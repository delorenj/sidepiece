# Sidepiece project brief

Sidepiece is a personal Chrome sidebar that recognizes when the current tab is
served by one of my projects, resolves that site back to the matching local
repository and project metadata, and gives me an immediate control surface for
the project's agent, ticket board, and operational context.

## Core idea

The extension watches the active tab URL and matches it against a project
registry built from my Traefik routes and personal repos. When I'm on a known
production or staging URL, such as `holocene.delo.sh`, Sidepiece opens or
becomes available as a project-aware sidebar.

The sidebar must avoid false positives from generic local development URLs.
`localhost:3000` can represent many different apps, so the first version should
prefer Traefik-backed domains and labels where the URL can be resolved with
confidence.

## Project registry

The registry is the foundation of the extension. It maps each known project to:

- Public and staging URLs served through Traefik.
- The Traefik label or route that identified the project.
- The repo name.
- The local clone path on Big Chungus.
- The associated Hermes project manager agent, when one exists.
- The associated Plane board, when one exists.
- The Bloodbank topic or message namespace, such as
  `bloodbank.v1.repo.<repo-name>`.

The registry can be imported or inferred from my Traefik configuration and repo
inventory. I can assume my projects are already cloned locally. If a repo isn't
cloned, that is an exception state worth surfacing.

## Sidebar experience

When Sidepiece recognizes the current site, it shows a compact project dashboard
for that repo.

The first useful version has three primary capabilities:

1. Talk to the project's registered Hermes project manager agent.
2. View and add tickets on the project's Plane board.
3. Capture a snapshot of the current page, draw on it, and attach the annotated
   image to a message sent to the agent.

The chat box is the main interface. I can ask the Hermes project manager to
create tickets, summarize project status, inspect work in progress, or reason
about what I am seeing on the current site.

The ticket area shows what is currently being worked on and gives me a direct
"add ticket" action. If I add a ticket manually, Sidepiece already knows which
Plane board it belongs to because the current URL has been resolved to a
specific repo.

The snapshot tool captures the current page, lets me draw an overlay, and
attaches that annotated screenshot to the agent conversation. This makes it easy
to report visual issues, product ideas, or debugging notes without switching
context.

## Agent resolution

For each matched project, Sidepiece checks whether the local repo has a
registered Hermes agent.

If an agent exists, Sidepiece connects the chat UI to that agent.

If an agent doesn't exist, Sidepiece surfaces that clearly and gives me a path
to create one. Ideally, there is a one-click action that uses `pjangler` or the
Hermes agent tooling to deploy the project manager agent non-interactively.

## Operational context

Sidepiece can also show project activity from Candystore and Bloodbank. Once it
knows the repo, it can filter Bloodbank messages for the related namespace, such
as `bloodbank.v1.repo.<repo-name>`, and show the relevant event stream beside
the ticket and agent context.

This would turn the sidebar into a live project cockpit: current URL, local
repo, agent, tickets, screenshots, and repo-specific operational messages all in
one place.

## MVP scope

Build the first version around the highest-value loop:

1. Resolve the current Traefik-served URL to a project registry entry.
2. Show the matched repo, local path, Hermes agent status, and Plane board.
3. Provide a Hermes agent chat box.
4. Let me add a Plane ticket from the sidebar.
5. Capture and annotate a page snapshot, then attach it to the agent message.
6. Show a clear "no agent found" state with a deploy-agent action.

## Open questions

- Where should the project registry live: browser extension storage, a local
  service, a checked-in config file, or a generated artifact from Traefik?
- What is the cleanest bridge between the Chrome extension and local Big Chungus
  paths?
- How should Sidepiece authenticate to Hermes, Plane, Candystore, and
  Bloodbank?
- Should localhost matching exist at all, or should v1 only trust
  Traefik-backed domains?
- What payload shape should annotated snapshots use when they are attached to
  agent messages or tickets?
