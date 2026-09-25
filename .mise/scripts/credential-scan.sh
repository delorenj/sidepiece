#!/usr/bin/env bash
# credential-scan (Story 1.12): prove `.env.op` holds only op:// references, and that no tracked
# file holds a resolved credential value. Usage: credential-scan.sh [repo-root]
#
#   1. every assignment in .env.op must be KEY=op://DeLoSecrets/<item>/<field>
#   2. collect every distinct op://DeLoSecrets/... reference from .env.op and from tracked
#      packages/** source files (test files excluded)
#   3. resolve each with `${OP_BIN:-op} read --no-newline`; a value found in any tracked file
#      fails (the value itself is never printed)
#   4. a reference that does not resolve fails
#
# Every failure is one line: `credential-scan: <code>: <detail>`. Exit 1 if any.
set -euo pipefail

root="${1:-$(git rev-parse --show-toplevel)}"
cd "$root"
op_bin="${OP_BIN:-op}"
env_op=".env.op"
fails=0
fail() {
  printf 'credential-scan: %s\n' "$1" >&2
  fails=$((fails + 1))
}

declare -A refs=()

# ---- 1. .env.op holds only references ------------------------------------------------------
if [[ -f "$env_op" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    trimmed="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue
    key="${trimmed%%=*}"
    if [[ "$trimmed" =~ ^[A-Z_][A-Z0-9_]*=op://DeLoSecrets/[^/]+/[^/]+$ ]]; then
      refs["${trimmed#*=}"]=1
    else
      fail "not_a_reference: ${key}"
    fi
  done <"$env_op"
fi

# ---- 2. references in tracked packages/** source ---------------------------------------------
ref_re='op://DeLoSecrets/[^/[:space:]<>"'"'"'`,()]+/[^/[:space:]<>"'"'"'`,()]+'
while IFS= read -r -d '' file; do
  case "$file" in
    *.test.* | */test/* | *.md) continue ;;
  esac
  [[ -f "$file" ]] || continue
  while IFS= read -r ref; do
    [[ -n "$ref" ]] && refs["$ref"]=1
  done < <(grep -ohE "$ref_re" -- "$file" || true)
done < <(git ls-files -z -- packages)

# ---- 3 + 4. resolve each, and look for its value in every tracked file ---------------------
for ref in $(printf '%s\n' "${!refs[@]}" | sort); do
  if ! value="$("$op_bin" read --no-newline "$ref" 2>/dev/null)" || [[ -z "$value" ]]; then
    fail "unresolvable: ${ref}"
    continue
  fi
  # The value goes in as a pattern file (never argv), and only file names come back.
  hits="$(git grep -F -l -z -f <(printf '%s\n' "$value") 2>/dev/null | tr '\0' ' ' || true)"
  unset value
  if [[ -n "${hits// /}" ]]; then
    fail "resolved_value_tracked: ${ref} in ${hits% }"
  fi
done

if ((fails > 0)); then
  exit 1
fi
printf 'credential-scan: ok (%d reference(s), .env.op clean, no resolved value tracked)\n' "${#refs[@]}"
