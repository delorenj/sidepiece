---
title: 'Story 1.13: Health that names the dependency that failed'
type: 'feature'
created: '2026-09-25'
baseline_revision: '3d1906a9b89004c432d0ace5f196a13384ea30e7'
status: 'in-progress'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `GET /v1/health` returns a flat `degraded[]` concatenated from ad-hoc probes. It does not say which upstream failed, it has no `dependencies[]`, it cannot say that the laptop's path is relayed through DERP, and no deadline guarantees that a hung upstream cannot hang the response.

**Approach:**
- **Aggregator:** add `health/aggregator.ts`, keyed by the eight dependency names that live in `contract/`. A probe is *registered* against exactly one name. Any name with no registered probe reports `unprobed`.
- **Rows and degraded:** every row is terminal within 2s. Top-level `degraded[]` is derived only from the rows' contributions plus DS-15.
- **Relay:** add `health/relay.ts`. It reads `tailscale status --json` for the peer named by `X-Forwarded-For`.

## Boundaries & Constraints

**Always:**
- **Contract (`contract/src/health.ts`):**
  - `DEPENDENCY_NAMES = ['registry','store','vault','fleet','gateway','plane','bloodbank','candystore'] as const`, with `DependencyName` derived from it.
  - `DependencyHealth` is a union keyed on `status`:
    - `{name, status:'ok', checkedAt, latencyMs}`
    - `{name, status:'failing', ds: BridgeDsCode, detail?, checkedAt, latencyMs}`
    - `{name, status:'unprobed', checkedAt}`
  - So a failing row without `ds` is a type error.
  - `BridgeHealth` keys, in order: `status:'ok'`, `contractVersion`, `node`, `startedAt`, `checkedAt`, `relayed: boolean`, `dependencies: DependencyHealth[]`, `degraded`.
  - `CONTRACT_VERSION` is unchanged, since the fields are additive.
- **Aggregator (`packages/bridge/src/health/aggregator.ts`):**
  - Export `HEALTH_PROBE_TIMEOUT_MS = 2000` and `createHealth({probes?: Partial<Record<DependencyName, DependencyProbe>>, relay?, now?, timeoutMs?})`, which returns `(clientIp: string | undefined) => Promise<{relayed, dependencies, degraded}>`.
  - `DependencyProbe = {run(signal): Promise<ProbeOutcome>, timedOut(): FailingOutcome}`, where:
    - `ProbeOutcome = {status:'ok'} | FailingOutcome`
    - `FailingOutcome = {status:'failing', degraded: [Degraded, ...Degraded[]], detail?}`
  - A probe never names its row: the aggregator stamps the registration key, so no probe can report for two upstreams.
  - A failing row's `ds` is `degraded[0].ds`. At runtime, a failing outcome with an empty `degraded` is a `TypeError`.
  - Rows are emitted in `DEPENDENCY_NAMES` order.
  - `degraded[]` is each failing row's `degraded` entries, in row order, then `{ds:'DS-15'}` when `relayed` is true. It keeps no other list.
  - Probes and the relay run in parallel. Each is raced against `timeoutMs`. On expiry, `signal` aborts and the row takes `timedOut()`. A probe that throws a non-timeout error is rethrown (a Bridge bug, answered 500 by the existing handler).
  - `latencyMs` is measured per probed row. `checkedAt` is set per row, and unprobed rows use the answer's `checkedAt`.
- **Registered probes, wired in `main.ts` and exported from their own modules:**
  - `registry` (`health/registry.ts`): `failing` uses `registryFailure()`. This is the only DS-6/DS-7 discriminator (Story 1.9), and it is not reimplemented. DS-7 sets `detail` to its `params.error` verbatim. DS-6 has no `detail`. `timedOut()` is `registryFailure(new RegistryUnreachable(...), url)`, which gives DS-6.
  - `store`: failing with the DS-25 entry when the store is ahead, otherwise `ok`.
  - `vault`: failing with every DS-8 from `vault.probe()` when any exists, otherwise `ok`. It has no `detail`. `timedOut()` is DS-8 for every declared credential.
  - `fleet`, `gateway`, `plane`, `bloodbank` and `candystore` get no registration. A comment in `main.ts` names each one's filling story: 3.1 fleet/gateway, 2.19 plane, 3.12 bloodbank, 4.5 candystore.
- **Relay (`health/relay.ts`):**
  - Takes `TAILSCALE_BIN`. It must be absolute; if it is unset or relative, `relayed` is `false` and nothing is spawned.
  - Runs `execFile(bin, ['status','--json'])` with `env: childEnv(process.env)`, a 2s timeout (SIGKILL) and a maxBuffer of 4 MiB.
  - Finds the `Peer` whose `TailscaleIPs` contains the client IP. `relayed = CurAddr === '' && Relay !== ''`.
  - No peer (Self, loopback, unknown), no client IP, or any failure means `false`.
  - A failure logs an info line `relay_unknown {client, reason, detail?}`, where `reason` is one of `tailscale_bin_invalid | tailscale_failed | timeout | unparseable`. It never logs a warn line, since no DsCode applies.
- **Server (`server/http.ts`):**
  - `BridgeServerOptions.probes` is replaced by `health?: (clientIp) => Promise<...>`. It defaults to `createHealth({})`, where all eight rows are unprobed.
  - The health handler passes the first `X-Forwarded-For` entry only, trimmed, or `undefined`. It never passes the socket address.
  - `degraded` stays an option, but health no longer reads it. Project routes do.
- **Unit:** `Environment=TAILSCALE_BIN=/usr/bin/tailscale`.
- **`detail`:** only an upstream's own error text, verbatim. No row carries a sentence.

**Block If:** none anticipated.

**Never:**
- Add a DsCode, bump `CONTRACT_VERSION`, or add a migration.
- Build stub probe files or adapter folders for the five unbuilt upstreams.
- Build `health/degradation.ts` (Story 1.14).
- Report `unprobed` as `ok`.
- Infer relay from latency.
- Edit `sprint-status.yaml`, create `.github/`, touch `port-conflict.conf` or `curator-serve`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All healthy | registry 200, store ready, vault resolves | registry/store/vault `ok`, five `unprobed`, `degraded: []`, `relayed:false` | — |
| Registry stopped | connection refused | registry `{status:'failing', ds:'DS-6'}` (no detail); `degraded` has the DS-6 with endpoint and remedy | — |
| Registry 500 | `500 Internal Server Error` | registry `ds:'DS-7'`, `detail:'500 Internal Server Error'` | — |
| Store ahead | DS-25 open | store `failing ds:'DS-25'`, the DS-25 entry in `degraded` | — |
| Vault unresolved | no token | vault `failing ds:'DS-8'`, the DS-8 entries in `degraded` | — |
| Hung probe | `run` never settles | row `failing` with `timedOut()` at about 2s; response under 3s with every row terminal | signal aborted |
| Relayed | peer `CurAddr:''`, `Relay:'nyc'` | `relayed:true`, `degraded` ends with `{ds:'DS-15'}` | — |
| Direct | peer `CurAddr:'192.168.1.36:41641'` | `relayed:false`, no DS-15 | — |
| No XFF / Self / unknown IP | loopback curl | `relayed:false` | — |
| tailscale fails or hangs | exit 1, bad JSON, sleeps | `relayed:false` within 2s | `relay_unknown` info |
| Failing with empty degraded | probe bug | — | `TypeError`, answered 500 |

</intent-contract>

## Code Map

- `packages/contract/src/health.ts`: today it has `BridgeHealth` with no dependencies. Extend it here, and add the name list and row union. `index.ts` already re-exports it.
- `packages/contract/src/state.ts:41`: the `Degraded` shape. `BridgeDsCode` already has DS-6, 7, 8, 15 and 25.
- `packages/contract/src/state.test.ts`: the pattern for contract tests. Add `health.test.ts` with `@ts-expect-error` for a failing row without `ds`. Tests are type-checked (`tsconfig` includes `test`/`src`; `build` depends on `typecheck`).
- `packages/bridge/src/health/registry.ts`: `registryHealth()` returns a `() => Promise<Degraded[]>` today. Change it to return a `DependencyProbe`. It reuses `fetchRegistry` and `registryFailure` from `registry/client.ts:52` and `RegistryUnreachable`.
- `packages/bridge/src/credentials/vault.ts:141-257`: `Vault.probe()` returns one DS-8 per failing credential and never throws. `CREDENTIALS` is at `:20`. `childEnv()` is at `:80`; the relay child must use it. `execFileRunner` (`:100`) has a 64 KiB maxBuffer, which is too small for tailscale, so the relay gets its own small runner.
- `packages/bridge/src/server/http.ts`:
  - `BridgeServerOptions` is at `:65-80`. `healthHandler` (`:101-117`) is where XFF gets extracted. `clientOf` (`:119`) falls back to the socket, so do not reuse it for the relay.
  - `builtinRoutes` (`:235`) is used by `http.test.ts:272`. `createBridgeServer` (`:289`).
- `packages/bridge/src/main.ts:119-130`:
  - Today `probes` is `Promise.all([registryProbe(), vault.probe()])`. Replace it with `health: createHealth({probes:{registry, store, vault}, relay})`.
  - The store state is the `degraded` variable (DS-25) and `store`.
- `packages/bridge/src/log.ts`: add `relay_unknown` to `InfoLine`.
- `packages/bridge/deploy/sidepiece-bridge.service` plus `test/deploy-paths.test.ts` (`unitKey()`): add and assert `TAILSCALE_BIN`.
- **Tests that assert the old health shape** and must move to the new one:
  - `server/http.test.ts:191,416-470`: its "Bridge-wide first" test becomes a row-order test.
  - `server/snapshot.conformance.test.ts:70`, which passes `probes: registryHealth(...)`.
  - `health/registry.test.ts`.
  - `test/main.test.ts:237,307,412,447`: the exact `degraded` arrays stay valid in registry→store→vault order. There is no store-ahead-plus-registry test.
- **Spawned test helpers:**
  - `test/spawn-bridge.ts` and `test/main.test.ts` `run()` inherit `process.env`. `TAILSCALE_BIN` is unset there, so `relayed:false`.
  - The relay bundle test sets a fake `#!/bin/sh` tailscale that prints fixture JSON.
- **Live facts:**
  - `/usr/bin/tailscale` 1.102.4. `status --json` runs as the user in about 5ms.
  - `Peer[]` entries carry `TailscaleIPs`, `CurAddr` (`''` when not direct), `Relay` (the home DERP region, set even when direct) and `PeerRelay`.
  - `tailscale serve` sets `X-Forwarded-For`: the journal shows `client` values `100.81.162.91` (the laptop) and `100.66.29.76` (Self).
  - The Bridge is live on `127.0.0.1:8789` (port-conflict drop-in) behind `https://big-chungus.burro-salmon.ts.net/v1`. The registry unit is `pjangler-project-registry.service`.

## Tasks & Acceptance

**Execution:**
- `packages/contract/src/health.ts` and `packages/contract/src/health.test.ts`: the types. The test covers the name order, a type error for a failing row without `ds`, and a type error for an unprobed row with `ds`.
- `packages/bridge/src/health/aggregator.ts` and `aggregator.test.ts`: `createHealth`. Tests cover:
  - eight rows in order, and the default all-unprobed case
  - a bloodbank registration changes only the bloodbank row, while candystore stays unprobed
  - degraded is derived from rows plus DS-15
  - the hung-probe timeout (under 3s, every row terminal, signal aborted)
  - a failing outcome with an empty `degraded` throws
  - an unexpected throw propagates
  - no row has keys outside `{name,status,ds,detail,checkedAt,latencyMs}`
- `packages/bridge/src/health/registry.ts` and its test: the probe object. Cover DS-6 without detail, DS-7 with verbatim detail, and `timedOut` giving DS-6. Assert it calls `registryFailure` (it imports it; there is no local discriminator).
- `packages/bridge/src/health/relay.ts` and `relay.test.ts`: the relay probe. Cover every relay row of the matrix with fake `tailscale` scripts, including a hang past 2s and an env dump showing no `OP_SERVICE_ACCOUNT_TOKEN`/`CREDENTIALS_DIRECTORY`.
- `packages/bridge/src/health/store.ts` and `health/vault.ts`, with tests: the `storeHealth(state)` and `vaultHealth(vault)` probe objects.
- `packages/bridge/src/server/http.ts`: the `health` option, XFF-only client IP, and the new body.
- `packages/bridge/src/log.ts`: `relay_unknown`.
- `packages/bridge/src/main.ts`: the registrations and the unbuilt-row comment.
- Existing tests: migrate them to the new option and shape.
- `packages/bridge/test/main.test.ts`: spawned-bundle tests covering:
  - the healthy body has all eight keys and rows with five unprobed
  - with the registry stopped, the row is DS-6 and top-level carries DS-6
  - with the registry answering 500, the row is DS-7 with `detail`
  - with a fake `TAILSCALE_BIN` and an XFF header naming a relayed peer, `relayed:true` and DS-15; the same with a direct peer gives `false`
- `packages/bridge/deploy/sidepiece-bridge.service` and `test/deploy-paths.test.ts`: `TAILSCALE_BIN`.
- **Live:**
  1. `mise run deploy`.
  2. Tailnet curl: every key present, five `unprobed`, `relayed:false`.
  3. `systemctl --user stop pjangler-project-registry` → the registry row is DS-6 and top-level carries DS-6. Then start it again, and the row is `ok`.

**Acceptance Criteria:**
- Given everything healthy, when `curl -s https://big-chungus.burro-salmon.ts.net/v1/health | jq` runs, then the body carries `status, contractVersion, node, startedAt, checkedAt, relayed, dependencies, degraded`. `dependencies` has the eight rows in order, `fleet, gateway, plane, bloodbank, candystore` are `"unprobed"`, and `X-Sidepiece-Contract` is unchanged.
- Given the registry unit stopped, when health is read, then the `registry` row is `{"name":"registry","status":"failing","ds":"DS-6",…}` and `degraded[]` carries DS-6.
- Given a probe that never answers, when health is read, then it returns 200 in under 3s with every row terminal (asserted by a test).
- Given the laptop on a DERP relay, when health is read over the tailnet, then `relayed` is `true` and `degraded[]` carries `{"ds":"DS-15"}`. On a direct path, `relayed` is `false` with no DS-15. This is proven by a fixture test. The live DERP run is an operator action, because a direct path cannot be forced to relay from `big-chungus`.
- Given `mise run lint && mise run test && mise run build`, then all three exit 0.

## Spec Change Log

## Review Triage Log

## Design Notes

- **"Two separate probe functions in two separate adapter folders, both unprobed … each with its own registration point"** is read together with epics' "Story 1.13 registers five `unprobed` rows rather than five stub probes" and "extensible by registration and not by edit":
  - The registration point is the `DependencyName` key in `createHealth({probes})`.
  - The folders (`bloodbank/`, `candystore/`) are created by Stories 3.12 and 4.5, which register there without editing the aggregator.
  - The "one probe, one upstream" rule is structural: a probe returns no name.
- **Top-level `status` stays `'ok'`.** It means the Bridge answered (the failure posture is 200 plus `degraded[]`). The per-dependency truth lives in rows.
- **DS-25 moves** from "Bridge-wide first" to the `store` row, so on health it follows a registry failure. Project routes keep their existing order.
- **Unknown relay means `false`**, with an info line. No DsCode exists for "could not ask tailscale", and inventing DS-15 from a failure would be the guess the AC forbids.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build`: expected exit 0.
- `mise run deploy`, then `curl -s https://big-chungus.burro-salmon.ts.net/v1/health | jq '{relayed, deps: [.dependencies[] | {name,status,ds}], degraded}'`: expected the eight rows, five unprobed, and `relayed:false`.
- `systemctl --user stop pjangler-project-registry; curl -s …/v1/health | jq '.dependencies[0], .degraded'; systemctl --user start pjangler-project-registry`: expected DS-6 on the row and at the top level.
