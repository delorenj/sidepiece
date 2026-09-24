import type { Degraded, ProjectRecord } from '@sidepiece/contract';
import { log as defaultLog, type Logger } from '../log.ts';
import { resolveProject } from '../registry/client.ts';
import { mintGeneration } from '../registry/generation.ts';
import type { TurnStore } from '../turns/store.ts';
import { DegradedError } from './errors.ts';
import type { RouteTable } from './http.ts';

export type ProjectRoutesOptions = {
  /** `SIDEPIECE_REGISTRY_URL`, already validated. */
  registryUrl: string;
  /** `undefined` under DS-25: the record is served with `generation: 0` (not minted). */
  store: TurnStore | undefined;
  /** Bridge-wide degraded states (e.g. DS-25), echoed on every record; read per request. */
  degraded?: () => Degraded[];
  log?: Logger;
};

/** `GET /v1/project/<pjid>`: the unwrapped Project Record, or `{"degraded":[DS-2]}`. */
export function projectRoutes(options: ProjectRoutesOptions): RouteTable {
  const log = options.log ?? defaultLog;
  return {
    '/v1/project/:pjid': {
      GET: async (_req, { pjid }) => {
        if (pjid === undefined) throw new Error('route matched without a pjid');
        const derived = await resolveProject(options.registryUrl, pjid);
        if (derived === undefined) throw new DegradedError({ ds: 'DS-2', params: { pjid } });
        const { generation, minted } =
          options.store === undefined
            ? { generation: 0, minted: false }
            : mintGeneration(options.store, derived);
        log({ level: 'info', event: 'resolved', pjid, generation, minted });
        const body: ProjectRecord & { degraded: Degraded[] } = {
          pjid: derived.pjid,
          generation,
          repo: derived.repo,
          clonePath: derived.clonePath,
          boardId: derived.boardId,
          agents: derived.agents,
          ticketProvider: derived.ticketProvider,
          degraded: [...(options.degraded?.() ?? [])],
        };
        return { status: 200, body };
      },
    },
  };
}
