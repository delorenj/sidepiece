# Reconciliation — `docs/product-brief.md` (2026-06-04) against the PRD

Input: `/home/delorenj/code/sidepiece/docs/product-brief.md`
Targets: `prd.md`, `addendum.md` (both 2026-09-17)
Question answered: what substantive idea, constraint, nuance or intention in the
brief appears **nowhere** in either PRD document and was **not** declared out of
scope?

Two supersessions are deliberate and documented (PRD §16 line, addendum §A.1,
§9) and are **excluded from the gap list by instruction**:

- the **resolution model** — Traefik-route/URL matching → page-declared `pjid`;
- the **annotation mechanism** — snapshot+draw → element picker with a context
  payload.

---

## 1. Line-by-line trace

| # | Brief content | Status | Where it lands |
|---|---|---|---|
| 1 | "Personal, project-aware Chrome sidebar" | covered | §1, §2.2 |
| 2 | "**always watching the active tab**" | covered (constrained) | FR-1 detects on every navigation; §5 documents that Chrome forbids auto-open, icon carries the signal |
| 3 | Recognized because served behind Traefik labels | **superseded** | addendum §A.1 |
| 4 | Resolves URL → local repository + project metadata | superseded (mechanism), intent preserved | §1, FR-2 |
| 5 | "**immediate** control surface for that project's agent, ticket board, and operational context" | covered | §5 latency budget; §4.2, §4.3, §9 |
| 6 | Problem: no fast bridge from "thing I'm looking at" to "project that produces it" | covered | §1 |
| 7 | Named targets of that bridge: local clone **on Big Chungus**, Hermes PM, Plane board, Bloodbank stream | partly — see **GAP 2** for the clone; workstation named generically elsewhere | §3 Project Record, §6 |
| 8 | "kills the loop between *noticing something* and *acting on it*" | covered verbatim in spirit | §7 last bullet, §2.1 |
| 9 | Registry built from Traefik routes + repo inventory | **superseded** | addendum §A.1 |
| 10 | Prod/staging URLs served through Traefik | superseded (both origins now resolve identically via pjid) | FR-1 |
| 11 | Traefik label/route that identified the project | **superseded** | addendum §A.1 |
| 12 | Repo name | covered | §3 Project Record, FR-2 (resolution only — **GAP 2** on display) |
| 13 | Local clone path | covered as data, **GAP 2** as surface | FR-2, FR-3 |
| 14 | Associated Hermes PM agent, when one exists | covered | FR-4 |
| 15 | Associated Plane board, when one exists | covered as data, **GAP 2** as surface | FR-9/FR-10 |
| 16 | Bloodbank topic `bloodbank.v1.repo.<repo>` | **corrected, with reason stated** | §6 correction block, addendum §B.1 |
| 17 | "Repos are assumed already cloned; **a missing clone is an exception state worth surfacing**" | covered | FR-3, 4th state |
| 18 | localhost:3000 "intentionally distrusted in v1 to avoid false positives" | **superseded** — declaration makes origin irrelevant | §4.1, addendum §A.1 |
| 19 | "shows a **compact** project dashboard" | **GAP 4** | nowhere |
| 20 | "The first useful version delivers **the highest-value loop**" | partly — §8 is a scope list, not a loop | §8.1 |
| 21 | Chat box is "**the primary interface**" | **GAP 3** | nowhere; §5 flattens panes to coequal-and-independent |
| 22 | Chat capability: create tickets | **GAP 3** (chat-side); form-side covered | FR-10 is a form; FR-6 is work-dispatch |
| 23 | Chat capability: summarize status | covered | UJ-2, FR-5 |
| 24 | Chat capability: inspect WIP | covered | UJ-2 |
| 25 | Chat capability: "**reason about the current page**" | **GAP 1** | nowhere |
| 26 | "board is already resolved … so 'add ticket' knows exactly where it goes" | covered, hardened | FR-10, §5 "cost of being wrong" |
| 27 | Snapshot + annotate + attach to agent message | **superseded mechanism**, deferred with shape | §9 |
| 28 | "visual bug reports / **ideas** without a context switch" | mostly covered; the *idea-capture* motive (not just bug-filing) is thin — all three UJs are bug/status shaped | §2.1 bullet 4 |
| 29 | Agent detection via `agents/hermes/…` on the local repo | superseded by Registry-sourced Agent bindings (implied, not stated) | §3 Project Record |
| 30 | Agent exists → connect chat UI | covered | FR-4 |
| 31 | No agent → surface clearly | covered | FR-4, UJ-3 |
| 32 | No agent → "offer a **one-click, non-interactive** deploy via pjangler" | explicitly deferred, reason given | FR-4 assumption, §9 |
| 33 | Bloodbank filtered to the repo namespace | covered as payload filter | §6, §9 |
| 34 | "show the **live** event stream" | **GAP 5** (liveness) | §9 says "recent events" |
| 35 | "**beside** the ticket and agent panes" | **GAP 4** (co-presence/layout) | nowhere |
| 36 | "project cockpit: URL → repo → agent → tickets → screenshots → events, **all in one place**" | **GAP 4** | §3 defines Cockpit as scope-of-one-Project, says nothing about co-presence |
| 37 | MVP 1 — resolve current URL to registry entry | superseded mechanism, intent covered | FR-1, FR-2 |
| 38 | MVP 2 — "**Show** matched repo, local path, Hermes agent status, and Plane board" | **GAP 2** — only agent status has an FR | FR-4 only |
| 39 | MVP 3 — Hermes chat box | covered | §4.2 |
| 40 | MVP 4 — add a Plane ticket | covered | FR-10 |
| 41 | MVP 5 — capture + annotate + attach | deferred | §9 |
| 42 | MVP 6 — clear "no agent found" state w/ deploy action | split: state in v1, action deferred | FR-4, §9 |
| 43 | OQ — where the registry lives | **superseded** (pjangler is authoritative) | §3 Registry |
| 44 | OQ — cleanest extension ↔ local path bridge | answered | §4.4, addendum §A.2, §A.3 |
| 45 | OQ — auth to Hermes, Plane, Candystore, Bloodbank | answered | FR-13, §5 trust boundary, §6 |
| 46 | OQ — should localhost match at all | **superseded** | §4.1 |
| 47 | OQ — payload shape for annotated snapshots "when attached to agent messages **or tickets**" | annotation mechanism superseded; the *ticket* destination has no successor anywhere (§9 attaches to a chat turn only) — noted, not ranked, as it sits inside the excluded supersession |
| 48 | Board: Plane `33god` / **Sidepiece** / `SIDE`, SSOT in `.project.json` | covered | §6, §10, addendum §B.3 |
| 49 | Agents: Hermes PM + **Scrum Master (Ticket Sentinel)** | covered | §3 Agent |
| 50 | Events: `bloodbank.evt.v1.repo.sidepiece.>` | corrected | §6 |

---

## 2. Gaps, ranked

### GAP 1 — The PM was supposed to be able to reason about the page you are on (high)

> "the chat box is the primary interface (create tickets, summarize status,
> inspect WIP, **reason about the current page**)"

The PRD's chat is Project-scoped but **page-blind**. FR-5 and FR-6 define a turn
as text in, tokens or an ack out; nothing in §4.2 puts the current URL, title,
or any page content into a turn. §4.2's Out of Scope names "attaching files",
not page context, so this was not scoped out — it evaporated.

This is not a nice-to-have detail. It is the difference between "a chat box that
happens to be docked next to a page" and the thing the brief describes. The PRD
itself leans on it implicitly in UJ-1 ("files a bug against the thing he's
staring at") and §9 admits the principle for the deferred element picker —
`[ASSUMPTION: a bare selector is useless to an agent that cannot see the page,
so context is part of the payload]` — but never applies the same reasoning to an
ordinary chat turn, which in v1 ships with *no* page context at all.

Minimum repair: an FR stating that every chat turn carries the resolved pjid
**and** the current page URL/title, and that the PM may be asked about the page.

### GAP 2 — Nothing requires the Cockpit to show what it resolved (high)

> MVP scope 2: "**Show** matched repo, local path, Hermes agent status, and Plane
> board."

FR-2 requires *obtaining* repo name, local clone path, Board binding and Agent
bindings. FR-4 requires *showing* agent status. Nothing requires showing the
other three. The local clone path in particular — the literal payoff of the
"page → project that produces it" bridge, and the string you copy to `cd` into
the repo — appears in the PRD only as a thing the Bridge returns and as a
failure state (FR-3) when it is missing on disk.

It also undercuts SM-3 ("resolution is never wrong. Target: zero instances of
the Cockpit showing the wrong Project"). That metric is unobservable if the
Cockpit never displays its resolution for the operator to check.

`bmad-ux` reading the PRD alone has no requirement to render a project header.

### GAP 3 — The chat box was the primary interface; the PRD flattened the hierarchy (medium-high)

> "the **chat box is the primary interface**"

The brief states an information architecture: one primary surface (chat), with
tickets and snapshot supporting it — it even routes ticket *creation* through
chat. The PRD replaces this with three sibling features (§4.1/§4.2/§4.3) and a
§5 posture — "Every pane fails independently" — that is correct about failure
but silently reads as *equal weight* to any downstream consumer. No sentence in
either document says which surface leads.

Consequence: `bmad-ux` will plausibly lay out coequal panes or tabs, and
`bmad-create-epics-and-stories` has no signal that chat is the one to ship
first if v1 has to be cut again. Note the brief's own priority ordering —
chat (1), tickets (2), snapshot (3) — which the PRD does not carry.

### GAP 4 — The "compact dashboard / all in one place" quality (medium)

> "shows a **compact** project dashboard" … "show the live event stream **beside**
> the ticket and agent panes — turning the sidebar into a project cockpit: current
> URL → local repo → agent → tickets → screenshots → repo-scoped events, **all in
> one place**"

Three qualities travel together here and none survive:

- **Compactness/density.** The word "compact" appears nowhere. The only adjacent
  note is §4.3's "the board's shape is legible at a glance", scoped to one pane.
- **Co-presence.** "Beside", "all in one place" — panes visible simultaneously,
  not swapped behind tabs or routes. §3 defines Cockpit purely as *scope*
  ("scoped to exactly one resolved Project at a time"), never as *layout*.
- **The chain as a felt thing.** URL → repo → agent → tickets → events read in
  one glance is the product's whole sensation; the PRD decomposes it into
  independently-specified features and never reassembles it.

SM-C1 ("if I'm living in the panel rather than dipping into it, the loop got
heavier") gestures at the dip-in feel but is a metric, not a design constraint,
and it argues about *dwell time*, not *density*. This is exactly the class of
material a functional-requirement structure drops, and it is the part `bmad-ux`
most needs.

### GAP 5 — The event feed lost its liveness in translation (medium)

> "filter Bloodbank for its namespace … and show the **live event stream**"

§6's correction is right and well-argued: a repo-scoped subject is illegal, so
Project-scoped retrieval is a `data.repo` payload filter through Candystore.
But that correction is about *where identity lives*, not about *push vs. poll* —
and in carrying it across, §9 restated the feature as "Project-scoped **recent**
Bloodbank events". A tailing stream and a recent-events list are different
products; the brief wanted the former ("live", sitting beside the other panes as
ambient operational context). Nothing states that liveness was traded away or
why.

Worth resolving deliberately, because the answer is non-obvious: §5's panel
lifetime rules and the addendum's SSE-vs-WebSocket finding both bear on whether
a tailing feed is even practical in the panel document.

---

## 3. Noted, deliberately not ranked

- **Idea capture, not only bug filing** (brief: "visual bug reports **/ ideas**
  without a context switch"). All three PRD journeys are bug- or status-shaped;
  §2.1's fourth JTBD ("act on small observations") is the closest survivor. Thin
  rather than absent.
- **Annotated snapshot attached to a *ticket*** (brief OQ 5: "agent messages **or
  tickets**"). §9 attaches only to a chat turn. Sits inside the excluded
  annotation supersession, so it is recorded here rather than claimed as a gap.
- **"Big Chungus"** as the named workstation. PRD says "the workstation"
  throughout — generic, accurate, and a non-loss for a single-operator tool.
- **Agent detection by `agents/hermes/…` path.** Reasonably subsumed by
  Registry-sourced Agent bindings; the substitution is unstated but harmless.
