#!/bin/sh
# The one lint entry point (mise `lint` and package.json `lint` both call this).
# Runs Biome (repo binary, cwd=root) AND the no-project-id SQL grep -- always
# both -- and exits non-zero if either failed. Usage: lint.sh [root]
set -u
repo="$(cd "$(dirname "$0")/.." && pwd)"
root="${1:-$repo}"
biome="$repo/node_modules/.bin/biome"
if [ ! -x "$biome" ]; then
  echo "lint.sh: biome not found at $biome (run pnpm install)" >&2
  exit 2
fi
rc=0
(cd "$root" && "$biome" check .) || rc=1
sh "$repo/lint/no-project-id-sql.sh" "$root" || rc=1
exit $rc
