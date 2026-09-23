# Epic 1 Context: Resolve any Project from the tailnet, and say honestly what is wrong with it

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Build the Bridge: a supervised daemon on `big-chungus` that turns a `pjid` into a trustworthy Project Record (repo name, clone path, Board binding, Agent bindings, content-addressed generation). It also reports what is wrong: health names which dependency failed, including silent credential degradation. The whole epic can be run with `curl` from the laptop or the host, with no extension and no Chrome. Epics 2–4 are built on this resolution step. The epic ends with a `curl` transcript. It also lays down the monorepo scaffold and the shared `contract/` package that both halves of the network boundary compile against. The extension (WXT) does not exist yet and must not be created in this epic.

## Stories

- Story 1.1: The monorepo scaffold that `contract/` cannot exist without
- Story 1.2: The lint that makes `project_id` impossible to reintroduce
- Story 1.3: `contract/` — the 28-state taxonomy and the Project Record, typed once for both halves
- Story 1.4: A Bridge that answers `curl`, states its contract, and refuses to start on the wrong Node
- Story 1.5: A Turn store that is versioned, and says so when it is newer than the Bridge
- Story 1.6: Resolve a pjid to a Project Record, stamped with a content-addressed generation
- Story 1.7: Refuse a mutation written against a Project that has moved
- Story 1.8: Say what is missing on disk — the clone path and the role directories
- Story 1.9: Answer from the last good copy when the Registry is down — and never silently
- Story 1.10: Deploy the Bridge as one file, supervised, with the Turn store out of the blast radius
- Story 1.11: Reach the Bridge from the laptop over the tailnet, on HTTPS, with the LNA headers
- Story 1.12: Every credential from the vault — and a missing one degrades instead of killing the Bridge
- Story 1.13: Health that names the dependency that failed
- Story 1.14: Catch the silent credential degradation nothing else on this machine notices
- Story 1.15: The `bb emit --check` gate, as a `mise` task and never a workflow
- Story 1.16: Run the two checks that end the guessing — DS-3 vs DS-4, and LNA on the laptop

## Requirements & Constraints

- **Curl-exercisable:** every capability must work without the extension. Acceptance for each story is a terminal transcript.
- **Resolution:** a known pjid returns the full record. An unknown pjid returns `200` with `{"degraded":[{"ds":"DS-2",...}]}` and no record fields. It is never a 5xx. Match the pjid byte for byte against the registry keys: no normalisation, and never read `.project.json` off disk.
- **Failure posture:** a product-level failure is `200` with `degraded[]` populated. Use 5xx only when the Bridge itself could not answer. The Bridge **degrades rather than exiting** on a missing credential. Exiting would show the operator DS-4 when the real state is DS-8.
- **Never act on the wrong Project:** mutations carry `(pjid, generation)`. A stale mutation is refused before the handler runs.
- **Latency:** resolution p95 ≤1s end-to-end from the laptop. The registry itself measures 2.4ms p50, so anything near 1s is a defect. Every outbound call has an explicit timeout. Health probes time out at 2s, and the health response returns within 3s with every row terminal. On a DERP relay, report it as DS-15. Never hang.
- **Credentials:** every credential comes from 1Password (`op://DeLoSecrets/...`, Plane key `op://DeLoSecrets/Plane/apiKey`). They are resolved at startup **and** per request, so recovery needs no restart. Never write a resolved value to disk or to the logs.
- **States produced and curl-proven here:** DS-2, DS-6, DS-7, DS-8, DS-9, DS-10, DS-15, DS-20, DS-23, DS-25. Free fixtures that are true of this repo today: **DS-10** (`sidepiece-scrum-master` → nonexistent `agents/hermes/scrum-master`). The PM's `role_dir` exists, so DS-20 needs a fixture registry.
- **No CI:** `mise` tasks are the whole pipeline. There must never be a `.github/` directory.
- **Definition of done** (human-checked, `DEFINITION-OF-DONE.md`):
  1. Every mutating route calls the generation check first.
  2. A new failure mode adds a `DsCode` and its `EXPERIENCE.md` row in the same change.
  3. New user-facing strings live in `EXPERIENCE.md` and the copy modules.
  4. No Glossary term appears under a synonym.

## Technical Decisions

- **Repo shape:** pnpm workspace with `packages/contract` (`@sidepiece/contract`) and `packages/bridge` (`@sidepiece/bridge`) only. Do not create `packages/extension` (that is Epic 2, `wxt init`) and never create `packages/ui`.
  - `tsconfig.base.json`: strict, `noUncheckedIndexedAccess`, `noImplicitOverride`, `nodenext`, `es2023`.
  - Tooling: Biome. Root `package.json` has no deps; the toolchain devDeps are pinned to exact versions.
- **Contract rules:** anything that crosses the network boundary lives only in `contract/` and is never re-declared.
  - `state.ts`: the full DS-1…DS-28 union split into `BridgeDsCode` (21) and `ClientDsCode` (7: DS-1, 3, 4, 5, 16, 21, 27). `Degraded.ds` is typed `BridgeDsCode`.
  - `Refusal`, `SubscriptionState` and `IconTransient` are separate code spaces and are not DsCodes.
  - `CONTRACT_VERSION` is a plain integer. It is echoed on `/v1/health` and on every response as the `X-Sidepiece-Contract` header.
- **Naming:** the pjangler identifier is always `pjid`, and a Plane project is `boardId`.
  - Biome rejects `project_id`, `projectId` and `projectSlug` everywhere except `tickets/plane.ts` and `registry/client.ts`, where the foreign name is renamed on read. A lint step also greps `packages/**/*.sql`.
  - All Sidepiece JSON is camelCase with flat, unwrapped bodies and ISO-8601 UTC `Z` timestamps.
- **Codes, not prose:** the Bridge sends DS codes plus typed `params`. User-facing sentences belong to the Cockpit's copy module. Upstream error text goes out verbatim. Omit a `remedy` key rather than sending it empty.
- **Runtime:** Node 24 with `node:sqlite`.
  - `main.ts` asserts `>=24.15.0 <25` before any socket or DB access, then exits 1 with the exact message.
  - The systemd `ExecStart=` uses an absolute pinned Node 24.15.x path, never `PATH`, `lts` or `latest`. `mise` will move to Node 26 LTS on 2026-10-28.
- **Store:**
  - Location: `$SIDEPIECE_STATE_DIR/turns.db` (default `~/.local/state/sidepiece/`).
  - Migrations: forward-only via `PRAGMA user_version`. Tables are plural snake_case, timestamps are TEXT.
  - Access: only `turns/store.ts` imports `node:sqlite`, and the case mapping happens only there.
  - Tables: this epic creates only `resolutions` (`pjid` PK, `generation`, `record_hash`, `resolved_at`, `clone_path`, `board_id`). Later tables arrive with their first writer.
  - Rollback: a store version ahead of this build is DS-25. Resolution and health keep working.
- **Registry:**
  - Fetch: `GET /v1/registry` once and index all 19 Projects client-side. There is no per-pjid endpoint.
  - Boardless Projects: `boardId` is `""`, never null or absent. Test board presence by truthiness only. There are four boardless Projects: codegraph-voyage, legofirst, momo, vinyl.
  - Snapshot: `<state-dir>/registry-snapshot.json` (a file, not a table) is rewritten on every successful fetch.
  - Registry down with a snapshot: serve the snapshot plus DS-23 with its age. The age is reported and never enforced, so there is no TTL constant.
  - Registry down with no snapshot: return DS-6 or DS-7 alone.
  - Errors: DS-6 means not running or unreachable. DS-7 means a non-2xx or unparseable response, with the error verbatim. One discriminator function decides between them and is shared by resolution and health.
- **Generation:**
  - Minting: per pjid and content-addressed. It is `sha256` of `{repo, clonePath, boardId, ticketProvider, agents sorted by id}` in fixed key order.
  - Changes: the generation increments only when the hash changes, never reuses a value, and serving from the snapshot never advances it. It is echoed at the top level of every Project-scoped response.
  - Staleness: stale means `received < current`. Greater than current is a Bridge bug, logged as `generation_ahead_of_bridge`.
  - Refusal: `409 {"error":"stale_generation","pjid","received","current"}`.
  - Placement: the generation is a body field and the pjid comes from the path. A missing generation is `400 missing_generation`.
  - Enforcement: routes that mutate register through `mutatingRoute()`, which checks the generation before the handler runs.
- **Filesystem:** `registry/paths.ts` is the only filesystem prober, and only the bridge imports `node:fs`. DS-9 is a missing clone path, sent as the full absolute path. DS-10 is a non-PM `role_dir`; DS-20 is the PM's `role_dir`. These codes ride alongside the record, and the Bridge never creates anything on disk.
- **Health:** `dependencies[]` has one row per upstream: registry, store, vault, fleet, gateway, plane, bloodbank, candystore.
  - Unbuilt adapters report `"unprobed"`, never `"ok"`. A `failing` row must carry a `BridgeDsCode`.
  - Bloodbank and Candystore are probed separately.
  - `relayed` is read from `tailscale status --json` for the peer in `X-Forwarded-For`.
- **Silent-degradation probe (`health/degradation.ts`):** runs on every health check.
  - It reports DS-8 with `probe: unresolved_reference` for any `^op://` literal, and with `provider_mismatch` for a provider or model mismatch.
  - For now the reported provider and model are null or unprobed until Epic 3's gateway adapter lands.
  - The file carries a header comment on the 2026-09-09→09-17 `hermes-dashboard.service` incident.
- **Transport:** the Bridge binds `127.0.0.1:8787` only. `tailscale serve` exposes it at `https://big-chungus.burro-salmon.ts.net/v1`.
  - It is never reachable through Traefik, Cloudflare or `delo.sh`. There is no app-level auth, because the tailnet is the trust boundary.
  - The client address comes from `X-Forwarded-For`.
  - `Access-Control-Allow-Private-Network: true` is sent on every preflight, unconditionally.
- **Deploy:** `tsup` bundles to a single `dist/bridge.mjs` with `contract` inlined and only `node:*` external. It is rsynced to `~/.local/lib/sidepiece/bridge.mjs`.
  - Abort if the target is under the state dir.
  - The `systemd --user` unit sets `Restart=always`, `RestartSec=2`, `WorkingDirectory=%h/.local/state/sidepiece`, `StateDirectory=sidepiece`, and needs lingering.
  - It sets `LoadCredential=op-token:/etc/sidepiece/op-service-token` and never uses `EnvironmentFile`. The token is passed only to the `op` child.
  - Absolute `OP_BIN` and `BB_BIN` go in `Environment=`.
  - Logs are structured JSON lines to journald, with `pjid` and `ds` as top-level keys.
- **Bloodbank gate:** `contract/src/bloodbank.ts` exports `PRODUCER_TYPES` (empty for now). `mise run bb:check` checks that each type has exactly 4 tokens and no `vN` token, then runs `$BB_BIN emit --check --type`. `deploy` depends on it. Never hand-assemble subject or schema fields.

## Cross-Story Dependencies

- **Order:** 1.1 → 1.2/1.3 → 1.4 → 1.5 → 1.6 → 1.7/1.8/1.9. Then 1.10 (deploy) → 1.11 (tailnet) → 1.12–1.15. 1.16 needs 1.11 live.
- **Shared pieces:** Story 1.6's first mint fills the `resolutions` table that 1.5 creates. The DS-6/DS-7 discriminator from 1.9 is reused by 1.13. 1.14 builds on 1.12's credential layer.
- **Handoffs to later epics:**
  - Epic 2 renders every code produced here and does its client-side generation pre-check.
  - Story 2.27 owns FR-15(c), which covers restarting the Bridge without reloading the extension.
  - The Epic 3 gateway story owns the `provider_mismatch` comparison.
  - Adding `ticket_creates` (Epic 2), `turns` and `dispatches` (Epic 3) is additive.
- **The DS-3/DS-4 spike (1.16):** it rewrites architecture O3 and PRD §12 Q7 in place. It uses a throwaway `spike/lna-probe/` outside the workspace globs. It must not add or remove any DsCode, and it decides whether Epic 2 renders DS-3 and DS-4.
- **External work, not part of this epic:**
  - EXT-1 (Bloodbank hermes-gateway drops response text) runs in parallel.
  - EXT-2: the illegal subjects in `agents/hermes/pm/role.yaml` and `docs/product-brief.md` are only reported as a non-blocking notice by `bb:check` and are never edited here.
