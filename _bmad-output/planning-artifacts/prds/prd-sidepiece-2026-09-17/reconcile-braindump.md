# Reconciliation: `BRAINDUMP.md` (2026-09-17) → PRD + Addendum

**Source input:** `/home/delorenj/code/sidepiece/BRAINDUMP.md` — declared source of truth, rewritten 2026-09-17.
**Targets:** `prd.md`, `addendum.md` (same directory).
**Question answered:** what is in the braindump that appears *nowhere* in either PRD document, and was not explicitly declared out of scope.

The braindump is short — 75 lines — and the PRD is 20x its length, so the losses are not bulk omissions. They are **compressions**: places where a stated decision became an open question, where a stated preference became a neutral deferral, where a named machine became a generic one, and above all where the braindump's *feel* for what this thing is got replaced by a different and narrower thesis. Those are catalogued first because they are the ones a functional-requirement structure drops without leaving a hole.

---

## 1. Qualitative losses — tone, motivation, texture

### 1.1 The braindump wants a dense cockpit; the PRD wants a correct resolver

This is the single largest divergence and it is entirely tonal, so nothing in the PRD's structure flags it.

The braindump's closing image of the product (lines 49–51):

> "This would turn the sidebar into a **live project cockpit**: current URL, local repo, agent, tickets, screenshots, and repo-specific operational messages **all in one place**."

Seven things, simultaneously present. The value proposition is *density* — the ambient, at-a-glance co-presence of everything about a project while you are looking at its output. "Cockpit" is a place you sit in.

The PRD's counter-thesis (§1):

> "The value is **not any single pane**. It is that the resolution is automatic and correct."

The PRD relocates the value from *what is shown* to *how reliably the right project was identified*. That is a defensible and arguably better product thesis — but it is the PRD's thesis, not the braindump's, and it is nowhere attributed as a change. Downstream (`bmad-ux`, epics) will read §1 as the author's intent when it is a substitution for it.

The substitution is then **enforced** by two mechanisms the braindump would not endorse:

- **SM-C1** ("Panel open time... If I'm *living* in the panel rather than dipping into it, the loop got heavier, not lighter") makes dwell time a *failure* signal. The braindump asked for a cockpit. You live in a cockpit. This counter-metric penalizes the braindump's stated goal.
- **SM-C2** ("Feature count... Shipping §8 and stopping beats shipping §9 late") institutionalizes the narrowing.

Related sub-losses, all in the same family:

- **"compact project dashboard"** (line 18). "Compact" is a form constraint — it says the panel should be information-dense rather than roomy, several things visible without scrolling. It appears nowhere. The PRD's "Cockpit" glossary entry is scope-defining ("scoped to exactly one resolved Project at a time"), not form-defining. UX will have no instruction on density.
- **"a quick view of the project's status"** (line 10). A *status* surface, distinct from tickets and chat. The PRD's FR-2/FR-4 resolve status data into a Project Record but never require it be *rendered* as a glanceable pane. "Show the matched repo, local path, Hermes agent status, and Plane board" (line 58) is a display requirement in the braindump; in the PRD it survives only as resolution output.
- **"agent activity"** (line 10) is listed as a first-class pane alongside chat, board, and annotation. The PRD has no "agent activity" concept in v1; the nearest thing is the deferred agent-session list (§9), which answers a different question ("is something already working on this repo?").
- **"current URL"** in the cockpit inventory (line 50). Never mentioned in the PRD. Trivial on its own; part of the density picture.
- **"immediate control surface"** (line 5) and **"As soon as it does, it shows a sidebar"** (line 10). The immediacy intent is *partly* honoured — PRD §5 correctly establishes that Chrome forbids auto-open and routes the signal through the extension icon. That is a good, well-sourced correction. What is lost is that the braindump's word was *shows*, not *offers* — the author's mental model is a panel that is simply there. The PRD's resolution is right; the residual friction it introduces (one click, every time, forever) is never acknowledged as a cost against a stated goal.

**Why this matters:** the braindump listed six capabilities under "the first useful version" (lines 21–29). The PRD ships two of them. Each individual deferral *is* explicitly declared (§8.2, §9) — so no single one is a silent loss — but the **claim that those six together are what makes v1 useful** is nowhere in the PRD, and the PRD's success metrics argue the opposite. The scope cut is declared; the disagreement with the source of truth about what "useful" means is not.

### 1.2 "Instead of passing screenshots, I can pass unique selectors"

Line 10, verbatim:

> "...an annotation tool that let's me select html elements to associate with a message to the agent. **Instead of passing screenshots, I can pass unique selectors.**"

This is a *preference with a reason*: the element picker is not a sibling of the snapshot feature, it is meant to **replace** it. The author's premise is that a selector is a cheaper, sharper, more machine-actionable way to say "this thing here" than an image.

Both PRD documents drop the preference and then invert the premise:

- §9 lists "Snapshot and annotate" and "Element picker" as two co-equal deferred items, with no relationship between them.
- §10 instructs epics to take EPIC J ("Snapshot & Annotate") and "**widen** to include the element picker" — subordinating the thing the author preferred to the thing he offered to give up.
- §9's assumption states "a bare selector is useless to an agent that cannot see the page, so context is part of the payload" — a direct contradiction of "instead of passing screenshots," argued but never marked as a reversal of the source.

The addendum §C then adds substantial selector-generation research (libraries, failure modes, priority order) which is genuinely useful — but it reads as risk-mitigation for a nice-to-have rather than as investment in the mechanism the author said he wanted to use *in place of* images.

**Not a scope question.** Both are deferred either way. What is lost is the *ordering*: when §9 is finally built, nothing tells the builder which one the author actually wanted.

### 1.3 The author's own framing of the annotation loop

Braindump capability 3 (lines 25–26): "Capture a snapshot of the current page, **draw on it**, and attach the annotated image to a message sent to the agent." The drawing is the point — freehand markup as a communication act, not just a screenshot. PRD §9 keeps "draw on it" (good). No loss here; noted for completeness because it is the one qualitative detail the PRD *did* preserve verbatim.

---

## 2. Substantive content losses

### 2.1 Annotated snapshots attached to **tickets**, not just chat messages

Braindump open question (lines 73–74):

> "What payload shape should annotated snapshots use when they are attached to agent messages **or tickets**?"

The ticket destination is dropped everywhere:

- §9 "Snapshot and annotate" — "attach to a **chat turn**." Chat only.
- §4.2 Out of Scope — "Attaching files." (chat attachments explicitly excluded from v1)
- §4.3 FR-10 — ticket create takes title, optional description, optional state. No attachment surface, and §4.3's out-of-scope list ("Editing an existing Ticket. Moving... Assigning, labelling, commenting, or deleting") does not mention attachments, so this is absence rather than exclusion.
- §12 Q6 preserves *only* the element-picker payload question. The snapshot payload question — which is what the braindump actually asked — is gone.

This matters because "screenshot a broken render → file it on the board" is the most obvious realization of UJ-1, and the PRD's own UJ-1 narrative ("On `holocene.delo.sh`, something renders wrong... He types a title into the ticket box") describes exactly that situation with the image stripped out.

### 2.2 The Bridge's host is assumed, and the braindump's own question named a different machine

Braindump open question (lines 69–70):

> "What is the cleanest bridge between the Chrome extension and local **Big Chungus** paths?"

The PRD answers a *generic* version of this question and never engages with the named machine. §4.4 defines the Bridge as "A daemon **on the workstation**"; §2.2 assumes "a single operator on a **single workstation**"; §5 binds it "to loopback only"; §4.4's out-of-scope line is "**Remote or off-workstation access**."

That chain silently collapses two machines into one: the machine running Chrome, and Big Chungus, where the repos and the pjangler registry live. The braindump's phrasing ("the Chrome extension **and** local Big Chungus paths") presupposes a gap to be bridged. The PRD assumes there is no gap, and then declares closing the gap out of scope.

If Chrome ever runs anywhere other than Big Chungus — a laptop, a second desktop, a tailnet client — then loopback-only is not an implementation detail that can be revisited later, it is the wrong transport, and §5's "Revisit only if the Bridge ever binds beyond loopback" is the exact assumption that breaks. This is the one dropped item that could invalidate an architecture rather than a feature. It is not tagged as an `[ASSUMPTION]` and does not appear in §11's assumptions index or §13's.

### 2.3 `pj info <pjid>` + parse output was a **decision**, demoted to an open question

Braindump, "The PJangler Registry" (line 14):

> "The extension can then resolve the linked metadata by **running `pj info [pjid]` and parsing the output**."

PRD §12 Q3:

> "**Which pjangler surface does the Bridge call?** `pj info <pjid>` shelling out, or a library/MCP surface? Shelling out is simplest and slowest; it may or may not matter at this latency budget."

The source of truth specified a mechanism; the PRD reopened it. The re-opening is reasonable engineering (the latency budget is real, and `pj info` shell-out inside a ≤1s p95 is worth testing), but it is presented as an unanswered question rather than as a challenge to a stated decision. Downstream, an architect reading Q3 has no idea the author already picked one.

Same pattern, lower stakes, on the declaration site: braindump line 14 states projects "**must** advertise their pjid in the html `<head>`" as a flat requirement. PRD FR-1 renders it `[ASSUMPTION: the declaration is a meta tag in <head>. Exact attribute naming is an architecture concern...]`. The `<head>` location is not an assumption — the source asserted it. (The PRD's added requirement — "readable without executing page JS" — is a genuine and valuable sharpening, and should be kept.)

### 2.4 The pjid mandate is an ecosystem-wide obligation, not just a bootstrap risk

Braindump line 14: "**To enable Sidepiece, all pjangler-backed projects must advertise their pjid**."

The PRD does capture the consequence — §12 Q4 flags it as a "**Sequencing risk, not a design risk**" and addendum §A.1 calls it "a bootstrapping burden." That is adequate coverage of the *risk*. What is not carried through is that the braindump states it as a **precondition on the whole pjangler fleet** — a cross-repo change the author is committing to, which plausibly belongs to pjangler's roadmap rather than Sidepiece's. Q4's "Is that a pjangler recipe, a per-project template change, or manual?" leaves it as Sidepiece's problem to wonder about. Low severity, listed for completeness.

### 2.5 The deploy-agent action was inside the braindump's MVP

Braindump MVP item 6 (line 62): "Show a clear 'no agent found' state **with a deploy-agent action**." And lines 38–40: "**Ideally, there is a one-click action** that uses `pjangler` or the Hermes agent tooling to deploy the project manager agent **non-interactively**."

The PRD moves this out of v1 — FR-4's `[ASSUMPTION: v1 states the command; it does not run it. One-click deploy is deferred — see §9]`, §7 "Not a deployment tool", §8.2, §9.

**This is explicitly declared out of scope and therefore not a silent loss.** It is recorded here only because the braindump put it in MVP and used the word "Ideally," which is a soft signal the author would trade it — the PRD's read is probably right. No action needed beyond confirming the author agrees.

### 2.6 Minor items, verified present in the PRD

For completeness, these braindump items were checked and *are* carried:

| Braindump item | Where it lands |
|---|---|
| Watch active tab, detect registered project | FR-1 |
| Resolve to repo + metadata | FR-2 |
| Chat box → project's Hermes PM | FR-5 (split with FR-6, an addition) |
| View and add tickets on Plane board | FR-9, FR-10 |
| Candystore feed of recent bloodbank events | §9, deferred |
| Agent-session list (claude/codex/kimi), reverse-chron | §9, deferred |
| Tray settings page + recent projects by activity | §9, deferred |
| Agent-present / agent-absent detection | FR-4 |
| `bloodbank.repo.<repo-name>` subject filter | §6 — **corrected**, correctly and with authority |
| Traefik-URL resolution (MVP item 1) | Addendum §A.1 — **superseded**, correctly documented |
| Auth to Hermes/Plane/Candystore/Bloodbank | FR-13 + §5 trust boundary |
| Registry-source open question (line 67 fragment) | Moot under the declaration model |

---

## 3. Recommended dispositions

| # | Loss | Suggested action |
|---|---|---|
| 1 | Cockpit density as the value proposition | Add a paragraph to §1 or §4 acknowledging the braindump's "all in one place" thesis, and either adopt it or state explicitly that v1 trades density for correctness. Re-word SM-C1 so it does not penalize the author's stated goal. |
| 2 | Snapshot attached to a **ticket** | Add to §9's snapshot entry: destination is a chat turn **or a ticket**. Restore the payload-shape question to §12 alongside Q6. |
| 3 | "Selectors instead of screenshots" | Record in §9 that the element picker is the author's *preferred* mechanism and the snapshot its fallback. Reverse §10's EPIC J instruction: widen the picker to optionally include a snapshot, not the other way round. |
| 4 | Big Chungus vs. "the workstation" | Add an explicit `[ASSUMPTION]`: Chrome and the pjangler registry are on the same host. Name the host. Add to §12: what happens when they are not. |
| 5 | `pj info` shell-out | Re-word §12 Q3 to say the braindump specified `pj info <pjid>` + output parsing, and that the question is whether the latency budget permits it — not an open choice from zero. |
| 6 | `<head>` marked as assumption | Demote to a stated source requirement; keep the "no page JS" sharpening as the PRD's own addition. |
| 7 | "Compact" / status pane / agent activity | Hand to `bmad-ux` as explicit density and pane-inventory input, or state they are cut. |

---

*Generated by a reconciliation pass against `BRAINDUMP.md` (2026-09-17). Scope: silent losses only — items explicitly deferred in §8.2/§9 or corrected in §6/§A.1 are catalogued but not counted as gaps.*
