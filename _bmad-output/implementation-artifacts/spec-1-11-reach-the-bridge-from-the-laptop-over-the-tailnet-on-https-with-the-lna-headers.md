---
title: 'Story 1.11: Reach the Bridge from the laptop over the tailnet, on HTTPS, with the LNA headers'
type: 'feature'
created: '2026-09-24'
baseline_revision: '862468b622b304cc25dfdb64d57db5150498cb9d'
status: 'awaiting-operator'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
operator_actions:
  - "With 8787 freed (or keeping 8789), confirm `tailscale serve status` exposes /v1 and run `mise run tailnet:check` from carries-macbook-air to confirm TLS, LNA preflight, and p95 under 1000ms."
---

<intent-contract>

## Intent

**Problem:** The Bridge listens only on `127.0.0.1` on `big-chungus`. Nothing exposes it to the laptop, it answers `OPTIONS` with `405` and no CORS headers (so no Chrome preflight can succeed), and nothing records that the tailnet is the only authentication.

**Approach:**
- **Transport:** extend `mise run deploy` with a final step that points `tailscale serve` path `/v1` at the Bridge's live loopback port and verifies it, without touching any other serve handler.
- **Server:** make the Bridge answer every `OPTIONS` itself, with unconditional private-network CORS headers, and add CORS read headers to every response.
- **Checks:** add a POSIX `tailnet-check.sh` that runs the laptop-side ACs (TLS without `-k`, preflight, and 50-request p50/p95), then run it on `carries-macbook-air` over ssh.

## Boundaries & Constraints

**Always:**
- **`server/http.ts` header comment:** the Bridge authenticates no caller: no token, no cookie, no `Authorization`. WireGuard device authentication on the tailnet is the trust boundary (NFR-1). The consequence is spelled out: any device on `burro-salmon.ts.net` can call every route, mutations included.
- **Preflight:**
  - Every `OPTIONS` request, on any path (matched or not), is answered by the server itself before route dispatch. The answer is `204` with an empty body and these headers:
    - `Access-Control-Allow-Private-Network: true`
    - `Access-Control-Allow-Origin`: the request's `Origin`, or `*` when there is none, plus `Vary: Origin`
    - `Access-Control-Allow-Methods`: the matched route's methods (via `allowOf`) plus `OPTIONS`; `GET, HEAD, OPTIONS` for an unmatched path
    - `Access-Control-Allow-Headers`: the request's `Access-Control-Request-Headers` echoed back, else `Content-Type`
    - `Access-Control-Max-Age: 600`
    - `X-Sidepiece-Contract`
  - No flag, env var, option or User-Agent/Chrome-version check gates any of it.
  - A comment beside the private-network header says the MagicDNS certificate is **not** an LNA mitigation: HTTPS is what lets Chrome ask, not what stops it asking.
- **Every non-preflight response** (`send`) also carries `Access-Control-Allow-Origin` (same rule), `Vary: Origin`, and `Access-Control-Expose-Headers: X-Sidepiece-Contract`.
- **Client address:** keep reading the first `X-Forwarded-For` hop (`clientOf`). The request log for an `OPTIONS` also carries `client`.
- **Deploy step 8, "Expose"** (`deploy-bridge.sh`, after the existing post-checks, through the existing `run` helper so it works locally and over ssh):
  1. **Loopback check.** Run `ss -Hltn "sport = :<port>"`. Any listening local address other than `127.0.0.1:<port>` aborts with `bridge_not_loopback_only: <addresses>`.
  2. **DNS name.** Read it from `tailscale status --json` as `.Self.DNSName`, with the trailing dot stripped.
  3. **Record** the handler keys of `tailscale serve status --json` for `<dns>:443` before the change.
  4. **Serve.** Run `tailscale serve --bg --https=443 --set-path /v1 http://127.0.0.1:<port>/v1`. On a non-zero exit, abort with `tailnet_serve_failed: <tailscale stderr verbatim>`.
  5. **Verify.** Re-read the status. Handler `/v1` must proxy to exactly `http://127.0.0.1:<port>/v1`, and every key recorded before must still be present. Otherwise abort with `tailnet_serve_unverified`.
  6. **Report.** Print `exposed https://<dns>/v1 -> http://127.0.0.1:<port>/v1`.
  - `<port>` is the value the post-checks already derived (last `SIDEPIECE_BRIDGE_PORT` wins, default 8787).
  - `tailscale` and `ss` are `SIDEPIECE_TAILSCALE_BIN` / plain `ss` on `PATH`, so the self-test can stub them.
- **`.mise/scripts/tailnet-check.sh`:** POSIX `sh`, so it runs under macOS `/bin/sh`. It needs `curl`, `sort` and `awk` only. It takes the base URL as `$1`, default `https://big-chungus.burro-salmon.ts.net/v1`, and runs three checks. Each failure prints `tailnet-check: <code>: <detail>` and exits non-zero.
  1. `curl -s -D-` of `/health` **without** `-k`, with no auth header, must be `200` with an `x-sidepiece-contract` header.
  2. The exact AC preflight (`chrome-extension://abcdefghijklmnopabcdefghijklmnop` origin, `Access-Control-Request-Private-Network: true`) against `/project/sidepiece` must carry all four `Access-Control-Allow-*` headers, with Private-Network `true`.
  3. 50 sequential `GET /project/sidepiece` requests, timed with `%{time_total}`. It prints `p50=<ms> p95=<ms> n=50` (nearest-rank) and fails if p95 is over 1000ms.
- **mise:** add a `tailnet:check` task that runs the script.

**Block If:** `tailscale serve` on `big-chungus` cannot be configured by this user even after `sudo -n tailscale set --operator=$USER`. In that case HALT as blocked, because the transport cannot exist.

**Never:**
- Bind the Bridge to anything but `127.0.0.1`. Add a Traefik label or route, a Cloudflare tunnel ingress, or a `delo.sh` name for it.
- Use `tailscale funnel`. Replace or remove the existing `/` serve handler (`http://127.0.0.1:5173`). Run `tailscale serve reset`.
- Add app-level auth or an origin allow-list.
- Move, stop or reconfigure `curator-serve.service` (it holds 8787). Delete the `port-conflict.conf` drop-in.
- Add a `DsCode`, change `CONTRACT_VERSION`, or add a migration. DS-15 (relay) belongs to Story 1.13.
- Edit `sprint-status.yaml`. Create `.github/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Preflight, known route | `OPTIONS /v1/project/x`, `Origin: chrome-extension://…`, ACRM GET, ACRPN true | 204; ACAO = that origin; Allow-Methods `GET, HEAD, OPTIONS`; ACAPN `true` | — |
| Preflight, unknown path | `OPTIONS /nope` | 204 with ACAPN `true` (not 404/405) | — |
| Preflight, no Origin | `OPTIONS /v1/health` | 204, ACAO `*`, ACAPN `true` | — |
| Requested headers | ACRH `content-type, x-foo` | Allow-Headers echoes `content-type, x-foo` | — |
| Route registers OPTIONS | table has `OPTIONS` handler | server answers; the handler never runs | — |
| Plain GET with Origin | `GET /v1/health`, `Origin: o` | 200 + ACAO `o`, Expose-Headers `X-Sidepiece-Contract` | — |
| Two callers | XFF `100.81.162.91` then `100.66.29.76` | two request lines, two distinct `client`s, neither `127.0.0.1` | — |
| Deploy, happy | ss 127.0.0.1 only; serve ok | `/v1` → `http://127.0.0.1:<port>/v1`; `/` handler kept | exit 0 |
| Deploy, wide bind | ss shows `0.0.0.0:<port>` | serve never called | `bridge_not_loopback_only` |
| Deploy, serve denied | tailscale serve exits 1 "access denied" | stderr carried verbatim | `tailnet_serve_failed` |
| Deploy, wrong proxy | status after shows `/v1` → another port, or `/` gone | — | `tailnet_serve_unverified` |

</intent-contract>

## Code Map

- `packages/bridge/src/server/http.ts`:
  - `send` (~L111) is the only response writer, so the CORS read headers go here. It needs the request's `Origin`, so pass `req` or the computed ACAO in.
  - `createServer` callback (~L275): add the `OPTIONS` intercept after the `res.once('close')` request-log hook and before the `matchRoute` 404 branch. Use `matchRoute` only to compute Allow-Methods.
  - `allowOf` (~L250) already yields the route's methods, with HEAD implied.
  - `clientOf` (~L100) already reads the first XFF hop, falling back to the socket.
  - `SAFE_METHODS` treats OPTIONS as unguarded. Leave `assertGuarded` alone.
- `packages/bridge/src/server/http.test.ts`:
  - The `call(path, init)` helper and `lines` capture are the patterns to reuse.
  - L300 already tests the XFF first hop. Add the two-caller case beside it.
  - L532 constructs routes with `OPTIONS` handlers. Reuse that shape for "handler never runs".
- `packages/bridge/src/log.ts`: the `request` InfoLine already has `client`. No new event is needed.
- `.mise/scripts/deploy-bridge.sh`:
  - `run` (L57) handles local vs ssh; `die` gives named errors.
  - The port parse is at L131-137. Step 8 goes after the `lib_dir_not_single_file` check at the end.
- `.mise/scripts/deploy-bridge.test.sh`:
  - It uses stub `systemctl`/`loginctl`/`curl`/`ssh`/`rsync` on `PATH`, recording calls, and currently runs 70 checks.
  - Add stubs for `tailscale` (serve status JSON from a fixture file that `serve --set-path` rewrites; exit code configurable) and `ss`. Existing cases must stay green, so the default stubs must describe a happy expose.
- `mise.toml`: the task table. Add `tailnet:check` next to `deploy`.
- `packages/bridge/deploy/README.md`: add an Expose section covering the serve mapping, the `/` handler it preserves, and `mise run tailnet:check`.
- **Live facts (big-chungus):**
  - Tailscale 1.102.4. `OperatorUser` is unset.
  - Serve currently has only `/` → `http://127.0.0.1:5173` on `big-chungus.burro-salmon.ts.net:443`.
  - The Bridge unit is active on `127.0.0.1:8789` through the `port-conflict.conf` drop-in, because `curator-serve` (python, pid 6375) holds `127.0.0.1:8787`.
  - `carries-macbook-air` (100.81.162.91) is online, direct, on the LAN (192.168.1.36), and reachable by `ssh -o BatchMode=yes carries-macbook-air`. It runs macOS with `/usr/bin/curl`.
  - `jq` is available on big-chungus.
- **Loopback baseline (Story 1.6):** 50 sequential curls on loopback gave p50 4.99ms, p95 6.83ms.

## Tasks & Acceptance

**Execution:**
- `packages/bridge/src/server/http.ts`: the header comment, the `OPTIONS` intercept with the LNA comment, and the CORS read headers in `send`.
- `packages/bridge/src/server/http.test.ts`: one test per matrix row for preflight, plain GET and two callers.
- `.mise/scripts/deploy-bridge.sh`: step 8, Expose.
- `.mise/scripts/deploy-bridge.test.sh`: the `tailscale` and `ss` stubs, plus the happy, wide-bind, serve-denied and wrong-proxy cases. The happy case also asserts the `/` handler survives and the exact `serve` argv. Refusal cases assert `serve --set-path` was never called, or its effect was reported.
- `.mise/scripts/tailnet-check.sh`: the three checks.
- `mise.toml`: the `tailnet:check` task.
- `packages/bridge/deploy/README.md`: the Expose section.
- **Live:**
  - Build and run `mise run deploy` on big-chungus. If serve is denied, run `sudo -n tailscale set --operator=$USER` once and retry.
  - Then run `ssh carries-macbook-air sh -s < .mise/scripts/tailnet-check.sh`.
  - Then capture the journal request lines for one laptop request and one request from big-chungus to its own MagicDNS URL.

**Acceptance Criteria:**
- **Serve mapping:** given the live deploy, `tailscale serve status` shows `https://big-chungus.burro-salmon.ts.net` with `/v1` proxying to `http://127.0.0.1:<live port>/v1` and `/` still proxying to `:5173`. `ss -ltnp` shows the Bridge only on `127.0.0.1:<live port>`.
- **No other exposure:** given the Traefik config under `~/docker/core/traefik/` and the cloudflared config, a grep for the Bridge port and for `sidepiece` finds no route to the Bridge.
- **TLS from the laptop:** given `carries-macbook-air`, `curl -s -D- https://big-chungus.burro-salmon.ts.net/v1/health`, run without `-k` and with no auth header, returns `200` with `x-sidepiece-contract` and the health JSON.
- **Preflight from the laptop:** given the same laptop, the AC's preflight command returns `Access-Control-Allow-Private-Network: true` together with ACAO, Allow-Methods and Allow-Headers.
- **Distinct clients:** given one laptop request and one big-chungus request through the MagicDNS URL, the journal's `request` lines show two different `client` values, both from XFF, and the laptop's is not `127.0.0.1`.
- **Latency:** given `tailnet-check.sh` on the laptop, 50 sequential resolutions give p95 ≤ 1000ms. p50 and p95 are recorded verbatim in the Auto Run Result, beside the loopback figures from Story 1.6.
- **Regression:** given `mise run lint && mise run test && mise run build`, all exit 0.

## Spec Change Log

## Review Triage Log

## Design Notes

- **Serve through deploy, not a separate task:** the port is known only after the post-checks parse the unit's environment. A second script would re-derive it and drift. Re-running `mise run deploy` after 8787 is freed re-points `/v1` automatically.
- **Port 8787 vs 8789:** the AC names `127.0.0.1:8787`, but Story 1.10's still-open operator decision left the Bridge on 8789. Proxying `/v1` to 8787 today would publish `curator-serve` to the tailnet under the Bridge's name. So `/v1` follows the live port, and the literal 8787 display is owed to the operator (story ends `awaiting-operator`).
- **`--set-path /v1` with target `…/v1`:** tailscale strips the mount point and joins the rest onto the target path, so `/v1/health` reaches `127.0.0.1:<port>/v1/health`. The live `tailnet-check` proves it.
- **Reflecting `Origin` rather than an allow-list:** the tailnet is the trust boundary, and an allow-list would be a second, weaker auth layer that the architecture explicitly declines.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build`: expected exit 0, with `deploy:selftest` including the new cases.
- `mise run deploy`: expected exit 0 and the `exposed https://big-chungus.burro-salmon.ts.net/v1 -> …` line.
- `tailscale serve status`: expected both `/` and `/v1` handlers.
- `ssh -o BatchMode=yes carries-macbook-air sh -s < .mise/scripts/tailnet-check.sh`: expected exit 0 and a `p50=… p95=… n=50` line.
- `journalctl --user -u sidepiece-bridge -o cat | grep '"event":"request"' | tail`: expected distinct `client` values for the laptop and big-chungus.

## Auto Run Result

Status: implemented, awaiting review (the literal `127.0.0.1:8787` display is owed to the operator; see Design Notes)

**Summary:** The Bridge now answers every `OPTIONS` itself (204, unconditional `Access-Control-Allow-Private-Network: true`, reflected origin, route methods + OPTIONS, echoed request headers, max-age 600), and every other response carries ACAO / `Vary: Origin` / `Expose-Headers: X-Sidepiece-Contract`. `mise run deploy` gained step 8, Expose: loopback-only check via `ss`, MagicDNS name from `tailscale status --json`, `tailscale serve --bg --https=443 --set-path /v1 http://127.0.0.1:<port>/v1`, then verification that `/v1` proxies to exactly that target and every prior handler survived. Live on big-chungus with `/v1 -> http://127.0.0.1:8789/v1` and `/ -> http://127.0.0.1:5173` kept.

**Files changed:**
- `packages/bridge/src/server/http.ts`: no-auth / NFR-1 header comment, the `OPTIONS` intercept with the LNA comment, CORS read headers in `send` (origin read from `res.req`).
- `packages/bridge/src/server/http.test.ts`: preflight (known route, unknown path, no Origin, echoed headers, mutating route, route-owned OPTIONS never runs, request log with client), plain GET with Origin, CORS on error responses, two XFF callers.
- `.mise/scripts/deploy-bridge.sh`: step 8, Expose (`bridge_not_loopback_only`, `tailnet_serve_failed`, `tailnet_serve_unverified`, `jq_missing`).
- `.mise/scripts/deploy-bridge.test.sh`: `tailscale` stub (serve state in a JSON fixture that `serve --set-path` rewrites; `STUB_SERVE_FAIL`, `STUB_SERVE_EFFECT=wrongport|droproot`) and an `ss -Hltn` branch in the `ss` stub. 97 checks (was 70).
- `.mise/scripts/tailnet-check.sh`: POSIX sh, three checks (tls, preflight, latency).
- `mise.toml`: `tailnet:check`.
- `packages/bridge/deploy/README.md`: Expose section.

**Verification:**
- `mise run lint && mise run test && mise run build`: exit 0. `deploy-bridge.test.sh`: all 97 checks passed.
- First live `mise run deploy`: `tailnet_serve_failed: sending serve config: Access denied: serve config denied` (stderr carried verbatim). After `sudo -n tailscale set --operator=$USER`, `mise run deploy` exits 0: `deploy-bridge: exposed https://big-chungus.burro-salmon.ts.net/v1 -> http://127.0.0.1:8789/v1`.
- `tailscale serve status`: `https://big-chungus.burro-salmon.ts.net (tailnet only)`, `/ proxy http://127.0.0.1:5173`, `/v1 proxy http://127.0.0.1:8789/v1`. `ss -ltnp`: Bridge only on `127.0.0.1:8789` (curator-serve still on `127.0.0.1:8787`).
- No other exposure: grep for `8787|8789|sidepiece` under `~/docker/core/traefik/`, `~/docker/core/cloudflare-tunnel*/config.yml` and `~/.cloudflared/config.yml` finds nothing.
- `ssh -o BatchMode=yes carries-macbook-air sh -s < .mise/scripts/tailnet-check.sh`: exit 0.
  - `tls ok: HTTP/2 200 , x-sidepiece-contract: 1` (no `-k`, no auth header; health JSON returned).
  - `preflight ok: ACAO chrome-extension://abcdefghijklmnopabcdefghijklmnop, methods GET, HEAD, OPTIONS, headers Content-Type, private-network true`
  - `p50=29.92 p95=118.82 n=50` (tailnet, laptop) vs loopback baseline from Story 1.6: p50 4.99ms, p95 6.83ms.
- Journal `request` lines: laptop `"client":"100.81.162.91"`, big-chungus via its own MagicDNS URL `"client":"100.66.29.76"`; both from XFF, neither `127.0.0.1`.
