# Sidepiece — Product Brief

> BMAD analysis-phase context source. Derived from `BRAINDUMP-REFINED.md`
> (itself refined from the `sidepiece-braindump.mp3` transcription in
> `BRAINDUMP.md`). This is the canonical seed for the BMM planning workflows
> (`create-prd`, `create-epics-and-stories`). Edit here; keep the root braindump
> files as the raw source of record.

## Vision

A personal, project-aware Chrome sidebar that is always watching the active tab.
When the current site is one I own — recognized because it is served behind my
Traefik labels — Sidepiece resolves that URL back to the matching local
repository and project metadata, then gives me an immediate control surface for
that project's agent, ticket board, and operational context.

## Problem

When I land on one of my own running services (e.g. `holocene.delo.sh`), there is
no fast bridge from "the thing I'm looking at" to "the project that produces it":
its local clone on Big Chungus, its Hermes PM agent, its Plane board, and its
Bloodbank event stream. Context-switching to wire those up by hand kills the
loop between *noticing something* and *acting on it*.

## Core idea

Watch the active tab URL and match it against a **project registry** built from
my Traefik routes and personal repo inventory. Production/staging URLs served
through Traefik resolve with confidence; generic local-dev URLs
(`localhost:3000`) are intentionally distrusted in v1 to avoid false positives.

## Project registry (the foundation)

Maps each known project to:

- Public and staging URLs served through Traefik.
- The Traefik label/route that identified the project.
- The repo name.
- The local clone path on Big Chungus.
- The associated Hermes PM agent, when one exists.
- The associated Plane board, when one exists.
- The Bloodbank topic/namespace, e.g. `bloodbank.v1.repo.<repo-name>`.

Importable/inferable from Traefik config + repo inventory. Repos are assumed
already cloned; a missing clone is an exception state worth surfacing.

## Sidebar experience (MVP capabilities)

When Sidepiece recognizes the current site, it shows a compact project dashboard
for that repo. The first useful version delivers the highest-value loop:

1. **Talk to the project's registered Hermes PM agent** — the chat box is the
   primary interface (create tickets, summarize status, inspect WIP, reason
   about the current page).
2. **View and add tickets on the project's Plane board** — board is already
   resolved from the URL, so "add ticket" knows exactly where it goes.
3. **Snapshot + annotate** — capture the current page, draw an overlay, attach
   the annotated screenshot to the agent message (visual bug reports / ideas
   without a context switch).

## Agent resolution

For each matched project, check whether the local repo has a registered Hermes
agent (`agents/hermes/…`).

- **Agent exists** → connect the chat UI to it.
- **No agent** → surface clearly and offer a one-click, non-interactive deploy
  via `pjangler` / the Hermes agent tooling.

## Operational context (stretch)

Once the repo is known, filter Bloodbank for its namespace
(`bloodbank.v1.repo.<repo-name>`) and show the live event stream beside the
ticket and agent panes — turning the sidebar into a project cockpit: current
URL → local repo → agent → tickets → screenshots → repo-scoped events, all in
one place.

## MVP scope

1. Resolve the current Traefik-served URL to a project registry entry.
2. Show matched repo, local path, Hermes agent status, and Plane board.
3. Provide a Hermes agent chat box.
4. Add a Plane ticket from the sidebar.
5. Capture + annotate a page snapshot and attach it to the agent message.
6. Clear "no agent found" state with a deploy-agent action.

## Open questions (to resolve in PRD / architecture)

- Where should the project registry live: extension storage, a local service, a
  checked-in config file, or a generated artifact from Traefik?
- Cleanest bridge between the Chrome extension and local Big Chungus paths?
- How should Sidepiece authenticate to Hermes, Plane, Candystore, and Bloodbank?
- Should localhost matching exist at all in v1, or only Traefik-backed domains?
- What payload shape should annotated snapshots use when attached to agent
  messages or tickets?

## This repo at a glance

- **Ticket board:** Plane `33god` workspace, project **Sidepiece** (identifier
  `SIDE`) — the single source of truth in `.project.json`.
- **Agents:** Hermes PM + Scrum Master (Ticket Sentinel) under `agents/hermes/`.
- **Events:** Bloodbank namespace `bloodbank.evt.v1.repo.sidepiece.>`.
