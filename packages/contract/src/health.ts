import type { Degraded } from './state.ts';

/**
 * The `GET /v1/health` body. Flat, keys in this order. Story 1.13 widens it with
 * `dependencies[]`; until then `degraded` is always empty on a healthy Bridge.
 */
export type BridgeHealth = {
  status: 'ok';
  contractVersion: number;
  /** `process.version` of the running Bridge, e.g. `v24.15.0`. */
  node: string;
  /** ISO 8601 UTC, when this Bridge process started. */
  startedAt: string;
  /** ISO 8601 UTC, when this answer was produced. */
  checkedAt: string;
  degraded: Degraded[];
};
