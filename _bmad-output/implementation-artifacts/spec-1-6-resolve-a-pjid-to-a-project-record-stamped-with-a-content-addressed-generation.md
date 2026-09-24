---
title: 'Story 1.6: Resolve a pjid to a Project Record, stamped with a content-addressed generation'
type: 'feature'
created: '2026-09-24'
status: 'awaiting-operator'
baseline_revision: 'ca628d0ec07d51c75ce7b0a7b8d1c42126899cf7'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
operator_actions:
  - "Free 127.0.0.1:8787 for the Bridge (still held by curator-serve.service, python3 pid 6375, as owed by Stories 1.4/1.5), or amend architecture.md's Bridge port"
  - "With 8787 free, on big-chungus run `node packages/bridge/dist/bridge.mjs &` then `curl -s http://127.0.0.1:8787/v1/project/sidepiece` and `curl -s -D- http://127.0.0.1:8787/v1/project/not-a-real-pjid`, and confirm the unwrapped record with degraded [] and HTTP/1.1 200 OK with exactly {\"degraded\":[{\"ds\":\"DS-2\",\"params\":{\"pjid\":\"not-a-real-pjid\"}}]}"
  - "Time 50 sequential `curl -s -o /dev/null -w '%{time_total}\\n' http://127.0.0.1:8787/v1/project/sidepiece` runs and confirm p95 under 1s (18787 measured p50 4.99ms, p95 6.83ms)"
  - "Rename one Project's repo in pjangler (move its repo_path), re-resolve it on 8787, and confirm `sqlite3 ~/.local/state/sidepiece/turns.db \"SELECT generation FROM resolutions WHERE pjid='<pjid>'\"` goes from 1 to 2; then move it back and confirm 3, never 1"
---

<intent-contract>

## Intent

**Problem:** The Bridge answers only `/v1/health`. Nothing turns a pjid into a Project Record, so the page-to-project link does not exist, and there is no generation for Story 1.7's stale-mutation guard to compare against.

**Approach:** Add `GET /v1/project/<pjid>`. `registry/client.ts` fetches `GET /v1/registry` once per resolution, indexes every Project client-side and derives the record. `registry/generation.ts` hashes the FR-2/FR-4 payload and mints a per-pjid generation in the `resolutions` table. The generation advances only when the hash changes. An unknown pjid is `200 {"degraded":[DS-2]}`.

## Boundaries & Constraints

**Always:**
- **Registry location:** `SIDEPIECE_REGISTRY_URL`, default `http://127.0.0.1:8764` (the live `pjangler-project-registry.service`). A value that is not an absolute `http:`/`https:` URL is refused: `config_invalid` (`key:'SIDEPIECE_REGISTRY_URL'`, `ds:'DS-4'`), exit 1. Startup order becomes pin → port → state dir → registry URL → store → listen.
- **One fetch per resolution, whole registry:** `GET <url>/v1/registry` with `signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS = 2_000)`. There is no in-memory cache (it would hide a rename). Build an index of **every** entry of `payload.projects`. There is no hardcoded count: the live registry holds 23 today, not the 19 the planning docs name.
- **Foreign names stay in `registry/client.ts`:** read the registry's identifier key and rename it to `pjid` in the same destructuring expression, spelling the foreign key literally (client.ts is the one Biome exemption), and index by that value. The same file reads `repo_path`, `board_id`, `role_dir` and `ticket_provider`. No other file (tests included) spells `project_id`. Tests build that key by concatenation.
- **Lookup:** match byte-for-byte against the indexed pjids (a `Map`). No trimming, lowercasing or reimplemented normaliser, and `.project.json` is never read. The path segment is `decodeURIComponent`-ed once. A malformed escape is a `404 not_found`.
- **Derived record (`ProjectRecord`, contract unchanged except a doc comment):**
  - `repo` = `path.posix.basename(repo_path)`. This is the repo directory name, and it is not the display `name`.
  - `clonePath` = `repo_path` verbatim.
  - `boardId` = `ticket_provider.board_id` when it is a string, else `""`.
  - `ticketProvider` = `{ type: ticket_provider.type ?? '' }`.
  - `agents` = entries of the `agents` object mapped to `{id, role, roleDir}`, sorted by `id` using code-unit order.
  - A requested entry whose `repo_path` is not a non-empty string counts as an unparseable registry answer (DS-7).
- **Body:** a known pjid returns `200` with the record **unwrapped**, keys in the order `pjid, generation, repo, clonePath, boardId, agents, ticketProvider, degraded`. Normally `degraded: []`.
- **Unknown pjid:** `200` with exactly `{"degraded":[{"ds":"DS-2","params":{"pjid":"<pjid>"}}]}`. No record keys and no prose.
- **Registry failure (minimal; Story 1.9 adds the snapshot and health reuse):**
  - One exported discriminator in `registry/client.ts` decides between the codes.
  - A fetch that rejects (refused, DNS, timeout) is `DS-6` with `params.endpoint` = the registry URL.
  - A non-2xx response or unparseable JSON/shape is `DS-7` with `params.error` = the verbatim status line or parse error.
  - Both are answered `200 {"degraded":[…]}` through `DegradedError`. Neither is ever a 5xx.
- **Hash (`registry/generation.ts`):** `recordHash` is the lowercase hex of `sha256(JSON.stringify({repo, clonePath, boardId, ticketProvider, agents}))`.
  - Build the object literal in that key order, with agents already sorted and each agent built as `{id, role, roleDir}`.
  - `pjid`, `generation` and `resolved_at` are excluded.
- **Mint:** runs inside one `BEGIN IMMEDIATE` transaction.
  - Read the row. The same hash returns the stored generation and **writes nothing** (re-resolution is not an event).
  - No row writes `generation = 1`. A different hash writes `stored + 1`, `record_hash`, and `resolved_at = new Date().toISOString()`, plus `clone_path` and `board_id`.
  - Rows are never deleted, so a pjid that leaves and re-enters continues from its high-water mark. The minted generation goes on the record.
- **Store API:** `store.ts` gains `readResolution(pjid)`, `writeResolution(row)` and `transaction(fn)`, with camelCase in and out. The snake_case column names stay in `store.ts`. `pjid` must be a non-empty string, or the store throws (DW-3).
- **Store ahead (DS-25):** there is no store, so the record is still served, with `generation: 0` (meaning not minted) and `degraded: [<the DS-25 entry>]`. Document the `0` meaning on `ProjectRecord.generation`.
- **Router:** `http.ts` routes gain `:name` path segments (for example, `'/v1/project/:pjid'`). An exact match wins over a pattern. A segment matches one non-empty path segment. Handlers receive `(req, params)`, and the HEAD/405 logic applies unchanged.
- **Board presence:** tested by truthiness only anywhere in `packages/bridge/src`.
- **Boundary guard:** `db/boundary.test.ts` additionally permits `board_id` in `registry/client.ts` only, because it is the registry's foreign name, renamed on read.
- **Logging:** a `resolved` info line (`pjid`, `generation`, `minted: boolean`) and a DS-2 `degraded` warn line with top-level `pjid`.

**Block If:** none anticipated. Actions against the live port 8787 and a real pjangler rename are operator-owed, not blockers.

**Never:**
- No registry snapshot file, no health `dependencies[]`, no `mutatingRoute()`, no 409. Those belong to Stories 1.9, 1.13 and 1.7.
- No filesystem probing of `clonePath` or `role_dir` (that is Story 1.8's `paths.ts`).
- No new `DsCode`, no change to `CONTRACT_VERSION`, no new migration.
- No mutation of the live pjangler registry from tests. Tests use an in-process stub HTTP registry.
- Do not edit `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Known pjid, first time | `sidepiece` in registry, no row | 200 record, `generation: 1`, `degraded: []`; row written | none |
| Re-resolve ×20 unchanged | same payload | `generation` stays 1, `record_hash` byte-identical, no write | none |
| Repo renamed | `repo_path` changed | `generation: 2`, hash differs | none |
| Leaves and re-enters, changed | removed, then back with a new path | `generation` = previous + 1, never reused | none |
| Unknown pjid | `not-a-real-pjid` | 200 `{"degraded":[{"ds":"DS-2","params":{"pjid":"not-a-real-pjid"}}]}` | warn `degraded` line |
| Case variant | `Sidepiece` | DS-2 (no normalisation) | warn line |
| Boardless | `board_id: ""` | `"boardId": ""` | none |
| Registry down | connection refused | 200 DS-6 `params.endpoint` | warn line |
| Registry error | 500, or body `not json` | 200 DS-7 `params.error` verbatim | warn line |
| Store ahead | DS-25 at startup | 200 record with `generation: 0`, `degraded:[DS-25]` | none |

</intent-contract>

## Code Map

- `packages/bridge/src/server/http.ts` -- routes are an exact pathname table (`routes[path]`, line ~128). `Handler = (req) => …`. `builtinRoutes` holds `/v1/health`. `DegradedError` maps to `200 {degraded}` via `server/errors.ts`, and a warn `degraded` line is logged there (it has no pjid yet).
- `packages/bridge/src/main.ts` -- startup sequence. `store` is `undefined` on DS-25, and `degraded` holds the DS-25 entry. Pass routes through `createBridgeServer({routes})`.
- `packages/bridge/src/turns/store.ts` -- the only `node:sqlite` importer. `wrap()` builds the `TurnStore` object, so add the resolution methods there. `db.exec('BEGIN IMMEDIATE')` is already exempt in `outbound.test.ts`.
- `packages/bridge/src/db/migrations/001_resolutions.sql` -- read-only here. The columns are `pjid, generation, record_hash, resolved_at, clone_path, board_id`.
- `packages/bridge/src/db/boundary.test.ts:14,61` -- the COLUMNS leak guard, which needs the `registry/client.ts` exemption for `board_id`.
- `packages/bridge/src/outbound.test.ts` -- every `fetch(` needs `signal`/`timeout` in its argument list.
- `packages/bridge/src/log.ts` -- a closed union of events. Add `resolved` (info), and allow `pjid` on the `degraded` warn line (it is already in `Scoped`).
- `packages/bridge/src/config.ts` -- add `DEFAULT_REGISTRY_URL` and `parseRegistryUrl`.
- `packages/contract/src/project.ts` -- `ProjectRecord`/`ProjectResponse` are already the right shape. The only change is a doc comment on `generation`.
- `biome.json` overrides -- `registry/client.ts` is already exempt from the no-project-id plugin. The grit rule matches `project[_-]?id` inside string literals too.
- `packages/bridge/test/spawn-bridge.ts` -- `startBridge(bundle, cwd, stateDir?)`. Add an optional extra env so the bundle test can point the registry at a stub.
- Live registry shape (probed 2026-09-24):
  - `{projects: {<pjid>: {project_id, slug, name, repo_path, agents: {<id>: {role, role_dir}}, ticket_provider: {type, board_id, …}}}}`.
  - pjangler enforces key === `project_id` === `slug`.
  - Boardless today: codegraph-voyage, legofirst and vinyl. `momo` gained a board on 2026-09-23.

## Tasks & Acceptance

**Execution:**
- `packages/bridge/src/config.ts` (+test) -- add `parseRegistryUrl`/`DEFAULT_REGISTRY_URL` -- a config refusal before listen.
- `packages/bridge/src/server/http.ts` (+test) -- add `:param` pattern routes and pass params to handlers. Exact routes win.
- `packages/bridge/src/turns/store.ts` (+test) -- add `readResolution`, `writeResolution` and `transaction`, with a non-empty pjid guard.
- `packages/bridge/src/registry/client.ts` (+`client.test.ts`) -- fetch, index, derive, and the DS-6/DS-7 discriminator. Tests use a stub `node:http` registry built from a fixture that has the four planning-time boardless Projects (codegraph-voyage, legofirst, momo, vinyl) plus sidepiece and a scrum-master agent. The test asserts the `!== null`/`in` vs `Boolean` triple for all four.
- `packages/bridge/src/registry/generation.ts` (+`generation.test.ts`) -- `recordHash` and `mintGeneration(store, record)`. Tests cover: first mint 1; ×20 unchanged with no write; rename → 2; leave/re-enter never reuses; mutating pjid, generation or resolved_at leaves the hash unchanged; agent order independence.
- `packages/bridge/src/server/project.ts` (+`project.test.ts`) -- `projectRoutes({registryUrl, store, degraded})` → `'/v1/project/:pjid'` GET handler. It covers DS-2, DS-25 (generation 0) and key order. The test asserts that every `/v1/project/:pjid…` route returns a top-level numeric `generation` for a resolved pjid.
- `packages/bridge/src/board-presence.test.ts` -- grep `packages/bridge/src` non-test files for `boardId` next to `!= null`, `!== null`, `??`, `in `, or `=== ''` comparisons. Expect none.
- `packages/bridge/src/main.ts`, `log.ts` -- wiring and the new log events.
- `packages/bridge/src/db/boundary.test.ts` -- the `board_id` exemption for `registry/client.ts` only, and an assertion that the `project_id` literal appears only in `registry/client.ts` across `packages/*/src|test`.
- `packages/bridge/test/spawn-bridge.ts`, `bundle.test.ts` -- a bundle run against the stub registry: resolve sidepiece and an unknown pjid, then 50 sequential resolutions with p50/p95 printed and p95 < 1000ms asserted.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- mark DW-3 addressed by the pjid guard.

**Acceptance Criteria:**
- Given a real registry on 8764, when the built bundle runs on a spare port and `curl -s /v1/project/sidepiece` is run, then 200 returns the unwrapped record with `boardId` `96725b78-…`, two agents sorted, and `degraded: []`.
- Given the same Bridge, when 50 sequential resolutions are timed, then p95 < 1s and p50/p95 are recorded in the Auto Run Result.
- Given `grep -rn "project_id" packages --exclude-dir=node_modules --exclude-dir=dist`, then the only hits are in `packages/bridge/src/registry/client.ts`.
- Given `mise run lint && mise run test && mise run build`, then all exit 0.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 1, low 5)
- defer: 0
- reject: 21: (high 0, medium 2, low 19)
- addressed_findings:
  - `[medium]` `[patch]` No test for a registry that accepts the connection and then stalls. The stub gained no-response and stall-body modes, and project.test asserts 200 DS-6 in about 2s under a 4s handler deadline. The test was proven to fail when the fetch signal is removed.
  - `[low]` `[patch]` parseRegistryUrl accepted a query, fragment or credentials and returned the raw string. It now rejects these and returns origin+path, normalised.
  - `[low]` `[patch]` A duplicate registry identifier meant last-wins. It is now DS-7 with a verbatim message.
  - `[low]` `[patch]` A repo_path of `/` gave an empty repo. It is now DS-7.
  - `[low]` `[patch]` Malformed agents (non-object, or a non-string role/role_dir) were coerced to ''. They are now DS-7.
  - `[low]` `[patch]` Spawned test Bridges could inherit SIDEPIECE_REGISTRY_URL or reach the live registry. The child env now pins an unroutable URL unless the caller overrides it.

## Design Notes

- **Why `repo` = basename(repo_path):** the PRD fact-check (`review-fact-check.md` §4.1) says "repo name" is derivable from `repo_path` and is not the display `project_name`. The glossary also forbids `Repo` as a synonym for Project. The AC's "rename that Project's repo in pjangler" therefore moves `repo_path`, and both `repo` and `clonePath` change.
- **Why `generation: 0` under DS-25:** the ahead store may not be read, so no high-water mark is known. An in-memory counter could reuse a value after a restart, and `0` is below every minted value. Chat is gated under DS-25 anyway. Story 1.7 must treat `0` as "cannot validate".
- **Why no write on an unchanged hash:** "re-resolution is not an event" (D11). `resolved_at` is the time the current generation was minted.
- **The drift that was found:** the registry now holds 23 Projects and `momo` is no longer boardless. The four-boardless assertion runs against a fixture. The live transcript shows the three that are still boardless.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build` -- expected: exit 0.
- `SIDEPIECE_BRIDGE_PORT=18787 SIDEPIECE_STATE_DIR=$(mktemp -d) node packages/bridge/dist/bridge.mjs & curl -s -D- http://127.0.0.1:18787/v1/project/sidepiece; curl -s -D- http://127.0.0.1:18787/v1/project/not-a-real-pjid` -- expected: 200 record, then 200 DS-2-only body.
- `sqlite3 $STATE/turns.db 'SELECT * FROM resolutions'` after 20 resolutions -- expected: one row, generation 1.

## Auto Run Result

Status: awaiting-operator

**Summary:** `GET /v1/project/<pjid>` resolves a pjid to an unwrapped `ProjectRecord`.
- `registry/client.ts` makes one whole-registry fetch per resolution (2s timeout, no cache), indexes every entry and matches the pjid byte for byte. The foreign `project_id` is renamed to `pjid` in the destructuring that reads it.
- `registry/generation.ts` mints a content-addressed, per-pjid generation. It is sha256 of `{repo, clonePath, boardId, ticketProvider, agents}`, computed in one `BEGIN IMMEDIATE` transaction. An unchanged hash writes nothing.
- An unknown pjid returns `200 {"degraded":[DS-2]}`. A refused, DNS-failed or stalled registry is DS-6 (`endpoint`). A non-2xx or malformed answer is DS-7 (`error`, verbatim). A store ahead of the Bridge serves the record with `generation: 0` plus DS-25.

**Files changed:**
- `packages/bridge/src/registry/client.ts`: fetch, index, record derivation, and the DS-6/DS-7 discriminator (`registryFailure`).
- `packages/bridge/src/registry/generation.ts`: `recordHash`, `sortAgents`, `mintGeneration`.
- `packages/bridge/src/server/project.ts`: the `/v1/project/:pjid` route.
- `packages/bridge/src/server/http.ts`: `:param` pattern routes; handlers now receive `(req, params)`; degraded lines carry `pjid`.
- `packages/bridge/src/turns/store.ts`: `readResolution`, `writeResolution`, `transaction`, and the non-empty pjid guard that closes DW-3's first-writer half.
- `packages/bridge/src/config.ts`: `DEFAULT_REGISTRY_URL` (`http://127.0.0.1:8764`) and a strict `parseRegistryUrl`.
- `packages/bridge/src/main.ts`, `log.ts`: registry URL check before the store, route wiring, and the `resolved` log event.
- `packages/contract/src/project.ts`: a doc comment only (generation 0 means not minted).
- Tests: `client.test.ts`, `generation.test.ts`, `project.test.ts`, `board-presence.test.ts`, `test/stub-registry.ts`.
- Extended tests: boundary, config, http, store, bundle, main, spawn-bridge.
- `_bmad-output/implementation-artifacts/deferred-work.md`: DW-3 marked addressed.

**Review findings:**
- 6 patches applied (1 medium, 5 low). 0 deferred.
- 21 rejected. Among them:
  - Store write failure answered as 500: the Bridge itself failed, and the store's busy timeout is 5s.
  - HEAD mints like GET.
  - A 502/503 from the registry is DS-7: the spec and Story 1.9 both say so.
  - A trailing slash on clonePath moves the generation: this is content-addressed on verbatim data.
  - The `resolved` line is logged per request: the spec asks for it.
  - No cache or request coalescing: a cache would hide a rename.
  - DS-25 is not echoed on DS-2 or DS-6 bodies.
  - Nested or async `transaction()`: there is one synchronous caller.
  - Overlapping pattern routes.
  - Gaps in the board-presence regex: the AC's grep surface is met, and no extension package exists yet.
  - A body size cap.
  - A missing identifier with its key still present: pjangler enforces key === identifier.

**Follow-up review recommendation:** true. Patched: high 0, medium 1, low 5. Score is 3×1 + 5 = 8, which is 5 or more.

**Verification:**
- `mise run lint && mise run test && mise run build`: exit 0. Contract passed 5/5; bridge passed 114/114, with 0 skipped.
- In-test bundle against the stub: p50 0.95ms, p95 1.99ms (n=50).
- Live run on 127.0.0.1:18787 against the real registry on 8764, with a temp state dir:
  - `/v1/project/sidepiece` returned `HTTP/1.1 200 OK` with `{"pjid":"sidepiece","generation":1,"repo":"sidepiece","clonePath":"/home/delorenj/code/sidepiece","boardId":"96725b78-df0b-436a-8b45-c871264fe25d","agents":[{"id":"sidepiece-pm",…},{"id":"sidepiece-scrum-master",…}],"ticketProvider":{"type":"plane"},"degraded":[]}`.
  - `/v1/project/not-a-real-pjid` returned `HTTP/1.1 200 OK` with `{"degraded":[{"ds":"DS-2","params":{"pjid":"not-a-real-pjid"}}]}`.
  - `boardId` is `""` for codegraph-voyage, legofirst and vinyl. `momo` has since gained a real board (`94fb34d5-…`), so all four boardless cases are asserted on a fixture.
  - 50 sequential curls: **p50 4.99ms, p95 6.83ms**.
  - The `resolutions` rows sit at generation 1 after the repeated resolutions.
- `grep -rn project_id packages` (excluding node_modules and dist) hits only `packages/bridge/src/registry/client.ts:48`.

**Residual risks:**
- The live registry now has 23 Projects, not 19, and momo is no longer boardless. The planning docs are stale on both counts.
- Story 1.7 must treat `generation: 0` (DS-25) as "cannot validate".
- The literal-port checks on 8787 and a real pjangler rename are owed; see `operator_actions`.
