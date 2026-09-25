# Deploying the Bridge

`mise run deploy` (on `big-chungus`, or from the laptop over `ssh`; set `SIDEPIECE_DEPLOY_HOST` for another host):

1. builds `packages/bridge/dist/bridge.mjs` (`build:bridge`) and refuses unless `dist/` is that one file with `@sidepiece/contract` inlined;
2. refuses if the lib dir and the state dir overlap (after `realpath -m`, so symlinks count);
3. refuses unless the unit's `ExecStart=` node is an absolute `.../node/24.15.<n>/...` path (no `lts`, `latest`, shims) printing `v24.*`;
4. rsyncs **one file** to `~/.local/lib/sidepiece/bridge.mjs` and installs `sidepiece-bridge.service` verbatim to `~/.config/systemd/user/`;
5. ensures lingering, then `daemon-reload`, `enable`, `restart`;
6. polls `http://127.0.0.1:<port>/v1/health` for 10s (200 + `x-sidepiece-contract`), naming whoever holds the port on failure;
7. exposes it on the tailnet (see [Expose](#expose)).

Every failure is one line: `deploy-bridge: <code>: <detail>`. `mise run deploy:selftest` covers the refusal paths.

## The two directories

| dir | what | who writes it |
|-----|------|---------------|
| `~/.local/lib/sidepiece/` | `bridge.mjs`, nothing else | the deploy |
| `~/.local/state/sidepiece/` | `turns.db`, `registry-snapshot.json` | the Bridge only; systemd creates it (`StateDirectory=`) |

The deploy never reads, writes, or rsyncs anything in the state dir.

## Checks

```sh
systemctl --user is-enabled sidepiece-bridge; systemctl --user is-active sidepiece-bridge
systemctl --user kill -s SIGKILL sidepiece-bridge; sleep 5; systemctl --user is-active sidepiece-bridge   # active again (Restart=always, RestartSec=2)
journalctl --user -u sidepiece-bridge -n 50 -o cat          # JSON lines, incl. "event":"listening"
loginctl show-user "$USER" -p Linger                         # Linger=yes, so it survives reboot without a login
```

After a reboot: `systemctl --user is-active sidepiece-bridge` should print `active` before you log in.

## Credentials

Every credential comes from 1Password. The Bridge holds exactly one bootstrap secret, the `DeLoSecrets` service-account token, and resolves each declared `op://` reference (today only `op://DeLoSecrets/Plane/apiKey`, dependency `plane`) with `/usr/bin/op read --no-newline <ref>` in a child that alone receives the token. Nothing in the repo reads or holds the token.

**The token file.** `/etc/sidepiece/op-service-token`, owned `root:delorenj`, mode `0640`, in a `root:root 0755` dir. The unit loads it with `LoadCredential=op-token:/etc/sidepiece/op-service-token`, so the Bridge sees it as `$CREDENTIALS_DIRECTORY/op-token`. It is never in `Environment=` or an `EnvironmentFile=`, and the Bridge deletes any inherited `OP_SERVICE_ACCOUNT_TOKEN` at startup.

Install or rotate it (from a shell whose `OP_SERVICE_ACCOUNT_TOKEN` is the new token; nothing is echoed):

```sh
sudo -n install -d -o root -g root -m 0755 /etc/sidepiece
printf '%s' "$OP_SERVICE_ACCOUNT_TOKEN" | sudo -n install -o root -g "$USER" -m 0640 /dev/stdin /etc/sidepiece/op-service-token
systemctl --user restart sidepiece-bridge
```

A resolved value is cached in memory for the process lifetime, so rotating a key (or the token) that is already cached needs that restart. A credential that has not resolved yet is retried on the next call that needs it (today: every `/v1/health`), so a vault that comes back is picked up with no restart.

**The fallback.** `SetCredential=op-token:` gives the credential an empty value when the file is missing. Without it systemd refuses to start the unit (`243/CREDENTIALS`) and the operator sees DS-4 for a host that is fine. With it, the Bridge starts, listens, and reports DS-8.

**What DS-8 means.** A declared credential did not resolve. `/v1/health` carries one entry per unresolved credential, `{"ds":"DS-8","params":{"credential":"op://DeLoSecrets/Plane/apiKey","dependency":"plane"}}`, and the journal carries a `credential_unresolved` warn line with the `reason`:

| reason | cause |
|--------|-------|
| `no_bootstrap_token` | no `$CREDENTIALS_DIRECTORY`, or `op-token` missing, unreadable or empty (the fallback) |
| `op_bin_invalid` | `OP_BIN` unset or not absolute; `op` is never spawned |
| `op_failed` | `op` exited non-zero (its stderr verbatim as `detail`: bad token, vault down) or could not be spawned |
| `timeout` | `op` took longer than 2s and was killed |
| `empty` | `op` printed nothing |

The Bridge never exits and never delays `listen` over a credential. No log line, health entry or response carries a resolved value or the token; the `op://` reference does appear.

```sh
journalctl --user -u sidepiece-bridge -o cat | grep credential_          # resolved / unresolved lines
mise run secrets:scan                                                    # .env.op is references only; no resolved value tracked
```

## Port 8787

`curator-serve.service` (folder-curator) holds `127.0.0.1:8787` today, and `pdf2md-serve.service` holds 8788. Until one moves, a temporary drop-in runs the Bridge on 8789:

```ini
# ~/.config/systemd/user/sidepiece-bridge.service.d/port-conflict.conf  -- remove once 8787 is free
[Service]
Environment=SIDEPIECE_BRIDGE_PORT=8789
```

The deploy reads the port from the unit's `Environment=`, so the health check follows the drop-in.

## Expose

The last deploy step puts the Bridge on the tailnet with `tailscale serve`, and nowhere else: no Traefik route, no Cloudflare ingress, no `delo.sh` name, never `tailscale funnel`.

1. `ss -Hltn "sport = :<port>"` must show only `127.0.0.1:<port>`, else `bridge_not_loopback_only`.
2. The MagicDNS name comes from `tailscale status --json` (`.Self.DNSName`).
3. `tailscale serve --bg --https=443 --set-path /v1 http://127.0.0.1:<port>/v1`. A refusal is `tailnet_serve_failed` with tailscale's stderr verbatim.
4. `tailscale serve status --json` is re-read: `/v1` must proxy to exactly that target, and every handler present before (today `/` -> `http://127.0.0.1:5173`) must still be there, else `tailnet_serve_unverified`. The deploy never runs `serve reset` and never touches another handler.

`<port>` is the one the health check used, so `/v1` follows the `port-conflict.conf` drop-in. Once 8787 is free, re-run `mise run deploy` and `/v1` is re-pointed.

Result: `https://big-chungus.burro-salmon.ts.net/v1/...` reaches `http://127.0.0.1:<port>/v1/...` (serve strips the `/v1` mount and joins the rest onto the target path). The Bridge authenticates no caller: the tailnet is the trust boundary, so any device on `burro-salmon.ts.net` can call every route. The client address in the request log comes from `X-Forwarded-For`.

If `serve` is denied, the user is not the tailscale operator: `sudo tailscale set --operator=$USER` once, then redeploy.

From any tailnet device (the laptop):

```sh
mise run tailnet:check                                                   # in a checkout
ssh carries-macbook-air sh -s < .mise/scripts/tailnet-check.sh           # or pipe it to one
```

It checks TLS without `-k`, the Chrome LNA preflight (`Access-Control-Allow-Private-Network: true` plus ACAO, Allow-Methods, Allow-Headers), and prints `p50=<ms> p95=<ms> n=50` for 50 sequential `GET /project/sidepiece`, failing over 1000ms.
