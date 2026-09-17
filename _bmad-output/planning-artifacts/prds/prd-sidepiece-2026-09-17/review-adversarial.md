# Adversarial Review — Sidepiece PRD (2026-09-17)

Reviewed: `prd.md` + `addendum.md`, in full.
Stance: looking for the reasons this fails in week three.
Calibration: single operator, single user, hobby stakes. Enterprise-shaped
findings (auth on loopback, tenancy, compliance, rollout, ROI) are deliberately
absent — the PRD declares them non-goals and is right to.

Every finding below was checked against the live workstation, not read off the
page. Where a claim in the PRD is contradicted by the machine, the command and
its output are quoted.

---

## Verdict

The resolution model is the best thing in this document and it holds up. Killing
URL matching for page-declared identity (§4.1, §A.1) is a real decision made on
merit, the glossary is disciplined, and §10's per-epic verdict table is exactly
what `bmad-create-epics-and-stories` needs. The failure-posture NFRs in §5 are
better than most production PRDs.

What does not hold up is everything downstream of the chat feature. §4.2 is the
largest feature in the document, it rejected both simpler alternatives in §A.4,
and its streaming half has **no transport that exists on this machine** — a fact
§12 Q1 flags as "not established" and then ships anyway in §8.1. Two more
load-bearing pieces (the stream/dispatch classifier, the dispatch correlation
id) are named but never specified. And the one thing that gates every success
metric — getting projects to actually emit a `pjid` — is waved off in a single
line as "Sequencing risk, not a design risk."

The document is honest about its unknowns. It is not honest about which of them
are allowed to remain unknown while §8 is called "MVP Scope."

**Dimension verdicts**

| Dimension | Verdict |
|---|---|
| Resolution model (§4.1, §A.1) | **strong** — the one decision made on merit, argued against a named alternative |
| Chat architecture (§4.2, §A.4) | **broken** — rests on a transport that does not exist; see F1 |
| Agent state model (FR-4, §6) | **thin** — two states specified where three exist; wrong on this repo today; see F2 |
| Dispatch lifecycle (FR-6, FR-7) | **thin** — classifier and correlation id both undefined; see F3, F4 |
| Bootstrapping / sequencing (§12 Q4) | **thin** — the critical path, declared out of scope; see F5 |
| Failure posture (§5) | **adequate** — genuinely good, but its headline guard is a no-op; see F6 |
| Downstream usability (§10, §3) | **strong** — glossary discipline and the epic verdict table are real assets |

---

## F1 — CRITICAL. FR-5 has no transport, and the whole §4.2 architecture is built on it.

**Location:** `prd.md` §12 Q1, §4.2 FR-5, §8.1, §5 latency budget; `addendum.md` §A.4

§12 Q1 states the problem correctly and then the document ignores its own
warning:

> "FR-5 needs a synchronous streaming channel and it is not established that the
> gateway provides one. ... **Blocks architecture.**"

Something marked *blocks architecture* appears unqualified in §8.1 In Scope
("Streamed Exchange with the PM (FR-5)"), carries a hard budget in §5 ("first
chat token ≤2s"), and has four testable consequences written as if the mechanism
were settled.

It is not settled, and the evidence says it is worse than "unestablished":

```
$ hermes gateway --help
Manage the messaging gateway (Telegram, Discord, WhatsApp, Weixin, and more)
  {run,start,stop,restart,status,install,uninstall,list,setup,migrate-legacy,enroll}
```

The Hermes PM gateway is a **chat-platform relay**, not an HTTP service. There is
no request/response surface, no streaming endpoint, and `ss -tlnp` shows no
per-project PM port listening — only `hermes-dashboard` on 9119. §6's dependency
table lists "Hermes PM gateway | Streamed Exchange (FR-5)" as though that binding
were known to work. It is not.

Q1's own fallback is worse. It names "a CLI-passthrough fallback (the old D3)":

```
$ time hermes --help
9.928 total          # and it prints "1Password: applied 17 secrets" first
```

**9.9 seconds of cold start**, before a single token of a model response, against
a 2-second first-token budget. Every Hermes process start pays a 1Password
resolution of 17 secrets. CLI passthrough is not a fallback; it is a
non-starter, and the PRD offers it as one of only two options.

So both of Q1's named paths are dead, which collapses §A.4. That section rejected
dispatch-only with:

> "a tool you cannot ask a quick question of stops being a cockpit"

If FR-5 cannot be built, dispatch-only is what ships — the option §A.4 rejected —
and the elaborate stream/dispatch split, the classifier, and half of §4.2 were
designed around a capability that was never verified to exist. This is the single
largest piece of the document and it is the least grounded.

**What the builder discovers in week three:** they wire the Bridge to the PM
gateway, find it is a Telegram/Discord relay, and have to redesign the chat
feature from scratch with the epics already written against FR-5/FR-6/FR-7.

**Fix:**
1. Make Q1 a **gated spike that runs before any epic is written**, with a stated
   decision rule and a deadline. Not "blocks architecture" as a label — a gate.
2. Add the third option the document never names. `hermes gateway enroll` is
   documented as *"Enroll this gateway with a relay connector (writes relay auth
   creds to .env)"*. The Bridge registering itself as a relay connector — i.e.
   becoming a messaging platform from Hermes's point of view — is the one path
   that already exists in the shipped tooling. It deserves to be the first thing
   tried.
3. State the fallback plan explicitly in §8: *if no streaming path exists by
   <date>, v1 ships dispatch-only plus a read-only "recent PM output" pane, FR-5
   moves to §9, and §A.4's rejection of dispatch-only is formally reversed.*
   Right now there is no written answer to "what if Q1 is no," which means the
   answer will be improvised under pressure.

---

## F2 — CRITICAL. FR-4 reads agent *intent* and reports it as agent *presence*. It is wrong on this repo right now.

**Location:** `prd.md` §3 Glossary (Project Record, Registry), §4.1 FR-4, §6; `addendum.md` §A.1

The Glossary defines where agent state comes from:

> "**Project Record** — The resolved metadata for a Project as returned by
> `pj info <pjid>`: repo name, local clone path, Board binding, **Agent bindings**."

> "**Registry** — pjangler's catalogue of Projects. **Authoritative**"

FR-4 then treats that as ground truth:

> "A Project with a PM shows it as the chat target by name.
> A Project without one disables chat with the reason stated"

Run it on Sidepiece itself:

```
$ pj info sidepiece --json
  "agents": { "sidepiece-pm": { "role": "pm", "role_dir": "agents/hermes/pm" } }

$ grep -ci sidepiece ~/.hermes/agents-registry.yaml
0

$ systemctl --user list-units --all | grep sidepiece
(nothing)
```

`pj info` reports a PM. There is **no** `sidepiece` entry in the Hermes fleet
registry and **no** `hermes-sidepiece-pm-gateway.service`. FR-4 as specified
would render "chat target: sidepiece-pm" and wire a chat box to an agent that
does not exist. The PRD's flagship demo project fails its own flagship
requirement on day one.

This is not a rare edge. Of the 20 PM gateway units on this box:

```
hermes-delocontainers-pm-gateway.service   inactive dead
hermes-skillex-pm-gateway.service          inactive dead
hermes-ssbnk-pm-gateway.service            inactive dead
hermes-automatic-ai-pm-gateway.service     failed
```

Four of twenty are provisioned-but-not-running. That is the third state, and §6
knows it exists —

> "Renders as agent-unreachable, distinct from no-agent-provisioned."

— but FR-4's consequences enumerate only two, and FR-4's remedy consequence
("The no-Agent state names the exact provisioning command") is the *wrong advice*
in the third state: telling the user to run `pj hermes-agent` when the files are
already rendered and the unit is dead sends them down the wrong path. Compare
FR-3, which gets this exactly right — "Four states are separately rendered and
separately worded ... the two have different causes and different fixes." FR-4
does not follow the precedent FR-3 sets two requirements earlier.

**The deeper problem is one the addendum already named and then walked into.**
§A.1 killed the Traefik model partly on this:

> "**Two sources of truth.** Traefik config and the pjangler Registry had to
> agree, and nothing kept them in agreement."

`.project.json`'s `agents` block and `~/.hermes/agents-registry.yaml` have
exactly that relationship, and — demonstrated above — they already disagree. The
Glossary's claim that the pjangler Registry is "Authoritative" is true for boards
and clone paths and **false for agents**. Calling it authoritative unqualified is
the kind of sentence that gets believed by whoever writes the Bridge.

**Fix:**
1. Rewrite FR-4 with three states, each with its own wording and its own remedy:
   - no `agents` entry with `role: pm` → "no PM declared" → `pj hermes-agent`
   - declared, but absent from `~/.hermes/agents-registry.yaml` or no gateway
     unit → "PM declared but not deployed" → the fleet install command
   - unit exists but not `active` / not answering → "PM deployed but not
     running" → `systemctl --user start hermes-<x>-pm-gateway`
2. Amend the Glossary: "Agent bindings" is **declared intent**, which the Bridge
   reconciles against the Hermes fleet registry and gateway unit state. Qualify
   "Authoritative" to the things pjangler is actually authoritative about.
3. Add a §6 dependency row for `~/.hermes/agents-registry.yaml` — right now the
   PRD has a dependency it does not know it has.

---

## F3 — HIGH. The stream/dispatch classifier is load-bearing, unspecified, and "does not ask" was chosen by default.

**Location:** `prd.md` §4.2 FR-6 and its `[ASSUMPTION]`, §2.3 UJ-2, §13; `addendum.md` §A.4

FR-6 opens with a predicate it never defines:

> "Turns that **assign work** are published to Bloodbank as commands"

What is a turn that assigns work? The only guidance in the entire document is an
assumption:

> `[ASSUMPTION: Sidepiece decides stream-vs-dispatch and does not ask. ... the
> classifier should bias toward dispatch when uncertain.]`

That is the whole specification. Nothing says **where** the classifier runs
(extension, Bridge, or the PM itself), **what** it is (keyword rules, a prefix
convention, a model call — each with wildly different latency and failure
characteristics), or **how it is tested**. Every other capability in this PRD has
a "Consequences (testable)" block. The classifier — the component that decides
which of two entirely different code paths a user's input takes — has none. It is
the only piece of the system with real behavioural ambiguity and it is the only
piece with no requirement.

It also makes FR-5 untestable. "First token renders within 2s of send" cannot be
verified without knowing which sends are *supposed* to produce a first token.

And the stated bias contradicts the primary journey. UJ-2:

> "Same panel, chat box. 'What's in progress?' streams back inline in a couple of
> seconds."

"What's in progress?" is a state question with an imperative-adjacent shape —
precisely the input an uncertain classifier biased toward dispatch will dispatch.
§A.4 excuses this as "merely mildly annoying rather than blocking," but the thing
being made mildly annoying is the document's own headline user journey. The
counter-metrics in §11 will not catch it either: SM-C1 measures panel open time,
which a misdispatched question *reduces*.

**"Does not ask" is a decision made by default, not on merit.** The document
argues carefully for the stream/dispatch split (§A.4) and then, in a bracketed
aside, disposes of the question of *who decides* without a single line of
justification. For a tool whose only user is its author, an explicit affordance
is cheaper than a classifier, deterministic, testable in one line, and deletes a
component. It was never weighed.

**Fix:**
Make the affordance the specified default and demote the heuristic:

- FR-6 gains a consequence: **"No turn is dispatched without an explicit dispatch
  action. Enter streams; a `/do ` prefix, a Dispatch button, or Shift+Enter
  dispatches."** That is testable, has zero latency cost, and cannot be wrong.
- Move heuristic classification to §9 as an optional convenience with its own
  shape ("suggest dispatch when the turn looks imperative; the user confirms").
- Update the §13 assumption index accordingly — the current entry records a
  decision that should not survive review.

---

## F4 — HIGH. FR-7's "configured window" recreates the exact hang the split was invented to prevent.

**Location:** `prd.md` §4.2 description, FR-7, §12 Q2, §8.1, §6

§4.2 states the entire motivation for the split:

> "Conflating these is how the panel ends up **appearing to hang while an agent
> does twenty minutes of work**."

FR-7 then specifies:

> "A dispatch with no observed outcome **within a configured window** is shown as
> unknown, not as success."

"A configured window" is the requirement in this document that sounds most
decisive while committing to nothing. No default value. No statement of where it
is configured. And critically, **no distinction between "still legitimately
running" and "dead."** A twenty-minute task under any window shorter than twenty
minutes shows `unknown` for the whole legitimate run — which conveys exactly as
much as the spinner §4.2 was written to eliminate, in different words. The
failure mode was renamed, not removed.

There is no interim-progress requirement anywhere. FR-7's three consequences
cover acknowledgement, correlation, and timeout; nothing covers "the agent is
working and here is evidence." §6 gives Candystore only the outcome role. Yet
Bloodbank's contract has the vocabulary for exactly this — `bb contract` lists
`started`, `received`, `routed`, `updated`, `spawned` as legal event actions, so
interim signal is available and simply unspecified.

Second problem: FR-7's core consequence —

> "Outcomes are correlated back to the originating turn **by identifier**, not by
> ordering or recency."

— is conditioned on §12 Q2, which asks whether that identifier exists:

> "Does the command envelope carry a correlation id that the outcome event
> preserves, and does Candystore index it?"

The requirement asserts a property; the open question asks whether the property
is real. If Q2 answers no, FR-7 degrades to permanently-`unknown` while still
sitting in §8.1 as MVP scope, and §6's "Outcomes show as unknown; dispatch still
succeeds" quietly becomes the normal case rather than the Candystore-down case.
Unlike Q1, Q2 carries no "blocks" marker at all.

**Fix:**
1. Put a number in FR-7 and split the state:
   - **running** — an interim event (`started` / `updated` / `routed`) seen for
     this correlation id; show elapsed time and the last event. No timeout.
   - **unknown** — no event of any kind within N seconds (state N; 60s is fine).
   - Add a consequence: **an outcome arriving after the window still resolves the
     turn** — a 20-minute task must land as completed, not stay unknown forever.
2. Give Q2 the same gating treatment as Q1 (verify before epics), and state the
   fallback in writing: if there is no preserved correlation id, FR-7 v1
   correlates on the Bloodbank message id echoed by the agent hook, or FR-7 moves
   to §9 and dispatched turns render as fire-and-forget with a link to the
   Candystore query. Any of those is fine; *none written down* is not.

---

## F5 — HIGH. §12 Q4 is the project's actual critical path, dismissed in one line.

**Location:** `prd.md` §12 Q4, §8, §11 SM-1, §4.1 FR-1 assumption; `addendum.md` §A.1, §D.1

> "**What emits the `pjid` declaration into served pages?** Out of scope here, but
> **v1 is useless until some number of Projects actually declare one**. Is that a
> pjangler recipe, a per-project template change, or manual? **Sequencing risk,
> not a design risk.**"

The document concedes the tool is useless without this and then declines to own
it. That reclassification does no work — a sequencing risk that gates 100% of the
product's value is the critical path by definition, and "not a design risk" is
not a reason to leave it out of §8.

Three concrete consequences:

1. **§8 MVP Scope contains no line item for it.** Ten bullets, all extension and
   Bridge work, zero about making a single project resolvable. The MVP as scoped
   can be fully delivered and demo nothing.
2. **§11 SM-1 silently depends on a number the doc refuses to state.** "within a
   month of v1, most new tickets on actively-browsed Projects originate in
   Sidepiece" is unreachable unless enough projects declare, and "some number" is
   never converted into a target.
3. **FR-1's assumption is a hard constraint on emission that is never priced.**
   > "in the served HTML, readable without executing page JS — it must work on a
   > static page with scripting disabled"

   That excludes every service whose HTML you do not template: a deployed
   third-party app, a dashboard you did not author, anything served by a vendor
   image. The resolvable set is exactly "projects whose served HTML I control,"
   and the PRD never estimates what fraction of the pjangler registry that is.
   §A.1 charges the declaration model only "a bootstrapping burden" without
   putting a number on it.

**The document also has the answer in its own addendum and does not use it.**
§D.1 on Vercel Toolbar:

> "**Injected into** preview and production deployments"

Injected by the platform — not authored per project. The equivalent here is a
Traefik response middleware injecting the meta tag for every `delo.sh`-served
host. That is *not* the rejected Traefik model: §A.1 rejected Traefik as the
*resolution* source (inference, confidence scores, two sources of truth). Traefik
as a *declaration transport*, with pjangler still authoritative, carries none of
those three objections and would bootstrap every routed host at once. §A never
evaluates it — a real alternative left unexamined.

**Fix:**
1. Add an §8.1 line item with a number: *"at least N projects emit a `pjid`
   declaration before v1 is called done."* Pick N. Three is a defensible answer.
2. Name the mechanism, and use the machinery that already exists. `pj audit` is
   documented as *"Deterministic parity audit against 33god project standard"*
   and `pj migrate` as *"Idempotent migration recipe for a parity rule."* The
   declaration should be a **parity rule with a migration**, not a manual chore —
   then `pj audit` tells you your coverage and `pj migrate` fixes it, and SM-1
   gets a denominator.
3. Add the platform-injection option (Traefik middleware) to §A with an explicit
   accept or reject, so the per-project burden is a chosen cost rather than an
   unexamined one. Note the one thing it does not cover — `localhost:5173` dev
   servers — which is precisely the case §A.1 said the Traefik model failed at,
   so the honest answer is probably *both*: middleware for routed hosts, template
   rule for dev servers.

---

## F6 — MEDIUM. §5's "cost of being wrong" guard is a tautology, and SM-3 cannot be observed.

**Location:** `prd.md` §5 Cost of being wrong, §4.3 FR-10, §11 SM-3

§5 makes the document's strongest safety commitment:

> "Sidepiece must never act against the wrong Project. Every mutating call carries
> the resolved pjid, and **the Bridge rejects a mutation whose pjid does not match
> the Board it targets**. A confidently wrong ticket is worse than a failed one."

The check cannot fire. The Bridge derives the Board *from* the pjid (FR-2), and
FR-10 is explicit that the client never supplies one:

> "The Ticket is created on the resolved Project's Board and no other — **the
> Board is never chosen by the user**."

So the Bridge compares `board_for(pjid)` against `board_for(pjid)`. It is
`f(x) == f(x)`. A reviewer reads this NFR and concludes the wrong-project risk is
handled; it is not handled at all, because the guard defends against an input the
protocol never accepts.

The real vector is stale panel state, and nothing guards it. FR-1 requires
re-detection on tab switch and SPA transition; §5 notes the panel document
persists across tab switches. So: resolve Project A → user types a ticket title →
user switches tabs or a route changes → the panel re-renders for Project B → the
in-flight compose submits. Whether that lands on A or B is an implementation
accident. FR-10's "On failure, the entered text is preserved" shows the author
thought about in-flight compose state, but only for the failure case.

SM-3 compounds it:

> "**SM-3:** Resolution is never wrong. Target: zero instances of the Cockpit
> showing the wrong Project."

There is no mechanism by which a wrong resolution becomes visible. A ticket filed
against the wrong board is indistinguishable from a correct one unless the author
happens to notice. The metric measures "times I noticed," not "times it
happened," and will read zero regardless.

**Fix:**
1. Replace the tautology with a generation check: the panel stamps each resolution
   with a monotonic id; every mutating call carries `(pjid, generation)`; the
   panel refuses to submit — and the Bridge refuses to accept — a mutation whose
   generation is not current.
2. Add an FR-10 consequence for the real case: *"a resolution change while a
   create is composed either re-targets the compose with a visible notice or
   blocks submission — it never silently submits against the previous Project."*
3. Make SM-3 observable: the Bridge logs `(pjid, board_id, created_ticket_key)`
   per create. §5 already requires "Bridge request logs are readable without a log
   aggregator," so this is free — and it turns SM-3 from a feeling into a grep.

---

## Additional notes (below the top six, worth a line each)

- **FR-8 never says who owns chat history, or whether restored turns are context
  or decoration.** FR-8 requires history to "survive a Chrome restart and an
  extension service worker termination," but §4.4 says the Bridge is "the only
  component in the system that touches the filesystem," and §6's dependency table
  has no row for chat history at all. More importantly: the PM is a Hermes agent
  with its own session state. If the panel keeps its own transcript, the two will
  diverge — the panel shows turns the agent has no memory of, or the agent
  remembers turns the panel never rendered. FR-8's consequences are silent on
  whether restored history is *sent back as context* or merely *displayed*. That
  is a product decision, not an architecture one, and it belongs here. Suggested:
  state that the Hermes session is authoritative and the panel renders from it,
  or state that the panel transcript is display-only and say so in the UI.

- **§8.2's EPIC K note is doing the right thing and should be copied.** The
  `[NOTE FOR PM: ... If it is still deferred at the next retrospective, delete it
  rather than carrying it.]` pattern is the best line in §8. §9's six deferred
  items have no equivalent expiry, and §9 is exactly the list that killed this
  project the first time — §E: "44 tickets ... Zero were ever started." SM-C2
  names the risk ("This died once already at 44 tickets and zero code") without
  any mechanism to enforce it. Give each §9 item a delete-by condition.

- **`pj info <pjid>` is fine; Q3 is a non-issue.** Measured from an unrelated cwd:
  `pj info sidepiece --json` returns the full record in **0.2s**. Against a 1s p95
  resolution budget, shelling out is comfortably adequate. §12 Q3 ("Shelling out
  is simplest and slowest; it may or may not matter at this latency budget") can
  be closed in favour of shelling out. One open question fewer costs one command
  to resolve — worth doing before the architecture pass so it does not consume
  design time.

- **§12 Q5 is correctly flagged and should just be fixed now.** The
  `project_slug` → `project_id` rename is real — the live `.project.json` carries
  `project_id` — and the PRD is right that "the Bridge will read whichever
  survives." It is a ten-minute fix in
  `_bmad/custom/workflows/ticket-lifecycle/data/event-schemas.md` and it does not
  need to be carried as an open question into architecture.

---

## What would make this PRD safe to build from

Four changes, in order:

1. **Run Q1 as a gate before epics.** Try `hermes gateway enroll` first. Write
   down the dispatch-only fallback and what §8 becomes if it triggers. (F1)
2. **Rewrite FR-4 for three agent states** and stop calling the pjangler Registry
   authoritative about agents. This is currently wrong on the Sidepiece repo
   itself. (F2)
3. **Delete the classifier; specify the affordance.** One consequence line
   removes an entire undefined component. (F3)
4. **Put the declaration bootstrap in §8 with a number and a `pj migrate` parity
   rule.** Otherwise the MVP ships and resolves nothing. (F5)

Everything else — the resolution model, the glossary, the failure posture, §10's
epic verdicts, the MV3 research in §C — is genuinely good work and should be left
alone.
