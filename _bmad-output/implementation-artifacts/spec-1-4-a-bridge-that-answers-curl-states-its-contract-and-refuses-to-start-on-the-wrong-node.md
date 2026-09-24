---
title: 'Story 1.4: A Bridge that answers curl, states its contract, and refuses to start on the wrong Node'
type: 'feature'
created: '2026-09-24'
status: 'awaiting-operator'
baseline_revision: 'a9d8a5ea59203ee0aa41fdbaff12a708364abdfb'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
operator_actions:
  - "Free 127.0.0.1:8787 for the Bridge: curator-serve.service (folder-curator `serve`, default --port 8787, pid 6375 today) holds it, so move folder-curator to another port and repoint the n8n-nodes-folder-curator node at it, or amend architecture.md's Bridge port instead"
  - "With 8787 free, run `node packages/bridge/dist/bridge.mjs & sleep 1; curl -s -D- http://127.0.0.1:8787/v1/health; ss -ltnp | grep 8787; kill %1` on big-chungus and confirm HTTP/1.1 200 OK, X-Sidepiece-Contract: 1, and exactly one listener on 127.0.0.1:8787"
---

<intent-contract>

## Intent

**Problem:** `packages/bridge/src/index.ts` prints one line and exits. There is no daemon to `curl`, no `X-Sidepiece-Contract` header, no Node pin, no error-to-code mapping and no structured log. A drifted runtime would fail hours later as a Degraded nobody can attribute (AR25, FR-15(d), NFR-8, UX-DR51).

**Approach:** Replace the stub with `main.ts`. It asserts the Node pin as its first act, then starts a `node:http` server bound to `127.0.0.1:8787` with one route, `GET /v1/health`. Every response carries the contract header. `server/errors.ts` turns anything a handler throws into a typed body. `log.ts` writes typed JSON lines to stdout. A co-located scan test fails any outbound call in `src/` without a timeout.

## Boundaries & Constraints

**Always:**
- The pin is `>=24.15.0 <25`, checked against `process.versions.node`. On failure, write exactly `sidepiece-bridge requires Node >=24.15.0 <25; this is ${process.version}. Refusing to start.` plus `\n` to stderr, then exit 1. This runs before any listen, file or DB access, and before any env parsing.
- Bind host is the literal `'127.0.0.1'` and is never configurable. The port defaults to `8787`. `SIDEPIECE_BRIDGE_PORT` (an integer from 0 to 65535, where 0 means ephemeral) overrides it for tests only. An invalid value logs `config_invalid` and exits 1.
- Health body, flat and in this key order: `{status:'ok', contractVersion: CONTRACT_VERSION, node: process.version, startedAt, checkedAt, degraded: []}`. Both timestamps come from `new Date().toISOString()`.
- Every response carries `X-Sidepiece-Contract: ${CONTRACT_VERSION}` and `Content-Type: application/json; charset=utf-8`. That includes 404, 405 and 500 responses.
- Routing uses the pathname only, with the query ignored. An unknown path returns `404 {"error":"not_found","path":<pathname>}`. A known path with the wrong method returns `405 {"error":"method_not_allowed","method","path"}` plus an `Allow` header.
- `server/errors.ts` maps what a handler throws:
  - A `DegradedError` (it carries a `Degraded`) becomes `200 {"degraded":[d]}`.
  - Anything else becomes `500 {"error":"internal_error"}`. The thrown message never reaches the body.
- Response and wire types (`BridgeHealth`, `BridgeError`) live in `@sidepiece/contract` only (AR22). All keys are camelCase.
- Logs are one JSON object per line on stdout, shaped `{ts, level, event, ...}`:
  - `event` is a typed union.
  - `pjid` is top-level on Project-scoped lines. None exist yet, but the type carries the optional key.
  - Every `level:'error'` line carries a `ds: DsCode`. The type enforces this.
  - The client address is read from `X-Forwarded-For` (first hop), falling back to the socket address.
  - There is no free-form `msg` field. A caught error's own `.message` may ride as `detail`, verbatim.
- The ds used for a Bridge-side failure (a 500, a failed listen, an invalid config) is `DS-5`, or `DS-4` when the listener never came up. That is what the Cockpit will render for it. See Design Notes.

**Block If:** none anticipated.

**Never:**
- No `packages/extension` or `packages/ui`, and no store, registry, credentials or `dependencies[]` rows. Those belong to Stories 1.5, 1.6, 1.12 and 1.13.
- No CORS or `Access-Control-Allow-Private-Network` handling. That is Story 1.11.
- No systemd unit and no deploy task. That is Story 1.10.
- No new `DsCode`, and no change to `state.ts`'s unions.
- No listen on `0.0.0.0`, `::` or a tailnet address.
- Do not edit `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Health | `GET /v1/health` on Node 24.15.x | 200 with the exact body above and the contract header | none |
| Query string | `GET /v1/health?x=1` | same as Health | none |
| Unknown path | `GET /nope` | `404 {"error":"not_found","path":"/nope"}` with the header | none |
| Wrong method | `POST /v1/health` | 405, `Allow: GET` | none |
| Handler throws Error("boom secret prose") | any route | `500 {"error":"internal_error"}`, with no "boom" in the body. The error log line carries `ds`. | caught in errors.ts |
| Handler throws DegradedError(DS-7) | any route | `200 {"degraded":[{"ds":"DS-7",...}]}` | caught in errors.ts |
| Node 22.22.2, 24.6.0 or 26.5.0 | start the bundle | the exact stderr line, exit 1, nothing listening, and the read-only state dir untouched | none |
| Bad port env | `SIDEPIECE_BRIDGE_PORT=abc` | a `config_invalid` error line with `ds`, exit 1 | none |
| Port busy | 8787 already bound | a `listen_failed` error line with `ds:'DS-4'` and `code`, exit 1 | none |

</intent-contract>

## Code Map

- `packages/bridge/src/index.ts` -- the current stub, which logs `contract v${CONTRACT_VERSION}`. Delete it. `main.ts` replaces it as the entry point.
- `packages/bridge/tsup.config.ts` -- `entry: { bridge: 'src/index.ts' }`. Repoint it to `src/main.ts`. The single-file, `node:`-only external setup stays. Keep splitting off, and never use a dynamic `import()` in `main.ts`, because the bundle must stay one file.
- `packages/bridge/test/bundle.test.ts` -- test 1 (only `node:` imports) is unchanged. Test 2 currently expects `/contract v\d+/` from a process that exits, and it must be rewritten. The new version starts the copied bundle with `SIDEPIECE_BRIDGE_PORT=0` and reads the `listening` JSON line for the port. It then fetches `/v1/health`, asserts `contractVersion === CONTRACT_VERSION` and the header, and kills the process.
- `packages/bridge/package.json` -- `test` is currently `tsup && node --test "test/*.test.ts"`. Extend it to also run `"src/**/*.test.ts"`, which picks up the co-located tests (A-P9), and add `"start": "node dist/bridge.mjs"`.
- `packages/bridge/tsconfig.json` -- includes `src` and `test` with node types. The co-located tests typecheck as they are.
- `packages/contract/src/index.ts` -- the barrel. Add `health.ts` and `errors.ts`.
- `packages/contract/src/state.ts` -- `Degraded` and `DsCode` are reused. Read-only.
- `packages/contract/src/version.ts` -- `CONTRACT_VERSION = 1`. Read-only.
- `lint/lint.sh` and the A-P1 grit rules -- scan all new files. The names `pjid` and `boardId` must never be misspelled.
- `mise.toml` -- the `test`, `build` and `lint` tasks already recurse into the packages. No change is needed.
- The Node installs at `~/.local/share/mise/installs/node/{22.22.2,24.6.0,26.5.0}/bin/node` exist on this host. The wrong-Node tests use them and `t.skip` any that are absent.

## Tasks & Acceptance

**Execution:**
- `packages/contract/src/health.ts` -- `BridgeHealth` type (the AC shape, `status: 'ok'`, `degraded: Degraded[]`) -- the wire type lives once (AR22). Story 1.13 widens it.
- `packages/contract/src/errors.ts` -- `BridgeError` is `{error:'not_found';path}`, `{error:'method_not_allowed';method;path}` or `{error:'internal_error'}` -- these are typed codes, never prose.
- `packages/contract/src/index.ts` -- re-export both.
- `packages/bridge/src/node-pin.ts` -- `nodeRefusal(versions: string, version: string): string | undefined`. It is a pure parse and compare -- testable without spawning.
- `packages/bridge/src/log.ts` -- `log(line)` is typed as a discriminated union over `event`, and error lines require `ds: DsCode`. It writes `JSON.stringify({ts, ...line})` plus `\n` to stdout -- this is A-P8.
- `packages/bridge/src/server/errors.ts` -- `DegradedError` class, and `toErrorResponse(err) -> {status, body}` -- this is UX-DR51.
- `packages/bridge/src/server/http.ts` -- `createBridgeServer({routes?, startedAt})` returns the `http.Server`. It holds the route table, applies the header everywhere, handles 404 and 405, sends every handler through errors.ts, and logs a `request` line per request. The health handler also lives here. `routes` is injectable so tests can force throws.
- `packages/bridge/src/main.ts` -- runs the pin check first. It then parses the port, listens on `127.0.0.1` and logs `listening` with `{host, port, contractVersion, node}`. It logs `listen_failed` and exits 1 on an error, and closes cleanly on SIGTERM and SIGINT.
- `packages/bridge/src/outbound.test.ts` -- scans `src/**/*.ts`, excluding `*.test.ts`. For each `fetch(`, `spawn(`, `spawnSync(`, `exec(`, `execSync(`, `execFile(`, `execFileSync(`, `connect(`, `createConnection(`, `request(` or `.get(` call on `http`/`https`, it requires `timeout` or `signal` inside the balanced argument list. Embedded fixture strings prove the scanner flags an untimed call and passes a timed one -- this is A-P7.
- `packages/bridge/src/node-pin.test.ts` -- a table test covering 24.15.0 and 24.99.1 (allowed), and 24.14.9, 24.6.0, 25.0.0, 22.22.2 and 26.5.0 (refused), plus the exact message.
- `packages/bridge/src/server/http.test.ts` -- starts a real server on port 0 and covers every I/O-matrix HTTP row, the header on every status, the ISO `Z` timestamps, a recursive camelCase key check, and "no prose": the 500 body must not contain the thrown message.
- `packages/bridge/test/main.test.ts` -- runs the built bundle. It covers the wrong-Node rows (read-only `SIDEPIECE_STATE_DIR` made with chmod 0o500 stays empty, exact stderr, exit 1), the bad port env and the busy port.

**Acceptance Criteria:**
- Given the bundle started on this host's Node 24.15.0, when `curl -s -D- http://127.0.0.1:8787/v1/health` is run, then the status is `HTTP/1.1 200 OK`, `X-Sidepiece-Contract: 1` is present, and the body matches the AC shape.
- Given the Bridge is running, when `ss -ltnp | grep 8787` is run, then exactly one listener is shown, on `127.0.0.1:8787`.
- Given `mise run lint && mise run test && mise run build`, when they are run, then all of them exit 0.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 14 (high 0, medium 6, low 8)
- defer: 0
- reject: 22
- addressed_findings:
  - `[medium]` `[patch]` `RequiresDs` in `log.ts` distributed over the union and could never fail. Replaced it with a non-distributive `[Exclude<Extract<…>,{ds}>] extends [never]` check that covers warn and error lines. Mutation-checked: making `ds` optional on one variant gives TS2322.
  - `[medium]` `[patch]` If a body failed to serialise (e.g. BigInt), `send` threw into `.catch`, which returned a 500 with no log line and could raise an unhandled rejection. There is now one `internalError` path: it logs `handler_failed` with DS-5, then sends a 500 or destroys the socket. A test covers it.
  - `[medium]` `[patch]` A handler that never settled hung forever, against A-P7. Added `handlerDeadlineMs` (default 10s). A handler past its deadline gets a 500 `internal_error` plus a `handler_timed_out` line with DS-5. A test covers it.
  - `[medium]` `[patch]` A `DegradedError` answer left no log line carrying its ds (A-P8). It now writes a `level:'warn'`, `event:'degraded'` line with `ds`. A test covers it.
  - `[medium]` `[patch]` No test asserted the loopback bind or the 8787 default. Moved `HOST` and `parsePort` into `config.ts`, with `config.test.ts` covering them. The bundle test now asserts that the `listening` line's host is `127.0.0.1`.
  - `[medium]` `[patch]` The throw-forcing test only exercised injected routes. Added `builtinRoutes()`; a new test forces every built-in route and method to throw and checks for a typed 500 with no prose.
  - `[low]` `[patch]` The request log hung off `'finish'`, so aborted requests went unlogged. It now uses `'close'`, and the flaky `setImmediate` wait is replaced by polling.
  - `[low]` `[patch]` `HEAD /v1/health` got a 405. HEAD now falls back to GET, and `Allow` lists `HEAD`.
  - `[low]` `[patch]` `Allow` listed methods whose handler was undefined. It now filters them out.
  - `[low]` `[patch]` When the URL fallback path was taken, the query string stayed in the path, and a `//x/v1/health` target was parsed as a host. Replaced both with `pathOf()`, which has tests.
  - `[low]` `[patch]` The Node pin regex had no anchor, so `24.15.0-rc.1` passed. It is anchored now, prereleases and nightlies are refused, and tests cover it.
  - `[low]` `[patch]` The outbound scanner missed `fork(` and `new WebSocket(`. Both are added, with fixtures.
  - `[low]` `[patch]` `spawn-bridge.ts` had three problems: a non-JSON line threw, `stopBridge` hung after a signal death, and spawn `'error'` was unhandled. All three are fixed. `bundle.test.ts` cleanup now always removes the temp dir and no longer hides the real assertion.
  - `[low]` `[patch]` `routes` doc comment clarified: overrides replace whole paths. `http.test.ts` `after()` now awaits `close`.

## Design Notes

**Which ds a Bridge-side failure logs.** A-P8 requires every failure line to carry a `DsCode`. None of the 21 `BridgeDsCode`s names "the Bridge crashed in a handler". Minting one would be a UX decision (DoD item 2), and this story is forbidden from making it. So the log uses the `DsCode` the operator will actually see:
- For a 5xx, the Cockpit sees a failed answer it cannot attribute. That is DS-5.
- When the listener never comes up, nothing is listening. That is DS-4.

The log type is widened to `DsCode`, not `BridgeDsCode`, for this reason only. `Degraded.ds` on the wire stays `BridgeDsCode`.

**Pin before everything.** Static imports carry no side effects: `node:http` opens nothing until `listen`. So `main.ts` can import normally, as long as its first statement is the check. That keeps the bundle a single file with no dynamic import.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build` -- expected: exit 0.
- `node packages/bridge/dist/bridge.mjs & sleep 1; curl -s -D- http://127.0.0.1:8787/v1/health; curl -s -D- http://127.0.0.1:8787/nope; ss -ltnp | grep 8787; kill %1` -- expected: the AC transcript.
- `SIDEPIECE_STATE_DIR=$(mktemp -d) ~/.local/share/mise/installs/node/22.22.2/bin/node packages/bridge/dist/bridge.mjs; echo $?` -- expected: the exact refusal line, then `1`.

## Auto Run Result

Status: awaiting-operator

**Summary:** The Bridge is now a daemon. `main.ts` checks the Node pin (`>=24.15.0 <25`) before anything else and refuses with the exact line and exit 1. It then serves `GET /v1/health` on a hard-coded `127.0.0.1` (default port 8787). Every response carries `X-Sidepiece-Contract` and the JSON content type:
- A throw is mapped to a typed body: `DegradedError` gives 200 with `degraded[]`, anything else gives 500 `internal_error`, never prose.
- An unknown path gives 404 `not_found`; a wrong method gives 405 with `Allow`.
- A handler has a 10s deadline.

Logs are typed JSON lines on stdout, and every warn and error line carries a `ds`. A co-located scan test fails any outbound call in `src/` that has no timeout. The one owed item is not code: port 8787 on big-chungus is held by `curator-serve.service` (folder-curator's HTTP engine for n8n), so the Bridge can't bind it yet. Freeing it is a cross-service port decision, listed under `operator_actions`.

**Files changed:**
- `packages/contract/src/health.ts`: `BridgeHealth` wire type.
- `packages/contract/src/errors.ts`: `BridgeError` (`not_found`, `method_not_allowed`, `internal_error`).
- `packages/contract/src/index.ts`: re-exports both.
- `packages/bridge/src/main.ts`: new entry point. Runs the pin, the port config, the loopback listen, `listen_failed` and `config_invalid` exits, and SIGTERM/SIGINT shutdown.
- `packages/bridge/src/config.ts` and `config.test.ts`: `HOST`, `DEFAULT_PORT` and `parsePort`, with tests.
- `packages/bridge/src/node-pin.ts` and `node-pin.test.ts`: the pure pin check, anchored, with prereleases refused.
- `packages/bridge/src/log.ts`: the typed JSON-line logger, with the ds requirement enforced at compile time.
- `packages/bridge/src/server/errors.ts`: `DegradedError` and `toErrorResponse`.
- `packages/bridge/src/server/http.ts`: route table, contract header, 404/405, HEAD, handler deadline, request log and `pathOf`.
- `packages/bridge/src/server/http.test.ts`: every HTTP matrix row, plus forced throws on every built-in route.
- `packages/bridge/src/outbound.test.ts`: the A-P7 untimed-outbound-call scanner, with fixtures.
- `packages/bridge/test/main.test.ts`: the bundle under Node 22.22.2, 24.6.0 and 26.5.0 with a read-only state dir, a bad port env, and a busy port.
- `packages/bridge/test/spawn-bridge.ts`: a hardened helper that starts and stops the bundle.
- `packages/bridge/test/bundle.test.ts`: the bundle runs outside the workspace, answers `/v1/health`, and binds loopback.
- `packages/bridge/package.json`: adds a `start` script, and tests run from both `test/` and co-located `src/**`.
- `packages/bridge/tsup.config.ts`: entry is now `src/main.ts`.
- `packages/bridge/src/index.ts`: deleted.

**Review findings:** 14 patches applied (6 medium, 8 low), 0 deferred, 22 rejected. The rejected findings, grouped:
- Trusting XFF from any peer: the tailnet is the trust boundary, and A-P8 says to read XFF.
- Silent skips when a mise Node is missing: the spec directs it.
- The state dir check is vacuous: this is correct until Story 1.5 adds the store.
- `engines` field: tracked as DW-1.
- Port 0 and leading zeros: port 0 is allowed by the spec.
- Stdout truncation before exit: pipes are synchronous on Linux.
- Second SIGINT, EPIPE on stdout, and the helper exported from a test file.
- Docs and systemd unit: Story 1.10.
- The scanner's word-match looseness and string-aware parsing.
- DS-4 and DS-5 being ClientDsCodes: the spec Design Notes justify it.
- The HTTP/1.1 status line: covered by the manual transcript.

**Follow-up review recommendation:** true. Patched: high 0, medium 6, low 8. Score is 3×6 + 1×8 = 26, which is 5 or more.

**Verification:**
- `mise run lint && mise run test && mise run build`: exit 0. Contract passes 5/5; bridge passes 34/34 with 0 skipped.
- Mutation check: making `ds` optional on `config_invalid` gives TS2322. Restored and clean.
- Manual run with `SIDEPIECE_BRIDGE_PORT=18787`:
  - `curl -s -D-` returns `HTTP/1.1 200 OK`, `X-Sidepiece-Contract: 1`, and the exact body.
  - HEAD returns 200.
  - `ss` shows one listener, on `127.0.0.1:18787`.
  - SIGTERM gives exit 0 and a `shutdown` log line.
- Wrong Node: running under Node 22.22.2 prints the exact refusal line and exits 1.
- Default port: running with no env var logs `listen_failed` with `ds` DS-4, `port` 8787 and `code` EADDRINUSE, because curator-serve holds 8787. That shows the default is honoured.

**Residual risks:**
- A-P8 requires a ds on failure lines, so a Bridge-side failure is logged as DS-5 (handler failed or timed out) or DS-4 (listen or config failed). Those are ClientDsCodes. If a dedicated Bridge code is wanted, it is a UX/EXPERIENCE.md decision.
- The 10s handler deadline is a chosen constant. Later stories with slower upstreams must fit under it or raise it on purpose.
- The outbound-call scan passes vacuously today, because `src/` makes no outbound calls yet.
- The rebase in this run replayed the orchestrator's local story-1.3 commit over a divergent `origin/main` 1.3 history. The rebased tree is byte-identical to `a9d8a5e`, and `sprint-status.yaml` was not reverted.
