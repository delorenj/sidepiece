# Sidepiece PRD — Addendum

Depth that belongs downstream (architecture, UX, epics) rather than in the PRD's
main narrative: rejected alternatives and their rationale, mechanism and
transport decisions, and technical constraints that bound the requirements
without being requirements themselves.

---

## A. Rejected alternatives

### A.1 Resolution: Traefik-label registry (rejected 2026-09-17)

The June model matched the active tab's URL against a registry built from Traefik
routes and a repo inventory. It carried three problems that the declaration model
eliminates outright rather than mitigates:

1. **Origin-coupled.** Only Traefik-served hosts could resolve. Local dev servers
   were explicitly distrusted to avoid false positives — meaning the tool was
   useless during the activity where you most want it.
2. **Inference, not fact.** URL matching produces confidence scores and therefore
   wrong answers. §5's "cost of being wrong" makes a confidently wrong Project
   the worst outcome in the system.
3. **Two sources of truth.** Traefik config and the pjangler Registry had to agree,
   and nothing kept them in agreement.

The declaration model inverts it: the page asserts its own identity, so origin is
irrelevant and resolution is exact. The cost is a bootstrapping burden — every
Project must emit the declaration before it is visible (§12 Q4).

### A.2 Bridge transport: Native Messaging (rejected)

No port, no CORS surface, no private-network-access exposure, and the helper's
lifetime is tied to Chrome's. Rejected on debuggability: stdio framing cannot be
exercised with `curl`, and FR-12 makes out-of-band inspection a hard requirement.
A component that can only be driven through the extension makes every bug a
two-variable bug. Registration is also per-browser-profile, which is friction on
every reinstall.

### A.3 Bridge transport: extend an existing 33GOD service (rejected)

Extending holocene or candystore to expose resolve/chat/tickets avoids a new
process to supervise. Rejected on coupling: it binds Sidepiece's release cadence
to a service with unrelated consumers, and it puts filesystem and pjangler
execution into a service that currently has no business doing either.

### A.4 Chat: streaming-only, and dispatch-only (both rejected)

Streaming-only was the June D-epic model. It has no answer for a turn that takes
twenty minutes; the panel appears hung, and a progress story gets bolted on later
in the worst possible place. Dispatch-only is architecturally cleanest and fits
the existing command gateway exactly, but a tool you cannot ask a quick question
of stops being a cockpit. The split (FR-5/FR-6) costs a classifier — the
classification is a heuristic, and FR-6's assumption biases it toward dispatch
because that failure direction is merely mildly annoying rather than blocking.

---

## B. Mechanism and transport notes

### B.1 Bloodbank naming — the operative constraint

```
type     bloodbank.<domain>.<entity>.<action>          4 tokens
subject  bloodbank.<kind>.<domain>.<entity>.<action>   5 tokens, kind = evt|cmd|rpy
```

- Versioning lives only in `schemaref` / `dataschema`. No `version` envelope
  field, no `v1` token in a type.
- Identity — repo, agent, ticket, project — lives in `data.*` and `actor.*`.
  Never as a token.
- Shape-valid is not contract-valid: a well-formed 4-token type whose action is
  not in the allowlist is refused.

Consequences for Sidepiece:

- Project-scoped event retrieval is a `data.repo` filter through Candystore, not
  a NATS subject subscription. This is the single most important correction this
  PRD makes to both source documents (PRD §6).
- Any new producer runs `bb contract` and `bb emit --check --type <type>` before
  publish. `bb emit` derives `subject`, `schemaref`, `dataschema`, `kind`,
  `domain` and `actor` — none of those are hand-written.
- There is no `publish.sh`. Instructions naming one are stale.

Prior art worth not repeating: the scrum-master's `repo.issue.*` family was
retired 2026-08-28 because it embedded a repo slug in the type *and* used an
entity outside the allowlist. It had no correct migration target, so it was
deleted rather than renamed.

### B.2 Credentials

Plane credentials resolve from 1Password by item UUID, not by title — the vault
contains duplicate titles and a title-based `op://` reference to a duplicated
name cannot resolve. The Sidepiece board's key is
`op://DeLoSecrets/dlxun2xmwhkt54ns77l4gagrdq/apiKey`; the other item titled
"Plane" returns 403.

### B.3 Ticket provider indirection

`.project.json` already models the provider abstractly (`ticket_provider.type`),
and the Hermes PM ships a provider shim (`.scripts/providers/plane.sh`). The
Bridge should resolve the provider from `.project.json` rather than hardcoding
Plane, even though Plane is the only implementation in v1. The abstraction
already exists upstream; ignoring it creates a second model of the same thing.

---

## C. Chrome MV3 constraints bounding the requirements

Constraints, not requirements — they explain why several FRs are shaped as they
are. Verified against the capability research in §D; where research corrected an
earlier draft assumption, the correction is noted.

- **Opening the panel requires a user gesture, synchronously.**
  `chrome.sidePanel.open()` has required a genuine user gesture since Chrome 116,
  and must be the *first synchronous call* in the gesture handler. An `await`
  before it — even awaiting `setOptions` — breaks the gesture chain and Chrome
  **silently no-ops with no thrown error**. There is no supported way to
  auto-open on navigation; this is by design, not a permission that can be
  requested. The silent-failure mode matters more than the restriction: it
  presents as an intermittent "sometimes doesn't open" heisenbug rather than an
  error (PRD §5).

- **The panel document survives tab switches.** *(Corrects the earlier draft.)*
  A global panel's document persists across tab switches within a window — DOM,
  JS state, and open sockets survive, similar to a DevTools panel. The earlier
  draft assumed the Cockpit would follow the active tab via per-tab
  `setOptions({tabId, ...})` overrides; that is available but loads a *distinct
  document* per tab and is prone to override drift, where a stale per-tab
  override silently diverges from the global default and produces "correct on
  some tabs, stale on others". The better shape is one global panel document
  that receives tab and URL updates by message. This is good news for FR-8: chat
  state survives tab switching without persistence work, and only needs
  persisting across the panel *closing*.

- **The service worker dies after ~30s idle**, taking in-memory state and open
  connections with it. Sharper than the earlier draft: WebSocket traffic is
  documented to reset the idle timer, but **EventSource has no equivalent
  documented exemption** — an SSE connection held in the service worker cannot
  be trusted to survive. Live streams belong in the panel document (alive while
  open), or an offscreen document if they must outlive panel visibility. This
  shapes PRD §5 and FR-7: outcomes arriving while the panel is closed are
  reconciled on next open rather than streamed to a listener that isn't there.

- **Reading the declaration wants a narrow match, but the model wants a broad
  one.** A manifest-declared `content_scripts` entry is the right mechanism —
  it fires automatically on every navigation with no gesture or message
  round-trip, unlike `chrome.scripting.executeScript` + `activeTab`, which only
  fires on demand. The tension is in the match pattern: scoping to known hosts
  (`*://*.delo.sh/*`, `http://localhost/*`) avoids the runtime warning, but
  **reintroduces exactly the origin coupling that killed the Traefik model in
  §A.1**. A Project served from an unanticipated origin would go undetected,
  which defeats the point of page-declared identity. Resolved in favour of the
  broad match and the permission prompt, valid only while the extension stays
  personally loaded (PRD §5, §7).

- **SPA navigation needs explicit handling.** Content scripts fire on document
  load. A client-side route change that replaces the page without a document
  load will not re-trigger one, so FR-1's SPA requirement needs either
  `chrome.webNavigation.onHistoryStateUpdated` (which needs host permissions
  regardless) or in-page history observation. Not automatic either way.

- **`captureVisibleTab` is viewport-only and rate-limited** — a handful of calls
  per second, no full-page stitching, and blocked on `chrome://` and other
  extensions' pages without `activeTab`. Full-page capture requires manual
  scroll-and-stitch or `chrome.debugger` + CDP
  `Page.captureScreenshot({captureBeyondViewport: true})`; the latter needs the
  `debugger` permission and its alarming "debug your browser" warning. A real
  tradeoff for the deferred snapshot feature (PRD §9), not an implementation
  detail.

- **Stable selector generation** has known libraries — `css-selector-generator`
  (configurable priority order, explicit Shadow DOM support), `optimal-select`
  (~11KB, shortest selector across id/class/attribute/structural path) — and
  DevTools' own approach (id if unique, else tag + `:nth-of-type` chain to a
  unique ancestor). All share the same failure modes: framework-hashed and
  utility class names churn on every rebuild; `nth-child` and structural
  selectors break when sibling count or order changes; Shadow DOM and iframes
  need special-casing because `querySelector` crosses neither boundary.
  Practical priority: `data-testid` / `data-*` → id → short capped structural
  path, with fallback text and role stored so a human can re-match a selector
  that went stale after a redeploy. This is why the deferred element-picker
  payload carries context rather than relying on the selector alone (PRD §9).

- **Private Network Access is unsettled and can break loopback calls on a Chrome
  update.** Extension pages run at `chrome-extension://`, a potentially-trustworthy
  context, so ordinary mixed-content blocking does not apply and
  `fetch`/`EventSource` to `http://localhost:PORT` is architecturally fine given
  host permissions. The hazard is PNA/LNA: Chrome has been sending a CORS
  preflight (`Access-Control-Request-Private-Network: true`) ahead of
  private-network subresource fetches, phased toward enforcement around Chrome
  130, with a broader Local Network Access gate landing around Chrome 142.
  **Whether extension-context fetches receive the same treatment as
  page-context ones is not clearly documented** — unverified, and worth testing
  against current stable before locking the transport (PRD §12 Q7).
  Unconditional mitigation: have the Bridge answer preflights with
  `Access-Control-Allow-Private-Network: true` alongside normal CORS headers
  now, so it survives whichever way enforcement lands.

- **Dev-loop friction, for whoever builds this.** The `chrome://extensions`
  reload button invalidates content-script contexts exactly as a real update
  does, throwing "Extension context invalidated" in already-open tabs; content
  scripts should detect and swallow the dead-context error rather than spam the
  console. The side panel document does not hot-reload on extension reload — it
  must be closed and reopened to pick up new code.

---

## D. Capability research digest

Research pass completed 2026-09-17 against current Chrome documentation and
Chromium issues. Findings are folded into §C above rather than duplicated here;
§C is the operative version and supersedes the draft assumptions it replaced.

Corrections the research made to the first draft:

1. **Panel document persistence.** The draft assumed per-tab `setOptions`
   overrides as the mechanism for following the active tab. The research showed
   a global panel document persists across tab switches and that per-tab
   overrides carry a drift failure mode. Changed the recommended shape and
   relaxed FR-8's persistence burden accordingly.
2. **SSE vs. WebSocket in the service worker.** The draft said "long-lived
   connections don't survive the service worker". True, but the research
   sharpened it: WebSocket traffic resets the idle timer, EventSource has no
   documented equivalent. Relevant if a stream ever must live outside the panel.
3. **Host permission scope.** The draft treated the broad host match as an
   obvious default with an irrelevant prompt. The research surfaced that a
   narrow match avoids the warning entirely — which turned a non-decision into a
   real tradeoff against the origin-independence the whole resolution model is
   built on. Now an explicit decision in PRD §5 with a stated expiry condition.
4. **Private Network Access.** Absent from the draft entirely. Now a
   cross-cutting NFR and an open question, because it is the one identified
   failure mode that can break a working install with no change on our side.
5. **The gesture constraint is a silent failure.** The draft had the restriction
   but not the failure mode. Silent no-op on a broken gesture chain is worth
   knowing before it is debugged the hard way.

Primary sources: `chrome.sidePanel` reference and Chromium issue 355266358
(gesture chain); content scripts and `chrome.scripting` references; Private
Network Access preflight announcements and the WICG PNA spec; service worker
lifecycle and extended-lifetime documentation; `chrome.tabs` reference;
`optimal-select` and `css-selector-generator`.

---

## D.1 Prior art worth knowing about

Deliberately brief — competitive positioning is not a concern for a
single-operator tool, but two of these are instructive.

- **Vercel Toolbar** — the closest existing analog. Injected into preview and
  production deployments, shows the current branch and commit, and lets you
  comment on a DOM location and jump to source. It validates the core premise:
  the running-page → source link is genuinely useful. It is first-party and
  Vercel-hosted only, which is exactly the generality Sidepiece is buying with
  the pjid declaration.
- **Sourcegraph browser extension** — overlaid code intelligence on code hosts
  by matching a URL to an indexed repo. Its extensibility framework was
  deprecated in 2022, leaving bare code navigation. The cautionary note: a
  general-purpose URL→repo mapping layer is expensive to sustain. Sidepiece
  avoids the class of problem by not mapping URLs at all — the page declares.
- **React/Vue/Redux DevTools** — excellent at reading live page state via a
  content script plus an injected page-world script, but with no concept of
  which local repo produced the page. They solve the other half.
- **Octotree and similar** — repo-aware, but only while browsing github.com.
  The opposite direction from running-app → local-repo.

---

## E. Prior art: the SIDE board

The per-epic verdict table lives in PRD §10 because
`bmad-create-epics-and-stories` needs it as a first-class input. What belongs
here is the pattern, for the retrospective:

44 tickets were created on 2026-06-23 directly from a product brief, with no PRD
and no architecture between them. Zero were ever started. The tickets named
implementation targets (`GET /resolve?url=`, "holocene fleet client") that
encoded an architecture nobody had written down, so when the resolution model
changed in a single braindump revision, roughly a third of the board silently
became wrong — and nothing in the board could detect that. The board had the
*form* of a plan without the decisions a plan is made of.
