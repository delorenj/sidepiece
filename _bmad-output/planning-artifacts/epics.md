---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/prd.md
  - _bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/addendum.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/.decision-log.md
workflowType: 'epics-and-stories'
lastStep: 3
status: 'in-progress'
updated: 2026-09-22
---

# Sidepiece - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Sidepiece, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

Sidepiece is a Chrome MV3 side panel — the **Cockpit** — that reads a page-declared `pjid`, resolves it through a **Bridge** daemon on `big-chungus` into a pjangler **Project Record**, and puts a PM-agent chat and that Board's **Tickets** beside the page. One operator: **Jarad**. No code exists yet.

## Requirements Inventory

**Where these numbers come from.** This inventory is drawn from six documents, read in full, all of which were final or complete at the time of extraction (2026-09-22): the PRD (`prds/prd-sidepiece-2026-09-17/prd.md`, `status: final`, amended four times on 2026-09-22) and its addendum; `architecture.md` (`status: complete`, D1–D21, A-P1–A-P9, resolved items S1–S4, open items O1–O3); and the two UX spines `EXPERIENCE.md` and `DESIGN.md` (both `status: final`, 2026-09-22) together with the UX `.decision-log.md`. Nothing here was inferred from a mockup: `mockups/key-screens.html` is evidence, never specification, and `mockups/direction-foreign.html` is explicitly historical. The counts were verified mechanically against the sources rather than estimated — **16 FRs** (FR-1…FR-16, PRD §4), **10 NFRs** (PRD §5 carries nine bullets; the *Latency budget* bullet is split into NFR-7 and NFR-8 below, see the note under the NFR list), **78 architecture requirements**, **91 UX design requirements** covering all **25** `{components.*}` keys declared in `DESIGN.md`'s frontmatter, all **54** design tokens (32 colours + 6 typography roles + 3 rounded + 8 spacing + 5 marks), and all **28** degraded states DS-1…DS-28. A reader six months from now should take these as counted, not guessed.

**Numbering form.** IDs use the PRD's own hyphenated form (`FR-1`, `NFR-1`) rather than the bare `FR1`. All four upstream artifacts cross-reference the hyphenated form, so a traceability map written as `FR9` would not grep against `architecture.md` or `EXPERIENCE.md`. If the hyphen is ever stripped, strip it everywhere or nowhere.

### Functional Requirements

**FR-1: Detect a declared pjid on the active tab, on initial load and on every subsequent navigation.** Testable obligations: (a) a page declaring a pjid is detected within 500ms of navigation completing; (b) a client-side route change that replaces the page without a document load re-triggers detection — a declarative content script alone does NOT satisfy this, history transitions must be observed explicitly (MutationObserver on `<head>`, `history.pushState`/`replaceState` patch, or `webNavigation.onHistoryStateUpdated`; `popstate` alone is insufficient); (c) a page declaring no pjid yields the unrecognized state, never a stale previous Project; (d) switching browser tabs re-evaluates against the newly active tab and the panel document is updated in place rather than reloaded; (e) detection works on a page served from any origin, including one never seen before; (f) a page whose declared pjid changes without a navigation is re-detected and the Cockpit re-resolves rather than continuing against the previous Project. `[ASSUMPTION: the declaration is a meta tag in <head>; "in the served HTML, readable without executing page JS" is a product requirement — it must work on a static page with scripting disabled.]`

**FR-2: Resolve a detected pjid to a full Project Record via the Bridge, which derives it from the pjangler Registry.** Testable obligations: (a) a pjid present in the Registry resolves to repo name, local clone path, Board binding, and Agent bindings; (b) a pjid absent from the Registry produces a distinct "declared but unknown" state, worded differently from "no pjid declared" — different causes, different fixes; (c) resolution results are cached per pjid and the cache is explicitly bounded — it expires on a stated TTL, is invalidated when Bridge health transitions unreachable→reachable, and every FR-3 failure state offers a re-resolve control; an unbounded "cached for the panel session" is not acceptable because it makes FR-3's stale states unreachable; (d) **AMENDED 2026-09-22** — each resolution is stamped with a CONTENT-ADDRESSED generation, not a per-resolution one: the Bridge hashes the Project Record it derived and advances the generation only when the hash changes, so re-resolving an unchanged record is not an event; the sequence remains monotonic and never reuses a value (architecture D11); (e) resolution completes within the §5 budget (≤1s p95), measured over the tailnet rather than on loopback.

**FR-3: Report every unresolved and degraded state honestly.** FR-3 is the single authoritative enumeration of states in which the Cockpit cannot fully function, and other FRs reference it rather than restating their own lists. Testable obligations: (a) each of the following is separately rendered and separately worded — no pjid declared; pjid declared but unknown to the Registry; Bridge unreachable; Bridge reachable but unhealthy, named by which dependency failed (per FR-14); Registry readable but the Project's clone path missing on disk; an Agent binding whose `role_dir` does not exist; (b) no failure state renders as an empty or loading panel; (c) the Bridge-unreachable state distinguishes "laptop is off the tailnet" from "`big-chungus` is not answering" where the two are distinguishable, since the fixes differ; (d) every failure state carries a re-resolve control (per FR-2). **SIZING — AMENDED 2026-09-22 (§8.1): the count is TWENTY-EIGHT, not the six listed above.** The built taxonomy is DS-1…DS-28, defined in `EXPERIENCE.md` and typed in `contract/src/state.ts`, plus three non-DS typed code spaces. FR-5's two Agent states and FR-12's no-Board state each gate a whole pane and appeared in none of the six; the architecture's step-7 validation added six more (DS-23…DS-28). Sizing this at six is a 4.7x error and the PRD names it "the single most likely place the backlog goes wrong."

**FR-4: Display the resolved identity in the Cockpit** — the literal payoff of the page-to-project bridge, without which FR-2's output is invisible and SM-3 is unobservable. Testable obligations: (a) repo name, local clone path, and Board identifier are visible whenever a Project is resolved, without opening a menu or a detail view; (b) the local clone path is selectable as text so it can be copied into a terminal; (c) when the resolved Project changes, the displayed identity changes in the same frame as the rest of the Cockpit — never one pane showing a Project the others have moved on from.

**FR-5: Surface Agent presence and distinguish a declared Agent from a running one;** a Registry declaration is an intent, not evidence that an Agent exists or is reachable. Testable obligations: (a) three states are distinguished, not two — no PM declared; a PM declared but not present in the Hermes fleet registry or not reachable; a PM declared, present, and reachable; (b) chat is enabled only in the third state, and the first two disable it with their own distinct reason; (c) the no-PM-declared state names the exact provisioning command (v1 states the command; it does not run it — one-click provisioning is §9); (d) neither degraded Agent state disables the Tickets pane. `[ASSUMPTION: the middle state is not hypothetical — Sidepiece's own .project.json declares sidepiece-pm, which does not appear in the Hermes fleet registry, so a design that reports declaration as presence is wrong about this repo on day one.]`

**FR-6: Classify every Turn as a Streamed Exchange or a Dispatched Command before it is sent.** The split is the feature, so the classifier is a requirement rather than an implementation note, and it needs a stated rule, a stated bias, and an escape hatch. Testable obligations: (a) every Turn is classified before send, by a rule specific enough that the same Turn always classifies the same way; (b) the classification is visible on the composer before the operator commits, and one control flips it; (c) the classifier biases toward Dispatched Command when uncertain; (d) three example Turns per branch are specified and used as test cases — at minimum `what's in progress?` and `summarize the board` classify as Streamed Exchange, and `start on the resolver ticket` and `fix the failing test` classify as Dispatched Command; (e) a manual override is remembered for the remainder of that Turn only, never applied implicitly to later Turns. `[ASSUMPTION: an explicit rule plus a visible override beats a perfect classifier; the rule's exact form is an architecture decision, that a rule exists and is overridable is the product requirement.]`

**FR-7: Answer Turns classified as conversational inline and incrementally, without waiting for completion.** Testable obligations: (a) the turn is ACCEPTED within 500ms — a visible "the PM has your turn" state, distinct from a response (measured at 79ms against the live gateway); (b) the FIRST CONTENT TOKEN renders within 8s p95 on a warm session — warm measured 3.8–5.1s — while a cold session carries no first-token budget and renders an explicit "warming up the PM" state instead (cold measured 7.1–17.1s); the earlier 2s figure was never achievable by any mechanism on this hardware; (c) a decorative placeholder frame does not count as a first token — the upstream gateway emits `thinking.delta` spinner text before real content, and rendering that as the answer would be measuring an animation; (d) partial output is visible while generating; the panel never shows only a spinner for a response in progress; (e) closing and reopening the panel mid-stream does not lose the Turn — the completed answer is retrievable on reopen, while partial tokens are best-effort and may be lost; this requires the Bridge to hold Turn state keyed by pjid and Turn id (FR-15), because the panel document is not the system of record; (f) a stream that dies mid-response is reported as failed, not left indefinitely pending.

**FR-8: Publish Turns classified as work assignment to Bloodbank as commands, acknowledged rather than answered.** Testable obligations: (a) a dispatched Turn produces a visible acknowledgement carrying a correlation identifier within the §5 budget (≤2s); (b) the Turn is rendered as dispatched, visibly distinct from a Streamed Exchange; (c) a rejected or unpublishable command surfaces the rejection, never silent success; (d) the subject conforms to the five-token contract (`bloodbank.<kind>.<domain>.<entity>.<action>`, no version segment, no identity tokens) and is validated before publish — `bb contract` is the authority and `bb emit --check` validates any producer name. Dispatch travels the fleet gateway (`bloodbank.cmd.agent.invocation.start`, target agent in `actor.agent_id`), not a per-agent subject.

**FR-9: Carry a Dispatched Command through to its outcome and its result** — a dispatched Turn is not abandoned at acknowledgement, and a status is not an answer. Testable obligations: (a) each dispatched Turn shows a terminal status — completed, failed, or timed out — once the corresponding outcome is observable; (b) a completed Dispatched Command renders its RESULT CONTENT in the Turn, not only its status — without this, a misclassified question is a dead end on the classifier's preferred failure side and FR-6's bias toward dispatch is unjustified; (c) outcomes are correlated back to the originating Turn by identifier, not by ordering or recency, and specifically by a `correlationId` the Bridge minted itself (dispatch outcome events carry no repo or project, so §6's `data.repo` filter does NOT apply to this leg); (d) a dispatch with no observed outcome within a configured window is shown as unknown, not as success, and the window is long enough that ordinary agent work does not routinely trip it; (e) outcomes arriving while the panel is closed are reconciled on next open. **Note: FR-9(b) is blocked on another repo — see the Prerequisites section.**

**FR-10: Attach page context to every Turn** — the PM is being asked about a page it cannot see, and a Turn that omits the page is a Turn the PM has to guess at. Testable obligations: (a) every Turn carries the active tab's URL and page title alongside the operator's text; (b) the operator can see what context is attached before sending; (c) context attachment survives the FR-6 classification — both Streamed Exchanges and Dispatched Commands carry it.

**FR-11: Scope chat history to the Project and make it survive the panel closing.** Testable obligations: (a) reopening the Cockpit on the same Project restores that Project's prior Turns; (b) two Projects never share history; (c) history survives a Chrome restart and an extension service worker termination; (d) history is appended per Turn rather than rewritten wholesale, so two Cockpits on the same Project (see NFR-4) cannot clobber each other.

**FR-12: List the resolved Board's Tickets grouped by state.** Testable obligations: (a) Tickets render grouped by Board state, in the Board's own state order, not alphabetically; (b) each Ticket shows its human key, title, and state; (c) a Project with NO Board binding renders the Tickets pane as unavailable with the reason stated — distinct from an empty Board and distinct from a failed fetch — names the command that binds one, and disables create rather than failing it, while chat stays fully usable; four of the nineteen registered Projects have no board (`codegraph-voyage`, `legofirst`, `momo`, `vinyl`), and the field is an EMPTY STRING, never null and never absent, so the check must be for truthiness — a `!= null` or key-presence test reports a board for all four and renders the pane against an empty id; (d) an empty Board renders as empty, distinct from both of the above; (e) each Ticket links to its Plane URL, opening in a new tab; (f) the list is fetched fresh on Project resolution, not served from a prior Project's cache, and offers a user-initiated refetch; (g) Board reads complete within the §5 budget (≤2s p95) or render a timeout state.

**FR-13: Create a Ticket on the resolved Board from the Cockpit, deliberately minimal.** Testable obligations: (a) a Ticket can be created with a TITLE ALONE; (b) description and target state are optional, and omitting state uses the Board's default entry state; (c) the Ticket is created on the resolved Project's Board and no other — the Board is never chosen by the user; (d) on success the new Ticket appears in the list without a manual refresh; (e) on failure the entered text is PRESERVED and the error is shown — a failure never costs the operator their typing.

**FR-14: Make Bridge health observable from the Cockpit.** Testable obligations: (a) the Cockpit distinguishes Bridge reachable, unreachable, and reachable-but-unhealthy, feeding FR-3's enumeration; (b) an unhealthy Bridge reports WHICH downstream dependency is failing — Registry, Plane, Bloodbank, or Agent gateway — rather than a generic error; (c) the Bridge exposes a health endpoint returning per-dependency status; (d) health distinguishes "the pjangler registry service is not running" from "the Registry returned an error", because the former has a different fix; (e) health reports whether the PM's PROVIDER CREDENTIALS ACTUALLY RESOLVED, not merely that the agent backend is reachable — a Hermes process that starts without vault auth falls through to unresolved `op://` literals, fails provider auth, and silently downgrades to a fallback model, producing correct-looking answers at the wrong cost and latency; verified on this machine, `hermes-dashboard.service` had been running in exactly that state since 2026-09-09.

**FR-15: Run the Bridge as a supervised, tailnet-bound, out-of-band-inspectable daemon that holds Turn state.** Testable obligations: (a) it runs under `systemd --user` on `big-chungus` — starts on login, restarts on failure, no manual intervention; (b) it is reachable from the laptop over the tailnet and NEVER on `0.0.0.0` — `tailscale serve` fronting a loopback-bound Bridge satisfies this and is preferred (Tailscale then owns the tailnet socket, TLS termination and certificate renewal), a direct tailnet-interface bind also satisfies it, and what is forbidden is a public bind or a loopback-only bind with nothing fronting it; (c) restarting the Bridge does not require reloading the extension; (d) the Bridge is inspectable with `curl` from either machine — every capability the extension uses is reachable without the extension; this is a HARD requirement, not a convenience, because a bridge that can only be exercised through Chrome makes every bug a two-variable bug; (e) it holds Turn state keyed by pjid and Turn id, so FR-7's reopen guarantee and FR-9's closed-panel reconciliation are satisfiable; (f) its logs are readable via the `big-chungus` journal, with no log aggregator required.

**FR-16: Resolve every credential from the 1Password vault, never from disk.** Testable obligations: (a) every credential resolves from 1Password at process start or per-request; (b) no credential is written to a file in the repo, INCLUDING files intended to be gitignored; (c) a failed credential resolution surfaces as an unhealthy dependency in FR-14, naming which one.

### NonFunctional Requirements

**Note on the count.** PRD §5 carries **nine** bullets. The *Latency budget* bullet is split here into **NFR-7** (the budget set itself — an instrumentation surface) and **NFR-8** (the DERP-relay degradation carve-out and the "timeout state, never indefinite pending" rule — a rendering contract), because each is an independently testable claim with a different implementation surface. Document order is otherwise preserved. The four the PRD calls genuinely shaping are tagged `[SHAPING]`.

**NFR-1: `[SHAPING — trust boundary]`** The tailnet is the authentication boundary. The Bridge performs no application-level authentication of its caller: WireGuard device authentication already gates who can reach it, and a token scheme on top would be ceremony on a single-user tool. The accepted consequence, stated so it can be revisited rather than assumed: anything on the tailnet can call the Bridge. Binding to `0.0.0.0` would not be acceptable and is prohibited by FR-15.

**NFR-2: `[SHAPING — failure posture]`** Every pane fails independently and says why. A dead Bloodbank must not take down Tickets; an unreachable Plane must not take down chat. No pane may render a failure as an empty state or a permanent spinner. FR-3 is the authoritative state enumeration that all pane-level failure rendering resolves against.

**NFR-3: `[SHAPING — panel lifetime]`** All long-lived connections — chat streams, event subscriptions — live in the panel document, never in the extension service worker, which is terminated after roughly 30s idle. The panel document stays alive across tab switches while open, so in-panel state survives navigation; it does not survive the panel closing (nor, per addendum §C.1, the panel being COLLAPSED, which is the same teardown event). Anything that must outlive it is held by the Bridge (FR-15), not persisted client-side.

**NFR-4: `[multiple windows]`** Chrome's side panel is per-window, so two Chrome windows mean two Cockpit documents with INDEPENDENT RESOLUTION STATE OVER A SHARED PER-PJID RESOLUTION CACHE (amended 2026-09-22: architecture D10 places FR-2's cache in `chrome.storage.local` keyed `fr2:<pjid>`, so the store behind the identity header is shared across windows and readable by the service worker; each panel still holds its own render, its own `(pjid, generation)` frame and its own SSE subscription). v1 does not attempt to synchronize the windows — each is independently correct for its own window, and FR-11's append-per-Turn history rule keeps them from clobbering each other.

**NFR-5: `[opening the panel]`** Chrome requires a genuine user gesture to open a side panel, and `chrome.sidePanel.open()` must be the FIRST SYNCHRONOUS CALL in the gesture handler — anything awaited first silently no-ops with no thrown error, presenting as an intermittent "sometimes doesn't open" heisenbug. Sidepiece therefore cannot auto-open on detection; the extension icon carries the "this tab is resolvable" signal so that opening it is an informed click.

**NFR-6: `[origin reach vs. permission scope]`** Declaration-based resolution is origin-independent by design, but the content script that reads the declaration is bound by its host match pattern, and a narrow allowlist would reintroduce exactly the origin coupling the declaration model was chosen to remove. Sidepiece takes the BROAD MATCH and accepts the one-time permission prompt — valid only while this remains a personally-loaded extension with no store review. `[ASSUMPTION: if §7's portability non-goal is ever revisited, this decision is the first thing that breaks.]`

**NFR-7: `[SHAPING — latency budget, measured over the tailnet]`** Detection ≤500ms (local to the browser, unaffected by the network). Resolution ≤1s p95 (measured 2.4ms p50 locally). Board read ≤2s p95. Dispatch acknowledgement ≤2s. Chat is TWO budgets, not one: turn accepted ≤500ms, and first content token ≤8s p95 warm with NO BUDGET cold. All figures are end-to-end from the laptop and must hold with the laptop on the same LAN as `big-chungus`. The single ≤2s first-token figure in earlier drafts was aspirational and is unachievable on this hardware.

**NFR-8: `[latency budget — degradation and timeout behaviour]`** Budgets are explicitly NOT guaranteed when the tailnet falls back to a DERP relay; that case renders a degraded-connection indicator rather than silently missing the budget. Missing any budget renders a timeout state, never an indefinite pending one.

**NFR-9: `[cost of being wrong]`** Sidepiece must never act against the wrong Project. Each resolution carries a monotonic generation number (FR-2); every mutating call carries `(pjid, generation)`, and BOTH the panel and the Bridge refuse a mutation whose generation is stale. Comparing the pjid against the Board it targets would be a tautology — the Bridge derives the Board from the pjid — so the generation is what actually catches a Project that changed under an in-flight action. A confidently wrong ticket is worse than a failed one.

**NFR-10: `[local network access / PNA]`** Chrome's Private Network Access rules have shipped in stages and continue to, and a Bridge call that works today can start failing after an unrelated Chrome auto-update. Mitigations are UNCONDITIONAL: the Bridge answers preflights with the private-network CORS headers (`Access-Control-Allow-Private-Network: true`) alongside normal CORS headers from day one, and is served over HTTPS with a real (Tailscale MagicDNS) certificate. Reachability is re-verified on Chrome version bumps rather than assumed solved. (§12 Q7, downgraded 2026-09-20 from a discovery to a one-off confirmation — expect no prompt at all; HTTPS is a precondition for Chrome to ASK, not an exemption from asking.)

### Additional Requirements

These 78 requirements come from `architecture.md` (`status: complete`), which carries decisions **D1–D21**, patterns **A-P1–A-P9**, a full project tree, a validation section, and a closing sweep with resolved items S1–S4 and open items O1–O3. Every item cites its source section. They are grouped by area for readability; the grouping carries no priority.

#### 🚩 Starter template — and the counter-intuitive sequencing it forces

**AR1: STARTER TEMPLATE — WXT v0.21.4**, selected over Plasmo, CRXJS and hand-rolled Vite. Initialization command is exactly `pnpm dlx wxt@latest init` with the **react** template (all templates are TypeScript by default; generated scripts: `dev`, `dev:firefox`, `build`, `build:firefox`, `zip`, `zip:firefox`, `postinstall`). [architecture.md § Starter Template Evaluation / Selected Starter: WXT]

**AR2: WXT init is NOT Epic 1 Story 1.** It is sequenced at implementation step 6 (Extension shell), not step 1. `pnpm dlx wxt@latest init` and `shadcn@latest init` are explicitly excluded from the first implementation story; scaffolding a WXT app four steps before anything renders "buys a loadable stub and a month of drift." [architecture.md § Starter Template Evaluation, step-7 correction note; § Decision Impact Analysis; § Implementation Handoff]

**AR3: The first implementation story is the monorepo scaffold (sequence step 0)**: `pnpm-workspace.yaml`, root `package.json` (scripts only, no deps), `tsconfig.base.json` (strict, extended by all three packages), `biome.json` (formatting + lint incl. the A-P1 `project_id` ban), `mise.toml` gaining dev/build/deploy tasks. It produces no component and no page. It exists because `contract/` is a workspace package and cannot be created without it. [architecture.md § Decision Impact Analysis, sequence step 0]

#### Repository shape and the shared contract

**AR4: Repository shape is a pnpm monorepo with exactly three packages** — `packages/extension/` (WXT + React, ships to Chrome only), `packages/bridge/` (TypeScript/Node daemon, ships to `big-chungus`), `packages/contract/` (shared types, imported by both, owns nothing at runtime). [architecture.md § Repository Shape]

**AR5: `contract/` is load-bearing, not tidy, and it is sequence step 2 because everything imports it.** The FR-3 degraded-state taxonomy grew from a self-declared 6 to 22 (UX run) to **28** (step 7); most states are produced by the Bridge and rendered by the Cockpit across the network boundary, and a taxonomy that drifts between the halves produces exactly the failure FR-3 exists to prevent. The same argument covers the Project Record shape, the Turn envelope, the classification enum and the correlation-id contract. [architecture.md § Why `contract/` is not optional]

**AR6: Bridge runtime is TypeScript/Node**, chosen specifically so `contract/` is real rather than mirrored — one definition, imported by both sides, checked by `tsc` on each. Go was rejected despite better deployment and concurrency because it would turn the shared contract into hand-maintained duplication. [architecture.md § Bridge Runtime]

**AR13: `contract/src/state.ts` exports `DsCode` as a string union of the literals `'DS-1' … 'DS-28'`, split by producer**: `BridgeDsCode` (what a Bridge response may carry in `degraded[]`), `ClientDsCode` = `'DS-1' | 'DS-3' | 'DS-4' | 'DS-5' | 'DS-16' | 'DS-21' | 'DS-27'` (what the extension produces without asking anyone), `DsCode` their union. The split is enforced by `tsc`: a Bridge route cannot emit `DS-1`. [architecture.md A-P2]

**AR14: Three failures are typed but deliberately NOT `DsCode`s and get their own code spaces in `contract/src/state.ts`**: the stale-generation `Refusal` (D11), `SubscriptionState` (SSE not established — a property of this open, not of the Project), and `IconTransient` (the icon's gesture transient). [architecture.md A-P2]

**AR15: Adding a failure mode means adding a `DsCode` AND its `EXPERIENCE.md` row in the same change** — never a new free-text message. This is human-checked; no linter can see it. [architecture.md A-P2; § Enforcement; § For agents implementing this]

**AR16: `contract/` exports `CONTRACT_VERSION` as a plain integer** (not the package version, not semver), bumped by hand in the same change as any breaking change to a `contract/` type. [architecture.md D12]

**AR17: The `CONTRACT_VERSION` handshake is three mechanisms**: the Bridge echoes it on `GET /v1/health` **and** as an `X-Sidepiece-Contract` header on every response; `lib/bridge.ts` compares it once per panel-document open **and** again on every health transition unreachable→reachable; a mismatch in either direction is **DS-27**, gated **Total**, naming which side is older, produced by the Cockpit. [architecture.md D12; A-P5 last MUST]

**AR18: `contract/src/project.ts` carries `Project`, `ProjectRecord` including `generation: number`, `pjid`, and `ticketProvider`.** [architecture.md D11, D21, tree]

**AR19: `contract/src/classify.ts` holds the FR-6 verb allowlist and its corpus; `classify.test.ts` holds `EXPERIENCE.md`'s six-Turn corpus verbatim** (three per branch, four of them from FR-6 itself) as the acceptance set. The rule is a leading-verb allowlist plus an imperative-mood test — not a bag of keywords anywhere in the sentence. Unclassifiable goes to Dispatched Command; the standing default on an empty composer is Dispatched Command; there is no blank state to render. [architecture.md D13]

**AR20: The classification rule is evaluated in two places against one function**: the Cockpit evaluates it on a typing pause (never on a keystroke) and renders the result; the Bridge re-evaluates it authoritatively at send and **honours an explicit override rather than overriding it**. The re-evaluation exists so a stale extension build cannot dispatch something the current rule would stream. [architecture.md D13; FR-6 map row]

**AR21: `contract/src/turn.ts` types `StreamFrame` to discriminate content from placeholder, and the mapping is made exactly once, in `turns/stream.ts`.** The upstream gateway's `thinking.delta` maps to `{ kind: 'placeholder' }` and never to `{ kind: 'content' }`; **FR-7's first-token measurement starts at the first `content` frame**. An untyped passthrough of the upstream frame ships a budget measured against an animation. [architecture.md A-P5]

**AR22: MUST — anything crossing the network boundary lives in `contract/` and only there.** A type defined in `contract/` must never be re-declared in `extension/` or `bridge/`, however convenient the local copy looks. Enforced by `tsc`. [architecture.md A-P9; § Enforcement]

#### Bridge runtime, store and schema

**AR23: The Turn store is `node:sqlite` on Node 24 Active LTS.** No native module to compile, therefore no build toolchain on `big-chungus`; `better-sqlite3` and `sqlite3` are both unnecessary. Corrected 2026-09-22: `node:sqlite` is **Stability 1.2 Release Candidate** (not Stability 2), available since **22.13.0**, current at **24.15.0**. [architecture.md D1]

**AR24: MUST — the systemd unit invokes an absolute path to a pinned Node 24 binary**, not `node` from `PATH` and not a `latest` alias. `mise` on this machine currently resolves `node/lts` to v24.15.0 and will move on its own when Node 26 becomes LTS on 2026-10-28; the exposure is live, not theoretical. [architecture.md D1]

**AR25: MUST — `main.ts` asserts `process.versions.node` satisfies `>=24.15.0 <25` at startup and exits with a stated message if it does not.** A drifted runtime must fail loudly at start rather than at the first `DatabaseSync` call, three hours into a session, as a Degraded nobody can attribute. [architecture.md D1]

**AR26: The SQLite schema is four tables, plural snake_case**: `turns`, `dispatches`, `ticket_creates`, `resolutions`. `registry_snapshots` does **not** exist — D2's snapshot is a JSON file. Columns are snake_case; timestamps are stored as ISO-8601 TEXT, not integers. [architecture.md A-P6]

**AR27: The `resolutions` table is `pjid` primary key, `generation`, `record_hash`, `resolved_at`, plus D5's `clone_path` and `board_id`.** Persistence is not optional: without it a Bridge restart resets every counter to 1 and a client holding 4 would out-rank the Bridge. It is a high-water mark and only ever goes up, including across a pjid that leaves and re-enters the registry. [architecture.md D11]

**AR28: Every persisted row carries `clone_path` and `board_id` alongside `pjid` as recovery metadata (never keys)**, because the pjid is mutable author-controlled text and renaming it deletes and re-keys the registry row, orphaning anything persisted by it. A row whose pjid no longer resolves is not deleted and not silently ignored — it is detectable and re-linkable by matching either field. [architecture.md D5; A-P6]

**AR29: Every mutating row carries a `generation` column alongside `pjid`** — `turns`, `dispatches`, `ticket_creates`. It is not a key and not recovery metadata; it is the answer to "which Project was this actually written against", which is the only way SM-3 is ever audited after the fact. [architecture.md D11; A-P6]

**AR30: Schema versioning via a `user_version` pragma with forward-only migrations at startup** (`db/migrations/`). A `user_version` **ahead** of the migrations this build carries — what a rollback produces — is **DS-25**: the Bridge starts, resolution and Tickets stay live as storeless reads, and **Chat is gated**, because Turn history and Turn state are the store. [architecture.md D7]

**AR31: `turns/store.ts` is the only module that opens the database**; nothing else imports `node:sqlite`, and the snake_case ↔ camelCase mapping happens there and nowhere else — once per table, never in a route handler and never twice. [architecture.md A-P6; § Data boundary]

#### Registry, snapshot and the generation guard

**AR32: The registry client fetches `GET /v1/registry` and indexes client-side** — there is no per-pjid endpoint; all 19 projects come back as one ~33KB object, measured at 2.4ms p50. [architecture.md § Technical Constraints; Integration Points]

**AR33: `board_id` is an empty string, never null or absent, for boardless Projects (4 of 19)** — a null check or key-presence test reports a board for all four. Truthiness is the only check that works. The same rule governs D14's empty-`content` meta tag. [architecture.md § Technical Constraints; D14]

**AR34: D2 — the registry fallback is a last-good snapshot on disk.** The Bridge writes the registry payload plus its fetch timestamp to `<state-dir>/registry-snapshot.json` on **every successful fetch**, read by `registry/snapshot.ts`. It is a file, not a table, so the resolution leg is not coupled to the Turn store's schema version. Reading `.project.json` off the filesystem was rejected on drift grounds — it would reimplement pjangler's own indexing including `normalizeProjectId` and the `project_id`/`project_slug` aliasing. [architecture.md D2]

**AR35: The snapshot is never served silently** — a resolution served from it is marked stale in the same frame as the identity, and carries **DS-23** (*Registry unreachable, resolution served from the last-good snapshot*), gating no pane, marking the header with the snapshot's age. **D9: the age is surfaced, never enforced** — there is no expiry threshold, and that absence is the decision. [architecture.md D2, D9]

**AR36: D2 moves DS-6 and DS-7 across the total/partial line and both branches must be built.** With a snapshot on disk they are **partial** (Project resolves from snapshot, header marked stale, panes stay live, DS-23 carries the age). With no snapshot — a Bridge that has never had a successful fetch — they remain **Total**: header replaced by one shared notice, pane switch inert. [architecture.md D2; PRD §6 amendment 2026-09-22]

**AR37: D11 — the generation is minted by the Bridge, scoped per pjid, and is content-addressed.** On a successful registry fetch the Bridge hashes the Project Record it derived (repo name, clone path, board binding, agent bindings — the FR-4/FR-2 payload, nothing else); if the hash differs from the one persisted, the generation increments and the new hash is stored. If the hash is unchanged the generation is unchanged, however many times the record is re-resolved by however many windows. **A resolution served from the D2 snapshot never advances it.** [architecture.md D11]

**AR38: Every Bridge response for a resolved Project carries `generation` at the top level, not only resolution answers**, so a client that has done anything since the record changed already holds the current value and the local pre-check is real rather than decorative. [architecture.md D11]

**AR39: Every mutating request carries `(pjid, generation)` and the Bridge checks it before the capability runs.** The pjid is in the path (`POST /v1/project/:pjid/turn`, `POST /v1/project/:pjid/ticket`); the `generation` is a required top-level field in the **request body, not a header**, because FR-15 makes the request body a curl surface and a guard hidden in a header is a guard nobody types. [architecture.md D11; A-P5]

**AR40: Stale is defined exactly once — `received < current` for that pjid.** Equal passes; greater is impossible and is a Bridge bug, logged as one. The refusal is `HTTP/1.1 409 Conflict` with `{ "error": "stale_generation", "pjid": "<pjid>", "received": 4, "current": 5 }` — deliberately **not** a `Degraded[]`, because nothing is degraded once a mutation is refused. The Cockpit renders `EXPERIENCE.md`'s exact sentence, keeps the text, and offers no re-resolve control. [architecture.md D11; A-P5]

**AR41: The generation guard is enforced in two places and both are required**: `registry/generation.ts` on the Bridge mints and compares, and every mutating route calls it before its capability; `lib/bridge.ts` attaches the generation on the client and **refuses locally first**, so the common case costs no round trip. PRD §5 requires both sides to refuse. [architecture.md D11; § Cross-cutting concerns → location]

**AR42: SM-3 needs a test of its own**: two windows, one Project, rename the pjangler record between them, assert the older window's create is refused with `409 stale_generation` and its text survives. [architecture.md D11, NOTE FOR PM]

#### Sessions, streaming and the Hermes gateway

**AR43: D15 — `POST …/turn` is a store write, not a session acquisition.** It validates `(pjid, generation)`, classifies per D13, writes the Turn row, and returns `{ turnId, kind, acceptedAt }` **synchronously**, touching nothing upstream. Session acquisition, warming and streaming all happen behind the SSE subscription keyed by `turnId`; `warming up the PM` is a frame on that stream, not a property of the POST. A POST that acquires the session first blows FR-7's 500ms budget by a factor of fourteen. [architecture.md D15]

**AR44: D3 — session pool is LRU with 3–5 warm sessions; eviction must never take a session with a Turn in flight** (streaming or awaiting a dispatch outcome). LRU among *idle* sessions only. [architecture.md D3; D8]

**AR45: The all-sessions-busy wait is bounded at 20 seconds, then terminal**, chosen to exceed the worst measured cold start (17.1s). On expiry the Turn is marked **DS-28** (*every warm session is busy; this Turn was not started*), gating Chat only. Kept separate from DS-24 because the fix differs. [architecture.md D15]

**AR46: Gateway error 4090 (active-session cap) must still be handled, not merely avoided** — other Hermes consumers share the ~37 profiles. It is **DS-24**, gating Chat only, worded for a cause the operator cannot fix by retrying. `sessions/errors-4090.ts`. **Not a retry loop.** [architecture.md D3]

**AR47: The Bridge pins a Hermes release in its unit and treats gateway protocol drift as a named failure mode.** `tui_gateway`'s JSON-RPC surface is Hermes *internals*, not a published API (Hermes 0.20.5, `config_version` 37 against a latest of 39); a renamed method produces a gateway that connects, answers, and refuses the call — **DS-26** (*the tui_gateway answered, but not with the surface this Bridge pinned*), gating Chat only, distinct from DS-13 because the fix is a version pin rather than a restart. [architecture.md § Technical Constraints; D3]

**AR48: `sessions/fleet.ts` reads the Hermes fleet registry at `~/.hermes/agents-registry.yaml`** — a seventh upstream, distinct from the gateway. FR-5's "declared but not present in the fleet registry" (DS-12) reads a different source from the gateway session DS-13 tests. [architecture.md § Integration Points]

#### Upstreams and adapters

**AR49: `registry/paths.ts` is a filesystem prober, and the Bridge is the only component that touches the filesystem.** It stats the clone path (**DS-9**) and each Agent binding's `role_dir` (**DS-10** for a non-PM, **DS-20** for the PM). **DS-10 occurs today on this repo**, so it is testable immediately. [architecture.md § Integration Points]

**AR50: Seven upstreams, one adapter folder each, and no upstream shared between two folders**: pjangler registry (`registry/client.ts`, HTTP), Hermes fleet registry (`sessions/fleet.ts`, YAML read), Hermes `tui_gateway` (`sessions/gateway.ts`, JSON-RPC/WS), Plane (`tickets/plane.ts` behind `tickets/index.ts`, REST), Bloodbank (`bloodbank/adapter.ts` publish + `bloodbank/outcomes.ts` consume, NATS), Candystore (`candystore/reader.ts`, HTTP), 1Password (`credentials/vault.ts`, `op`). [architecture.md § Integration Points]

**AR51: Candystore is split out of `bloodbank/adapter.ts` because `health/aggregator.ts` must probe them independently** — DS-18 (Bloodbank unreachable) gates half of Chat, DS-19 (Candystore unreachable) gates nothing at all. One adapter reporting for both cannot produce two blast radii. [architecture.md § Integration Points]

**AR52: D19 — dispatch outcomes arrive on a durable NATS consumer on `bloodbank.evt.agent.invocation.*`, scoped by `correlationId` alone**, matched against the outstanding set the Bridge persisted when it dispatched. **Durable is a requirement, not an optimisation**: FR-9 requires outcomes arriving while the panel is closed to be reconciled on next open, and a closed panel is the normal case for a command that takes twenty minutes — the consumer's position must survive a Bridge restart. Dispatch outcomes carry **no `data.repo` at all**, so the Project-scoped payload filter does not apply to them. [architecture.md D19; A-P3]

**AR53: Candystore is the backfill, not the primary**: on startup and on any consumer gap, `candystore/reader.ts` queries outstanding correlation ids directly. This is what makes a missed message recoverable rather than permanently unknown. [architecture.md D19]

**AR54: Correlation ids are minted as `correlationId` in `turns/dispatch.ts`, serialised to Bloodbank's `correlationid` (no separator) only inside `bloodbank/adapter.ts`, and matched back as `correlationId` in `bloodbank/outcomes.ts` and `turns/reconcile.ts`.** Foreign names never travel inward past the adapter. [architecture.md A-P4; § Cross-cutting concerns → location]

**AR55: A-P4 — JSON casing splits at the Bloodbank boundary and that is intentional.** Sidepiece's own surfaces (Bridge HTTP/SSE API, everything in `contract/`) are camelCase; Bloodbank envelopes keep Bloodbank's names byte for byte (`data.repo`, `actor.agent_id`, `command_id`, `idempotency_key`, `correlationid`). **Anti-pattern to forbid explicitly: a camelCase-ifying middleware applied to everything** — it silently rewrites `correlationid` and breaks the one mechanism PRD §12 Q2 confirmed works today. [architecture.md A-P4]

**AR56: A-P3 — Bloodbank subjects are five tokens, no version, no identity.** MUST NOT put a version token or an identity slug (repo name, agent id, pjid) in a subject; versioning lives only in `schemaref`/`dataschema`, identity in `data.*`/`actor.*`. MUST validate every new producer with `bb emit --check --type <type>` before publishing, and never hand-assemble `subject`, `schemaref`, `dataschema`, `kind`, `domain` or `actor`. [architecture.md A-P3; addendum §B.1]

**AR57: D21 — the ticket provider is read from the Project Record, not hardcoded.** `ProjectRecord` carries `ticketProvider`; `tickets/index.ts` dispatches on `ticket_provider.type`; `tickets/plane.ts` is the only implementation in v1. An unrecognised provider renders **DS-14**'s no-Board treatment with the provider named, rather than a crash. Deliberately the thinnest form: one field read and one branch — no provider interface, no registry, no second implementation. [architecture.md D21; addendum §B.3]

**AR58: D20 — the Bridge resolves the Board's default entry state server-side** and the created Ticket comes back carrying the state it was assigned. This licenses the create box to be live **before the Board read lands**; holding the submit until the Board arrives costs UJ-1 its entire margin. [architecture.md D20]

**AR59: D20 — Ticket create is deduped on a `createKey` UUID minted by the Cockpit at submit**, carried on the request and recorded by the Bridge on the `ticket_creates` row alongside `(pjid, generation, board_id)`. A create carrying an already-recorded `createKey` returns the Ticket that key produced rather than filing a second one. Plane's REST create exposes no idempotency key, so Sidepiece supplies the missing half. The key must be **client-minted and server-deduped**: a Bridge-minted key would be new on every attempt. [architecture.md D20]

**AR60: `tickets/plane.ts` is the ONLY place Plane's "project" is renamed to `boardId`.** Plane's REST surface calls a board a project; Sidepiece does not. Foreign names die at the adapter. [architecture.md A-P1; tree]

#### Deployment, credentials and transport

**AR61: D17 — the deploy artifact is a single bundled file.** `tsup`/`esbuild` bundles `packages/bridge` to `dist/bridge.mjs` with `contract` **inlined**, `node:*` external and nothing else to externalise. An rsync of `packages/bridge` carries a dangling pnpm symlink for `contract` and the daemon cannot resolve it at import time. One file rsyncs, has no `node_modules`, and an atomic replace cannot be half-applied. [architecture.md D17]

**AR62: D17 — state lives outside the deploy tree.** `~/.local/state/sidepiece/` on `big-chungus` holds `turns.db` (+`-wal`, `-shm`) and `registry-snapshot.json`; the deploy target is `~/.local/lib/sidepiece/bridge.mjs`; the two directories never intersect. The unit sets `WorkingDirectory=%h/.local/state/sidepiece` and `StateDirectory=sidepiece`. If either file lands inside the rsync target, the next deploy overwrites the Turn history. [architecture.md D17]

**AR63: D17 — the `systemd --user` unit's environment is explicit**, because `systemd --user` gets a minimal environment and not the login shell's `PATH`. `node` is named by absolute path in `ExecStart=`; `bb` (for `bb emit --check`) and `op` (FR-16) are named by absolute path in `Environment=`. A unit that inherits `PATH` works when started by hand from a terminal and fails at boot. An explicit restart policy is required. [architecture.md D17; § Infrastructure & Deployment]

**AR64: D18 — the 1Password bootstrap token is passed to the unit with systemd `LoadCredential=`, reading from a root-owned file outside the repo**; the Bridge reads it from `$CREDENTIALS_DIRECTORY` at startup and never logs it. `LoadCredential=` over `EnvironmentFile=` because a credential in the environment is visible to every child process the Bridge spawns, and it spawns `bb` and `op` by design. `.env.op` holds `op://` references only, never values. [architecture.md D18]

**AR65: D18 — credential resolution happens at process start AND per request, and a failed resolution degrades rather than exiting non-zero.** Startup resolution populates the Bridge's in-process credential cache (a different thing from FR-2's, which is the extension's); a capability whose credential is missing retries the resolution on its next call. An implementer who exits non-zero makes the operator see **DS-4** (`big-chungus` isn't answering) instead of **DS-8**, which is the wrong sentence and the wrong fix. [architecture.md D18]

**AR66: D18 — the silent-degradation probe is two independent assertions in `health/degradation.ts`, reported separately on each health check**: (1) assert no resolved config value still matches `^op://`; (2) compare the PM session's *reported* provider and model against the profile's *expected* provider and model, read from the Hermes profile the Bridge is pinned against. Either failing is **DS-8**, named with the credential and the dependency it feeds. This exists because nothing else on the machine will notice — `hermes-dashboard.service` ran silently degraded from 2026-09-09 to 2026-09-17. [architecture.md D18; § Cross-Cutting Concerns 5]

**AR67: Transport is `tailscale serve` with a MagicDNS certificate, and `X-Forwarded-For` must be read for the client address** — `tailscale serve` rewrites the peer to `127.0.0.1`, so anything reading the socket address logs one client forever. The certificate is recorded honestly as **not** an LNA mitigation. [architecture.md § Infrastructure & Deployment; A-P8]

**AR68: The private-network CORS headers ship unconditionally**: `Access-Control-Allow-Private-Network: true` on preflights alongside ordinary CORS headers. Two lines on a route that already exists; PRD §5 calls it unconditional, and PRD §12 Q7's confirmation on `carries-macbook-air` has not been run. [architecture.md D16; addendum §C]

#### Extension platform: manifest, detection, boundaries

**AR69: D16 — the extension manifest surface, in full.** `host_permissions: <all_urls>` (also what the LNA host-permission exemption rests on); `permissions: sidePanel, storage, tabs`; **not** declared: `activeTab`, `debugger`, `webNavigation`; `action` declared with **no `default_popup`** (a popup displaces `setPanelBehavior({openPanelOnActionClick: true})`, which is the product's only close gesture); **exactly two `commands`** — `_execute_action` at `Alt+Shift+S` and `focus-ticket-title` at `Alt+Shift+N`, with the two `[v2]` bindings **not** declared because a dead shortcut occupies a slot Chrome will not give back; one `content_scripts` entry, `<all_urls>`, `document_idle`, manifest-declared rather than `scripting.executeScript`; `WXT_BRIDGE_ORIGIN` **baked at build time** (localhost in dev, the MagicDNS name deployed — there is no settings page and no first-run surface for a runtime origin to live in). [architecture.md D16; addendum §C, §C.1]

**AR70: D14 — the pjid declaration contract is `<meta name="pjid" content="<pjid>">` in `<head>`, read by `document.head.querySelector('meta[name="pjid"]')` and nothing else.** `name=` not `property=`; `<head>` only (FR-1 requires it work with scripting disabled, so a tag injected into `<body>` is out of contract by construction); no page JS is executed to obtain it; the attribute **name** matches case-insensitively but the attribute **value** is never normalised and is passed through byte for byte; **conflicting declarations take first in document order and report the conflict alongside the resolution** (duplicates that agree are just duplicates); an empty or whitespace-only `content` is **DS-1**, never a pjid. This string is the contract any emitter must satisfy. [architecture.md D14]

**AR71: SPA re-detection is a `MutationObserver` on `<head>` in the already-injected content script** — not `chrome.webNavigation` (costs a permission for a signal the content script can observe itself) and not `popstate` alone (fires on back/forward, never on a `pushState` call). [architecture.md D16; addendum §C]

**AR72: The Cockpit is a single global panel document with the service worker listening on `tabs.onActivated`/`onUpdated` and messaging it to re-render** — not per-tab `setOptions({tabId})` overrides, which load a distinct document per tab and are prone to override drift ("correct on some tabs, stale on others"). The panel document survives tab switches, so FR-11's chat state needs persisting only across the panel *closing*. [addendum §C]

**AR73: `entrypoints/background/gesture.ts` — the in-page gesture path is callbacks only, zero `await`s, exactly one hop.** Chrome curries a user gesture across one `runtime.sendMessage` hop; an `await` anywhere in the chain loses it to a **silent no-op with no thrown error**, presenting as an intermittent "sometimes doesn't open" heisenbug. The curried gesture cannot be re-forwarded. `sidePanel.open()` has a known bug (issues.chromium.org/415694848) throwing on the second click after a manual close, **unverified against Chrome 151–155**. [addendum §C.1; architecture.md § Architectural Boundaries]

**AR74: `lib/stream.ts` owns `EventSource` and is imported only by `entrypoints/sidepanel/`.** A static import from anywhere under `entrypoints/background/` is a review failure **and is the one import rule worth an explicit lint**. WebSocket traffic is documented to reset the service worker's ~30s idle timer; **EventSource has no equivalent documented exemption**. [architecture.md § Streaming boundary; addendum §C]

**AR75: `lib/bridge.ts` is the only module in the extension that performs a request**, usable from either the panel or the service worker (the Resolvable icon state fires with the Cockpit closed), with **every call bounded well under 30s**, which is what makes it safe in the worker. It is also the one place transport reality is converted into the client-produced states DS-3, DS-4, DS-5 and DS-27. [architecture.md § Component boundary; § Streaming boundary]

**AR76: D10 — `lib/cache.ts` holds FR-2's bounded cache in `chrome.storage.local`, one entry per pjid under the key `fr2:<pjid>`, with a 5-minute TTL.** The entry is `{ record: ProjectRecord, fetchedAt: <ISO-8601 UTC string> }` and the generation is **not** a third field (it is already inside `record`). It is imported by the panel **and** by `entrypoints/background/icon.ts`, and it does **not** go through `lib/storage.ts` (D6's continuity tier: draft, pane selection, collapse state — no expiry, no staleness semantics). Same browser API, separate keyspaces. It caches exactly one thing: the Project Record, for the identity header — no Ticket list, no Turn, ever. [architecture.md D10]

**AR77: D10 — the cache has four invalidation triggers and a write discipline.** Invalidated on: TTL expiry; an explicit re-resolve from any FR-3 state (which bypasses the cache); a Bridge health transition unreachable→reachable observed by `lib/bridge.ts`; and the generation advancing for that pjid (the client invalidates on *learning* an advance, never on producing one). **A write replaces the entry whole and never patches a field**, and `chrome.storage.onChanged` is how the other context finds out — the panel does not poll and the worker need not be alive at the moment of the write. `unlimitedStorage` is **not** declared and no orphan sweeper exists (the TTL collects them). [architecture.md D10]

**AR78: D6 MUST — nothing in `chrome.storage.local` may be the only source of a rendered fact, and anything rendered from it carries its age.** Delete the whole `fr2:` keyspace and the product is one frame slower and thereafter identical. A future decision that wants to put something un-refetchable or unlabelled in this tier **is** amending D6 and must say so in those words. [architecture.md D6]

#### UI layer, tokens and the shadow-root overlay

**AR7: `srcDir: 'src'` MUST be declared in `wxt.config.ts`.** Verified 2026-09-22: `srcDir` defaults to `"."` and WXT does **not** auto-detect a `src/` directory, so the tree's `packages/extension/src/entrypoints/` will simply not be discovered without that one line. `components.json`'s shadcn aliases point at the same root. [architecture.md A-P9]

**AR8: UI layer is React + Tailwind v4 + shadcn/ui, with shadcn primitives adopted one at a time as a component actually needs one.** Running the full `add` surface up front would drop dozens of components carrying a visual identity being discarded; the Cockpit's real inventory is a composer, a list, a grouped list, a notice and a switch. The value taken is Radix behaviour (focus management, dismissal, aria wiring); the appearance is replaced wholesale. [architecture.md § UI Layer, NOTE FOR PM]

**AR9: Token plumbing is two files and only one defines anything.** `styles/tokens.css` is THE definition — `DESIGN.md`'s canonical `:root` block verbatim including `color-scheme: light` in both modes, plus the `@media (prefers-color-scheme: dark)` override with its thirteen declarations. `tailwind.css`'s `@theme` block **aliases those custom properties and never restates a value** (`--color-surface-panel: var(--surface-panel)`), because a `@theme` block cannot hold a media query and one carrying literal values would ship a Cockpit that never goes to Night Paper. [architecture.md § UI Layer]

**AR10: A one-time, mechanical hex→OKLCH conversion of the 54-token set happens at `shadcn init`** (shadcn on Tailwind v4 emits OKLCH; `DESIGN.md` is hex). `DESIGN.md`'s hex values stay the documented source of truth with OKLCH as generated output — never the reverse, because every contrast ratio in `DESIGN.md` was computed against the hex values. [architecture.md § UI Layer, NOTE FOR IMPLEMENTATION]

**AR11: The `[v2]` in-page overlay must be authored in px and scoped to the never-themed token subset from the first commit.** WXT's `createShadowRootUi` resets inherited styles with `all: initial`, which does not reset the host `<html>` font size, so `rem` units are not fully isolated — converting the overlay to rem later would silently break it on every site with a non-16px root. `DESIGN.md` is px throughout (407 px values, zero rem). All five `overlay.*` tokens are byte-identical across modes, so the overlay stylesheet is scoped separately rather than inheriting a themed `:root` it must fight. [architecture.md § Selected Starter rationale 2; § UI Layer NOTE FOR IMPLEMENTATION]

**AR12: Verify whether WXT's `createShadowRootUi` root is open or closed before treating "closed" as delivered.** Both UX spines say closed; WXT's docs do not state it. A one-line check; if only an open root is available, either accept it or wrap it ourselves. [architecture.md § Selected Starter, `[ASSUMPTION]`]

### UX Design Requirements

The UX Design Specification is a first-class input, not supplementary material. These 91 UX-DRs are drawn from `EXPERIENCE.md` (`status: final`, ~1860 lines — IA, DS-1…DS-28, 25 components, Voice and Tone, Interaction Primitives, Accessibility Floor, Key Flows UJ-1…UJ-4), `DESIGN.md` (`status: final`, ~1930 lines — 54 tokens, the type ramp, Night Paper dark mode, component visual specs, Do's and Don'ts) and the UX `.decision-log.md`.

**Nothing here is summarised.** The extraction shape, so it audits:

- **UX-DR1–9** — the 54-token system (32 colours + 6 typography roles + 3 rounded + 8 spacing + 5 marks), the `tokens.css` / `@theme` split, the hex→OKLCH direction, Night Paper, and the contrast audit.
- **UX-DR10–36** — **all 25 `{components.*}` keys by name** (17 v1, 8 `[v2]`), plus the clone-path line (a sub-element rather than a key, which is why Component Patterns carries 26 rows for 25 keys) and the `[v2]` in-page layer's common requirements as its own entry. **27 entries, 25 components.**
- **UX-DR37–48** — all **28** DS codes, with explicit per-entry coverage so the count audits (see the coverage table below), plus the total-vs-partial router and the four in-flight/deadline rules.
- **UX-DR49–52** — Voice and Tone.
- **UX-DR53–60** — Interaction Primitives.
- **UX-DR61–69** — the Accessibility Floor.
- **UX-DR70–78** — Responsive and platform behaviour.
- **UX-DR79–91** — the **thirteen key-screen findings**, carried as requirements-to-decide rather than as resolved specs.

**DS coverage audit — 28, no gaps, no double-coverage:**

| Entry | DS codes | Count |
|---|---|---|
| UX-DR37 | DS-1 | 1 |
| UX-DR38 | DS-21 | 1 |
| UX-DR39 | DS-3, DS-4, DS-5, DS-27, DS-6, DS-7 | 6 |
| UX-DR40 | DS-2, DS-16 | 2 |
| UX-DR41 | DS-11, DS-12, DS-13, DS-20, DS-24, DS-25, DS-26, DS-28 | 8 |
| UX-DR42 | DS-14, DS-17, DS-22 | 3 |
| UX-DR43 | DS-18 | 1 |
| UX-DR44 | DS-19 | 1 |
| UX-DR45 | DS-9, DS-10, DS-15, DS-23 | 4 |
| UX-DR46 | DS-8 | 1 |
| **Total** | **DS-1 … DS-28** | **28** |

DS-6 and DS-7 appear once, in UX-DR39's no-snapshot (Total) form; their partial-with-snapshot form is routed by UX-DR47.

**Authority note.** The mock (`mockups/key-screens.html`, seven screens at 320px) is **evidence, never specification** — both spines win on conflict with any mock, wireframe or import, and `mockups/direction-foreign.html` is explicitly HISTORICAL (340px, a pre-final token set, superseded on every number). **Any story citing a measurement must cite the spine, not the mock.**

#### The token system (UX-DR1–9)

**UX-DR1:** Build `packages/extension/src/styles/tokens.css` as the single definition of all 54 design tokens from `DESIGN.md`'s frontmatter, at the exact nested paths `EXPERIENCE.md` references (`{colors.surface.panel}`, `{colors.state.ok}`, `{typography.mono}`, `{spacing.glyph}`, `{marks.failed}`). The 54 = 32 colors + 6 typography roles + 3 rounded + 8 spacing + 5 marks. Acceptance: every `{colors.*}` / `{typography.*}` / `{spacing.*}` / `{rounded.*}` / `{marks.*}` reference in `EXPERIENCE.md` resolves to a declared custom property; a token declared and unreferenced, or referenced and undeclared, fails the build. *(Path corrected during extraction: `apps/extension/` appears in neither UX spine nor the architecture; `architecture.md`'s tree is the authority and places it at `packages/extension/src/styles/tokens.css`. AR4 and AR7 are the governing requirements.)*

**UX-DR2:** Implement all 32 colour tokens at their exact hex values, in eight groups. **surface (6):** panel `#F2EDE3`, raised `#FBF8F1`, sunken `#E8E0D0`, overlay `#F2EDE3`, stamp `#191713`, spotWash `#FFE4EC`. **border (4):** hairline `#CFC3AB`, strong `#191713`, faint `#E0D7C4`, sheet `#C9BDA6`. **text (5):** primary `#191713`, muted `#645D4E`, machine `#1B3FA0`, inverse `#F2EDE3`, onSpot `#191713`. **state (5):** ok `#645D4E`, pending `#4C463A`, degraded `#8A5A0B`, failed `#191713`, unknown `#645D4E`. **action (3):** primary `#191713`, mark `#FF2E63`, markDeep `#C2003F`. **overlay (5):** signature `#FF2E63`, outline `#FF2E63`, scrim `rgba(255,46,99,0.14)`, keylineDark `#191713`, keylineLight `#FFFFFF`. **focus (2):** ring `#191713`, ringInner `#F2EDE3`. **selection (2):** ground `#FFE4EC`, ink `#191713`. Note deliberately: **NINE** tokens share `#191713` (The One Black Rule) — `surface.stamp`, `border.strong`, `text.primary`, `text.onSpot`, `state.failed`, `action.primary`, `overlay.keylineDark`, `focus.ring`, `selection.ink` — and `state.ok` == `state.unknown` == `text.muted`; four more share `#F2EDE3` (`surface.panel`, `surface.overlay`, `text.inverse`, `focus.ringInner`) and three share `#FF2E63` (`action.mark`, `overlay.signature`, `overlay.outline`). These are not duplicates to be tidied away, and a de-duplicating generator is a build defect. *(Corrected during extraction: `DESIGN.md`'s prose at its One Black Rule says "seven tokens carry `#191713`" and enumerates seven, omitting `{colors.text.onSpot}` and `{colors.selection.ink}`, which its own frontmatter sets to that value. The frontmatter is the token data and wins. A build-time check written against the prose's "seven" fails on the real token set — see note 19 in Notes Carried Forward.)*

**UX-DR3:** Implement the six-role type ramp exactly as tokened, with no size override permitted inside any component. **heading** = Charis SIL 22px/700/1.05/-0.015em (identity header repo name, one per Cockpit); **body** = Charis SIL 13.5px/400/1.55/normal (Turn text, notice sentences, ticket titles, context-chip page title); **label** = IBM Plex Mono 11.5px/500/1.35/0.04em + tabular-nums (anything variable: control text, classification values, group names, counts, state words); **micro** = IBM Plex Mono 10.5px/500/1.3/0.10em (static chrome only, uppercase: section rules, band words, stamp chips, clip mark); **mono** = IBM Plex Mono 11.5px/400/1.45/0.01em + tabular-nums, always at `{colors.text.machine}` (machine data); **numeral** = IBM Plex Mono 10px/600/1/0em (counted marks only — the `[v2]` pin digit and pin-number chip). Both stacks carry `fontSizeAdjust` as a token (serif 0.481, mono 0.516). Acceptance: derived advances hold — mono 7.015px/char, label 7.36px/char, micro 7.35px/char, numeral 6.00px/char, body ≈6.35px/char, body line box 20.93px.

**UX-DR4:** Bundle both faces and declare seven `@font-face` blocks, each with an explicit `font-weight` and `font-style`: CharisSIL Regular/Italic/Bold/BoldItalic (400 normal, 400 italic, 700 normal, 700 italic) and IBMPlexMono Regular/Medium/SemiBold (400/500/600), all woff2, all `font-display: block`. Set `font-synthesis: none` on `:root`. **Forbidden:** any `local()` in `src`, any remote fetch, `@import`, a Google Fonts link, `font-display: swap`, naming `Cascadia Code` (its ligatures rewrite `->` inside a clone path), or naming `Bitstream Charter`/`Charter`/`Source Serif 4`/`Iowan Old Style` in the stack (each resolves to a sans or an unhinted 1987 Type 1 on this machine). The only permitted fallbacks are Georgia (serif) and Cascadia Mono (mono). Italic is load-bearing: both the composer and the create box set a serif-italic placeholder and a synthetic oblique there is the most visible faux-craft artefact available. The `[v2]` in-page layer needs the extra step: `@font-face` inside a shadow root is ignored by spec, so the content script registers the faces on the host document via the `FontFace` API with `chrome.runtime.getURL()`, which requires the woff2 files in `web_accessible_resources` with `"use_dynamic_url": false`.

**UX-DR5:** Implement the shape and spacing scales with no additions. **rounded:** control 0px, panel 0px, pill 9999px — everything is a square rectangle, and `pill` has exactly two consumers in the whole system, both outside the Cockpit (`[v2]` `{components.annotationPin}` and `{components.iconBadge}`, which Chrome draws). **spacing (8):** hair 4px, tight 6px, inset 9px, glyph 11px (the mark box, one size, three consumers), gutter 14px (the only horizontal inset in the column, never overridden), stack 15px, section 24px, row 32px (minimum list-row height). Acceptance: no corner radius anywhere inside the Cockpit; no horizontal inset other than `{spacing.gutter}`; the two rhythms are not one grid — text rhythm is the 20.93px line box and the control scale is a separate 2px scale (16, 24, 28, 30, 32, 58), and nothing may claim a shared divisor.

**UX-DR6:** Implement the five `marks.*` as data-carried CSS geometry, not as icons — the Glyph Law made checkable by a generator rather than by a reviewer. Four are drawn in `currentColor` centred in an 11px `{spacing.glyph}` box: **marks.ok** a 7×1px bar (weight 400); **marks.degraded** a filled triangle 8px base × 7px rise (500); **marks.failed** a 7×7px filled square (600); **marks.unknown** a 7×7px 1px-ring hollow circle (400). One is typed: **marks.pending** `»` U+00BB set in `{typography.micro}` (500), because Latin-1 is the one block every fallback in the mono stack guarantees. **Forbidden:** SVG, icon fonts, emoji, or a sixth mark whose silhouette is not distinct from the five at 11px. Acceptance: a generator that emits a `colors.state` value without its `marks` sibling fails the build — on the token layer alone `ok` and `unknown` are the identical hex and only the mark separates them.

**UX-DR7:** Implement **Night Paper** as `@media (prefers-color-scheme: dark)` — thirteen declarations overriding fifteen values, with seventeen byte-identical across modes. Changing: surface.panel `#E0D9C8`, surface.raised `#EAE4D6`, surface.sunken `#D3CAB6`, surface.spotWash `#F7CFDB`, border.hairline `#BCAF93`, border.faint `#CFC5AE`, border.sheet `#B3A68C`, text.muted `#565040` (which also carries state.ok and state.unknown — three tokens, one declaration), state.degraded `#6F460A`, action.markDeep `#A3002F`, text.inverse `#E0D9C8`, focus.ringInner `#E0D9C8`, selection.ground `#F7CFDB`, plus `--sheet-offset` hardening to `3px 3px 0 rgba(0,0,0,.45)`. Deliberately invariant: surface.stamp, surface.overlay, border.strong, text.primary, text.machine, text.onSpot, state.pending, state.failed, action.primary, action.mark, focus.ring, selection.ink, and all five `overlay.*` including `signature`. `color-scheme: light` is declared in BOTH modes because Night Paper is still a light ground at Lrel 0.709. `{colors.action.mark}` runs at 2.56:1 on night paper — an accepted, recorded failure, and the `markDeep` fix is explicitly rejected because signature invariance is a behavioral constraint. Acceptance: the Cockpit follows a live OS theme change while open (the `change` event, not a sample at load); in-page `[v2]` sheets are never dimmed.

**UX-DR8:** Wire the Tailwind v4 / shadcn token plumbing so `tokens.css` stays the only definition. `tailwind.css`'s `@theme` block aliases the custom properties and never restates a value (`--color-surface-panel: var(--surface-panel)`) — a `@theme` cannot hold a media query, so a `@theme` carrying literal values ships a Cockpit that never reaches Night Paper. The hex→OKLCH conversion shadcn's v4 init performs is one-time and mechanical; `DESIGN.md`'s hex values remain the documented source of truth and the OKLCH is generated output, never hand-edited — every contrast ratio in `DESIGN.md` was computed against the hex. The `[v2]` in-page layer's token set is the never-themed subset, so its overlay stylesheet is scoped separately from the first commit rather than inheriting a themed `:root` it must then fight.

**UX-DR9:** Turn `DESIGN.md`'s measured contrast table into an automated audit with **three** outcomes, not one. **PASS:** every body pair ≥ 4.5:1 and every non-text pair ≥ 3:1. **ACCEPTED-FAIL**, hard-coded as a named allowlist of seven: border.hairline 1.49:1, border.faint 1.23:1, border.sheet 1.59:1, surface.raised-on-panel 1.10:1, surface.sunken-on-panel 1.12:1, selection.ground 1.02:1 (chromatic, not luminant), action.mark-on-paper 3.09:1 (never sets type). **FORBIDDEN**, which must fail the build: any `colors.state.*` value rendered on `{colors.surface.stamp}` — failed 1.00:1, pending 1.91:1, ok/unknown 2.74:1, degraded 3.02:1. On a stamped band both the mark and the word are `{colors.text.inverse}` at 15.34:1. Also forbidden: white on the spot ground (3.61:1); text on the spot is ink `#191713` at 4.96:1. Acceptance: the audit test — remove every hairline from a screen; if a region becomes ambiguous, that region was leaning on a hairline and needs a `{colors.border.strong}` rule instead.

#### The 25 components, by name (UX-DR10–36)

**UX-DR10: `{components.identityHeader}` — v1.** Pinned top, never scrolls, present whenever a Project is resolved. Renders repo name, clone path, Board identifier, health marker and (only while it applies) the degraded-connection indicator — four lines at most, and normally four. It holds NO overflow, NO kebab and NO menu of any kind. It persists nothing of its own; it is re-derived from the Project Record on every resolution. It never renders a half-Project: identity changes in the same frame as the body and the switch, one atomic render keyed by `(pjid, generation)`. On a total outage the header is REPLACED by the shared notice, not dimmed and not left showing a Project we can no longer vouch for. **Visual:** `{colors.surface.raised}` ground closed by a 1px `{colors.border.strong}` seam; repo name in `{typography.heading}` fitting 25 characters before it wraps; Board identifier as a `{colors.surface.stamp}` chip — a band, so no inset keyline — with paper text in `{typography.micro}`; health marker and degraded indicator on the meta row at `{spacing.tight}` intervals; padding `13px {spacing.gutter} 12px`.

**UX-DR11: Clone-path line — v1**, a sub-element of `{components.identityHeader}` and NOT a `{components.*}` key, but it carries behaviour of its own. It is selectable text (FR-4's only named such field), sits in a `{colors.surface.sunken}` well with a 2px `{colors.border.hairline}` left edge, is set in `{typography.mono}` at `{colors.text.machine}`, is `user-select: all`, and it WRAPS — never truncates, never ellipsises, no `text-overflow`. The well is 268px inside, so `/home/delorenj/code/sidepiece` (29 ch × 7.015 = 203.4px) sets on one line with 64.6px spare and the wrap threshold is 38 characters. It is focusable so it can be reached and copied without a mouse, and it carries a `{components.copyControl}`. When the path is missing on disk (DS-9) it still renders, marked, because the path is the thing the operator needs to go look at.

**UX-DR12: `{components.copyControl}` — v1.** Copies a complete machine string (clone path, command string, correlation identifier) to the clipboard. It confirms by swapping its own label for one beat — same type, same colour, same box — and never draws a toast, a tick, a fill or a colour change. If the clipboard write throws, it says so in place and the text remains selectable, which was always the primary path. **Visual:** 32px transparent control, 1px `{colors.border.hairline}`, `{typography.micro}` at `{colors.text.muted}`, `0 8px` padding, square. Hover takes affordances 1+2 (tonal step plus ink step), pressed takes 2. It exists as a deliberate addition beyond FR-4's letter, because a wrapped path in a 320px column is a poor drag target and the paste is the whole point of UJ-3.

**UX-DR13: `{components.degradedConnectionIndicator}` — v1.** Renders on the header meta row for as long as the Tailnet is on a DERP relay, and is never suppressed. It is a fact, not a fault: `{colors.state.degraded}` ochre, not `{colors.state.failed}`, with NO box, no fill and no border — a pencil note in the margin. While it is present the budget's PROMISE is dropped but its DEADLINE is not: every in-flight state keeps a terminal transition and says on expiry that the connection is relayed and there is no budget for this, with a retry. **Visual:** `marks.degraded` plus one word in `{typography.micro}` at `{colors.state.degraded}`, 16px tall, padding `0 0 0 {spacing.gutter}`. Acceptance: no in-flight state anywhere in the product may become indefinite while this indicator is up.

**UX-DR14: `{components.paneSwitch}` — v1.** Selects which pane the body shows. Built as an n-item control with TWO items rendered in v1 (Tickets, Chat) and laid out so a third fits in the usable column without wrapping. Each cell carries its own status marker at its leading edge, so a pane that is failing says so while hidden — this is how §5's "every pane fails independently and says why" survives a one-pane-at-a-time body. Selected pane persists per Project in `chrome.storage.local`; a Project change resets to Tickets; if the read throws or returns empty the reset target applies. **Visual:** a single 32px strip on the header's bottom edge, ruled top and bottom in `{colors.border.strong}`, divided into equal cells by 1px `{colors.border.hairline}`; labels in `{typography.label}` uppercase; the selected cell carries a 2px `{colors.action.mark}` underline INSIDE the cell and steps its label to `{colors.text.primary}`, unselected cells sit at `{colors.text.muted}`. **Measured:** v1 two-up is (284−1)÷2 = 141.5px per cell, a 14-character budget against TICKETS (7) and CHAT (4). The reserved `[v2]` third slot renders as an empty ruled cell, never as a gap. The fourth slot is NOT reserved and two `[v2]` panes contend for it.

**UX-DR15: `{components.healthMarker}` — v1.** One marker in the header carrying one of four Bridge conditions: reachable / unreachable / reachable-but-unhealthy / not yet known. It NEVER shows reachable before it has an answer — an unknown marker, not a green one. Naming the failing dependency is the pane notice's job, not the marker's; health is never a dashboard. **Visual:** one `{spacing.glyph}` 11px mark plus its word in `{typography.label}`, no ring, no dot, no fill — the mark IS the marker. It carries NO colour token of its own: it is the generic five-state marker and the consumer supplies one of the five `colors.state` values together with the matching `marks` entry. (A hard-pinned `textColor` here makes every resolver emit a permanently grey marker — that is a defect, not a default.)

**UX-DR16: `{components.stateNotice}` — v1.** The one block every degraded state renders into: a stamped band, a headline sentence, an optional detail line, an optional `{components.commandString}`, and a control row. It IS the failure path — it never renders as an empty region, never as a spinner, and it always contains at least one control. Exactly two states in the product do not use it: DS-1 and DS-21. **Visual:** bordered block on `{colors.surface.raised}`, 1px `{colors.border.strong}`, padding `10px {spacing.inset} 11px`, square. Anatomy top to bottom: a `{colors.surface.stamp}` BAND — solid, no inset keyline, because it is a statement and not a control — carrying the state mark AND the state word both in `{colors.text.inverse}` at 15.34:1; headline in `{typography.body}` at `{colors.text.primary}`; detail line at `{colors.text.muted}`; then the control row, whose controls are struck plates. A state notice is stamped, never tinted.

**UX-DR17: `{components.reResolveControl}` — v1.** Re-runs detection and resolution for the active tab, bypassing the FR-2 cache. Present in EVERY state notice including ones it cannot fix — a Plane outage does not resolve by re-resolving, but the operator does not have to know that to reach for it. While running it disables and says so; when it returns the same state it says the state again rather than flashing. **Three forms, all 32px:** PRIMARY — `{colors.action.primary}` ground, `{colors.text.inverse}` label in `{typography.label}`, square, with the 1px struck-plate inset keyline, hover thickens it to 2px and pressed removes it entirely so the plate seats; DEMOTED — transparent ground, 1px `{colors.border.hairline}`, `{colors.text.muted}` label, used by DS-1; DISABLED — `{colors.surface.sunken}` with a hairline and a muted label. DS-21 renders it not at all, and that is the single stated exception to FR-3's blanket rule.

**UX-DR18: `{components.turnComposer}` — v1.** Collects a Turn; holds the context chip, the classification control, the text field, and an action row whose LEADING slot is empty in v1 (the `[v2]` attachment seat). Draft text is debounced continuously to `chrome.storage.local` keyed by pjid and restored on open; `onClosed` is treated as a belt, not the braces, because nothing documents whether it fires early enough to be trusted as a flush point. Disabled with a distinct reason in both degraded Agent states, with the draft kept while disabled; when only the dispatch half is down (DS-18) it stays LIVE and says which half. On send failure the text stays in the box. If storage throws or returns empty, the box renders empty and works. **Visual:** bottom-anchored on `{colors.surface.raised}`, 1px `{colors.border.hairline}`, `{spacing.inset}` padding, capped at 188px tall; stacked context chip → classification control → text field at `{typography.body}` with a 1px `{colors.border.faint}` top rule → action row; placeholder in `{colors.text.muted}` bundled Charis SIL ITALIC. Inner width 264px. **NOTE: the 188px cap is contradicted by key-screen finding 1 — see UX-DR79.**

**UX-DR19: `{components.classificationControl}` — v1.** Shows the Turn's classification before commit and flips it in one control. Renders the glossary term VERBATIM AND COMPLETE — `STREAMED EXCHANGE` / `DISPATCHED COMMAND` — plus one plain line of consequence, and neither term is ever abbreviated at any width. It is never absent: an unclassifiable Turn classifies as Dispatched Command per FR-6's bias and says so. The override lives for this Turn only and is discarded on send. **Recompute rule:** a pure function in `contract/src/classify.ts` (verb allowlist), evaluated in the Cockpit on a TYPING PAUSE, never on a keystroke, never under the caret; once flipped it is pinned until send; an empty composer shows the standing default, Dispatched Command. **Acceptance corpus, all six**, which the Bridge re-evaluates authoritatively at send while honouring an explicit override: `what's in progress?` → Streamed; `summarize the board` → Streamed; `why did the resolver ticket stall?` → Streamed; `start on the resolver ticket` → Dispatched; `fix the failing test` → Dispatched; `open a PR for the width fix` → Dispatched. **Visual:** TWO full-width stacked 30px rows boxed in 1px `{colors.border.strong}`, divided by a 1px internal rule, 244px inside; each row carries its term in `{typography.label}` uppercase; the selected row carries a 2px `{colors.action.mark}` UNDERLINE inside the cell and sets its label to `{colors.text.primary}` — never a spot fill. **Measured:** `DISPATCHED COMMAND` 18 ch × 7.36 = 132.5px in 244px, 111.5px spare (46% empty); it still sets complete down to a 208.5px panel. Consequence line today must read `This will be published and acknowledged. The result arrives later.` because FR-9's result content is unbuildable.

**UX-DR20: `{components.contextChip}` — v1.** Shows what will be attached to the Turn: the active tab's TITLE, with the URL revealed only on focus or hover — one line at rest, never the URL beside it. If the title or the URL cannot be read, the chip says WHICH ONE is missing and the Turn still sends — a Turn with partial context beats a blocked Turn. **Visual:** `{colors.surface.sunken}` block with a dashed 1px `{colors.border.hairline}` bottom rule at the top of the composer, 248px inside, `6px 8px` padding; kicker in `{typography.micro}` at `{colors.text.muted}`; page title in `{typography.body}` at its own 13.5px in `{colors.text.primary}` wrapping to at most two lines with NO size override; the revealed URL in `{typography.mono}` at `{colors.text.machine}`, wrapping to two lines, never elided. **Measured:** a 47-character URL is 329.7px against 248px, so it wraps to two lines; the three-line threshold is 71 characters.

**UX-DR21: `{components.turnCard}` — v1.** Renders one Turn and holds NO state of its own — Turn state lives in the Bridge keyed by pjid and Turn id. **THREE visibly distinct visual variants**, and the distinction is printed vs stamped: **(a) the operator's turn** — a 2px `{colors.action.mark}` left rule at 9px inset, serif ROMAN at `{colors.text.primary}`, the only spot-marked content in the scroll region; **(b) Streamed Exchange** — a `{typography.micro}` kicker at `{colors.text.muted}` then the reply in `{typography.body}`, no box, no ground, no border, printed directly onto the sheet; **(c) Dispatched Command** — a bordered block, 1px `{colors.border.strong}`, opening with a `{colors.surface.stamp}` band carrying the state mark and state word both in `{colors.text.inverse}` with the correlation id right-aligned in `#C9BDA6` at 9.64:1, inner body on `{colors.surface.raised}`, acknowledgement in `{typography.mono}` at `{colors.text.machine}`, the outcome as a bordered `{typography.micro}` stamp chip, the result separated by a DASHED `{colors.border.hairline}` rule. Turns are separated by a 1px `{colors.border.faint}` rule at `{spacing.stack}`. **Failure paths:** a dead stream renders as FAILED with the partial text kept and marked partial; a rejection is surfaced with its reason; no outcome inside the window renders as UNKNOWN, never as success; an unreachable Candystore renders as UNOBSERVABLE, worded differently (DS-19); a completed outcome renders its result content or says `Completed. The gateway returned no result content.` Never a bare checkmark. The gateway's `thinking.delta` placeholder is NOT content and is never rendered as the answer.

**UX-DR22: `{components.jumpToLatest}` — v1.** Appears in the Chat pane only while the operator has scrolled up away from a STREAMING Turn and something is arriving; returns to the bottom and re-arms bottom-anchoring. It never appears on a quiet thread, because a control that offers to move you somewhere is a control that pulls. **Visual:** 28px `{colors.action.primary}` control with the struck-plate keyline, paper label in `{typography.label}`, floating bottom-right above the action bar with a `{colors.surface.panel}` 1px keyline so it reads as a separate slip of paper over the scroll. NO shadow — it is inside the sheet, not on top of it. Acceptance: the Turn list is bottom-anchored while streaming and stops following the moment the operator scrolls up.

**UX-DR23: `{components.ticketGroupHeader}` — v1.** One per Board state, in the Board's OWN state order. Collapses to name plus count. A group with zero Tickets renders with a zero count rather than disappearing — the Board's shape includes its empty columns — and on an empty Board the group skeleton still renders BENEATH the `This Board is empty.` line, not instead of it. The group holding the Board's default entry state is expanded on first render and the rest are collapsed; collapse state is per-Project in `chrome.storage.local`. **Visual:** sticky to the top of the Tickets region on OPAQUE `{colors.surface.panel}` so rows do not ghost through, 30px, closed by a 1px `{colors.border.strong}` bottom rule, padding `4px 0 6px`; state mark at `{spacing.glyph}`, state name in `{typography.label}` uppercase at `{colors.text.primary}`, count right-aligned in `{typography.label}` at `{colors.text.muted}` with tabular-nums so the column does not jitter.

**UX-DR24: `{components.ticketRow}` — v1.** Renders human key, title and state; clicking the key opens the Plane URL in a NEW TAB (the one deliberate hand-off, because editing a Ticket is out of scope for v1). A Ticket missing a field renders the fields it has and marks the gap with an ink em-dash at `{colors.text.muted}` — never blank space, never dropped from the list. **NO ROW SURVIVES A PJID CHANGE.** **Visual:** 58px at a two-line title (2 × 20.93px of text + 16px padding) with `{spacing.row}` 32px as the one-line floor, separated by 1px `{colors.border.faint}`, padding `8px 0`. Three grid columns at an 8px gap, `{spacing.glyph} max-content 1fr`: the state mark at 11px coloured by whichever of the five `colors.state` values the row resolves to; the key in `{typography.mono}` at `{colors.text.machine}` sized to the longest key IN THE CURRENT FETCH (not across all projects — that costs 28px of title on every row, 13.5% of the measure); the title in `{typography.body}` wrapping to two lines. **Measured:** 207px ≈ 32 serif characters per line on a `SIDE`-length key, 179px ≈ 28 on a `HOLOCENE`-length key. Hover raises the row ground to `{colors.surface.raised}` — a tonal step, never a shadow.

**UX-DR25: `{components.ticketCreateBox}` — v1.** Creates with a TITLE ALONE; description and target state optional and collapsed by default. It does NOT wait on the Board read — the Bridge resolves the omitted entry state server-side, so the box is live before the list lands. It validates nothing beyond non-empty and says nothing implying the title must be good. The submit NAMES THE BOARD it will write to. A `createKey` UUID is minted at submit in the Cockpit and carried on the request, so a create carrying an already-recorded key returns the Ticket that key produced rather than filing a second one. Draft debounced to `chrome.storage.local` keyed by pjid. On failure the entered text is preserved and the error is shown; with no Board (DS-14) or a Board with zero states (DS-22) it is DISABLED WITH THE REASON, not failing on submit; a stale generation is refused before the network call and says so. **Visual:** `{colors.surface.raised}`, 1px `{colors.border.hairline}`, `{spacing.inset}` padding; `{typography.micro}` kicker at `{colors.text.muted}` above a 1px `{colors.border.strong}` top rule; the title field is a RULED BLANK — no box, no ground, a 1px `{colors.border.strong}` baseline with a serif-italic placeholder. The submit row is three cells across a 264px inner width: a 32px fixed LEADING slot (`[v2]` attachment seat), the submit filling 184px, a 32px fixed TRAILING slot (`[v2]` batch-create seat), 8px gaps — and the two empty slots render as RULED SPACE, not as gaps. Submit label budget is 22 characters at 7.36px/char.

**UX-DR26: `{components.refetchControl}` — v1.** User-initiated Board refetch, with a never-blank guarantee scoped strictly to ONE Project: while a refetch within the current Project runs, the current list stays on screen, and a failure leaves the previous list in place with the failure stated above it. **A PROJECT CHANGE IS NOT A REFETCH** — the list is discarded in the same frame as the header and the pane renders `Reading the Board.` for the new Project. One state gives this control a second mechanism under the same word: in `Ticket created, not renderable` it re-issues the CREATE under the held `createKey` rather than re-reading the Board, which returns the exact Ticket and cannot double-file; everywhere else it is a Board read. **Visual:** 28px, transparent, 1px `{colors.border.strong}`, `{typography.label}` at `{colors.text.primary}`, `0 10px` padding — deliberately quieter than the primary submit; takes affordances 1 and 2, not the struck plate. It carries the second of the product's exactly two freshness markers (the header's as-of marker is the first; nowhere else gets one).

**UX-DR27: `{components.commandString}` — v1.** Renders a remedy command the BRIDGE returned. The Cockpit never composes command text, in any case. **Two rules because the states differ:** where an FR mandates a command (DS-11 provisioning, DS-14 board-binding), a missing command is a Bridge CONTRACT VIOLATION — the notice renders its sentence plus `The Bridge did not return the command for this. That is a Bridge bug.` and the client logs it; where no FR mandates one (DS-6, DS-8 and any notice that merely benefits), the block is OMITTED ENTIRELY rather than rendered empty. **Visual:** `{colors.surface.sunken}` block with a 2px `{colors.border.hairline}` left edge, `5px 7px` padding, `{typography.mono}` at `{colors.text.machine}`, `user-select: all`, `word-break: break-all`, never elided; its selection renders in `{colors.selection.ground}` with `{colors.selection.ink}`, never in the signature hue. It carries a `{components.copyControl}` and one EMPTY `[v2]` action slot at its trailing edge. **NOTE: this is the one v1 component whose fit at 284px was never rendered** — derived only: inside a notice the well is 248px → 35 mono characters per line before `word-break` fires.

**UX-DR28: The `[v2]` in-page layer's COMMON requirements** — the block every mark drawn into an arbitrary third-party page inherits, and the requirements no Cockpit component carries. **(i)** Every sheet declares `color-scheme: light` and an explicit opaque `background`, sets `isolation: isolate` and `filter: none` so no ancestor page filter tints it, and is drawn at `z-index: 2147483647` inside a `position: fixed` root in a hand-built CLOSED shadow root — `chrome.debugger`'s `Overlay.setInspectMode` is rejected outright with NO fallback built, because a browser-native outline is Chrome's mark and cannot wear the signature. **(ii)** Every stroke drawn ON the page uses the TRI-TONE KEYLINE — a `{colors.overlay.keylineDark}` outer and a `{colors.overlay.keylineLight}` inner around the signature stroke — all three tones, no exceptions, guaranteeing ≥4.23:1 against any sRGB ground where the signature alone drops to 1.10:1 (worst ground `#188890`). The keyline buys VISIBILITY only. **(iii)** IDENTITY is geometry, not hue: detached 10×10px L-shaped registration ticks at 2px set 3px CLEAR of the box, plus the 7px ticked spine on the inboard edge of every mark and every sheet. **(iv)** The ACHROMATIC FALLBACK: the content script samples the computed background of the outlined element and of its nearest opaque ancestor, and if ΔE76 to `#FF2E63` is under 25 the mark drops its signature stroke and renders ink-and-paper only, keeping the ticks and the spine, and dropping the scrim entirely — Tailwind `rose-500` is ΔE 8.0 and trips it. **(v)** NOTHING PRINTS: `@media print { :host, .sp-root { display: none } }`, because a fixed layer surviving into a print stylesheet paints every annotation over the first page of the operator's own document. **(vi)** OCCLUSION is handled: a mark whose anchor rect is not visible in the viewport collapses to an EDGE-DOCKED STUB — an 11×18px half-roundel flush to the nearest viewport edge carrying its number in `{typography.numeral}` in the same tri-tone, docked to the edge the element is past — reversible by scrolling, never floating over page chrome, and explicitly NOT a fifth anchoring outcome (the pane still reports the row as Anchored). **(vii)** If the layer cannot render on a page at all — an ancestor `transform`, `filter` or `contain`, or the top layer — the arm gesture REPORTS that it could not arm and names the page; no degraded, approximate or best-effort box is ever drawn.

**UX-DR29: `{components.hoverOutline}` — `[v2]`.** Outlines the element under the cursor while the select tool is armed and prints the RESOLVED SELECTOR FIRST, before the click — the DevTools pattern, taken so the operator can prove which node the tool resolved before committing, with no round trip to any agent. If the layer cannot render on this page the arm gesture reports it could not arm; it NEVER arms invisibly. **Visual:** a 2px `{colors.overlay.outline}` box with a `{colors.overlay.scrim}` `rgba(255,46,99,0.14)` fill and four DETACHED 10×10px corner ticks 3px clear of the box; tri-tone keyline mandatory; the 7px ticked spine runs down its inboard edge, which is what makes it recognisably Sidepiece's rather than recognisably an outline. The scrim is a RELATIVE tint (≈1.21:1 over white), explicitly not a contrast device, and drops entirely under the achromatic fallback. Its tooltip is a full free-standing Sidepiece sheet — paper ground, 7px spine, four detached ticks, `3px 3px 0` zero-blur offset — with the selector in `{typography.mono}` at `{colors.text.primary}` and the dimensions beneath at `{colors.text.muted}`.

**UX-DR30: `{components.commentBubble}` — `[v2]`.** Opens at the clicked element, collects text, and yields selector + context with NO IMAGE. Escape CLOSES it and KEEPS the draft; a navigation while it is open keeps the draft against that URL. Draft persisted to `chrome.storage.local` keyed by (pjid, page URL). **Visual:** a 280px free-standing Sidepiece sheet on `{colors.surface.overlay}`, 1px `{colors.border.sheet}`, 7px ticked spine, four detached ticks, `3px 3px 0` offset at the dark-ground opacity, padding `7px 9px 8px`; header row carries the anchor in `{typography.mono}` at `{colors.text.machine}` and the mark number as a SQUARE `{colors.action.mark}` chip with `{colors.text.onSpot}` ink in `{typography.numeral}`; body in `{typography.body}`; footer above a dashed rule holds the count at `{colors.text.muted}` and a `{colors.surface.stamp}` commit control at 32px with its struck-plate keyline. Because it is a fully opaque sheet its interior contrast is identical to the Cockpit's on any page. **OPEN FOR JARAD:** how much of the captured payload (tag, text snippet, `outerHTML`) the bubble shows before commit.

**UX-DR31: `{components.freehandLayer}` — `[v2]`.** The drawing surface for feedback a selector cannot express. A DRAG inside the armed mode is a PEN, not a rectangle — pointer-down with any movement begins a stroke, pointer-up commits that stroke and the annotation stays open so strokes accumulate; a click with NO movement is the element-anchored path instead, same armed mode, no mode switch, the branch is movement. Undo removes the LAST STROKE repeatedly back to an empty layer; an empty layer on exit yields no annotation. Escape exits drawing and KEEPS the strokes as a draft against that URL. Strokes are drawn as VECTORS over the live DOM — nothing is captured as a raster, which deletes `captureVisibleTab`, its two-calls-per-second limit, HiDPI handling, the `activeTab` permission and the whole capture-failure path. A commit control yields: stroke geometry in RELATIVE coordinates, the strokes' bounding box in relative coordinates, and the SET OF ELEMENTS THE STROKES CROSS, each carrying the same selector+context payload the element-anchored kind sends. **Visual:** transparent full-viewport surface; the stroke is the named 5/3/1 TRIPLE with a true rendered width of 5px — a 5px `{colors.overlay.keylineDark}` under-stroke, a 3px `{colors.overlay.outline}` core, a 1px `{colors.overlay.keylineLight}` over-stroke, round cap and round join; strokes never change colour, thickness or opacity by tool, age or pressure; the active bounding box is a 1px dashed `{colors.overlay.outline}` rectangle; the commit affordance is a free-standing Sidepiece sheet pinned to the viewport corner, not an in-canvas widget. The DRIFTED state renders the same 5/3/1 stroke with the CORE switched to `{colors.state.unknown}`, keylines unchanged, and the bounding box switched from dashed to 1px dotted `{colors.state.unknown}` — and the geometry is NEVER moved to follow the elements.

**UX-DR32: `{components.annotationPin}` — `[v2]`.** Marks an annotated element on the page; when the anchor no longer resolves the pin does not render and the row says so. **Visual:** an 18px `{rounded.pill}` roundel — the ONLY curved shape in the entire system, and the curve is the point: it is a mark made ON the page, not Sidepiece chrome, and every piece of Sidepiece chrome is square. `{colors.action.mark}` fill with a `{colors.text.onSpot}` ink digit in `{typography.numeral}` at 4.96:1; two digits at 12.0px inside a 15px chord, so pins run 1–99 and the layer does not mint a hundredth mark. Tri-tone: a 1.5px `{colors.overlay.keylineLight}` ring inside and a 1px `{colors.overlay.keylineDark}` ring outside. NO translucent halo — a glow is banned, and the halo left the pin at 1.90:1 on a light-green ground and invisible on Tailwind rose. Its leader to an open bubble is the same tri-tone at a 1.5px core. Hover steps the outer ring from 1px to 1.5px.

**UX-DR33: `{components.annotationRow}` — `[v2]`.** One row in the Annotations pane, grouped by page URL, carrying its CAPTURE TIME so a stale batch looks stale rather than disappearing. Hovering it outlines its element in the page, or replays its strokes for the freehand kind — the list and the overlay are two views of ONE state, never two states to reconcile. It keeps its text and captured context when the anchor is lost and STAYS DISCHARGEABLE. **Four anchor outcomes render distinctly:** Anchored (live, hover outlines); Re-matched weakly (`Re-matched by text, not by selector.`, hover still outlines, the discharge payload says which rank matched); Anchor lost (`The element this was pinned to is gone.`); Drifted, freehand only (`The page moved under these marks.`). **Visual:** ordinary Cockpit paper — `{spacing.row}` 32px minimum, 1px `{colors.border.faint}` separator, padding `8px 0`, a leading pin number as a small SQUARE `{colors.action.mark}` chip with `{colors.text.onSpot}` ink in `{typography.numeral}`, text in `{typography.body}`, capture time in `{typography.label}` at `{colors.text.muted}`. A lost anchor marks the row with `marks.unknown` at the leading edge; the row is NEVER dimmed, because a dim row reads as disabled and this one is still dischargeable.

**UX-DR34: `{components.dischargeControl}` — `[v2]`.** The one-button finale: a Ticket per annotation, or the whole batch to the PM as one Dispatched Command. Partial failure is ITEMISED — the pane keeps exactly the annotations that did not land and says which; it never reports four when two landed. The pane EMPTIES on discharge and its switch slot disappears. **Visual:** 32px, `{colors.action.primary}` ground with the struck-plate keyline, `{colors.text.inverse}` label in `{typography.label}`, padding `0 {spacing.gutter}`, FULL WIDTH of the action bar — the largest stamp in the product and the only control that is ever full-width, because the finale of a batch is the one moment the instrument commits everything at once.

**UX-DR35: `{components.attachmentChip}` — `[v2]`.** Shows an annotation attached to a Turn or a Ticket BEFORE it sends; removable before send, never silently dropped. **Visual:** 24px, `{colors.surface.sunken}` fill, 1px `{colors.action.markDeep}` border, label in `{typography.label}` at `{colors.action.markDeep}` (4.76:1 on sunken) — the ONLY place `markDeep` sets type in the system. Padding `0 7px`, square. It is explicitly NOT a `{colors.surface.spotWash}` pastel fill: a pastel is the one tonal register this system does not otherwise contain, and a sunken well with a deep-spot rule says "a piece of the in-page layer rode in here" without importing a boutique colour.

**UX-DR36: `{components.iconBadge}` — `[v2]`.** Counts UNDISCHARGED ANNOTATIONS FOR THE RESOLVED PROJECT across its pages — a count of the operator's own uncommitted work, a reminder to LEAVE, never a count of inbound work, never a fifth resolvability state. Absent in v1 entirely, and absent whenever the count is zero. It is NOT a reserved seat: v1 builds no badge surface at all, and "no badge" is a v1 RULE, not a principle, so v2 is not re-litigating it. **Mechanism:** `chrome.action.setBadgeText` with `setBadgeBackgroundColor('#FF2E63')` and `setBadgeTextColor('#191713')` at 4.96:1 — Chrome owns the shape, the face, the size and the tracking, and Sidepiece owns exactly two colours. Text is at most two characters. This is the one named exemption to The Spot Is Identity Rule, because on Chrome's toolbar the badge is identity first — being found among a row of other extension icons is the one job no ink could do.

#### The 28 degraded states and the router (UX-DR37–48)

**UX-DR37: DS-1 — `This page declares no pjid.`** Its own entry because it is the browser's DEFAULT CONDITION on almost every page until something emits the declaration, and it must be the wallpaper rather than an error. It is one of exactly TWO states in the product that render NO `{components.stateNotice}`: one line at rest at `{colors.text.muted}` in the body, plus the second sentence `Nothing to resolve. Sidepiece never guesses a Project from a URL.` because that sentence is what makes the first non-accusatory. NO failure glyph — Rule 3's glyph pairing applies to states, and this is the absence of one. No header. The re-resolve control is DEMOTED, NOT ABSENT — present as a quiet secondary affordance under the line, because FR-1 re-detects a declaration that appears without a navigation, so re-resolution genuinely can succeed. Resolves when a tab that declares one becomes active, or this page starts declaring one.

**UX-DR38: DS-21 — `Sidepiece can't read this page.`** Its own entry, and the SECOND and last state that renders no `{components.stateNotice}`. **Trigger:** Chrome will not run the content script on this tab — a `chrome://` page, the new-tab page, another extension's page, the Web Store, a `data:` URL. Detail line: `Chrome doesn't let an extension look at its own pages, other extensions' pages, or the Web Store.` It renders NO RE-RESOLVE CONTROL AT ALL, and this is the single stated exception to FR-3's blanket rule — re-resolving a `chrome://` tab can never succeed, and offering a control that structurally cannot work violates honesty more seriously than omitting it violates FR-3. It exists because DS-1 would otherwise LIE: DS-1 asserts a positive fact about what the page contains, and on a page nothing was read from, that claim is unsupported. Clears itself when a readable tab becomes active. This is the strongest candidate for an eighth key screen — a genuinely different shape from anything on the sheet.

**UX-DR39: The SHARED TOTAL-OUTAGE notice** — covers **DS-3, DS-4, DS-5, DS-27, plus DS-6 and DS-7 in their no-snapshot form (6 codes).** ONE notice in the body, the identity header REPLACED by it (not dimmed), the pane switch INERT, one re-resolve control. Sentences, one per distinguishable cause because each has a different fix: **DS-3** `The laptop is off the tailnet.` / `` `burro-salmon.ts.net` isn't up on this machine, so the Bridge can't be reached. ``; **DS-4** `` `big-chungus` isn't answering. `` / `The tailnet is up. Nothing is listening at the Bridge.`; **DS-5** `Can't reach the Bridge.` / `The tailnet looks up, but Sidepiece can't tell whether the host is down or the Bridge is stopped.`; **DS-27** `Sidepiece and the Bridge are on different contracts.` / `` `<side>` is the older one. `` (produced by the COCKPIT, since the Bridge cannot know what the client was built against; naming the side IS the fix); **DS-6** `The pjangler Registry service isn't running.` + command when the Bridge returns one; **DS-7** `The Registry answered with an error.` / `<the error, as the Bridge reported it>`. **Acceptance:** no per-pane message renders while any of these is active — six ways of saying the tailnet is down is the failure this rule exists to prevent; and the FR-2 cache is invalidated on the unreachable→reachable transition. This is key screen S4.

**UX-DR40: The NO-HEADER RESOLUTION notice** — covers **DS-2 and DS-16 (2 codes).** All panes gated, no identity header, a full `{components.stateNotice}` in the body with a re-resolve control. **DS-2** `` `<pjid>` — declared but unknown. `` / `The page declares this pjid. The Registry has no Project under it.` — note `declared but unknown` is one of the five PRD literals and is exact. **DS-16** `Sidepiece was reloaded. Reload this tab to reconnect.` — the ONLY state in the entire product that tells the operator to reload anything, with a re-resolve that will keep failing until the tab reloads AND SAYS SO. **Acceptance:** DS-16's sentence must never appear for a Bridge restart, which needs no reload of anything — teaching that reflex for the most routine Bridge event is the specific failure.

**UX-DR41: The PARTIAL-OUTAGE PER-PANE notice, CHAT gated** — covers **DS-11, DS-12, DS-13, DS-20, DS-24, DS-25, DS-26, DS-28 (8 codes).** Header intact, Tickets fully live, the pane switch marks Chat degraded while hidden, the composer disabled with the reason stated, one `{components.stateNotice}` in the Chat pane. Eight separately-worded sentences because there are eight different fixes: **DS-11** `No PM is declared for <repo>.` + MANDATORY command; **DS-12** `` `<pm>` is declared but isn't in the Hermes fleet registry. ``; **DS-13** `` `<pm>` is registered but isn't answering. ``; **DS-20** `` `<pm>` is bound to a role directory that isn't on disk. `` / `The PM is declared, but the directory it runs out of isn't there.`; **DS-24** `The Hermes gateway is at its session limit.` / `Something else on big-chungus is holding the sessions. Nothing here can free one.` (no retry offered — no amount of Sidepiece restraint reaches a shared cap); **DS-25** `This Bridge is older than its Turn store.` / `The store was written by a newer Bridge. Nothing has been read, and nothing has been migrated.`; **DS-26** `The Hermes gateway answered with a surface Sidepiece doesn't know.` / `<the method, as the Bridge named it>`; **DS-28** `No PM session was free for that turn.` / `Your other Projects are mid-Turn. Nothing was sent, and the text is still here.` **Acceptance:** DS-24 and DS-28 are distinct (shared gateway cap vs Sidepiece's own 3–5 pool) and so are DS-13 and DS-26 (silent vs answering with the wrong surface); the Turn text is kept in every one; and no Chat-scoped state may ever disable the Tickets pane.

**UX-DR42: The PARTIAL-OUTAGE PER-PANE notice, TICKETS gated** — covers **DS-14, DS-17, DS-22 (3 codes).** Header intact, Chat fully live, the switch marks Tickets degraded while hidden, the create box DISABLED WITH THE REASON rather than failing on submit. **DS-14** `<repo> has no Board.` / `Nothing to list, and nothing to create against.` + MANDATORY command, with the `[v2]` one-click-provisioning action slot beside it; the check is for a TRUTHY identifier because the field is an empty string, never null. **DS-17** `The Bridge is up. Plane is failing.` / `<the error, as the Bridge reported it>` — and the previous list is NOT left on screen under a failure, because a list we cannot refresh is a list we cannot vouch for. **DS-22** `This Board has no states. Nothing to create into.` + command when the Bridge returns one — a DS-14 sibling, and distinct from both `This Board is empty.` (a Board with states and no Tickets) and DS-14 (no binding). This is key screen S5, and the S4/S5 difference IS Rule 2's total/partial line.

**UX-DR43: DS-18 — the HALF-PANE state, and the only one of its shape (1 code).** Bloodbank unreachable at the transport: the Streamed Exchange path stays FULLY LIVE and the composer stays ENABLED. `The Bridge is up. Bloodbank isn't reachable.` / `Questions still work. Anything that would be dispatched can't be published right now.` A Turn that classifies as Dispatched Command is refused BEFORE publish with this sentence, the text is kept, and the flip control is right there — a flip to Streamed Exchange sends. **Acceptance:** it is distinct from a five-token subject rejection, which is Bloodbank ANSWERING and refusing; and disabling all of Chat here is the explicitly forbidden behaviour.

**UX-DR44: DS-19 — the PER-TURN-CARD marker, gating no pane (1 code).** Candystore unreachable: dispatch still SUCCEEDS and is acknowledged; the marker renders on the affected Turn cards, not as a pane gate. `The Bridge is up. Candystore isn't reachable.` / `Dispatches still go out. Their outcomes can't be observed until it's back.` Outstanding outcomes reconcile on the next read. **Acceptance:** it must be worded and rendered DIFFERENTLY from FR-9's `No outcome after <window>. Status unknown.` — that one means nothing arrived, this one means we cannot look, and the fixes differ so the sentences differ. Never render a dispatch as completed because nothing said otherwise.

**UX-DR45: The INFORMATIONAL header-level markers** — no notice, no pane gated, no recovery control needed. Covers **DS-9, DS-10, DS-15, DS-23 (4 codes).** **DS-9:** clone path missing on disk — the header renders and MARKS the path, which stays selectable and copyable because the path is the thing he needs to go look at; `` `<path>` isn't on disk. `` / `The Registry has this Project. big-chungus doesn't have the clone.`; Sidepiece never clones it. **DS-10:** a NON-PM Agent binding whose `role_dir` does not exist — one informational line, gating NOTHING; `` `<agent>` is bound to `<role_dir>`, which doesn't exist. `` / `That role isn't a chat target, so nothing here depends on it.` (this occurs on this repo today, and gating Chat on it would kill Chat on the repo being built). **DS-15:** the degraded-connection indicator — marks the header, gates nothing, renders NO recovery control because it is a fact and not a fault, and deadlines are kept while only what expiry SAYS changes. **DS-23:** `Resolved from a snapshot taken <age> ago.` / `The Registry isn't answering. This is the last good copy big-chungus had.` — the age is SURFACED, NEVER ENFORCED; a snapshot is never withheld for being old.

**UX-DR46: DS-8 — the CREDENTIAL-SCOPED state, whose blast radius is variable (1 code).** A credential did not resolve from `DeLoSecrets` at Bridge start: the gate is whichever dependency it feeds, and that dependency is NAMED. `` The Bridge started without `<credential>`. `<dependency>` can't be trusted. `` Recovery: re-resolve; resolves when the credential resolves at the next Bridge start or per-request retry. No command block is rendered, because no FR mandates one here — an omitted block, never an empty one.

**UX-DR47: Implement the total-vs-partial ROUTER as a single testable predicate**, because the PRD never reconciles "§5: every pane fails independently and says why" with "UJ-3: one shared message". **The rule:** when the Bridge itself is unreachable, or the Registry behind it is down AND the Bridge holds no last-good snapshot, nothing in the Cockpit can be true — ONE shared notice, header replaced, switch inert. When the Bridge answers and a single dependency behind it has failed, the panes that do not depend on it stay FULLY LIVE and only the one that does renders its own notice. DS-6 and DS-7 move ACROSS this line depending on whether the Bridge holds a snapshot — with one, the Project resolves from it, the header renders marked stale, the panes stay live and DS-23 carries the age. **Acceptance:** a test matrix asserting, for each of the 28 DS codes, exactly which of the two shapes renders and which panes remain operable.

**UX-DR48: Implement the four in-flight/deadline rules that govern every state, degraded or not.** **Rule 1:** NO pane may render a failure as an empty state or a permanent spinner — every in-flight state NAMES what it is waiting on and carries its budget as a deadline; when the deadline passes it BECOMES a timeout state with a retry control; an empty state is a RESULT and only a successful read may render one (`This Board is empty.` renders after a 200, never instead of one). **Rule 1a:** a dropped promise is not a dropped deadline — under a DERP relay every in-flight state keeps a deadline and only what expiry SAYS changes, e.g. `Still waiting on the Board read. The connection is relayed, so there is no budget for this.` with a retry. **Rule 3:** no state is carried by hue alone — every state renders a GLYPH and a WORD alongside its `{colors.state.*}` value, and this is behavioral, not visual. **Rule 4:** the client holds continuity, the Bridge holds the record — `chrome.storage.local` holds drafts, pane selection, group-collapse state, the bounded FR-2 resolution cache and `[v2]`'s pre-discharge annotations, NOTHING there may be the only source of a rendered fact, anything rendered from it CARRIES ITS AGE, and every read is wrapped so that if storage throws or returns empty the surface renders its empty default and works. **OPEN:** the relayed deadline's MULTIPLE is set nowhere and belongs in this story; the SSE-subscription budget is ≤2s by analogy only.

#### Voice and Tone (UX-DR49–52)

**UX-DR49: Build a single COPY MODULE holding every user-visible string**, so no sentence is authored at a call site and no sentence is reused across two states. It must carry: all 28 DS headline+detail pairs; every normal-path state string; the four extension-icon titles plus the one transient; and the Do/Don't table's ~30 exact strings. **Enforceable rules:** (1) NAME WHAT FAILED — never "something went wrong", never "an error occurred", never a status code alone; (2) DISTINCT CAUSES GET DISTINCT SENTENCES — no string may appear under two state codes, and a lint over the module asserts uniqueness; (3) the Cockpit NEVER composes a remedy command; (4) machine identifiers are COMPLETE OR ABSENT — mono, never elided, never `text-overflow: ellipsis`; (5) HONESTY OVER COMFORT — "unknown" is a word we use; "probably", "should", "may have" are not; (6) never blame, never apologise, never cute — no "Oops", no "Sorry", no exclamation marks, no emoji, no encouragement; (7) second person ONLY when he must act; (8) GLOSSARY OR NOTHING — never "sidebar"/"the panel" for Cockpit, "message" for Turn, "issue"/"bug" for Ticket, "bot"/"assistant" for PM, "server" for Bridge, lowercase "project" for a Project; the one permitted use of "panel" is the compound "panel document"; (9) sentence case, one sentence where one will do, period on a sentence and none on a label.

**UX-DR50: Ship the five PRD-dictated strings EXACTLY, as constants that a test asserts byte-for-byte.** (1) `the PM has your turn` — Turn card within 500ms of send, distinct from a response, never "Sending…". (2) `warming up the PM` — Turn card on a cold session, replaces the first-token budget, never shown warm. (3) `this tab is resolvable` — the extension icon's title in the RESOLVABLE state. (4) `declared but unknown` — inside the DS-2 resolution notice, naming the state in the state. (5) The degraded-connection INDICATOR — the thing is named by the PRD, its sentence is ours (`Relayed connection. Timings below are not the usual ones.`), and it is rendered, never suppressed. **Note for the story:** strings 1–4 are literals to match; row 5 names a component rather than a literal, so the test asserts presence of the indicator, not of a PRD string.

**UX-DR51: Enforce the wire rule that the BRIDGE SENDS CODES, NOT PROSE, with exactly one deliberate exception.** Every DS code, every normal-path state and every icon title resolves to its sentence in the Cockpit's copy module; the Bridge sends the code plus its typed payload (the error text as the Bridge reported it, the credential name, the dependency name, the method name, the snapshot age, the correlation id). **THE ONE EXCEPTION is remedy COMMAND TEXT:** DS-11's provisioning command and DS-14's board-binding command are composed and sent by the Bridge verbatim, because the Bridge knows the installed pjangler and Hermes surface and a command the Cockpit invents goes stale the first time a flag changes. **Acceptance:** no user-facing sentence originates server-side except that command text; and where an FR mandates a command and the Bridge returns none, the Cockpit renders `The Bridge did not return the command for this. That is a Bridge bug.` and logs it.

**UX-DR52: Implement the classification CONSEQUENCE LINE as copy that reflects what actually happens today, not what FR-9 promises.** `This will stream back here.` for Streamed Exchange; `This will be published and acknowledged. The result arrives later.` for Dispatched Command. The flip is made on the OUTCOME, not on the label, which is why the line exists. **Acceptance:** until the Bloodbank gateway carries result content, a completed dispatch renders `Completed. The gateway returned no result content.` and never `Completed` alone and never a bare checkmark — FR-6's bias toward dispatch is only justified by FR-9, so the honest state is the requirement.

#### Interaction Primitives (UX-DR53–60)

**UX-DR53: Declare EXACTLY TWO `chrome.commands` in v1's manifest, from a total budget of four.** Row 1: `_execute_action` at `Alt+Shift+S`, not global — a reserved command name needing no handler, which with `setPanelBehavior({openPanelOnActionClick: true})` OPENS a closed Cockpit and CLOSES an open one. Row 2: `focus-ticket-title` at `Alt+Shift+N`, not global — opens the Cockpit if closed, switches to Tickets, puts the caret in the title field, and NEVER closes it (it is its own command calling `open()`, not the action). So **v1 ships exactly ONE command listener.** Rows 3 and 4 (`arm-picker` at `Alt+Shift+A`, `discharge-batch` at `Alt+Shift+D`) are ALLOCATED for `[v2]` and must NOT be declared — a declared-but-dead shortcut occupies a slot Chrome will not give back, shows the operator a keystroke that does nothing, and there is zero headroom to recover it. All four are Alt+Shift rather than Ctrl+Shift, to stay clear of Chrome's own C/J/T/N/D chords; none is global, because all four verbs operate on the active tab.

**UX-DR54: Implement the six in-document key handlers**, which cost nothing from the `chrome.commands` budget of four: `Enter` sends/creates in the composer and the create-box title; `Shift+Enter` newlines in the description; `Alt+M` flips the classification and PINS it until send (an accelerator, not the only path — the control is also a button); `Tab`/`Shift+Tab` traverse focus in reading order; `Escape` cancels, never destroys; `Alt+1`/`Alt+2` select a pane by position, mirroring the switch's visible order.

**UX-DR55: Implement ESCAPE-AND-CANCEL semantics as a table, and teach it**, because Escape-to-cancel is NOT inherited — neither Chrome's `inspect-mode` page nor Edge's documents Escape at all, so it is a deliberate choice and the armed state must name its exit. **Composer or create box with text:** BLURS the field, text STAYS — never clears it. **A collapsed section just expanded:** collapses it. **`[v2]` armed select tool:** disarms and the indicator goes away — never discards accumulated annotations. **`[v2]` comment bubble open:** closes the bubble and KEEPS the draft against that URL — never discards the text. **`[v2]` freehand layer with strokes:** exits drawing and KEEPS the strokes as a draft — never discards them (per-stroke undo and the row's delete are what discard). **Anywhere in the Cockpit:** nothing else, and NEVER closes the Cockpit — only the icon can.

**UX-DR56: Implement the OPEN/CLOSE gesture rules as interaction rules rather than implementation notes**, because their failure mode is an intermittent heisenbug. `sidePanel.open()` must be the FIRST SYNCHRONOUS CALL in a user-gesture handler — an `await` before it, even awaiting `setOptions`, breaks the chain and Chrome silently no-ops with no thrown error. `sidePanel.close()` and `toggle()` do not exist inside the panel document, so NO control the Cockpit renders may claim to dismiss it, and none does — an X that does not work is worse than no X. The icon click is a TOGGLE and it is the product's only close gesture, identical to its open gesture, in the same place, with no aim required. The service worker's `onMessage` handler is written CALLBACK-STYLE WITH ZERO AWAITS from day one, even though v1 has nothing to summon it — Chrome curries a user gesture across exactly one `runtime.sendMessage` hop and a promise chain there silently loses it. If the known Chromium reopen-gesture bug (issues.chromium.org/415694848) fires, the failure must NOT be swallowed to the console: the service worker replaces the current icon title with `Sidepiece couldn't open. Click again.` until the next successful open.

**UX-DR57: Implement FOCUS ORDER and focus survival.** Focus order is READING ORDER on every surface: header (clone-path region → copy control → health marker) → pane switch → pane content → action bar. A re-render NEVER steals focus and NEVER drops it: when the Project changes under an open Cockpit (a tab switch), focus moves to the PANE SWITCH — a defined landing — rather than being lost to `<body>`; when the composer or title field has focus and the pane re-renders around it for any other reason, focus STAYS IN THE FIELD. The focus ring is `{colors.focus.ring}` on every interactive element INCLUDING the clone-path region, which is focusable specifically so it can be reached and copied without a mouse.

**UX-DR58: Implement SCROLL behaviour:** exactly ONE scroll region on screen at a time — the body — with the header and action bar pinned, because nested scroll regions in a 284px column are a trap-the-wheel bug. The Turn list is bottom-anchored while streaming and STOPS FOLLOWING the moment the operator scrolls up, surfacing `{components.jumpToLatest}`. The Tickets pane scrolls with group headers `position: sticky` to the top of the region on opaque `{colors.surface.panel}` with a `{colors.border.strong}` bottom rule, so the state a row belongs to is never off screen. **NOTE: this rule is in direct contradiction with `{components.turnComposer}`'s "grows upward to a cap, then scrolls internally" — see UX-DR80.**

**UX-DR59: Implement TEXT SELECTION rules.** The clone path is selectable text and WRAPS rather than truncates — no ellipsis ever, because an ellipsised path looks copyable and copies wrong. The Board identifier, the pjid, every correlation identifier and every command string are equally selectable and equally complete, with `user-select: all` and `word-break: break-all` on the command string. Turn text is selectable; `[v2]` annotation text is selectable. **SELECTION IS NEVER HIJACKED:** no control captures `mousedown` inside a selectable region — the `[v2]` armed select tool is the one exception, which is exactly why it is a named mode with a visible indicator and a documented exit. `::selection` renders in `{colors.selection.ground}` `#FFE4EC` with `{colors.selection.ink}` `#191713` at 14.97:1, and NEVER as white-on-signature at 3.61:1, which would land the one banned pair on the panel's most important text.

**UX-DR60: Implement POINTER rules.** Click to act, one primary action per control. **HOVER REVEALS NOTHING that is not also reachable by keyboard** — at 320px with a terminal-dwelling operator, hover-only affordances are a trap; hover may ADD information (the URL behind the context chip, the page outline behind an annotation row) but never expose the only path to an action. **DRAG IS USED IN EXACTLY ONE PLACE in the entire product:** `[v2]`'s armed select tool, where a click with no movement yields an element-anchored annotation and a drag yields a stroke-bearing one — one armed mode, two payloads, no mode switch. The armed state ANNOUNCES ITSELF (a visible in-page indicator plus a changed icon) and does not silently steal the page's clicks. Deliberate divergence from DevTools: the tool STAYS ARMED across clicks, because the journey is accumulate-then-discharge and re-arming per item is the friction the product exists to remove.

#### Accessibility Floor (UX-DR61–69)

**UX-DR61: KEYBOARD REACHABILITY.** Every control is reachable and operable from the keyboard, including the clone-path region and every state notice's recovery control. **Acceptance test:** there is no mouse-only path to any action in the product; tab through every screen in the key-screen set and reach every interactive element, then operate each with Enter/Space.

**UX-DR62: FOCUS IS NEVER LOST.** **Acceptance test:** trigger every re-render path (tab switch same Project, tab switch different Project, switch to a no-pjid tab, switch to an unreadable tab, refetch, Ticket created, Turn sent, state notice appears) and assert focus is never on `<body>` afterwards — it is either where it was, or on the pane switch.

**UX-DR63: FOCUS IS ALWAYS VISIBLE.** One ring token on every interactive element, drawn as a TWO-TONE printer's keyline with `box-shadow: 0 0 0 1px #F2EDE3, 0 0 0 3px #191713; outline: none` so it follows the 0px corner exactly, applied on `:focus-visible`. On a stamp-ground control the focus keyline and the struck plate COEXIST because one is `inset` and the other is not: `box-shadow: inset 0 0 0 1px {colors.surface.panel}, 0 0 0 1px {colors.focus.ringInner}, 0 0 0 3px {colors.focus.ring}`. **Acceptance:** on every Sidepiece ground at least one of the two tones clears 3:1 — ink 15.34:1 on paper, paper 15.34:1 on the stamp, and on a spot mark ink 4.96:1 / paper 3.09:1. The named failure not to repeat: a codebase with exactly one `:focus` rule and no `:focus-visible`.

**UX-DR64: LIVE REGIONS, used sparingly and correctly.** Streaming text goes into a `polite` live region that announces THE COMPLETED ANSWER, not every token — token-by-token floods a screen reader and communicates nothing. State transitions announce ONCE EACH: turn accepted, warming, stream failed, dispatched, outcome arrived, Ticket created, create failed. Degraded-state notices announce on appearance. DS-1 and DS-21 announce once on appearance and NEVER re-announce on a tab switch between two unreadable tabs, because the wallpaper is not news. **Acceptance: nothing announces twice.**

**UX-DR65: NO STATE IS CARRIED BY HUE ALONE.** Every state renders a `marks.*` glyph AND a word alongside its colour. This is the one accessibility rule that is also a CORRECTNESS rule, and it is not theoretical: `{colors.state.ok}` and `{colors.state.unknown}` are the identical hex value, so a hue without a glyph is not a signal at all. **Acceptance:** a render of a `colors.state` value without its `marks` sibling fails the build; the panel is legible to a colourblind operator and legible in a screenshot pasted into a terminal, which is where half of Sidepiece's output ends up.

**UX-DR66: REDUCED MOTION IS HONORED.** Under `prefers-reduced-motion: reduce`: the streaming caret does not pulse, progress lines do not shimmer, pane switches do not slide, and every state change is a TEXT SWAP. **Acceptance:** nothing in this product needs motion to be understood, so nothing loses meaning when motion is off — assert every state transition remains comprehensible with all animation disabled.

**UX-DR67: HIT TARGETS.** No interactive target smaller than 24 × 24 CSS px (WCAG 2.2 Target Size Minimum), and list rows at least `{spacing.row}` 32px tall. **44px is explicitly rejected** as a touch floor: this is a mouse-and-keyboard desktop panel at 320px where 44px rows would cost real information. **Acceptance:** audit every control against 24×24 and every ticket/annotation row against 32px.

**UX-DR68: TEXT SCALES.** The Cockpit is readable at the browser's larger default sizes without a control being clipped or a row overlapping. At 320px this is the constraint that bites FIRST, and it is the reason nothing in the header may be laid out in fixed columns. **Acceptance:** render every key screen at the browser's larger default font sizes and assert no clipping and no overlap, with particular attention to the header meta row (see UX-DR81).

**UX-DR69: The SCOPE BOUNDARY, stated so nobody re-adds work with no reader.** Deliberately OUT of the floor and out of v1: a full WCAG 2.2 AA conformance pass and audit; screen-reader QA across NVDA/JAWS/VoiceOver (the live-region and label discipline is written to be correct, not verified against three readers); localization and RTL; forced-colors / high-contrast-mode theming; touch. **Revisit trigger, stated once:** if the "not portable" non-goal is ever reopened, every line in this list comes back, and the in-floor list is what makes that recoverable rather than a rewrite.

#### Responsive and platform behaviour (UX-DR70–78)

**UX-DR70: Build the Cockpit to a 320px DESIGN WIDTH that is simultaneously Chrome's hard floor, with a 284px USABLE COLUMN.** The derivation, which every layout claim is written against: 320 − 2px sheet border − 6px ticked signature spine − 28px (`{spacing.gutter}` × 2) = 284px. Fixed horizontal chrome is 36px, 11.3% of the panel, and that share is TERMINAL because 320 is the floor. **The nesting chain**, which every inner measurement hangs off: 284 → 264 inside `{components.turnComposer}` → 244 inside `{components.classificationControl}` / 248 inside `{components.contextChip}`; and 284 → 268 inside the identity header's clone-path well. **THERE ARE NO BREAKPOINTS**, because the extension can neither set, suggest nor read the width — every claim holds at 284px and degrades upward, and extra width buys longer unwrapped paths and more visible Turn text, NEVER a second column and never a revealed pane. Nothing is centred; every label, value and row starts at the gutter.

**UX-DR71: Lifecycle — TAB SWITCH, SAME PROJECT.** The panel document SURVIVES: DOM, JS state and open sockets persist, and the service worker messages the long-lived document to re-render in place, keyed by the SAME `(pjid, generation)`. Focus lands on the pane switch. Chat state survives with no persistence work. **Acceptance: no reload, no refetch, no flicker.**

**UX-DR72: Lifecycle — TAB SWITCH, DIFFERENT PROJECT.** The panel document still survives but EVERY PANE'S CONTENT DOES NOT: one atomic re-render onto the new `(pjid, generation)` in which the Tickets list is DISCARDED and refetched from zero, the Chat pane loads the new Project's Turns, the pane resets to Tickets, and focus lands on the pane switch. Nothing crosses the pjid boundary — not a Ticket row, not a group header, not a Turn, not a partial stream, not a cached list; the only thing the FR-2 cache may make fast is the header, and even that carries an as-of marker until the Bridge confirms. An outstanding Turn stays owned by its originating pjid in the Bridge and CONTINUES there, is never rendered in the new Project's thread, and its accumulated partial text is DISCARDED rather than carried. Nothing whatsoever is rendered about the Project he left — no marker, no count, no toast. **Acceptance: there is no code path in which two regions render from different generations.**

**UX-DR73: Lifecycle — COLLAPSE, CLOSE, and REOPEN COLD START.** Collapse is the SAME EVENT as close: the panel document is fully torn down and reloaded, which is why every draft lives in `chrome.storage.local` and why drafts are debounced continuously during typing rather than flushed on `onClosed`. A reopen is roughly seven network reads plus re-establishing SSE, and the rendering order is fixed: (1) **DETECTION FIRST**, locally, before anything paints — the pjid is re-read, never remembered; (2) the identity header paints next FROM CACHE if the entry is valid for that pjid, carrying an as-of marker until the Bridge confirms, and the cache serves the header AND NOTHING ELSE; (3) **AT MOST THREE progress lines**, never a whole-panel spinner — one for resolution if uncached, one in Tickets, one in Chat, while health and the SSE subscription render nothing and the health marker sits at "not yet known", which is a real state and not a placeholder; (4) **NO PANE WAITS ON ANOTHER** — the composer is live before Turn history arrives, the create box is live before the Board arrives; (5) every progress line carries its budget as a deadline and converts to a timeout state on expiry; (6) the subscription is SILENT UNLESS IT FAILS, and on failure renders `Not subscribed to outcomes. Dispatched results won't land here until this reconnects.` with a retry — lodged outside the DS taxonomy as a property of this open, gating no pane.

**UX-DR74: Lifecycle — the three tab-content transitions.** **Switch to a tab with NO pjid:** the Cockpit re-renders into DS-1; it never keeps showing the last Project because the last Project is more interesting. **Switch to a tab Chrome WILL NOT LET US READ:** the Cockpit re-renders into DS-21, distinct from DS-1 because nothing was read and the sentence must not claim otherwise — routine on `chrome://extensions`, the new-tab page and the Web Store. **SPA NAVIGATION:** the panel document is unaffected and the content script is the problem — a history-API transition never unloads the document so a declarative content script does not re-inject; detection is re-triggered by an EXPLICIT OBSERVER, and a route change re-resolves exactly like a navigation, including into DS-1 if the new route declares nothing.

**UX-DR75: Lifecycle — BRIDGE RESTART and EXTENSION RELOAD, which must never be confused.** **Bridge restart:** the Bridge goes away and comes back and NOTHING IN CHROME IS RELOADED — while it is down the Cockpit renders DS-4 or DS-5 (or DS-3 if the tailnet went with it), and when it returns ONE re-resolve is the whole recovery, with the FR-2 cache invalidated on the unreachable→reachable transition. DS-16's "reload this tab" sentence must NEVER appear for this cause. **Extension reload (dev):** content-script contexts are invalidated exactly as a real update does, throwing "Extension context invalidated" in open tabs, and the side panel document does NOT hot-reload — it must be closed and reopened. DS-16 exists for this one cause only, and it is the only state in the product that tells the operator to reload anything.

**UX-DR76: Lifecycle — WINDOW SWITCH / MULTI-WINDOW and CHROME RESTART.** Chrome's side panel is per-window: two windows are two Cockpit documents with INDEPENDENT RESOLUTION STATE over a SHARED per-pjid resolution cache in `chrome.storage.local`. Each panel holds its own render, its own `(pjid, generation)` frame and its own SSE subscription. v1 does NOT synchronize them, two Cockpits may legitimately disagree, and **NO SYNC INDICATOR IS RENDERED** — inventing one would imply a guarantee v1 does not make. Pane selection is a single global key, so a switch in one window follows to the next open of the other; accepted and priced for a two-item toggle. **Chrome restart PRESERVES:** Turn history (the Bridge holds it), drafts, pane selection, group-collapse state, and the resolution cache — still only good for its five-minute TTL. **NOT preserved:** anything in the panel document, the SSE subscription. **UNKNOWN and not designed around:** whether Chrome reopens the side panel at all and whether it restores a resized width — assume the Cockpit is CLOSED after a restart and the first open is a full cold start.

**UX-DR77: FIRST RUN — two one-time steps, neither of which is a journey and neither of which gets a screen.** (1) The BROAD HOST MATCH prompts once at install and is ACCEPTED — Chrome renders that prompt, Sidepiece does not, and Sidepiece renders nothing before or after it. There is NO onboarding screen, NO welcome tab and NO first-run Cockpit state; the first open is an ordinary open. (2) **THE ACTION ICON MUST BE PINNED**, and that is the product's only setup step — Chrome hides a newly installed extension's action behind the puzzle-piece overflow, every journey opens on the icon, and an unpinned icon renders its resolvability signal into a menu nobody has open. Say "pin the icon" in the install note; build NO in-product nudge, coach mark or first-run overlay.

**UX-DR78: Implement the FOUR EXTENSION-ICON STATES plus one transient**, as states of the ACTIVE TAB'S RESOLVABILITY — whether the Cockpit is open is a separate axis the icon does not render. **Resolvable:** active glyph at `{colors.state.ok}`, title `this tab is resolvable` (verbatim). **Not resolvable (DS-1):** inactive glyph at `{colors.text.muted}`, title `This tab declares no pjid.` **Unreadable (DS-21):** the SAME inactive glyph with its own title, `Sidepiece can't read this page.` **Declared, not resolved:** glyph at `{colors.state.unknown}`, title `This tab declares a pjid Sidepiece hasn't resolved.` **The transient:** on a gesture-error reopen failure, the current state's title is replaced with `Sidepiece couldn't open. Click again.` until the next successful open, then restored. The click is a TOGGLE in all four states including the degraded ones, and the icon does NOT render which way it will go. **NO BADGE IN V1:** no count, no Project name, no dot that means "something happened".

#### The thirteen key-screen findings, as requirements-to-decide (UX-DR79–91)

These are logged in `ux-designs/ux-sidepiece-2026-09-20/.decision-log.md`, **recorded rather than resolved** — every one is a design decision rather than an editorial defect, and Finalize is not the place to make new design decisions silently. **None changes an FR or a DS code, so none blocks story generation**, but each must be decided by the implementation story that touches its component. Findings 1–4 bite first, and findings 1 and 2 must be resolved *together*, in the first implementation story that touches the composer, before any composer AC can be written.

**UX-DR79 `[DECISION REQUIRED — key-screen finding 1, bites first]`:** The composer cannot hold its own 188px cap. At rest — context chip collapsed, the standing Dispatched Command default, one line of draft — the specified stack computes to **233px**; with FR-10's URL revealed it is **269px**. It fits 188px in exactly ONE state. The mock drew it overflowing rather than shrunk, per "Don't shrink type to fit". The first implementation story must choose: raise the cap to a measured number, make the context chip's revealed URL a different surface, drop a stacked element, or accept overflow — **and it may not shrink type to absorb it.**

**UX-DR80 `[DECISION REQUIRED — key-screen finding 2, bites first, and is a direct contradiction BETWEEN the two spines]`:** `EXPERIENCE.md`'s IA table says the action bar "grows upward to a cap, then scrolls internally"; `DESIGN.md`'s Rhythm says "One scroll region on screen: the body" and calls a nested scroll region in a 284px column a trap-the-wheel bug. Given finding 1, the composer reaches its cap in ORDINARY use, so **ONE OF THE TWO RULES HAS TO GIVE.** The story must resolve it explicitly — either the composer gets a sanctioned second scroll region with its own wheel-trap mitigation, or the cap goes and the composer pushes the body instead.

**UX-DR81 `[DECISION REQUIRED — key-screen finding 3]`:** The identity header's META ROW has no measurement and is already nearly full. Board chip + health marker + copy control is 183px of 284 on `SIDE` and 212px on `HOLOCENE`; adding the `{components.degradedConnectionIndicator}` that `DESIGN.md` also places there OVERFLOWS it. Related and unresolved: two Bridge readouts — the clip band's `BRIDGE UP · LAN` and FR-14's health marker — sit 40px apart and both state Bridge health. The story must measure the meta row, decide its wrap or reflow behaviour under a long Board identifier plus the relay indicator, and decide whether the clip band keeps a Bridge readout at all.

**UX-DR82 `[DECISION REQUIRED — key-screen finding 4]`:** FIVE marks, N Board states, and **NO MAPPING RULE**. Nothing maps a Board's own state names onto the five `colors.state` values. An ordinary five-state Plane board already collapses two pairs, and `EXPERIENCE.md` anticipates Boards with EIGHT states. The mapping drawn in key screen S3 is the mock's, not the spines'. The story must specify the mapping function — by name match, by Plane state group, by position, or by explicit per-Board config — and what an unmappable state resolves to. **This blocks `{components.ticketRow}` and `{components.ticketGroupHeader}` equally.**

**UX-DR83 `[DECISION REQUIRED — key-screen finding 5]`:** `{components.classificationControl}`'s 244px inner width is derived from a geometry the Version Seam table CONTRADICTS. The seam reserves a `[v2]` attachment slot in the composer's action row; a slot beside the classification control would make it 224px. The verdict survives (`DISPATCHED COMMAND` at 132.5px still fits 224px) but the HEADLINE NUMBER does not. The story must decide whether the attachment seat sits beside the control or below it, and restate the measurement against the answer.

**UX-DR84 `[DECISION REQUIRED — key-screen finding 6]`:** `{components.paneSwitch}` is SPECIFIED TWO WAYS, and `DESIGN.md` contradicts ITSELF between its prose and its own fits table. Additionally, its full-bleed `{colors.border.strong}` seam cannot share an edge with gutter-inset cells. The story must settle one geometry: full-bleed strip vs gutter-inset cells, and recompute the per-cell budget for both the v1 two-up (141.5px, 14 characters) and the `[v2]` three-up (94px per cell → 59px of label → an **EIGHT-CHARACTER** budget, which rules out `ANNOTATIONS` at 11 characters).

**UX-DR85 `[DECISION REQUIRED — key-screen finding 7]`:** On a TERMINAL dispatch, the Dispatched Command card's band WORD and its outcome CHIP collide. The band carries the state mark and state word in `{colors.text.inverse}`; the outcome chip carries the terminal status. The story must decide which one survives on a terminal dispatch, or how the two are laid out so both fit at 284px.

**UX-DR86 `[DECISION REQUIRED — key-screen finding 8]`:** The Dispatched Command card's OUTCOME CHIP puts VARIABLE content in `{typography.micro}`, a role `DESIGN.md`'s own 10.5 Floor Rule reserves for STATIC CHROME ONLY (anything variable sits at `{typography.label}` 11.5px or above). The story must either promote the chip to `{typography.label}` and re-measure, or justify a named exception the way `{typography.numeral}` is justified.

**UX-DR87 `[DECISION REQUIRED — key-screen finding 9]`:** If the grounds are taken literally, `{components.turnComposer}`'s ONLY boundary is a 1.49:1 hairline — which fails `DESIGN.md`'s own audit test ("remove every hairline; if a region becomes ambiguous, that region needs a `strong` rule instead"). The composer is unambiguously such a region. The story must either promote the composer's boundary to `{colors.border.strong}` or add a second cue (a tonal step, a seam) that survives the audit test.

**UX-DR88 `[DECISION REQUIRED — key-screen finding 10]`:** The DISABLED create box cannot carry "the reason" once the pane is SCROLLED. DS-14, DS-17 and DS-22 all require the create box be disabled WITH THE REASON rather than failing on submit, but the reason lives in a pane notice that scrolls out of the pinned action bar's sight. The story must decide where the reason lives when the notice is off screen — a second line in the pinned action bar, a reason on the disabled submit itself, or a pinned banner.

**UX-DR89 `[DECISION REQUIRED — key-screen finding 11]`:** `DESIGN.md`'s `CREATE IN 33GOD` and `EXPERIENCE.md`'s `Create on HOL` NAME DIFFERENT THINGS — one names a Project/workspace, the other a Board identifier — and FR-13's whole point is that the submit proves which Board it will write to. The story must settle the submit label's grammar and its source field, then re-check it against the 22-character budget at 7.36px per character.

**UX-DR90 `[DECISION REQUIRED — key-screen finding 12]`:** The worst-case ticket measure (179px of title, ≈28 serif characters per line) is built on an ELEVEN-CHARACTER key (`HOLOCENE-12`) that THE LIVE REGISTRY MAY NEVER PRODUCE. The story should measure the actual longest key across the nineteen registered Projects before treating 28 ch/line as the floor — the `max-content` grid already returns the difference to the title, so the real worst case may be materially better than the drawn one.

**UX-DR91 `[DECISION REQUIRED — key-screen finding 13]`:** COLD-INSTALL DRIFT means the rendered mock is OPTIMISTIC, not worst-case. Neither bundled face is installed on the build machine, so the key screens render Noto Serif at 0.897× and Cascadia Mono at ~0.997× — every fit in the mock is LOOSER than the shipped one. The story must re-verify the fits against the BUNDLED faces (Charis SIL, IBM Plex Mono) before treating any drawn measurement as proven, and read key screen S3's title column as an optimistic case.

### Prerequisites and Sequencing Constraints

These are not requirements; they are the facts that determine what order the epics can be built in. Step 2 must honour them.

**The implementation sequence is dependency-forced and is the backbone of epic ordering** (architecture.md § Decision Impact Analysis, restated in § Implementation Handoff):

| Step | Work | Notes |
|---|---|---|
| **0** | Monorepo scaffold — pnpm workspace, `tsconfig.base.json`, `biome.json`, `mise` tasks | AR3. Produces no component and no page. **This is Epic 1 Story 1, not WXT init.** |
| **0b** | The pjid emitter + the three-page dev fixture | FR-1 / D14's acceptance set. Costs an afternoon; buildable before any real pjid is emitted anywhere. |
| **1** | **The Bloodbank gateway fix (D4)** — different repo, no Sidepiece dependency | Unblocks FR-9. **Start first precisely because it is off this repo's path.** |
| **2** | `contract/` — the 28-state taxonomy split by producer, ProjectRecord incl. generation, CONTRACT_VERSION, Turn envelope, classification rule + corpus, correlation id | AR5. Everything imports it. |
| **3** | Bridge skeleton + `node:sqlite` store (D1, D5, D7) incl. the Node-version startup assertion | AR23–AR31. |
| **4** | Registry client + snapshot fallback (D2, D9, D10, D11, D14) | "Where SM-3 is won or lost"; the generation mint/compare belongs **here**, not later. |
| **5** | Hermes session manager (D3, D8, D15) | AR43–AR48. |
| **6** | **Extension shell (D16) — WXT init lands HERE** | AR1, AR2, AR7, AR69–AR77. |
| **7** | Chat and Tickets panes (D13, D20, D21) | AR19–AR21, AR57–AR60. |
| **8** | Dispatch outcome ingestion (D19 + D4's landing) | Last, because its upstream is still being fixed while the rest is built. |

**This sequence INVERTS the existing SIDE board's EPIC A**, which put scaffolding and a UI kit first. PRD §10 already directed sequencing the extension behind a working Bridge, and the dependency graph agrees. Note also that step 0 is a *scaffold*, not a UI kit — `packages/ui/` is explicitly refused (one consumer; extracting a package for one consumer is speculative generality).

**FR-15's curl-inspectability is the natural sequencing seam.** "Every capability the extension uses is reachable without the extension" means each Bridge endpoint story ships a curl-exercisable surface and can be accepted with no extension built — so the entire Bridge epic can precede and be validated independently of the extension epic.

#### Cross-repo prerequisite stories (neither is in-repo Sidepiece work)

**CROSS-REPO STORY 1 — blocking FR-9(b); start first, parallel with everything.** `33GOD/bloodbank/services/hermes-gateway/bloodbank_hermes_gateway/adapter.py` — `send()` at **line 684**, with the offending `del` at **line 691**: `del chat_id, content, reply_to, metadata` followed by `return SendResult(success=True, …)`. It discards the agent's response text and reports success. Correlation genuinely works (`correlationid`, `command_id`, `idempotency_key` are all copied onto outcome events); only the content was never carried. **Scope it as a Bloodbank fix that happens to unblock Sidepiece, not as a Sidepiece patch** — every Bloodbank consumer that dispatches to an agent has been silently losing response text. Fallback if it proves hard: investigate having the Bridge observe the dispatched command's output through its own `tui_gateway` session (never verified either way; worth an hour before accepting a status-only v1).

**CROSS-REPO STORY 2 — small, prerequisite, NOT a blocker.** `agents/hermes/pm/role.yaml:53` subscribes to `bloodbank.evt.repo.sidepiece.>` and `:54` to `bloodbank.cmd.agent.sidepiece-pm.>`; `docs/product-brief.md:102` carries `bloodbank.evt.v1.repo.sidepiece.>` (version token *and* slug). All embed an identity slug as a subject token, which the five-token grammar forbids, and **a PM subscribed to an illegal subject receives nothing**. The step-7 correction matters for sizing: this is **not** an FR-8 blocker (FR-8 dispatches through the fleet gateway `bloodbank.cmd.agent.invocation.start` with the target agent in `actor.agent_id`), but it *is* a live defect in the manifest of the very PM FR-7/FR-8 target, and whoever builds FR-7 will spend an hour debugging the wrong thing. **Verify against addendum §B.1 before writing the story — if §B.1 holds, the fix is to DELETE the subscriptions rather than correct them.**

#### Spike / decision stories

**ONE SPIKE STORY, SEQUENCED EARLY, covering two "run it once and stop guessing" checks.** (a) Architecture O3: is DS-3 distinguishable from DS-4 in practice (FR-3(c)'s off-tailnet vs `big-chungus`-down distinction)? A fetch failure from an extension context is an opaque `TypeError`; the candidate discriminator is DNS — MagicDNS failing to resolve at all vs resolving and failing to connect. Ten minutes in a console decides it, and if it works DS-3 and DS-4 light up for free (wording, triggers and recovery already exist in `EXPERIENCE.md`); A-P2 ships **DS-5** as v1's fallback answer, so **DS-3 and DS-4 are not v1 stories pending O3**. (b) PRD §12 Q7: run the LNA check once on `carries-macbook-air` (macOS) before the transport is locked — expect NO prompt, treat a prompt as the surprise.

**A DECISION TICKET, not just a story — the pjid emitter (PRD §12 Q4 / architecture O1).** Nothing currently emits the pjid declaration into served pages. Three costed options are carried: a **pjangler recipe** (most leverage, 19 Projects resolvable in one change, costs a change to another repo), **per-project template changes** (no cross-repo work, 19 hand edits, later Projects inert), or **manual-per-surface** (zero up-front cost, makes DS-1 the permanent default state). The dev fixture (step 0b) makes FR-1…FR-4 testable in dev, but **v1 is inert in production until something emits the tag, and that work has no owner in any document.** This is the project's real sequencing risk and it is Jarad's decision.

#### Two enforcement items that are themselves step-0 stories

1. **The lint rule banning the identifier `project_id` and the string `projectId` outside the Plane adapter** — "five lines and it forecloses the one mistake this project has already made once, in its own specification". It lives in `biome.json`, which means it needs a per-path exception for `tickets/plane.ts`.
2. **The `bb emit --check` gate.** **Contradiction to resolve in the epics:** § Enforcement says "`bb emit --check --type <type>` in CI, or in a pre-publish script, for every Bloodbank producer", while § Deliberately absent says "**No `.github/workflows/`.** There is no CI. One operator, one machine; `mise` tasks are the pipeline." Only the pre-publish / `mise`-task form is actually available, and the Bridge shells out to `bb` by absolute path from the unit (D17). **Write the story as a mise task / pre-publish hook, not a workflow.**

#### Four human-checked enforcement items (belong in a definition-of-done, not scattered)

No linter can see any of these. (1) **Does every mutating route call the generation check before its capability?** — `tsc` cannot see it (the check is a call, not a type), and it is "the cheapest thing on this list to skip and the most expensive to skip." It is the SM-3 guard. (2) A new failure mode has a `DsCode` **and** an `EXPERIENCE.md` row in the same change. (3) A new user-facing string exists in `EXPERIENCE.md` (landing in `copy/states.ts`, `copy/progress.ts` or `copy/icon.ts`). (4) No Glossary term appears under a synonym.

#### Free acceptance fixtures — two degraded states are already true of this repo

Both are testable on day one rather than hypothetical, and both are zero-setup: **FR-5's middle state / DS-12** — `.project.json` declares `sidepiece-pm`, which is not in the Hermes fleet registry. **FR-3's dangling `role_dir` / DS-10** — `.project.json` binds `sidepiece-scrum-master` to `agents/hermes/scrum-master`, which does not exist here. Gating Chat on DS-10 would kill Chat on the repo being built, which is exactly why DS-10 gates nothing.

### Explicitly Out of Scope

Kept visible and clearly separated so nothing here gets built by accident, and so nothing here is re-added as an FR. **Do not generate epics for anything in this section.**

#### From the PRD (§7 non-goals, §4 per-feature exclusions, §8.2 / §9 deferred)

- **§7 NON-GOAL — Not a Plane client.** Tickets are read and appended; everything richer belongs to `px` and the PM.
- **§7 NON-GOAL — Not an agent runtime.** Sidepiece talks to Hermes agents; it does not host, schedule, or supervise them.
- **§7 NON-GOAL — Not a deployment tool.** It reports that an Agent is missing; it does not provision one in v1.
- **§7 NON-GOAL — Not multi-user, and not portable.** No tenancy, no accounts, no install story for a second person. Multi-DEVICE for one operator IS in scope (§2.2); multi-operator is not, and multi-device does not reopen this.
- **§7 NON-GOAL — Not a URL matcher.** No hostname heuristic, no Traefik route import, no fuzzy matching. A page that does not declare a pjid is not a Project, full stop. Hard requirement with no fallback (§12 Q4).
- **§7 NON-GOAL — Not publicly reachable.** The Bridge lives on the tailnet and is never exposed through Traefik, the Cloudflare tunnel, or any public hostname. (Rejected alternative: fronting the Bridge at a `delo.sh` name — addendum §A.5.)
- **§7 NON-GOAL — Not a replacement for the terminal.** It closes the gap between noticing and acting, not between thinking and building.
- **§4.1 OUT OF SCOPE** — Writing to the Registry; creating, editing, or removing Projects; cloning a missing repo. Sidepiece reads the Registry and never writes it.
- **§4.2 OUT OF SCOPE** — Chatting with any Agent other than the Project's PM (the Scrum Master role may be declared but is not a chat target); multi-turn tool approval flows; attaching files; sending page BODY content or screenshots.
- **§4.3 OUT OF SCOPE FOR v1** — Editing an existing Ticket; moving a Ticket between states; assigning, labelling, commenting, or deleting. These belong to the PM and to `px`.
- **§8.2 / §9 DEFERRED — Element picker and selector payloads.** Hover-to-select a DOM element, sending a stable CSS selector PLUS context (tag, text snippet, `outerHTML`, page URL). This is the PRIMARY annotation mechanism and leads; snapshot is its fallback, not the reverse. Payload shape is architecture O2 / `EXPERIENCE.md` Gaps 4 and 7, both open, both Jarad's call. Known failure modes: hashed CSS-in-JS class names, `nth-child` brittleness under re-render, shadow DOM.
- **§8.2 / §9 DEFERRED — Snapshot capture and annotation**, as the FALLBACK for cases a selector cannot express. Note addendum §C: `bmad-ux` closed this on 2026-09-20 — the annotation image is not load-bearing, strokes render as SVG over the live DOM and the payload is stroke geometry plus crossed-element selectors, which deletes `captureVisibleTab`, its 2-calls-per-second rate limit, the HiDPI physical-pixel problem and the `activeTab` permission from this feature entirely.
- **§9 DEFERRED — Attachment to Tickets, not only Turns.** FR-13 gains an attachment surface when the annotation features land; the ticket destination is deferred WITH them, not dropped.
- **§8.2 / §9 DEFERRED — Candystore live event feed:** Project-scoped Bloodbank events TAILING LIVE (not a static recent-events list — the distinction is a product difference, not a wording one). Implemented as a `data.repo` payload filter against Candystore, NEVER a subject subscription (§6). This is why old EPIC E is "defer and rewrite" rather than "defer".
- **§8.2 / §9 DEFERRED — Agent-session list:** sessions across claude/codex/kimi in reverse-chronological order with live running status, answering "is something already working on this repo right now?" *[PRD carries an explicit PM note: this is the only pane that prevents an actual collision — if parallel-agent work increases before v1 ships, PROMOTE it.]*
- **§8.2 / §9 DEFERRED — Tray settings page and recent-Projects list** on the extension-icon surface, in reverse-chronological order.
- **§8.2 / §9 DEFERRED — One-click Agent provisioning** (non-interactive `pj hermes-agent` from FR-5's no-Agent state). v1 STATES the command; it does not run it.
- **§8.2 DEFERRED — Desktop shell (Tauri)**, old EPIC K4. *[PRD note: EPIC K deferred this in June and nothing since has argued for it — if it is still deferred at the next retrospective, DELETE it rather than carrying it.]*
- **§10 / EPIC K DEFERRED — K3 packaging stays deferred.** Note the inverse: **K5 "Remote access (optional)" is NOT deferred** — it is the tailnet transport and it is v1 (FR-15).
- **OUT OF THIS PRD'S SCOPE BUT ON THE CRITICAL PATH** — whatever emits the pjid declaration into served pages (§12 Q4 / architecture O1). Explicitly scoped out of the product document while being called "sequencing risk on the critical path" that gates every §11 success metric. Listed here so it is not re-added as an FR, but it still needs an owner and a decision (see Prerequisites).
- **OUT OF THIS PRD'S SCOPE, ANOTHER REPO** — fixing `BloodbankAdapter.send()` in `33GOD/bloodbank` so outcome events carry result content, and fixing `agents/hermes/pm/role.yaml`'s illegal five-token subjects. Both are prerequisites rather than Sidepiece features, and **neither should be folded into an FR-8 or FR-9 story as if it were in-repo work.**
- **DELIBERATELY OMITTED PRD SECTIONS, PER §0** — stakeholders and approvals, risk register, ROI, rollout and change management, data governance, audit trail, compliance, monetization, hardware constraints, versioning and deprecation policy, public API surface. Their absence is a recorded decision for a single-operator personal tool, not an oversight; **do not generate epics to fill them.**

#### From the architecture (things it explicitly refuses, with reasons, so nobody adds them by reflex)

- **No CI.** `.github/workflows/` is deliberately absent — one operator, one machine, `mise` tasks are the pipeline. "Adding CI would be adding a system to maintain, not a safety net someone is waiting on."
- **No container.** No `docker-compose.yml`. The Bridge is a `systemd --user` unit on a box that already exists; a container would add a network hop between the Bridge and the filesystem it is specifically there to touch.
- **No `e2e/` directory.** Deferred honestly rather than scaffolded and left empty — MV3 end-to-end harnesses are their own project, and PRD §11's metrics are behavioural rather than automated.
- **No `packages/ui/` shared UI kit.** EPIC A proposed one; there is exactly one consumer, and extracting a package for one consumer is speculative generality. shadcn components are added one at a time as a real need appears.
- **No offscreen document.** Addendum §C offers one as a place a stream could live "if they must outlive panel visibility." They must not: FR-9 already specifies that outcomes arriving while the panel is closed are reconciled on next open. Rejected, not overlooked.
- **No `registry/cache.ts` on the Bridge.** FR-2's cache is the extension's (D10); the Bridge's durable copy of the registry is the D2 snapshot and is a different thing with a different job.
- **No app-level authentication, no rate limiting, no API versioning.** Not applicable by decision, not by omission — PRD §5 makes the tailnet the trust boundary; one operator, no tenancy, no public surface. The only security-shaped decision left is credential handling (FR-16/D18).
- **No router and no global state store in the panel.** The Cockpit is one Project and a pane switch, not a navigable surface; the panel dies on collapse, so there is nothing long-lived to manage. React state local to the panel document.
- **No settings page and no first-run/onboarding surface.** PRD §9 defers the settings page; `EXPERIENCE.md` states "no onboarding screen, no welcome tab and no first-run Cockpit state." This is why the Bridge origin is a build-time constant.
- **The extension is never published to the Chrome Web Store** — loaded unpacked only. PRD §7's "not publicly reachable" is a deployment property, not just a policy.
- **`activeTab`, `chrome.debugger` and `webNavigation` permissions are not declared.** `activeTab` was deleted outright by the UX decision log on 2026-09-20 when the annotation image stopped being load-bearing; `chrome.debugger` was rejected in the same pass with no fallback built; `webNavigation` is unnecessary because the content script observes its own history transitions.
- **`captureVisibleTab`, full-page capture and HiDPI coordinate handling are all moot.** Nothing is captured.
- **The two `[v2]` keyboard commands (`arm-picker`, `discharge-batch`) are NOT declared in v1's manifest**, even though `EXPERIENCE.md` spends all four of Chrome's suggested-shortcut slots. A declared-but-dead shortcut occupies a slot Chrome will not give back.
- **Per-tab `chrome.sidePanel.setOptions({tabId})` overrides are rejected** in favour of one global panel document — they load a distinct document per tab and are prone to override drift.
- **A second ticket provider is not built.** D21 is deliberately the thinnest indirection — one field read and one branch, no provider interface, no registry.
- **An LLM pre-pass for FR-6 classification is not v1.** The verb allowlist is the decision. If it proves too blunt in daily use, the escalation is an LLM pre-pass **on send only**, never on a typing pause — the pre-commit display stays local.
- **DS-3 and DS-4 are not v1 stories pending O3.** v1 ships DS-5 (indistinguishable). Writing stories for them now presumes an experiment nobody has run.
- **The `[v2]` annotation payload shape is explicitly unlocked and unbuilt (O2).** `contract/src/annotation.ts` is a reserved empty seat; its tree comment was deliberately changed from "shape locked, unbuilt" to "shape follows `EXPERIENCE.md` Gaps 4 and 7, unbuilt" — a locked shape that two open questions can still move is worse than an unlocked one. **Do not write a story that specifies the payload.**
- **Everything in PRD §9 is deferred.** Note specifically that the `[v2]` annotation batch's persistence was already decided by `EXPERIENCE.md` (`chrome.storage.local`, keyed by pjid and page URL, discharge the only network crossing), so it does **not** become a Bridge storage decision later.
- **Reading `.project.json` off the filesystem as the registry fallback was considered and rejected** on drift grounds — it would reimplement pjangler's own indexing including `normalizeProjectId` and the `project_id`/`project_slug` aliasing, and two implementations of one index diverge into a wrong Project.
- **Multi-window synchronisation is not attempted in v1.** Each Cockpit document is independently correct for its own window; they now share one per-pjid resolution cache but nothing synchronises what is on screen.

#### From the UX spines (the `[v2]` version seam — what v1 reserves vs what v1 builds)

- **`[v2]` The ANNOTATIONS PANE and its running list.** v1 builds the pane switch as an n-item control laid out so a third item fits without wrapping — and nothing else. The slot's label is v2's to name but MUST be ≤ 8 characters (94px per cell minus 20px padding, 11px mark and 4px hair leaves 59px ÷ 7.36px), which rules out `ANNOTATIONS` (11) and permits `NOTES` or `MARKS` (5). The reserved cell renders as an empty RULED cell, never as a gap.
- **`[v2]` ATTACHMENT ON A TURN.** v1 builds `{components.turnComposer}`'s action row AS A ROW with the leading slot EMPTY. No attachment affordance, no payload, and explicitly **NOT a greyed-out button** — a disabled control wearing a promise is the thing the seam rule exists to forbid.
- **`[v2]` ATTACHMENT ON A TICKET and BATCH CREATE.** v1 builds `{components.ticketCreateBox}`'s submit row as three cells across 264px with both empty slots rendering as RULED SPACE. v1 builds neither the attachment affordance nor the secondary batch-create control.
- **`[v2]` BATCH DISCHARGE TO THE PM.** It reuses the Dispatched Command path v1 already builds for UJ-2 — dispatch, subject validation, acknowledgement, correlation. v1 builds that whole path and NOT the batch payload shape.
- **`[v2]` THE ENTIRE IN-PAGE LAYER** — hover outline, resolved-selector tooltip, comment bubble, freehand markup, annotation pins, the edge-docked occlusion stub, the achromatic ΔE76 fallback, the tri-tone keyline on page-drawn strokes, and the print suppression. **v1 builds the CONTENT SCRIPT (for FR-1 detection), its SPA re-detection observer and its message channel to the service worker, and renders NOTHING in the page at all.**
- **`[v2]` PAGE-CLICK-SUMMONS-THE-COCKPIT.** v1 builds the service worker's `onMessage` handler CALLBACK-STYLE WITH ZERO AWAITS from day one — that is a v1 requirement because a promise chain silently loses the curried gesture — but builds no in-page control that sends the message.
- **`[v2]` ONE-CLICK AGENT PROVISIONING.** v1 builds `{components.commandString}`'s control row containing ONLY the copy control, with one EMPTY action slot beside it (the DS-11 and DS-14 seats). v1 STATES the command and does not run it. **No control that runs a command ships in v1.**
- **`[v2]` `{components.iconBadge}` — and note it is explicitly NOT a reserved seat.** It is new surface area in v2, reserved by NOTHING in v1. What v1 owes v2 is a scoped prohibition ("no badge" is a v1 RULE, not a principle).
- **`[v2]` THE TWO RESERVED KEYBOARD CHORDS.** `Alt+Shift+A` (`arm-picker`) and `Alt+Shift+D` (`discharge-batch`) are ALLOCATED so v2 inherits a plan, and MUST NOT be declared in v1's manifest.
- **`[v2]` THE FOUR `[v2]` COCKPIT COMPONENTS** themselves: `{components.annotationRow}`, `{components.dischargeControl}`, `{components.attachmentChip}`, `{components.iconBadge}` — specified so v1's IA reserves their seats, built by nobody in v1.
- **NOT A RESERVED SEAT, AND DELIBERATELY UNRESOLVED: the FOURTH pane-switch slot.** v1's switch is laid out so a THIRD item fits and makes no claim about a fourth. Two §9 panes (the Candystore live event feed and the Agent-session list) both want it. Recorded as unresolved v2 contention rather than silently double-booked.
- **§9's RECENT-PROJECTS LIST has no home in v1 and must not acquire one.** The action is declared with NO `default_popup`, because a popup displaces `setPanelBehavior({openPanelOnActionClick:true})` and costs the one-click open. v2 must find another home — a switch slot or a context-menu item — not a popup.
- **EDITING A TICKET.** Out of scope for v1 entirely; the ticket row's key opens Plane in a new tab, which is the one moment the product deliberately hands the operator off.
- **CLONING A REPO.** DS-9 renders the missing clone path, marked and copyable, and Sidepiece never clones it.
- **A MANUAL THEME OVERRIDE CONTROL.** The OS signal drives both grounds and no control ships in v1. The known imprecision (`prefers-color-scheme` reports the OS and never Chrome's theme, so a light-OS/dark-Chrome session gets Day paper) is ACCEPTED; if the night ground proves too bright the fix is a darker paper in `DESIGN.md`, not a control in the Cockpit.
- **A PRINT-WITH-MARKS MODE, in v1 or v2.** Making `[v2]` marks printable requires the layer positioned in document coordinates rather than fixed to the viewport — a different component with a different drift story. Not a stylesheet tweak.
- **A FULL INVERSION DARK MODE.** Priced and rejected as a second design system, not a token swap: seven tokens on `#191713` collapse to ~1.02:1 on an inverted panel and "stamped = inverted" has no inverse left. Night Paper (15 values, 13 declarations) is what ships.
- **A `colors.surface.desk` TOKEN plus a 6px sheet inset**, so the offset shadow and four crop marks would have somewhere to land on the Cockpit. Proposed by both audits and REJECTED — it spends 12px of a 320px panel (3.8%) to render a shadow onto a fake table inside the viewport. The docked Cockpit carries the spine and TWO INBOARD ticks only.
- **ONBOARDING.** No welcome tab, no first-run Cockpit state, no coach mark nudging the operator to pin the icon, no in-product rendering before or after Chrome's own host-permission prompt.
- **ACCESSIBILITY WORK WITH NO READER**, named so nobody re-adds it: a full WCAG 2.2 AA conformance pass and audit; screen-reader QA across NVDA / JAWS / VoiceOver; localization and RTL; forced-colors / high-contrast-mode theming; touch targets at a 44px floor. The revisit trigger is stated once: if the "not portable" non-goal is reopened, all of it comes back.
- **DENSITY SURFACES THE CONTRACT EXPLICITLY REFUSES:** a per-dependency health dashboard (one marker, four states, the dependency named only inside the notice of the pane it gates); a Ticket-pane workspace (groups collapse to header plus count); a chat archive (recent Turns render, older load on demand); a context CARD (one line: the page title, URL on focus/hover); any unread marker, inbound count, notification, toast, or badge that grows while you are away; a sync indicator across two windows; a confirmation screen or "view Ticket" after a create; **any control inside the Cockpit that claims to close it.**

### Notes Carried Forward to Epic Design

Resolved conflicts and standing facts step 2 must not re-open:

1. **Document authority on conflict:** the PRD owns *what and why* (§3 Glossary binds vocabulary everywhere), `EXPERIENCE.md` owns *how it behaves*, `DESIGN.md` owns *how it looks*, `architecture.md` owns *how it is built* — each defers in the others' domains. The mock is evidence, never specification.
2. **Two deliberate divergences from the PRD have ALREADY been carried back into it** (both amended 2026-09-22), so **do not write stories to "fix" them back.** **D11** reinterprets FR-2's literal "each resolution is stamped with a monotonically increasing generation" as **content-addressed** — most resolutions do not advance it; under the original literal wording a second window merely re-resolving would advance the number and refuse the first window's perfectly valid mutation, so the NFR-9 guard would fire constantly on the safe case and never on the dangerous one. **D10** puts FR-2's cache in `chrome.storage.local`, retiring PRD §5's "independent caches". PRD §6's Registry row was also amended from Total to **partial**, and PRD §8's FR-3 line from six states to twenty-eight.
3. **PRD §5's "not persisted client-side" vs the UX's use of `chrome.storage.local`** was resolved by architecture D6, whose test is "if losing it would make the product WRONG it is the Bridge's; if only ANNOYING it may be the client's", with the MUST that nothing there may be the only source of a rendered fact and anything rendered from it carries its age.
4. **The 340px-vs-320px four-document disagreement was RULED at 320px.** `DESIGN.md` was the outlier and has been recomputed end to end at a 284px column.
5. **`EXPERIENCE.md` and `DESIGN.md` both read `status: final`** (S3 resolved 2026-09-22, `bmad-ux` Finalize ran, seven key screens promoted at the ruled 320px). The architecture's `[NOTE FOR PM: both spines still carry status: draft]` is **stale** as of that run.
6. **FR-7's 500ms accept budget is an architectural split, not a performance target, and the obvious implementation misses it by 14x.** D15 makes `POST …/turn` a pure store write returning `{turnId, kind, acceptedAt}` synchronously (measured 79ms against the live gateway). Any story that implements turn submission as "acquire session then respond" fails FR-7 on the cold-start transition D3 exists to make survivable (7.1–17.1s). Also note FR-7(c): an AC that measures "first frame received" instead of "first content token" measures an animation and passes falsely. **Any AC inherited from an earlier draft carrying a ≤2s first-token budget is wrong.**
7. **SM-3 has no mechanism without FR-4.** PRD §11 states it outright — FR-4 displaying the resolved identity is what makes SM-3 observable, and NFR-9's generation check is what enforces it. **FR-4 is therefore not cosmetic and must not be sequenced as polish behind the panes it validates.**
8. **FR-12's no-Board check is a literal bug waiting to be written.** The board field is an EMPTY STRING, never null and never absent. This belongs in the story's acceptance criteria **verbatim**, not as a code comment.
9. **`node:sqlite` is a Release Candidate, which converts a version pin into two acceptance criteria** (AR24, AR25). The exposure is live — `mise` resolves `node/lts` to v24.15.0 today and will move when Node 26 becomes LTS on **2026-10-28**.
10. **PRD §10 maps every FR onto the existing 44-ticket SIDE board, and five FRs have no lineage at all** — **FR-1, FR-2, FR-3, FR-4 and FR-14 are new work regardless of what happens to the old epics.** Verdicts to honour: **A** Foundation survives but must be sequenced BEHIND a working Bridge; **B** Project Resolution is a rewrite (B3's `GET /resolve?url=` resolves the wrong input entirely — the input is a pjid, not a URL; B2's holocene fleet client is superseded by the pjangler Registry); **C** survives narrowed to FR-12/FR-13 plus the no-Board state; **D** amends to carry FR-6…FR-10; **E** defers and rewrites (§9, invalid subject-subscription premise); **F** splits (status → FR-5 v1, deploy → §9); **G** survives amended for NFR-5 and NFR-4; **H** survives amended for FR-6 visibility and FR-9 result rendering; **I** survives; **J** defers and reorders (element picker leads, snapshot becomes fallback); **K** splits and PROMOTES — K1/K2 → FR-15/FR-16 in v1, and K5 "Remote access (optional)" is no longer optional or deferred, it IS the tailnet transport and it is v1.
11. **SCOPE COUNTER-METRIC, worth honouring in epic design:** SM-C2 — *"Feature count — this died once already at 44 tickets and zero code. Shipping §8 and stopping beats shipping §9 late."* **A backlog that reintroduces §9 items as "while we're in here" stories is the documented failure mode of this exact project.**
12. **The `[v2]` in-page set is FOUR components, not seven or eight.** `DESIGN.md`'s preamble says "the seven `[v2]` components render into arbitrary third-party pages through a closed shadow root" but EIGHT are listed under that heading and three are explicitly NOT in-page (`annotationRow` is "inside the Cockpit, so it is ordinary paper", `dischargeControl` is the Cockpit's action bar, `attachmentChip` is a Cockpit chip), while `iconBadge` is drawn by Chrome on its own toolbar. **The genuine in-page set carrying UX-DR28's shadow-root / tri-tone / achromatic-fallback / print / occlusion requirements is four: `hoverOutline`, `commentBubble`, `freehandLayer`, `annotationPin`. Epic design must not size a story from the number seven.**
13. **`{components.commandString}` is the one v1 component whose fit at 284px was never rendered**, because drawing it would have meant fabricating a Bridge response. Only derived: inside a notice the well is 248px → 35 mono characters per line before `word-break: break-all`. **Whichever story builds DS-11/DS-14 should measure a real Bridge-returned command.**
14. **Two numbers are unset and belong in implementation stories, not in a spine:** (a) the **relayed deadline's MULTIPLE** — the rule that a relay changes what expiry SAYS but never whether one exists is confirmed, but the number is set nowhere, and it must be generous relative to the direct budget or the timeout fires on every relayed read and teaches the operator to ignore it; (b) the **SSE-subscription budget** — ≤2s by analogy to the dispatch acknowledgement, for lack of a better anchor; architecture types the state (`SubscriptionState`) and sets no number.
15. **Three things are unanswerable today and were designed around rather than resolved:** (a) whether `chrome.sidePanel.onClosed` fires early enough to be trusted as a flush point — two independent sweeps found no documentation, so the belt-and-braces design (debounce continuously during typing, treat `onClosed` as a notification) IS the answer; (b) whether Chrome reopens the side panel after a restart and whether it restores a resized width — assume closed and a full cold start; (c) whether the Chromium reopen-gesture bug (415694848) reproduces on Chrome 151–155 — the handling is settled and typed (`IconTransient`), only the reproduction is unverified, so **the extension-shell story should carry a verification step.**
16. **VOCABULARY IS ENFORCEABLE IN STORIES.** PRD §3's glossary is VERBATIM and an abbreviation counts as a synonym. `DISPATCHED COMMAND` sets complete with 46% of its row empty at the ruled width, and still fits down to a 208.5px panel — there is no width Chrome will draw at which it breaks. *"If a future change cannot fit a required literal here, the change is wrong, not the literal."*
17. **shadcn primitives are adopted ONE AT A TIME** as a component needs one, never via a bulk `add`. The value taken is Radix's focus management, dismissal and aria wiring — which is exactly what UX-DR61–64 ask for.
18. **`{components.annotationPin}` and `{components.iconBadge}` are the only two consumers of `{rounded.pill}` in the whole system, and both are outside the Cockpit.** Any pill inside the Cockpit is a defect.
19. **`DESIGN.md` contradicts itself on the One Black Rule's count, and the number matters to a build check.** Its prose says seven tokens carry `#191713` and enumerates seven; its own frontmatter sets **nine** to that value, adding `{colors.text.onSpot}` and `{colors.selection.ink}`. The frontmatter is the token data and wins (UX-DR2). This is a fourteenth finding of the same class as the thirteen in the UX decision log — it does not change an FR or a DS code, but any story that writes the de-duplication guard must write it against nine, not seven.

### FR Coverage Map

All sixteen FRs, each mapped to exactly one epic. Nothing is placed twice.

- **FR-1: Epic 2** — detect the declared `pjid` on the active tab, on load, on SPA route change and on tab switch, readable without executing page JS.
- **FR-2: Epic 1** — resolve a `pjid` to a full Project Record through the Bridge, content-addressed generation and all.
- **FR-3: Epic 2** — every unresolved and degraded state rendered separately and worded separately, never as an empty or loading panel.
- **FR-4: Epic 2** — the resolved identity visible in the Cockpit: repo name, selectable clone path, Board identifier.
- **FR-5: Epic 3** — Agent presence, with *declared* distinguished from *present* distinguished from *reachable*, and Tickets never gated on any of it.
- **FR-6: Epic 3** — every Turn classified as Streamed Exchange or Dispatched Command before send, visibly, with one control to flip it.
- **FR-7: Epic 3** — conversational Turns accepted inside 500ms and answered inline and incrementally.
- **FR-8: Epic 3** — work Turns published to Bloodbank as commands and acknowledged with a correlation identifier.
- **FR-9: Epic 4** — a Dispatched Command carried through to a terminal status and to its result content.
- **FR-10: Epic 3** — the active tab's URL and title attached to every Turn, visible before send, surviving classification.
- **FR-11: Epic 3** — chat history scoped to the Project, appended per Turn, surviving the panel closing and a Chrome restart.
- **FR-12: Epic 2** — the resolved Board's Tickets listed grouped by the Board's own state order.
- **FR-13: Epic 2** — a Ticket created on the resolved Board from the Cockpit, title alone, never choosing the Board.
- **FR-14: Epic 1** — Bridge health observable per dependency, including whether the PM's provider credentials actually resolved.
- **FR-15: Epic 1** — the Bridge as a supervised, tailnet-bound, `curl`-inspectable daemon that holds Turn state.
- **FR-16: Epic 1** — every credential resolved from the 1Password vault, never from disk, a failure surfacing through FR-14 by name.

**Two FRs are mapped whole but render partly in a later epic.** They are flagged here rather than double-mapped, because a map that lists an FR twice is not a map:

- **FR-2 → Epic 1.** Obligations (a), (b), (d) and (e) — Registry resolution, the declared-but-unknown state, the content-addressed generation, ≤1s p95 over the tailnet — are entirely Bridge-side and curl-testable, and they are what gives Epic 1 its value. But **(c), the bounded per-pjid cache, is extension code**: D10 put it in `chrome.storage.local` under `fr2:<pjid>` with a 5-minute TTL and four invalidation triggers, and it is meaningless until a client exists. It is implemented in Epic 2's `lib/cache.ts` as a named **inherited** acceptance criterion of FR-2, not as a new FR.
- **FR-14 → Epic 1.** Obligations (c), (d) and (e) — the per-dependency health endpoint, "the registry service isn't running" versus "the Registry returned an error", and the silent-credential-degradation probe — are the Bridge's, and are the harder and more valuable half. But **(a) and (b) are phrased as "the Cockpit distinguishes…"**, and that marker renders in Epic 2's `{components.identityHeader}` — again an inherited AC, not a second mapping.

The same born-here / rendered-there pattern governs eleven DS codes. It is stated as an explicit rule rather than left implicit; see *How the 28-State Taxonomy Is Distributed*.

**NFRs are not mapped one-to-one** — the step file's coverage map is FR-scoped — but the shaping ones bind concretely. NFR-1, NFR-7, NFR-8 and NFR-10 land in Epic 1. NFR-2 lands in Epic 2's router. NFR-3 lands in Epic 2's lifecycle rules and again at Epic 3's streaming boundary. NFR-4, NFR-5 and NFR-6 land in Epic 2. NFR-9 splits deliberately: the content-addressed mint and the Bridge's refusal in Epic 1, the client-side pre-check in Epic 2.

**Three things that are not FRs are placed anyway, so they do not fall through the floor.** The single **spike story** (architecture O3 plus PRD §12 Q7) sits at the *end* of Epic 1, after the transport is up — O3's DNS discriminator needs something real to fail to reach and the LNA check needs HTTPS already serving — because its DS-3/DS-4 verdict must reach Epic 2 before Epic 2 writes those states. The **pjid-emitter decision ticket** sits in Epic 2, the epic whose value it gates. And the **thirteen key-screen findings** are distributed to the epic that owns each component: Epic 2 takes 3, 4, 6, 10, 11, 12 and 13; Epic 3 takes 1, 2, 5 and 9; Epic 4 takes 7 and 8. None of them changes an FR or a DS code, so none blocks story generation, but each is owned.

**Nothing from the out-of-scope section generated an epic.** No §7 non-goal, no §9 deferral, no `[v2]` component. The `[v2]` in-page set is **four** components (`hoverOutline`, `commentBubble`, `freehandLayer`, `annotationPin`), not the seven the preamble says or the eight listed under it, and no epic is sized against either wrong number. The `[v2]` seats the spines require — the empty leading slot in the composer's action row, the ruled third cell in the pane switch, the empty action slot beside `commandString`'s copy control — are built as **empty ruled seats** inside their v1 epics, which is what the version seam demands and is not v2 work.

## Epic List

**Four epics.** Three of them are a journey from PRD §2.3 completing end to end; the first is the resolution leg all three stand on, and it is the one place this list knowingly trades a visible exit for a dependency-forced one. The ordering inverts the June SIDE board exactly as PRD §10 and the dependency graph both demand — **Epic 1 Story 1 is the monorepo scaffold, and `wxt init` does not appear until Epic 2.**

### Epic 1: Resolve any Project from the tailnet, and say honestly what is wrong with it

Jarad can ask `big-chungus` — from the laptop or from the host, with `curl`, with no extension installed and no Chrome running — which Project a given `pjid` belongs to, and get back repo name, clone path, Board binding, Agent bindings and a content-addressed generation. And he can ask what is wrong with it: a health answer that names **which** dependency failed rather than failing generically, including the silent-credential-degradation case that nothing else on this machine notices. Before this epic a `pjid` is a string that means nothing; after it the page-to-project link physically exists, is supervised, survives a reboot, and is exercisable without a browser. `sp-resolve holocene | jq .clonePath` is a shell function he can write the day it lands.

**FRs covered:** FR-2, FR-14, FR-15, FR-16

**Standalone.** Every acceptance criterion is a transcript: `GET /v1/health` names the failing dependency, `GET /v1/project/:pjid` returns the record with `degraded[]` populated, a stale `POST` is refused `409 stale_generation`. FR-15(d) makes that surface a hard product requirement rather than scaffolding — *"a bridge that can only be exercised through Chrome makes every bug a two-variable bug."* Nothing in Epics 2–4 is required for any of it to be true or useful, and this epic imports nothing from them: the extension does not exist yet. It is also the only epic whose outcome is fully certain — D1–D21 settled, the Registry measured at 2.4ms p50, nineteen Projects in one 33KB payload — which is why it is one large epic rather than three.

**Sequence.** Steps 0, 2 (the resolution half of `contract/`), 3, 4, deploy, then the spike. `contract/` carries `state.ts`, `project.ts` and `CONTRACT_VERSION` here; `turn.ts` and `classify.ts` are added by the epics that need them — different files, so no churn. It carries the two step-0 enforcement stories: the Biome rule banning the identifier `project_id` and the string `projectId` outside `tickets/plane.ts` (five lines, and it forecloses the one mistake this project already made in its own specification), and the `bb emit --check` gate **written as a mise task / pre-publish hook, never a GitHub workflow** — the *Enforcement* / *Deliberately absent* contradiction resolves in favour of `mise` because there is no CI on this machine. The Node 24 pin is **two** acceptance criteria, not one (AR24's absolute path in `ExecStart=`, AR25's `>=24.15.0 <25` startup assertion), and the exposure is dated: `mise` moves when Node 26 becomes LTS on **2026-10-28**. All four SQLite tables land in one migration because `turns/store.ts` is the only module permitted to open the database (AR31); `resolutions` is exercised here and the other three are filled by Epics 2–4, which is append-per-table rather than a rewrite. The generation mint and compare belong **here**, at step 4 — *"where SM-3 is won or lost"* — and it is content-addressed per D11, so re-resolving an unchanged record is not an event. The Bridge **degrades rather than exiting non-zero** on a failed credential, because exiting makes the operator see DS-4 when the truth is DS-8. NFR-1, NFR-7, NFR-8 and NFR-10 land here; NFR-9's mint half lands here and its client-side pre-check in Epic 2.

**The rename test, recorded, because this is the epic most open to the charge.** Could it be called *"API Development"* without losing meaning? No, in both directions. That name would have to include the turn routes, the ticket routes and the SSE surface, none of which this epic builds — and it would exclude the systemd unit, the tailnet transport, the vault path, the last-good snapshot and the content-addressed generation, which are most of the work and the only reason the answer is trustworthy. The epic is scoped by one question — *which Project is this, and can I trust the answer* — so a name describing the kind of code loses it. The same test shows where the scope would have been wrong: an epic called *"the Bridge"* **would** have renamed losslessly, which is exactly why the Board read, the turn POST and the SSE stream are not in it. **This is still the weakest title in the list and the call most worth overruling — see *Structural Calls Recorded*.**

### Epic 2: Open the Cockpit on any page and file a ticket against the thing you are staring at

UJ-1, end to end, on a real page against a real Board. Jarad pins the icon, hits the chord on `holocene.delo.sh`, and the Cockpit opens already showing Holocene's repo name, its clone path — selectable, copyable, wrapping, never elided — and its Board; the Board's Tickets are grouped in the Board's own state order, each key opening its Plane URL in a new tab; he types a title and it lands. No identifier looked up, no terminal, no tab switch. And when anything is broken the panel says **which** thing and what to do about it, in that state's own sentence, with a re-resolve control — never a spinner, never an empty panel, never the last Project left on screen because the last Project was more interesting. After this epic the product's own headline metric, SM-1 — *"I file tickets from the panel instead of the terminal"* — becomes measurable for the first time.

**FRs covered:** FR-1, FR-3, FR-4, FR-12, FR-13

**Standalone.** It calls only endpoints Epic 1 shipped, plus the Plane adapter it builds itself, and needs nothing from Epic 3 or Epic 4. The obvious objection — *a pane switch with one destination switches nothing* — is answered by the design rather than by a split: `{components.paneSwitch}` is specified as an **n-item control** laid out so another cell fits without wrapping (UX-DR14), and v1's switch renders one live cell beside the reserved `[v2]` **ruled** cell, never a gap. Read and create are one capability with one failure domain and one set of files — `tickets/index.ts`, `tickets/plane.ts`, the contract's ticket types and the three components that render them — so splitting *list* from *create* is precisely the churn rule 4 names. Create does not wait on the read: D20 has the Bridge resolve the omitted entry state server-side, which licenses the create box to be live before the list lands, and holding the submit until the Board arrives costs UJ-1 its entire margin. There is no Chat pane here and, crucially, no **empty** one — UX-DR48 Rule 1 says an empty state is a result and only a successful read may render one. Note 7 is honoured *inside* the epic rather than by splitting it: FR-4 is sequenced ahead of the panes it validates, because SM-3 has no mechanism without FR-4 and FR-4 must not be polish behind them.

**Sequence.** Step 0b, then step 6, then the Tickets half of step 7. **Story 1 is the `pjid` emitter contract (D14/AR70) plus the three-page dev fixture.** It costs an afternoon; Epic 1 resolves `pjid`s that already exist in the Registry and never needs it, but nothing in *this* epic is runnable without it. **Story 2 is the cold-install font re-verification (UX-DR91).** Neither bundled face is installed on the build machine, so every fit drawn in the seven key screens is looser than the shipped one, and no drawn number — the meta row's 212px of 284, the pane-switch cell budget, 28 characters per ticket title line — is trusted until it is re-measured against Charis SIL and IBM Plex Mono. **`pnpm dlx wxt@latest init` comes third, at step 6, not first**: scaffolding it four steps earlier buys a loadable stub and a month of drift, which is the ordering the June board used and PRD §10 directed against. `srcDir: 'src'` is one line and without it nothing under `src/entrypoints/` is discovered at all (AR7). The full D16 manifest surface lands here — broad host match, no `default_popup` (a popup displaces `setPanelBehavior({openPanelOnActionClick:true})` and costs the one-click open), exactly two commands declared **and both handlers built here**, because a slot Chrome gives away is a slot it does not give back and a declared-dead command is the thing note 15's rule forbids. The gesture path is callbacks only, zero awaits, exactly one hop — an await anywhere is a silent no-op presenting as an intermittent heisenbug (AR73) — and the story carries a verification step for Chromium bug 415694848 against Chrome 151–155. SPA re-detection is a `MutationObserver` on `<head>`, not `webNavigation` and not `popstate`. `lib/bridge.ts` is the only module that makes a request; `lib/cache.ts` implements FR-2(c) as an inherited AC; `tokens.css` is the single definition of all 54 tokens with `@theme` aliasing and never restates a value; the de-duplication guard on the One Black Rule is written against **nine** tokens, not seven, because the frontmatter is the token data and wins (UX-DR2, note 19). NFR-2, NFR-3, NFR-4, NFR-5 and NFR-6 land here, with UX-DR61–69's accessibility floor and UX-DR70–78's lifecycle rules. When this epic sets the pinned action-bar geometry, write it knowing Epic 3 puts a taller composer in the same slot.

**Decisions it owns.** Key-screen finding **3** (the header meta row has no measurement and already runs 212px of 284 on `HOLOCENE` before the relay indicator is added — and whether the clip band keeps a second Bridge readout 40px from the health marker at all); finding **4**, which is story one of the Tickets pane (**five marks, N Board states, and no mapping rule anywhere** — an ordinary five-state Plane board already collapses two pairs, `EXPERIENCE.md` anticipates eight-state Boards, and the mapping drawn in key screen S3 is the mock's, which is evidence and never specification; it blocks `ticketRow` and `ticketGroupHeader` equally); finding **6** (`paneSwitch` specified two ways); finding **10** (where the disabled create box's *reason* lives once the notice has scrolled out of the pinned action bar); finding **11** (`CREATE IN 33GOD` and `Create on HOL` name different things — a workspace and a Board identifier — and FR-13's whole point is that the submit proves which Board it writes to); finding **12** (measure the actual longest key across the nineteen registered Projects before treating 28 characters per title line as the floor); finding **13** (the font drift above); and note 14(a), the **relayed deadline's multiple**, which is set nowhere and must be generous relative to the direct budget or the timeout fires on every relayed read and teaches him to ignore it. Note 13 also lands here in part: `{components.commandString}`'s fit at 284px was never rendered, so whichever story builds DS-14's command well measures a real Bridge-returned string rather than the derived 35 characters.

**Placed, not solved.** The `pjid` emitter decision (architecture O1 / PRD §12 Q4) rides here as a decision ticket, because this is the epic whose value is inert without it. See *Work Outside This Repository*.

**Exit criterion: the 28-row router matrix.** See *How the 28-State Taxonomy Is Distributed*.

### Epic 3: Ask the PM what is going on — and hand it work without pretending that is a conversation

UJ-2's conversational half and UJ-3's main line. Jarad types *"what's in progress?"* and the answer streams into the panel beside the page, partial output visible while it generates. He types *"start on the resolver ticket"* and Sidepiece classifies it as **work** before he commits, shows him the classification, lets one control flip it, dispatches it through the fleet gateway and acknowledges it with a correlation identifier he can copy and chase himself. Every Turn carries the tab's URL and title, so the PM is not guessing at a page it cannot see. History is the Project's, is appended per Turn, and survives the panel closing and a Chrome restart. And on a Project with no PM — or a PM declared but absent from the fleet registry, which is true of this very repo today — Chat is visibly unavailable with the reason stated and the exact provisioning command shown, while Tickets stay fully live.

**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-10, FR-11

**Standalone.** It never waits on Epic 4. Both branches of the classifier terminate here: a Streamed Exchange streams and completes; a Dispatched Command publishes, is acknowledged inside the §5 budget, and renders visibly as dispatched with its correlation id inside a `{components.copyControl}` Epic 2 already built — a real handoff the operator can chase by hand through `bb` or Candystore. That boundary is the PRD's own (FR-8 is acknowledgement, FR-9 is the outcome), and UX-DR52 already writes the honest consequence line for exactly this world: *"This will be published and acknowledged. The result arrives later."* FR-8's four obligations are all satisfiable with no outcome ingestion at all, and the card claims nothing it cannot prove. It builds on Epic 2 — composer surface, pane switch, notice, copy module — and adds one cell to an n-item control, which is the direction dependencies are allowed to run. UJ-3 finishes here: its edge case (Bridge unreachable, one shared message, header replaced, switch inert) landed in Epic 2 with the router; its main line (no PM, reason stated, exact provisioning command, Tickets untouched) lands here, attached to the capability it degrades rather than floating in an epic of its own.

**Sequence.** Step 5, then the Chat half of step 7. Sessions first — LRU 3–5 warm, eviction never taking a session with a Turn in flight, the pinned Hermes release, and `sessions/fleet.ts` reading `~/.hermes/agents-registry.yaml` as a **seventh upstream distinct from the gateway**. Then D15, and **D15 is the load-bearing decision because the obvious implementation misses FR-7 by 14x**: `POST …/turn` is a *store write* — validate `(pjid, generation)`, classify, write the row, return `{turnId, kind, acceptedAt}` synchronously, touching nothing upstream (measured 79ms). Session acquisition, warming and streaming all live behind the SSE subscription keyed by `turnId`, and *"warming up the PM"* is a frame on that stream, not a property of the POST. **Any AC inherited from an earlier draft carrying a ≤2s first-token budget is wrong** — it is 8s p95 warm and **no budget cold** — and an AC measuring *"first frame received"* measures the gateway's `thinking.delta` animation and passes falsely, so the content/placeholder discrimination in `turns/stream.ts` (AR21) is what the budget is measured against. The classifier is one function in `contract/src/classify.ts`: a leading-verb allowlist plus an imperative-mood test, not a bag of keywords, evaluated on a typing pause in the Cockpit and re-evaluated authoritatively at send by the Bridge, which **honours an explicit override rather than overriding it**; `classify.test.ts` carries `EXPERIENCE.md`'s six-Turn corpus **verbatim** as the acceptance set. `lib/stream.ts` owns `EventSource`, and a static import of it from anywhere under `entrypoints/background/` is the one import rule worth an explicit lint. **EXT-2 should land before this epic starts**, or an hour goes into debugging the wrong thing.

**Decisions it owns — and findings 1 and 2 must be resolved together, in the first story that touches the composer, before any composer AC is written.** The specified stack computes to **233px at rest and 269px with FR-10's URL revealed, against a 188px cap**: it fits in exactly one state. And the two spines flatly contradict each other on the remedy — `EXPERIENCE.md`'s action bar *"grows upward to a cap, then scrolls internally"* against `DESIGN.md`'s *"one scroll region on screen"* and its verdict that a nested scroll region in a 284px column is a trap-the-wheel bug. The answer is binary: either the composer gets a sanctioned second scroll region with a wheel-trap mitigation, or the cap goes and the composer pushes the body. Raise the cap to a measured number, move the revealed URL to another surface, drop a stacked element, or push the body — **but never shrink type to absorb it.** Also finding **5** (the attachment seat beside or below the classification control, which decides whether the inner width is 244px or 224px — then restate the number), finding **9** (the composer's only boundary is a 1.49:1 hairline, which fails `DESIGN.md`'s own audit test), and note 14(b): the SSE-subscription budget is ≤2s **by analogy only** and has no better anchor; the architecture types the state (`SubscriptionState`) and sets no number.

### Epic 4: Get the answer back from the work you dispatched

UJ-2's closing beat, the one the journey text singles out: *"later shows the result in the same thread rather than only a green checkmark."* A Dispatched Command stops being a receipt and becomes an answer. It reaches a terminal status — completed, failed, or timed out. It renders the agent's actual **result content** in the Turn rather than a status word. Outcomes correlate back by the identifier the Bridge minted rather than by recency. A dispatch with no observed outcome inside the window reads as **unknown** and never as success. And anything that finished while the panel was closed — the normal case for a command that takes twenty minutes — is reconciled on next open.

**FRs covered:** FR-9

**Standalone, and separate for exactly one reason.** It is the only epic gated on a repository Sidepiece does not own: `33GOD/bloodbank/…/adapter.py` discards the agent's response text at line 691 and returns `success=True`, so FR-9(b) cannot be built until EXT-1 lands — and the documented fallback (have the Bridge observe the dispatched command's output through its own `tui_gateway` session, never verified either way, worth one hour before accepting a status-only v1) would change the shape of the work. **Rule 5 prefers fewer and larger *when the outcome is certain*; this is the one place in the project where it is not.** Keeping it separate means an external repo's schedule cannot hold UJ-1 or UJ-2's conversational half hostage, and Epic 3 shipping without it is honest rather than broken — a card that says *dispatched* and stops is telling the truth. It is one FR by count and a full epic by substance: a durable NATS consumer, a Candystore backfill, `turns/reconcile.ts`, and the terminal rendering of the Dispatched Command card. The file overlap with Epic 3 (`turns/*`, the turn card) is one module and one component variant — incidental sharing, not the same four files three times — and merging would make Epic 3 unshippable until a fix in someone else's repository lands, which is the precise coupling the dependency sequence puts at step 8 to avoid.

**Sequence.** Step 8, last, because its upstream is still being fixed while the rest is built. **Durability is a requirement, not an optimisation** — the consumer on `bloodbank.evt.agent.invocation.*` must survive a Bridge restart, because FR-9(e) requires reconciling outcomes that arrived while the panel was closed, and a closed panel is the normal case. Dispatch outcome events carry **no `data.repo` at all**, so §6's Project-scoped payload filter does not apply to this leg: matching is by `correlationId` against the outstanding set the Bridge persisted at dispatch, and nothing else. **Candystore is the backfill, not the primary** — queried on startup and on any consumer gap, which is what makes a missed message recoverable rather than permanently unknown, and it is why Candystore is a separate adapter from Bloodbank: DS-18 gates half of Chat and DS-19 gates nothing, and one adapter reporting for both cannot produce two blast radii. Casing splits at the boundary and that is intentional: `correlationId` inward, Bloodbank's `correlationid` (no separator) only inside `bloodbank/adapter.ts` — **a camelCase-ifying middleware applied to everything is the explicitly forbidden anti-pattern**, because it silently rewrites the one mechanism §12 Q2 confirmed works today. Until EXT-1 lands, UX-DR52's copy **is** the specified behaviour: a completed dispatch renders *"Completed. The gateway returned no result content."* and never *"Completed"* alone and never a bare checkmark — FR-6's bias toward Dispatched Command is only justified by FR-9, and an unjustified bias must say so.

**Decisions it owns.** Finding **7** (on a terminal dispatch the card's stamped band word and its outcome chip collide at 284px — decide which survives, or lay them out so both fit) and finding **8** (the outcome chip puts *variable* content in `{typography.micro}`, a role `DESIGN.md`'s own 10.5 Floor Rule reserves for static chrome — promote it to `{typography.label}` and re-measure, or earn a named exception the way `numeral` did). The FR-9(d) window must be long enough that ordinary agent work does not routinely trip it.

---

## How the 28-State Taxonomy Is Distributed

**FR-3 maps to Epic 2. The twenty-eight states do not.** Those are two different things and conflating them is the trap. §8.1 said six until the 2026-09-22 amendment; the built taxonomy is DS-1…DS-28, and the PRD names sizing it at six *"the single most likely place the backlog goes wrong."* The error there is not one of **count** — it is one of **location**. Three layers, deliberately not the same thing:

**Layer 1 — the type, in Epic 1.** `contract/src/state.ts` lands with the entire `DS-1 … DS-28` union split by producer (`BridgeDsCode` / `ClientDsCode` / `DsCode`, AR13) plus the three non-DS code spaces `Refusal`, `SubscriptionState` and `IconTransient` (AR14). The whole union has to exist in the first epic even though nothing renders there, because the split is what `tsc` enforces — *"a Bridge route cannot emit DS-1"* is only **impossible** if DS-1 is in the union. This is not FR-3 work smuggled early: FR-2(b) already demands a distinct *declared but unknown*, FR-14(b) already demands the failing dependency be named, and FR-15(d) already demands both be visible to `curl`. The enum is the cheapest correct way to satisfy requirements Epic 1 owns outright. It is also rule 4 applied to the single most-imported file in the repo: four epics each editing the one union both halves of a network boundary typecheck against is exactly the drift FR-3 exists to prevent.

**Layer 2 — the renderer, in Epic 2, and this is where FR-3 itself lands.** Read FR-3's testable obligations and every one of them is a *rendering* obligation: each state separately rendered and separately worded; no failure state rendering as an empty or loading panel; the Bridge-unreachable state distinguishing what is distinguishable; every failure state carrying a re-resolve control. FR-3 is not "build 28 states" — it is *the panel never lies about what it cannot do*, and that becomes observable exactly once, in the epic that first has a Cockpit to render into. With it come the machinery it actually names: the total-vs-partial router as a single testable predicate (UX-DR47), the four in-flight/deadline rules (UX-DR48), `{components.stateNotice}`, `{components.reResolveControl}`, and the copy module holding all 28 headline-plus-detail pairs and the five byte-exact PRD literals.

**Layer 3 — the triggers, everywhere after, as acceptance criteria on capability stories rather than as new FR-3 work.** One rule, applied mechanically: **a state is born in the epic that detects it, and rendered in the epic that owns the surface it degrades.** FR-15's curl surface is what makes the first half real rather than notional — Epic 1 does not *stub* DS-9, it stats a missing clone path and returns it in `degraded[]`, and the acceptance is a transcript. The distinction that keeps this honest: **Epic 3 is never "done with FR-3" — it is done with FR-5, and DS-12 rendering correctly is part of FR-5's proof.**

**The count is defended in one place, at one gate.** Epic 2's **28-row router matrix is that epic's exit criterion**: for every code it asserts which of the two shapes renders and which panes stay operable. Rows for codes no epic has triggered yet are asserted against an injected `degraded[]` — which is cheap *precisely because* Epic 1 left every surface curl-exercisable. So the 4.7x miscount cannot be carried past the second epic, and when a later epic adds a failure mode the matrix visibly grows a row. AR15 makes that a definition-of-done clause on all four epics: **a new failure mode adds a `DsCode` and its `EXPERIENCE.md` row in the same change, never a free-text message.** Note 19's lesson applies — no linter can see this one, so it is a human check written into every epic's DoD, not a tool.

**The distribution that falls out:**

| Epic | Produced here | Count |
|---|---|---|
| **1** | DS-2, DS-6, DS-7, DS-8, DS-9, DS-10, DS-15, DS-20, DS-23, DS-25 | 10 |
| **2** | DS-1, DS-5, DS-14, DS-16, DS-17, DS-21, DS-22, DS-27 | 8 |
| **3** | DS-11, DS-12, DS-13, DS-18, DS-24, DS-26, DS-28 | 7 |
| **4** | DS-19 | 1 |
| *(none)* | **DS-3, DS-4 — not v1 stories pending the O3 spike; v1 ships DS-5 as the fallback answer (A-P2)** | 2 |

Twenty-six firm, twenty-eight with the conditional pair. No gaps, no double-coverage. If the spike says MagicDNS distinguishes "off the tailnet" from "`big-chungus` is not answering", DS-3 and DS-4 light up inside Epic 2 for free — wording, triggers and recovery already exist in `EXPERIENCE.md`.

Four consequences worth stating rather than leaving implicit:

- **DS-9, DS-10 and DS-20 are produced together in Epic 1** because AR49 names all three as outputs of the *one* filesystem prober in `registry/paths.ts` — clone path, non-PM `role_dir`, PM `role_dir`. Splitting DS-20's production into Epic 3 would reopen that file for a third of a function. DS-20 is **gated** in Epic 3, where its blast radius is, alongside Epic 1's DS-25. DS-10 gates nothing at all — and must not, because this repo binds `sidepiece-scrum-master` to a `role_dir` that does not exist, so gating Chat on DS-10 would kill Chat on the repo being built.
- **Two states carry no `{components.stateNotice}`** — DS-1 (no `pjid` declared: the browser's default condition on almost every page, so it is wallpaper at rest with a demoted-not-absent re-resolve) and DS-21 (Chrome will not run the content script here). DS-21 is the only state in the product that renders **no re-resolve control at all**, because a control that structurally cannot succeed is a worse lie than omitting it.
- **DS-18 is the only half-pane state in the product.** Bloodbank unreachable leaves Streamed Exchange fully live and the composer **enabled**, refuses a dispatch *before* publish, keeps the text, and puts the flip control right there. Disabling all of Chat to say it is the explicitly forbidden behaviour. Its sibling DS-19 gates nothing whatsoever, and their acceptance criteria must read differently from each other and from FR-9's own *"No outcome after `<window>`. Status unknown."* — that one means nothing arrived, DS-19 means we cannot look, and the fixes differ, so the sentences differ.
- **UJ-3 is not an epic.** An epic whose deliverable is "failures render honestly" has nothing to fail yet, carries no standalone value, and inverts every dependency in the plan. UJ-3 is the organising principle *for exactly this distribution*, and it completes in two halves attached to the capabilities they degrade — its edge case in Epic 2 with the router, its main line in Epic 3 with the Chat pane. Neither half is meaningful anywhere else.

Two degraded states are **free acceptance fixtures**, true of this repo today with zero setup: **DS-12** (`.project.json` declares `sidepiece-pm`, which is not in the Hermes fleet registry) and **DS-10** (`.project.json` binds `sidepiece-scrum-master` to `agents/hermes/scrum-master`, which does not exist here).

---

## Work Outside This Repository

Three items. None is a Sidepiece story, none should be folded into an FR story as if it were in-repo work, and all three are exactly what a Sidepiece-shaped backlog loses.

**EXT-1 — the Bloodbank hermes-gateway loses every agent response. Start day one, in parallel with Epic 1; sits immediately before Epic 4.** `33GOD/bloodbank/services/hermes-gateway/bloodbank_hermes_gateway/adapter.py`: `send()` at line 684, the offending `del chat_id, content, reply_to, metadata` at line 691, followed by `return SendResult(success=True, …)`. It discards the agent's response text and reports success. Correlation genuinely works — `correlationid`, `command_id` and `idempotency_key` are all copied onto outcome events — only the content was never carried, which is why FR-9(b) is the one blocked obligation in the whole backlog. **Scope it as a Bloodbank fix that happens to unblock Sidepiece, not as a Sidepiece patch:** every Bloodbank consumer that dispatches to an agent has been silently losing response text. It carries its own fallback investigation — can the Bridge observe the dispatched command's output through its own `tui_gateway` session? Never verified either way; worth one hour before accepting a status-only v1. **Start it first precisely because it is off this repo's critical path** — it is the only place a schedule slip in another repository can reach this one.

**EXT-2 — the Sidepiece PM is subscribed to subjects the grammar forbids, so it receives nothing. Small, prerequisite, not a blocker; sits before Epic 3.** `agents/hermes/pm/role.yaml` subscribes to `bloodbank.evt.repo.sidepiece.>` and `bloodbank.cmd.agent.sidepiece-pm.>` — still present today, with an in-file comment already conceding the first is non-functional — and `docs/product-brief.md:102` carries `bloodbank.evt.v1.repo.sidepiece.>`, a version token **and** an identity slug. All of them embed an identity slug as a subject token, which the five-token grammar forbids, and **a PM subscribed to an illegal subject receives nothing.** Precision worth keeping: these files sit inside this repository's tree, but they are fleet configuration for the `sidepiece-pm` agent, not Sidepiece product source — they belong to the Hermes/flume surface and touching them changes no package, which is why they are filed here as out-of-repo work. It is **not** an FR-8 blocker: dispatch travels the fleet gateway at `bloodbank.cmd.agent.invocation.start` with the target agent in `actor.agent_id`. But it **is** a live defect in the manifest of the very PM that FR-7 and FR-8 target, and whoever builds FR-7 will spend an hour debugging the wrong thing. **Verify against addendum §B.1 before writing it — if §B.1 holds, the fix is to DELETE the subscriptions rather than correct them.**

**EXT-3 — nothing emits a `pjid` into a served page, and that work has no owner in any document.** Architecture O1 / PRD §12 Q4. The **decision** rides inside Epic 2, because that is the epic whose value it gates and a decision with no home is a decision that does not get made; the **implementation** is external under two of the three costed options, and they are not equivalent. A **pjangler recipe** has the most leverage — nineteen Projects resolvable in one change — and costs a change to another repo. **Per-project template changes** need no cross-repo work, cost nineteen hand edits, and leave every Project registered later inert until someone remembers. **Manual-per-surface** costs nothing up front and makes DS-1 the permanent default state of the product. Epic 2's dev fixture makes FR-1…FR-4 fully testable without any of them, so no epic is blocked — **but every epic can be accepted while the shipped product still resolves nothing on a real page.** This is the project's real sequencing risk, it is a decision rather than a story, and it is Jarad's.

---

## Structural Calls Recorded

Two structures were designed independently against this inventory and scored against the step file's six rules. They agreed on the FR mapping for every FR and on every epic boundary but one. What follows is that disagreement and the two calls most worth overruling at the approval gate.

**The disagreement was whether the Cockpit shell and Tickets are one epic or two.** The alternative split Epic 2 into *"the Cockpit names the Project, or says why it can't"* (FR-1, FR-3, FR-4) and *"file a ticket against the thing you're staring at"* (FR-12, FR-13), for five epics. It was rejected on rules 4 and 5: the solution design is unusually settled — PRD final, both spines final, 21 architecture decisions and a validated tree — the split takes the panel's body through **three** layout passes instead of two (identity-only, then Tickets, then switch-plus-panes), and it ships a keyboard command in one epic whose handler lands in the next. Its best argument survived and was taken as a **sequencing requirement rather than a boundary**: the cold-install font re-verification is Epic 2's *second* story, before any drawn measurement is trusted, so the one place the settled design is genuinely unsettled is absorbed early rather than mid-epic. Three ideas from that structure were grafted wholesale — the 28-row matrix as Epic 2's **exit criterion** with not-yet-reachable rows asserted against an injected `degraded[]`; the three-layer type/renderer/trigger framing of FR-3; and DS-20's production moving into Epic 1 on AR49's single-prober grounds.

**Call 1 — the weakest thing in this list: Epic 1 finishes with a `curl` transcript, and no journey completes in it.** UJ-1, UJ-2 and UJ-3 all require the Cockpit. The defence is FR-15(d), and FR-15(d) is a constraint on *how* things are built; using a constraint as an epic boundary is how a technical-layer epic gets smuggled back in under a better name. The counter is a **cost** argument, not a value argument: folding Epic 1 into Epic 2 produces a roughly thirty-five-story epic with no acceptance gate for months, at the precise point where the design stops being certain — everything before that seam is curl-verifiable against measured numbers, everything after it carries the unverified Chrome behaviours (the curried-gesture no-op, Chromium 415694848, PNA, `createShadowRootUi`'s root, the cold-install font drift). **The named repair, if the curl framing does not survive contact with the person who has to build it: move the thinnest slice of FR-1 and FR-4 forward as Epic 1's final story, so the epic ends with a panel showing an identity header and nothing else.** That costs the clean FR mapping — FR-1 and FR-4 would then split across two epics — and buys back a visible exit. It is a real trade and it is Jarad's to make.

**Call 2 — Epic 2 is large, roughly twenty stories, and is deliberately ungated.** The token system, the copy module, the router, the 28-row matrix, the extension shell, detection, the identity header and both halves of Tickets all live in one epic. Rule 5 says prefer fewer and larger when the outcome is certain, and it is; the mitigation for the one uncertain part is sequencing the font measurement second rather than adding a boundary. If that measurement comes back materially different from Noto Serif at 0.897×, the meta row, the pane-switch cell budget and the ticket title measure all move at once, and this epic absorbs the redesign with nothing to stop at.

**Standing counter-metric: SM-C2.** This project died once at 44 tickets and zero code. Nothing from the out-of-scope section generated an epic — no §7 non-goal, no §9 deferral, no `[v2]` component — and a backlog that re-admits them as "while we're in here" stories is this project's documented failure mode.

---

## Epic 1: Resolve any Project from the tailnet, and say honestly what is wrong with it

Jarad can ask `big-chungus` — from the laptop or from the host, with `curl`, with no extension installed and no Chrome running — which Project a given `pjid` belongs to, and get back repo name, clone path, Board binding, Agent bindings and a content-addressed generation. And he can ask what is wrong with it: a health answer that names **which** dependency failed rather than failing generically, including the silent-credential-degradation case that nothing else on this machine notices. Before this epic a `pjid` is a string that means nothing; after it the page-to-project link physically exists, is supervised, survives a reboot, and is exercisable without a browser. `sp-resolve holocene | jq .clonePath` is a shell function he can write the day it lands.

**FRs covered:** FR-2, FR-14, FR-15, FR-16
**NFRs bound here:** NFR-1, NFR-7, NFR-8, NFR-9 (mint + Bridge-side refusal), NFR-10
**States produced and `curl`-proven here:** DS-2, DS-6, DS-7, DS-8, DS-9, DS-10, DS-15, DS-20, DS-23, DS-25

---

### Story 1.1: The monorepo scaffold that `contract/` cannot exist without

As Jarad, the one operator,
I want a pnpm workspace with a strict shared TypeScript base, a Biome config and `mise` tasks that build, typecheck and lint it,
So that the shared contract can exist as a real imported package rather than two hand-maintained copies that drift across the network boundary.

**Acceptance Criteria:**

**Given** an empty repository with no `packages/` directory
**When** Story 1.1 is complete and `pnpm install && mise run build` is run from the repo root
**Then** `pnpm-workspace.yaml` declares `packages: ['packages/*']`, and exactly two package directories exist — `packages/contract/` (name `@sidepiece/contract`) and `packages/bridge/` (name `@sidepiece/bridge`)
**And** `packages/extension/` does **not** exist and no `wxt` or `shadcn` command has been run, because `pnpm dlx wxt@latest init` is sequence step 6 and belongs to Epic 2 (AR2)
**And** `packages/ui/` does not exist and is not created by any later story in this epic

**Given** `tsconfig.base.json` at the repo root
**When** it is read
**Then** it sets `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`, `"module": "nodenext"`, `"moduleResolution": "nodenext"`, `"target": "es2023"`
**And** both `packages/contract/tsconfig.json` and `packages/bridge/tsconfig.json` contain `"extends": "../../tsconfig.base.json"` and redeclare none of those five compiler options
**And** `mise run typecheck` runs `tsc --noEmit` over both packages and exits 0

**Given** the root `package.json`
**When** it is read
**Then** it carries `"private": true`, a `scripts` block, and **no `dependencies` key at all**; `devDependencies` is limited to the workspace toolchain (`typescript`, `@biomejs/biome`, `tsup`), every entry pinned to an exact version with no range prefix

**Given** `biome.json` at the repo root
**When** a file containing `const  x   =1` (deliberately misformatted) is added under `packages/`
**Then** `mise run lint` exits non-zero and names that file and line
**And** after `mise run format` the same command exits 0

**Given** `mise.toml`
**When** `mise tasks` is run
**Then** it lists `build`, `typecheck`, `lint`, `format` and `test`, and `build` declares `depends = ["typecheck", "lint"]`
**And** no `.github/` directory exists anywhere in the repository — there is no CI on this machine and `mise` tasks are the pipeline

**Given** the four human-checked enforcement items that no linter can see
**When** Story 1.1 is complete
**Then** `DEFINITION-OF-DONE.md` exists at the repo root carrying exactly four checklist items, verbatim in intent: (1) does every mutating route call the generation check before its capability; (2) does a new failure mode have a `DsCode` **and** its `EXPERIENCE.md` row in the same change, never a new free-text message; (3) does a new user-facing string exist in `EXPERIENCE.md`, landing in `copy/states.ts`, `copy/progress.ts` or `copy/icon.ts`; (4) does a Glossary term appear under a synonym

*Satisfies: AR2, AR3, AR4, AR6, AR15*

---

### Story 1.2: The lint that makes `project_id` impossible to reintroduce

As Jarad, the one operator,
I want Biome to fail the build on the pjangler identifier appearing as `project_id`, `projectId` or `projectSlug` anywhere outside the two boundary files that must rename foreign names,
So that the one vocabulary mistake this project already made in its own specification cannot reach the code, where both a slug and a board UUID are just strings and nothing else would catch it.

**Acceptance Criteria:**

**Given** the rule installed in `biome.json`
**When** a new file `packages/bridge/src/registry/index.ts` contains the identifier `projectId`
**Then** `mise run lint` exits non-zero, names the file and line, and emits the message `pjangler's identifier is 'pjid'; Plane's board UUID is 'boardId'. Rename at the boundary (architecture A-P1).`
**And** the same rule fires for the identifier `project_id` and for `projectSlug`, in any layer including a local variable name, a JSON key literal and a log key

**Given** the two boundary files where a foreign name is legitimately read once and renamed in the same expression — `packages/bridge/src/tickets/plane.ts` (Plane's `project` → `boardId`) and `packages/bridge/src/registry/client.ts` (the registry payload's own identifier key → `pjid`), neither of which exists yet
**When** a throwaway fixture file is created at each of those two exact paths containing the foreign name, and at a third path containing the same name
**Then** `mise run lint` exits 0 for the two permitted paths and non-zero for the third
**And** the per-path exception list in `biome.json` contains exactly those two entries, written as full single-file paths with no glob wider than one file, and the fixtures are deleted

**Given** that A-P6 says `pjid` is never `project_id` "not even in SQL", and Biome does not lint `.sql`
**When** `mise run lint` runs
**Then** it also greps `packages/**/*.sql` for `project_id` and exits non-zero on a hit, with the same message
**And** the grep is scoped to `packages/` so `_bmad-output/` planning artifacts, which quote the forbidden names deliberately, are never scanned

**Given** A-P1 also forbids `project` and a bare `id` for the pjangler identifier, which are too generic to lint mechanically
**When** Story 1.2 is complete
**Then** those two names are recorded in `DEFINITION-OF-DONE.md` item 4 (the Glossary-synonym check) as human-checked rather than silently dropped, and the lint rule's own comment says which two it deliberately does not cover and why

*Satisfies: AR3, AR60, AR22*

---

### Story 1.3: `contract/` — the 28-state taxonomy and the Project Record, typed once for both halves

As Jarad, the one operator,
I want the whole DS-1…DS-28 union, the three non-DS code spaces, the Project Record and `CONTRACT_VERSION` defined in one package that both halves of the network boundary compile against,
So that a Bridge and a Cockpit can never disagree about what a failure is called — which is the exact drift FR-3 exists to prevent, and the single most-imported file in the repo is edited once rather than by four epics.

**Acceptance Criteria:**

**Given** `packages/contract/src/state.ts`
**When** it is typechecked
**Then** it exports `ClientDsCode` as exactly `'DS-1' | 'DS-3' | 'DS-4' | 'DS-5' | 'DS-16' | 'DS-21' | 'DS-27'` (7 literals)
**And** it exports `BridgeDsCode` as exactly the other 21 literals — `'DS-2' | 'DS-6' | 'DS-7' | 'DS-8' | 'DS-9' | 'DS-10' | 'DS-11' | 'DS-12' | 'DS-13' | 'DS-14' | 'DS-15' | 'DS-17' | 'DS-18' | 'DS-19' | 'DS-20' | 'DS-22' | 'DS-23' | 'DS-24' | 'DS-25' | 'DS-26' | 'DS-28'`
**And** it exports `DsCode = BridgeDsCode | ClientDsCode`
**And** it exports `Degraded = { ds: BridgeDsCode; params?: Record<string, string>; remedy?: string }` — `ds` typed `BridgeDsCode`, not `DsCode`

**Given** a co-located `state.test.ts`
**When** `mise run test` runs
**Then** a runtime array mirroring each union asserts: 7 client codes, 21 bridge codes, 28 total, the two sets are disjoint, and the 28 are `DS-1`…`DS-28` with no gap and no duplicate
**And** a `// @ts-expect-error` fixture assigning `{ ds: 'DS-1' }` to `Degraded` compiles only because of the expect-error directive — proving a Bridge route *cannot* emit a client-produced code rather than merely being discouraged from it

**Given** the three failures that are typed but deliberately not `DsCode`s
**When** `state.ts` is read
**Then** it also exports `Refusal = { error: 'stale_generation'; pjid: string; received: number; current: number }`, `SubscriptionState` (SSE not established — a property of this open, not of the Project) and `IconTransient` (the icon's gesture transient), each in its own code space and none of them a member of `DsCode`

**Given** `packages/contract/src/project.ts`
**When** it is read
**Then** it exports `ProjectRecord` carrying `pjid: string`, `generation: number`, `repo: string`, `clonePath: string`, `boardId: string`, `agents: AgentBinding[]` and `ticketProvider: TicketProvider`
**And** `boardId` is typed `string` and is **not** optional and **not** nullable, because 4 of the 19 registered Projects carry an empty string and a `string | null` type would invite exactly the `!= null` check that reports a Board for all four
**And** it exports `type ProjectResponse = (ProjectRecord & { degraded: Degraded[] }) | { degraded: Degraded[] }`, so `tsc` forces every consumer to handle the resource-absent shape rather than reading a field off `undefined`

**Given** `packages/contract/src/version.ts`
**When** it is read
**Then** it exports `export const CONTRACT_VERSION = 1` typed as `number` — a plain integer, not the package version and not a semver string
**And** a comment above it states that it is bumped by hand in the same change as any breaking change to a `contract/` type

**Given** the rule that a new failure mode adds a `DsCode` and its `EXPERIENCE.md` row in the same change
**When** `state.ts` is read
**Then** a header comment states that rule and names `EXPERIENCE.md`'s degraded-state table as the authority, and points at `DEFINITION-OF-DONE.md` item 2

*Satisfies: AR5, AR13, AR14, AR15, AR16, AR18, AR22, AR33, UX-DR51*

---

### Story 1.4: A Bridge that answers `curl`, states its contract, and refuses to start on the wrong Node

As Jarad, the one operator,
I want a daemon on `big-chungus` that answers `GET /v1/health` over loopback, stamps every response with the contract version, and dies loudly at startup if it is running on a Node it was not pinned to,
So that a drifted runtime fails in the first second with a sentence I can read instead of three hours in, at the first `DatabaseSync` call, as a Degraded nobody can attribute.

**Acceptance Criteria:**

**Given** `packages/bridge/src/main.ts`
**When** the Bridge is started on a Node that does not satisfy `>=24.15.0 <25`
**Then** it writes exactly `sidepiece-bridge requires Node >=24.15.0 <25; this is v<actual>. Refusing to start.` to stderr and exits with code 1
**And** the assertion runs before any socket is opened and before any database file is touched — verified by running it with the state directory made read-only and observing the same message and exit code

**Given** the Bridge running on Node 24.15.0 or later within the pin
**When** `curl -s -D- http://127.0.0.1:8787/v1/health` is run on `big-chungus`
**Then** the status is `HTTP/1.1 200 OK`, the response carries `X-Sidepiece-Contract: 1`, and the body is flat and unwrapped — `{"status":"ok","contractVersion":1,"node":"v24.15.0","startedAt":"<ISO-8601 UTC>","checkedAt":"<ISO-8601 UTC>","degraded":[]}`
**And** both timestamps are ISO-8601 UTC strings with a `Z` suffix, never epoch integers
**And** every key in every Bridge response body is camelCase

**Given** the loopback-only bind
**When** `ss -ltnp | grep 8787` is run on `big-chungus`
**Then** exactly one listener is shown, on `127.0.0.1:8787`
**And** no listener on `0.0.0.0:8787`, `*:8787` or any tailnet interface address is present

**Given** `packages/bridge/src/server/errors.ts`
**When** any handler throws
**Then** the response is a JSON body carrying a typed code, never an English sentence — `curl`ing every route while forcing a throw produces no response body containing prose
**And** a `5xx` status is emitted only when the Bridge itself failed to answer; a product-level failure is `200` with `degraded[]` populated
**And** an unrecognised path returns `404` with `{"error":"not_found","path":"<path>"}`

**Given** A-P8's logging rules
**When** the Bridge handles a request and a failure occurs
**Then** `journalctl`-readable stdout carries one structured JSON line per event, with `pjid` as a top-level key on anything Project-scoped and the failure's `ds` code on any failure line
**And** a log line describing a failure that maps to no `DsCode` fails review — a grep of the log module shows no free-text error string constructed at a call site

**Given** A-P7's rule that every in-flight state has a deadline and a terminal transition
**When** the Bridge makes any outbound call
**Then** that call carries an explicit timeout and a terminal outcome; a test asserting that no `fetch`, `spawn` or socket call in `packages/bridge/src` is made without a timeout argument exits 0

*Satisfies: FR-15(d), NFR-8, AR16, AR17, AR22, AR25, AR55, UX-DR48, UX-DR51*

---

### Story 1.5: A Turn store that is versioned, and says so when it is newer than the Bridge

As Jarad, the one operator,
I want the Bridge's SQLite store created and migrated forward-only at startup, and a Bridge rolled back beneath its own store to say so and keep resolution working,
So that a redeploy of an older binary degrades one pane honestly instead of half-reading a store it does not understand, which is the confidently-wrong outcome this product forbids.

**Acceptance Criteria:**

**Given** `packages/bridge/src/db/schema.sql` and `packages/bridge/src/db/migrations/001_resolutions.sql`
**When** the Bridge starts against an empty state directory
**Then** `sqlite3 ~/.local/state/sidepiece/turns.db '.tables'` lists exactly `resolutions` — one table, plural snake_case, and **no** `registry_snapshots` table, because D2's snapshot is a JSON file
**And** `turns`, `dispatches` and `ticket_creates` do **not** exist, because this story writes to none of them; each is created by the story that first writes to it, as its own forward migration — `ticket_creates` in Story 2.22, `turns` in Story 3.2, `dispatches` in Story 3.10
**And** `PRAGMA user_version` returns `1`
**And** `resolutions` has columns `pjid TEXT PRIMARY KEY`, `generation INTEGER NOT NULL`, `record_hash TEXT NOT NULL`, `resolved_at TEXT NOT NULL`, `clone_path TEXT`, `board_id TEXT`
**And** the migration contract every later table is held to is stated once, in `db/README.md`: plural snake_case table names, snake_case columns, `pjid TEXT NOT NULL` and `generation INTEGER NOT NULL` on every capability table, ISO-8601 UTC TEXT timestamps, `clone_path` and `board_id` carried as recovery metadata and never as keys, migrations forward-only and numbered, each advancing `user_version` by exactly one
**And** every timestamp column is `TEXT` holding ISO-8601 UTC, never an integer — `SELECT resolved_at FROM resolutions` is readable in a terminal without conversion

**Given** AR31's rule that exactly one module opens the database
**When** `grep -rn "node:sqlite" packages/` is run
**Then** the only hit is `packages/bridge/src/turns/store.ts`
**And** the snake_case ↔ camelCase mapping for each table happens once, in that module — a grep for `record_hash`, `clone_path`, `board_id` and `created_at` outside `store.ts` and `db/` returns nothing

**Given** a store written by a newer Bridge — reproduced with `sqlite3 turns.db 'PRAGMA user_version = 9'`
**When** the Bridge is restarted and `curl -s http://127.0.0.1:8787/v1/health` is run
**Then** the status is `HTTP/1.1 200 OK`, the process is still running (its PID is unchanged and it keeps answering), and `degraded[]` contains `{"ds":"DS-25","params":{"storeVersion":"9","bridgeVersion":"1"}}`
**And** `PRAGMA user_version` is still `9` — no migration ran, nothing was read from the store, and no table was dropped or altered
**And** resolution and health remain fully answerable, because they are storeless reads; only the Turn-scoped capability is gated

**Given** the state directory
**When** the store is opened
**Then** its path is `$SIDEPIECE_STATE_DIR/turns.db`, defaulting to `~/.local/state/sidepiece/turns.db`, and it is never created inside `~/.local/lib/sidepiece/` or anywhere under the deploy target

*Satisfies: FR-15(e), AR23, AR26, AR27, AR28, AR29, AR30, AR31, AR62, UX-DR41 (DS-25, Bridge half)*

---

### Story 1.6: Resolve a pjid to a Project Record, stamped with a content-addressed generation

As Jarad, the one operator,
I want `curl https://…/v1/project/<pjid>` to hand back repo name, clone path, Board binding, Agent bindings and a generation that only moves when the record actually changed,
So that the page-to-project link physically exists and is trustworthy — and so that `sp-resolve holocene | jq .clonePath` is a shell function I can write the day this lands.

**Acceptance Criteria:**

**Given** the pjangler registry service answering on `big-chungus`
**When** `curl -s http://127.0.0.1:8787/v1/project/sidepiece` is run
**Then** the status is `200`, the body is the `ProjectRecord` **itself, unwrapped** — no `data` envelope — carrying `pjid`, `generation`, `repo`, `clonePath`, `boardId`, `agents[]` and `ticketProvider`, plus `degraded: []`
**And** `registry/client.ts` fetched `GET /v1/registry` once and indexed all 19 Projects client-side, because there is no per-pjid endpoint
**And** the registry payload's own identifier key is renamed to `pjid` inside `registry/client.ts` in the same expression that reads it, and that foreign name appears in no other file

**Given** a pjid the page declares but the Registry has never heard of
**When** `curl -s -D- http://127.0.0.1:8787/v1/project/not-a-real-pjid` is run
**Then** the status is `HTTP/1.1 200 OK` — the Bridge answered, so this is not a `5xx`
**And** the body is `{"degraded":[{"ds":"DS-2","params":{"pjid":"not-a-real-pjid"}}]}` and carries **no** `ProjectRecord` fields at all
**And** the body contains no user-facing sentence — the Bridge sends the code and the pjid; `declared but unknown` is the Cockpit's wording and lands in Epic 2's copy module

**Given** the four boardless Projects — `codegraph-voyage`, `legofirst`, `momo`, `vinyl`
**When** each is resolved and the response is inspected
**Then** each returns `"boardId": ""` — an empty string, present as a key, never `null` and never absent
**And** a co-located test asserts, for all four, that `record.boardId !== null` evaluates **true** and `'boardId' in record` evaluates **true** — both naive checks would report a Board for all four — while `Boolean(record.boardId)` evaluates **false**
**And** a grep asserts the only board-presence check anywhere in `packages/bridge/src` is a truthiness test; no `!= null`, `!== null`, `?? `-defaulting or `in`-check on `boardId` exists

**Given** `registry/generation.ts` and the `resolutions` table
**When** a pjid is resolved for the first time
**Then** a `resolutions` row is written with `generation = 1`, `record_hash = sha256(JSON.stringify({repo, clonePath, boardId, ticketProvider, agents}))` hex-lowercase with `agents` sorted by agent id and keys emitted in that fixed order, `resolved_at` ISO-8601 UTC, plus `clone_path` and `board_id` as recovery metadata
**And** re-resolving the same unchanged Project 20 times in a row leaves `generation` at `1` and `record_hash` byte-identical — re-resolution is not an event
**And** after renaming that Project's repo in pjangler and re-resolving, `generation` is `2` and `record_hash` differs; the sequence never reuses a value, including across a pjid that leaves and re-enters the registry
**And** the hash covers the FR-4/FR-2 payload and nothing else — `generation` itself, `resolved_at` and the pjid are excluded, verified by a test that mutates each of them and asserts the hash is unchanged

**Given** AR38's rule that the generation is echoed everywhere
**When** any Bridge response for a resolved Project is inspected
**Then** `generation` is present at the top level of the body, not only on resolution answers

**Given** NFR-7's resolution budget
**When** 50 sequential resolutions are run on `big-chungus` and timed
**Then** p95 is under 1s and the measured p50 and p95 are recorded in the story's transcript; the registry itself measures 2.4ms p50, so a p95 anywhere near the budget is a defect in this story, not a tight budget
**And** the pjid is matched byte-for-byte against the registry's own keys — the Bridge performs no normalisation, does not reimplement `normalizeProjectId`, and does not read `.project.json` off the filesystem

*Satisfies: FR-2(a), FR-2(b), FR-2(d), FR-2(e), FR-15(d), NFR-7, NFR-9 (mint half), AR18, AR27, AR32, AR33, AR37, AR38, AR50, AR55, AR57, UX-DR40 (DS-2, Bridge half), UX-DR51*

---

### Story 1.7: Refuse a mutation written against a Project that has moved

As Jarad, the one operator,
I want the Bridge to refuse, with `409 stale_generation`, any mutating request whose generation is behind the current one for that pjid,
So that Sidepiece never acts against the wrong Project — a confidently wrong Ticket is worse than a failed one, and this is the check SM-3 is measured against.

**Acceptance Criteria:**

**Given** `registry/generation.ts`
**When** `assertCurrentGeneration(pjid, received)` is called
**Then** stale is defined in exactly one place as `received < current` for that pjid
**And** `received === current` passes
**And** `received > current` is impossible and is treated as a Bridge bug — it throws, and a structured log line at level `error` carries the literal key `generation_ahead_of_bridge` with both numbers

**Given** `server/http.ts` exporting a `mutatingRoute()` registration helper
**When** a route is registered through it
**Then** the generation check runs **before** the handler body executes — proven by a fixture handler that records invocation, asserted never to have been reached on a stale request
**And** a route registered without `mutatingRoute()` cannot reach a mutating capability; this is also written into `DEFINITION-OF-DONE.md` item 1, because `tsc` cannot see a call

**Given** a conformance test that boots the real HTTP server and registers a fixture route through the production `mutatingRoute()` helper
**When** a pjid is resolved at generation 4, the pjangler record is changed so the next resolution mints generation 5, and the fixture route is POSTed with `{"generation": 4}`
**Then** the transcript reads `HTTP/1.1 409 Conflict` with `content-type: application/json` and `X-Sidepiece-Contract: 1`
**And** the body is exactly `{"error":"stale_generation","pjid":"<pjid>","received":4,"current":5}` — those four keys, in that order, and **no** `degraded` key, because nothing is degraded once a mutation is refused
**And** the same POST with `{"generation": 5}` returns the fixture handler's own success response

**Given** AR39's rule that the guard is a body field and not a header
**When** the same request is sent carrying the generation only as an `X-Sidepiece-Generation` header and omitting it from the body
**Then** the response is `HTTP/1.1 400 Bad Request` with `{"error":"missing_generation","pjid":"<pjid>","field":"generation"}` — not a `409`, because nothing was compared
**And** the pjid is taken from the path (`/v1/project/:pjid/...`) and never from the body

*Satisfies: FR-2(d), FR-15(d), NFR-9, AR39, AR40, AR41, AR42, AR14 (`Refusal`)*

---

### Story 1.8: Say what is missing on disk — the clone path and the role directories

As Jarad, the one operator,
I want a resolution to tell me when the Registry has a Project whose clone is not on `big-chungus`, or an Agent bound to a role directory that does not exist,
So that I go look at the thing that is actually wrong instead of watching a pane fail for a reason nobody names — and so that the two states already true of this repo today are proven rather than hypothesised.

**Acceptance Criteria:**

**Given** `registry/paths.ts`, the one filesystem prober, and the Bridge as the only component that touches the filesystem
**When** a Project is resolved
**Then** the prober stats the clone path and each Agent binding's `role_dir`, producing `DS-9` for a missing clone path (`params.path`), `DS-10` for a **non-PM** binding whose `role_dir` is missing (`params.agent`, `params.roleDir`), and `DS-20` for the **PM's own** missing `role_dir` (`params.pm`, `params.roleDir`)
**And** `grep -rn "node:fs" packages/ | grep -v "^packages/bridge/"` returns nothing

**Given** this repository's own `.project.json`, which binds `sidepiece-scrum-master` to `agents/hermes/scrum-master` — a directory that does not exist here
**When** `curl -s http://127.0.0.1:8787/v1/project/sidepiece | jq '.degraded'` is run today, with zero setup
**Then** the array contains `{"ds":"DS-10","params":{"agent":"sidepiece-scrum-master","roleDir":"<clonePath>/agents/hermes/scrum-master"}}`
**And** the full `ProjectRecord` is still present in the same `200` response — DS-9, DS-10 and DS-20 ride **alongside** the resolved record, never instead of it
**And** `degraded[]` contains no `DS-20`, because the PM's role directory does exist in this repo; the DS-20 branch is proven separately by pointing a PM binding at a nonexistent path in a fixture registry payload and asserting `DS-20` with `params.pm`

**Given** a Project whose Registry row is readable but whose clone path is absent on `big-chungus`
**When** it is resolved
**Then** `degraded[]` contains `{"ds":"DS-9","params":{"path":"<the absolute clone path>"}}`
**And** `params.path` is the complete absolute path — never truncated, never elided, never ellipsised — because the path is the thing the operator needs to go look at
**And** the Bridge does not clone, fetch or create anything on disk in response

**Given** UX-DR51's rule that the Bridge sends codes and not prose
**When** any of DS-9, DS-10 or DS-20 is emitted
**Then** the response carries only the code and its typed `params`; no sentence, no remedy, and no `remedy` key, because no FR mandates a command for any of these three

*Satisfies: FR-2(a), FR-15(d), AR49, AR50, UX-DR45 (DS-9, DS-10, DS-20 — Bridge half), UX-DR51*

---

### Story 1.9: Answer from the last good copy when the Registry is down — and never silently

As Jarad, the one operator,
I want the Bridge to keep a last-good snapshot of the registry on disk, serve from it when the pjangler Registry does not answer, and mark every such answer with the snapshot's age,
So that a Registry outage becomes a partial, honest degradation rather than a total one — and so that a cache that looks healthy while the service is down never exists.

**Acceptance Criteria:**

**Given** `registry/snapshot.ts` and a healthy Registry
**When** the registry payload is fetched successfully
**Then** `<state-dir>/registry-snapshot.json` is rewritten whole with `{"fetchedAt":"<ISO-8601 UTC>","payload":{…}}`
**And** its mtime advances on **every** successful fetch, not only the first — asserted over three consecutive fetches
**And** it is a file under the state directory, not a table; `sqlite3 turns.db '.tables'` still shows no `registry_snapshots`

**Given** the pjangler Registry stopped and a snapshot on disk
**When** `curl -s http://127.0.0.1:8787/v1/project/sidepiece` is run
**Then** the status is `200`, the full `ProjectRecord` is returned, and `degraded[]` contains `{"ds":"DS-23","params":{"fetchedAt":"<ISO-8601 UTC>","ageSeconds":"<n>"}}`
**And** `SELECT generation, record_hash FROM resolutions WHERE pjid='sidepiece'` is byte-identical to its value before the outage — a resolution served from the snapshot never advances the generation, because a stale copy is not new information
**And** no pane-gating code is emitted: DS-23 gates nothing, it marks the header

**Given** the pjangler Registry stopped and **no** snapshot on disk — a Bridge that has never had a successful fetch
**When** the same `curl` is run
**Then** the status is `200` and the body is `{"degraded":[{"ds":"DS-6", …}]}` **alone**, with no `ProjectRecord` fields — nothing can be true, so nothing is claimed
**And** both branches of DS-6 and DS-7 are built and separately tested: partial with a snapshot (DS-23 carries the age, panes stay live), total without one

**Given** FR-14(d)'s requirement that "the service is not running" is distinguished from "the Registry returned an error"
**When** the registry host refuses the connection, the DNS name does not resolve, or nothing is listening on the registry port
**Then** the code is `DS-6` with `params.endpoint` naming the registry URL, and `remedy` carries the Bridge-composed start command if the Bridge can compose one — an omitted key, never an empty one
**And** when the registry answers with a non-2xx status or a body that is not parseable JSON, the code is `DS-7` with `params.error` carrying the error **verbatim as the Bridge received it**, never reworded
**And** the DS-6/DS-7 discriminator exists in exactly one function, reused by both the resolution leg and the health leg — proven by a grep showing one definition and two call sites

**Given** D9's ruling that the snapshot's age is surfaced and never enforced
**When** a snapshot with a `fetchedAt` 45 days in the past is the only source available
**Then** it is still served, still marked with its age, and still `200`
**And** `grep -rniE "MAX_AGE|maxAge|EXPIR|STALE_AFTER|TTL" packages/bridge/src/registry/` returns nothing — the absence of a threshold is the decision, not an oversight

*Satisfies: FR-2(a), FR-2(c) (Bridge-side fallback half), FR-14(d), FR-15(d), AR34, AR35, AR36, AR37, UX-DR39 (DS-6, DS-7 — Bridge half), UX-DR45 (DS-23 — Bridge half), UX-DR47 (the total/partial line, Bridge half), UX-DR51*

---

### Story 1.10: Deploy the Bridge as one file, supervised, with the Turn store out of the blast radius

As Jarad, the one operator,
I want `mise run deploy` to bundle the Bridge to a single file, rsync that file to `big-chungus`, and restart a `systemd --user` unit that starts on login and restarts on failure,
So that the Bridge survives a reboot with no manual intervention, and so that a deploy can never half-apply or overwrite the Turn history.

**Acceptance Criteria:**

**Given** `mise run build:bridge`
**When** it completes
**Then** `packages/bridge/dist/bridge.mjs` exists as a **single file** with no sibling `node_modules`, `contract` **inlined** into it, and `node:*` the only external
**And** `grep -c "@sidepiece/contract" packages/bridge/dist/bridge.mjs` returns `0` — an rsync of a workspace symlink is what this exists to prevent
**And** `node packages/bridge/dist/bridge.mjs` starts the Bridge on a machine with no `pnpm` and no `node_modules` anywhere

**Given** `mise run deploy`
**When** it runs
**Then** it rsyncs **that one file** to `big-chungus:~/.local/lib/sidepiece/bridge.mjs` and runs `systemctl --user restart sidepiece-bridge`
**And** it never rsyncs `packages/bridge/` or the workspace
**And** it aborts with a named error if the resolved destination path is at or under `~/.local/state/sidepiece/`

**Given** `~/.config/systemd/user/sidepiece-bridge.service`
**When** it is read
**Then** `ExecStart=` names an **absolute path to a pinned Node 24 binary** — a concrete `24.15.x` install path, never `node` from `PATH`, never a `lts` or `latest` alias, never `~/.local/share/mise/shims/node`
**And** a check in `mise run deploy` runs `<that ExecStart node path> --version`, asserts the output matches `^v24\.` and that the path string contains neither `lts` nor `latest`, and fails the deploy otherwise — `mise` resolves `node/lts` to v24.15.0 today and will move on its own when Node 26 becomes LTS on 2026-10-28
**And** the unit sets `Restart=always`, `RestartSec=2`, `WorkingDirectory=%h/.local/state/sidepiece`, `StateDirectory=sidepiece`, and `[Install] WantedBy=default.target`

**Given** the unit installed and enabled with lingering on
**When** `big-chungus` is rebooted and no one logs in interactively
**Then** `systemctl --user is-enabled sidepiece-bridge` prints `enabled`, `is-active` prints `active`, and `curl -s http://127.0.0.1:8787/v1/health` returns `200` with no manual intervention
**And** after `systemctl --user kill -s SIGKILL sidepiece-bridge` the unit is `active` again within 5 seconds

**Given** two consecutive deploys with real Turn-store and snapshot content on disk
**When** `mise run deploy` is run twice
**Then** `~/.local/state/sidepiece/turns.db` is unchanged by size, mtime and `PRAGMA user_version`, and `registry-snapshot.json` is byte-identical
**And** `~/.local/lib/sidepiece/` contains only `bridge.mjs` — the two directories never intersect

**Given** FR-15(f)
**When** `journalctl --user -u sidepiece-bridge -n 50 -o cat` is run on `big-chungus`
**Then** it shows the structured JSON lines the Bridge emits, with no log aggregator configured or required

*Satisfies: FR-15(a), FR-15(c), FR-15(f), AR24, AR61, AR62, AR63*

---

### Story 1.11: Reach the Bridge from the laptop over the tailnet, on HTTPS, with the LNA headers

As Jarad, the one operator,
I want the Bridge reachable from the laptop at its MagicDNS name over real TLS, answering private-network preflights from day one and logging the actual client,
So that every capability is exercisable with `curl` from either machine — a Bridge that can only be exercised through Chrome makes every bug a two-variable bug.

**Acceptance Criteria:**

**Given** `tailscale serve` fronting the loopback-bound Bridge on `big-chungus`
**When** `tailscale serve status` is run
**Then** it shows `https://big-chungus.burro-salmon.ts.net/v1` proxying to `http://127.0.0.1:8787/v1`
**And** `ss -ltnp` on `big-chungus` still shows the Bridge only on `127.0.0.1:8787`, on no tailnet interface address and on no `0.0.0.0`
**And** nothing about the Bridge is reachable through Traefik, the Cloudflare tunnel, or any `delo.sh` hostname

**Given** the laptop on the tailnet
**When** `curl -s -D- https://big-chungus.burro-salmon.ts.net/v1/health` is run from `carries-macbook-air` **without** `-k`
**Then** the status is `200`, the MagicDNS certificate validates against the system trust store, and the body is the health object
**And** the same command with no `Authorization` header, no token and no cookie succeeds — the Bridge performs no application-level authentication of its caller, because WireGuard device authentication is the trust boundary (NFR-1), and this consequence is recorded in a comment at the top of `server/http.ts` rather than assumed

**Given** AR68's unconditional private-network CORS headers
**When** `curl -s -D- -X OPTIONS https://big-chungus.burro-salmon.ts.net/v1/project/sidepiece -H 'Origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop' -H 'Access-Control-Request-Method: GET' -H 'Access-Control-Request-Private-Network: true'` is run
**Then** the response carries `Access-Control-Allow-Private-Network: true` alongside `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`
**And** the private-network header is present on **every** preflight response, not gated on a feature flag, an environment variable or a Chrome-version check
**And** a comment beside it records that the MagicDNS certificate is explicitly **not** an LNA mitigation — HTTPS is what lets Chrome ask, not what stops it asking

**Given** that `tailscale serve` rewrites the peer address to `127.0.0.1`
**When** requests are made from `carries-macbook-air` and from `big-chungus` itself
**Then** the log lines carry two different client addresses, both read from `X-Forwarded-For`
**And** no log line records `127.0.0.1` as the client for a request that came from the laptop

**Given** NFR-7's requirement that the budgets are measured end-to-end from the laptop, not on loopback
**When** 50 sequential `GET /v1/project/sidepiece` requests are run from `carries-macbook-air` on the same LAN as `big-chungus`
**Then** p95 is at or under 1s, and the measured p50 and p95 are recorded verbatim in the story's transcript alongside the loopback figures from Story 1.6

*Satisfies: FR-15(b), FR-15(d), NFR-1, NFR-7, NFR-10, AR67, AR68*

---

### Story 1.12: Every credential from the vault — and a missing one degrades instead of killing the Bridge

As Jarad, the one operator,
I want the Bridge to resolve every credential from 1Password at startup and again per request, and to stay up and name the missing one when a resolution fails,
So that no plaintext key exists anywhere on disk, and so that a credential failure shows me DS-8 — the right sentence and the right fix — instead of DS-4, which would send me hunting for a host that is fine.

**Acceptance Criteria:**

**Given** `credentials/vault.ts` and the repo's `.env.op`
**When** `.env.op` is read
**Then** every value is an `op://DeLoSecrets/<item>/<field>` reference and no value is a resolved secret — the Plane key is the title form `op://DeLoSecrets/Plane/apiKey`
**And** `grep -rn "op://" packages/ .env.op` shows references only; a scan of every tracked file for a resolved credential value finds none, including in files intended to be gitignored

**Given** the 1Password bootstrap token
**When** the unit is read
**Then** it carries `LoadCredential=op-token:/etc/sidepiece/op-service-token`, reading a root-owned file outside the repo, and the Bridge reads the token from `$CREDENTIALS_DIRECTORY/op-token` at startup
**And** the unit contains no `EnvironmentFile=` and no `Environment=OP_SERVICE_ACCOUNT_TOKEN=`
**And** the token value appears in the environment of the spawned `op` child process only — a test asserting it is absent from the Bridge's own `process.env` and from the environment handed to any other child exits 0
**And** `Environment=OP_BIN=<absolute path to op>` is set in the unit, because `systemd --user` gets a minimal environment and not the login shell's `PATH`

**Given** the vault unreachable or the service token invalid
**When** the Bridge is restarted
**Then** it **starts and stays up**: `systemctl --user is-active sidepiece-bridge` prints `active` and the process never exits non-zero
**And** `curl -s https://big-chungus.burro-salmon.ts.net/v1/health` returns `200` with `degraded[]` containing `{"ds":"DS-8","params":{"credential":"op://DeLoSecrets/Plane/apiKey","dependency":"plane"}}`
**And** the operator sees DS-8, never DS-4 — an implementation that exits non-zero fails this story outright

**Given** FR-16's "at process start **or** per-request", which D18 reads as both
**When** the vault becomes reachable again with the Bridge still running
**Then** the next request that needs that credential resolves it with no restart, and the following health check no longer carries DS-8
**And** a test asserts the per-request retry path exists by resolving once with the vault down and once with it up, in a single process lifetime

**Given** A-P8's rule that a resolved credential is never logged
**When** `journalctl --user -u sidepiece-bridge` is grepped for any resolved secret value used during the run
**Then** there are zero hits
**And** `op://` references do appear in the logs, which is correct and is what makes a failure attributable

*Satisfies: FR-16, FR-14(b) (naming which dependency the missing credential feeds), AR50, AR63, AR64, AR65, UX-DR46 (DS-8 — Bridge half), UX-DR51*

---

### Story 1.13: Health that names the dependency that failed

As Jarad, the one operator,
I want `GET /v1/health` to report each upstream separately, with the failing one named and coded, and to say when my connection is relayed,
So that an unhealthy Bridge tells me which of seven things to go fix instead of handing me a generic error — and so that a missed latency budget on a DERP relay is a stated fact rather than a mystery.

**Acceptance Criteria:**

**Given** `contract/src/health.ts` and `health/aggregator.ts`
**When** `curl -s https://big-chungus.burro-salmon.ts.net/v1/health | jq` is run with everything healthy
**Then** the body carries `status`, `contractVersion`, `node`, `startedAt`, `checkedAt`, `relayed`, `dependencies[]` and `degraded[]`
**And** `dependencies[]` carries one row per upstream — `registry`, `store`, `vault`, `fleet`, `gateway`, `plane`, `bloodbank`, `candystore` — each shaped `{name, status, ds?, detail?, checkedAt, latencyMs?}`
**And** the five upstreams whose adapters this epic has not built (`fleet`, `gateway`, `plane`, `bloodbank`, `candystore`) report `"status":"unprobed"` — never `"ok"`, because reporting an unbuilt probe as healthy is the exact lie this endpoint exists to refuse
**And** adding `CONTRACT_VERSION` as a field here requires no version bump, because adding a field is not a breaking change

**Given** the pjangler registry service stopped
**When** the health endpoint is read
**Then** the `registry` row is `{"name":"registry","status":"failing","ds":"DS-6", …}` and the top-level `degraded[]` carries the same `DS-6`
**And** when the registry instead answers `500`, the row carries `"ds":"DS-7"` with `detail` holding the error verbatim as the Bridge received it
**And** the DS-6/DS-7 discriminator is the single function Story 1.9 built — the aggregator calls it rather than reimplementing it

**Given** AR51's requirement that Bloodbank and Candystore are probed independently so they can produce two different blast radii
**When** the aggregator is read
**Then** they are two separate rows fed by two separate probe functions in two separate adapter folders, both `unprobed` in this epic and each with its own registration point for the epic that builds it
**And** no probe function reports for more than one upstream

**Given** `health/aggregator.ts`'s rule that it feeds FR-3 and never keeps its own list
**When** any dependency row reports `failing`
**Then** it carries a `BridgeDsCode`, and a test asserts no `failing` row can be constructed without one
**And** no dependency row carries a user-facing sentence; `detail` holds only an upstream's own error text, verbatim

**Given** NFR-8's DERP carve-out and DS-15
**When** the laptop's connection to `big-chungus` has fallen back to a DERP relay
**Then** `relayed` is `true` and `degraded[]` carries `{"ds":"DS-15"}`
**And** when the path is direct, `relayed` is `false` and no DS-15 is present
**And** the relay determination is read from `tailscale status --json` for the peer identified by `X-Forwarded-For`, not guessed from latency

**Given** A-P7's rule that every in-flight state has a deadline and a terminal transition, relay or no relay
**When** an upstream hangs and never answers
**Then** its probe times out at 2 seconds and the row becomes `failing` with its code — the health response itself never hangs, never returns a permanent pending, and returns within 3 seconds with every row terminal
**And** a relayed connection changes what an expiry *says*, never whether one exists

*Satisfies: FR-14(a) (Bridge half), FR-14(b), FR-14(c), FR-14(d), FR-15(d), NFR-8, AR17, AR50, AR51, AR67, UX-DR39, UX-DR45 (DS-15 — Bridge half), UX-DR48 (Rules 1 and 1a — Bridge half), UX-DR51*

---

### Story 1.14: Catch the silent credential degradation nothing else on this machine notices

As Jarad, the one operator,
I want the health check to assert, every time it runs, that no config value is still an unresolved `op://` literal and that the PM is answering on the provider and model its profile expects,
So that the failure that ran `hermes-dashboard.service` degraded from 2026-09-09 to 2026-09-17 with nothing noticing cannot happen again — correct-looking answers at the wrong cost and latency are the one failure this product exists to catch.

**Acceptance Criteria:**

**Given** `health/degradation.ts` and assertion 1 — the unresolved-reference scan
**When** any resolved config value still matches `^op://`
**Then** the health response carries `{"ds":"DS-8","params":{"credential":"<the config key>","dependency":"<the dependency it feeds>","probe":"unresolved_reference"}}`
**And** the failure is reproduced end to end: set one config value to the literal string `op://DeLoSecrets/Plane/apiKey` without resolving it, restart, and assert `GET /v1/health` reports DS-8 naming `plane` — the exact shape of the `hermes-dashboard.service` incident
**And** the scan covers every resolved value the Bridge holds, not only the ones a capability has touched this run

**Given** assertion 2 — the provider/model comparison, and AR66's `[ASSUMPTION]` that the gateway reports the resolved model per session
**When** the health check runs in this epic, before any gateway adapter exists
**Then** the `gateway` dependency row carries `expectedProvider` and `expectedModel`, read from the Hermes profile the Bridge is pinned against, and `reportedProvider: null`, `reportedModel: null`, with `"status":"unprobed"`
**And** the comparison itself is named in the story as an **inherited acceptance criterion of Epic 3's `sessions/gateway.ts` story** — the reported half arrives with the gateway adapter, and this story does not stub a fake reported value to make a comparison look implemented

**Given** D18's correction that a startup-only framing makes DS-8 unreachable
**When** two consecutive health checks are made 10 seconds apart with no restart between them
**Then** both executed both assertions — proven by a counter or a per-check `checkedAt` on the degradation rows that advances on each call
**And** an implementation that evaluates the probe only at process start fails this story

**Given** that the two assertions have different causes and different fixes
**When** either fails
**Then** the response distinguishes which one did, via the `probe` param (`unresolved_reference` or `provider_mismatch`), and both may be present at once as two separate `degraded[]` entries
**And** neither assertion emits prose; both emit DS-8 plus typed params, named with the credential and the dependency it feeds
**And** no `remedy` key is emitted for DS-8 — an omitted block, never an empty one, because no FR mandates a command here

**Given** that the next reader will ask why this probe exists
**When** `health/degradation.ts` is read
**Then** a header comment records the dated incident — `hermes-dashboard.service` ran silently degraded from 2026-09-09 to 2026-09-17, starting without vault auth, falling through to unresolved `op://` literals and downgrading to a fallback model — and states that nothing else on this machine compares those two strings

*Satisfies: FR-14(e), FR-16(c), AR65, AR66, UX-DR46, UX-DR51*

---

### Story 1.15: The `bb emit --check` gate, as a `mise` task and never a workflow

As Jarad, the one operator,
I want every Bloodbank producer type this repo declares validated by `bb emit --check` before a deploy can run,
So that an illegal subject — a version token or an identity slug where the five-token grammar forbids one — cannot ship, and so that the gate exists before the first producer is written rather than after the first silent subscription that receives nothing.

**Acceptance Criteria:**

**Given** `packages/contract/src/bloodbank.ts`
**When** it is read
**Then** it exports `PRODUCER_TYPES: readonly string[]`, empty in this epic, with a comment naming it as the single list the gate reads and the epics that will append to it
**And** nothing in this epic hand-assembles a `subject`, `schemaref`, `dataschema`, `kind`, `domain` or `actor` — `bb emit` derives all six

**Given** `mise run bb:check`
**When** it runs against `PRODUCER_TYPES`
**Then** for each entry it first asserts locally that the **type** is exactly 4 dot-separated tokens (`bloodbank.<domain>.<entity>.<action>`) with no token matching `^v\d+$`, failing with the rule named rather than a bare exit code
**And** it then runs `"$BB_BIN" emit --check --type <t>` for each entry, exiting non-zero on any refusal and printing `bb`'s own message verbatim — `bb contract` is the authority, this task is the gate

**Given** a deliberately illegal declaration
**When** `bloodbank.evt.v1.repo.sidepiece.started` is temporarily added to `PRODUCER_TYPES` and `mise run bb:check` is run
**Then** the task exits non-zero and names both violations — the version token and the identity slug
**And** after removing it the task exits 0

**Given** the *Enforcement* vs *Deliberately absent* contradiction in the architecture
**When** Story 1.15 is complete
**Then** the gate exists **only** as a `mise` task, `mise run deploy` declares `depends = ["bb:check"]`, and `ls -d .github` returns "No such file or directory"
**And** the unit gains `Environment=BB_BIN=<absolute path to bb>`, because `systemd --user` does not inherit the login shell's `PATH` and a unit that does works by hand and fails at boot

**Given** EXT-2's illegal subjects in this tree (`agents/hermes/pm/role.yaml:53-54`, `docs/product-brief.md:102`)
**When** `mise run bb:check` runs
**Then** it prints a non-blocking notice naming those three locations and pointing at EXT-2, and still exits 0 for them
**And** it does not edit them — they are fleet configuration for the `sidepiece-pm` agent, not Sidepiece product source, and are filed as out-of-repository work

*Satisfies: AR56, AR63, AR22 — a precondition for Epic 3's FR-8, deliberately not claimed as FR-8 coverage*

---

### Story 1.16: Run the two checks that end the guessing — DS-3 vs DS-4, and LNA on the laptop

As Jarad, the one operator,
I want the two "run it once and stop guessing" checks executed against the live transport and their verdicts written back into the documents that carry the open questions,
So that Epic 2 writes DS-3 and DS-4 only if they are real, and the transport is locked knowing what Chrome actually does on the machine I use.

**Acceptance Criteria:**

**Given** a throwaway unpacked MV3 extension under `spike/lna-probe/` — a manifest with `host_permissions: ["<all_urls>"]` and a service worker, loaded by hand
**When** it is created
**Then** nothing is written under `packages/extension/`, no `wxt` or `shadcn` command is run, and `spike/` is outside the pnpm workspace globs — the extension shell is sequence step 6 and belongs to Epic 2

**Given** the Bridge serving at `https://big-chungus.burro-salmon.ts.net/v1` from Story 1.11, and the probe extension loaded in Chrome on `carries-macbook-air`
**When** `fetch('https://big-chungus.burro-salmon.ts.net/v1/health')` runs from its service worker with the tailnet up
**Then** the result is recorded verbatim: the status, whether any Local Network / Loopback Network permission prompt appeared, and the exact Chrome version from `chrome://version`
**And** the expected result is **no prompt at all**; a prompt is the surprise and is recorded as such, with its exact wording

**Given** PRD §12 Q7's question and the three-point candidate discriminator for architecture O3
**When** the same fetch is run under each of three conditions — (a) `tailscale down` on the laptop, (b) tailnet up but `systemctl --user stop sidepiece-bridge` and `tailscale serve` torn down, (c) a deliberately bogus MagicDNS name `no-such-host.burro-salmon.ts.net`
**Then** for each condition the thrown value's constructor name, `name`, `message`, and the DevTools network-panel failure reason are recorded side by side
**And** the verdict states explicitly whether "MagicDNS did not resolve at all" is distinguishable from "resolved and failed to connect" **from an extension context**

**Given** the verdicts
**When** Story 1.16 is complete
**Then** `architecture.md`'s open item **O3** is replaced in place, dated 2026-09-XX, with one of exactly two rulings: *"DS-3 and DS-4 are distinguishable by `<the discriminator>`; Epic 2 implements both, their wording, triggers and recovery already exist in `EXPERIENCE.md`"*, or *"not distinguishable from an extension context; v1 ships DS-5 as A-P2 specifies and DS-3/DS-4 remain unimplemented"*
**And** PRD §12 **Q7** is updated in place with the LNA result, the Chrome version tested, and the date, and is marked CLOSED or left open with the surprise recorded
**And** no `DsCode` is added or removed from `contract/src/state.ts` by this story — the union already carries all 28, and the verdict decides only whether Epic 2 renders DS-3 and DS-4

*Satisfies: NFR-10, AR14, AR68, architecture O3, PRD §12 Q7*

---

## Epic 2: Open the Cockpit on any page and file a ticket against the thing you are staring at

UJ-1, end to end, on a real page against a real Board. Jarad pins the icon, hits the chord on `holocene.delo.sh`, and the Cockpit opens already showing Holocene's repo name, its clone path — selectable, copyable, wrapping, never elided — and its Board; the Board's Tickets are grouped in the Board's own state order, each key opening its Plane URL in a new tab; he types a title and it lands. No identifier looked up, no terminal, no tab switch. And when anything is broken the panel says **which** thing and what to do about it, in that state's own sentence, with a re-resolve control — never a spinner, never an empty panel, never the last Project left on screen because the last Project was more interesting. After this epic the product's own headline metric, SM-1 — *"I file tickets from the panel instead of the terminal"* — becomes measurable for the first time.

**FRs covered:** FR-1, FR-3, FR-4, FR-12, FR-13. **Inherited acceptance criteria:** FR-2(c) (the bounded cache), FR-14(a)(b) (the Cockpit's health marker), NFR-9's client-side pre-check.

**Exit criterion:** the 28-row router matrix, Story 2.26.

---

### Story 2.1: The pjid declaration contract and the three-page dev fixture

As Jarad,
I want a written, byte-exact `pjid` declaration contract and a set of local fixture pages that exercise every branch of it,
So that every detection story after this one has an acceptance set, and so that whoever eventually emits the tag into a served page has one string to satisfy instead of a paragraph to interpret.

**Acceptance Criteria:**

**Given** the repository at `docs/contracts/pjid-declaration.md`
**When** the contract document is read
**Then** it states the declaration form verbatim as `<meta name="pjid" content="<pjid>">` in `<head>`
**And** it states that the only read is `document.head.querySelector('meta[name="pjid"]')` and that no other selector, attribute or location is in contract
**And** it states `name=` and not `property=`
**And** it states that `<head>` only is in contract, because FR-1 requires the declaration be readable with scripting disabled, so a tag injected into `<body>` is out of contract by construction
**And** it states that the attribute *name* matches case-insensitively while the attribute *value* is never normalised, trimmed, lowercased or otherwise touched and is passed through byte for byte
**And** it states that conflicting declarations take first in document order and report the conflict alongside the resolution, while duplicates that agree are just duplicates
**And** it states that an empty or whitespace-only `content` is DS-1 and never a pjid

**Given** the fixture directory `packages/fixture/` served by `pnpm --filter fixture dev` on a local port
**When** Jarad opens each of the nine fixture pages in Chrome with JavaScript disabled and evaluates `document.head.querySelector('meta[name="pjid"]')?.content` in the console after re-enabling it
**Then** `one-pjid.html` returns exactly `sidepiece`
**And** `no-pjid.html` returns `undefined` (no `meta[name="pjid"]` element at all)
**And** `two-conflicting.html` carries `<meta name="pjid" content="sidepiece">` before `<meta name="pjid" content="holocene">` and the first-in-document-order read returns `sidepiece`
**And** `two-agreeing.html` carries the same value twice and returns that value with no conflict to report
**And** `empty-content.html` carries `content=""` and returns the empty string
**And** `whitespace-content.html` carries `content="   "` and returns three spaces
**And** `wrong-attribute.html` carries `<meta property="pjid" content="sidepiece">` and the in-contract selector returns `undefined`
**And** `body-declared.html` carries the tag inside `<body>` and the in-contract selector returns `undefined`
**And** `uppercase-name.html` carries `<meta NAME="pjid" content="sidepiece">` and returns `sidepiece`, proving the attribute name matches case-insensitively

**Given** `spa.html`, the tenth fixture page
**When** its two buttons are clicked
**Then** one calls `history.pushState({}, '', '/route-b')` and rewrites the `<head>` meta to `content="holocene"` without a document load
**And** the other calls `history.pushState({}, '', '/route-c')` and removes the meta from `<head>` entirely
**And** neither fires `popstate`, which is what makes this page the acceptance fixture for FR-1(b)

**Given** the pjid-emitter decision has no owner in any document (architecture O1 / PRD §12 Q4)
**When** this story closes
**Then** `docs/decisions/pjid-emitter.md` exists and records which of the three costed options Jarad chose — a pjangler recipe (19 Projects in one change, costs a change to another repo), per-project template changes (no cross-repo work, 19 hand edits, later Projects inert), or manual-per-surface (zero up-front cost, DS-1 becomes the permanent default state of the product)
**And** it states in one line that until that option is implemented, the shipped product resolves nothing on a real page and every acceptance in this epic runs against this fixture

*Satisfies: FR-1(a), FR-1(c), FR-1(e), AR70, EXT-3*

---

### Story 2.2: Cold-install font measurement, before any drawn number is trusted

As Jarad,
I want both bundled faces installed in the repo and every per-character advance in the two UX spines re-measured against them,
So that no layout acceptance criterion in the rest of this epic is written against a mock that rendered Noto Serif at 0.897× and was therefore looser than the shipped panel will ever be.

**Acceptance Criteria:**

**Given** the repository has no `assets/fonts/` directory
**When** this story lands
**Then** `assets/fonts/` contains exactly seven woff2 files: `CharisSIL-Regular`, `CharisSIL-Italic`, `CharisSIL-Bold`, `CharisSIL-BoldItalic`, `IBMPlexMono-Regular`, `IBMPlexMono-Medium`, `IBMPlexMono-SemiBold`
**And** no file is fetched at runtime, no `local()` appears in any `src`, and no Google Fonts link, `@import` or remote URL is introduced anywhere

**Given** the measurement harness at `tools/font-measure/index.html`
**When** it is opened in Chrome with `font-synthesis: none` set on `:root` and `font-display: block` on every face
**Then** it renders each of the six type roles at its tokened size, weight, line-height and letter-spacing — heading 22/700/1.05/-0.015em, body 13.5/400/1.55/normal, label 11.5/500/1.35/0.04em, micro 10.5/500/1.3/0.10em, mono 11.5/400/1.45/0.01em, numeral 10/600/1/0em
**And** it prints the measured advance per character for each role, computed from a 100-character run divided by 100, to three decimal places
**And** it prints the measured body line box height

**Given** the harness output
**When** it is compared against the drawn figures — mono 7.015px/char, label 7.36px/char, micro 7.35px/char, numeral 6.00px/char, body ≈6.35px/char, body line box 20.93px
**Then** `docs/measurements/font-advances.md` records each measured figure beside its drawn figure and the signed delta
**And** it records the three derived numbers that move with them: the identity header meta row budget (drawn 183px on `SIDE`, 212px on `HOLOCENE`, against 284px), the pane-switch per-cell label budget, and the ticket-row title measure (drawn 207px ≈ 32 serif characters on a `SIDE`-length key, 179px ≈ 28 on an `HOLOCENE`-length key)
**And** it states in one line which of those three, if any, no longer fits at the measured advances

**Given** any layout acceptance criterion written in a later story in this epic
**When** it quotes a character budget or a pixel fit
**Then** it quotes the figure from `docs/measurements/font-advances.md` and not the figure from `DESIGN.md`, which is recorded as the optimistic case

*Satisfies: UX-DR3, UX-DR4, UX-DR91*

---

### Story 2.3: The WXT extension shell that loads in Chrome

As Jarad,
I want an unpacked extension that Chrome loads with no errors and an action icon I can pin,
So that there is a real surface to render into, and so that the manifest's one-way doors — the broad host match, the absent `default_popup`, the command slots — are decided once and never re-litigated.

**Acceptance Criteria:**

**Given** the monorepo from Epic 1 with `packages/contract/` already a workspace package
**When** `pnpm dlx wxt@latest init` is run with the **react** template into `packages/extension/`
**Then** `packages/extension/wxt.config.ts` declares **`srcDir: 'src'`**
**And** `packages/extension/src/entrypoints/` contains `background/`, `content/` and `sidepanel/`, and `pnpm --filter extension dev` discovers all three — verified by asserting each entrypoint appears in `.output/chrome-mv3/manifest.json`, because `srcDir` defaults to `"."` and WXT does not auto-detect a `src/` directory, so omitting that one line discovers none of them
**And** `packages/extension/tsconfig.json` extends `tsconfig.base.json` and `packages/extension/package.json` depends on `contract` by workspace protocol

**Given** the built `.output/chrome-mv3/manifest.json`
**When** it is read
**Then** `host_permissions` is exactly `["<all_urls>"]`
**And** `permissions` is exactly `["sidePanel", "storage", "tabs"]`
**And** `activeTab`, `debugger` and `webNavigation` do **not** appear anywhere in it
**And** `action` is declared with **no** `default_popup` key
**And** `content_scripts` is one entry, `matches: ["<all_urls>"]`, `run_at: "document_idle"`, declared in the manifest rather than injected via `scripting.executeScript`
**And** `commands` contains exactly one entry, `_execute_action` at `Alt+Shift+S`, `global: false` — `focus-ticket-title` is **not** declared here because its handler does not exist until Story 2.23 and a declared-dead shortcut occupies a slot Chrome will not give back
**And** `arm-picker` and `discharge-batch` appear nowhere

**Given** `WXT_BRIDGE_ORIGIN`
**When** the extension is built
**Then** the value is baked at build time — `http://127.0.0.1:8787` in dev, the Tailscale MagicDNS origin over HTTPS in the deploy build — and no settings page, options page or first-run surface is created for it

**Given** `assets/fonts/` from Story 2.2
**When** the extension is built
**Then** all seven woff2 files are emitted into the output bundle and are reachable from the panel document at a build-stable path

**Given** AR12's open `[ASSUMPTION]` — both UX spines say WXT's `createShadowRootUi` yields a **closed** shadow root and WXT's own documentation does not state it
**When** the one-line check is run against the pinned WXT v0.21.4 in this scaffold: call `createShadowRootUi`, then read `element.shadowRoot` from the page context
**Then** the answer is recorded in `docs/measurements/wxt-shadow-root.md` with the WXT version and the date — `closed` if `shadowRoot` reads `null`, `open` if it reads a node
**And** if the root is open, the record states the two options AR12 names — accept it, or wrap it ourselves — and says which was taken, so the `[v2]` in-page layer is never built on an assumption nobody checked
**And** nothing of the `[v2]` in-page layer is built here: the check is a check, and `hoverOutline`, `commentBubble`, `freehandLayer` and `annotationPin` are not created

**Given** a freshly built unpacked extension
**When** it is loaded at `chrome://extensions` with Developer mode on
**Then** the broad host-match permission prompt appears once and is accepted
**And** `chrome://extensions` shows zero errors and zero warnings for the extension
**And** the action icon appears in the toolbar overflow and can be pinned

*Satisfies: NFR-6, AR1, AR2, AR4, AR7, AR8, AR12, AR69, UX-DR53, UX-DR77*

---

### Story 2.4: Detect a declared pjid on page load

As Jarad,
I want the content script to read the declaration off any page the moment it loads and report it to the service worker,
So that the page-to-project link exists in the browser rather than only in a curl transcript.

**Acceptance Criteria:**

**Given** the content script at `packages/extension/src/entrypoints/content/`
**When** it runs at `document_idle` on any page
**Then** it reads the declaration with `document.head.querySelector('meta[name="pjid"]')` and with nothing else — no `document.querySelector`, no `getElementsByTagName`, no `property=` fallback
**And** it passes the `content` attribute value through byte for byte, with no `trim()`, no case change and no normalisation of any kind
**And** it sends one `runtime.sendMessage` carrying `{ pjid: string | null, conflict: string[] | null, url: string, title: string }`

**Given** `one-pjid.html` from the fixture
**When** it loads
**Then** the service worker receives `pjid: "sidepiece"` and `conflict: null`

**Given** `two-conflicting.html`
**When** it loads
**Then** the service worker receives `pjid: "sidepiece"` — first in document order — and `conflict: ["sidepiece", "holocene"]`, so the conflict is reported alongside the resolution rather than instead of it

**Given** `two-agreeing.html`
**When** it loads
**Then** `conflict` is `null`, because duplicates that agree are just duplicates

**Given** `no-pjid.html`, `empty-content.html`, `whitespace-content.html`, `wrong-attribute.html` or `body-declared.html`
**When** any of them loads
**Then** the service worker receives `pjid: null`, which is the DS-1 condition
**And** in no case does it receive the previously detected pjid from a prior page

**Given** a page on an origin the extension has never seen
**When** it loads
**Then** detection succeeds identically — the content script's reach is its `<all_urls>` match pattern and nothing origin-specific exists anywhere in the detection path

**Given** `performance.mark()` around the content script's read
**When** detection is measured across 20 loads of `one-pjid.html`
**Then** the elapsed time from navigation complete to the `runtime.sendMessage` call is ≤500ms on every one of the 20, and the measured p95 is recorded in `docs/measurements/detection.md`

*Satisfies: FR-1(a), FR-1(c), FR-1(e), NFR-6, NFR-7, AR70*

---

### Story 2.5: Re-detect on SPA route change and on tab switch

As Jarad,
I want detection to re-fire when a page replaces itself without a document load and when I switch tabs,
So that the panel is never showing a Project the active tab stopped being about — which is the one failure the whole generation guard exists to catch.

**Acceptance Criteria:**

**Given** the content script from Story 2.4
**When** it finishes its first read
**Then** it installs a `MutationObserver` on `document.head` observing `childList` and `subtree` with `attributes: true` and `attributeFilter: ['content', 'name']`
**And** it does **not** call `chrome.webNavigation` — the permission is not declared and the signal is observable from the content script itself
**And** it does **not** rely on `popstate`, which fires on back/forward and never on a `pushState` call, and a test asserts the re-detection path works with no `popstate` listener registered anywhere

**Given** `spa.html` from the fixture
**When** the button calling `history.pushState` and rewriting `<head>` to `content="holocene"` is clicked
**Then** the service worker receives a fresh detection message carrying `pjid: "holocene"` within 500ms
**And** the message is dispatched to the panel document **if one is open** — there is no panel document until Story 2.12, so this story asserts the message and its payload, and Story 2.25 asserts the in-place re-render onto the new `(pjid, generation)`
**And** the replaced value never reaches a consumer as `sidepiece`: a test asserts the last detection the service worker holds for that tab is `holocene`

**Given** the same page
**When** the button that removes the meta from `<head>` is clicked
**Then** the service worker receives `pjid: null` and the route change is treated exactly like a navigation, including into DS-1

**Given** the service worker
**When** `chrome.tabs.onActivated` or `chrome.tabs.onUpdated` fires
**Then** it re-evaluates against the newly active tab and messages the single long-lived panel document — when one is open — to re-render in place; the message is asserted here, the render in Story 2.25
**And** it does **not** call `chrome.sidePanel.setOptions({ tabId })` anywhere, so exactly one panel document exists per window and no per-tab override can drift

**Given** a tab whose URL scheme is `chrome://`, `chrome-extension://`, `edge://`, `devtools://`, `about:`, `data:` or `chrome.google.com/webstore` / `chromewebstore.google.com`
**When** it becomes active
**Then** the service worker receives no detection message because Chrome will not run the content script there
**And** it classifies that tab as **DS-21** rather than DS-1, on the URL scheme plus the absence of a content-script response, and never asserts a positive fact about a page nothing was read from

*Satisfies: FR-1(b), FR-1(d), FR-1(f), NFR-3, AR71, AR72, UX-DR74*

---

### Story 2.6: The 54-token system, the five marks, and Night Paper

As Jarad,
I want every colour, type role, radius, spacing step and state mark defined in exactly one place, and the panel to follow the OS theme while it is open,
So that no component invents a value, the One Black Rule survives a de-duplicating build step, and a state is never carried by a hue that two tokens share.

**Acceptance Criteria:**

**Given** `packages/extension/src/styles/tokens.css`
**When** it is read
**Then** it is the single definition of all 54 tokens — 32 colours + 6 typography roles + 3 rounded + 8 spacing + 5 marks — at the exact nested paths `EXPERIENCE.md` references, as custom properties named for `{colors.surface.panel}`, `{colors.state.ok}`, `{typography.mono}`, `{spacing.glyph}`, `{marks.failed}` and the rest
**And** it declares `color-scheme: light` on `:root` in **both** modes, because Night Paper is still a light ground at Lrel 0.709
**And** it declares `font-synthesis: none` on `:root`
**And** the 32 colour tokens carry exactly the `DESIGN.md` frontmatter hex values, with `surface.spotWash` `#FFE4EC`, `text.machine` `#1B3FA0`, `state.degraded` `#8A5A0B`, `action.mark` `#FF2E63`, `overlay.scrim` `rgba(255,46,99,0.14)`

**Given** a build-time guard over the token set
**When** it runs
**Then** it asserts **nine** tokens carry `#191713` — `surface.stamp`, `border.strong`, `text.primary`, `text.onSpot`, `state.failed`, `action.primary`, `overlay.keylineDark`, `focus.ring`, `selection.ink` — and fails if any is collapsed into another
**And** it asserts four carry `#F2EDE3` and three carry `#FF2E63`, likewise uncollapsed
**And** the guard is written against **nine**, not the seven `DESIGN.md`'s prose enumerates, because the frontmatter is the token data and wins
**And** any `{colors.*}` / `{typography.*}` / `{spacing.*}` / `{rounded.*}` / `{marks.*}` reference in `EXPERIENCE.md` that resolves to no declared custom property fails the build, as does any declared token referenced nowhere

**Given** `packages/extension/src/styles/tailwind.css`
**When** its `@theme` block is read
**Then** every entry aliases a custom property (`--color-surface-panel: var(--surface-panel)`) and **no entry restates a literal value**, because a `@theme` block cannot hold a media query and one carrying literals ships a Cockpit that never reaches Night Paper
**And** the one-time hex→OKLCH conversion `shadcn init` performs on Tailwind v4 is recorded as generated output, with `DESIGN.md`'s hex kept as the documented source of truth and never hand-edited in the OKLCH direction

**Given** the five `marks.*`
**When** they render
**Then** `marks.ok` is a 7×1px bar at weight 400, `marks.degraded` a filled triangle 8px base × 7px rise at 500, `marks.failed` a 7×7px filled square at 600, `marks.unknown` a 7×7px hollow circle with a 1px ring at 400 — all four drawn in `currentColor`, centred in an 11px `{spacing.glyph}` box, as CSS geometry
**And** `marks.pending` is the typed character `»` U+00BB set in `{typography.micro}` at 500
**And** no SVG, icon font or emoji appears in any mark
**And** a generator that emits a `colors.state` value without its `marks` sibling **fails the build**, because on the token layer alone `state.ok` and `state.unknown` are the identical hex and only the mark separates them

**Given** `@media (prefers-color-scheme: dark)`
**When** the override block is read
**Then** it carries exactly thirteen declarations overriding fifteen values — `surface.panel` `#E0D9C8`, `surface.raised` `#EAE4D6`, `surface.sunken` `#D3CAB6`, `surface.spotWash` `#F7CFDB`, `border.hairline` `#BCAF93`, `border.faint` `#CFC5AE`, `border.sheet` `#B3A68C`, `text.muted` `#565040` (which also carries `state.ok` and `state.unknown`, three tokens in one declaration), `state.degraded` `#6F460A`, `action.markDeep` `#A3002F`, `text.inverse` `#E0D9C8`, `focus.ringInner` `#E0D9C8`, `selection.ground` `#F7CFDB`, plus `--sheet-offset` hardening to `3px 3px 0 rgba(0,0,0,.45)`
**And** `surface.stamp`, `surface.overlay`, `border.strong`, `text.primary`, `text.machine`, `text.onSpot`, `state.pending`, `state.failed`, `action.primary`, `action.mark`, `focus.ring`, `selection.ink` and all five `overlay.*` are byte-identical across modes
**And** the panel follows a live OS theme change **while open**, driven by the `change` event on `matchMedia('(prefers-color-scheme: dark)')` and not by a sample taken at load

**Given** the contrast audit test
**When** it runs
**Then** it produces three outcomes, not one: **PASS** for every body pair ≥4.5:1 and every non-text pair ≥3:1; **ACCEPTED-FAIL** for a hard-coded allowlist of exactly seven — `border.hairline` 1.49:1, `border.faint` 1.23:1, `border.sheet` 1.59:1, `surface.raised`-on-panel 1.10:1, `surface.sunken`-on-panel 1.12:1, `selection.ground` 1.02:1, `action.mark`-on-paper 3.09:1; and **FORBIDDEN**, which fails the build, for any `colors.state.*` value rendered on `{colors.surface.stamp}` and for white on the spot ground
**And** `action.mark` at 2.56:1 on night paper is recorded in the allowlist as an accepted failure, and the `markDeep` fix is explicitly rejected because signature invariance is a behavioural constraint

**Given** `{rounded}`
**When** any Cockpit surface renders
**Then** every corner radius inside the Cockpit is `0px` and no `{rounded.pill}` appears anywhere in it
**And** the only horizontal inset in the column is `{spacing.gutter}` 14px

*Satisfies: UX-DR1, UX-DR2, UX-DR5, UX-DR6, UX-DR7, UX-DR8, UX-DR9, UX-DR65, AR9, AR10*

---

### Story 2.7: The copy module and the five byte-exact PRD literals

As Jarad,
I want every user-visible sentence in one module, each one unique to one state, with the five PRD-dictated strings asserted byte for byte,
So that no sentence is authored at a call site, no two causes share a sentence, and the panel never says "something went wrong".

**Acceptance Criteria:**

**Given** `packages/extension/src/copy/`
**When** it is read
**Then** `states.ts` carries all **28** DS codes' headline and detail pairs, keyed by `DsCode` from `contract/src/state.ts`, typed so that a missing code fails `tsc`
**And** `progress.ts` carries every normal-path string — `` Resolving `<pjid>`. ``, `` Resolution didn't come back inside 1s for `<pjid>`. ``, `Reading the Board.`, `The Board read didn't come back inside 2s.`, `This Board is empty.`, `Loading this Project's Turns.`, `The Project changed while that was in flight. Nothing was written.`, `Created, but the Board read didn't come back. Refetch to see it.`
**And** `icon.ts` carries the four icon titles plus the one transient
**And** no user-visible string literal exists anywhere outside `copy/` — a lint over `src/` fails on a JSX text node or a string passed to a render path that is not a `copy/` import

**Given** the uniqueness lint over `copy/states.ts`
**When** it runs
**Then** it fails if any headline or detail string appears under two DS codes, because distinct causes get distinct sentences
**And** it fails on `something went wrong`, `an error occurred`, `Oops`, `Sorry`, any `!`, any emoji, and on `probably`, `should have`, `may have`
**And** it fails on the glossary synonyms `sidebar`, `the panel` (except inside the compound `panel document`), `message` for Turn, `issue`, `bug`, `bot`, `assistant`, `server` for Bridge, and lowercase `project` used for a Project

**Given** `copy/literals.ts`
**When** the test asserting the PRD literals runs
**Then** it asserts byte-for-byte equality on `the PM has your turn`, `warming up the PM`, `this tab is resolvable` and `declared but unknown`
**And** it asserts `declared but unknown` appears inside the DS-2 headline `` `<pjid>` — declared but unknown. ``
**And** for the fifth PRD item it asserts the **presence of the degraded-connection indicator component**, not a literal, because the PRD names a component there; the indicator's own sentence is `Relayed connection. Timings below are not the usual ones.`

**Given** the wire rule
**When** any Bridge response is rendered
**Then** every DS code, normal-path state and icon title resolves to its sentence in `copy/` and not from the response body
**And** the **one exception** is remedy command text: DS-11's provisioning command and DS-14's board-binding command are rendered verbatim as the Bridge composed them
**And** where an FR mandates a command and the Bridge returns none, the Cockpit renders the state's own sentence plus `The Bridge did not return the command for this. That is a Bridge bug.` and logs it
**And** where no FR mandates one, the command block is **omitted entirely** rather than rendered empty

**Given** a machine identifier in any sentence — a pjid, a clone path, a Board identifier, a correlation id, a command string
**When** it renders
**Then** it is set in `{typography.mono}` at `{colors.text.machine}`, is complete, and carries no `text-overflow: ellipsis` anywhere in its computed style

*Satisfies: FR-3(a), UX-DR49, UX-DR50, UX-DR51, UX-DR59, AR15*

---

### Story 2.8: `lib/bridge.ts` — the one module that talks to the Bridge

As Jarad,
I want a single module that makes every request to the Bridge, bounded, usable from both the panel and the service worker, and producing the transport states itself,
So that the worker can light the icon with the Cockpit closed without ever holding a connection long enough to be killed, and so that a Bridge built against a different contract is caught before it half-parses a Project Record.

**Acceptance Criteria:**

**Given** `packages/extension/src/lib/bridge.ts`
**When** the extension source is searched
**Then** it is the **only** module that performs a request — no other file under `src/` contains `fetch(`, `XMLHttpRequest` or `EventSource`
**And** every call it exposes carries an `AbortController` with a timeout bounded well under 30s, which is what makes it safe to call from the service worker
**And** it is importable from `entrypoints/sidepanel/` and from `entrypoints/background/` and works identically in both

**Given** the Bridge is not answering
**When** `lib/bridge.ts` catches the opaque `TypeError` a failed fetch throws from an extension context
**Then** it produces **DS-5**, whose sentences are `Can't reach the Bridge.` / `The tailnet looks up, but Sidepiece can't tell whether the host is down or the Bridge is stopped.`
**And** it produces DS-5 and not DS-3 or DS-4, because A-P2 ships DS-5 as v1's fallback answer

**Given** Epic 1's spike (architecture O3) returned a verdict on whether MagicDNS distinguishes "off the tailnet" from "`big-chungus` is not answering"
**When** the verdict is *distinguishable*
**Then** `lib/bridge.ts` applies the discriminator the spike recorded and produces **DS-3** (`The laptop is off the tailnet.` / `` `burro-salmon.ts.net` isn't up on this machine, so the Bridge can't be reached. ``) or **DS-4** (`` `big-chungus` isn't answering. `` / `The tailnet is up. Nothing is listening at the Bridge.`) instead of DS-5
**And** when the verdict is *not distinguishable*, DS-3 and DS-4 are not produced by v1 at all and DS-5 is the whole answer, with the spike's verdict cited in a one-line comment at the branch

**Given** the `CONTRACT_VERSION` handshake
**When** the panel document opens
**Then** `lib/bridge.ts` compares its bundled `CONTRACT_VERSION` against the Bridge's, read from `GET /v1/health`'s body **and** from the `X-Sidepiece-Contract` header on every response
**And** it compares again on every health transition unreachable→reachable
**And** a mismatch in either direction produces **DS-27**, `Sidepiece and the Bridge are on different contracts.` / `` `<side>` is the older one. ``, where `<side>` is the literal `Sidepiece` or `the Bridge`
**And** DS-27 is produced by the Cockpit, because the Bridge cannot know what the client was built against

**Given** `GET /v1/health`
**When** it answers
**Then** `lib/bridge.ts` exposes the Bridge condition as one of exactly four — reachable, unreachable, reachable-but-unhealthy, not yet known — and never reports reachable before it has an answer
**And** when the condition is reachable-but-unhealthy it carries the failing dependency name the Bridge reported (Registry, Plane, Bloodbank, Agent gateway) as typed data, not as prose

**Given** every mutating call
**When** it is composed
**Then** `lib/bridge.ts` attaches `generation` as a top-level field in the **request body**, never as a header, and the pjid in the path
**And** it compares the held generation against the last one the Bridge returned and **refuses locally first** when `held < current`, so the common case costs no round trip
**And** a `409` carrying `{ "error": "stale_generation", "pjid": "<pjid>", "received": <n>, "current": <n> }` is surfaced as a typed `Refusal` and never as a `DsCode`

**Given** any Bridge response for a resolved Project
**When** it is parsed
**Then** `generation` is read from the top level of that response, whatever the route, so a client that has done anything since the record changed already holds the current value

*Satisfies: FR-14(a), FR-14(b), NFR-3, NFR-9, AR14, AR17, AR22, AR38, AR39, AR40, AR41, AR75, UX-DR15, UX-DR39*

---

### Story 2.9: `lib/cache.ts` — FR-2's bounded per-pjid resolution cache

As Jarad,
I want the identity header to paint from a bounded local cache before the Bridge answers, with its age on screen and four explicit ways to die,
So that a reopen is one frame faster without ever becoming the reason a stale Project stays on screen.

**Acceptance Criteria:**

**Given** `packages/extension/src/lib/cache.ts`
**When** it writes
**Then** it writes to `chrome.storage.local` under the key `fr2:<pjid>`, one entry per pjid
**And** the entry is exactly `{ record: ProjectRecord, fetchedAt: "<ISO-8601 UTC string>" }` with **no** third `generation` field, because the generation already lives inside `record`
**And** a write **replaces the entry whole** and never patches a field
**And** it caches exactly one thing — the Project Record, for the identity header. A test asserts no Ticket, Turn, outcome or Board read is ever written under an `fr2:` key
**And** it does **not** go through `lib/storage.ts`, which owns the separate continuity keyspace (draft, pane selection, collapse state)

**Given** an entry older than **5 minutes** by its `fetchedAt`
**When** it is read
**Then** it is treated as absent and the read falls through to the Bridge

**Given** the four invalidation triggers
**When** any of them occurs
**Then** the entry for that pjid is removed: TTL expiry; an explicit re-resolve from any FR-3 state, which bypasses the cache entirely on the way out; a Bridge health transition unreachable→reachable observed by `lib/bridge.ts`; and the generation advancing for that pjid
**And** the generation trigger fires when the client **learns** of an advance, never when it produces one

**Given** two Chrome windows, each with its own panel document
**When** one writes an `fr2:` entry
**Then** the other learns of it through `chrome.storage.onChanged` and does not poll
**And** the service worker need not be alive at the moment of the write for the entry to be there when it next wakes

**Given** `unlimitedStorage`
**When** the manifest is read
**Then** it is not declared, and no orphan sweeper exists anywhere — the TTL collects them

**Given** anything rendered from a cached entry
**When** it paints
**Then** it carries its age as an as-of marker until the Bridge confirms
**And** deleting the whole `fr2:` keyspace leaves the product one frame slower and thereafter identical — a test deletes it mid-session and asserts every rendered fact still arrives

**Given** `chrome.storage.local.get` throws or returns empty
**When** the cache is read
**Then** the read is wrapped, the surface renders its empty default, and the product works

*Satisfies: FR-2(c), NFR-4, AR76, AR77, AR78, UX-DR48*

---

### Story 2.10: The extension icon's four resolvability states

As Jarad,
I want the toolbar icon to tell me whether the tab I am on is resolvable before I click it,
So that opening the Cockpit is an informed click — which is the only compensation available for the fact that Chrome will not let it auto-open.

**Acceptance Criteria:**

**Given** `packages/extension/src/entrypoints/background/icon.ts`
**When** a detection result arrives for the active tab
**Then** it sets exactly one of four states, as states of the **active tab's resolvability** — whether the Cockpit is open is a separate axis the icon does not render

**Given** the active tab declares a pjid that resolved, or that `lib/cache.ts` holds as resolved
**When** the icon updates
**Then** the glyph is the active one at `{colors.state.ok}`
**And** the title is exactly `this tab is resolvable` — asserted byte for byte, lowercase, no trailing period

**Given** the active tab declares no pjid (DS-1)
**When** the icon updates
**Then** the glyph is the inactive one at `{colors.text.muted}` and the title is `This tab declares no pjid.`

**Given** Chrome will not run the content script on the active tab (DS-21)
**When** the icon updates
**Then** the glyph is the **same** inactive glyph, with its own title `Sidepiece can't read this page.`

**Given** a pjid is declared but the Bridge has not answered, or answered DS-2
**When** the icon updates
**Then** the glyph is at `{colors.state.unknown}` and the title is `This tab declares a pjid Sidepiece hasn't resolved.`

**Given** any of the four states
**When** the icon is inspected
**Then** `chrome.action.setBadgeText` has never been called — there is no badge in v1, no count, no Project name and no dot that means "something happened"

**Given** `icon.ts`
**When** its imports are read
**Then** it imports `lib/cache.ts` and `lib/bridge.ts` directly, because the Resolvable state must fire with the Cockpit closed

*Satisfies: FR-1(d), NFR-5, UX-DR78, UX-DR36, AR75, AR76*

---

### Story 2.11: Open and close the Cockpit on the icon and on Alt+Shift+S

As Jarad,
I want one gesture in one place that opens the Cockpit and the same gesture that closes it,
So that the product has a reliable front door rather than an intermittent one — which is what an `await` in the wrong place produces, with no thrown error to find it by.

**Acceptance Criteria:**

**Given** `packages/extension/src/entrypoints/background/`
**When** the service worker starts
**Then** it calls `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`
**And** the manifest declares no `default_popup`, because a popup displaces that behaviour and it is the product's only close gesture

**Given** `entrypoints/background/gesture.ts`
**When** its source is read
**Then** the path from the gesture to `chrome.sidePanel.open()` contains **zero** `await` keywords and **zero** `.then()` calls before the `open()` call
**And** `sidePanel.open()` is the first synchronous statement in its handler
**And** the path crosses at most **one** `runtime.sendMessage` hop, because Chrome curries a user gesture across exactly one hop and the curried gesture cannot be re-forwarded
**And** the service worker's `onMessage` handler is written callback-style with zero awaits, from day one, even though v1 has nothing else to summon it
**And** a lint rule fails the build on an `await` or `.then()` anywhere in `gesture.ts`

**Given** the action icon is pinned
**When** it is clicked on a tab in any of the four icon states, including the degraded ones
**Then** a closed Cockpit opens and an open Cockpit closes — the click is a toggle in all four states
**And** the icon does not render which way the next click will go

**Given** `Alt+Shift+S`
**When** it is pressed
**Then** `_execute_action` fires with no handler of our own, and the toggle behaves identically to the click

**Given** the Cockpit is open
**When** its rendered controls are enumerated
**Then** **no** control claims to dismiss it, because `sidePanel.close()` and `toggle()` do not exist inside the panel document and an X that does not work is worse than no X

**Given** Chromium bug 415694848 (`sidePanel.open()` throwing on the second click after a manual close)
**When** the verification step is run against the installed Chrome version — open, close manually, click again, repeated 10 times, with the Chrome version recorded in `docs/measurements/gesture.md`
**Then** the result is recorded as reproduced or not reproduced on that version
**And** whether or not it reproduces, the handling ships: on a throw from `open()`, the service worker replaces the current icon state's title with `Sidepiece couldn't open. Click again.` until the next successful open, then restores it
**And** the failure is **not** swallowed to the console, and it is typed as `IconTransient` rather than as a `DsCode`, because it is a property of this click and not of the Project

*Satisfies: NFR-5, AR14, AR69, AR73, UX-DR53, UX-DR56, UX-DR78*

---

### Story 2.12: The Cockpit shell — 284px, one scroll region, pinned chrome

As Jarad,
I want the panel's frame settled once — its column, its clip band, its single scroll region and its pinned action bar —
So that every component measured after this one is measured against a frame that does not move, and so that the contradiction between "grows upward to a cap" and "one scroll region on screen" is resolved before anything is built into it.

**Acceptance Criteria:**

**Given** the panel document at its 320px design width, which is also Chrome's hard floor
**When** the usable column is measured
**Then** it is **284px**, derived as 320 − 2px sheet border − 6px ticked signature spine − 28px (`{spacing.gutter}` × 2)
**And** the full-bleed width, used by the clip band and the pane-switch seam, is **318px** (320 − 2px sheet border)
**And** the stylesheet contains **no `@media (min-width:` or `max-width:` rule of any kind** — there are no breakpoints, because the extension can neither set, suggest nor read the width
**And** nothing is centred: every label, value and row starts at the gutter
**And** at widths above 320px the extra width buys longer unwrapped paths and more visible text, and a test asserts no second column and no additionally revealed pane appears at 500px

**Given** the clip band at the top of the panel
**When** it renders
**Then** it is 24px tall, full-bleed at 318px, carrying `SIDEPIECE` in `{typography.micro}` and **nothing else**
**And** the `BRIDGE UP · LAN` readout is **removed** — FR-14's health marker on the identity header meta row is the single Bridge readout in the product, because two readouts 40px apart is a dashboard and health is never a dashboard

**Given** the panel's layout tree
**When** every element's computed `overflow-y` is enumerated
**Then** exactly **one** element resolves to `auto` or `scroll`: the body region
**And** the header and the action bar are pinned and never scroll
**And** the only other scrollable things in the document are focused form controls, which is a form-control scroll and not a pane

**Given** the action bar
**When** its height is measured
**Then** it is **intrinsically sized** — `height: auto`, no `max-height`, and the **188px cap is removed**
**And** the body is `flex: 1 1 0; min-height: 0; overflow-y: auto`, so the action bar growing shrinks the body rather than scrolling inside itself
**And** a text field inside the action bar grows to at most **6 rendered lines** (6 × the measured body line box) and then scrolls natively as a focused `<textarea>`; this is the single sanctioned exception to the one-scroll-region rule and it applies only to a focused text control, never to a `<div>` and never to a pane
**And** no type size is reduced anywhere to absorb the growth

**Given** a fixture element standing in the action bar at the composer's worst **specified** height — 269px, computed from `DESIGN.md`'s composer stack with FR-10's URL revealed, which Epic 3 builds into this same slot
**When** the body is measured
**Then** the body's computed height equals panel height − header height − action bar height and is never negative
**And** the body is permitted to reach zero height while the action bar is that tall, which is acceptable because the operator is typing and not reading at that moment, and the bar returns to rest on send

**Given** `{colors.border}` usage across the shell
**When** the hairline audit test runs — remove every `{colors.border.hairline}` rule from a screen and look for a region that becomes ambiguous
**Then** the action bar is **not** one of them: its boundary is a 1px `{colors.border.strong}` seam, promoted from the 1.49:1 hairline, because a 1.49:1 hairline is the composer's only boundary if the grounds are taken literally and that fails `DESIGN.md`'s own audit

*Satisfies: NFR-2, NFR-3, UX-DR58, UX-DR70, UX-DR79, UX-DR80, UX-DR87, AR11*

---

### Story 2.13: The identity header — repo name, selectable clone path, Board

As Jarad,
I want the Cockpit to show me which Project this tab is, with a clone path I can select and copy and a Board identifier I can read,
So that the page-to-project link is visible rather than notional — which is the only thing that makes SM-3 observable at all.

**Acceptance Criteria:**

**Given** a resolved Project
**When** the Cockpit renders
**Then** `{components.identityHeader}` is pinned to the top, never scrolls, and shows repo name, clone path, Board identifier and health marker without opening a menu or a detail view
**And** it holds no overflow control, no kebab and no menu of any kind
**And** it persists nothing of its own — it is re-derived from the Project Record on every resolution

**Given** the header's visual spec
**When** it renders
**Then** the ground is `{colors.surface.raised}` closed by a 1px `{colors.border.strong}` seam, padding `13px {spacing.gutter} 12px`
**And** the repo name is in `{typography.heading}`
**And** the Board identifier is a `{colors.surface.stamp}` chip — a band, so no inset keyline — with paper text in `{typography.micro}`, rendering `record.ticketProvider.identifier` (e.g. `SIDE`), not the `boardId` UUID and not the Plane workspace name
**And** when `record.boardId` is falsy — the empty string 4 of the 19 registered Projects carry — the chip is **not** rendered and `NO BOARD` renders in its place in `{typography.label}` at `{colors.text.muted}`, because a chip naming a Board the Project has not got is the confidently-wrong answer FR-12(c) exists to forbid
**And** the test is `Boolean(record.boardId)` and never `!= null`, `!== null` or a key-presence check, which would report a Board for all four

**Given** the clone-path line
**When** it renders
**Then** it sits in a `{colors.surface.sunken}` well with a 2px `{colors.border.hairline}` left edge, is set in `{typography.mono}` at `{colors.text.machine}`, and carries `user-select: all`
**And** it **wraps** — a test asserts its computed `text-overflow` is not `ellipsis` and its computed `white-space` permits wrapping, at every path length
**And** the well is 268px inside, so `/home/delorenj/code/sidepiece` sets on one line at the measured mono advance from Story 2.2, and the wrap threshold is recorded
**And** it is focusable with a real tab stop, so it can be reached and copied without a mouse
**And** it carries a `{components.copyControl}`

**Given** `{components.copyControl}`
**When** it is activated
**Then** it copies the complete machine string and confirms by swapping **its own label** for one beat — same type, same colour, same box
**And** it draws no toast, no tick, no fill and no colour change
**And** when `navigator.clipboard.writeText` throws, it says so in place and the text remains selectable
**And** it is a 32px transparent control, 1px `{colors.border.hairline}`, `{typography.micro}` at `{colors.text.muted}`, `0 8px` padding, square

**Given** the header meta row
**When** it renders
**Then** it is `display: flex; flex-wrap: wrap` with a 6px `{spacing.tight}` gap in both axes, carrying in order: Board chip, health marker, copy control, and a trailing slot that `{components.degradedConnectionIndicator}` occupies once Story 2.14 builds it
**And** when the composed row exceeds 284px it **wraps to a second line** rather than eliding, truncating or hiding any item — the header grows from four lines to five and nothing is dropped
**And** a test renders the row with the longest Board identifier measured across the registered Projects plus a fixture element of the indicator's specified width in that trailing slot, and asserts zero horizontal overflow and zero clipping
**And** nothing in the header is laid out in fixed columns

**Given** `{components.healthMarker}`
**When** it renders
**Then** it carries one of four Bridge conditions — reachable / unreachable / reachable-but-unhealthy / not yet known — as one 11px `{spacing.glyph}` mark plus its word in `{typography.label}`
**And** it never shows reachable before it has an answer; "not yet known" renders as `marks.unknown`, which is a real state and not a placeholder
**And** it has no ring, no dot and no fill — the mark is the marker
**And** it carries **no hard-pinned colour of its own**: the consumer supplies one of the five `colors.state` values together with its matching `marks` entry
**And** it does not name the failing dependency — that is the pane notice's job

**Given** a resolution served from `lib/cache.ts`
**When** the header paints
**Then** it paints immediately from the cache and carries an as-of marker until the Bridge confirms
**And** the cache serves the header **and nothing else**

**Given** the resolved Project changes
**When** the Cockpit re-renders
**Then** the header, the pane switch and the body change in the **same frame**, one atomic render keyed by `(pjid, generation)`
**And** a test asserts there is no code path in which two regions render from different generations
**And** on a total outage the header is **replaced** by the shared notice — not dimmed, not left showing a Project we can no longer vouch for

*Satisfies: FR-4(a), FR-4(b), FR-4(c), FR-14(a), FR-14(b), NFR-9, UX-DR10, UX-DR11, UX-DR12, UX-DR15, UX-DR59, UX-DR68, UX-DR81, AR38*

---

### Story 2.14: Deadlines that always terminate, and the relayed-connection indicator

As Jarad,
I want every in-flight state to name what it is waiting on and to become a timeout with a retry when its deadline passes, including when the tailnet is relayed,
So that no region of this panel can ever hang, and so that a relay changes what expiry says without removing the fact that expiry happens.

**Acceptance Criteria:**

**Given** `packages/extension/src/lib/deadline.ts`
**When** it is read
**Then** it exports one wrapper that every in-flight region in the product is required to use — it takes the region's sentence key, its budget and its retry action, and it is the only place a timeout transition is implemented
**And** a lint fails the build on a rendered in-flight region that does not go through it

**Given** the resolution request, which is the only in-flight state that exists at this story
**When** it renders
**Then** it names what it is waiting on with `` Resolving `<pjid>`. `` from `copy/progress.ts` — never a bare spinner, never an empty region
**And** it carries the §5 resolution budget of ≤1s as a deadline
**And** on expiry it **becomes** a timeout state carrying a retry control, in the same region, reading `` Resolution didn't come back inside 1s for `<pjid>`. ``
**And** a test stalls the resolution response and asserts the region reaches a terminal state, with a control, within deadline + 100ms
**And** the module's budget table already declares the ≤2s Board read figure, so the Tickets pane consumes it rather than restating it

**Given** an empty state
**When** it renders
**Then** it is a **result**: `This Board is empty.` renders after an HTTP 200 and never instead of one
**And** a test asserts no empty state is reachable from a non-200 or from a pending request

**Given** `{components.degradedConnectionIndicator}`
**When** the Bridge reports the tailnet is on a DERP relay
**Then** it renders on the header meta row for as long as the relay lasts and is **never suppressed**
**And** it is `marks.degraded` plus one word in `{typography.micro}` at `{colors.state.degraded}` — ochre, not `{colors.state.failed}` — with **no box, no fill and no border**, 16px tall, padding `0 0 0 {spacing.gutter}`
**And** its sentence, where the indicator is expanded, is `Relayed connection. Timings below are not the usual ones.`
**And** it carries no recovery control, because it is a fact and not a fault

**Given** the relay indicator is up
**When** any in-flight state is measured
**Then** its **deadline is multiplied by 3, with a floor of 6 seconds** — resolution 1s → 6s, Board read 2s → 6s, dispatch acknowledgement 2s → 6s — and the multiple and the floor are declared as named constants in one module
**And** the promise is dropped but the deadline is not: every in-flight state still reaches a terminal transition
**And** on expiry under a relay the sentence changes and only the sentence: `Still waiting on the Board read. The connection is relayed, so there is no budget for this.` with a retry
**And** a test asserts that **no in-flight state anywhere in the product becomes indefinite while the indicator is up**

**Given** any state that renders a `{colors.state.*}` value
**When** it renders
**Then** it renders a `marks.*` glyph **and** a word alongside the colour
**And** a build-time check fails on a `colors.state` render with no `marks` sibling
**And** the panel is legible with all colour removed, which is asserted by rendering each state under a grayscale filter and checking that glyph and word still distinguish it

*Satisfies: NFR-2, NFR-7, NFR-8, UX-DR13, UX-DR45, UX-DR48, UX-DR65*

---

### Story 2.15: `{components.stateNotice}`, the re-resolve control and the command well

As Jarad,
I want one block that every degraded state renders into, always carrying at least one control, with the remedy command the Bridge returned set in a well I can select and copy,
So that a failure is always a thing I can read and act on, and never an empty region.

**Acceptance Criteria:**

**Given** `{components.stateNotice}`
**When** it renders
**Then** its anatomy top to bottom is: a `{colors.surface.stamp}` **band** carrying the state mark and the state word both in `{colors.text.inverse}`; a headline in `{typography.body}` at `{colors.text.primary}`; an optional detail line at `{colors.text.muted}`; an optional `{components.commandString}`; and a control row
**And** the band is solid with **no inset keyline**, because it is a statement and not a control
**And** the block is bordered on `{colors.surface.raised}`, 1px `{colors.border.strong}`, padding `10px {spacing.inset} 11px`, square
**And** it is stamped, never tinted — a test asserts no `colors.state.*` value is used as a background anywhere in it
**And** it **always contains at least one control**; a test asserts a notice with an empty control row fails to render

**Given** the FORBIDDEN contrast rule
**When** the band renders
**Then** both the mark and the word are `{colors.text.inverse}` at 15.34:1 on `{colors.surface.stamp}`
**And** a test asserts no `colors.state.*` value is ever painted on `{colors.surface.stamp}`

**Given** `{components.reResolveControl}`
**When** any state notice renders
**Then** the control is present — including in states it cannot fix, because a Plane outage does not resolve by re-resolving but the operator does not have to know that to reach for it
**And** activating it re-runs detection and resolution for the active tab, **bypassing the FR-2 cache**
**And** while running it disables and says so
**And** when it returns the same state it says the state again rather than flashing it away and back

**Given** the control's three forms, all 32px
**When** each renders
**Then** **primary** is `{colors.action.primary}` ground with a `{colors.text.inverse}` label in `{typography.label}`, square, with the 1px struck-plate inset keyline — hover thickens it to 2px, pressed removes it entirely so the plate seats
**And** **demoted** is transparent with a 1px `{colors.border.hairline}` and a `{colors.text.muted}` label
**And** **disabled** is `{colors.surface.sunken}` with a hairline and a muted label

**Given** `{components.commandString}`
**When** a remedy command renders
**Then** the text is the Bridge's verbatim — the Cockpit never composes command text, in any case
**And** it sits in a `{colors.surface.sunken}` block with a 2px `{colors.border.hairline}` left edge, `5px 7px` padding, `{typography.mono}` at `{colors.text.machine}`, `user-select: all`, `word-break: break-all`, never elided
**And** its selection renders in `{colors.selection.ground}` with `{colors.selection.ink}`, never in the signature hue
**And** it carries a `{components.copyControl}` and one **empty ruled** `[v2]` action slot at its trailing edge — ruled space, not a gap

**Given** a command string captured with `curl` from Epic 1's `GET /v1/project/:pjid` for a Project in a DS-6 or DS-8 condition — the only Bridge-composed remedy commands that exist at this story
**When** it is rendered in the notice well at 284px, where the well is 248px inside
**Then** its actual wrapped line count and characters-per-line figure are measured at the mono advance from Story 2.2 and recorded in `docs/measurements/command-string.md`, replacing the derived 35-characters-per-line figure that was never rendered
**And** the recorded figure is what any later fit claim against `{components.commandString}` cites
**And** the record states that DS-14's mandatory board-binding command is not yet composable and is measured in Story 2.19

*Satisfies: FR-3(b), FR-3(d), UX-DR16, UX-DR17, UX-DR27, UX-DR59*

---

### Story 2.16: DS-1 and DS-21 — the two states that render no notice

As Jarad,
I want the browser's default condition to read as wallpaper rather than as an error, and a page Chrome will not let Sidepiece read to say exactly that instead of pretending it read something,
So that the panel is not shouting at me on every ordinary tab, and so that it never asserts a positive fact about a page it was never allowed to look at.

**Acceptance Criteria:**

**Given** the active tab declares no pjid
**When** the Cockpit renders DS-1
**Then** it renders **no** `{components.stateNotice}` — one of exactly two states in the product that do not
**And** it renders **no** identity header
**And** the body carries one line at rest at `{colors.text.muted}`: `This page declares no pjid.`
**And** beneath it, the second sentence `Nothing to resolve. Sidepiece never guesses a Project from a URL.`
**And** it renders **no failure glyph** — the glyph-plus-word pairing applies to states, and this is the absence of one
**And** the re-resolve control is present in its **demoted** form as a quiet secondary affordance under the line, because FR-1 re-detects a declaration that appears without a navigation, so re-resolution genuinely can succeed

**Given** a `chrome://` page, the new-tab page, another extension's page, the Web Store or a `data:` URL
**When** the Cockpit renders DS-21
**Then** it renders **no** `{components.stateNotice}` and no identity header
**And** the body carries `Sidepiece can't read this page.` and the detail line `Chrome doesn't let an extension look at its own pages, other extensions' pages, or the Web Store.`
**And** it renders **no re-resolve control at all** — the single stated exception to FR-3's blanket rule, because re-resolving a `chrome://` tab can never succeed and offering a control that structurally cannot work is a worse lie than omitting it
**And** a test enumerates the Cockpit's interactive elements in DS-21 and asserts the re-resolve control is not among them

**Given** DS-1 and DS-21 are distinct
**When** a tab that Chrome will not read becomes active
**Then** DS-21 renders and DS-1 does not, because DS-1 asserts a positive fact about what the page contains and on a page nothing was read from that claim is unsupported

**Given** DS-1 or DS-21 is showing
**When** a tab that declares a resolvable pjid becomes active, or this page starts declaring one
**Then** the state clears and the Cockpit resolves, with no manual action

**Given** the `polite` live region
**When** DS-1 or DS-21 appears
**Then** it announces **once**
**And** switching between two unreadable tabs does **not** re-announce, because the wallpaper is not news
**And** a test drives four consecutive unreadable-tab switches and asserts exactly one announcement

*Satisfies: FR-3(a), FR-3(b), FR-3(d), UX-DR37, UX-DR38, UX-DR64, UX-DR74*

---

### Story 2.17: The pane switch

As Jarad,
I want a switch across the top of the body that selects the pane and marks a pane that is failing even while it is hidden,
So that "every pane fails independently and says why" survives a body that shows one pane at a time.

**Acceptance Criteria:**

**Given** `{components.paneSwitch}`
**When** it renders
**Then** it is an **n-item** control with two items in v1 — `TICKETS` and `CHAT` — laid out so a third fits in the column without wrapping
**And** it is a single 32px **full-bleed** strip on the header's bottom edge at **318px**, ruled top and bottom in `{colors.border.strong}`, divided into equal cells by a 1px `{colors.border.hairline}`
**And** the geometry is full-bleed rather than gutter-inset, because a full-bleed `{colors.border.strong}` seam cannot share an edge with gutter-inset cells, and the two full-bleed seams in the product — this one and the clip band — align at 318px
**And** the v1 two-up cell is (318 − 1) ÷ 2 = **158.5px**, with labels inset 8px each side leaving **142.5px** of label, which at the measured label advance from Story 2.2 is recorded as the character budget against `TICKETS` (7) and `CHAT` (4)
**And** the reserved `[v2]` third cell is recorded as (318 − 2) ÷ 3 = **105.33px**, leaving 89.3px of label — a budget the story records against `ANNOTATIONS` (11 characters) so the later epic knows whether the word survives
**And** the third cell renders as an **empty ruled cell**, never as a gap, and the fourth slot is not reserved

**Given** the selected cell
**When** it renders
**Then** it carries a 2px `{colors.action.mark}` underline **inside** the cell and steps its label to `{colors.text.primary}`
**And** unselected cells sit at `{colors.text.muted}`
**And** labels are `{typography.label}` uppercase
**And** no cell carries a spot **fill** — the underline is the whole marking

**Given** a pane is degraded while hidden
**When** the switch renders
**Then** that cell carries its own status marker at its leading edge — an 11px `{spacing.glyph}` mark plus, where it fits, nothing else
**And** a test gates the Tickets pane with an injected DS-17 while Chat is selected and asserts the Tickets cell is marked

**Given** the selected pane
**When** it changes
**Then** the selection persists per Project in `chrome.storage.local` under `lib/storage.ts`'s continuity keyspace, not under `fr2:`
**And** a Project change resets the selection to Tickets
**And** if the storage read throws or returns empty, the reset target applies and the switch works

**Given** `Alt+1` and `Alt+2`
**When** pressed anywhere in the Cockpit
**Then** they select a pane by position, mirroring the switch's visible order
**And** they are in-document key handlers and cost nothing from the `chrome.commands` budget of four

**Given** the switch's `inert` prop is set — which the total-outage shape will drive in Story 2.18
**When** it renders
**Then** the switch is **visible, not removed, and not interactive**: no cell takes focus, `Alt+1` and `Alt+2` do nothing, and a click changes nothing
**And** a test sets the prop directly and asserts all three

*Satisfies: NFR-2, UX-DR14, UX-DR54, UX-DR84*

---

### Story 2.18: The total-vs-partial router

As Jarad,
I want one predicate that decides whether a failure replaces the whole Cockpit or gates exactly one pane,
So that the panel never says the tailnet is down six different ways, and never leaves a live pane dark because something unrelated broke.

**Acceptance Criteria:**

**Given** `packages/extension/src/lib/router.ts`
**When** it is read
**Then** it exports **one pure predicate** taking `(degraded: DsCode[], health: BridgeCondition)` and returning `{ shape: 'total' | 'partial', gated: PaneId[] }`
**And** nothing else in the extension decides the shape of a failure

**Given** the Bridge itself is unreachable, or the Registry behind it is down **and** the Bridge holds no last-good snapshot
**When** the predicate runs
**Then** the shape is `total`: one shared notice in the body, the identity header **replaced** by it, the pane switch inert, one re-resolve control
**And** **no per-pane message renders while any total state is active** — a test injects DS-3, DS-4, DS-5 and DS-27 together and asserts exactly one notice is in the document

**Given** the six total-outage codes
**When** each renders
**Then** each gets its own distinguishable sentence, because each has a different fix: DS-3 `The laptop is off the tailnet.` / `` `burro-salmon.ts.net` isn't up on this machine, so the Bridge can't be reached. ``; DS-4 `` `big-chungus` isn't answering. `` / `The tailnet is up. Nothing is listening at the Bridge.`; DS-5 `Can't reach the Bridge.` / `The tailnet looks up, but Sidepiece can't tell whether the host is down or the Bridge is stopped.`; DS-27 `Sidepiece and the Bridge are on different contracts.` / `` `<side>` is the older one. ``; DS-6 `The pjangler Registry service isn't running.` plus the Bridge's command when it returns one; DS-7 `The Registry answered with an error.` / `<the error, as the Bridge reported it>`

**Given** the Bridge answers and returns a snapshot-backed resolution
**When** DS-6 or DS-7 arrives alongside **DS-23**
**Then** the shape is `partial`: the Project resolves from the snapshot, the header renders marked stale carrying the snapshot's age, and the panes stay live
**And** the age is **surfaced, never enforced** — a test injects a snapshot age of 30 days and asserts the resolution is still served and still rendered

**Given** DS-2 or DS-16
**When** the predicate runs
**Then** the shape gates **all** panes with **no identity header**, and a full `{components.stateNotice}` renders in the body with a re-resolve control
**And** DS-2 is `` `<pjid>` — declared but unknown. `` / `The page declares this pjid. The Registry has no Project under it.`
**And** DS-16 is `Sidepiece was reloaded. Reload this tab to reconnect.` — the only state in the product that tells the operator to reload anything — with a re-resolve that keeps failing until the tab reloads **and says so**
**And** a test asserts DS-16's sentence never appears for a Bridge restart, which needs no reload of anything

**Given** the Bridge answers and a single dependency behind it has failed
**When** the predicate runs
**Then** the shape is `partial`: the panes that do not depend on it stay **fully live** and only the one that does renders its own notice
**And** the header stays intact and the switch marks the gated pane

**Given** the health transition unreachable→reachable
**When** it is observed
**Then** the FR-2 cache is invalidated and the `CONTRACT_VERSION` handshake is re-checked

*Satisfies: FR-3(a), FR-3(b), FR-3(c), FR-3(d), NFR-2, UX-DR39, UX-DR40, UX-DR45, UX-DR47, AR35, AR36, AR77*

---

### Story 2.19: The Board read endpoint on the Bridge

As Jarad,
I want `GET /v1/project/:pjid/tickets` to return the resolved Board's Tickets in the Board's own state order, with a boardless Project answered honestly, and I want to prove all of it with curl and no Chrome running,
So that when the pane is built there is exactly one variable left in it.

**Acceptance Criteria:**

**Given** `packages/bridge/src/tickets/index.ts` and `packages/bridge/src/tickets/plane.ts`
**When** they are read
**Then** `index.ts` dispatches on `record.ticketProvider.type` read from the Project Record, and nothing is hardcoded to Plane
**And** `plane.ts` is the only implementation in v1, and is the **only** place Plane's "project" is renamed to `boardId` — it occupies one of the two per-path exceptions Story 1.2's Biome rule already carries, and this story adds no rule and no exception, it only fills the path that was reserved for it
**And** an unrecognised `ticketProvider.type` returns DS-14's no-Board treatment with the provider named, rather than crashing

**Given** a Project whose `ticketProvider.boardId` is the **empty string** — true for 4 of the 19 registered Projects
**When** `curl -s $BRIDGE/v1/project/codegraph-voyage/tickets` is run
**Then** the response carries `degraded: [{"ds":"DS-14","params":{"repo":"<repo>"}}]` and no ticket list — the `Degraded` shape Story 1.3 fixed in `contract/src/state.ts` (`{ds, params?, remedy?}`), never a bare code string
**And** the check in the source is a **truthiness** check on `boardId`, written as such — a `!= null` or key-presence test reports a Board for all four and renders the pane against an empty id
**And** a test runs the check against each of the four boardless Projects (`codegraph-voyage`, `legofirst`, `momo`, `vinyl`) and asserts DS-14 for all four
**And** the entry carries the board-binding command the Bridge composed in its `remedy` field, because DS-14's command is mandatory
**And** that command string is rendered once in `{components.commandString}`'s 248px well and its wrapped line count is appended to `docs/measurements/command-string.md`, completing the measurement Story 2.15 deferred

**Given** a Project with a truthy `boardId`
**When** `curl -s $BRIDGE/v1/project/sidepiece/tickets | jq` is run
**Then** the response carries `generation` at the top level
**And** it carries `states[]` in the Board's own `sequence` order, each with `{ id, name, group, sequence, isDefaultEntry }`, where `group` is Plane's own state group — one of `backlog`, `unstarted`, `started`, `completed`, `cancelled`
**And** it carries `tickets[]`, each with `{ key, title, stateId, url }` where `key` is the human key (`SIDE-12`) and `url` is the Plane issue URL
**And** camelCase is used throughout, because this is a Sidepiece surface

**Given** a Board that returns zero states
**When** the endpoint answers
**Then** it carries `degraded: [{"ds":"DS-22"}]` plus the Bridge's command in `remedy` when it has one — an omitted key, never an empty one

**Given** Plane is failing
**When** the endpoint answers
**Then** it carries `degraded: [{"ds":"DS-17","params":{"error":"<the upstream error, verbatim>"}}]` — typed data rather than a user-facing sentence
**And** it does **not** return a stale ticket list alongside the failure

**Given** the §5 budget
**When** the endpoint is measured over the tailnet from the laptop, 20 samples
**Then** p95 is ≤2s, and the measured figure is recorded in `docs/measurements/board-read.md`

**Given** FR-15(d)
**When** the story closes
**Then** every branch above — boardless, zero-state, Plane failing, healthy — has a recorded `curl` transcript in `docs/transcripts/board-read.md`, produced with no extension installed and no Chrome running

*Satisfies: FR-12(a), FR-12(b), FR-12(c), FR-12(e), FR-12(g), FR-15(d), NFR-7, AR57, AR33, AR38, AR60 (inherited from Story 1.2 — occupied, not re-declared)*

---

### Story 2.20: Board states mapped to the five marks, and the group headers

As Jarad,
I want a stated rule that turns any Board's own state names into the five marks the design system has, and a group header per Board state in the Board's own order,
So that the Tickets pane can be built against a mapping that exists, rather than against the one the mockup improvised.

**Acceptance Criteria:**

**Given** `packages/contract/src/board.ts`
**When** the mapping function is read
**Then** it maps **on Plane's state `group`**, not on the state name, not on position and not on per-Board config, because the group is the only field every Plane board carries and its five values map one-to-one onto the five marks with no collapse:
| Board state group | `colors.state` | `marks` |
|---|---|---|
| `backlog` | `unknown` | hollow circle |
| `unstarted` | `pending` | `»` |
| `started` | `degraded` | filled triangle |
| `completed` | `ok` | 7×1 bar |
| `cancelled` | `failed` | filled square |
**And** a state whose `group` is missing, empty or not one of the five resolves to **`unknown`**, never to a guess and never to an omitted mark
**And** the function is pure, is exported from `contract/`, and is the only place the mapping exists — `tsc` prevents the extension re-declaring it

**Given** the 33GOD standard board, which carries **nine** states across the five groups — `Backlog`(backlog), `Needs Re-evaluation`(unstarted), `Todo`(unstarted, default), `In Progress`(started), `E2E Testing & QA`(started), `Ready for Documentation`(started), `Needs Attention`(started), `Done`(completed), `Cancelled`(cancelled)
**When** the mapping runs over it
**Then** all nine map without error, two groups carry more than one state, and every state gets a mark
**And** a fixture test runs the mapping over an 8-state board and over a 3-state board and asserts total coverage in both

**Given** two Board states that map to the same mark
**When** they render
**Then** they are still distinguished, because the group header carries the Board state's **own name** and the mark is secondary
**And** a test asserts `backlog` and `completed` — whose `colors.state` hexes are `unknown` and `ok`, which are the identical value — are distinguished by glyph and by name, which is exactly what Rule 3 exists for

**Given** `{components.ticketGroupHeader}`
**When** the Tickets pane renders
**Then** there is one header per Board state, in the Board's **own** `sequence` order, never alphabetically
**And** it collapses to name plus count
**And** a group with zero Tickets renders with a **zero count** rather than disappearing, because the Board's shape includes its empty columns
**And** the group holding the Board's **default entry state** is expanded on first render and the rest are collapsed
**And** collapse state persists per Project in `chrome.storage.local`, and a read that throws or returns empty falls back to that default

**Given** the header's visual spec
**When** it renders
**Then** it is `position: sticky` to the top of the Tickets region on **opaque** `{colors.surface.panel}` so rows do not ghost through, 30px, closed by a 1px `{colors.border.strong}` bottom rule, padding `4px 0 6px`
**And** the state mark sits at `{spacing.glyph}`, the state name in `{typography.label}` uppercase at `{colors.text.primary}`, and the count right-aligned in `{typography.label}` at `{colors.text.muted}` with `font-variant-numeric: tabular-nums` so the column does not jitter

*Satisfies: FR-12(a), UX-DR23, UX-DR65, UX-DR82, AR22*

---

### Story 2.21: The Tickets list — rows, empty, timeout, refetch

As Jarad,
I want the resolved Board's Tickets on screen, grouped, each key opening its Plane URL in a new tab, with a refetch that never blanks the pane,
So that I can see what is on the Board for the thing I am staring at without leaving the page.

**Acceptance Criteria:**

**Given** a resolved Project with a truthy Board
**When** the Tickets pane renders
**Then** it fetches fresh on resolution and is never served from a prior Project's cache — a test switches Projects and asserts a network read occurred and that zero rows from the previous Project are in the document
**And** while the read is in flight the pane shows `Reading the Board.` with its ≤2s deadline

**Given** `{components.ticketRow}`
**When** it renders
**Then** it is a three-column grid at an 8px gap, `{spacing.glyph} max-content 1fr`: the 11px state mark coloured by the Story 2.20 mapping, the human key in `{typography.mono}` at `{colors.text.machine}`, and the title in `{typography.body}` wrapping to at most two lines
**And** the key column is sized to the longest key **in the current fetch**, not across all Projects
**And** the row is 58px at a two-line title and `{spacing.row}` 32px at one line, separated by 1px `{colors.border.faint}`, padding `8px 0`
**And** hover raises the row ground to `{colors.surface.raised}` — a tonal step, never a shadow
**And** a Ticket missing a field renders the fields it has and marks the gap with an ink em-dash at `{colors.text.muted}` — never blank space, never dropped from the list

**Given** the longest ticket key is unmeasured and the drawn worst case assumed an eleven-character `HOLOCENE-12`
**When** this story runs the measurement — for each of the 19 registered Projects with a truthy `boardId`, read `ticketProvider.identifier` and the highest issue sequence number, and compute `identifier + '-' + digits`
**Then** the measured longest key is recorded in `docs/measurements/ticket-keys.md` with the per-project table
**And** the title measure at that key length is computed at the measured body advance from Story 2.2 and recorded beside the drawn 179px ≈ 28 characters
**And** the recorded figure replaces the drawn one in any later fit claim

**Given** a ticket key
**When** it is clicked or activated with Enter
**Then** the Plane URL opens in a **new tab**
**And** the Cockpit does not navigate and the panel document is not reloaded

**Given** a Project change
**When** it occurs
**Then** **no row survives the pjid change** — the list is discarded in the same frame as the header and the pane renders `Reading the Board.` for the new Project
**And** a test asserts no ticket row, group header or count from the previous Project is in the document one frame after the switch

**Given** the Board read returns 200 with zero Tickets
**When** the pane renders
**Then** it renders `This Board is empty.` **above** the group skeleton, not instead of it — every Board state still renders its header with a zero count
**And** this state is reachable only after a 200

**Given** `{components.refetchControl}`
**When** a refetch **within the current Project** runs
**Then** the current list stays on screen with an in-progress marker on the control, and the pane never blanks
**And** on failure the previous list stays in place with the failure stated above it
**And** a **Project change is not a refetch** — a test asserts the never-blank guarantee does not apply across a pjid change
**And** the control is 28px, transparent, 1px `{colors.border.strong}`, `{typography.label}` at `{colors.text.primary}`, `0 10px` padding — quieter than the primary submit, taking the tonal and ink affordances and not the struck plate
**And** it carries the second of the product's exactly two freshness markers; the header's as-of marker is the first and nowhere else gets one

**Given** DS-17 (`The Bridge is up. Plane is failing.` / `<the error, as the Bridge reported it>`)
**When** it arrives
**Then** the Tickets pane renders its own `{components.stateNotice}`, the switch marks Tickets degraded, and **Chat and resolution stay fully live**
**And** the previous list is **not** left on screen under the failure, because a list we cannot refresh is a list we cannot vouch for

**Given** the ≤2s deadline expires
**When** the Board read has not landed
**Then** the pane renders `The Board read didn't come back inside 2s.` with a retry, and never a permanent spinner

*Satisfies: FR-12(a), FR-12(b), FR-12(d), FR-12(e), FR-12(f), FR-12(g), NFR-2, UX-DR24, UX-DR26, UX-DR42, UX-DR48, UX-DR90*

---

### Story 2.22: The Ticket create endpoint on the Bridge

As Jarad,
I want `POST /v1/project/:pjid/ticket` to file a Ticket on the resolved Board from a title alone, resolve the entry state itself, refuse a stale generation, and never double-file,
So that the create path is provable with curl before a single pixel of the create box exists.

**Acceptance Criteria:**

**Given** `curl -s -X POST $BRIDGE/v1/project/sidepiece/ticket -H 'content-type: application/json' -d '{"title":"one line","generation":5,"createKey":"<uuid>"}'`
**When** it runs
**Then** a Ticket is created on the Board derived from `sidepiece` and on no other — the Board is never a request parameter
**And** `description` and `stateId` are optional, and omitting `stateId` makes the **Bridge** resolve the Board's default entry state server-side
**And** the response carries the created Ticket including the state it was assigned, plus the current `generation` at the top level
**And** the response is camelCase throughout

**Given** `generation` is in the **request body** and not a header
**When** the route runs
**Then** the generation check runs **before** the create capability, not after
**And** stale is `received < current` for that pjid; equal passes; greater is impossible, is a Bridge bug, and is logged as one
**And** a stale create returns `HTTP/1.1 409 Conflict` with body `{"error":"stale_generation","pjid":"sidepiece","received":4,"current":5}` and **no** `degraded[]`, because nothing is degraded once a mutation is refused
**And** a recorded `curl` transcript in `docs/transcripts/ticket-create.md` shows the 409 with its exact body

**Given** `createKey`, a UUID minted by the **Cockpit** at submit
**When** a second request carries an already-recorded `createKey`
**Then** the Bridge returns the Ticket that key produced rather than filing a second one
**And** the key is recorded on the `ticket_creates` row alongside `(pjid, generation, board_id, clone_path)`
**And** a test issues the identical request twice and asserts one Ticket exists on the Board and both responses carry the same ticket key
**And** the Bridge never mints the key itself, because a Bridge-minted key would be new on every attempt

**Given** the `ticket_creates` table
**When** the migration is read
**Then** this story adds **only** that table — `turns` and `dispatches` are not created here
**And** the table is plural snake_case with snake_case columns and ISO-8601 TEXT timestamps, per the migration contract Story 1.5 recorded
**And** `turns/store.ts` remains the only module that opens the database and the only place snake_case ↔ camelCase mapping happens
**And** the migration is `002_ticket_creates.sql`, forward-only, advancing `user_version` from `1` to `2` — Epic 1's `001_resolutions.sql` created `resolutions` and nothing else

**Given** a Project whose `boardId` is the empty string
**When** a create is attempted
**Then** the Bridge refuses with DS-14 rather than filing against an empty id
**And** a Board with zero states refuses with DS-22
**And** both ride as `{ds, params?, remedy?}` entries in `degraded[]`, never as bare code strings

**Given** Plane refuses the create
**When** the Bridge answers
**Then** it returns the upstream status and error text as typed data — never silent success, and never a user-facing sentence

*Satisfies: FR-13(a), FR-13(b), FR-13(c), FR-15(d), NFR-9, AR26, AR28, AR29, AR30, AR31, AR39, AR40, AR58, AR59, AR42*

---

### Story 2.23: The create box — a title alone, and the Board it names

As Jarad,
I want to type a title into the pinned action bar and have a Ticket land on the Board the submit names, without waiting for the list and without ever losing my typing,
So that filing a ticket from the panel is actually faster than the terminal — which is the entire headline metric.

**Acceptance Criteria:**

**Given** `{components.ticketCreateBox}`
**When** the Tickets pane renders
**Then** it is pinned in the action bar on `{colors.surface.raised}`, 1px `{colors.border.strong}` (promoted from the hairline per Story 2.12), `{spacing.inset}` padding
**And** the title field is a **ruled blank** — no box, no ground, a 1px `{colors.border.strong}` baseline with a **serif-italic** placeholder in bundled Charis SIL Italic at `{colors.text.muted}`, with a test asserting `font-synthesis: none` is in force so no synthetic oblique is drawn
**And** description and target state are optional and collapsed by default
**And** it validates nothing beyond non-empty and says nothing implying the title must be good

**Given** the submit row
**When** it renders
**Then** it is three cells across the 264px inner width: a 32px fixed leading slot, the submit filling 184px, a 32px fixed trailing slot, 8px gaps
**And** both empty slots render as **ruled space**, not as gaps

**Given** the submit label
**When** it renders
**Then** it reads `CREATE ON <identifier>`, where `<identifier>` is `record.ticketProvider.identifier` uppercased — the **same byte string** the header's stamp chip renders, asserted equal in a test
**And** it names a **Board**, never a Plane workspace and never a Project name, because FR-13's whole point is that the submit proves which Board it will write to
**And** the identifier is never elided, never truncated and never abbreviated; when `CREATE ON <identifier>` exceeds the 184px cell at the measured label advance it **wraps to a second line** and the control grows to fit two lines of `{typography.label}`
**And** the budget is recorded: 184px at the measured advance, against `CREATE ON SIDE` (14 characters) and against the longest identifier from `docs/measurements/ticket-keys.md`

**Given** the create box and the Board read
**When** the pane opens
**Then** the box is **live before the Board read lands** — a test stalls the Board read indefinitely and asserts the title field is focusable and the submit is enabled
**And** the submit does not wait, because the Bridge resolves the omitted entry state server-side

**Given** a submit
**When** it fires
**Then** the Cockpit mints a **`createKey` UUID at submit** and carries it on the request
**And** it performs the **client-side generation pre-check first** and refuses locally when its held generation is behind, with `The Project changed while that was in flight. Nothing was written.`, the text kept, and **no re-resolve control** — resolution already happened, which is why the generation is stale, so re-resolving is the one action guaranteed to change nothing
**And** while in flight the submit is disabled with an in-progress marker and the title stays visible

**Given** a successful create
**When** the response lands
**Then** the row appears at the top of its group **without a manual refresh**, carrying the state the Bridge assigned it
**And** the title clears, **focus stays in the title field**, and the description collapses
**And** nothing navigates
**And** if the Board read has not landed yet, the created row renders as a single row above the `Reading the Board.` line marked as just created, and takes its place inside its group when the list arrives

**Given** a failed create
**When** the error lands
**Then** the entered text is **preserved** and the error is shown, e.g. `Plane refused the create: 403. Your title is still here.`
**And** a test types a title, forces a 403, and asserts the exact typed string is still in the field

**Given** the write was acknowledged and the response could not be used — a 2xx whose body did not parse, or the connection lost after the write
**When** the pane renders
**Then** it says `Created, but the Board read didn't come back. Refetch to see it.`
**And** the title field **clears**, because the work landed and leaving it populated invites a duplicate
**And** on this state **only**, the refetch control re-issues the **create** under the held `createKey` rather than re-reading the Board, which returns the exact Ticket and cannot double-file
**And** resubmitting by retyping is not offered, because a retype mints a new key and therefore genuinely does double-file

**Given** DS-14 (`<repo> has no Board.` / `Nothing to list, and nothing to create against.` + mandatory command) or DS-22 (`This Board has no states. Nothing to create into.` + command when the Bridge returns one)
**When** either gates the Tickets pane
**Then** the create box is **disabled with the reason**, never failing on submit
**And** because the pane notice carrying the reason scrolls out of the pinned action bar's sight, the disabled box carries the reason **itself**: the state's headline sentence renders in `{typography.label}` at `{colors.text.muted}` on a wrapping line directly above the submit row, inside the pinned action bar, and the submit label becomes `CAN'T CREATE`
**And** a test scrolls the Tickets pane to the bottom under DS-14 and asserts the reason is still visible
**And** Chat stays fully usable in both states

**Given** `chrome.commands`
**When** this story lands
**Then** `focus-ticket-title` is declared at `Alt+Shift+N`, `global: false`, **and its handler lands in the same change**
**And** the handler opens the Cockpit if closed, switches to Tickets, and puts the caret in the title field, and **never closes** the Cockpit — it is its own command calling `open()`, not the action
**And** the manifest now declares exactly two commands and no more; `arm-picker` and `discharge-batch` remain undeclared

**Given** the draft
**When** the operator types
**Then** it is debounced continuously to `chrome.storage.local` keyed by pjid and restored on open
**And** `chrome.sidePanel.onClosed` is treated as a belt and not the braces, because nothing documents whether it fires early enough to be trusted as a flush point
**And** if storage throws or returns empty, the box renders empty and works

**Given** `Enter` in the title field
**When** pressed
**Then** it creates
**And** `Escape` **blurs** the field and the text **stays** — it never clears it and never closes the Cockpit

*Satisfies: FR-13(a), FR-13(b), FR-13(c), FR-13(d), FR-13(e), NFR-9, UX-DR25, UX-DR42, UX-DR53, UX-DR54, UX-DR55, UX-DR88, UX-DR89, AR58, AR59*

---

### Story 2.24: The accessibility floor

As Jarad,
I want every control reachable and operable from the keyboard, focus that is never lost and always visible, and a panel that is legible in a screenshot pasted into a terminal,
So that the surface works for the way I actually use it — keyboard-first, at 320px, often without looking directly at it.

**Acceptance Criteria:**

**Given** every screen in the key-screen set
**When** it is traversed with Tab and Shift+Tab
**Then** every interactive element is reached, including the clone-path region and every state notice's recovery control
**And** each one is operable with Enter or Space
**And** a test asserts there is **no mouse-only path to any action in the product**

**Given** focus order
**When** it is traversed on any surface
**Then** it is **reading order**: header (clone-path region → copy control → health marker) → pane switch → pane content → action bar

**Given** every re-render path — tab switch same Project, tab switch different Project, switch to a no-pjid tab, switch to an unreadable tab, refetch, Ticket created, a state notice appearing
**When** each is triggered
**Then** focus is **never** on `<body>` afterwards
**And** when the Project changes under an open Cockpit, focus lands on the **pane switch** — a defined landing
**And** when the title field has focus and the pane re-renders around it for any other reason, focus **stays in the field**
**And** a re-render never steals focus

**Given** the focus ring
**When** an element receives `:focus-visible`
**Then** it draws as a two-tone printer's keyline: `box-shadow: 0 0 0 1px #F2EDE3, 0 0 0 3px #191713; outline: none`, so it follows the 0px corner exactly
**And** on a stamp-ground control the focus keyline and the struck plate coexist, one `inset` and one not: `box-shadow: inset 0 0 0 1px {colors.surface.panel}, 0 0 0 1px {colors.focus.ringInner}, 0 0 0 3px {colors.focus.ring}`
**And** a lint fails the build on a `:focus` rule with no `:focus-visible` counterpart
**And** on every Sidepiece ground at least one of the two tones clears 3:1

**Given** the `polite` live region
**When** state transitions occur
**Then** each of these announces exactly **once**: Ticket created, create failed, a degraded-state notice appearing
**And** DS-1 and DS-21 announce once on appearance and never re-announce on a tab switch between two unreadable tabs
**And** a test drives every announcing transition and asserts **nothing announces twice**

**Given** `prefers-reduced-motion: reduce`
**When** it is set
**Then** progress lines do not shimmer, pane switches do not slide, and every state change is a text swap
**And** a test asserts every state transition remains comprehensible with all animation disabled

**Given** hit targets
**When** every control is audited
**Then** none is smaller than 24 × 24 CSS px
**And** every ticket row is at least `{spacing.row}` 32px tall
**And** 44px is explicitly **not** applied, because this is a mouse-and-keyboard desktop panel at 320px where 44px rows cost real information

**Given** the browser's larger default font sizes
**When** every key screen is rendered at them
**Then** nothing is clipped and no row overlaps
**And** the header meta row in particular wraps rather than overflowing, per Story 2.13

**Given** the scope boundary
**When** the story closes
**Then** it is stated in the repo that a full WCAG 2.2 AA conformance pass, NVDA/JAWS/VoiceOver QA, localization and RTL, forced-colors theming and touch are **deliberately out** of v1 and out of the floor

*Satisfies: NFR-2, UX-DR57, UX-DR61, UX-DR62, UX-DR63, UX-DR64, UX-DR65, UX-DR66, UX-DR67, UX-DR68, UX-DR69, UX-DR60*

---

### Story 2.25: Cold start, tab switches, Bridge restart and two windows

As Jarad,
I want the panel to come back correctly after every way it can go away, and never to confuse a Bridge restart with an extension reload,
So that the most routine event in the system does not teach me to reload a tab I did not need to reload.

**Acceptance Criteria:**

**Given** a reopen or an expand after a collapse — which is the **same teardown event** as a close
**When** the panel document cold-starts
**Then** the render order is fixed: (1) **detection first**, locally, before anything paints, with the pjid **re-read and never remembered**; (2) the identity header paints from `lib/cache.ts` if the entry is valid for that pjid, carrying an as-of marker until the Bridge confirms, and the cache serves the header **and nothing else**; (3) **at most three progress lines** — one for resolution if uncached, one in Tickets, one in Chat — and never a whole-panel spinner; (4) **no pane waits on another** — the create box is live before the Board arrives; (5) every progress line carries its budget as a deadline and converts to a timeout on expiry
**And** the health marker sits at "not yet known", which is a real state and not a placeholder
**And** a test collapses the panel mid-typing and asserts the draft is restored from `chrome.storage.local` on expand

**Given** a tab switch **within the same Project**
**When** it occurs
**Then** the panel document survives — DOM, JS state and open connections persist — and the service worker messages it to re-render in place keyed by the **same** `(pjid, generation)`
**And** focus lands on the pane switch
**And** there is **no reload, no refetch and no flicker** — a test asserts zero network requests fire on this transition

**Given** a tab switch to a **different Project**
**When** it occurs
**Then** the panel document still survives but every pane's content does not: one atomic re-render onto the new `(pjid, generation)` in which the Tickets list is **discarded and refetched from zero**, the pane resets to Tickets, and focus lands on the pane switch
**And** nothing crosses the pjid boundary — not a ticket row, not a group header, not a cached list
**And** the only thing the FR-2 cache may make fast is the header, and even that carries an as-of marker until the Bridge confirms
**And** **nothing whatsoever is rendered about the Project he left** — no marker, no count, no toast

**Given** a **Bridge restart**
**When** the Bridge goes away and comes back
**Then** **nothing in Chrome is reloaded**
**And** while it is down the Cockpit renders DS-5 (or DS-3/DS-4 if Epic 1's spike made them distinguishable)
**And** when it returns, **one re-resolve** is the whole recovery, with the FR-2 cache invalidated on the unreachable→reachable transition
**And** a test asserts DS-16's sentence `Sidepiece was reloaded. Reload this tab to reconnect.` **never** appears for this cause

**Given** an **extension reload** in dev
**When** it occurs
**Then** content-script contexts are invalidated exactly as a real update does, and the `Extension context invalidated` throw in an open tab produces **DS-16**
**And** DS-16 exists for this one cause only
**And** the panel document does not hot-reload and must be closed and reopened, which is stated in the dev notes

**Given** two Chrome windows
**When** both have a Cockpit open
**Then** each holds its own render and its own `(pjid, generation)` frame over the **shared** per-pjid `fr2:` cache
**And** v1 does not synchronize them, the two may legitimately disagree, and **no sync indicator is rendered**
**And** pane selection is stored per Project under a single shared key, so a switch in one window follows to the next open of the other **on that same Project** — accepted and priced for a two-item toggle, and consistent with Story 2.17's reset to Tickets on a Project change

**Given** a Chrome restart
**When** the browser comes back
**Then** drafts, pane selection, group-collapse state and the resolution cache survive — the cache only for its five-minute TTL
**And** nothing in the panel document survives
**And** the Cockpit is assumed **closed** after a restart and the first open is a full cold start

**Given** first run
**When** the extension is installed
**Then** the broad host-match prompt renders once, drawn by Chrome, and Sidepiece renders nothing before or after it
**And** there is **no** onboarding screen, welcome tab, first-run Cockpit state, coach mark or in-product nudge
**And** the install note says `pin the icon`, which is the product's only setup step

*Satisfies: FR-1(d), FR-2(c), FR-3(a), NFR-3, NFR-4, UX-DR71, UX-DR72, UX-DR73, UX-DR74, UX-DR75, UX-DR76, UX-DR77, AR72, AR77*

---

### Story 2.26: The 28-row router matrix — the epic's exit criterion

As Jarad,
I want one test that asserts, for every one of the twenty-eight states, which shape renders and which panes stay operable,
So that the 4.7× miscount this project already made once cannot be carried past this epic, and so that a later epic adding a failure mode visibly grows a row.

**Acceptance Criteria:**

**Given** `packages/extension/src/lib/router.matrix.test.ts`
**When** it runs
**Then** it carries **28 rows**, one per `DsCode` in `contract/src/state.ts`, and a `tsc`-enforced exhaustiveness check fails the build if a code exists with no row
**And** each row asserts three things: the shape (`total` or `partial`), the exact set of gated panes, and whether an identity header renders

**Given** a code no story in this epic can yet trigger — DS-11, DS-12, DS-13, DS-18, DS-19, DS-20, DS-24, DS-25, DS-26, DS-28
**When** its row runs
**Then** it asserts against an **injected `degraded[]`** handed straight to the router predicate, which is cheap precisely because Epic 1 left every Bridge surface curl-exercisable
**And** the row is a real assertion, not a skip

**Given** the matrix
**When** its rows are read
**Then** they assert at minimum:
| Codes | Shape | Gated | Header |
|---|---|---|---|
| DS-3, DS-4, DS-5, DS-27 | total, one shared notice, switch inert | all | replaced |
| DS-6, DS-7 **with no snapshot** | total | all | replaced |
| DS-6, DS-7 **with a snapshot**, alongside DS-23 | partial | none | renders, marked stale with the age |
| DS-2, DS-16 | all panes gated, full notice in the body | all | **none** |
| DS-1, DS-21 | no notice at all | all | **none** |
| DS-11, DS-12, DS-13, DS-20, DS-24, DS-25, DS-26, DS-28 | partial | Chat only | intact |
| DS-14, DS-17, DS-22 | partial | Tickets only | intact |
| DS-18 | partial, **half-pane** — composer stays enabled, Streamed Exchange live | dispatch only | intact |
| DS-19 | partial | **nothing** | intact |
| DS-8 | partial | whichever dependency it feeds, named | intact |
| DS-9, DS-10, DS-15, DS-23 | informational marker, no notice | **nothing** | intact, marked |

**Given** DS-1 and DS-21
**When** their rows run
**Then** they assert `{components.stateNotice}` is **absent** — the only two states in the product that render none
**And** DS-21's row additionally asserts **no re-resolve control at all**, and DS-1's asserts a **demoted** one

**Given** DS-3 and DS-4
**When** their rows run and Epic 1's O3 spike returned *not distinguishable*
**Then** the rows assert they are not produced by v1 and that DS-5 is the whole answer, citing the spike verdict
**And** when the spike returned *distinguishable*, the rows assert their own sentences and shapes

**Given** any two rows
**When** the copy for their codes is compared
**Then** no headline or detail sentence is shared between them
**And** DS-18's and DS-19's sentences are asserted distinct from each other and from `No outcome after <window>. Status unknown.` — one means nothing arrived, one means we cannot look, one means the transport is down, and the fixes differ

**Given** a total-shape row
**When** it runs
**Then** it asserts **exactly one** notice element is in the document, so six ways of saying the tailnet is down cannot ship

**Given** the epic's definition of done
**When** it is written into the repo
**Then** it carries the four human-checked clauses no linter can see: (1) every mutating route calls the generation check **before** its capability; (2) a new failure mode adds a `DsCode` **and** its `EXPERIENCE.md` row in the same change, never a free-text message; (3) a new user-facing string exists in `EXPERIENCE.md` and lands in `copy/states.ts`, `copy/progress.ts` or `copy/icon.ts`; (4) no glossary term appears under a synonym

*Satisfies: FR-3(a), FR-3(b), FR-3(c), FR-3(d), NFR-2, UX-DR41, UX-DR43, UX-DR44, UX-DR46, UX-DR47, AR13, AR15*

## Epic 3: Ask the PM what is going on — and hand it work without pretending that is a conversation

UJ-2's conversational half and UJ-3's main line. Jarad types *"what's in progress?"* and the answer streams into the panel beside the page, partial output visible while it generates. He types *"start on the resolver ticket"* and Sidepiece classifies it as **work** before he commits, shows him the classification, lets one control flip it, dispatches it through the fleet gateway and acknowledges it with a correlation identifier he can copy and chase himself. Every Turn carries the tab's URL and title, so the PM is not guessing at a page it cannot see. History is the Project's, is appended per Turn, and survives the panel closing and a Chrome restart. And on a Project with no PM — or a PM declared but absent from the fleet registry, which is true of this very repo today — Chat is visibly unavailable with the reason stated and the exact provisioning command shown, while Tickets stay fully live.

**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-10, FR-11
**DS codes produced here:** DS-11, DS-12, DS-13, DS-18, DS-24, DS-26, DS-28. **Gated here, produced in Epic 1:** DS-20, DS-25.
**Findings this epic owns and must decide:** 1 (UX-DR79), 2 (UX-DR80), 5 (UX-DR83), 9 (UX-DR87). Findings 1 and 2 are resolved together in Story 3.3, before any composer acceptance criterion is exercised.
**Definition of done, on every story in this epic (AR15):** a new failure mode adds a `DsCode` in `contract/src/state.ts` **and** its `EXPERIENCE.md` row in the same change — never a free-text message; every new user-facing string lands in `copy/states.ts` or `copy/progress.ts` and appears in `EXPERIENCE.md`; no Glossary term appears under a synonym or an abbreviation; and every mutating route calls the `(pjid, generation)` check before its capability.

---

### Story 3.1: Ask the Bridge whether this Project's PM can be talked to at all

As Jarad, the one operator,
I want `curl` to tell me which of the three FR-5 Agent states a Project's PM is in — and, when none is declared, the exact command that declares one,
So that I know before I open Chrome whether chat on this Project is going to work, and what to run if it is not.

**Acceptance Criteria:**

**Given** the Bridge is running and `sidepiece`'s Project Record declares the Agent binding `sidepiece-pm`, which does not appear in `~/.hermes/agents-registry.yaml`
**When** I run `curl -s https://<bridge>/v1/project/sidepiece | jq '.degraded'`
**Then** the response is `HTTP/1.1 200` and `degraded[]` contains exactly one PM-scoped entry, `{"ds":"DS-12","params":{"pm":"sidepiece-pm"}}` — the `Degraded` shape Story 1.3 fixed, `ds` and not `code`
**And** the body carries no prose for it — `copy/states.ts` in the Cockpit owns the sentence, per the wire rule that the Bridge sends codes, not prose
**And** this is a zero-setup fixture: it is true of this repository today and requires nothing to be broken deliberately.

**Given** a Project Record whose Agent bindings contain no PM role
**When** I `GET /v1/project/:pjid`
**Then** `degraded[]` contains `{"ds":"DS-11","params":{"repo":"<repo>"},"remedy":"<command text>"}`
**And** `remedy` is a non-empty string composed by the Bridge verbatim from the installed pjangler and Hermes surface — this is the single deliberate exception to the codes-not-prose rule, because a command the Cockpit invents goes stale the first time a flag changes
**And** `sessions/fleet.ts` and `sessions/gateway.ts` are not consulted at all, because there is no PM to look for.

**Given** a Project Record declaring a PM that **is** present in `~/.hermes/agents-registry.yaml`
**When** the Bridge probes the Hermes `tui_gateway` and the gateway does not answer
**Then** `degraded[]` contains `{"ds":"DS-13","params":{"pm":"<pm>"}}`
**And** the probe is a JSON-RPC liveness handshake that **never acquires a session** — probing must not consume one of the gateway's ~37 profile slots, or health checking would itself cause DS-24.

**Given** the same Project and a `tui_gateway` that answers but refuses a method this Bridge's pinned Hermes release calls
**When** the Bridge probes it
**Then** `degraded[]` contains `{"ds":"DS-26","params":{"method":"<the method, as the Bridge named it>"}}` and **not** DS-13
**And** the two are provably distinct in the transcript: DS-13 carries no `params.method` and DS-26 always does, because the gateway is not silent here and `isn't answering` would be the wrong sentence and a restart would be the wrong fix
**And** the pinned Hermes release is recorded in the `systemd --user` unit's environment, not discovered at runtime.

**Given** a Project where several PM-scoped conditions hold at once — for example a PM declared, absent from the fleet registry, **and** bound to a `role_dir` that is not on disk
**When** I `GET /v1/project/:pjid`
**Then** `degraded[]` carries **exactly one** Chat-gating PM code, chosen by the fixed precedence `DS-25 → DS-11 → DS-12 → DS-20 → DS-13 → DS-26`, because each is a precondition for testing the next
**And** the order lives in one exported table in `contract/src/state.ts`, and a later story appends its codes to the **end** of it rather than interleaving them — Story 3.6 appends `DS-24` and `DS-28`, which is why this story asserts six entries and not eight
**And** DS-20 is read from Epic 1's `registry/paths.ts` output rather than re-probed here
**And** `DS-10` — a **non-PM** Agent binding with a missing `role_dir`, which is also true of this repository today for `sidepiece-scrum-master` — is present in `degraded[]` alongside it and is never treated as a PM code, because gating Chat on DS-10 would kill Chat on the repo being built.

**Given** the Bridge has probed the fleet registry and the gateway
**When** I run `curl -s https://<bridge>/v1/health | jq '.dependencies'`
**Then** the `fleet` and `gateway` rows Story 1.13 registered as `"status":"unprobed"` now report a real status, as two separate rows fed by two separate probe functions — this story **fills** them and adds no row, because DS-12 reads a YAML file and DS-13 reads a WebSocket and one adapter reporting for both cannot produce two causes
**And** every response to both routes carries the `X-Sidepiece-Contract: <CONTRACT_VERSION>` header.

*Satisfies: FR-5(a), FR-5(c), FR-5(d), FR-14(b), FR-15(d), AR5, AR13, AR15, AR22, AR47, AR48, AR50, AR51, UX-DR51*

---

### Story 3.2: A Turn is accepted by writing it down, inside 500ms

As Jarad,
I want the Bridge to take a Turn, classify it, write it down and answer me immediately — without touching Hermes on that path,
So that "the PM has your turn" can be an honest sentence at 79ms instead of a lie told over a seventeen-second cold start.

**Acceptance Criteria:**

**Given** the `turns` table does not exist
**When** this story's forward-only migration `003_turns.sql` runs at Bridge startup and advances `user_version` from `2` to `3`
**Then** `turns` exists with `turn_id` (PK), `pjid`, `generation`, `kind`, `text`, `page_url`, `page_title`, `classified_kind`, `override_applied`, `status`, `answer_text`, `created_at`, `accepted_at`, `clone_path`, `board_id` — plural snake_case, timestamps as ISO-8601 UTC TEXT
**And** `clone_path` and `board_id` are recovery metadata and never keys, so a Turn survives its pjid being renamed out from under it
**And** `generation` is present on the row because "which Project was this actually written against" is the only way SM-3 is ever audited after the fact
**And** `turns/store.ts` is the only module in the Bridge that imports `node:sqlite`, and the snake_case ↔ camelCase mapping happens there and nowhere else
**And** no other table is created by this story.

**Given** the Bridge is running and `holocene` resolves at generation 5
**When** I run
`curl -s -X POST https://<bridge>/v1/project/holocene/turn -H 'content-type: application/json' -d '{"generation":5,"text":"what'\''s in progress?","pageUrl":"https://holocene.delo.sh/board","pageTitle":"Holocene — Board"}'`
**Then** the response is `HTTP/1.1 200` with the body `{"turnId":"<uuid>","kind":"streamed","acceptedAt":"<ISO-8601 UTC>"}` and nothing else
**And** no session was acquired, no gateway call was made and no Bloodbank publish happened on that path — verified by asserting the gateway adapter's call count is unchanged across the request
**And** the round trip measured from the laptop over the tailnet is **≤500ms**, reported as the p95 of 20 consecutive accepts, with the reference measurement at 79ms
**And** an implementation that acquires or warms a session before answering fails this criterion by roughly 14×, which is the whole reason the route is shaped this way.

**Given** the same route
**When** the body omits `generation`, or carries `generation` lower than the Bridge's current value for that pjid
**Then** the response is `HTTP/1.1 409 Conflict` with body `{"error":"stale_generation","pjid":"holocene","received":4,"current":5}` — not a `200` with a `degraded[]`, because nothing is degraded once a mutation is refused
**And** an equal generation passes; a greater one is impossible and is logged as a Bridge bug
**And** the check runs **before** the classification and before the store write, so a refused Turn writes no row
**And** `generation` is read from the request body, never from a header, because FR-15 makes the body a `curl` surface and a guard hidden in a header is a guard nobody types.

**Given** `contract/src/classify.ts` holds the FR-6 rule as a pure function
**When** `classify.test.ts` runs the six-Turn corpus verbatim
**Then** all six pass: `what's in progress?` → Streamed Exchange; `summarize the board` → Streamed Exchange; `why did the resolver ticket stall?` → Streamed Exchange; `start on the resolver ticket` → Dispatched Command; `fix the failing test` → Dispatched Command; `open a PR for the width fix` → Dispatched Command
**And** the rule is a **leading-verb allowlist plus an imperative-mood test**, not a bag of keywords anywhere in the sentence: normalise by trimming and lowercasing and stripping leading punctuation; a leading interrogative (`what`, `why`, `how`, `when`, `where`, `who`, `is`, `are`, `did`, `does`, `can`) or a trailing `?` classifies Streamed; a leading verb on the **knowledge list** (`summarize`, `explain`, `list`, `show`, `describe`, `tell`, `review`, `check`) classifies Streamed; a leading verb on the **change list** (`start`, `fix`, `open`, `create`, `add`, `remove`, `delete`, `deploy`, `merge`, `rebase`, `close`, `assign`, `implement`, `refactor`, `run`, `ship`, `revert`, `rename`, `move`, `update`, `bump`, `release`, `build`, `write`, `land`, `file`, `push`) classifies Dispatched; anything unplaced classifies **Dispatched Command**, and an empty string classifies Dispatched Command
**And** the function is exported from `contract/` and is never re-declared in `bridge/` or `extension/`, which `tsc` enforces.

**Given** a Turn whose text classifies as Streamed Exchange
**When** the POST body carries `"override":"dispatched"`
**Then** the Bridge re-evaluates the rule authoritatively, observes the explicit override, and **honours it** — the response `kind` is `"dispatched"` and `override_applied` is true on the row
**And** with no `override` field present the Bridge's own re-evaluation wins, which is what stops a stale extension build from dispatching something the current rule would stream.

**Given** Turns have been accepted against `holocene`
**When** I run `curl -s 'https://<bridge>/v1/project/holocene/turns?limit=30'`
**Then** the response is `HTTP/1.1 200` with `{"turns":[…],"degraded":[]}`, most recent last, each Turn carrying `turnId`, `kind`, `text`, `pageUrl`, `pageTitle`, `status`, `createdAt`, `acceptedAt` and `answerText` when one exists
**And** `?before=<turnId>` returns the page of Turns older than that one, so the Cockpit can load older on demand rather than rendering the whole history
**And** a request for a different pjid returns none of these rows — the query is keyed on `pjid` and there is no code path that returns a Turn under a Project that did not own it.

*Satisfies: FR-6(a), FR-6(c), FR-6(d), FR-6(e), FR-7(a), FR-10(a), FR-10(c), FR-11(b), FR-11(d), FR-15(d), FR-15(e), NFR-7, NFR-9, AR19, AR20, AR22, AR26, AR28, AR29, AR31, AR39, AR40, AR43*

---

### Story 3.3: Compose a Turn, see how it will be treated, and hand it to the PM

As Jarad,
I want a composer in the Chat pane that tells me — before I commit — whether this Turn will stream back or be dispatched, what page it is carrying, and which PM it is going to,
So that the split between asking and assigning is a decision I make with my eyes open rather than one the product makes behind my back.

**Note.** Key-screen findings 1 and 2 (UX-DR79, UX-DR80) and finding 9 (UX-DR87) are resolved in the first three criteria below, before any other criterion in this story is exercised. Finding 5 (UX-DR83) is resolved in the second.

**Acceptance Criteria:**

**Given** `EXPERIENCE.md`'s IA table says the action bar "grows upward to a cap, then scrolls internally" while `DESIGN.md` says "one scroll region on screen: the body" and calls a nested scroll region in a 284px column a trap-the-wheel bug, and the specified composer stack measures **233px at rest** and **269px with FR-10's URL revealed** against its stated **188px cap**
**When** the composer is built
**Then** the composer **inherits Story 2.12's shell rule rather than re-deciding it**: the action bar is `height: auto` with no `max-height`, the 188px cap is already gone, and the bar grows upward and pushes the body, which keeps the body the only scroll region on screen
**And** the growth is bounded at the **text field** and nowhere else — the focused `<textarea>` grows to the six-rendered-line ceiling Story 2.12 licensed, which measures **288px** for the fully-revealed stack (269px specified, plus 19px for one further line of `{typography.body}` draft), and then scrolls natively; this is the single sanctioned exception Story 2.12 named, and `overscroll-behavior` is left at `auto` on that field so a wheel event at its scroll boundary chains to the body rather than being trapped
**And** **no type is shrunk to absorb any of it**, and the body is permitted to reach zero height at that worst case, because the operator is typing and not reading at that moment
**And** the resolution is recorded in the implementation notes citing Story 2.12, because the two spines contradict each other here and the next reader must not have to rediscover it.

**Given** the `[v2]` attachment seat the Version Seam reserves in the composer's action row
**When** the composer's action row is laid out
**Then** the seat sits **in the action row, below the classification control**, so `{components.classificationControl}` keeps the full **244px** inner width and its headline measurement stands unchanged: `DISPATCHED COMMAND` at 18 characters × 7.36px = **132.5px in 244px**, 111.5px spare
**And** the seat renders as **nothing** in v1 — not a disabled control, because a greyed-out attachment button is a promise and an empty slot is a layout decision.

**Given** `DESIGN.md`'s own audit test — remove every hairline; if a region becomes ambiguous, that region needs a `strong` rule — and Story 2.12's promotion of the action bar's boundary from the 1.49:1 hairline to a 1px `{colors.border.strong}` seam
**When** the composer's top boundary is drawn
**Then** it **is** that promoted seam rather than a second one: the composer sits on the action bar's existing `{colors.border.strong}` edge, draws no boundary of its own, and a test asserts exactly one horizontal rule separates the body from the action bar at every composer height.


**Given** the Chat pane is selected and the composer is empty
**When** it renders
**Then** `{components.classificationControl}` shows the standing default **DISPATCHED COMMAND**, rendered as two full-width stacked 30px rows boxed in 1px `{colors.border.strong}` with a 1px internal rule, each row carrying its term in `{typography.label}` uppercase, the selected row carrying a 2px `{colors.action.mark}` underline inside the cell — never a spot fill
**And** the term is rendered **verbatim and complete** — `STREAMED EXCHANGE` / `DISPATCHED COMMAND` — and is never abbreviated at any width; `DISPATCHED CMD` anywhere in the rendered output fails this criterion, because an abbreviation is a synonym and the Glossary forbids one
**And** there is no blank state: an unclassifiable Turn classifies as Dispatched Command and says so.

**Given** I am typing in the composer
**When** I stop typing for **400ms**
**Then** the classification recomputes once, by calling the same `contract/src/classify.ts` function the Bridge re-evaluates at send, at zero latency with no network call and no in-flight state rendered
**And** it does **not** recompute on a keystroke — a keystroke-driven test that types `start on the resolver ticket` one character at a time must observe exactly one classification change, not twenty-seven
**And** the consequence line under the control reads exactly `This will stream back here.` for Streamed Exchange and exactly `This will be published and acknowledged. The result arrives later.` for Dispatched Command — the second is the honest line for the world FR-9 has not landed in yet.

**Given** the control shows one classification
**When** I click the other row, or press `Alt+M`
**Then** the classification flips, is **pinned until send** and does not recompute on any subsequent typing pause in that Turn
**And** on send the override is discarded, so the next Turn starts from the rule again — an override is never implicitly applied to a later Turn
**And** `Alt+M` is an accelerator, not the only path: the control is also a button reachable by `Tab` and operable with `Enter`/`Space`.


**Given** the active tab is `https://holocene.delo.sh/board` titled `Holocene — Board`
**When** the composer renders
**Then** `{components.contextChip}` shows the **page title** on one line at rest in `{typography.body}`, wrapping to at most two lines, in a `{colors.surface.sunken}` block with a dashed 1px `{colors.border.hairline}` bottom rule at the top of the composer, 248px inside
**And** focusing or hovering the chip reveals the **URL** in `{typography.mono}` at `{colors.text.machine}`, wrapping to two lines, never elided — and the reveal is reachable by keyboard, because hover must never be the only path
**And** if the title or the URL cannot be read, the chip names **which one** is missing and the Turn still sends, because a Turn with partial context beats a blocked Turn.


**Given** a composed Turn and a resolved Project at `(pjid, generation)`
**When** I press `Enter`, or activate the send control
**Then** the Cockpit refuses locally first if it holds a stale generation, rendering `The Project changed while that was in flight. Nothing was written.`, keeping the text and offering **no** re-resolve control
**And** otherwise it `POST`s to `/v1/project/:pjid/turn` with `generation`, `text`, `pageUrl`, `pageTitle` and, when the operator flipped it, `override`
**And** within 500ms a `{components.turnCard}` appears rendering the operator's turn — variant (a): a 2px `{colors.action.mark}` left rule at 9px inset, serif roman at `{colors.text.primary}`, the only spot-marked content in the scroll region — followed by the accepted state reading exactly `the PM has your turn`, byte for byte, asserted by a test against the constant in the copy module
**And** the accepted state is never rendered as `Sending…`, a spinner, or a bare glyph
**And** the send control's label names its target — `SEND TO <pm>` in `{typography.label}` uppercase, 20 characters at 7.36px = 147px inside a 264px action row — because every mutating control states its target inside itself.

**Given** the send fails at the transport
**When** the failure returns
**Then** the entered text **stays in the box**, the failure is named rather than reported as "something went wrong", and no Turn card is left pending.

**Given** a Turn has just been sent and the Chat pane re-renders around the composer
**When** the re-render lands
**Then** focus **stays in the text field** and is never on `<body>`, and the field is cleared for the next Turn
**And** when the Project changes under an open Cockpit, focus moves to the pane switch — a defined landing — rather than being lost.

**Given** `Shift+Enter` and `Escape`
**When** each is pressed in the composer
**Then** `Shift+Enter` inserts a newline and does not send
**And** `Escape` **blurs the field and keeps the text** — it never clears it, and it never closes the Cockpit, because only the icon can.

**Given** draft text in the composer
**When** I type
**Then** the draft is debounced continuously to `chrome.storage.local` keyed by pjid through `lib/storage.ts`'s continuity keyspace — never through `lib/cache.ts`'s `fr2:` keyspace — and restored on the next open, because collapse is the same teardown event as close and `onClosed` is a belt rather than the braces
**And** if the storage read throws or returns empty the composer renders empty and works
**And** the draft is never the only source of a rendered fact.

*Satisfies: FR-6(b), FR-6(e), FR-7(a), FR-10(a), FR-10(b), FR-10(c), NFR-3, NFR-9, AR19, AR20, AR41, AR78, UX-DR18, UX-DR19, UX-DR20, UX-DR21(a), UX-DR49, UX-DR50(1), UX-DR52, UX-DR54, UX-DR55, UX-DR57, UX-DR59, UX-DR61, UX-DR62, UX-DR63, UX-DR67, UX-DR70, UX-DR79, UX-DR80, UX-DR83, UX-DR87*

---

### Story 3.4: Chat says why it is unavailable, hands over the command, and leaves Tickets alone

As Jarad,
I want the Chat pane to tell me which of the four PM problems I have and, when no PM is declared, to hand me the exact provisioning command in a form I can paste,
So that landing on a Project with no PM costs me one copy and one paste instead of a lookup, and so that a missing agent never takes my Tickets with it.

**Acceptance Criteria:**

**Given** a Project whose `degraded[]` carries `DS-11`
**When** the Chat pane renders
**Then** `{components.stateNotice}` renders the headline `No PM is declared for <repo>.` with `<repo>` substituted from the Project Record
**And** below it `{components.commandString}` renders the Bridge's command verbatim in `{typography.mono}` at `{colors.text.machine}`, `user-select: all`, `word-break: break-all`, never elided, carrying a `{components.copyControl}` and **one empty `[v2]` action slot** at its trailing edge
**And** the notice carries a `{components.reResolveControl}`
**And** v1 **states** the command and does not run it.

**Given** the same DS-11 state and a Bridge response whose `command` field is absent or empty
**When** the Chat pane renders
**Then** the notice renders its sentence plus `The Bridge did not return the command for this. That is a Bridge bug.` and the client logs it — never an empty command block, and never a command the Cockpit composed
**And** the Cockpit is verified to contain no command-text template anywhere in `cockpit/` or `copy/`.

**Given** a Project whose `degraded[]` carries one of DS-12, DS-13, DS-20 or DS-25
**When** the Chat pane renders
**Then** the headline is exactly, byte for byte, one of:
`` `<pm>` is declared but isn't in the Hermes fleet registry. `` (DS-12) ·
`` `<pm>` is registered but isn't answering. `` (DS-13) ·
`` `<pm>` is bound to a role directory that isn't on disk. `` with detail `The PM is declared, but the directory it runs out of isn't there.` (DS-20) ·
`This Bridge is older than its Turn store.` with detail `The store was written by a newer Bridge. Nothing has been read, and nothing has been migrated.` (DS-25)
**And** no sentence is reused across two codes — a lint over `copy/states.ts` asserts uniqueness across all strings in the module
**And** exactly one notice renders, chosen by the precedence Story 3.1 established.

**Given** any of DS-11, DS-12, DS-13, DS-20 or DS-25
**When** the Chat pane renders
**Then** the composer is **disabled**, its draft is kept, and the reason is pinned to the composer itself in the **same form Story 2.23 gave the disabled create box** — the state's headline sentence on a wrapping line in `{typography.label}` at `{colors.text.muted}` directly above the send row, with the send label becoming `CAN'T SEND` — so the reason is still legible once the pane notice has scrolled out of the pinned action bar's sight, and the product's two action bars do not diverge
**And** it is **not** set in `{typography.micro}`, because that role is `DESIGN.md`'s 10.5 Floor Rule reserve for static chrome and this line is variable content
**And** the classification control and the context chip are disabled with it
**And** `{components.paneSwitch}`'s Chat cell carries its own status marker so the pane says it is failing **while hidden**
**And** every state renders a `marks.*` glyph **and** a word alongside its `{colors.state.*}` value, because `{colors.state.ok}` and `{colors.state.unknown}` are the identical hex and a hue alone is not a signal.

**Given** any of those five states
**When** I switch to the Tickets pane
**Then** the Tickets list renders, the refetch control works and the create box is **enabled** — no Chat-scoped state may ever disable the Tickets pane
**And** this is asserted on `sidepiece` itself, which carries DS-12 today with no setup.

**Given** a Project whose only Agent-scoped code is `DS-10` — a non-PM binding with a missing `role_dir`, true of `sidepiece-scrum-master` in this repository today
**When** the Cockpit renders
**Then** Chat is **fully live**, the composer is enabled, and DS-10 renders as one informational line at the header level gating nothing
**And** a test asserts that no code path routes DS-10 into the Chat gate.

**Given** each of the states in this story
**When** the notice appears
**Then** it announces **once** into a `polite` live region and never re-announces on a tab switch between two tabs of the same Project
**And** it renders neither as an empty region nor as a spinner, and it always contains at least one control.

*Satisfies: FR-5(b), FR-5(c), FR-5(d), FR-3(a) as FR-5's proof, NFR-2, AR13, AR15, AR51, UX-DR12, UX-DR14, UX-DR16, UX-DR17, UX-DR27, UX-DR41, UX-DR48, UX-DR49, UX-DR51, UX-DR64, UX-DR65*

---

### Story 3.5: This Project's Turns come back, and no other Project's do

As Jarad,
I want the Chat pane to reload this Project's prior Turns when I reopen the Cockpit, and to be structurally incapable of showing me another Project's,
So that a thread I left is the thread I come back to, and a Turn appearing under the wrong header — the same class of error as a confidently wrong Ticket — cannot happen.

**Acceptance Criteria:**

**Given** `holocene` has prior Turns in the Bridge's store
**When** the Cockpit opens on a `holocene` tab and the Chat pane is selected
**Then** the pane renders `Loading this Project's Turns.` as one line while the read is in flight, with the read's budget as a deadline, and **the composer is live immediately** — history arriving late never gates sending
**And** when the read lands, the most recent **30** Turns render in order, each as a `{components.turnCard}` separated by a 1px `{colors.border.faint}` rule at `{spacing.stack}`
**And** older Turns load on demand rather than the whole history rendering on open.

**Given** the history read does not return inside its deadline
**When** the deadline passes
**Then** the line **becomes** a timeout state naming what it was waiting on, with a retry control — never an indefinite pending state and never an empty pane
**And** on a relayed connection the deadline is taken from Story 2.14's named constants — **×3 with a 6-second floor** — and the expiry sentence says the connection is relayed and there is no budget for this, with a retry; the promise is dropped, the deadline is not.

**Given** the Cockpit is open on `holocene` with Turns rendered
**When** I switch to a tab on a different Project
**Then** the Chat pane's content is **discarded in the same frame** as the identity header, the new Project's Turns are loaded from zero, and the pane resets to Tickets
**And** no Turn, no partial text and no card crosses the pjid boundary — a test asserts there is no code path in which two regions render from different `(pjid, generation)` frames
**And** nothing whatsoever is rendered about the Project I left: no marker, no count, no toast.

**Given** Turns exist for `holocene` and for `sidepiece`
**When** each Project's Chat pane is rendered in turn
**Then** neither thread contains a Turn belonging to the other, asserted directly against the store
**And** history is **appended per Turn** rather than rewritten wholesale, so two Cockpit documents in two Chrome windows on the same Project cannot clobber each other — asserted by interleaving accepts from two clients and reading back both.

**Given** Turns exist
**When** I close the panel, collapse the panel, restart Chrome, or let the extension service worker be terminated after its ~30s idle
**Then** reopening the Cockpit on that Project restores the Turns from the Bridge
**And** nothing about Turn history is read from `chrome.storage.local` — the Bridge is the system of record, and the panel document is not.

*Satisfies: FR-11(a), FR-11(b), FR-11(c), FR-11(d), FR-15(e), NFR-3, NFR-4, NFR-8, AR31, UX-DR21, UX-DR48, UX-DR58, UX-DR72, UX-DR73*

---

### Story 3.6: A warm PM session that is never taken from live work

As Jarad,
I want the Bridge to keep a few PM sessions warm and to say honestly when it cannot get me one — naming whether the cap is the gateway's or Sidepiece's own,
So that a Project switch does not pay a seventeen-second cold start every time, and so that a Turn that cannot be started tells me which fix applies instead of hanging.

**Acceptance Criteria:**

**Given** `sessions/pool.ts` holds a warm-session registry keyed by pjid, tracking last-Turn time and liveness, in memory only
**When** the pool is at its configured capacity of 3–5 warm sessions and a new Project needs one
**Then** it evicts the **least recently used among idle sessions only**
**And** a session with a Turn in flight — streaming, or awaiting a dispatch outcome — is **never** evicted, asserted by holding a stream open on one session, driving the pool past capacity, and observing the held session survive
**And** the pool does not survive a Bridge restart and is not persisted, because a warm session does not survive a restart anyway.

**Given** every session in the pool is busy and none goes idle
**When** a new Turn needs one
**Then** the wait is bounded at **20 seconds** — chosen to exceed the worst measured cold start of 17.1s — and on expiry the Turn is marked `DS-28` and is **not started**
**And** `curl -s https://<bridge>/v1/health | jq '.sessions'` reports `{"warm":n,"busy":n,"capacity":n}` so the condition is observable without a browser
**And** DS-28 renders through Story 3.4's Chat notice with the headline `No PM session was free for that turn.` and the detail `Your other Projects are mid-Turn. Nothing was sent, and the text is still here.`, and the composer text is kept.

**Given** the Hermes gateway refuses a new session with error **4090** — its active-session cap across the ~37 shared profiles
**When** the Bridge observes it
**Then** it is reported as `DS-24`, **not** retried in a loop, and **not** collapsed into DS-28
**And** DS-24 renders as `The Hermes gateway is at its session limit.` / `Something else on big-chungus is holding the sessions. Nothing here can free one.` with **no retry offered**, because no amount of Sidepiece restraint reaches a shared cap
**And** a test asserts the two sentences are distinct and that DS-24 and DS-28 are never emitted for the same cause: DS-24 is the gateway's cap, DS-28 is Sidepiece's own pool of 3–5.

**Given** either of those states
**When** the Chat pane renders it
**Then** the Tickets pane and resolution stay **fully live** — both codes gate Chat only.

**Given** Story 1.14's `gateway` dependency row, which ships `expectedProvider` and `expectedModel` read from the pinned Hermes profile alongside `reportedProvider: null`, `reportedModel: null` and `"status":"unprobed"`, and which explicitly refused to stub a reported value
**When** the pool holds a warm session and the health check runs
**Then** the row reports the provider and the model that session actually resolved, and its `status` is no longer `unprobed`
**And** when either reported value differs from its expected value, the row carries `{"ds":"DS-8","params":{"probe":"provider_mismatch","expected":"<value>","reported":"<value>","dependency":"gateway"}}` — the second half of AR66, inherited from Story 1.14 and completed here because this is the first story in which a session exists to ask
**And** if the pinned Hermes release does **not** report a resolved provider or model per session, that is recorded in `docs/measurements/gateway-degradation.md` with the date and the row stays `unprobed` rather than reporting a comparison it cannot make — AR66's `[ASSUMPTION]` is closed either way, and a fabricated comparison fails this criterion
**And** reading the row never acquires a session of its own, for the same reason Story 3.1's liveness probe does not.

*Satisfies: FR-5(a), FR-7(b) precondition, FR-14(b), FR-14(e) (AR66's reported half, inherited from Story 1.14), FR-15(d), NFR-2, AR44, AR45, AR46, AR66, UX-DR41, UX-DR48*

---

### Story 3.7: The answer streams over SSE, with the placeholder typed as a placeholder

As Jarad,
I want `curl -N` to show me a Turn's answer arriving frame by frame, with the gateway's spinner text typed as a placeholder rather than smuggled in as content,
So that the first-token budget is measured against a real answer and not against an animation, and so that every streaming bug is a one-variable bug.

**Acceptance Criteria:**

**Given** a Turn accepted by Story 3.2 with `turnId` `t-abc`
**When** I run `curl -N https://<bridge>/v1/project/holocene/turn/t-abc/stream`
**Then** the connection opens within **2s**, and the first frame is `event: open` with a JSON `data:` payload carrying `{"turnId":"t-abc","pjid":"holocene","generation":5}`
**And** every frame carries a named `event:` type and exactly one JSON object as its `data:` payload — never a bare string — so `curl -N` produces something a person can follow live
**And** the response carries the `X-Sidepiece-Contract` header like every other route.

**Given** the pool has no warm session for this Project and must open a cold one
**When** the stream is subscribed
**Then** an `event: warming` frame is emitted and **no first-token budget applies** to that Turn
**And** session acquisition, warming and streaming all happen **behind the subscription**, never on the accept POST — asserted by observing that the accept already returned before any gateway traffic occurred
**And** the cold path is measured and recorded, with the reference range 7.1–17.1s.

**Given** the upstream Hermes gateway emits `thinking.delta` spinner text before real content
**When** `turns/stream.ts` maps upstream frames to `StreamFrame`
**Then** `thinking.delta` maps to `{"kind":"placeholder"}` and **never** to `{"kind":"content"}`, and the mapping is made exactly once, in that module
**And** `contract/src/turn.ts` discriminates the two so `tsc` prevents an untyped passthrough of the upstream frame
**And** a `curl -N` transcript of a cold Turn shows one or more `placeholder` frames before the first `content` frame, and the two are distinguishable by a reader without reference to any other document.

**Given** a warm session
**When** the answer generates
**Then** `content` frames arrive incrementally and the **first `content` frame** arrives within **8s p95**, measured over at least 20 warm Turns from the laptop over the tailnet, with the reference range 3.8–5.1s
**And** any acceptance criterion written against a ≤2s first-token figure, or against "first frame received", is wrong and fails this story — the first figure was never achievable on this hardware and the second measures the gateway's animation.

**Given** the answer completes
**When** the last frame is sent
**Then** `event: done` carries the terminal status and the Bridge writes the completed answer into the Turn row's `answer_text` and sets `status`, so FR-7's reopen guarantee is satisfiable from the store rather than from the panel document
**And** a Turn whose stream dies emits `event: failed` carrying the reason, and the row's status becomes `failed` — a stream is never left open and never left pending.

*Satisfies: FR-7(b), FR-7(c), FR-7(d), FR-7(f), FR-15(d), FR-15(e), NFR-7, AR21, AR22, AR43*

---

### Story 3.8: The answer streams into the panel while it is still being written

As Jarad,
I want the Turn card to fill with the answer as it generates, and to say `warming up the PM` when the session is cold instead of pretending to think,
So that I can read the answer beside the page before it is finished, and so that the longest wait in the product is named rather than hidden behind a spinner.

**Acceptance Criteria:**

**Given** a Turn accepted and rendered by Story 3.3
**When** the Cockpit subscribes to its stream
**Then** the `EventSource` is opened by `lib/stream.ts`, which is imported **only** by modules under `entrypoints/sidepanel/`
**And** a static import of `lib/stream.ts` from anywhere under `entrypoints/background/` fails an explicit lint rule in `biome.json` — the one import rule in this project worth its own lint, because `EventSource` has no documented exemption from the service worker's ~30s idle timer
**And** if the subscription does not establish within **2s** the card renders `Not subscribed to this Turn's answer. It is still running on the Bridge.` with a retry, lodged outside the DS taxonomy as a `SubscriptionState`, gating no pane
**And** that sentence is explicitly **not** `Not subscribed to outcomes. Dispatched results won't land here until this reconnects.`, which belongs to the project-scoped outcomes subscription Story 4.7 builds and which this epic has nothing to subscribe to; Story 2.7's copy-uniqueness lint fails the build if one string appears under two conditions, so this story adds its own row to `copy/progress.ts` **and** to `EXPERIENCE.md` in the same change (AR15).

**Given** the session is cold and a `warming` frame arrives
**When** the card updates
**Then** it reads exactly `warming up the PM`, byte for byte, asserted against the copy-module constant
**And** it is **never** shown on a warm session
**And** it replaces the first-token budget rather than sitting alongside one.

**Given** `placeholder` frames arrive before any `content` frame
**When** the card renders
**Then** it continues to show the accepted state — `the PM has your turn` — or `warming up the PM`, and renders **no placeholder text as the answer**
**And** it never shows only a spinner for a response in progress.

**Given** `content` frames arrive
**When** they render
**Then** partial output appears as it arrives, as `{components.turnCard}` variant (b) — a `{typography.micro}` kicker at `{colors.text.muted}` then the reply in `{typography.body}`, no box, no ground, no border, printed directly onto the sheet
**And** the Turn list is **bottom-anchored while streaming** and stops following the moment I scroll up
**And** while I am scrolled up away from a streaming Turn and something is arriving, `{components.jumpToLatest}` appears bottom-right above the action bar — a 28px `{colors.action.primary}` control with the struck-plate keyline, label `LATEST` in `{typography.label}`, no shadow — and returns me to the bottom and re-arms anchoring
**And** it never appears on a quiet thread.

**Given** an answer completes
**When** it lands
**Then** a `polite` live region announces **the completed answer**, not every token
**And** the state transitions *turn accepted*, *warming*, *stream failed* announce **once each**, and nothing announces twice.

**Given** `prefers-reduced-motion: reduce`
**When** a Turn streams
**Then** the streaming caret does not pulse, no progress line shimmers, and every state change is a text swap
**And** every streaming state remains comprehensible with all animation disabled.

**Given** the first-token budget
**When** it is measured
**Then** the Cockpit records `t0` at send and `t1` at the first `StreamFrame` whose `kind` is `content`, and reports p95 over at least 20 warm Turns as **≤8s**
**And** placeholder frames are excluded by type rather than by heuristic.

*Satisfies: FR-7(b), FR-7(c), FR-7(d), NFR-3, NFR-7, AR14, AR21, AR74, UX-DR21(b), UX-DR22, UX-DR48, UX-DR50(2), UX-DR58, UX-DR64, UX-DR66*

---

### Story 3.9: A stream that dies says so, and a Turn survives me leaving the page

As Jarad,
I want a broken stream reported as failed with whatever text arrived kept and marked partial, and a Turn I walked away from to still be there when I come back,
So that nothing is ever left spinning, and so that closing the panel mid-answer is a thing I can do rather than a thing that costs me the Turn.

**Acceptance Criteria:**

**Given** a Turn streaming into the panel
**When** the stream dies mid-answer
**Then** the card renders `The stream stopped before the answer finished.`, keeps the partial text and **marks it partial**
**And** the Turn is reported as **failed**, never left pending
**And** the failure announces once into the live region.

**Given** a Turn that completed while the Cockpit was closed
**When** I reopen the Cockpit on that Project
**Then** the completed answer is retrieved from the Bridge's `answer_text` and rendered in the card, in its original position in the thread
**And** the card states which it is showing with the line `Showing the finished answer.`

**Given** a Turn that was still streaming when the Cockpit closed or collapsed
**When** I reopen
**Then** the card states `That Turn was still streaming when the Cockpit closed. The partial text didn't survive.` and shows the Turn's current status from the store
**And** partial tokens are explicitly best-effort and the card never implies otherwise
**And** both of these sentences are added to `copy/states.ts` **and** to `EXPERIENCE.md`'s normal-path table in the same change.

**Given** a Turn streaming on `holocene`
**When** I switch to a tab on a different Project mid-stream
**Then** the Cockpit drops its client-side subscription for the Project it left and re-renders atomically onto the new `(pjid, generation)`
**And** the Turn **stays owned by its originating pjid in the Bridge and continues there** — it is not cancelled by a tab switch, verified by reading the store after the switch
**And** it is **never** rendered in the new Project's thread
**And** the partial text accumulated before the switch is **discarded, not carried**, because a partial re-rendered after a round trip is indistinguishable from a stale one
**And** returning to `holocene` shows the Turn in its own thread, in its original position, carrying whatever terminal state it reached.

**Given** any in-flight chat state — accepted, warming, streaming, subscribing
**When** its deadline passes
**Then** it **becomes** a timeout state naming what it was waiting on, with a retry control
**And** under a relayed connection the deadline is taken from Story 2.14's named constants — **×3 with a 6-second floor**, so the 500ms accept becomes 6s, the 2s subscribe becomes 6s and the 8s warm first token becomes 24s — and only what expiry *says* changes; no in-flight chat state may ever become indefinite while the degraded-connection indicator is up.

*Satisfies: FR-7(e), FR-7(f), FR-11(a), FR-15(e), NFR-2, NFR-3, NFR-8, AR15, UX-DR13, UX-DR21, UX-DR48, UX-DR64, UX-DR72*

---

### Story 3.10: Work is published on a legal five-token subject and acknowledged with an id the Bridge minted

As Jarad,
I want a Turn classified as work published to Bloodbank through the fleet gateway and acknowledged with a correlation identifier,
So that `start on the resolver ticket` becomes a real command I can chase by hand through `bb` or Candystore, rather than a message that disappears.

**Acceptance Criteria:**

**Given** the `dispatches` table does not exist
**When** this story's forward-only migration `004_dispatches.sql` runs and advances `user_version` from `3` to `4`
**Then** `dispatches` exists with `turn_id` (PK), `pjid`, `generation`, `correlation_id`, `subject`, `publish_status`, `dispatched_at`, `clone_path`, `board_id` — `publish_status` holds `dispatched` or `rejected` and nothing else, and **no outcome column is created here**, because this story writes none
**And** `generation` rides alongside `pjid` because this row is a mutation
**And** no other table is created by this story.

**Given** a Turn accepted with `kind: "dispatched"`
**When** the stream for that Turn is subscribed and `turns/dispatch.ts` runs
**Then** it mints a `correlationId` itself, persists the `dispatches` row, and publishes through `bloodbank/adapter.ts`
**And** the subject is exactly `bloodbank.cmd.agent.invocation.start` — **five tokens**, `bloodbank.<kind>.<domain>.<entity>.<action>`, with **no version segment and no identity slug**
**And** the target agent travels in `actor.agent_id` and the Project identity in `data.*`, never as a subject token
**And** `subject`, `schemaref`, `dataschema`, `kind`, `domain` and `actor` are derived by `bb emit` and never hand-assembled anywhere in the Bridge.

**Given** the producer is new
**When** the repository's `mise` pre-publish task runs — not a GitHub workflow, because there is no CI on this machine
**Then** `bb emit --check --type bloodbank.agent.invocation.start` passes, and the deploy task depends on it
**And** `bb` is invoked by **absolute path** from `Environment=` in the `systemd --user` unit, because a unit that inherits `PATH` works by hand and fails at boot.

**Given** the dispatch is published
**When** the acknowledgement returns
**Then** an `event: dispatched` SSE frame carries `{"turnId":"…","correlationId":"…","dispatchedAt":"<ISO-8601 UTC>"}` within **≤2s** of the Turn being accepted, measured from the laptop over the tailnet
**And** `correlationId` is camelCase on every Sidepiece surface — the Bridge's HTTP and SSE API and everything in `contract/` — and is serialised to Bloodbank's `correlationid`, **no separator**, only inside `bloodbank/adapter.ts`
**And** a camelCase-ifying middleware applied across all payloads is a review failure, because it silently rewrites `correlationid` and breaks the one correlation mechanism that is confirmed to work today
**And** `curl -N` on that Turn's stream shows the `dispatched` frame, so the whole path is exercisable without Chrome.

**Given** Bloodbank answers and **refuses** the command
**When** the refusal returns
**Then** an `event: rejected` frame carries the reason as Bloodbank reported it, the Turn's status becomes `rejected`, and nothing reports success
**And** the refusal is distinct in the transcript from Bloodbank being unreachable, which is Story 3.12's DS-18.

**Given** a dispatched Turn
**When** it is published
**Then** its `publish_status` is `dispatched` and the row carries no outcome column of any kind — the outcome columns are added by Story 4.2, which is the story that first writes one
**And** this story claims **nothing** about an outcome or a result — FR-9 is Epic 4's and is blocked on another repository.

*Satisfies: FR-8(a), FR-8(c), FR-8(d), FR-15(d), NFR-7, AR26, AR28, AR29, AR54, AR55, AR56, AR63*

---

### Story 3.11: A dispatch renders as a dispatch, not as an answer

As Jarad,
I want a dispatched Turn to look nothing like a streamed one, and to hand me its correlation identifier in a form I can paste,
So that I can tell at a glance which Turns are questions and which are work, and chase the work myself through `bb` while the result path is still being built.

**Acceptance Criteria:**

**Given** a Turn dispatched by Story 3.10
**When** its card renders
**Then** it renders as `{components.turnCard}` variant (c): a bordered block with a 1px `{colors.border.strong}` edge, opening with a `{colors.surface.stamp}` band carrying the state mark and the state word `DISPATCHED`, both in `{colors.text.inverse}`, and **nothing else** — the correlation id is not in the band, because a complete 36-character UUID is 252px of a 282px band and UX-DR49 rule 4 forbids eliding a machine identifier, and because `#C9BDA6` is not one of the 54 tokens; Story 4.6 adds the terminal words to this same band and removes nothing — and an inner body on `{colors.surface.raised}` carrying the acknowledgement in `{typography.mono}` at `{colors.text.machine}`
**And** it is **visibly distinct** from the streamed variant above it, which has no box, no ground and no border — a side-by-side render of one of each is the acceptance artifact
**And** the pending line reads exactly `` Dispatched. `<correlation id>`. `` — never a green checkmark and never a bare glyph.

**Given** the correlation id is rendered
**When** I reach for it
**Then** it carries a `{components.copyControl}` that copies the **complete** identifier and confirms by swapping its own label for one beat — no toast, no tick, no fill, no colour change
**And** if the clipboard write throws it says so in place and the text remains selectable, which was always the primary path
**And** the identifier is selectable, complete and never elided, because a machine identifier is complete or absent.

**Given** the dispatch is rejected
**When** the `rejected` frame arrives
**Then** the card surfaces the rejection and its reason, e.g. `Bloodbank refused the command: the subject is not five tokens.` — never silent success
**And** the band word becomes `REJECTED` with `marks.failed`, and `publish_status` on the row is `rejected`
**And** this is worded and rendered differently from any unreachable-transport state.

**Given** a dispatched Turn whose outcome has not arrived
**When** the card renders
**Then** it stops at its terminal acknowledged status and claims nothing further — no status word implying completion, no result region rendered empty
**And** the card **reserves** the region the result content will occupy without drawing a disabled control or a placeholder in it, because a reserved seat renders as nothing in v1
**And** the consequence line the composer showed — `This will be published and acknowledged. The result arrives later.` — is the truth this card is consistent with.

**Given** the dispatched card
**When** it is inspected for accessibility
**Then** the state mark and the state word both render — no state is carried by hue alone
**And** every control on the card is reachable and operable from the keyboard, with the two-tone `:focus-visible` keyline, and no interactive target is smaller than 24 × 24 CSS px
**And** the whole card fits the 284px usable column at the 320px design width with no horizontal scroll.

*Satisfies: FR-8(a), FR-8(b), FR-8(c), UX-DR12, UX-DR21(c), UX-DR49, UX-DR52, UX-DR59, UX-DR61, UX-DR63, UX-DR65, UX-DR67, UX-DR70*

---

### Story 3.12: Bloodbank unreachable leaves questions working

As Jarad,
I want an unreachable Bloodbank to take out dispatch and nothing else — composer still live, questions still answered, and the flip control right there,
So that half a Chat pane is still a working Chat pane, and so that the one honest response to "dispatch is down" is never "chat is down".

**Acceptance Criteria:**

**Given** the Bridge is up and its Bloodbank probe reports unreachable at the transport
**When** the Chat pane renders
**Then** the Streamed Exchange path stays **fully live** and the composer stays **enabled**
**And** the notice reads exactly `The Bridge is up. Bloodbank isn't reachable.` / `Questions still work. Anything that would be dispatched can't be published right now.`
**And** disabling all of Chat here is the explicitly forbidden behaviour and fails this story.

**Given** DS-18 is present
**When** I send a Turn that classifies as Dispatched Command
**Then** the accept route refuses it **before publish**, returning `HTTP/1.1 200` with `{"degraded":[{"ds":"DS-18"}]}` and **no** `turnId` — a read of already-held health state, so the 500ms accept budget still holds and no upstream call is made
**And** the Cockpit also refuses locally first when it already holds DS-18 in the current `degraded[]`, so the common case costs no round trip
**And** **the text is kept** in the composer.

**Given** the refusal has rendered
**When** I look for the way out
**Then** `{components.classificationControl}`'s flip is right there in the composer, and flipping to **STREAMED EXCHANGE** sends the same text successfully
**And** the flip lives for that Turn only and is discarded on send.

**Given** DS-18 and a Bloodbank that is **answering and refusing** a command
**When** each is rendered
**Then** the two are worded differently and are never produced for the same cause — DS-18 is unreachable at the transport, a five-token subject rejection is Bloodbank answering
**And** a test asserts the two strings are distinct and that neither appears under the other's code.

**Given** DS-18
**When** the Tickets pane and the identity header render
**Then** both are **fully live** — DS-18 is the only half-pane state in the product and it gates half of Chat and nothing else
**And** `{components.paneSwitch}`'s Chat cell marks the pane degraded while hidden, and the marker distinguishes half-gated from fully gated.

*Satisfies: FR-8(c), FR-6(b), FR-6(e), NFR-2, AR13, AR15, AR51, UX-DR14, UX-DR19, UX-DR41, UX-DR43, UX-DR48, UX-DR49*

---

## Epic 4: Get the answer back from the work you dispatched

UJ-2's closing beat, the one the journey text singles out: *"later shows the result in the same thread rather than only a green checkmark."* A Dispatched Command stops being a receipt and becomes an answer. It reaches a terminal status — completed, failed, or unknown. It renders the agent's actual **result content** in the Turn rather than a status word. Outcomes correlate back by the identifier the Bridge minted rather than by recency. A dispatch with no observed outcome inside the window reads as **unknown** and never as success. And anything that finished while the panel was closed — the normal case for a command that takes twenty minutes — is reconciled on next open.

**FRs covered:** FR-9.

**Sequence note.** Story 4.1 is out-of-repository work against `33GOD/bloodbank` and is the only thing in this backlog gated on a repository Sidepiece does not own. It starts day one, in parallel with Epic 1, and sits immediately before the rest of this epic. Stories 4.2, 4.4 and 4.5 do **not** depend on 4.1 landing — the status half of FR-9 is buildable today and is written so it can ship while the content half waits. Story 4.3 is the one that needs 4.1.

---

### Story 4.1: [EXTERNAL — `33GOD/bloodbank`] Carry the agent's response text onto the invocation outcome

As an operator of any Bloodbank consumer that dispatches work to a Hermes agent (Jarad among them),
I want the agent's response text carried onto the `bloodbank.agent.invocation.completed` and `.failed` events,
So that a dispatched command returns an answer instead of a receipt, for every consumer on the bus rather than only for Sidepiece.

**Scope note.** This is a Bloodbank defect that happens to unblock Sidepiece, not a Sidepiece patch. Its acceptance criteria belong to Bloodbank's own event contract. No Sidepiece package is touched by this story.

**Acceptance Criteria:**

**Given** `33GOD/bloodbank/services/hermes-gateway/bloodbank_hermes_gateway/adapter.py`, whose `send()` begins at line 684 and whose line 691 reads `del chat_id, content, reply_to, metadata` immediately before `return SendResult(success=True, message_id=str(uuid.uuid4()))`
**When** the fix lands
**Then** `send()` records `content` against the in-flight invocation whose `invocation.thread_id` equals the `chat_id` it was called with — the same value `_dispatch` passes as `build_source(chat_id=invocation.thread_id, …)`
**And** no `del` of `content` remains anywhere in `send()`
**And** a `send()` call whose `chat_id` matches no in-flight invocation discards the content, logs one WARN line carrying the `chat_id`, and still returns `SendResult(success=True, …)` — the call never raises and never changes the gateway's existing return shape.

**Given** an invocation that completes successfully after `send()` delivered one or more content chunks
**When** `terminal_events(...)` in `contract.py` builds `bloodbank.agent.invocation.completed`
**Then** `data.result_content` is a string holding those chunks in the order `send()` received them, joined by `\n\n`
**And** `data.result_truncated` is a boolean, `true` only when the UTF-8 encoding of the joined text exceeded **32768 bytes**, in which case the value is cut at the last whole character at or before that limit
**And** an invocation that delivered no content at all omits both keys entirely — never `result_content: ""`, never `result_content: null`
**And** `correlationid`, `command_id` and `idempotency_key` on the event remain byte-identical to the values on the originating `bloodbank.cmd.agent.invocation.start` envelope, which is what already works today and must not regress.

**Given** an invocation that fails or is cancelled after `send()` delivered content
**When** `bloodbank.agent.invocation.failed` is built
**Then** it carries the same `data.result_content` and `data.result_truncated` fields alongside its existing `data.error_code` and `data.error_message`
**And** the partial text the agent produced before failing is preserved rather than discarded, because a failed run's output is the diagnostic.

**Given** `schemas/bloodbank/agent/invocation.completed.json` and `schemas/bloodbank/agent/invocation.failed.json`
**When** the fields are declared
**Then** both carry `result_content` (`type: string`) and `result_truncated` (`type: boolean`) under `data.properties`, neither added to `required`
**And** `bb emit --check --type bloodbank.agent.invocation.completed` exits `0`, and the same for `.failed`
**And** the published `subject` is still produced by `_subject_for()` and is `bloodbank.evt.agent.invocation.completed` — five tokens, no version segment, no identity slug, never hand-assembled.

**Given** the gateway running against a real Hermes profile on `big-chungus`
**When** a `bloodbank.cmd.agent.invocation.start` is published and the agent answers
**Then** `curl -s "http://127.0.0.1:8683/events?correlationid=<that uuid>&type=bloodbank.agent.invocation.completed" | jq -r '.events[0].data.result_content'` prints the agent's answer text
**And** the identical query captured before the change — which prints `null` — is recorded beside it as the story's before/after transcript.

**Given** the fix at the first criterion proves harder to land than it looks
**When** one hour, and no more, has been spent on the recorded alternative — having a Bridge observe a dispatched command's output through its own `tui_gateway` session, which has never been verified either way
**Then** a written verdict is recorded: it can, or it cannot
**And** the Bloodbank fix remains the chosen path unless that verdict is "it can"
**And** no Sidepiece code is written against the alternative on the strength of an unverified guess.

*Satisfies: FR-9 (unblocks obligation (b)), AR56.*

---

### Story 4.2: A dispatched Turn reaches a terminal status the Bridge can be asked for

As Jarad,
I want the Bridge to ingest agent invocation outcomes over a durable consumer and attach each one to the Turn that caused it,
So that a Dispatched Command stops reading `pending` forever and I can check on it with `curl` from either machine without opening Chrome.

**Acceptance Criteria:**

**Given** Story 3.10's `dispatches` table holding `(turn_id, pjid, generation, correlation_id, subject, publish_status, dispatched_at, clone_path, board_id)` at `user_version = 4`
**When** `db/migrations/005_dispatch_outcome.sql` is applied at startup
**Then** `dispatches` gains `outcome_status TEXT`, `outcome_code TEXT`, `outcome_message TEXT`, `outcome_at TEXT`, `outcome_source TEXT`, all nullable, and `user_version` becomes `5`
**And** the migration is forward-only and creates no table — `turns`, `ticket_creates` and `resolutions` are untouched, because this story writes to one table and only that one
**And** `turns/store.ts` is still the only module in the Bridge that imports `node:sqlite`, and the snake_case ↔ camelCase mapping for the five new columns happens there and nowhere else
**And** timestamps in the new columns are ISO-8601 TEXT, never integers.

**Given** a JetStream stream `BLOODBANK_EVENTS` reachable at `nats://127.0.0.1:4222`
**When** the Bridge starts
**Then** `bloodbank/outcomes.ts` binds a **durable** consumer named `sidepiece-bridge-outcomes` with filter subject `bloodbank.evt.agent.invocation.*`, explicit ack, `AckWait` 30s, and `DeliverPolicy: all` on first creation only
**And** a unit test asserts the filter subject is exactly five dot-separated tokens, contains no version token, and contains no pjid, repo name or agent id
**And** `bloodbank/outcomes.ts` hand-assembles no `subject`, `schemaref`, `dataschema`, `kind`, `domain` or `actor` — it only reads them.

**Given** an outcome event on `bloodbank.evt.agent.invocation.completed` carrying `correlationid: "<uuid>"`
**When** the consumer receives it
**Then** `turns/reconcile.ts` matches it against the outstanding set — rows in `dispatches` where `correlation_id = '<uuid>'` **and** `outcome_status IS NULL` — and against nothing else: not `data.repo`, which dispatch outcomes do not carry at all, not ordering, not recency
**And** a `correlationid` matching no outstanding row is acked and dropped with one INFO line — never stored, never retried, never redelivered forever
**And** matching succeeds even when the row's `pjid` no longer resolves in the Registry, because the row is found by `correlation_id` and carries `clone_path` and `board_id` as recovery metadata rather than as keys
**And** the write is `UPDATE dispatches SET … WHERE correlation_id = ? AND outcome_status IS NULL`, so a redelivery of an already-applied outcome updates zero rows and is a no-op — the first terminal outcome wins and a later contradicting one is acked and logged, not applied.

**Given** the three event types the filter subject matches
**When** each is reconciled
**Then** `bloodbank.evt.agent.invocation.completed` sets `outcome_status = 'completed'`, `outcome_at` = the event's `time`, `outcome_source = 'nats'`
**And** `bloodbank.evt.agent.invocation.failed` sets `outcome_status = 'failed'`, `outcome_code` = `data.error_code` verbatim, `outcome_message` = `data.error_message` verbatim, with no rewording and no translation
**And** `bloodbank.evt.agent.invocation.started` is acked and ignored, because it is not terminal
**And** the row's `generation` is never rewritten: an outcome is not an operator mutation, no `(pjid, generation)` check runs on this path, and no `409 stale_generation` can be produced by it — the generation on the row stays as Epic 3 wrote it, which is what makes SM-3 auditable after the fact.

**Given** a dispatched Turn whose outcome has landed
**When** `curl -s https://<bridge>/v1/project/<pjid>/dispatch/<correlationId>` runs from either machine with no extension installed and no Chrome running
**Then** it returns `200` with `{"correlationId":"…","turnId":"…","pjid":"…","generation":N,"status":"completed","outcomeAt":"…","outcomeCode":null,"outcomeMessage":null}`
**And** `curl -s https://<bridge>/v1/project/<pjid>/turns` returns each dispatched Turn carrying a `dispatch` object with those same fields, while each Streamed Exchange Turn carries no `dispatch` key at all
**And** an unknown correlation id returns `404` with `{"error":"unknown_correlation"}`
**And** every one of those responses carries the `X-Sidepiece-Contract` header and the top-level `generation` that every Bridge response for a resolved Project already carries.

**Given** three outcomes have been delivered and acked
**When** `systemctl --user restart sidepiece-bridge` runs and `curl -s https://<bridge>/v1/health | jq '.dependencies[] | select(.name=="bloodbank") | .consumer'` is read before and after
**Then** it reports `{"durable":"sidepiece-bridge-outcomes","lastStreamSeq":<N>,"state":"bound"}` with `lastStreamSeq` unchanged across the restart — an added field on the `bloodbank` row Story 1.13 registered, not a ninth dependency, and adding a field needs no `CONTRACT_VERSION` bump
**And** an outcome published while the Bridge was stopped is delivered and reconciled within 10s of the Bridge coming back
**And** no already-applied outcome is applied a second time, asserted by reading the `dispatches` row's `outcome_at` before and after and finding it identical.

*Satisfies: FR-9a, FR-9c, FR-9e (durability half), FR-15d, NFR-2, NFR-9 (boundary honoured — no guard on a non-mutating path), AR26, AR28, AR29, AR30, AR31, AR38, AR50, AR52, AR54, AR55, AR56.*

---

### Story 4.3: The completed dispatch carries the agent's answer, or says the gateway returned none

As Jarad,
I want the outcome's result content stored verbatim and served with the Turn,
So that a Dispatched Command comes back as an answer, and when it cannot, the panel says exactly why instead of dressing up a status word.

**Acceptance Criteria:**

**Given** Story 4.1 deployed, so outcome events carry `data.result_content`
**When** `db/migrations/006_dispatch_result.sql` is applied at startup
**Then** `dispatches` gains `result_content TEXT` and `result_truncated INTEGER` (0/1, nullable), and `user_version` becomes `6`
**And** the reconcile path stores `data.result_content` **verbatim**, byte for byte — no trimming, no markdown processing, no newline normalisation, and no camelCase rewriting of anything inside the string
**And** `curl -s https://<bridge>/v1/project/<pjid>/dispatch/<correlationId>` now also returns `"resultContent": "<the text>"` and `"resultTruncated": false`.

**Given** an outcome event carrying no `data.result_content` — Story 4.1 not yet deployed, or the agent produced no text
**When** it is reconciled
**Then** `result_content` is NULL and the API returns `"resultContent": null`
**And** the Bridge invents no placeholder text and no sentence of any kind: the Bridge sends codes and typed payload, the Cockpit owns the prose, and the one exception to that rule is remedy command text, which this path does not produce.

**Given** an outcome event carrying `data.result_truncated: true`
**When** it is reconciled
**Then** the API returns `"resultTruncated": true`
**And** in this same change `EXPERIENCE.md`'s Turn-card state table gains the row `Result truncated by the gateway.` with its trigger, so the string has a spine source before it has a call site
**And** it is explicitly **not** a new `DsCode` — it gates nothing, names no failing dependency, is a property of one outcome rather than of the Bridge, and `DS-29` is not minted.

**Given** the Bloodbank envelope spells its fields `correlationid` (no separator), `command_id`, `idempotency_key`, `actor.agent_id` and `result_content`
**When** an event crosses into the Bridge
**Then** the rename to `correlationId` / `resultContent` happens only inside `bloodbank/outcomes.ts`, at the point of ingest, and those camelCase names exist nowhere outside `contract/`'s own types thereafter
**And** no generic camelCase-ifying middleware is applied to the envelope anywhere: a unit test feeds a raw envelope containing all five foreign spellings through the adapter and asserts each was read under its Bloodbank spelling and that `correlationid` was never silently rewritten in transit.

**Given** a real PM dispatch that answered
**When** `curl -s https://<bridge>/v1/project/<pjid>/turns | jq -r '.turns[] | select(.dispatch) | .dispatch.resultContent'` runs
**Then** it prints the agent's answer text
**And** it does not print the word `completed`, which is what FR-9(b) exists to forbid.

*Satisfies: FR-9b, AR30, AR31, AR54, AR55, AR15, UX-DR51.*

---

### Story 4.4: A dispatch with no outcome reads unknown, never success

As Jarad,
I want a dispatch that has produced nothing for a configured window to read as unknown,
So that silence is never rendered as success, and the window is long enough that ordinary agent work does not routinely trip it.

**Acceptance Criteria:**

**Given** the `systemd --user` unit, whose environment is explicit because `systemd --user` inherits nothing from a login shell
**When** `Environment=SIDEPIECE_DISPATCH_WINDOW_MINUTES=20` is set
**Then** the Bridge reads it at startup and defaults to `20` when the variable is absent
**And** a value that is not an integer between 1 and 1440 makes the Bridge exit at startup with the stated message `SIDEPIECE_DISPATCH_WINDOW_MINUTES must be an integer between 1 and 1440; got "<value>"` — loudly at start, never three hours into a session
**And** `curl -s https://<bridge>/v1/health | jq .dispatchWindowMinutes` prints `20`, so the Cockpit can render the number rather than hard-code it.

**Given** a `dispatches` row with `outcome_status IS NULL` and `dispatched_at` more than the window in the past
**When** the dispatch is read through either `/v1/project/<pjid>/dispatch/<correlationId>` or `/v1/project/<pjid>/turns`
**Then** `status` is `"unknown"` and `"unknownSince"` carries the ISO-8601 instant the window expired
**And** `unknown` is derived at read time from `dispatched_at` plus the window — no `unknown` is ever written into `outcome_status`, and no timer, cron, sweeper or background job exists to write one
**And** a row still inside the window reads `"pending"` and carries `"deadlineAt"` = `dispatched_at` plus the window, so the in-flight state names its deadline rather than hanging
**And** the derivation runs in one place and one order: `publish_status = 'rejected'` → `rejected`; else `outcome_status` when it is set; else `unknown` past the window; else `pending`.

**Given** a dispatch reading `unknown` at minute 25
**When** its genuine outcome arrives at minute 30
**Then** the next read returns `"completed"` (or `"failed"`) and `unknownSince` is absent from the payload
**And** nothing had to be undone or reversed, because `unknown` was never persisted.

**Given** any dispatch with no outcome recorded
**When** it is read at any age
**Then** the status is never `"completed"` — not at the boundary, not on a clock skew, not on a restart
**And** a test asserts the derived status vocabulary is exactly `{"rejected","pending","unknown","completed","failed"}`: `rejected` is Story 3.10's publish refusal read straight off `publish_status` and is never confused with `failed`, which is a gateway-reported failure; `timed_out` is not a value at all, and a gateway-reported timeout arrives as `"failed"` carrying its own `outcomeCode` and `outcomeMessage` verbatim, per Story 4.2's mapping.

**Given** a Bridge started with `SIDEPIECE_DISPATCH_WINDOW_MINUTES=1` and a dispatch with no outcome
**When** 61 seconds have passed and `curl -s https://<bridge>/v1/project/<pjid>/dispatch/<correlationId> | jq -r .status` runs
**Then** it prints `unknown`
**And** the same curl run at 30 seconds prints `pending`.

*Satisfies: FR-9a, FR-9d, NFR-2, NFR-8, AR63, UX-DR48.*

---

### Story 4.5: Candystore backfills what the consumer missed, and says so when it cannot be asked

As Jarad,
I want the Bridge to query Candystore directly for outstanding correlation ids on startup and on a consumer gap, and to mark the affected Turns when Candystore itself is unreachable,
So that a missed message is recoverable rather than permanently unknown, and an outcome we cannot *look at* is never confused with an outcome that never *arrived*.

**Acceptance Criteria:**

**Given** rows in `dispatches` with `outcome_status IS NULL`
**When** the Bridge starts, **or** the consumer reports a gap (a delivered stream sequence more than one past the last it applied), **or** `GET /v1/project/<pjid>/dispatch/<correlationId>?refresh=1` is called
**Then** `candystore/reader.ts` issues `GET http://127.0.0.1:8683/events?correlationid=<uuid>&type=bloodbank.agent.invocation.completed,bloodbank.agent.invocation.failed&limit=50`, one request per outstanding correlation id, at most 8 in flight
**And** any returned event is reconciled through the same `turns/reconcile.ts` path as a NATS delivery, under the same `outcome_status IS NULL` guard, with `outcome_source = 'candystore'`
**And** the `?refresh=1` form is a `GET` that records what it learned: it is not an operator mutation, carries no `generation` in its request, and can never return `409 stale_generation`.

**Given** the NATS consumer is bound and healthy
**When** outcomes arrive normally
**Then** no per-outcome Candystore poll runs — the only Candystore reads are the three triggers above
**And** a test asserts that a single normal outcome delivery performs zero Candystore requests, because Candystore is the backfill and not the primary.

**Given** `health/aggregator.ts`
**When** `curl -s https://<bridge>/v1/health` is read
**Then** the `bloodbank` and `candystore` rows Story 1.13 registered as `"status":"unprobed"` both report a real status, determined independently — `candystore` probed by `GET http://127.0.0.1:8683/readyz`, where `204` means up — and this story **fills** those two rows rather than adding them, because `health/aggregator.ts` is extensible by registration and not by edit
**And** `candystore/reader.ts` contains no NATS client, and neither `bloodbank/adapter.ts` nor `bloodbank/outcomes.ts` contains a Candystore URL — one adapter reporting for both could not produce two blast radii.

**Given** the Candystore probe is failing while Bloodbank is reachable
**When** `curl -s https://<bridge>/v1/project/<pjid>/turns` is read
**Then** the response's top-level `degraded[]` contains `{"ds":"DS-19"}`, and every `dispatch` object whose status is `pending` or `unknown` carries `"degraded": [{"ds":"DS-19"}]` — the `Degraded` shape Story 1.3 fixed, never a bare code string
**And** no `dispatch` object with a terminal status carries it
**And** `DS-19` gates nothing: the same response still serves the full Turn history, `/v1/project/<pjid>/tickets` still answers `200`, and no pane-gating flag appears anywhere in the payload
**And** `DS-19` is typed in `BridgeDsCode` and not in `ClientDsCode`, so `tsc` fails if the extension tries to construct it.

**Given** Candystore is unreachable and Bloodbank is reachable
**When** a Turn classified as Dispatched Command is sent
**Then** it is published and acknowledged with its correlation id exactly as it is when Candystore is up — DS-19 changes nothing about publishing, and a dispatch is never rendered as completed because nothing said otherwise
**And** when Candystore returns, the next backfill reconciles every outstanding correlation id and `degraded[]` no longer carries `{"ds":"DS-19"}`.

*Satisfies: FR-9c, FR-9e, FR-14b (inherited — Candystore named as its own dependency), NFR-2, AR13, AR50, AR51, AR53, AR54, UX-DR44.*

---

### Story 4.6: The Dispatched Command card shows what came back

As Jarad,
I want a terminal Dispatched Command to render its status and the agent's actual result in the same thread I sent it from,
So that reopening the Cockpit on that Project shows me the answer instead of a receipt.

**Decisions this story owns and must make before any AC below is implemented:** key-screen finding 7 (UX-DR85) and key-screen finding 8 (UX-DR86). Both are decided in the first two criteria.

**Acceptance Criteria:**

**Given** `{components.turnCard}`'s Dispatched Command variant — a bordered block, 1px `{colors.border.strong}`, opening with a `{colors.surface.stamp}` band — and key-screen finding 7, which is that on a terminal dispatch the band word and the outcome chip collide at 284px
**When** the card renders in any state
**Then** the band carries **exactly one** state word — `DISPATCHED`, `REJECTED`, `COMPLETED`, `FAILED` or `UNKNOWN` — with its `marks.*` sibling (`marks.pending` `»`, `marks.failed`, `marks.ok`, `marks.failed`, `marks.unknown` respectively), `REJECTED` being Story 3.11's publish refusal rather than a new state, both mark and word in `{colors.text.inverse}` at 15.34:1, and **the separate outcome stamp chip is not rendered at all, in any state** — finding 7 is resolved by the band word surviving and the chip being deleted, because two words saying the same thing 3px apart in a 284px column is the collision
**And** the correlation id leaves the band: it renders on the body's acknowledgement line as `` Dispatched. `<correlation id>`. `` in `{typography.mono}` at `{colors.text.machine}`, **complete** — all 36 characters of the UUID, because a machine identifier is complete or absent — `user-select: all`, never elided, with a `{components.copyControl}` beside it
**And** the band's fit is restated against the decision: mark 11px + `{spacing.hair}` 4px + the longest word `DISPATCHED` at `{typography.micro}` 7.35px/char × 10 = 73.5px, total **88.5px inside the card's 282px band, 193.5px spare**, and the band carries nothing else at any width.

**Given** key-screen finding 8 — the outcome chip put variable content in `{typography.micro}`, a role `DESIGN.md`'s 10.5 Floor Rule reserves for static chrome
**When** this card is built
**Then** the only `{typography.micro}` on it is the band word, which `DESIGN.md`'s own type ramp enumerates as a licensed micro consumer ("section rules, band words, stamp chips, clip mark") — so finding 8 is resolved by the chip not shipping, and no named exception is claimed
**And** a written rule is recorded alongside the component for the next change: any chip or control later reintroduced onto this card carrying variable content sets at `{typography.label}` 11.5px or above and is re-measured, never at `{typography.micro}`
**And** no size override of any kind appears inside this component.

**Given** a dispatch with `status: "completed"` and a non-null `resultContent`
**When** the card renders
**Then** the result content appears below a **dashed** 1px `{colors.border.hairline}` rule, in `{typography.body}` at `{colors.text.primary}`, wrapping, selectable, and never truncated or ellipsised by the Cockpit
**And** given `status: "completed"` with `resultContent: null`, the card renders exactly `Completed. The gateway returned no result content.` — never `Completed` alone, never a bare checkmark, never a tick
**And** given `resultTruncated: true`, the line `Result truncated by the gateway.` renders beneath the content at `{colors.text.muted}`, resolved from `copy/progress.ts` and authored at no call site.

**Given** a dispatch with `status: "unknown"` and the Bridge reporting `dispatchWindowMinutes: 20`
**When** the card renders
**Then** the band word is `UNKNOWN` with `marks.unknown`, and the body reads exactly `No outcome after 20 minutes. Status unknown.` — the number interpolated from the Bridge's `dispatchWindowMinutes`, so a Bridge configured to 45 renders `No outcome after 45 minutes. Status unknown.`
**And** the card carries a quiet 28px `Check again` control built to `{components.refetchControl}`'s geometry — transparent ground, 1px `{colors.border.strong}`, `{typography.label}` at `{colors.text.primary}`, `0 10px` padding, square — which calls `GET /v1/project/<pjid>/dispatch/<correlationId>?refresh=1` and re-renders the card, so no in-flight state in this product becomes indefinite
**And** given `status: "failed"`, the band word is `FAILED` with `marks.failed` and the body renders `outcomeCode` and `outcomeMessage` verbatim as the Bridge reported them — no rewording, no apology, no "something went wrong".

**Given** a `pending` or `unknown` dispatch whose object carries `"degraded": [{"ds":"DS-19"}]`
**When** the card renders
**Then** it shows `The Bridge is up. Candystore isn't reachable.` / `Dispatches still go out. Their outcomes can't be observed until it's back.`, resolved from `copy/states.ts`
**And** that text never appears on a terminal dispatch, and never as a pane gate: the composer stays enabled, the pane switch marks nothing degraded, and the Tickets pane is untouched
**And** a test asserts `The Bridge is up. Candystore isn't reachable.` and `No outcome after 20 minutes. Status unknown.` are distinct strings and that neither is ever rendered under the other's condition — one means we cannot look, the other means nothing arrived, and the fixes differ.

**Given** a dispatch sent, the Cockpit then closed **or collapsed** (the same teardown event), and the outcome landing while it is gone
**When** the Cockpit is reopened on a tab declaring that same pjid
**Then** that same Turn card, in the same thread, in its original position, carries its terminal status and its result content
**And** nothing client-side was required to make that true: clearing every `chrome.storage.local` key, including the whole `fr2:` keyspace, changes nothing about this card, because the Bridge is the system of record
**And** no notification, badge, toast, count or unread marker is rendered anywhere for it, before or after the reopen.

**Given** the accessibility floor
**When** a terminal status first renders for a Turn
**Then** `outcome arrived` is announced **once** into the polite live region, and re-rendering the same terminal card announces nothing
**And** every state on this card renders a `marks.*` glyph **and** a word alongside its colour — asserted for all five band words, because `{colors.state.ok}` and `{colors.state.unknown}` are the identical hex and hue alone is not a signal
**And** the `Check again` control and the `{components.copyControl}` are reachable by Tab in reading order, operable with Enter and Space, each at least 24 × 24 CSS px, and each carries the two-tone focus keyline on `:focus-visible`
**And** with `prefers-reduced-motion: reduce` every state change on this card is a text swap and nothing loses meaning.

*Satisfies: FR-9a, FR-9b, FR-9d, FR-9e, NFR-2, NFR-3, AR78, UX-DR3, UX-DR5, UX-DR6, UX-DR9, UX-DR12, UX-DR21, UX-DR44, UX-DR48, UX-DR49, UX-DR52, UX-DR59, UX-DR61, UX-DR63, UX-DR64, UX-DR65, UX-DR66, UX-DR67, UX-DR70, UX-DR85, UX-DR86.*

---

### Story 4.7: An outcome that lands while the Cockpit is open appears without a reopen

As Jarad,
I want an outcome arriving while the panel is open to land in the thread by itself,
So that I do not have to close and reopen the Cockpit to discover that the work finished while I was watching it.

**Acceptance Criteria:**

**Given** the Cockpit opens on a resolved Project
**When** `lib/stream.ts` subscribes
**Then** it opens exactly **one** `EventSource` to `GET /v1/project/<pjid>/outcomes` for that Project — one subscription per panel open, never one per outstanding dispatch
**And** `lib/stream.ts` is imported only by `entrypoints/sidepanel/`; a static import of it from anywhere under `entrypoints/background/` fails the lint rule that exists for exactly this
**And** no connection of any kind is opened from the service worker to keep outcomes flowing, and no offscreen document is created.

**Given** the Bridge reconciles an outcome for a Turn owned by that pjid
**When** the subscription is live
**Then** the stream emits one `outcome` frame carrying `{correlationId, turnId, status, outcomeAt, outcomeCode, outcomeMessage, resultContent, resultTruncated}` and the card re-renders in place without the thread scrolling or focus moving
**And** `curl -N https://<bridge>/v1/project/<pjid>/outcomes` prints that frame with no extension installed, which is how this leg is debugged without Chrome
**And** the stream emits a comment heartbeat at most every 20s, so an idle subscription is distinguishable from a dead one.

**Given** two Projects with outstanding dispatches
**When** the operator switches to a tab on the other Project
**Then** the stream for pjid A never carries a frame for a Turn owned by pjid B, asserted by subscribing to both and sending a dispatch on one
**And** the Cockpit drops the subscription for the Project it left and opens one for the new Project inside the same atomic re-render, so no frame from the old Project can land in the new Project's thread.

**Given** the subscription cannot be established within **2000ms** of panel open, or drops and does not recover
**When** the Chat pane renders
**Then** it shows exactly `Not subscribed to outcomes. Dispatched results won't land here until this reconnects.` with a retry control
**And** this is typed as `SubscriptionState` in `contract/src/state.ts` — outside the 28-code DS taxonomy, because it is a property of this open and not of the Project — and no new `DsCode` is minted for it
**And** it gates no pane: the composer stays enabled, a dispatch still publishes and is still acknowledged, Tickets stays fully live, and the header is untouched.

**Given** the subscription is down for the entire life of a dispatch
**When** the Cockpit is closed and reopened
**Then** the terminal status and result content are still there, because the subscription is a convenience and the Bridge is the record
**And** deleting `lib/stream.ts`'s outcome path entirely would make the product one reopen slower and thereafter identical — a test of that claim is the acceptance, not a code comment.

*Satisfies: FR-9e, FR-15e, NFR-2, NFR-3, AR14, AR22, AR74, UX-DR64, UX-DR73.*

---

### Story 4.8: UJ-2 end to end — dispatch, execute, answer, in one thread

As Jarad,
I want one complete round trip proved against a real PM on a real Project,
So that the first time the journey works completely is a recorded transcript rather than an assumption, and FR-6's bias toward dispatch is finally justified.

**Acceptance Criteria:**

**Given** `big-chungus` running the Bridge under `systemd --user`, the Bloodbank hermes-gateway carrying Story 4.1's fix, and a Project whose PM is declared in the Project Record, present in `~/.hermes/agents-registry.yaml`, and reachable
**When** Jarad opens a tab declaring that Project's pjid, opens the Cockpit on the icon, switches to Chat, types `start on the resolver ticket` and pauses
**Then** the classification control settles on `DISPATCHED COMMAND` — the glossary term complete and unabbreviated — with the consequence line `This will be published and acknowledged. The result arrives later.`

**Given** he presses Enter
**When** the Turn is accepted
**Then** within 500ms the Turn card renders with the band word `DISPATCHED` and `marks.pending`, and within 2s the body reads `` Dispatched. `<correlation id>`. `` with the complete 36-character id and a working copy control
**And** the measured accept latency is recorded in the story's evidence, and the `POST …/turn` that produced it touched no upstream — it validated `(pjid, generation)`, classified, wrote the row and returned `{turnId, kind, acceptedAt}` synchronously.

**Given** he closes the Cockpit and the PM works for several minutes
**When** he reopens the Cockpit on a tab declaring that same pjid
**Then** that same card, in the same thread, in its original position, reads `COMPLETED` with `marks.ok` and renders the PM's actual answer text beneath the dashed rule
**And** it does **not** read `Completed. The gateway returned no result content.`
**And** three transcripts are recorded as the evidence: `curl -s https://<bridge>/v1/project/<pjid>/dispatch/<correlationId>` showing a non-null `resultContent`, `curl -s "http://127.0.0.1:8683/events?correlationid=<id>&type=bloodbank.agent.invocation.completed" | jq -r '.events[0].data.result_content'` showing the same text, and a screenshot of the card rendered at a 320px panel.

**Given** the same correlation id
**When** it is traced end to end
**Then** it appears byte-identical in four places — the Cockpit card, the Bridge's `dispatches` row, the Bloodbank command envelope's `correlationid`, and the outcome event's `correlationid`
**And** correlation was by identifier and never by ordering or recency: a second dispatch sent between the first and its outcome lands on its own card, and swapping the arrival order of the two outcomes changes nothing about which card each lands on.

**Given** the happy path is proved
**When** the epic is closed out
**Then** the `unknown`, `failed` and DS-19 paths are each demonstrated once — `unknown` against a Bridge started with a one-minute window, `failed` against an outcome event with `error_code`/`error_message`, DS-19 against a stopped Candystore — rather than left untested because the happy path passed
**And** the six-Turn classification corpus in `classify.test.ts` still passes unchanged
**And** the epic's definition-of-done clause is discharged by a human check, because no linter can see it: every failure mode this epic added carries a `DsCode` or a typed non-DS code **and** a row in `EXPERIENCE.md` committed in the same change, every new user-facing string in `copy/progress.ts` and `copy/states.ts` has an `EXPERIENCE.md` source, and no Glossary term appears anywhere under a synonym.

*Satisfies: FR-9 (obligations a–e, complete), NFR-2, NFR-7, NFR-9, AR15, AR54, UX-DR19, UX-DR21, UX-DR49, UX-DR50, UX-DR52. Exercises but does not claim FR-6, FR-8, FR-10 and FR-11, which are Epic 3's.*

---

## Coverage, Verified Mechanically

The set below was built from the `*Satisfies:*` line of all **62** stories, not from the writers' self-reports. Sixteen stories in Epic 1, twenty-six in Epic 2, twelve in Epic 3, eight in Epic 4.

- **All 16 FRs covered.** FR-1, FR-3, FR-4, FR-12, FR-13 → Epic 2; FR-2, FR-14, FR-15, FR-16 → Epic 1; FR-5, FR-6, FR-7, FR-8, FR-10, FR-11 → Epic 3; FR-9 → Epic 4. The FR Coverage Map's two born-here/rendered-there splits hold: FR-2(c) is an inherited criterion of Story 2.9, FR-14(a)(b) of Story 2.8 and Story 2.13.
- **All 10 NFRs covered.**
- **All 78 ARs covered.** AR12 — the one-line `createShadowRootUi` open-or-closed check — was the only one no writer claimed; it is now a criterion of Story 2.3, which is the story that runs `wxt init`, rather than a story of its own. It produces no component and would have been exactly the forbidden shape.
- **83 of 91 UX-DRs covered.** The eight that are not are **UX-DR28–UX-DR35**, and none of them is an oversight:

| Uncovered | What it is | Why no story |
|---|---|---|
| UX-DR28 | The `[v2]` in-page layer's common requirements — closed shadow root, tri-tone keyline, registration geometry, achromatic fallback, print suppression, occlusion stubs | `[v2]`. v1 ships no in-page layer at all. |
| UX-DR29 | `{components.hoverOutline}` | `[v2]` in-page component |
| UX-DR30 | `{components.commentBubble}` | `[v2]` in-page component; also carries an open question for Jarad about the pre-commit payload |
| UX-DR31 | `{components.freehandLayer}` | `[v2]` in-page component |
| UX-DR32 | `{components.annotationPin}` | `[v2]` in-page component |
| UX-DR33 | `{components.annotationRow}` | `[v2]`, Annotations pane |
| UX-DR34 | `{components.dischargeControl}` | `[v2]`, Annotations pane |
| UX-DR35 | `{components.attachmentChip}` | `[v2]`, the attachment seat Story 3.3 reserves and leaves empty |

Writing stories for these would re-admit the `[v2]` seam as work, which is the failure mode SM-C2 names and this project has already died of once. What v1 **does** owe them is built: the empty ruled `[v2]` seats — the third pane-switch cell (Story 2.17), the trailing action slot beside `{components.commandString}` (Stories 2.15 and 3.4), the attachment seat below the classification control (Story 3.3) — plus AR11's px-authored overlay token subset (Story 2.12) and AR12's shadow-root verdict (Story 2.3), so the layer can be built later without reopening v1's geometry.

---

## Cross-Epic Seams, Resolved at Assembly

Four writers worked without seeing each other. Where two of them built the same thing, one owns it and the other references it. Where a requirement genuinely needs work in two epics, that is stated rather than deduplicated.

**Decided by one epic, inherited by the rest.**

- **The SQLite tables.** Story 1.5 creates `resolutions` and the migration contract, and nothing else. `ticket_creates` is Story 2.22 (`002`), `turns` is Story 3.2 (`003`), `dispatches` is Story 3.10 (`004`), the outcome columns are Story 4.2 (`005`) and the result columns Story 4.3 (`006`). `user_version` advances by exactly one per migration, forward-only, and `turns/store.ts` remains the only module that opens the database. Epic 1's brief said all four tables land in one migration; that is the one place the approved brief loses to the step file's own rule — a story creates the tables it writes to.
- **The `Degraded` wire shape.** `{ds, params?, remedy?}`, fixed by Story 1.3, `ds` and never `code`, and never a bare code string. Every Bridge route in all four epics now answers in that shape, and the Bridge-composed remedy command rides in `remedy`.
- **The health `dependencies[]` rows.** Story 1.13 registers all eight — `registry`, `store`, `vault`, `fleet`, `gateway`, `plane`, `bloodbank`, `candystore` — as an array of `{name, status, …}`, with the five it has no adapter for reporting `unprobed` and never `ok`. Story 3.1 fills `fleet` and `gateway`; Story 4.5 fills `bloodbank` and `candystore`. No later story adds a row, and `sessions` (Story 3.6), `dispatchWindowMinutes` (Story 4.4) and the `bloodbank` row's `consumer` object (Story 4.2) are added fields, which need no `CONTRACT_VERSION` bump.
- **The action bar's geometry.** Story 2.12 owns it, because the create box sits in that bar twenty stories before the composer does: the 188px cap is removed, the bar is intrinsically sized and pushes the body, the body stays the only pane-level scroll region, and the bar's boundary is promoted from the 1.49:1 hairline to a 1px `{colors.border.strong}` seam. Story 3.3 inherits all of it and bounds the composer's growth at the focused text field, at the measured 288px, which is the single exception Story 2.12 licensed. UX-DR79, UX-DR80 and UX-DR87 are decided once.
- **The disabled action bar's reason.** UX-DR88's answer is Story 2.23's — the state's headline sentence on a wrapping line in `{typography.label}` at `{colors.text.muted}` above the submit row, with the submit label becoming `CAN'T CREATE`. Story 3.4 takes the same form for the composer (`CAN'T SEND`). `{typography.micro}` is not used for it, because that role is reserved for static chrome.
- **The relayed deadline's multiple.** Story 2.14's constants: **×3 with a 6-second floor**. Stories 3.5 and 3.9 consume them rather than setting a second number.
- **The `project_id` lint.** Story 1.2 writes the rule and both per-path exceptions. Story 2.19 occupies `tickets/plane.ts`, the path that was reserved for it, and declares nothing.
- **The correlation id's place on the card.** Not in the stamped band, in any epic: it renders complete, all 36 characters, on the body's acknowledgement line with a copy control (Story 3.11), and Story 4.6 adds the terminal band words to that same band without moving it back. Key-screen finding 7 is decided once and applied forward rather than built twice.
- **The dispatch status vocabulary.** `publish_status` (`dispatched` | `rejected`) is written by Story 3.10; `outcome_status` by Story 4.2; the API's `dispatch.status` is **derived** over `{rejected, pending, unknown, completed, failed}` in one place and one order (Story 4.4). `unknown` is never stored, so a late outcome supersedes it with nothing to undo.
- **The SSE subscription sentences.** `Not subscribed to outcomes. Dispatched results won't land here until this reconnects.` belongs to Story 4.7's project-scoped outcomes subscription. Story 3.8's per-Turn stream gets its own sentence, because Story 2.7's copy-uniqueness lint fails the build on a string appearing under two conditions.

**Legitimately two epics' work, and stated as such.**

- **UX-DR73 (cold start).** Epic 2 owns the render **order** (Story 2.25); Epic 4 owns the outcomes subscription and its failure sentence (Story 4.7), which item (6) describes and which does not exist until Epic 4. Expect the duplicate citation; it is not a duplicate build.
- **AR66 (the silent credential degradation).** Story 1.14 ships assertion 1 complete and curl-proven, plus assertion 2's *expected* half at `unprobed`. Story 3.6 completes the reported half, because that is the first story in which a session exists to ask — and closes the architecture's `[ASSUMPTION]` in writing either way.
- **The eleven born-here / rendered-there DS codes.** Governed by the rule already stated under *How the 28-State Taxonomy Is Distributed*: born in the epic that detects it, rendered in the epic that owns the surface it degrades. Epic 1 produces DS-9, DS-10, DS-15, DS-20, DS-23 and DS-25 as `curl` transcripts; Epic 2 renders them; Epic 3 gates on DS-20 and DS-25. Story 2.7 carries all 28 sentences from the start, so no later epic authors one that already exists.
- **FR-3's obligations under a capability story.** Epic 3's Story 3.4 cites FR-3(a) as FR-5's proof and Epic 2 keeps FR-3. Epic 3 is never *done with FR-3*; it is done with FR-5.

**Two things were deliberately not deduplicated.** Story 1.7's `409 stale_generation` conformance test and Story 2.22's stale-create transcript both exercise the generation guard — the first through the production `mutatingRoute()` helper against a fixture route, the second through the first real mutating capability. That is the guard proven twice on purpose, which is what `DEFINITION-OF-DONE.md` item 1 exists for. And the `{components.commandString}` fit is measured twice, in Story 2.15 against a DS-6/DS-8 remedy and in Story 2.19 against DS-14's mandatory board-binding command, because the second string does not exist until the Board endpoint composes it.
