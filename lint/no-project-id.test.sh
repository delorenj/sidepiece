#!/bin/sh
# Self-test for the no-project-id lint (architecture A-P1). Builds a throwaway
# tree in a temp dir (never touches the real boundary paths, which later
# stories occupy), runs the repo's Biome binary and the SQL grep against it,
# and asserts on exit codes, file:line and the exact message.
set -u
repo="$(cd "$(dirname "$0")/.." && pwd)"
biome="$repo/node_modules/.bin/biome"
msg="pjangler's identifier is 'pjid'; Plane's board UUID is 'boardId'. Rename at the boundary (architecture A-P1)."
# Not $TMPDIR: it may sit under a dotted dir, which biome.json's `!!**/.*` ignores.
tmp="$(mktemp -d /tmp/sidepiece-lint-selftest.XXXXXX)"
trap 'rm -rf "$tmp"' EXIT INT TERM

fails=0
pass() { printf 'ok   - %s\n' "$1"; }
fail() { printf 'FAIL - %s\n' "$1"; fails=$((fails + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }

# --- exception list in the real biome.json: exactly the two single-file negations
negs=$(grep -oE '"!packages/[^"]*"' "$repo/biome.json" | sort | tr '\n' ' ')
check "biome.json holds exactly the two negated boundary files" \
  "[ \"\$negs\" = '\"!packages/bridge/src/registry/client.ts\" \"!packages/bridge/src/tickets/plane.ts\" ' ]"

# --- fixture tree
cp "$repo/biome.json" "$tmp/biome.json"
sed -i 's#"\./node_modules/@biomejs/biome/configuration_schema.json"#"'"$repo"'/node_modules/@biomejs/biome/configuration_schema.json"#' "$tmp/biome.json"
cp -r "$repo/lint" "$tmp/lint"
b="$tmp/packages/bridge/src"
mkdir -p "$b/registry" "$b/tickets" "$b/other" "$tmp/packages/contract/data" "$tmp/packages/bridge/sql" "$tmp/_bmad-output"

violator() {
  cat > "$1" <<'TS'
export const projectId = 'a';
export function f(project_id: string): string {
  const projectSlug = project_id;
  console.log({ project_id: projectSlug });
  return JSON.stringify({ 'projectSlug': projectId });
}
TS
}
violator "$b/registry/index.ts"
violator "$b/other/third.ts"
violator "$b/tickets/plane.ts"
violator "$b/registry/client.ts"
printf '{ "project_id": "x" }\n' > "$tmp/packages/contract/data/x.json"
printf 'SELECT id\nFROM t WHERE project_id = 1;\n' > "$tmp/packages/bridge/sql/x.sql"
printf 'project_id projectId projectSlug\n' > "$tmp/_bmad-output/notes.sql"

# --- Biome
out="$tmp/biome.out"
(cd "$tmp" && "$biome" lint --max-diagnostics=none --colors=off . > "$out" 2>&1); rc=$?
check "biome exits non-zero on violators" "[ $rc -ne 0 ]"
check "exact message is printed" "grep -qF \"\$msg\" \"\$out\""
for spec in "registry/index.ts:1:14" "registry/index.ts:2:19" "registry/index.ts:3:9" \
            "registry/index.ts:4:17" "registry/index.ts:5:27" "other/third.ts:1:14"; do
  check "flagged packages/bridge/src/$spec" "grep -qE '^packages/bridge/src/$spec plugin' \"\$out\""
done
check "JSON key flagged (packages/contract/data/x.json:1:3)" \
  "grep -qE '^packages/contract/data/x.json:1:3 plugin' \"\$out\""
check "no plugin diagnostic for tickets/plane.ts" \
  "! grep -qE '^packages/bridge/src/tickets/plane.ts:[0-9]+:[0-9]+ plugin' \"\$out\""
check "no plugin diagnostic for registry/client.ts" \
  "! grep -qE '^packages/bridge/src/registry/client.ts:[0-9]+:[0-9]+ plugin' \"\$out\""

# --- SQL grep
sqlout=$(sh "$repo/lint/no-project-id-sql.sh" "$tmp"); rc=$?
check "SQL grep exits non-zero on packages/**/*.sql hit" "[ $rc -ne 0 ]"
check "SQL grep prints path:line: + exact message" \
  "[ \"\$sqlout\" = \"packages/bridge/sql/x.sql:2: \$msg\" ]"
check "SQL grep never scans _bmad-output/" "! printf '%s' \"\$sqlout\" | grep -q _bmad-output"
rm "$tmp/packages/bridge/sql/x.sql"
mkdir -p "$tmp/packages/bridge/node_modules/dep" && printf 'project_id\n' > "$tmp/packages/bridge/node_modules/dep/y.sql"
sh "$repo/lint/no-project-id-sql.sh" "$tmp" >/dev/null; rc=$?
check "SQL grep passes with no .sql files (node_modules ignored)" "[ $rc -eq 0 ]"

if [ "$fails" -ne 0 ]; then printf '%d assertion(s) failed\n' "$fails"; exit 1; fi
printf 'all assertions passed\n'
