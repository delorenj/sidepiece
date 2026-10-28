---
title: 'SIDE-49 — Local-first attributed annotation userscript'
type: 'feature'
created: '2026-10-27'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: 'eb4674bf8b190b42e6a06a458b0cb68fa5032a83'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
## Intent
**Problem:** Page review requires leaving the page and loses which collaborator marked what. Deliver a standalone first slice before the extension cockpit.
**Approach:** A reusable browser-neutral annotation document core plus explicitly activated Tampermonkey overlay, local save/load and attributed Markdown.

## Boundaries & Constraints
**Always:** Preserve per-annotation author ID/display/time; validate imports, block mismatched overlays; default to no active origin; file export works without Slack/S3. Preserve dirty main BMAD artifacts.
**Never:** Claim arbitrary tab screenshot capture, realtime sync, LLM summaries, live Slack posting without an authorized destination, client-side S3/Slack secrets, or extension/cockpit delivery.

## I/O & Edge-Case Matrix
| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Review | Jarad and Damian draw four shapes and write notes | Versioned JSON, persistent overlay, deterministic attributed Markdown | Undo/delete/Escape available |
| Import | Matching URL/version/dimensions | Explicit merge or replace preserves author | Collision refuses, no silent loss |
| Mismatch | Different URL/version/size or malformed JSON | No overlay/import mutation | Clear warning or validation error |
| Slack/S3 | No destination or asset service | Local export works; Slack button says unconfigured | No real send, no secret in browser |
</frozen-after-approval>

## Code Map
- `packages/annotation/src/core.mjs` — standalone serialization, validation, merge, Markdown, adapter seam.
- `packages/annotation/src/ui.mjs` — Shadow DOM overlay, canvas and sidebar, localStorage, file import/export.
- `packages/annotation/src/userscript.mjs` and `scripts/build.mjs` — default-off exact-origin activation and self-contained Tampermonkey bundle.
- `packages/annotation/test/` — Node core tests and Playwright Chromium browser two-persona/two-page flow.
- `packages/annotation/demo/` — public downloadable userscript and two HTML demo pages.

## Tasks & Acceptance
**Execution:**
- [x] `packages/annotation/src/core.mjs` — implement versioned document, import modes and Markdown.
- [x] `packages/annotation/src/ui.mjs` — implement opt-in drawing/sidebar and local save/load.
- [x] `packages/annotation/demo/` — installable script and public demo pages.
- [x] `packages/annotation/test/` — unit and browser tests.

**Acceptance Criteria:**
- Given an allowed origin, when launched explicitly, then Jarad/Damian can mark the page, reload, export/import and retain attribution.
- Given another page, when importing the first page's JSON, then the overlay refuses to attach it.
- Given no Slack destination, when clicking Send Slack, then no external request occurs and an unconfigured message appears.

## Implementation Notes
Implemented in isolated SIDE-49 worktree, not shared main. Screenshot file reference only; image bytes not embedded. Slack mock adapter tested; production destination unresolved. Initial Node 26 bridge tests failed because bridge explicitly pins Node 24; rerun under mise Node 24.15.0 passed.

## Verification
- `mise exec node@24.15.0 -- pnpm test`: annotation 6, contract 7, bridge 262 pass.
- `mise exec node@24.15.0 -- pnpm typecheck`: pass.
- `mise exec node@24.15.0 -- pnpm build`: pass.
- `node packages/annotation/test/browser.mjs`: pass, two personas and two pages.
- `pnpm lint`: fails on pre-existing repo Biome configuration (no files processed), unrelated to slice.

## Review Triage Log
| Finding | Verdict / route | Verified evidence / repair |
|---|---|---|
| P1 query/hash identity omitted | high / repair authorized | Baseline Node repro equated query documents; v2 uses full parsed URL href for page identity, targets, imports and keys. SPA URL changes hide/refuse until reload. |
| P1 stale two-tab writes lose attribution/marks | high / repair authorized | Baseline real Chromium output: after Jarad `[jarad]`, after Damian `[damian]`, each panel one row. New Web-Lock-serialized delta saves reread latest storage, track record revisions/tombstones, refuse conflicts; native storage refresh and selective undo. No lock-free fallback. |
| P2 Markdown attribution injection | medium / repair authorized | Baseline Node repro emitted raw CR/LS/PS/version newline and forged author syntax. All untrusted fields now literal entity-encoded, line separators normalized, multiline notes quoted. Imported adversarial tests and independent CommonMark render verify. |

## Repair Tasks / Acceptance (review iteration 1)
- [x] `src/core.mjs`, `src/store.mjs`, `src/ui.mjs`: one conservative full URL identity; distinct query/hash keys/import refusal; same-page import accepted. Legacy path-only storage untouched, not guessed/migrated.
- [x] `src/store.mjs`: latest-state reconciliation inside Web Locks; deterministic monotonic document/per-record revisions, persistent tombstones, atomic whole-operation refusal for edit/delete conflicts and stale replace. Preserve immutable author IDs/display/time. Refuse writes if locks unavailable or storage malformed.
- [x] `src/ui.mjs`: storage/focus refresh; operation-local undo rather than whole-state rollback; failed edited text retained; explicit note editing; SPA route guard.
- [x] `test/review.test.mjs`, `test/store.test.mjs`, `test/browser-review.mjs`: query/hash separation, stale two-tab additions, edit/edit + edit/delete + delete/edit conflicts, ABA revisions, no resurrection, author imports, selective undo, native storage refresh and actual browser-process restart.
- [x] `src/core.mjs`: CRLF/CR/LF/NEL/LS/PS normalization; literal escaping of all untrusted Markdown fields, safe multiline notes with content preserved.
- [x] `scripts/build.mjs`, `demo/sidepiece.user.js`: rebuild candidate 0.1.1; no public upload/overwrite.
- [ ] Independent re-review by a separate reviewer (parent PM owns dispatch/verdict). Not merged, not closed, not publication-approved.

Given two already-open tabs on the same full URL, when they add different attributed marks from stale snapshots, then both remain and panels refresh. Given a conflicting edit/delete, when the stale save runs, then the whole save refuses with a clear message and retains latest stored content. Given a deleted mark, when a stale unrelated addition or old file merge runs, then it cannot resurrect that ID; intentional undo checks its tombstone revision. Given a different query or fragment, when imported or navigated without reload, then overlay/import/write does not silently attach. Given imported hostile multiline fields, when exported to Markdown, then all original text remains literal and only actual annotation records produce attributed entries.

## Repair Verification (Node 24.15.0)
Evidence directory: `/home/delorenj/.hermes/profiles/33god-pm/cache/scratch/`.
- `SIDE-49-baseline-regressions.log`: fail-first against reviewed baseline core: 2 failed / 0 passed (identity and Markdown). `SIDE-49-baseline-two-tabs.log`: real baseline silent loss `[jarad]` → `[damian]`.
- `SIDE-49-tests.log`: `mise exec node@24.15.0 -- pnpm test` exit 0; annotation 15, contract 7, bridge 262 passed, plus repository boundary checks.
- `SIDE-49-typecheck.log`, `SIDE-49-build.log`: Node24 full workspace typecheck/build exit 0. Annotation JS syntax checks include new store; bridge/contract TypeScript checks unchanged and pass.
- `SIDE-49-browser-original.log`: existing browser smoke exit 0 (activation-off, drawing/export/reload/import mismatch/replace, filename reference, unconfigured Slack, Escape).
- `SIDE-49-browser-review.log`: expanded two-tab/conflict/query/hash/SPA/restart/no-lock regression exit 0, no page errors. Playwright evaluation smoke, NOT manager installation proof.
- `SIDE-49-adversarial.md`, `SIDE-49-markdown-render.log`: actual MarkdownIt CommonMark parser reports one trusted heading, no injected links/HTML/code, literal hostile content retained.
- `SIDE-49-manager-probe.log`: installed Tampermonkey 5.5.1 detected in Chrome Profile 3 read-only; disposable Chrome 154 profile had no extension/worker, manager navigation `ERR_BLOCKED_BY_CLIENT`. No user extension installed or profile changed. Actual Tampermonkey install remains untested.
- Existing `${NPM_TOKEN?}` config warnings persist without blocking the passing checks. Existing repo lint limitation is unchanged.

Release limits: Web Locks requires a supported secure context; unsupported browsers are deliberately read/export-only. v2 coordinates participating same-origin tabs, not arbitrary storage mutation/cloud sync. Old path-only saved data/files require manual verified migration. Tombstones are local, not part of portable exports. Slack/S3 upload NOT done; screenshot reference is filename-only. Public original preliminary URL remains unchanged; repaired bundle held for independent review. No Studio/live auth/config changes.
