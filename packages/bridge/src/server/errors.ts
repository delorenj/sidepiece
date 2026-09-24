import type { BridgeError, Degraded, Refusal } from '@sidepiece/contract';
import { StaleGenerationError } from '../registry/generation.ts';

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

/** Thrown when the request itself is refused before anything is compared: a typed `400`. */
export class HttpRefusal extends Error {
  readonly status: 400;
  readonly body: BridgeError;
  constructor(status: 400, body: BridgeError) {
    super(body.error);
    this.name = 'HttpRefusal';
    this.status = status;
    this.body = body;
  }
}

export type ErrorResponse =
  | { status: 200; body: { degraded: Degraded[] } }
  | { status: 400; body: BridgeError }
  | { status: 409; body: Refusal }
  | { status: 500; body: BridgeError };

/**
 * UX-DR51: map anything a handler throws to a typed body. The thrown message never reaches
 * the wire; it may only ride in the log line as `detail`.
 */
export function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof DegradedError) return { status: 200, body: { degraded: [err.degraded] } };
  if (err instanceof StaleGenerationError) return { status: 409, body: err.refusal };
  if (err instanceof HttpRefusal) return { status: err.status, body: err.body };
  return { status: 500, body: { error: 'internal_error' } };
}
