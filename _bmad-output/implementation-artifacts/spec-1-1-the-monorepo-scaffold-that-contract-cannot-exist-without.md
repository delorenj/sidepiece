---
title: 'Story 1.1: The monorepo scaffold that contract/ cannot exist without'
type: 'chore'
created: '2026-09-23'
status: 'in-progress'
baseline_revision: 'bf1e6c05953892f39d550c1495c9fc7609c9a3bb'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `contract/` must be a real workspace package imported by both the Bridge and (later) the extension, but the repo has no workspace, no TypeScript base, no linter and no build tasks — so it cannot exist yet.

**Approach:** Lay down a pnpm workspace with two packages (`@sidepiece/contract`, `@sidepiece/bridge`), a strict shared `tsconfig.base.json`, a root-scoped Biome config, and `mise` tasks (`build`, `typecheck`, `lint`, `format`, `test`) that are the whole pipeline. Add `DEFINITION-OF-DONE.md` with the four human-checked items.

## Boundaries & Constraints

**Always:**
- Root `package.json`: `"private": true`, a `scripts` block, no `dependencies` key; `devDependencies` exactly `typescript` `6.0.3`, `@biomejs/biome` `2.5.14`, `tsup` `8.5.1` — exact pins, no `^`/`~`.
- `tsconfig.base.json` sets `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` (all true), `module`/`moduleResolution` `nodenext`, `target` `es2023`. Package tsconfigs `extend` it and redeclare none of those five.
- Packages are ESM (`"type": "module"`); relative imports carry `.js` extensions (nodenext).
- `@sidepiece/contract` `exports` resolve `types` to `./src/index.ts` (so typecheck never needs a prior build) and `import` to `./dist/index.js`.
- The Bridge imports from `@sidepiece/contract` (`workspace:*`) so the link is proven by `tsc`, not asserted.
- Biome only scans `packages/**` and root config files — never `_bmad*`, `agents/`, `docs/`, dot-dirs.
- `build` declares `depends = ["typecheck", "lint"]`.

**Block If:** none anticipated.

**Never:**
- Create `packages/extension/` or `packages/ui/`; run `wxt` or `shadcn` (Epic 2).
- Add a `.github/` directory, CI workflow, or any GitHub Actions.
- Implement the `project_id` lint ban (Story 1.2) or the DsCode taxonomy / Project Record (Story 1.3).
- Use TypeScript 7 (native port; no JS API for tsup/WXT tooling).

</intent-contract>

## Code Map

- `mise.toml` -- existing; keep `[tools]`, `[env]`, hooks, `link:agentfiles`, `skills:sync` and the managed `mise-versioning` block untouched. Append the five new tasks outside the managed block.
- `.gitignore` -- existing; already ignores `node_modules`, `dist`. Add `.github/` so BMAD Copilot re-installs never re-enter the repo (global `~/.config/git/ignore:150` already ignores `.github/agents/`, but those files were tracked before it).
- `.github/agents/*.agent.md` -- tracked BMAD Copilot agent personas; violate the "no `.github/` anywhere" AC. Remove from index and disk.
- `~/.local/bin/pnpm` -- machine-level stale symlink to Debian corepack `pnpm.js` that crashes (`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`) and shadows mise's working `pnpm` 11.5.0 even under `mise exec`. Remove it (outside repo; recreate with `ln -s` if ever wanted).
- `.mise/scripts/versioning.sh` -- will discover the new `package.json` files; no change needed.

## Tasks & Acceptance

**Execution:**
- `~/.local/bin/pnpm` -- delete stale corepack symlink -- `pnpm install` must work from the repo root.
- `.github/` -- `git rm -r` + delete, and add `.github/` to `.gitignore` -- AC: no `.github/` anywhere.
- `pnpm-workspace.yaml` -- `packages: ['packages/*']` -- workspace declaration.
- `package.json` -- private root, scripts only, pinned toolchain devDeps -- AR3.
- `tsconfig.base.json` -- the five strict/module options plus sane shared defaults (`skipLibCheck`, `isolatedModules`, `verbatimModuleSyntax`, `esModuleInterop`, `forceConsistentCasingInFileNames`) -- one strict base.
- `biome.json` -- recommended lint + formatter, `files.includes` scoped to `packages/**` and root json -- AR3.
- `packages/contract/{package.json,tsconfig.json,src/index.ts}` -- `@sidepiece/contract`, exports `CONTRACT_VERSION = 1` placeholder; `build` = `tsup src/index.ts --format esm --clean` -- the package everything imports.
- `packages/bridge/{package.json,tsconfig.json,tsup.config.ts,src/index.ts}` -- `@sidepiece/bridge`, depends on `@sidepiece/contract: workspace:*`, devDep `@types/node` `24.13.6`; entry logs the imported `CONTRACT_VERSION`; tsup bundles to `dist/bridge.mjs` with `contract` inlined (`noExternal`) and `node:*` external -- proves the cross-package import.
- `mise.toml` -- tasks `typecheck` (`pnpm -r run typecheck` → `tsc --noEmit` per package), `lint` (`biome check .`), `format` (`biome check --write .`), `test` (`pnpm -r --if-present run test`), `build` (`pnpm -r run build`, depends typecheck+lint).
- `DEFINITION-OF-DONE.md` -- exactly four checklist items: generation check before capability on mutating routes; new failure mode = `DsCode` + `EXPERIENCE.md` row in the same change, never free text; new user-facing string exists in `EXPERIENCE.md` and lands in `copy/states.ts`, `copy/progress.ts` or `copy/icon.ts`; no Glossary term appears under a synonym -- AR15.

**Acceptance Criteria:**
- Given a fresh clone, when `pnpm install && mise run build` runs from root, then it exits 0 and exactly `packages/contract/` and `packages/bridge/` exist, with no `packages/extension/` or `packages/ui/`.
- Given `mise run typecheck`, when run, then `tsc --noEmit` runs over both packages and exits 0.
- Given a file under `packages/` containing `const  x   =1`, when `mise run lint` runs, then it exits non-zero naming that file and line; after `mise run format`, `mise run lint` exits 0.
- Given `mise tasks`, when run, then `build`, `typecheck`, `lint`, `format`, `test` are listed and `build` depends on `typecheck` and `lint`.
- Given the repo, when searched, then no `.github/` directory exists.
- Given `node packages/bridge/dist/bridge.mjs`, when run after build, then it prints the contract version (proves inlined workspace import).

## Spec Change Log

## Review Triage Log

## Design Notes

`contract` points its `types` export at source rather than `dist/*.d.ts`: `build` depends on `typecheck`, so typecheck cannot require a prior build. The Bridge bundle inlines `contract` because the future rsync deploy (Story 1.10) cannot carry pnpm's workspace symlink.

TypeScript is pinned to 6.0.3, the last JS-API release; 7.x is the native port and breaks tsup's dts path and WXT tooling.

## Verification

**Commands:**
- `pnpm install && mise run build` -- expected: exit 0
- `mise run typecheck && mise run test` -- expected: exit 0
- `printf 'const  x   =1\n' > packages/contract/src/bad.ts && mise run lint` -- expected: non-zero, names `packages/contract/src/bad.ts`; then `mise run format && mise run lint` exits 0; delete the file.
- `mise tasks` -- expected: the five tasks listed
- `node packages/bridge/dist/bridge.mjs` -- expected: prints contract version
- `find . -name .github -not -path './node_modules/*'` -- expected: no output
