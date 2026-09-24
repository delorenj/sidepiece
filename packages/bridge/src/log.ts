import type { DsCode } from '@sidepiece/contract';

/**
 * Structured logs (A-P8): one JSON object per line on stdout, `{ts, level, event, ...}`.
 * `event` is a closed union, there is no free-form `msg`, and every `level:'error'` line
 * carries a `ds`. A caught error's own `.message` may ride as `detail`, verbatim.
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
  );

export type LogLine = InfoLine | ErrorLine;
export type LogEvent = LogLine['event'];
export type Logger = (line: LogLine) => void;

// Compile-time guarantee that no error line can omit `ds`.
type RequiresDs<T> = T extends { level: 'error' }
  ? T extends { ds: DsCode }
    ? true
    : never
  : true;
const _everyErrorLineCarriesDs: RequiresDs<LogLine> = true;
void _everyErrorLineCarriesDs;

export const log: Logger = (line) => {
  process.stdout.write(`${JSON.stringify({ ts: new Date().toISOString(), ...line })}\n`);
};
