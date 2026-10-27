---
title: 'SIDE-49 — Local-first attributed annotation userscript'
type: 'feature'
created: '2026-10-27'
status: 'in-review'
route: 'dispatch'
review_loop_iteration: 0
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
