#!/bin/sh
# Self-test for the no-project-id lint (architecture A-P1). Builds throwaway
# trees in a temp dir (never touches the real boundary paths, which later
# stories occupy), runs the repo's Biome binary, the SQL grep and the real
# entry point lint/lint.sh against them, and asserts exit codes, file:line:col
# and the exact message.
set -u
repo="$(cd "$(dirname "$0")/.." && pwd)"
biome="$repo/node_modules/.bin/biome"
msg="pjangler's identifier is 'pjid'; Plane's board UUID is 'boardId'. Rename at the boundary (architecture A-P1)."
if [ ! -x "$biome" ]; then
  echo "no-project-id.test.sh: biome not found at $biome (run pnpm install)" >&2
  exit 1
fi
# Not $TMPDIR: it may sit under a dotted dir, which biome.json's `!!**/.*` ignores.
tmp="$(mktemp -d /tmp/sidepiece-lint-selftest.XXXXXX)" || exit 1
[ -n "$tmp" ] && [ -d "$tmp" ] || exit 1
trap 'rm -rf "$tmp"' EXIT
trap 'rm -rf "$tmp"; exit 130' INT TERM

fails=0
pass() { printf 'ok   - %s\n' "$1"; }
fail() { printf 'FAIL - %s\n' "$1"; fails=$((fails + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

# expect_at <tree> <rel-file> <line> <token> <what>: a plugin diagnostic at the
# token's 1-based column on that line (column computed from the fixture itself).
expect_at() {
  col=$(sed -n "${3}p" "$1/$2" | awk -v t="$4" '{ print index($0, t) }')
  if [ "${col:-0}" -gt 0 ] && grep -qE "^$2:$3:$col plugin" "$1/biome.out"; then
    pass "$5 ($2:$3:$col)"
  else
    fail "$5 ($2:$3:${col:-?})"
  fi
}
no_plugin() {
  check "$3" "! grep -qE '^$2:[0-9]+:[0-9]+ plugin' \"$1/biome.out\""
}

# mktree <dir>: a skeleton with the real biome.json and lint/ copied in.
mktree() {
  mkdir -p "$1/packages/bridge/src/registry" "$1/packages/bridge/src/tickets" \
    "$1/packages/bridge/src/other" "$1/packages/contract/data" "$1/packages/bridge/sql"
  sed 's#"\./node_modules/@biomejs/biome/configuration_schema.json"#"'"$repo"'/node_modules/@biomejs/biome/configuration_schema.json"#' \
    "$repo/biome.json" > "$1/biome.json"
  cp -r "$repo/lint" "$1/lint"
}
# Biome-clean (formatted, recommended-clean) fixtures, used by the lint.sh runs.
boundary() {
  cat > "$1" <<'TS'
export function renameOnRead(raw: { project_id: string }): { pjid: string } {
  return { pjid: raw.project_id };
}
TS
}
clean() {
  cat > "$1" <<'TS'
export const pjid = 'a';
export const boardId = 'b';
export const project = { pjid, boardId };
export const projects = [project];
TS
}

# --- exception list in the real biome.json: exactly the two single-file negations
negs=$(grep -oE '"!packages/[^"]*"' "$repo/biome.json" | sort | tr '\n' ' ')
check "biome.json holds exactly the two negated boundary files" \
  "[ \"\$negs\" = '\"!packages/bridge/src/registry/client.ts\" \"!packages/bridge/src/tickets/plane.ts\" ' ]"

# ============ Tree A: every node kind, via biome lint ============
A="$tmp/a"; mktree "$A"; b="$A/packages/bridge/src"
cat > "$b/registry/index.ts" <<'TS'
export const projectId = 'a';
let q = 0; q = 1; projectSlug = q;
const o = { a: 1 }; o.projectId;
const s = 'select project_id from t';
const t = `x project_id ${s}`;
class C {
  #projectSlug = 1;
  m() { return this.#projectSlug; }
}
type ProjectId = string;
const PROJECT_ID = 1;
console.log({ project_id: 1 });
function getProjectId(): ProjectId { return String(PROJECT_ID + t + C); }
TS
cat > "$b/other/view.tsx" <<'TSX'
export const V = () => <div title="project-id">projectSlug</div>;
export const W = () => <projectId />;
TSX
printf 'export const projectId = %s;\n' "'a'" > "$b/other/third.ts"
cp "$b/registry/index.ts" "$b/tickets/plane.ts"
cp "$b/registry/index.ts" "$b/registry/client.ts"
clean "$b/other/clean.ts"
printf '{ "project_id": "x", "k": "PROJECT-SLUG", "ok": "pjid" }\n' > "$A/packages/contract/data/x.json"

(cd "$A" && "$biome" lint --max-diagnostics=none --colors=off . > "$A/biome.out" 2>&1); rc=$?
check "biome exits non-zero on violators" "[ $rc -ne 0 ]"
check "exact message is printed" "grep -qF \"\$msg\" \"\$A/biome.out\""
R=packages/bridge/src/registry/index.ts
expect_at "$A" $R 1 "projectId" "binding"
expect_at "$A" $R 2 "projectSlug" "assignment target"
expect_at "$A" $R 3 "projectId" "member name obj.projectId"
expect_at "$A" $R 4 "'select project_id" "plain string"
expect_at "$A" $R 5 "x project_id" "template chunk"
expect_at "$A" $R 7 "#projectSlug" "private class member"
expect_at "$A" $R 8 "#projectSlug" "private name access"
expect_at "$A" $R 10 "ProjectId" "type alias, PascalCase"
expect_at "$A" $R 11 "PROJECT_ID" "UPPER_CASE"
expect_at "$A" $R 12 "project_id" "log key"
expect_at "$A" $R 13 "getProjectId" "camelCase prefix"
V=packages/bridge/src/other/view.tsx
expect_at "$A" $V 1 '"project-id"' "JSX string, kebab-case"
expect_at "$A" $V 1 "projectSlug<" "JSX text"
expect_at "$A" $V 2 "projectId" "JSX tag name"
expect_at "$A" packages/bridge/src/other/third.ts 1 "projectId" "third path"
J=packages/contract/data/x.json
expect_at "$A" $J 1 '"project_id"' "JSON key"
expect_at "$A" $J 1 '"PROJECT-SLUG"' "JSON string value"
check "JSON: exactly two plugin diagnostics (clean value not flagged)" \
  "[ \$(grep -cE '^$J:[0-9]+:[0-9]+ plugin' \"\$A/biome.out\") -eq 2 ]"
no_plugin "$A" packages/bridge/src/other/clean.ts "negative fixture (pjid, boardId, project, projects) is clean"
no_plugin "$A" packages/bridge/src/tickets/plane.ts "no plugin diagnostic for tickets/plane.ts"
no_plugin "$A" packages/bridge/src/registry/client.ts "no plugin diagnostic for registry/client.ts"

# ============ SQL grep ============
S="$tmp/s"; mkdir -p "$S/packages/bridge/sql" "$S/_bmad-output"
printf 'SELECT id\nFROM t WHERE project_id = 1;\n' > "$S/packages/bridge/sql/x.sql"
printf 'select 1;\nselect PROJECT-ID;\n' > "$S/packages/bridge/sql/y.SQL"
printf 'project_id projectId projectSlug\n' > "$S/_bmad-output/notes.sql"
sqlout=$(sh "$repo/lint/no-project-id-sql.sh" "$S"); rc=$?
check "SQL grep exits 1 on packages/**/*.sql hit" "[ $rc -eq 1 ]"
check "SQL grep prints path:line: + exact message" \
  "printf '%s\n' \"\$sqlout\" | grep -qxF \"packages/bridge/sql/x.sql:2: \$msg\""
check "SQL grep is case-insensitive and covers *.SQL" \
  "printf '%s\n' \"\$sqlout\" | grep -qxF \"packages/bridge/sql/y.SQL:2: \$msg\""
check "SQL grep never scans _bmad-output/" "! printf '%s' \"\$sqlout\" | grep -q _bmad-output"
rm "$S/packages/bridge/sql/x.sql" "$S/packages/bridge/sql/y.SQL"
mkdir -p "$S/packages/bridge/node_modules/dep" && printf 'project_id\n' > "$S/packages/bridge/node_modules/dep/y.sql"
sh "$repo/lint/no-project-id-sql.sh" "$S" >/dev/null; rc=$?
check "SQL grep exits 0 with no .sql files (node_modules ignored)" "[ $rc -eq 0 ]"
mkdir -p "$tmp/empty"
sh "$repo/lint/no-project-id-sql.sh" "$tmp/empty" >/dev/null 2>&1; rc=$?
check "SQL grep exits 2 when an explicit root has no packages/" "[ $rc -eq 2 ]"

# ============ Tree B: the real entry point, lint/lint.sh ============
B="$tmp/b"; mktree "$B"; b="$B/packages/bridge/src"
boundary "$b/tickets/plane.ts"
boundary "$b/registry/client.ts"
clean "$b/other/clean.ts"
sh "$repo/lint/lint.sh" "$B" > "$tmp/lintb.out" 2>&1; rc=$?
check "lint.sh exits 0 with only boundary + clean fixtures" "[ $rc -eq 0 ]"
[ "$rc" -eq 0 ] || cat "$tmp/lintb.out"
printf 'export const projectId = %s;\n' "'a'" > "$b/other/third.ts"
sh "$repo/lint/lint.sh" "$B" > "$tmp/lintb.out" 2>&1; rc=$?
check "lint.sh exits non-zero once the third-path violator exists" "[ $rc -ne 0 ]"
check "lint.sh names the third path and the message" \
  "grep -q 'packages/bridge/src/other/third.ts:1:14 plugin' \"\$tmp/lintb.out\" && grep -qF \"\$msg\" \"\$tmp/lintb.out\""
rm "$b/other/third.ts"
printf 'select project_id;\n' > "$B/packages/bridge/sql/x.sql"
sh "$repo/lint/lint.sh" "$B" > "$tmp/lintb.out" 2>&1; rc=$?
check "lint.sh exits non-zero on a packages/**/*.sql hit alone" "[ $rc -ne 0 ]"
check "lint.sh prints the SQL hit" \
  "grep -qxF \"packages/bridge/sql/x.sql:1: \$msg\" \"\$tmp/lintb.out\""

if [ "$fails" -ne 0 ]; then printf '%d assertion(s) failed\n' "$fails"; exit 1; fi
printf 'all assertions passed\n'
