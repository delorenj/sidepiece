#!/usr/bin/env bash
# Self-test for credential-scan.sh (Story 1.12). Each case builds a throwaway git repo in a temp
# dir and a fake `op` (OP_BIN) that resolves from a fixed table. It never calls the real vault.
set -u
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
scan="$here/credential-scan.sh"

tmp="$(mktemp -d "${TMPDIR:-/tmp}/sidepiece-credscan-selftest.XXXXXX")" || exit 1
[[ -n "$tmp" && -d "$tmp" ]] || exit 1
trap 'rm -rf "$tmp"' EXIT
trap 'rm -rf "$tmp"; exit 130' INT TERM

fails=0
pass() { printf 'ok   - %s\n' "$1"; }
fail() {
  printf 'FAIL - %s\n' "$1"
  fails=$((fails + 1))
}

# Fake values, not secrets.
PLANE_VALUE="fake-plane-value-9f3a"
ROUTER_VALUE="fake-router-value-77c1"

fake_op="$tmp/op"
cat >"$fake_op" <<SH
#!/bin/sh
[ "\$1" = read ] && [ "\$2" = --no-newline ] || exit 2
case "\$3" in
  op://DeLoSecrets/Plane/apiKey) printf '%s' '$PLANE_VALUE' ;;
  op://DeLoSecrets/openrouter/OpenCode) printf '%s' '$ROUTER_VALUE' ;;
  *) echo "[ERROR] could not read secret '\$3': item not found" >&2; exit 1 ;;
esac
SH
chmod +x "$fake_op"

# new_repo <name>: a git repo with a clean .env.op and a source file referencing the Plane key.
new_repo() {
  local r="$tmp/$1"
  mkdir -p "$r/packages/bridge/src" "$r/packages/bridge/test"
  git -C "$r" init -q
  cat >"$r/.env.op" <<'EOF'
# comment
PLANE_API_KEY=op://DeLoSecrets/Plane/apiKey

OPENROUTER_API_KEY=op://DeLoSecrets/openrouter/OpenCode
EOF
  printf "export const REF = 'op://DeLoSecrets/Plane/apiKey';\n" >"$r/packages/bridge/src/vault.ts"
  # Test files are excluded from reference collection: this one would be unresolvable.
  printf "const x = 'op://DeLoSecrets/Nope/none';\n" >"$r/packages/bridge/test/x.test.ts"
  printf '%s\n' "$r"
}
# Throwaway fixture repos with fake values: the machine-wide git guards are not in play here.
commit() {
  git -C "$1" add -A &&
    git -C "$1" -c core.hooksPath=/dev/null -c user.email=t@t -c user.name=t commit -qm x
}
run_scan() { OP_BIN="$fake_op" bash "$scan" "$1" >"$tmp/out" 2>&1; }

# ---- clean ---------------------------------------------------------------------------------
r="$(new_repo clean)"
commit "$r"
if run_scan "$r"; then pass "clean repo exits 0"; else fail "clean repo exits 0: $(cat "$tmp/out")"; fi
grep -q 'credential-scan: ok (2 reference(s)' "$tmp/out" && pass "clean repo counts 2 distinct references" ||
  fail "clean repo counts 2 distinct references: $(cat "$tmp/out")"

# ---- not a reference -----------------------------------------------------------------------
r="$(new_repo notref)"
printf 'PLANE_BASE_URL=https://plane.delo.sh\n' >>"$r/.env.op"
commit "$r"
if run_scan "$r"; then fail "a non-reference value fails"; else pass "a non-reference value fails"; fi
grep -qx 'credential-scan: not_a_reference: PLANE_BASE_URL' "$tmp/out" &&
  pass "names the key: not_a_reference: PLANE_BASE_URL" || fail "names the key: $(cat "$tmp/out")"
grep -q 'plane.delo.sh' "$tmp/out" && fail "the non-reference value is not echoed" ||
  pass "the non-reference value is not echoed"

# ---- tracked resolved value ----------------------------------------------------------------
r="$(new_repo leak)"
printf 'api_key: %s\n' "$PLANE_VALUE" >"$r/leaked-config.txt"
commit "$r"
if run_scan "$r"; then fail "a tracked resolved value fails"; else pass "a tracked resolved value fails"; fi
grep -qx 'credential-scan: resolved_value_tracked: op://DeLoSecrets/Plane/apiKey in leaked-config.txt' "$tmp/out" &&
  pass "names the ref and the file" || fail "names the ref and the file: $(cat "$tmp/out")"
grep -q "$PLANE_VALUE" "$tmp/out" && fail "the value is never printed" || pass "the value is never printed"

# ---- unresolvable reference ----------------------------------------------------------------
r="$(new_repo unresolvable)"
printf "export const GONE = 'op://DeLoSecrets/Missing/field';\n" >"$r/packages/bridge/src/gone.ts"
commit "$r"
if run_scan "$r"; then fail "an unresolvable reference fails"; else pass "an unresolvable reference fails"; fi
grep -qx 'credential-scan: unresolvable: op://DeLoSecrets/Missing/field' "$tmp/out" &&
  pass "names the unresolvable ref" || fail "names the unresolvable ref: $(cat "$tmp/out")"
grep -q 'Nope/none' "$tmp/out" && fail "test files are not scanned for references" ||
  pass "test files are not scanned for references"

if ((fails > 0)); then
  printf '%d failure(s)\n' "$fails"
  exit 1
fi
echo "credential-scan selftest: all passed"
