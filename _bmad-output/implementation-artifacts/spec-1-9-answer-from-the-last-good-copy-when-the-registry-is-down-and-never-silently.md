---
title: 'Story 1.9: Answer from the last good copy when the Registry is down — and never silently'
type: 'feature'
created: '2026-09-24'
baseline_revision: '6d745d46a226622c61456072d3f6d465b6b5aa24'
status: 'awaiting-operator'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
operator_actions:
  - "After Story 1.10 deploys the Bridge on big-chungus, prime the snapshot with `curl -s http://127.0.0.1:8787/v1/project/sidepiece`, then run `systemctl --user stop pjangler-project-registry.service` and repeat the curl; confirm a 200 with the full ProjectRecord and a degraded[] entry {\"ds\":\"DS-23\",\"params\":{\"fetchedAt\",\"ageSeconds\"}} followed by DS-6 carrying the systemctl remedy."
  - "While the registry is still stopped, run `sqlite3 ~/.local/state/sidepiece/turns.db \"SELECT generation, record_hash FROM resolutions WHERE pjid='sidepiece'\"` and confirm the output is byte-identical to the output from before the outage, then run `sqlite3 ~/.local/state/sidepiece/turns.db '.tables'` and confirm there is no registry_snapshots table."
  - "Run `systemctl --user start pjangler-project-registry.service` and confirm that the next curl returns the record with no DS-23 or DS-6, and that the mtime of ~/.local/state/sidepiece/registry-snapshot.json advances."
---

<intent-contract>

## Intent

**Problem:** When the pjangler Registry does not answer, every `GET /v1/project/<pjid>` is a total DS-6/DS-7 outage. The Bridge keeps no last-good copy, so nothing can resolve. The DS-6/DS-7 discriminator also has only one caller: health does not probe the registry at all.

**Approach:** Add `registry/snapshot.ts`. It rewrites `<state-dir>/registry-snapshot.json` whole, as `{"fetchedAt","payload"}`, on every successful registry fetch. When the fetch fails, the GET resolution serves the record from that snapshot and marks it with DS-23 (`fetchedAt`, `ageSeconds`) next to the DS-6/DS-7 cause. The stored generation is never advanced. With no usable snapshot, the answer stays `{"degraded":[DS-6|DS-7]}` alone. Health gains a registry leg that calls the same `registryFailure` discriminator.

## Boundaries & Constraints

**Always:**
- **Snapshot file:**
  - `registry/snapshot.ts` owns `<state-dir>/registry-snapshot.json` (`SNAPSHOT_FILE`). It is a file, never a table: no migration and no `turns/store.ts` change.
  - The write is whole and atomic: write a temp file in the same directory, then `renameSync`, mode `0600`.
  - The body is exactly `{"fetchedAt":"<ISO-8601 UTC Z>","payload":<the parsed registry JSON>}`, keys in that order.
  - The write happens on **every** successful `fetchRegistry`: the parsed payload has passed `indexRegistry`, whether the caller is resolution, the mutation guard or health.
  - A write failure never fails the fetch. It logs error `snapshot_write_failed` (`ds:'DS-5'`, `path`, `detail`).
- **Fallback conditions:** the fallback happens only when the fetch itself failed: `RegistryUnreachable` → DS-6, or `RegistryUnparseable` thrown by `fetchRegistry` → DS-7.
  - A `deriveRecord` failure on a fetched entry stays plain DS-7 with no fallback, because the registry answered.
  - Only the GET resolution falls back. `mutationResolver` and `currentProject` never serve a snapshot, because a stale copy cannot validate a mutation.
- **The snapshot answer:** a `200` with the full `ProjectRecord`. `degraded` is ordered:
  1. the Bridge-wide entries (DS-25);
  2. `{"ds":"DS-23","params":{"fetchedAt":"<the snapshot's>","ageSeconds":"<floor(now-fetchedAt), ≥0, decimal string>"}}`;
  3. the DS-6/DS-7 cause, exactly as `registryFailure` built it;
  4. then `probePaths` (DS-9/DS-10/DS-20) on the snapshot record.
- **Other snapshot outcomes:**
  - The pjid is absent from the snapshot, or its entry fails `deriveRecord`: the answer is `{"degraded":[<cause>]}` alone. It is never DS-2, because the Bridge cannot claim the pjid is unknown while the registry is down.
  - The snapshot is missing: `{"degraded":[<cause>]}` alone, and nothing is logged beyond the existing `degraded` warn.
  - The snapshot is unreadable (bad JSON, `fetchedAt` not a valid date, `payload` failing `indexRegistry`): the same answer. It also logs warn `snapshot_unreadable` (`ds` = the cause's ds, `path`, `detail`).
- **Generation from a snapshot:** it is **never** minted and never written. If a store row exists and its `recordHash` equals `recordHash(snapshotRecord)`, serve its `generation`. Otherwise serve `0` ("cannot validate"), and use `0` under DS-25.
  - A snapshot serve logs warn `served_from_snapshot` (`ds:'DS-23'`, `pjid`, `generation`, `fetchedAt`, `ageSeconds`) instead of `resolved`.
- **Age:** the age is surfaced and never enforced. No threshold constant exists anywhere, so `grep -rniE "MAX_AGE|maxAge|EXPIR|STALE_AFTER|TTL" packages/bridge/src/registry/` must return nothing.
- **DS-6 and DS-7 shapes:**
  - DS-6 is `{"ds":"DS-6","params":{"endpoint":<registry URL>}}`. It gains `remedy: "systemctl --user start pjangler-project-registry.service"` only when the registry URL's hostname is loopback (`127.0.0.1`, `localhost`, `[::1]`). Otherwise the key is omitted, never `""`.
  - DS-7 keeps `params.error` verbatim as the Bridge received it: the existing `"<status> <statusText>"` or the `JSON.parse` message.
- **The one discriminator:** `registryFailure` stays the only DS-6/DS-7 discriminator, with exactly two non-test call sites: `registry/client.ts` (resolution) and `health/registry.ts` (health).
- **Health registry leg:** `health/registry.ts` exports `registryHealth(registryUrl, snapshot)`, which returns `() => Promise<Degraded[]>`.
  - It runs `fetchRegistry` (which rewrites the snapshot) and returns `[]` on success, or `[registryFailure(...)]`.
  - `createBridgeServer` gains an optional `probes?: () => Promise<Degraded[]>`. Health appends its result after the Bridge-wide entries, and `status` stays `'ok'`.
  - `main.ts` wires it in. Without `probes`, health output is unchanged.
- **Imports:** `http.ts` still does not import `registry/client.ts` or `registry/snapshot.ts`.

**Block If:** none anticipated.

**Never:**
- Add a `DsCode` or change `CONTRACT_VERSION`: DS-23 already exists.
- Add a TTL, a max-age or an in-memory registry cache.
- Advance or write `resolutions` from a snapshot serve.
- Serve a snapshot to a mutation.
- Build 1.13's `dependencies[]`.
- Edit `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Healthy ×3 | three GETs, stub up | 200 record; snapshot rewritten each time (mtime advances past a back-dated value; fetchedAt advances) | none |
| Down, snapshot | stub closed after one good GET | 200 full record; degraded `[DS-23{fetchedAt,ageSeconds}, DS-6{endpoint,remedy}]`; `resolutions` row byte-identical | warn `served_from_snapshot` |
| Error, snapshot | stub `override {500}` or body `not json` | 200 record; `[DS-23, DS-7{error verbatim}]` | warn `served_from_snapshot` |
| Down, no snapshot | fresh state dir, no stub | 200 `{"degraded":[DS-6]}` only — no record keys | existing warn `degraded` |
| Error, no snapshot | stub 500 / not json | 200 `{"degraded":[DS-7]}` only | existing warn |
| 45-day-old snapshot | snapshot file with fetchedAt −45d, registry down | 200 record, `ageSeconds` ≥ 3888000 | none enforced |
| pjid not in snapshot | registry down, snapshot lacks pjid | 200 `{"degraded":[DS-6]}` | no DS-2 |
| Corrupt snapshot | file `{bad` | 200 `{"degraded":[DS-6]}` | warn `snapshot_unreadable` |
| Non-loopback URL | `http://nonexistent.invalid` | DS-6 with `endpoint`, no `remedy` key | none |
| Hash moved since mint | snapshot record hash ≠ stored hash | served with `generation: 0` | none |
| Mutation, registry down, snapshot present | POST via `mutationResolver` | 200 `{"degraded":[DS-6]}`; handler never runs | unchanged 1.7 behavior |
| Health, registry down | `probes` wired | `degraded` includes DS-6 from `registryFailure` | none |

</intent-contract>

## Code Map

- `packages/bridge/src/registry/client.ts`:
  - `registryFailure` (:30) is the discriminator. Add the loopback `remedy` there, with the `REGISTRY_UNIT` constant.
  - `fetchRegistry(url)` (:58) gains an optional `snapshot` param and calls `snapshot?.write(payload)` after `indexRegistry` succeeds.
  - `resolveProject` (:120) today catches everything, derive included, into DS-6/DS-7. Split it so that fetch failures are distinguishable. Suggested: `resolveProject(url, pjid, {snapshot, fallback})` returns `{record, served?: {fetchedAt, ageSeconds, cause}}`. `indexRegistry` and `deriveRecord` are reused to read the snapshot payload.
- `packages/bridge/src/registry/snapshot.ts` (new):
  - `SNAPSHOT_FILE`, and `openSnapshot(stateDir, {now?, log?})` returning `RegistrySnapshot {path, write(payload), read(): {fetchedAt, payload} | undefined}`. `read` returns `undefined` when the file is missing and throws when it is corrupt.
  - `snapshotAge(fetchedAt, now)`.
  - It imports `node:fs`, which is allowed because only the bridge package may.
- `packages/bridge/src/registry/generation.ts:19`: `recordHash(record)`. It is used to decide whether the stored generation still describes the snapshot record.
- `packages/bridge/src/turns/store.ts:44`: `readResolution(pjid)`. Read only; the snapshot path never calls `mintGeneration` or `writeResolution`.
- `packages/bridge/src/server/project.ts`:
  - `ProjectRoutesOptions` gains `snapshot?: RegistrySnapshot`.
  - `currentProject` stays fresh-only; it passes the snapshot for writing, with no fallback.
  - The GET handler resolves with fallback, then composes `degraded` in the order the constraints give.
  - `mutationResolver` is unchanged in behavior.
- `packages/bridge/src/health/registry.ts` (new): `registryHealth`.
- `packages/bridge/src/server/http.ts:90`: `healthHandler(startedAt, degraded)`. It becomes async and appends `options.probes?.()`. `BridgeServerOptions` gains `probes`.
- `packages/bridge/src/log.ts`: add warn `served_from_snapshot`, warn `snapshot_unreadable` and error `snapshot_write_failed`. The existing type check forces `ds` on each.
- `packages/bridge/src/main.ts:112`: build `openSnapshot(stateDir)` once and pass it to `projectRoutes` and `registryHealth`. This must also happen under DS-25.
- `packages/bridge/test/main.test.ts`:
  - The DS-25 test (~:195-255) asserts `readdirSync(stateDir)` is `['turns.db']`. It must now allow `registry-snapshot.json`.
  - The `UNROUTABLE_REGISTRY_URL` health assertions may now see DS-6 in `degraded`. Adjust them wherever `probes` is live.
- `packages/bridge/test/stub-registry.ts`: `override`, `hang` and `close()` give the down and error branches.
- `packages/bridge/src/server/project.test.ts`: `bridge()` helper pattern, used for the new snapshot conformance cases.

## Tasks & Acceptance

**Execution:**
- `packages/bridge/src/registry/snapshot.ts` (+`snapshot.test.ts`): cover the atomic whole-file write, the key order, missing vs corrupt reads, and `snapshotAge` flooring and clamping.
- `packages/bridge/src/registry/client.ts` (+`client.test.ts`):
  - Snapshot write on a successful fetch only; no write on 500, bad JSON, or a missing `projects` object.
  - The fallback split, and the loopback `remedy`.
  - Tests for refused (a closed stub port), DNS (`http://nonexistent.invalid`, no remedy), non-2xx and unparseable.
- `packages/bridge/src/log.ts`: the three events.
- `packages/bridge/src/server/project.ts`: fallback on GET only, snapshot generation lookup, `degraded` ordering, and the `served_from_snapshot` / `snapshot_unreadable` logs.
- `packages/bridge/src/health/registry.ts` (+ a test): the health leg.
- `packages/bridge/src/server/http.ts`: `probes` option and async health.
- `packages/bridge/src/main.ts`: wiring.
- `packages/bridge/src/server/snapshot.conformance.test.ts` (new): drive every I/O matrix row against a live `createBridgeServer` with a stub registry and temp state dir.
  - Assert raw bodies. The no-snapshot body has only the `degraded` key.
  - Assert that the `resolutions` row read via the store is `deepEqual` before and after the outage.
  - Assert that `store.inspect()` tables contain no `registry_snapshots`.
  - Assert that the mutation row still refuses to run the handler.
- `packages/bridge/test/main.test.ts`: adjust the state-dir listing and health expectations.

**Acceptance Criteria:**
- Given a healthy stub and three consecutive GETs, with the snapshot's mtime back-dated via `utimesSync` before each, then after each GET the mtime is newer than the back-dated value and the file parses to `{fetchedAt, payload}` with `payload.projects` present.
- Given one good GET, then the stub closed, when `GET /v1/project/sidepiece` is made, then the status is 200, the body carries every `ProjectRecord` key, `degraded` contains DS-23 with `fetchedAt` and a decimal `ageSeconds`, and `readResolution('sidepiece')` is `deepEqual` to its value before the outage.
- Given `grep -rn "registryFailure(" packages/bridge/src --include=*.ts --exclude=*.test.ts`, then there is exactly one `function registryFailure(` definition and two call sites: `registry/client.ts` and `health/registry.ts`.
- Given `grep -rniE "MAX_AGE|maxAge|EXPIR|STALE_AFTER|TTL" packages/bridge/src/registry/`, then there is no output.
- Given `mise run lint && mise run test && mise run build`, then all exit 0.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 1, low 5)
- defer: 0
- reject: 30: (high 0, medium 3, low 27)
- addressed_findings:
  - `[medium]` `[patch]` Nothing tested the `main.ts` wiring: dropping `probes:` or `snapshot` left every test green. A new spawned-bundle test in `test/main.test.ts` does a good GET, closes the stub, then asserts that the GET returns DS-23 followed by DS-6 (endpoint + remedy) and that health equals `[DS-6]`. Removing either wiring line is confirmed to fail it.
  - `[low]` `[patch]` A snapshot entry that failed `deriveRecord` was logged as `snapshot_unreadable`, which contradicts the spec's "cause alone". `deriveRecord` now runs outside the logging try, and a test covers it.
  - `[low]` `[patch]` A stale `<path>.<pid>.tmp` kept its old mode. The temp file is now removed before the write, and a test checks the result is 0600.
  - `[low]` `[patch]` `isLoopback` missed the rest of 127.0.0.0/8. It now matches `127.x.y.z`, tested with 127.0.1.1 and 128.0.0.1.
  - `[low]` `[patch]` Nothing pinned the health `degraded` order. A test now asserts `[DS-25, DS-6]`.
  - `[low]` `[patch]` Nothing tested the mutation guard's snapshot write. A POST with the registry up and no prior GET now asserts that the snapshot file appears.

## Design Notes

- **Why DS-6/DS-7 ride alongside DS-23:** `EXPERIENCE.md`'s DS-6 and DS-7 rows were amended to "partial when it holds one". A partial DS-6 has to be emitted to be rendered, and DS-7's verbatim error is the only place the cause is named. DS-23 carries the age, and the cause entry says why the snapshot is being served. The AC's "contains DS-23" allows both entries.
- **Why a pjid missing from the snapshot is not DS-2:** DS-2 tells the operator to declare the Project, which is the wrong fix while the registry is down. The honest total answer is the cause.
- **Why generation 0 on a hash mismatch:** the snapshot is rewritten on *every* fetch, so it can hold a newer entry for pjid X than X's last mint. Serving that record with X's old generation would stamp new content with an old identity. Minting is forbidden: a stale copy is not new information. `0` is the existing "cannot validate" value from DS-25.
- **Why mutations never fall back:** SM-3 needs a fresh resolution. A snapshot cannot prove a rename did not happen.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build` -- expected: exit 0.
- `grep -rn "registryFailure(" packages/bridge/src --include=*.ts --exclude=*.test.ts` -- expected: 1 definition and 2 call sites.
- `grep -rniE "MAX_AGE|maxAge|EXPIR|STALE_AFTER|TTL" packages/bridge/src/registry/` -- expected: no output.

**Manual checks (if no CLI):**
- A live `curl` against `127.0.0.1:8787` with the real `pjangler-project-registry.service` stopped needs a deployed Bridge (Story 1.10) and stopping a live service. The operator runs that transcript; the conformance test proves the same behavior in-process.

## Auto Run Result

Status: awaiting-operator

**Summary:** The Bridge keeps a last good copy of the pjangler registry. `registry/snapshot.ts` rewrites `<state-dir>/registry-snapshot.json` whole and atomically (`{fetchedAt, payload}`, mode 0600) on every successful fetch, whether the fetch came from resolution, the mutation guard or health. When the fetch itself fails, `GET /v1/project/<pjid>` serves the record from the snapshot and marks it with degraded entries in this order:
1. the Bridge-wide entries;
2. `DS-23 {fetchedAt, ageSeconds}`;
3. the DS-6/DS-7 cause;
4. the on-disk probe.

The generation is never minted from a snapshot. It is the stored generation when the stored hash matches the snapshot record, and `0` otherwise. With no usable snapshot, a missing pjid, or a bad entry, the answer is the cause alone, never DS-2. Mutations never fall back. DS-6 gains `remedy: systemctl --user start pjangler-project-registry.service` for a loopback registry only. Health gains a registry leg through the same `registryFailure` discriminator. The age is surfaced and has no threshold.

**Files changed:**
- `packages/bridge/src/registry/snapshot.ts` (new): the snapshot file, the atomic write, read, and `snapshotAge`.
- `packages/bridge/src/registry/client.ts`: the snapshot write in `fetchRegistry`, the fallback split in `resolveProject`/`fromSnapshot`, and the loopback remedy on DS-6.
- `packages/bridge/src/health/registry.ts` (new): `registryHealth`, the second call site of the discriminator.
- `packages/bridge/src/server/project.ts`: the GET fallback, `snapshotGeneration`, the degraded ordering, and the `served_from_snapshot` log.
- `packages/bridge/src/server/http.ts`: the `probes` option and the async health handler.
- `packages/bridge/src/log.ts`: `served_from_snapshot`, `snapshot_unreadable` and `snapshot_write_failed`.
- `packages/bridge/src/main.ts`: `openSnapshot(stateDir)` wired into the routes and health.
- Tests:
  - new `snapshot.test.ts`, `health/registry.test.ts` and `server/snapshot.conformance.test.ts`;
  - extended `client.test.ts`, `http.test.ts`, `project.test.ts`, `mutating.conformance.test.ts` and `test/main.test.ts`.

**Review findings:** 6 patches applied (1 medium, 5 low), 0 deferred, 30 rejected. The rejected findings are:
- Behavior the spec settles: every health request fetches and writes; a snapshot is written even when one entry is bad; a missing pjid logs nothing; DS-6/DS-7 are sent alongside DS-23; generation 0 on a hash mismatch.
- A 500 when a probe fails with a non-registry Bridge bug. This is the established 5xx-for-Bridge-bugs posture.
- Durability and race concerns: no fsync; `fetchedAt` stamped at write time; out-of-order concurrent writes.
- Remaining items: clock skew clamped to 0; the chmod test under root; a snapshot format version; test aliasing and other cosmetic points.

**Follow-up review recommendation:** true. Patched: high 0, medium 1, low 5. Score is 3×1 + 5 = 8, which is 5 or more.

**Verification:**
- `mise run lint && mise run test && mise run build`: exit 0. Contract passed 5/5; bridge passed 185/185, with 0 skipped.
- `grep -rn 'registryFailure(' packages/bridge/src --include='*.ts' --exclude='*.test.ts'`: 1 definition (`registry/client.ts`) and 2 call sites (`registry/client.ts` for resolution, `health/registry.ts` for health).
- `grep -rniE 'MAX_AGE|maxAge|EXPIR|STALE_AFTER|TTL' packages/bridge/src/registry/`: no output.
- Every I/O matrix row has a passing test in `server/snapshot.conformance.test.ts`, `registry/client.test.ts` and `health/registry.test.ts`.

**Operator actions owed:** the live transcript. The Bridge must be running on 127.0.0.1:8787, which needs Story 1.10, and the real `pjangler-project-registry.service` must be stopped. See `operator_actions` in the frontmatter. The in-process conformance and spawned-bundle tests prove the same behavior.

**Residual risks:**
- Every `/v1/health` call now does a full registry fetch (up to the 2s timeout) and rewrites the snapshot. Story 1.13 may want a shared in-flight probe.
- The snapshot write is not fsynced. After a power loss it can be lost, and the reader then treats it as unreadable, answering with the cause alone.
- The Cockpit (Epic 2) must key partial versus total on DS-23 or on record presence, because DS-6/DS-7 now also appear on a partial answer.
