---
title: 'Story 1.10: Deploy the Bridge as one file, supervised, with the Turn store out of the blast radius'
type: 'feature'
created: '2026-09-24'
baseline_revision: 'a1534170ba98b1aa7bad731fbb18fa9c3edc9e07'
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

**Problem:** The Bridge bundles to `dist/bridge.mjs`, but nothing puts it on `big-chungus`, supervises it, or survives a reboot. A careless deploy could also overwrite `~/.local/state/sidepiece/` (the Turn history and the registry snapshot).

**Approach:** Add three things.
- A tracked `systemd --user` unit that is installed verbatim, with an absolute, pinned Node 24.15.0 path in `ExecStart=`.
- A `mise run build:bridge` task.
- A `mise run deploy` task backed by `.mise/scripts/deploy-bridge.sh`. It verifies the single-file bundle, refuses a destination that intersects the state dir, checks the pinned Node, rsyncs **only** `bridge.mjs` and the unit, enables and restarts the unit, and smoke-tests `/v1/health`.

A shell self-test covers the script's refusal and no-touch paths with stub `systemctl`/`loginctl`/`curl`.

## Boundaries & Constraints

**Always:**
- **Unit file:** `packages/bridge/deploy/sidepiece-bridge.service` is the one source. It is installed byte-for-byte to `~/.config/systemd/user/sidepiece-bridge.service`.
  - `ExecStart=%h/.local/share/mise/installs/node/24.15.0/bin/node %h/.local/lib/sidepiece/bridge.mjs`. Use the real `24.15.0` dir, never the `24`, `24.15` or `lts` symlinks, and never shims.
  - `Restart=always`, `RestartSec=2`, `WorkingDirectory=%h/.local/state/sidepiece`, `StateDirectory=sidepiece`, `[Install] WantedBy=default.target`.
  - `[Unit] StartLimitIntervalSec=0`, so the supervisor never gives up.
  - `SyslogIdentifier=sidepiece-bridge`.
  - No `EnvironmentFile=` and no `PATH=`.
- **Deploy script (`deploy-bridge.sh`, bash, `set -euo pipefail`):** every failure exits non-zero with one line `deploy-bridge: <code>: <detail>` on stderr. It runs these steps in order, and nothing on the target is touched before step 4.
  1. **Bundle check.**
     - `packages/bridge/dist/` contains exactly `bridge.mjs`, else `bundle_not_single_file`.
     - `grep -c "@sidepiece/contract"` must be `0`, else `bundle_not_inlined`.
  2. **Target resolution.**
     - Host: `SIDEPIECE_DEPLOY_HOST`, default `big-chungus`. When it equals `hostname -s` or `localhost`, commands run locally; otherwise over `ssh`, and `rsync` uses `host:path`.
     - Remote home: `$HOME` on the target, or `SIDEPIECE_DEPLOY_ROOT` (a test seam that replaces it).
     - Lib dir is `<home>/.local/lib/sidepiece` and state dir is `<home>/.local/state/sidepiece`. `SIDEPIECE_DEPLOY_LIB_DIR` and `SIDEPIECE_DEPLOY_STATE_DIR` override them, for tests.
  3. **Blast-radius guard.** Canonicalize both dirs on the target (`realpath -m`). If the lib dir is at or under the state dir, or the state dir is at or under the lib dir, abort with `deploy_target_in_state_dir: <lib> is at or under <state>`.
  4. **Node pin check.**
     - Take the first `ExecStart=` token of the unit and expand `%h` to the remote home.
     - Abort with `node_pin_invalid` when any of these fail: it must be absolute; it must contain neither `lts` nor `latest` nor `/shims/`; it must contain a `/24.15.<n>/` segment; `<path> --version` on the target must match `^v24\.`.
  5. **Install.**
     - `mkdir -p` the lib dir and `~/.config/systemd/user`.
     - `rsync --times` the **one file** `dist/bridge.mjs` to `<lib>/bridge.mjs`. rsync's temp-then-rename makes this atomic.
     - rsync the unit file.
     - Never pass `--delete`, `-r` or a directory source.
  6. **Supervise.**
     - Linger: if `loginctl show-user <user> -p Linger` is not `Linger=yes`, run `loginctl enable-linger`; on failure abort with `linger_unavailable`.
     - Then `systemctl --user daemon-reload`, `enable sidepiece-bridge`, and `restart sidepiece-bridge`.
  7. **Post-checks.**
     - Poll `http://127.0.0.1:<port>/v1/health` on the target for up to 10s. It needs `200` and an `x-sidepiece-contract` header.
     - `<port>` is `SIDEPIECE_BRIDGE_PORT` from `systemctl --user show sidepiece-bridge -p Environment --value`, default `8787`.
     - On failure, abort with `health_unanswered`. The detail includes the `ss -ltnp` line holding the port, if any, so a foreign listener is named.
     - Then assert the lib dir lists only `bridge.mjs`, else `lib_dir_not_single_file`. Report it only; never delete.
- **The deploy never reads, writes, stats-for-change, or rsyncs anything under the state dir.** `systemd` creates it via `StateDirectory=`.
- **mise tasks:**
  - `build:bridge` is `pnpm --filter @sidepiece/bridge run build`.
  - `deploy` depends on `build:bridge` and runs the script.
  - `deploy:selftest` runs the self-test, and `test` depends on it (as it does on `lint:selftest`).

**Block If:** none anticipated. Actions that need a reboot of `big-chungus`, or a decision about another service's port, are recorded as `operator_actions`, not blocks.

**Never:**
- Rsync `packages/bridge/`, the workspace, or any directory.
- Add `LoadCredential=`, `OP_BIN` or `BB_BIN`. They belong to Story 1.12 (credentials) and Story 1.15 (`bb:check`).
- Add `tailscale serve`. That is Story 1.11.
- Create `.github/`. Change any Bridge runtime behavior, `CONTRACT_VERSION`, a `DsCode`, or a migration.
- Reboot the host, or move or stop another project's service (for example `curator-serve.service`, which holds `127.0.0.1:8787` today).
- Edit `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy deploy | bundle ok, dirs disjoint, node v24 | file + unit installed; enable, restart; health 200 | exit 0 |
| Redeploy | same, real `turns.db` + snapshot in state dir | state files unchanged (size, mtime, `user_version`, bytes); lib dir = `bridge.mjs` only | exit 0 |
| Lib under state | `SIDEPIECE_DEPLOY_LIB_DIR=<state>/lib` | nothing written, systemctl never called | `deploy_target_in_state_dir` |
| Lib symlinked into state | lib dir is a symlink to `<state>/x` | same | `deploy_target_in_state_dir` |
| Node drift | ExecStart node prints `v26.10.0` | nothing written | `node_pin_invalid` |
| Alias path | ExecStart names `…/node/lts/bin/node` | nothing written | `node_pin_invalid` |
| Contract not inlined | bundle contains `@sidepiece/contract` | nothing written | `bundle_not_inlined` |
| Extra dist file | `dist/bridge.mjs.map` present | nothing written | `bundle_not_single_file` |
| Port held by a stranger | health answers without `x-sidepiece-contract` | holder named | `health_unanswered` |

</intent-contract>

## Code Map

- `packages/bridge/tsup.config.ts` -- already emits one ESM file with everything inlined except `node:*` (`clean: true`). Nothing to change.
- `packages/bridge/test/bundle.test.ts` -- asserts the bundle imports only builtins and runs from a tmp copy. Extend it:
  - `dist/` lists exactly `['bridge.mjs']`.
  - The source contains no `@sidepiece/contract`.
  - The tmp-copy run uses `PATH` = only `dirname(process.execPath)`, so there is no pnpm.
- `packages/bridge/test/spawn-bridge.ts:44` -- `startBridge(bundle, cwd, stateDir, extraEnv)`. `extraEnv` is layered last, so a `PATH` override works.
- `packages/bridge/src/config.ts:21-25` -- `DEPLOY_TARGET_DIR = '.local/lib/sidepiece'` and `DEFAULT_STATE_DIR = '.local/state/sidepiece'`. The runtime-side twin of the deploy guard already refuses a state dir under the bundle dir. The script must use the same two relative paths.
- `packages/bridge/src/main.ts` -- the pin runs first and logs JSON lines to stdout (`log.ts:132`), which journald captures as-is. The default port is 8787 and the default state dir is `~/.local/state/sidepiece`, so the unit needs no `Environment=`.
- `mise.toml` -- task table. `test` depends on `lint:selftest`; add `deploy:selftest` next to it. Scripts live in `.mise/scripts/` (already on `_.path`).
- `lint/no-project-id.test.sh` -- the precedent for a POSIX-shell self-test against temp fixtures.
- Live facts on `big-chungus` (this host, so the deploy runs in local mode):
  - `~/.local/share/mise/installs/node/24.15.0/bin/node` is a real file that prints `v24.15.0`.
  - `Linger=yes`.
  - `ssh big-chungus` works.
  - The registry is on `127.0.0.1:8764`.
  - **`127.0.0.1:8787` is held by `curator-serve.service`** (folder-curator; its n8n node also defaults to 8787).

## Tasks & Acceptance

**Execution:**
- `packages/bridge/deploy/sidepiece-bridge.service` -- the unit as specified.
- `.mise/scripts/deploy-bridge.sh` -- the seven steps. A `run` helper runs commands locally or over ssh. Named-error `die`.
- `.mise/scripts/deploy-bridge.test.sh` -- the self-test. It builds a temp root with a fake dist, a fake node (`v24.15.0` or `v26.10.0`), a real `turns.db` (`user_version` set through `node:sqlite`) and a snapshot, plus stub `systemctl`/`loginctl`/`curl` on `PATH` that record their calls.
  - It covers every matrix row except the stranger row, which needs a curl stub that returns a 200 without the header. Cover that row too.
  - Each refusal row asserts that the lib dir was not created and that `systemctl` was never called.
  - The redeploy row runs the script twice and compares `stat` and `sha256sum` of the state files.
- `mise.toml` -- the `build:bridge`, `deploy` and `deploy:selftest` tasks; `test` depends on `deploy:selftest`.
- `packages/bridge/test/bundle.test.ts` -- the three extensions from the Code Map.
- `packages/bridge/deploy/README.md` -- a short operator note: what `mise run deploy` does, the two directories, and the SIGKILL, reboot and journal checks.

**Acceptance Criteria:**
- Given `mise run build:bridge`, then `ls packages/bridge/dist` prints only `bridge.mjs`, and `grep -c "@sidepiece/contract" packages/bridge/dist/bridge.mjs` prints `0`.
- Given the installed unit, when `deploy-bridge.sh`'s node check reads `ExecStart=`, then the path is `/home/delorenj/.local/share/mise/installs/node/24.15.0/bin/node` and `--version` prints `v24.15.0`.
- Given a live `mise run deploy` on `big-chungus` with a free port, then `systemctl --user is-enabled sidepiece-bridge` prints `enabled`, `is-active` prints `active`, and `/v1/health` returns 200. After `systemctl --user kill -s SIGKILL sidepiece-bridge`, the unit is `active` again within 5s.
- Given two live deploys with real state on disk, then `turns.db`'s size, mtime and `PRAGMA user_version` are unchanged, `registry-snapshot.json`'s sha256 is unchanged, and `ls ~/.local/lib/sidepiece` prints only `bridge.mjs`.
- Given the live unit, when `journalctl --user -u sidepiece-bridge -n 50 -o cat` is run, then it shows the Bridge's JSON lines (`"event":"listening"`).
- Given `mise run lint && mise run test && mise run build`, then all exit 0.

## Spec Change Log

## Review Triage Log

## Design Notes

- **Unit with `%h`, not templated:** one tracked file installed verbatim is diffable against what is live. `%h` expands to an absolute path, so `ExecStart=` still names a concrete `24.15.0` binary. The deploy's check expands `%h` itself and runs that exact path.
- **Local mode:** the operator runs the deploy on `big-chungus` itself today. Treating the target as local when its name matches `hostname -s` avoids an ssh round-trip to self, while ssh stays the path from the laptop.
- **Port 8787 conflict:** the AC and architecture fix the Bridge at `127.0.0.1:8787`, but `curator-serve.service` already binds it. Choosing which service moves is the operator's call; moving curator ripples into folder-curator's defaults and its n8n node.
  - The deploy's health post-check names the holder rather than letting `Restart=always` spin silently.
  - Live verification runs through a clearly named, temporary drop-in `sidepiece-bridge.service.d/port-conflict.conf` setting `SIDEPIECE_BRIDGE_PORT=8788`. It is recorded as an operator action to remove once 8787 is free.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build` -- expected: exit 0, including `deploy:selftest`.
- `mise run deploy` on `big-chungus` -- expected: exit 0, with the health smoke passing (on the drop-in port while 8787 is held).
- `systemctl --user kill -s SIGKILL sidepiece-bridge; sleep 5; systemctl --user is-active sidepiece-bridge` -- expected: `active`.
