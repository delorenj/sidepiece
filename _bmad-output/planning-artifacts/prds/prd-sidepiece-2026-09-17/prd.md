---
title: Sidepiece
status: draft
created: 2026-09-17
updated: 2026-09-17
---

# PRD: Sidepiece

## 0. Document Purpose

This PRD is the contract between the Sidepiece brain dump and everything downstream — `bmad-ux`, `bmad-create-architecture`, and `bmad-create-epics-and-stories`. It is written for one reader who is also the only user, so it spends its length on requirements that constrain implementation and almost none on justification.

Structure: vocabulary is fixed in §3 Glossary and used verbatim everywhere else; features are grouped in §4 with globally-numbered FRs nested under them; inferences are tagged `[ASSUMPTION]` inline and indexed in §11.

Inputs: `BRAINDUMP.md` (2026-09-17) is the source of truth. `docs/product-brief.md` (2026-06-04) supplied depth but was superseded on two points — resolution model and annotation mechanism. The `SIDE` Plane board's 44 tickets (EPIC A–K, 2026-06-23) were read as prior art; §10 records what survives and what does not. Transport and framework choices deliberately live in `addendum.md`, not here.

## 1. Vision

Sidepiece is a Chrome side panel that closes the gap between looking at one of my running services and acting on the project that produces it. Today that gap is a context switch: find the repo, remember the board identifier, open a terminal, pick the right CLI. Each step is small and the sum of them is enough friction that I notice things and don't act on them.

The mechanism is a page-declared identity. Every pjangler-backed project advertises its `pjid` in the served HTML. When I'm on a page that declares one, Sidepiece resolves it through a local bridge into the full project record — repo path, Hermes PM agent, Plane board — and puts a cockpit next to the page: a chat box wired to that project's PM, and that project's tickets.

The value is not any single pane. It is that the resolution is automatic and correct. I never tell Sidepiece which project I'm looking at, and it is never wrong about it, because the page itself said so.

## 2. Target User

### 2.1 Jobs To Be Done

- When I notice something wrong on a running service, file it against the right board without leaving the page or looking up an identifier.
- When I want to know what's happening with a project, ask its PM agent in the same place I'm looking at its output.
- Cut the "which repo is this again?" lookup to zero — the page should already know.
- Act on small observations at the moment I have them, instead of losing them to the cost of switching contexts.

### 2.2 Non-Users (v1)

Everyone else. Sidepiece assumes a single operator on a single workstation with a pjangler registry, a Hermes fleet, and a Plane workspace already in place. There is no multi-user model, no tenancy, and no install story for anyone who isn't me. `[ASSUMPTION: this stays true indefinitely — the design may take shortcuts that are expensive to undo if it ever changes.]`

### 2.3 Key User Journeys

Single operator, single role — captured in the lighter shape per the template's scope dial.

- **UJ-1. Jarad files a bug against the thing he's staring at.** On `holocene.delo.sh`, something renders wrong. The panel already shows Holocene resolved. He types a title into the ticket box and it lands on Holocene's board — no identifier looked up, no terminal, no tab switch.
- **UJ-2. Jarad asks the PM what's going on.** Same panel, chat box. "What's in progress?" streams back inline in a couple of seconds. Follow-up: "start on the resolver ticket" — that one dispatches as a command and the panel tells him it was accepted rather than pretending to converse about it.
- **UJ-3. Jarad lands on a project with no PM.** The panel resolves the project fine but reports no Hermes agent. Chat is visibly unavailable with the reason stated, tickets still work, and he's told the exact command to provision one. *Edge case:* if the bridge is down, every pane says so with the same message rather than each failing in its own way.

## 3. Glossary

Downstream workflows use these terms exactly. Introducing a synonym anywhere is a discipline violation.

- **pjid** — The stable identifier pjangler assigns a registered project. Advertised by the served page in its own HTML. One per Project.
- **Project** — A pjangler-registered unit of work. Has exactly one pjid, one repo, one local clone path, at most one Board, and zero or more Agents.
- **Project Record** — The resolved metadata for a Project as returned by `pj info <pjid>`: repo name, local clone path, Board binding, Agent bindings.
- **Registry** — pjangler's catalogue of Projects. Authoritative; Sidepiece reads it and never writes it.
- **Bridge** — The local HTTP daemon on the workstation that Sidepiece calls. The only component that touches the filesystem, runs pjangler, or holds credentials. See §4.4.
- **Cockpit** — The Chrome side panel UI, scoped to exactly one resolved Project at a time.
- **Agent** — A Hermes process bound to a Project. Sidepiece cares about the PM role; the Scrum Master role exists but is not a chat target.
- **PM** — The Hermes Project Manager Agent for a Project. The chat counterpart.
- **Board** — The Plane project holding a Project's Tickets. Identified by workspace, identifier, and board UUID.
- **Ticket** — A Plane issue on a Board.
- **Bloodbank** — The 33GOD event and command bus. Subjects are five tokens, `bloodbank.<kind>.<domain>.<entity>.<action>`, with no version segment and no identity tokens.
- **Candystore** — The queryable projection of Bloodbank events. The only practical way to retrieve events filtered by Project.
- **Streamed Exchange** — A chat turn answered inline, token by token, within the panel session.
- **Dispatched Command** — A chat turn published to Bloodbank as a command for asynchronous execution. Acknowledged, not answered.

## 4. Features

### 4.1 Project Resolution

**Description:** The spine — everything else is dead without it. A page declares its own identity via `pjid`; Sidepiece reads that declaration on every navigation and asks the Bridge to resolve it into a Project Record. Resolution is never inferred from a URL, a hostname, or a Traefik route. Declaration is the entire mechanism, which is what makes it trustworthy: the page is authoritative about which Project produces it, so origin becomes irrelevant. A `localhost:5173` dev server and a public `delo.sh` host resolve identically. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-1: Detect a declared pjid on the active tab

Sidepiece reads the active tab's declared `pjid` on initial load and on every subsequent navigation, including SPA history transitions that do not trigger a document load.

**Consequences (testable):**
- A page declaring a `pjid` is detected within 500ms of navigation completing.
- A client-side route change that replaces the page without a document load re-triggers detection. A declarative content script alone does not satisfy this — history transitions must be observed explicitly.
- A page declaring no `pjid` yields the unrecognized state, never a stale previous Project.
- Switching browser tabs re-evaluates against the newly active tab, and the panel document is updated in place rather than reloaded.
- Detection works on a page served from any origin, including one never seen before.

`[ASSUMPTION: the declaration is a meta tag in <head>. Exact attribute naming is an architecture concern, but "in the served HTML, readable without executing page JS" is a product requirement — it must work on a static page with scripting disabled.]`

#### FR-2: Resolve a pjid to a Project Record

Given a detected pjid, Sidepiece obtains the full Project Record from the Bridge, which derives it from the pjangler Registry.

**Consequences (testable):**
- A pjid present in the Registry resolves to repo name, local clone path, Board binding, and Agent bindings.
- A pjid absent from the Registry produces a distinct "declared but unknown" state, worded differently from "no pjid declared" — the two have different causes and different fixes.
- Resolution results are cached per pjid for the panel session; returning to an already-resolved tab does not re-hit the Registry.
- Resolution completes within 1s at the 95th percentile.

#### FR-3: Report the unresolved states honestly

Every way resolution can fail is distinguishable in the UI.

**Consequences (testable):**
- Four states are separately rendered and separately worded: no pjid declared; pjid declared but unknown to the Registry; Bridge unreachable; Registry readable but the Project's clone path is missing on disk.
- No failure state renders as an empty or loading panel.
- The Bridge-unreachable state states how to restart it.

#### FR-4: Surface Agent presence

The Cockpit reports whether the resolved Project has a Hermes PM, and degrades honestly when it does not.

**Consequences (testable):**
- A Project with a PM shows it as the chat target by name.
- A Project without one disables chat with the reason stated, and does not disable tickets.
- The no-Agent state names the exact provisioning command. `[ASSUMPTION: v1 states the command; it does not run it. One-click deploy is deferred — see §9.]`

**Out of Scope:** Writing to the Registry. Creating, editing, or removing Projects. Cloning a missing repo.

### 4.2 Agent Chat

**Description:** A chat box bound to the resolved Project's PM, with two different response modes because two genuinely different things happen in it. Asking a question should answer in the panel. Assigning work should not pretend to be a conversation — it should be published as a command and acknowledged, with the real outcome arriving through the event stream later. Conflating these is how the panel ends up appearing to hang while an agent does twenty minutes of work. Realizes UJ-2, UJ-3.

**Functional Requirements:**

#### FR-5: Streamed Exchange for conversational turns

Short conversational turns are answered inline, incrementally, without waiting for completion.

**Consequences (testable):**
- First token renders within 2s of send.
- Partial output is visible while generating; the panel never shows only a spinner for a response in progress.
- Closing and reopening the panel mid-stream does not lose the turn.
- A stream that dies mid-response is reported as failed, not left indefinitely pending.

#### FR-6: Dispatched Command for work assignment

Turns that assign work are published to Bloodbank as commands and acknowledged rather than answered.

**Consequences (testable):**
- A dispatched turn produces a visible acknowledgement carrying a correlation identifier within 2s.
- The turn is rendered as dispatched, visibly distinct from a Streamed Exchange.
- A rejected or unpublishable command surfaces the rejection, never silent success.
- The subject conforms to the five-token contract and is validated before publish.

`[ASSUMPTION: Sidepiece decides stream-vs-dispatch and does not ask. Getting it wrong is cheap in one direction (a question dispatched still gets answered) and annoying in the other (a long task streamed blocks the panel), so the classifier should bias toward dispatch when uncertain.]`

#### FR-7: Dispatched Command outcome visibility

A dispatched turn is not abandoned at acknowledgement.

**Consequences (testable):**
- Each dispatched turn shows a terminal status — completed, failed, or timed out — once the corresponding outcome is observable.
- Outcomes are correlated back to the originating turn by identifier, not by ordering or recency.
- A dispatch with no observed outcome within a configured window is shown as unknown, not as success.

#### FR-8: Per-Project conversation continuity

Chat history is scoped to the Project and survives the panel closing.

**Consequences (testable):**
- Reopening the Cockpit on the same Project restores that Project's prior turns.
- Two Projects never share history.
- History survives a Chrome restart and an extension service worker termination.

**Out of Scope:** Chatting with any Agent other than the Project's PM. Multi-turn tool approval flows. Attaching files.

### 4.3 Tickets

**Description:** The resolved Board, read and appended to, in the panel. Read is grouped by state so the board's shape is legible at a glance. Create is deliberately minimal — title, and optionally a description and target state — because refinement is the PM's job and `px` already exists for everything richer. Realizes UJ-1.

**Functional Requirements:**

#### FR-9: List Tickets grouped by state

**Consequences (testable):**
- Tickets render grouped by Board state, in the Board's own state order, not alphabetically.
- Each Ticket shows its human key, title, and state.
- An empty Board renders as empty, distinct from a failed fetch.
- Each Ticket links to its Plane URL, opening in a new tab.
- The list is fetched fresh on Project resolution, not served from a prior Project's cache.

#### FR-10: Create a Ticket

**Consequences (testable):**
- A Ticket can be created with a title alone.
- Description and target state are optional; omitting state uses the Board's default entry state.
- The Ticket is created on the resolved Project's Board and no other — the Board is never chosen by the user.
- On success, the new Ticket appears in the list without a manual refresh.
- On failure, the entered text is preserved and the error is shown.

**Feature-specific NFRs:**
- Board reads complete within 2s at the 95th percentile, or render a timeout state.

**Out of Scope for v1:** Editing an existing Ticket. Moving a Ticket between states. Assigning, labelling, commenting, or deleting. These belong to the PM and to `px`.

### 4.4 The Local Bridge

**Description:** A daemon on the workstation, and the only component in the system that touches the filesystem, executes pjangler, reaches Plane, or holds a credential. The extension is a client and nothing more. This exists because a Chrome extension fundamentally cannot do any of those things — but since it is a process I have to keep alive, its health and lifecycle are product surface, not purely an implementation detail. Realizes UJ-3.

**Functional Requirements:**

#### FR-11: Bridge health is observable from the Cockpit

**Consequences (testable):**
- The Cockpit distinguishes Bridge reachable, unreachable, and reachable-but-unhealthy.
- An unhealthy Bridge reports which downstream dependency is failing — Registry, Plane, Bloodbank, or Agent gateway — rather than a generic error.
- The Bridge exposes a health endpoint returning per-dependency status.

#### FR-12: Bridge survives the workstation's normal lifecycle

**Consequences (testable):**
- The Bridge starts on login and restarts on failure without manual intervention.
- Restarting the Bridge does not require reloading the extension.
- The Bridge is inspectable with `curl` — every capability the extension uses is reachable without the extension. This is a hard requirement, not a convenience; a bridge that can only be exercised through Chrome cannot be debugged.

#### FR-13: Credentials resolve from the vault, never from disk

**Consequences (testable):**
- Every credential resolves from 1Password at process start or per-request.
- No credential is written to a file in the repo, including files intended to be gitignored.
- A failed credential resolution surfaces as an unhealthy dependency in FR-11, naming which one.

**Out of Scope:** Remote or off-workstation access. Authenticating the extension to the Bridge — see §5.

## 5. Cross-Cutting NFRs

- **Trust boundary.** The Bridge binds to loopback only and performs no authentication of its caller. Any process on the workstation can call it. This is deliberate and correct for a single-operator tool; encoding an auth scheme here would be cost with no corresponding risk reduction. Revisit only if the Bridge ever binds beyond loopback.
- **Failure posture.** Every pane fails independently and says why. A dead Bloodbank must not take down tickets; an unreachable Plane must not take down chat. No pane may render a failure as an empty state or a permanent spinner.
- **Panel lifetime.** All long-lived connections — chat streams, event subscriptions — live in the panel document, never in the extension service worker, which is terminated after roughly 30s idle. The panel document stays alive across tab switches while open, so in-panel state survives navigation; it does not survive the panel closing, so anything that must outlive it is persisted explicitly. Work whose outcome arrives while the panel is shut is reconciled on next open rather than streamed to a listener that isn't there.
- **Opening the panel.** Chrome requires a genuine user gesture to open a side panel, and the open call must be the first synchronous call in the gesture handler — anything awaited first silently no-ops with no error. Sidepiece therefore cannot auto-open on detection; the extension icon carries the "this tab is resolvable" signal so opening it is an informed click.
- **Origin reach vs. permission scope.** Declaration-based resolution is origin-independent by design (§4.1), but the content script that reads the declaration is bound by its host match pattern. A narrow allowlist reintroduces exactly the origin coupling the model was chosen to remove. Sidepiece takes the broad match and accepts the permission prompt — it is a personally-loaded extension, the prompt is a one-time cost, and no store review applies. `[ASSUMPTION: this stays a personally-loaded extension. If §7's portability non-goal is ever revisited, this decision is the first thing that breaks.]`
- **Local network access is a moving target.** Chrome's Private Network Access rules have shipped in stages and continue to; whether extension-context requests to loopback are subject to the same preflight enforcement as page-context ones is **not documented**. A Bridge call that works today can start failing after an unrelated Chrome auto-update. The Bridge therefore answers preflights with the private-network CORS headers from day one regardless of current enforcement, and Bridge reachability is re-verified on Chrome version bumps rather than assumed solved. See §12 Q7.
- **Latency budget.** Detection ≤500ms; resolution ≤1s p95; board read ≤2s p95; first chat token ≤2s. Missing a budget renders a timeout state — never an indefinite pending one.
- **Cost of being wrong.** Sidepiece must never act against the wrong Project. Every mutating call carries the resolved pjid, and the Bridge rejects a mutation whose pjid does not match the Board it targets. A confidently wrong ticket is worse than a failed one.
- **Observability.** Bridge request logs are readable without a log aggregator — the workstation's journal is sufficient.

## 6. Integration and Dependencies

Sidepiece produces almost no data of its own; nearly every requirement is a read or write against something that already exists. Each dependency is listed with what breaks when it's gone.

| Dependency | Used for | On failure |
|---|---|---|
| pjangler Registry | pjid → Project Record (FR-2) | Total. Nothing resolves; the Cockpit cannot open. |
| Plane (via the `33god` workspace) | Ticket read and create (FR-9, FR-10) | Tickets pane only. Chat and resolution unaffected. |
| Hermes PM gateway | Streamed Exchange (FR-5) | Chat pane only. Renders as agent-unreachable, distinct from no-agent-provisioned. |
| Bloodbank | Dispatched Command publish (FR-6) | Dispatch only. Streaming chat still works. |
| Candystore | Dispatched Command outcomes (FR-7), and the deferred event feed (§9) | Outcomes show as unknown; dispatch still succeeds. |
| 1Password (`DeLoSecrets`) | All credentials (FR-13) | Bridge starts unhealthy and says which credential failed. |

**Bloodbank subject grammar — a correction to both source documents.** `BRAINDUMP.md` and `docs/product-brief.md` both describe filtering events on a repo-scoped subject (`bloodbank.repo.<repo-name>` and `bloodbank.v1.repo.<repo-name>` respectively). Neither is a legal subject under the current contract. Subjects are exactly five tokens — `bloodbank.<kind>.<domain>.<entity>.<action>` — carrying no version segment and no identity tokens; repo identity lives in `data.repo` and agent identity in `actor.agent_id`. A Project-scoped view of events is therefore a **payload filter, not a subscription**, which is precisely what Candystore's projection is for. This applies to FR-7 now and to the deferred event feed in §9. `bb contract` is the authority; any producer name is validated with `bb emit --check` before publish.

## 7. Non-Goals

- **Not a Plane client.** Tickets are read and appended. Everything richer belongs to `px` and the PM.
- **Not an agent runtime.** Sidepiece talks to Hermes agents; it does not host, schedule, or supervise them.
- **Not a deployment tool.** It reports that an Agent is missing; it does not provision one in v1.
- **Not multi-user, and not portable.** No tenancy, no accounts, no install story for a second person.
- **Not a URL matcher.** There is no hostname heuristic, no Traefik route import, and no fuzzy matching. A page that does not declare a pjid is not a Project, full stop.
- **Not a replacement for the terminal.** It closes the gap between *noticing* and *acting*, not between *thinking* and *building*.

## 8. MVP Scope

### 8.1 In Scope

- Detect a declared pjid on the active tab, including SPA navigation (FR-1).
- Resolve it to a Project Record through the Bridge (FR-2).
- Distinguish all four unresolved states honestly (FR-3).
- Report PM presence; degrade chat honestly when absent (FR-4).
- Streamed Exchange with the PM (FR-5).
- Dispatched Command with acknowledgement and outcome (FR-6, FR-7).
- Per-Project conversation continuity (FR-8).
- Ticket list grouped by state (FR-9) and minimal create (FR-10).
- Bridge health, lifecycle, and vault-resolved credentials (FR-11, FR-12, FR-13).

### 8.2 Out of Scope for MVP

Everything below is specified in §9 rather than dropped, so `bmad-create-epics-and-stories` has a shape to work from when it lands.

- Snapshot capture and annotation.
- Element picker and selector payloads.
- Candystore event feed.
- Agent-session list.
- Tray settings page and recent-projects list.
- One-click Agent provisioning.
- Desktop shell (Tauri). `[NOTE FOR PM: EPIC K deferred this in June and nothing since has argued for it. If it is still deferred at the next retrospective, delete it rather than carrying it.]`

## 9. Deferred Scope (specified, not built)

Shape locked now so v2 does not re-litigate it.

- **Snapshot and annotate.** Capture the visible viewport, draw on it, attach to a chat turn. Constrained by `captureVisibleTab`: visible viewport only, not full-page.
- **Element picker.** Hover-to-select a DOM element; send a stable CSS selector *plus* context — tag, text snippet, `outerHTML`, page URL. `[ASSUMPTION: a bare selector is useless to an agent that cannot see the page, so context is part of the payload, not an enhancement.]` Known failure modes: hashed CSS-in-JS class names, `nth-child` brittleness under re-render, shadow DOM.
- **Candystore event feed.** Project-scoped recent Bloodbank events. Implemented as a `data.repo` payload filter against Candystore, per §6 — never a subject subscription.
- **Agent-session list.** Sessions across claude/codex/kimi in reverse-chronological order, with live running status. The job is "is something already working on this repo right now?" — the question that bites when several agents run in parallel. `[NOTE FOR PM: this was cut from v1 on scope grounds, but it is the only pane that prevents an actual collision. If parallel-agent work increases before v1 ships, promote it.]`
- **Tray settings page and recent Projects.** Extension-icon surface listing recently active Projects in reverse-chronological order.
- **One-click Agent provisioning.** Non-interactive `pj hermes-agent` from the no-Agent state (FR-4).

## 10. Reconciliation with the SIDE Board

The board holds 44 tickets from 2026-06-23, all in backlog, none started. They were written against the superseded Traefik-registry model. Verdict per epic, for `bmad-create-epics-and-stories` to act on:

| Epic | Verdict |
|---|---|
| A — Foundation: monorepo, core, UI kit | **Survives.** Model-independent. |
| B — Project Resolution (registry + URL→repo) | **Rewrite.** Its premise is gone. B3 (`GET /resolve?url=`) resolves the wrong input entirely — the input is a pjid, not a URL. B2 (holocene fleet client) is superseded by the pjangler Registry. |
| C — Plane Ticket Proxy | **Survives**, narrowed to FR-9/FR-10. |
| D — Hermes Chat Relay | **Amend.** Assumed streaming only; must now carry the stream/dispatch split (FR-5, FR-6, FR-7). |
| E — Bloodbank Event Stream | **Defer and rewrite.** §9, and its subject-subscription premise is invalid per §6. |
| F — Agent Provisioning | **Split.** Status surfacing → FR-4 in v1; deploy action → §9. |
| G — Extension Shell & Cockpit | **Survives**, amended for the user-gesture constraint in §5. |
| H — Chat UI | **Survives**, amended for the dispatched-turn rendering in FR-6. |
| I — Tickets UI | **Survives.** |
| J — Snapshot & Annotate | **Defer**, and widen to include the element picker (§9). |
| K — Auth, Packaging, Desktop | **Split.** K1/K2 → FR-12/FR-13 in v1; K3/K4/K5 deferred. |

## 11. Success Metrics

Single-operator tool; the only honest measures are behavioural.

**Primary**
- **SM-1:** I file tickets from the panel instead of the terminal. Target: within a month of v1, most new tickets on actively-browsed Projects originate in Sidepiece. Validates FR-9, FR-10.
- **SM-2:** I still have it installed and enabled 60 days after v1. Validates the whole premise.

**Secondary**
- **SM-3:** Resolution is never wrong. Target: zero instances of the Cockpit showing the wrong Project. Validates FR-1, FR-2.

**Counter-metrics (do not optimize)**
- **SM-C1:** Panel open time. If I'm *living* in the panel rather than dipping into it, the loop got heavier, not lighter. Counterbalances SM-1.
- **SM-C2:** Feature count. This died once already at 44 tickets and zero code. Shipping §8 and stopping beats shipping §9 late. Counterbalances SM-2.

## 12. Open Questions

1. **How does the Bridge reach a Hermes PM for a Streamed Exchange?** The fleet-shared command gateway handles dispatch cleanly (FR-6), but FR-5 needs a synchronous streaming channel and it is not established that the gateway provides one. If it does not, FR-5 needs either a direct agent transport or a CLI-passthrough fallback (the old D3). **Blocks architecture.**
2. **How does a Dispatched Command outcome get correlated back?** FR-7 requires correlating an outcome to an originating turn by identifier. Does the command envelope carry a correlation id that the outcome event preserves, and does Candystore index it?
3. **Which pjangler surface does the Bridge call?** `pj info <pjid>` shelling out, or a library/MCP surface? Shelling out is simplest and slowest; it may or may not matter at this latency budget.
4. **What emits the `pjid` declaration into served pages?** Out of scope here, but v1 is useless until some number of Projects actually declare one. Is that a pjangler recipe, a per-project template change, or manual? **Sequencing risk, not a design risk.**
5. **`.project.json` renamed `project_slug` → `project_id` on 2026-09-17, but `_bmad/custom/workflows/ticket-lifecycle/data/event-schemas.md` still reads `slug` from `project_slug`.** One of the two is now wrong, and the Bridge will read whichever survives. Unrelated to Sidepiece's design; it will bite the Bridge regardless.
6. **Is the element-picker payload enough for the PM to act without seeing the page?** Affects §9 only.
7. **Are extension-context requests to loopback subject to Private Network Access preflight enforcement?** Undocumented, and the rules are still shipping in stages. The mitigation in §5 is cheap and unconditional, so this does not block — but it wants verifying against current stable Chrome before the Bridge's transport is locked, and re-verifying on version bumps. **Verify empirically; do not resolve from documentation.**

## 13. Assumptions Index

- §2.2 — Single-operator assumption is permanent; the design may take shortcuts expensive to reverse.
- §4.1 FR-1 — The pjid declaration is readable from served HTML without executing page JS.
- §4.1 FR-4 — v1 states the provisioning command; it does not run it.
- §4.2 FR-6 — Sidepiece classifies stream-vs-dispatch itself, biasing toward dispatch when uncertain.
- §5 — Sidepiece stays a personally-loaded extension, which is what makes the broad host permission acceptable.
- §9 — Element-picker payload carries context alongside the selector, not a bare selector.

**Verified, no longer assumptions** *(confirmed against the MV3 capability research in `addendum.md` §D)*: service worker idle termination forcing streams into the panel document; the user-gesture requirement and its synchronous-call constraint; per-tab panel scoping and panel-document persistence across tab switches; `captureVisibleTab` viewport-only capture.
