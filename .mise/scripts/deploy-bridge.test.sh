#!/usr/bin/env bash
# Self-test for deploy-bridge.sh (Story 1.10). Every case runs against a throwaway repo copy and
# a throwaway home in a temp dir, in local mode, with stub systemctl/loginctl/curl/ss/tailscale on PATH
# that record their calls. It never touches the real ~/.local or the live systemd user manager.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
node_bin="$(command -v node)" || {
  echo "deploy-bridge.test.sh: node not found on PATH" >&2
  exit 1
}

tmp="$(mktemp -d "${TMPDIR:-/tmp}/sidepiece-deploy-selftest.XXXXXX")" || exit 1
[[ -n "$tmp" && -d "$tmp" ]] || exit 1
trap 'rm -rf "$tmp"' EXIT
trap 'rm -rf "$tmp"; exit 130' INT TERM

fails=0
pass() { printf 'ok   - %s\n' "$1"; }
fail() {
  printf 'FAIL - %s\n' "$1"
  fails=$((fails + 1))
}
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

# ---- stubs ---------------------------------------------------------------------------------
bin="$tmp/bin"
mkdir -p "$bin"
cat >"$bin/systemctl" <<'SH'
#!/bin/sh
echo "systemctl $*" >>"$STUB_LOG"
case "$*" in
  *" show "*) echo "${STUB_ENV:-${STUB_PORT:+SIDEPIECE_BRIDGE_PORT=$STUB_PORT}}" ;;
  *" is-active "*) echo "${STUB_ACTIVE:-active}" ;;
esac
exit 0
SH
cat >"$bin/loginctl" <<'SH'
#!/bin/sh
echo "loginctl $*" >>"$STUB_LOG"
case "$1" in
  show-user) echo "Linger=${STUB_LINGER:-yes}" ;;
  enable-linger) [ "${STUB_LINGER_FAIL:-0}" = 1 ] && exit 1 ;;
esac
exit 0
SH
cat >"$bin/curl" <<'SH'
#!/bin/sh
echo "curl $*" >>"$STUB_LOG"
case "${STUB_CURL:-ok}" in
  ok) printf 'HTTP/1.1 200 OK\r\nx-sidepiece-contract: 1\r\ncontent-type: application/json\r\n\r\n' ;;
  stranger) printf 'HTTP/1.1 200 OK\r\ncontent-type: text/html\r\n\r\n' ;;
  *) exit 7 ;;
esac
SH
cat >"$bin/ss" <<'SH'
#!/bin/sh
echo "ss $*" >>"$STUB_LOG"
if [ "$1" = -Hltn ]; then
  # `ss -Hltn "sport = :N"`: one line per listening address; defaults to loopback on N.
  port="${2##*:}"
  for addr in ${STUB_SS_ADDRS:-127.0.0.1:$port}; do
    echo "LISTEN 0      511    $addr   0.0.0.0:*"
  done
  exit 0
fi
echo "LISTEN 0      5      127.0.0.1:${STUB_PORT:-8787}   0.0.0.0:*    users:((\"python3\",pid=4242,fd=4))"
SH
# tailscale: serve status is the JSON in $STUB_SERVE_STATE, which `serve --set-path` rewrites.
# STUB_SERVE_FAIL=1 denies the serve; STUB_SERVE_EFFECT=wrongport|droproot corrupts its effect.
cat >"$bin/tailscale" <<'SH'
#!/bin/sh
echo "tailscale $*" >>"$STUB_LOG"
key="big-chungus.burro-salmon.ts.net:443"
case "$1 $2" in
  "status --json") echo '{"Self":{"DNSName":"big-chungus.burro-salmon.ts.net."}}' ;;
  "serve status") cat "$STUB_SERVE_STATE" ;;
  "serve --bg")
    if [ "${STUB_SERVE_FAIL:-0}" = 1 ]; then
      echo "Access denied: serve config denied" >&2
      exit 1
    fi
    for target; do :; done
    case "${STUB_SERVE_EFFECT:-ok}" in
      wrongport) target="http://127.0.0.1:9999/v1" ;;
    esac
    filter='.TCP["443"].HTTPS = true | .Web[$k].Handlers["/v1"].Proxy = $t'
    [ "${STUB_SERVE_EFFECT:-ok}" = droproot ] && filter="$filter"' | del(.Web[$k].Handlers["/"])'
    jq --arg k "$key" --arg t "$target" "$filter" "$STUB_SERVE_STATE" >"$STUB_SERVE_STATE.new" &&
      mv "$STUB_SERVE_STATE.new" "$STUB_SERVE_STATE"
    ;;
  *) exit 2 ;;
esac
SH
chmod +x "$bin"/*

# Remote-mode stubs, on PATH only for the remote case: ssh runs the quoted command locally,
# rsync strips `fakehost:` and -e, logging the destination it was handed.
rbin="$tmp/rbin"
mkdir -p "$rbin"
cat >"$rbin/ssh" <<'SH'
#!/bin/sh
while [ "$1" = -o ]; do shift 2; done
host="$1"; shift
echo "ssh $host $*" >>"$STUB_LOG"
exec bash -c "$*"
SH
cat >"$rbin/rsync" <<'SH'
#!/usr/bin/env bash
echo "rsync $*" >>"$STUB_LOG"
out=()
while (($#)); do
  if [[ "$1" == -e ]]; then shift 2; continue; fi
  out+=("${1#fakehost:}")
  shift
done
exec /usr/bin/rsync "${out[@]}"
SH
chmod +x "$rbin"/*

# ---- fixtures ------------------------------------------------------------------------------
# fixture <name> [node-version]: a fresh repo copy + home under $tmp/<name>; sets globals.
fixture() {
  base="$tmp/$1"
  frepo="$base/repo"
  fhome="$base/home"
  mkdir -p "$frepo/.mise/scripts" "$frepo/packages/bridge/dist" "$frepo/packages/bridge/deploy"
  cp "$repo/.mise/scripts/deploy-bridge.sh" "$frepo/.mise/scripts/"
  cp "$repo/packages/bridge/deploy/sidepiece-bridge.service" "$frepo/packages/bridge/deploy/"
  printf '// fake bundle\nimport { createServer } from "node:http";\n' >"$frepo/packages/bridge/dist/bridge.mjs"
  local nodedir="$fhome/.local/share/mise/installs/node/24.15.0/bin"
  mkdir -p "$nodedir"
  printf '#!/bin/sh\necho %s\n' "${2:-v24.15.0}" >"$nodedir/node"
  chmod +x "$nodedir/node"
  fstate="$fhome/.local/state/sidepiece"
  flib="$fhome/.local/lib/sidepiece"
  mkdir -p "$fstate"
  "$node_bin" -e '
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(process.argv[1]);
    db.exec("CREATE TABLE resolutions (pjid TEXT PRIMARY KEY, generation INTEGER)");
    db.exec("INSERT INTO resolutions VALUES (\x27sidepiece\x27, 3)");
    db.exec("PRAGMA user_version = 1");
    db.close();' "$fstate/turns.db" 2>/dev/null
  printf '{"projects":{"sidepiece":{"boardId":"b"}}}\n' >"$fstate/registry-snapshot.json"
  # Old timestamps so an accidental touch would show up as a changed mtime.
  touch -d '2026-01-01 00:00:00' "$fstate/turns.db" "$fstate/registry-snapshot.json"
  log="$base/calls.log"
  : >"$log"
  serve_state="$base/serve.json"
  printf '%s\n' '{"TCP":{"443":{"HTTPS":true}},"Web":{"big-chungus.burro-salmon.ts.net:443":{"Handlers":{"/":{"Proxy":"http://127.0.0.1:5173"}}}}}' >"$serve_state"
  # A fixture whose turns.db never got created would make every "state untouched" check vacuous.
  [[ -s "$fstate/turns.db" ]] || {
    echo "deploy-bridge.test.sh: fixture $1 failed to create turns.db (node:sqlite?)" >&2
    exit 1
  }
}

# deploy [VAR=val...]: run the fixture's script; captures rc, stdout, stderr.
deploy() {
  env PATH="$bin:$PATH" STUB_LOG="$log" STUB_SERVE_STATE="$serve_state" SIDEPIECE_DEPLOY_HOST=localhost \
    SIDEPIECE_DEPLOY_ROOT="$fhome" SIDEPIECE_DEPLOY_HEALTH_TIMEOUT=1 "$@" \
    bash "$frepo/.mise/scripts/deploy-bridge.sh" >"$base/out" 2>"$base/err"
  rc=$?
}

state_sig() {
  (cd "$fstate" && stat -c '%n %s %Y %i' turns.db registry-snapshot.json && sha256sum turns.db registry-snapshot.json)
  "$node_bin" -e '
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(process.argv[1], { readOnly: true });
    console.log("user_version", db.prepare("PRAGMA user_version").get().user_version);
    db.close();' "$fstate/turns.db" 2>/dev/null
}

# refused <label> <code> [lib-path]: the refusal contract -- one named stderr line, non-zero exit,
# no lib dir, no systemctl call, state untouched.
refused() {
  local label="$1" code="$2" libpath="${3:-$flib}"
  check "$label: exits non-zero" "[[ $rc -ne 0 ]]"
  check "$label: one stderr line naming $code" \
    "[[ \$(wc -l <'$base/err') -eq 1 ]] && grep -q '^deploy-bridge: $code: ' '$base/err'"
  check "$label: lib dir not created" "[[ ! -e '$libpath' ]]"
  check "$label: systemctl never called" "! grep -q '^systemctl' '$log'"
  check "$label: state untouched" "[[ \"\$(state_sig)\" == '$before' ]]"
}

# ---- happy deploy ----------------------------------------------------------------------------
fixture happy
deploy
check "happy: exit 0" "[[ $rc -eq 0 ]]"
[[ $rc -eq 0 ]] || sed 's/^/    /' "$base/err"
check "happy: bundle installed byte-for-byte" "cmp -s '$frepo/packages/bridge/dist/bridge.mjs' '$flib/bridge.mjs'"
check "happy: unit installed verbatim" \
  "cmp -s '$frepo/packages/bridge/deploy/sidepiece-bridge.service' '$fhome/.config/systemd/user/sidepiece-bridge.service'"
check "happy: daemon-reload, enable, restart in order" \
  "[[ \"\$(grep -E '^systemctl --user (daemon-reload|enable|restart)' '$log' | tr '\n' '|')\" == 'systemctl --user daemon-reload|systemctl --user enable sidepiece-bridge|systemctl --user restart sidepiece-bridge|' ]]"
check "happy: linger already on, not re-enabled" "! grep -q 'enable-linger' '$log'"
check "happy: health polled on default 8787" "grep -q 'http://127.0.0.1:8787/v1/health' '$log'"
check "happy: lib dir holds only bridge.mjs" "[[ \"\$(ls -A '$flib')\" == bridge.mjs ]]"

check "happy: serve argv is exact" \
  "grep -qxF 'tailscale serve --bg --https=443 --set-path /v1 http://127.0.0.1:8787/v1' '$log'"
check "happy: /v1 proxies to the live port" \
  "[[ \$(jq -r '.Web[\"big-chungus.burro-salmon.ts.net:443\"].Handlers[\"/v1\"].Proxy' '$serve_state') == http://127.0.0.1:8787/v1 ]]"
check "happy: the / handler survives" \
  "[[ \$(jq -r '.Web[\"big-chungus.burro-salmon.ts.net:443\"].Handlers[\"/\"].Proxy' '$serve_state') == http://127.0.0.1:5173 ]]"
check "happy: loopback checked with ss -Hltn on the port" "grep -qxF 'ss -Hltn sport = :8787' '$log'"
check "happy: exposure reported" \
  "grep -qxF 'deploy-bridge: exposed https://big-chungus.burro-salmon.ts.net/v1 -> http://127.0.0.1:8787/v1' '$base/out'"
check "happy: no funnel, no serve reset" "! grep -qE '^tailscale (funnel|serve reset)' '$log'"

# ---- redeploy with real state ------------------------------------------------------------------
fixture redeploy
before="$(state_sig)"
deploy
rc1=$rc
deploy STUB_PORT=8789
check "redeploy: both runs exit 0" "[[ $rc1 -eq 0 && $rc -eq 0 ]]"
check "redeploy: state files unchanged (size, mtime, inode, sha256, user_version)" \
  "[[ \"\$(state_sig)\" == '$before' ]]"
check "redeploy: user_version is still 1" "grep -q '^user_version 1$' <<<\"\$(state_sig)\""
check "redeploy: port read from unit Environment" "grep -q 'http://127.0.0.1:8789/v1/health' '$log'"
check "redeploy: lib dir holds only bridge.mjs" "[[ \"\$(ls -A '$flib')\" == bridge.mjs ]]"
check "redeploy: /v1 re-pointed at the drop-in port" \
  "[[ \$(jq -r '.Web[\"big-chungus.burro-salmon.ts.net:443\"].Handlers[\"/v1\"].Proxy' '$serve_state') == http://127.0.0.1:8789/v1 ]]"
check "redeploy: state dir holds only what it had" \
  "[[ \"\$(ls -A '$fstate' | tr '\n' ' ')\" == 'registry-snapshot.json turns.db ' ]]"

# ---- lib under state ------------------------------------------------------------------------
fixture lib-under-state
before="$(state_sig)"
deploy SIDEPIECE_DEPLOY_LIB_DIR="$fstate/lib"
refused "lib under state" deploy_target_in_state_dir "$fstate/lib"

# ---- state under lib ------------------------------------------------------------------------
fixture state-under-lib
before="$(state_sig)"
deploy SIDEPIECE_DEPLOY_LIB_DIR="$fhome/.local"
refused "state under lib" deploy_target_in_state_dir "$fhome/.local/lib"

# ---- lib symlinked into state -----------------------------------------------------------------
fixture lib-symlink
before="$(state_sig)"
mkdir -p "$fhome/.local/lib"
ln -s "$fstate/x" "$flib"
deploy
refused "lib symlinked into state" deploy_target_in_state_dir "$fstate/x"

# ---- node drift ------------------------------------------------------------------------------
fixture node-drift v26.10.0
before="$(state_sig)"
deploy
refused "node drift" node_pin_invalid
check "node drift: detail names the version" "grep -q 'v26.10.0' '$base/err'"

# ---- alias path ------------------------------------------------------------------------------
fixture alias
sed -i 's#/node/24\.15\.0/bin/node#/node/lts/bin/node#' "$frepo/packages/bridge/deploy/sidepiece-bridge.service"
before="$(state_sig)"
deploy
refused "alias path" node_pin_invalid

# ---- shim path -------------------------------------------------------------------------------
fixture shim
sed -i 's#^ExecStart=[^ ]*#ExecStart=%h/.local/share/mise/shims/node#' "$frepo/packages/bridge/deploy/sidepiece-bridge.service"
before="$(state_sig)"
deploy
refused "shim path" node_pin_invalid

# ---- contract not inlined ----------------------------------------------------------------------
fixture not-inlined
echo 'import { CONTRACT_VERSION } from "@sidepiece/contract";' >>"$frepo/packages/bridge/dist/bridge.mjs"
before="$(state_sig)"
deploy
refused "contract not inlined" bundle_not_inlined

# ---- extra dist file -------------------------------------------------------------------------
fixture extra-dist
echo '{}' >"$frepo/packages/bridge/dist/bridge.mjs.map"
before="$(state_sig)"
deploy
refused "extra dist file" bundle_not_single_file

# ---- port held by a stranger -----------------------------------------------------------------
fixture stranger
before="$(state_sig)"
deploy STUB_CURL=stranger
check "stranger: exits non-zero" "[[ $rc -ne 0 ]]"
check "stranger: one line naming health_unanswered" \
  "[[ \$(wc -l <'$base/err') -eq 1 ]] && grep -q '^deploy-bridge: health_unanswered: ' '$base/err'"
check "stranger: holder is named" "grep -q 'python3' '$base/err' && grep -q 'pid=4242' '$base/err'"
check "stranger: state untouched" "[[ \"\$(state_sig)\" == '$before' ]]"

# ---- linger off, then unavailable ----------------------------------------------------------------
fixture linger-off
deploy STUB_LINGER=no
check "linger off: enable-linger is run, deploy succeeds" "[[ $rc -eq 0 ]] && grep -q '^loginctl enable-linger' '$log'"
fixture linger-fail
deploy STUB_LINGER=no STUB_LINGER_FAIL=1
check "linger unavailable: named failure, no systemctl" \
  "[[ $rc -ne 0 ]] && grep -q '^deploy-bridge: linger_unavailable: ' '$base/err' && ! grep -q '^systemctl' '$log'"

# ---- stray file in lib dir ---------------------------------------------------------------------
fixture stray-lib
mkdir -p "$flib"
echo old >"$flib/stray.txt"
deploy
check "stray lib file: lib_dir_not_single_file, reported only" \
  "[[ $rc -ne 0 ]] && grep -q '^deploy-bridge: lib_dir_not_single_file: ' '$base/err' && [[ -f '$flib/stray.txt' ]]"

# ---- last SIDEPIECE_BRIDGE_PORT wins (unit, then drop-in) ---------------------------------------
fixture port-last
deploy STUB_ENV="SIDEPIECE_BRIDGE_PORT=8787 FOO=bar SIDEPIECE_BRIDGE_PORT=8789"
check "port: last assignment wins" "[[ $rc -eq 0 ]] && grep -q 'http://127.0.0.1:8789/v1/health' '$log' && ! grep -q '127.0.0.1:8787/' '$log'"

# ---- health answered but the unit is not active ---------------------------------------------------
fixture inactive
deploy STUB_ACTIVE=activating
check "inactive unit: health_unanswered even with the header" \
  "[[ $rc -ne 0 ]] && grep -q '^deploy-bridge: health_unanswered: .*activating' '$base/err'"

# ---- bad health timeout --------------------------------------------------------------------------
fixture bad-timeout
deploy SIDEPIECE_DEPLOY_HEALTH_TIMEOUT=abc
check "bad timeout: named health_timeout_invalid" \
  "[[ $rc -ne 0 && \$(wc -l <'$base/err') -eq 1 ]] && grep -q '^deploy-bridge: health_timeout_invalid: ' '$base/err'"

# ---- expose refusals ------------------------------------------------------------------------------
# expose_refused <label> <code>: named failure after the install, and `serve --set-path` never ran.
expose_refused() {
  check "$1: exits non-zero" "[[ $rc -ne 0 ]]"
  check "$1: one stderr line naming $2" \
    "[[ \$(wc -l <'$base/err') -eq 1 ]] && grep -q '^deploy-bridge: $2: ' '$base/err'"
}
fixture wide-bind
deploy STUB_SS_ADDRS="0.0.0.0:8787"
expose_refused "wide bind" bridge_not_loopback_only
check "wide bind: detail names the address" "grep -qF 'bridge_not_loopback_only: 0.0.0.0:8787' '$base/err'"
check "wide bind: serve never called" "! grep -q '^tailscale serve --bg' '$log'"
check "wide bind: no exposure reported" "! grep -q 'exposed' '$base/out'"

fixture wide-v6
deploy STUB_SS_ADDRS="127.0.0.1:8787 [::]:8787"
expose_refused "loopback plus [::]" bridge_not_loopback_only
check "loopback plus [::]: serve never called" "! grep -q '^tailscale serve --bg' '$log'"

fixture serve-denied
serve_before="$(cat "$serve_state")"
deploy STUB_SERVE_FAIL=1
check "serve denied: exits non-zero" "[[ $rc -ne 0 ]]"
check "serve denied: tailscale stderr carried verbatim" \
  "grep -qxF 'deploy-bridge: tailnet_serve_failed: Access denied: serve config denied' '$base/err'"
check "serve denied: serve config unchanged" "[[ \"\$(cat '$serve_state')\" == '$serve_before' ]]"
check "serve denied: no exposure reported" "! grep -q 'exposed' '$base/out'"

fixture wrong-port
deploy STUB_SERVE_EFFECT=wrongport
expose_refused "wrong proxy" tailnet_serve_unverified
check "wrong proxy: the effect is reported" "grep -qF '/v1 -> http://127.0.0.1:9999/v1 (want http://127.0.0.1:8787/v1)' '$base/err'"
check "wrong proxy: no exposure reported" "! grep -q 'exposed' '$base/out'"

fixture drop-root
deploy STUB_SERVE_EFFECT=droproot
expose_refused "root handler lost" tailnet_serve_unverified
check "root handler lost: / is named" "grep -qF 'handlers lost: / ' '$base/err'"

# ---- remote (ssh) mode -----------------------------------------------------------------------------
fixture remote
before="$(state_sig)"
env PATH="$rbin:$bin:$PATH" STUB_LOG="$log" STUB_SERVE_STATE="$serve_state" SIDEPIECE_DEPLOY_HOST=fakehost \
  SIDEPIECE_DEPLOY_ROOT="$fhome" SIDEPIECE_DEPLOY_HEALTH_TIMEOUT=1 \
  bash "$frepo/.mise/scripts/deploy-bridge.sh" >"$base/out" 2>"$base/err"
rc=$?
check "remote: exit 0" "[[ $rc -eq 0 ]]"
[[ $rc -eq 0 ]] || sed 's/^/    /' "$base/err"
check "remote: bundle rsynced to fakehost:<lib>/bridge.mjs in batch mode" \
  "grep -qF -- \"-e ssh -o BatchMode=yes --times -- $frepo/packages/bridge/dist/bridge.mjs fakehost:$flib/bridge.mjs\" '$log'"
check "remote: bundle landed byte-for-byte" "cmp -s '$frepo/packages/bridge/dist/bridge.mjs' '$flib/bridge.mjs'"
check "remote: systemctl ran over ssh" "grep -q '^ssh fakehost systemctl --user restart sidepiece-bridge' '$log'"
check "remote: node pin checked over ssh with the remote home" \
  "grep -qF 'ssh fakehost $fhome/.local/share/mise/installs/node/24.15.0/bin/node --version' '$log'"
check "remote: state untouched" "[[ \"\$(state_sig)\" == '$before' ]]"
check "remote: serve ran over ssh" \
  "grep -qF 'ssh fakehost tailscale serve --bg --https=443 --set-path /v1 http://127.0.0.1:8787/v1' '$log'"

if [[ $fails -gt 0 ]]; then
  echo "deploy-bridge.test.sh: $fails failure(s)" >&2
  exit 1
fi
echo "deploy-bridge.test.sh: all passed"
