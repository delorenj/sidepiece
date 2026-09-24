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
