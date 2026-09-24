# `turns.db` — the Turn store

The Bridge's one SQLite database, at `$SIDEPIECE_STATE_DIR/turns.db` (default
`~/.local/state/sidepiece/turns.db`), never inside the deploy tree
(`~/.local/lib/sidepiece/`). `src/turns/store.ts` is the only module that opens it and
the only module that imports the SQLite driver.

## Files

- `migrations/NNN_<name>.sql` — the numbered, forward-only migrations. The store applies
  them in order at startup.
- `schema.sql` — the cumulative current schema. It is a reference: the store never
  executes it. `schema.test.ts` proves that migrating a fresh DB yields the same
  `sqlite_master` SQL, so it is updated in the same change as every new migration.

## The migration contract (AR26–AR30)

1. **Forward-only and numbered.** `001_`, `002_`, … There are no down-migrations. Each
   migration runs in its own `BEGIN IMMEDIATE … COMMIT` together with
   `PRAGMA user_version = n`, so each advances `user_version` by exactly 1, and a
   failure rolls the whole step back.
2. **`BRIDGE_STORE_VERSION` is the number of migrations this build carries.** It is not
   `CONTRACT_VERSION`. A store whose `user_version` is above it (a rollback) or below 0
   is **DS-25**: the store reads only the pragma, closes the DB without writing, and the
   Bridge keeps serving with DS-25 in `/v1/health` `degraded[]`.
3. **Table names are plural snake_case; columns are snake_case.** The snake_case ↔
   camelCase mapping happens only in `store.ts`.
4. **Every capability table carries `pjid TEXT NOT NULL` and `generation INTEGER NOT NULL`.**
5. **Timestamps are ISO-8601 UTC TEXT** (`…Z`), never INTEGER epochs.
6. **`clone_path` and `board_id` are recovery metadata, never keys** (architecture D5): a
   row whose pjid no longer resolves can be re-linked by matching either one.
7. **Later tables arrive with their first writer.** The planned owners are:
   - `002_ticket_creates` — Story 2.22
   - `003_turns` — Story 3.2
   - `004_dispatches` — Story 3.12

## The one recorded exception

`resolutions` (migration `001`) is created **one story ahead of its first writer**. Story
1.5 creates the table and versions the store; Story 1.6 is the first code that writes a
row to it. Rule 7 applies to every other table.
