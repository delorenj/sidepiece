---
title: 'Story 1.4: A Bridge that answers curl, states its contract, and refuses to start on the wrong Node'
type: 'feature'
created: '2026-09-24'
status: 'in-progress'
baseline_revision: 'a9d8a5ea59203ee0aa41fdbaff12a708364abdfb'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
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
