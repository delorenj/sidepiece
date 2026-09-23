# Definition of Done

Human-checked on every change. No CI enforces these; you do.

- [ ] Every mutating route calls the generation check before any capability runs.
- [ ] A new failure mode adds a `DsCode` and its `EXPERIENCE.md` row in the same change — never free text.
- [ ] A new user-facing string exists in `EXPERIENCE.md` and lands in `copy/states.ts`, `copy/progress.ts` or `copy/icon.ts`.
- [ ] No Glossary term appears under a synonym. `project_id`, `projectId` and `projectSlug` are linted (`lint/no-project-id.grit`, architecture A-P1). `project` and a bare `id` for the pjangler identifier are human-checked here instead: they are too generic to lint mechanically, so the pjangler identifier must read `pjid` and a Plane project `boardId`.
