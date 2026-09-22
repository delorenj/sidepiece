---
title: Sidepiece
status: final
created: 2026-09-17
updated: 2026-09-22
---

# PRD: Sidepiece

## 0. Document Purpose

This PRD is the contract between the Sidepiece braindump and everything downstream — `bmad-ux`, `bmad-create-architecture`, and `bmad-create-epics-and-stories`. It is written for one reader who is also the only user, so it spends its length on requirements that constrain implementation and almost none on justification.

Structure: vocabulary is fixed in §3 Glossary and used verbatim everywhere else; features are grouped in §4 with globally-numbered FRs nested under them; inferences are tagged `[ASSUMPTION]` inline and indexed in §13.

Inputs: `BRAINDUMP.md` (2026-09-17) is the source of truth. `docs/product-brief.md` (2026-06-04) supplied depth but was superseded on two points — resolution model and annotation mechanism. The `SIDE` Plane board's 44 tickets (EPIC A–K, 2026-06-23) were read as prior art; §10 records what survives and what does not. Transport and framework choices deliberately live in `addendum.md`, not here.

Sections a PRD template would offer and this one deliberately omits, because a single-operator personal tool does not carry the concerns they exist for: stakeholders and approvals, risk register, ROI, rollout and change management, data governance, audit trail, compliance, monetization, hardware constraints, versioning and deprecation policy, public API surface. Their absence is a decision, not an oversight.

## 1. Vision

Sidepiece is a Chrome side panel that closes the gap between looking at one of my running services and acting on the project that produces it. Today that gap is a context switch: find the repo, remember the board identifier, open a terminal, pick the right CLI. Each step is small and the sum of them is enough friction that I notice things and don't act on them.

The mechanism is a page-declared identity. Every pjangler-backed project advertises its `pjid` in the served HTML. When I'm on a page that declares one, Sidepiece resolves it through a bridge into the full project record — repo path, Hermes PM agent, Plane board — and puts a cockpit next to the page: a chat box wired to that project's PM, and that project's tickets.

The value is not any single pane. It is that the resolution is automatic and correct. I never tell Sidepiece which project I'm looking at, and it is never wrong about it, because the page itself said so. `[NOTE FOR PM: BRAINDUMP.md frames the value as density instead — "a live project cockpit: current URL, local repo, agent, tickets, screenshots, and repo-specific operational messages all in one place." That framing was considered and deliberately overridden on 2026-09-17; the cockpit is a means, not the thesis. bmad-ux should not reintroduce density as a goal on the strength of the braindump alone.]`

## 2. Target User

### 2.1 Jobs To Be Done

- When I notice something wrong on a running service, file it against the right board without leaving the page or looking up an identifier.
- When I want to know what's happening with a project, ask its PM agent in the same place I'm looking at its output.
- Cut the "which repo is this again?" lookup to zero — the page should already know.
- Act on small observations at the moment I have them, instead of losing them to the cost of switching contexts.

### 2.2 Non-Users (v1)

Everyone else. Sidepiece assumes a single operator with a pjangler registry, a Hermes fleet, and a Plane workspace already in place. There is no multi-user model, no tenancy, and no install story for anyone who isn't me. `[ASSUMPTION: this stays true indefinitely — the design may take shortcuts that are expensive to undo if it ever changes.]`

Single operator does **not** mean single machine. Chrome runs on a laptop; the repos, the Hermes fleet, and the Bridge live on `big-chungus`. Every requirement below crosses that boundary, and §5 treats the tailnet as the trust boundary rather than pretending the gap isn't there. Multi-*device* is not multi-*user* and does not reopen the portability non-goal in §7.

### 2.3 Key User Journeys

Single operator, single role — captured in the lighter shape per the template's scope dial.

- **UJ-1. Jarad files a bug against the thing he's staring at.** On `holocene.delo.sh`, something renders wrong. The panel already shows Holocene resolved, with its repo name and clone path visible. He types a title into the ticket box and it lands on Holocene's board — no identifier looked up, no terminal, no tab switch.
- **UJ-2. Jarad asks the PM what's going on.** Same panel, chat box. "What's in progress?" streams back inline in a couple of seconds. Follow-up: "start on the resolver ticket" — Sidepiece classifies that as work, dispatches it, says so, and later shows the result in the same thread rather than only a green checkmark.
- **UJ-3. Jarad lands on a project with no PM.** The panel resolves the project fine but reports no Hermes agent. Chat is visibly unavailable with the reason stated, tickets still work, and he's told the exact command to provision one. *Edge case:* if the Bridge is unreachable — laptop off the tailnet, or `big-chungus` down — every pane says so with one shared message rather than each failing in its own way.

## 3. Glossary

Downstream workflows use these terms exactly. Introducing a synonym anywhere is a discipline violation.

- **pjid** — The stable identifier pjangler assigns a registered project. Advertised by the served page in its own HTML. One per Project.
- **Project** — A pjangler-registered unit of work. Has exactly one pjid, one repo, one local clone path, at most one Board, and zero or more Agents.
- **Project Record** — The resolved metadata for a Project: repo name, local clone path, Board binding, Agent bindings.
- **Registry** — pjangler's catalogue of Projects. Authoritative; Sidepiece reads it and never writes it.
- **Bridge** — The daemon on `big-chungus` that Sidepiece calls. The only component that touches the filesystem, runs pjangler, or holds a credential. See §4.4.
- **Tailnet** — The private WireGuard network (`burro-salmon.ts.net`) joining the laptop and `big-chungus`. Sidepiece's transport and, per §5, its trust boundary.
- **Cockpit** — The Chrome side panel UI, scoped to exactly one resolved Project at a time.
- **Agent** — A Hermes process bound to a Project. Sidepiece cares about the PM role; the Scrum Master role may be declared but is not a chat target. A declared Agent binding is not proof of a running Agent, and its `role_dir` is not guaranteed to exist — see FR-5.
- **PM** — The Hermes Project Manager Agent for a Project. The chat counterpart.
- **Board** — The Plane project holding a Project's Tickets. Identified by workspace, identifier, and board UUID. A Project may have none.
- **Ticket** — A Plane issue on a Board.
- **Bloodbank** — The 33GOD event and command bus. Subjects are five tokens, `bloodbank.<kind>.<domain>.<entity>.<action>`, with no version segment and no identity tokens.
- **Candystore** — The queryable projection of Bloodbank events. The only practical way to retrieve events filtered by Project.
- **Turn** — One message the operator sends in the Cockpit chat, and its response.
- **Streamed Exchange** — A Turn answered inline, token by token, within the panel session.
- **Dispatched Command** — A Turn published to Bloodbank as a command for asynchronous execution. Acknowledged immediately; its result arrives later.

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
- A page whose declared `pjid` changes without a navigation is re-detected, and the Cockpit re-resolves rather than continuing against the previous Project.

`[ASSUMPTION: the declaration is a meta tag in <head>. Exact attribute naming is an architecture concern, but "in the served HTML, readable without executing page JS" is a product requirement — it must work on a static page with scripting disabled.]`

#### FR-2: Resolve a pjid to a Project Record

Given a detected pjid, Sidepiece obtains the full Project Record from the Bridge, which derives it from the pjangler Registry.

**Consequences (testable):**
- A pjid present in the Registry resolves to repo name, local clone path, Board binding, and Agent bindings.
- A pjid absent from the Registry produces a distinct "declared but unknown" state, worded differently from "no pjid declared" — the two have different causes and different fixes.
- Resolution results are cached per pjid and the cache is explicitly bounded: it expires on a stated TTL, is invalidated when Bridge health transitions from unreachable to reachable, and every FR-3 failure state offers a re-resolve control. An unbounded "cached for the panel session" is not acceptable — it makes FR-3's stale states unreachable.
- Each resolution is stamped with a generation number, carried by every subsequent call for that Project (see §5, "cost of being wrong"). **AMENDED 2026-09-22 — the generation is *content-addressed*, not per-resolution.** `architecture.md` D11 specifies it: the Bridge hashes the Project Record it derived and advances the generation only when the hash changes, so re-resolving an unchanged record is not an event. The sequence remains monotonic and never reuses a value. The original literal wording — a stamp on *each resolution* — was wrong in a way that would have made the guard useless: a second window merely re-resolving would advance the number and refuse the first window's perfectly valid mutation, so the check would fire constantly on the safe case and never on the dangerous one. This amendment adopts the downstream correction rather than leaving the contract and the design disagreeing.
- Resolution completes within the §5 latency budget, measured over the tailnet rather than on loopback.

#### FR-3: Report the unresolved and degraded states honestly

FR-3 is the single authoritative enumeration of states in which the Cockpit cannot fully function. Other FRs reference it rather than restating their own lists.

**Consequences (testable):**
- Each of the following is separately rendered and separately worded: no pjid declared; pjid declared but unknown to the Registry; Bridge unreachable; Bridge reachable but unhealthy, named by which dependency failed (per FR-14); Registry readable but the Project's clone path missing on disk; an Agent binding whose `role_dir` does not exist.
- No failure state renders as an empty or loading panel.
- The Bridge-unreachable state distinguishes "laptop is off the tailnet" from "`big-chungus` is not answering" where the two are distinguishable, since the fixes differ.
- Every failure state carries a re-resolve control (per FR-2).

`[ASSUMPTION: the dangling role_dir state is worth its own message because it already occurs — .project.json binds sidepiece-scrum-master to agents/hermes/scrum-master, which does not exist in this repo.]`

#### FR-4: Display the resolved identity

The Cockpit shows what it resolved. This is the literal payoff of the page-to-project bridge, and without it FR-2's output is invisible and SM-3 is unobservable.

**Consequences (testable):**
- Repo name, local clone path, and Board identifier are visible whenever a Project is resolved, without opening a menu or a detail view.
- The local clone path is selectable as text so it can be copied into a terminal.
- When the resolved Project changes, the displayed identity changes in the same frame as the rest of the Cockpit — never one pane showing a Project the others have moved on from.

#### FR-5: Surface Agent presence, and distinguish declared from running

The Cockpit reports whether the resolved Project has a Hermes PM and degrades honestly when it does not. A declaration in the Registry is an *intent*; it is not evidence that an Agent exists or is reachable.

**Consequences (testable):**
- Three states are distinguished, not two: no PM declared; a PM declared but not present in the Hermes fleet registry or not reachable; a PM declared, present, and reachable.
- Chat is enabled only in the third state. The first two disable it with their own distinct reason.
- The no-PM-declared state names the exact provisioning command. `[ASSUMPTION: v1 states the command; it does not run it. One-click deploy is deferred — see §9.]`
- Neither degraded Agent state disables the Tickets pane.

`[ASSUMPTION: the middle state is not hypothetical — Sidepiece's own .project.json declares sidepiece-pm, which does not appear in the Hermes fleet registry. A design that reports declaration as presence would be wrong about this repo on day one.]`

**Out of Scope:** Writing to the Registry. Creating, editing, or removing Projects. Cloning a missing repo.

### 4.2 Agent Chat

**Description:** A chat box bound to the resolved Project's PM, with two different response modes because two genuinely different things happen in it. Asking a question should answer in the panel. Assigning work should not pretend to be a conversation — it should be published as a command and acknowledged, with the result arriving later. Conflating these is how the panel ends up appearing to hang while an agent does twenty minutes of work. Realizes UJ-2, UJ-3.

**Functional Requirements:**

#### FR-6: Classify a Turn as Streamed Exchange or Dispatched Command

The split is the feature, so the classifier is a requirement rather than an implementation note. It needs a stated rule, a stated bias, and an escape hatch.

**Consequences (testable):**
- Every Turn is classified before send, by a rule specific enough that the same Turn always classifies the same way.
- The classification is visible on the composer before the operator commits, and one control flips it.
- The classifier biases toward Dispatched Command when uncertain.
- Three example Turns per branch are specified and used as test cases — at minimum "what's in progress?" and "summarize the board" classify as Streamed Exchange; "start on the resolver ticket" and "fix the failing test" classify as Dispatched Command.
- A manual override is remembered for the remainder of that Turn only, never applied implicitly to later Turns.

`[ASSUMPTION: an explicit rule plus a visible override beats a perfect classifier. The rule's exact form — verb allowlist, LLM pre-pass, or mode toggle — is an architecture decision; that a rule exists and is overridable is a product requirement.]`

#### FR-7: Streamed Exchange

Turns classified as conversational are answered inline, incrementally, without waiting for completion.

**Consequences (testable):**
- The turn is **accepted** within 500ms — a visible "the PM has your turn" state, distinct from a response. Measured at 79ms against the live gateway, so this is the promise that actually kills the feeling of a hang.
- **First content token** renders within 8s p95 on a warm session. A cold session carries no first-token budget and renders an explicit "warming up the PM" state instead. Warm was measured at 3.8–5.1s and cold at 7.1–17.1s; token-level streaming exists and is genuine, but 2s was never achievable by any mechanism on this hardware.
- A decorative placeholder frame does not count as a first token. The upstream gateway emits `thinking.delta` spinner text before real content; rendering that as the answer would be measuring an animation.
- Partial output is visible while generating; the panel never shows only a spinner for a response in progress.
- Closing and reopening the panel mid-stream does not lose the Turn: the completed answer is retrievable on reopen. Partial tokens are best-effort and may be lost; the answer is not. This requires the Bridge to hold Turn state keyed by pjid and Turn id (see FR-15) — the panel document cannot be the system of record, because §5 establishes it does not survive closing.
- A stream that dies mid-response is reported as failed, not left indefinitely pending.

#### FR-8: Dispatched Command

Turns classified as work assignment are published to Bloodbank as commands and acknowledged rather than answered.

**Consequences (testable):**
- A dispatched Turn produces a visible acknowledgement carrying a correlation identifier within the §5 budget.
- The Turn is rendered as dispatched, visibly distinct from a Streamed Exchange.
- A rejected or unpublishable command surfaces the rejection, never silent success.
- The subject conforms to the five-token contract and is validated before publish.

#### FR-9: Dispatched Command outcome and result

A dispatched Turn is not abandoned at acknowledgement, and a status is not an answer.

**Consequences (testable):**
- Each dispatched Turn shows a terminal status — completed, failed, or timed out — once the corresponding outcome is observable.
- A completed Dispatched Command renders its **result content** in the Turn, not only its status. Without this, a misclassified question is a dead end on the classifier's preferred failure side, and FR-6's bias toward dispatch is unjustified.
- Outcomes are correlated back to the originating Turn by identifier, not by ordering or recency.
- A dispatch with no observed outcome within a configured window is shown as unknown, not as success, and the window is long enough that ordinary agent work does not routinely trip it.
- Outcomes arriving while the panel is closed are reconciled on next open.

#### FR-10: Turns carry page context

The PM is being asked about a page it cannot see. A Turn that omits the page is a Turn the PM has to guess at.

**Consequences (testable):**
- Every Turn carries the active tab's URL and page title alongside the operator's text.
- The operator can see what context is attached before sending.
- Context attachment survives the classification in FR-6 — both Streamed Exchanges and Dispatched Commands carry it.

#### FR-11: Per-Project conversation continuity

Chat history is scoped to the Project and survives the panel closing.

**Consequences (testable):**
- Reopening the Cockpit on the same Project restores that Project's prior Turns.
- Two Projects never share history.
- History survives a Chrome restart and an extension service worker termination.
- History is appended per Turn rather than rewritten wholesale, so two Cockpits on the same Project (see §5, multiple windows) cannot clobber each other.

**Out of Scope:** Chatting with any Agent other than the Project's PM. Multi-turn tool approval flows. Attaching files. Sending page *body* content or screenshots. Those are §9.

### 4.3 Tickets

**Description:** The resolved Board, read and appended to, in the panel. Read is grouped by state so the board's shape is legible at a glance. Create is deliberately minimal — title, and optionally a description and target state — because refinement is the PM's job and `px` already exists for everything richer. Realizes UJ-1.

**Functional Requirements:**

#### FR-12: List Tickets grouped by state

**Consequences (testable):**
- Tickets render grouped by Board state, in the Board's own state order, not alphabetically.
- Each Ticket shows its human key, title, and state.
- **A Project with no Board binding renders the Tickets pane as unavailable with the reason stated (distinct from an empty Board and distinct from a failed fetch), names the command that binds one, and disables create rather than failing it. Chat stays fully usable.** This mirrors FR-5's treatment of a missing Agent. Four of the nineteen registered Projects have no board — `codegraph-voyage`, `legofirst`, `momo`, `vinyl` — so it is a real state rather than a hypothetical one. The field is an **empty string**, never null and never absent, so the check must be for truthiness; `!= null` or a key-presence test reports a board for all four and renders the pane against an empty id.
- An empty Board renders as empty, distinct from both of the above.
- Each Ticket links to its Plane URL, opening in a new tab.
- The list is fetched fresh on Project resolution, not served from a prior Project's cache, and offers a user-initiated refetch.
- Board reads complete within the §5 budget, or render a timeout state.

#### FR-13: Create a Ticket

**Consequences (testable):**
- A Ticket can be created with a title alone.
- Description and target state are optional; omitting state uses the Board's default entry state.
- The Ticket is created on the resolved Project's Board and no other — the Board is never chosen by the user.
- On success, the new Ticket appears in the list without a manual refresh.
- On failure, the entered text is preserved and the error is shown.

**Out of Scope for v1:** Editing an existing Ticket. Moving a Ticket between states. Assigning, labelling, commenting, or deleting. These belong to the PM and to `px`.

### 4.4 The Bridge

**Description:** A daemon on `big-chungus`, and the only component in the system that touches the filesystem, executes pjangler, reaches Plane, or holds a credential. The extension is a client and nothing more. This exists because a Chrome extension fundamentally cannot do any of those things, and because Chrome is not running on the machine that has them. Since it is a process I have to keep alive on a host I am not sitting at, its health and lifecycle are product surface, not an implementation detail. Realizes UJ-3.

**Functional Requirements:**

#### FR-14: Bridge health is observable from the Cockpit

**Consequences (testable):**
- The Cockpit distinguishes Bridge reachable, unreachable, and reachable-but-unhealthy, feeding FR-3's enumeration.
- An unhealthy Bridge reports which downstream dependency is failing — Registry, Plane, Bloodbank, or Agent gateway — rather than a generic error.
- The Bridge exposes a health endpoint returning per-dependency status.
- Health distinguishes "the pjangler registry service is not running" from "the Registry returned an error", because the former has a different fix.
- Health reports whether the PM's **provider credentials actually resolved**, not merely that the agent backend is reachable. A Hermes process that starts without vault auth falls through to unresolved `op://` literals, fails provider auth, and silently downgrades to a fallback model — a failure that produces correct-looking answers at the wrong cost and latency, and surfaces nowhere. Verified on this machine: `hermes-dashboard.service` had been running in exactly that state since 2026-09-09. Silent degradation is the failure mode most worth a health state, because nothing else will ever report it.

#### FR-15: Bridge lifecycle, binding, and Turn state

**Consequences (testable):**
- The Bridge runs under `systemd --user` on `big-chungus`: starts on login, restarts on failure, no manual intervention.
- It is reachable from the laptop over the tailnet and **never** on `0.0.0.0`. The binding itself is an architecture decision: `tailscale serve` fronting a loopback-bound Bridge satisfies this and is preferred, because Tailscale then owns the tailnet socket, TLS termination, and certificate renewal. A Bridge binding the tailnet interface directly also satisfies it. What this requirement forbids is a public bind and a loopback-only bind with nothing fronting it.
- Restarting the Bridge does not require reloading the extension.
- The Bridge is inspectable with `curl` from either machine — every capability the extension uses is reachable without the extension. This is a hard requirement, not a convenience; a bridge that can only be exercised through Chrome makes every bug a two-variable bug.
- It holds Turn state keyed by pjid and Turn id, so FR-7's reopen guarantee and FR-9's closed-panel reconciliation are satisfiable.
- Its logs are readable via the `big-chungus` journal; no log aggregator is required.

#### FR-16: Credentials resolve from the vault, never from disk

**Consequences (testable):**
- Every credential resolves from 1Password at process start or per-request.
- No credential is written to a file in the repo, including files intended to be gitignored.
- A failed credential resolution surfaces as an unhealthy dependency in FR-14, naming which one.

## 5. Cross-Cutting NFRs

- **Trust boundary.** The tailnet is the authentication boundary. The Bridge performs no application-level authentication of its caller: WireGuard device authentication already gates who can reach it, and layering a token scheme on top would be ceremony on a single-user tool. What this buys is stated plainly so it can be revisited rather than assumed: anything on the tailnet can call the Bridge. That is acceptable. Binding to `0.0.0.0` would not be, and is prohibited by FR-15.
- **Failure posture.** Every pane fails independently and says why. A dead Bloodbank must not take down tickets; an unreachable Plane must not take down chat. No pane may render a failure as an empty state or a permanent spinner. FR-3 is the authoritative state enumeration.
- **Panel lifetime.** All long-lived connections — chat streams, event subscriptions — live in the panel document, never in the extension service worker, which is terminated after roughly 30s idle. The panel document stays alive across tab switches while open, so in-panel state survives navigation; it does not survive the panel closing. Anything that must outlive it is held by the Bridge (FR-15), not persisted client-side.
- **Multiple windows.** Chrome's side panel is per-window, so two Chrome windows mean two Cockpit documents with independent caches and independent resolution state. v1 does not attempt to synchronize them: each is independently correct for its own window, and FR-11's append-per-Turn history rule keeps them from clobbering each other. `[ASSUMPTION: concurrent multi-window use is rare enough that per-window independence is acceptable. If it proves otherwise, the Bridge already holds the state a shared model would need.]`
- **Opening the panel.** Chrome requires a genuine user gesture to open a side panel, and the open call must be the first synchronous call in the gesture handler — anything awaited first silently no-ops with no error. Sidepiece therefore cannot auto-open on detection; the extension icon carries the "this tab is resolvable" signal so opening it is an informed click.
- **Origin reach vs. permission scope.** Declaration-based resolution is origin-independent by design (§4.1), but the content script that reads the declaration is bound by its host match pattern. A narrow allowlist reintroduces exactly the origin coupling the model was chosen to remove. Sidepiece takes the broad match and accepts the permission prompt — it is a personally-loaded extension, the prompt is a one-time cost, and no store review applies. `[ASSUMPTION: this stays a personally-loaded extension. If §7's portability non-goal is ever revisited, this decision is the first thing that breaks.]`
- **Latency budget, measured over the tailnet.** Detection ≤500ms (local to the browser, unaffected by the network). Resolution ≤1s p95 (measured at 2.4ms p50 locally — roughly two orders of magnitude of headroom). Board read ≤2s p95. Dispatch acknowledgement ≤2s. Chat is **two** budgets, not one: turn accepted ≤500ms, and first content token ≤8s p95 warm with no budget cold. The single ≤2s first-token figure in earlier drafts was aspirational and is unachievable on this hardware. These are end-to-end from the laptop and must hold with the laptop on the same LAN as `big-chungus`. Budgets are explicitly **not** guaranteed when the tailnet falls back to a DERP relay; that case renders a degraded-connection indicator rather than silently missing the budget. Missing a budget renders a timeout state, never an indefinite pending one.
- **Cost of being wrong.** Sidepiece must never act against the wrong Project. Each resolution carries a monotonic generation number (FR-2); every mutating call carries `(pjid, generation)`, and both the panel and the Bridge refuse a mutation whose generation is stale. Comparing the pjid against the Board it targets would be a tautology — the Bridge derives the Board *from* the pjid — so the generation is what actually catches a Project that changed under an in-flight action. A confidently wrong ticket is worse than a failed one.
- **Local network access is a moving target, and the tailnet makes it less certain, not more.** Chrome's Private Network Access rules have shipped in stages and continue to. The Bridge is no longer on loopback but on a tailnet address in `100.64.0.0/10` (CGNAT), whose PNA address-space classification is *less* clearly documented than loopback's. A Bridge call that works today can start failing after an unrelated Chrome auto-update. Mitigations are unconditional: the Bridge answers preflights with the private-network CORS headers from day one, and serving it over HTTPS with a real certificate removes an entire class of this problem. Reachability is re-verified on Chrome version bumps rather than assumed solved. See §12 Q7.

## 6. Integration and Dependencies

Sidepiece produces almost no data of its own; nearly every requirement is a read or write against something that already exists. Each dependency is listed with what breaks when it's gone.

| Dependency | Used for | On failure |
|---|---|---|
| Tailnet (`burro-salmon.ts.net`) | Reaching the Bridge at all (FR-14, FR-15) | Total. Every pane renders Bridge-unreachable. The most likely real-world outage — a laptop off the tailnet. |
| pjangler Registry | pjid → Project Record (FR-2) | **AMENDED 2026-09-22 — partial, not total.** Was "Total. Nothing resolves; the Cockpit cannot open." That was written against a Bridge with no fallback. `architecture.md` D2 gives it one: a last-good registry snapshot on disk. The Project resolves from the snapshot, the identity header renders **marked stale**, the panes stay live, and DS-23 carries the snapshot's age. Total remains correct for the Tailnet row, where nothing can be true. |
| Plane (via the `33god` workspace) | Ticket read and create (FR-12, FR-13) | Tickets pane only. Chat and resolution unaffected. |
| Hermes PM gateway | Streamed Exchange (FR-7) | Chat pane only. Renders as agent-unreachable, distinct from no-agent-declared (FR-5). |
| Bloodbank | Dispatched Command publish (FR-8) | Dispatch only. Streaming chat still works. |
| Candystore | Dispatched Command outcome and result (FR-9), and the deferred event feed (§9) | Outcomes show as unknown; dispatch still succeeds. |
| 1Password (`DeLoSecrets`) | All credentials (FR-16) | Bridge starts unhealthy and says which credential failed. |

**Bloodbank subject grammar — a correction to both source documents, and to live config.** `BRAINDUMP.md` and `docs/product-brief.md` both describe filtering events on a repo-scoped subject (`bloodbank.repo.<repo-name>` and, at `product-brief.md:102`, `bloodbank.evt.v1.repo.sidepiece.>`). Neither is a legal subject. Subjects are exactly five tokens — `bloodbank.<kind>.<domain>.<entity>.<action>` — carrying no version segment and no identity tokens; repo identity lives in `data.repo` and agent identity in `actor.agent_id`. A Project-scoped view of events is therefore a **payload filter, not a subscription**, which is precisely what Candystore's projection is for. This applies to FR-9 now and to the deferred event feed in §9.

This is not only a documentation problem. `agents/hermes/pm/role.yaml` — the live manifest of the PM that FR-7 and FR-8 target — currently subscribes to `bloodbank.evt.repo.sidepiece.>` and `bloodbank.cmd.agent.sidepiece-pm.>`, both of which embed an identity slug as a subject token and are illegal under the same contract. `bb contract` is the authority; any producer name is validated with `bb emit --check` before publish. `[NOTE FOR PM: fixing role.yaml is outside this PRD's scope but blocks FR-8 in practice — a PM subscribed to an illegal subject receives nothing.]`

## 7. Non-Goals

- **Not a Plane client.** Tickets are read and appended. Everything richer belongs to `px` and the PM.
- **Not an agent runtime.** Sidepiece talks to Hermes agents; it does not host, schedule, or supervise them.
- **Not a deployment tool.** It reports that an Agent is missing; it does not provision one in v1.
- **Not multi-user, and not portable.** No tenancy, no accounts, no install story for a second person. Multi-device for one operator is in scope; multi-operator is not.
- **Not a URL matcher.** There is no hostname heuristic, no Traefik route import, and no fuzzy matching. A page that does not declare a pjid is not a Project, full stop. `[ASSUMPTION: this is a hard requirement with no fallback — emitting the declaration is a pjangler concern, out of scope here, and tracked as §12 Q4.]`
- **Not publicly reachable.** The Bridge lives on the tailnet. It is never exposed through Traefik, the Cloudflare tunnel, or any public hostname.
- **Not a replacement for the terminal.** It closes the gap between *noticing* and *acting*, not between *thinking* and *building*.

## 8. MVP Scope

### 8.1 In Scope

- Detect a declared pjid on the active tab, including SPA navigation (FR-1).
- Resolve it to a Project Record through the Bridge, with a bounded cache and a generation stamp (FR-2).
- Distinguish every unresolved and degraded state honestly (FR-3). **AMENDED 2026-09-22 — the count is twenty-eight, not six.** FR-3 claims to be the single authoritative enumeration and named six; `EXPERIENCE.md` found that FR-5's two Agent states and FR-12's no-Board state each gate a whole pane and appeared in none of them, and the architecture's step-7 validation added six more that its own decisions required (DS-23…DS-28). The built taxonomy is **DS-1…DS-28**, defined in `EXPERIENCE.md` and typed in `contract/src/state.ts`. `[NOTE FOR PM: this line is what `bmad-create-epics-and-stories` reads to size FR-3. Sizing it at six budgets six sentences and six recovery affordances for a requirement that needs twenty-eight plus three non-DS typed code spaces — a 4.7x error, and the single most likely place the backlog goes wrong.]`
- Display the resolved identity — repo, clone path, board (FR-4).
- Report PM presence, distinguishing declared from running (FR-5).
- Classify each Turn, visibly and overridably (FR-6).
- Streamed Exchange with the PM (FR-7).
- Dispatched Command with acknowledgement (FR-8), and outcome *with result content* (FR-9).
- Turns carry page URL and title (FR-10).
- Per-Project conversation continuity (FR-11).
- Ticket list grouped by state, including the no-Board state (FR-12), and minimal create (FR-13).
- Bridge health (FR-14), tailnet lifecycle and Turn state (FR-15), vault-resolved credentials (FR-16).

### 8.2 Out of Scope for MVP

Everything below is specified in §9 rather than dropped, so `bmad-create-epics-and-stories` has a shape to work from when it lands.

- Element picker and selector payloads.
- Snapshot capture and annotation.
- Candystore live event feed.
- Agent-session list.
- Tray settings page and recent-projects list.
- One-click Agent provisioning.
- Desktop shell (Tauri). `[NOTE FOR PM: EPIC K deferred this in June and nothing since has argued for it. If it is still deferred at the next retrospective, delete it rather than carrying it.]`

## 9. Deferred Scope (specified, not built)

Shape locked now so v2 does not re-litigate it.

- **Element picker — the primary annotation mechanism.** Hover-to-select a DOM element; send a stable CSS selector *plus* context — tag, text snippet, `outerHTML`, page URL. `BRAINDUMP.md` states this as a **replacement** for screenshots, not a peer: "Instead of passing screenshots, I can pass unique selectors." Build this first and treat snapshot as the fallback for cases a selector cannot express, not the other way round. `[ASSUMPTION: a bare selector is useless to an agent that cannot see the page, so context is part of the payload, not an enhancement.]` Known failure modes: hashed CSS-in-JS class names, `nth-child` brittleness under re-render, shadow DOM.
- **Snapshot and annotate — the fallback.** Capture the visible viewport, draw on it, attach to a Turn. Constrained by `captureVisibleTab`: visible viewport only, not full-page, and rate-limited.
- **Attachment to Tickets, not only Turns.** `BRAINDUMP.md`'s open question is what payload shape annotations use "when they are attached to agent messages **or tickets**." The ticket destination is deferred with the annotation features, not dropped — FR-13 gains an attachment surface when they land.
- **Candystore live event feed.** Project-scoped Bloodbank events, **tailing live** rather than a static recent-events list — `docs/product-brief.md` specifies a "live event stream" and the distinction is a product difference, not a wording one. Implemented as a `data.repo` payload filter against Candystore, per §6 — never a subject subscription.
- **Agent-session list.** Sessions across claude/codex/kimi in reverse-chronological order, with live running status. The job is "is something already working on this repo right now?" — the question that bites when several agents run in parallel. `[NOTE FOR PM: this was cut from v1 on scope grounds, but it is the only pane that prevents an actual collision. If parallel-agent work increases before v1 ships, promote it.]`
- **Tray settings page and recent Projects.** Extension-icon surface listing recently active Projects in reverse-chronological order.
- **One-click Agent provisioning.** Non-interactive `pj hermes-agent` from the no-Agent state (FR-5).

## 10. Reconciliation with the SIDE Board

The board holds 44 tickets from 2026-06-23, all in backlog, none started, written against the superseded Traefik-registry model. Verdict per epic, for `bmad-create-epics-and-stories` to act on. Note that FR-1, FR-2, FR-3, FR-4, and FR-14 have **no existing board lineage** — they are new work regardless of what happens to these epics.

| Epic | Verdict |
|---|---|
| A — Foundation: monorepo, core, UI kit | **Survives.** Model-independent. But it is four tickets of scaffolding ahead of the hard part; sequence it behind a working Bridge rather than in front of it. |
| B — Project Resolution (registry + URL→repo) | **Rewrite.** Its premise is gone. B3 (`GET /resolve?url=`) resolves the wrong input entirely — the input is a pjid, not a URL. B2 (holocene fleet client) is superseded by the pjangler Registry. New FRs: FR-1, FR-2, FR-3, FR-4. |
| C — Plane Ticket Proxy | **Survives**, narrowed to FR-12/FR-13, plus the no-Board state. |
| D — Hermes Chat Relay | **Amend.** Assumed streaming only; must now carry the classifier and the stream/dispatch split (FR-6 through FR-10). D3's CLI-passthrough fallback stays relevant pending §12 Q1. |
| E — Bloodbank Event Stream | **Defer and rewrite.** §9, and its subject-subscription premise is invalid per §6. |
| F — Agent Provisioning | **Split.** Status surfacing → FR-5 in v1, widened to distinguish declared from running; deploy action → §9. |
| G — Extension Shell & Cockpit | **Survives**, amended for the user-gesture and multi-window constraints in §5. |
| H — Chat UI | **Survives**, amended for classifier visibility (FR-6) and dispatched-result rendering (FR-9). |
| I — Tickets UI | **Survives.** |
| J — Snapshot & Annotate | **Defer and reorder.** The element picker leads and snapshot becomes the fallback (§9) — the reverse of this epic's framing. |
| K — Auth, Packaging, Desktop | **Split and promote.** K1/K2 → FR-15/FR-16 in v1. **K5 "Remote access (optional)" is no longer optional or deferred** — it is the tailnet transport, and it is v1. K3 packaging and K4 Tauri stay deferred. |

## 11. Success Metrics

Single-operator tool; the only honest measures are behavioural.

**Primary**
- **SM-1:** I file tickets from the panel instead of the terminal. Target: within a month of v1, most new tickets on actively-browsed Projects originate in Sidepiece. Validates FR-12, FR-13.
- **SM-2:** I still have it installed and enabled 60 days after v1. Validates the whole premise.

**Secondary**
- **SM-3:** Resolution is never wrong. Target: zero instances of the Cockpit showing the wrong Project. Observable because FR-4 displays the resolved identity — without it this metric has no mechanism — and enforced by the generation check in §5. Validates FR-1, FR-2, FR-4.

**Counter-metrics (do not optimize)**
- **SM-C1:** Panel open time. If I'm *living* in the panel rather than dipping into it, the loop got heavier, not lighter. Counterbalances SM-1. Confirmed deliberate on 2026-09-17 against the braindump's density framing — see §1.
- **SM-C2:** Feature count. This died once already at 44 tickets and zero code. Shipping §8 and stopping beats shipping §9 late. Counterbalances SM-2.

## 12. Open Questions

*Q1, Q2, Q3 and Q5 were closed empirically on 2026-09-17 by the architecture investigation; each is annotated below with its answer and the architecture document carries the detail. Q4, Q6, Q7 and Q8 remain genuinely open.*

1. **CLOSED — a streaming transport exists.** `tui_gateway`, a newline-delimited JSON-RPC server, over WebSocket via `hermes serve`, with `session.create {profile}` so one backend serves every Project's PM. Genuine per-token frames. The budget, not the mechanism, was what had to give — see FR-7 and §5. Original question: **How does the Bridge reach a Hermes PM for a Streamed Exchange?** Dispatch (FR-8) maps onto the command gateway cleanly, but FR-7 needs a synchronous streaming channel and it is not established that one exists. If it does not, FR-7 needs either a direct agent transport or a CLI-passthrough fallback (the old D3) — and a CLI cold start may not fit the §5 budget, in which case the budget or the mechanism has to give. **Blocks architecture.**
2. **CLOSED, and half of it is a blocker.** Correlation already works: a dispatched command carries `correlationid`, `command_id` and `idempotency_key`, and the gateway copies all three onto every outcome event — verified with a live probe dispatch. **Result content does not exist.** `BloodbankAdapter.send()`, the method Hermes core calls with the agent's response text, is a no-op that discards its `content` argument; outcome events carry status only. FR-9's "renders its result content" is therefore unbuildable until the Bloodbank gateway is changed — a dependency on another repo, not Sidepiece work. Note also that gateway lifecycle events carry no repo or project at all, so §6's `data.repo` filter holds for webhook events but **not** for agent dispatch events; the Bridge must scope dispatch outcomes by the correlationid it minted itself. Original question: **How does a Dispatched Command outcome get correlated back, and does it carry a result payload?** FR-9 needs both a correlation identifier the outcome event preserves and access to the command's actual output — not just its status. Does the envelope carry a correlation id, does Candystore index it, and is the result content available there?
3. **CLOSED — the registry HTTP service, and the PRD's named fallback was wrong.** `GET /v1/registry` measures 2.4ms p50; there is no per-pjid endpoint, so the Bridge indexes the payload client-side. `pj info <pjid>` is **not** an independent fallback: it calls the same service and exits 1 when it is down, failing in precisely the outage it was meant to cover. The service is supervised under `systemd --user`. Original question: **Which pjangler surface does the Bridge call?** Three options, not two: shelling out to `pj info <pjid>`; a library or MCP surface; or **the pjangler registry HTTP service, which `pj info --help` exposes as `--registry` (default `http://localhost:8764`) and which is currently listening on `big-chungus`.** The service is the leading candidate on latency grounds, with the CLI as fallback — in which case FR-14 must report "registry service down" as its own health state. `BRAINDUMP.md` named the CLI form as a decision ("running `pj info [pjid]` and parsing the output"); this is a challenge to that decision on latency grounds, not a question asked from zero.
4. **What emits the `pjid` declaration into served pages?** Out of scope here, but v1 is inert until some number of Projects actually declare one. Is that a pjangler recipe, a per-project template change, or manual? **Sequencing risk on the critical path, not a design risk** — it gates every success metric in §11.
5. **CLOSED — yes, and the framing below was wrong.** `normalizeProjectId(manifest.project_id ?? manifest.project_slug)`: `project_slug` is a live legacy *alias* for the same field, so neither name is "wrong". The real defect is a **name collision** — `event-schemas.md` defines `project_id` as the provider board UUID while pjangler's `project_id` is a slug, so a Bridge reading the manifest and emitting per that contract writes a slug where a UUID is expected. Call the pjangler-sourced field `pjid`. Also: the pjid is author-controlled text with no UUID behind it, and renaming it deletes and re-keys the row — so anything persisted by pjid orphans silently. Original question: **Is `.project.json`'s `project_id` the pjid?** It was renamed from `project_slug` on 2026-09-17, and `_bmad/custom/workflows/ticket-lifecycle/data/event-schemas.md` still reads `slug` from `project_slug`, so one of the two is now wrong. If `project_id` *is* the pjid, this is not incidental — it is the join key FR-2 resolves on, and the Bridge reads the same file. Resolve the name before the Bridge is written.
6. **Is the element-picker payload enough for the PM to act without seeing the page?** Affects §9 only. FR-10's URL-and-title context is the v1 floor.
7. **DOWNGRADED 2026-09-20 — from a discovery to a confirmation.** *(The paragraph below was substantially wrong and is corrected here rather than deleted, because the correction is the useful part. Full sourcing in `addendum.md` §C and `../../ux-designs/ux-sidepiece-2026-09-20/.working/research-mv3-platform.md` §6.)* Four errors: **Local Network Access shipped in Chrome 142** (29 September 2025), not 153 — it has been live across this whole fleet for nearly a year without incident; **`100.64.0.0/10` does not sit "awkwardly" in the taxonomy**, the WICG spec classifies CGNAT explicitly as `local`; **extensions with host permissions are stated to be exempt** — Chrome's Patrick Kettner, verbatim, *"as long as an extension has the correct host permissions, then they will not be impacted by this"*, with the two bugs that once broke that guarantee fixed by Chrome 144 and this tailnet spanning 151–155; and **HTTPS is a precondition for *asking*, not an exemption from asking**, so a real certificate never bought what Q8 hoped it did. Chrome 146+ additionally splits the permission into "Local Network" and "Loopback Network" and extends the model to WebSockets, WebTransport and WebRTC — irrelevant while the only socket is server-to-server. **The question stands, its expected answer has flipped:** run it once on `carries-macbook-air` (macOS) before the transport is locked, because a result from another node does not transfer — but expect **no prompt at all**, and treat a prompt as the surprise rather than the base case. *Original text: "Note Chrome 153+ ships Local Network Access… Are extension-context requests to a tailnet address subject to Private Network Access preflight enforcement? Undocumented, and less certain than the loopback case because `100.64.0.0/10` sits awkwardly in PNA's address-space taxonomy."*
8. **CLOSED 2026-09-20 — no for LNA, yes for the older mixed-content class, and do it anyway.** A certificate does not sidestep Q7: *"the ability to request this permission is restricted to secure contexts"* means HTTPS is what lets Chrome **ask**, not what stops it asking. It does clear the older mixed-content class — which is in any case already exempted for known local destinations — and Tailscale issues a MagicDNS certificate for free. So serve over HTTPS, but for ordinary reasons rather than as a PNA mitigation, and do not let it be mistaken for having closed Q7. Original question: **Does serving the Bridge over HTTPS with a real certificate remove the PNA problem entirely?**

## 13. Assumptions Index

- §2.2 — Single-operator assumption is permanent; the design may take shortcuts expensive to reverse.
- §4.1 FR-1 — The pjid declaration is readable from served HTML without executing page JS.
- §4.1 FR-3 — The dangling `role_dir` state earns its own message because it already occurs in this repo.
- §4.1 FR-5 — v1 states the provisioning command; it does not run it.
- §4.1 FR-5 — A declared Agent may not be a running one; Sidepiece's own PM is declared but not fleet-registered.
- §4.2 FR-6 — An explicit classification rule plus a visible override beats a perfect classifier.
- §5 — Concurrent multi-window use is rare enough that per-window independence is acceptable.
- §5 — Sidepiece stays a personally-loaded extension, which is what makes the broad host permission acceptable.
- §7 — pjid is a hard requirement with no URL fallback; emitting the declaration is out of scope.
- §9 — Element-picker payload carries context alongside the selector, not a bare selector.

**Verified, no longer assumptions** *(confirmed against the MV3 capability research in `addendum.md` §D)*: service worker idle termination forcing streams into the panel document; the user-gesture requirement and its synchronous-call constraint; per-tab panel scoping and panel-document persistence across tab switches; `captureVisibleTab` viewport-only capture; the side panel being per-window.
