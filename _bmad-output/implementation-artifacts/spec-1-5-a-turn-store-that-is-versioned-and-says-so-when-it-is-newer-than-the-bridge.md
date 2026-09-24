---
title: 'Story 1.5: A Turn store that is versioned, and says so when it is newer than the Bridge'
type: 'feature'
created: '2026-09-24'
status: 'awaiting-operator'
baseline_revision: '62c4b0cd4985744fd89ccbd097b7ae3be9676430'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred:
  - summary: >-
      resolutions.pjid is declared `TEXT PRIMARY KEY` without NOT NULL, which SQLite treats as nullable (non-INTEGER PK quirk).
    evidence: |-
      Blind Hunter inserted two NULL-pjid rows into the migrated table in :memory:. The AC fixes the column list literally, and db/README.md's `pjid TEXT NOT NULL` rule is stated for capability tables, so 001 keeps the AC's DDL. Story 1.6 (the first writer) must never bind a null pjid, or a later forward migration can rebuild the table with NOT NULL.
    location: >-
      packages/bridge/src/db/migrations/001_resolutions.sql
    severity: low
operator_actions:
  - "Free 127.0.0.1:8787 for the Bridge (still held by curator-serve.service, python3 pid 6375, as owed by Story 1.4), or amend architecture.md's Bridge port"
  - "With 8787 free, on big-chungus run `node packages/bridge/dist/bridge.mjs & sleep 1; sqlite3 ~/.local/state/sidepiece/turns.db '.tables' 'PRAGMA user_version'; kill %1` and confirm `resolutions` and `1`"
  - "Then run `sqlite3 ~/.local/state/sidepiece/turns.db 'PRAGMA user_version = 9'`, restart the Bridge, run `curl -s -D- http://127.0.0.1:8787/v1/health` twice, and confirm HTTP/1.1 200 OK with {\"ds\":\"DS-25\",\"params\":{\"storeVersion\":\"9\",\"bridgeVersion\":\"1\"}} both times from the same PID, and that `PRAGMA user_version` still reads 9"
  - "Reset the real store afterwards with `rm ~/.local/state/sidepiece/turns.db*` (it holds no rows yet) so the next start migrates it to 1"
---

<intent-contract>

## Intent

**Problem:** The Bridge has no store. There is no `turns.db`, no `PRAGMA user_version`, and no forward-only migrations, so a Bridge that gets rolled back has no way to say its store is newer than it is. That rollback would half-read a store it doesn't understand, which is the confidently-wrong outcome (D7, AR26–AR31, FR-15(e), UX-DR41) the product forbids.

**Approach:** Add `turns/store.ts`, the only module that imports `node:sqlite`. It opens `$SIDEPIECE_STATE_DIR/turns.db` at startup and applies the numbered `.sql` migrations forward-only, one transaction per step. If the store's `user_version` is one this build does not know, it touches nothing and reports DS-25. `/v1/health` then carries that DS-25 in `degraded[]` while the process keeps running.

## Boundaries & Constraints

**Always:**
- Migration `001_resolutions.sql` creates exactly one table, with no other objects: `resolutions(pjid TEXT PRIMARY KEY, generation INTEGER NOT NULL, record_hash TEXT NOT NULL, resolved_at TEXT NOT NULL, clone_path TEXT, board_id TEXT)`. Afterwards `PRAGMA user_version` is `1`.
- `db/schema.sql` is the cumulative current schema, used as a reference. The store never executes it. A test proves that migrating a fresh DB produces the same `sqlite_master` SQL as applying `schema.sql`.
- Each migration is applied inside `BEGIN IMMEDIATE … COMMIT` together with `PRAGMA user_version = n` (so each advances the version by exactly 1), and a failure rolls back.
- `BRIDGE_STORE_VERSION` is the number of migrations the build carries. It is not `CONTRACT_VERSION`.
- **Ahead or unrecognised version:** this is `user_version > BRIDGE_STORE_VERSION`, or `< 0`.
  - The store reads nothing but the pragma, then closes the DB with no migration, no WAL switch and no write.
  - It returns `{kind:'ahead', storeVersion, bridgeVersion}`. `main.ts` logs `store_ahead` as `level:'warn'` with `ds:'DS-25'`.
  - The Bridge keeps serving. `/v1/health` stays `200`, `status:'ok'`, with `degraded` exactly `[{"ds":"DS-25","params":{"storeVersion":"9","bridgeVersion":"1"}}]` (the param values are strings).
- The WAL journal mode is set only in the ready path, after the version check.
- **State dir:** `SIDEPIECE_STATE_DIR` if set, else `~/.local/state/sidepiece`. The store creates it (`recursive`, mode `0o700`) and the DB file is `<dir>/turns.db`.
  - An empty or relative value, or one equal to or under `~/.local/lib/sidepiece` or the running bundle's own directory, is refused: `config_invalid` (`key:'SIDEPIECE_STATE_DIR'`, `ds:'DS-4'`), exit 1, before anything is created.
  - Startup order is pin → port → state dir → store → listen.
- If the store fails to open or migrate, the Bridge logs `store_open_failed` (`ds:'DS-4'`, `detail`) and exits 1. `Restart=always` will retry.
- The snake_case↔camelCase mapping lives only in `store.ts`. The names `record_hash`, `clone_path`, `board_id` and `created_at` appear only in `store.ts` and under `src/db/`, including tests. A guard test enforces this, and also that `node:sqlite` appears only in `store.ts` across `packages/*/src` and `packages/*/test`. The guard builds its needles by concatenation.
- **The one recorded exception:** `resolutions` is created one story ahead of its first writer (Story 1.6). `db/README.md` states this, along with the migration contract. That contract covers: plural snake_case table names; snake_case columns; `pjid TEXT NOT NULL` and `generation INTEGER NOT NULL` on every capability table; ISO-8601 UTC TEXT timestamps; `clone_path` and `board_id` as recovery metadata, never keys; forward-only numbered migrations that each advance `user_version` by exactly 1; and future owners `002_ticket_creates` (2.22), `003_turns` (3.2) and `004_dispatches` (3.12).

**Block If:** none anticipated.

**Never:**
- No `turns`, `dispatches`, `ticket_creates` or `registry_snapshots` table.
- No row written to `resolutions`. Story 1.6 does that.
- No down-migrations and no DB outside the state dir.
- No new `DsCode`.
- No store API beyond open, version, inspect and close.
- No `node:sqlite` import outside `store.ts`, and none in tests.
- No dynamic `import()` in the bundle.
- Do not edit `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty state dir | dir absent | dir and `turns.db` created; tables = `[resolutions]`; `user_version` is 1; health `degraded: []` | none |
| Restart at v1 | `user_version` is 1 | no migration runs, the file is otherwise untouched, and the same tables remain | none |
| Rollback | `user_version` is 9 | 200; `degraded` holds DS-25 with params `9` and `1`; the process keeps answering; the DB file is byte-identical afterwards | a `store_ahead` warn line |
| Negative version | `user_version` is -1 | DS-25 with `storeVersion` `-1`, nothing migrated | a `store_ahead` warn line |
| Bad state dir | `''`, `rel/dir`, `~/.local/lib/sidepiece/x`, or the bundle dir | `config_invalid` with key `SIDEPIECE_STATE_DIR` and ds DS-4, exit 1, no `turns.db` created | none |
| Migration throws | the SQL fails | the transaction rolls back and `user_version` is unchanged; `openStore` throws, so main logs `store_open_failed` and exits 1 | caught in main |

</intent-contract>

## Code Map

- `packages/bridge/src/main.ts` -- the startup sequence after 1.4. Insert state-dir resolution and `openStore` between `parsePort` and `createBridgeServer`, and pass `degraded` in. Close the store on shutdown. The bundle directory is `dirname(fileURLToPath(import.meta.url))`.
- `packages/bridge/src/config.ts` (+`config.test.ts`) -- holds `HOST`, `DEFAULT_PORT` and `parsePort`. Add a pure `resolveStateDir(raw, {home, bundleDir})` that returns `string | undefined`, plus `DEPLOY_TARGET_DIR` (relative to home, `.local/lib/sidepiece`).
- `packages/bridge/src/server/http.ts:41` `healthHandler` -- `degraded: []` is hard-coded. Add an option `degraded?: () => Degraded[]` (default `() => []`) and use it there.
- `packages/bridge/src/log.ts` -- a closed event union. Add a `store_opened` info line (`path`, `userVersion`, `migratedFrom`), a `store_ahead` warn line (`ds`, `path`, `storeVersion`, `bridgeVersion`) and a `store_open_failed` error line (`ds`, `path`, `detail?`). The compile-time ds guard already covers warn and error lines.
- `packages/bridge/tsup.config.ts` -- add `loader: { '.sql': 'text' }`, so the SQL is inlined and the bundle stays one file. `test/bundle.test.ts` test 1 still has to pass. `node:sqlite` is external through `/^node:/`.
- `packages/bridge/package.json` `test` -- add `--import ./test/sql-loader.ts`, so `.sql` imports resolve under native type stripping. Confirm it propagates to the `node --test` child processes.
- `packages/bridge/test/spawn-bridge.ts` and `test/main.test.ts` `run()` -- these currently spawn with no `SIDEPIECE_STATE_DIR`, which would write into the real `~/.local/state`. Give each spawn its own temp state dir, kept outside the bundle's dir.
- `@types/node@24.13.6` has `registerHooks` in `module.d.ts:258` and `node:sqlite` `DatabaseSync`. Node on this host is v24.15.0.
- `packages/contract/src/state.ts` -- `Degraded`, whose `params` is `Record<string,string>`, and DS-25 ∈ `BridgeDsCode`. Read-only.
- EXPERIENCE.md L812 (DS-25 row) and architecture.md D7 (L242–244) and L482 (state outside the deploy tree) -- the authorities. Read-only.

## Tasks & Acceptance

**Execution:**
- `packages/bridge/src/db/migrations/001_resolutions.sql` -- the one `CREATE TABLE` -- this is the first migration (AR27).
- `packages/bridge/src/db/schema.sql` -- the cumulative reference schema, with a header comment -- this is AR26.
- `packages/bridge/src/db/README.md` -- the migration contract and the recorded exception -- this is AR28–AR30.
- `packages/bridge/src/sql.d.ts` -- `declare module '*.sql' { const sql: string; export default sql; }`.
- `packages/bridge/test/sql-loader.ts` -- a `registerHooks` load hook that turns a `.sql` URL into `export default <json string>`.
- `packages/bridge/src/turns/store.ts` -- `openStore(stateDir): StoreOpen`, `BRIDGE_STORE_VERSION`, and `TurnStore {path, userVersion(), inspect(): {tables: {name, sql, columns: {name,type,notNull,primaryKey}[]}[]}, close()}` -- the single opener (AR31).
- `packages/bridge/src/turns/store.test.ts` -- covers the matrix rows for empty, restart, ahead (9 and -1, with file bytes unchanged) and migration rollback, the last through an injectable migrations list. Version 9 is forced by writing the big-endian int32 at header offset 60 with `node:fs`, after `close()`.
- `packages/bridge/src/db/schema.test.ts` -- asserts exact tables and columns through `inspect()`, TEXT timestamps, and migrated schema = `schema.sql`.
- `packages/bridge/src/db/boundary.test.ts` -- the grep guards described in Always.
- `config.ts`, `config.test.ts`, `log.ts`, `http.ts`, `http.test.ts` (health echoes injected `degraded`), `main.ts` -- as in the Code Map.
- `packages/bridge/test/main.test.ts` -- covers the bad state-dir rows through the bundle. It also runs a bundle rollback: after it the store is at 9, health shows DS-25 twice from the same live process, and the DB file is byte-identical after `stopBridge`.
- `packages/bridge/test/bundle.test.ts` -- the bundle run creates `turns.db` in its temp state dir.

**Acceptance Criteria:**
- Given an empty state dir, when the bundle starts, then `sqlite3 <dir>/turns.db '.tables'` prints only `resolutions`, `PRAGMA user_version` prints `1`, and `.schema resolutions` matches the column list above.
- Given `sqlite3 turns.db 'PRAGMA user_version = 9'` and a restart, when `curl -s -D- http://127.0.0.1:<port>/v1/health` runs twice, then both answers are `HTTP/1.1 200 OK` and carry the DS-25 entry, the PID is unchanged, and `PRAGMA user_version` afterwards is still `9`.
- Given `grep -rn "node:sqlite" packages/*/src packages/*/test`, when it runs, then the only hit is `packages/bridge/src/turns/store.ts`.
- Given `mise run lint && mise run test && mise run build`, when they run, then every one exits 0.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 17 (high 0, medium 4, low 13)
- defer: 1 (high 0, medium 0, low 1)
- reject: 10 (high 0, medium 0, low 10)
- addressed_findings:
  - `[medium]` `[patch]` `isAtOrUnder` treated `<deploy>/..state` as outside the deploy tree. Now uses an exact `..`/`..`+sep test; refusal cases added.
  - `[medium]` `[patch]` Two concurrent starts could both migrate from 0. Added a 5s busy timeout, and `user_version` is re-read inside each `BEGIN IMMEDIATE`, so a step is never re-run. A `beforeStep` test hook simulates the race.
  - `[medium]` `[patch]` Probing an ahead store on a writable connection checkpoints a stale `-wal` into the main file on close. An existing store is now probed read-only; a test proves the main file stays byte-identical with v9 only in the WAL.
  - `[medium]` `[patch]` No test ran the bundle with `SIDEPIECE_STATE_DIR` unset. Added a bundle test with a temp `HOME` that asserts `store_opened.path` is `<home>/.local/state/sidepiece/turns.db`.
  - `[low]` `[patch]` A symlink could bypass the deploy-tree/bundle-dir guard. The guard now also compares the realpath of the longest existing ancestor; a real-symlink test was added.
  - `[low]` `[patch]` `ROLLBACK` could mask the original migration error. It is now guarded by `isTransaction` and try/catch, and the original error is rethrown.
  - `[low]` `[patch]` A missing or blank `migrations[v]` would advance the version with no schema change. It now throws `migration N missing`.
  - `[low]` `[patch]` `inspect()` interpolated the table name into `PRAGMA table_info`. It is now a bound `pragma_table_info(?)`.
  - `[low]` `[patch]` The store was not closed on the `listen_failed`, 5s-fallback and post-open-throw exits. All now close it.
  - `[low]` `[patch]` The boundary guard omitted `resolved_at`. Added.
  - `[low]` `[patch]` Schema parity checked tables only. It now compares every `sqlite_master` object, and a test checks the on-disk migration files are contiguous from 001 and match `BRIDGE_STORE_VERSION`.
  - `[low]` `[patch]` There was no v1→v2 upgrade test. Added; it checks `migratedFrom: 1`.
  - `[low]` `[patch]` The outbound-timeout exemption covered any `db.` call in any file. It is now `db.exec(` in `turns/store.ts` only, with fixtures.
  - `[low]` `[patch]` A refused default state dir was logged as `value: ''`. It now logs `(default) <path>`.
  - `[low]` `[patch]` `startBridge` leaked temp state dirs. They are now removed on stop or on a failed start.
  - `[low]` `[patch]` A `tsup.config.ts` comment contained the literal `node:sqlite`, which broke the AC grep. Reworded.
  - `[low]` `[patch]` Re-verified the AC greps across `packages/` (excluding dist and node_modules): only `store.ts` hits.

## Design Notes

**Why DS-25 covers negative versions.** EXPERIENCE.md defines DS-25 as "a `user_version` this Bridge binary does not recognise". A negative value is not a rollback, but it is unrecognised, and migrating over it would be guessing.

**Why the version is forced through header bytes.** Tests may not import `node:sqlite`, so `test.ts` writes the 4 bytes at header offset 60 directly after a clean `close()`. By then WAL is checkpointed and the `-wal` file is gone. This is exactly the on-disk state `sqlite3 'PRAGMA user_version = 9'` leaves.

**Store failure is DS-4.** 1.4's Design Notes apply: the listener never comes up, so the operator sees DS-4.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build` -- expected: exit 0.
- `D=$(mktemp -d); SIDEPIECE_STATE_DIR=$D SIDEPIECE_BRIDGE_PORT=18787 node packages/bridge/dist/bridge.mjs & sleep 1; sqlite3 $D/turns.db '.tables' 'PRAGMA user_version'; kill %1` -- expected: `resolutions`, `1`.
- The same `$D` after `sqlite3 $D/turns.db 'PRAGMA user_version = 9'`, restarted, with `curl -s -D- …/v1/health` run twice -- expected: `200` with DS-25 both times, then `user_version` is still `9`.

## Auto Run Result

Status: awaiting-operator

**Summary:** The Bridge now has a versioned Turn store.
- `turns/store.ts` is the only module that imports `node:sqlite`. It opens `$SIDEPIECE_STATE_DIR/turns.db` (default `~/.local/state/sidepiece/turns.db`), creating the directory with mode 0700.
- It applies numbered `.sql` migrations forward-only, one `BEGIN IMMEDIATE` transaction per step, each paired with `PRAGMA user_version = n`. There is a busy timeout, the version is re-read inside every transaction, and a failure rolls back.
- Migration 001 creates exactly `resolutions`, with no rows. `db/README.md` records the migration contract and notes that this table arrives one story ahead of its first writer.
- If `user_version` is above this build's version, or below 0, the store is probed read-only and nothing is migrated or written. The Bridge logs `store_ahead` (DS-25) and keeps serving: `/v1/health` stays `200 ok` with `degraded:[{"ds":"DS-25","params":{"storeVersion":"9","bridgeVersion":"1"}}]`.
- The Bridge refuses to start if the state dir is empty, relative, or inside `~/.local/lib/sidepiece` or the bundle's own directory, including through a symlink. That exits with `config_invalid` DS-4 and creates nothing.
- A store that fails to open exits with `store_open_failed` DS-4.
- tsup inlines the SQL as text and keeps the `node:` prefix (`removeNodeProtocol: false`); without that, `node:sqlite` would bundle as a bare `sqlite` import.

The one item owed is not code. The ACs name `curl http://127.0.0.1:8787` and the real `~/.local/state/sidepiece`, but port 8787 is still held by curator-serve (Story 1.4's open operator action). The same transcript was proven on port 18787 against a temp state dir, and the live-port checks are listed under `operator_actions`.

**Files changed:**
- `packages/bridge/src/turns/store.ts`: the single opener. Handles migration, the ahead probe, `inspect()` and `close()`.
- `packages/bridge/src/turns/store.test.ts`: covers the matrix rows, the race, the stale WAL, rollback and upgrade.
- `packages/bridge/src/db/migrations/001_resolutions.sql`: the one table.
- `packages/bridge/src/db/schema.sql`: the cumulative reference schema, never executed.
- `packages/bridge/src/db/README.md`: the migration contract and the recorded exception.
- `packages/bridge/src/db/schema.test.ts`: exact columns, full `sqlite_master` parity, and on-disk migration numbering.
- `packages/bridge/src/db/boundary.test.ts`: guards that the SQLite driver and the snake_case names stay in `store.ts` and `db/`.
- `packages/bridge/src/sql.d.ts` and `packages/bridge/test/sql-loader.ts`: let `.sql` files be imported for typecheck and tests.
- `packages/bridge/src/config.ts` and `config.test.ts`: `resolveStateDir` and `DEPLOY_TARGET_DIR`, including the symlink-aware guard.
- `packages/bridge/src/main.ts`: startup order pin → port → state dir → store → listen, and the store is closed on every exit.
- `packages/bridge/src/log.ts`: the `store_opened`, `store_ahead` (warn, ds) and `store_open_failed` (error, ds) lines.
- `packages/bridge/src/server/http.ts` and `http.test.ts`: `/v1/health` echoes an injected `degraded()`.
- `packages/bridge/src/outbound.test.ts`: exempts `db.exec(` in `store.ts` only.
- `packages/bridge/test/main.test.ts`, `spawn-bridge.ts` and `bundle.test.ts`: every bundle run uses a temp state dir. Adds the rollback (DS-25) run, the bad-state-dir and default-path runs, and cleanup.
- `packages/bridge/tsup.config.ts`: the `.sql` text loader and `removeNodeProtocol: false`.
- `packages/bridge/package.json`: the test run loads `sql-loader.ts`.

**Review findings:** 17 patches applied (4 medium, 13 low), 1 deferred (the nullable `resolutions.pjid` primary key; the AC fixes the DDL), and 10 rejected:
- Negative versions labelled "ahead": intended, and justified in the Design Notes.
- No `remedy` on DS-25: the Bridge sends codes, not prose.
- The 0700 mode is not re-applied to an existing dir.
- The test `--import` path depends on the cwd.
- Store state is frozen at startup.
- Asserting `removeNodeProtocol` explicitly: the bundle run already covers it.
- README guidance on pragmas.
- `dist/` grep hits: gitignored build output.
- README naming 3.12 vs the AC's 3.10 for `dispatches`: epics.md's later correction says 3.12.
- The operator lane: resolved here as `awaiting-operator`.

**Follow-up review recommendation:** true. Patched: high 0, medium 4, low 13. Score is 3×4 + 1×13 = 25, which is 5 or more.

**Verification:**
- `mise run lint && mise run test && mise run build`: exit 0. Contract passed 5/5; bridge passed 67/67, with 0 skipped.
- Manual run on port 18787 with a temp state dir:
  - `sqlite3 .tables` gives `resolutions`, and `user_version` is `1`.
  - After `PRAGMA user_version = 9` and a restart, two `curl`s both return 200 with the DS-25 entry, the same PID stays alive, and the version is still 9.
  - `turns.db`'s sha256 is unchanged.
- `grep -rn "node:sqlite" packages --exclude-dir=node_modules --exclude-dir=dist` hits only `store.ts`.
- The snake_case column grep outside `store.ts` and `src/db/` is empty.

**Residual risks:**
- `resolutions.pjid` is nullable (deferred to Story 1.6).
- DS-25 is decided once at startup, so a store changed under a running Bridge is not re-detected until restart. The AC describes a restart.
- There are two test-only options on `openStore` (`migrations`, `beforeStep`).
- An ahead store probed read-only may leave empty `-wal`/`-shm` files beside it; the main file is untouched.
- The literal AC runs against 8787 and the real state dir are owed (`operator_actions`).

