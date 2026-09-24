import type { BridgeError, Degraded } from '@sidepiece/contract';

/**
 * Thrown by a handler when the answer is a product-level failure: it becomes
 * `200 {"degraded":[d]}`, never a 5xx.
 */
export class DegradedError extends Error {
  readonly degraded: Degraded;
  constructor(degraded: Degraded) {
    super(degraded.ds);
    this.name = 'DegradedError';
    this.degraded = degraded;
  }
}

export type ErrorResponse =
  | { status: 200; body: { degraded: Degraded[] } }
  | { status: 500; body: BridgeError };

/**
 * UX-DR51: map anything a handler throws to a typed body. The thrown message never reaches
 * the wire; it may only ride in the log line as `detail`.
 */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof DegradedError) return { status: 200, body: { degraded: [err.degraded] } };
  return { status: 500, body: { error: 'internal_error' } };
}
