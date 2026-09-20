# Research — Does a house design language already exist for Sidepiece to inherit?

Run: `ux-sidepiece-2026-09-20` · Discovery sweep · 2026-09-20
Scope: read-only sweep of `/home/delorenj/code`, `/home/delorenj/docker`, `/home/delorenj/.agents/skills`.
Nothing was modified.

**Bottom line up front: there is NO house design language.** There is no shared palette, no
shared font stack, no shared component library, no design-token package, and no cross-project
theme file. Every frontend Jarad owns is a self-contained visual world. What *does* exist and is
inheritable is a **house DESIGN.md schema**, a **house tooling convention** (shadcn + Tailwind v4
+ CSS custom properties, dark-first), and — critically — one **unfinished decision from a prior
BMAD UX run that asked this exact question and never got an answer.**

---

## 1. The finding that matters most: this question was already asked and abandoned

`/home/delorenj/code/33GOD/_bmad-output/planning-artifacts/ux-designs/ux-33GOD-2026-08-25/`

A `bmad-ux` run for **DeloHQ** (the 33GOD platform UX) was started 2026-08-25 and died at
frontmatter. Both deliverables are 9-line stubs — `status: draft`, zero body, `.working/` and
`imports/` empty:

```yaml
---
title: "DeloHQ Visual Design"
status: draft
created: 2026-08-25
updated: 2026-08-25
sources:
  - ../../briefs/brief-33GOD-2026-08-25/brief.md
  - ../../briefs/brief-33GOD-2026-08-25/addendum.md
---
```

Its `.memlog.md` records exactly why it stopped, verbatim:

> `- (event) UX creation started from the DeloHQ product brief and idea bank; current Holocene HQ is behavioral evidence pending Jarad's decision on visual inheritance.`

**"Pending Jarad's decision on visual inheritance."** That decision was never made. Sidepiece's
DESIGN.md is the second BMAD run to hit the same wall. This is not a gap to fill silently — it is
a standing open question that belongs to Jarad.

---

## 2. Inventory: every real 33GOD / DeLoNET frontend, with actual values

### 2.1 Holocene — `/home/delorenj/code/33GOD/holocene` (the strongest candidate, and the most compromised)

The only 33GOD surface with a fully articulated, written design system. Two versions exist and
they disagree.

**(a) Shipped code** — `apps/web/app/globals.css` (1792 lines, hand-written, no framework; last
touched **2026-09-13**, the most recently modified 33GOD CSS):

```css
:root {
  color-scheme: dark;
  --bg: #0b1020;      --panel: #121a2d;   --panel-2: #172036;
  --line: #26324d;    --text: #eef3ff;    --muted: #9aa8c7;
  --blue: #7fb0ff;    --green: #69d3a5;   --yellow: #ffd166;
  --red: #ff7a90;     --ink: #07111f;
}
body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button { border-radius: 8px; min-height: 40px; padding: 0 14px; }
```

Radius: 8px default, 6px chips, 999px pills, 32px hero. Depth: **no shadows at all** — layering is
background lightness + 1px `--line` borders. Single breakpoint at `max-width: 820px`.

**(b) Written spec** — `.stitch/DESIGN.md`, 305 lines, 2026-07-01. Full token frontmatter
(`colors` / `typography` / `rounded` / `spacing` / `components`) plus the eight canonical prose
sections. It is genuinely good and directly quotable. Its own stated laws:

> "Do spend saturated color only on state (active/idle/checking/attention/unknown). Surfaces and chrome stay navy-slate and quiet."
> "Rule of thumb: sans for people, mono for machines, and never mix them within a single value."
> "Deliberately **flat** — there are no drop shadows."
> "Don't add drop shadows, gradients (except functional severity hatching), or a second brand color — there isn't one."

**(c) The audit that invalidates it.** `_bmad-output/planning-artifacts/ia-redesign-2026-09/VERIFIED-GROUND-TRUTH.md`
(2026-09-06) measured the shipped app against the spec. Verbatim:

> "**Three unreconciled palettes in one file**: the `:root` ramp (--bg #0b1020, --panel #121a2d, --line #26324d, --text #eef3ff, --muted #9aa8c7, --blue #7fb0ff, --green #69d3a5, --yellow #ffd166, --red #ff7a90); an rgba-white neutral ramp governing the ENTIRE Systems tab (globals.css:1203-1579); and a **Catppuccin accent set** (#8aadf4 / #ed8796 / #a6da95 / #f5a97f) in the systems chips and charts. None resolve to the same values."
>
> "**Inter is declared in globals.css:30 and loaded NOWHERE** — no @font-face, no next/font, no `<link>`. `.stitch/DESIGN.md` (305 lines) specifies a complete Inter type system across 8 scales that has never once rendered."
>
> "NO spacing scale, NO type scale, NO radius scale (8px everywhere), NO elevation, NO motion tokens."
> "**Exactly one `:focus` rule and no `:focus-visible`.**"
> "**One dashed grey `.empty` box doing triple duty as loading, empty AND error.**"
> "**FOUR incompatible severity vocabularies**"

**I re-verified the font claim today, 2026-09-20: it still holds.**
`grep -rn 'next/font|@font-face|fonts.googleapis' apps --exclude-dir=node_modules --exclude-dir=.next`
returns nothing. Holocene has rendered in the browser's default sans for its entire life.

**(d) The September redesign — newest design thinking in the constellation, NOT shipped.**
`_bmad-output/planning-artifacts/ia-redesign-2026-09/design/` (2026-09-06), six Claude Design
artboards + `canvas.json`, published at `https://claude.ai/code/artifact/9566554f-0184-4186-930d-cda24ca71a75`.
It changes the type stack and formalises a severity system:

```css
body { font-family: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif; }
.mono { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
        font-variant-numeric: tabular-nums; }
/* loaded via fonts.googleapis.com IBM+Plex+Mono:400,500,600 & IBM+Plex+Sans:400,500,600 */
```

Six-rung ladder (`design/Ladder.dc.html:147`, identical in `Main.dc.html:213`):

```js
const C = { blocked: '#ff5f6d', broken: '#ff9152', stuck: '#ffd166', nudge: '#7fb0ff', ok: '#6b7793' };
// glyphs: BLOCKED ◆ · BROKEN ● · STUCK ▲ · NUDGE ▪ · OK ─ · CLEARED ─ (#69d3a5)
```

Surfaces retained from the old ramp: `#0b1020` page, `#07111f` truth strip, `#26324d` rules,
`#eef3ff` text, `#c3ccdf` link, `#9aa8c7` / `#7c89a6` / `#5d6b8a` / `#56637f` muted tiers,
`#151e33` row hover, `#141c33` hairline.

Its `design/README.md` states the rules as law. These are the sharpest, most transferable
statements of Jarad's current taste anywhere on the machine:

> "**A rung hue never appears on chrome, controls, filters, captions or explainers** — only on a row, cell or badge whose severity it states."
> "**No rung hue appears without its glyph.** BROKEN and NUDGE differ by 1.01:1 in luminance, so the glyph carries the meaning."
> "**OK is grey.** Green means exactly one thing: left the queue in the last 6 hours."
> "**Confidence is form, never hue**, and no confidence treatment may push text under 3:1 (`opacity` is invisible to a colour audit — compute the blend)."
> "**10.5px for static chrome at >=4.5:1; 11.5px minimum for anything variable.** Density comes from leading, not from shrinking type."
> "**Hollowness is never the sole signal.**"

And its hard constraints, verbatim from `VERIFIED-GROUND-TRUTH.md`:

> "Dark-first. Operator lives in a terminal. Monospace is a legitimate primary voice here."

None of this shipped. `globals.css` (2026-09-13, a week *after* the redesign) contains no IBM
Plex and none of the rung hexes.

### 2.2 Candystore — `/home/delorenj/code/33GOD/candystore/web` (2026-05-26)

Tailwind v3, three custom colors, no shadcn, no `components.json`, no dark-mode class — dark is
the only mode.

```js
// tailwind.config.js
theme: { extend: { colors: { ink: "#101216", panel: "#181b20", line: "#2a2f36" } } }
```
```css
/* src/index.css */
:root { color-scheme: dark; background: #101216;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.focus-ring { @apply focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-ink; }
```

**Not Holocene's palette.** Neutral-grey-black (`#101216`) vs Holocene's navy (`#0b1020`);
amber-400 focus vs Holocene's blue. Shares only `color-scheme: dark` and the Inter declaration.

### 2.3 Candybar — `/home/delorenj/code/trunk-main/candybar` (CSS last touched 2026-01-07)

Tauri 2 + React 19 + Tailwind v4.1.18 + shadcn (`"style": "default"`, `"baseColor": "slate"`) +
Radix + lucide-react + framer-motion + recharts. Its `src-next/css/index.css` is the
**stock unmodified shadcn slate theme** — `--background: 0 0% 100%` light default, `.dark` class
variant, `--radius: 0.5rem`, system font stack. Zero customisation. Stale (Jan 2026) relative to
everything else.

### 2.4 Kapture / liam extension — `/home/delorenj/code/liam/extension/panel.css` (2026-09-18)

**The only Chrome-extension UI surface Jarad currently maintains**, and the closest architectural
sibling to Sidepiece. Vanilla JS + hand-written CSS, 435 lines, no build step.

```css
:root {
  --bg-primary: #1e1e1e;  --bg-secondary: #252526;  --bg-tertiary: #2d2d30;
  --text-primary: #cccccc; --text-secondary: #969696; --border-color: #464647;
  --accent-blue: #3794ff; --accent-green: #4ec9b0; --accent-orange: #ff9800;
  --accent-red: #f44336;  --hover-bg: #2a2a2a;      --selection-bg: #094771;
}
html, body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
             font-size: 13px; }
```

Plus a second, inconsistent Chrome-DevTools/Material accent set further down the same file:
`#8ab4f8`, `#f28b82`, `#81c995`, `#fdd663`, `#9aa0a6`, `#5f6368`, `#e8eaed`.

This is **not authored house style — it is the VS Code / Chrome DevTools dark theme**, adopted so
the DevTools panel disappears into its host chrome. Relevant precedent for Sidepiece only if
Sidepiece wants to look native to Chrome rather than native to 33GOD. That is a fork in the road,
not an inheritance.

### 2.5 No frontend at all

`wax`, `pilot`, `HeyMa`, `bloodbank`, `pjangler`, `krebs`, `flume`, `mcp-hub`, `momo` — swept for
`*.css`, `*.tsx`, `*.jsx`, `tailwind.config*`, `components.json`. **Zero hits.** They are CLIs and
services. There is nothing to inherit from them.

---

## 3. Is there a shared palette? No — measured, not assumed

I grepped every Holocene and Candystore token across all of `/home/delorenj/code`
(excluding `.git`, `node_modules`, `dist`, `.next`):

| hex | token | appears outside its own project? |
|---|---|---|
| `#0b1020` | Holocene bg | **No.** Only Holocene + one archived session log + unrelated Rust/Swift literals. |
| `#7fb0ff` | Holocene blue | **No.** Holocene only. |
| `#69d3a5` | Holocene green | **No.** Holocene only. |
| `#ff7a90` | Holocene red | **No.** Holocene only. |
| `#eef3ff` | Holocene text | **No.** Holocene + one 2026-05 journal HTML. |
| `#ffd166` | Holocene yellow | Holocene + the vendored `hyperframes` "bold-energetic" palette pack (third-party, unrelated). |
| `#101216` | Candystore ink | **No.** Candystore only. |

**No hex value is shared between two Jarad-authored projects.** The de facto house style does not
exist at the palette level. What repeats is only a *posture*: dark-first, near-monochrome
surfaces, one accent, color reserved for state.

### What DOES repeat (the real, weak house signal)

Across every Jarad-authored frontend, three things are consistent:

1. **Dark-first, always.** `color-scheme: dark` in Holocene and Candystore; `.dark` shipped in
   Candybar and Intelliforia; Holocene's hard constraint "Dark-first. Operator lives in a
   terminal." No Jarad tool surface defaults to light.
2. **Monospace carries machine data.** Holocene (`SFMono-Regular, Consolas, "Liberation Mono",
   ui-monospace`), the September redesign (`IBM Plex Mono` with `tabular-nums`), james-brennan
   (`--font-data: ui-monospace, 'SF Mono', …`). Every surface separates human text from machine
   text by family.
3. **Structure from 1px borders, not shadows.** Holocene bans shadows outright; james-brennan uses
   `--rule-hair: 1px` and `--radius-sm: 2px`.

Recent shadcn choices also cluster: Jarad's four most recent shadcn repos all pick
`"baseColor": "neutral"` with the newer registry styles — `base-lyra` (`james-brennan/apps/surface`
2026-09-19, `client-portal`), `base-nova` (`ssbnk/ui`, `newapi/web`), `radix-nova`
(`gruvato`, `ShadCNV4`). His older repos are `slate`/`zinc` with `default`/`new-york`. If
Sidepiece uses shadcn, `base-lyra` + `neutral` is the current habit.

---

## 4. The one mature design-system *practice* on this machine — and whose it is

`/home/delorenj/code/james-brennan/apps/surface` (client project; `styles.css` touched **2026-09-19**,
3731 lines — the single most actively maintained stylesheet Jarad owns).

Mechanism worth copying, palette that is not Sidepiece's to take:

- `.design-sync/` — `config.json`, `conventions.md`, `ground.css`, `ds-entry.tsx`, `learnings/`, `previews/`
- `ds-bundle/` — compiled `_ds_bundle.css` / `.js`, `tokens/`, `guidelines/`, `components/`,
  `.render-check.json`, `.resync-verdict.json`, `_screenshots/`
- A `DesignSync` tool is available in this session's toolset, i.e. this is a first-class workflow,
  not a one-off.

Its tokens are OKLCH, not hex, and it is warm-dark with one amber accent:

```css
--color-paper: oklch(15.0% 0.012 64);   --color-ink:    oklch(93.0% 0.011 76);
--color-rule:  oklch(30.0% 0.013 64);   --color-accent: oklch(79.0% 0.152 74);
--color-lit:   oklch(89.0% 0.026 82);   --color-done:   oklch(72.0% 0.105 152);
--font-data: ui-monospace, 'SF Mono', …;  --font-voice: ui-serif, 'Iowan Old Style', …;
--text-meta: 14px; --text-body: 17.5px; --text-effect: 22px; --text-lede: 46px;
--space-3xs: 4px … --space-3xl: 64px;  --rule-hair: 1px;  --radius-sm: 2px;
--ease-out: cubic-bezier(0.16, 1, 0.3, 1); --dur-micro: 120ms; --dur-short: 300ms; --dur-long: 620ms;
--measure: 54ch;
```

Its `conventions.md` shows the *shape* of rule Jarad writes when he is serious about a system:

> "One hue, three intensities, and they encode **ownership, never activity**."
> "**Chrome is never amber** — not a header, rule, label, nav marker, or control border. Even the focus ring is ink (`--color-ring`), deliberately."
> "On a quiet or settled screen there is **not one amber pixel**."
> "Amber *area* is meant to measure the size of his to-do list, so decorative amber is a defect."
> "**Tailwind compiles this stylesheet, but the vocabulary is NOT utility classes.** Do not write `bg-paper`, `text-ink`, `p-4` — they do not exist here."

**Vocabulary collision worth flagging:** this project's page-container classes are `.chair` (the
Quiet Room), `.deck` (**the Cockpit**), `.hall` (the Engine Room). "Cockpit" is already a room
name in a different product's design system. It is a coincidence, not a shared token — but if
Sidepiece ever borrows the `.design-sync` machinery, the two will sit side by side.

---

## 5. Sidepiece today: what exists vs. what was only planned

**Nothing exists.** `/home/delorenj/code/sidepiece` has no `package.json`, no `src/`, no
`manifest.json`, no CSS, no JS/TS, no `components.json`. Full top-level contents: agent-harness
dot-dirs, `.mise/`, `.project.json`, `AGENTS.md` (symlinked as `CLAUDE.md`/`GEMINI.md`),
`BRAINDUMP.md`, `_bmad/`, `_bmad-output/`, `agents/`, `docs/product-brief.md`, `mise.toml`, and
one exported session transcript. This is a **pure planning repo**.

The June SIDE board's "EPIC A — Foundation" was only ever planned, and the current PRD
deliberately deprioritises it. From `prd-sidepiece-2026-09-17/prd.md:360`, verbatim:

> `| A — Foundation: monorepo, core, UI kit | **Survives.** Model-independent. But it is four tickets of scaffolding ahead of the hard part; sequence it behind a working Bridge rather than in front of it. |`

**The four Sidepiece source docs are silent on frontend stack.** Grepping `prd.md`,
`architecture.md`, `docs/product-brief.md` and `BRAINDUMP.md` for `ui kit|design system|shadcn|
tailwind|react|preact|svelte|vite|css|theme|dark mode|font|color` returns only the EPIC A row
above, a "Project registry (the foundation)" heading, and the element-picker FR. The PRD explicitly
parks the choice: *"Transport and framework choices deliberately live in `addendum.md`, not here."*
So **framework, component library, palette, typography and theming are all still open.** Silent is
the accurate word.

For reference, `intelliforia-mobile/extension` (a client MV3 extension Jarad ships) proves the
stack pattern is in his hands: `manifest_version: 3`, `"sidePanel"` permission,
`minimum_chrome_version: 114`, React + Tailwind v3 + shadcn (`new-york`/`slate`) — though its CSS
is the **stock unmodified shadcn slate theme**, so there is no visual language to take from it.

---

## 6. House skills: what they mandate

`/home/delorenj/.agents/skills` → all symlinks into `/home/delorenj/code/skillex/all-skills`.
There is **no house theming or palette skill**. No `theme.json`, no tokens package, no
`@delonet/ui`. The relevant skills are process, not style:

### `impeccable` v4.0.2 — the governing design skill
User-invocable, and the only skill that owns DESIGN.md. Key mandates:

- Run `node <skill>/scripts/context.mjs` once per session; "It loads PRODUCT.md, DESIGN.md, the
  matching surface brief."
- **"Visual authority is evidence, not a filename. Missing DESIGN.md alone does not make a project greenfield."**
- **Modes**: Sidepiece is squarely **Operate** — *"the visitor completes a task. App UI,
  dashboards, editors, admin, settings, tools. Scanability, consistency, native expectations, and
  the real usage scene outrank expression. Brand lives in precise details."*
- `reference/craft-floor.md` must be loaded immediately before editing UI (quality floor +
  absolute bans). `reference/new-work.md` owns a new surface. `reference/operate.md` owns Operate.

### The DESIGN.md format is mandated and portable
`impeccable/reference/document.md` states it verbatim:

> "DESIGN.md follows the [official DESIGN.md format spec](https://raw.githubusercontent.com/google-labs-code/design.md/main/docs/spec.md): optional YAML frontmatter carrying machine-readable design tokens, followed by up to eight markdown sections in a fixed order. **Tokens are normative; prose provides context for how to apply them.**"

Hard rules it imposes:
- Frontmatter keys: `name`, `description`, then `colors`, `typography`, `rounded`, `spacing`, `components`.
- Token refs use `{path.to.token}`; components may reference primitives, primitives may not reference each other.
- **Component sub-tokens are limited to 8 props**: `backgroundColor`, `textColor`, `typography`,
  `rounded`, `padding`, `size`, `height`, `width`. *"Shadows, motion, focus rings, backdrop-filter:
  none of those fit."* — they go in a sidecar.
- Eight canonical sections in fixed order: `Overview`, `Colors`, `Typography`, `Layout`,
  `Elevation & Depth`, `Shapes`, `Components`, `Do's and Don'ts`. *"Omit irrelevant sections
  rather than filling them with invented rules."*

Both `holocene/.stitch/DESIGN.md` and `project-delorenj/.../DESIGN.md` conform exactly, so this
schema **is** the house convention. `project-delorenj`'s file also carries an operational note
Sidepiece's DESIGN.md must respect:

> `# Frontmatter key order: doc-meta keys FIRST (name, description, status, updated, sources), then the token blocks in spec order (colors, typography, rounded, spacing, components).`
> `# 'status' and 'updated' are intentionally top-level — the bmad-ux resume scanner reads them there.`

### Other skills — what they are and are not
- **`design-md`** — Stitch-specific: "Analyze Stitch projects and synthesize a Semantic Design
  System." Requires the Stitch MCP server. Produces a *prose* DESIGN.md (5 numbered sections),
  a **different and older format** than impeccable's eight-section spec. Do not mix the two.
- **`shadcn-components`** — "Use its components.json, package manager, aliases, and design tokens;
  do not assume a monorepo packages/ui layout… **Existing identity and the user brief control
  design choices.**" Explicitly defers to whatever Sidepiece decides; mandates nothing.
- **`antislop-ui`** — "Preserve deliberate voice, typography, palette, and motion choices. **For a
  new UI direction, use `impeccable`**; this skill critiques execution of that direction."
- **`theme-factory`** — 10 generic presentation themes (Ocean Depths, Midnight Galaxy…) for slides
  and docs. Not a product-UI system. Irrelevant here.
- **`canvas-design`** — static poster/PDF art. Irrelevant here.
- **`delonet-conventions`** — grepped for `brand|color|palette|font|logo|visual|design`: **zero
  hits.** The house conventions skill is entirely silent on visual identity.
- No `design` skill exists locally; the "seeding helper" the Holocene redesign README references
  is the Claude-bundled Design/Artifact tooling, not a repo skill.

---

## 7. Precedent for how Jarad writes a design system when he cares

Not house style — but evidence of taste, and of the bar he sets. Two fully realised, mutually
incompatible systems:

- **`project-delorenj/.../DESIGN.md`** ("Career Ascent", `status: final`, 632 lines, 2026-08-12) —
  cel-shaded poster world, six-band grit→neon ramp, WCAG ratios computed per token and annotated
  inline (`# darkened one step → 5.0:1 on canvas-light (was #63707F @ 4.48:1 FAIL)`), full
  dark+light sibling sets.
- **`gruvato/DESIGN.md`** (6600 bytes, **modified 2026-09-20 02:46 — hours before this run**) —
  `design-md` prose format. "Deep Obsidian Noir (#111210)", "Electric Acid Wasabi (#BAE791)",
  Geist Variable + Space Grotesk, 4–8px radius, explicitly "never overly bubbly."
  Contains the anti-target too: *"no decorative gradients without acoustic meaning, no floating
  pastel bubbles… rather than generic SaaS dashboards."*

And a standing **taste ban** worth putting in front of Jarad, from
`Dompacolypse/site/DESIGN.md` (2026-07-08), which autopsies his own earlier site as
*"textbook AI slop"*:

> "**The AI neon aesthetic** — `#00f0ff` cyan + `#8b5cf6` violet… The single most recognizable 'an AI made this' signature."
> "**`Inter` font** — The default 'safe' font. Zero character. Banned for premium/creative work."
> "**Everything is a glass card** — When every element floats with the same blur + shadow, elevation stops meaning anything."

Inter is the font Holocene and Candystore both declare. If Sidepiece inherits Holocene, it
inherits a font Jarad has elsewhere called out by name.

---

## 8. Recency compass (`ctime`, newest last) — what to trust

```
2026-01-07  candybar/src-next/css/index.css              stock shadcn slate, STALE
2026-05-26  33GOD/candystore/web/src/index.css           tiny, 3 tokens
2026-07-01  33GOD/holocene/.stitch/DESIGN.md             305-line spec, superseded by the 09-06 audit
2026-07-13  intelliforia-mobile/extension/.../globals.css stock shadcn slate, client
2026-08-12  project-delorenj/.../DESIGN.md               final, different product
2026-08-25  33GOD/.../ux-33GOD-2026-08-25/DESIGN.md      9-line STUB — the abandoned decision
2026-08-30  james-brennan/.../design-sync/conventions.md the mature practice, client-owned
2026-09-06  33GOD/holocene/.../ia-redesign-2026-09/      newest 33GOD design thinking, NOT shipped
2026-09-13  33GOD/holocene/apps/web/app/globals.css      shipped Holocene, three palettes, no font
2026-09-18  liam/extension/panel.css                     the live Chrome extension surface
2026-09-19  james-brennan/apps/surface/src/styles.css    most actively maintained sheet on the box
2026-09-20  gruvato/DESIGN.md                            touched hours ago, unrelated product
```

---

## 9. Facts, stated plainly

1. There is **no house design language**, no shared palette, no shared font, no token package, no
   `@delonet/ui`. Every frontend is its own world. DESIGN.md for Sidepiece gets invented.
2. There **is** a house **DESIGN.md schema** (impeccable / google-labs-code spec: token
   frontmatter + eight fixed sections) and Sidepiece must conform to it, including the top-level
   `status`/`updated` keys the bmad-ux resume scanner reads.
3. The nearest thing to a house *posture* is three habits, not a palette: **dark-first**,
   **mono-for-machine-data**, **structure from 1px borders, never shadows**.
4. Holocene is the only 33GOD surface with a written system — and its own 2026-09-06 audit
   declares it three unreconciled palettes deep with a font that has never rendered. Inheriting it
   means inheriting known debt, or inheriting the **redesign** (IBM Plex, six-rung ladder,
   glyph-with-hue law) which has never shipped.
5. A prior BMAD UX run already parked this exact decision as *"pending Jarad's decision on visual
   inheritance."* It is his call, not bmad-ux's.

---

## 10. Sources read (all absolute)

- `/home/delorenj/code/33GOD/_bmad-output/planning-artifacts/ux-designs/ux-33GOD-2026-08-25/{DESIGN.md,EXPERIENCE.md,.memlog.md}`
- `/home/delorenj/code/33GOD/holocene/.stitch/DESIGN.md`
- `/home/delorenj/code/33GOD/holocene/apps/web/app/globals.css`
- `/home/delorenj/code/33GOD/holocene/apps/web/app/hq/hq.css`
- `/home/delorenj/code/33GOD/holocene/_bmad-output/planning-artifacts/ia-redesign-2026-09/VERIFIED-GROUND-TRUTH.md`
- `/home/delorenj/code/33GOD/holocene/_bmad-output/planning-artifacts/ia-redesign-2026-09/design/{README.md,Main.dc.html,Ladder.dc.html}`
- `/home/delorenj/code/33GOD/candystore/web/{tailwind.config.js,src/index.css}`
- `/home/delorenj/code/trunk-main/candybar/{components.json,package.json,src-next/css/index.css}`
- `/home/delorenj/code/liam/extension/panel.css`
- `/home/delorenj/code/james-brennan/apps/surface/{components.json,src/styles.css,.design-sync/conventions.md}`
- `/home/delorenj/code/intelliforia-mobile/extension/{manifest.json,tailwind.config.js,components.json,src/styles/globals.css}`
- `/home/delorenj/code/project-delorenj/_bmad-output/planning-artifacts/ux-designs/ux-project-delorenj-2026-07-16/DESIGN.md`
- `/home/delorenj/code/gruvato/DESIGN.md`
- `/home/delorenj/code/Dompacolypse/site/DESIGN.md`
- `/home/delorenj/code/skillex/all-skills/{impeccable/SKILL.md,impeccable/reference/document.md,design-md/SKILL.md,shadcn-components/SKILL.md,antislop-ui/SKILL.md,theme-factory/SKILL.md,canvas-design/SKILL.md,delonet-conventions/SKILL.md}`
- `/home/delorenj/code/sidepiece/` (full tree), `_bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/prd.md`,
  `_bmad-output/planning-artifacts/architecture.md`, `docs/product-brief.md`, `BRAINDUMP.md`, `.project.json`, `AGENTS.md`
