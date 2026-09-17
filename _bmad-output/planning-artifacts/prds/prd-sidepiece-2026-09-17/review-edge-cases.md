---
title: Sidepiece PRD — Edge Case Review
status: complete
created: 2026-09-17
reviews: prd.md (2026-09-17), addendum.md (2026-09-17)
method: exhaustive state-space walk, FR-1 through FR-13
---

# Edge Case Review: Sidepiece PRD

## Method

Every FR was walked for its branching paths and boundary conditions. For each,
the state space was enumerated and checked against the PRD's stated
consequences. **Only unhandled cases are reported.** A case the PRD already
answers — even briefly — is not a finding, and several candidate cases were
dropped on exactly that ground (listed in §4 so the reader knows the walk
covered them).

Calibration: single operator, single workstation, hobby stakes. The PRD's
declared non-goals around auth, tenancy, compliance, rollout and hardening are
correct decisions and are not re-litigated here. §5 lists what was deliberately
not raised.

One finding is grounded in a live check of the registry rather than inference;
that check is shown inline.

---

## 1. Findings

### F1 — Project switch with work in flight is unspecified, and the guard that is supposed to prevent mis-targeting cannot fire

**Severity: critical. Location: prd.md §5 (Panel lifetime, Cost of being wrong), FR-5, FR-8, FR-10.**

§5 states the hazard as a feature: *"The panel document stays alive across tab
switches while open, so in-panel state survives navigation."* That is exactly
right for chat continuity and exactly wrong for correctness, because the PRD
never says what happens to the surviving state when the survived-into context is
a **different Project**.

The unenumerated transitions:

| Transition | In-flight state | PRD guidance |
|---|---|---|
| Tab switch A→B (both declare) | Streamed Exchange mid-token for A | none |
| Tab switch A→B | Dispatched Command for A awaiting outcome | none |
| Tab switch A→B | Typed-but-unsent ticket title for A | none |
| Navigate tab to non-declaring page | all of the above | FR-1 covers the *display* ("never a stale previous Project"), nothing covers the *state* |
| SPA route change that swaps the declared pjid | all of the above | none — see F6 |

Three concrete failures an implementer gets no help with:

1. A stream started against A's PM completes while B is displayed. FR-8 requires
   *"Two Projects never share history."* Whether the arriving tokens are
   attributed to A (invisible), attributed to B (a violation), or dropped (FR-5's
   *"Closing and reopening the panel mid-stream does not lose the turn"* implies
   they must not be) is undetermined. All three are defensible readings of the
   current text.
2. A ticket title typed against A, submitted after the panel re-rendered for B.
   FR-10 promises *"The Ticket is created on the resolved Project's Board and no
   other"* — but "the resolved Project" is now ambiguous between the Project that
   was resolved when the form was filled and the one resolved when it was
   submitted.
3. §5's stated defence does not defend. *"Every mutating call carries the
   resolved pjid, and the Bridge rejects a mutation whose pjid does not match
   the Board it targets."* The Bridge derives the Board **from** the pjid
   (FR-2) — the client never names a board independently. The check therefore
   compares a value against itself and cannot fail. A stale-but-self-consistent
   payload carrying A's pjid and A's board, submitted while the operator is
   looking at B, passes cleanly. This is the one failure mode SM-3 exists to
   drive to zero, and the only guard against it is vacuous as written.

**Fix:** Add an FR — "Project switch tears down or re-homes in-flight state" —
with an explicit disposition per class: streams (cancel, or continue and file
into the originating Project's history, never the displayed one), pending
dispatches (survive; reconcile per FR-7 regardless of what is displayed), unsent
composer text (retained per Project, restored on return). Then restate §5's
guard as something that can fail: every mutating call carries the pjid **and the
panel-render generation that produced the form**, and the Bridge or panel
rejects a submission whose generation is stale. Add a consequence: "a form
filled against Project A and submitted after the Cockpit re-rendered for
Project B is rejected, not retargeted."

---

### F2 — Projects with no Board are not a state anywhere, and they are 25% of the registry

**Severity: high. Location: prd.md §3 Glossary, FR-2, §4.3 (FR-9, FR-10).**

The glossary defines a Project as having *"at most one Board"* — explicitly
permitting zero. §4.1 takes the analogous zero case for Agents extremely
seriously: FR-4 exists solely to handle it, mandates a disabled-with-reason
chat pane, and requires naming the provisioning command. There is no
counterpart for Boards. FR-2 lists *"Board binding"* as a resolution output
with no zero-cardinality branch; FR-9 and FR-10 assume a Board throughout;
FR-9's failure taxonomy is *"An empty Board renders as empty, distinct from a
failed fetch"* — neither of which is "this Project has no Board."

This is not a theoretical branch of the glossary. Checked against the live
registry:

```
$ find ~/code -maxdepth 2 -name .project.json | wc -l          # 55
$ ... without a ticket_provider.board_id                        # 14
NO BOARD: OptionJangler, DigiPop, HeyMa-Satellite, cal.diy, bhappy,
          chorescore, yTm, pr-jangler, n8n-nodes-hermes,
          intelliforia-voice-agent, jacksnaps, agent-runtimes, wean, ...
```

One in four registered Projects resolves to a Project Record with no Board.
Several of them (cal.diy, jacksnaps, HeyMa-Satellite) are exactly the kind of
running, browsable service Sidepiece is built to sit beside. On those, the
Tickets pane has no specified rendering and FR-10's create has no target, so
the implementer will improvise — most likely into the "failed fetch" state,
which is the wrong diagnosis with the wrong fix, in a document whose §4.1 makes
a point of *"different causes and different fixes."*

Note also that §6's dependency table maps only Plane *failure*, and addendum §B.3
correctly says the Bridge resolves the provider from `.project.json` — which is
precisely where the block is absent. The upstream ticket-lifecycle workflow
already treats a missing `ticket_provider` as a named precondition failure
rather than an error; Sidepiece has no equivalent.

**Fix:** Add a fifth resolved-state to FR-3's taxonomy, or better, a consequence
under FR-9 mirroring FR-4's shape: "A Project with no Board binding renders the
Tickets pane as unavailable with the reason stated, distinct from an empty Board
and from a failed fetch, and names the command that binds one. Create is
disabled, not failed." Chat must remain usable — the FR-4 symmetry is the point.

---

### F3 — A dispatched question has no path back to the operator, which falsifies the assumption the classifier is built on

**Severity: high. Location: prd.md FR-6 assumption, FR-7.**

FR-6's assumption justifies an aggressive dispatch bias with a claim about
consequences: *"Getting it wrong is cheap in one direction (a question
dispatched still gets answered)."* Nothing in the PRD makes that true.

FR-6's consequences produce an acknowledgement, a correlation identifier, and a
distinct visual treatment. FR-7's consequences produce *"a terminal status —
completed, failed, or timed out."* A status is not an answer. There is no
requirement anywhere that the **content** of a Dispatched Command's result is
rendered in the panel. So under the spec as written, "what's in progress?"
misclassified as work assignment yields: an ack, a spinner-equivalent, and
eventually a green "completed" — with the actual answer sitting in Candystore or
an agent log, unread. That is not the cheap direction; it is a dead end, and it
happens on the classifier's *preferred* failure side.

Compounding it: there is no override. The assumption says Sidepiece *"decides
stream-vs-dispatch and does not ask"*, and no FR offers a re-run-as-stream
affordance, a forced-dispatch affordance, or any way to see what the classifier
decided before it commits. UJ-2 has the operator typing both kinds of turn into
the same box within seconds of each other, so misclassification is a
several-times-a-day event, not an edge.

**Fix:** Either (a) add a consequence to FR-7 — "a completed Dispatched Command
renders its result payload in the turn, not only its status" — which makes the
assumption true, or (b) drop the claim and add a manual override: the
classification is shown on the composer before send and is one click to flip.
(a) is better; both are cheap. Leaving the assumption unbacked is the one
option that costs later.

---

### F4 — The Ticket list has no staleness model, and the product's own core loop is what makes it stale

**Severity: high. Location: prd.md FR-9, FR-10, FR-2.**

The only specified fetch trigger is FR-9's *"The list is fetched fresh on
Project resolution"*, plus FR-10's local insertion on create — *"the new Ticket
appears in the list without a manual refresh."* There is no polling, no event
subscription, no refresh control, and no staleness bound.

Two consequences the PRD does not address:

1. **The dispatch loop guarantees staleness.** UJ-2's second half dispatches
   "start on the resolver ticket" to the PM. The PM's job is to move tickets and
   open new ones. That board mutation is invisible to the panel indefinitely —
   the operator watches a "completed" status on a dispatched turn while the list
   beside it still shows the pre-dispatch board. The feature that most needs a
   fresh board is the feature that most reliably invalidates it. §9's deferred
   Candystore event feed would supply the signal, but it is deferred, and FR-9
   does not name a substitute.
2. **The refetch trigger may never fire twice.** FR-9 ties freshness to "Project
   resolution", and FR-2 caches resolution: *"Resolution results are cached per
   pjid for the panel session; returning to an already-resolved tab does not
   re-hit the Registry."* If returning to a tab is not a resolution, it is not a
   refetch either — so a panel open all day can show a board read once, at
   breakfast. If it *is* a refetch, FR-2's cache saves nothing worth having and
   the two requirements should say so together.
3. **Create-during-fetch is a lost write.** FR-10's insertion is local. If a
   refetch is in flight when create succeeds, the in-flight response — computed
   before the ticket existed — lands second and silently removes it from the
   list. With no further refresh trigger, it stays gone until the next
   resolution. The operator's reasonable reading is that the create failed, and
   FR-10 promises the opposite.

**Fix:** State the refresh contract in FR-9: refetch on Project resolution,
on panel open, on returning to a tab whose Project differs from the displayed
one, and after any successful create; plus an explicit manual refresh control
(the counter to SM-C1 is that a stale board is worse than a button). State the
race rule: a create's local insertion survives any fetch response that was
issued before the create returned. If the deferred event feed is the intended
long-term answer, say so in §9 as a promotion trigger, the way the Agent-session
pane already carries one.

---

### F5 — Two Chrome windows produce two live Cockpits with no reconciliation model

**Severity: medium. Location: prd.md §5 (Panel lifetime), FR-2, FR-8.**

The whole panel model in §5 and addendum §C is written in the singular — "the
panel document". The addendum is precise about the actual scope: a global
panel's document persists across tab switches *"within a window"*. Chrome's side
panel is per-window, so a second browser window means a second panel document,
with its own resolution cache, its own chat state, and its own view of the same
persisted history. The PRD never acknowledges the second one exists.

Unhandled consequences, all reachable on a multi-monitor desk:

- **Same Project in both windows.** FR-8 requires *"Reopening the Cockpit on the
  same Project restores that Project's prior turns."* Two Cockpits each restore
  the same history and each append to it. With no merge or locking rule, the
  natural implementation (load at open, write the whole thread at change) makes
  the second window's close silently discard the first window's turns. The
  requirement that history survives is satisfied; the requirement that it is
  *correct* is not stated.
- **Different Projects in each window.** Harmless for display, but FR-2's cache
  is scoped to *"the panel session"* — now an ambiguous term with two live
  sessions — and F1's in-flight teardown question gains a second axis.
- **A dispatched turn's outcome** (FR-7) arriving while both are open: which
  panel reconciles it, and does the other see it without being reopened?

**Fix:** Either declare single-window operation a constraint in §5 (legitimate
for this product, and the cheapest fix — but then say what the second window
does: refuse to open, or render read-only), or add a consequence to FR-8 that
history is appended per turn rather than rewritten wholesale, and that a Cockpit
re-reads persisted history on focus. One sentence either way; the failure
without it is silently losing chat turns, which is the exact thing FR-8 exists
to prevent.

---

### F6 — The resolution cache has no invalidation rule, which makes one of FR-3's four states unreachable in practice

**Severity: medium. Location: prd.md FR-2, FR-3, §12 Q4.**

FR-2: *"Resolution results are cached per pjid for the panel session; returning
to an already-resolved tab does not re-hit the Registry."* There is no TTL, no
invalidation on Bridge restart, no invalidation on registry change, and no
manual re-resolve. "Panel session" is unbounded — the panel stays open as long
as the window does.

What this leaves unspecified:

- **FR-3's fourth state is evaluated once, ever.** *"Registry readable but the
  Project's clone path is missing on disk"* is a property of the filesystem at
  resolution time. A clone moved, renamed, or archived after the panel resolved
  it keeps rendering as healthy for the rest of the session. The state is
  specified; the moment it is re-checked is not.
- **Registry edits during bootstrapping are invisible.** §12 Q4 flags that v1 is
  useless until Projects start declaring a pjid, which means the operator will
  be actively adding declarations and registry entries *while the panel is
  open*. A pjid that rendered "declared but unknown" at 10:00 and was registered
  at 10:05 keeps rendering unknown until the panel is closed and reopened — and
  FR-3's wording for that state, quite reasonably, will not tell him to do that.
- **Bridge restart is explicitly a non-event.** FR-12 promises *"Restarting the
  Bridge does not require reloading the extension"*, which is right, but a
  restarted Bridge is the likeliest signal that registry or credential state
  changed. Nothing connects the two.

**Fix:** Give the cache a bound and a bust: a short TTL (the p95 budgets imply
re-resolution is cheap), plus explicit invalidation on Bridge health
transitioning unreachable→reachable, plus a re-resolve affordance on each of
FR-3's failure states ("declared but unknown" should offer "check again" — it is
the state most likely to be fixed while it is on screen).

---

## 2. Minor, reported for completeness

- **FR-7 uses two words for one state and neither is defined.** The
  consequences list *"a terminal status — completed, failed, or timed out"* and
  then *"shown as unknown, not as success."* Whether "unknown" and "timed out"
  are the same state, and whether either is terminal or reverts when a late
  outcome arrives, is not stated — in a document whose §3 declares that
  *"Introducing a synonym anywhere is a discipline violation."* Also: FR-7's
  *"a configured window"* has nowhere to be configured, since the only settings
  surface in the document (the tray settings page) is deferred to §9. Pick a
  constant and name it, or promote the setting.
- **FR-7's reconciliation has no lookback bound.** §5 says work whose outcome
  arrives while the panel is shut *"is reconciled on next open"*. Over what
  set — every dispatch ever made, or those still non-terminal, and from how far
  back? Where the pending set is persisted is also unstated (FR-8 persists chat
  history; whether dispatched turns are part of it is left open).
- **FR-13's "at process start or per-request" is an unmade decision.** The two
  differ materially: start-time resolution means a rotated credential needs a
  Bridge restart and FR-11 reports a stale healthy; per-request means a vault
  round-trip inside the 1s resolution and 2s board-read budgets in §5. Downstream
  architecture has to guess which the budget was written against.
- **§6 and §5 disagree on Registry failure.** §6 says *"the Cockpit cannot
  open"*; §5's failure posture and FR-3 require it to open and render the reason.
  §6's prose should say "nothing resolves" and stop there.

---

## 3. Edge cases specifically probed

Walked and found genuinely unhandled → F1–F6 above:
page changes its declared pjid without navigating (F1); two tabs on different
Projects with work in flight (F1); two windows on the same Project (F5); a
Project whose Board was deleted or never existed (F2); a clone path that moved
after resolution (F6); a Project registered while the panel is open (F6); a
Ticket created while the list is mid-fetch (F4); a board mutated by the PM in
response to the panel's own dispatch (F4); a dispatched question whose answer
has no renderer (F3).

## 4. Probed and found covered — deliberately not reported as findings

- **Bridge dies mid-stream.** FR-5: *"A stream that dies mid-response is
  reported as failed, not left indefinitely pending."* Covered.
- **Clock skew / ordering in outcome correlation.** FR-7 pre-empts it
  explicitly: *"correlated back to the originating turn by identifier, not by
  ordering or recency."* Covered, and correctly.
- **Two tabs on the same Project.** Single-window: one panel document, one
  resolution, no conflict. Only the multi-*window* case bites (F5).
- **A page declaring no pjid after one that did.** FR-1: *"never a stale
  previous Project."* Display covered; only the in-flight *state* is not (F1).
- **Agent missing.** FR-4 in full, including the reason and the command.
- **Plane down vs. agent down vs. Bloodbank down.** §5 failure posture plus §6's
  per-dependency blast radius. Covered.
- **Chat history for a Project later removed from the registry.** Orphaned
  history is unaddressed, but the cost is a few KB of dead storage on one
  workstation. Immaterial; not raised.
- **Extension reload invalidating content-script contexts.** addendum §C,
  dev-loop bullet. Covered.
- **PNA breaking loopback on a Chrome update.** §5 plus §12 Q7, with an
  unconditional mitigation. Covered better than most PRDs manage.

## 5. Not raised by calibration

Single-operator, single-workstation, hobby stakes — the PRD declares these
non-goals and the declarations are correct: no Bridge↔extension auth on
loopback, no tenancy or multi-user model, no compliance or data-governance
treatment, no stakeholder/approval/rollout process, no ROI or market analysis,
no quantitative success-metric rigour beyond the behavioural ones in §11, no
hardening of a single-operator localhost daemon. Raising any of these would be
a failed review, not a thorough one.

## 6. Verdict

The failure-path thinking in this PRD is well above average — FR-3's four-state
taxonomy, FR-7's explicit rejection of ordering-based correlation, and §5's
failure posture are the work of someone who has been burned before. The gap is
consistent and narrow: **the document specifies states thoroughly and
transitions barely.** Every finding above is a transition — switching Project,
changing pjid, a second window opening, a board changing under a rendered list,
a cache aging, a classification going the wrong way. FR-2's cache, §5's
surviving panel state, and FR-9's single fetch trigger are each individually
reasonable and collectively produce a Cockpit that is correct when it opens and
drifts thereafter, with no specified moment of re-truth.

F1 and F2 should be closed before `bmad-create-architecture`: F1 because the
architecture's state-ownership model depends on the answer, F2 because a quarter
of the registry hits it on day one and the fix is a two-sentence FR. F3–F6 can
be closed during epic breakdown.
