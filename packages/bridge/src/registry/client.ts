import { posix } from 'node:path';
import type { AgentBinding, Degraded, ProjectRecord } from '@sidepiece/contract';
import { DegradedError } from '../server/errors.ts';
import { sortAgents } from './generation.ts';

/**
 * The pjangler Registry client (architecture D5). The ONLY module that spells the registry's
 * foreign names; each is renamed on read. One `GET /v1/registry` per resolution, indexed
 * whole: no per-pjid endpoint exists, and no in-memory cache (it would hide a rename).
 */

export const REGISTRY_TIMEOUT_MS = 2_000;

/** A Project Record before its generation is minted. */
export type DerivedRecord = Omit<ProjectRecord, 'generation'>;

type Entry = Record<string, unknown>;
/** Every registry entry, by pjid, matched byte for byte. */
export type RegistryIndex = ReadonlyMap<string, Entry>;

/** The registry could not be reached: refused, DNS, timeout (DS-6). */
export class RegistryUnreachable extends Error {}
/** The registry answered, but not with something this build can read (DS-7). */
export class RegistryUnparseable extends Error {}

/**
 * The one discriminator between DS-6 and DS-7, shared by resolution and (Story 1.13) health.
 * `undefined` means `err` is not a registry failure at all.
 */
export function registryFailure(err: unknown, endpoint: string): Degraded | undefined {
  if (err instanceof RegistryUnreachable) return { ds: 'DS-6', params: { endpoint } };
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
    if (typeof pjid === 'string') index.set(pjid, entry);
  }
  return index;
}

/** `GET <url>/v1/registry`, whole, under {@link REGISTRY_TIMEOUT_MS}. */
export async function fetchRegistry(url: string): Promise<RegistryIndex> {
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
  return indexRegistry(payload);
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The record for one registry entry. A `repo_path` that is not a non-empty string is DS-7. */
export function deriveRecord(pjid: string, entry: Entry): DerivedRecord {
  const { repo_path: repoPath, agents: rawAgents, ticket_provider: rawProvider } = entry;
  if (typeof repoPath !== 'string' || repoPath === '') {
    throw new RegistryUnparseable(`${pjid}: repo_path is not a non-empty string`);
  }
  const { type, board_id: rawBoard } = isObject(rawProvider) ? rawProvider : {};
  const agents: AgentBinding[] = Object.entries(isObject(rawAgents) ? rawAgents : {}).map(
    ([id, agent]) => {
      const { role, role_dir: roleDir } = isObject(agent) ? agent : {};
      return { id, role: str(role), roleDir: str(roleDir) };
    },
  );
  return {
    pjid,
    repo: posix.basename(repoPath),
    clonePath: repoPath,
    boardId: str(rawBoard),
    agents: sortAgents(agents),
    ticketProvider: { type: str(type) },
  };
}

/**
 * Resolve a pjid against a fresh copy of the registry. `undefined` is an unknown pjid (DS-2,
 * the caller's to answer). A registry failure is thrown as a {@link DegradedError}.
 */
export async function resolveProject(
  url: string,
  pjid: string,
): Promise<DerivedRecord | undefined> {
  try {
    const entry = (await fetchRegistry(url)).get(pjid);
    return entry === undefined ? undefined : deriveRecord(pjid, entry);
  } catch (err) {
    const degraded = registryFailure(err, url);
    if (degraded !== undefined) throw new DegradedError(degraded);
    throw err;
  }
}
