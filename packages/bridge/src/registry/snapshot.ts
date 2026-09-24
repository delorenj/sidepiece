import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { log as defaultLog, type Logger } from '../log.ts';

/**
 * The registry's last good copy (architecture D5): `<state-dir>/registry-snapshot.json`, a
 * file and never a table. Rewritten whole on every successful fetch; read only when the
 * registry does not answer. Its age is reported (DS-23) and never enforced.
 */

export const SNAPSHOT_FILE = 'registry-snapshot.json';

/** The file's body, in key order. `payload` is the parsed registry answer, verbatim. */
export type SnapshotCopy = { fetchedAt: string; payload: unknown };

export type RegistrySnapshot = {
  readonly path: string;
  /** Replace the file atomically with `payload`, stamped now. Never throws; logs a failure. */
  write(payload: unknown): void;
  /** The copy, or `undefined` when there is none. Throws when the file is unreadable. */
  read(): SnapshotCopy | undefined;
  /** The clock `fetchedAt` is stamped from and ages are measured against. */
  now(): Date;
};

export type OpenSnapshotOptions = { now?: () => Date; log?: Logger };

/** Whole seconds since `fetchedAt`, floored, never negative (a clock stepped back is age 0). */
export function snapshotAge(fetchedAt: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(fetchedAt)) / 1000));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function openSnapshot(
  stateDir: string,
  options: OpenSnapshotOptions = {},
): RegistrySnapshot {
  const now = options.now ?? (() => new Date());
  const log = options.log ?? defaultLog;
  const path = join(stateDir, SNAPSHOT_FILE);
  const temp = `${path}.${process.pid}.tmp`;
  return {
    path,
    now,
    write(payload) {
      const copy: SnapshotCopy = { fetchedAt: now().toISOString(), payload };
      try {
        writeFileSync(temp, JSON.stringify(copy), { mode: 0o600 });
        renameSync(temp, path);
      } catch (err) {
        try {
          rmSync(temp, { force: true });
        } catch {
          // the write already failed; a leftover temp file is never read
        }
        log({
          level: 'error',
          event: 'snapshot_write_failed',
          ds: 'DS-5',
          path,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    },
    read() {
      let text: string;
      try {
        text = readFileSync(path, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw err;
      }
      const parsed: unknown = JSON.parse(text);
      if (!isObject(parsed) || !Object.hasOwn(parsed, 'payload')) {
        throw new Error('snapshot has no payload');
      }
      const { fetchedAt, payload } = parsed;
      if (typeof fetchedAt !== 'string' || Number.isNaN(Date.parse(fetchedAt))) {
        throw new Error('snapshot fetchedAt is not a valid date');
      }
      return { fetchedAt, payload };
    },
  };
}
