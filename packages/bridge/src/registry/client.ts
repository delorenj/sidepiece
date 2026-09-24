import { posix } from 'node:path';
import type { AgentBinding, Degraded, ProjectRecord } from '@sidepiece/contract';
import { log as defaultLog, type Logger } from '../log.ts';
import { DegradedError } from '../server/errors.ts';
import { sortAgents } from './generation.ts';
import { type RegistrySnapshot, snapshotAge } from './snapshot.ts';

/**
 * The pjangler Registry client (architecture D5). The ONLY module that spells the registry's
 * foreign names; each is renamed on read. One `GET /v1/registry` per resolution, indexed
 * whole: no per-pjid endpoint exists, and no in-memory cache (it would hide a rename).
 */

export const REGISTRY_TIMEOUT_MS = 2_000;

/** The systemd user unit that serves the registry on this host. */
export const REGISTRY_UNIT = 'pjangler-project-registry.service';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
/** The rest of 127.0.0.0/8, e.g. Debian's `127.0.1.1`. */
const LOOPBACK_V4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

/** A Project Record before its generation is minted. */
export type DerivedRecord = Omit<ProjectRecord, 'generation'>;

type Entry = Record<string, unknown>;
/** Every registry entry, by pjid, matched byte for byte. */
export type RegistryIndex = ReadonlyMap<string, Entry>;

/** The registry could not be reached: refused, DNS, timeout (DS-6). */
export class RegistryUnreachable extends Error {}
/** The registry answered, but not with something this build can read (DS-7). */
export class RegistryUnparseable extends Error {}

/** A registry on this host can be started; one elsewhere cannot be from here. */
function isLoopback(endpoint: string): boolean {
  try {
    const { hostname } = new URL(endpoint);
    return LOOPBACK.has(hostname) || LOOPBACK_V4.test(hostname);
  } catch {
    return false;
  }
}

/**
 * The one discriminator between DS-6 and DS-7, shared by resolution and health. DS-6 names
 * the unit to start only when the registry is on loopback. `undefined` means `err` is not a
 * registry failure at all.
 */
export function registryFailure(err: unknown, endpoint: string): Degraded | undefined {
  if (err instanceof RegistryUnreachable) {
    return isLoopback(endpoint)
      ? { ds: 'DS-6', params: { endpoint }, remedy: `systemctl --user start ${REGISTRY_UNIT}` }
      : { ds: 'DS-6', params: { endpoint } };
  }
  if (err instanceof RegistryUnparseable) return { ds: 'DS-7', params: { error: err.message } };
  return undefined;
}

function isObject(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Index every entry of `payload.projects` by its identifier, renamed to `pjid` on read. */
export function indexRegistry(payload: unknown): RegistryIndex {
  if (!isObject(payload) || !isObject(payload.projects)) {
    throw new RegistryUnparseable('registry answer has no projects object');
  }
  const index = new Map<string, Entry>();
  for (const entry of Object.values(payload.projects)) {
    if (!isObject(entry)) continue;
    const { project_id: pjid } = entry;
    if (typeof pjid !== 'string') continue;
    // Last-wins would silently pick one of two Projects; the answer is not trustworthy.
    if (index.has(pjid)) throw new RegistryUnparseable(`duplicate pjid in registry: ${pjid}`);
    index.set(pjid, entry);
  }
  return index;
}

/**
 * `GET <url>/v1/registry`, whole, under {@link REGISTRY_TIMEOUT_MS}. An answer that indexes
 * cleanly is written to `snapshot` as the last good copy, whoever asked.
 */
export async function fetchRegistry(
  url: string,
  snapshot?: RegistrySnapshot,
): Promise<RegistryIndex> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${url}/v1/registry`, { signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS) });
    text = await res.text();
  } catch (err) {
    throw new RegistryUnreachable(err instanceof Error ? err.message : String(err));
  }
  if (!res.ok) throw new RegistryUnparseable(`${res.status} ${res.statusText}`.trim());
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch (err) {
    throw new RegistryUnparseable(err instanceof Error ? err.message : String(err));
  }
  const index = indexRegistry(payload);
  snapshot?.write(payload);
  return index;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The agents object, validated: a malformed binding is DS-7, never coerced to `''`. */
function agentsOf(pjid: string, rawAgents: unknown): AgentBinding[] {
  if (rawAgents === undefined) return [];
  if (!isObject(rawAgents)) throw new RegistryUnparseable(`${pjid}: agents is not an object`);
  return Object.entries(rawAgents).map(([id, agent]) => {
    if (!isObject(agent)) throw new RegistryUnparseable(`${pjid}: agent ${id} is not an object`);
    const { role, role_dir: roleDir } = agent;
    if (typeof role !== 'string' || typeof roleDir !== 'string') {
      throw new RegistryUnparseable(`${pjid}: agent ${id} role or role_dir is not a string`);
    }
    return { id, role, roleDir };
  });
}

/**
 * The record for one registry entry. DS-7 when `repo_path` is not a non-empty string or has
 * no basename, or when the agents are malformed. Missing `ticket_provider` fields are `''`.
 */
export function deriveRecord(pjid: string, entry: Entry): DerivedRecord {
  const { repo_path: repoPath, agents: rawAgents, ticket_provider: rawProvider } = entry;
  if (typeof repoPath !== 'string' || repoPath === '') {
    throw new RegistryUnparseable(`${pjid}: repo_path is not a non-empty string`);
  }
  const repo = posix.basename(repoPath);
  if (repo === '') throw new RegistryUnparseable(`${pjid}: repo_path has no basename`);
  const { type, board_id: rawBoard } = isObject(rawProvider) ? rawProvider : {};
  const agents = agentsOf(pjid, rawAgents);
  return {
    pjid,
    repo,
    clonePath: repoPath,
    boardId: str(rawBoard),
    agents: sortAgents(agents),
    ticketProvider: { type: str(type) },
  };
}

/** Why and from how old a copy a record was served while the registry did not answer. */
export type ServedFromSnapshot = { fetchedAt: string; ageSeconds: number; cause: Degraded };

/** `record` is `undefined` for an unknown pjid; `served` is set only for a snapshot answer. */
export type Resolved = { record: DerivedRecord | undefined; served?: ServedFromSnapshot };

export type ResolveOptions = {
  /** Written on every successful fetch. */
  snapshot?: RegistrySnapshot;
  /** GET only: when the fetch itself fails, answer from `snapshot`. Never for a mutation. */
  fallback?: boolean;
  log?: Logger;
};

/**
 * The snapshot's record for `pjid`, or the registry failure `cause` thrown as-is: no copy, a
 * copy without the pjid (never DS-2 while the registry is down) or an unreadable copy.
 */
function fromSnapshot(
  snapshot: RegistrySnapshot,
  pjid: string,
  cause: Degraded,
  log: Logger,
): Resolved {
  let entry: Entry | undefined;
  let fetchedAt: string;
  try {
    const copy = snapshot.read();
    if (copy === undefined) throw new DegradedError(cause);
    fetchedAt = copy.fetchedAt;
    entry = indexRegistry(copy.payload).get(pjid);
  } catch (err) {
    // Only a file that cannot be read is unreadable; no copy at all logs nothing more.
    if (!(err instanceof DegradedError)) {
      log({
        level: 'warn',
        event: 'snapshot_unreadable',
        ds: cause.ds,
        path: snapshot.path,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
    throw new DegradedError(cause);
  }
  // A pjid the copy lacks, or an entry it cannot derive, is the cause alone, like no copy.
  if (entry === undefined) throw new DegradedError(cause);
  let record: DerivedRecord;
  try {
    record = deriveRecord(pjid, entry);
  } catch (err) {
    if (err instanceof RegistryUnparseable) throw new DegradedError(cause);
    throw err;
  }
  return {
    record,
    served: { fetchedAt, ageSeconds: snapshotAge(fetchedAt, snapshot.now()), cause },
  };
}

/**
 * Resolve a pjid against a fresh copy of the registry. `record: undefined` is an unknown pjid
 * (DS-2, the caller's to answer). A registry failure is thrown as a {@link DegradedError},
 * unless `fallback` finds the pjid in the snapshot. A bad entry in a fetched registry is plain
 * DS-7 with no fallback: the registry answered.
 */
export async function resolveProject(
  url: string,
  pjid: string,
  options: ResolveOptions = {},
): Promise<Resolved> {
  let index: RegistryIndex | undefined;
  try {
    index = await fetchRegistry(url, options.snapshot);
    const entry = index.get(pjid);
    return { record: entry === undefined ? undefined : deriveRecord(pjid, entry) };
  } catch (err) {
    const cause = registryFailure(err, url);
    if (cause === undefined) throw err;
    if (index !== undefined || !options.fallback || options.snapshot === undefined) {
      throw new DegradedError(cause);
    }
    return fromSnapshot(options.snapshot, pjid, cause, options.log ?? defaultLog);
  }
}
