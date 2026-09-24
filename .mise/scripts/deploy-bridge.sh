#!/usr/bin/env bash
# deploy-bridge.sh -- put the one-file Bridge bundle on its host, supervised by systemd --user,
# without ever touching the Turn store (Story 1.10).
#
# Steps, in order; nothing on the target is written before step 5:
#   1 bundle check   2 target resolution   3 blast-radius guard   4 node pin check
#   5 install (one file + the unit, never a directory)   6 supervise   7 post-checks
#   8 expose (tailscale serve path /v1 -> the live loopback port; no other handler touched)
#
# Every failure exits non-zero with exactly one line on stderr: `deploy-bridge: <code>: <detail>`.
# The state dir is canonicalized for the guard and otherwise never read, written, or rsynced;
# systemd creates it through StateDirectory=.
#
# Env:
#   SIDEPIECE_DEPLOY_HOST        target host (default big-chungus); `hostname -s`/`-f`, localhost or 127.0.0.1 = local mode
#   SIDEPIECE_DEPLOY_ROOT        test seam: replaces the target's $HOME
#   SIDEPIECE_DEPLOY_LIB_DIR     test seam: overrides <home>/.local/lib/sidepiece
#   SIDEPIECE_DEPLOY_STATE_DIR   test seam: overrides <home>/.local/state/sidepiece
#   SIDEPIECE_DEPLOY_HEALTH_TIMEOUT  seconds to poll /v1/health (default 10)
#   SIDEPIECE_TAILSCALE_BIN      tailscale binary on the target (default: tailscale on PATH)
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
dist="$repo/packages/bridge/dist"
unit_src="$repo/packages/bridge/deploy/sidepiece-bridge.service"
unit_name="sidepiece-bridge"

# Same two relative paths as packages/bridge/src/config.ts (DEPLOY_TARGET_DIR, DEFAULT_STATE_DIR).
LIB_REL=".local/lib/sidepiece"
STATE_REL=".local/state/sidepiece"

die() {
  printf 'deploy-bridge: %s: %s\n' "$1" "$2" >&2
  exit 1
}
say() { printf 'deploy-bridge: %s\n' "$*"; }

# ---- 1. bundle check ------------------------------------------------------------------------
[[ -d "$dist" ]] || die bundle_not_single_file "$dist does not exist (run mise run build:bridge)"
listing="$(ls -A "$dist")"
[[ -f "$dist/bridge.mjs" ]] || die bundle_not_single_file "$dist/bridge.mjs is not a regular file"
[[ "$listing" == "bridge.mjs" ]] ||
  die bundle_not_single_file "$dist must contain exactly bridge.mjs, has: $(echo "$listing" | tr '\n' ' ')"
inlined="$(grep -c "@sidepiece/contract" "$dist/bridge.mjs" || true)"
[[ "$inlined" == "0" ]] || die bundle_not_inlined "$dist/bridge.mjs references @sidepiece/contract $inlined time(s)"
[[ -f "$unit_src" ]] || die unit_missing "$unit_src not found"

# ---- 2. target resolution --------------------------------------------------------------------
host="${SIDEPIECE_DEPLOY_HOST:-big-chungus}"
host_lc="${host,,}"
if [[ "$host_lc" == "$(hostname -s | tr '[:upper:]' '[:lower:]')" || "$host_lc" == "$(hostname -f 2>/dev/null | tr '[:upper:]' '[:lower:]')" ||
  "$host_lc" == "localhost" || "$host_lc" == "127.0.0.1" ]]; then
  local_mode=1
else
  local_mode=0
fi

# run <cmd> [args...]: on the target, locally or over ssh (args quoted for the remote shell).
run() {
  if ((local_mode)); then
    "$@"
  else
    ssh -o BatchMode=yes "$host" "$(printf '%q ' "$@")"
  fi
}
# push <local-file> <remote-path>: rsync ONE file; never -r, never --delete, never a directory.
push() {
  [[ -f "$1" ]] || die install_failed "refusing to rsync non-file $1"
  if ((local_mode)); then
    rsync --times -- "$1" "$2"
  else
    rsync -e 'ssh -o BatchMode=yes' --times -- "$1" "$host:$2"
  fi
}

if [[ -n "${SIDEPIECE_DEPLOY_ROOT:-}" ]]; then
  home="$SIDEPIECE_DEPLOY_ROOT"
elif ((local_mode)); then
  home="$HOME"
else
  home="$(ssh -o BatchMode=yes "$host" 'printf %s "$HOME"')" || die target_unreachable "ssh $host failed"
fi
[[ "$home" == /* ]] || die target_unreachable "remote home '$home' is not absolute"
lib_dir="${SIDEPIECE_DEPLOY_LIB_DIR:-$home/$LIB_REL}"
state_dir="${SIDEPIECE_DEPLOY_STATE_DIR:-$home/$STATE_REL}"
unit_dir="$home/.config/systemd/user"

# ---- 3. blast-radius guard -------------------------------------------------------------------
lib_real="$(run realpath -m -- "$lib_dir")" || die target_unreachable "realpath failed on $host"
state_real="$(run realpath -m -- "$state_dir")" || die target_unreachable "realpath failed on $host"
at_or_under() { [[ "$1" == "$2" || "$1" == "$2"/* || "$2" == / ]]; }
if at_or_under "$lib_real" "$state_real"; then
  die deploy_target_in_state_dir "$lib_real is at or under $state_real"
fi
if at_or_under "$state_real" "$lib_real"; then
  die deploy_target_in_state_dir "$state_real is at or under $lib_real"
fi

# ---- 4. node pin check -----------------------------------------------------------------------
exec_line="$(sed -n 's/^ExecStart=//p' "$unit_src" | head -n 1)"
node_raw="${exec_line%% *}"
node_path="${node_raw//%h/$home}"
[[ -n "$node_raw" ]] || die node_pin_invalid "no ExecStart= in $unit_src"
[[ "$node_path" == /* ]] || die node_pin_invalid "$node_path is not absolute"
# Alias checks run on the unit's own token, so a random temp home cannot trip them.
if [[ "$node_raw" == *lts* || "$node_raw" == *latest* || "$node_raw" == */shims/* ]]; then
  die node_pin_invalid "$node_raw names an alias or shim, not a pinned install"
fi
[[ "$node_path" =~ /24\.15\.[0-9]+/ ]] || die node_pin_invalid "$node_path has no /24.15.<n>/ segment"
node_version="$(run "$node_path" --version 2>/dev/null)" || die node_pin_invalid "$node_path --version failed on $host"
[[ "$node_version" =~ ^v24\.15\. ]] || die node_pin_invalid "$node_path prints $node_version, want v24.15.*"
say "target $host ($([[ $local_mode == 1 ]] && echo local || echo ssh)), node $node_version, lib $lib_real, state $state_real (untouched)"

# ---- 5. install ------------------------------------------------------------------------------
run mkdir -p -- "$lib_dir" "$unit_dir" || die install_failed "mkdir on $host"
push "$dist/bridge.mjs" "$lib_dir/bridge.mjs" || die install_failed "rsync bridge.mjs to $host:$lib_dir"
push "$unit_src" "$unit_dir/$unit_name.service" || die install_failed "rsync unit to $host:$unit_dir"
say "installed $lib_dir/bridge.mjs and $unit_dir/$unit_name.service"

# ---- 6. supervise ----------------------------------------------------------------------------
user="$(run id -un)" || die target_unreachable "id -un failed on $host"
linger="$(run loginctl show-user "$user" -p Linger 2>/dev/null || true)"
if [[ "$linger" != "Linger=yes" ]]; then
  run loginctl enable-linger "$user" >/dev/null 2>&1 || die linger_unavailable "loginctl enable-linger $user failed on $host"
fi
run systemctl --user daemon-reload || die supervise_failed "daemon-reload"
run systemctl --user enable "$unit_name" >/dev/null 2>&1 || die supervise_failed "enable $unit_name"
run systemctl --user restart "$unit_name" || die supervise_failed "restart $unit_name"
say "enabled and restarted $unit_name"

# ---- 7. post-checks --------------------------------------------------------------------------
env_line="$(run systemctl --user show "$unit_name" -p Environment --value 2>/dev/null || true)"
# systemd applies assignments in order, so the LAST SIDEPIECE_BRIDGE_PORT= (e.g. a drop-in) wins.
port=8787
for assignment in $env_line; do
  if [[ "$assignment" =~ ^SIDEPIECE_BRIDGE_PORT=([0-9]+)$ ]]; then
    port="${BASH_REMATCH[1]}"
  fi
done
url="http://127.0.0.1:$port/v1/health"
health_timeout="${SIDEPIECE_DEPLOY_HEALTH_TIMEOUT:-10}"
[[ "$health_timeout" =~ ^[0-9]+$ ]] || die health_timeout_invalid "SIDEPIECE_DEPLOY_HEALTH_TIMEOUT='$health_timeout' is not a whole number of seconds"
deadline=$((SECONDS + health_timeout))
healthy=0
last=""
while :; do
  headers="$(run curl -s -o /dev/null -D - --max-time 2 "$url" 2>/dev/null || true)"
  status="$(printf '%s\n' "$headers" | head -n 1 | tr -d '\r')"
  last="${status:-no answer}"
  if [[ "$status" =~ ^HTTP/[0-9.]+\ 200 ]] && printf '%s\n' "$headers" | grep -qi '^x-sidepiece-contract:'; then
    healthy=1
    break
  fi
  ((SECONDS < deadline)) || break
  sleep 0.5
done
if ((!healthy)); then
  holder="$(run ss -ltnp 2>/dev/null | grep -E "[:.]$port[[:space:]]" | head -n 1 | tr -s ' ' || true)"
  die health_unanswered "$url gave '$last' without x-sidepiece-contract; port $port holder: ${holder:-none}"
fi
active="$(run systemctl --user is-active "$unit_name" 2>/dev/null || true)"
[[ "$active" == "active" ]] || die health_unanswered "$url answered, but $unit_name is '$active' -- something else is serving the port"
say "health ok on $url"

lib_listing="$(run ls -A -- "$lib_dir")"
[[ "$lib_listing" == "bridge.mjs" ]] ||
  die lib_dir_not_single_file "$lib_dir holds: $(echo "$lib_listing" | tr '\n' ' ') (reported only; nothing deleted)"

# ---- 8. expose -------------------------------------------------------------------------------
# tailscale serve is the only way onto the tailnet (Story 1.11): never funnel, never Traefik or
# Cloudflare, never `serve reset`. Only the /v1 handler is set; every other handler must survive.
command -v jq >/dev/null || die jq_missing "jq is needed to read tailscale's JSON"
tailscale_bin="${SIDEPIECE_TAILSCALE_BIN:-tailscale}"
listeners="$(run ss -Hltn "sport = :$port" 2>/dev/null | awk '{print $4}' | sort -u | tr '\n' ' ' || true)"
listeners="${listeners% }"
[[ -n "$listeners" ]] || die bridge_not_loopback_only "nothing listens on :$port"
for addr in $listeners; do
  [[ "$addr" == "127.0.0.1:$port" ]] || die bridge_not_loopback_only "$listeners"
done
dns="$(run "$tailscale_bin" status --json | jq -r '.Self.DNSName // empty')" ||
  die tailnet_serve_failed "tailscale status --json failed on $host"
dns="${dns%.}"
[[ -n "$dns" ]] || die tailnet_serve_failed "tailscale status --json has no .Self.DNSName"
web_key="$dns:443"
target="http://127.0.0.1:$port/v1"
handlers() {
  run "$tailscale_bin" serve status --json | jq -r --arg k "$web_key" '(.Web // {})[$k].Handlers // {} | keys[]'
}
before_keys="$(handlers)" || die tailnet_serve_unverified "tailscale serve status --json failed before the change"
if ! serve_err="$(run "$tailscale_bin" serve --bg --https=443 --set-path /v1 "$target" 2>&1 >/dev/null)"; then
  die tailnet_serve_failed "$serve_err"
fi
after_json="$(run "$tailscale_bin" serve status --json)" || die tailnet_serve_unverified "tailscale serve status --json failed after the change"
proxy="$(jq -r --arg k "$web_key" '(.Web // {})[$k].Handlers["/v1"].Proxy // "none"' <<<"$after_json")"
after_keys="$(jq -r --arg k "$web_key" '(.Web // {})[$k].Handlers // {} | keys[]' <<<"$after_json")"
missing=""
while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  grep -qxF -- "$key" <<<"$after_keys" || missing+="$key "
done <<<"$before_keys"
if [[ "$proxy" != "$target" || -n "$missing" ]]; then
  die tailnet_serve_unverified "/v1 -> $proxy (want $target); handlers lost: ${missing:-none}"
fi
say "exposed https://$dns/v1 -> $target"
say "done"
