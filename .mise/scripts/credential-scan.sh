#!/usr/bin/env bash
# credential-scan (Story 1.12): prove `.env.op` holds only op:// references, and that no tracked
# file holds a resolved credential value.
#
#   Usage: credential-scan.sh [--shape-only] [repo-root]
#
#   1. every assignment in .env.op must be KEY=op://DeLoSecrets/<item>/<field>
#   2. collect every distinct op://DeLoSecrets/... reference from .env.op and from tracked
#      packages/** source files (test files excluded)
#   3. resolve each with `${OP_BIN:-op} read --no-newline`; a value found in any tracked file
#      fails (the value itself is never printed)
#   4. a reference that does not resolve fails
#
# --shape-only runs step 1 alone: offline, no op, no git.
# Every failure is one line: `credential-scan: <code>: <detail>`. Exit 1 if any. A line of
# .env.op is never echoed: a malformed one could be a pasted secret.
set -euo pipefail

shape_only=0
if [[ "${1:-}" == --shape-only ]]; then
  shape_only=1
  shift
fi

fails=0
fail() {
  printf 'credential-scan: %s\n' "$1" >&2
  fails=$((fails + 1))
}
die() {
  printf 'credential-scan: %s\n' "$1" >&2
  exit 1
}

if [[ $# -gt 0 ]]; then
  root="$1"
elif ((shape_only)); then
  root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
else
  root="$(git rev-parse --show-toplevel 2>/dev/null)" || die "not_a_repo: $(pwd)"
fi
cd "$root" || die "not_a_repo: ${root}"
if ((!shape_only)) && [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" != true ]]; then
  die "not_a_repo: ${root}"
fi

op_bin="${OP_BIN:-op}"
env_op=".env.op"
[[ -f "$env_op" ]] || die "missing: ${env_op}"

declare -A refs=()

# ---- 1. .env.op holds only references ------------------------------------------------------
n=0
while IFS= read -r line || [[ -n "$line" ]]; do
  n=$((n + 1))
  trimmed="${line#"${line%%[![:space:]]*}"}"
  [[ -z "$trimmed" || "$trimmed" == \#* ]] && continue
  if [[ "$trimmed" =~ ^[A-Z_][A-Z0-9_]*=op://DeLoSecrets/[^/]+/[^/]+$ ]]; then
    refs["${trimmed#*=}"]=1
  elif [[ "$trimmed" == *=* && "${trimmed%%=*}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    fail "not_a_reference: ${trimmed%%=*}"
  else
    # No usable KEY= prefix: name the line, never its text.
    fail "not_a_reference: line ${n}"
  fi
done <"$env_op"

if ((shape_only)); then
  ((fails > 0)) && exit 1
  printf 'credential-scan: ok (shape only: %d reference(s) in .env.op)\n' "${#refs[@]}"
  exit 0
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
while IFS= read -r ref; do
  [[ -n "$ref" ]] || continue
  if ! value="$("$op_bin" read --no-newline "$ref" 2>/dev/null)" || [[ -z "$value" ]]; then
    fail "unresolvable: ${ref}"
    continue
  fi
  # The value goes in as a pattern file (never argv), and only file names come back.
  # git grep: 0 = hits, 1 = no match, anything else = the search itself failed.
  rc=0
  hits="$(git grep -F -l -z -f <(printf '%s\n' "$value") 2>/dev/null | tr '\0' ' ')" || rc=$?
  unset value
  if ((rc == 0)) && [[ -n "${hits// /}" ]]; then
    fail "resolved_value_tracked: ${ref} in ${hits% }"
  elif ((rc > 1)); then
    fail "grep_failed: ${ref}"
  fi
done < <(printf '%s\n' "${!refs[@]}" | sort)

if ((fails > 0)); then
  exit 1
fi
printf 'credential-scan: ok (%d reference(s), .env.op clean, no resolved value tracked)\n' "${#refs[@]}"
