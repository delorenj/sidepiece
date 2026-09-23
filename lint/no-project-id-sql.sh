#!/bin/sh
# no-project-id (SQL) -- architecture A-P1. Biome does not parse SQL, so this
# greps packages/**/*.sql and *.SQL (never node_modules, never _bmad-output/)
# case-insensitively for project[_-]?id / project[_-]?slug, the same form as
# the Grit rule. Usage: no-project-id-sql.sh [root]  (default: repo root)
# Exit: 0 clean, 1 hit, 2 error (grep failure, or explicit root lacks packages/).
set -u
root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
msg="pjangler's identifier is 'pjid'; Plane's board UUID is 'boardId'. Rename at the boundary (architecture A-P1)."
if [ ! -d "$root/packages" ]; then
  echo "no-project-id-sql.sh: no packages/ directory under '$root'" >&2
  exit 2
fi
hits=$(cd "$root" && grep -rniE --include='*.sql' --include='*.SQL' --exclude-dir=node_modules \
  'project[_-]?id|project[_-]?slug' packages)
grc=$?
if [ "$grc" -gt 1 ]; then
  echo "no-project-id-sql.sh: grep failed (exit $grc) under '$root/packages'" >&2
  exit 2
fi
[ -z "$hits" ] && exit 0
printf '%s\n' "$hits" | while IFS= read -r line; do
  printf '%s: %s\n' "$(printf '%s' "$line" | cut -d: -f1-2)" "$msg"
done
exit 1
