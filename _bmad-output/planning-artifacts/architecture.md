---
stepsCompleted: [1, 2]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/prd.md
  - _bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/addendum.md
  - _bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/.decision-log.md
workflowType: 'architecture'
project_name: 'sidepiece'
user_name: 'Jarad'
date: '2026-09-17'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:** 16, in four groups — Project Resolution (FR-1–5), Agent Chat (FR-6–11), Tickets (FR-12–13), and the Bridge itself (FR-14–16).

Architecturally, almost nothing here is *computed*. Nearly every FR is a read or write against a system that already exists, which makes this an **integration and state-reconciliation architecture** rather than a data-modeling one. The design work is in boundaries, lifetimes, and failure attribution — not in domain logic.

Three FRs carry disproportionate weight:

- **FR-3** enumerates six distinct failure states and is declared the single authoritative taxonomy. Every other FR that can fail must feed it rather than restate its own list. This is the requirement most likely to be quietly violated during implementation.
- **FR-6** (classify a Turn) is the premise of the entire chat feature and has no upstream equivalent — it is genuinely new behaviour the Bridge must own.
- **FR-15** makes curl-inspectability of every Bridge capability a hard requirement, which disqualifies any design whose only driver is the extension.

**Non-Functional Requirements:** 10 cross-cutting, of which four are genuinely shaping rather than aspirational — the trust boundary (tailnet, no app-level auth), failure posture (panes fail independently, never as an empty state), panel lifetime (the client dies), and the split latency budget.

The dominant constraint is not performance. It is that **the client is not durable**: the panel document does not survive closing, and the MV3 service worker is killed after ~30s idle. FR-7's reopen guarantee and FR-9's closed-panel reconciliation therefore both force the **Bridge to be the system of record for Turn state**. That single fact shapes more of this design than every latency budget combined.

**Scale & Complexity:** Three tiers with a network boundary through the middle — MV3 extension on a laptop, Bridge daemon on `big-chungus`, six upstream services behind it. Two distinct streaming protocols meet in the Bridge: JSON-RPC over WebSocket upstream, SSE downstream (SSE because FR-15 requires `curl -N` to tail it).

- **Primary domain:** full-stack — MV3 browser extension, local daemon, event-bus integration
- **Complexity level:** medium-high. Not enterprise — no tenancy, compliance, availability or scale requirements, and a single operator throughout. But not simple either: three tiers, a network boundary, two streaming protocols, asynchronous correlation, seven integrations, and a browser runtime with hard platform limits.
- **Estimated architectural components:** ~12 — content script, extension service worker, panel document, Bridge HTTP/SSE server, registry client, Hermes session manager, Plane client, Bloodbank publisher, Candystore reader, Turn store, health aggregator, credential resolver.

### Technical Constraints & Dependencies

Seven runtime dependencies (PRD §6). Discovered empirically on 2026-09-17 and binding on the design:

- **`tui_gateway`'s JSON-RPC surface is Hermes *internals*, not a published API.** Hermes is at 0.20.5 with `config_version` 37 against a latest of 39. An upgrade can rename methods out from under the Bridge. The Bridge must pin a Hermes release in its unit and treat a gateway protocol break as a named failure mode FR-14 reports.
- **Warm sessions are capped and costly.** The gateway enforces an active-session limit (error 4090) against ~37 profiles on this machine, and each warm session carries an agent with a large system prompt plus its own MCP children. Session **eviction policy is required**, not optional.
- **The registry has no per-pjid endpoint.** `GET /v1/registry` returns all 19 projects as one ~33KB object; the Bridge indexes client-side. Measured 2.4ms p50 — roughly two orders of magnitude inside budget.
- **The PRD's named registry fallback does not work.** `pj info <pjid>` calls the same HTTP service and exits 1 when it is down, so it fails in precisely the outage it was meant to cover. A real fallback must be chosen.
- **`board_id` is an empty string, never null or absent** for boardless Projects (4 of 19). A null check or key-presence test reports a board for all four.
- **The pjid is mutable and author-controlled** — plain text in a file with no UUID behind it. Renaming it deletes and re-keys the registry row, so anything the Bridge persists keyed by pjid orphans silently. It is also decoupled from the repo directory name in 5 of 19 cases, so a path must always come from the record.
- **FR-9 is blocked on another repo.** `BloodbankAdapter.send()` discards the agent's response text; dispatch outcomes carry status only. Correlation works — result content does not exist yet.
- **Dispatch outcomes carry no repo or project**, so §6's `data.repo` filter holds for webhook events but not for agent dispatch. The Bridge must scope by a correlation id it minted itself.
- **`tailscale serve` rewrites the client address to `127.0.0.1`**, moving the real caller to `X-Forwarded-For`.
- **Chrome's Local Network Access may survive TLS.** LNA gates on the address-space transition with a permission prompt rather than on secure context, so the transport choice does not close Q7.

### Cross-Cutting Concerns Identified

1. **Failure isolation under one authoritative taxonomy.** FR-3 owns the state list; FR-14 feeds it. Panes fail independently and never render a failure as empty or as a permanent spinner.
2. **Identity discipline.** The pjid is the join key — mutable, path-decoupled, and colliding by name with `event-schemas.md`'s board-UUID `project_id`. The Bridge should name its field `pjid` and never `project_id`.
3. **Streaming lifecycle across two protocols and a non-durable client.** Upstream WS, downstream SSE, with a panel that closes and a service worker that dies.
4. **Asynchronous correlation and reconciliation.** Self-minted correlation ids; outcomes merged on arrival, never assumed to follow their status.
5. **Credential resolution *and silent-degradation detection*.** A Hermes process without vault auth falls through to unresolved `op://` literals and downgrades to a fallback model, producing correct-looking answers at the wrong cost and latency while surfacing nothing. Verified live: `hermes-dashboard.service` ran in exactly that state from 2026-09-09 to 2026-09-17. FR-14 must detect it because nothing else will.
6. **Latency across a network hop.** Every measured figure to date is loopback-only; the tailnet hop is additive and unmeasured.
7. **Staleness and cache invalidation.** FR-2's bounded cache and FR-12's refetch — the product's own loop invalidates its own reads.
8. **Version coupling to an unpublished upstream protocol.** See the `tui_gateway` constraint above.
