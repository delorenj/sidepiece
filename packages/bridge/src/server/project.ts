import type { Degraded, ProjectRecord } from '@sidepiece/contract';
import { log as defaultLog, type Logger } from '../log.ts';
import { resolveProject } from '../registry/client.ts';
import { mintGeneration } from '../registry/generation.ts';
import { probePaths } from '../registry/paths.ts';
import type { TurnStore } from '../turns/store.ts';
import { DegradedError } from './errors.ts';
import type { MutationResolver, RouteTable } from './http.ts';

export type ProjectRoutesOptions = {
  /** `SIDEPIECE_REGISTRY_URL`, already validated. */
  registryUrl: string;
  /** `undefined` under DS-25: the record is served with `generation: 0` (not minted). */
  store: TurnStore | undefined;
  /** Bridge-wide degraded states (e.g. DS-25), echoed on every record; read per request. */
  degraded?: () => Degraded[];
  /** The on-disk prober (DS-9/DS-10/DS-20) for GET only; injectable so tests pin `degraded`. */
  probePaths?: typeof probePaths;
  log?: Logger;
};

/**
 * A fresh resolution: one registry fetch plus a mint. Throws `DegradedError` for DS-2 and
 * DS-6/DS-7; under DS-25 (no store) the record carries `generation: 0`, unminted.
 */
export function currentProject(
  options: ProjectRoutesOptions,
): (pjid: string) => Promise<ProjectRecord> {
  const log = options.log ?? defaultLog;
  return async (pjid) => {
    const derived = await resolveProject(options.registryUrl, pjid);
    if (derived === undefined) throw new DegradedError({ ds: 'DS-2', params: { pjid } });
    const { generation, minted } =
      options.store === undefined
        ? { generation: 0, minted: false }
        : mintGeneration(options.store, derived);
    log({ level: 'info', event: 'resolved', pjid, generation, minted });
    return {
      pjid: derived.pjid,
      generation,
      repo: derived.repo,
      clonePath: derived.clonePath,
      boardId: derived.boardId,
      agents: derived.agents,
      ticketProvider: derived.ticketProvider,
    };
  };
}

/**
 * The resolver `mutatingRoute` re-resolves through on every mutation. With no store (DS-25)
 * nothing can be validated, so it answers the DS-25 entry without fetching and the handler
 * never runs. A store that still yields generation `0` is a Bridge bug (500).
 */
export function mutationResolver(options: ProjectRoutesOptions): MutationResolver {
  const current = currentProject(options);
  return async (pjid) => {
    if (options.store === undefined) {
      // DS-25: nothing can be validated, so nothing is fetched or resolved.
      const ds25 = options.degraded?.().find((d) => d.ds === 'DS-25');
      throw new DegradedError(ds25 ?? { ds: 'DS-25' });
    }
    const record = await current(pjid);
    if (record.generation < 1) {
      throw new Error(`minted generation ${record.generation} for ${pjid} with a store present`);
    }
    return record;
  };
}

/**
 * `GET /v1/project/<pjid>`: the unwrapped Project Record, or `{"degraded":[DS-2]}`. A served
 * record's `degraded` is the Bridge-wide entries, then the on-disk probe (DS-9/DS-10/DS-20).
 */
export function projectRoutes(options: ProjectRoutesOptions): RouteTable {
  const current = currentProject(options);
  const probe = options.probePaths ?? probePaths;
  return {
    '/v1/project/:pjid': {
      GET: async (_req, { pjid }) => {
        if (pjid === undefined) throw new Error('route matched without a pjid');
        const record = await current(pjid);
        const body: ProjectRecord & { degraded: Degraded[] } = {
          ...record,
          degraded: [...(options.degraded?.() ?? []), ...(await probe(record))],
        };
        return { status: 200, body };
      },
    },
  };
}
