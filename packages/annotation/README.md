# Sidepiece annotations — SIDE-49

Build: `pnpm --filter @sidepiece/annotation build`; install `demo/sidepiece.user.js` in Tampermonkey. Host `demo/` over HTTP (`python3 -m http.server 8765 -d packages/annotation/demo`) or open the preliminary published demo. Click **Enable on this origin** and reload, then click **Sidepiece**. On other sites explicitly add the exact origin: `localStorage.setItem('sidepiece:allowed-origins', JSON.stringify([location.origin]))`, reload, and click the launcher. The `@match` wildcard is portable; the origin allowlist is empty by default and nothing appears without opt-in.

Choose Jarad or Damian, enter a note, start drawing, and drag a mark. Escape leaves drawing mode. Each mark preserves its author ID/display/time independently of the currently selected persona; imports retain the original author. Edit note changes only the note. Hide, delete and undo are local. Export versioned `.sidepiece.json` or deterministic attributed `.md`; the core supports `markdown(doc, authorId)` to filter by author. Copy uses the clipboard.

## Page identity

Identity is the full HTTP(S) WHATWG `URL.href`, including **all query parameters in their original order and the entire fragment**. No tracking parameter removal, query sorting, or hash-route guessing. Normal URL parsing applies (e.g. lowercase host/default-port normalization); changing `?doc=alice` to `?doc=bob`, or `#one` to `#two`, is a different document. Even plain anchor fragments conservatively get their own document. Both local keys and import/target compatibility use this one function. A live SPA `pushState`/`replaceState`/hash change hides old marks and refuses writes until reload/reopen; it does not silently follow the new route.

Local keys are `sidepiece:v2:<full identity>`. The separate namespace prevents old path-only scripts from overwriting repaired state. Existing `sidepiece:<origin><path>` data is **left untouched**, with a migration warning, not guessed onto a query/hash document. Old files whose identity dropped query/hash now fail validation: use the old version to export and explicitly verify/correct page identity and targets before importing. This is deliberate refusal, not automatic migration. Import checks identity, version hint and document size before an explicit merge/replace; conflicting IDs refuse.

## Same-origin tab coordination (not a realtime service)

Writes require **Web Locks** (normally HTTPS or loopback). There is no lock-free localStorage CAS. Without `navigator.locks.request`, the panel explains read/export-only mode and all writes refuse. Use a supported secure-context browser rather than relying on an unsafe fallback.

Each v2 save acquires the same full-page-key Web Lock, rereads storage, and applies only the delta from the operation's base snapshot. Local envelopes track a monotonic document revision, per-record revisions, and deletion tombstones (not part of portable exports). Unrelated concurrent additions survive. Edits/deletes to a record changed since the operation began refuse the **whole save**, even if another edit later restored identical bytes. Attribution cannot change during an edit. Untouched stale records never resurrect deleted marks; tombstoned IDs cannot be reimported. Explicit replace refuses if any save intervened. Undo applies only the inverse of this tab's operation, preserves unrelated work, and refuses intervening same-record edits; intentional undo of deletion checks the exact tombstone revision.

Native `storage` events and focus refresh the panels. Conflicts refresh the latest state and show a refusal; unsaved edited text is kept in the note field, and failed new-mark saves do not clear that field. Review/reapply deliberately. This protocol coordinates participating v2 tabs, not arbitrary DevTools/third-party storage writers, cloud clients, or user-cleared storage. Tombstones/revisions persist until origin data is cleared; no background compaction or distributed backend is claimed.

## Export safety and integration limits

All untrusted Markdown fields (author, ID, URL, version hint, anchor/text, asset ID, note) render as literal text. CRLF/CR/LF/NEL/Unicode LS/PS normalize consistently; metadata line breaks display as `↵`, and multiline notes retain their lines inside an indented quote. Markdown punctuation/HTML/control characters become numeric entities, preserving content without creating headings, links, fences, or extra attributed list entries. These are declared collaborator labels, not authenticated identities.

Screenshot reference is **filename/reference only**, not image bytes or arbitrary-tab capture: manually capture an image, choose **Reference screenshot**, and keep it alongside the JSON. No upload or client secret. Slack is unconfigured and **does not send**; the core mock-adapter seam is tested, but a real authorized server-side Slack destination and S3/MinIO storage remain unwired. No LLM or realtime service.

## Verification / release status

Use Node 24.15.x: `mise exec node@24.15.0 -- pnpm test`, `pnpm typecheck`, `pnpm build`, then `node packages/annotation/test/browser.mjs` and `node packages/annotation/test/browser-review.mjs` under that runtime. The second browser test forces stale two-tab writes, conflicts/deletions/undo, query/hash mismatch, same-page import/attribution, SPA navigation, no-lock refusal and a real isolated browser-process restart. Both evaluate the bundle through Playwright; **neither proves Tampermonkey installation**.

The existing installed manager was detected but did not load in a disposable Chrome profile (`ERR_BLOCKED_BY_CLIENT`; extension list/service workers empty). No user profile, extension install, Studio auth or live configuration was changed. User Tampermonkey installation remains untested. The rebuilt 0.1.1 bundle is a review candidate only; the original public demo has not been overwritten or republished. Independent review and publication approval are outstanding.
