---
title: 'Story 1.3: contract/ — the 28-state taxonomy and the Project Record, typed once for both halves'
type: 'feature'
created: '2026-09-24'
status: 'in-progress'
baseline_revision: '1f1b5042717f1e5c6f884023b2a111d0f1ccf52c'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
warnings: [oversized]
deferred: []
---

<intent-contract>

## Intent

**Problem:** `@sidepiece/contract` holds only `CONTRACT_VERSION` in `index.ts`. There is no shared type for a failure code or for the Project Record, so the Bridge and the Cockpit could each name the same failure differently. FR-3 exists to prevent exactly that drift (A-P2, D11, D12, D21).

**Approach:** Add `state.ts` (the DS-1…DS-28 union split by producer, `Degraded`, and the three non-DS code spaces `Refusal`, `SubscriptionState` and `IconTransient`), `project.ts` (`AgentBinding`, `TicketProvider`, `ProjectRecord`, `ProjectResponse`) and `version.ts` (`CONTRACT_VERSION`). Re-export all of them from `index.ts`. Co-located tests prove the taxonomy at runtime and prove the type-level guarantees through `@ts-expect-error`, and `mise run test` typechecks them.

## Boundaries & Constraints

**Always:**
- `ClientDsCode` is exactly `'DS-1'|'DS-3'|'DS-4'|'DS-5'|'DS-16'|'DS-21'|'DS-27'`, and `BridgeDsCode` is exactly the other 21. Both are written as literal unions, not derived from arrays. `DsCode = BridgeDsCode | ClientDsCode`.
- `Degraded = { ds: BridgeDsCode; params?: Record<string, string>; remedy?: string }`.
- `Refusal = { error: 'stale_generation'; pjid: string; received: number; current: number }`.
- `SubscriptionState` and `IconTransient` are string-literal unions with no `DS-` literal in them:
  - `SubscriptionState = 'pending' | 'established' | 'not_established'`. This is the SSE subscription of one open, per EXPERIENCE.md "Reopen cold start" rule 6.
  - `IconTransient = 'open_gesture_rejected'`. This is the one `sidePanel.open()` gesture-error transient, per EXPERIENCE.md "Extension icon states".
- The `ProjectRecord` fields are:
  - `pjid: string`, `generation: number`, `repo: string`, `clonePath: string`;
  - `boardId: string`, which is required and never `null` or `undefined`;
  - `agents: AgentBinding[]` and `ticketProvider: TicketProvider`.
- `AgentBinding = { id: string; role: string; roleDir: string }`. The generation hash sorts agents by `id`.
- `TicketProvider = { type: string }`. It stays an open string because D21 renders an unrecognised provider as DS-14 and must not crash on it.
- `ProjectResponse = (ProjectRecord & { degraded: Degraded[] }) | { degraded: Degraded[] }`.
- `CONTRACT_VERSION` stays `1` and is annotated `: number`.
- The comments required by the AC must be present, and all identifiers must pass the A-P1 lint: `pjid` and `boardId`, never `project_id` or `projectId`.

**Block If:** none anticipated.

**Never:**
- Do not create `packages/extension`, `packages/ui`, `classify.ts`, `turn.ts`, `ticket.ts`, `health.ts` or `bloodbank.ts`. They belong to later stories.
- Do not add runtime logic to `contract/` beyond constants.
- Do not rename wire fields to snake_case.
- Do not change the bridge bundle test's `contract v\d+` expectation.
- Do not edit `sprint-status.yaml`.

</intent-contract>

## Code Map

- `packages/contract/src/index.ts` -- currently declares `CONTRACT_VERSION` inline, with a doc comment. Move the declaration to `version.ts` and make `index.ts` re-export `version`, `state` and `project`.
- `packages/contract/package.json` -- scripts are `build` (tsup on `src/index.ts`) and `typecheck`. There is no `test` script and no devDeps. It needs `test` and `@types/node` `24.13.6`, the same pin the bridge uses and already in the pnpm store.
- `packages/contract/tsconfig.json` -- extends the base and includes `src`, so the `*.test.ts` files are typechecked. That typecheck is what proves the `@ts-expect-error` fixtures.
- `tsconfig.base.json` -- `nodenext`, `verbatimModuleSyntax` and `isolatedModules`. Relative imports must carry the `.ts` extension, because the tests run under Node 24.15's native type stripping (`node --test`). That needs `"rewriteRelativeImportExtensions": true` here. TypeScript 6.0.3 supports it, and tsup/esbuild resolves `.ts` specifiers.
- `packages/bridge/src/index.ts` -- the only consumer, `import { CONTRACT_VERSION } from '@sidepiece/contract'`. It must keep compiling, and the bundle must keep inlining contract.
- `packages/bridge/test/bundle.test.ts` -- asserts the bundle prints `contract v\d+` and has only `node:` imports. Leave it unchanged.
- `mise.toml` `[tasks.test]` -- `pnpm -r --if-present run test`, so a contract `test` script is picked up automatically.
- `lint/lint.sh` and the A-P1 grit rules -- will scan the new files. Avoid `project_id`, `projectId` and `projectSlug` even in comments that sit inside string literals.
- EXPERIENCE.md's degraded-state table (`_bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/EXPERIENCE.md` ~L786–815) -- the authority for the 28 codes and their producers.

## Tasks & Acceptance

**Execution:**
- `tsconfig.base.json` -- add `"rewriteRelativeImportExtensions": true`, so `./state.ts`-style imports typecheck and also run under Node's type stripping.
- `packages/contract/src/version.ts` -- `export const CONTRACT_VERSION: number = 1;` with a comment above it. The comment says it is a plain integer, not the package version and not semver; that it is echoed on `/v1/health` and in `X-Sidepiece-Contract`; and that it is bumped by hand in the same change as any breaking change to a `contract/` type.
- `packages/contract/src/state.ts` -- the unions and types listed under Always. It opens with a header comment that says four things:
  - a new failure mode adds a `DsCode` and its row in `EXPERIENCE.md`'s degraded-state table in the same change;
  - that table is the authority;
  - see `DEFINITION-OF-DONE.md` item 2;
  - the producer split is A-P2's.
  Each non-DS type gets a one-line comment saying why it is not a `DsCode`.
- `packages/contract/src/project.ts` -- `AgentBinding`, `TicketProvider`, `ProjectRecord` and `ProjectResponse`. Comment `boardId`: it is an empty string for the four boardless Projects, and board presence is tested by truthiness.
- `packages/contract/src/index.ts` -- `export * from` `./version.ts`, `./state.ts` and `./project.ts`.
- `packages/contract/src/state.test.ts` -- runtime arrays `CLIENT` and `BRIDGE`, each checked two ways:
  - `satisfies readonly X[]`;
  - a compile-time exhaustiveness assertion, so a union member missing from the array is a type error.

  It asserts 7 client codes, 21 bridge codes and 28 total; that the two sets are disjoint; and that the union equals `DS-1`…`DS-28` with no gap and no duplicate. It also carries `@ts-expect-error` fixtures:
  - `{ ds: 'DS-1' }` as `Degraded`;
  - a `Refusal`, `SubscriptionState` or `IconTransient` value assigned to `DsCode`.
- `packages/contract/src/project.test.ts` -- `@ts-expect-error` fixtures:
  - `boardId: null`;
  - `boardId` omitted;
  - reading `.boardId` off an un-narrowed `ProjectResponse`.

  It also has a narrowing example that compiles (`'pjid' in r`), and one runtime test that `CONTRACT_VERSION === 1` and is an integer.
- `packages/contract/package.json` -- add `"test": "tsc --noEmit && node --test \"src/*.test.ts\""` and devDep `"@types/node": "24.13.6"`, then run `pnpm install`.

**Acceptance Criteria:**
- Given `state.ts`, when typechecked, then `ClientDsCode`, `BridgeDsCode`, `DsCode` and `Degraded` are exactly as the epic AC states, and `Degraded['ds']` is `BridgeDsCode`.
- Given `mise run test`, when it runs, then contract typecheck passes and every expect-error directive is used; the runtime taxonomy assertions pass (7/21/28, disjoint, DS-1…DS-28 complete); and removing the directive on `{ ds: 'DS-1' }` makes `tsc` fail.
- Given `state.ts`, when read, then `Refusal`, `SubscriptionState` and `IconTransient` are exported, none is assignable to `DsCode`, and the header comment names `EXPERIENCE.md`'s degraded-state table and `DEFINITION-OF-DONE.md` item 2.
- Given `project.ts`, when read, then `ProjectRecord` has the seven fields with `boardId: string` required and non-nullable, and `ProjectResponse` forces narrowing before a record field is read.
- Given `version.ts`, when read, then `CONTRACT_VERSION = 1` is typed `number` and a comment says it is bumped by hand with any breaking contract change.
- Given the repo, when `mise run lint && mise run test && mise run build` run, then all exit 0 and the bridge bundle still prints `contract v1`.

## Spec Change Log

## Review Triage Log

## Design Notes

Exhaustiveness without deriving the type from the array:

```ts
const CLIENT = ['DS-1', 'DS-3', /* … */] as const satisfies readonly ClientDsCode[];
type Missing = Exclude<ClientDsCode, (typeof CLIENT)[number]>;
const _complete: [Missing] extends [never] ? true : false = true; // fails if a member is missing
```

`tsc --noEmit` is part of the contract `test` script because the `@ts-expect-error` fixtures prove nothing at runtime. Only the typecheck turns an unused directive into a failure, so the proof has to run as part of `mise run test`.

## Verification

**Commands:**
- `pnpm --filter @sidepiece/contract test` -- expected: tsc clean, all node tests pass.
- `mise run lint && mise run test && mise run build` -- expected: exit 0.
- Temporarily delete the `@ts-expect-error` above `{ ds: 'DS-1' }` and run `pnpm --filter @sidepiece/contract typecheck` -- expected: TS2322. Then restore the directive.
