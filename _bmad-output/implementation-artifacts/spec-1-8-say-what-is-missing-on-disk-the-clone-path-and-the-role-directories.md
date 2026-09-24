---
title: 'Story 1.8: Say what is missing on disk — the clone path and the role directories'
type: 'feature'
created: '2026-09-24'
status: 'awaiting-operator'
baseline_revision: '09a8e0e341738dee12959ebba8bc3e7916dc8d0d'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
operator_actions:
  - "Free 127.0.0.1:8787 for the Bridge (still held by curator-serve.service, python3 pid 6375, as owed since Stories 1.4-1.6), or amend architecture.md's Bridge port"
  - "With 8787 free, on big-chungus run `node packages/bridge/dist/bridge.mjs &` then `curl -s http://127.0.0.1:8787/v1/project/sidepiece | jq '.degraded'` and confirm it is exactly [{\"ds\":\"DS-10\",\"params\":{\"agent\":\"sidepiece-scrum-master\",\"roleDir\":\"/home/delorenj/code/sidepiece/agents/hermes/scrum-master\"}}] with no DS-20, alongside the full record in a 200"
  - "When re-running Story 1.6's owed 8787 check, expect that DS-10 entry in degraded instead of [] (Story 1.8 now reports the missing scrum-master role dir)"
---

<intent-contract>

## Intent

**Problem:** A resolution today returns the Registry's clone path and Agent bindings without checking that any of them exist on `big-chungus`. The operator is never told that a clone is missing (DS-9) or that an Agent's role directory is missing (DS-10 for a non-PM, DS-20 for the PM). DS-10 is true of this repo right now: `sidepiece-scrum-master` → `agents/hermes/scrum-master` does not exist.

**Approach:** Add `packages/bridge/src/registry/paths.ts`, the one filesystem prober. It stats the record's clone path and each binding's `roleDir` resolved against it, and returns `Degraded[]` entries. The `GET /v1/project/:pjid` handler appends them to `degraded[]` after the Bridge-wide entries, next to the full record. The prober is read-only.

## Boundaries & Constraints

**Always:**
- **Export:** `probePaths(record: Pick<ProjectRecord,'clonePath'|'agents'>): Promise<Degraded[]>` in `registry/paths.ts`. It uses `node:fs/promises` `stat`, and it is the only module that probes Project paths.
- **What counts as present:** `stat` succeeds (following symlinks) and the target is a directory. Anything else is "missing" and never throws: ENOENT, ENOTDIR, a dangling symlink, a regular file, or any other stat error.
- **Role directory resolution:** `roleDir` is resolved with `posix.resolve(clonePath, roleDir)`. A relative `roleDir` joins the clone path, and an absolute one stands alone. The params carry the resolved absolute path. The record's own `agents[].roleDir` stays exactly as the Registry sent it, so the generation hash is unchanged.
- **Entries, in this order:**
  1. DS-9 `{ds:'DS-9',params:{path:<clonePath>}}`. The path is complete, never truncated.
  2. One entry per agent in record order (already sorted by id):
     - role `=== 'pm'`: `{ds:'DS-20',params:{pm:<agent id>,roleDir:<resolved>}}`
     - any other role: `{ds:'DS-10',params:{agent:<agent id>,roleDir:<resolved>}}`
- **Probe independence:** each path is probed on its own. A missing clone path does not suppress the role-directory entries.
- **Shape:** only `ds` plus `params` (key order as written above). There is no `remedy` key and no prose.
- **Response order:** `degraded = [...options.degraded?.() ?? [], ...await probe(record)]`. The record keys and order are unchanged. The status is always `200`.
- **Scope:** `probe` is injectable on `ProjectRoutesOptions` (`probePaths?: typeof probePaths`, defaulting to the real one) so record-shape tests can pin `degraded`. `main.ts` uses the default.
- **Hermetic tests:** any test asserting an exact `degraded` array controls the filesystem it points at. It uses mkdtemp-backed fixtures or an injected probe, and never depends on `/home/delorenj/code/*` existing on the test host.

**Block If:** none anticipated.

**Never:**
- Create, clone, fetch, chmod or write anything on disk in response to a probe.
- Probe inside `mutationResolver` / `mutatingRoute`. DS-9, DS-10 and DS-20 gate nothing on the Bridge.
- Add a `DsCode`, change `CONTRACT_VERSION`, add a migration, or change `mintGeneration` / the record hash.
- Import `node:fs` (or `node:fs/promises`) anywhere under `packages/` outside `packages/bridge/`.
- Log DS-9/10/20 as `warn` `degraded` lines. They ride alongside a served record, the same way DS-25 does.
- Edit `sprint-status.yaml` or `.project.json`, or create `agents/hermes/scrum-master`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All present | clone dir + every role dir exist | `[]` | none |
| This repo today | clone exists, pm dir exists, scrum-master dir absent | `[{ds:'DS-10',params:{agent:'sidepiece-scrum-master',roleDir:'<clone>/agents/hermes/scrum-master'}}]` | none |
| PM missing | pm roleDir points at nonexistent path | `DS-20` with `params.pm`, `params.roleDir` | none |
| Clone missing | clonePath absent, two agents | DS-9 with full path, then DS-20 and DS-10 | no fs writes |
| Absolute roleDir | `roleDir:'/elsewhere/x'` absent | `roleDir:'/elsewhere/x'` | none |
| Not a directory | clonePath is a regular file | DS-9 | none |
| No agents | boardless Project, `agents: []`, clone present | `[]` | none |
| Store ahead | DS-25 bridge-wide + DS-10 | `[DS-25, DS-10]`; record still served | no warn line |
| Unknown pjid | DS-2 | unchanged `{"degraded":[DS-2]}`; probe not called | existing path |

</intent-contract>

## Code Map

- `packages/bridge/src/registry/paths.ts` -- NEW. `probePaths`. The only Project-path prober (architecture tree: "clone-path + role_dir existence checks → DS-9/DS-10/DS-20").
- `packages/bridge/src/registry/client.ts` -- `deriveRecord` sets `clonePath = repo_path` verbatim and keeps `agents[].roleDir` as the Registry sent it (relative, e.g. `agents/hermes/pm`). This is read-only for this story.
- `packages/bridge/src/server/project.ts` -- `projectRoutes` GET handler: it builds `{...record, degraded:[...options.degraded?.()]}`. Add the probe there only. `currentProject` / `mutationResolver` are untouched. Add `probePaths?` to `ProjectRoutesOptions`.
- `packages/contract/src/state.ts:41` -- `Degraded {ds, params?: Record<string,string>, remedy?}`. DS-9, DS-10 and DS-20 are already in `BridgeDsCode`.
- `_bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/EXPERIENCE.md:796,797,807` -- DS-9, DS-10 and DS-20 rows already exist, so there is no copy change (DoD items 2 and 3 are satisfied).
- `packages/bridge/test/stub-registry.ts` -- `fixtureProjects()`:
  - sidepiece → `/home/delorenj/code/sidepiece` with the pm and scrum-master agents.
  - The boardless projects → `/home/delorenj/code/<pjid>`.
  - These are real host paths, which is non-hermetic for exact-`degraded` asserts.
- Exact-`degraded` asserts that would change with a real probe:
  - `packages/bridge/src/server/project.test.ts:95` (`degraded: []`) and `:195`.
  - `packages/bridge/test/bundle.test.ts:76`.
  - `packages/bridge/test/main.test.ts:232`, which spawns the bundle, so the probe can't be injected there. Point the fixture at mkdtemp dirs or assert with the probe entries filtered.
  - `mutating.conformance.test.ts` asserts no `degraded` log line and GET bodies. Check it.
- `packages/bridge/src/outbound.test.ts` / `db/boundary.test.ts` -- boundary scans; confirm the new file passes them.

## Tasks & Acceptance

**Execution:**
- `packages/bridge/src/registry/paths.ts` -- implement `probePaths` per the Always rules, with a doc comment naming DS-9/10/20 and "never creates anything".
- `packages/bridge/src/registry/paths.test.ts` -- unit-test every probe-level row of the I/O matrix against mkdtemp trees (including symlink-to-missing and regular-file cases) and assert the exact key order via `JSON.stringify`.
- `packages/bridge/src/server/project.ts` -- inject the probe into the GET handler after the Bridge-wide entries.
- `packages/bridge/src/server/project.test.ts` -- add end-to-end GET tests against a stub registry whose repoPath is a mkdtemp clone with `agents/hermes/pm` present and `scrum-master` absent:
  - assert the full record plus exactly the DS-10 entry;
  - a DS-20 fixture (the pm roleDir points at a nonexistent path);
  - DS-9 with the full absolute path and no dir created afterwards;
  - DS-25 + DS-10 ordering.
  - Make the existing exact-`degraded` tests hermetic.
- `packages/bridge/test/bundle.test.ts`, `packages/bridge/test/main.test.ts` -- make their exact-`degraded` asserts hermetic, and assert DS-10 rides alongside in the bundle test.

**Acceptance Criteria:**
- Given `grep -rn "node:fs" packages/ --include='*.ts' | grep -v node_modules | grep -v "^packages/bridge/"`, then the output is empty.
- Given a GET for a mkdtemp-backed sidepiece fixture mirroring this repo, when the response is read, then status is `200`, every `ProjectRecord` key is present with its registry values, and `degraded` is exactly `[{"ds":"DS-10","params":{"agent":"sidepiece-scrum-master","roleDir":"<clonePath>/agents/hermes/scrum-master"}}]` with no DS-20 and no `remedy` key.
- Given a missing clone path, when resolved, then the directory still does not exist afterwards.
- Given `mise run lint && mise run test && mise run build`, then all exit 0.
- Given the live Bridge on `127.0.0.1:8787` pointed at the real registry, when `curl -s http://127.0.0.1:8787/v1/project/sidepiece | jq '.degraded'` is run, then it contains the DS-10 entry for `/home/delorenj/code/sidepiece/agents/hermes/scrum-master` and no DS-20. The agent checks this if a live Bridge can be run locally; otherwise it is owed to the operator.

## Spec Change Log

## Review Triage Log

### 2026-09-24 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3: (high 0, medium 0, low 3)
- defer: 0
- reject: 24: (high 0, medium 1, low 23)
- addressed_findings:
  - `[low]` `[patch]` A relative `clonePath` was stat'ed against the Bridge's cwd, and its role dirs were cwd-resolved. `probePaths` now never stats a non-absolute path: the clone is DS-9, and role dirs are `posix.join`ed and reported missing. Test added (`clonePath: '.'`).
  - `[low]` `[patch]` `roleDir` was resolved twice (once to probe, once to report). It is now resolved once, so the probed path and the reported path cannot drift.
  - `[low]` `[patch]` The `sidepieceClone()` doc comment said "mkdtemp". It now says what the helper actually does.

## Design Notes

- **Why the probe is on GET only:** DS-9, DS-10 and DS-20 are informational on the Bridge. The Cockpit decides gating (DS-20 gates Chat client-side). Probing in the mutation guard would add filesystem latency to a check whose job is generation freshness only.
- **Why each path is independent:** a missing clone implies missing relative role directories, but reporting them is still true. It also keeps the prober free of branching the Cockpit would have to reverse-engineer. DS-20 under a missing clone correctly gates Chat.
- **Why the resolved path goes in params:** EXPERIENCE.md words DS-10 as "`<agent>` is bound to `<role_dir>`, which doesn't exist". The operator needs a path they can `ls`, and the epic AC fixes it as `<clonePath>/agents/hermes/scrum-master`.

## Verification

**Commands:**
- `mise run lint && mise run test && mise run build` -- expected: exit 0.
- `grep -rn "node:fs" packages/ --include='*.ts' | grep -v node_modules | grep -v "^packages/bridge/"` -- expected: no output.

## Auto Run Result

Status: awaiting-operator

**Summary:** `GET /v1/project/:pjid` now says what is missing on disk.
- `registry/paths.ts` `probePaths` is the one Project-path prober. It stats the clone path and each Agent's `roleDir`, resolved against the clone. It reports DS-9 (`path`), DS-20 for the PM (`pm`, `roleDir`) and DS-10 for any other role (`agent`, `roleDir`).
- The entries follow the Bridge-wide ones (such as DS-25) in `degraded[]`, next to the full record, at `200`. There is no prose, no `remedy` key and no warn log.
- The probe never writes to disk, runs on GET only (never in the mutation guard), and is skipped for an unknown pjid.

**Files changed:**
- `packages/bridge/src/registry/paths.ts`: new. `probePaths`, read-only; a relative clone path is never probed against the cwd.
- `packages/bridge/src/registry/paths.test.ts`: new. Every probe-level matrix row on temp trees, plus symlink, ENOTDIR and relative-clone cases.
- `packages/bridge/src/server/project.ts`: the GET handler appends the probe results; injectable `probePaths?` on `ProjectRoutesOptions`.
- `packages/bridge/src/server/project.test.ts`: the record-shape tests now use a no-op probe (hermetic). New real-probe end-to-end tests cover DS-10 alongside the full record, DS-20, DS-9 with nothing created, DS-25-then-DS-10 ordering, and that an unknown pjid never calls the probe.
- `packages/bridge/test/bundle.test.ts`, `packages/bridge/test/main.test.ts`: the sidepiece fixture now points at a temp clone. The bundle test asserts DS-10 comes back alongside the record, and the DS-25 test still gets exactly `[DS-25]`.

**Review findings:** 3 patches applied (all low), 0 deferred, 24 rejected. The rejected findings include:
- Findings the spec already settles: any stat error counts as missing; role entries still appear under a missing clone; no warn log; GET-only.
- A timeout for a hung `stat`: the paths are local, not outbound calls.
- A probe that rejects: the default never throws, and the client validates `roleDir`.
- `..` in a `roleDir`, and a role constant for `'pm'`.
- Test-hygiene nits: temp-dir leaks if setup throws, a mix of assertion styles.

**Follow-up review recommendation:** false. Patched: high 0, medium 0, low 3. Score is 3×0 + 3 = 3, which is below 5.

**Verification:**
- `mise run lint && mise run test && mise run build`: exit 0. Contract passed 5/5; bridge passed 153/153, with 0 skipped.
- `grep -rn "node:fs" packages/ --include='*.ts' | grep -v node_modules | grep -v "^packages/bridge/"`: no output.
- Live check: the patched `dist/bridge.mjs` on 127.0.0.1:18787, against the real pjangler registry on :8764, answered `curl -s http://127.0.0.1:18787/v1/project/sidepiece`. It returned `200`, the full record (`clonePath /home/delorenj/code/sidepiece`, generation 1, 2 agents), and `degraded` exactly `[{"ds":"DS-10","params":{"agent":"sidepiece-scrum-master","roleDir":"/home/delorenj/code/sidepiece/agents/hermes/scrum-master"}}]`, with no DS-20.
- The literal check on port 8787 is owed; see `operator_actions`.

**Residual risks:**
- A `stat` error such as EACCES is reported as "missing" (the spec's choice). An unreadable directory reads as absent.
- A `stat` on a hung network mount would block the GET until the handler deadline. The clone paths are local today.
- Git: during implementation, `origin/main` held an older, split-up version of the story 1-7 commits (`2264793`..`9977970`). It was merged with `-s ours` (`00195af`) because local `09a8e0e` already contains all of that code plus the later `RequestAborted` fix. The local `sprint-status.yaml` row was kept as-is; nothing in this run wrote that file.

