#!/bin/sh
# no-project-id (SQL) -- architecture A-P1. Biome does not parse .sql, so this
# greps packages/**/*.sql (never node_modules, never _bmad-output/) for the
# banned names. Usage: no-project-id-sql.sh [root]  (default: repo root)
set -u
root="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
msg="pjangler's identifier is 'pjid'; Plane's board UUID is 'boardId'. Rename at the boundary (architecture A-P1)."
[ -d "$root/packages" ] || exit 0
hits=$(cd "$root" && grep -rnE --include='*.sql' --exclude-dir=node_modules 'project_id|projectId|projectSlug' packages 2>/dev/null)
[ -z "$hits" ] && exit 0
printf '%s\n' "$hits" | while IFS= read -r line; do
  printf '%s: %s\n' "$(printf '%s' "$line" | cut -d: -f1-2)" "$msg"
done
exit 1
