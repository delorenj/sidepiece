import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
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

/** How long an open or a `BEGIN IMMEDIATE` waits on another connection's lock. */
const BUSY_TIMEOUT_MS = 5_000;

export type ColumnInfo = { name: string; type: string; notNull: boolean; primaryKey: boolean };
export type TableInfo = { name: string; sql: string; columns: ColumnInfo[] };
/** Every schema object SQLite did not create itself (tables, indexes, triggers, views). */
export type SchemaObject = { type: string; name: string; tableName: string; sql: string };

/** One `resolutions` row: the generation minted for a pjid and the hash it was minted from. */
export type Resolution = {
  pjid: string;
  generation: number;
  recordHash: string;
  /** ISO 8601 UTC: when the current generation was minted (not the last re-resolution). */
  resolvedAt: string;
  clonePath: string;
  boardId: string;
};

export type TurnStore = {
  readonly path: string;
  userVersion(): number;
  inspect(): { tables: TableInfo[]; objects: SchemaObject[] };
  /** The row for a pjid, or `undefined`. Throws on an empty or non-string pjid (DW-3). */
  readResolution(pjid: string): Resolution | undefined;
  /** Insert or replace the row for `row.pjid`. Throws on an empty or non-string pjid (DW-3). */
  writeResolution(row: Resolution): void;
  /** Run `fn` inside one `BEGIN IMMEDIATE` transaction: committed on return, rolled back on throw. */
  transaction<T>(fn: () => T): T;
  close(): void;
};

export type StoreOpen =
  | { kind: 'ready'; store: TurnStore; migratedFrom: number }
  /** DS-25: nothing was read but the pragma, nothing migrated, nothing written. */
  | { kind: 'ahead'; path: string; storeVersion: number; bridgeVersion: number };

export type OpenStoreOptions = {
  /** Tests only: replaces the migrations this build carries. */
  migrations?: readonly string[];
  /** Tests only: runs before each migration step's `BEGIN IMMEDIATE`. */
  beforeStep?: () => void;
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
  const unrecognised = (v: number) => v > bridgeVersion || v < 0;

  // The version check reads only the pragma, on a read-only handle: a writable handle would
  // checkpoint a leftover `-wal` into the main file on close, which is a write to a store this
  // build does not understand. An ahead store may keep its `-wal`/`-shm`; its main file is
  // byte-identical.
  if (existsSync(path)) {
    const probe = new DatabaseSync(path, { readOnly: true, timeout: BUSY_TIMEOUT_MS });
    let storeVersion: number;
    try {
      storeVersion = readUserVersion(probe);
    } finally {
      probe.close();
    }
    if (unrecognised(storeVersion)) {
      return { kind: 'ahead', path, storeVersion, bridgeVersion };
    }
  }

  const db = new DatabaseSync(path, { timeout: BUSY_TIMEOUT_MS });
  try {
    const migratedFrom = readUserVersion(db);
    if (unrecognised(migratedFrom)) {
      // Moved ahead between the probe and this open (another Bridge). Nothing was written.
      db.close();
      return { kind: 'ahead', path, storeVersion: migratedFrom, bridgeVersion };
    }
    db.exec('PRAGMA journal_mode = WAL');
    // One step per transaction. The version is re-read under the write lock, so a step another
    // process already applied is skipped, never re-run.
    for (;;) {
      options.beforeStep?.();
      db.exec('BEGIN IMMEDIATE');
      let current: number;
      try {
        current = readUserVersion(db);
        if (unrecognised(current)) {
          db.exec('ROLLBACK');
          db.close();
          return { kind: 'ahead', path, storeVersion: current, bridgeVersion };
        }
        if (current === bridgeVersion) {
          db.exec('COMMIT');
          break;
        }
        const sql = migrations[current];
        if (sql === undefined || sql.trim() === '') {
          throw new Error(`migration ${current + 1} missing`);
        }
        db.exec(sql);
        db.exec(`PRAGMA user_version = ${current + 1}`);
        db.exec('COMMIT');
      } catch (err) {
        if (db.isOpen && db.isTransaction) {
          try {
            db.exec('ROLLBACK');
          } catch {
            // the original error is the one worth reporting
          }
        }
        throw err;
      }
    }
    return { kind: 'ready', store: wrap(db, path), migratedFrom };
  } catch (err) {
    if (db.isOpen) db.close();
    throw err;
  }
}

/** DW-3: `resolutions.pjid` is nullable in SQLite, so no caller may ever bind a null or empty one. */
function assertPjid(pjid: unknown): asserts pjid is string {
  if (typeof pjid !== 'string' || pjid === '') {
    throw new TypeError(
      `resolutions: pjid must be a non-empty string, got ${JSON.stringify(pjid)}`,
    );
  }
}

type ResolutionRow = {
  pjid: string;
  generation: number;
  record_hash: string;
  resolved_at: string;
  clone_path: string | null;
  board_id: string | null;
};

function wrap(db: DatabaseSync, path: string): TurnStore {
  // Prepared on first use: a test store opened with substitute migrations has no such table.
  let select: StatementSync | undefined;
  let upsert: StatementSync | undefined;
  const selectResolution = () =>
    (select ??= db.prepare(
      'SELECT pjid, generation, record_hash, resolved_at, clone_path, board_id FROM resolutions WHERE pjid = ?',
    ));
  const upsertResolution = () =>
    (upsert ??= db.prepare(
      `INSERT INTO resolutions (pjid, generation, record_hash, resolved_at, clone_path, board_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (pjid) DO UPDATE SET
       generation = excluded.generation,
       record_hash = excluded.record_hash,
       resolved_at = excluded.resolved_at,
       clone_path = excluded.clone_path,
       board_id = excluded.board_id`,
    ));
  return {
    path,
    readResolution: (pjid) => {
      assertPjid(pjid);
      const row = selectResolution().get(pjid) as ResolutionRow | undefined;
      if (row === undefined) return undefined;
      return {
        pjid: row.pjid,
        generation: row.generation,
        recordHash: row.record_hash,
        resolvedAt: row.resolved_at,
        clonePath: row.clone_path ?? '',
        boardId: row.board_id ?? '',
      };
    },
    writeResolution: (row) => {
      assertPjid(row.pjid);
      upsertResolution().run(
        row.pjid,
        row.generation,
        row.recordHash,
        row.resolvedAt,
        row.clonePath,
        row.boardId,
      );
    },
    transaction: (fn) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (err) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw err;
      }
    },
    userVersion: () => readUserVersion(db),
    inspect: () => {
      const tables = db
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string; sql: string }[];
      const columnsOf = db.prepare('SELECT * FROM pragma_table_info(?)');
      const objects = db
        .prepare(
          "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
        )
        .all() as { type: string; name: string; tbl_name: string; sql: string | null }[];
      return {
        tables: tables.map(({ name, sql }) => ({
          name,
          sql,
          columns: (
            columnsOf.all(name) as { name: string; type: string; notnull: number; pk: number }[]
          ).map((c) => ({
            name: c.name,
            type: c.type,
            notNull: c.notnull === 1,
            primaryKey: c.pk > 0,
          })),
        })),
        objects: objects.map((o) => ({
          type: o.type,
          name: o.name,
          tableName: o.tbl_name,
          sql: o.sql ?? '',
        })),
      };
    },
    close: () => {
      if (db.isOpen) db.close();
    },
  };
}
