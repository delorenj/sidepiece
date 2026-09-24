import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import m001 from '../db/migrations/001_resolutions.sql';

/**
 * The Turn store (AR26–AR31, architecture D7). The ONLY module that imports `node:sqlite`,
 * and the only place the snake_case ↔ camelCase mapping happens. See `../db/README.md` for
 * the migration contract.
 */

/** The migrations this build carries, in order; migration `i` moves `user_version` i → i+1. */
const MIGRATIONS: readonly string[] = [m001];

/** The number of migrations this build carries. Not `CONTRACT_VERSION`. */
export const BRIDGE_STORE_VERSION = MIGRATIONS.length;

export const STORE_FILE = 'turns.db';

export type ColumnInfo = { name: string; type: string; notNull: boolean; primaryKey: boolean };
export type TableInfo = { name: string; sql: string; columns: ColumnInfo[] };

export type TurnStore = {
  readonly path: string;
  userVersion(): number;
  inspect(): { tables: TableInfo[] };
  close(): void;
};

export type StoreOpen =
  | { kind: 'ready'; store: TurnStore; migratedFrom: number }
  /** DS-25: nothing was read but the pragma, nothing migrated, nothing written. */
  | { kind: 'ahead'; path: string; storeVersion: number; bridgeVersion: number };

export type OpenStoreOptions = {
  /** Tests only: replaces the migrations this build carries. */
  migrations?: readonly string[];
};

function readUserVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  if (row === undefined) throw new Error('PRAGMA user_version returned no row');
  return row.user_version;
}

/**
 * Open `<stateDir>/turns.db`, creating the directory (0700) and the file as needed, and
 * migrate it forward. A store ahead of this build (or at a negative version) is left
 * byte-for-byte untouched and reported as `ahead`. Throws when the store cannot be opened
 * or a migration fails; a failed migration is rolled back first.
 */
export function openStore(stateDir: string, options: OpenStoreOptions = {}): StoreOpen {
  const migrations = options.migrations ?? MIGRATIONS;
  const bridgeVersion = migrations.length;
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const path = join(stateDir, STORE_FILE);

  const db = new DatabaseSync(path);
  try {
    // The version check reads only the pragma. An unrecognised store is closed untouched: no
    // migration, no WAL switch, no schema read. (A read-only handle is deliberately NOT used:
    // on a WAL-mode file it leaves `-wal`/`-shm` behind, where a writable handle removes them
    // on close without writing to the main file.)
    const migratedFrom = readUserVersion(db);
    if (migratedFrom > bridgeVersion || migratedFrom < 0) {
      db.close();
      return { kind: 'ahead', path, storeVersion: migratedFrom, bridgeVersion };
    }
    db.exec('PRAGMA journal_mode = WAL');
    for (let v = migratedFrom; v < bridgeVersion; v++) {
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec(migrations[v] ?? '');
        db.exec(`PRAGMA user_version = ${v + 1}`);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }
    return { kind: 'ready', store: wrap(db, path), migratedFrom };
  } catch (err) {
    if (db.isOpen) db.close();
    throw err;
  }
}

function wrap(db: DatabaseSync, path: string): TurnStore {
  return {
    path,
    userVersion: () => readUserVersion(db),
    inspect: () => {
      const tables = db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string; sql: string }[];
      return {
        tables: tables.map(({ name, sql }) => ({
          name,
          sql,
          columns: (
            db.prepare(`PRAGMA table_info(${JSON.stringify(name)})`).all() as {
              name: string;
              type: string;
              notnull: number;
              pk: number;
            }[]
          ).map((c) => ({
            name: c.name,
            type: c.type,
            notNull: c.notnull === 1,
            primaryKey: c.pk > 0,
          })),
        })),
      };
    },
    close: () => {
      if (db.isOpen) db.close();
    },
  };
}
