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

### DW-4: Story 1.10's AC that registry-snapshot.json stays byte-identical across two live deploys conflicts with Story 1.9's rewrite-on-every-successful-fetch snapshot.
origin: spec-deferred 9ebbfd78c750
location: packages/bridge/src/registry/snapshot.ts
source_spec: `spec-1-10-deploy-the-bridge-as-one-file-supervised-with-the-turn-store-out-of-the-blast-radius.md`
severity: low
reason: The deploy never touches the snapshot (the self-test proves sha256, mtime and inode are unchanged under stubs). But each deploy restarts the Bridge, and its first health or resolution fetch rewrites the file with a new fetchedAt. The epic AC is literally unsatisfiable on a live host unless the snapshot write skips unchanged payloads, which would make DS-23's age report time since the last change rather than since the last fetch. Reconcile in planning.
status: open

### DW-5: mise pins node = "lts" for tests while the unit pins 24.15.0. On 2026-10-28, lts moves to Node 26, and every spawned-bundle test will be refused by the Node pin.
origin: spec-deferred 60549823aeb0
location: mise.toml
source_spec: `spec-1-10-deploy-the-bridge-as-one-file-supervised-with-the-turn-store-out-of-the-blast-radius.md`
severity: medium
reason: mise.toml [tools] node = "lts" resolves to 24.15.0 today. spawn-bridge.ts spawns process.execPath. main.ts refuses anything outside >=24.15.0 <25. Nothing runs the bundle tests under the pinned runtime.
status: open

### DW-6: An unresolved credential re-spawns op and writes a credential_unresolved warn line on every /v1/health, including the permanent no_bootstrap_token and op_bin_invalid reasons.
origin: spec-deferred 091ee8b45ea4
location: packages/bridge/src/credentials/vault.ts
source_spec: `spec-1-12-every-credential-from-the-vault-and-a-missing-one-degrades-instead-of-killing-the-bridge.md`
severity: low
reason: The spec mandates per-request retry and a warn line on every failed attempt. Once Epic 2's sidebar polls health, a missing credential means one op child (up to about 2s) and one journal line per poll, and could hit service-account rate limits. It needs a retry cooldown and warn-on-change logging, decided at the point the poll cadence exists.
status: open
