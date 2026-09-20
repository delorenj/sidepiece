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
exercised with `curl`, and FR-15 makes out-of-band inspection a hard requirement.
A component that can only be driven through the extension makes every bug a
two-variable bug. Registration is also per-browser-profile, which is friction on
every reinstall.

### A.3 Bridge transport: extend an existing 33GOD service (rejected)

Extending holocene or Candystore to expose resolve/chat/tickets avoids a new
process to supervise. Rejected on coupling: it binds Sidepiece's release cadence
to a service with unrelated consumers, and it puts filesystem and pjangler
execution into a service that currently has no business doing either.

### A.4 Chat: streaming-only, and dispatch-only (both rejected)

Streaming-only was the June D-epic model. It has no answer for a Turn that takes
twenty minutes; the panel appears hung, and a progress story gets bolted on later
in the worst possible place. Dispatch-only is architecturally cleanest and fits
the existing command gateway exactly, but a tool you cannot ask a quick question
of stops being a cockpit. The split (FR-7/FR-8) costs a classifier, which FR-6
now owns outright rather than leaving as a footnote. It biases toward dispatch
because that failure direction is the cheaper one to be wrong in — but only
because FR-9 renders a dispatched command's result content. Without that, a
misclassified question would be a dead end on the classifier's preferred side.

### A.5 Bridge on loopback, one machine (rejected 2026-09-17)

The first draft of this PRD assumed Chrome and the repos shared a machine, called
it "the workstation", and made loopback-only binding a hard NFR. That was an
assumption made silently, and it was wrong: Chrome runs on a laptop; the repos,
the Hermes fleet and the Bridge live on `big-chungus`. `BRAINDUMP.md` said
so all along — "the cleanest bridge between the Chrome extension and local Big
Chungus paths" presupposes exactly this gap — and the draft answered a generic
version of the question that collapsed it.

What the correction costs, all of it now in the PRD rather than discovered later:

- Loopback binding would make the Bridge unreachable from the machine that needs
  it. The Bridge binds to the tailnet interface instead — and explicitly not
  `0.0.0.0`, which would be the lazy way to make the symptom go away.
- The trust boundary moves from "nothing can reach it but this machine" to "the
  tailnet gates who can reach it". WireGuard device authentication is real
  authentication, so no app-level token scheme is warranted on a single-user
  tool — but the boundary is now *stated* rather than silently absent, which is
  the part that matters if it is ever revisited.
- Every latency budget absorbs network RTT. Negligible on-LAN, materially worse
  through a DERP relay, which is why §5 scopes the budgets to the LAN case and
  requires a degraded-connection indicator rather than silently missing them.
- The Private Network Access risk gets *worse*, not better — see §C.
- EPIC K5, "Remote access (optional)", stops being optional. It is the transport.

Rejected alternative within the correction: exposing the Bridge through Traefik
at a `delo.sh` name. It would inherit working TLS and the existing routing, but
it puts a filesystem-touching, credential-holding daemon on a public hostname to
solve a problem the tailnet already solves. PRD §7 makes this an explicit
non-goal. A Tailscale-issued certificate for a MagicDNS name gets the TLS benefit
without the exposure (§12 Q8).

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

**Illegal forms still live in this repo as of 2026-09-17** — found while
fact-checking the PRD, and worth fixing before anything is built against them:

| Location | Form | Why illegal |
|---|---|---|
| `agents/hermes/pm/role.yaml:53` | `bloodbank.evt.repo.sidepiece.>` | repo slug as a subject token |
| `agents/hermes/pm/role.yaml:54` | `bloodbank.cmd.agent.sidepiece-pm.>` | agent slug as a subject token |
| `docs/product-brief.md:102` | `bloodbank.evt.v1.repo.sidepiece.>` | version token *and* slug |

The `role.yaml` entries matter operationally, not just editorially: that file is
the live manifest of the PM which FR-7 and FR-8 target, and a subscription to an
illegal subject receives nothing. The dispatch path is the fleet gateway
(`bloodbank.cmd.agent.invocation.start`, with the target agent in
`actor.agent_id`), not a per-agent subject — which is the same mistake in
miniature.

### B.2 Credentials

**Corrected 2026-09-17 — an earlier draft of this section was false and would
have sent FR-16 work to "repair" a working reference.**

The 33god Plane key is `op://DeLoSecrets/Plane/apiKey`, and that title resolves
unambiguously. Exactly one vault item is titled `Plane`
(`dlxun2xmwhkt54ns77l4gagrdq`). Other items merely *start* with the word —
`Plane (AutomaticAI / HelloSubconscious)`, `Plane (Intelliforia)`,
`PlaneWebhook-33GOD` — but none share the exact title, so there is nothing to
disambiguate. The repo's committed `.env.op` states this outright and uses the
title form.

The earlier claim — that the vault "contains duplicate titles", that a
title-based reference "cannot resolve", and that "the other item titled Plane
returns 403" — was stale. The duplicate was renamed. The UUID form still works
and is reasonable hardening against future re-duplication, but it is not a fix
for a present failure, and nothing should be rewritten on the belief that it is.

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
  some tabs, stale on others". Per-tab `setOptions` is for "a different panel
  per tab, or no panel on some tabs" — a different product shape than one
  cockpit re-rendering for a new Project. The right pattern here is a single
  global panel document, with the service worker listening on
  `tabs.onActivated` / `tabs.onUpdated` and messaging that long-lived document
  to re-render. Good news for FR-11: chat state survives tab switching with no
  persistence work, and only needs persisting across the panel *closing*.

- **The service worker dies after ~30s idle**, taking in-memory state and open
  connections with it. Sharper than the earlier draft: WebSocket traffic is
  documented to reset the idle timer, but **EventSource has no equivalent
  documented exemption** — an SSE connection held in the service worker cannot
  be trusted to survive. Live streams belong in the panel document (alive while
  open), or an offscreen document if they must outlive panel visibility. This
  shapes PRD §5 and FR-9: outcomes arriving while the panel is closed are
  reconciled on next open rather than streamed to a listener that isn't there.

- **Reading the declaration wants a narrow match, but the model wants a broad
  one.** A manifest-declared `content_scripts` entry is the right mechanism —
  it injects automatically on every *document load* with no gesture or message
  round-trip, unlike `chrome.scripting.executeScript` + `activeTab`, which only
  fires on demand. The tension is in the match pattern: scoping to known hosts
  (`*://*.delo.sh/*`, `http://localhost/*`) avoids the runtime warning, but
  **reintroduces exactly the origin coupling that killed the Traefik model in
  §A.1**. A Project served from an unanticipated origin would go undetected,
  which defeats the point of page-declared identity. Resolved in favour of the
  broad match and the permission prompt, valid only while the extension stays
  personally loaded (PRD §5, §7).

- **SPA navigation needs explicit handling, and the permission scope is
  unrelated to it.** A content script is injected once per *document load*. A
  history-API transition (`pushState` / `replaceState`) never unloads the
  document, so it does not re-inject — and widening the host match does nothing
  to change that, because the match pattern is a permission knob, not a
  re-injection trigger. Confusing the two is easy and wastes a permission
  decision on the wrong problem. FR-1's SPA requirement needs one of:
  - a `MutationObserver` on `<head>` in the already-injected content script —
    cheapest, needs no additional permission, and the recommended default;
  - monkey-patching `history.pushState` / `replaceState`. Note that `popstate`
    alone is insufficient: it fires on back/forward, not on a `pushState` call;
  - `chrome.webNavigation.onHistoryStateUpdated` in the service worker, which
    then messages the content script. Reserve this for when the service worker
    itself needs to know about the transition — it costs the `webNavigation`
    permission for a signal the content script can usually observe itself.

- **Local Network Access almost certainly does not affect us.** *(Rewritten
  2026-09-20 during `bmad-ux`. The previous text said the tailnet move made PNA
  "strictly greater" uncertainty than loopback and left it unverified either
  way. **Four of its factual claims were wrong**; full sourcing in
  `../../ux-designs/ux-sidepiece-2026-09-20/.working/research-mv3-platform.md` §6.)*

  Extension pages run at `chrome-extension://`, a potentially-trustworthy
  context, so ordinary mixed-content blocking does not apply and
  `fetch`/`EventSource` to a private address is architecturally fine given host
  permissions. That part stood. The four corrections:

  1. **`100.64.0.0/10` is not ambiguous — the spec classifies it explicitly as
     `local`.** The WICG Local Network Access address-space taxonomy names CGNAT
     (RFC 6598) alongside `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` and
     `169.254.0.0/16`. Loopback is its own class (`127.0.0.0/8`, `::1/128`).
     The claim that "loopback has an unambiguous place and CGNAT does not" was
     backwards: both are classified, just differently. The tailnet move did
     **not** increase this uncertainty.
  2. **Extensions with host permissions are stated to be exempt.** Chrome's
     Patrick Kettner, on chromium-extensions: *"as long as an extension has the
     correct host permissions, then they will not be impacted by this."* Two bugs
     once broke that guarantee — crbug.com/435246545 (fixed 5 November, requires
     Chrome ≥ 144.0.7512.0) and issue 456078996, fixed shortly after. This
     tailnet spans Chrome 151–155, so **both fixes are already in on every
     machine**.
  3. **LNA shipped in Chrome 142, not 153.** Launched 29 September 2025;
     Chrome 138 had it behind `chrome://flags#local-network-access-check`. The
     PRD's "Chrome 153+ ships Local Network Access" was off by eleven milestones
     — it has been shipping for nearly a year, across the whole fleet, without
     this having been noticed as a problem.
  4. **HTTPS is a precondition for asking, not an exemption from asking.**
     Verbatim: *"The ability to request this permission is restricted to secure
     contexts."* So a real certificate does not buy an exemption — though it
     remains worth having for the older mixed-content class, which *is* exempted
     for known local destinations.

  **Trending more granular, not less:** Chrome 146+ splits the permission into
  **"Local Network"** and **"Loopback Network"**, and upcoming releases extend
  the model to **WebSockets, WebTransport and WebRTC**. That last clause would
  matter if the upstream WebSocket leg ever ran browser-side. It does not — it
  is the Bridge's, server to server — but any future design that moves a socket
  into the extension inherits this.

  **If a prompt does appear**, it is a standard Chrome permission bubble anchored
  to the omnibox reading **"Look for and connect to any device on your local
  network."** The Chrome documentation is **silent on what happens on denial**
  and on the recovery path, so the UX cannot be specified from documentation —
  see `EXPERIENCE.md`, which renders a denial as an ordinary fetch failure until
  proven otherwise.

  The mitigations stay, because they are cheap and unconditional: have the Bridge
  answer preflights with `Access-Control-Allow-Private-Network: true` alongside
  normal CORS headers, and serve over HTTPS with a Tailscale-issued MagicDNS
  certificate. **Net effect on PRD §12 Q7: it drops from a discovery to a
  confirmation.** Still worth one empirical check on `carries-macbook-air`
  before the transport is locked, but the expected result is now *no prompt at
  all*, and a prompt would be the surprise rather than the base case.

- **`captureVisibleTab` is viewport-only and rate-limited to exactly two calls
  per second** — `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND = 2`, not "a handful";
  no full-page stitching; and it returns **physical** pixels on a HiDPI display,
  so any coordinate travelling with a capture must be relative or it will not
  survive the mismatch. *(Corrected 2026-09-20. The earlier text also had the
  permission backwards: `activeTab` is **strictly more capable** than
  `<all_urls>` here — it is what unlocks capture on `chrome://` and other
  extensions' pages, which a broad host match alone does not.)* Full-page capture
  requires manual scroll-and-stitch or `chrome.debugger` + CDP
  `Page.captureScreenshot({captureBeyondViewport: true})`; the latter needs the
  `debugger` permission and its alarming "debug your browser" warning.

  **This bullet is now largely moot, and that is worth stating rather than
  leaving for someone to rediscover.** `bmad-ux` closed the question on
  2026-09-20: the freehand annotation's image is **not load-bearing**. Strokes
  render as SVG over the live DOM and the payload is stroke geometry in relative
  coordinates plus the selectors of the elements those strokes cross. Nothing is
  captured. That decision deletes `captureVisibleTab`, this rate limit, the HiDPI
  problem and the `activeTab` permission from the deferred annotation feature
  entirely (PRD §9). The facts above are kept because the constraint is real and
  a future full-page-capture idea will run into it — not because anything
  currently planned depends on it.

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

- **Dev-loop friction, for whoever builds this.** The `chrome://extensions`
  reload button invalidates content-script contexts exactly as a real update
  does, throwing "Extension context invalidated" in already-open tabs; content
  scripts should detect and swallow the dead-context error rather than spam the
  console. The side panel document does not hot-reload on extension reload — it
  must be closed and reopened to pick up new code.

### C.1 Facts this section was missing *(added 2026-09-20)*

Surfaced by the `bmad-ux` platform sweep. None contradicts anything above; all
four change what is buildable, and the first changes it substantially. Sourcing
in `../../ux-designs/ux-sidepiece-2026-09-20/.working/research-mv3-platform.md`.

- **A click inside the page can open the Cockpit.** Chrome *curries* a user
  gesture across a `runtime.sendMessage` hop: a content-script click that
  messages the service worker, whose `onMessage` handler calls
  `chrome.sidePanel.open({windowId})`, **works** — demonstrated empirically on
  chromium-extensions (thread `d5ky9SiZlqQ`). Three hard edges: the curried
  gesture is *restricted*, so **one hop only** and it cannot be re-forwarded; the
  chain must be **callbacks with zero `await`s**, or the gesture is lost to the
  same silent no-op as above; and `sidePanel.open()` has a known bug
  (issues.chromium.org/415694848) where it throws on the *second* click after the
  panel was manually closed, unverified against 151–155.

  This is the most consequential fact in the sweep and neither this document nor
  the PRD had it. It is what makes the deferred in-page annotation flow (§9) able
  to summon the Cockpit at the moment of discharge, rather than requiring the
  operator to go and open it. Also PRD-silent and simpler:
  `setPanelBehavior({openPanelOnActionClick: true})` makes the icon open the
  panel with **no service-worker gesture handling at all** — and it is a
  **toggle**, so the same click closes it.

- **The panel document is torn down on *collapse*, not only on close.** The PRD's
  "does not survive the panel closing" is right but understates it: collapsing
  the panel is the same event. Anything held in the panel document dies at that
  moment, which is why FR-15's Bridge-as-system-of-record is load-bearing rather
  than tidy. **New since the 2026-09-17 pass:** `chrome.sidePanel.onOpened` /
  `onClosed` exist (Chrome 141+, fleet runs 151–155), as does
  `runtime.getContexts({contextTypes:['SIDE_PANEL']})` — a save/restore hook this
  document did not know about. Nothing documents whether `onClosed` fires early
  enough to flush unsaved state, so treat it as a notification and not a
  guaranteed drain.

- **The side panel has a hard ~320px minimum width and the extension can neither
  read, set nor suggest it** (Chrome 149). It is user-resizable only upward. Every
  FR that puts something permanently on screen — FR-4's repo name, full clone path
  and Board identifier; FR-6's classification control with both values visible;
  FR-10's context preview; FR-12's grouped list — competes in that single column.
  This is an information-architecture constraint, and it is why `EXPERIENCE.md`
  treats 320px as the design target on every open rather than as a worst case.

- **The keyboard budget is exactly four.** `chrome.commands` caps *suggested*
  shortcuts at four; each must contain Ctrl or Alt; **Ctrl+Alt is banned
  outright**; and global chords (firing when Chrome lacks focus) are restricted to
  `Ctrl+Shift+[0..9]`. The deferred annotation journey has exactly four verbs —
  arm the picker, open the Cockpit, file a Ticket, discharge the batch — so there
  is zero headroom. `EXPERIENCE.md` spends the four on Alt+Shift chords to stay
  clear of Chrome's own Ctrl+Shift bindings, and puts everything else on
  in-document accelerators that cost no budget.

- **Dark mode has a seam the extension cannot close.** In a side panel,
  `prefers-color-scheme` reports the **operating system's** setting and never
  Chrome's own theme, and no API exposes the browser theme
  (w3c/webextensions#242 — Firefox has `browser.theme`, Chrome has nothing). A
  light-OS/dark-Chrome operator gets a light panel flush against dark browser
  chrome with no signal the extension can detect. `DESIGN.md` accepts this: both
  grounds are the same material, so a wrong guess costs comfort, not correctness.

---

## D. Capability research digest

Research pass completed 2026-09-17 against current Chrome documentation and
Chromium issues. Findings are folded into §C above rather than duplicated here;
§C is the operative version and supersedes the draft assumptions it replaced.

Corrections the research made to the first draft:

1. **Panel document persistence.** The draft assumed per-tab `setOptions`
   overrides as the mechanism for following the active tab. The research showed
   that a global panel document persists across tab switches and that per-tab
   overrides carry a drift failure mode. Changed the recommended shape and
   relaxed FR-11's persistence burden accordingly.
2. **SSE vs. WebSocket in the service worker.** The draft said "long-lived
   connections don't survive the service worker". True, but the research
   sharpened it: WebSocket traffic resets the idle timer; EventSource has no
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
6. **Host match scope and SPA re-injection are unrelated problems.** A second
   research pass caught this in the draft's wording: widening the content-script
   match does not make it re-run on a history-API transition, because the match
   pattern governs *where* a script may inject, not *when* it re-injects. They
   are now separate bullets in §C with separate mechanisms, and the recommended
   SPA default is a `MutationObserver` on `<head>` rather than the
   `webNavigation` permission.

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
  production deployments, it shows the current branch and commit, and lets you
  comment on a DOM location and jump to source. It validates the core premise:
  the running-page → source link is genuinely useful. It is first-party and
  Vercel-hosted only — precisely the generality it lacks and Sidepiece buys with
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
