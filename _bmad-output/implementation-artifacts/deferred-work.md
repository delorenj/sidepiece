### DW-1: mise.toml pins node = "lts", which will float to Node 26 on 2026-10-28 while the Bridge targets node24 and @types/node 24.
origin: spec-deferred 323559681196
location: mise.toml:5
source_spec: `spec-1-1-the-monorepo-scaffold-that-contract-cannot-exist-without.md`
severity: medium
reason: mise.toml [tools] node = "lts" resolves to 24.15.0 today; epic context says the systemd ExecStart must use an absolute pinned Node 24.15.x path and that mise moves to Node 26 LTS on 2026-10-28.
status: open

### DW-2: mise run version:check reports no version found in any manifest file.
origin: spec-deferred a6d5506cc2ef
location: .mise/scripts/versioning.sh
source_spec: `spec-1-1-the-monorepo-scaffold-that-contract-cannot-exist-without.md`
severity: low
reason: Root package.json carries no version and packages are 0.0.0; the managed mise-versioning script finds nothing to keep in parity. Pre-existing managed block, not changed by this story.
status: open

### DW-3: resolutions.pjid is declared `TEXT PRIMARY KEY` without NOT NULL, which SQLite treats as nullable (non-INTEGER PK quirk).
origin: spec-deferred a19b061d64d8
location: packages/bridge/src/db/migrations/001_resolutions.sql
source_spec: `spec-1-5-a-turn-store-that-is-versioned-and-says-so-when-it-is-newer-than-the-bridge.md`
severity: low
reason: Blind Hunter inserted two NULL-pjid rows into the migrated table in :memory:. The AC fixes the column list literally, and db/README.md's `pjid TEXT NOT NULL` rule is stated for capability tables, so 001 keeps the AC's DDL. Story 1.6 (the first writer) must never bind a null pjid, or a later forward migration can rebuild the table with NOT NULL.
status: addressed
resolution: Story 1.6 — `turns/store.ts` `readResolution`/`writeResolution` throw a TypeError on an empty or non-string pjid before binding (tested in `store.test.ts`). The DDL is unchanged; a later forward migration may still add NOT NULL.
