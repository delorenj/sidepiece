-- The cumulative current schema of turns.db (AR26), at user_version 1.
-- A REFERENCE ONLY: the store never executes this file. It applies the numbered
-- migrations under ./migrations, forward-only. `schema.test.ts` proves that migrating a
-- fresh DB yields exactly the sqlite_master SQL below, so a new migration must update
-- this file in the same change, statement for statement.
CREATE TABLE resolutions (
  pjid TEXT PRIMARY KEY,
  generation INTEGER NOT NULL,
  record_hash TEXT NOT NULL,
  resolved_at TEXT NOT NULL,
  clone_path TEXT,
  board_id TEXT
);
