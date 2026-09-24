import type { Degraded, ProjectRecord } from '@sidepiece/contract';
import { log as defaultLog, type Logger } from '../log.ts';
import { resolveProject } from '../registry/client.ts';
import { mintGeneration } from '../registry/generation.ts';
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
 * The resolver `mutatingRoute` re-resolves through on every mutation. Generation `0` means
 * "cannot validate" (DS-25), so it is answered with the DS-25 entry and the handler never runs.
 */
export function mutationResolver(options: ProjectRoutesOptions): MutationResolver {
  const current = currentProject(options);
  return async (pjid) => {
    const record = await current(pjid);
    if (record.generation < 1) {
      const ds25 = options.degraded?.().find((d) => d.ds === 'DS-25');
      throw new DegradedError(ds25 ?? { ds: 'DS-25' });
    }
    return record;
  };
}

/** `GET /v1/project/<pjid>`: the unwrapped Project Record, or `{"degraded":[DS-2]}`. */
export function projectRoutes(options: ProjectRoutesOptions): RouteTable {
  const current = currentProject(options);
  return {
    '/v1/project/:pjid': {
      GET: async (_req, { pjid }) => {
        if (pjid === undefined) throw new Error('route matched without a pjid');
        const record = await current(pjid);
        const body: ProjectRecord & { degraded: Degraded[] } = {
          ...record,
          degraded: [...(options.degraded?.() ?? [])],
        };
        return { status: 200, body };
      },
    },
  };
}
