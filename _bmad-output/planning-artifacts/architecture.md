---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
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
lastStep: 8
status: 'complete'
completedAt: '2026-09-22'
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
- **FR-6** (classify a Turn) is the premise of the entire chat feature and has no upstream equivalent — it is genuinely new behaviour this product must own. *(Step 7, D13: the rule lives in `contract/` and is evaluated by both sides — the Cockpit on every typing pause, the Bridge authoritatively at send. "The Bridge must own it" was the wrong half: FR-6 requires the answer visible **before commit**, which is where the caret is.)*
- **FR-15** makes curl-inspectability of every Bridge capability a hard requirement, which disqualifies any design whose only driver is the extension.

**Non-Functional Requirements:** 10 cross-cutting, of which four are genuinely shaping rather than aspirational — the trust boundary (tailnet, no app-level auth), failure posture (panes fail independently, never as an empty state), panel lifetime (the client dies), and the split latency budget.

The dominant constraint is not performance. It is that **the client is not durable**: the panel document does not survive closing, and the MV3 service worker is killed after ~30s idle. FR-7's reopen guarantee and FR-9's closed-panel reconciliation therefore both force the **Bridge to be the system of record for Turn state**. That single fact shapes more of this design than every latency budget combined.

**Scale & Complexity:** Three tiers with a network boundary through the middle — MV3 extension on a laptop, Bridge daemon on `big-chungus`, **seven** upstream services behind it. *(Six until step 7, which added the Hermes fleet registry — FR-5's "declared but not present in the fleet registry" state reads a different source from the gateway session, and nothing in the document owned it.)* Two distinct streaming protocols meet in the Bridge: JSON-RPC over WebSocket upstream, SSE downstream (SSE because FR-15 requires `curl -N` to tail it).

- **Primary domain:** full-stack — MV3 browser extension, local daemon, event-bus integration
- **Complexity level:** medium-high. Not enterprise — no tenancy, compliance, availability or scale requirements, and a single operator throughout. But not simple either: three tiers, a network boundary, two streaming protocols, asynchronous correlation, seven integrations, and a browser runtime with hard platform limits.
- **Estimated architectural components:** ~12 at step 2 — content script, extension service worker, panel document, Bridge HTTP/SSE server, registry client, Hermes session manager, Plane client, Bloodbank publisher, Candystore reader, Turn store, health aggregator, credential resolver. *(Step 7 note: the estimate held its shape but not its count. Steps 4–7 split the Candystore reader out of the Bloodbank publisher, and added a filesystem prober (`registry/paths.ts`), a Hermes fleet-registry reader (`sessions/fleet.ts`), a generation minter (`registry/generation.ts`), a Turn accept path (`turns/accept.ts`) and a dedicated SSE client in the panel (`lib/stream.ts`). **Fifteen to seventeen** is the honest figure. The estimate is left standing rather than rewritten because the delta is the useful part: every addition came from a requirement this document already carried and had not yet given an owner — which is exactly what steps 4–7 are for.)*

### Technical Constraints & Dependencies

Seven runtime dependencies (PRD §6). Discovered empirically on 2026-09-17 and binding on the design:

- **`tui_gateway`'s JSON-RPC surface is Hermes *internals*, not a published API.** Hermes is at 0.20.5 with `config_version` 37 against a latest of 39. An upgrade can rename methods out from under the Bridge. The Bridge must pin a Hermes release in its unit and treat a gateway protocol break as a named failure mode FR-14 reports — **`DS-26`, allocated in step 7**.
- **Warm sessions are capped and costly.** The gateway enforces an active-session limit (error 4090) against ~37 profiles on this machine, and each warm session carries an agent with a large system prompt plus its own MCP children. Session **eviction policy is required**, not optional. The cap surfaces as **`DS-24`**; the Bridge's *own* pool running out surfaces as **`DS-28`**, because the two have different fixes (D3, D15).
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

1. **Failure isolation under one authoritative taxonomy.** FR-3 owns the state list; FR-14 feeds it. Panes fail independently and never render a failure as empty or as a permanent spinner. *(Step 7: the taxonomy has **two** producers, not one — see A-P2 and D12. Six states were added in step 7, DS-23…DS-28.)*
2. **Identity discipline.** The pjid is the join key — mutable, path-decoupled, and colliding by name with `event-schemas.md`'s board-UUID `project_id`. The Bridge should name its field `pjid` and never `project_id`.
3. **Streaming lifecycle across two protocols and a non-durable client.** Upstream WS, downstream SSE, with a panel that closes and a service worker that dies. *(Step 7: the downstream `EventSource` is constructed **only in the panel document** — see § Architectural Boundaries and `lib/stream.ts`.)*
4. **Asynchronous correlation and reconciliation.** Self-minted correlation ids; outcomes merged on arrival, never assumed to follow their status.
5. **Credential resolution *and silent-degradation detection*.** A Hermes process without vault auth falls through to unresolved `op://` literals and downgrades to a fallback model, producing correct-looking answers at the wrong cost and latency while surfacing nothing. Verified live: `hermes-dashboard.service` ran in exactly that state from 2026-09-09 to 2026-09-17. FR-14 must detect it because nothing else will.
6. **Latency across a network hop.** Every measured figure to date is loopback-only; the tailnet hop is additive and unmeasured.
7. **Staleness and cache invalidation.** FR-2's bounded cache and FR-12's refetch — the product's own loop invalidates its own reads. *(Step 7 moved this cache off the Bridge; the 2026-09-22 ruling settled where it landed. FR-2's cache is the **extension's**, in `chrome.storage.local` keyed by pjid, read by the panel document **and** the service worker — see D10. The Bridge's on-disk snapshot (D2) is a different thing with a different job.)*
8. **Version coupling to an unpublished upstream protocol.** See the `tui_gateway` constraint above.

---

## Starter Template Evaluation

*Step 3. All versions and commands below were verified by web search on 2026-09-20 rather than recalled; where a claim is from documentation rather than from running it here, it says so.*

`[NOTE — step 7, 2026-09-22: the claim of verification was not true of every figure in this document. Step 4's three `node:sqlite` version facts were recalled, not read, and all three were wrong; they are corrected in D1 against the live Node 24 docs, re-read on 2026-09-22. WXT's `srcDir` default was likewise assumed and is corrected in A-P9. Both re-reads are dated where they land. Treat "verified" in this document as a claim that carries a date and a source, and nothing else as verified.]`

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

**Why `contract/` is not optional.** FR-3's degraded-state taxonomy expanded from its self-declared six to **twenty-two** during the UX run (`EXPERIENCE.md` defines DS-1 through DS-22), and to **twenty-eight** in step 7 (DS-23…DS-28, allocated by D2, D3, D7, D12 and D15). Most of those states are produced by the Bridge and rendered by the Cockpit across a network boundary; **seven are produced by the Cockpit itself** and never cross the wire at all — DS-1, DS-3, DS-4, DS-5, DS-16, DS-21 and DS-27 are conditions a Bridge structurally cannot observe, three of them decided before any request is made. *(Corrected in step 7; the original sentence said all of them were the Bridge's. See A-P2 for the split and the FR-3 row for the producers.)* A taxonomy that drifts between the two halves produces exactly the failure the PRD spends FR-3 trying to prevent: a pane that fails in a way the other side has no word for. The same argument covers the Project Record shape, the Turn envelope, the classification enum and the correlation-id contract. `[ASSUMPTION: a shared package is the cheapest enforcement available. The alternative — mirroring types by hand across two repos — is what PRD §12 Q5's `project_id` / `pjid` name collision already demonstrates the cost of.]`

### Bridge Runtime — TypeScript / Node

Chosen so the `contract/` package is **real rather than mirrored**: one definition, imported by both sides, checked by the compiler on each. A Go binary would deploy more cleanly to `big-chungus` and handle concurrent WebSocket-plus-SSE more comfortably, but it would turn the shared contract into hand-maintained or code-generated duplication — and the contract is the thing most likely to rot, because it spans the one boundary neither side can see across.

Consequences to carry into step 4:

- **Node under `systemd --user` needs more care than a static binary.** A `node_modules` deployment on `big-chungus`, an explicit restart policy, and a pinned Node version in the unit. *(Step 7: D17 answers this — the deploy artifact is a single bundled file, so there is no `node_modules` on that box and no dangling workspace symlink.)*
- **FR-15's `curl`-inspectability is a design constraint on the HTTP surface, not a Node question** — it is why SSE was chosen downstream over a WebSocket, and that holds regardless of runtime.
- **The `tui_gateway` WebSocket leg stays server-side.** Worth stating explicitly now that Chrome 146+ is extending Local Network Access to WebSockets, WebTransport and WebRTC: that change cannot reach us as long as no socket runs browser-side. Any future design that moves one into the extension inherits the whole LNA question we just closed.

### UI Layer — React + Tailwind v4 + shadcn/ui

Matches the four most recent repos on this machine. The obvious objection is that `DESIGN.md` defines all 54 tokens from zero — paper, serif, a fluorescent spot spine — which is about as far from shadcn's defaults as a design system gets, so there is no library default to *override*.

**That objection is weaker than it looks, because shadcn is not a dependency.** The CLI copies component source into the repository, where it is ours to edit. The value taken is Radix's behavior — focus management, dismissal, `aria` wiring — which `EXPERIENCE.md`'s Accessibility Floor asks for and which is genuinely tedious to hand-roll. The value discarded is its appearance, which we are replacing wholesale rather than fighting incrementally.

Two concrete integration facts, both verified 2026-09-20:

- **Tailwind v4 is CSS-first: `tailwind.config.js` is gone.** Configuration lives in the main stylesheet under the `@theme` directive. This is a *better* fit for `DESIGN.md` than v3 would have been — its nested token paths become CSS custom properties directly, with no JS config mirroring them.
- **Two files, and only one of them defines anything.** *(Added step 7; the original text said "in one file" and the tree then named two, each claiming `DESIGN.md` as its source with neither deferring to the other.)* `styles/tokens.css` is **the definition**: it carries `DESIGN.md`'s canonical block verbatim — the `:root` declarations including `color-scheme: light` in *both* modes, and the `@media (prefers-color-scheme: dark)` override with its thirteen declarations. `tailwind.css`'s `@theme` block **aliases those custom properties and never restates a value** (`--color-surface-panel: var(--surface-panel)`). This is not a style preference: the dark override is a media query and a `@theme` block cannot hold one, so a `@theme` that carried literal values would ship a Cockpit that never goes to Night Paper. `[NOTE FOR IMPLEMENTATION: `DESIGN.md` is explicit that fifteen of its thirty-two colour tokens change and seventeen do not, and that all five `overlay.*` tokens are byte-identical across modes — "in-page sheets are never dimmed." That makes the `[v2]` in-page layer's token set **the never-themed subset**, so its overlay stylesheet is scoped separately from the first commit rather than inheriting a themed `:root` it must then fight.]`
- **shadcn on Tailwind v4 uses OKLCH, and `DESIGN.md` is hex.** `shadcn@latest init` detects the Tailwind version and emits v4 output; its own migration converts HSL to OKLCH. So there is a **one-time, mechanical hex→OKLCH conversion** of the token set. `[NOTE FOR IMPLEMENTATION: convert once, at init, and keep `DESIGN.md`'s hex values as the documented source of truth with the OKLCH as generated output — not the other way round. Every contrast ratio in `DESIGN.md` was computed against the hex values, and a hand-edited OKLCH set would silently invalidate them.]`

**`[NOTE FOR PM: adopt shadcn primitives one at a time, as a component actually needs one.]`** Running the full `add` surface up front would drop dozens of components carrying a visual identity we are discarding, and SM-C2 counts feature surface as a cost. The Cockpit's real inventory is small — a composer, a list, a grouped list, a notice, a switch — and several of them are simpler hand-written than rethemed.

**Note — corrected in step 7, because this sentence and step 4's sequence said different things.** The **repo scaffold** is the first implementation story: pnpm workspace, `tsconfig.base.json`, `biome.json` (including the A-P1 `project_id` ban), `mise` tasks. That is sequence step 0 below, and it exists because sequence step 1's `contract/` is a workspace package and cannot be created without it. `pnpm dlx wxt@latest init` and `shadcn@latest init` are **not** part of that story — they happen at sequence step 6 with the extension shell. Scaffolding a WXT app four steps before anything renders buys a loadable stub and a month of drift; PRD §10 already directed sequencing the extension behind a working Bridge.

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
| D11 | The `(pjid, generation)` guard | Bridge-minted, content-addressed per pjid, persisted, carried by every mutating request |
| D12 | Bridge ↔ Cockpit contract drift | `CONTRACT_VERSION` exported from `contract/`, echoed on every response, compared once per open |
| D13 | FR-6 classification form | Verb allowlist in `contract/`, evaluated client-side, re-evaluated authoritatively at send |
| D14 | The pjid declaration contract | `<meta name="pjid" content="…">` in `<head>`, first in document order wins |

**Important — shape the architecture**

D7 schema versioning · D8 warm-session registry shape · **D9 snapshot age is surfaced, never enforced** · D10 FR-2's cache is the extension's, in `chrome.storage.local` keyed by pjid, with a stated TTL

**Added in step 7, because validation found them unspecified rather than undecided**

| # | Decision | Choice |
|---|---|---|
| D15 | Turn acceptance | A store write that returns `turnId` synchronously; session acquisition is behind the stream |
| D16 | Extension manifest surface | Broad host match, `sidePanel`/`storage`/`tabs`, no `activeTab`, no `debugger`, popup-less action, Bridge origin baked at build |
| D17 | Deploy artifact and unit shape | Single bundled file + a state directory outside the deploy tree + absolute paths in the unit |
| D18 | Credential failure posture | Resolution failure degrades to DS-8 and never exits non-zero; the degradation probe is specified |
| D19 | Dispatch outcome ingestion | Durable NATS consumer on the legal `invocation.*` subjects, filtered by self-minted `correlationId` |
| D20 | Ticket create | Bridge resolves the default entry state server-side; a Cockpit-minted `createKey` the Bridge dedupes on makes a retry safe |
| D21 | Ticket provider indirection | Read `ticket_provider.type` from the Project Record; Plane is the only v1 implementation |

**Deferred — post-MVP**

Everything in PRD §9. Note that the `[v2]` annotation batch's persistence was already decided by `EXPERIENCE.md` (`chrome.storage.local`, keyed by pjid and page URL, discharge being the only network crossing), so it does **not** become a Bridge storage decision later.

---

### Data Architecture

**D1 — The Turn store is `node:sqlite`, on Node 24 (Active LTS).**

FR-7's reopen guarantee, FR-9's closed-panel reconciliation and FR-11's per-Project history all force durable Turn state on the Bridge — this document's step 2 called that "the single fact that shapes more of this design than every latency budget combined." One daemon, one writer, one operator; there is no concurrency story that wants a server.

**The version detail is what makes this decision clean, and step 7 found all three of its numbers wrong.** Re-read against `https://nodejs.org/docs/latest-v24.x/api/sqlite.html` on **2026-09-22**, verbatim: the banner reads **"Stability: 1.2 - Release candidate"**, and the history table reads **"v24.15.0 — SQLite is now a release candidate"** and **"v23.4.0, v22.13.0 — SQLite is no longer behind `--experimental-sqlite` but still experimental."** So: *release candidate*, never Stability 2; *24.15.0*, not 24.12.0; *22.13.0*, not 22.18.

~~`node:sqlite` reached Stability 2 in Node 24.12.0 and has been on by default since 22.18.~~ The correction is kept visible rather than deleted, because the wrong numbers were stated with more confidence than the right ones deserve and the next agent should see that this document got it wrong once.

**The decision survives unchanged.** `node:sqlite` is embedded in the Node binary, so **there is no native module to compile**; `better-sqlite3` and `sqlite3` are both unnecessary; "one daemon, one writer" is still true. What the correction narrows is the claim about what that buys: it retires **the native-module toolchain** on `big-chungus`, not "the cost this document booked against the Node runtime in step 3." A Node deployment still needs a runtime, a deploy artifact and a unit — D17 is where that is actually answered.

**What the correction *adds* is a requirement.** A Release-candidate module sits outside Node's semver guarantee, so the step-4 `[ASSUMPTION]` about pinning is promoted:

- **MUST** — the systemd unit invokes an absolute path to a **pinned Node 24** binary, not `node` from `PATH` and not a `latest` alias. Node 26 becomes LTS on 2026-10-28; `mise` on this machine currently resolves `node/lts` to exactly **v24.15.0** and will move on its own. The exposure is live, not theoretical.
- **MUST** — `main.ts` asserts `process.versions.node` satisfies `>=24.15.0 <25` at startup and exits with a stated message if it does not. A drifted runtime must fail loudly at start rather than at the first `DatabaseSync` call, three hours into a session, as a `Degraded` nobody can attribute.

**D5 — What the store keys on, and why a rename must not be silent.**

The pjid is the join key, so rows are keyed by pjid. But this document's own dependency list records that **the pjid is mutable, author-controlled plain text, and renaming it deletes and re-keys the registry row** — so anything persisted by pjid orphans silently. That is recorded as a risk everywhere and answered nowhere.

Every persisted row therefore also carries **the clone path and the board UUID** at the time of write. Neither is a key; both are recovery metadata. A row whose pjid no longer resolves in the registry is not deleted and not silently ignored — it is *detectable*, and re-linkable by matching either field against the current registry. `[ASSUMPTION: this is cheap — two columns — and it converts a silent data-loss mode into a recoverable one. It does not make renames safe, it makes them survivable.]`

**D7 — Schema versioning is required even at one user.** A single operator does not excuse an unversioned schema, because the failure mode is not multi-user conflict, it is a Bridge that starts against a store it cannot read and has no vocabulary to say so. A `user_version` pragma and forward-only migrations at startup.

A version the binary does not recognise — a `user_version` *ahead* of the migrations this build carries, which is what a rollback produces — is **`DS-25`**, allocated in step 7. It is a rendered state, not a health-endpoint footnote: the Bridge starts, resolution and Tickets are storeless reads and stay live, and **Chat is gated**, because Turn history and Turn state are the store. Saying "a named FR-14 health state" and stopping was not enough — A-P2 gives that phrase a specific meaning (a `DsCode`, a row, a wording, a pane gate), and four places in this document used it as a way of not deciding.

**D10 — FR-2's cache lives in `chrome.storage.local`, keyed by pjid, and it has a TTL.** *(Rewritten twice. Step 7 moved this cache **off the Bridge**, which was right, and into the **Cockpit document's memory**, which was not; the closing section recorded that as S1. **Jarad ruled `chrome.storage.local` on 2026-09-22** and this is that decision. Both earlier obituaries are kept below, because each is a live constraint on any future attempt to move it again.)*

**Two constraints, and exactly one placement satisfies both.**

**Not the Bridge.** FR-2's own bound requires invalidation *"when Bridge health transitions from unreachable to reachable"*, and that is a transition **only the client can observe** — a Bridge that was unreachable was not running, and a process cannot notice its own absence. A cache on the Bridge cannot implement the one invalidation trigger its requirement names. That is blocker B1, and nothing about this ruling changes it.

**Not the panel document's memory either.** Three `EXPERIENCE.md` behaviours require this cache to outlive the document that reads it, and one of them requires it to be readable from a context that has no document at all:

- the reopen path — *"the identity header paints next, from cache … the difference between a reopen that feels instant and one that feels like a load"*;
- UJ-1 step 3 — *"the identity header is already painted from the FR-2 cache"*;
- the extension icon's **Resolvable** state, which fires *"or that is cached as resolved"* **with the Cockpit closed**. That state is produced by `entrypoints/background/icon.ts` in the service worker, which cannot read a panel document's memory — at that moment there is no panel document.

A cache in the panel document is empty at precisely the three moments it is read. And **D10's own TTL rationale was self-refuting**: five minutes chosen as "long enough that a dip-out-and-back reopen is served from cache", from a cache that is empty on every reopen. The number was right for a reason that could not be true, which is worse than a wrong number, because it survives review.

`chrome.storage.local` is the only store in the extension that survives panel teardown **and** Chrome restart **and** is readable from both the panel and the service worker. It is also what PRD FR-2 already describes: *"Resolution results are cached **per pjid** and the cache is explicitly bounded."* Keying by pjid is the requirement's own wording, not an invention here. So:

- **Storage: `chrome.storage.local`, one entry per pjid, under the key `fr2:<pjid>`.** Owned by `lib/cache.ts`, imported by the panel **and** by `entrypoints/background/icon.ts`. It does **not** go through `lib/storage.ts`: that module is D6's continuity tier — drafts, pane selection, collapse state — with no expiry and no staleness semantics, and merging the two would produce one module holding two different invalidation rules. Same browser API, separate keyspaces, separate reasons to exist.
- **An entry is `{ record: ProjectRecord, fetchedAt: string }`**, `fetchedAt` as an ISO-8601 UTC string per A-P5, and it is what the identity header's as-of marker renders from. **The generation is not a third field.** D11 put `generation` on `ProjectRecord`, so it is already inside `record`; a second copy beside it would be two numbers that can disagree about one fact, which is the shape of defect this document has already had once. The comparison that matters reads the one inside: `entry.record.generation < current` is stale, exactly as D11 defines stale.
- **TTL: 5 minutes — same number, and the rationale now holds.** `[ASSUMPTION: five minutes, unchanged in value and repaired in reasoning. The registry is nineteen rarely-changing Projects measured at 2.4ms p50, so the TTL is not protecting a slow read — it is the hard ceiling FR-2 demands, so that an unbounded "cached for the panel session" is unreachable and FR-3's stale states are reachable. Five minutes is long enough that a dip-out-and-back reopen (SM-C1's whole shape) is served from cache — **which is now a claim about something that can actually happen**, because the entry outlives the panel that wrote it — and short enough that a Project renamed while he is away costs one stale header for one reopen, marked as-of the whole time. Tune it against SM-C1 if reopens start feeling like loads.]`
- **Invalidated on:** TTL expiry; an explicit re-resolve from any FR-3 state (the `{components.reResolveControl}` bypasses the cache, per `EXPERIENCE.md`); a Bridge health transition from unreachable to reachable, which `lib/bridge.ts` observes and which is what makes FR-15's *"a Bridge restart does not require reloading the extension"* true in practice; and **the generation advancing for that pjid** (D11) — the Bridge echoes its current generation on every answer, so the client invalidates on *learning* an advance rather than on producing one. The original wording had the cached resolution invalidated by the stamp it had itself produced, which is circular and unimplementable.
- **Invalidation is a whole-entry delete, and the other context finds out.** *(New, and it is what durability costs as well as what it buys.)* One shared entry means two readers. `chrome.storage.onChanged` fires in every extension context, so the panel does not poll and the worker does not have to be alive at the moment of the write — it reads what is there the next time it wakes. **A write replaces the entry whole and never patches a field**: there is one writer per event and therefore nothing to merge.
- **It caches exactly one thing: the Project Record, for the identity header.** `EXPERIENCE.md`: "**The cache serves the header and nothing else** — no Ticket list, no Turn, ever." Every cached read renders with its as-of marker until the Bridge confirms. Durability changes nothing about that bound: a durable cache of *many* things would be a second system of record; this is a durable cache of **one** thing that is always labelled with its age.
- **Quota and orphans are not a consideration, and it is worth saying once so nobody re-opens it.** Nineteen Projects at one small JSON object each sits far under `chrome.storage.local`'s quota, so `unlimitedStorage` is **not** declared and D16's permission list is unchanged. A pjid renamed in pjangler orphans its entry — D5's problem in miniature — and the TTL collects it within five minutes, so no sweeper has to exist.
- **Its relationship to the D2 snapshot, in one sentence:** this cache is a *client-side copy of a good answer*, read first and always marked with its age; the Bridge's `registry/snapshot.ts` is a *server-side copy of the upstream*, read only when the pjangler Registry does not answer and always marked with its age — invalidating the cache never deletes the snapshot, and serving from the snapshot never populates the cache as fresh. Both are now durable, and that does **not** blur them: they sit on opposite sides of the tailnet and answer different questions.
- **`registry/cache.ts` stays deleted from the Bridge.** Unchanged by this ruling. There is nothing left for it to hold: the registry payload the Bridge fetches is one 33KB object it indexes in memory anyway, and its durable copy is the snapshot.

**The divergence from PRD §5, stated plainly rather than absorbed.** §5 says *"two Chrome windows mean two Cockpit documents with **independent caches** and independent resolution state."* One shared `chrome.storage.local` entry per pjid is **not** independent caches: two windows on the same Project read and write the same entry, so a re-resolve in one is visible to the other on its next read. **Independent *resolution state* survives intact** — each panel document still holds its own render, its own `(pjid, generation)` frame and its own SSE subscription, and nothing synchronises what is on screen. What is no longer independent is the *store behind the identity header*.

`[NOTE FOR PM: this wants carrying back into PRD §5, the way the three 2026-09-22 amendments were. §5's own `[ASSUMPTION]` treats per-window independence as **acceptable-because-rare** — "concurrent multi-window use is rare enough that per-window independence is acceptable" — rather than as a correctness property, and it goes on to say "if it proves otherwise, the Bridge already holds the state a shared model would need." So §5 describes independence as a consequence it was willing to live with, not a guarantee it was making. Sharing is arguably the **safer** direction: two windows cannot diverge on the identity header at all, and the clobbering §5 worried about does not arise, because the cache holds one Project Record per pjid and a write replaces it whole. Suggested amendment: "two Cockpit documents with independent resolution state, over a shared per-pjid resolution cache (architecture D10)."]`

`[NOTE FOR UX: `EXPERIENCE.md`'s Chrome-restart row lists *"the resolution cache's in-memory copy"* under **Not preserved**. As of this ruling it **is** preserved — that is the whole point of the move, and it is what makes the neighbouring Reopen rule 2 and UJ-1 step 3 implementable rather than aspirational. The row belongs under **Preserved**, beside drafts and pane selection, carrying the same qualifier they do: preserved, and still only good for five minutes. The multi-window row's "independent caches" needs the same correction as PRD §5's. Not edited here — the spines are yours.]`

**D11 — The `(pjid, generation)` guard, specified.** *(Added in step 7. Before it, "generation" appeared four times in this document and every one of them was a noun.)*

PRD §5 makes this the whole defence against acting on the wrong Project, and PRD §11 makes it SM-3's entire enforcement: "every mutating call carries `(pjid, generation)`, and both the panel and the Bridge refuse a mutation whose generation is stale." `EXPERIENCE.md` builds "one generation, one frame" on top of it. A mechanism carrying that much weight cannot be a word.

**What it is.** A `number`, minted by the **Bridge**, scoped **per pjid**, monotonically increasing and never reused. It is a revision number for the *Project Record*, not a counter of resolutions — and that distinction is the decision, not a detail. See "what stale means", below.

**When it advances.** On a successful registry fetch, the Bridge hashes the Project Record it derived for that pjid (repo name, clone path, board binding, agent bindings — the FR-4/FR-2 payload, nothing else). If the hash differs from the one persisted for that pjid, the generation increments and the new hash is stored. **If the hash is unchanged, the generation is unchanged**, however many times the record is re-resolved and by however many windows. A resolution served from the D2 snapshot never advances it: a stale copy is not new information.

**Where it is persisted.** A `resolutions` table — `pjid` primary key, `generation`, `record_hash`, `resolved_at`, plus D5's `clone_path` and `board_id` recovery metadata. Persistence is not optional: without it a Bridge restart resets every counter to 1 and a client holding 4 would out-rank the Bridge. It is the high-water mark, and it only ever goes up, including across a pjid that leaves and re-enters the registry.

**Where it travels.**

- `contract/src/project.ts` gains **`generation: number` on `ProjectRecord`**. Every resolution answer carries it; the Cockpit keys its render on `(pjid, generation)` as `EXPERIENCE.md` requires, and persists it **inside** the cached record rather than beside it — D10's cache entry holds the `ProjectRecord` whole, and two copies of one number are two things that can disagree (D10).
- **Every Bridge response for a resolved Project carries `generation` at the top level, not only resolution answers.** *(Added in step 7's validation pass — this was the one seam the remediation left open.)* PRD §5 requires *both* the panel and the Bridge to refuse a stale mutation, and `lib/bridge.ts` cannot refuse locally against a number it only learns when it re-resolves. Echoing it on every answer means a client that has done *anything* since the record changed already holds the current value, so the local pre-check is real rather than decorative. It also keeps the two refusals consistent: the client refuses on the same number the Bridge would have refused on, instead of on a stale copy that produces a *different* wrong answer. `[ASSUMPTION: one integer on every response is free, and it is the smallest carrier that makes the client-side half of the guard implementable. The alternative — a dedicated generation endpoint the client polls — adds a request per mutation to save four bytes per response.]`
- Every **mutating** row in the Turn store carries a `generation` column alongside `pjid`: `turns`, `dispatches`, `ticket_creates`. This is what makes "which Project was this actually written against" answerable after the fact, which is the only way SM-3 is ever audited.
- Every **mutating request** carries it — see A-P5's `(pjid, generation)` MUST. Mutating routes are pjid-scoped by path (`POST /v1/project/:pjid/turn`, `POST /v1/project/:pjid/ticket`) and the request body carries `generation` as a required top-level field. Not a header: FR-15 makes the request body a `curl` surface too, and a guard hidden in a header is a guard nobody types.

`[NOTE FOR PM: D11 deliberately reinterprets PRD FR-2's literal wording. FR-2 says "each resolution is stamped with a monotonically increasing generation number"; under D11 most resolutions do **not** advance it, because it is content-addressed. The sequence is still monotonic and still never reuses a value — what changes is that re-resolving an unchanged Project Record is not an event. The reason is in the next paragraph: a per-resolution counter makes the guard fire on the common case and stay silent on the dangerous one. This is a deliberate divergence from the PRD's letter in service of its stated intent (§5's "cost of being wrong"), and it should be reflected in the PRD rather than left as a discrepancy for someone to "fix" back.]`

**What "stale" means, and why a bare counter would have been wrong.** PRD §5 says two windows are *both* legitimately correct and v1 does not synchronise them. Under a naive per-resolution counter, window B merely re-resolving would advance the number and window A's perfectly valid mutation would be refused — the guard would fire on the common case and never on the dangerous one, and the operator would learn to ignore it. Because the generation is **content-addressed**, two windows holding different generations for one pjid means the Project Record genuinely changed between their resolutions, and the older one genuinely *is* acting against a Project it no longer describes. Stale is therefore defined exactly once: **`received < current` for that pjid.** Equal passes. Greater is impossible and is a Bridge bug, logged as one.

**The refusal's wire shape.** This is the one failure in the product that is deliberately **not** a `Degraded[]` — `EXPERIENCE.md` puts it in the normal-path table and says why: "the mutation is the thing that failed and nothing is degraded once it is refused."

```
HTTP/1.1 409 Conflict
{ "error": "stale_generation", "pjid": "<pjid>", "received": 4, "current": 5 }
```

`409` rather than `200`-with-a-code because A-P5's rule is that the status reflects the transport, and a refused write is not a degraded resource — nothing was written and no resource is being returned. The Cockpit renders `EXPERIENCE.md`'s exact sentence, keeps the text, and offers no re-resolve control, because re-resolution is the one action guaranteed to change nothing.

**Where it is enforced.** `registry/generation.ts` on the Bridge mints and compares; **every mutating route calls it before its capability**, which is the check FR-13's row now names. `lib/bridge.ts` attaches the generation on the client and refuses locally first, so the common case costs no round trip — PRD §5 requires *both* sides to refuse and the client-side check is the one the operator feels.

`[NOTE FOR PM: this is the mechanism SM-3 is measured against, so it wants a test of its own in the epics — two windows, one Project, rename the pjangler record between them, assert the older window's create is refused with `409 stale_generation` and its text survives. Step 4 called the registry leg the place "SM-3 is won or lost"; this is the check that wins it.]`

---

### Resolution and Degradation

**D2 — The registry fallback is a last-good snapshot on disk.**

PRD §12 Q3 closed that the PRD's own named fallback does not work: `pj info <pjid>` calls the same HTTP service and exits 1 when it is down, failing in precisely the outage it was meant to cover. The replacement: the Bridge writes the registry payload to disk on **every successful fetch**, and serves that copy when the service does not answer.

Why this over reading `.project.json` off the filesystem directly — which *was* the more independent failure domain, and was rejected on drift grounds: it would reimplement pjangler's own indexing, including `normalizeProjectId` and the `project_id` / `project_slug` alias handling that PRD §12 Q5 already shows is subtle. Two implementations of one index diverge, and the divergence would surface as a wrong Project, which SM-3 makes the one unacceptable outcome.

Four things this decision requires:

- **The snapshot is never served silently.** It carries its fetch time, and a resolution served from it is marked stale in the same frame as the identity. FR-3 gains a state for it: **`DS-23`**, allocated in step 7 — *Registry unreachable, resolution served from the last-good snapshot*, gating no pane, marking the header with the snapshot's age. A cache that looks healthy while the service is down is the failure this product's whole failure posture exists to refuse.
- **It is a file, not a table.** One JSON document — the registry payload plus its fetch timestamp — written to `<state-dir>/registry-snapshot.json` (D17 names the directory) on every successful fetch, read by `registry/snapshot.ts`. `[ASSUMPTION: a file. It is one blob with one writer, rewritten whole; a table buys nothing and couples the resolution leg — the leg that must work when everything else is down — to the Turn store's schema version. A-P6's `registry_snapshots` table is therefore deleted from A-P6's list; it named a table that does not exist.]`
- **This decision moves DS-6 and DS-7 across the total/partial line, and that has to be said out loud.** `EXPERIENCE.md`'s Rule 2 makes total-versus-partial the spine of the whole error model, and PRD §6 marks Registry failure **Total**: "Nothing resolves; the Cockpit cannot open." That was true of a Bridge with no fallback. It is not true of this one. **With a snapshot on disk, DS-6 and DS-7 become partial** — the Project resolves from the snapshot, the identity header renders marked stale, the panes stay live, and DS-23 carries the age. **With no snapshot on disk** — a Bridge that has never had a successful fetch — they remain **Total** and Rule 2 applies unchanged, header replaced by one shared notice, pane switch inert. `EXPERIENCE.md`'s DS-6 and DS-7 rows are corrected in the same change as this sentence, because step 4's own dependency note already said it: "D2 → FR-3. The snapshot adds a rendered state. A fallback that does not surface itself violates the failure posture, so this is a contract change, not an internal optimisation." A contract change that only one document knows about is the drift FR-3 exists to prevent.
- **D9 — snapshot age is surfaced, never enforced.** Nineteen projects that change rarely means a day-old snapshot is almost certainly correct and a month-old one is a different claim. `[ASSUMPTION: surface the age rather than expiring the snapshot. Expiry turns a working degraded state into a broken one for no gain, and the operator is the only reader — he can judge "cached 3 days ago" better than a threshold can.]` *(Renamed in step 7: the priority index called this "D9 staleness threshold for D2", which states the opposite of the decision. There is no threshold. That is the decision.)*

---

### Agent Session Management

**D3 — LRU, 3–5 warm sessions.**

The gateway enforces an active-session limit (error 4090) against ~37 profiles, and each warm session carries an agent with a large system prompt plus its own MCP children. This document already recorded that an eviction policy is **required, not optional**; this is that policy.

The tradeoff is against the product's worst wait. A cold session measures **7.1–17.1s** and must render the explicit `warming up the PM` state — the longest wait anywhere in Sidepiece. Holding exactly one warm session would pay that on *every* Project switch, which is the most common transition. Holding 3–5 keeps the two or three Projects actually in flight warm, and makes the cold start a first-visit cost rather than a per-switch one.

Cascading requirements this creates:

- **D8 — a warm-session registry keyed by pjid**, tracking last-Turn time and liveness. The Bridge owns it; it is in-memory, because a warm session does not survive a Bridge restart anyway.
- **Eviction must never take a session with a Turn in flight**, whether streaming or awaiting a dispatch outcome. Least-recently-used among *idle* sessions, and if every session is busy the new request waits rather than evicting live work — **for a bounded time**, see D15. The original sentence stopped at "waits", which is the unbounded in-flight state A-P7's second MUST outlaws and no `DsCode` could render.
- **4090 must still be handled, not merely avoided.** A count cap makes hitting the ceiling unlikely, not impossible — other Hermes consumers share those ~37 profiles. It is **`DS-24`**, allocated in step 7 — *the Hermes gateway's active-session cap is reached*, gating Chat only, worded for a cause the operator cannot fix by retrying. Not a retry loop.
- **A gateway that answers with the wrong surface is not a gateway that is down.** The pinned Hermes release can drift under the Bridge (step 2's first constraint), and a renamed JSON-RPC method produces a gateway that connects, answers, and refuses the call. That is **`DS-26`** — *the `tui_gateway` answered, but not with the surface this Bridge pinned* — gating Chat only, distinct from DS-13 (registered, not answering) because the fix is a version pin rather than a restart.

**D15 — A Turn is accepted by writing it down, not by acquiring a session.** *(Added in step 7. FR-7's first budget was never addressed architecturally, and the obvious implementation misses it by an order of magnitude.)*

FR-7 promises the turn is **accepted within 500ms** — "a visible 'the PM has your turn' state, distinct from a response", measured at 79ms against the live gateway — and D3 records a cold session at **7.1–17.1s**. A `POST /v1/project/:pjid/turn` that acquires the session before it answers blows that budget by a factor of fourteen on the transition D3 exists to make survivable, and no amount of eviction tuning fixes it, because the cold start is the point.

So the write path is split, and the split is a contract, not an optimisation:

- **`POST …/turn` is a store write.** It validates `(pjid, generation)` per D11, classifies per D13, writes the Turn row, and returns `{ turnId, kind, acceptedAt }` **synchronously**. Nothing upstream is touched on that path. This is what `the PM has your turn` renders from, and it is why that sentence can be honest at 79ms.
- **Session acquisition, warming and streaming all happen behind the SSE subscription**, keyed by `turnId`. `warming up the PM` is a frame on that stream, not a property of the POST. `EXPERIENCE.md`'s own card ordering already assumed this — `the PM has your turn` precedes `warming up the PM` on the same card — and this document never said it, which is exactly the kind of seam this step exists to close.
- **The all-sessions-busy wait is bounded at 20s, then terminal.** `[ASSUMPTION: 20 seconds. It has to exceed the worst measured cold start (17.1s) or it will fire on a legitimate warm-up and teach the operator that the state is noise; it has to be short enough that a Turn does not sit unanswered past the point he has moved on. It is the tuning value D3's own impact note says should be tuned against SM-C1 rather than against resource usage.]` On expiry the Turn is marked with **`DS-28`** — *every warm session is busy; this Turn was not started* — gating Chat only, kept separate from DS-24 because the fix differs: DS-24 means someone else is holding the gateway's cap, DS-28 means **your own** Projects are mid-Turn and one of them will finish.

---

### FR-6 Classification

**D13 — The classification rule is a verb allowlist, it lives in `contract/`, and the Cockpit evaluates it.** *(Added in step 7. PRD FR-6 and `EXPERIENCE.md` both say in the same words that the rule's form "is an architecture decision"; this document placed the classifier and never chose the form.)*

Three forms were on the table and the constraint that picks between them is not accuracy — it is **where the answer has to be available**. FR-6 requires the classification "visible on the composer **before the operator commits**", and `EXPERIENCE.md` pins recompute to "a typing pause, never on a keystroke", because "a control that flips under the caret mid-sentence is flicker that makes FR-6's whole pre-commit promise untrustworthy." Every typing pause is therefore a classification. An LLM pre-pass is a model call per pause — cost and latency per pause, and a budget PRD §5 never wrote. A Bridge-side rule is a tailnet round trip per pause, with the same missing budget and an in-flight state to render under the caret. **A verb allowlist is a pure function over the Turn text**, so it can be evaluated where the caret is, at zero latency, with no in-flight state to render and no budget to miss.

- The rule and its corpus live in **`contract/src/classify.ts`** — it crosses the boundary, so A-P9's MUST already required it to. One definition, imported by both.
- **The Cockpit evaluates it on a typing pause** and renders the result. The override pins until send, for that Turn only (FR-6).
- **The Bridge re-evaluates it authoritatively at send**, against the same function, and **honours an explicit override** rather than overriding it — FR-6 makes the override a product requirement, so a Bridge that second-guesses it is a Bridge that breaks the feature. The re-evaluation exists so a stale extension build cannot dispatch something the current rule would stream.
- **The acceptance set is `EXPERIENCE.md`'s six-Turn corpus, verbatim** — three per branch, four of them from FR-6 itself. They belong in `classify.test.ts` beside the rule. The shape the corpus encodes, in `EXPERIENCE.md`'s words: *a Turn that can be answered from knowledge is a Streamed Exchange; a Turn that asks for the world to change is a Dispatched Command.*
- **Unclassifiable goes to Dispatched Command**, per FR-6's stated bias, and the standing default on an empty composer is Dispatched Command. There is no blank state to render.

`[ASSUMPTION: a leading-verb allowlist plus an imperative-mood test, not a bag of keywords anywhere in the sentence. "what's in progress?" contains no allowlisted verb in leading position; "start on the resolver ticket" does. The six test cases are what keep this honest — a rule that passes them and stays five lines is worth more than one that generalises and cannot be read.]` `[NOTE FOR ARCHITECTURE: if the allowlist proves too blunt in daily use, the escalation is an LLM pre-pass **on send only**, never on a pause — the pre-commit display stays local, and the model becomes a second opinion at the one moment there is already a network call in flight.]`

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

**D19 — How the Bridge learns an outcome happened at all.** *(Added in step 7. `turns/reconcile.ts` existed to merge outcomes and nothing in the document gave the Bridge a way to receive one.)*

Two corrections meet here, and the first is one this document already made against itself. Step 2's own constraint list reads: "**Dispatch outcomes carry no repo or project**, so §6's `data.repo` filter holds for webhook events but not for agent dispatch. The Bridge must scope by a correlation id **it minted itself**." The Integration Points table then prescribed `data.repo` for Candystore anyway. The table is wrong; the constraint is right. PRD §12 Q2 says the same thing.

- **Ingestion is a durable NATS consumer on `bloodbank.evt.agent.invocation.*`** — legal five-token subjects carrying no identity, which is precisely what A-P3 permits. A-P3's prohibition is on **Project-scoped subject subscriptions** ("the subscription form is unrepresentable in this grammar"); a correlation-scoped consumer on an allowlisted subject is not that, and the distinction is worth stating because A-P3 read as a blanket ban on subscribing to anything.
- **Scoping is by `correlationId` alone**, matched against the outstanding set the Bridge persisted when it dispatched. Durable, because FR-9 requires outcomes that arrive while the panel is closed to be reconciled on next open — and the panel being closed is the normal case for a command that takes twenty minutes. The consumer's position survives a Bridge restart or the guarantee does not.
- **Candystore is the *backfill*, not the primary.** On startup and on any consumer gap, `candystore/reader.ts` queries outstanding correlation ids directly. This is the leg that makes a missed message recoverable rather than permanently unknown, and it is why Candystore gets its own adapter file rather than sharing Bloodbank's.
- **It has a module and a place in the sequence:** `bloodbank/outcomes.ts` (the consumer) and `candystore/reader.ts` (the backfill), built with FR-9 at sequence step 8.

`[ASSUMPTION: a durable consumer rather than a poll. A poll is simpler and would work — nineteen Projects and a single operator generate a trivial number of outstanding dispatches — but it puts a floor under FR-9's latency for no gain, and the backfill path already exists as the poll for the case that actually needs one.]`

---

### Frontend Architecture

**D6 — State ownership is already settled, and is restated here because it is an architectural boundary, not a UI preference.**

`EXPERIENCE.md`'s Rule 4 draws it with a test that survives contact: **if losing the state would make the product *wrong*, it is the Bridge's; if losing it would only make the product *annoying*, it may be the client's.**

- **Bridge (system of record):** Turns, stream state, dispatch outcomes and their correlation, Ticket reads, the Project Record, and the resolution generation it mints (D11).
- **`chrome.storage.local` (per-operator continuity and display acceleration — authority for nothing):** an unsent composer draft, pane selection, Ticket group collapse state, the `[v2]` annotation batch pre-discharge, and — **added 2026-09-22 by the S1 ruling** — **FR-2's explicitly bounded resolution cache**, keyed by pjid (D10).

**The tension in that last item is real, and it is answered here rather than fudged.** *(Step 7 invented a third tier — "the Cockpit document, in memory" — specifically to keep the cache out of this one, and argued that writing it to `chrome.storage.local` "would make it shared and durable, which is the opposite of both". Shared and durable is now the decision, so that argument has to be met, not deleted.)* A cache the identity header paints from *looks* like authority, and this tier is defined as having none. Three properties are what keep it a display accelerator rather than a second source of truth:

1. **The Bridge remains the system of record, and a cache miss is an ordinary resolve.** Nothing is reachable only from the cache. Delete the whole `fr2:` keyspace and the product is one frame slower and thereafter identical — which is Rule 4's test applied literally: losing it is *annoying*, never *wrong*.
2. **Every cached read is provisional and is labelled.** It renders with its as-of marker and is overwritten by the Bridge's answer in the same frame sequence. There is no state in which the operator is looking at a cached record and does not know that is what he is looking at.
3. **D11's generation makes a stale read *detectable* rather than silently wrong.** This is the property that actually settles it. The failure D6 exists to prevent is a client-held fact that quietly outranks the Bridge's; under D11 the Bridge echoes its current generation on **every** answer, so a cached record that no longer describes the Project is caught by comparison rather than by hoping the TTL was short enough. A second source of truth is one nobody can check against the first. This one is checked against the first on every answer the Bridge gives.

**So D6's conclusion stands, and it gains the sentence it never had.** **MUST — nothing in `chrome.storage.local` may be the *only* source of a rendered fact, and anything rendered from it carries its age.** That is what "authority for nothing" means operationally, and neither the draft nor the pane selection was ever demanding enough to force anyone to write it down. `[ASSUMPTION: this is a sharpening, not an amendment — the tier's rule is unchanged and the cache satisfies it. If a future decision wants to put something in this tier that cannot be re-fetched from the Bridge, or that renders without a marker, that decision **is** amending D6 and should say so in those words rather than arriving as a third tier.]`

This matters architecturally because PRD §5 says client state is "not persisted client-side", and Rule 4 is the reconciliation: that directive governs *system-of-record* state, not UI continuity. **That reconciliation now has to carry the resolution cache as well, and it does** — §5's directive and FR-2 are the same document, and FR-2 says "cached per pjid" with "a bounded cache", not "without persistence". What §5 forbids is client state the Bridge does not also hold; a bounded, labelled, re-fetchable copy of a record the Bridge owns is not that. Both documents still say the same thing; a reader of one will not be surprised by the other.

Remaining frontend decisions are unremarkable and fall out of step 3: React state local to the panel document with no global store (the panel dies on collapse, so there is nothing long-lived to manage), and no router — the Cockpit is one Project and a pane switch, not a navigable surface.

**D12 — `CONTRACT_VERSION`, because skew here is structural rather than accidental.** *(Added in step 7. `EXPERIENCE.md` closed its degraded-state section by handing exactly this to architecture: "**Bridge contract drift** — a Bridge older or newer than the Cockpit expects. Nothing in the source set specifies a version handshake. Not invented here; flagged for architecture." It went unanswered.)*

The document versioned the SQLite schema (D7) and nothing across the network boundary — the one boundary neither side can see across. And three facts make the skew *normal*: FR-15 requires that "restarting the Bridge does not require reloading the extension", the deploy is an rsync to a box the operator is not sitting at, and the extension is loaded unpacked and reloaded by hand. Every one of those is a way for the two halves to be at different commits, routinely.

- **`contract/` exports `CONTRACT_VERSION`** — a plain integer, bumped by hand in the same change as any breaking change to a type in `contract/`. Not the package version and not semver: two integers compare in one line and nobody has to adjudicate what "breaking" means in a minor.
- **The Bridge echoes it** on `GET /v1/health` and as an `X-Sidepiece-Contract` header on every response. The header is there so a `curl` of any route shows it without a second call, which is FR-15's whole argument applied to this.
- **`lib/bridge.ts` compares it once per open** — on the first call of a panel document's life — and again whenever health transitions unreachable→reachable, which is the exact moment a Bridge that was just redeployed comes back.
- **A mismatch in either direction is `DS-27`**, allocated in step 7: *the Bridge and the Cockpit are built against different contracts*. Gated **Total**, because a contract mismatch means no response body can be trusted to parse into what the pane expects, and a half-parsed Project Record is the confidently-wrong outcome PRD §5 exists to forbid. It names **which side is older**, because that is the entire fix: reload the extension, or redeploy the Bridge. It is produced by the **Cockpit** — the Bridge cannot know what the client was built against.

**D14 — The pjid declaration contract.** *(Added in step 7. PRD FR-1 delegates this explicitly — "exact attribute naming is an architecture concern" — and it is simultaneously the content script's input and the specification for whatever eventually closes PRD §12 Q4.)*

```html
<meta name="pjid" content="<pjid>">
```

- **`name=`, not `property=`.** `property=` is RDFa/OpenGraph's attribute; `name=` is the plain HTML one and is what `document.head.querySelector('meta[name="pjid"]')` reads. The attribute name is lowercase `pjid`, matching A-P1's identifier rule exactly — the declaration in the page and the field in the code are the same five characters, which is one fewer thing to get wrong.
- **Read path: `document.head.querySelector('meta[name="pjid"]')`, and nothing else.** In `<head>` only — PRD FR-1 requires it work "on a static page with scripting disabled", so a tag injected into `<body>` by page JS is out of contract by construction. No page JS is executed to obtain it.
- **The attribute name is matched case-insensitively; the attribute value is never normalised.** HTML lowercases attribute *names* at parse time, so `NAME="pjid"` is the same declaration — but a CSS attribute selector compares attribute *values* case-sensitively in an HTML document, so `<meta name="PJID" …>` is **not** matched by `meta[name="pjid"]` and is not a declaration. The `content` value is likewise passed through byte for byte: the pjid is author-controlled text and pjangler is the authority on what it means, so a Bridge that lowercases it resolves a different row.
- **Conflicting declarations: first in document order wins, and the conflict is not silent.** The content script reads all matches; if there is more than one **and they disagree**, it takes the first and reports the conflict alongside the resolution. Duplicates that agree are just duplicates. FR-1 requires re-detection when a page's declared pjid changes without a navigation, so this is reachable rather than hypothetical — a SPA that swaps its head tag can leave two behind for a frame.
- **An empty or whitespace-only `content` is treated as no declaration** (DS-1), never as a pjid. Step 2 already records the neighbouring bug this prevents: `board_id` is an empty string rather than null, and a truthiness check is the only one that works.
- **This string is the contract any emitter must satisfy.** Whatever closes PRD §12 Q4 — a pjangler recipe, a per-project template, a hand edit — emits exactly this and nothing else has to agree with it.

**D16 — The extension manifest surface.** *(Added in step 7. For a greenfield MV3 extension, the manifest is the only place several already-made decisions become real, and 660 lines never named one of them.)*

| Declaration | Value | Why |
|---|---|---|
| `host_permissions` | `<all_urls>` | PRD §5 decided it: "Sidepiece takes the broad match and accepts the permission prompt." A narrow allowlist reintroduces the origin coupling declaration-based resolution exists to remove. **This is also what step 2's LNA closure rests on** — extensions holding the correct host permissions are stated to be exempt, so the broad match is not only a detection decision, it is the transport's exemption. |
| `permissions` | `sidePanel`, `storage`, `tabs` | `sidePanel` for the Cockpit; `storage` for D6's tier — the continuity keys and, since the 2026-09-22 S1 ruling, FR-2's `fr2:<pjid>` cache (D10); `tabs` for `onActivated`/`onUpdated`, which is how FR-1's tab-switch requirement is satisfied at all. |
| `permissions` — **not** declared | `activeTab`, `debugger`, `webNavigation` | `activeTab` was deleted outright by the UX decision log on 2026-09-20 when the annotation image stopped being load-bearing; `chrome.debugger` was rejected in the same pass "with no fallback built"; `webNavigation` is unnecessary because the content script observes its own history transitions (see below). Declaring a permission nothing uses widens the install prompt for free. |
| `action` | declared, **no `default_popup`** | IA note (c): a `default_popup` displaces `setPanelBehavior({openPanelOnActionClick: true})`, and that toggle is the product's **only** close gesture — "nothing inside the Cockpit claims to close it, because nothing inside the Cockpit can." `setPanelBehavior` is called once at service-worker startup. |
| `commands` | **two**: `_execute_action` at `Alt+Shift+S`, `focus-ticket-title` at `Alt+Shift+N` | The budget is exactly four *suggested* shortcuts, each needing Ctrl or Alt, Ctrl+Alt banned. `EXPERIENCE.md` spends all four on Alt+Shift chords and marks two of them `[v2]` — `arm-picker` and `discharge-batch`. **v1 declares only the two v1 bindings.** A declared-but-dead shortcut occupies a slot Chrome will not give back and shows the operator a keystroke that does nothing, and there is zero headroom to recover it from. `_execute_action` is a reserved name and needs no handler — `setPanelBehavior` gives it its toggle behaviour — so `commands.ts` holds exactly one listener in v1. |
| `content_scripts` | one entry, `<all_urls>`, `document_idle` | Manifest-declared rather than `scripting.executeScript`, per addendum §C: it injects on every document load with no gesture and no round trip. |
| Bridge origin | **baked at build time** | `WXT_BRIDGE_ORIGIN` — `http://localhost:<port>` in dev, the MagicDNS name in the deployed build. There is no settings page (PRD §9 defers it) and no first-run surface (`EXPERIENCE.md`: "no onboarding screen, no welcome tab and no first-run Cockpit state"), so a runtime-configured origin has nowhere to be configured. A build-time constant matches "loaded unpacked, never published" and costs nothing. Whatever origin is baked must also be reachable under `host_permissions`, which `<all_urls>` covers. |

**SPA re-detection: `MutationObserver` on `<head>`**, which addendum §C names as the recommended default and which costs no additional permission. Not `chrome.webNavigation` — that is the service worker's view of a transition the content script can observe itself, and it costs a permission for the privilege. Not `popstate` alone, which fires on back/forward and never on a `pushState` call.

**The private-network CORS headers ship, as PRD §5 requires.** `Access-Control-Allow-Private-Network: true` on preflights, alongside ordinary CORS headers. Step 2's line about the host-permission exemption is a statement about the *expected* outcome of Q7, not a licence to drop the mitigation — PRD §5 calls it unconditional, the header is two lines on a route that already exists, and Q7 is a confirmation that has not been run yet on `carries-macbook-air`. Dropping a two-line mitigation on the strength of a mailing-list quote is the trade this project does not need to make.

---

### Infrastructure & Deployment

- **Runtime:** Node 24, pinned by absolute path in the unit (D1's MUST). No native modules, therefore no build toolchain on `big-chungus`.
- **Supervision:** `systemd --user`, matching every other service on that box, with an explicit restart policy.
- **Transport:** `tailscale serve` with a MagicDNS certificate. Recorded honestly in PRD §12 Q8 as *not* an LNA mitigation — it is worth having for the older mixed-content class and for ordinary reasons, and must not be mistaken for having closed Q7.
- **`X-Forwarded-For`:** `tailscale serve` rewrites the client address to `127.0.0.1`. Any logging or future origin check must read the forwarded header or it will see one client forever.

**D17 — The deploy artifact, the state directory, and the unit's environment.** *(Added in step 7. The deploy as originally specified — "build `bridge`, rsync to `big-chungus`, `systemctl --user restart`" — would not have produced a running Bridge, and had nowhere safe to put the Turn store.)*

Three concrete omissions, each of the "what would stop the unit coming up" kind:

- **`packages/contract` is a pnpm workspace dependency, which pnpm satisfies with a symlink.** An rsync of `packages/bridge` carries a dangling link and the daemon cannot resolve `contract` at import time — and A-P9 makes that import mandatory, not optional. **The deploy artifact is therefore a single bundled file**: `tsup`/`esbuild` bundles `packages/bridge` to `dist/bridge.mjs` with `contract` inlined, `node:*` external and nothing else to externalise (D1 already removed the only native dependency). One file rsyncs, has no `node_modules`, and makes the Bridge as deployable as the Go binary D1 gave up — which is the deployability argument the runtime choice actually cost, now paid back by the bundler instead of the runtime. `[ASSUMPTION: a bundle over `pnpm deploy --filter bridge --prod`, which would also work. The bundle wins because it is one file to reason about on a box the operator is not sitting at, and because an atomic replace of one file is a deploy that cannot be half-applied.]`
- **State lives outside the deploy tree, and that is what protects the Turn history.** `~/.local/state/sidepiece/` on `big-chungus`, holding `turns.db` (+ `-wal`, `-shm`) and `registry-snapshot.json`. The unit sets `WorkingDirectory=%h/.local/state/sidepiece` and `StateDirectory=sidepiece`. **If either file lands inside the rsync target, the next deploy overwrites the fact step 2 calls the one that "shapes more of this design than every latency budget combined."** The deploy target is `~/.local/lib/sidepiece/bridge.mjs`; the two directories never intersect.
- **The unit's environment is explicit, because `systemd --user` gets a minimal one and not the login shell's `PATH`.** The Bridge shells out to `bb` (A-P3's `bb emit --check`) and `op` (FR-16). Both are named by **absolute path** in the unit's `Environment=`, as is `node` in `ExecStart=`. A unit that inherits `PATH` works when it is started by hand from a terminal and fails at boot, which is the worst possible shape for this failure.

**D18 — Credential resolution is not fatal, and the degradation probe is specified.** *(Added in step 7. "FR-14 must detect it" was asserted four times, given a filename, and never given a mechanism — and the startup-only framing made DS-8 unreachable.)*

- **Resolution happens at process start *and* per request.** PRD FR-16 says "at process start **or per-request**", and `EXPERIENCE.md`'s DS-8 resolves "at the next Bridge start **or per-request retry**". Startup-only drops the half both documents rely on. Startup resolution populates the Bridge's in-process **credential** cache — a different thing from FR-2's, which is the extension's (D10); a capability whose credential is missing retries the resolution on its next call.
- **A failed resolution degrades; it never exits non-zero.** This is the correction that matters. DS-8's wording — `The Bridge started without <credential>. <dependency> can't be trusted.` — *requires* a Bridge that is up and answering while a credential is missing, and PRD FR-16 confirms it: "a failed credential resolution surfaces as an unhealthy dependency in FR-14, naming which one." With an "explicit restart policy" and nothing said, an implementer will reasonably exit non-zero — and the operator then sees **DS-4** (`big-chungus` isn't answering) instead of **DS-8**. Wrong sentence, wrong fix, in the exact failure class this whole concern exists for.
- **The silent-degradation probe, concretely.** On each health check, `health/degradation.ts` does two things and reports them separately:
  1. **Asserts no resolved config value still matches `^op://`.** An unresolved reference that survived into a live config *is* the failure — this is the cheap half and it catches the `hermes-dashboard.service` case directly.
  2. **Compares the PM session's *reported* provider and model against the profile's *expected* provider and model**, read from the Hermes profile the Bridge is pinned against. A session answering on a fallback model is the failure that "produces correct-looking answers at the wrong cost and latency"; nothing else on the machine compares those two strings.
  Either assertion failing is **DS-8**, named with the credential and the dependency it feeds. `[ASSUMPTION: the gateway reports the resolved model per session. If it does not, the first probe still stands alone and the second becomes a note in the epics — but it is the one worth the hour, because it is the half that catches a *wrong* answer rather than a *missing* key.]`
- **Where the bootstrap token lives.** "Never written to a file" cannot be literally true of the 1Password service-account token itself — `.env.op` holds `op://` references, and something has to hold the credential that resolves them. It is passed to the unit with **systemd `LoadCredential=`**, reading from a root-owned file outside the repo; the Bridge reads it from `$CREDENTIALS_DIRECTORY` at startup and never logs it (A-P8). `LoadCredential=` over an `EnvironmentFile=` because a credential in the environment is visible to every child process the Bridge spawns, and it spawns `bb` and `op` by design.

---

### Tickets

*Added in step 7. `EXPERIENCE.md` handed two `NOTE FOR ARCHITECTURE` items to this document about the create path; one was never acknowledged and the other was forwarded back in the same words it arrived in.*

**D20 — The Bridge resolves the default entry state, and mints a create key.**

- **Default entry state is resolved server-side.** FR-13 says an omitted target state "uses the Board's default entry state" without saying who resolves it. The Bridge does: it already derives the Board from the pjid, so it is the only component that can. `POST …/ticket` with no `state` applies the Board's default and **the created Ticket comes back carrying the state it was assigned**, which is what `EXPERIENCE.md`'s "Ticket created" row renders. This is load-bearing rather than tidy: it is what licenses the create box to be **live before the Board read lands** (Reopen rule 4), and holding the submit until the Board arrives "costs UJ-1 its entire margin."
- **Create is deduped on a `createKey`, and that answers the question A-P7 was forwarding to itself.** Plane's REST create exposes no idempotency key, so Sidepiece supplies the missing half itself: a `createKey` UUID **minted by the Cockpit at submit**, carried on the request, and recorded by the Bridge on the `ticket_creates` row alongside `(pjid, generation, board_id)`. A create carrying a `createKey` already recorded returns the Ticket that key produced rather than filing a second one. The key is minted client-side and the dedupe is owned server-side, and that division is the whole mechanism: a key minted by the Bridge would be new on every attempt, which is exactly the property a retry must not have.
- **What that changes, and what it deliberately does not.** A-P7's `MUST NOT — auto-retry a Ticket create whose outcome is unknown` **relaxes for the Bridge's own retries**: the Bridge may safely re-issue its own write. It does **not** change what the Cockpit offers. `EXPERIENCE.md`'s "Ticket created, not renderable" row still clears the field and points at the refetch, because that row is the operator-facing contract and rewriting it is a UX decision, not an architecture one. `[NOTE FOR UX: the precondition your row asked for now exists — "if the Bridge can mint an idempotency key for create, this state gains a safe retry and should." It can, and it does. Whether the row now offers one is yours.]`

**D21 — The ticket provider is read from the Project Record, not hardcoded.**

Addendum §B.3: "`.project.json` already models the provider abstractly (`ticket_provider.type`), and the Hermes PM ships a provider shim… The abstraction already exists upstream; ignoring it creates a second model of the same thing." Adopted, at the cost of one field and one switch: `ProjectRecord` carries `ticketProvider`, `tickets/index.ts` dispatches on it, and `tickets/plane.ts` is the only implementation in v1. An unrecognised provider renders **DS-14**'s no-Board treatment with the provider named, rather than a crash — a Project bound to something Sidepiece cannot read is, from the Tickets pane's point of view, a Project with no Board it can use.

This is deliberately the *thinnest* form of the indirection: one field read and one branch, no provider interface, no registry, no second implementation. Speculative generality is what SM-C2 counts as cost. What this buys is that the second provider is a file rather than a refactor, and that Sidepiece is not the component that forgets `.project.json` already answers this question.

---

### Decision Impact Analysis

**Implementation sequence.** The ordering is forced by dependency, not preference:

0. **Monorepo scaffold** — pnpm workspace, `tsconfig.base.json`, `biome.json` including the A-P1 `project_id` ban, `mise` dev/build/deploy tasks. *(Added in step 7. Step 1 below is a workspace package and cannot exist without this; step 3's own step-3 note said project initialization was "the first implementation story" and meant this, not WXT.)*

**0b. The pjid emitter, and the dev fixture FR-1 is tested against.** *(Added in step 7. PRD §12 Q4 — "what emits the `pjid` declaration into served pages?" — is called a **sequencing risk on the critical path** that "gates every success metric in §11", and this document never mentioned it. `EXPERIENCE.md` Gap 8 repeats it: it "decides whether DS-1 is an edge case or the product's default state.")* Two deliverables, and they are not the same size. **The fixture is Sidepiece's own to build**: a static local page carrying a known pjid, served by the dev task, with a second page carrying none and a third carrying two conflicting declarations — those three are FR-1's and D14's acceptance set and they cost an afternoon. **The emitter is not an architecture decision** and is carried as an open item below, but at least Sidepiece's own repo and one served surface must emit the meta tag before FR-1 through FR-4 can be demonstrated against anything real. Sequenced beside D4 for the same reason D4 is sequenced first: it is off this repo's path and it blocks acceptance rather than implementation.

1. **The Bloodbank gateway fix (D4)** — different repo, no Sidepiece dependency, and it unblocks FR-9. Start it first precisely because it is not on this repo's own path.
2. **`contract/`** — the twenty-eight-state taxonomy (DS-1…DS-28, split by producer per A-P2), Project Record incl. `generation` (D11), `CONTRACT_VERSION` (D12), Turn envelope, the classification rule and its corpus (D13), correlation id. Everything else imports it.
3. **Bridge skeleton + `node:sqlite` store (D1, D5, D7)** — schema, versioning, recovery metadata, the `resolutions` table and the `generation` columns (D11), the Node-version startup assertion (D1).
4. **Registry client + snapshot fallback (D2, D9, D10, D11, D14)** — this is what makes FR-1 through FR-4 possible and it is where SM-3 is won or lost. The generation mint and compare belong here, not later: it is the one thing in the document SM-3 is enforced by.
5. **Hermes session manager (D3, D8, D15)** — warm-session registry, LRU eviction, the bounded pool wait, 4090 and gateway-drift handling.
6. **Extension shell (D16)** — WXT init, the manifest surface, the service worker's four jobs, the identity header, the FR-3 state surface.
7. **Chat and Tickets panes (D13, D20, D21)** — because both sit on everything above.
8. **Dispatch outcome ingestion (D19, and D4's landing)** — last, because it is the only leg whose upstream is still being fixed while the rest is built.

Note this inverts EPIC A's June plan, which put scaffolding and a UI kit first; PRD §10 already directed sequencing it behind a working Bridge, and the dependency graph agrees. Note also that step 0 is a *scaffold*, not a UI kit — it produces no component and no page.

`[NOTE FOR PM: two prerequisites now sit off this repo's path, not one. D4's Bloodbank gateway fix is the first and already carried. The second is `agents/hermes/pm/role.yaml`, whose two illegal subscriptions are recorded in A-P3 — **not** as an FR-8 blocker (see the correction there), but as a live defect in the manifest of the very PM this product targets, which will be discovered by whoever builds FR-7 and will cost an hour of the wrong debugging if it is not fixed first. Carry it as a small prerequisite story, not as a blocker.]`

**Cross-component dependencies worth stating explicitly:**

- **D1 → D5 → D7.** The store choice, its key strategy and its versioning are one decision wearing three hats; changing any forces the others.
- **D2 → FR-3.** The snapshot adds a rendered state. A fallback that does not surface itself violates the failure posture, so this is a contract change, not an internal optimisation.
- **D3 → FR-7's budget.** Eviction policy directly determines how often the operator meets `warming up the PM`. It is a UX decision implemented in the Bridge, and it should be tuned against SM-C1 rather than against resource usage alone.
- **D4 → epics.** The only decision in step 4 that creates work outside this repository. Step 7 adds a second (the pjid emitter, sequence step 0b) and a third, smaller one (`role.yaml`).
- **D6 → both spines.** Already reconciled; the value is that it stays reconciled.
- **D10 → D11 → SM-3.** *(Added in step 7; re-checked 2026-09-22 when D10 moved to `chrome.storage.local`.)* The cache's placement, the generation's definition and the metric are one mechanism. Moving the cache **client-side** is what lets the generation invalidate it on *learning* an advance — and `chrome.storage.local` is still client-side, so that leg is undisturbed. Making the generation **content-addressed** rather than a request counter is what stops a mutation being refused merely because another window re-resolved, and the S1 ruling makes that matter **more**, not less: both windows now read the same entry, so a per-resolution counter would have churned it on every read in either window. Change either and SM-3's enforcement changes with it.
- **D2 → Rule 2.** *(Added in step 7.)* The snapshot does not only add a state, it moves DS-6 and DS-7 across `EXPERIENCE.md`'s total-versus-partial line whenever a snapshot exists. That is a change to the failure *posture*, which is the most expensive kind of change to make silently, and it is why `EXPERIENCE.md` was edited in the same change as this document.
- **D12 → FR-15.** *(Added in step 7.)* "Restarting the Bridge does not require reloading the extension" is exactly the condition under which the two halves end up at different contracts. The requirement that makes the product pleasant is the requirement that makes skew routine, so the handshake is not optional overhead.
- **D13 → SM-C1 and FR-6 together.** *(Added in step 7.)* Putting the classifier client-side is what removes a network round trip from every typing pause. A Bridge-side rule would have made the composer's most frequent interaction the product's chattiest one.

---

## Implementation Patterns & Consistency Rules

*Step 5. These exist to stop independent agents making different-but-defensible choices. The test for inclusion is not "is this good practice" but **"would two competent agents plausibly diverge here, and would the divergence be expensive?"** Ordinary style is delegated to tooling and deliberately absent.*

**These patterns are written and cited as `A-P1…A-P9`, and the prefix is not decoration.** *(Qualified 2026-09-22, closing S4.)* `EXPERIENCE.md` carries 22 `P<n>` references of its own that predate this document, so a bare `P<n>` resolved to two different rules depending on which file the reader had open. **An unprefixed `P<n>` is the UX spine's; an `A-P<n>` is this document's.** Inside this document the short form was never ambiguous — which is exactly why it was worth fixing, because the reader who gets it wrong is the one holding the other file.

### Critical Conflict Points

Nine areas where divergence is both likely and costly. **The first is not hypothetical — it has already happened once in this project's own documents**, which is why it leads.

---

### A-P1 — Vocabulary is the type system. `pjid` is never `project_id`.

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

### A-P2 — Every failure carries a typed code. There are no ad-hoc error strings.

`EXPERIENCE.md` defines **DS-1 through DS-28** — each with its own trigger, its own pane-gating, its own exact wording and its own recovery affordance. That enumeration is the error model. *(DS-23…DS-28 were allocated in step 7 by D2, D3, D7, D12 and D15, and their `EXPERIENCE.md` rows were written in the same change — which is this pattern's own rule, applied to this pattern.)*

- **MUST** — the `contract/` package exports `DsCode` as a string union of the literals `'DS-1' … 'DS-28'`, **split by producer**. Adding a failure mode means adding a `DsCode` and its `EXPERIENCE.md` row **in the same change**, never a new free-text message.
- **MUST** — a `DsCode` has exactly one producer and the type says which. *(Corrected in step 7; this pattern used to read "The Bridge returns one; the Cockpit renders it", and six of the twenty-two were conditions the Bridge can never observe — three of them decided before any request is made.)* `BridgeDsCode` is what a Bridge response may carry in `degraded[]`; `ClientDsCode` is what the extension produces without asking anyone. `DsCode` is their union and is what `StateNotice.tsx` renders. The split is enforced by `tsc`: a Bridge route cannot emit `DS-1` because `Degraded['ds']` is `BridgeDsCode`.
- **MUST NOT** — the Bridge never sends user-facing prose. It sends a code plus typed parameters. **All copy lives in the Cockpit**, sourced from `EXPERIENCE.md`, because FR-3 requires each state be *separately worded* and a wording change must not require redeploying the daemon on `big-chungus`.
- **Exception, and it is deliberate:** remedy command text (DS-11's provisioning command, DS-14's board-binding command) **is** sent by the Bridge, verbatim as it composed it. `EXPERIENCE.md` records the reason — the Bridge knows the installed pjangler and Hermes surface, and a command the Cockpit invents goes stale the first time a flag changes.
- **Three failures are typed but are deliberately *not* `DsCode`s, and the type system says so.** *(Added in step 7.)* `EXPERIENCE.md` keeps them outside the DS taxonomy on purpose and each has its own code space in `contract/src/state.ts`: the **stale-generation refusal** (`Refusal`, D11 — "a mutation-scoped refusal, not a degraded state"), **SSE not established** (`SubscriptionState` — "a property of this open, not of the Project"), and the icon's **gesture transient** (`IconTransient` — "one transient, not a fifth state"). Naming them as code spaces is what keeps the rule "every failure carries a typed code" true without pretending they are DS rows.

```ts
// contract/src/state.ts
export type BridgeDsCode = 'DS-2' | 'DS-6' | /* … */ | 'DS-26' | 'DS-28'
export type ClientDsCode = 'DS-1' | 'DS-3' | 'DS-4' | 'DS-5' | 'DS-16' | 'DS-21' | 'DS-27'
export type DsCode      = BridgeDsCode | ClientDsCode
export type Degraded    = { ds: BridgeDsCode; params?: Record<string, string>; remedy?: string }
export type Refusal     = { error: 'stale_generation'; pjid: string; received: number; current: number }
```

**Copy is three files, not one.** *(Added in step 7.)* `copy/states.ts` holds the twenty-eight DS strings. `copy/progress.ts` holds the roughly twenty-five normal-path strings `EXPERIENCE.md` specifies that carry no DS code — `Reading the Board.`, `This Board is empty.`, `the PM has your turn`, `warming up the PM`, `Created, but the Board read didn't come back. Refetch to see it.`, `No outcome after <window>. Status unknown.` — plus the three non-DS typed codes above. `copy/icon.ts` holds the four extension-icon titles, including PRD §5's literal `this tab is resolvable`, and the gesture transient. All three are sourced from `EXPERIENCE.md` and none of them is a place to invent a sentence; the enforcement rule below ("does a new user-facing string exist in `EXPERIENCE.md`?") now has somewhere to point for every string in the product rather than for twenty-eight of them.

**Anti-pattern.** `throw new Error('bridge unreachable')` — untyped, unrenderable, and it collapses DS-3 (laptop off the tailnet) and DS-4 (`big-chungus` not answering) into one.

**On DS-3 versus DS-4, precisely, because the original wording overstated FR-3.** *(Corrected in step 7.)* FR-3 reads "distinguishes … **where the two are distinguishable**", and `EXPERIENCE.md` supplies DS-5 for the case where they are not. **v1 has no reliable in-browser discriminator**: a `fetch` to an unreachable host fails as an opaque `TypeError` whether the tailnet is down or the host is, and an extension cannot query Tailscale. **So DS-5 is what v1 ships**, and DS-3/DS-4 become reachable the moment a discriminator exists. `[ASSUMPTION: the candidate discriminator is DNS — MagicDNS failing to resolve `big-chungus.burro-salmon.ts.net` at all means the tailnet is not up on this machine (DS-3), while resolving and then failing to connect means the host is not answering (DS-4). Worth ten minutes to check whether the failure modes are distinguishable from an extension context; if they are, DS-3 and DS-4 light up for free and the sentences already exist.]`

---

### A-P3 — Bloodbank subjects: five tokens, no version, no identity.

`bb contract` is the authority. Getting this wrong is not a style issue — **a producer on an illegal subject publishes into the void and a consumer on one receives nothing.**

```
type     bloodbank.<domain>.<entity>.<action>          4 tokens
subject  bloodbank.<kind>.<domain>.<entity>.<action>   5 tokens, kind = evt|cmd|rpy
```

- **MUST NOT** — put a version token (`v1`) or an identity slug (a repo name, an agent id, a pjid) in a subject. Versioning lives **only** in `schemaref` / `dataschema`. Identity lives in `data.*` and `actor.*`.
- **MUST** — validate every new producer with `bb emit --check --type <type>` before publishing. `bb emit` derives `subject`, `schemaref`, `dataschema`, `kind`, `domain` and `actor` itself; do not hand-assemble them.
- **MUST** — implement any **Project-scoped** event view as a `data.repo` payload filter through Candystore, never a NATS subscription. The subscription form is unrepresentable in this grammar, and several documents across the fleet still describe it.
- **This is not a ban on subscribing.** *(Clarified in step 7, because it read as one.)* What is unrepresentable is *identity as a subject token*. A durable consumer on a legal five-token subject, filtered by a payload field, is exactly what the grammar is for — and it is what D19 uses for dispatch outcomes: `bloodbank.evt.agent.invocation.*`, scoped by the `correlationId` the Bridge minted itself. Note that **dispatch outcomes carry no `data.repo` at all**, so the Project-scoped filter above does not even apply to them; step 2's constraint list and PRD §12 Q2 both say so.

`[NOTE FOR PM — corrected in step 7. The claim that this "blocks FR-8 in practice" was inherited from PRD §6 and addendum §B.1 refutes it: "The dispatch path is the fleet gateway (`bloodbank.cmd.agent.invocation.start`, with the target agent in `actor.agent_id`), **not a per-agent subject** — which is the same mistake in miniature." FR-8 publishes to the fleet gateway, so the PM's own subscriptions are not on FR-8's path and FR-8 is not blocked. **The defect is still live and still worth fixing**: `agents/hermes/pm/role.yaml` subscribes to `bloodbank.evt.repo.sidepiece.>` and `bloodbank.cmd.agent.sidepiece-pm.>`, both embedding an identity slug as a token, so that PM receives nothing on either — which is not FR-8's problem but *is* the first thing whoever builds FR-7 will debug in the wrong place. `docs/product-brief.md` carries `bloodbank.evt.v1.repo.sidepiece.>` — version token *and* slug. Carry it as a small prerequisite story, sequenced beside D4 rather than blocking on it. Finding these is routine; **fix rather than imitate**.]`

---

### A-P4 — JSON casing splits at the Bloodbank boundary, and that is intentional.

Two conventions meet, and picking one globally would corrupt the other.

- **Sidepiece's own surfaces** — the Bridge's HTTP/SSE API and everything in `contract/` — are **`camelCase`**. It is TypeScript on both sides of the wire; a translation layer would exist only to satisfy a convention neither end uses.
- **Bloodbank envelopes keep Bloodbank's names, byte for byte.** `data.repo`, `actor.agent_id`, `command_id`, `idempotency_key`, and — note the spelling — **`correlationid`**, which has no separator and must not be "corrected" to `correlationId` or `correlation_id` when it is a Bloodbank field.
- **MUST** — rename at the boundary, once, in the adapter that touches Bloodbank. Foreign names never travel inward past that adapter, and Sidepiece names never travel outward past it.

**Anti-pattern.** A camelCase-ifying middleware applied to everything. It silently rewrites `correlationid` and breaks correlation — the one mechanism PRD §12 Q2 confirmed actually works today.

---

### A-P5 — Response shape: flat, because FR-15 means a human reads it.

FR-15 makes `curl`-inspectability a hard requirement, which makes the response body a **user interface**, not just a transport.

- **MUST** — success responses are the resource itself, unwrapped. `GET /v1/project/:pjid` returns a `ProjectRecord`, not `{ data: ProjectRecord }`. An envelope that exists to hold a `data` key makes every `curl` one `jq` deeper for no gain.
- **MUST** — degradation rides alongside, not instead: `{ …resource, degraded: Degraded[] }`. This is what lets a pane fail independently while the rest of the response stays usable, which is the failure posture stated as an NFR.
- **MUST** — when **no resource can be produced at all**, the body is `{ degraded: Degraded[] }` alone, still with HTTP `200`, because the Bridge answered. *(Added in step 7. The three MUSTs above compose to nothing for DS-2 — pjid declared, absent from the Registry: the transport succeeded, there is no `ProjectRecord`, and "alongside, not instead" is unsatisfiable.)* `5xx` is reserved for the Bridge itself failing to answer. `contract/` types this as a union — `type ProjectResponse = (ProjectRecord & { degraded: Degraded[] }) | { degraded: Degraded[] }` — so `tsc` forces every pane to handle the resource-absent shape rather than reading a field off `undefined` at runtime, which is the shape this whole pattern exists to prevent.
- **MUST** — HTTP status reflects the transport, `degraded[]` reflects the product. A resolved Project whose Board is unreachable is **`200` with a DS-17 in `degraded[]`**, not a `502` — because the Cockpit's chat pane is fine and a `502` would say otherwise. *(Corrected in step 7: this example cited **DS-19**, which is Candystore, gates no pane, and renders on Turn cards. The Board is Plane, which is **DS-17** — the one that disables create and states the reason. Copying the wrong code emits Candystore's sentence during a Plane outage and leaves the Tickets pane ungated, which is precisely the misattribution FR-3 exists to prevent. Every DS number cited in this document's prose has been swept against `EXPERIENCE.md`'s table.)*
- **MUST** — **every mutating request carries `(pjid, generation)` and the Bridge checks it before the capability runs.** *(Added in step 7; D11 is the decision.)* The pjid is in the path, the `generation` is a required top-level field in the request body, and a stale one is refused with `409 Conflict` and `{ error: 'stale_generation', pjid, received, current }` — **not** a `200` with a `Degraded[]`. This is the one deliberate exception to the rule above it, and the reason is `EXPERIENCE.md`'s: nothing is degraded once a mutation is refused, the mutation is simply the thing that did not happen. A route that mutates and does not call the check is a bug the compiler cannot see, so it is on the human-checked list below.
- **MUST** — timestamps are ISO-8601 UTC strings. Readable in a terminal without conversion; epoch integers are not.
- **MUST** — SSE frames carry a named `event:` type and a JSON `data:` payload, one JSON object per frame, never a bare string. `curl -N` must produce something a person can follow live.
- **MUST** — `StreamFrame` discriminates **content from placeholder**, and the mapping is made once, in `turns/stream.ts`. *(Added in step 7.)* The upstream gateway emits `thinking.delta` spinner text before real content; FR-7 says "a decorative placeholder frame does not count as a first token" and that rendering it as the answer "would be measuring an animation." So `thinking.delta` maps to `{ kind: 'placeholder' }` and never to `{ kind: 'content' }`; **FR-7's first-token measurement starts at the first `content` frame**; and `EXPERIENCE.md`'s rule that "between accept and first real token the card shows the accepted state, not a spinner" is a consequence of the type rather than a thing the pane has to remember. An untyped passthrough of the upstream frame is the version of this that ships a budget measured against an animation.
- **MUST** — every response carries `X-Sidepiece-Contract: <CONTRACT_VERSION>` (D12). One header, and it is what makes a `curl` of any route enough to tell whether the two halves agree.

---

### A-P6 — SQLite naming, and the one place casing crosses.

- Tables: **plural `snake_case`** — `turns`, `dispatches`, `ticket_creates`, `resolutions`. *(Corrected in step 7: `registry_snapshots` is deleted from this list. D2 specifies the snapshot as a JSON file under the Bridge's state directory, and A-P6 was naming a table that does not exist. `resolutions` is D11's generation store; `ticket_creates` is D20's dedupe record.)*
- Columns: **`snake_case`** — `turn_id`, `created_at`, `board_id`, `generation`.
- **MUST** — every mutating row carries `generation` alongside `pjid` (D11). It is not a key and not recovery metadata; it is the answer to "which Project was this actually written against", which is the only way SM-3 is ever audited after the fact.
- **`pjid` stays `pjid`.** It is already lowercase and it is the join key; A-P1 outranks the casing convention. Never `project_id`, not even in SQL.
- **MUST** — map `snake_case` ↔ `camelCase` in exactly one repository layer per table. Never in a route handler, never twice.
- Timestamps stored as **ISO-8601 TEXT**, not integers. SQLite has no date type, this sorts lexically, and it keeps `sqlite3` CLI output readable — which is the same argument as FR-15, applied to the store.
- **MUST** — every persisted row carries `clone_path` and `board_id` alongside `pjid` (decision D5). These are recovery metadata, never keys.

---

### A-P7 — Loading, failure and retry are three different things, and never a spinner.

Directly enforcing the NFR *"no pane may render a failure as an empty state or a permanent spinner."*

- **MUST** — every async surface is a discriminated union, never a boolean pair:
  `{ status: 'idle' | 'loading' | 'ready' | 'degraded' }`. `isLoading` plus `error` admits the illegal `loading && error` state and invites exactly the spinner this product forbids.
- **MUST** — every in-flight state has a deadline and a terminal transition. Including under a DERP relay: the relay changes what the expiry *says*, never whether one exists.
- **MUST NOT** — have the **Cockpit** auto-retry a Ticket create whose outcome is unknown. The honest path is the refetch control, and `EXPERIENCE.md`'s row is the contract for what the operator is offered. *(Narrowed in step 7. The `NOTE FOR ARCHITECTURE` that used to sit here — "if the Bridge can mint an idempotency key for create, this rule relaxes and should" — was `EXPERIENCE.md`'s question forwarded back to itself in the same words, at the last step before implementation. **It is answered in D20:** Plane's REST create exposes no idempotency key, so the Cockpit mints a `createKey` per submit and the Bridge dedupes on it. The rule therefore relaxes **for the Bridge's own retries** and stays exactly as written for the Cockpit's, because changing what the operator is offered is a UX decision and not this document's to make.)*
- **MUST** — retry only idempotent reads, with backoff, and surface the attempt rather than hiding it.

---

### A-P8 — Log in the vocabulary, and never log a secret.

- **MUST** — structured JSON lines, with `pjid` as a top-level key on anything Project-scoped and `correlationid` on anything dispatch-scoped. These are the two keys that make a cross-component trace possible at all.
- **MUST** — a failure logs its `DsCode`. A log line describing a failure that maps to no `DsCode` is a missing state, not a log message.
- **MUST NOT** — log a resolved credential, ever. FR-16 resolves from the vault at startup; an `op://` reference is safe to log, its resolved value never is.
- **MUST** — read `X-Forwarded-For` for the client address. `tailscale serve` rewrites the peer to `127.0.0.1`, so anything reading the socket address logs one client forever.

---

### A-P9 — Structure: co-located tests, feature folders, one place for shared types.

- Tests **co-located** as `*.test.ts` beside the unit. One fewer tree to keep in sync, and an untested module is visible by absence.
- Bridge organised **by capability**, matching the component list from step 2 — `registry/`, `sessions/`, `tickets/`, `turns/`, `health/` — not by layer. Layer folders (`controllers/`, `services/`) scatter one capability across three places, which is precisely how two agents end up implementing half of it each.
- Extension follows **WXT's entrypoint convention** — `entrypoints/` for the content script, service worker and panel. Do not invent a parallel structure beside a framework that has one.
- **`srcDir: 'src'` is declared in `wxt.config.ts`, and it is not optional.** *(Added in step 7.)* Verified against `https://wxt.dev/guide/essentials/project-structure` on 2026-09-22: `srcDir` defaults to `"."` and `entrypointsDir` to `"entrypoints"` relative to it, and **WXT does not auto-detect a `src/` directory**. The tree below puts the entrypoints at `packages/extension/src/entrypoints/`, which WXT will simply not discover without that one line — in the one place this pattern tells the implementer *not* to deviate from the framework's convention. `components.json`'s aliases point at the same root, since shadcn's CLI writes to them.
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
- Does a new user-facing string exist in `EXPERIENCE.md`? If not, it is invented copy and the spine is the authority. It lands in `copy/states.ts`, `copy/progress.ts` or `copy/icon.ts` — there is now a home for every string in the product, not only for the DS ones.
- Does a Glossary term appear under a synonym?
- **Does every mutating route call the generation check before its capability?** `tsc` cannot see this one: the check is a call, not a type. It is the cheapest thing on this list to skip and the most expensive to skip — SM-3 is the metric it enforces.

**When a pattern is wrong, change it here first.** These are load-bearing for consistency, not for correctness, so a pattern that fights the code is a pattern to fix — but fixed in this document, in one change, rather than worked around per file.

---

## Project Structure & Boundaries

*Step 6. The tree below is the real one, not a sketch — every directory named here has a stated owner and a mapped requirement. Where something is deliberately absent, it says so, because an unexplained absence reads as an oversight to the next agent.*

### Complete Project Directory Structure

```
sidepiece/
├── package.json                      # workspace root; scripts only, no deps
├── pnpm-workspace.yaml
├── tsconfig.base.json                # strict; extended by all three packages
├── biome.json                        # formatting + lint, incl. the A-P1 project_id ban
├── mise.toml                         # exists; gains dev/build/deploy tasks
├── .env.op                           # exists; op:// references only, never values
├── .project.json                     # pjangler SOT — Sidepiece's own pjid
│
├── packages/
│   ├── contract/                     # ── imported by both. Owns nothing at runtime.
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── version.ts            # CONTRACT_VERSION                  [D12]
│   │       ├── state.ts              # BridgeDsCode | ClientDsCode, Degraded,
│   │       │                         #   Refusal, SubscriptionState,
│   │       │                         #   IconTransient                 [A-P2]
│   │       ├── project.ts            # Project, ProjectRecord incl. generation,
│   │       │                         #   pjid, ticketProvider       [A-P1][D11][D21]
│   │       ├── classify.ts           # the verb allowlist + its 6-Turn corpus [D13]
│   │       ├── turn.ts               # Turn, TurnKind, StreamFrame (content
│   │       │                         #   vs. placeholder — see turns/stream.ts)
│   │       ├── ticket.ts             # Ticket, BoardState, createKey    [D20]
│   │       ├── health.ts             # BridgeHealth, DependencyHealth, relayed
│   │       ├── annotation.ts         # [v2] — shape follows EXPERIENCE.md
│   │       │                         #   Gaps 4 and 7, unbuilt
│   │       └── *.test.ts             # incl. classify.test.ts = the FR-6 corpus
│   │
│   ├── bridge/                       # ── systemd --user on big-chungus
│   │   ├── package.json
│   │   └── src/
│   │       ├── main.ts               # entry; wires capabilities, starts server
│   │       ├── server/
│   │       │   ├── http.ts           # routes; flat bodies                [A-P5]
│   │       │   ├── sse.ts            # named event frames, curl -N        [FR-15]
│   │       │   └── errors.ts         # thrown → Degraded. No prose out.   [A-P2]
│   │       ├── registry/
│   │       │   ├── client.ts         # GET /v1/registry, client-side index
│   │       │   ├── snapshot.ts       # last-good JSON in the state dir  [D2][D17]
│   │       │   ├── generation.ts     # mint on record change; compare   [D11]
│   │       │   └── paths.ts          # clone-path + role_dir existence
│   │       │                         #   checks → DS-9/DS-10/DS-20      [FR-3]
│   │       ├── sessions/
│   │       │   ├── gateway.ts        # JSON-RPC over WS to tui_gateway; a
│   │       │   │                     #   surface mismatch → DS-26
│   │       │   ├── pool.ts           # LRU 3–5 warm; never evicts in-flight;
│   │       │   │                     #   bounded wait → DS-28       [D3][D15]
│   │       │   ├── errors-4090.ts    # session cap → DS-24, not retry
│   │       │   └── fleet.ts          # Hermes fleet registry reader →
│   │       │                         #   DS-12 vs DS-13                  [FR-5]
│   │       ├── turns/
│   │       │   ├── store.ts          # node:sqlite; the only opener       [D1]
│   │       │   ├── accept.ts         # synchronous write → turnId ≤500ms [D15]
│   │       │   ├── stream.ts         # Streamed Exchange; thinking.delta is
│   │       │   │                     #   a placeholder frame, never content
│   │       │   ├── dispatch.ts       # Dispatched Command + correlationId
│   │       │   └── reconcile.ts      # outcomes arriving while panel closed
│   │       ├── tickets/
│   │       │   ├── index.ts          # dispatch on ticketProvider.type    [D21]
│   │       │   └── plane.ts          # the ONLY place Plane's "project" is
│   │       │                         #   renamed; default entry state; dedupe
│   │       │                         #   on createKey              [A-P1][D20]
│   │       ├── bloodbank/
│   │       │   ├── adapter.ts        # publish: 5-token subjects;
│   │       │   │                     #   bb emit --check           [A-P3][A-P4]
│   │       │   └── outcomes.ts       # durable consumer on evt.agent
│   │       │                         #   .invocation.*, by correlationId [D19]
│   │       ├── candystore/
│   │       │   └── reader.ts         # backfill by correlationId; probed
│   │       │                         #   separately from Bloodbank  [D19][FR-14]
│   │       ├── health/
│   │       │   ├── aggregator.ts     # feeds FR-3, never its own list; carries
│   │       │   │                     #   relayed:boolean for DS-15
│   │       │   └── degradation.ts    # op:// literal scan + provider/model
│   │       │                         #   comparison → DS-8    [D18][FR-14]
│   │       ├── credentials/
│   │       │   └── vault.ts          # op:// at start AND per-request;
│   │       │                         #   failure degrades, never exits [D18][FR-16]
│   │       └── db/
│   │           ├── schema.sql        # turns, dispatches, ticket_creates,
│   │           │                     #   resolutions                [A-P6][D11]
│   │           └── migrations/       # forward-only, user_version; unknown
│   │                                 #   version → DS-25                [D7]
│   │
│   └── extension/                    # ── WXT. Ships to Chrome only.
│       ├── package.json
│       ├── wxt.config.ts             # srcDir: 'src' — REQUIRED, WXT does not
│       │                             #   auto-detect it; manifest surface [A-P9][D16]
│       ├── tailwind.css              # @theme ALIASES tokens.css's custom
│       │                             #   properties; declares no value  [step 3]
│       ├── components.json           # shadcn; aliases point at src/
│       └── src/
│           ├── entrypoints/
│           │   ├── content.ts        # meta[name=pjid] read + MutationObserver
│           │   │                     #   on <head> for SPA        [FR-1][D14]
│           │   ├── background/       # ── the service worker, four jobs
│           │   │   ├── index.ts      # setPanelBehavior at startup     [D16]
│           │   │   ├── tabs.ts       # onActivated/onUpdated → re-render
│           │   │   │                 #   the live panel document       [FR-1]
│           │   │   ├── icon.ts       # 4 resolvability states + the
│           │   │   │                 #   "Click again." transient; DS-21
│           │   │   ├── commands.ts   # focus-ticket-title; _execute_action
│           │   │   │                 #   needs no listener             [D16]
│           │   │   └── gesture.ts    # curried gesture, callbacks, 1 hop [§C.1]
│           │   └── sidepanel/
│           │       ├── index.html
│           │       └── main.tsx
│           ├── cockpit/
│           │   ├── IdentityHeader.tsx    # repo, clone path, board, as-of [FR-4]
│           │   ├── PaneSwitch.tsx
│           │   ├── StateNotice.tsx       # renders a DsCode. ALL copy here [A-P2]
│           │   ├── RestingLine.tsx       # DS-1 and DS-21 ONLY: one muted
│           │   │                         #   line, no failure glyph; DS-1
│           │   │                         #   demotes re-resolve, DS-21 has
│           │   │                         #   none at all
│           │   ├── chat/                 # Chat pane                      [FR-6–11]
│           │   ├── tickets/              # Tickets pane                   [FR-12–13]
│           │   └── annotations/          # [v2] — seat reserved, empty
│           ├── copy/
│           │   ├── states.ts         # DS-1…DS-28 strings, from EXPERIENCE.md
│           │   ├── progress.ts       # normal-path + the 3 non-DS code spaces
│           │   └── icon.ts           # 4 icon titles + the gesture transient
│           ├── lib/
│           │   ├── bridge.ts         # the only module that REQUESTS. Usable
│           │   │                     #   from panel or worker; every call
│           │   │                     #   bounded well under 30s; attaches
│           │   │                     #   (pjid, generation); DS-27 check [D11][D12]
│           │   ├── stream.ts         # EventSource. Imported ONLY by
│           │   │                     #   entrypoints/sidepanel/           [§5]
│           │   ├── cache.ts          # FR-2's bounded cache: chrome.storage
│           │   │                     #   .local, key fr2:<pjid>, 5-min TTL.
│           │   │                     #   Imported by the panel AND by
│           │   │                     #   background/icon.ts. Own keyspace;
│           │   │                     #   NOT via storage.ts        [D10][D6]
│           │   └── storage.ts        # chrome.storage.local CONTINUITY keys
│           │                         #   only: draft, pane, collapse    [D6]
│           └── styles/
│               └── tokens.css        # THE definition: DESIGN.md's canonical
│                                     #   :root + @media dark block; hex is SOT
│
└── _bmad-output/planning-artifacts/  # exists — PRD, UX spines, this document
```

**Deliberately absent, so nobody adds them by reflex:**

- **No `.github/workflows/`.** There is no CI. One operator, one machine; `mise` tasks are the pipeline. Adding CI would be adding a system to maintain, not a safety net someone is waiting on.
- **No `docker-compose.yml`.** The Bridge is a `systemd --user` unit on a box that already exists. A container would add a network hop between the Bridge and the filesystem it is specifically there to touch.
- **No `e2e/` directory.** Deferred honestly rather than scaffolded and left empty — MV3 end-to-end harnesses are their own project, and PRD §11's metrics are behavioural rather than automated.
- **No `packages/ui/`.** EPIC A proposed a shared UI kit. There is exactly one consumer; extracting a package for one consumer is speculative generality, and step 3 already recorded that shadcn components are added one at a time as a real need appears.
- **No offscreen document.** *(Added in step 7, because addendum §C offers one and a later agent will otherwise reopen it.)* §C names it as the place a stream could live "if they must outlive panel visibility." They must not: FR-9 already specifies that outcomes arriving while the panel is closed are **reconciled on next open**, and the Bridge is the system of record for exactly that reason. An offscreen document buys a live connection nobody is watching, in a third non-durable context, with its own lifetime rules. Rejected, not overlooked.
- **No `registry/cache.ts` on the Bridge.** It was in this tree until step 7. FR-2's cache is the extension's, in `chrome.storage.local` (D10); the Bridge's durable copy of the registry is the D2 snapshot and it is a different thing with a different job. *(Both are durable as of 2026-09-22 and they are still not the same thing — see D10's last bullet.)*

### Architectural Boundaries

**The three boundaries that matter**, in order of how expensive they are to get wrong:

| Boundary | Crosses | Enforced by |
|---|---|---|
| **Cockpit ↔ Bridge** | The tailnet. HTTP + SSE. | `contract/`, checked by `tsc` on both sides |
| **Bridge ↔ upstreams** | Process/network to seven services | One adapter folder per upstream; foreign names die at the adapter `[A-P1][A-P4]` |
| **Content script ↔ service worker ↔ panel** | Chrome contexts, all three non-durable | `runtime.sendMessage`; **callbacks only on the gesture path** `[§C.1]` |

**API boundary — the Bridge's surface is the whole contract.** FR-15 requires every capability be `curl`-inspectable, so the HTTP surface *is* the architecture's public face, not an implementation detail. `packages/bridge/src/server/` is the only place routes are defined; no capability exists that the extension can reach and `curl` cannot.

**Component boundary — `lib/bridge.ts` is the only module in the extension that performs a request.** Every pane asks it. This is what makes the FR-3 taxonomy renderable at all: one place converts transport reality into the client-produced states — DS-3, DS-4, DS-5 and DS-27 — rather than each pane inventing its own failure vocabulary, which is the exact drift FR-3 exists to prevent.

**Streaming boundary — `EventSource` is constructed only in the panel document.** *(Added in step 7. This document named "streaming lifecycle across two protocols and a non-durable client" as a cross-cutting concern and then never said which Chrome context holds the downstream connection.)* PRD §5 states the rule verbatim: "All long-lived connections — chat streams, event subscriptions — live in the panel document, **never in the extension service worker**, which is terminated after roughly 30s idle." Addendum §C sharpens it: "WebSocket traffic is documented to reset the idle timer, but **EventSource has no equivalent documented exemption**." So:

- **`lib/stream.ts` owns `EventSource` and is imported only by `entrypoints/sidepanel/`.** A static import from anywhere under `entrypoints/background/` is a review failure, and it is the one import rule worth an explicit lint.
- **`lib/bridge.ts` is the request client and is usable from either context**, because the service worker genuinely needs it — `EXPERIENCE.md`'s **Resolvable** icon state fires with the Cockpit closed, which means the worker resolves. **Every call it makes is bounded well under 30s**, which is what makes it safe there.
- The split exists because one shared fetching module *invites* the wrong placement: the worker legitimately needs half of it, so "the only module that fetches" would have put the stream wherever it was first called. Two modules make the rule mechanical.
- **FR-15's extension half lives here too.** "Restarting the Bridge does not require reloading the extension" is reconnect-plus-re-resolve behaviour, and it is `lib/stream.ts`'s reconnect plus `lib/bridge.ts`'s unreachable→reachable transition, which is also what invalidates the FR-2 cache (D10).

**Data boundary — `turns/store.ts` is the only module that opens the database.** Capabilities call it; nothing else imports `node:sqlite`. The `snake_case` ↔ `camelCase` mapping happens there and nowhere else `[A-P6]`.

**The boundary that is *not* a boundary:** the panel document and the service worker are **not** a client/server pair. Both are non-durable, both die (the panel on collapse, the worker at ~30s idle), and neither is a system of record. State that matters crosses to the Bridge; state that does not lives in `chrome.storage.local` `[D6]` — **the one place both contexts can reach and neither owns.** Treating the **service worker itself** as a cache tier is the most likely wrong turn here, and it would fail intermittently, which is the worst failure shape.

*(Sharpened 2026-09-22, because D10 now has the worker reading FR-2's cache and the sentence above could be misread as forbidding that. The rule is about **where the value lives, not which context touches it.** The worker reads and writes `chrome.storage.local`; it does not *hold* state. A value in a worker-scope variable is gone at the next idle teardown and its absence is indistinguishable from a miss — that is the wrong turn. A value in `chrome.storage.local` is readable by whichever context happens to be alive, which is exactly why the **Resolvable** icon state can fire with the Cockpit closed.)*

### Requirements → Structure Mapping

| FR | Requirement | Bridge | Extension |
|---|---|---|---|
| FR-1 | Detect a declared pjid, incl. SPA nav | — | `entrypoints/content.ts` `[D14]`, `entrypoints/background/tabs.ts` |
| FR-2 | Resolve to a Project Record, bounded cache | `registry/client.ts`, `registry/generation.ts` | `lib/bridge.ts`, **`lib/cache.ts`** — `chrome.storage.local`, key `fr2:<pjid>`, read by the panel **and** `background/icon.ts` `[D10]` |
| FR-3 | Report all degraded states honestly | `health/aggregator.ts`, `registry/paths.ts`, `server/errors.ts` | `lib/bridge.ts` (DS-3/4/5/27), `entrypoints/content.ts` + `background/icon.ts` (DS-1/16/21), `cockpit/StateNotice.tsx`, `cockpit/RestingLine.tsx`, `copy/states.ts` |
| FR-4 | Display resolved identity | `registry/client.ts` | `cockpit/IdentityHeader.tsx` |
| FR-5 | Agent presence, declared vs running | `sessions/fleet.ts` (DS-12), `sessions/gateway.ts` (DS-13), `registry/paths.ts` (DS-20), `health/aggregator.ts` | `cockpit/StateNotice.tsx` |
| FR-6 | Classify a Turn, visibly, overridably | `contract/src/classify.ts` (the rule), `turns/accept.ts` (authoritative re-check at send — it is the call that returns `kind`, per D15) `[D13][D15]` | `cockpit/chat/` composer, evaluating the same rule on a typing pause |
| FR-7 | Streamed Exchange | `turns/accept.ts` `[D15]`, `turns/stream.ts`, `server/sse.ts` | `cockpit/chat/`, `lib/stream.ts` |
| FR-8 | Dispatched Command + ack | `turns/dispatch.ts`, `bloodbank/adapter.ts` | `cockpit/chat/` |
| FR-9 | Outcome **with result content** | `bloodbank/outcomes.ts`, `candystore/reader.ts`, `turns/reconcile.ts` `[D19]` | `cockpit/chat/`, `lib/stream.ts` |
| FR-10 | Turns carry page URL + title | `turns/store.ts` | `entrypoints/content.ts` → composer |
| FR-11 | Per-Project continuity | `turns/store.ts` `[D1][D5]` | `cockpit/chat/` |
| FR-12 | Tickets grouped by state, no-Board state | `tickets/index.ts` `[D21]`, `tickets/plane.ts` | `cockpit/tickets/` |
| FR-13 | Create a Ticket, title alone | `tickets/plane.ts` `[D20]`, `registry/generation.ts` (the `(pjid, generation)` check, before the write) `[D11]` | `cockpit/tickets/`, `lib/bridge.ts` (refuses locally first) |
| FR-14 | Bridge health, incl. silent degradation | `health/aggregator.ts`, `health/degradation.ts` `[D18]` | `cockpit/IdentityHeader.tsx` |
| FR-15 | Lifecycle, binding, Turn state | `server/`, `main.ts` | `lib/stream.ts` (reconnect), `lib/bridge.ts` (re-resolve on unreachable→reachable) |
| FR-16 | Vault-resolved credentials | `credentials/vault.ts` | — |

**Note the asymmetry, because it is the shape of this product:** every FR has a Bridge column except FR-1, and every FR has an extension column except FR-16. Detection is the one thing only the browser can do; **secrets are the one thing only the daemon may do.** Everything between them is a collaboration, which is why `contract/` carries the weight it does. *(Softened in step 7: FR-15 used to have an empty extension column and a paragraph built on the emptiness. It was never empty — "restarting the Bridge does not require reloading the extension" is behaviour that lives in the extension, and it now has the modules to prove it.)*

**Cross-cutting concerns → location:**

- **The DS-1…DS-28 taxonomy** — defined in `contract/src/state.ts` with the union **split by producer**, produced by `health/aggregator.ts` and `registry/paths.ts` on the Bridge *and* by `lib/bridge.ts`, `entrypoints/content.ts` and `background/icon.ts` in the extension, rendered by `StateNotice.tsx` (and `RestingLine.tsx` for DS-1 and DS-21), worded in `copy/states.ts`. *(Corrected in step 7: this bullet used to name `health/aggregator.ts` as the sole producer. DS-1, DS-16 and DS-21 are decided before any request is made, and DS-3/4/5/27 are conditions a Bridge cannot report about itself.)* A new state touches the type, one producer, one renderer, one copy file and an `EXPERIENCE.md` row, or it is incomplete.
- **Correlation** — minted as **`correlationId`** in `turns/dispatch.ts`, serialised to Bloodbank's **`correlationid`** only inside `bloodbank/adapter.ts`, matched back as `correlationId` in `bloodbank/outcomes.ts` and `turns/reconcile.ts`. *(Corrected in step 7: this bullet said `correlationid` keeps Bloodbank's spelling "throughout" and cited A-P4 as the authority, while A-P4's MUST says the opposite — "foreign names never travel inward past that adapter", and Sidepiece's own surfaces are camelCase. The id is minted inside `turns/dispatch.ts`, which is inward of the adapter. A-P8's log-key exception stays where it is, in A-P8.)*
- **Resolution generation** — minted in `registry/generation.ts`, persisted in `resolutions`, carried on `ProjectRecord`, stamped on every mutating row, checked by every mutating route before its capability, attached and pre-checked by `lib/bridge.ts` `[D11]`. Five places, one mechanism, and it is what SM-3 is measured against.
- **Contract version** — `contract/src/version.ts`, echoed by `server/http.ts` on every response, compared once per open by `lib/bridge.ts`, rendered as DS-27 `[D12]`.
- **pjid discipline** — `contract/src/project.ts` is the only definition; `tickets/plane.ts` is the only place a foreign "project" is renamed `[A-P1]`.
- **Credential degradation detection** — `health/degradation.ts`, feeding FR-14 `[D18]`. It exists because nothing else on the machine will notice.

### Integration Points

**Internal.** Cockpit → Bridge over HTTPS on the tailnet: JSON for reads and writes, SSE for streams. Content script → service worker → panel by `runtime.sendMessage`, with the **gesture path callback-only and one hop** `[§C.1]`.

**External** — **seven** upstreams, **one adapter folder each, no upstream shared between two**: *(Corrected in step 7. It said six upstreams with "one adapter each, no exceptions", and the table beneath it mapped **two** upstreams onto one file carrying two protocols in two directions — collapsing two of the twelve components step 2 enumerated. The Hermes fleet registry was missing entirely, although three degraded states read it or the filesystem beside it. The rule is restated precisely: an upstream owns a folder, and a folder owns exactly one upstream. Bloodbank's two legs are two files in **its** folder, which is a direction split, not a shared adapter.)*

| Upstream | Adapter | Protocol |
|---|---|---|
| pjangler registry | `registry/client.ts` | HTTP `GET /v1/registry` |
| Hermes fleet registry | `sessions/fleet.ts` | read `~/.hermes/agents-registry.yaml` — declared vs *registered*, which is DS-12 and is a different source from the gateway session DS-13 tests |
| Hermes `tui_gateway` | `sessions/gateway.ts` | JSON-RPC over WebSocket |
| Plane | `tickets/plane.ts`, behind `tickets/index.ts` `[D21]` | REST |
| Bloodbank | `bloodbank/adapter.ts` (publish), `bloodbank/outcomes.ts` (consume) | NATS: `bb emit` out, durable consumer in `[A-P3][D19]` |
| Candystore | `candystore/reader.ts` | HTTP, scoped by the **self-minted `correlationId`** — *not* `data.repo`, which dispatch outcomes do not carry `[D19]` |
| 1Password | `credentials/vault.ts` | `op`, at start **and** per-request `[D18]` |

Splitting Candystore out of `bloodbank/adapter.ts` is not tidiness: `health/aggregator.ts` must probe them **independently**, because `EXPERIENCE.md` gates DS-18 (Bloodbank unreachable) on *half of Chat* and DS-19 (Candystore unreachable) on *nothing at all*. One adapter reporting for both cannot produce two blast radii.

**The Bridge is the only component that touches the filesystem** (PRD §3), and four degraded states depend on it doing so: `registry/paths.ts` stats the clone path (DS-9) and each Agent binding's `role_dir` (DS-10 for a non-PM, DS-20 for the PM). It is a probe module, not an upstream, which is why it is not a row above — but it was absent from the tree entirely until step 7, and DS-10 *occurs today* on this repo.

**Data flow, end to end** — the product in one line:

```
page <meta name="pjid">  →  content script  →  service worker  →  panel
                                                     ↓              ↓
                                                lib/cache.ts — chrome.storage.local,
                                                key fr2:<pjid>, read+written by BOTH
                                                contexts, 5-min TTL       [FR-2][D10]
                                                        ↓  lib/bridge.ts  (+ lib/stream.ts,
                                    tailnet (HTTPS + SSE)   ↓              panel only)
         registry ← snapshot  ←   Bridge   →  sessions → tui_gateway → PM
                                    ↓  ↓  ↓
                                sqlite  Plane  Bloodbank ⇄ Candystore
```

*(Corrected in step 7: the cache was drawn on the Bridge's side, between the registry and the snapshot. It is the extension's, it is read before the network call rather than behind it, and the Bloodbank leg is bidirectional — publish out, outcomes back. **Corrected again on 2026-09-22, closing S1:** it hangs off the service worker *and* the panel rather than off the arrow between them, because it is in `chrome.storage.local` and both contexts read it — which is what makes the **Resolvable** icon state implementable with the Cockpit closed.)*

The resolution leg is the one with a fallback — a client-side cache in front and a server-side snapshot behind; every other leg fails to a `DsCode`.

### Development Workflow

- **Dev.** `pnpm dev` in `extension/` runs WXT's dev server and opens Chrome with the extension installed. The Bridge runs locally against the real registry and a local SQLite file under the same state directory shape D17 names. The Bridge origin is `WXT_BRIDGE_ORIGIN`, **baked at build time** — localhost in dev, the MagicDNS name in the deployed build (D16 settles it; there is no settings page and no first-run surface for a runtime-configured origin to live in).
- **The dev fixture, because FR-1 has nothing else to run against.** Three static pages served by the dev task: one carrying a known pjid, one carrying none, one carrying two conflicting declarations. They are FR-1's and D14's acceptance set, and until PRD §12 Q4 is answered they are also the *only* pages in existence that declare anything.
- **Build.** `pnpm build` → `contract` first, then `bridge` and `extension` in parallel. `bridge` bundles to a **single file** with `contract` inlined (D17). WXT's `zip` produces the loadable artifact.
- **Deploy.** `mise` task: bundle `bridge` to one file, rsync **that file** to `~/.local/lib/sidepiece/` on `big-chungus`, `systemctl --user restart`. **Never rsync the workspace** — `contract` is a pnpm symlink and an rsync of `packages/bridge` carries a dangling link the daemon cannot resolve at import time. **Never rsync over the state directory** — `~/.local/state/sidepiece/` holds the Turn history and the registry snapshot, and the two paths never intersect (D17). No container, no registry, no CI. The extension is loaded unpacked and **never** published — PRD §7's "not publicly reachable" is a deployment property, not just a policy.
- **Dev-loop hazard, already a rendered state.** Reloading the extension invalidates content-script contexts and the panel does not hot-reload. `DS-16` exists for exactly this, and it is the only state that tells the operator to reload anything — because in a repo whose one operator is also its developer, a dev-loop failure *is* a user-facing failure.

---

## Open Items

*Step 7. Validation found thirty-three defects in the six sections above; thirty-one are repaired in place. These are the two that are not architecture's to decide, plus one that needs ten minutes of empiricism rather than a decision. They are here rather than silently answered, because a document that invents an answer to a question its owner reserved is worse than one that leaves the question visible.*

**O1 — What emits the `pjid` declaration into served pages?** *(PRD §12 Q4, open. `EXPERIENCE.md` Gap 8, open.)*

The architecture half is closed: D14 fixes the literal form any emitter must satisfy, and sequence step 0b names the dev fixture FR-1's acceptance tests run against. What is not closed is the mechanism, and PRD §12 Q4 explicitly scopes it out of the product document while calling it "**sequencing risk on the critical path** — it gates every success metric in §11."

| Option | What it costs |
|---|---|
| **A pjangler recipe** — the registry emits the tag as part of whatever it already templates | Most leverage: every registered Project gains the declaration at once, and nineteen Projects become resolvable in one change. Costs a change to pjangler, which is another repo, and only reaches Projects whose served surface pjangler actually touches. |
| **A per-project template change** — each Project's own layout/head partial emits it | No cross-repo work and no coordination, but it is nineteen small changes done by hand, and a Project added later is inert until someone remembers. |
| **Manual, per surface, as needed** | Zero up-front cost, and it makes DS-1 the permanent default state. `EXPERIENCE.md` IA note (d) already treats it as "the wallpaper, not an error" for exactly this reason. Honest for a first month; a slow failure if it becomes the answer. |

The architectural consequence of leaving it open is already absorbed: DS-1 is designed as the browser's default condition rather than as an edge case, and `RestingLine.tsx` exists so that it is cheap and quiet. **What is not absorbed is acceptance** — FR-1 through FR-4 cannot be demonstrated against anything real until at least Sidepiece's own repo and one served surface emit the tag. That is the decision, and it is Jarad's.

**O2 — The `[v2]` annotation payload shape.** *(`EXPERIENCE.md` Gaps 4 and 7, both open, both filed under "Decisions only Jarad can make.")*

`contract/src/annotation.ts` used to be annotated **"shape locked, unbuilt"** in this document's tree. It is not locked: Gap 4 asks whether the payload is "selector + comment" or the full PRD §9 payload (selector + tag + text snippet + `outerHTML` + URL), and Gap 7 asks whether cross-origin iframes and shadow-DOM elements need to be pickable — which decides whether an annotation can carry an unaddressable anchor at all. The tree comment now reads "shape follows `EXPERIENCE.md` Gaps 4 and 7, unbuilt."

A locked shape that two open questions can still move is worse than an unlocked one, because the next agent builds against it. No v1 work depends on either answer; the seat stays reserved and empty, which is what the Version Seam prescribes.

**O3 — Is DS-3 distinguishable from DS-4 in practice?** *(Not a decision — an experiment nobody has run.)*

A-P2 now ships DS-5 as v1's answer, because a `fetch` failure from an extension context is opaque and FR-3 only asks for the distinction "where the two are distinguishable." The candidate discriminator is DNS: MagicDNS failing to resolve at all versus resolving and failing to connect. **Ten minutes in a console decides it**, and if it works, DS-3 and DS-4 light up for free — their wording, their triggers and their recovery already exist in `EXPERIENCE.md`. Worth doing beside PRD §12 Q7's one-off confirmation on `carries-macbook-air`, since both are "run it once and stop guessing."

---

## Architecture Validation Results

*Step 7. Four independent lenses reviewed this document — internal coherence, requirements coverage, cross-document contract against both UX spines, and platform reality — producing 59 raw findings. An adversarial verifier, instructed to default to refuting, **confirmed 33, refuted 9 outright and downgraded 11**. The confirmed findings were then repaired and the repair independently verified. The numbers below are the verified ones, not the reported ones.*

### The verdict worth quoting

> "The architecture is strong on decisions and weak on the seams between them. Its D-decisions, P-patterns and tree are individually defensible; what fails is the joinery — places where a decision in one section silently changes a contract in another, or where an upstream document explicitly handed a question to this step and it went unanswered."

That is an accurate description of what six sections written in sequence will do to each other, and it is the reason this step exists.

### The three blockers, and what closed them

All three shared a failure mode the PRD names as its worst outcome: they produced **a product that is confidently wrong rather than visibly broken**.

**B1 — FR-2's cache was on the wrong side of the network.** This document placed it on the Bridge; PRD §5 and `EXPERIENCE.md` both place it in the Cockpit document, per window, and build behavioural guarantees on that placement — *"two Chrome windows mean two Cockpit documents with independent caches."* The decisive evidence was not the disagreement but the self-contradiction: **the invalidation trigger this document itself specified is one a Bridge structurally cannot observe** (a Bridge-health transition from unreachable to reachable), and the TTL PRD FR-2 calls a hard bound was absent entirely. *Closed:* cache relocated off the Bridge with a stated 5-minute TTL, corrected triggers, and the change carried through the dependent surfaces — D6, D10, the tree, the FR-2 map row, the data-flow diagram, and the D2 snapshot's stated relationship to it. *(Corrected 2026-09-22: this said "all seven" and then named six. It was also wrong in a more interesting way — five further surfaces asserted the old placement and were missed, which is how the destination came to be wrong without the relocation being noticed as incomplete. See the S1 entry.)* **Superseded in part on 2026-09-22:** the *relocation off the Bridge* was and remains right; the *destination* — the Cockpit document's memory — broke three `EXPERIENCE.md` behaviours and was itself recorded as S1 below. The cache now lives in `chrome.storage.local` keyed by pjid (D10). This entry is left standing because the fix that created a new defect is the most instructive thing in this section.

**B2 — The `(pjid, generation)` guard was never specified.** PRD §5 names it as the entire defence against acting on the wrong Project; PRD §11 names it as SM-3's entire enforcement. It appeared four times in 660 lines, every time as a noun — no type, no column, no route, no check — and the one behaviour stated was circular: a cached resolution invalidated by the stamp it had itself produced. *Closed as D11*, specifying mint, scope, persistence, the `ProjectRecord` type change, the `generation` columns, the A-P5 MUST, and a `409` refusal shape. The substantive design problem it surfaced — that a naive per-resolution counter would refuse window A's valid mutation the instant window B merely re-resolved, **firing on the common case and staying silent on the dangerous one** — is solved by making the generation content-addressed rather than a counter.

**B3 — `DsCode` was a closed union that four of this document's own decisions violated.** A-P2 pinned it at DS-1…DS-22 and forbade any failure outside it, while D2, D3, D7 and a step-2 constraint each required a new named state — and `EXPERIENCE.md` had explicitly handed over a fifth (*"Bridge contract drift … Not invented here; flagged for architecture"*) that went unanswered. *Closed:* six codes allocated — **DS-23** snapshot-served resolution, **DS-24** gateway 4090, **DS-25** unrecognised store version, **DS-26** gateway surface drift, **DS-27** Bridge/Cockpit contract drift, **DS-28** pool exhausted — each with trigger, pane-gating, recovery, wording and producing side, **and each written into `EXPERIENCE.md`'s degraded-state table in the same change**, which is A-P2's own rule applied to itself.

### Coherence Validation

**Decision compatibility** — verified across D1…D21 after repair. The repair itself introduced eleven new inconsistencies, of which the verification pass caught and fixed seven (a stale cross-reference into A-P5's renumbered MUSTs, a self-contradicting case-sensitivity bullet in D14, a real contradiction between the FR-6 map row and D15 over where authoritative classification runs, two type-name mismatches between A-P2 and the tree, a markdown list that silently swallowed sequence step 0b, and — in `EXPERIENCE.md` — Rule 2's prose still asserting the pre-repair Registry behaviour two hundred lines above the rows that had been corrected). **That a fix pass generates its own defects at roughly a third the rate of the original is the argument for verifying repairs rather than trusting them.**

**Pattern consistency** — A-P1…A-P9 re-checked against D1…D21. A-P2's error model, A-P5's wire shape and A-P6's storage naming now agree on where degradation, refusals and the generation live.

**Structure alignment** — the tree carries every new module with a named owner: `registry/generation.ts`, `registry/paths.ts`, `sessions/fleet.ts`, `turns/accept.ts`, `lib/stream.ts`, `lib/cache.ts`, `candystore/reader.ts`, and `entrypoints/background/` expanded from one annotation into five files.

**Numbers and versions** — a full sweep. **D1's three load-bearing `node:sqlite` facts were wrong**, in the section that called the version detail *"the whole reason this is a clean decision"* and in a document that twice claimed these were verified rather than recalled. Corrected against the live Node 24 documentation: `node:sqlite` is **Stability 1.2, Release Candidate** — *not* Stability 2 — available since **22.13.0**, current at **24.15.0**. The decision survives, because the property it rests on (embedded in the binary, no native compilation, no toolchain on `big-chungus`) is real. Its justification did not survive, and the correction promotes the Node-24 pin from an `[ASSUMPTION]` to a **MUST** with a startup assertion, since an RC module's API is a version-coupled dependency rather than a stable one. Every `DsCode` cited in prose was also swept against `EXPERIENCE.md`'s table; **A-P5's worked example cited DS-19 (Candystore) for a Board outage, which is Plane, DS-17** — and the wrong code destroyed the example's point, since DS-19 gates nothing.

### Requirements Coverage Validation

**Functional requirements** — all sixteen now have an architectural owner, and the sweep found five that had only a headline. **FR-1** mapped tab-switching entirely to the content script, a context that structurally cannot observe it. **FR-6**'s classification *form* — which both the PRD and `EXPERIENCE.md` explicitly delegate to this document — was never chosen, and the one placement given put a tailnet round trip under the caret on a control `EXPERIENCE.md` forbids to flicker. **FR-7**'s ≤500ms accept budget was unaddressed, and the obvious implementation misses it by an order of magnitude. **FR-9**'s outcome path was prescribed with the one filter this document itself proves does not work for dispatch outcomes. **FR-14**'s silent-credential-degradation detection was asserted four times and given a filename with no mechanism — which mattered more than the others, because that failure is the product's motivating incident. All five are closed as D13, D15, D18, D19 and an expanded service-worker structure.

**Non-functional requirements** — the split latency budget now has an architectural answer rather than a restatement (D15 decouples Turn acceptance from session acquisition). The failure posture is enforced by the DS taxonomy and A-P7. The panel-lifetime constraint drove the SSE placement fix. The trust boundary was already correct.

**Success metrics** — SM-3 was the gap, and it was the important one: the metric had no mechanism until D11.

### Implementation Readiness

| Requirements Analysis | | Architectural Decisions | |
|---|---|---|---|
| Project context analysed | `[x]` | Critical decisions documented with versions | `[x]` |
| Scale and complexity assessed | `[x]` | Technology stack fully specified | `[x]` |
| Technical constraints identified | `[x]` | Integration patterns defined | `[x]` |
| Cross-cutting concerns mapped | `[x]` | Performance considerations addressed | `[x]` |

| Implementation Patterns | | Project Structure | |
|---|---|---|---|
| Naming conventions established | `[x]` | Complete directory structure defined | `[x]` |
| Structure patterns defined | `[x]` | Component boundaries established | `[x]` |
| Communication patterns specified | `[x]` | Integration points mapped | `[x]` |
| Process patterns documented | `[x]` | Requirements → structure mapping complete | `[x]` |

### Gap Analysis

**Critical gaps:** none open.

**Open items requiring Jarad** — neither blocks implementation:

- **O1 — what emits the `pjid` into served pages (PRD §12 Q4).** Carried with three costed options. It gates **acceptance** of FR-1…FR-4 in production, not their implementation: sequence step 0b builds a three-page dev fixture (one `pjid`, none, two conflicting) which is FR-1's and D14's acceptance set, so the work is testable before the emitter exists. **This remains the project's real sequencing risk — v1 is inert in production until something emits the tag.**
- **O2 — the `[v2]` annotation payload shape.** Two of `EXPERIENCE.md`'s open Gaps items decide it, both explicitly Jarad's. Nothing in v1 depends on it.

**Deliberate divergences to reflect upstream — there are two, both against PRD §5, both filed as `[NOTE FOR PM]`s:**

- **D11** reinterprets FR-2's literal *"monotonically increasing"* as content-addressed. The sequence remains monotonic and never reuses a value; what changes is that re-resolving an unchanged Project Record is not an event. This serves §5's stated intent and should be carried back into the PRD rather than left for someone to "correct" in the wrong direction.
- **D10** *(added 2026-09-22 by the S1 ruling)* puts FR-2's cache in `chrome.storage.local` keyed by pjid, so §5's *"two Cockpit documents with **independent caches**"* no longer describes the build. Independent *resolution state* survives; the store behind the identity header is shared. §5 itself frames per-window independence as acceptable-because-rare rather than as a correctness property, and sharing is the safer direction — two windows cannot diverge. The amendment wanted is in D10.

### Readiness Assessment

**Overall Status: READY WITH MINOR GAPS.**

**Confidence: high** — and the reason is the process rather than the document. This architecture was wrong in three load-bearing ways after six careful steps, and it took four independent lenses to find them; every one was a *seam* between sections that were individually correct. A document that had not been adversarially reviewed would have shipped all three into implementation, where the generation gap in particular would have surfaced as SM-3 failures — the Cockpit confidently showing the wrong Project — with no mechanism to explain why.

**Key strengths.** The failure model is unusually complete for a personal tool: twenty-eight enumerated states, each separately worded and separately recoverable, with a typed contract enforcing them across the network boundary. The PRD's empirical findings from 2026-09-17 are carried as binding constraints rather than notes. And the document's deliberate absences — no CI, no container, no shared UI package, no e2e scaffold — are recorded as decisions with reasons, which is what stops the next agent adding them by reflex.

**Areas for future enhancement.** The multi-window story is correct but minimal (PRD §5 accepts that independent windows do not synchronise; as of D10 they do at least share one resolution cache, so they cannot disagree about *who* the Project is). Session eviction is tuned by judgement rather than measurement and should be revisited against SM-C1 once there is real usage.

### Implementation Handoff

**Agents implementing this project MUST:** follow the D-decisions and P-patterns as written; add a `DsCode` *and* its `EXPERIENCE.md` row in the same change when adding a failure mode; never name the pjangler identifier anything but `pjid`; and treat this document as the authority on architecture, `EXPERIENCE.md` on behaviour, and `DESIGN.md` on appearance — with the two spines winning on conflict within their own domains.

**First implementation story:** the monorepo scaffold (sequence step 0), then `contract/`. **The Bloodbank gateway fix (D4) has no dependency on this repository and should start first**, in parallel with everything else.

---

## Architecture Complete — Handoff

*Step 8. Workflow closed 2026-09-22.*

### What this document became

It opened on 2026-09-18 as a context analysis and paused at step 2 for four days while `bmad-ux` ran. It closes at **1,253 lines, twenty-one numbered decisions (D1…D21), nine implementation patterns (A-P1…A-P9), a complete project tree, and a validation section that records three blockers found and closed rather than three blockers avoided** — plus a post-completion sweep that found four more and a 2026-09-22 ruling that closed two of them.

The number worth remembering is not the line count. It is that **after six careful steps this architecture was wrong in three load-bearing ways**, every one a *seam* between sections that were individually correct, and it took four independent adversarial lenses to find them. The most dangerous — the `(pjid, generation)` guard that PRD §11 names as SM-3's entire enforcement — appeared four times in the document as a noun and nowhere as a mechanism. Unreviewed, it would have shipped into implementation and surfaced as the Cockpit confidently showing the wrong Project, with nothing in the codebase to explain why.

### Document authority, and what wins on conflict

| Document | Owns | Status |
|---|---|---|
| `prds/prd-sidepiece-2026-09-17/prd.md` | **What and why.** FR-1…FR-16, the NFRs, scope, metrics. §3 Glossary is binding vocabulary everywhere. | `final` |
| `ux-designs/…/EXPERIENCE.md` | **How it behaves.** IA, DS-1…DS-28, interactions, accessibility, journeys. | `draft` — see below |
| `ux-designs/…/DESIGN.md` | **How it looks.** 54 tokens, Night Paper dark mode, component visuals. | `draft` — see below |
| `architecture.md` *(this)* | **How it is built.** Decisions, patterns, structure, boundaries. | complete |

Each is authoritative in its own domain and defers in the others. Where this document touches behaviour it is restating `EXPERIENCE.md`, which wins; where `EXPERIENCE.md` touches structure it is restating this document, which wins.

**`[NOTE FOR PM: both UX spines still carry `status: draft`.]`** They are *content*-complete — each survived two adversarial audits, and `EXPERIENCE.md` was amended again during this document's step-7 remediation — but `bmad-ux`'s Finalize step never ran, so there are no promoted mockups, no input reconciliation, and no doc-standards prose pass. **This architecture treats them as binding anyway, which is the honest position given what they contain, but the lifecycle gap is real and should be closed rather than ignored.** It is cheap: the run folder is intact and the workflow supports resuming.

### The handoff payload for `bmad-create-epics-and-stories`

**Start outside this repository.** `[NOTE FOR PM: D4 is the only work with no dependency on Sidepiece, and it should start first, in parallel with everything else.]` `33GOD/bloodbank/services/hermes-gateway/bloodbank_hermes_gateway/adapter.py:691` — `send()` `del`s the agent's response text and returns success, so FR-9's result content is unbuildable until it is fixed. **It is not a Sidepiece patch:** every Bloodbank consumer that dispatches to an agent has been silently losing response text, so scope it as a Bloodbank fix that happens to unblock Sidepiece.

**A second cross-repo item, smaller and sharper.** `agents/hermes/pm/role.yaml` — the manifest of the very PM that FR-7 and FR-8 target — subscribes to `bloodbank.evt.repo.sidepiece.>` and `bloodbank.cmd.agent.sidepiece-pm.>`. Both embed an identity slug as a subject token, which the five-token grammar forbids, and **a PM subscribed to an illegal subject receives nothing.** `[NOTE FOR PM: addendum §B.1 may make this moot by routing dispatch through the fleet gateway rather than a per-agent subject — verify before writing a story for it, and if §B.1 holds, delete the subscriptions rather than correcting them.]`

**Sequencing.** Step 0 is the monorepo scaffold; step 0b is a three-page dev fixture (one `pjid`, none, two conflicting) that is FR-1's and D14's acceptance set; `contract/` is step 2 because everything imports it; WXT init is step 6, not step 1. This inverts EPIC A's June ordering, which put scaffolding and a UI kit first — PRD §10 already directed sequencing behind a working Bridge, and the dependency graph agrees.

**Three open items, none blocking implementation** — O1 (what emits the `pjid`), O2 (the `[v2]` annotation payload), O3 (whether DS-3 is distinguishable from DS-4 in practice). **O1 is the one that matters for planning:** it gates *acceptance* rather than implementation, and the dev fixture makes FR-1…FR-4 testable without it — but **v1 is inert in production until something emits the tag**, and that work has no owner in any document.

**Two deliberate divergences to carry upstream, both against PRD §5.** **D11** reinterprets FR-2's literal "monotonically increasing" as content-addressed: the sequence stays monotonic and never reuses a value, but re-resolving an unchanged Project Record is not an event. This serves §5's stated intent — a per-resolution counter would fire the guard on the common case and stay silent on the dangerous one. **D10**, added by the 2026-09-22 S1 ruling, puts FR-2's cache in `chrome.storage.local` keyed by pjid, which retires §5's "independent caches" while leaving independent *resolution state* intact. The PRD should be amended to match both rather than either divergence being "corrected" back; the exact wording is proposed in each decision.

### For agents implementing this

- **Follow the decisions and patterns as written.** Where you disagree, change this document in one commit rather than working around it per file.
- **Adding a failure mode means adding a `DsCode` *and* its `EXPERIENCE.md` row in the same change.** A-P2's rule; it was applied to itself when DS-23…DS-28 were allocated.
- **Never name the pjangler identifier anything but `pjid`** — not in a field, a column, a JSON key, or a local variable. This project has already made that mistake once, in its own specification.
- **A lint rule banning `project_id` outside the Plane adapter is five lines and forecloses it permanently.** Write it early.

### Post-completion coherence sweep — the handoff is NOT clean

*Appended 2026-09-22, after this document had been marked complete. A final end-to-end read of all
four artifacts — the first since the step-7 multi-agent remediation — returned **`clean: false`**.
Ten mechanical defects were fixed in place (commit `3a6254a`); four substantive ones were not,
because each needs a judgement rather than a correction. They are recorded here rather than
softened, because the next workflow reads these documents as a specification.*

**Update, later the same day.** Jarad ruled on the two items that were blocking: **`chrome.storage.local` for the cache, and 320px.** S1 and S4 are now closed here, and S2 — which cost this document nothing — is closed in `DESIGN.md`. Each entry below carries its **resolution first and its original problem statement verbatim underneath** — the statement is the record of why, and deleting it would delete the only evidence that a repair can generate its own defect. **S3 is the one still open.** The heading stays as written: it was true when it was written, and the point of this section is that a document can be marked complete and still not be one.

**S1 — RESOLVED 2026-09-22.** *Jarad: "`chrome.storage.local` for the cache".* The FR-2 resolution
cache lives in **`chrome.storage.local`, keyed by pjid** (`fr2:<pjid>`), with **D11's generation as
the staleness guard** and the 5-minute TTL kept at its value with a rationale that now holds. It is
read and written by the panel document **and** the service worker, which is what makes the
**Resolvable** icon state, the reopen paint and UJ-1 step 3 implementable rather than aspirational.
Carried through **D10** (rewritten), **D6** (the cache joins the `chrome.storage.local` tier, with
the authority question argued rather than sidestepped, and D6 gains the MUST that makes "authority
for nothing" operational), **the tree** (`lib/cache.ts` stays under `lib/` — that folder is already
the home for context-agnostic modules, and the panel-only rule lives on `stream.ts`, not on `lib/`),
**the FR-2 map row**, **the data-flow diagram**, the *"boundary that is not a boundary"* note, the
cross-cutting-concerns list, the D10→D11→SM-3 impact note, the B1 record, and both places that
counted the deliberate divergences. **Two carry-backs are filed rather than done, because they are
other documents' surfaces:** a `[NOTE FOR PM]` in D10 asking PRD §5 to amend *"independent caches"*,
and a `[NOTE FOR UX]` asking `EXPERIENCE.md` to move the resolution cache from *Not preserved* to
*Preserved* in its Chrome-restart row — **both have since been applied, and PRD §5 and
`EXPERIENCE.md`'s multi-window row now read "independent resolution state over a shared per-pjid
resolution cache".** **The problem statement below is left intact; it is the
record of why.**

**S1 — The step-7 fix for blocker B1 created a new B1-style seam, and it is the most expensive
item here.** D10 moved FR-2's cache into the Cockpit document, in memory, one per window, where it
"dies with the document". Three `EXPERIENCE.md` behaviours depend on that cache surviving a reopen
and are now unimplementable: the reopen path's *"the identity header paints next, from cache … the
difference between a reopen that feels instant and one that feels like a load"*; UJ-1 step 3's
*"the identity header is already painted from the FR-2 cache"*; and the extension icon's
**Resolvable** state, which fires *"or that is cached as resolved"* **with the Cockpit closed** —
from the service worker, which cannot read a panel-document's memory. **D10's own TTL rationale is
self-refuting**: five minutes chosen as "long enough that a dip-out-and-back reopen is served from
cache", from a cache that is empty on every reopen. `[NOTE FOR ARCHITECTURE: this needs a third
placement — the service worker, or `chrome.storage.local` keyed by pjid with D11's generation as
the staleness guard. PRD §5's "independent caches" described a consequence of per-document state,
not a requirement, and §5 itself accepts that per-window independence is a convenience rather than
a correctness property. Whichever is chosen, D6, D10, the tree, the FR-2 map row and the data-flow
diagram move together — the same five surfaces B1 moved.]`

**S2 — RULED 2026-09-22: 320px.** *Jarad: "and 320px".* **This document needed no change for it** —
step 2's constraint list and every measured claim here already treat 320px as the design target.
What moves is `DESIGN.md`: its 340px computation and its entire "verified fits" table must be
re-verified at a **284px usable column**, including the load-bearing `DISPATCHED COMMAND` claim that
refused the PRD-literal abbreviation. That is the UX spine's edit and not this file's.
**It has since landed** *(verified 2026-09-22, after the spine's own commit)*: `DESIGN.md`'s
Layout & Spacing chain is recomputed 320 → 284, all fifteen rows of the fits table are
re-derived with a `Was (304px)` column kept beside them, and `DISPATCHED COMMAND` sets complete
in a 244px row with **111.5px spare** — independently recomputed here as 18 ch × 7.36px =
132.5px, and the chain run backwards puts the term's floor at a **208.5px panel**, below any
width Chrome will draw. No string was abbreviated and no type size lowered.
**The problem statement below is left intact.**

**S2 — The four documents disagree about the panel's design width, and every measured fit hangs off
it.** `DESIGN.md` computes at **340px** ("Sidepiece's design width", 304px usable column);
`EXPERIENCE.md`, `addendum.md` §C.1 and this document all treat **320px** as the design target.
`DESIGN.md` states the cost itself: at 320px the usable column is 284px. So its entire "verified
fits" table — including the load-bearing claim that `DISPATCHED COMMAND` fits spelled out, which is
what refused the PRD-literal abbreviation — is computed twenty pixels wider than three of four
documents say the panel will be. `[NOTE FOR PM: this is a three-way call and it has a visible
product consequence. Resolve the width first, then re-verify the fits at whatever it is.]`

**S3 — `bmad-ux` was never finalized, and it is not a formality.** Both spines carry
`status: draft`. The skill's Finalize step is specifically what would have absorbed `DESIGN.md`'s
six-item handoff list into `EXPERIENCE.md` — **two items of which are live contradictions today**,
including S2. The run folder is intact and the workflow supports resuming.

**S4 — RESOLVED 2026-09-22.** This document's pattern series is now written and cited as
**`A-P1…A-P9`** throughout — the nine headings, every in-tree annotation (`[A-P2]`, `[A-P6]`, …) and
every prose citation. `EXPERIENCE.md`'s 22 references are untouched and are now unambiguous by
construction: **an unprefixed `P<n>` is the UX spine's, an `A-P<n>` is this document's**, and the
rule is stated at the head of the patterns section so it survives someone reading only that section.
**The problem statement below is left intact.**

**S4 — A P-number namespace collision.** `EXPERIENCE.md` carries 22 unqualified `P<n>` references
that predate this document, and this document then defined its own P1…P9. An unqualified "P5" now
resolves to two different rules depending on which file the reader has open. `[NOTE FOR
ARCHITECTURE: cheapest fix is to qualify this document's series as `A-P1…A-P9` or
`arch:P1…arch:P9` wherever it is cited from outside.]`

**Status, honestly stated.** *(Updated 2026-09-22, after the S1 and S2 rulings.)* The architecture
*workflow* is complete: all eight steps ran and this document is internally coherent. **S1 and S4
are closed** — S1 by Jarad's ruling, carried through every surface in this file, and S4
mechanically. **S2 is closed** — ruled at 320px, which cost this document nothing because it was already on
that number, and the one piece of it that was real work, the re-verification of `DESIGN.md`'s fits
at a 284px usable column, has since been done in the spine and checked here. **S3 remains open** and is now the last item:
both spines still carry `status: draft`, and `bmad-ux`'s Finalize step is what absorbs
`DESIGN.md`'s handoff list. The *document set* becomes one specification when that finalize runs and
the last of D10's two carry-backs lands. **The `[NOTE FOR UX]` one is done** — `EXPERIENCE.md`'s
Chrome-restart row now lists the resolution cache under *Preserved*, and its Rule 4 enumeration
of the `chrome.storage.local` tier now names it. **The `[NOTE FOR PM]` one is now applied too** *(2026-09-22)*: PRD §5 and
`EXPERIENCE.md`'s multi-window row both read **"independent resolution state over a shared
per-pjid resolution cache"**, with the reasoning inline — each panel keeps its own render, its own
`(pjid, generation)` frame and its own SSE subscription, so the independence that mattered
survives; only the duplicated store did not. **S1 is closed.** **Nothing still open in this
file produces a wrong story**, which was the bar S1 and S2 were being held to.

### A note on how this was produced

Three of this document's own factual claims were wrong and were corrected rather than quietly dropped: `node:sqlite`'s stability (it is a Release Candidate, not stable), a `DsCode` cited in the one worked example of the most important wire rule, and a dark-mode token count that was stale in five places across three documents. Two of the three sat behind sentences asserting they had been verified.

The step-7 repair then introduced eleven new inconsistencies of its own, seven caught by the pass that verified it, four more by a final coherence sweep. **A fix generates defects at roughly a third the rate of the original work.** That is the argument for verifying repairs rather than trusting the report that a repair happened, and it is the single most transferable thing this workflow produced.
