---
title: 'Story 1.2: The lint that makes project_id impossible to reintroduce'
type: 'chore'
created: '2026-09-23'
status: 'in-progress'
baseline_revision: 'e0e7838da0bd47e1de81a40cce52a1f1477bf79f'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** Nothing stops `project_id`, `projectId` or `projectSlug` from reaching the code, where a pjangler slug and a Plane board UUID are both plain strings. Architecture A-P1 says the pjangler identifier is always `pjid` and a Plane project is `boardId`.

**Approach:** Add a Biome GritQL plugin (JS/TS and JSON) that flags the three names with one exact message. It is attached through a `biome.json` override whose includes negate exactly the two boundary files. Extend `mise run lint` with a scoped grep of `packages/**/*.sql`, and record the two names the lint cannot cover in `DEFINITION-OF-DONE.md` item 4.

## Boundaries & Constraints

**Always:**
- The message is exactly: `pjangler's identifier is 'pjid'; Plane's board UUID is 'boardId'. Rename at the boundary (architecture A-P1).` This applies to Biome and to the SQL grep.
- The rule fires on any identifier (binding, reference, member name, assignment target, type member, export name), on string and template literals (JSON key literals, log keys, SQL-in-strings), and on JSON member names under `packages/`.
- The per-path exception list has exactly two entries: `!packages/bridge/src/tickets/plane.ts` and `!packages/bridge/src/registry/client.ts`. Both are full single-file paths.
- The SQL grep scans only `packages/` (excluding `node_modules`), so `_bmad-output/` is never scanned.
- A rule comment names `project` and a bare `id` as deliberately uncovered, because they are too generic to lint mechanically.
- The self-test runs in a temp directory and never writes to the real boundary paths, which later stories occupy.

**Block If:** none anticipated.

**Never:**
- Use the plugin-level `includes` for the exceptions. Biome 2.5.14 matches those globs against absolute paths, so a root-relative negation silently does nothing (verified).
- Create the real `tickets/plane.ts` or `registry/client.ts`. That is Stories 1.6/1.9/2.19.
- Add CI or a `.github/` directory.
- Edit `sprint-status.yaml`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Banned identifier | `packages/bridge/src/registry/index.ts` has `const projectId` | lint non-zero, `path:line:col plugin` + exact message | — |
| Other names/layers | `project_id` object key, `'projectSlug'` string, `{ project_id: x }` log key, local var | each flagged | — |
| Boundary files | same content at `tickets/plane.ts` / `registry/client.ts` | no plugin diagnostic | — |
| JSON | `packages/**/x.json` key `"project_id"` | flagged | — |
| SQL | `packages/**/x.sql` contains `project_id` | lint non-zero, `path:line:` + message | no `.sql` files → pass |
| Outside packages | `_bmad-output/**` quoting names | never scanned | — |

</intent-contract>

## Code Map

- `biome.json` -- existing root config: `files.includes` covers `packages/**` and root `*.json`, `linter.rules.preset: recommended`. Add an `overrides` entry that attaches the plugins, and no top-level `plugins`.
- `mise.toml:84-86` -- `[tasks.lint]` currently runs `pnpm exec biome check .`. It must also run the SQL grep, run both checks, and fail if either fails. `[tasks.test]` is at 92-94.
- `package.json` -- root `scripts.lint` mirrors the mise task (`biome check .`). Keep it in parity.
- `DEFINITION-OF-DONE.md` -- item 4, "No Glossary term appears under a synonym". Append the human-checked `project` / bare `id` note.
- `node_modules/.bin/biome` -- 2.5.14. Grit facts verified:
  - Node names are PascalCase (`JsIdentifierBinding()`).
  - A capturing group in `r"..."` errors with "regex pattern matched 1 variables", so use alternation without groups.
  - `language json` with `JsonMemberName()` works.
  - `overrides[].plugins` honours root-relative negated includes.
- `packages/bridge/test/bundle.test.ts` -- existing test. It must stay clean under the new rule.

## Tasks & Acceptance

**Execution:**
- `lint/no-project-id.grit` -- JS/TS Grit plugin. Use an `or {}` of identifier, member-name, string-literal and template-chunk node types, matched with `r".*project_id.*|.*projectId.*|.*projectSlug.*"`, and call `register_diagnostic` (severity error) with the exact message. The header comment explains A-P1, both exceptions, and the uncovered `project` / `id`.
- `lint/no-project-id-json.grit` -- same for `JsonMemberName()` and `JsonStringValue()`.
- `lint/no-project-id-sql.sh` -- `[root]` arg (default repo root). Grep `*.sql` under `$root/packages` (excluding `node_modules`) for the three names. Print `file:line: <message>` and exit 1 on a hit, 0 otherwise.
- `biome.json` -- add `overrides: [{ includes: ["packages/**", "!packages/bridge/src/tickets/plane.ts", "!packages/bridge/src/registry/client.ts"], plugins: [both grit files] }]`.
- `mise.toml` -- `lint` runs biome and the SQL script, and exits non-zero if either fails. Add a `lint:selftest` task. `test` depends on `lint:selftest`.
- `lint/no-project-id.test.sh` -- builds a temp tree with a copy of `biome.json` + `lint/` and fixtures:
  - banned-name fixtures at `registry/index.ts` and a third path;
  - both boundary paths;
  - `.json` and `.sql` fixtures.
  It runs the repo's biome binary and the SQL script against that tree. It asserts non-zero, the file/line and the exact message for violators, zero plugin diagnostics for the boundary files, and exactly two negated entries in `biome.json`. It cleans up with a trap.
- `package.json` -- `scripts.lint` = `biome check . && sh lint/no-project-id-sql.sh`.
- `DEFINITION-OF-DONE.md` -- item 4 records that `project` and a bare `id` for the pjangler identifier are human-checked here, because they are too generic to lint.

**Acceptance Criteria:**
- Given the rule installed, when `packages/bridge/src/registry/index.ts` contains `projectId`, then `mise run lint` exits non-zero, names file and line, and prints the exact message. The same holds for `project_id` and `projectSlug` as a local variable, a JSON key literal and a log key.
- Given fixtures at the two boundary paths and a third path, when linting, then only the third fails. `biome.json` holds exactly those two negated single-file entries, and the fixtures are deleted afterwards.
- Given a `packages/**/*.sql` containing `project_id`, when `mise run lint` runs, then it exits non-zero with the same message. `_bmad-output/` is never scanned.
- Given `DEFINITION-OF-DONE.md` and the grit file, when read, then item 4 names `project` and bare `id` as human-checked, and the rule comment says it does not cover them and why.
- Given the current repo, when `mise run lint && mise run test && mise run build` run, then all exit 0.

## Spec Change Log

## Review Triage Log

## Design Notes

Why an override and not the plugin `includes`: in 2.5.14, `{"path": ..., "includes": ["packages/**"]}` matched nothing. Only `**`-prefixed or absolute globs worked, which would widen an exception beyond one file. `overrides[].includes` resolves from the config root, so `!packages/bridge/src/tickets/plane.ts` names exactly one file.

The regex is a substring match, so `subprojectId` or `'SELECT project_id FROM'` in a string are flagged too. That is intended: an SQL string in TS is exactly where A-P6 applies.

## Verification

**Commands:**
- `mise run lint:selftest` -- expected: exit 0, and every assertion is reported as passing.
- `mise run lint && mise run test && mise run build` -- expected: exit 0.
- `git status --short` after the self-test -- expected: no stray fixtures.
