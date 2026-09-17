# Fact-check review — Sidepiece PRD (2026-09-17)

Scope: `prd.md` and `addendum.md`, checked against the live repo, the live
pjangler registry, the live Hermes fleet registry, the live Plane board, the
live Bloodbank contract, and the live 1Password vault. Only claims that are
**false, unverifiable, or materially imprecise** are reported. Correct claims
are listed in §2 so the next reader does not re-check them.

Method: every assertion was resolved against an executable source where one
exists (`bb contract`, `pj info --json`, `pj list`, `pj fleet inventory`,
`px task list --json`, `px schema export`, `op item list`, `op read`), and
against the named file otherwise.

---

## 1. Findings

### F1 — `addendum.md §B.2`: the 1Password rationale is false, and the repo's own `.env.op` says so

**Claim.** "Plane credentials resolve from 1Password by item UUID, not by title
— the vault contains duplicate titles and a title-based `op://` reference to a
duplicated name cannot resolve. The Sidepiece board's key is
`op://DeLoSecrets/dlxun2xmwhkt54ns77l4gagrdq/apiKey`; **the other item titled
"Plane" returns 403**."

**Ground truth.** `op item list --vault DeLoSecrets` returns exactly one item
whose title is `Plane`, and that item's id is
`dlxun2xmwhkt54ns77l4gagrdq` — i.e. the UUID the addendum cites *is* the item
titled "Plane". The former duplicate was renamed to
`Plane (AutomaticAI / HelloSubconscious)` (`43yfdx2uw5x6w5xy3hrdgmnq7u`). Both
reference forms resolve:

```
op read op://DeLoSecrets/Plane/apiKey                        -> rc=0
op read op://DeLoSecrets/dlxun2xmwhkt54ns77l4gagrdq/apiKey   -> rc=0
```

The repo's committed `.env.op` states the correction explicitly and uses the
title form:

> "The 33god key is the `apiKey` field of the DeLoSecrets item titled "Plane".
> (The former duplicate was renamed to "Plane (AutomaticAI /
> HelloSubconscious)", so this title now resolves unambiguously.)"
> `PLANE_33GOD_API_KEY=op://DeLoSecrets/Plane/apiKey`

**Why it matters.** FR-13 makes credential resolution a testable requirement.
As written, §B.2 instructs the implementer that the working, committed reference
in `.env.op` is broken and that a *nonexistent* second "Plane" item 403s. The
likely outcome is a change to `.env.op` justified by a condition that no longer
holds, plus a false belief about the vault that will be carried into the
Bridge's credential layer.

**Fix.** Replace §B.2 with: the Plane item title is unique as of 2026-09-17 and
`op://DeLoSecrets/Plane/apiKey` resolves; prefer the UUID form
(`dlxun2xmwhkt54ns77l4gagrdq`) as a *hardening* choice against future
re-duplication, not as a correction to a present failure. Delete the 403 claim.

---

### F2 — `prd.md §6` / FR-4 / §12 Q1: the reference project has no fleet-registered PM, and the PRD never says what "has a PM" means

**Claim.** §2.2 asserts "a Hermes fleet ... already in place". §6's dependency
table lists "Hermes PM gateway" as the FR-5 transport. §12 Q1 asserts "The
fleet-shared command gateway handles dispatch cleanly (FR-6)". FR-4's
consequence: "A Project with a PM shows it as the chat target by name."

**Ground truth.** Three sources disagree about whether Sidepiece has a PM:

| source | says |
|---|---|
| `.project.json` `agents` | `sidepiece-pm` (role `pm`) **and** `sidepiece-scrum-master` |
| `~/.hermes/profiles/` | `sidepiece-pm/` directory exists |
| `~/.hermes/agents-registry.yaml` | **absent** — 24 agents registered, none is `sidepiece-pm` |
| `pj fleet inventory` (whole registered fleet, 24 rows) | **no sidepiece row at all** |
| `systemctl --user list-unit-files \| grep sidepiece` | **no units** |

The gateway in that same registry routes by payload, not by agent-owned subject:

```yaml
gateways:
  bloodbank:
    command_subject: bloodbank.cmd.agent.invocation.start
    target_field: data.target_agent_id
```

so a dispatched command reaches an agent only if that agent is a registered
target. `sidepiece-pm` is not. The inventory also reports the fleet as
`UNHEALTHY · 15 uncorrelated · 3 unpermitted conflicts` — agent↔project
correlation is broken fleet-wide, which is precisely the data FR-4 reads.

**Why it matters.** FR-4 is the only requirement that decides whether chat
renders at all, and it is specified without naming its authority. An
implementer who reads `.project.json` gets "PM present, chat enabled"; one who
reads the fleet registry gets "no agent"; the gateway agrees with the second.
UJ-3 treats the no-PM path as an edge case, when it is the live state of the
project the PRD is written for. §12 Q1 further asserts dispatch is the *solved*
half — it is not solved for this project.

**Fix.** Name the authority for Agent presence in FR-4 (recommend:
`~/.hermes/agents-registry.yaml` via `pj fleet`, because that is what the
gateway routes against) and add a consequence for "declared in `.project.json`
but not fleet-registered" — half-provisioned, chat unavailable, with the
`pj hermes-agent` repair command. Downgrade §12 Q1's "handles dispatch cleanly"
to "handles dispatch cleanly *for registered targets*; registration is a
precondition, currently unmet for `sidepiece-pm`."

---

### F3 — `prd.md §12 Q5`: "Unrelated to Sidepiece's design" is false, and the collision is worse than described

**Claim.** "`.project.json` renamed `project_slug` → `project_id` on 2026-09-17,
but ... `event-schemas.md` still reads `slug` from `project_slug`. One of the
two is now wrong, and the Bridge will read whichever survives. **Unrelated to
Sidepiece's design**; it will bite the Bridge regardless."

**Ground truth.**

1. `project_id` is the pjid. `pj info sidepiece --json` returns
   `"project_id": "sidepiece"` as the canonical resolution key, and
   `pj info --help` documents the positional argument as "Canonical project ID".
   `pjangler/src/lifecycle/preflight.ts:418` accepts either name. So the renamed
   field is §3's **pjid** — the primary key of FR-1 and FR-2, the spine of the
   product. It is not unrelated; it is the most related field in the file.
2. The rename created a **name collision**, not a simple stale reference.
   `event-schemas.md` already defines a different `project_id`:

   | field | value from |
   |---|---|
   | `slug` | `project_slug` in `.project.json` |
   | `project_id` | provider project UUID (same as `board_id` for Plane) |

   After the rename, `.project.json`'s `project_id` is `"sidepiece"` while
   `data.project_id` must be `96725b78-df0b-436a-8b45-c871264fe25d`. Both names
   survive with conflicting semantics. Q5's framing ("one of the two is now
   wrong") points the implementer at the wrong defect and invites the exact
   wrong repair — copying `.project.json`'s `project_id` into `data.project_id`.

**Fix.** Rewrite Q5: the pjid is `.project.json.project_id`; `data.slug` in
`event-schemas.md` must be re-sourced from it; `data.project_id` keeps its
provider-UUID meaning and must **not** be fed from `.project.json.project_id`.
Move it out of "open questions" and into §6 as a stated contract, because FR-2
depends on the answer.

---

### F4 — `prd.md §6` / §9: a `data.repo` payload filter cannot be driven by the pjid

**Claim.** §6: "repo identity lives in `data.repo`". §9: "Implemented as a
`data.repo` payload filter against Candystore, per §6."

**Ground truth.** `event-schemas.md` defines `data.repo` as "repository
directory name". Sidepiece resolves a **pjid**, and pjangler's project ids are
not repo directory names. From `pj list` (19 projects):

```
bb    ->  /home/delorenj/code/33GOD/bloodbank      (dir "bloodbank")
px    ->  /home/delorenj/code/pilot                (dir "pilot")
```

The filter only works for Sidepiece because `project_id` and the directory name
happen to coincide here. For any project where they diverge, a `data.repo`
filter keyed on the resolved pjid returns zero events — silently, which is the
worst failure shape for FR-7 (a dispatched command whose outcome never
correlates renders as "unknown", per FR-7's own consequence).

**Fix.** State the mapping explicitly: the Bridge derives `data.repo` as
`basename(repo_path)` from the Project Record, never from the pjid. Add it as a
consequence under FR-7 and repeat it in §9.

---

### F5 — `prd.md §6`: the illegal subject is live agent config, not only "both source documents"

**Claim.** "**Bloodbank subject grammar — a correction to both source
documents.** `BRAINDUMP.md` and `docs/product-brief.md` both describe filtering
events on a repo-scoped subject (`bloodbank.repo.<repo-name>` and
`bloodbank.v1.repo.<repo-name>` respectively)."

**Ground truth.** The two quoted forms are accurate (`BRAINDUMP.md:46`,
`docs/product-brief.md:42,73`), and the grammar correction itself is correct
(see §2). But the defect is not confined to prose:

- `docs/product-brief.md:102` carries a **third** illegal form the PRD does not
  name: "**Events:** Bloodbank namespace `bloodbank.evt.v1.repo.sidepiece.>`".
- `agents/hermes/pm/role.yaml` — the PM's live manifest, the agent FR-5/FR-6
  target — subscribes to the same illegal construction and *documents itself as
  broken*:

  ```yaml
  bloodbank:
    subscribe:
      # Non-functional: the repo name sits in the grammar's entity slot ...
      - "bloodbank.evt.repo.sidepiece.>"
      - "bloodbank.cmd.agent.sidepiece-pm.>"
  ```

**Why it matters.** §6 presents this as a documentation correction with a clean
resolution ("use Candystore's projection"). An implementer will close the item
by editing two markdown files and leave the PM agent subscribing to a subject
its own comment calls non-functional — which is the second half of F2's dispatch
problem. The scope of the correction is understated, and the one place it has
operational consequence is unnamed.

**Fix.** Extend the §6 paragraph to name `agents/hermes/pm/role.yaml` and
`docs/product-brief.md:102`, and add a line: the PM's `bloodbank.subscribe`
block is not the dispatch path — the fleet gateway
(`bloodbank.cmd.agent.invocation.start`, routed on `data.target_agent_id`) is.

---

### F6 — `prd.md §3` / FR-2 / FR-3: a declared Agent binding points at a directory that does not exist

**Claim.** §3: "**Agent** — A Hermes process bound to a Project. Sidepiece cares
about the PM role; **the Scrum Master role exists** but is not a chat target."
FR-2: a present pjid "resolves to repo name, local clone path, Board binding,
and **Agent bindings**." FR-3 enumerates exactly four unresolved states.

**Ground truth.** `.project.json` declares:

```json
"sidepiece-scrum-master": { "role": "scrum-master", "role_dir": "agents/hermes/scrum-master" }
```

`ls agents/hermes/` returns `pm` and nothing else. The scrum-master assets
actually live at `agents/hermes/pm/.scripts/scrum-master/`. `pj info
sidepiece --json` returns the dangling binding verbatim, because it echoes the
manifest without validating it.

**Why it matters.** FR-3's four states are "no pjid declared / declared but
unknown / Bridge unreachable / clone path missing on disk". The live reference
project sits in a fifth state — *Registry resolves, clone path is fine, an Agent
binding is dangling* — which FR-3 forbids by omission ("No failure state renders
as an empty or loading panel"). §5's "cost of being wrong" makes a confidently
wrong Agent binding the same class of error as a wrong Project.

**Fix.** Add a fifth unresolved state to FR-3 for an Agent binding whose
`role_dir` is absent, and soften §3's "the Scrum Master role exists" to "may be
declared; its `role_dir` is not guaranteed to exist and must be verified".

---

## 2. Verified correct — do not re-check

These were checked against executable ground truth and are accurate as written.

**Bloodbank grammar (`prd.md §3`, `§6`; `addendum.md §B.1`).** `bb contract`
returns, verbatim:

```
type     bloodbank.<domain>.<entity>.<action>
subject  bloodbank.<kind>.<domain>.<entity>.<action>
kind     event=evt, command=cmd, reply=rpy
Versioning lives ONLY in schemaref/dataschema -- never as a token.
Identity (repo, agent) lives in data.* and actor.* -- never as a token.
```

- 4-token type / 5-token subject — **correct**.
- `kind = evt|cmd|rpy` — **correct**.
- No version token, versioning only in `schemaref`/`dataschema` — **correct**.
- Identity in `data.*` / `actor.*`, never a token — **correct**.
- "Shape-valid is not contract-valid: a well-formed 4-token type whose action is
  not in the allowlist is refused" — **correct**, verbatim from `bb contract`
  and `event-schemas.md`.
- "`bb contract` is the authority; validated with `bb emit --check`" — **correct**.
- "There is no `publish.sh`" — **correct** (`event-schemas.md` says so verbatim).
- `repo.issue.*` retired 2026-08-28 for embedding a repo slug in the type *and*
  using an entity outside the allowlist, deleted rather than renamed —
  **correct**, matches `agents/hermes/pm/.scripts/scrum-master/docs/bloodbank-events.md`
  verbatim.

**`.project.json` (`§6`, `§12 Q5`, `addendum §B.3`).** Workspace `33god`,
identifier `SIDE`, board `96725b78-df0b-436a-8b45-c871264fe25d` — **correct**.
`ticket_provider.type` models the provider abstractly — **correct**. The PM
ships `agents/hermes/pm/.scripts/providers/plane.sh` (alongside `linear.sh`,
`trello.sh`) — **correct**. `project_slug` → `project_id` renamed 2026-09-17 in
commit `9dd031e` — **correct** (see F3 for what the PRD gets wrong *about* it).
`event-schemas.md` does still read `slug` from `project_slug` — **correct**.

**SIDE board (`§10`, `addendum §E`).** Verified via `px task list --json` and
`px schema export`:

- 44 tickets — **correct** (`count: 44`, sequence 5–48).
- EPIC A through K, 11 epics — **correct**.
- All created 2026-06-23 — **correct** (all 44 `created_at` on `2026-06-23`).
- All in backlog, none started — **correct** (all 44 share state
  `8f6e590b-ff38-4c04-a463-c149d501039e`; the board's only `group: backlog`
  state is `Backlog`, which is also `default: true`).
- B3 is a URL resolver — **correct**: `#13 B3 — GET /resolve?url= URL→repo resolver`.
- B2 is the holocene fleet client — **correct**: `#12 B2 — holocene fleet client + project index`.
- K4 is a deferred Tauri scaffold — **correct**: `#47 K4 — Desktop scaffold (Tauri v2, deferred)`.
- K1/K2 → FR-13/FR-12 — **correct**: `K1 — Secrets & config via op/.env`,
  `K2 — Bridge lifecycle (systemd --user)`.
- D3 is the CLI-passthrough fallback cited in §12 Q1 — **correct**: `#21 D3 — CLI-passthrough fallback`.

**Source documents (`§0`, `§6`).** `BRAINDUMP.md` mtime 2026-09-17 and
`docs/product-brief.md` created 2026-06-04 — **correct**. The two quoted subject
forms are quoted accurately from those files — **correct** (see F5 for what is
missing). `docs/product-brief.md` does describe the Traefik-route registry the
addendum §A.1 rejects — **correct**; `BRAINDUMP.md` does describe the pjid-in-
`<head>` + `pj info <pjid>` model — **correct**.

*Note, not a finding:* `BRAINDUMP.md` is internally inconsistent — its "Core
idea" and MVP item 1 still say "watches the active tab URL" and "Resolve the
current Traefik-served URL", while its "PJangler Registry" section states the
declaration model. `addendum §A.1` already records the supersession explicitly,
and `reconcile-braindump.md:140` already flags the MVP-item-1 residue, so the
PRD family handles it.

**Paths and commands.** All exist and behave as described: `pj`, `px`,
`pjangler` on `PATH`; `bb` → `bloodbank`; `pj info <pjid>` and
`pj info <pjid> --json` (the JSON form does return repo path, Board binding and
Agent bindings, so FR-2's consequence holds); `pj hermes-agent` (§9) exists as
`pjangler hermes-agent|hermes`; `agents/hermes/pm/hermes`;
`agents/hermes/pm/.scripts/providers/plane.sh`;
`_bmad/custom/workflows/ticket-lifecycle/data/event-schemas.md`;
`agents/hermes/pm/.scripts/scrum-master/docs/bloodbank-events.md`;
`~/code/33GOD/bloodbank/docs/event-naming.md`.

---

## 3. Smaller notes (below the finding bar)

- **`§12 Q3` is a false dichotomy.** It offers "`pj info <pjid>` shelling out, or
  a library/MCP surface?" and omits the surface both already go through:
  `pj info --help` documents `--registry <location>` defaulting to
  `http://localhost:8764`, and `pj fleet inventory` reports
  `pjangler-project-registry · 19 records · configured http://localhost:8764`.
  A loopback HTTP registry is the obvious third option and is neither slow nor a
  shell-out. Worth adding to Q3 rather than leaving architecture to rediscover.
- **`§4.4` "the only component that ... runs pjangler"** is slightly overstated
  given the registry is already a loopback service with its own lifetime; the
  Bridge is the only *Sidepiece* component that does, which is the intended
  meaning.
- **`addendum §A.2`** says Native Messaging "registration is also
  per-browser-profile". On Linux host manifests are registered per *user* (or
  system-wide) under the browser's config dir, not per profile. The rejection
  still stands on the `curl`-debuggability argument in the same paragraph.
- **`§4.1` FR-2 "repo name"** — `pj info --json` returns `repo_path` and
  `project_name`, not a distinct `repo_name`; "repo name" is derivable but not a
  returned field. Harmless if architecture derives it, misleading if taken as a
  field name.
