---
stepsCompleted: [1, 2, 3, 4, 5]
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

**Why `contract/` is not optional.** FR-3's degraded-state taxonomy expanded from its self-declared six to **twenty-two** during the UX run (`EXPERIENCE.md` defines DS-1 through DS-22), and every one of those states is produced by the Bridge and rendered by the Cockpit across a network boundary. A taxonomy that drifts between the two halves produces exactly the failure the PRD spends FR-3 trying to prevent: a pane that fails in a way the other side has no word for. The same argument covers the Project Record shape, the Turn envelope, the classification enum and the correlation-id contract. `[ASSUMPTION: a shared package is the cheapest enforcement available. The alternative — mirroring types by hand across two repos — is what PRD §12 Q5's `project_id` / `pjid` name collision already demonstrates the cost of.]`

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

---

## Core Architectural Decisions

*Step 4. Versions verified by web search on 2026-09-20. Where a claim is about code on this machine, it was read rather than recalled and the path is given.*

### Scope note — which of the standard categories actually apply

Four of step 4's five categories are largely pre-resolved or genuinely absent here, and saying so is more useful than filling them in:

- **Authentication & Security** — *not applicable by decision, not by omission.* PRD §5 makes the tailnet the trust boundary and specifies no app-level auth. There is one operator, no tenancy, no public surface (§7). The only security-shaped decision left is credential handling, which is FR-16 and lives under Infrastructure below.
- **API & Communication** — *fixed upstream.* FR-15 requires every Bridge capability be `curl`-inspectable, which is why the downstream is SSE rather than a WebSocket, and PRD §12 Q1 closed the upstream as JSON-RPC over WebSocket to `tui_gateway`. Rate limiting and API versioning have no constituency at one operator.
- **Infrastructure & Deployment** — *shaped by `systemd --user` on `big-chungus` and nothing else.* No CI/CD, no cloud, no scaling story.
- **Frontend Architecture** — *mostly decided in step 3 and by `EXPERIENCE.md`.* What remains is state ownership, below.

What is genuinely open is the set this document's own **Cross-Cutting Concerns** named, and those are decided here.

### Decision Priority Analysis

**Critical — block implementation**

| # | Decision | Choice |
|---|---|---|
| D1 | Turn store | `node:sqlite` on Node 24 LTS |
| D2 | Registry fallback | Last-good snapshot on disk, served with a staleness marker |
| D3 | Session eviction | LRU, small N (3–5 warm) |
| D4 | FR-9 result content | Fix the Bloodbank gateway first — cross-repo prerequisite |
| D5 | pjid orphan recovery | Key on pjid, carry clone path + board UUID as recovery metadata |
| D6 | Client state ownership | `EXPERIENCE.md` Rule 4 — Bridge owns correctness, `chrome.storage.local` owns convenience |

**Important — shape the architecture**

D7 schema versioning · D8 warm-session registry shape · D9 staleness threshold for D2 · D10 generation-stamp invalidation (FR-2)

**Deferred — post-MVP**

Everything in PRD §9. Note that the `[v2]` annotation batch's persistence was already decided by `EXPERIENCE.md` (`chrome.storage.local`, keyed by pjid and page URL, discharge being the only network crossing), so it does **not** become a Bridge storage decision later.

---

### Data Architecture

**D1 — The Turn store is `node:sqlite`, on Node 24 (Active LTS).**

FR-7's reopen guarantee, FR-9's closed-panel reconciliation and FR-11's per-Project history all force durable Turn state on the Bridge — this document's step 2 called that "the single fact that shapes more of this design than every latency budget combined." One daemon, one writer, one operator; there is no concurrency story that wants a server.

**The version detail is the whole reason this is a clean decision.** `node:sqlite` reached Stability 2 in Node **24.12.0** and has been on by default since 22.18, embedded in the Node binary. **There is no native module to compile.** That retires the cost this document booked against the Node runtime in step 3 — "a `node_modules` deployment on `big-chungus` [that] needs more care than a static binary" — because the one dependency that would have needed a toolchain on that box no longer exists. `better-sqlite3` and `sqlite3` are both unnecessary.

`[ASSUMPTION: pin Node 24 in the systemd unit rather than tracking latest. Node 26 becomes LTS on 2026-10-28 and there is no reason to ride that boundary for a single-operator daemon.]`

**D5 — What the store keys on, and why a rename must not be silent.**

The pjid is the join key, so rows are keyed by pjid. But this document's own dependency list records that **the pjid is mutable, author-controlled plain text, and renaming it deletes and re-keys the registry row** — so anything persisted by pjid orphans silently. That is recorded as a risk everywhere and answered nowhere.

Every persisted row therefore also carries **the clone path and the board UUID** at the time of write. Neither is a key; both are recovery metadata. A row whose pjid no longer resolves in the registry is not deleted and not silently ignored — it is *detectable*, and re-linkable by matching either field against the current registry. `[ASSUMPTION: this is cheap — two columns — and it converts a silent data-loss mode into a recoverable one. It does not make renames safe, it makes them survivable.]`

**D7 — Schema versioning is required even at one user.** A single operator does not excuse an unversioned schema, because the failure mode is not multi-user conflict, it is a Bridge that starts against a store it cannot read and has no vocabulary to say so. A `user_version` pragma and forward-only migrations at startup; a version the binary does not recognise is a named FR-14 health state, not a crash.

**D10 — FR-2's cache and its generation stamp.** The registry is a single ~33KB object measured at 2.4ms p50, so the cache exists for outage resilience and request amplification, not latency. Invalidated on: the generation stamp advancing, an explicit re-resolve from any FR-3 state, and the unreachable→reachable transition. `[NOTE FOR IMPLEMENTATION: that last trigger is what makes FR-15's "a Bridge restart does not require reloading the extension" true in practice.]`

---

### Resolution and Degradation

**D2 — The registry fallback is a last-good snapshot on disk.**

PRD §12 Q3 closed that the PRD's own named fallback does not work: `pj info <pjid>` calls the same HTTP service and exits 1 when it is down, failing in precisely the outage it was meant to cover. The replacement: the Bridge writes the registry payload to disk on **every successful fetch**, and serves that copy when the service does not answer.

Why this over reading `.project.json` off the filesystem directly — which *was* the more independent failure domain, and was rejected on drift grounds: it would reimplement pjangler's own indexing, including `normalizeProjectId` and the `project_id` / `project_slug` alias handling that PRD §12 Q5 already shows is subtle. Two implementations of one index diverge, and the divergence would surface as a wrong Project, which SM-3 makes the one unacceptable outcome.

Two things this decision requires:

- **The snapshot is never served silently.** It carries its fetch time, and a resolution served from it is marked stale in the same frame as the identity — FR-3 gains a state for it. A cache that looks healthy while the service is down is the failure this product's whole failure posture exists to refuse.
- **D9 — a staleness threshold.** Nineteen projects that change rarely means a day-old snapshot is almost certainly correct and a month-old one is a different claim. `[ASSUMPTION: surface the age rather than expiring the snapshot. Expiry turns a working degraded state into a broken one for no gain, and the operator is the only reader — he can judge "cached 3 days ago" better than a threshold can.]`

---

### Agent Session Management

**D3 — LRU, 3–5 warm sessions.**

The gateway enforces an active-session limit (error 4090) against ~37 profiles, and each warm session carries an agent with a large system prompt plus its own MCP children. This document already recorded that an eviction policy is **required, not optional**; this is that policy.

The tradeoff is against the product's worst wait. A cold session measures **7.1–17.1s** and must render the explicit `warming up the PM` state — the longest wait anywhere in Sidepiece. Holding exactly one warm session would pay that on *every* Project switch, which is the most common transition. Holding 3–5 keeps the two or three Projects actually in flight warm, and makes the cold start a first-visit cost rather than a per-switch one.

Cascading requirements this creates:

- **D8 — a warm-session registry keyed by pjid**, tracking last-Turn time and liveness. The Bridge owns it; it is in-memory, because a warm session does not survive a Bridge restart anyway.
- **Eviction must never take a session with a Turn in flight**, whether streaming or awaiting a dispatch outcome. Least-recently-used among *idle* sessions, and if every session is busy the new request waits rather than evicting live work.
- **4090 must still be handled, not merely avoided.** A count cap makes hitting the ceiling unlikely, not impossible — other Hermes consumers share those ~37 profiles. `[NOTE FOR IMPLEMENTATION: 4090 is a named FR-14 failure state with its own wording, not a retry loop.]`

---

### FR-9 and the Cross-Repo Prerequisite

**D4 — Fix the Bloodbank gateway before building FR-9.**

FR-9 requires a Dispatched Command to render its **result content**. It cannot today. Verified by reading the source on 2026-09-20:

`33GOD/bloodbank/services/hermes-gateway/bloodbank_hermes_gateway/adapter.py`, `send()` at line 684:

```python
async def send(self, chat_id, content, reply_to=None, metadata=None) -> SendResult:
    del chat_id, content, reply_to, metadata          # line 691
    return SendResult(success=True, message_id=str(uuid.uuid4()))
```

It `del`s the agent's response text and reports success. Correlation genuinely works — `correlationid`, `command_id` and `idempotency_key` are all copied onto outcome events — but the content was never carried.

The decision is to fix it at the source rather than ship around it. The reasoning that makes this the right call rather than the slow one: **FR-6 biases classification toward Dispatched Command when uncertain, and that bias is only safe because FR-9 promises the result comes back.** Shipping status-only would leave the classifier's *preferred* branch as its *degraded* branch — a product that quietly gets worse the more often it guesses the way it was designed to guess.

`[NOTE FOR PM: this puts a second repo on Sidepiece's critical path and bmad-create-epics-and-stories must carry it as an explicit prerequisite story against 33GOD/bloodbank, sequenced before any FR-9 story. It is also not Sidepiece-specific — every Bloodbank consumer that dispatches to an agent has been silently losing response text — so the fix has value beyond this project and should not be scoped as a Sidepiece patch.]`

`[NOTE FOR ARCHITECTURE: the third option — having the Bridge observe the dispatched command's output directly through its own tui_gateway session — was considered and not chosen, because dispatch travels the command gateway and chat travels the session, and they are not the same path. It was never verified either way. If the Bloodbank fix proves harder than it looks, that investigation is the fallback and it is worth an hour before accepting a status-only v1.]`

---

### Frontend Architecture

**D6 — State ownership is already settled, and is restated here because it is an architectural boundary, not a UI preference.**

`EXPERIENCE.md`'s Rule 4 draws it with a test that survives contact: **if losing the state would make the product *wrong*, it is the Bridge's; if losing it would only make the product *annoying*, it may be the client's.**

- **Bridge (system of record):** Turns, stream state, dispatch outcomes and their correlation, Ticket reads, the Project Record, resolution generation.
- **`chrome.storage.local` (per-operator continuity, no authority):** an unsent composer draft, pane selection, Ticket group collapse state, and the `[v2]` annotation batch pre-discharge.

This matters architecturally because PRD §5 says client state is "not persisted client-side", and Rule 4 is the reconciliation: that directive governs *system-of-record* state, not UI continuity. Both documents now say the same thing; a reader of one will not be surprised by the other.

Remaining frontend decisions are unremarkable and fall out of step 3: React state local to the panel document with no global store (the panel dies on collapse, so there is nothing long-lived to manage), and no router — the Cockpit is one Project and a pane switch, not a navigable surface.

---

### Infrastructure & Deployment

- **Runtime:** Node 24 LTS, pinned in the unit. No native modules, therefore no build toolchain on `big-chungus`.
- **Supervision:** `systemd --user`, matching every other service on that box, with an explicit restart policy.
- **Transport:** `tailscale serve` with a MagicDNS certificate. Recorded honestly in PRD §12 Q8 as *not* an LNA mitigation — it is worth having for the older mixed-content class and for ordinary reasons, and must not be mistaken for having closed Q7.
- **Credentials (FR-16):** resolved from the 1Password vault at startup, never written to a file. FR-14 must additionally detect **silent credential degradation** — a Hermes process without vault auth falls through to unresolved `op://` literals and downgrades to a fallback model, producing correct-looking answers at the wrong cost and latency. This is not hypothetical: `hermes-dashboard.service` ran in exactly that state from 2026-09-09 to 2026-09-17. **Nothing else will detect it, so FR-14 must.**
- **`X-Forwarded-For`:** `tailscale serve` rewrites the client address to `127.0.0.1`. Any logging or future origin check must read the forwarded header or it will see one client forever.

---

### Decision Impact Analysis

**Implementation sequence.** The ordering is forced by dependency, not preference:

1. **The Bloodbank gateway fix (D4)** — different repo, no Sidepiece dependency, and it unblocks FR-9. Start it first precisely because it is not on this repo's own path.
2. **`contract/`** — the twenty-two-state taxonomy (DS-1…DS-22), Project Record, Turn envelope, classification enum, correlation id. Everything else imports it.
3. **Bridge skeleton + `node:sqlite` store (D1, D5, D7)** — schema, versioning, recovery metadata.
4. **Registry client + snapshot fallback (D2, D9, D10)** — this is what makes FR-1 through FR-4 possible and it is where SM-3 is won or lost.
5. **Hermes session manager (D3, D8)** — warm-session registry, LRU eviction, 4090 handling.
6. **Extension shell** — WXT init, the identity header, the FR-3 state surface.
7. **Chat and Tickets panes** — last, because both sit on everything above.

Note this inverts EPIC A's June plan, which put scaffolding and a UI kit first; PRD §10 already directed sequencing it behind a working Bridge, and the dependency graph agrees.

**Cross-component dependencies worth stating explicitly:**

- **D1 → D5 → D7.** The store choice, its key strategy and its versioning are one decision wearing three hats; changing any forces the others.
- **D2 → FR-3.** The snapshot adds a rendered state. A fallback that does not surface itself violates the failure posture, so this is a contract change, not an internal optimisation.
- **D3 → FR-7's budget.** Eviction policy directly determines how often the operator meets `warming up the PM`. It is a UX decision implemented in the Bridge, and it should be tuned against SM-C1 rather than against resource usage alone.
- **D4 → epics.** The only decision here that creates work outside this repository.
- **D6 → both spines.** Already reconciled; the value is that it stays reconciled.

---

## Implementation Patterns & Consistency Rules

*Step 5. These exist to stop independent agents making different-but-defensible choices. The test for inclusion is not "is this good practice" but **"would two competent agents plausibly diverge here, and would the divergence be expensive?"** Ordinary style is delegated to tooling and deliberately absent.*

### Critical Conflict Points

Nine areas where divergence is both likely and costly. **The first is not hypothetical — it has already happened once in this project's own documents**, which is why it leads.

---

### P1 — Vocabulary is the type system. `pjid` is never `project_id`.

**This is the single highest-value rule in the document.** PRD §12 Q5 records a live name collision: pjangler's `project_id` is a **slug**, while `event-schemas.md` defines `project_id` as the provider **board UUID**. A Bridge that reads the manifest and emits per that contract writes a slug where a UUID is expected, and nothing catches it — both are strings.

| Rule | |
|---|---|
| **MUST** | Name the pjangler-sourced identifier `pjid`. Everywhere. Field names, column names, variable names, JSON keys, log keys, function parameters. |
| **MUST NOT** | Use `project_id`, `projectId`, `projectSlug`, `project`, or `id` for it — in any layer, including a local variable. |
| **MUST** | Name the Plane board UUID `boardId`, never `projectId`, even though Plane's own API calls it a project. |

`[NOTE: Plane's REST surface calls a board a "project". Sidepiece does not, per the §3 Glossary. Where a Plane response is destructured, rename at the boundary — the foreign name must not travel inward.]`

**PRD §3's Glossary is binding on identifiers, not just prose.** A synonym is called "a discipline violation" for documents; in code it is the same violation with a compiler that cannot see it.

| Glossary term | Identifier | Never |
|---|---|---|
| Turn | `Turn`, `turnId` | `Message`, `Chat`, `Exchange` |
| Streamed Exchange / Dispatched Command | `TurnKind.Streamed` / `TurnKind.Dispatched` | `stream`/`async`, `sync`/`job` |
| Ticket | `Ticket`, `ticketId` | `Issue`, `Card`, `Task` |
| Board | `Board`, `boardId` | `Project` (that is a pjangler Project) |
| Project / Project Record | `Project`, `ProjectRecord` | `Repo`, `Workspace` |
| Cockpit | `Cockpit` | `Panel`, `Sidebar`, `SidePanel` — except where naming Chrome's own API surface |
| Bridge | `Bridge` | `Server`, `Daemon`, `Api` |
| Agent / PM | `Agent`, `PM` | `Bot`, `Assistant` |

---

### P2 — Every failure is a `DsCode`. There are no ad-hoc error strings.

`EXPERIENCE.md` defines **DS-1 through DS-22** — each with its own trigger, its own pane-gating, its own exact wording and its own recovery affordance. That enumeration is the error model.

- **MUST** — the `contract/` package exports `DsCode` as a string union of the literals `'DS-1' … 'DS-22'`. The Bridge returns one; the Cockpit renders it. Adding a failure mode means adding a `DsCode` and its `EXPERIENCE.md` row **in the same change**, never a new free-text message.
- **MUST NOT** — the Bridge never sends user-facing prose. It sends a code plus typed parameters. **All copy lives in the Cockpit**, sourced from `EXPERIENCE.md`, because FR-3 requires each state be *separately worded* and a wording change must not require redeploying the daemon on `big-chungus`.
- **Exception, and it is deliberate:** remedy command text (DS-11's provisioning command, DS-14's board-binding command) **is** sent by the Bridge, verbatim as it composed it. `EXPERIENCE.md` records the reason — the Bridge knows the installed pjangler and Hermes surface, and a command the Cockpit invents goes stale the first time a flag changes.

```ts
// contract/src/state.ts
export type DsCode = 'DS-1' | 'DS-2' | /* … */ | 'DS-22'
export type Degraded = { ds: DsCode; params?: Record<string, string>; remedy?: string }
```

**Anti-pattern.** `throw new Error('bridge unreachable')` — untyped, unrenderable, and it collapses DS-3 (laptop off the tailnet) and DS-4 (`big-chungus` not answering) into one, which FR-3 explicitly requires be distinguishable.

---

### P3 — Bloodbank subjects: five tokens, no version, no identity.

`bb contract` is the authority. Getting this wrong is not a style issue — **a producer on an illegal subject publishes into the void and a consumer on one receives nothing.**

```
type     bloodbank.<domain>.<entity>.<action>          4 tokens
subject  bloodbank.<kind>.<domain>.<entity>.<action>   5 tokens, kind = evt|cmd|rpy
```

- **MUST NOT** — put a version token (`v1`) or an identity slug (a repo name, an agent id, a pjid) in a subject. Versioning lives **only** in `schemaref` / `dataschema`. Identity lives in `data.*` and `actor.*`.
- **MUST** — validate every new producer with `bb emit --check --type <type>` before publishing. `bb emit` derives `subject`, `schemaref`, `dataschema`, `kind`, `domain` and `actor` itself; do not hand-assemble them.
- **MUST** — implement any Project-scoped event view as a **`data.repo` payload filter through Candystore**, never a NATS subscription. The subscription form is unrepresentable in this grammar, and several documents across the fleet still describe it.

`[NOTE FOR PM: illegal forms are live right now, and one of them blocks FR-8 in practice. `agents/hermes/pm/role.yaml` — the manifest of the very PM that FR-7 and FR-8 target — subscribes to `bloodbank.evt.repo.sidepiece.>` and `bloodbank.cmd.agent.sidepiece-pm.>`, both embedding an identity slug as a token. A PM subscribed to an illegal subject receives nothing. `docs/product-brief.md` carries `bloodbank.evt.v1.repo.sidepiece.>` — version token *and* slug. Finding these is routine; **fix rather than imitate**.]`

---

### P4 — JSON casing splits at the Bloodbank boundary, and that is intentional.

Two conventions meet, and picking one globally would corrupt the other.

- **Sidepiece's own surfaces** — the Bridge's HTTP/SSE API and everything in `contract/` — are **`camelCase`**. It is TypeScript on both sides of the wire; a translation layer would exist only to satisfy a convention neither end uses.
- **Bloodbank envelopes keep Bloodbank's names, byte for byte.** `data.repo`, `actor.agent_id`, `command_id`, `idempotency_key`, and — note the spelling — **`correlationid`**, which has no separator and must not be "corrected" to `correlationId` or `correlation_id` when it is a Bloodbank field.
- **MUST** — rename at the boundary, once, in the adapter that touches Bloodbank. Foreign names never travel inward past that adapter, and Sidepiece names never travel outward past it.

**Anti-pattern.** A camelCase-ifying middleware applied to everything. It silently rewrites `correlationid` and breaks correlation — the one mechanism PRD §12 Q2 confirmed actually works today.

---

### P5 — Response shape: flat, because FR-15 means a human reads it.

FR-15 makes `curl`-inspectability a hard requirement, which makes the response body a **user interface**, not just a transport.

- **MUST** — success responses are the resource itself, unwrapped. `GET /v1/project/:pjid` returns a `ProjectRecord`, not `{ data: ProjectRecord }`. An envelope that exists to hold a `data` key makes every `curl` one `jq` deeper for no gain.
- **MUST** — degradation rides alongside, not instead: `{ …resource, degraded: Degraded[] }`. This is what lets a pane fail independently while the rest of the response stays usable, which is the failure posture stated as an NFR.
- **MUST** — HTTP status reflects the transport, `degraded[]` reflects the product. A resolved Project whose Board is unreachable is **`200` with a DS-19 in `degraded[]`**, not a `502` — because the Cockpit's chat pane is fine and a `502` would say otherwise.
- **MUST** — timestamps are ISO-8601 UTC strings. Readable in a terminal without conversion; epoch integers are not.
- **MUST** — SSE frames carry a named `event:` type and a JSON `data:` payload, one JSON object per frame, never a bare string. `curl -N` must produce something a person can follow live.

---

### P6 — SQLite naming, and the one place casing crosses.

- Tables: **plural `snake_case`** — `turns`, `dispatches`, `registry_snapshots`.
- Columns: **`snake_case`** — `turn_id`, `created_at`, `board_id`.
- **`pjid` stays `pjid`.** It is already lowercase and it is the join key; P1 outranks the casing convention. Never `project_id`, not even in SQL.
- **MUST** — map `snake_case` ↔ `camelCase` in exactly one repository layer per table. Never in a route handler, never twice.
- Timestamps stored as **ISO-8601 TEXT**, not integers. SQLite has no date type, this sorts lexically, and it keeps `sqlite3` CLI output readable — which is the same argument as FR-15, applied to the store.
- **MUST** — every persisted row carries `clone_path` and `board_id` alongside `pjid` (decision D5). These are recovery metadata, never keys.

---

### P7 — Loading, failure and retry are three different things, and never a spinner.

Directly enforcing the NFR *"no pane may render a failure as an empty state or a permanent spinner."*

- **MUST** — every async surface is a discriminated union, never a boolean pair:
  `{ status: 'idle' | 'loading' | 'ready' | 'degraded' }`. `isLoading` plus `error` admits the illegal `loading && error` state and invites exactly the spinner this product forbids.
- **MUST** — every in-flight state has a deadline and a terminal transition. Including under a DERP relay: the relay changes what the expiry *says*, never whether one exists.
- **MUST NOT** — auto-retry a Ticket create whose outcome is unknown. `EXPERIENCE.md` records that create is **not idempotent** — nothing in the source set gives Plane's create an idempotency key — so a retry after an unknown outcome can double-file. The honest path is the refetch control. `[NOTE FOR ARCHITECTURE: if the Bridge can mint an idempotency key for create, this rule relaxes and should.]`
- **MUST** — retry only idempotent reads, with backoff, and surface the attempt rather than hiding it.

---

### P8 — Log in the vocabulary, and never log a secret.

- **MUST** — structured JSON lines, with `pjid` as a top-level key on anything Project-scoped and `correlationid` on anything dispatch-scoped. These are the two keys that make a cross-component trace possible at all.
- **MUST** — a failure logs its `DsCode`. A log line describing a failure that maps to no `DsCode` is a missing state, not a log message.
- **MUST NOT** — log a resolved credential, ever. FR-16 resolves from the vault at startup; an `op://` reference is safe to log, its resolved value never is.
- **MUST** — read `X-Forwarded-For` for the client address. `tailscale serve` rewrites the peer to `127.0.0.1`, so anything reading the socket address logs one client forever.

---

### P9 — Structure: co-located tests, feature folders, one place for shared types.

- Tests **co-located** as `*.test.ts` beside the unit. One fewer tree to keep in sync, and an untested module is visible by absence.
- Bridge organised **by capability**, matching the component list from step 2 — `registry/`, `sessions/`, `tickets/`, `turns/`, `health/` — not by layer. Layer folders (`controllers/`, `services/`) scatter one capability across three places, which is precisely how two agents end up implementing half of it each.
- Extension follows **WXT's entrypoint convention** — `entrypoints/` for the content script, service worker and panel. Do not invent a parallel structure beside a framework that has one.
- **MUST** — anything crossing the network boundary lives in `contract/`, and **only** there. A type defined in `contract/` must never be re-declared in `extension/` or `bridge/`, however convenient the local copy looks.

---

### Enforcement

**Machine-checkable, and therefore not optional:**

- `contract/` is the only source of cross-boundary types — enforced by `tsc`, which is the entire reason D-decision 4 chose a shared package over mirrored types.
- Casing, formatting and import order → Biome or ESLint + Prettier. Not adjudicated here; delegated deliberately.
- **A lint rule banning the identifier `project_id` and the string `projectId` outside a Plane adapter is worth writing.** It is five lines and it forecloses the one mistake this project has already made once, in its own specification.
- `bb emit --check --type <type>` in CI, or in a pre-publish script, for every Bloodbank producer.

**Human-checked, because no linter can see it:**

- Does a new failure mode have a `DsCode` *and* an `EXPERIENCE.md` row? Both, same change.
- Does a new user-facing string exist in `EXPERIENCE.md`? If not, it is invented copy and the spine is the authority.
- Does a Glossary term appear under a synonym?

**When a pattern is wrong, change it here first.** These are load-bearing for consistency, not for correctness, so a pattern that fights the code is a pattern to fix — but fixed in this document, in one change, rather than worked around per file.
