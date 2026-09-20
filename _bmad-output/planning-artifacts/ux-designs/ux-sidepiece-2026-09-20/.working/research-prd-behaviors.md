---
title: "Research — PRD-forced UX behaviors"
run: ux-sidepiece-2026-09-20
phase: Discovery
status: facts-only
created: 2026-09-20
---

# Research: what the PRD forces the Cockpit to do

**Discovery artifact. Facts and verbatim quotes only — no design solutions, no
directions, no visual choices.** Every claim below is traceable to a line in one
of the two sources. Where a doc is silent, this note says **silent** and that is
reported as a finding, not filled in.

## Sources read in full

| Path | Lines | Read |
|---|---|---|
| `/home/delorenj/code/sidepiece/_bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/prd.md` | 413 | full |
| `/home/delorenj/code/sidepiece/_bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/.decision-log.md` | — | full |

Consulted for the §9 failure modes and the persistence matrix only (the PRD
points at it by name for the MV3 facts):

| Path | Section | Read |
|---|---|---|
| `.../prd-sidepiece-2026-09-17/addendum.md` | §C Chrome MV3 constraints (lines 170–290) | full |

Glossary discipline observed throughout: **Cockpit, Turn, Streamed Exchange,
Dispatched Command, Project, Project Record, pjid, Bridge, Board, Ticket, Agent,
PM, Registry, Bloodbank, Candystore, Tailnet** are used verbatim and never
paraphrased. PRD §3 opens: *"Downstream workflows use these terms exactly.
Introducing a synonym anywhere is a discipline violation."*

---

## 1. The state taxonomy

### 1.1 FR-3's six — authoritative, quoted exactly

FR-3 is titled **"Report the unresolved and degraded states honestly"** and
declares itself the single enumeration:

> "FR-3 is the single authoritative enumeration of states in which the Cockpit
> cannot fully function. Other FRs reference it rather than restating their own
> lists."

Its first consequence carries the six, in one sentence:

> "Each of the following is **separately rendered and separately worded**: no
> pjid declared; pjid declared but unknown to the Registry; Bridge unreachable;
> Bridge reachable but unhealthy, named by which dependency failed (per FR-14);
> Registry readable but the Project's clone path missing on disk; an Agent
> binding whose `role_dir` does not exist."

§8.1 confirms the count as a scope line: *"Distinguish all six unresolved and
degraded states honestly (FR-3)."*

| # | State (verbatim) | Required wording obligation | Re-resolve control | What the docs say each pane does |
|---|---|---|---|---|
| S1 | "no pjid declared" | Must be **worded differently** from S2 — FR-2: *"worded differently from 'no pjid declared' — the two have different causes and different fixes."* | Yes (FR-3: *"Every failure state carries a re-resolve control (per FR-2)."*) | **Silent** on per-pane behavior. FR-1 adds only: *"A page declaring no `pjid` yields the unrecognized state, never a stale previous Project."* |
| S2 | "pjid declared but unknown to the Registry" | FR-2 names it a *"distinct 'declared but unknown' state"* | Yes | **Silent** |
| S3 | "Bridge unreachable" | *"The Bridge-unreachable state distinguishes 'laptop is off the tailnet' from '`big-chungus` is not answering' where the two are distinguishable, since the fixes differ."* | Yes | UJ-3: *"if the Bridge is unreachable — laptop off the tailnet, or `big-chungus` down — **every pane says so with one shared message rather than each failing in its own way**."* §6: *"Total. Every pane renders Bridge-unreachable."* |
| S4 | "Bridge reachable but unhealthy, named by which dependency failed (per FR-14)" | FR-14: *"An unhealthy Bridge reports **which downstream dependency is failing — Registry, Plane, Bloodbank, or Agent gateway** — rather than a generic error."* Plus: *"Health distinguishes 'the pjangler registry service is not running' from 'the Registry returned an error', because the former has a different fix."* Plus FR-16: *"A failed credential resolution surfaces as an unhealthy dependency in FR-14, naming which one."* | Yes | Per-dependency blast radius is fully specified in §6 — see §1.3 below. |
| S5 | "Registry readable but the Project's clone path missing on disk" | separate wording | Yes | **Silent.** Note FR-4 still requires the clone path be *displayed and selectable*; the docs do not say how a missing path renders in the identity pane. |
| S6 | "an Agent binding whose `role_dir` does not exist" | separate wording | Yes | **Silent on panes**, but §13/FR-3 justify it: *"the dangling role_dir state is worth its own message because it already occurs — .project.json binds sidepiece-scrum-master to agents/hermes/scrum-master, which does not exist in this repo."* |

FR-2 makes the re-resolve control a cache requirement, not a courtesy:

> "Resolution results are cached per pjid and the cache is explicitly bounded: it
> expires on a stated TTL, is invalidated when Bridge health transitions from
> unreachable to reachable, and **every FR-3 failure state offers a re-resolve
> control**. An unbounded 'cached for the panel session' is not acceptable — it
> makes FR-3's stale states unreachable."

### 1.2 FINDING — the Cockpit's real state count is larger than six

FR-3 claims to be "the single authoritative enumeration" but **two degraded
states that gate whole panes live outside it**:

- **FR-5's middle state** — *"a PM declared but not present in the Hermes fleet
  registry or not reachable"*. FR-5 explicitly says *"Three states are
  distinguished, not two"*, and only the third of the six (S6, dangling
  `role_dir`) overlaps. FR-5 state 1 (no PM declared) and state 2 (declared but
  not running) are **not in FR-3's list**.
- **FR-12's no-Board state** — *"A Project with no Board binding renders the
  Tickets pane as unavailable with the reason stated"*. Not in FR-3's list.

Both are called out as real, not hypothetical: FR-5 — *"Sidepiece's own
.project.json declares sidepiece-pm, which does not appear in the Hermes fleet
registry."* FR-12 — *"Four of the nineteen registered Projects have no board —
`codegraph-voyage`, `legofirst`, `momo`, `vinyl`."*

### 1.3 Every other state the PRD forces, by origin

| State | Source | Verbatim obligation |
|---|---|---|
| **Fully resolved and healthy** | FR-4, FR-5 | Only state in which chat is enabled: *"Chat is enabled only in the third state."* |
| **Loading / resolving** | FR-3, §5 | Not named, but bounded from both sides: *"No failure state renders as an empty or loading panel"* and *"No pane may render a failure as an empty state or a permanent spinner."* The **wording and form of a legitimate in-flight state is silent.** |
| **Timeout (per budget)** | §5, FR-12 | *"Missing a budget renders a timeout state, never an indefinite pending one."* FR-12: *"Board reads complete within the §5 budget, or render a timeout state."* |
| **Degraded connection (DERP relay)** | §5 | *"Budgets are explicitly **not** guaranteed when the tailnet falls back to a DERP relay; that case renders a **degraded-connection indicator** rather than silently missing the budget."* |
| **No PM declared** | FR-5 | *"The no-PM-declared state names the exact provisioning command."* `[ASSUMPTION: v1 states the command; it does not run it.]` |
| **PM declared but not running/reachable** | FR-5 | *"The first two disable it with their own distinct reason."* §6: *"Renders as agent-unreachable, distinct from no-agent-declared (FR-5)."* |
| **No Board bound** | FR-12 | *"renders the Tickets pane as unavailable with the reason stated (distinct from an empty Board and distinct from a failed fetch), **names the command that binds one**, and **disables create rather than failing it**. Chat stays fully usable."* |
| **Empty Board** | FR-12 | *"An empty Board renders as empty, distinct from both of the above."* |
| **Failed Board fetch** | FR-12 | third of the three distinct ticket-pane failure modes |
| **Turn accepted** | FR-7 | *"The turn is **accepted** within 500ms — a visible **'the PM has your turn'** state, distinct from a response."* |
| **Warming up the PM (cold session)** | FR-7 | *"A cold session carries no first-token budget and renders an explicit **'warming up the PM'** state instead."* |
| **Streaming / partial output** | FR-7 | *"Partial output is visible while generating; the panel never shows only a spinner for a response in progress."* |
| **Stream death** | FR-7 | *"A stream that dies mid-response is **reported as failed, not left indefinitely pending**."* |
| **Dispatched (acknowledged)** | FR-8 | *"A dispatched Turn produces a visible acknowledgement carrying a **correlation identifier** within the §5 budget"* and *"The Turn is rendered as dispatched, visibly distinct from a Streamed Exchange."* |
| **Dispatch rejected** | FR-8 | *"A rejected or unpublishable command surfaces the rejection, never silent success."* |
| **Dispatch terminal status** | FR-9 | *"Each dispatched Turn shows a terminal status — **completed, failed, or timed out** — once the corresponding outcome is observable."* |
| **Dispatch completed WITH result content** | FR-9 | *"A completed Dispatched Command renders its **result content** in the Turn, not only its status."* |
| **Dispatch unknown** | FR-9 | *"A dispatch with no observed outcome within a configured window is **shown as unknown, not as success**, and the window is long enough that ordinary agent work does not routinely trip it."* |
| **Ticket create failure** | FR-13 | *"On failure, the entered text is preserved and the error is shown."* |
| **Tab is resolvable (OUTSIDE the panel)** | §5 | *"Sidepiece therefore cannot auto-open on detection; **the extension icon carries the 'this tab is resolvable' signal** so opening it is an informed click."* |

### 1.4 FINDING — a documented tension in failure presentation

§5 Failure posture: *"**Every pane fails independently and says why.** A dead
Bloodbank must not take down tickets; an unreachable Plane must not take down
chat."*

UJ-3 edge case: Bridge unreachable → *"**every pane says so with one shared
message** rather than each failing in its own way."*

These are not contradictory once read as scoped (total outage = one shared
message; partial outage = independent per-pane messages), but the PRD never
states that reconciliation explicitly. It is a UX decision that has to be made,
not read off.

### 1.5 Per-dependency blast radius (§6 table, verbatim "On failure" column)

| Dependency | On failure |
|---|---|
| Tailnet (`burro-salmon.ts.net`) | "Total. Every pane renders Bridge-unreachable. The most likely real-world outage — a laptop off the tailnet." |
| pjangler Registry | "Total. Nothing resolves; the Cockpit cannot open." |
| Plane (via the `33god` workspace) | "Tickets pane only. Chat and resolution unaffected." |
| Hermes PM gateway | "Chat pane only. Renders as agent-unreachable, distinct from no-agent-declared (FR-5)." |
| Bloodbank | "Dispatch only. Streaming chat still works." |
| Candystore | "Outcomes show as unknown; dispatch still succeeds." |
| 1Password (`DeLoSecrets`) | "Bridge starts unhealthy and says which credential failed." |

---

## 2. FR-by-FR: what each one forces the UI to do

| FR | Title | UI obligations forced (behavioral) | Forbidden |
|---|---|---|---|
| **FR-1** | Detect a declared pjid on the active tab | Detect within 500ms of navigation completing. Re-detect on SPA history transitions. Re-evaluate on browser **tab switch**, with the panel document **"updated in place rather than reloaded"**. Re-resolve when a page's declared pjid changes without a navigation. Works on any origin, "including one never seen before". | Showing "a stale previous Project" when no pjid is declared. Relying on a declarative content script alone for SPA. |
| **FR-2** | Resolve a pjid to a Project Record | Produce repo name, local clone path, Board binding, Agent bindings. Distinct "declared but unknown" state. Per-pjid cache with stated TTL; cache invalidated on Bridge unreachable→reachable. **Re-resolve control on every FR-3 failure state.** Every resolution stamped with a monotonic generation number. | An unbounded "cached for the panel session". |
| **FR-3** | Report the unresolved and degraded states honestly | Six separately rendered, separately worded states (§1.1). Bridge-unreachable splits tailnet-vs-host where distinguishable. Re-resolve control everywhere. | **"No failure state renders as an empty or loading panel."** |
| **FR-4** | Display the resolved identity | "Repo name, local clone path, and **Board identifier** are visible whenever a Project is resolved, **without opening a menu or a detail view**." "The local clone path is **selectable as text** so it can be copied into a terminal." Identity changes **in the same frame** as the rest of the Cockpit. | "never one pane showing a Project the others have moved on from." Hiding identity behind disclosure. |
| **FR-5** | Surface Agent presence, declared vs running | Three distinct Agent states, not two. Chat enabled **only** in the reachable state; the other two "disable it with their own distinct reason". No-PM state "names the exact provisioning command". | "Neither degraded Agent state disables the Tickets pane." Writing to the Registry; creating/editing/removing Projects; cloning a missing repo (§4.1 Out of Scope). Running the provisioning command in v1. |
| **FR-6** | Classify a Turn as Streamed Exchange or Dispatched Command | See §3 below — classification visible on the composer pre-commit, one control flips it, override lasts one Turn. | Applying an override "implicitly to later Turns". |
| **FR-7** | Streamed Exchange | Accepted ≤500ms with a visible "the PM has your turn" state **distinct from a response**. First content token ≤8s p95 warm. Cold → explicit "warming up the PM". Partial output visible while generating. Completed answer retrievable after close/reopen mid-stream. Stream death reported as failed. | "A decorative placeholder frame does not count as a first token… rendering that as the answer would be measuring an animation." "the panel never shows only a spinner for a response in progress." Panel document as system of record. |
| **FR-8** | Dispatched Command | Visible acknowledgement carrying a **correlation identifier** within budget. Turn "rendered as dispatched, **visibly distinct from a Streamed Exchange**". Rejection surfaced. Five-token subject validated before publish. | "never silent success." |
| **FR-9** | Dispatched Command outcome and result | Terminal status (completed / failed / timed out). **Result content rendered in the Turn, not only status.** Outcomes correlated "by identifier, not by ordering or recency". Unknown state after a configured window. "Outcomes arriving while the panel is closed are reconciled on next open." | Showing an unobserved dispatch "as success". Correlating by recency. |
| **FR-10** | Turns carry page context | "Every Turn carries the active tab's **URL and page title** alongside the operator's text." "**The operator can see what context is attached before sending.**" Context survives classification — both branches carry it. | (none stated) |
| **FR-11** | Per-Project conversation continuity | Reopening on the same Project restores that Project's prior Turns. History survives **Chrome restart** and **service worker termination**. History **appended per Turn**, not rewritten wholesale, so two Cockpits cannot clobber each other. | "Two Projects never share history." |
| **FR-12** | List Tickets grouped by state | Grouped by Board state, **"in the Board's own state order, not alphabetically"**. Each Ticket shows **human key, title, and state**. Each Ticket links to its Plane URL, **"opening in a new tab"**. List fetched fresh on resolution. A **user-initiated refetch** control. Three distinct ticket-pane degradations: no-Board / empty / failed fetch. No-Board disables create and names the binding command. | Alphabetical grouping. Serving "from a prior Project's cache". Failing create instead of disabling it. Taking chat down with the Board. |
| **FR-13** | Create a Ticket | Create with **title alone**. Description and target state optional; omitted state uses "the Board's default entry state". On success the new Ticket "appears in the list without a manual refresh". On failure, entered text preserved + error shown. | **"the Board is never chosen by the user."** Editing, moving between states, assigning, labelling, commenting, deleting (§4.3 Out of Scope). |
| **FR-14** | Bridge health observable from the Cockpit | Three Bridge states surfaced (reachable / unreachable / reachable-but-unhealthy). Unhealthy **names the failing dependency** from {Registry, Plane, Bloodbank, Agent gateway}. Distinguishes "registry service is not running" from "Registry returned an error". **Reports whether the PM's provider credentials actually resolved.** | "a generic error." Reporting reachability as health — *"Silent degradation is the failure mode most worth a health state, because nothing else will ever report it."* |
| **FR-15** | Bridge lifecycle, binding, Turn state | UI-visible consequence: "Restarting the Bridge does not require reloading the extension." Bridge holds Turn state keyed by pjid and Turn id — this is what makes FR-7 reopen and FR-9 closed-panel reconciliation possible. | Binding `0.0.0.0`; a loopback-only bind with nothing fronting it. |
| **FR-16** | Credentials resolve from the vault | UI-visible consequence only: "A failed credential resolution surfaces as an unhealthy dependency in FR-14, naming which one." | No credential written to a file in the repo, "including files intended to be gitignored". |

---

## 3. The Turn classifier (FR-6) — exact obligations

Header framing: *"The split is the feature, so the classifier is a requirement
rather than an implementation note. It needs a stated rule, a stated bias, and
an escape hatch."*

| Obligation | Verbatim |
|---|---|
| When classification happens | "Every Turn is classified **before send**, by a rule specific enough that the same Turn always classifies the same way." |
| Where it must appear | "The classification is **visible on the composer before the operator commits**, and **one control flips it**." |
| The bias | "The classifier **biases toward Dispatched Command when uncertain**." |
| Test-case corpus | "Three example Turns per branch are specified and used as test cases — at minimum **'what's in progress?'** and **'summarize the board'** classify as Streamed Exchange; **'start on the resolver ticket'** and **'fix the failing test'** classify as Dispatched Command." |
| Override lifetime | "A manual override is remembered for the **remainder of that Turn only, never applied implicitly to later Turns**." |
| What is left to architecture | `[ASSUMPTION: an explicit rule plus a visible override beats a perfect classifier. The rule's exact form — verb allowlist, LLM pre-pass, or mode toggle — is an architecture decision; that a rule exists and is overridable is a product requirement.]` |

**Cross-dependency the UX must respect:** FR-9 justifies the dispatch bias —
*"Without this, a misclassified question is a dead end on the classifier's
preferred failure side, and FR-6's bias toward dispatch is unjustified."* The
bias is only safe because dispatched results render their content.

**Silent:** the PRD never dictates the *label text* for either classification,
the affordance of the flip control, or whether classification re-runs as the
operator keeps typing.

---

## 4. Latency budgets as UX-visible thresholds

§5, verbatim: *"Detection ≤500ms (local to the browser, unaffected by the
network). Resolution ≤1s p95 (measured at 2.4ms p50 locally — roughly two orders
of magnitude of headroom). Board read ≤2s p95. Dispatch acknowledgement ≤2s.
Chat is **two** budgets, not one: turn accepted ≤500ms, and first content token
≤8s p95 warm with no budget cold."*

| Threshold | Budget | Measured | What the user must see |
|---|---|---|---|
| Detection | ≤500ms | — (local to the browser) | FR-1: a page declaring a pjid "is detected within 500ms of navigation completing". Nothing is stated about a detection-in-flight indicator — **silent**. |
| Resolution | ≤1s p95 | 2.4ms p50 locally | Headroom is ~2 orders of magnitude. Practical consequence: a resolution spinner will almost never be seen on-LAN — but §5 still forbids a permanent one. |
| Board read | ≤2s p95 | — | "or render a timeout state" (FR-12). |
| Dispatch acknowledgement | ≤2s | — | Acknowledgement "carrying a correlation identifier within the §5 budget" (FR-8). |
| **Turn accepted** | ≤500ms | **79ms** against the live gateway | *"this is the promise that actually kills the feeling of a hang."* Requires a state "distinct from a response". |
| **First content token, warm** | ≤8s p95 | **3.8–5.1s** | Must be a real token. *"A decorative placeholder frame does not count as a first token."* |
| **First content token, cold** | **no budget** | **7.1–17.1s** | *"renders an explicit 'warming up the PM' state instead."* This is the single longest wait in the product and the one state that exists purely to cover it. |
| Any budget missed | — | — | *"Missing a budget renders a timeout state, never an indefinite pending one."* |
| DERP relay fallback | budgets void | — | *"renders a degraded-connection indicator rather than silently missing the budget."* |

Scope of the measurements: *"These are end-to-end from the laptop and must hold
with the laptop on the same LAN as `big-chungus`."*

Historical correction worth carrying: *"The single ≤2s first-token figure in
earlier drafts was aspirational and is unachievable on this hardware."* FR-7
repeats it: *"token-level streaming exists and is genuine, but 2s was never
achievable by any mechanism on this hardware."*

---

## 5. Component patterns (behavioral) — per pane

### 5.1 Identity pane

| Property | Requirement |
|---|---|
| Always visible | Repo name, local clone path, Board identifier — "whenever a Project is resolved, without opening a menu or a detail view" (FR-4). |
| Selectable text | **Local clone path** — "selectable as text so it can be copied into a terminal" (FR-4). Nothing else is named as selectable. |
| Refresh | Re-resolve control required in every failure state (FR-2, FR-3). |
| Atomicity | "When the resolved Project changes, the displayed identity changes **in the same frame as the rest of the Cockpit**" (FR-4). |
| Why it exists | "without it FR-2's output is invisible and SM-3 is unobservable" (FR-4). |
| Also shown here? | **Silent** — the PRD never says which pane hosts Bridge health, the degraded-connection indicator, or the Agent-presence state. |

### 5.2 Chat pane

| Property | Requirement |
|---|---|
| Enabled only when | PM "declared, present, and reachable" (FR-5). |
| Composer must show pre-send | (a) the Turn's classification (FR-6), (b) the attached page context — URL and title (FR-10). |
| Turn rendering | Streamed Exchange and Dispatched Command must be "visibly distinct" (FR-8). |
| Persists across panel close | Prior Turns for that Project (FR-11); the **completed answer** of a mid-stream Turn (FR-7). |
| Does NOT persist | **Partial tokens** — "Partial tokens are best-effort and may be lost; the answer is not" (FR-7). |
| Persists across Chrome restart / SW death | Yes — FR-11: "History survives a Chrome restart and an extension service worker termination." |
| Write model | "History is **appended per Turn** rather than rewritten wholesale, so two Cockpits on the same Project cannot clobber each other" (FR-11). |
| Scoping | "Two Projects never share history" (FR-11). |
| Reconciliation on open | "Outcomes arriving while the panel is closed are reconciled on next open" (FR-9). |
| Out of scope | Chatting with any Agent other than the PM. Multi-turn tool approval flows. Attaching files. Sending page *body* content or screenshots (§4.2 Out of Scope). |

### 5.3 Tickets pane

| Property | Requirement |
|---|---|
| Grouping & order | "grouped by Board state, **in the Board's own state order, not alphabetically**" (FR-12). |
| Per-Ticket fields | "human key, title, and state" (FR-12). Nothing else is required. |
| Link behavior | "Each Ticket links to its Plane URL, **opening in a new tab**" (FR-12). |
| Refresh | Fetched fresh on Project resolution; **plus a user-initiated refetch** (FR-12). |
| Create | Title alone sufficient; description + target state optional; default entry state on omission (FR-13). |
| Post-create | "the new Ticket appears in the list **without a manual refresh**" (FR-13). |
| Create failure | "the entered text is preserved and the error is shown" (FR-13). |
| Board selection | Never by the user (FR-13). |
| Survives Agent failure | Yes — "Neither degraded Agent state disables the Tickets pane" (FR-5). |
| Data-shape trap the UI inherits | FR-12: *"The field is an **empty string**, never null and never absent, so the check must be for truthiness; `!= null` or a key-presence test reports a board for all four and renders the pane against an empty id."* |

### 5.4 Panel shell / lifetime (§5 + addendum §C)

| Property | Requirement |
|---|---|
| Opening | Cannot auto-open. "Chrome requires a genuine user gesture… the open call must be the first synchronous call in the gesture handler — anything awaited first **silently no-ops with no error**." |
| Pre-open signal | "the extension icon carries the **'this tab is resolvable'** signal so opening it is an informed click." |
| Survives tab switch | Yes — "The panel document stays alive across tab switches while open, so in-panel state survives navigation." FR-1 adds: the panel document is "updated in place rather than reloaded". |
| Survives panel close | **No** — "it does not survive the panel closing. Anything that must outlive it is held by the Bridge (FR-15), not persisted client-side." |
| Long-lived connections | "All long-lived connections — chat streams, event subscriptions — live in the panel document, never in the extension service worker, which is terminated after roughly 30s idle." |
| Multiple windows | Per-window Cockpits with "independent caches and independent resolution state". "v1 does not attempt to synchronize them: each is independently correct for its own window." |
| Correctness guard | "every mutating call carries `(pjid, generation)`, and both the panel and the Bridge refuse a mutation whose generation is stale… **A confidently wrong ticket is worse than a failed one.**" |

**Silent** on: panel width, pane ordering, pane collapse/expand, scroll behavior,
whether panes are tabs or stacked, timestamps, pagination, ticket search/filter,
whether the description field accepts markdown, keyboard shortcuts of any kind.

---

## 6. Microcopy obligations — every place the PRD dictates what must be *said*

These are the raw material for EXPERIENCE.md's Voice and Tone section. Quoted
verbatim; the PRD dictates **that** something is said and often **what fact** it
must contain, but **never the sentence itself**.

**Distinctness of wording**
1. FR-3: *"Each of the following is separately rendered and **separately worded**"* (the six).
2. FR-2: *"produces a distinct 'declared but unknown' state, **worded differently from** 'no pjid declared' — the two have different causes and different fixes."*
3. FR-12: *"with the reason stated (**distinct from** an empty Board and **distinct from** a failed fetch)"*.
4. FR-5: *"The first two disable it with **their own distinct reason**."*
5. §6: agent-unreachable is *"**distinct from** no-agent-declared (FR-5)"*.

**Naming a specific cause**
6. FR-3 / FR-14: *"**named by which dependency failed**"* / *"**reports which downstream dependency is failing** — Registry, Plane, Bloodbank, or Agent gateway — rather than a generic error."*
7. FR-14: *"Health **distinguishes** 'the pjangler registry service is not running' from 'the Registry returned an error', because the former has a different fix."*
8. FR-16: *"A failed credential resolution surfaces as an unhealthy dependency in FR-14, **naming which one**."*
9. FR-3: *"distinguishes '**laptop is off the tailnet**' from '**`big-chungus` is not answering**' where the two are distinguishable, since the fixes differ."*
10. §6: 1Password failure → *"Bridge starts unhealthy and **says which credential failed**."*

**Naming a remedy command**
11. FR-5: *"The no-PM-declared state **names the exact provisioning command**."*
12. FR-12: *"**names the command that binds one**"* (a Board).
13. UJ-3: *"he's **told the exact command** to provision one."*

**Fixed phrases the PRD itself puts in quotes** (candidate literal strings)
14. FR-7: *"a visible **'the PM has your turn'** state, distinct from a response."*
15. FR-7: *"renders an explicit **'warming up the PM'** state instead."*
16. §5: *"the extension icon carries the **'this tab is resolvable'** signal"*.
17. FR-2: the **"declared but unknown"** state.
18. §5: a **"degraded-connection indicator"**.

**Honesty obligations (say the true thing, not the flattering one)**
19. FR-3 title: *"Report the unresolved and degraded states **honestly**."*
20. §5: *"Every pane fails independently and **says why**."*
21. FR-8: *"surfaces the rejection, **never silent success**."*
22. FR-9: *"shown as **unknown, not as success**."*
23. FR-7: *"**reported as failed**, not left indefinitely pending."*
24. UJ-2: *"Sidepiece classifies that as work, dispatches it, **says so**, and later shows the result in the same thread rather than only a green checkmark."*
25. UJ-3: *"Chat is **visibly unavailable with the reason stated**."*
26. UJ-3: *"every pane **says so with one shared message** rather than each failing in its own way."*
27. FR-13: *"the entered text is preserved and **the error is shown**."*
28. FR-14: *"**Silent degradation is the failure mode most worth a health state**, because nothing else will ever report it."*

**Vocabulary discipline**
29. §3: *"Downstream workflows use these terms exactly. **Introducing a synonym anywhere is a discipline violation.**"*

---

## 7. What the PRD forbids the UI from doing

| # | Prohibition | Source |
|---|---|---|
| P1 | "**No failure state renders as an empty or loading panel.**" | FR-3 |
| P2 | "**No pane may render a failure as an empty state or a permanent spinner.**" | §5 Failure posture |
| P3 | "the panel **never shows only a spinner** for a response in progress." | FR-7 |
| P4 | "A **decorative placeholder frame does not count as a first token**… rendering that as the answer would be measuring an animation." (the gateway's `thinking.delta` spinner text) | FR-7 |
| P5 | "**Missing a budget renders a timeout state, never an indefinite pending one.**" | §5 |
| P6 | "**the Board is never chosen by the user.**" | FR-13 |
| P7 | "grouped by Board state, in the Board's own state order, **not alphabetically**." | FR-12 |
| P8 | "Outcomes are correlated back to the originating Turn **by identifier, not by ordering or recency**." | FR-9 |
| P9 | A dispatch with no observed outcome is "**not** … success". | FR-9 |
| P10 | "A page declaring no `pjid` yields the unrecognized state, **never a stale previous Project**." | FR-1 |
| P11 | "**never one pane showing a Project the others have moved on from**." | FR-4 |
| P12 | Identity must be visible "**without opening a menu or a detail view**." | FR-4 |
| P13 | "The list is fetched fresh on Project resolution, **not served from a prior Project's cache**." | FR-12 |
| P14 | A manual classifier override is "**never applied implicitly to later Turns**." | FR-6 |
| P15 | "**Two Projects never share history.**" | FR-11 |
| P16 | "**Introducing a synonym anywhere is a discipline violation.**" | §3 |
| P17 | "**bmad-ux should not reintroduce density as a goal** on the strength of the braindump alone." | §1 `[NOTE FOR PM]` |
| P18 | "Sidepiece therefore **cannot auto-open on detection**." | §5 |
| P19 | No-Board must "**disable create rather than failing it**." | FR-12 |
| P20 | "Neither degraded Agent state **disables the Tickets pane**." | FR-5 |
| P21 | Tickets: no editing, moving between states, assigning, labelling, commenting, or deleting. | §4.3 Out of Scope |
| P22 | Chat: no other Agent than the PM; no multi-turn tool approval flows; no file attachment; no page *body* content or screenshots. | §4.2 Out of Scope |
| P23 | Resolution: never inferred from "a URL, a hostname, or a Traefik route"; "no hostname heuristic, no Traefik route import, and no fuzzy matching." | §4.1, §7 |
| P24 | Writing to the Registry; creating, editing or removing Projects; cloning a missing repo. | §4.1 Out of Scope |
| P25 | "An unbounded 'cached for the panel session' is **not acceptable**." | FR-2 |
| P26 | "the panel document **cannot be the system of record**." | FR-7 |
| P27 | Not a replacement for the terminal — "It closes the gap between *noticing* and *acting*, not between *thinking* and *building*." | §7 |

### 7.1 The density directive, in full

PRD §1, verbatim:

> `[NOTE FOR PM: BRAINDUMP.md frames the value as density instead — "a live
> project cockpit: current URL, local repo, agent, tickets, screenshots, and
> repo-specific operational messages all in one place." That framing was
> considered and deliberately overridden on 2026-09-17; **the cockpit is a means,
> not the thesis. bmad-ux should not reintroduce density as a goal on the
> strength of the braindump alone.**]`

The counter-metric that enforces it, §11 SM-C1, verbatim:

> "**SM-C1:** Panel open time. If I'm *living* in the panel rather than dipping
> into it, the loop got heavier, not lighter. Counterbalances SM-1. Confirmed
> deliberate on 2026-09-17 against the braindump's density framing — see §1."

And SM-C2: *"Feature count. This died once already at 44 tickets and zero code.
Shipping §8 and stopping beats shipping §9 late."*

The decision log records this as a formally escalated and resolved blocker:

> "**Blocker 1 — thesis: RESOLVED, my framing stands** … **User's call: exact
> resolution is the thesis.** The cockpit is a means. Dipping in beats living in
> it, so SM-C1 stands as written. Recorded here explicitly: the braindump's
> density framing was **deliberately overridden**, not lost."

---

## 8. §9 Deferred scope — verbatim, with named failure modes

### 8.1 Element picker — quoted in full

> "**Element picker — the primary annotation mechanism.** Hover-to-select a DOM
> element; send a stable CSS selector *plus* context — tag, text snippet,
> `outerHTML`, page URL. `BRAINDUMP.md` states this as a **replacement** for
> screenshots, not a peer: 'Instead of passing screenshots, I can pass unique
> selectors.' Build this first and treat snapshot as the fallback for cases a
> selector cannot express, not the other way round. `[ASSUMPTION: a bare selector
> is useless to an agent that cannot see the page, so context is part of the
> payload, not an enhancement.]` Known failure modes: hashed CSS-in-JS class
> names, `nth-child` brittleness under re-render, shadow DOM."

**Payload shape (v2, as specified):** stable CSS selector + tag + text snippet +
`outerHTML` + page URL. **No image.**

### 8.2 Snapshot and annotate — quoted in full

> "**Snapshot and annotate — the fallback.** Capture the visible viewport, draw
> on it, attach to a Turn. Constrained by `captureVisibleTab`: visible viewport
> only, not full-page, and rate-limited."

### 8.3 Attachment to Tickets — quoted in full

> "**Attachment to Tickets, not only Turns.** `BRAINDUMP.md`'s open question is
> what payload shape annotations use 'when they are attached to agent messages
> **or tickets**.' The ticket destination is deferred with the annotation
> features, not dropped — FR-13 gains an attachment surface when they land."

### 8.4 Named failure modes, consolidated

| Failure mode | Source | Detail |
|---|---|---|
| Hashed CSS-in-JS class names | §9 + addendum §C | "framework-hashed and utility class names churn on every rebuild" |
| `nth-child` brittleness | §9 + addendum §C | "`nth-child` and structural selectors break when sibling count or order changes" |
| Shadow DOM | §9 + addendum §C | "Shadow DOM and iframes need special-casing because `querySelector` crosses neither boundary" |
| `captureVisibleTab` viewport-only | §9 + addendum §C + §13 verified | "visible viewport only, not full-page". Full-page needs scroll-and-stitch or `chrome.debugger` + CDP, "which needs the `debugger` permission and its alarming 'debug your browser' warning" |
| `captureVisibleTab` rate limits | §9 + addendum §C | "a handful of calls per second"; blocked on `chrome://` and other extensions' pages without `activeTab` |

Addendum §C also records the mitigation that shapes the payload:

> "Practical priority: `data-testid` / `data-*` → id → short capped structural
> path, with **fallback text and role stored so a human can re-match a selector
> that went stale after a redeploy**. This is why the deferred element-picker
> payload carries context rather than relying on the selector alone."

Ordering directive, §10 EPIC J: *"**Defer and reorder.** The element picker leads
and snapshot becomes the fallback (§9) — the reverse of this epic's framing."*

Open question that gates the whole mechanism, §12 Q6, verbatim: *"**Is the
element-picker payload enough for the PM to act without seeing the page?**
Affects §9 only. FR-10's URL-and-title context is the v1 floor."*

### 8.5 FINDING — the PRD is silent on four elements of Jarad's narrated journey

Checked by grep across `prd.md` for: `annotation list`, `batch`, `bubble`,
`relative coordinate`, `coordinate` — **zero hits for all five.**

| Narrated beat (UX decision log, 2026-09-20, "The Garbage Man") | PRD status |
|---|---|
| Hover → live border outline of the element under cursor (DevTools-style) | Implied by "Hover-to-select a DOM element". Nearest thing the PRD has. |
| Click element → **comment bubble opens in place**, user types the note | **Silent.** The PRD specifies the payload, never the in-page UI that collects it. |
| Freehand markup delivered as **image + relative coordinates** | **Silent on relative coordinates entirely.** §9 says only "Capture the visible viewport, draw on it, attach to a Turn." |
| **Running list of annotations** accumulated on the page | **Silent.** No such surface appears anywhere in the PRD. |
| **One button** → a Plane ticket per piece of feedback, OR the whole batch to the PM | **Silent.** FR-13 is single-Ticket create only; there is no batch create and no batch-to-PM path. §9 only promises "FR-13 gains an attachment surface when they land." |

This is the central scope fact of this Discovery run: **the north star Jarad
narrated is (a) deferred to v2 in the PRD, and (b) larger than what §9 actually
specifies.** The UX decision log already flagged half of it — *"TENSION: Jarad's
stated UX north star (finger-on-clipboard pointing) is the flagship deferred
feature."* The other half — list + batch discharge + comment bubble + relative
coordinates — is new scope that no PRD sentence covers.

### 8.6 Remaining §9 items (for completeness)

- **Candystore live event feed** — "Project-scoped Bloodbank events, **tailing
  live** rather than a static recent-events list… Implemented as a `data.repo`
  payload filter against Candystore, per §6 — never a subject subscription."
- **Agent-session list** — "Sessions across claude/codex/kimi in
  reverse-chronological order, with live running status. The job is 'is something
  already working on this repo right now?'" `[NOTE FOR PM: … it is the only pane
  that prevents an actual collision. If parallel-agent work increases before v1
  ships, promote it.]`
- **Tray settings page and recent Projects** — "Extension-icon surface listing
  recently active Projects in reverse-chronological order."
- **One-click Agent provisioning** — "Non-interactive `pj hermes-agent` from the
  no-Agent state (FR-5)."
- **Desktop shell (Tauri)** — §8.2, with `[NOTE FOR PM: EPIC K deferred this in
  June and nothing since has argued for it. If it is still deferred at the next
  retrospective, delete it rather than carrying it.]`

---

## 9. §13 Assumptions that constrain UX directly

| Assumption | UX consequence |
|---|---|
| "The pjid declaration is readable from served HTML without executing page JS" — *"it must work on a static page with scripting disabled"* (FR-1) | Detection cannot depend on page runtime; no UX affordance may assume a live JS context on the target page. |
| "v1 states the provisioning command; it does not run it" (FR-5) | The no-PM state is **read-only copy with a command in it**, not an action button. |
| "A declared Agent may not be a running one; Sidepiece's own PM is declared but not fleet-registered" | The degraded middle state will be visible on the very repo being built. |
| "An explicit classification rule plus a visible override beats a perfect classifier" (FR-6) | The override affordance is a product requirement, not a fallback. |
| "Concurrent multi-window use is rare enough that per-window independence is acceptable" (§5) | Two Cockpits may legitimately disagree; no sync indicator is required. |
| "Sidepiece stays a personally-loaded extension" (§5) | The broad host-permission prompt is accepted as a one-time cost; no install-flow UX. |
| "pjid is a hard requirement with no URL fallback" (§7) | The no-pjid state is permanent and common, not transitional. There is no "guess the project" affordance, ever. |
| "Element-picker payload carries context alongside the selector, not a bare selector" (§9) | The picker must gather more than a click. |
| Single-operator assumption is permanent (§2.2) | No accounts, no onboarding, no empty-first-run tutorial implied anywhere. |

---

## 10. Confirmed silences (greenfield for DESIGN.md / EXPERIENCE.md)

Verified by grep across `prd.md` — **zero hits**: `keyboard`, `shortcut`,
`accessib*`, `theme`, `dark`, `color`, `notification`, `badge`, `width`,
`collapse`, `timestamp`, `pagination`, `search`, `markdown`, `bubble`, `batch`,
`coordinate`, `annotation list`.

The PRD is therefore silent on, and does not constrain:
- All visual style: color, typography, spacing, iconography, light/dark theming.
- Keyboard shortcuts and any accessibility target.
- Notifications, badges (except the extension icon's resolvable signal), sound.
- Panel width, pane layout, ordering, collapse, scroll, tab-vs-stack.
- Timestamps, relative time, Turn grouping or threading in chat.
- Ticket list pagination, filtering, sorting-within-group, search, count limits.
- Whether the Ticket description field is plain text or markdown.
- The literal text of every state message (it dictates the fact, never the sentence).
- What a legitimate in-flight/loading state looks like (only what it may not be).
- Where Bridge health, the degraded-connection indicator, and Agent presence are
  rendered — which pane owns them is unstated.
- Undo. Nothing in the PRD mentions undoing a created Ticket or a dispatched Turn.

---

## 11. Open items the PRD itself leaves to a human

Carried forward as decisions only Jarad can make — see `open_questions` in the
returned schema fields.

- §12 Q4 (open): *"**What emits the `pjid` declaration into served pages?** … v1
  is inert until some number of Projects actually declare one."*
- §12 Q6 (open): the element-picker payload sufficiency question (§8.4 above).
- §12 Q1, Q2, Q3, Q5 are marked CLOSED; Q2's closure carries a UX-relevant
  blocker: *"**Result content does not exist.** … FR-9's 'renders its result
  content' is therefore **unbuildable** until the Bloodbank gateway is changed."*
  FR-9's result-content rendering — the thing that justifies FR-6's dispatch bias
  — is blocked on another repo.
