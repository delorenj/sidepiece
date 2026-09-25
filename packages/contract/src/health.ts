import type { BridgeDsCode, Degraded } from './state.ts';

/**
 * Every upstream `/v1/health` reports on, one row each, in this order. A name with no probe
 * registered reports `unprobed`, never `ok`.
 */
export const DEPENDENCY_NAMES = [
  'registry',
  'store',
  'vault',
  'fleet',
  'gateway',
  'plane',
  'bloodbank',
  'candystore',
] as const;

export type DependencyName = (typeof DEPENDENCY_NAMES)[number];

/**
 * One row of `dependencies[]`. A `failing` row always carries the `BridgeDsCode` that names
 * the failure; `detail`, when present, is the upstream's own error text, verbatim.
 */
export type DependencyHealth =
  | { name: DependencyName; status: 'ok'; checkedAt: string; latencyMs: number }
  | {
      name: DependencyName;
      status: 'failing';
      ds: BridgeDsCode;
      detail?: string;
      checkedAt: string;
      latencyMs: number;
    }
  | { name: DependencyName; status: 'unprobed'; checkedAt: string };

/**
 * The `GET /v1/health` body. Flat, keys in this order. `status` means the Bridge answered;
 * the per-upstream truth is in `dependencies`, and `degraded` is derived from those rows
 * (plus DS-15 when `relayed`).
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
  /** The caller's tailnet path is relayed through DERP (DS-15). */
  relayed: boolean;
  dependencies: DependencyHealth[];
  degraded: Degraded[];
};
