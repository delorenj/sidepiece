---
title: Downstream Consumability Review — Sidepiece PRD
reviewer: acid-test (standing in for bmad-create-architecture and bmad-create-epics-and-stories)
date: 2026-09-17
target: prd.md (2026-09-17) + addendum.md
---

# Downstream Consumability Review

**Calibration acknowledged.** Single operator, single workstation, hobby stakes. Loopback
trust boundary, absent tenancy, no rollout process, and behavioural-only success metrics are
deliberate and correct; none of them appear below. Everything here is a structural defect that
would make an architecture or epics workflow either stop and ask, or generate something wrong.

**Bottom line.** This is a genuinely strong PRD — the declaration model is stated crisply, the
§5 NFRs are unusually load-bearing, and the addendum's rejected-alternatives section pre-empts
most of the "why not X" that architecture would otherwise re-litigate. It fails the acid test in
one place badly (the stream-vs-dispatch classifier has no requirement at all) and in four places
recoverably. §10 is the weakest section relative to its stated job.

---

## Question 1 — Can architecture decide everything without asking the author?

**No.** Four unmade decisions beyond the already-flagged §12 Q1.

### Walk of the 13 FRs

| FR | Architecture can decide alone? | Note |
|---|---|---|
| FR-1 | **No** | Whether a `pjid` can change within one document's lifetime is a product fact, not an architecture choice. See A1 below. |
| FR-2 | Yes | Q3 (shell out to `pj info` vs library) is a real choice but architecture owns it; the latency budget bounds it. Cache invalidation rule is unstated but inferable ("panel session"). |
| FR-3 | **No** | The state set is declared exhaustive and is not. See A2. |
| FR-4 | **No** | "Has a PM" is ambiguous between *provisioned in the Registry* and *reachable on the gateway*; §6 requires both to render distinctly and no FR says so. Folded into A2. |
| FR-5 | **No** (beyond Q1) | "Does not lose the turn" across a panel close contradicts §5 and implies a Bridge capability no FR requires. See A4. |
| FR-6 | **No** | The classification rule that decides FR-5 vs FR-6 does not exist. See A0 — the single biggest hole in the document. |
| FR-7 | **No** | Entirely contingent on §12 Q2, which carries no blocking tag. See A3. |
| FR-8 | Yes | Storage location (extension `chrome.storage` vs Bridge-side) is architecture's call; addendum §C already relaxed the burden. Retention/pruning unstated but harmless. |
| FR-9 | Yes | — |
| FR-10 | Yes | Behaviour when the Project has no Board binding is unspecified, but that is a state gap (A2), not a transport choice. |
| FR-11 | Yes | Dependency enumeration is wrong (A2) but the mechanism is clear. |
| FR-12 | Yes | systemd user unit. "Every capability the extension uses is reachable without the extension" is unenumerated — see Q2 §B. |
| FR-13 | Yes | `op://` by item UUID, per addendum §B.2. "at process start **or** per-request" leaves a choice architecture can make. |

### A0 — The stream-vs-dispatch classifier is not a requirement anywhere (CRITICAL)

§4.2 is built entirely on splitting a turn into Streamed Exchange or Dispatched Command. That
split is the feature. Yet:

- FR-5 scopes itself to "Short conversational turns" — undefined.
- FR-6 scopes itself to "Turns that assign work" — undefined.
- The only statement of the rule is an `[ASSUMPTION]`: *"Sidepiece decides stream-vs-dispatch and
  does not ask … the classifier should bias toward dispatch when uncertain."*
- Addendum §A.4 adds only *"The split (FR-5/FR-6) costs a classifier — the classification is a
  heuristic."*

Architecture cannot pick between a keyword/verb heuristic, an LLM pre-pass, and a user-visible
mode toggle, because the choice trades accuracy against latency and cost and the PRD never says
what accuracy is acceptable. Epics cannot write a single acceptance criterion for it.

**Worse, the assumption's own justification is contradicted by the document.** It claims getting
it wrong is "cheap in one direction (a question dispatched still gets answered)". But the Glossary
defines a Dispatched Command as *"Acknowledged, not answered"*, and FR-7's only consequences are a
terminal status — completed, failed, timed out. There is no specified path by which a misclassified
question's *answer* reaches the panel. Given the assumption deliberately biases toward dispatch,
the common failure is the one with no specified recovery.

**Fix:** add FR-5a "Classify a chat turn" with a stated decision rule (even a crude one: imperative
verb + an allowlist of work verbs → dispatch; everything else → stream), a testable consequence
for at least three example turns per branch, and a manual override affordance so a misclassification
is recoverable in one click. Then either specify how a dispatched turn's free-text reply renders,
or delete the "still gets answered" claim from the assumption.

### A1 — FR-1's static-HTML assumption and its SPA consequence cannot both hold (HIGH)

FR-1's assumption: *"the declaration is a meta tag in `<head>` … it must work on a static page with
scripting disabled."*
FR-1's consequence: *"A client-side route change that replaces the page without a document load
re-triggers detection."*
Addendum §C's recommended default: *"a `MutationObserver` on `<head>` in the already-injected
content script — cheapest, needs no additional permission, and the recommended default."*

These are mutually exclusive in the common case. A `MutationObserver` on `<head>` fires only if
page JS mutates the declaration. If the declaration is static-served and scripting-independent, a
history transition changes nothing in `<head>` and the observer never fires — so the recommended
mechanism cannot satisfy the requirement. If the SPA *does* rewrite the tag per route, the
declaration is JS-produced and the "scripting disabled" requirement is violated.

The unstated product fact is: **can one document declare more than one pjid over its lifetime?**
If no — and for a single-app SPA it almost certainly is no — then the SPA consequence is asking
for detection work that has no observable effect, and the real requirement is re-*render* on tab
activation, which FR-1 already covers separately ("Switching browser tabs re-evaluates against the
newly active tab"). Architecture cannot resolve this; it is a statement about how projects serve
pages.

**Fix:** state whether pjid is per-document or per-route. If per-document, delete the SPA
consequence and keep only late-injection handling ("detection succeeds if the declaration appears
after `DOMContentLoaded`"). If per-route, drop "scripting disabled" from the assumption and say so.

### A2 — FR-3 declares an exhaustive state set that is provably incomplete (HIGH)

FR-3's preamble: *"Every way resolution can fail is distinguishable in the UI."* Its consequence
enumerates exactly four. At least three more required states are asserted elsewhere and owned by
no FR:

1. **Project resolves but has no Board.** The Glossary permits it explicitly — a Project has
   *"at most one Board"*. FR-9 and FR-10 have no consequence for a Project with zero Boards, and
   FR-3's four states do not include it. This is the exact symmetric case that FR-4 handles for a
   missing Agent, and it was simply not done for the Board.
2. **Agent provisioned but gateway unreachable.** §6 asserts it renders *"as agent-unreachable,
   distinct from no-agent-provisioned"*. FR-4 has only two branches (PM / no PM). Nothing requires
   the third rendering §6 promises.
3. **Registry down while the Bridge is up.** §6 says *"Total. Nothing resolves; the Cockpit cannot
   open."* This contradicts FR-3 (*"No failure state renders as an empty or loading panel"*), §5's
   failure posture (*"Every pane fails independently and says why"*), and §5's gesture constraint,
   under which the panel opens on a click regardless of backend state. The panel opens; it renders
   a Registry-unhealthy state. §6's cell is simply wrong.

**Corroborating hygiene defect in the same cluster:** FR-11 enumerates four downstream
dependencies — *"Registry, Plane, Bloodbank, or Agent gateway"* — while §6 lists six. Candystore
and 1Password are omitted, yet FR-13 explicitly requires *"A failed credential resolution surfaces
as an unhealthy dependency in FR-11, naming which one."* FR-11 as written cannot satisfy FR-13.

**Fix:** replace FR-3's four-item list with a state table covering every failure mode named in §6
plus no-Board; add a no-Board consequence to FR-9/FR-10; add an agent-unreachable branch to FR-4;
correct §6's Registry row; extend FR-11's dependency list to all six.

### A3 — §12 Q2 blocks an MVP requirement and is not flagged as blocking (HIGH)

Q1 carries **"Blocks architecture."** Q4 carries "Sequencing risk". Q6 carries "Affects §9 only".
Q7 carries "Verify empirically". Q2 carries no disposition at all:

> *"Does the command envelope carry a correlation id that the outcome event preserves, and does
> Candystore index it?"*

FR-7 is in §8.1 MVP scope and its central consequence is *"Outcomes are correlated back to the
originating turn by identifier, not by ordering or recency."* If the envelope does not carry a
preserved correlation id, or Candystore does not index it, FR-7 is not implementable and the
fallback the PRD explicitly forbids (ordering/recency) is the only option left. This is exactly as
blocking as Q1 and is presented as an open curiosity.

Compounding it, FR-7's third consequence — *"A dispatch with no observed outcome within a configured
window is shown as unknown"* — names no default value and no configuration surface. The only
settings surface in the document, "Tray settings page", is deferred in §8.2. An engineer has
nowhere to put the setting and no number to hard-code.

**Fix:** tag Q2 "Blocks architecture", and verify it against `bb contract` before the architecture
pass. State a default window (e.g. 90s) and either name where it is configured in v1 or make it a
constant.

### A4 — FR-5's mid-stream survival contradicts §5 and implies an unrequired Bridge capability (MEDIUM-HIGH)

FR-5: *"Closing and reopening the panel mid-stream does not lose the turn."*
§5 Panel lifetime: *"All long-lived connections — chat streams, event subscriptions — live in the
panel document … it does not survive the panel closing … Work whose outcome arrives while the panel
is shut is reconciled on next open rather than streamed to a listener that isn't there."*

For a *stream*, "reconciled on next open" requires the Bridge to hold the in-flight turn, keep
accumulating tokens with no client attached, and replay or hand back the completed text. §4.4's
FRs cover health (FR-11), lifecycle (FR-12), and credentials (FR-13) — none of them require the
Bridge to own a chat session at all. Architecture would have to invent a stateful turn buffer and
guess the guarantee: does reopening resume streaming from the last delivered token, or just show
the finished answer? Does a turn survive a Bridge restart?

**Fix:** define what "does not lose the turn" guarantees (recommend: the completed answer is
retrievable on reopen; partial tokens are best-effort), and add a Bridge FR requiring server-side
turn state keyed by pjid + turn id, surviving panel close but not Bridge restart.

---

## Question 2 — Can epics-and-stories produce implementable stories?

**Mostly yes.** 9 of 13 FRs have at least one crisply testable consequence an engineer could turn
into an AC verbatim. FR-9, FR-10, FR-12, FR-13, FR-8, FR-3, FR-2, FR-1 and FR-11 are in good
shape — FR-10's *"omitting state uses the Board's default entry state"* and FR-9's *"in the Board's
own state order, not alphabetically"* are exemplary: unambiguous, mechanically checkable, and they
foreclose the wrong implementation.

### Consequences that are not testable as written

| Location | Quote | Why it fails |
|---|---|---|
| FR-6 / FR-5 | *"Turns that assign work are published to Bloodbank as commands"* / *"Short conversational turns are answered inline"* | No boundary. Every AC for either FR begins by assuming the classification it cannot define. See A0. |
| FR-7 | *"once the corresponding outcome is observable"* | "Observable" is undefined and depends on unresolved Q2. An engineer cannot write the precondition. |
| FR-7 | *"within a configured window"* | No value, no configuration surface in MVP scope. Untestable until a number exists. |
| FR-5 | *"Closing and reopening the panel mid-stream does not lose the turn."* | "Lose the turn" admits at least three different passing behaviours. See A4. |
| FR-12 | *"every capability the extension uses is reachable without the extension"* | Quantifies over an unenumerated set. There is no endpoint list anywhere in the PRD, so "every" has no finite test. Enumerating the Bridge surface (resolve, tickets read/create, chat stream, dispatch, outcome lookup, health) would fix this and would also serve architecture. |
| FR-2 / §5 | *"Resolution completes within 1s at the 95th percentile."* (also board read ≤2s p95) | A percentile over a single operator's ad-hoc usage has no defined measurement population and no instrumentation is required anywhere. §5's Observability NFR asks only that *"Bridge request logs are readable without a log aggregator"* — it never requires timings. Either require per-request duration in the Bridge log line, or restate as a hard timeout ("renders a timeout state after 1s"), which §5 already implies. |
| FR-4 | *"The no-Agent state names the exact provisioning command."* | Testable only if the command string is given. Addendum/§9 names `pj hermes-agent`; FR-4 does not. Cheap fix: inline the command. |

Everything else passes. Note that the §4.2 Out-of-Scope line (*"Multi-turn tool approval flows"*)
and the §4.3 Out-of-Scope list are good negative ACs and should be carried into stories as such.

---

## Question 3 — Is §10 actionable?

**Partly. It is the section least ready for its stated job**, which the table's own preamble
defines as *"for `bmad-create-epics-and-stories` to act on"*.

### Verdict-by-verdict

| Epic | Verdict | Actionable? |
|---|---|---|
| A — Foundation | Survives | **Yes.** No change implied; keep tickets as-is. |
| B — Project Resolution | Rewrite | **Partly.** Names B2 and B3 and says precisely why each is wrong (*"resolves the wrong input entirely — the input is a pjid, not a URL"*) — that is a model verdict. But B's other tickets are unaddressed, and the row never names FR-1/FR-2 as the replacement target. |
| C — Plane Ticket Proxy | Survives, narrowed to FR-9/FR-10 | **No.** "Narrowed" means some C tickets die. Which ones is not said. |
| D — Hermes Chat Relay | Amend | **Partly.** Names the amendment (stream/dispatch split) but not which D tickets change or what happens to D3, which §12 Q1 explicitly resurrects as a possible fallback. |
| E — Bloodbank Event Stream | Defer and rewrite | **No.** Two verdicts at once with no ticket list. "Defer" and "rewrite" imply different actions (park vs. edit-then-park). |
| F — Agent Provisioning | Split | **No.** *"Status surfacing → FR-4 in v1; deploy action → §9"* is the right cut, but no F ticket IDs are given, so the split cannot be executed. |
| G — Extension Shell & Cockpit | Survives, amended | **Yes**, the amendment is specific (§5 gesture constraint). |
| H — Chat UI | Survives, amended | **Yes**, specific (FR-6 dispatched-turn rendering). |
| I — Tickets UI | Survives | **Yes.** |
| J — Snapshot & Annotate | Defer, widen | **Yes** for the defer; the widen is specified in §9. |
| K — Auth, Packaging, Desktop | Split | **Yes — the only fully executable row.** *"K1/K2 → FR-12/FR-13 in v1; K3/K4/K5 deferred."* This is the format every other row should have used. |

### The missing direction: FR → epic

§10 maps epics forward but never maps FRs back. Running the reverse check, **five of the thirteen
MVP FRs appear nowhere in §10**: FR-1, FR-2, FR-3, FR-8, FR-11.

- FR-1/FR-2 are presumably what epic B is rewritten *into*, but the row never says so.
- FR-3 (the four unresolved states), FR-8 (per-Project conversation continuity) and FR-11 (Bridge
  health observability) have no board lineage at all. They are new work with no signal that they
  are new.

An epics workflow reading §10 top-down will produce epics for A–K and silently drop FR-3, FR-8 and
FR-11 — the same class of failure the addendum's §E autopsy diagnoses in the original 44 tickets.

**Fix:** add a ticket-ID column to §10 (K's row shows the format), and append a short FR→epic
coverage table that names the new epics for FR-3, FR-8 and FR-11 explicitly.

---

## Question 4 — Glossary and ID hygiene

### FR IDs: clean

FR-1 through FR-13, contiguous, each defined exactly once, no gaps, no duplicates. Section numbering
0–13 is contiguous. §8.1 lists all 13 FRs, matching the §4 definitions exactly. §13's assumptions
index has exactly six entries and every inline `[ASSUMPTION]` tag is one of them — that index is
complete and correct.

### Cross-references: one broken, one false

1. **§0 points at the wrong section.** *"inferences are tagged `[ASSUMPTION]` inline and indexed in
   §11."* §11 is Success Metrics; the Assumptions Index is **§13**. A downstream workflow following
   the document's own navigation instruction lands on the wrong section.
2. **§8.2 makes a false completeness claim.** *"Everything below is specified in §9 rather than
   dropped."* §9 has six entries; §8.2 has seven bullets. **"Desktop shell (Tauri)" has no §9
   entry.** It is exactly the one item the note says to consider deleting — but as written the
   claim is untrue.
3. All other `§n` references resolve: §3, §4, §4.1, §4.4, §5, §6, §7, §8, §9, §10, §12 and the §2.2 /
   §4.1 / §4.2 / §5 / §9 anchors in §13 are all correct. Addendum→PRD references (§5, §6, §7, §9,
   §12 Q7) all resolve. §13's *"confirmed against the MV3 capability research in `addendum.md` §D"*
   is slightly off-target — §D explicitly says *"Findings are folded into §C above … §C is the
   operative version"* — so the pointer should be §C (or §C/§D).

### Synonym drift: one real instance, one minor

**"Cockpit" vs "panel".** The Glossary fixes *Cockpit — The Chrome side panel UI* and warns
*"Introducing a synonym anywhere is a discipline violation."* "Cockpit" is used 8 times; a bare
"the panel" is used 22 times as the same noun (UJ-1 *"The panel already shows Holocene resolved"*,
FR-5 *"the panel never shows only a spinner"*, FR-8 *"survives the panel closing"*).

This is not pedantry, because **"panel" is overloaded with a distinct technical meaning.** §5 and
addendum §C use "panel document" for the MV3 side-panel document — a lifecycle object with its own
rules. FR-2 and FR-5 then use "the panel session" without saying whether that means the Cockpit's
logical session or the document's lifetime. Given §5 makes the document's lifetime load-bearing for
FR-5, FR-7 and FR-8, an architect has to guess which one "panel session" scopes the resolution
cache to. **Fix:** use "Cockpit" for the UI concept, "panel document" for the MV3 object, and define
"panel session" in the Glossary as one of the two.

**"turn" is undefined.** It appears 18 times and is the unit FR-8 persists (*"restores that
Project's prior turns"*), the unit FR-6 dispatches, and the thing FR-5 must not lose. The Glossary
defines Streamed Exchange and Dispatched Command *in terms of* "a chat turn" but never defines a
turn. Is it a user message, or a user message plus its response? FR-8's story depends on the answer.
Add it to §3.

**Minor lowercase drift** (§1 *"a local bridge"*, *"the full project record"*, *"Plane board"*;
UJ-1 *"the ticket box"*; UJ-3 *"if the bridge is down"*). Prose sections, low harm, but §3 says
"verbatim everywhere" and §1 is the first thing a downstream workflow reads.

---

## Additional findings (below the top six, worth fixing)

### B1 — FR-6's subject-validation consequence contradicts addendum §B.1

FR-6: *"The subject conforms to the five-token contract and is validated before publish."*
Addendum §B.1: *"`bb emit` derives `subject`, `schemaref`, `dataschema`, `kind`, `domain` and
`actor` — none of those are hand-written"*, and the validation command is
`bb emit --check --type <type>` — i.e. you validate the **4-token type** against the action
allowlist, because *"Shape-valid is not contract-valid"*.

As written, FR-6 tells an engineer to construct and validate a subject, which the toolchain
explicitly forbids hand-writing. A story generated from FR-6 verbatim will build the wrong thing.
**Fix:** restate as *"The command type is in the `bb contract` allowlist, verified with
`bb emit --check --type <type>` before publish; the subject, kind, domain and actor are derived by
`bb emit` and never constructed by Sidepiece."*

### B2 — Addendum §B.3 states a Bridge requirement that no FR carries

*"The Bridge should resolve the provider from `.project.json` rather than hardcoding Plane, even
though Plane is the only implementation in v1."* This is a requirement in requirement's clothing —
it constrains the Bridge's data path and it is the kind of thing that never gets built if no story
names it. §4.3 and §4.4 both hardcode Plane in every consequence; §6 lists Plane directly.

It also undercuts §12 Q5's own disposition. Q5 says the `.project.json` `project_slug` →
`project_id` rename is *"Unrelated to Sidepiece's design"* — but §B.3 makes `.project.json` a direct
Bridge input, so the rename is a direct dependency of a Bridge code path, not an unrelated
annoyance. Either promote §B.3 into an FR-10 consequence ("the ticket provider is resolved from
`.project.json`'s `ticket_provider.type`, not hardcoded") and drop "unrelated" from Q5, or state
explicitly that v1 hardcodes Plane and §B.3 is a v2 note.

### B3 — §12 Q3 is fine, but note the interaction with the latency budget

Q3 (*"`pj info <pjid>` shelling out, or a library/MCP surface?"*) is correctly left to architecture.
Worth noting for whoever answers it: FR-2 caches per pjid for the panel session, so the shell-out
cost is paid once per Project per session, which almost certainly fits the 1s budget. Architecture
has enough here; no author input needed.

---

## What is strong and should not be touched

- **§5 is the best section in the document.** "Cost of being wrong" (*"the Bridge rejects a mutation
  whose pjid does not match the Board it targets"*) is a requirement architecture can implement
  directly, and it is the correct invariant for this product.
- **§6's Bloodbank subject-grammar correction** is the highest-value paragraph in the PRD — it
  catches a factual error in both source documents and converts it into a concrete design
  constraint (payload filter, not subscription) that propagates correctly to FR-7 and §9.
- **The addendum's §A rejected-alternatives section** does exactly what it should: architecture will
  not re-propose Native Messaging or extending holocene, because both are killed with a reason tied
  to a specific FR.
- **§13's "Verified, no longer assumptions" block** is a discipline most PRDs skip. Keep it.
- **Counter-metrics SM-C1/SM-C2** are honest and correctly scoped to a solo tool.
