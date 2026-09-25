---
title: 'Story 1.12: Every credential from the vault — and a missing one degrades instead of killing the Bridge'
type: 'feature'
created: '2026-09-25'
baseline_revision: '4425642678608956cb32cb2d13499767caa2909f'
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

**Problem:** The Bridge resolves no credentials. It has no `credentials/vault.ts`, its unit carries no bootstrap token, and nothing guarantees that a vault failure leaves it up and reporting DS-8. The natural implementation would exit non-zero, and the operator would then see DS-4 for a host that is fine.

**Approach:**
- **Vault module:** add `packages/bridge/src/credentials/vault.ts`. It reads the 1Password service-account token from `$CREDENTIALS_DIRECTORY/op-token` and resolves each declared `op://` reference with `$OP_BIN read <ref>` in a child process that alone receives the token.
- **Caching:** a successful value is cached in memory. A failed reference is retried on the next call that needs it. Startup fires one resolution pass and never waits on it and never exits on it.
- **Health:** health reports every unresolved credential as `DS-8 {credential, dependency}`.
- **Unit:** carries `LoadCredential=`, a `SetCredential=` empty fallback, and `OP_BIN`.
- **Scan:** a mise task proves that `.env.op` holds only references and that no tracked file holds a resolved value.

## Boundaries & Constraints

**Always:**
- **The declared credentials** are exported as one list from `vault.ts`, each `{ref, dependency}`. Today the list has exactly one entry: `{ref:'op://DeLoSecrets/Plane/apiKey', dependency:'plane'}` (title form).
- **Bootstrap token:**
  - The Bridge reads `join($CREDENTIALS_DIRECTORY, 'op-token')` once at startup and strips only the trailing newline.
  - Unset dir, missing file, unreadable file or empty content means "no token". Each declared credential is then DS-8, with log reason `no_bootstrap_token`.
  - `OP_SERVICE_ACCOUNT_TOKEN` is deleted from `process.env` at startup and never used as a token source.
- **`OP_BIN`** must be an absolute path. Unset or relative means each credential is DS-8 with reason `op_bin_invalid`, and `op` is never spawned.
- **The `op` child:**
  - Spawn it with `execFile(OP_BIN, ['read', '--no-newline', ref])`.
  - Its env is exactly `{OP_SERVICE_ACCOUNT_TOKEN: token, HOME}`, plus `XDG_CONFIG_HOME` when that is set. Nothing else from `process.env` is passed.
  - Use an explicit timeout of `OP_READ_TIMEOUT_MS = 2000` with SIGKILL, and a small `maxBuffer`.
  - Failure reasons are: non-zero exit (`op_failed`, op's stderr verbatim and trimmed as `detail`), timeout (`timeout`), empty stdout (`empty`), or spawn error (`op_failed`, `err.message`).
- **Environment for other children:** `vault.ts` exports `childEnv(env)`, a copy without `OP_SERVICE_ACCOUNT_TOKEN`. Every future non-`op` child (`bb`, `tailscale`) must use it.
- **Resolution semantics:**
  - `get(ref)` returns the cached value, or resolves now. A success is cached for the process lifetime. A failure is never cached, so the next call retries.
  - Concurrent calls for the same ref share one in-flight child.
  - `probe()` calls `get` for every declared credential in parallel and returns one `{ds:'DS-8', params:{credential:ref, dependency}}` per failure, in declaration order. It never throws.
- **Startup:** `main.ts` builds the vault after the store and snapshot, and calls `void vault.resolveAll()` without awaiting it. No vault outcome calls `process.exit`.
- **Health:** the probes become registry followed by vault, run in parallel, concatenated in that order.
- **Logs (A-P8):**
  - `credential_resolved` is an info line `{credential, dependency}`, logged on the first success only.
  - `credential_unresolved` is a warn line `{ds:'DS-8', credential, dependency, reason, detail?}`, logged on every failed attempt.
  - No log line, degraded entry or response ever contains a resolved value or the token.
  - `op://` references do appear in logs.
- **Unit (`packages/bridge/deploy/sidepiece-bridge.service`):**
  - `LoadCredential=op-token:/etc/sidepiece/op-service-token`.
  - `SetCredential=op-token:` as the fallback, so a missing file still starts the unit and yields DS-8.
  - `Environment=OP_BIN=/usr/bin/op`, the real ELF binary rather than `~/.local/bin/op`, which is a shell wrapper with a Redis cache.
  - It keeps no `EnvironmentFile=` and no `OP_SERVICE_ACCOUNT_TOKEN`.
- **`.env.op`:** every value is an `op://DeLoSecrets/<item>/<field>` reference. The non-secret `PLANE_BASE_URL` and `PLANE_WORKSPACE` move to `mise.toml` `[env]` with their values unchanged.
- **`.mise/scripts/credential-scan.sh` (bash, `set -euo pipefail`):**
  1. Every assignment in `.env.op` must match `^[A-Z_][A-Z0-9_]*=op://DeLoSecrets/[^/]+/[^/]+$`; otherwise fail with `credential-scan: not_a_reference: <KEY>`.
  2. Collect every distinct `op://DeLoSecrets/...` reference from `.env.op` and from tracked `packages/**` source files (excluding test files).
  3. Resolve each one with `${OP_BIN:-op} read --no-newline`. For a value, list tracked files (`git ls-files -z`) containing it with `git grep -F -l -z`, and fail with `credential-scan: resolved_value_tracked: <ref> in <files>`. The value itself is never printed.
  4. A reference that does not resolve fails with `credential-scan: unresolvable: <ref>`.
  - It runs as the `secrets:scan` mise task, with a self-test `credential-scan.test.sh` (fake `op`, temp git repo) wired into `test` beside `deploy:selftest`.
- **Live token file:** `/etc/sidepiece/op-service-token` holds the canonical service-account token, as `root:delorenj` mode `0640` inside a `root:root 0755` dir. The user manager reads it; nothing in the repo does. Install it with `sudo -n` from the current `OP_SERVICE_ACCOUNT_TOKEN`, without echoing it.

**Block If:** none anticipated. `sudo -n` works on this host. If it stops working, record the token-file install as an operator action rather than blocking.

**Never:**
- Write a resolved value or the token to any file in the repo, the state dir, or logs.
- Exit non-zero, or delay `listen`, because of a credential.
- Add a DsCode, change `CONTRACT_VERSION`, add a migration, or add `dependencies[]` to health (that is Story 1.13).
- Build `health/degradation.ts` (Story 1.14) or a Plane adapter.
- Delete `port-conflict.conf`, or touch `curator-serve`.
- Edit `sprint-status.yaml`, or create `.github/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Healthy | token file, `OP_BIN` ok, `op` prints value | health has no DS-8; one `credential_resolved` | — |
| No credentials dir | `CREDENTIALS_DIRECTORY` unset | Bridge up; health DS-8 `{credential:'op://DeLoSecrets/Plane/apiKey', dependency:'plane'}` | reason `no_bootstrap_token` |
| Empty token (SetCredential fallback) | `op-token` is 0 bytes | same DS-8; `op` never spawned | `no_bootstrap_token` |
| Bad OP_BIN | `OP_BIN=op` or unset | DS-8; `op` never spawned | `op_bin_invalid` |
| Invalid token / vault down | `op` exits 1 with stderr | DS-8; stderr in log `detail` | `op_failed` |
| Hung op | `op` sleeps > 2s | DS-8 within ~2s; child killed | `timeout` |
| Recovery | first `op` fails, second succeeds, same process | 1st probe DS-8; 2nd probe `[]`; no restart | — |
| Concurrent | two `get` in flight | one child spawned | — |
| Token isolation | parent env has `OP_SERVICE_ACCOUNT_TOKEN` | absent from `process.env` after startup; present only in the `op` child's env; `childEnv()` omits it | — |

</intent-contract>

## Code Map

- `packages/bridge/src/main.ts`:
  - The startup order is pin, port, state dir, registry URL, store, snapshot, server.
  - Build the vault after `openSnapshot` (~L115).
  - Compose `probes` (~L119), which is today only `registryHealth(registryUrl, snapshot)`.
  - Fire `resolveAll()` after the server is created. Never `process.exit` on it.
- `packages/bridge/src/health/registry.ts`: the probe shape `() => Promise<Degraded[]>`. The vault probe mirrors it.
- `packages/bridge/src/server/http.ts:65-80,103-116`: `BridgeServerOptions.probes`, awaited once per health request. The degraded warn line is at ~L429.
- `packages/bridge/src/log.ts`: closed `LogLine` unions. Add `credential_resolved` to InfoLine and `credential_unresolved` to WarnLine. The compile-time check at the end forces `ds` on the warn line.
- `packages/contract/src/state.ts:41`: `Degraded {ds, params?, remedy?}`. DS-8 is already a `BridgeDsCode`. Omit `remedy`.
- `EXPERIENCE.md` DS-8 row (planning-artifacts/ux-designs/.../EXPERIENCE.md:795): the params are exactly `credential` and `dependency`.
- `packages/bridge/test/spawn-bridge.ts:44` (`startBridge`) and `test/main.test.ts:30` (`run`):
  - Spawned Bridges inherit `process.env`, which has no `CREDENTIALS_DIRECTORY`. Existing exact `degraded` assertions (main.test.ts ~L226, ~L294; snapshot.conformance uses the in-process server, so it is unaffected) would gain DS-8.
  - Default both helpers to a stub vault: a temp dir holding `op-token` and an executable `#!/bin/sh` fake `op` that prints a fixed fake value. Pass it via `CREDENTIALS_DIRECTORY` and `OP_BIN` before `extraEnv`, so a test can override either.
- `packages/bridge/test/bundle.test.ts:41`: runs with `PATH` set to node's dir only. The fake op's `#!/bin/sh` is absolute, so it still works.
- `packages/bridge/deploy/sidepiece-bridge.service`: add the three lines. The header comment currently says "Credentials arrive in Story 1.12"; update it.
- `packages/bridge/test/deploy-paths.test.ts:15` `unitKey()`: reuse it for unit assertions.
- `.mise/scripts/deploy-bridge.sh`: the port parse takes the last `SIDEPIECE_BRIDGE_PORT` from `systemctl show -p Environment`. `OP_BIN` in the same line is harmless. No change is expected.
- `.env.op` / `mise.toml [env]` (`_.file=[".env"]`): Hermes scripts read `PLANE_WORKSPACE` from the shell env, which mise populates from either source.
- **Live facts:**
  - `/usr/bin/op` 2.31.1 is the real binary. `op read` of the Plane ref with the service token takes about 0.6s. A malformed token fails in about 7ms, exit 1, with `could not read secret ... format is invalid`.
  - systemd is 257, which supports `LoadCredential=` and the `SetCredential=` fallback in user units.
  - `/etc/sidepiece` does not exist yet. `sudo -n` works.
  - The Bridge is live on `127.0.0.1:8789` (drop-in) behind `https://big-chungus.burro-salmon.ts.net/v1`.

## Tasks & Acceptance

**Execution:**
- `packages/bridge/src/credentials/vault.ts`: the credential list, `OP_READ_TIMEOUT_MS`, `readBootstrapToken(env)` (reads the file and deletes the env token), `childEnv(env)`, and `createVault({token, opBin, credentials, run?, logger?})`, which returns `{get, resolveAll, probe}`. The injectable `run` defaults to the `execFile` runner.
- `packages/bridge/src/credentials/vault.test.ts`: one test per matrix row, using an injected runner and real fake-`op` scripts for the timeout, env and exit rows. A redaction test: capture every log line and assert none contains the fake value or the token.
- `packages/bridge/src/log.ts`: the two new events.
- `packages/bridge/src/main.ts`: the wiring.
- `packages/bridge/test/spawn-bridge.ts` and `packages/bridge/test/main.test.ts`: the default stub vault.
- `packages/bridge/test/main.test.ts`, new spawned tests:
  - (a) With no credentials dir, the bundle stays up and health is `200` with the exact DS-8 entry. The exit code is `0` only on SIGTERM.
  - (b) With the parent env carrying `OP_SERVICE_ACCOUNT_TOKEN` and a stub vault whose fake `op` dumps its env to a file baked into the script, the dump contains the token, and `/proc/<pid>/environ` of the Bridge does not contain the op-token value.
  - (c) No stdout line contains the fake resolved value.
- `packages/bridge/deploy/sidepiece-bridge.service`: `LoadCredential=`, `SetCredential=` and `Environment=OP_BIN=`.
- `packages/bridge/test/deploy-paths.test.ts`: assert those three lines, and that there is no `EnvironmentFile=` and no `OP_SERVICE_ACCOUNT_TOKEN`.
- `.env.op` and `mise.toml`: move the two non-secret values. Add the `secrets:scan` task, add `secrets:selftest`, and make `test` depend on it.
- `.mise/scripts/credential-scan.sh` and `.mise/scripts/credential-scan.test.sh`: the scan and its self-test, with cases for clean, a non-reference value, a tracked resolved value (the value never printed) and an unresolvable reference.
- `packages/bridge/deploy/README.md`: a Credentials section covering the token file (path, owner, mode, how to install and rotate it), the `SetCredential` fallback, and what DS-8 means.
- **Live:**
  - Install `/etc/sidepiece/op-service-token`, then `mise run deploy`.
  - Prove healthy, then prove the fault with a temporary drop-in that points `LoadCredential=` at a scratchpad file containing an invalid token. Check that `is-active` is `active`, that `NRestarts` is unchanged, and that tailnet health carries DS-8.
  - Remove the drop-in, redeploy, and confirm DS-8 is gone.
  - Grep the journal for the resolved Plane value and for the token: zero hits. Grep it for `op://DeLoSecrets/Plane/apiKey`: at least one hit.

**Acceptance Criteria:**
- Given `.env.op`, when `mise run secrets:scan` runs, then it exits 0. `grep -rn "op://" packages/ .env.op` shows only references, and the Plane reference is `op://DeLoSecrets/Plane/apiKey`.
- Given the deployed unit, when it is read, then it has `LoadCredential=op-token:/etc/sidepiece/op-service-token` and `Environment=OP_BIN=/usr/bin/op`, and has no `EnvironmentFile=` and no `Environment=OP_SERVICE_ACCOUNT_TOKEN=`.
- Given an invalid token on the live unit, when it is restarted, then `systemctl --user is-active sidepiece-bridge` prints `active`, the process never exits non-zero, and `curl -s https://big-chungus.burro-salmon.ts.net/v1/health` returns `200` with `degraded[]` containing `{"ds":"DS-8","params":{"credential":"op://DeLoSecrets/Plane/apiKey","dependency":"plane"}}`.
- Given one process lifetime, when the vault fails once and then succeeds, then the first probe carries DS-8 and the next does not, with no restart (asserted by a test).
- Given the live run, when `journalctl --user -u sidepiece-bridge` is grepped for the resolved Plane value and for the token, then there are zero hits, and `op://DeLoSecrets/Plane/apiKey` does appear.
- Given `mise run lint && mise run test && mise run build`, then all exit 0.

## Spec Change Log

## Review Triage Log

## Design Notes

- **"Every tracked file … including in files intended to be gitignored"** is read as the tracked-`.bak` failure: a file that should have been ignored but got tracked. So the scan covers `git ls-files` exhaustively. The mode-0600 `.env` that the managed `materialize-env.sh` writes on `mise` enter is the pjangler platform convention (PJAN-84). It is untracked, and the Bridge never reads it; changing it is out of scope.
- **Why `SetCredential=op-token:`:** without it, a missing `/etc/sidepiece/op-service-token` makes systemd refuse to start the unit (243/CREDENTIALS). The operator would then see DS-4, exactly the wrong sentence this story exists to prevent.
- **Success cached, failure not:** this is D18's "startup resolution populates the in-process credential cache; a capability whose credential is missing retries on its next call". Health counts as such a call today, because no Plane adapter exists yet. Rotating a key that is already cached needs a restart. That is acceptable for now and noted in the README.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build`: expected exit 0, including `secrets:selftest` and `deploy:selftest`.
- `mise run secrets:scan`: expected exit 0.
- `mise run deploy`: expected exit 0. Then `curl -s https://big-chungus.burro-salmon.ts.net/v1/health | jq .degraded`: expected no DS-8.
- Fault drop-in, then `systemctl --user restart sidepiece-bridge; sleep 3; systemctl --user is-active sidepiece-bridge; curl -s https://big-chungus.burro-salmon.ts.net/v1/health`: expected `active` and a DS-8 entry.
