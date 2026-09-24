#!/bin/sh
# tailnet-check.sh -- the laptop-side checks of Story 1.11, against the Bridge through
# `tailscale serve`. POSIX sh (runs under macOS /bin/sh); needs curl, sort and awk only.
#
#   sh tailnet-check.sh [base-url]        default https://big-chungus.burro-salmon.ts.net/v1
#   ssh carries-macbook-air sh -s < .mise/scripts/tailnet-check.sh
#
#   1 tls        GET /health without -k and with no auth header: 200 + x-sidepiece-contract
#   2 preflight  the AC's chrome-extension preflight: all four Access-Control-Allow-* headers,
#                Private-Network true
#   3 latency    50 sequential GET /project/sidepiece; prints p50/p95 (nearest-rank), p95 <= 1000ms
#
# Every failure prints one line, `tailnet-check: <code>: <detail>`, and exits non-zero.
set -u

base="${1:-https://big-chungus.burro-salmon.ts.net/v1}"
base="${base%/}"
origin="chrome-extension://abcdefghijklmnopabcdefghijklmnop"
n=50

fail() {
  printf 'tailnet-check: %s: %s\n' "$1" "$2" >&2
  exit 1
}

# header <name> <headers-text>: the value of the first header <name>, CR stripped.
header() {
  printf '%s\n' "$2" | tr -d '\r' | awk -v want="$1" '
    { i = index($0, ":"); if (i == 0) next
      name = tolower(substr($0, 1, i - 1))
      if (name == want) { v = substr($0, i + 1); sub(/^[ \t]+/, "", v); print v; exit } }'
}

# ---- 1. tls ----------------------------------------------------------------------------------
out="$(curl -s -D- --max-time 10 "$base/health")" || fail tls "curl $base/health exited $? (certificate or transport)"
status="$(printf '%s\n' "$out" | head -n 1 | tr -d '\r')"
case "$status" in
  HTTP/*' 200'*) ;;
  *) fail tls "$base/health gave '${status:-no answer}', want 200" ;;
esac
contract="$(header x-sidepiece-contract "$out")"
[ -n "$contract" ] || fail tls "$base/health has no x-sidepiece-contract header"
printf 'tls ok: %s, x-sidepiece-contract: %s\n' "$status" "$contract"

# ---- 2. preflight ----------------------------------------------------------------------------
pre="$(curl -s -D- -o /dev/null --max-time 10 -X OPTIONS \
  -H "Origin: $origin" \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Private-Network: true' \
  "$base/project/sidepiece")" || fail preflight "curl OPTIONS $base/project/sidepiece exited $?"
for h in access-control-allow-origin access-control-allow-methods access-control-allow-headers access-control-allow-private-network; do
  [ -n "$(header "$h" "$pre")" ] || fail preflight "no $h on OPTIONS $base/project/sidepiece"
done
pn="$(header access-control-allow-private-network "$pre")"
[ "$pn" = true ] || fail preflight "access-control-allow-private-network is '$pn', want true"
printf 'preflight ok: ACAO %s, methods %s, headers %s, private-network %s\n' \
  "$(header access-control-allow-origin "$pre")" "$(header access-control-allow-methods "$pre")" \
  "$(header access-control-allow-headers "$pre")" "$pn"

# ---- 3. latency ------------------------------------------------------------------------------
times=""
i=0
while [ "$i" -lt "$n" ]; do
  t="$(curl -s -o /dev/null --max-time 10 -w '%{http_code} %{time_total}' "$base/project/sidepiece")" ||
    fail latency "request $((i + 1)) of $n: curl exited $?"
  code="${t%% *}"
  [ "$code" = 200 ] || fail latency "request $((i + 1)) of $n: HTTP $code"
  times="$times${t#* }
"
  i=$((i + 1))
done
stats="$(printf '%s' "$times" | sort -n | awk -v n="$n" '
  { v[NR] = $1 * 1000 }
  END {
    r50 = int((50 * n + 99) / 100); r95 = int((95 * n + 99) / 100)
    printf "p50=%.2f p95=%.2f n=%d\n", v[r50], v[r95], NR
  }')"
printf '%s\n' "$stats"
p95="$(printf '%s\n' "$stats" | awk '{ sub(/^p95=/, "", $2); print $2 }')"
awk -v p="$p95" 'BEGIN { exit !(p <= 1000) }' || fail latency "p95=${p95}ms is over 1000ms"
