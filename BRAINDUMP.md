# Sidepiece project brief

Sidepiece is a personal Chrome sidebar that recognizes when the current tab is
served by one of my projects, resolves that site back to the matching local
repository and project metadata, and gives me an immediate control surface for
the project's agent, ticket board, and operational context.

## Core idea

The extension watches the active tab URL and detects whether it's one of my registered pjangler-backed projects. As soon as it does, it shows a sidebar that gives me a quick view of the project's status, a chat box linked to the project's agent, it's ticket board, agent activity, and an annotation tool that let's me select html elements to associate with a message to the agent. Instead of passing screenshots, I can pass unique selectors.

## The PJangler Registry

All my projects are registered in a PJangler registry. To enable Sidepiece, all pjangler-backed projects must advertise their pjid in the html `<head>`. The extension can then resolve the linked metadata by running `pj info [pjid]` and parsing the output.

## Sidebar experience

When Sidepiece recognizes the current site, it shows a compact project dashboard
for that repo.

The first useful version has three primary capabilities:

1. Talk to the project's registered Hermes project manager agent.
2. View and add tickets on the project's Plane board.
3. Capture a snapshot of the current page, draw on it, and attach the annotated
   image to a message sent to the agent.
4. Select an html element to annotate to the agent.
5. Provide a Candystore feed of the project's most recent bloodbank events.
6. Provide a list of all agent sessions in reverse chronological order (claude, codex, kimi, etc).

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
as `bloodbank.repo.<repo-name>`, and show the relevant event stream beside
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
7. The tray icon should have a settings page, and below that, a list of the most recent projects in reverse chronological order they exibited activity from.

## Open questions

service, a checked-in config file, or a generated artifact from Traefik?

- What is the cleanest bridge between the Chrome extension and local Big Chungus
  paths?
- How should Sidepiece authenticate to Hermes, Plane, Candystore, and
  Bloodbank?
- What payload shape should annotated snapshots use when they are attached to
  agent messages or tickets?
