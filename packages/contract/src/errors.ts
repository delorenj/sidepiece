/**
 * Bridge error bodies: typed codes, never prose. A thrown message never reaches the wire.
 * Product-level failures are not errors; they are `200` with `degraded[]` populated.
 */
export type BridgeError =
  | { error: 'not_found'; path: string }
  | { error: 'method_not_allowed'; method: string; path: string }
  | { error: 'internal_error' }
  /** A mutation whose body has no top-level `generation`; a header never counts. */
  | { error: 'missing_generation'; pjid: string; field: 'generation' }
  /** `generation` present but not a safe integer ≥ 0. */
  | { error: 'invalid_generation'; pjid: string; field: 'generation' }
  /** A mutation body that is not JSON, not a plain object, or over the size cap. */
  | { error: 'invalid_body'; pjid: string };
