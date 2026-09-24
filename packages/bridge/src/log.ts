import type { DsCode } from '@sidepiece/contract';

/**
 * Structured logs (A-P8): one JSON object per line on stdout, `{ts, level, event, ...}`.
 * `event` is a closed union, there is no free-form `msg`, and every `level:'error'` line
 * carries a `ds`, and so does every `level:'warn'` line. A caught error's own `.message` may ride as `detail`, verbatim.
 * `pjid` is top-level on Project-scoped lines.
 */
type Scoped = { pjid?: string };

type InfoLine = Scoped &
  (
    | {
        level: 'info';
        event: 'listening';
        host: string;
        port: number;
        contractVersion: number;
        node: string;
      }
    | {
        level: 'info';
        event: 'request';
        method: string;
        path: string;
        status: number;
        durationMs: number;
        client: string;
      }
    | { level: 'info'; event: 'shutdown'; signal: string }
    | {
        level: 'info';
        event: 'store_opened';
        path: string;
        userVersion: number;
        migratedFrom: number;
      }
    /** `minted` is false for an unchanged hash and under DS-25 (`generation: 0`). */
    | { level: 'info'; event: 'resolved'; pjid: string; generation: number; minted: boolean }
    /** A mutation written against an older generation, answered `409 stale_generation`. */
    | {
        level: 'info';
        event: 'mutation_refused';
        pjid: string;
        received: number;
        current: number;
      }
    /** A mutation refused before anything was compared: `400` with a typed `error` code. */
    | { level: 'info'; event: 'mutation_rejected'; pjid?: string; error: string }
  );

type ErrorLine = Scoped &
  (
    | {
        level: 'error';
        event: 'listen_failed';
        ds: DsCode;
        host: string;
        port: number;
        code?: string;
        detail?: string;
      }
    | { level: 'error'; event: 'config_invalid'; ds: DsCode; key: string; value: string }
    | {
        level: 'error';
        event: 'handler_failed';
        ds: DsCode;
        method: string;
        path: string;
        detail?: string;
      }
    | { level: 'error'; event: 'store_open_failed'; ds: DsCode; path: string; detail?: string }
    | {
        level: 'error';
        event: 'handler_timed_out';
        ds: DsCode;
        method: string;
        path: string;
        deadlineMs: number;
      }
    /** D11: a received generation this Bridge never minted; a Bridge bug, answered 500. */
    | {
        level: 'error';
        event: 'generation_ahead_of_bridge';
        ds: DsCode;
        pjid: string;
        received: number;
        current: number;
      }
    /** The registry answered, but its last good copy could not be written; the fetch stands. */
    | { level: 'error'; event: 'snapshot_write_failed'; ds: DsCode; path: string; detail: string }
  );

type WarnLine = Scoped &
  /** A product-level failure answered as `200 {"degraded":[...]}`: the Bridge worked, the Project did not. */
  (
    | { level: 'warn'; event: 'degraded'; ds: DsCode; method: string; path: string }
    /** DS-25: the Turn store is at a `user_version` this build does not recognise; left untouched. */
    | {
        level: 'warn';
        event: 'store_ahead';
        ds: DsCode;
        path: string;
        storeVersion: number;
        bridgeVersion: number;
      }
    /** DS-23: the registry did not answer; the record came from its last good copy (logged instead of `resolved`). */
    | {
        level: 'warn';
        event: 'served_from_snapshot';
        ds: DsCode;
        pjid: string;
        generation: number;
        fetchedAt: string;
        ageSeconds: number;
      }
    /** The registry did not answer and its last good copy could not be read; `ds` is the cause. */
    | { level: 'warn'; event: 'snapshot_unreadable'; ds: DsCode; path: string; detail: string }
  );

export type LogLine = InfoLine | WarnLine | ErrorLine;
export type LogEvent = LogLine['event'];
export type Logger = (line: LogLine) => void;

// Compile-time guarantee that no failure line (warn or error) can omit `ds`. Non-distributive:
// any failure variant without a required `ds` makes the tuple check false and this line fails.
type FailureWithoutDs = Exclude<Extract<LogLine, { level: 'warn' | 'error' }>, { ds: DsCode }>;
const _everyFailureLineCarriesDs: [FailureWithoutDs] extends [never] ? true : false = true;
void _everyFailureLineCarriesDs;

export const log: Logger = (line) => {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...line })}\n`);
};
