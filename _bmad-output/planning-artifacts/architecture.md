---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/prd.md
  - _bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/addendum.md
  - _bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/.decision-log.md
  # Added 2026-09-20 — the bmad-ux run completed after steps 1-2 were written.
  - _bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/.decision-log.md
  - _bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/.working/research-mv3-platform.md
workflowType: 'architecture'
project_name: 'sidepiece'
user_name: 'Jarad'
date: '2026-09-17'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 16, in four groups — Project Resolution (FR-1–5), Agent Chat (FR-6–11), Tickets (FR-12–13), and the Bridge itself (FR-14–16).

Architecturally, almost nothing here is *computed*. Nearly every FR is a read or write against a system that already exists, which makes this an **integration and state-reconciliation architecture** rather than a data-modeling one. The design work is in boundaries, lifetimes, and failure attribution — not in domain logic.

Three FRs carry disproportionate weight:

- **FR-3** enumerates six distinct failure states and is declared the single authoritative taxonomy. Every other FR that can fail must feed it rather than restate its own list. This is the requirement most likely to be quietly violated during implementation.
- **FR-6** (classify a Turn) is the premise of the entire chat feature and has no upstream equivalent — it is genuinely new behaviour the Bridge must own.
- **FR-15** makes curl-inspectability of every Bridge capability a hard requirement, which disqualifies any design whose only driver is the extension.

**Non-Functional Requirements:** 10 cross-cutting, of which four are genuinely shaping rather than aspirational — the trust boundary (tailnet, no app-level auth), failure posture (panes fail independently, never as an empty state), panel lifetime (the client dies), and the split latency budget.

The dominant constraint is not performance. It is that **the client is not durable**: the panel document does not survive closing, and the MV3 service worker is killed after ~30s idle. FR-7's reopen guarantee and FR-9's closed-panel reconciliation therefore both force the **Bridge to be the system of record for Turn state**. That single fact shapes more of this design than every latency budget combined.

**Scale & Complexity:** Three tiers with a network boundary through the middle — MV3 extension on a laptop, Bridge daemon on `big-chungus`, six upstream services behind it. Two distinct streaming protocols meet in the Bridge: JSON-RPC over WebSocket upstream, SSE downstream (SSE because FR-15 requires `curl -N` to tail it).

- **Primary domain:** full-stack — MV3 browser extension, local daemon, event-bus integration
- **Complexity level:** medium-high. Not enterprise — no tenancy, compliance, availability or scale requirements, and a single operator throughout. But not simple either: three tiers, a network boundary, two streaming protocols, asynchronous correlation, seven integrations, and a browser runtime with hard platform limits.
- **Estimated architectural components:** ~12 — content script, extension service worker, panel document, Bridge HTTP/SSE server, registry client, Hermes session manager, Plane client, Bloodbank publisher, Candystore reader, Turn store, health aggregator, credential resolver.

### Technical Constraints & Dependencies

Seven runtime dependencies (PRD §6). Discovered empirically on 2026-09-17 and binding on the design:

- **`tui_gateway`'s JSON-RPC surface is Hermes *internals*, not a published API.** Hermes is at 0.20.5 with `config_version` 37 against a latest of 39. An upgrade can rename methods out from under the Bridge. The Bridge must pin a Hermes release in its unit and treat a gateway protocol break as a named failure mode FR-14 reports.
- **Warm sessions are capped and costly.** The gateway enforces an active-session limit (error 4090) against ~37 profiles on this machine, and each warm session carries an agent with a large system prompt plus its own MCP children. Session **eviction policy is required**, not optional.
- **The registry has no per-pjid endpoint.** `GET /v1/registry` returns all 19 projects as one ~33KB object; the Bridge indexes client-side. Measured 2.4ms p50 — roughly two orders of magnitude inside budget.
- **The PRD's named registry fallback does not work.** `pj info <pjid>` calls the same HTTP service and exits 1 when it is down, so it fails in precisely the outage it was meant to cover. A real fallback must be chosen.
- **`board_id` is an empty string, never null or absent** for boardless Projects (4 of 19). A null check or key-presence test reports a board for all four.
- **The pjid is mutable and author-controlled** — plain text in a file with no UUID behind it. Renaming it deletes and re-keys the registry row, so anything the Bridge persists keyed by pjid orphans silently. It is also decoupled from the repo directory name in 5 of 19 cases, so a path must always come from the record.
- **FR-9 is blocked on another repo.** `BloodbankAdapter.send()` discards the agent's response text; dispatch outcomes carry status only. Correlation works — result content does not exist yet.
- **Dispatch outcomes carry no repo or project**, so §6's `data.repo` filter holds for webhook events but not for agent dispatch. The Bridge must scope by a correlation id it minted itself.
- **`tailscale serve` rewrites the client address to `127.0.0.1`**, moving the real caller to `X-Forwarded-For`.
- **~~Chrome's Local Network Access may survive TLS.~~ CORRECTED 2026-09-20 — LNA almost certainly does not affect us.** The original bullet was right that LNA gates on the address-space transition rather than on secure context, and therefore that TLS alone does not close Q7. Everything else around it was wrong: LNA shipped in **Chrome 142**, not 153, and has been live across this entire 151–155 fleet for nearly a year; the WICG spec classifies `100.64.0.0/10` explicitly as `local` rather than leaving it ambiguous; and **extensions holding the correct host permissions are stated to be exempt**, with the two bugs that once broke that guarantee fixed by Chrome 144. Q7 therefore drops from a discovery to a one-off confirmation on `carries-macbook-air`, with *no prompt* as the expected result. See `prds/prd-sidepiece-2026-09-17/addendum.md` §C.
- **A click inside the page can open the Cockpit.** *(Added 2026-09-20 — absent from every input this document was built on.)* Chrome curries a user gesture across exactly one `runtime.sendMessage` hop, so content script → service worker → `chrome.sidePanel.open()` works, provided the chain is callbacks with zero `await`s. This is what lets the deferred in-page annotation flow summon the Cockpit at the moment of discharge rather than requiring a separate manual open, and it is a component-boundary fact: it puts a gesture-carrying message path between the content script and the service worker that the twelve-component sketch above does not yet account for.
- **The panel document is destroyed on collapse, not only on close**, and `chrome.sidePanel.onOpened` / `onClosed` (Chrome 141+) now exist as save/restore hooks that did not when this document's dependency list was written. The Bridge-as-system-of-record conclusion is unchanged and if anything strengthened; what changes is that there is now a flush point to design around, and nothing documents whether `onClosed` fires early enough to be trusted as one.
- **The side panel has a hard ~320px floor the extension cannot read or set**, which is an architectural constraint and not only a design one: it bounds what a single render pass can usefully deliver and it is the reason `EXPERIENCE.md` treats 320px as the design target rather than a worst case.

### Cross-Cutting Concerns Identified

1. **Failure isolation under one authoritative taxonomy.** FR-3 owns the state list; FR-14 feeds it. Panes fail independently and never render a failure as empty or as a permanent spinner.
2. **Identity discipline.** The pjid is the join key — mutable, path-decoupled, and colliding by name with `event-schemas.md`'s board-UUID `project_id`. The Bridge should name its field `pjid` and never `project_id`.
3. **Streaming lifecycle across two protocols and a non-durable client.** Upstream WS, downstream SSE, with a panel that closes and a service worker that dies.
4. **Asynchronous correlation and reconciliation.** Self-minted correlation ids; outcomes merged on arrival, never assumed to follow their status.
5. **Credential resolution *and silent-degradation detection*.** A Hermes process without vault auth falls through to unresolved `op://` literals and downgrades to a fallback model, producing correct-looking answers at the wrong cost and latency while surfacing nothing. Verified live: `hermes-dashboard.service` ran in exactly that state from 2026-09-09 to 2026-09-17. FR-14 must detect it because nothing else will.
6. **Latency across a network hop.** Every measured figure to date is loopback-only; the tailnet hop is additive and unmeasured.
7. **Staleness and cache invalidation.** FR-2's bounded cache and FR-12's refetch — the product's own loop invalidates its own reads.
8. **Version coupling to an unpublished upstream protocol.** See the `tui_gateway` constraint above.

---

## Starter Template Evaluation

*Step 3. All versions and commands below were verified by web search on 2026-09-20 rather than recalled; where a claim is from documentation rather than from running it here, it says so.*

### Primary Technology Domain

**Two domains in one product, and they do not share a runtime.**

- **The Cockpit** — a Chrome MV3 extension: content script, extension service worker, side panel document. Runs on the laptop, inside Chrome, under its platform limits.
- **The Bridge** — a long-lived daemon under `systemd --user` on `big-chungus`. Holds a JSON-RPC WebSocket upstream to `tui_gateway`, serves SSE downstream, and must stay `curl`-inspectable (FR-15).

The repository is **genuinely empty today** — no `package.json`, no `manifest.json`, no `src/`, no lockfile. EPIC A's "monorepo, core, UI kit" was planned in June and never built, and PRD §10 directs that it be sequenced *behind* a working Bridge. So this is a greenfield starter decision with nothing to retrofit.

### Starter Options Considered

Only the extension side has a meaningful starter market; a Node daemon does not need a generator.

| Option | Verdict |
|---|---|
| **WXT** (v0.21.4) | **Selected.** Vite-based, first-class TypeScript, entrypoint discovery, supports every frontend framework, and ships a `createShadowRootUi` content-script UI wrapper. Actively maintained with strong adoption. |
| **Plasmo** | **Rejected.** Custom Parcel bundler, slowest builds of the three, React/Vue/Svelte only, and widely read as being in maintenance mode on outdated dependencies. One published benchmark put its output at ~800KB against WXT's ~400KB for an equivalent extension. |
| **CRXJS** | **Rejected.** Not a framework — a Vite plugin that reads your `manifest.json` and wires the build, deliberately providing no storage, messaging or content-script-UI helpers. Realistically Chromium-only. Defensible if we wanted maximum control, but we would rebuild the shadow-root UI layer by hand for no gain. |
| **Hand-rolled Vite + manifest** | **Rejected.** This is CRXJS's job with more of our own code in it. |

### Selected Starter: WXT

**Rationale.** Three of its properties land directly on decisions already made upstream, which is why it wins on more than general popularity:

1. **`createShadowRootUi` is the `[v2]` in-page layer's foundation.** The UX run decided the element picker's overlay is a hand-built shadow root rather than `chrome.debugger` — see `ux-designs/ux-sidepiece-2026-09-20/.decision-log.md`. WXT abstracts the `ShadowRoot` setup and offers an `isolateEvents` option, so "hand-built" no longer means "built from zero."
2. **Its one documented isolation caveat does not apply to us.** WXT resets inherited styles with `all: initial`, which does not reset the host `<html>` font size, so **`rem` units are not fully isolated**. `DESIGN.md` is px throughout — 407 px values, zero rem values. `[NOTE FOR IMPLEMENTATION: this is now a constraint, not a coincidence. Converting the in-page layer to rem later would silently break it on every site with a non-16px root. Keep the overlay in px.]`
3. **Cross-browser for free**, which the PRD does not ask for and we should not pay for — but it costs nothing here and it is the reason WXT's platform abstractions are as thorough as they are.

**`[ASSUMPTION]`** WXT's docs do not state whether `createShadowRootUi`'s root is **open or closed**. Both UX spines say *closed*. The distinction does not affect style isolation — it affects whether the host page's own JavaScript can reach in through `.shadowRoot`. **Verify before treating "closed" as delivered**; if WXT only offers an open root, either accept it (the threat model is a single operator on pages he chose to visit, not a hostile page) or wrap it ourselves. This is a one-line check, not a design risk.

### Initialization Command

```bash
pnpm dlx wxt@latest init          # template: react
```

Templates offered: Vanilla, Vue, React, Svelte, Solid — all TypeScript by default. Generated scripts: `dev`, `dev:firefox`, `build`, `build:firefox`, `zip`, `zip:firefox`, `postinstall`.

### Repository Shape — monorepo, two packages

```
sidepiece/
├── packages/
│   ├── extension/     # WXT + React. Ships to Chrome. Never ships to big-chungus.
│   ├── bridge/        # TypeScript/Node daemon. Ships to big-chungus under systemd --user.
│   └── contract/      # Shared types. Imported by both.
└── pnpm-workspace.yaml
```

**Why `contract/` is not optional.** FR-3's degraded-state taxonomy expanded from its self-declared six to **sixteen** during the UX run, and every one of those states is produced by the Bridge and rendered by the Cockpit across a network boundary. A taxonomy that drifts between the two halves produces exactly the failure the PRD spends FR-3 trying to prevent: a pane that fails in a way the other side has no word for. The same argument covers the Project Record shape, the Turn envelope, the classification enum and the correlation-id contract. `[ASSUMPTION: a shared package is the cheapest enforcement available. The alternative — mirroring types by hand across two repos — is what PRD §12 Q5's `project_id` / `pjid` name collision already demonstrates the cost of.]`

### Bridge Runtime — TypeScript / Node

Chosen so the `contract/` package is **real rather than mirrored**: one definition, imported by both sides, checked by the compiler on each. A Go binary would deploy more cleanly to `big-chungus` and handle concurrent WebSocket-plus-SSE more comfortably, but it would turn the shared contract into hand-maintained or code-generated duplication — and the contract is the thing most likely to rot, because it spans the one boundary neither side can see across.

Consequences to carry into step 4:

- **Node under `systemd --user` needs more care than a static binary.** A `node_modules` deployment on `big-chungus`, an explicit restart policy, and a pinned Node version in the unit.
- **FR-15's `curl`-inspectability is a design constraint on the HTTP surface, not a Node question** — it is why SSE was chosen downstream over a WebSocket, and that holds regardless of runtime.
- **The `tui_gateway` WebSocket leg stays server-side.** Worth stating explicitly now that Chrome 146+ is extending Local Network Access to WebSockets, WebTransport and WebRTC: that change cannot reach us as long as no socket runs browser-side. Any future design that moves one into the extension inherits the whole LNA question we just closed.

### UI Layer — React + Tailwind v4 + shadcn/ui

Matches the four most recent repos on this machine. The obvious objection is that `DESIGN.md` defines all 54 tokens from zero — paper, serif, a fluorescent spot spine — which is about as far from shadcn's defaults as a design system gets, so there is no library default to *override*.

**That objection is weaker than it looks, because shadcn is not a dependency.** The CLI copies component source into the repository, where it is ours to edit. The value taken is Radix's behavior — focus management, dismissal, `aria` wiring — which `EXPERIENCE.md`'s Accessibility Floor asks for and which is genuinely tedious to hand-roll. The value discarded is its appearance, which we are replacing wholesale rather than fighting incrementally.

Two concrete integration facts, both verified 2026-09-20:

- **Tailwind v4 is CSS-first: `tailwind.config.js` is gone.** Configuration lives in the main stylesheet under the `@theme` directive. This is a *better* fit for `DESIGN.md` than v3 would have been — its nested token paths become CSS custom properties directly, in one file, with no JS config mirroring them.
- **shadcn on Tailwind v4 uses OKLCH, and `DESIGN.md` is hex.** `shadcn@latest init` detects the Tailwind version and emits v4 output; its own migration converts HSL to OKLCH. So there is a **one-time, mechanical hex→OKLCH conversion** of the token set. `[NOTE FOR IMPLEMENTATION: convert once, at init, and keep `DESIGN.md`'s hex values as the documented source of truth with the OKLCH as generated output — not the other way round. Every contrast ratio in `DESIGN.md` was computed against the hex values, and a hand-edited OKLCH set would silently invalidate them.]`

**`[NOTE FOR PM: adopt shadcn primitives one at a time, as a component actually needs one.]`** Running the full `add` surface up front would drop dozens of components carrying a visual identity we are discarding, and SM-C2 counts feature surface as a cost. The Cockpit's real inventory is small — a composer, a list, a grouped list, a notice, a switch — and several of them are simpler hand-written than rethemed.

**Note:** project initialization using these commands should be the first implementation story.
