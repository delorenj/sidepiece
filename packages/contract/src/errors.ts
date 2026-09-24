/**
 * Bridge error bodies: typed codes, never prose. A thrown message never reaches the wire.
 * Product-level failures are not errors; they are `200` with `degraded[]` populated.
 */
export type BridgeError =
  | { error: 'not_found'; path: string }
  | { error: 'method_not_allowed'; method: string; path: string }
  | { error: 'internal_error' };
