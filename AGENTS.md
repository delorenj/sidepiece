# Sidepiece

Project-aware Chrome sidebar that resolves the active Traefik-served tab to its
local repo, Hermes PM agent, Plane board, and Bloodbank stream.

> **Hermes PM–Managed Project.** Managed by a dedicated Hermes
> [Project Manager agent](./agents/hermes/pm/SOUL.md) with a paired
> [Scrum Master / Ticket Sentinel](./agents/hermes/scrum-master/role.yaml).
> `AGENTS.md` is the single source of truth — `CLAUDE.md` and `GEMINI.md` are
> symlinks to it (kept current by the `link-agentfiles` mise task). Edit only
> this file.

## Product Overview

Sidepiece watches the active browser tab and, when the URL is one of my own
services (recognized by its Traefik route), resolves it back to the matching
local repository and surfaces a project cockpit:

1. **Chat** with the project's registered Hermes PM agent.
2. **View / add tickets** on the project's Plane board (board resolved from URL).
3. **Snapshot + annotate** the current page and attach it to the agent message.

The full brief and MVP scope live in [`docs/product-brief.md`](./docs/product-brief.md)
(the BMAD analysis context source, derived from `BRAINDUMP-REFINED.md`). Raw
braindumps (`BRAINDUMP.md`, `BRAINDUMP-REFINED.md`) are kept as source of record.

## This project's 33god wiring

| Facet | Value |
|---|---|
| Ticket board (SOT) | Plane `33god` workspace · **Sidepiece** · identifier `SIDE` |
| Board URL | https://plane.delo.sh/33god/projects/96725b78-df0b-436a-8b45-c871264fe25d/issues/ |
| PM agent | `sidepiece-pm` → `agents/hermes/pm/` |
| Scrum Master (Ticket Sentinel) | `sidepiece-scrum-master` → `agents/hermes/scrum-master/` (systemd timer, 1-min cadence) |
| Bloodbank namespace | `bloodbank.evt.v1.repo.sidepiece.>` (events) · `bloodbank.cmd.v1.agent.<agent_id>.>` (commands) |
| Runtime repos | `gh:delorenj/agent-hm-sidepiece-{pm,scrum-master}` (each agent's HERMES_HOME submodule) |

`.project.json` is canonical for board + agent bindings. There is **one board per
repo**: the PM owns it, the Scrum Master sentinel watches it. Never add a
separate `.plane.json`.

## Talking to the agents

```bash
agents/hermes/pm/hermes chat "status"            # ask the PM
agents/hermes/scrum-master/hermes chat "status"  # ask the Scrum Master
# Telegram bots (@sidepiece_pm_bot / @sidepiece_scrum-master_bot) are not yet
# wired — run agents/hermes/<role>/.scripts/30-telegram.sh to add a BotFather token.
```

Fleet daemons (gateway/consumer/checkpoint) are installed as `systemctl --user`
units named `hermes-sidepiece-<role>-*`; start them with
`systemctl --user start hermes-sidepiece-pm-gateway.service` etc.

## Ticket discipline

No code changes in this repo without an active ticket on the `SIDE` board. The
Scrum Master sentinel reconciles board ↔ evidence ↔ worker state every minute.
Emergency bypass: prefix git with `ALLOW_NO_TICKET=1` (already the shell default
in this environment).

## mise (mandatory tooling/env layer)

```bash
mise trust                # once per clone
mise run link-agentfiles  # refresh AGENTS.md symlinks (also runs on `enter`)
```

- On directory `enter`, mise links the agent files and runs
  `op inject -i .env.op > .env` to materialize 1Password secrets. `.env.op`
  holds only `op://` references and is committed; `.env` is gitignored — never
  commit it.
- **Versioning** (uniform across the fleet):
  `mise run version` · `version:bump[-patch|-minor|-major]` · `version:check` ·
  `version:sync`. All version-bearing files are kept at the same semver
  (highest wins). When a `package.json` lands, re-run
  `bash ~/.claude/skills/mise-versioning/scripts/init.sh --force` to adopt it.

## BMAD methodology

Formal BMad Method install at `_bmad/` (modules `bmm`, `bmb`, `cis`; tools
claude-code, codex, gemini, opencode, crush, auggie). Project knowledge lives in
`docs/`; planning/implementation artifacts under `_bmad-output/`.

- Start BMAD work with the `bmad-help` skill when the next step isn't obvious,
  then route to the specific `bmad-*` skill.
- `docs/product-brief.md` is the seeded context source — drive PRD / epics from it.
- Repair/parity: `npx bmad-method@latest install --yes --modules bmm,bmb,cis
  --tools claude-code,codex,gemini,opencode,crush,auggie --user-name Jarad`.

## Memory & events

- **Hindsight** (bank: `sidepiece`) is the persistent memory layer — a
  `UserPromptSubmit` hook recalls before each prompt; retain learnings with
  `hindsight memory retain sidepiece "<learning>" --context <category>`.
- **Bloodbank** (NATS `127.0.0.1:4222`): each agent consumes its repo + command
  subjects and emits via the envelope helper (producer `hermes-agent:<agent_id>`).
