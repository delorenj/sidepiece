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

# ---- test-file exclusions, one pattern each ----------------------------------------------
# *.test.* only: a src/ file (no /test/ dir in its path) named x.test.ts.
r="$(new_repo excl_dot_test)"
printf "const x = 'op://DeLoSecrets/Nope/dottest';\n" >"$r/packages/bridge/src/x.test.ts"
commit "$r"
if run_scan "$r"; then pass "*.test.* files are not scanned for references"; else
  fail "*.test.* files are not scanned for references: $(cat "$tmp/out")"
fi
# */test/* only: a helper under test/ whose name has no .test. in it.
r="$(new_repo excl_test_dir)"
printf "const x = 'op://DeLoSecrets/Nope/testdir';\n" >"$r/packages/bridge/test/helper.ts"
commit "$r"
if run_scan "$r"; then pass "*/test/* files are not scanned for references"; else
  fail "*/test/* files are not scanned for references: $(cat "$tmp/out")"
fi

# ---- missing .env.op -----------------------------------------------------------------------
r="$(new_repo noenv)"
rm "$r/.env.op"
commit "$r"
if run_scan "$r"; then fail "a missing .env.op fails"; else pass "a missing .env.op fails"; fi
grep -qx 'credential-scan: missing: .env.op' "$tmp/out" && pass "says missing: .env.op" ||
  fail "says missing: .env.op: $(cat "$tmp/out")"
grep -q 'ok' "$tmp/out" && fail "a missing .env.op is never reported clean" ||
  pass "a missing .env.op is never reported clean"

# ---- a line with no '=' --------------------------------------------------------------------
r="$(new_repo noeq)"
printf 'pasted-secret-looking-line-4c2e\n' >>"$r/.env.op"
commit "$r"
if run_scan "$r"; then fail "a no-= line fails"; else pass "a no-= line fails"; fi
grep -qx 'credential-scan: not_a_reference: line 5' "$tmp/out" && pass "names the line number" ||
  fail "names the line number: $(cat "$tmp/out")"
grep -q 'pasted-secret-looking-line-4c2e' "$tmp/out" && fail "the line's text is never printed" ||
  pass "the line's text is never printed"

# ---- not a git work tree -------------------------------------------------------------------
r="$tmp/norepo"
mkdir -p "$r"
cp "$tmp/clean/.env.op" "$r/.env.op"
# TMPDIR may itself sit inside some repo: stop git's discovery at the temp dir.
if GIT_CEILING_DIRECTORIES="$tmp" run_scan "$r"; then fail "a non-repo root fails"; else
  pass "a non-repo root fails"
fi
grep -q '^credential-scan: not_a_repo: ' "$tmp/out" && pass "says not_a_repo" ||
  fail "says not_a_repo: $(cat "$tmp/out")"

# ---- --shape-only --------------------------------------------------------------------------
# No op anywhere: PATH holds only a dir without op, and OP_BIN points at nothing.
nobin="$tmp/nobin"
mkdir -p "$nobin"
for tool in bash git grep sort tr; do ln -sf "$(command -v "$tool")" "$nobin/$tool"; done
shape() { PATH="$nobin" OP_BIN=/nonexistent/op "$nobin/bash" "$scan" --shape-only "$1" >"$tmp/out" 2>&1; }
if shape "$tmp/clean"; then pass "--shape-only passes a clean .env.op with no op"; else
  fail "--shape-only passes a clean .env.op with no op: $(cat "$tmp/out")"
fi
grep -q 'shape only: 2 reference(s)' "$tmp/out" && pass "--shape-only counts references" ||
  fail "--shape-only counts references: $(cat "$tmp/out")"
if shape "$tmp/notref"; then fail "--shape-only fails a non-reference"; else
  pass "--shape-only fails a non-reference"
fi
grep -qx 'credential-scan: not_a_reference: PLANE_BASE_URL' "$tmp/out" &&
  pass "--shape-only names the key" || fail "--shape-only names the key: $(cat "$tmp/out")"
if shape "$tmp/unresolvable"; then pass "--shape-only never resolves (unresolvable ref passes)"; else
  fail "--shape-only never resolves: $(cat "$tmp/out")"
fi

if ((fails > 0)); then
  printf '%d failure(s)\n' "$fails"
  exit 1
fi
echo "credential-scan selftest: all passed"
