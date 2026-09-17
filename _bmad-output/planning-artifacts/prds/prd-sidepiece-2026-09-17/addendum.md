# Sidepiece PRD — Addendum

Depth that belongs downstream (architecture, UX, epics) rather than in the PRD's
main narrative: rejected alternatives and their rationale, mechanism and
transport decisions, and technical constraints that bound the requirements
without being requirements themselves.

---

## A. Rejected alternatives

### A.1 Resolution: Traefik-label registry (rejected 2026-09-17)

The June model matched the active tab's URL against a registry built from Traefik
routes and a repo inventory. It carried three problems that the declaration model
eliminates outright rather than mitigates:

1. **Origin-coupled.** Only Traefik-served hosts could resolve. Local dev servers
   were explicitly distrusted to avoid false positives — meaning the tool was
   useless during the activity where you most want it.
2. **Inference, not fact.** URL matching produces confidence scores and therefore
   wrong answers. §5's "cost of being wrong" makes a confidently wrong Project
   the worst outcome in the system.
3. **Two sources of truth.** Traefik config and the pjangler Registry had to agree,
   and nothing kept them in agreement.

The declaration model inverts it: the page asserts its own identity, so origin is
irrelevant and resolution is exact. The cost is a bootstrapping burden — every
Project must emit the declaration before it is visible (§12 Q4).

### A.2 Bridge transport: Native Messaging (rejected)

No port, no CORS surface, no private-network-access exposure, and the helper's
lifetime is tied to Chrome's. Rejected on debuggability: stdio framing cannot be
exercised with `curl`, and FR-12 makes out-of-band inspection a hard requirement.
A component that can only be driven through the extension makes every bug a
two-variable bug. Registration is also per-browser-profile, which is friction on
every reinstall.

### A.3 Bridge transport: extend an existing 33GOD service (rejected)

Extending holocene or candystore to expose resolve/chat/tickets avoids a new
process to supervise. Rejected on coupling: it binds Sidepiece's release cadence
to a service with unrelated consumers, and it puts filesystem and pjangler
execution into a service that currently has no business doing either.

### A.4 Chat: streaming-only, and dispatch-only (both rejected)

Streaming-only was the June D-epic model. It has no answer for a turn that takes
twenty minutes; the panel appears hung, and a progress story gets bolted on later
in the worst possible place. Dispatch-only is architecturally cleanest and fits
the existing command gateway exactly, but a tool you cannot ask a quick question
of stops being a cockpit. The split (FR-5/FR-6) costs a classifier — the
classification is a heuristic, and FR-6's assumption biases it toward dispatch
because that failure direction is merely mildly annoying rather than blocking.

---

## B. Mechanism and transport notes

### B.1 Bloodbank naming — the operative constraint

```
type     bloodbank.<domain>.<entity>.<action>          4 tokens
subject  bloodbank.<kind>.<domain>.<entity>.<action>   5 tokens, kind = evt|cmd|rpy
```

- Versioning lives only in `schemaref` / `dataschema`. No `version` envelope
  field, no `v1` token in a type.
- Identity — repo, agent, ticket, project — lives in `data.*` and `actor.*`.
  Never as a token.
- Shape-valid is not contract-valid: a well-formed 4-token type whose action is
  not in the allowlist is refused.

Consequences for Sidepiece:

- Project-scoped event retrieval is a `data.repo` filter through Candystore, not
  a NATS subject subscription. This is the single most important correction this
  PRD makes to both source documents (PRD §6).
- Any new producer runs `bb contract` and `bb emit --check --type <type>` before
  publish. `bb emit` derives `subject`, `schemaref`, `dataschema`, `kind`,
  `domain` and `actor` — none of those are hand-written.
- There is no `publish.sh`. Instructions naming one are stale.

Prior art worth not repeating: the scrum-master's `repo.issue.*` family was
retired 2026-08-28 because it embedded a repo slug in the type *and* used an
entity outside the allowlist. It had no correct migration target, so it was
deleted rather than renamed.

### B.2 Credentials

Plane credentials resolve from 1Password by item UUID, not by title — the vault
contains duplicate titles and a title-based `op://` reference to a duplicated
name cannot resolve. The Sidepiece board's key is
`op://DeLoSecrets/dlxun2xmwhkt54ns77l4gagrdq/apiKey`; the other item titled
"Plane" returns 403.

### B.3 Ticket provider indirection

`.project.json` already models the provider abstractly (`ticket_provider.type`),
and the Hermes PM ships a provider shim (`.scripts/providers/plane.sh`). The
Bridge should resolve the provider from `.project.json` rather than hardcoding
Plane, even though Plane is the only implementation in v1. The abstraction
already exists upstream; ignoring it creates a second model of the same thing.

---

## C. Chrome MV3 constraints bounding the requirements

Constraints, not requirements — they explain why several FRs are shaped as they
are. Verified against the capability research in §D.

- **Side panel opening requires a user gesture.** `chrome.sidePanel.open()`
  cannot be called from a navigation handler. Sidepiece therefore cannot
  auto-open when a Project is detected. The extension icon carries the
  "this tab is resolvable" signal instead (PRD §5).
- **Panel options are per-tab.** `sidePanel.setOptions({ tabId, ... })` scopes
  the panel per tab, which is what lets the Cockpit follow the active tab.
- **The service worker is terminated aggressively when idle.** Long-lived
  connections — SSE for chat streams, event subscriptions — must live in the
  panel document, which has a normal document lifetime while open. A stream
  owned by the service worker dies unpredictably. This directly shapes PRD §5
  and FR-8's persistence requirement.
- **`captureVisibleTab` captures the visible viewport only**, not the full page,
  and needs a broad host permission. This bounds the deferred snapshot feature
  (PRD §9).
- **Stable selector generation** is a solved-ish problem with known libraries
  (`medv/finder`, `css-selector-generator`, `optimal-select`). All share the same
  failure modes: hashed CSS-in-JS class names, `nth-child` brittleness under
  re-render, and shadow DOM boundaries. This is why the deferred element-picker
  payload carries context alongside the selector rather than relying on it alone.
- **Reading `<head>` on every navigation** is cheapest via a declarative content
  script with a broad host match. Broad host permissions trigger a wide-scope
  install prompt — irrelevant for a personally-loaded extension, relevant if the
  non-goal in PRD §7 is ever revisited.

---

## D. Capability research digest

*Pending — the MV3 capability research subagent's digest lands here, and any
finding that contradicts §C corrects §C rather than being appended to it.*

---

## E. Prior art: the SIDE board

The per-epic verdict table lives in PRD §10 because
`bmad-create-epics-and-stories` needs it as a first-class input. What belongs
here is the pattern, for the retrospective:

44 tickets were created on 2026-06-23 directly from a product brief, with no PRD
and no architecture between them. Zero were ever started. The tickets named
implementation targets (`GET /resolve?url=`, "holocene fleet client") that
encoded an architecture nobody had written down, so when the resolution model
changed in a single braindump revision, roughly a third of the board silently
became wrong — and nothing in the board could detect that. The board had the
*form* of a plan without the decisions a plan is made of.
