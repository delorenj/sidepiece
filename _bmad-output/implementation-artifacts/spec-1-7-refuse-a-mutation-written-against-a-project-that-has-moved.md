---
title: 'Story 1.7: Refuse a mutation written against a Project that has moved'
type: 'feature'
created: '2026-09-24'
status: 'in-progress'
baseline_revision: 'c42575e5ecf3c19de6d8342d626e49e83396a66d'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** The Bridge mints a per-pjid generation (Story 1.6), but nothing compares it against anything. A mutation written against a Project Record that has since changed would run against the wrong Project, and SM-3 has no enforcement.

**Approach:** Put the one definition of stale in `registry/generation.ts` (`assertCurrentGeneration`), and add a `mutatingRoute()` helper to `server/http.ts`. The helper parses the body's `generation` field, **re-resolves the pjid to learn the current generation**, then refuses with `409 stale_generation` or runs the handler. `createBridgeServer` refuses to start with any mutating method that was not registered through the helper.

## Boundaries & Constraints

**Always:**
- **Stale is defined once:** `assertCurrentGeneration(pjid, received, current)` in `registry/generation.ts`.
  - `received < current` throws `StaleGenerationError`, which carries the `Refusal`.
  - `received === current` returns.
  - `received > current` throws `GenerationAheadError`.
  - No other file compares generations.
- **Where `current` comes from:** a fresh resolution, which means one registry fetch plus `mintGeneration`, run by the guard on every mutating request. It is never the last value a GET happened to store. A rename that no GET has seen yet must still refuse the older generation; this is SM-3's dangerous case.
  - `server/project.ts` exports `currentProject(options)`, which the GET handler uses, and `mutationResolver(options)`, which wraps it for the guard.
  - Failures are the same as for GET: unknown pjid is DS-2, registry failure is DS-6/DS-7 (both `200 {degraded}`), and the handler does not run.
  - Under DS-25 (no store, generation `0`) the guard answers `200 {"degraded":[<the DS-25 entry>]}` and the handler does not run. `0` means "cannot validate".
- **`mutatingRoute(resolve, handler)` in `server/http.ts`:** it returns a `Handler` that runs these steps in order.
  1. Read the body, capped at `MAX_BODY_BYTES = 65_536`.
  2. Parse it as JSON.
  3. Require a top-level `generation`.
  4. Validate it as a safe non-negative integer.
  5. Call `resolve(pjid)`.
  6. Call `assertCurrentGeneration`.
  7. Call `handler(req, ctx)`, where `ctx = {pjid, generation, record, body}`.
  - The pjid comes from the path params only. A `pjid` key in the body is ignored.
  - `http.ts` must not import `registry/`: `resolve` is injected.
- **Enforcement:** `mutatingRoute` marks the handlers it returns (a module-private `WeakSet`). `createBridgeServer` throws `TypeError('unguarded mutating route: <METHOD> <pattern>')` at construction when a route has a handler under any method other than `GET`, `HEAD` or `OPTIONS` that was not produced by `mutatingRoute`.
- **Wire shapes:** keys are in exactly this order, `X-Sidepiece-Contract: 1`, and `CONTRACT_VERSION` is unchanged.
  - Stale: `409` with `{"error":"stale_generation","pjid","received","current"}`. The `Refusal` type already exists in `contract/src/state.ts`. There is no `degraded` key.
  - No `generation` key (including a request that sends it only as a header): `400` with `{"error":"missing_generation","pjid","field":"generation"}`.
  - `generation` present but not a safe integer ≥ 0 (string, float, negative, null): `400` with `{"error":"invalid_generation","pjid","field":"generation"}`.
  - Body that is not JSON, not a plain object, or over the cap: `400` with `{"error":"invalid_body","pjid"}`.
  - The three 400 shapes are added to `contract/src/errors.ts` `BridgeError`.
- **Errors:** `server/errors.ts` gains `HttpRefusal` (status plus typed body). `toErrorResponse` maps `StaleGenerationError` to 409 and `HttpRefusal` to its own status. `http.ts` sends both without writing `degraded` warn lines.
  - A stale refusal logs `info` `mutation_refused` with `pjid`, `received` and `current`.
  - A `GenerationAheadError` logs `error` `generation_ahead_of_bridge` with `ds:'DS-5'`, `pjid`, `received` and `current`, then is answered `500 internal_error`.
- **Definition of done:** `DEFINITION-OF-DONE.md` item 1 names `mutatingRoute()` and states that `tsc` cannot see a missing call.

**Block If:** none anticipated.

**Never:**
- Create a real mutating capability or a production POST route. Only test fixtures register through `mutatingRoute` (Epic 2 owns `…/ticket`, Epic 3 owns `…/turn`).
- Add a `DsCode`, change `CONTRACT_VERSION`, or add a migration.
- Add the snapshot fallback (Story 1.9), a client-side pre-check (Epic 2), or preflight/CORS (Story 1.11).
- Accept a generation from a header, or read the pjid from the body.
- Edit `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Current | stored gen 5, POST `{"generation":5}` | fixture handler's own 200 body; handler invoked once | none |
| Stale after rename, no GET between | resolved at 4, record changed, POST `{"generation":4}` | 409 `{"error":"stale_generation","pjid":"p","received":4,"current":5}`; handler never invoked | info `mutation_refused` |
| Ahead | current 5, POST `{"generation":9}` | 500 `internal_error`; handler never invoked | error `generation_ahead_of_bridge` with 9 and 5 |
| Header only | `X-Sidepiece-Generation: 4`, body `{}` | 400 `missing_generation` | no registry fetch |
| Bad value | `{"generation":"4"}` / `4.5` / `-1` / `null` | 400 `invalid_generation` | no registry fetch |
| Bad body | `not json`, `[4]`, or > 64 KiB | 400 `invalid_body` | no registry fetch |
| Body pjid | path `sidepiece`, body `{"generation":g,"pjid":"vinyl"}` | guard and handler see `sidepiece` | none |
| Unknown pjid | POST to `/v1/project/nope/x` | 200 `{"degraded":[DS-2]}` | handler never invoked |
| Registry down | refused connection | 200 DS-6 | handler never invoked |
| Store ahead | DS-25, generation 0 | 200 `{"degraded":[DS-25]}` | handler never invoked |
| Unguarded | route table with a raw `POST` handler | `createBridgeServer` throws `TypeError` | refused at construction |

</intent-contract>

## Code Map

- `packages/bridge/src/registry/generation.ts` -- has `recordHash` and `mintGeneration`. Add `assertCurrentGeneration`, `StaleGenerationError` (carrying `refusal: Refusal`) and `GenerationAheadError` (carrying `pjid`, `received` and `current`).
- `packages/bridge/src/server/http.ts` --
  - `Handler = (req, params)`; `matchRoute` returns `{route, params}`.
  - The catch branch (about lines 213–240) maps `toErrorResponse`. Today it is either 500 or degraded; add the refusal and 400 branches there.
  - `createBridgeServer` merges `builtinRoutes` and `options.routes`. The unguarded check runs on the merged table.
- `packages/bridge/src/server/errors.ts` -- `DegradedError` and the `ErrorResponse` union. Extend the union with `409 Refusal` and `400 BridgeError`.
- `packages/bridge/src/server/project.ts` -- extract the GET handler's resolve and mint into an exported `currentProject({registryUrl, store, degraded})` that returns `(pjid) => Promise<ProjectRecord>`. It throws `DegradedError` for DS-2 and DS-6/DS-7, and the record carries `generation: 0` under DS-25. Also export `mutationResolver(options)`, which wraps it: a record with `generation < 1` throws `DegradedError` carrying the DS-25 entry from `degraded()`. The GET response must stay byte-identical.
- `packages/bridge/src/log.ts` -- a closed union of events. Add info `mutation_refused` and error `generation_ahead_of_bridge` (it needs `ds`; use DS-5).
- `packages/contract/src/errors.ts` -- `BridgeError`. Add `missing_generation`, `invalid_generation` and `invalid_body`.
- `packages/contract/src/state.ts:48` -- `Refusal` already has the exact key order. Reuse it and do not redeclare it.
- `packages/bridge/src/server/http.test.ts:43-47` -- the `/multi` fixture registers a raw `DELETE`. The new construction check breaks it, so wrap that fixture in `mutatingRoute` with a stub resolver (the `Allow` header test stays the same).
- `packages/bridge/src/server/project.test.ts` -- `bridge()` helper pattern: stub registry, real store, ephemeral port, captured log lines.
- `packages/bridge/test/stub-registry.ts` -- `stub.projects` can be mutated between requests; changing `repoPath` changes the hash.
- `packages/bridge/src/outbound.test.ts` -- every `fetch(` needs a `signal`. Tests use `AbortSignal.timeout`.
- `DEFINITION-OF-DONE.md` -- item 1.

## Tasks & Acceptance

**Execution:**
- `packages/contract/src/errors.ts` -- add the three 400 `BridgeError` variants.
- `packages/bridge/src/registry/generation.ts` (+`generation.test.ts`) -- `assertCurrentGeneration` plus its two errors. Tests cover: equal passes; less throws a Refusal with the key order `error, pjid, received, current`; greater throws the ahead error.
- `packages/bridge/src/server/errors.ts` -- `HttpRefusal`, and the extended `toErrorResponse`.
- `packages/bridge/src/log.ts` -- the two new events.
- `packages/bridge/src/server/http.ts` (+`http.test.ts`) -- `mutatingRoute`, `MAX_BODY_BYTES`, the guarded-handler `WeakSet`, the construction-time `TypeError`, the 409/400 send paths and the log lines. Fix the `/multi` fixture. Add unit tests for the body and validation matrix rows (a stub resolver counting its calls asserts no resolve on a 400), and for the unguarded `TypeError`.
- `packages/bridge/src/server/project.ts` -- `currentProject` and `mutationResolver`; the GET handler uses `currentProject`.
- `packages/bridge/src/server/mutating.conformance.test.ts` -- boots `createBridgeServer` with `projectRoutes` plus a fixture `POST /v1/project/:pjid/fixture` built by `mutatingRoute(mutationResolver(...), handler)`. The handler records each invocation and returns `{status:200, body:{fixture:'ok', pjid, generation}}`. Tests use a stub registry and a temp store. Use raw `node:http` requests so the status line (`HTTP/1.1 409 Conflict`) and the raw body bytes are asserted. Cover every I/O matrix row that needs a live server, including stale with no GET between the rename and the POST.
- `DEFINITION-OF-DONE.md` -- reword item 1.

**Acceptance Criteria:**
- Given the conformance test, when a pjid is walked to generation 4 by changing `repoPath` and re-resolving, the record is changed again, and the fixture is POSTed `{"generation":4}`, then the raw response has status line `HTTP/1.1 409 Conflict`, `content-type` beginning with `application/json`, and `x-sidepiece-contract: 1`. The body is byte-equal to `{"error":"stale_generation","pjid":"sidepiece","received":4,"current":5}`, and the fixture's invocation count is unchanged.
- Given the same state, when the POST carries `{"generation":5}`, then the fixture's own 200 body comes back and the invocation count is 1.
- Given `grep -rn "received < current\|received > current" packages --include=*.ts --exclude-dir=node_modules`, then the only non-test hit is in `registry/generation.ts`.
- Given `mise run lint && mise run test && mise run build`, then all exit 0.

## Spec Change Log

## Review Triage Log

## Design Notes

- **Why re-resolve in the guard:** comparing against the stored row would pass window A's `4` when no one has re-resolved since the rename. That is exactly SM-3's "silent on the dangerous one". One registry fetch is about 2ms and every future mutating handler needs the fresh record anyway, so `ctx.record` hands it over.
- **Why validation runs before the fetch:** a 400 compared nothing, so it should cost nothing and touch no upstream.
- **Why ahead is a 500:** D11 calls it impossible, "a Bridge bug". The route must not run, and it is not the operator's stale window. `DS-5` is the Bridge's own internal-error code, and it is used here only to satisfy the log invariant that every error line carries a `ds`.
- **Why a runtime check as well as the DoD:** `tsc` cannot see a missing call, but a `WeakSet` membership check at construction can. The DoD line remains the human check for a capability invoked from a GET handler.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build` -- expected: exit 0.
- `mise run test` output lists every `mutating.conformance.test.ts` case as passing.
