# Definition of Done

Human-checked on every change. No CI enforces these; you do.

- [ ] Every mutating route registers through `mutatingRoute()` (`packages/bridge/src/server/http.ts`), which re-resolves the pjid and checks the body's `generation` before any capability runs. `createBridgeServer` refuses to start with a mutating method not built by `mutatingRoute()`, but `tsc` cannot see a missing call: a capability invoked from a `GET` handler, or run outside the guarded handler, is caught only by you, here.
- [ ] A new failure mode adds a `DsCode` and its `EXPERIENCE.md` row in the same change — never free text.
- [ ] A new user-facing string exists in `EXPERIENCE.md` and lands in `copy/states.ts`, `copy/progress.ts` or `copy/icon.ts`.
- [ ] No Glossary term appears under a synonym. `project_id`, `projectId` and `projectSlug` are linted (`lint/no-project-id.grit`, architecture A-P1). `project` and a bare `id` for the pjangler identifier are human-checked here instead: they are too generic to lint mechanically, so the pjangler identifier must read `pjid` and a Plane project `boardId`.
