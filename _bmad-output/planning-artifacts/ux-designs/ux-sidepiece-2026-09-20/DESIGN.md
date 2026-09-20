---
# Frontmatter key order: doc-meta keys FIRST (name, description, status, updated, project,
# sources), then the token blocks in spec order (colors, typography, rounded, spacing,
# marks, components). 'status' and 'updated' are top-level because the bmad-ux resume
# scanner reads them there. 'marks' is a declared extension — see "Conflicts with the spec".
#
# Token paths are NESTED, not flat kebab-case. EXPERIENCE.md is the peer contract and it
# references tokens as {colors.surface.panel}, {colors.state.ok}, {typography.mono}. The
# spec says "the path follows the YAML structure", so nested is the only shape that
# resolves those references. See "Conflicts with the spec, declared" at the foot of this
# document.
name: Sidepiece
description: A printed instrument laid on top of somebody else's screen. Warm paper, serif ink, a fluorescent signature and detached registration ticks that make a Sidepiece mark unmistakable on a white docs site and a black dashboard alike.
status: draft
updated: 2026-09-20
project: sidepiece
sources:
  - .working/direction-foreign.html
  - .working/research-house-design-language.md
  - .decision-log.md
  - EXPERIENCE.md

colors:
  surface:
    panel: '#F2EDE3'          # the sheet — Cockpit ground
    raised: '#FBF8F1'         # pinned header, action bar, composer, result blocks
    sunken: '#E8E0D0'         # collapsed group interiors, input wells, machine blocks
    overlay: '#F2EDE3'        # [v2] in-page sheet — deliberately identical to panel
    stamp: '#191713'          # inverted band ground (dispatch, failure, submit)
    spotWash: '#FFE4EC'       # spot at fill strength; one consumer — selection.ground
  border:
    hairline: '#CFC3AB'       # the 1px printed rule — box edges, section rules
    strong: '#191713'         # the pinned/scrolling seam, group headers, stamped bands
    faint: '#E0D7C4'          # row separators inside a list
    sheet: '#C9BDA6'          # the outer edge of any Sidepiece sheet
  text:
    primary: '#191713'        # serif body and headings, full-strength rules
    muted: '#645D4E'          # captions, metadata, secondary lines
    machine: '#1B3FA0'        # ALL machine data, in mono: paths, pjid, cid, commands
    inverse: '#F2EDE3'        # ALL type AND ALL marks on {colors.surface.stamp}
    onSpot: '#191713'         # type on {colors.action.mark} — ink, never white
  state:
    ok: '#645D4E'             # OK is grey. Nothing is ever green. Mark: marks.ok
    pending: '#4C463A'        # ink still wet. Mark: marks.pending
    degraded: '#8A5A0B'       # the one hue admitted to the state set. Mark: marks.degraded
    failed: '#191713'         # stamped, inverted, never coloured. Mark: marks.failed
    unknown: '#645D4E'        # shares ok's ink on purpose; the mark carries it
  action:
    primary: '#191713'        # the submit. Committing is a stamp.
    mark: '#FF2E63'           # THE SPOT. Identity and armed/active marks only. Never state.
    markDeep: '#C2003F'       # the only spot that may set type on paper
  overlay:
    signature: '#FF2E63'      # THE SIGNATURE INK. One value, every surface, both grounds,
                              # never themed. Equal to action.mark by role, not by accident.
    outline: '#FF2E63'        # [v2] hover outline and freehand stroke
    scrim: 'rgba(255, 46, 99, 0.14)'
    keylineDark: '#191713'    # outer keyline — carries the mark on light pages
    keylineLight: '#FFFFFF'   # inner keyline — carries the mark on dark pages
  focus:
    ring: '#191713'           # outer ink of the two-tone keyline
    ringInner: '#F2EDE3'      # inner paper of the two-tone keyline
  selection:
    ground: '#FFE4EC'         # ::selection ground — never action.mark
    ink: '#191713'            # ::selection type — 14.97:1

typography:
  heading:
    fontFamily: '"Charis SIL", Georgia, "Noto Serif", "Liberation Serif", serif'
    fontSize: 22px
    fontWeight: '700'
    lineHeight: '1.05'
    letterSpacing: -0.015em
    fontSizeAdjust: '0.481'
  body:
    fontFamily: '"Charis SIL", Georgia, "Noto Serif", "Liberation Serif", serif'
    fontSize: 13.5px
    fontWeight: '400'
    lineHeight: '1.55'
    letterSpacing: normal
    fontSizeAdjust: '0.481'
  label:
    fontFamily: '"IBM Plex Mono", "Cascadia Mono", ui-monospace, "DejaVu Sans Mono", monospace'
    fontSize: 11.5px
    fontWeight: '500'
    lineHeight: '1.35'
    letterSpacing: 0.04em
    fontSizeAdjust: '0.516'
    fontVariantNumeric: tabular-nums
  micro:
    fontFamily: '"IBM Plex Mono", "Cascadia Mono", ui-monospace, "DejaVu Sans Mono", monospace'
    fontSize: 10.5px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: 0.10em
    fontSizeAdjust: '0.516'
  mono:
    fontFamily: '"IBM Plex Mono", "Cascadia Mono", ui-monospace, "DejaVu Sans Mono", monospace'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.45'
    letterSpacing: 0.01em
    fontSizeAdjust: '0.516'
    fontVariantNumeric: tabular-nums
  numeral:
    fontFamily: '"IBM Plex Mono", "Cascadia Mono", ui-monospace, "DejaVu Sans Mono", monospace'
    fontSize: 10px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0em
    fontSizeAdjust: '0.516'
    fontVariantNumeric: tabular-nums

rounded:
  control: 0px
  panel: 0px
  pill: 9999px

spacing:
  hair: 4px
  tight: 6px
  inset: 9px
  glyph: 11px
  gutter: 14px
  stack: 15px
  section: 24px
  row: 32px

# EXTENSION, declared at the foot of this document. The mark is half of every state and the
# Glyph Law is this document's strongest accessibility claim. A YAML comment cannot be
# enforced by a generator, so the mark is carried as data. 'form: drawn' means CSS geometry
# in currentColor, not a character — see Components → The Mark Law.
marks:
  ok:
    form: drawn
    figure: rule            # a 7 x 1px bar, centred
    box: '{spacing.glyph}'
    weight: '400'
  pending:
    form: typed
    figure: '»'             # U+00BB, Latin-1 — the one block every fallback guarantees
    box: '{spacing.glyph}'
    weight: '500'
  degraded:
    form: drawn
    figure: triangle        # 8px base, 7px rise, filled
    box: '{spacing.glyph}'
    weight: '500'
  failed:
    form: drawn
    figure: square          # 7 x 7px, filled
    box: '{spacing.glyph}'
    weight: '600'
  unknown:
    form: drawn
    figure: circle          # 7 x 7px, 1px ring, hollow
    box: '{spacing.glyph}'
    weight: '400'

components:
  identityHeader:
    backgroundColor: '{colors.surface.raised}'
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.strong}'
    typography: '{typography.heading}'
    padding: '13px {spacing.gutter} 12px'
    rounded: '{rounded.panel}'
  copyControl:
    backgroundColor: transparent
    textColor: '{colors.text.muted}'
    borderColor: '{colors.border.hairline}'
    typography: '{typography.micro}'
    padding: '0 8px'
    height: 32px
    rounded: '{rounded.control}'
  degradedConnectionIndicator:
    backgroundColor: transparent
    textColor: '{colors.state.degraded}'
    typography: '{typography.micro}'
    padding: '0 0 0 {spacing.gutter}'
    height: 16px
  paneSwitch:
    backgroundColor: '{colors.surface.raised}'
    textColor: '{colors.text.muted}'
    borderColor: '{colors.border.strong}'
    typography: '{typography.label}'
    padding: '0 10px'
    height: 32px
    rounded: '{rounded.control}'
  healthMarker:
    backgroundColor: transparent
    typography: '{typography.label}'
    padding: '0'
    size: '{spacing.glyph}'
  stateNotice:
    backgroundColor: '{colors.surface.raised}'
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.strong}'
    typography: '{typography.body}'
    padding: '10px {spacing.inset} 11px'
    rounded: '{rounded.panel}'
  reResolveControl:
    backgroundColor: '{colors.action.primary}'
    textColor: '{colors.text.inverse}'
    typography: '{typography.label}'
    padding: '0 11px'
    height: 32px
    rounded: '{rounded.control}'
  turnComposer:
    backgroundColor: '{colors.surface.raised}'
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.hairline}'
    typography: '{typography.body}'
    padding: '{spacing.inset}'
    height: 188px
    rounded: '{rounded.panel}'
  classificationControl:
    backgroundColor: '{colors.surface.raised}'
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.strong}'
    typography: '{typography.label}'
    padding: '0 {spacing.inset}'
    height: 30px
    width: 100%
  contextChip:
    backgroundColor: '{colors.surface.sunken}'
    textColor: '{colors.text.muted}'
    borderColor: '{colors.border.hairline}'
    typography: '{typography.body}'
    padding: '6px 8px'
    rounded: '{rounded.control}'
  turnCard:
    backgroundColor: transparent
    textColor: '{colors.text.primary}'
    borderColor: '{colors.action.mark}'
    typography: '{typography.body}'
    padding: '1px 0 1px {spacing.inset}'
  jumpToLatest:
    backgroundColor: '{colors.action.primary}'
    textColor: '{colors.text.inverse}'
    typography: '{typography.label}'
    padding: '0 10px'
    height: 28px
    rounded: '{rounded.control}'
  ticketGroupHeader:
    backgroundColor: '{colors.surface.panel}'
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.strong}'
    typography: '{typography.label}'
    padding: '4px 0 6px'
    height: 30px
  ticketRow:
    backgroundColor: transparent
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.faint}'
    typography: '{typography.body}'
    padding: '8px 0'
    height: 58px
  ticketCreateBox:
    backgroundColor: '{colors.surface.raised}'
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.hairline}'
    typography: '{typography.body}'
    padding: '{spacing.inset}'
    rounded: '{rounded.panel}'
  refetchControl:
    backgroundColor: transparent
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.strong}'
    typography: '{typography.label}'
    padding: '0 10px'
    height: 28px
    rounded: '{rounded.control}'
  commandString:
    backgroundColor: '{colors.surface.sunken}'
    textColor: '{colors.text.machine}'
    borderColor: '{colors.border.hairline}'
    typography: '{typography.mono}'
    padding: '5px 7px'
    rounded: '{rounded.control}'
  hoverOutline:
    backgroundColor: '{colors.overlay.scrim}'
    borderColor: '{colors.overlay.outline}'
    size: 2px
    rounded: '{rounded.control}'
  commentBubble:
    backgroundColor: '{colors.surface.overlay}'
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.sheet}'
    typography: '{typography.body}'
    padding: '7px 9px 8px'
    width: 280px
    rounded: '{rounded.panel}'
  freehandLayer:
    backgroundColor: transparent
    borderColor: '{colors.overlay.outline}'
    size: 3px
    width: 100%
    height: 100%
  annotationPin:
    backgroundColor: '{colors.action.mark}'
    textColor: '{colors.text.onSpot}'
    borderColor: '{colors.overlay.keylineLight}'
    typography: '{typography.numeral}'
    size: 18px
    rounded: '{rounded.pill}'
  annotationRow:
    backgroundColor: transparent
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.faint}'
    typography: '{typography.body}'
    padding: '8px 0'
    height: '{spacing.row}'
  dischargeControl:
    backgroundColor: '{colors.action.primary}'
    textColor: '{colors.text.inverse}'
    typography: '{typography.label}'
    padding: '0 {spacing.gutter}'
    height: 32px
    rounded: '{rounded.control}'
  attachmentChip:
    backgroundColor: '{colors.surface.sunken}'
    textColor: '{colors.action.markDeep}'
    borderColor: '{colors.action.markDeep}'
    typography: '{typography.label}'
    padding: '0 7px'
    height: 24px
    rounded: '{rounded.control}'
  iconBadge:
    backgroundColor: '{colors.action.mark}'
    textColor: '{colors.text.onSpot}'
    size: 16px
---

# Sidepiece — DESIGN.md

**DESIGN.md owns how it looks. `EXPERIENCE.md` owns how it behaves.** Where this document
names a state, a control or a component, it specifies only its appearance; what it does,
when it appears and what it says are the spine's, and are not restated here.

---

## Brand & Style

**Creative North Star: "The Printed Instrument."**

Sidepiece is a warm paper sheet laid on top of somebody else's screen. Serif throughout,
ruled in ink, stamped rather than styled, signed at its inboard edge with a ticked
fluorescent spine and detached ink registration marks. Nothing in it is a card, a pill, a
gradient or a glass panel. It looks like a proof sheet on a light table, because that is
exactly what it is doing.

This register was chosen against three alternatives at true panel width, and it was chosen
for one reason: **Sidepiece is the only tool Jarad owns that draws on other people's
screens.** A hover outline, a comment bubble, a numbered pin, freehand markup — all of it
renders into a page whose colours, type and chrome are unknown and hostile. The moment a
Sidepiece mark is ambiguous with the page's own marks, the "finger on the clipboard"
confidence loop breaks: he points, and he is not sure what he pointed at. So the panel does
not try to belong. It carries a register that survives leaving the panel — the same spine,
the same registration ticks, the same signature ink are drawn on the Cockpit, on the hover
tooltip and on the in-page comment bubble, **so that a Sidepiece mark is unmistakably a
Sidepiece mark on a white docs site and on a black dashboard alike.**

That single requirement settles two house rules against themselves, and this document
defends both breaks with measured numbers rather than taste.

- **It is light, on a machine where every other surface is dark-first.** A dark panel beside
  a dark dashboard is camouflage, and camouflage is the one thing this direction cannot
  afford. The measurement: paper `#F2EDE3` on a dark dashboard ground `#0E1116` is
  **16.21:1** — the sheet is unmissable. The same paper against a white docs page is
  **1.17:1** — it nearly vanishes. That asymmetry is the whole argument. You cannot be
  foreign to both grounds with one ground, so you pick the ground where the sheet does the
  most work by itself, and you make the *signature* carry the other case.
- **It has a shadow, in a house that bans drop shadows.** The shadow is `3px 3px 0` with
  **zero blur**. A blurred shadow is atmosphere. An unblurred offset is a second sheet of
  paper. It is the semantics of *laid on top of, not part of* — **and it is a free-standing
  sheet's signature, not the Cockpit's.** The Cockpit *is* the side-panel viewport; it cannot
  paint outside itself and this revision stops pretending it can. See **Shapes → The
  signatures, by surface**, which is where the first draft was wrong.

One house rule is kept exactly: **monospace is reserved for machine-generated data.** What
changes is the other half of that pairing — the house says "sans for people," and here it
is **serif for people**, because web UI chrome is sans and a serif panel is instantly
not-the-page and not-the-browser. Charter and Georgia are among the very few serifs drawn
for small sizes on screen, which is the specific reason 13.5px body type is viable in a
304px column at all.

**Key characteristics**

- Warm paper ground, never white, never grey, never navy.
- Serif for human text; monospace for machine text; no sans-serif anywhere in the Cockpit.
- Square. Nothing has a corner radius except one `[v2]` annotation pin.
- One fluorescent signature ink, spent only on identity and on armed marks — never on status.
- Status is a drawn mark plus a word plus ink weight. Nothing is green, and red is not
  available because red is the signature.
- Structure from 1px printed rules. One unblurred offset, on free-standing sheets only.
  No elevation on hover, no motion as hierarchy, nothing that floats.

### Earning the register

Paper-and-ink is one bad decision away from being a novelty skin. Three things keep it
craft:

1. **The ink does real work.** Every rule in the Cockpit is a boundary a developer can name
   — a region seam, a row separator, a stamped band. There is no rule drawn "for texture."
2. **The signature ink is rationed, and the ration is exact.** `{colors.action.mark}` appears
   in **five** places in v1 and nowhere else: the clip band, the spine, the selected
   pane-switch underline, the selected classification-row underline, and the operator's own
   turn edge. Two of the five are always present; three are selection marks that move.
   **On a screen at rest with no Turn in the scroll region, the only spot pixels are the
   spine, the clip band and two 2px underlines.** If you find a spot *fill* anywhere in the
   Cockpit body, something is miscoloured. (The first draft contradicted itself between its
   own second and third sentences here, and then specified a 264 × 30px spot-filled
   classification row — the single largest resting spot area in the product, absent from both
   of its enumerations. It is now an underline.)
3. **The typography is the density mechanism.** Density comes from leading, never from
   shrinking type. The rendered direction set chrome labels at 8.5px; this document raises
   the floor to 10.5px static / 11.5px variable, and pays for it in leading and in one
   layout change (see **Layout & Spacing → What the raised type floor cost**). That
   correction is what separates a print-*look* from a printed *instrument*.

### Six tells that were removed

A printed register fails as *stationery* before it fails as *design*. Each of these was in
the rendered direction or the first draft, each one said "boutique packaging" rather than
"instrument," and each was fixed with one value:

| Tell | Was | Is |
|---|---|---|
| Tear-off perforation on the spine | `transparent 0 7px, rgba(255,255,255,.62) 7px 9px`, 10px wide | 1px registration ticks at 12px intervals, 6px wide — and 4px of column returned |
| Four crop marks on a docked panel | Four corners, inset −5px | Two inboard ticks, inset 3px *inside* the sheet; four detached ticks on free-standing sheets only |
| Logotype tracking on chrome | `micro` at 0.18em / weight 600 | 0.10em / weight 500 |
| Magazine pull-quote | The operator's turn in serif italic | Serif Roman; the 2px signature rule carries the distinction alone |
| The one pastel | `#FFE4EC` as an attachment-chip fill | The chip is `{colors.surface.sunken}` with a `markDeep` rule; the wash survives as `{colors.selection.ground}`, which is what a wash is actually for |
| Jittering counts | `label` at 0.08em with no numeric variant | `label` at 0.04em with `tabular-nums` — an instrument's numbers do not move |

---

## Colors

The palette is four warm papers, four inks, one blue, and one fluorescent signature. It is
small on purpose: a proof sheet has the ink that is on the press, and no more.

### Grounds

- **Paper (`#F2EDE3`)** — the sheet. The Cockpit ground and the `[v2]` in-page sheet ground,
  which are **the same value on purpose**: the bubble on the page is not a variant of the
  panel, it is the same sheet.
- **Paper Raised (`#FBF8F1`)** — anything lifted off the sheet: the pinned identity header,
  the action bar, the composer, a dispatch result block, a state notice.
- **Paper Sunk (`#E8E0D0`)** — anything pressed into the sheet: input wells, collapsed group
  interiors, every machine-data block, and the `[v2]` attachment chip.
- **Stamp (`#191713`)** — the inverted band ground. A dispatch header, a failure band, a
  submit control. Not a "dark surface"; a stamp.

### Inks

- **Ink (`#191713`)** — serif body, headings, full-strength rules, the stamp ground, the
  submit, and failure. One black doing several jobs. See **The One Black Rule**.
- **Ink Muted (`#645D4E`)** — captions, metadata, secondary lines, and the quiet states.
  This is a **deliberate darkening of the rendered direction's `ink-3 #837A69`**, which
  measures 3.63:1 on paper and fails the 4.5:1 body floor. `#837A69` is **dropped from the
  system entirely** — it is not a text token and it is not a mark token, and no token carries
  it. (The first draft claimed it "survives in the system as a non-text mark colour." It did
  not; there was no such token, and telling a developer a token exists that they cannot find
  is worse than dropping it.) The panel therefore reads slightly heavier than the mock did;
  that is the cost of the floor and it is recorded in **Gaps**.
- **Machine Blue (`#1B3FA0`)** — **all** machine-generated data, always in mono: the clone
  path, the pjid, the Board identifier, correlation identifiers, command strings, the
  dispatch acknowledgement. This is the third text role EXPERIENCE.md demands, and it is a
  role rather than a shade: on a printed instrument the operator's text is black and the
  machine's stamp is blue. A developer never has to ask whether a string is machine data —
  if it is blue and monospaced, it came from a machine, and it is complete and selectable.

### The signature

Two token names hold `#FF2E63`, because they are two roles and not two colours:

- **`{colors.action.mark}`** is the **Cockpit's** use: the clip band, the spine, the two
  selection underlines, the operator's turn edge.
- **`{colors.overlay.signature}`** is the **cross-surface** use, and it is the token
  EXPERIENCE.md explicitly names as owed. It is the one ink written identically on the
  Cockpit, the `[v2]` hover tooltip, the comment bubble and the in-page mark. It is **not**
  `[v2]`-scoped. It does not change under any theme, on any ground, in either mode — and that
  invariance is the whole point, because a signature that needs a theme to be legible is not
  a signature.

It measures 3.09:1 on paper, which clears the 3:1 non-text floor and fails the 4.5:1 text
floor, exactly as the direction claimed. **It fills, it rules, it outlines, it spines; it
never sets small type on paper.**

- **Spot Deep (`#C2003F`)** — the only spot permitted to set type on paper, at 5.35:1.
  Reserved for `[v2]`'s attachment chip label and nothing else in v1.
- **Spot Wash (`#FFE4EC`)** — spot at fill strength. Exactly one consumer,
  `{colors.selection.ground}`. Ink on it measures 14.97:1.

### Named rules

**The One Black Rule.** Seven tokens carry `#191713` — `{colors.text.primary}`,
`{colors.state.failed}`, `{colors.action.primary}`, `{colors.border.strong}`,
`{colors.surface.stamp}`, `{colors.focus.ring}` and `{colors.overlay.keylineDark}` — and that
is not an oversight to be tidied away. The sheet has one black ink. What distinguishes its
jobs is never hue; it is **form**, and the forms are now enumerated, because "the height is
different and so are the words" was not enough:

| Form | What it is | How you know |
|---|---|---|
| Type | Serif at `{typography.body}` or above | It is words on paper |
| Rule | 1px line | It bounds a region |
| Band | Full-bleed inverted strip, ≤24px, `{typography.micro}` caps, paper ink, **no inset keyline** | It is a *statement*, and it is never clickable |
| Control | 28–32px inverted box, `{typography.label}` caps, paper ink, **1px paper inset keyline** | The keyline is the affordance — see **Elevation & Depth → The four affordances** |

The band/control distinction used to be carried only by 8px of height and the words inside,
which put the failure band and the submit control one glance apart. It is now carried by a
visible printing device: **a stamp control is a struck plate and shows its keyline; a stamp
band is solid and does not.** If a future token needs an eighth black, the answer is a fifth
*form*, not a second value.

**The Spot Is Identity Rule.** The signature hue never states a status. Not ok, not degraded,
not failed, not a severity, not a priority, not a quantity. It says *this is Sidepiece* and
*this is the thing you armed*. The consequence is deliberate and load-bearing: **there is no
red available for errors**, which is why failure is stamped in black instead — and a stamped
black band is louder on warm paper than any red would be.

*One exemption, named:* `{components.iconBadge}` is a count set on the signature hue, on
Chrome's toolbar. It is exempt because on that surface the badge is **identity first** — the
job is to be found among a row of other extension icons, which is the one job no ink could
do — and the number is incidental. Nothing inside the Cockpit inherits this exemption.

**The Foreign Hue Is Not Enough Rule.** *(New, and the sharpest correction in this revision.)*
`#FF2E63` is not a rare colour on the web. CIE76 ΔE from the signature to Tailwind `rose-500`
`#F43F5E` is **8.0** — for scale, `rose-500` to `pink-500` is 33.5, so 8.0 is *the same
colour*. Bootstrap `danger` is ΔE 16.6; GitHub dark `danger` 22.4; Stripe pink 22.3; T-Mobile
magenta 22.7. On any page built with the most-used CSS framework's defaults, an outline drawn
in the signature hue **is the page's own destructive-action colour**, at 1.02–1.30:1 against
it — ambiguous *and* invisible, which is the exact failure the whole direction exists to
prevent.

Therefore: **on a page Sidepiece does not own, identity is carried by geometry, never by hue
alone.** Geometry is ground-independent and no page owns it:

1. **Detached registration ticks.** 10 × 10px L-shaped corner ticks at 2px, set **3px clear of
   the box they register**, at all four corners. Nothing else on the web draws detached
   registration ticks; a page's own focus ring, selection box and hover outline are all
   continuous.
2. **The ticked spine.** The same signature spine, with its 1px ticks at 12px intervals, runs
   down the **inboard edge of the hover outline** — not only down sheets.

And one measurable guard, in the `[v2]` common requirements: **the content script samples the
computed background of the outlined element and of its nearest opaque ancestor; if ΔE76 to
`#FF2E63` is under 25, the mark drops its signature stroke and renders ink-and-paper only,
keeping the ticks and the spine.** That is a ten-line check and it converts the worst case
from *ambiguous* to *achromatic but unmistakably ours*.

**The OK Is Grey Rule.** Harvested verbatim from direction 03 and kept. `{colors.state.ok}`
is `#645D4E`, the same value as `{colors.text.muted}` — a healthy Bridge is exactly as loud
as a caption, which is to say barely. **Nothing in Sidepiece is ever green.** The colour
green does not exist in this system.

**The Glyph Law.** No state renders without its mark, ever, and no mark is decorative.
`{colors.state.ok}` and `{colors.state.unknown}` share one ink value on purpose: in this
register hue is not asked to carry status, so two states that are semantically adjacent are
allowed to be chromatically identical. What separates *Reachable* from *Not yet known* is the
mark and the word. This also means the panel is legible to a colourblind operator and legible
in a screenshot pasted into a terminal, which is where half of Sidepiece's output ends up.

**The law is enforceable, not aspirational.** The marks live in the frontmatter as `marks.*`,
not as YAML comments. A generator fed only `colors.state.*` emits five hexes, two of which are
the identical value — on the token layer alone, `ok` and `unknown` would be indistinguishable,
which is precisely what this law forbids. A generator that emits a `colors.state` value
without its `marks` sibling is producing a hue-only state, and that is a build defect. See
**Components → The Mark Law** for how each one is drawn.

### The state set

Five inks, five marks, five weights. Every state ships all three.

| Token | Value | Mark | Form | Weight | On paper | On raised | On sunk | Reading |
|---|---|---|---|---|---|---|---|---|
| `{colors.state.ok}` | `#645D4E` | `marks.ok` — a rule | drawn | 400 | **5.59:1** ✓ | **6.15:1** ✓ | **4.97:1** ✓ | A ruled line. Nothing to report. |
| `{colors.state.pending}` | `#4C463A` | `marks.pending` — `»` | typed | 500 | **8.02:1** ✓ | **8.82:1** ✓ | **7.13:1** ✓ | Ink still wet. In flight. |
| `{colors.state.degraded}` | `#8A5A0B` | `marks.degraded` — a triangle | drawn | 500 | **5.07:1** ✓ | **5.58:1** ✓ | **4.51:1** ✓ | Archival ochre. A fact, not a fault. |
| `{colors.state.failed}` | `#191713` | `marks.failed` — a filled square | drawn | 600 | **15.34:1** ✓ | **16.87:1** ✓ | **13.64:1** ✓ | Stamped and inverted. |
| `{colors.state.unknown}` | `#645D4E` | `marks.unknown` — a hollow circle | drawn | 400 | **5.59:1** ✓ | **6.15:1** ✓ | **4.97:1** ✓ | A hollow mark. Nothing in it yet. |

Every state value clears 4.5:1 on all three paper grounds, so a state word is legible
wherever a state can appear. The five silhouettes — a line, a double angle, a filled
triangle, a filled square, a hollow circle — were picked to be distinct at `{spacing.glyph}`
11px, which is the one size all three consumers now use.

**On a stamped band, the state ink is not used.** This is the rule the first draft omitted and
it was the most dangerous omission in it: on `{colors.surface.stamp}`, `{colors.state.failed}`
is `#191713` on `#191713` = **1.00:1**, which renders the failure mark invisible on the single
most important surface in the product. **The mark and the word on a stamped band are both
`{colors.text.inverse}` (15.34:1).** The state is carried by the mark's shape and by the word,
not by the hue — which is already this system's law, applied to the one ground where the hue
cannot go.

**Ochre is the single hue admitted to the state set**, and it earns the exception: the
`{components.degradedConnectionIndicator}` sits in the header for as long as the tailnet is
on a DERP relay, which can be hours. It has to be noticeable without reading as a fault, and
an ink weight cannot do "persistent but not broken." Ochre on warm paper is a pencil note in
the margin, which is precisely the meaning.

### Measured contrast — every pair this document specifies

Body text floor 4.5:1, non-text and large-text floor 3:1. Failures are reported, not
substituted. Every ratio recomputed independently for this revision.

| Foreground | Background | Ratio | 4.5:1 text | 3:1 non-text | Scope |
|---|---|---|---|---|---|
| `text.primary` `#191713` | `surface.panel` `#F2EDE3` | **15.34:1** | ✓ | ✓ | body, headings |
| `text.primary` `#191713` | `surface.raised` `#FBF8F1` | **16.87:1** | ✓ | ✓ | header, composer |
| `text.primary` `#191713` | `surface.sunken` `#E8E0D0` | **13.64:1** | ✓ | ✓ | wells |
| `text.muted` `#645D4E` | `surface.panel` `#F2EDE3` | **5.59:1** | ✓ | ✓ | captions |
| `text.muted` `#645D4E` | `surface.sunken` `#E8E0D0` | **4.97:1** | ✓ | ✓ | worst ground |
| `text.machine` `#1B3FA0` | `surface.panel` `#F2EDE3` | **7.95:1** | ✓ | ✓ | mono data |
| `text.machine` `#1B3FA0` | `surface.sunken` `#E8E0D0` | **7.07:1** | ✓ | ✓ | path, command |
| `text.inverse` `#F2EDE3` | `surface.stamp` `#191713` | **15.34:1** | ✓ | ✓ | band words, submit |
| `text.inverse` as the **`ok` mark** | `surface.stamp` `#191713` | **15.34:1** | ✓ | ✓ | stamped band |
| `text.inverse` as the **`pending` mark** | `surface.stamp` `#191713` | **15.34:1** | ✓ | ✓ | stamped band |
| `text.inverse` as the **`degraded` mark** | `surface.stamp` `#191713` | **15.34:1** | ✓ | ✓ | stamped band |
| `text.inverse` as the **`failed` mark** | `surface.stamp` `#191713` | **15.34:1** | ✓ | ✓ | stamped band |
| `text.inverse` as the **`unknown` mark** | `surface.stamp` `#191713` | **15.34:1** | ✓ | ✓ | stamped band |
| *(why those five rows exist)* `state.failed` `#191713` | `surface.stamp` `#191713` | **1.00:1** | ✗ | ✗ | **forbidden** |
| *(ditto)* `state.pending` `#4C463A` | `surface.stamp` `#191713` | **1.91:1** | ✗ | ✗ | **forbidden** |
| *(ditto)* `state.ok` / `unknown` `#645D4E` | `surface.stamp` `#191713` | **2.74:1** | ✗ | ✗ | **forbidden** |
| *(ditto)* `state.degraded` `#8A5A0B` | `surface.stamp` `#191713` | **3.02:1** | ✗ | ✓ | **forbidden anyway — one rule, not four** |
| `#C9BDA6` | `surface.stamp` `#191713` | **9.64:1** | ✓ | ✓ | cid on a band |
| `surface.panel` `#F2EDE3` inset keyline | `surface.stamp` `#191713` | **15.34:1** | — | ✓ | struck-plate affordance |
| `text.onSpot` `#191713` | `action.mark` `#FF2E63` | **4.96:1** | ✓ | ✓ | clip mark, pin digit |
| `action.markDeep` `#C2003F` | `surface.panel` `#F2EDE3` | **5.35:1** | ✓ | ✓ | `[v2]` chip label on paper |
| `action.markDeep` `#C2003F` | `surface.sunken` `#E8E0D0` | **4.76:1** | ✓ | ✓ | `[v2]` chip, as shipped |
| `action.mark` `#FF2E63` | `surface.panel` `#F2EDE3` | **3.09:1** | ✗ **FAIL** | ✓ | spine, rules, fills — **never type** |
| `action.mark` `#FF2E63` | `surface.stamp` `#191713` | **4.96:1** | ✓ | ✓ | spot on a failed clip |
| `selection.ink` `#191713` | `selection.ground` `#FFE4EC` | **14.97:1** | ✓ | ✓ | `::selection` |
| `focus.ring` `#191713` | `surface.panel` `#F2EDE3` | **15.34:1** | — | ✓ | focus, light grounds |
| `focus.ringInner` `#F2EDE3` | `surface.stamp` `#191713` | **15.34:1** | — | ✓ | focus, on the submit |
| `focus.ringInner` `#F2EDE3` | `action.mark` `#FF2E63` | **3.09:1** | — | ✓ | focus, on a spot mark |
| `border.strong` `#191713` | `surface.panel` `#F2EDE3` | **15.34:1** | — | ✓ | the pinned/scroll seam |
| `border.hairline` `#CFC3AB` | `surface.panel` `#F2EDE3` | **1.49:1** | — | ✗ **FAIL** | decorative rule — see note |
| `border.faint` `#E0D7C4` | `surface.panel` `#F2EDE3` | **1.23:1** | — | ✗ **FAIL** | row separator — see note |
| `border.sheet` `#C9BDA6` | `surface.panel` `#F2EDE3` | **1.59:1** | — | ✗ **FAIL** | sheet edge — see note |
| `surface.raised` `#FBF8F1` | `surface.panel` `#F2EDE3` | **1.10:1** | — | ✗ **FAIL** | tonal layer — see note |
| `surface.sunken` `#E8E0D0` | `surface.panel` `#F2EDE3` | **1.12:1** | — | ✗ **FAIL** | tonal layer — see note |
| `selection.ground` `#FFE4EC` | `surface.panel` `#F2EDE3` | **1.02:1** | — | ✗ **FAIL** | chromatic, not luminant — see note |
| `surface.panel` `#F2EDE3` | white page `#FFFFFF` | **1.17:1** | — | ✗ **FAIL** | the sheet on a light page |
| `surface.panel` `#F2EDE3` | dark page `#0E1116` | **16.21:1** | — | ✓ | the sheet on a dark page |
| `overlay.signature` `#FF2E63` | white page `#FFFFFF` | **3.61:1** | — | ✓ | `[v2]` outline, the spine |
| `overlay.signature` `#FF2E63` | dark page `#0E1116` | **5.24:1** | — | ✓ | `[v2]` outline, the spine |
| `overlay.signature` `#FF2E63` | mid-grey page `#808080` | **1.10:1** | — | ✗ **FAIL** | **the hole — see below** |
| tri-tone keyline | **worst sRGB ground** `#188890` | **≥4.23:1** | — | ✓ | `[v2]`, guaranteed |

**Seven of those failures are accepted, one is fixed, and five are forbidden outright.**

- **The four sub-3:1 rules and the two tonal steps are accepted.** WCAG 1.4.11 governs UI
  components and graphical objects *required to understand the content*. A printed rule and a
  tonal step are not: every boundary that carries meaning is drawn in
  `{colors.border.strong}` at 15.34:1 — the pinned/scrolling seam, the group header, the
  stamped band. The hairlines are what a printed rule looks like, and making them clear 3:1
  would turn the sheet into a wireframe. **The audit test: remove every hairline from a
  screen; if a region becomes ambiguous, that region was leaning on a hairline and needs a
  `strong` rule instead.**
- **`{colors.selection.ground}` at 1.02:1 is accepted because luminance is the wrong metric
  for it.** A selection ground is read against the *unselected* text beside it, and the shift
  is chromatic — cream to pink — not luminant. What the floor governs is the ink on it, and
  that is 14.97:1. The alternative the mock shipped was
  `::selection { background: var(--spot); color: #fff }` — white on `#FF2E63` at 3.61:1, the
  exact pair this document bans, landing on the machine strings it mandates be
  `user-select: all`. One click would have put the banned pair on the most important text in
  the panel.
- **`{colors.action.mark}` at 3.09:1 on paper is accepted and scoped.** It fails body text and
  it is never used for body text. The direction stated this as law 2 before it was measured
  and the measurement confirms it.
- **Every `colors.state` value on `surface.stamp` is forbidden**, not accepted. One rule, no
  exceptions, including for `degraded`, which would technically pass the 3:1 non-text floor:
  **a mark on a stamped band is `{colors.text.inverse}`.** Four sub-threshold cells and one at
  1.00:1 are not worth the ambiguity of a fifth case.
- **The mid-grey hole is a real defect and is fixed — but only half of it was a contrast
  problem.** The signature alone collapses to **1.10:1 against `#808080`**. The fix is the
  **tri-tone keyline**: the signature stroke drawn between a `{colors.overlay.keylineDark}`
  `#191713` outer hairline and a `{colors.overlay.keylineLight}` `#FFFFFF` inner hairline.
  Swept across the full sRGB cube, the best of those three tones never drops below **4.23:1**,
  worst ground `#188890`.

  **Stated honestly, because the first draft overstated it:** that 4.23:1 floor is bought
  **entirely by the black and white hairlines.** The same sweep with the signature removed
  returns the same 4.23:1 at the same ground — the spot never sets the floor, and the spot is
  under 3:1 against **91%** of the sRGB cube. So **the tri-tone keyline guarantees *visibility*
  and nothing else.** A black-over-white double stroke is also what Chromium's own focus ring
  and most DevTools overlays look like, and that covers most of the real web. *Identity* is
  guaranteed by the geometry — the detached registration ticks and the ticked spine — under
  **The Foreign Hue Is Not Enough Rule**. Two mechanisms, two jobs, and neither one is asked to
  do the other's.

### One correction to the rendered direction, stated plainly

The mock sets `SIDEPIECE`, `MARK 2` and the active flip half in **white on the spot**, which
measures **3.61:1 — below the 4.5:1 text floor**. Text on the spot ground is therefore **ink
`#191713` at 4.96:1**, not white. This is not a compromise: black on fluorescent stock is
exactly how fluorescent paper is printed, and it reads harder than the white did. The same
correction removes the mock's `::selection` rule, which used that pair on the panel's machine
data.

---

## Typography

**Human voice:** Charis SIL — a hinted, screen-drawn, OFL descendant of Bitstream Charter.
**Machine voice:** IBM Plex Mono.
**There is no sans-serif in the Cockpit.**

Charter is the load-bearing choice, not a flourish. It and Georgia are among the very few
serifs engineered for small sizes and low-resolution screens, and that is the only reason
13.5px body type survives a 304px column. Substituting a display serif here collapses the
whole layout.

### MV3 forbids fetching a font, so both faces ship in the bundle

**Seven files, seven `@font-face` blocks, every one with an explicit weight and style.** The
first draft gave one weightless, style-less declaration per family, which is the worst bug in
that draft: Chrome would synthesise 700, 600 and 500 from Regular and oblique every italic,
which widens advances and silently invalidates every column measurement this document proves.

```css
/* --- serif: four real faces, no synthesis --- */
@font-face { font-family:"Charis SIL"; src:url("fonts/CharisSIL-Regular.woff2")    format("woff2"); font-weight:400; font-style:normal; font-display:block; }
@font-face { font-family:"Charis SIL"; src:url("fonts/CharisSIL-Italic.woff2")     format("woff2"); font-weight:400; font-style:italic; font-display:block; }
@font-face { font-family:"Charis SIL"; src:url("fonts/CharisSIL-Bold.woff2")       format("woff2"); font-weight:700; font-style:normal; font-display:block; }
@font-face { font-family:"Charis SIL"; src:url("fonts/CharisSIL-BoldItalic.woff2") format("woff2"); font-weight:700; font-style:italic; font-display:block; }

/* --- mono: three real weights --- */
@font-face { font-family:"IBM Plex Mono"; src:url("fonts/IBMPlexMono-Regular.woff2")  format("woff2"); font-weight:400; font-style:normal; font-display:block; }
@font-face { font-family:"IBM Plex Mono"; src:url("fonts/IBMPlexMono-Medium.woff2")   format("woff2"); font-weight:500; font-style:normal; font-display:block; }
@font-face { font-family:"IBM Plex Mono"; src:url("fonts/IBMPlexMono-SemiBold.woff2") format("woff2"); font-weight:600; font-style:normal; font-display:block; }

:root { font-synthesis: none; }   /* a missing face fails loudly in review, never silently */
```

Four rules govern that block and none of them is optional:

- **No `local()` in `src`.** `local("Charis SIL")` silently substitutes whatever version of
  the family a machine happens to have, at metrics this document did not measure. The bundle
  exists precisely so the rendered face is known.
- **`font-synthesis: none` on `:root`.** With it, a weight or style with no bundled face
  renders at the nearest real one and looks obviously wrong in review. Without it, Chrome
  fakes it and the wrongness is invisible until someone measures a column — the identity
  header's 27-character fit was computed on real Charter Bold metrics, not faux-bold.
- **Italic is bundled because italic is load-bearing.** `{components.turnComposer}` and
  `{components.ticketCreateBox}` both set a serif-italic placeholder. A synthetic oblique — a
  mechanically slanted Roman — is the single most visible faux-craft artefact available, and
  the first draft aimed it at the operator's own input field.
- **`font-display: block`, not `swap`.** A swap reflows the identity header and the clone path
  one beat after the panel opens, and the Cockpit's whole premise is dip-in-dip-out. A block
  period on a local-origin font is imperceptible.

Inside an extension page a relative URL already resolves to `chrome-extension://<id>/…`; no
remote fetch, no CSP exception. **The `[v2]` in-page layer needs one extra step:** `@font-face`
rules declared inside a shadow root are ignored by spec, so the content script must register
the faces on the host document with the `FontFace` API and `chrome.runtime.getURL()`. That
requires the woff2 files in `web_accessible_resources` with **`"use_dynamic_url": false`** — a
dynamic URL changes per page load and defeats the font cache.

### What a cold install sees, verified on this machine today

| Named family | `fc-match` resolves to | In the stack? |
|---|---|---|
| `Charis SIL` | Noto Sans | **Bundled.** Not installed anywhere on this machine — that is why it ships |
| `Bitstream Charter` | `c0648bt_.pfb` — a real, installed, legacy Type 1 | **Removed from the stack.** See below |
| `Charter` | Noto Sans | **Removed from the stack.** See below |
| `Source Serif 4` | Noto Sans | **Removed from the stack** |
| `Iowan Old Style` | Noto Sans | **Removed from the stack** |
| `Georgia` | **Noto Serif** | **Kept** — the only fallback whose metrics are costed here |
| `IBM Plex Mono` | Noto Sans | **Bundled.** Not installed |
| `Cascadia Mono` | Cascadia Mono | **Kept** — installed and verified |
| `Cascadia Code` | Cascadia Code | Installed, and **banned** — its ligatures rewrite `->` and `=>` inside a clone path or a correlation id |

**Why `Bitstream Charter` and `Charter` came out of the stack.** `Bitstream Charter` is the one
serif name in the original stack that *actually resolves on this machine*, and it resolves to
an unhinted 1987 Type 1 `.pfb` from the X11 package — no woff2, no screen hinting, and a
`fontSizeAdjust` value computed for a different design. The document's own table called it
unbettable and then listed it second, where it was the name most likely to bind. `Charter`,
`Source Serif 4` and `Iowan Old Style` all fall through to **Noto Sans**, and a sans in this
panel is not a degradation, it is a total register failure. **Nothing now sits between Georgia
and the bundled face**, because every name that could sit there is either a sans in disguise or
a typeface this document has not measured.

### Degrading without metric collapse

Both stacks carry `fontSizeAdjust` **as a token**, not as prose — the first draft made it the
entire defence against metric collapse and then left it out of the normative layer, so a
developer building from the frontmatter would have shipped without it.

- Serif: `fontSizeAdjust: 0.481` (Charis SIL's x-height ratio). Measured
  `NotoSerif-Regular.ttf` sxHeight is 536/1000 = **0.536**, so Noto Serif scales to **0.897×**
  — it renders about **10% narrower**, not wider.
- Mono: `fontSizeAdjust: 0.516` (IBM Plex Mono). Measured `CascadiaMono-Regular.ttf` sxHeight
  is 1060/2048 = **0.5176** and its advance is **0.5859em**, not the 0.6em the first draft
  claimed. Adjusted, the used size scales by 0.997 and the advance lands at **6.72px** at the
  11.5px roles against IBM Plex Mono's 6.90px — **about 2.6% narrower.** The monospace column
  measurements do not hold *identically* on the fallback; they hold with 2.6% of slack in the
  safe direction, which is a different and weaker claim than the first draft made.

**So the honest statement is the opposite of the first draft's, and it is a stronger argument
for the bundle.** A cold install does **not** break the fits — every fallback runs narrower.
What a cold install breaks is the **voice**: Noto Serif is a different typeface with a 10%
larger x-height and none of Charter's small-size engineering, and Cascadia Mono is a different
mono with a different rhythm. **The bundle is mandatory for register and hinting.** Those are
the reasons to state, and they are true.

### The ramp

| Role | Family | Size | Weight | Leading | Tracking | Purpose |
|---|---|---|---|---|---|---|
| `{typography.heading}` | Charis SIL | 22px | 700 | 1.05 | −0.015em | The repo name in the identity header. One per Cockpit. |
| `{typography.body}` | Charis SIL | 13.5px | 400 | 1.55 | normal | Turn text, notice sentences, ticket titles, bubble text, the context chip's page title. The default voice. |
| `{typography.label}` | IBM Plex Mono | 11.5px | 500 | 1.35 | 0.04em | **Anything variable**: control text, classification values, group names, counts, state words. `tabular-nums`, so a count never jitters. |
| `{typography.micro}` | IBM Plex Mono | 10.5px | 500 | 1.3 | 0.10em | **Static chrome only**, uppercase: section rules, band words, stamp chips, the clip mark. |
| `{typography.mono}` | IBM Plex Mono | 11.5px | 400 | 1.45 | 0.01em | Machine data, `tabular-nums`, always `{colors.text.machine}`. |
| `{typography.numeral}` | IBM Plex Mono | 10px | 600 | 1 | 0 | **Counted marks only** — the `[v2]` pin digit and the pin-number chip. Zero tracking so two digits fit a 12px chord. |

`{typography.numeral}` exists because a tracked face cannot hold two digits in a roundel: at
`{typography.micro}`'s old 10.5px and 0.18em the advance was 8.19px, so `10` needed 16.4px
inside a 16px circle whose usable chord at cap height is ≈12.8px. At numeral's 6.00px advance,
two digits are 12.0px. Pins run **1–99**; the layer does not mint a hundredth mark.

### Named rules

**The Two Voices Rule.** Serif for people, mono for machines, and never mixed inside a single
value. A repo name is serif. A clone path is mono. A sentence that contains a path sets the
sentence in serif and the path in mono, and the path stays complete.

**The 10.5 Floor Rule.** Harvested from direction 03 and enforced here.
*10.5px is the floor for static chrome at ≥4.5:1; 11.5px is the floor for anything variable.*
Density comes from leading, not from shrinking type. **The rendered direction violated this
at 8.5px and this document overrides it**, which cost one layout (see below) and bought back
the PRD's literal strings. `{typography.numeral}` at 10px is not an exception: it sets digits
*inside a mark*, not chrome, and it is measured against the chord of the mark that contains
it.

**The Complete String Rule.** Machine data is never elided, never truncated, never given a
tooltip in place of itself. It wraps. An ellipsised path looks copyable and copies wrong.

---

## Layout & Spacing

### The column is 304px, and that is the only number that matters

```
340px  Chrome side panel at Sidepiece's design width (floor is 320, unreadable)
 −2px  sheet border, 1px each side
 −6px  the ticked signature spine
−28px  gutter, {spacing.gutter} × 2
─────
304px  usable column
```

**The signature costs 8px of 340, or 2.4%** — down from 12px, because the spine went 10px → 6px
when its tear-off perforation became registration ticks. The two inboard ticks cost **zero
column**: they are drawn *inside* the sheet at a 3px inset, in the top-inboard and
bottom-inboard corners, where the clip band and the action bar sit and no text runs. Nothing
else in the signature consumes horizontal space, because nothing else in the signature renders
on the Cockpit — see **Shapes → The signatures, by surface**.

**The extension can neither read, set nor suggest the width**, so there are no breakpoints in
this product and none can be observed. Every measurement below is written to hold at 304px
and to degrade upward — extra width buys longer unwrapped paths and more visible Turn text,
never a second column.

### Scale

| Token | Value | Use |
|---|---|---|
| `{spacing.hair}` | 4px | Mark-to-word, chip internals |
| `{spacing.tight}` | 6px | Between a label and the thing it labels |
| `{spacing.inset}` | 9px | Inside any bordered box |
| `{spacing.glyph}` | 11px | **The mark box.** One size, three consumers — see The Mark Law |
| `{spacing.gutter}` | 14px | **The only horizontal inset in the column.** Never overridden |
| `{spacing.stack}` | 15px | Between sibling blocks in the scroll region |
| `{spacing.section}` | 24px | Above a section rule |
| `{spacing.row}` | 32px | Minimum list-row height, ticket and annotation |

### The nesting, shown once

Every measurement below hangs off this chain. The first draft quoted three different inner
widths for boxes at the same depth — 284px, 298px and 282px — and none of them subtracted the
composer's own 1px border and 18px of `{spacing.inset}`.

```
304px  usable column
 ├ 284px  inside {components.turnComposer}                   (−2 border, −18 inset × 2)
 │   ├ 264px  inside {components.classificationControl}      (−2 border, −18 padding)
 │   └ 268px  inside {components.contextChip}                (−16 padding)
 └ 288px  inside the identity header's clone-path well       (−2 left edge, −14 padding)
```

### Verified fits at the shipped type ramp

Advances, all derived from the tokens rather than asserted:

| Role | Advance per character |
|---|---|
| `{typography.mono}` | 11.5 × 0.6 + 11.5 × 0.01 = **7.015px** |
| `{typography.label}` | 11.5 × 0.6 + 11.5 × 0.04 = **7.36px** |
| `{typography.micro}` | 10.5 × 0.6 + 10.5 × 0.10 = **7.35px** |
| `{typography.numeral}` | 10 × 0.6 + 0 = **6.00px** |
| `{typography.body}` | Charter lowercase average ≈ 0.47em = **6.35px** |
| `{typography.body}` line box | 13.5 × 1.55 = **20.93px** |

| Element | Measurement | Verdict |
|---|---|---|
| Clone path, `/home/delorenj/code/sidepiece` | 29 ch × 7.015 = 203.4px in a 288px well | **Fits, one line** |
| Clone path, longest before wrap | 288 ÷ 7.015 = **41 characters** | Longer paths wrap; they never truncate |
| Classification row, `DISPATCHED COMMAND` | 18 ch × 7.36 = 132.5px in a 264px row | **Fits, 131px spare — the PRD literal survives** |
| Ticket key column, `SIDE-12` | 7 ch × 7.015 = 49.1px → **50px** at `max-content` | |
| Ticket key column, `HOLOCENE-12` | 11 ch × 7.015 = 77.2px → **78px** at `max-content` | The first draft's fixed 76px overflows this by 1.2px |
| Ticket title column, on SIDE | 304 − 11 − 8 − 50 − 8 = **227px** | ≈**35** serif characters per line |
| Ticket title column, on HOLOCENE | 304 − 11 − 8 − 78 − 8 = **199px** | ≈**31** serif characters per line |
| Identity header repo name | 304 ÷ (22 × 0.5) = **27 characters** | Then it wraps |
| Clip band | `SIDEPIECE` 9 × 7.35 = 66.2px + `BRIDGE UP · LAN` 15 × 7.35 = 110.3px + 17px padding = **193.4px of 338px** | **Fits, 145px spare.** The first draft quoted 79px and 117px — two figures at two different implied rates, neither of them `micro`'s |
| Ticket row, two-line title | 2 × 20.93 = 41.9px of text + 16px padding = **58px** | Clears the 32px `{spacing.row}` floor. A scroll budget built on the first draft's 52px under-counts by 11% per row |
| FR-10 context URL, 47 ch | 47 × 7.015 = 329.7px against **268px** | **Wraps to two lines** |
| Create-box submit cell | 284 − 32 − 32 − 16 = 204px, less 22px padding = 182 ÷ 7.36 = **24 characters** | `CREATE IN 33GOD` (15 ch) fits with nine to spare |
| `[v2]` pin, two digits | 2 × 6.00 = 12.0px inside an 18px roundel less a 1.5px ring = 15px chord | **Fits, 1–99** |

**The key column is grid-sized, not fixed.** `grid-template-columns: {spacing.glyph} max-content 1fr`
at an 8px gap, with a `ch`-based `min-width`. The panel only ever shows one project's keys, so
sizing every row for the longest key across all projects spends 28px of title on every row,
permanently — seven times what the whole spine costs. On SIDE the grid returns that 28px to the
title and the measure goes from 31 to 35 characters per line.

### What the raised type floor cost

Raising chrome type from the mock's 8.5px to 10.5/11.5px has three consequences, stated
honestly:

1. **The side-by-side classification flip does not fit and is replaced.** Two halves each
   holding a full glossary term in one row is impossible at 11.5px. The control becomes
   **two full-width stacked rows**, one per value, 30px each. It costs ~30px of vertical and
   it **buys back the PRD's literal string**: the mock had to abbreviate `Dispatched Command`
   to `DISPATCHED CMD`, and at the shipped ramp it does not.
2. **The FR-10 context URL no longer fits on one line.** 47 characters is 329.7px against
   268px of chip. It wraps to two lines. EXPERIENCE.md renders the URL on focus or hover, so
   two lines in a revealed state is acceptable — but it is a real loss against the mock's
   single-line claim and it is recorded as one.
3. **The clip band is 21px → 24px tall** to carry 10.5px type with its leading.

### Rhythm

- **One scroll region on screen**: the body. Header and action bar are pinned. Nested scroll
  regions in a 304px column are a trap-the-wheel bug.
- **Group headers are `position: sticky`** inside the Tickets pane, on
  `{colors.surface.panel}` with a `{colors.border.strong}` bottom rule.
- **There are two rhythms and they are not one grid.** The first draft claimed "vertical
  rhythm is 3px-quantised," which three spacing tokens (`hair` 4, `gutter` 14, `row` 32) and
  four control sizes (32, 28, 16, 10) do not satisfy. The truth: **the text rhythm is the
  20.93px line box**, and **the control scale is a separate 2px scale** — 16, 24, 28, 30, 32,
  58. Nothing is gained by pretending they share a divisor, and a developer told the rhythm is
  3px-quantised and handed a 32px row floor cannot honour both.
- **Nothing is centred.** A proof sheet is left-ruled. Every label, every value, every row
  starts at the gutter.

---

## Elevation & Depth

**The system has exactly two shadows and both are literal.** There is no ambient shadow, no
hover lift, no elevation ramp, and no z-index vocabulary beyond "the sheet is on top."

### Shadow vocabulary

| Name | Value | Where |
|---|---|---|
| **Sheet offset** | `3px 3px 0 rgba(25, 23, 19, 0.26)` | **Free-standing sheets only** — the `[v2]` hover tooltip, the comment bubble, the freehand commit sheet. Zero blur. |
| **Sheet offset, dark ground** | `3px 3px 0 rgba(0, 0, 0, 0.45)` | The same offset when the sheet is over a dark page. |
| **Focus keyline** | `0 0 0 1px {colors.focus.ringInner}, 0 0 0 3px {colors.focus.ring}` | Every interactive element. See **Shapes**. |

Two entries were deleted in this revision, and the deletions matter:

- **`Panel cast`, `-10px 0 28px rgba(0,0,0,.30)`, is gone because it cannot exist.** It was
  described as "the shadow the sheet casts onto the page it abuts." An extension document
  cannot paint into the host page's compositor, Chrome draws its own separator between the
  pane and the content area, and a 28px blur broke this document's own headline rule inside
  its own table.
- **`Pin halo`, `0 0 0 2px rgba(255,46,99,0.28)`, is gone.** It was a translucent pink spread
  ring — a glow, relabelled "a registration halo" — in a system whose Don'ts forbid glows.
  `{components.annotationPin}` now carries an opaque 1px `{colors.overlay.keylineDark}` ring
  outside its light ring, which gives the pin the tri-tone the `[v2]` section mandates and
  removes the only translucent spread in the system.

With those gone, the table is **two shadows**, which is what the Don'ts always claimed.

### The four affordances

*(New. The first draft specified an interaction appearance for 2 of 25 components, and told
developers what hover must **not** be without ever saying what it **is**.)*

Every interactive element in this system takes one or two of exactly four treatments. There
is no fifth, and adding one is a design change, not an implementation detail.

1. **Tonal step** — the element's ground moves one step toward `{colors.surface.raised}`. For
   rows and for transparent controls sitting on paper.
2. **Ink step** — the label moves from `{colors.text.muted}` to `{colors.text.primary}`. For
   quiet controls whose ground does not change.
3. **The struck plate** — `box-shadow: inset 0 0 0 1px {colors.surface.panel}`, drawn 2px in
   from the edge. **Stamp-ground controls only.** Resting 1px; hover thickens it to 2px;
   pressed removes it entirely, so the plate seats. Both states measure **15.34:1**, both are
   plainly visible, and neither is a shadow, a lift, a scale or a new colour value.
4. **The focus keyline** — `:focus-visible` only, system-level, specified in **Shapes**.

**Why the struck plate had to be invented.** The One Black Rule puts seven tokens on `#191713`,
so a failure band and a submit control are both black rectangles with paper caps. The only
affordance the Don'ts permit is "a tonal step at most" — and on `#191713` every tonal step
available is perceptually nothing: `#231F19` is 1.09:1, `#2A2620` is 1.19:1, `#332E26` is
1.33:1. **The one permitted mechanism does not work on the one ground where affordance is
ambiguous.** The struck plate is the fourth *form* the One Black Rule always promised, and it
reads as exactly what it is: a printing plate with a bevel. **A stamp band never carries one.
That is now the distinction between a statement and a control.**

**Disabled**, universally: the control leaves the stamp ground entirely. It becomes
`{colors.surface.sunken}` with a 1px `{colors.border.hairline}` and a `{colors.text.muted}`
label, at unchanged height. A disabled stamp is a contradiction — a plate that cannot strike
is not inked.

### Which affordance each component takes

| Component | Hover | Pressed | Disabled |
|---|---|---|---|
| `{components.copyControl}` | 1 + 2 | 2 | — |
| `{components.paneSwitch}` cell | 1 | 1 | — |
| `{components.reResolveControl}` | 3 | 3 | Disabled form |
| `{components.turnComposer}` field | focus only | — | Disabled form |
| `{components.classificationControl}` row | 1 | 1 | — |
| `{components.contextChip}` | 2 | — | — |
| `{components.jumpToLatest}` | 3 | 3 | — |
| `{components.ticketGroupHeader}` | 1 | 1 | — |
| `{components.ticketRow}` | 1 | 1 | — |
| `{components.ticketCreateBox}` submit | 3 | 3 | Disabled form |
| `{components.refetchControl}` | 1 + 2 | 2 | Disabled form |
| `{components.commandString}` | — (`user-select: all`) | — | — |
| `{components.annotationRow}` `[v2]` | 1 | 1 | — |
| `{components.dischargeControl}` `[v2]` | 3 | 3 | Disabled form |
| `{components.attachmentChip}` `[v2]` | 2 | — | — |
| `{components.hoverOutline}` `[v2]` | *is* the hover | — | — |
| `{components.annotationPin}` `[v2]` | 2 — its outer ring steps from 1px to 1.5px | — | — |

Everything not in this table is not interactive: `{components.identityHeader}`,
`{components.degradedConnectionIndicator}`, `{components.healthMarker}`,
`{components.stateNotice}` (its controls are), `{components.turnCard}`,
`{components.commentBubble}` (its controls are), `{components.freehandLayer}`,
`{components.iconBadge}`.

### Named rules

**The No-Blur Rule.** The offset shadow has **zero blur radius**. A blurred shadow is
atmosphere and this house bans it. An unblurred offset is a second sheet of paper, and on a
free-standing `[v2]` sheet it is the only thing separating paper from a white page at 1.17:1.
**On the Cockpit that job belongs to the spine**, which is 3.61:1 against white and 5.24:1
against near-black at the one edge that touches the page; the first draft credited the offset
with a job it cannot do there. If someone adds a blur, they have turned semantics back into
decoration and the rule is broken.

**The Nothing Lifts Rule.** No element gains a shadow on hover, focus, press or selection. A
shadow states a permanent physical fact — *this object is laid on top of that one* — and a
fact that changes on mouseover is not a fact. Interaction is the four affordances above, and
none of them is depth.

**The Tonal Layering Rule.** Depth inside the sheet is surface lightness plus a rule, never a
shadow. `{colors.surface.raised}` and `{colors.surface.sunken}` are 1.10:1 and 1.12:1 from
paper — that is deliberately below the perceptual threshold for a boundary, which is exactly
why every region also carries a printed rule. The tone says *what kind of thing this is*; the
rule says *where it ends*.

---

## Shapes

**Everything is a rectangle at 0px.** `{rounded.control}` and `{rounded.panel}` are both
`0px`. A radius is a screen idiom; a printed sheet is cut square and a stamp has corners. The
crispness is the single fastest read that this is not a web card.

`{rounded.pill}` is `9999px` and has **exactly two consumers in the whole system**: the `[v2]`
`{components.annotationPin}`, a numbered roundel drawn on somebody else's page, and
`{components.iconBadge}`, which Chrome draws on its own toolbar. **Nothing inside the Cockpit
is ever a pill.** This is a deliberate departure from EXPERIENCE.md's note that "pill is
reserved for state markers so a state is never shaped like a control" — here state markers are
**drawn marks**, which satisfies that intent more strongly than a pill would, because they are
not shaped like anything else in the system. Flagged in **Gaps** for the spine's revision.

### The signatures, by surface

*(This is the largest correction in the revision. The first draft's law was "A Sidepiece
surface without all three signatures is not a Sidepiece surface" — a test which, by its own
terms, disqualified the only surface v1 ships.)*

The first draft was written against the mock, and in the mock the panel is a **child element
of a 1240px harness page with grey margin around it** — which is why `.crop > i.tl{left:-5px}`
worked there. The Cockpit is not a child element. It **is** the side-panel viewport. An offset
of `3px 3px 0` paints right and below the root box and is clipped. Crop marks at
`inset: -5px` paint outside the root box and are clipped. Neither one can render, and no
amount of rationale changes that.

So the law is restated by surface.

**On a free-standing sheet** — the `[v2]` hover tooltip, the comment bubble, the freehand
commit sheet — **all three signatures are mandatory**, because those sheets float in the middle
of a page with page on all four sides and nothing else identifies them:

1. **The ticked spine.** A solid `{colors.overlay.signature}` bar on the inboard edge, **7px**
   on in-page sheets, ticked by
   `repeating-linear-gradient(to bottom, transparent 0 11px, rgba(255,255,255,.55) 11px 12px)`
   — 1px registration ticks at 12px intervals, not a tear-off perforation.
2. **Four detached registration ticks.** 10 × 10px L-shaped corner marks at 2px in
   `{colors.overlay.signature}`, set **3px clear** of the sheet's edge, with the tri-tone
   keyline. Detachment is what makes them registration marks rather than a corner treatment,
   and it is the geometry that carries identity under **The Foreign Hue Is Not Enough Rule**.
3. **The unblurred offset shadow**, specified in **Elevation & Depth**.

**On the docked Cockpit**, two of the three cannot paint and the third is not needed:

1. **The ticked spine, at 6px**, down the inboard edge. On the Cockpit this is *also* the edge
   treatment: it is the boundary between the sheet and the page at the one edge that touches
   it, at 3.61:1 against white and 5.24:1 against near-black. It does the job the offset was
   wrongly credited with, and it was always there doing it.
2. **Two inboard registration ticks**, 9 × 9px at 1px `{colors.text.primary}`, inset **3px
   inside** the sheet at the top-inboard and bottom-inboard corners. Inset, not outset, because
   outset is clipped. Two, not four, because the outboard corners are flush against browser
   chrome and there is nothing there to register against — a crop mark on an edge nobody trims
   is decoration by definition.
3. **No offset shadow.** It would be clipped on three sides and the fourth is the spine's.
   Chrome draws the separator between the pane and the content area, and the Cockpit sits
   *beside* the page, not on it. The sheet that is laid on the page is the `[v2]` layer, and
   it carries all three.

**The restated law:** *every free-standing Sidepiece sheet carries all three signatures; the
docked Cockpit carries the spine and the two inboard ticks.* The ink and the geometry are
identical on both, which is what the direction actually needs — the claim was never that the
shadow travels, it was that **the mark** travels.

*A `colors.surface.desk` token was considered and rejected — a neutral ground inset behind the
sheet so the offset and four crop marks would have somewhere to land. It spends 12px of a 340px
panel to render a shadow onto a fake table inside the viewport, which is precisely the
craft-fair move this direction cannot afford, and the spine already does the edge job for 6px
that is spent anyway. Recorded in **Gaps**.*

### The focus keyline

One ring, on every interactive element including the clone-path region. It is drawn as a
**two-tone printer's keyline**, not a single stroke, because a single ink ring is invisible on
the stamp ground (`1.00:1`) and a single spot ring is invisible on a spot mark:

```css
box-shadow: 0 0 0 1px #F2EDE3, 0 0 0 3px #191713;   /* inner paper, outer ink */
outline: none;
```

On every Sidepiece ground at least one of the two tones clears 3:1 — ink at 15.34:1 on paper,
paper at 15.34:1 on the stamp, and on a spot mark ink at 4.96:1 and paper at 3.09:1. It is
drawn with `box-shadow` rather than `outline` so it follows the 0px corner exactly, and it is
applied on `:focus-visible`. Holocene's audit found *"exactly one `:focus` rule and no
`:focus-visible`"* — that is the specific failure this token exists not to repeat.

**On a stamp-ground control the focus keyline and the struck plate coexist**, because one is
`inset` and the other is not:
`box-shadow: inset 0 0 0 1px {colors.surface.panel}, 0 0 0 1px {colors.focus.ringInner}, 0 0 0 3px {colors.focus.ring}`.

### Line weights

| Weight | Where |
|---|---|
| 1px `{colors.border.faint}` | Row separators inside a list |
| 1px `{colors.border.hairline}` | Box edges, section rules, dashed internal dividers |
| 1px `{colors.border.sheet}` | The outer edge of any Sidepiece sheet |
| 1px `{colors.border.strong}` | The pinned/scrolling seam, group headers, stamped-band outlines |
| 1px `{colors.surface.panel}` inset | The struck plate, on stamp-ground controls |
| 2px `{colors.action.mark}` | The operator's turn edge; the two selection underlines |
| 2px `{colors.overlay.outline}` | `[v2]` hover-outline stroke and its detached ticks |
| **5px composite — the 5 / 3 / 1 triple** | `[v2]` freehand stroke. Its true rendered width is 5px: a 5px `{colors.overlay.keylineDark}` under-stroke, a 3px `{colors.overlay.outline}` core, a 1px `{colors.overlay.keylineLight}` over-stroke. |
| **1.5 / 1px** | `[v2]` pin ring and leader — light inside, dark outside |

The freehand mark is recorded at its composite width because the first draft recorded it at
3px, which is only the core: a developer budgeting 3px of ink lays a 5px mark. And the
signature survives as 2 of its own 5px — two 1px slivers either side of the over-stroke —
which is exactly why the freehand mark's identity rests on the tri-tone and on the commit
sheet, not on the hue.

---

## Components

Visual specification only. Behavior, copy, state machines and when each appears belong to
EXPERIENCE.md and are not restated. Per the house schema, component token sets are capped at
**8 props** and **exclude shadows, motion and focus rings** — those are system-level and live
in **Elevation & Depth** and `{colors.focus.ring}`. Interaction *appearance* is Components'
job and is given once, in **Elevation & Depth → Which affordance each component takes**,
rather than repeated 25 times.

The seven `[v2]` components render into arbitrary third-party pages through a closed shadow
root, so the section below them states how they hold up over an unknown background.

### The Mark Law

*(New. The system's entire iconography is five marks, and nothing told a developer how to add
a sixth.)*

- **Marks are drawn or typed. Never SVG, never an icon font, never an emoji.**
- **Four of the five state marks are drawn in CSS**, centred in an `{spacing.glyph}` 11px box
  in `currentColor`: `marks.ok` is a 7 × 1px bar; `marks.failed` is a 7 × 7px filled box;
  `marks.unknown` is a 7 × 7px box with a 1px ring at `{rounded.pill}`; `marks.degraded` is a
  filled CSS triangle, 8px base × 7px rise. Drawn marks are font-independent, crisp at 11px,
  and immune to any coverage gap in the bundled face — which is not hypothetical: `─` is
  U+2500 in **Box Drawing** (the first draft named the wrong block — Geometric Shapes), and
  Box Drawing coverage is asserted nowhere for the bundled primary, only for the fallbacks. If
  the most frequent mark in the product fell through to a different face, one state row would
  render in two typefaces at two advances. The source mock had already solved this and said
  so: *"Backlog glyph, drawn not typed — a hollow square stays crisp at 7px in any font."*
- **One mark is typed:** `marks.pending`, `»` U+00BB, because Latin-1 is the one block every
  fallback in the mono stack guarantees. It is set in `{typography.micro}`.
- **One size.** `{spacing.glyph}` 11px, in all three consumers —
  `{components.healthMarker}`, `{components.ticketRow}` and every stamped band. The first draft
  rendered the same five marks at 10px, 10.5px and 12px with no rule saying which applied
  where, and the 10px was below its own stated floor.
- **No new mark is introduced without a word beside it**, and none whose silhouette is not
  distinct from the existing five at 11px.
- **No mark is ever hue alone.** That is the Glyph Law, and `marks.*` in the frontmatter is
  what makes it checkable by a generator instead of by a reviewer.

### v1 — the Cockpit

**`{components.identityHeader}`** — Pinned top on `{colors.surface.raised}`, closed by a 1px
`{colors.border.strong}` seam. Repo name in `{typography.heading}` at `{colors.text.primary}`,
fitting 27 characters before it wraps. Clone path directly beneath in a
`{colors.surface.sunken}` well with a 2px `{colors.border.hairline}` left edge, set in
`{typography.mono}` at `{colors.text.machine}`, wrapping and `user-select: all`. Board
identifier as a `{colors.surface.stamp}` chip — a **band**, so no inset keyline — with paper
text in `{typography.micro}`. Health marker and degraded indicator sit on the meta row at
`{spacing.tight}` intervals. **No overflow, no kebab, no menu** — there is nothing to put in
one and the header must never imply there is.

**`{components.copyControl}`** — 32px transparent control, 1px `{colors.border.hairline}`,
`{typography.micro}` at `{colors.text.muted}`. Sits inline at the end of any machine string.
Its confirmed label is the **same type, the same colour and the same box** as its resting
label; it never draws a toast, a tick, a fill or a colour change.

**`{components.degradedConnectionIndicator}`** — `marks.degraded` plus one word in
`{typography.micro}` at `{colors.state.degraded}`, on the header meta row. **No box, no fill,
no border** — it is a pencil note in the margin, not a badge, because it is a fact and not a
fault.

**`{components.paneSwitch}`** — A single 32px strip on the header's bottom edge, ruled top and
bottom in `{colors.border.strong}`, divided into equal cells by 1px `{colors.border.hairline}`.
Cell label in `{typography.label}`, uppercase. **The selected cell carries a 2px
`{colors.action.mark}` underline inside the cell and steps its label to
`{colors.text.primary}`**; unselected cells sit at `{colors.text.muted}`. Each cell carries its
own state mark at its leading edge, so a pane that is failing says so while hidden. The
reserved `[v2]` third slot renders as an empty ruled cell, not as a gap.

**`{components.healthMarker}`** — One `{spacing.glyph}` mark plus its word in
`{typography.label}`. **It carries no colour token of its own**: it is the generic five-state
marker, and the consumer supplies one of the five `colors.state` values together with the
matching `marks` entry. (The first draft hard-pinned its `textColor` to `{colors.state.ok}`,
which makes any resolver emit a permanently grey health marker.) No ring, no dot, no fill. The
mark *is* the marker.

**`{components.stateNotice}`** — A bordered block on `{colors.surface.raised}`, 1px
`{colors.border.strong}`, `{spacing.inset}` padding. Anatomy top to bottom: a
`{colors.surface.stamp}` **band** — solid, no inset keyline, because it is a statement and not
a control — carrying **the state mark and the state word, both in `{colors.text.inverse}` at
15.34:1**; the headline sentence in `{typography.body}` at `{colors.text.primary}`; an optional
detail line at `{colors.text.muted}`; an optional `{components.commandString}`; then the
control row, whose controls are struck plates. The band is the whole distinction between a
notice and a paragraph — **a state notice is stamped, not tinted.**

**`{components.reResolveControl}`** — 32px, `{colors.action.primary}` ground,
`{colors.text.inverse}` label in `{typography.label}`, square, with the 1px struck-plate inset
keyline. The primary control of any notice. Its demoted form is a transparent ground with a 1px
`{colors.border.hairline}` and a `{colors.text.muted}` label at the same height. Its disabled
form is `{colors.surface.sunken}` with a hairline and a muted label, keeping the 32px.

**`{components.turnComposer}`** — Bottom-anchored on `{colors.surface.raised}`, boxed in 1px
`{colors.border.hairline}`, **capped at 188px tall**. Stacked: context chip, classification
control, then the text field at `{typography.body}` on `{colors.surface.raised}` with a 1px
`{colors.border.faint}` top rule, then the action row. Placeholder text is
`{colors.text.muted}` **italic**, set in the bundled Charis SIL Italic — the serif italic is the
resting-state signal, and with the operator's own turn now in Roman it is one of only two
italics in the Cockpit.

**`{components.classificationControl}`** — **Two full-width stacked 30px rows**, boxed in 1px
`{colors.border.strong}`, divided by a 1px internal rule, 264px inside. Each row carries its
glossary term verbatim in `{typography.label}`, uppercase — `DISPATCHED COMMAND` at 132.5px in
a 264px row. **The selected row carries a 2px `{colors.action.mark}` underline inside the cell
and sets its label in `{colors.text.primary}`**; the unselected row is transparent with a
`{colors.text.muted}` label. This matches `{components.paneSwitch}` exactly, which is the
point: the two selection controls in the product now look like each other. *(The first draft
filled the selected row with the signature hue — a 264 × 30px spot block, present at rest,
larger than the clip band, and absent from both of the document's own enumerations of where
spot appears. It was the single largest resting spot area in the product and it is gone.)*

**`{components.contextChip}`** — A `{colors.surface.sunken}` block with a dashed 1px
`{colors.border.hairline}` bottom rule, sitting at the top of the composer, 268px inside. Its
kicker is `{typography.micro}` at `{colors.text.muted}`; the page title is `{typography.body}`
at its own 13.5px in `{colors.text.primary}`, wrapping to at most two lines — **no size
override; a token's value is the token's value**; the URL, when revealed, is
`{typography.mono}` at `{colors.text.machine}`, wrapping to two lines, never elided.

**`{components.turnCard}`** — Three visibly distinct variants, and the distinction is
**printed vs stamped**:

- *The operator's turn* — a 2px `{colors.action.mark}` left rule, 9px inset, serif **Roman** at
  `{colors.text.primary}`. It is the only spot-marked content in the scroll region and the 2px
  rule carries that alone. (It was italic; a serif italic beside a pink rule is a magazine
  pull-quote, not an instrument — and with no italic bundled it would have been a synthetic
  oblique landing on the operator's own voice.)
- *Streamed Exchange* — a `{typography.micro}` kicker at `{colors.text.muted}`, then the reply
  in `{typography.body}` at `{colors.text.primary}`. No box, no ground, no border. It is
  printed directly onto the sheet.
- *Dispatched Command* — a bordered block, 1px `{colors.border.strong}`, opening with a
  `{colors.surface.stamp}` **band** carrying **the state mark and the state word, both in
  `{colors.text.inverse}`**, with the correlation id right-aligned in `#C9BDA6` at 9.64:1.
  Inner body on `{colors.surface.raised}`; the acknowledgement in `{typography.mono}` at
  `{colors.text.machine}`; the outcome as a bordered `{typography.micro}` stamp chip; the
  result separated by a **dashed** `{colors.border.hairline}` rule. Turns are separated from
  each other by a 1px `{colors.border.faint}` rule at `{spacing.stack}`.

**`{components.jumpToLatest}`** — A 28px `{colors.action.primary}` control with the struck-plate
keyline, paper label in `{typography.label}`, floating bottom-right above the action bar with a
`{colors.surface.panel}` 1px keyline so it reads as a separate slip of paper over the scroll.
No shadow — it is inside the sheet, not on top of it.

**`{components.ticketGroupHeader}`** — Sticky to the top of the Tickets region on
`{colors.surface.panel}` (opaque, so rows do not ghost through), 30px, closed by a 1px
`{colors.border.strong}` bottom rule. State mark at `{spacing.glyph}`, then the state name in
`{typography.label}` uppercase at `{colors.text.primary}`, then the count right-aligned in
`{typography.label}` at `{colors.text.muted}` — `tabular-nums`, so the column does not jitter
as counts change.

**`{components.ticketRow}`** — **58px** at a two-line title (2 × 20.93px of text plus 16px of
padding), with `{spacing.row}` 32px as the one-line floor, separated by 1px
`{colors.border.faint}`. Three grid columns at an 8px gap,
`{spacing.glyph} max-content 1fr`: the state mark at `{spacing.glyph}` 11px, coloured by
whichever of the five `colors.state` values the row resolves to; the key in `{typography.mono}`
at `{colors.text.machine}`, sized to the longest key **in the current fetch** rather than to
the longest key across all projects; the title filling the remainder in `{typography.body}` at
`{colors.text.primary}`, wrapping to two lines — 227px, ≈35 characters per line, on SIDE. Hover
raises the row ground to `{colors.surface.raised}` — affordance 1, a tonal step, never a
shadow. A missing field renders as an ink em-dash at `{colors.text.muted}`, never as blank
space.

**`{components.ticketCreateBox}`** — Opens with a `{typography.micro}` kicker at
`{colors.text.muted}` above a 1px `{colors.border.strong}` top rule. The title field is a
**ruled blank**: no box, no ground, just a 1px `{colors.border.strong}` baseline with serif
italic placeholder at `{colors.text.muted}` — a form to be filled in by hand. The submit row is
**three cells at 32px across a 284px inner width: a 32px fixed leading slot, the submit filling
the remainder at 204px, a 32px fixed trailing slot, 8px gaps.** The submit is
`{colors.action.primary}` with the struck-plate keyline and its target Board named in
`{typography.label}` — a **24-character budget** at 7.36px per character after its `0 11px`
padding, which `CREATE IN 33GOD` clears with nine to spare. **The two empty slots render as
ruled space, not as gaps**, so the `[v2]` seats are visibly reserved.

**`{components.refetchControl}`** — 28px, transparent, 1px `{colors.border.strong}`,
`{typography.label}` at `{colors.text.primary}`. Deliberately quieter than the primary submit —
it reads as a secondary stamp, and it takes affordances 1 and 2 rather than the struck plate,
because it is not on the stamp ground.

**`{components.commandString}`** — A `{colors.surface.sunken}` block with a 2px
`{colors.border.hairline}` left edge, `5px 7px` padding, `{typography.mono}` at
`{colors.text.machine}`, `user-select: all`, `word-break: break-all`, never elided. Its
selection renders in `{colors.selection.ground}` with `{colors.selection.ink}` — never in the
signature hue, which would put white-on-spot at 3.61:1 on the panel's most important text.
Carries a `{components.copyControl}` and one empty `[v2]` action slot at its trailing edge.

### `[v2]` — the in-page layer

All seven render into a closed shadow root over an unknown page. **Common requirements:**

- Every sheet declares `color-scheme: light` and an explicit opaque `background`, sets
  `isolation: isolate` and `filter: none` so no ancestor page filter tints it, and is drawn at
  `z-index: 2147483647` inside a `position: fixed` root.
- **Every stroke drawn *on* the page rather than inside a sheet uses the tri-tone keyline** —
  all three tones, no exceptions, including the pin ring and the pin leader.
- **Identity is geometry, not hue.** Detached 10 × 10px registration ticks at 3px clear, plus
  the 7px ticked spine on the inboard edge of every mark and every sheet.
- **The achromatic fallback.** The content script reads the computed background of the outlined
  element and of its nearest opaque ancestor. **If ΔE76 to `#FF2E63` is under 25, the mark
  drops its signature stroke and renders ink-and-paper only** — the tri-tone keyline minus the
  spot, and no scrim — keeping the ticks and the spine. Tailwind `rose-500` is ΔE 8.0 and trips
  this.
- **Nothing prints.** `@media print { :host, .sp-root { display: none } }`. The layer is
  `position: fixed`, so without this rule every annotation paints over the first printed page
  of the operator's own document. This is a decision, not an omission: Sidepiece marks are for
  the screen. (If they must print, the layer needs `position: absolute` in document
  coordinates, which is a different component.)
- **Occlusion is handled, not ignored.** At maximum z-index a pin anchored to an element that
  has scrolled under a page's own sticky nav would paint on top of that nav, pointing at
  nothing. **A mark whose anchor rect is not visible in the viewport collapses to an
  edge-docked stub**: an 11 × 18px half-roundel flush to the nearest viewport edge, carrying
  its number in `{typography.numeral}`, drawn with the same tri-tone. It never floats over page
  chrome.

**`{components.hoverOutline}` `[v2]`** — A 2px `{colors.overlay.outline}` box with a
`{colors.overlay.scrim}` fill and four **detached** 10 × 10px corner ticks at the same weight,
3px clear of the box. **Tri-tone keyline mandatory**: a 1px `{colors.overlay.keylineDark}`
outside the stroke and a 1px `{colors.overlay.keylineLight}` inside it, guaranteeing ≥4.23:1
against any sRGB ground where the signature alone falls to 1.10:1. **The 7px ticked spine runs
down its inboard edge**, which is what makes it recognisably *Sidepiece's* rather than
recognisably *an outline*. The scrim is a **relative** tint — it says *which box*, read against
the untinted page beside it — and it is deliberately not a contrast device: at
`rgba(255,46,99,0.14)` it measures about 1.21:1 over white, and the outline and the ticks carry
every part of the job a ratio governs. Under the achromatic fallback the scrim drops entirely.
Its resolved-selector tooltip is a full free-standing Sidepiece sheet — paper ground, 7px
spine, four detached ticks, offset shadow — with the selector in `{typography.mono}` at
`{colors.text.primary}` and the dimensions beneath at `{colors.text.muted}`.

**The outline is ours to draw, and that was the deciding argument.** `[DECIDED 2026-09-20: a
hand-built closed shadow root, not `chrome.debugger`'s `Overlay.setInspectMode`, and no
fallback to it. The browser-native outline cannot wear the spine, the ticks or
`{colors.overlay.signature}` — it is Chrome's mark, not Sidepiece's — and every visual
guarantee in this entry would be unavailable under it. See `.decision-log.md`.]` The accepted
cost is that some pages defeat a fixed overlay through an ancestor `transform`, `filter` or
`contain`, or through the top layer. **That case renders no outline at all.** There is no
degraded, approximate or best-effort box: a displaced outline asserts something false about
which node was resolved, and the whole point of the tooltip printing the selector before commit
is that the operator can trust the answer. What renders instead belongs to the Cockpit — a
`{components.stateNotice}` on `{colors.state.failed}` naming the page — and it is
`EXPERIENCE.md`'s to word.

**`{components.commentBubble}` `[v2]`** — A 280px free-standing Sidepiece sheet on
`{colors.surface.overlay}`, 1px `{colors.border.sheet}`, 7px ticked spine, four detached ticks,
`3px 3px 0` offset at the dark-ground opacity. Header row: the anchor in `{typography.mono}` at
`{colors.text.machine}`, and the mark number as a square `{colors.action.mark}` chip with
`{colors.text.onSpot}` ink in `{typography.numeral}`. Body in `{typography.body}`. Footer above
a dashed rule: count at `{colors.text.muted}`, and a `{colors.surface.stamp}` commit control at
32px with its struck-plate keyline. Because it is a fully opaque sheet, its interior contrast
is identical to the Cockpit's on any page.

**`{components.freehandLayer}` `[v2]`** — A transparent full-viewport drawing surface. The
stroke is the **named 5 / 3 / 1 triple** and its true rendered width is **5px**: a 5px
`{colors.overlay.keylineDark}` under-stroke, a 3px `{colors.overlay.outline}` core, a 1px
`{colors.overlay.keylineLight}` over-stroke, round cap and round join — three tones on every
stroke, the hover outline's guarantee applied to freehand geometry. The token's `size` is the
core only; **Shapes → Line weights** records the composite. Strokes never change colour,
thickness or opacity by tool, age or pressure; the layer has one mark. The active bounding box
of committed strokes is a 1px dashed `{colors.overlay.outline}` rectangle, and the commit
affordance is a free-standing Sidepiece sheet pinned to the viewport corner, not an in-canvas
widget. *(The first draft carried the over-stroke colour in this component's `textColor`, on a
transparent drawing surface that has no text. It is prose and `borderColor` now.)*

**Replay, and the one visual state drift gets.** `[DECIDED 2026-09-20: strokes are vectors over
the live DOM and nothing is captured — no raster exists to replay against. See
`.decision-log.md`.]` Because there is no screenshot, a stroke is always redrawn over the page
as it is *now*, which means the design needs one appearance for "these marks no longer sit over
what they were drawn on" — `EXPERIENCE.md`'s **Drifted** outcome. That state renders the same
5 / 3 / 1 stroke with the core switched to `{colors.state.unknown}` and the two keylines
unchanged, plus the bounding-box rectangle switched from dashed to a 1px dotted
`{colors.state.unknown}`. **The geometry is never moved to follow the elements.** Desaturating
the core is the whole signal: the marks are still exactly where he drew them, and the colour
says the page is not. A stroke that relocated itself would be the confidently-wrong-anchor
failure wearing a different costume, and **Do's and Don'ts** forbids it.

**`{components.annotationPin}` `[v2]`** — An 18px `{rounded.pill}` roundel:
`{colors.action.mark}` fill, `{colors.text.onSpot}` ink digit in `{typography.numeral}` at
4.96:1 — two digits at 12.0px inside a 15px chord, so pins run 1–99. **Tri-tone, like
everything else drawn on a page**: a 1.5px `{colors.overlay.keylineLight}` ring inside and a
1px `{colors.overlay.keylineDark}` ring outside it. The translucent pink halo the first draft
specified is gone — it was a glow in a system that bans glows, and it left the pin at 1.90:1 on
a light-green ground and invisible on Tailwind rose. **This is the only curved shape in the
system**, and the curve is the point: it is a mark made *on* the page, not a piece of Sidepiece
chrome, and every piece of Sidepiece chrome is square. Its leader to an open bubble is the same
tri-tone at a 1.5px core: `{colors.overlay.keylineDark}` under, `{colors.overlay.outline}`
core, `{colors.overlay.keylineLight}` over.

**`{components.annotationRow}` `[v2]`** — Inside the Cockpit, so it is ordinary paper:
`{spacing.row}` minimum, 1px `{colors.border.faint}` separator, a leading pin number as a small
square `{colors.action.mark}` chip with `{colors.text.onSpot}` ink in `{typography.numeral}`,
the annotation text in `{typography.body}`, and the capture time in `{typography.label}` at
`{colors.text.muted}`. A lost anchor marks the row with `marks.unknown` at the leading edge;
the row is never dimmed, because a dim row reads as disabled and this one is still
dischargeable.

**`{components.dischargeControl}` `[v2]`** — The one-button finale. 32px,
`{colors.action.primary}` ground with the struck-plate keyline, `{colors.text.inverse}` label
in `{typography.label}`, full width of the action bar. **It is the largest stamp in the product
and it is the only control that is ever full-width** — the finale of a batch is the one moment
the instrument commits everything at once, and its width is how that reads.

**`{components.attachmentChip}` `[v2]`** — 24px, `{colors.surface.sunken}` fill, 1px
`{colors.action.markDeep}` border, label in `{typography.label}` at `{colors.action.markDeep}`
(**4.76:1** on sunken). **The only place `markDeep` sets type in the system.** It was a
`{colors.surface.spotWash}` pastel fill; a pastel is the one tonal register this system does
not otherwise contain, and a sunken well with a deep-spot rule says *a piece of the in-page
layer rode in here* without importing a boutique colour.

**`{components.iconBadge}` `[v2]`** — **Chrome owns the shape, the face, the size and the
tracking; Sidepiece owns two colours.** The mechanism is `chrome.action.setBadgeText` with
`setBadgeBackgroundColor('#FF2E63')` and `setBadgeTextColor('#191713')` at 4.96:1, and no other
control exists on that surface — the first draft specified a pill roundel with a typography
token there, which is not achievable through that API. Text is at most two characters by
convention. It must read at 16px against Chrome's own toolbar in both browser themes, which is
exactly the job the signature is best at and the job no ink could do. (The alternative —
drawing into the 16 × 16 action bitmap with `OffscreenCanvas` + `setIcon`, which *would* make a
real Sidepiece roundel achievable — is recorded in **Gaps** rather than assumed.)

---

## Do's and Don'ts

### Do

- **Do spend the signature on identity and armed marks only** — the spine, the clip band, the
  two 2px selection underlines, the operator's own turn edge, the `[v2]` outline and pin. On a
  screen at rest with no Turn showing, the only spot pixels are the spine, the clip and two
  underlines.
- **Do pair every state with its mark and its word**, and take the mark from `marks.*`, not
  from memory. No exceptions, including in a tooltip, including in a one-line row, including
  when space is tight.
- **Do set every mark and every word on a stamped band in `{colors.text.inverse}`.** A state
  hue on `{colors.surface.stamp}` measures between 1.00:1 and 3.02:1, and the worst of those is
  the failure mark on the failure notice.
- **Do set machine data in `{typography.mono}` at `{colors.text.machine}`, complete and
  selectable.** A path, a pjid, a Board id, a correlation id and a command are blue, they
  wrap, and they are `user-select: all` — selecting into `{colors.selection.ground}`.
- **Do draw every meaningful boundary in `{colors.border.strong}`.** Hairlines are texture;
  a seam the operator must see is ink.
- **Do keep 10.5px as the floor for static chrome and 11.5px for anything variable**, and buy
  density back with leading.
- **Do put the spine and the registration geometry on every Sidepiece surface** — all three
  signatures on a free-standing sheet, the spine and two inboard ticks on the docked Cockpit.
  A tooltip without them is indistinguishable from the page's own tooltip, and at that point
  the whole direction has failed.
- **Do use the tri-tone keyline on anything drawn on a page**, and remember what it buys:
  visibility, not identity. The signature alone is 1.10:1 on mid-grey and under 3:1 against
  91% of sRGB.
- **Do let geometry carry identity on somebody else's page.** Detached ticks and the ticked
  spine are ground-independent and no page owns them; the hue is ΔE 8.0 from Tailwind
  `rose-500` and plenty of pages do.
- **Do set text on the spot ground in ink `#191713`** (4.96:1), never white (3.61:1).
- **Do let text wrap.** Ticket titles wrap to two lines, paths wrap, URLs wrap. Truncation is
  how SIDE-12 becomes indistinguishable from SIDE-15.
- **Do give every interactive element one of the four affordances**, and only those four.
- **Do declare every bundled face with its own weight and style**, and set
  `font-synthesis: none` so a missing one fails loudly.

### Don't

- **Don't put a corner radius on anything but the `[v2]` pin and the icon badge.** No cards, no
  rounded buttons, no rounded inputs, no rounded chips.
- **Don't blur a shadow, and don't add a third one.** There are exactly two: the sheet offset
  on two grounds, and the focus keyline. The offset says "laid on top of." A blur says
  "generic web UI," and this house bans drop shadows for exactly that reason.
- **Don't let anything lift, glow, scale or elevate on hover.** Hover is affordance 1, 2 or 3.
  A translucent spread ring is a glow no matter what the table calls it.
- **Don't use green. Ever.** There is no green in this system, no success fill, no green tick.
  OK is grey and it is supposed to be boring.
- **Don't colour a status with the signature**, and don't invent a red for errors. Failure is a
  stamped black band.
- **Don't fill a control with the signature.** It underlines, it rules, it outlines, it spines.
  The one fill inside the Cockpit body would be the largest resting spot area in the product,
  and it was removed for exactly that reason.
- **Don't let the hue do identity's job on a page you do not own.** The page may already own
  the hue; it does not own detached registration ticks.
- **Don't use Inter** — *"the default safe font. Zero character. Banned."* (Jarad,
  `Dompacolypse/site/DESIGN.md`.) Don't use any sans-serif in the Cockpit at all. The one
  sans in this design system is whatever the third-party page brought with it, and the point
  is to not look like it.
- **Don't reach for the cyan/violet neon signature** — *"`#00f0ff` cyan + `#8b5cf6` violet…
  the single most recognizable 'an AI made this' signature."* The signature is `#FF2E63` and
  it is the only chromatic hue with an identity job.
- **Don't make everything a glass card.** *"When every element floats with the same blur +
  shadow, elevation stops meaning anything."*
- **Don't let a state ink onto chrome.** A `colors.state` value never colours a control, a
  filter, a caption, an explainer, a section rule or a border. It colours a mark or a state
  word, on a paper ground, and nothing else.
- **Don't fetch a font**, and **don't declare one without its weight and style.** MV3 forbids
  the fetch; `font-synthesis: none` plus seven explicit `@font-face` blocks forbid the fake.
  No Google Fonts link, no CDN, no `@import`, no `local()`.
- **Don't name Cascadia Code in a mono stack** — its ligatures rewrite `->` inside a path;
  Cascadia **Mono** is the correct fallback. And don't name a serif the bundle does not carry
  and this document has not measured: an unresolved family can bind to Noto Sans, and a sans
  in this panel is not a degradation, it is a failure.
- **Don't add a second accent, a gradient, a texture image, or a paper-grain overlay.** The
  paper is a flat hex value. A literal paper texture is where this direction stops being a
  design system and becomes a skin.
- **Don't draw a perforation, a torn edge, a dog-ear, a pushpin or a paperclip.** A tear-off
  strip is a raffle ticket. Registration ticks are an instrument. That difference is the whole
  direction.
- **Don't shrink type to fit.** If it does not fit at the floor, change the layout. That is
  how the classification control got its verbatim PRD strings back.
- **Don't override a token's value inside a component paragraph.** If a role needs a different
  size, it needs a role.

---

## Dark mode

**DECIDED 2026-09-20 — Sidepiece ships two grounds in one register.
`prefers-color-scheme: dark` renders Night Paper: the paper is dimmed, never inverted.
Nine values change; fifteen do not; the stamp device and the signature survive intact.**

The rest of this section is the derivation, and it is worth keeping in full because it
records *why* dimming and inversion are not the same kind of change. Two things it rules out
permanently: a full inversion, which is a second design system rather than a token swap; and
a night-specific signature, which would trade the register's one invariant for a contrast
figure. Both rejections are costed below.

One caveat stands, recorded rather than designed around: in a side panel
`prefers-color-scheme` reports the **operating system's** setting and never Chrome's own
theme, and no API exposes the browser theme (w3c/webextensions#242). A light-OS/dark-Chrome
operator gets Day paper against dark browser chrome. That is a known imprecision in the
trigger, not a reason to refuse the signal. No manual override ships in v1.

### The number nobody had put on the 2am problem

Paper `#F2EDE3` has relative luminance 0.850. On a 300-nit display that is **≈255 cd/m²**,
against a dark page's `#0D1117` at **≈1.6 cd/m²** — a **155× luminance ratio**, across a 17.7%
slice of a 1080p viewport, traversed on every single dip-in-dip-out, which is the product's
only interaction pattern. That is the real cost of the light ground and it belongs inside the
argument, not outside it.

### The argument for one *material*, in three measured parts

These three held, and they are why the answer is a dimmed paper rather than a dark panel.
What did not survive is the first draft's conclusion that they also forbid a second ground:
they forbid a second *material*. Night Paper is the same material at a lower emission.

1. **A dark panel beside a dark dashboard is camouflage, and camouflage is the one thing this
   direction cannot afford.** Paper on a dark page is **16.21:1**. Paper on a white page is
   **1.17:1** — and on the Cockpit it is the 6px signature spine, at 3.61:1 against white, that
   carries the light-page case. Invert the ground and you have not removed the problem, you
   have **moved it onto the half of the web where Sidepiece's north star actually lives** — the
   dark dashboards and dark app UIs he is reviewing.
2. **`prefers-color-scheme` is an imprecise signal, and it is the only one there is.** In a
   side panel it reports the **OS** setting and never Chrome's own theme, and no API exposes
   the browser theme (w3c/webextensions#242), so it will read wrong for a light-OS/dark-Chrome
   operator. The first draft treated that as grounds for refusing the signal entirely. It is
   not: the failure mode of guessing wrong here is *the operator gets the other paper*, which
   is a comfort miss, not a broken interface — because both grounds are the same material and
   every token that carries meaning is measured on both. **A signal that can only be wrong
   about brightness is safe to follow.** It would not be safe if the two grounds were
   different design systems, which is exactly why the inversion below is rejected.
3. **The register is not a palette, it is a material.** "Paper" that is sometimes black is not
   paper. The direction's whole claim — a printed instrument laid on somebody else's screen —
   has a ground built into the noun.

### Why a full inversion is a redesign, not a token swap

The first draft priced an inversion as *"a token swap… pre-measured so nobody has to
re-argue it"* and then listed 8 of 22 colour tokens. **That understated the cost at the exact
moment Jarad is being asked to rule, and it is withdrawn.** Measured against the dark panel
that draft proposed, `#17150F`:

| Token | Value | On `#17150F` |
|---|---|---|
| `surface.stamp` | `#191713` | **1.02:1** |
| `action.primary` | `#191713` | **1.02:1** |
| `state.failed` | `#191713` | **1.02:1** |
| `border.strong` | `#191713` | **1.02:1** |
| `focus.ring` | `#191713` | **1.02:1** |
| `overlay.keylineDark` | `#191713` | **1.02:1** |
| `state.pending` | `#4C463A` | **1.95:1** |
| `state.ok` / `state.unknown` | `#645D4E` | **2.80:1** |
| `action.markDeep` | `#C2003F` | **2.93:1** |

That is the stamped band, the submit, the failure state, every meaningful boundary, the focus
ring and three of five states — all invisible, and none of them in the first draft's table.
**The One Black Rule is precisely what makes an inversion impossible:** in dark mode the type
goes light and the stamp must go light too, and *"stamped = inverted"* has no inverse left. A
stamp needs a light ground to stamp onto. Doing it properly would require a second
`surface.stamp` that is paper-on-dark (`#EDE7DA` ground with `#17150F` text), a re-derived
`border.strong` (`#6E6757`, 3.25:1), a `focus.ring` whose tone order flips, and a new answer to
what "failure is stamped black" means when everything structural is already light. That is a
second design system. It is not costed here because it should not be built.

### Night Paper — the shipped dark mode, costed in full

**Dim the paper; do not invert it.** Night Paper keeps the material, keeps the stamp device,
keeps every structural token, and is **18% less emissive**: `#E0D9C8` is Lrel 0.709 ≈ **209
cd/m²** on a 300-nit display, against paper's 255. Ink stays at 12.72:1. It is still
unmistakably warm paper rather than a dark panel, so nothing in **Brand & Style** has to be
re-argued.

All 24 colour tokens, measured:

| Token | Day | Night | On night panel `#E0D9C8` |
|---|---|---|---|
| `surface.panel` | `#F2EDE3` | `#E0D9C8` | — |
| `surface.raised` | `#FBF8F1` | `#EAE4D6` | ink **14.12:1** ✓ |
| `surface.sunken` | `#E8E0D0` | `#D3CAB6` | ink **10.99:1** ✓ |
| `surface.overlay` | `#F2EDE3` | **unchanged** | in-page sheets are never dimmed — a guest sheet is not themed by its host's operator |
| `surface.stamp` | `#191713` | **unchanged** | the stamp still works, which is the whole argument |
| `surface.spotWash` | `#FFE4EC` | `#F7CFDB` | ink on it **12.70:1** ✓ |
| `border.hairline` | `#CFC3AB` | `#BCAF93` | 1.54:1 — same role, same accepted failure |
| `border.faint` | `#E0D7C4` | `#CFC5AE` | 1.22:1 — same |
| `border.sheet` | `#C9BDA6` | `#B3A68C` | 1.71:1 — same |
| `border.strong` | `#191713` | **unchanged** | **12.72:1** ✓ |
| `text.primary` | `#191713` | **unchanged** | **12.72:1** ✓ |
| `text.muted` | `#645D4E` | `#565040` | **5.70:1** ✓ (4.93:1 on sunk) |
| `text.machine` | `#1B3FA0` | **unchanged** | **6.59:1** ✓ (5.69:1 on sunk) |
| `text.inverse` | `#F2EDE3` | `#E0D9C8` | **12.72:1** on the stamp ✓ |
| `text.onSpot` | `#191713` | **unchanged** | **4.96:1** on the spot ✓ |
| `state.ok` | `#645D4E` | `#565040` | **5.70:1** ✓ |
| `state.pending` | `#4C463A` | **unchanged** | **6.65:1** ✓ |
| `state.degraded` | `#8A5A0B` | `#6F460A` | **5.84:1** ✓ (5.04:1 on sunk) |
| `state.failed` | `#191713` | **unchanged** | **12.72:1** ✓ |
| `state.unknown` | `#645D4E` | `#565040` | **5.70:1** ✓ |
| `action.primary` | `#191713` | **unchanged** | **12.72:1** ✓ |
| `action.mark` | `#FF2E63` | **unchanged** | **2.56:1** — accepted, see below |
| `action.markDeep` | `#C2003F` | `#A3002F` | **5.75:1** ✓ (4.96:1 on night sunk) |
| `overlay.*` — all five, including `signature` | — | **unchanged, all five** | drawn on other people's pages; never themed |
| `focus.ring` | `#191713` | **unchanged** | **12.72:1** ✓ |
| `focus.ringInner` | `#F2EDE3` | `#E0D9C8` | **12.72:1** on the stamp ✓ |
| `selection.ground` | `#FFE4EC` | `#F7CFDB` | ink **12.70:1** ✓ |
| `selection.ink` | `#191713` | **unchanged** | ✓ |

**Nine values change. Fifteen do not.** Compare an inversion, which changes all of them and
leaves the stamp device with no meaning.

**One accepted failure, stated rather than fixed.** `{colors.action.mark}` measures **2.56:1**
on night paper, under the 3:1 non-text floor. The obvious fix is to set the night spine and
clip in `{colors.action.markDeep}` at 4.44:1 — **and that fix is rejected.** The signature is
one value on every surface in both modes; that invariance is what `{colors.overlay.signature}`
*is for*, and EXPERIENCE.md states it as a behavioral constraint ("must survive both grounds
unchanged"). A spine that is one pink by day and another by night is three treatments again.
A 6px fluorescent bar at 2.56:1 against warm paper remains plainly visible — the hue separation
is enormous where the luminance separation is small — and the spine is a fill, not a boundary
required to understand content, which is the same exemption the hairlines already take. It is
recorded as a genuine cost, not waved away, and it is **Gaps** item 3.

### What `prefers-color-scheme: dark` does

It switches the ground to Night Paper and hardens the sheet offset. Nothing else moves:

```css
:root {
  color-scheme: light;                      /* always, in BOTH modes — Night Paper is still a
                                               light ground at Lrel 0.709, so Chrome's own form
                                               controls, scrollbars and default canvas must
                                               render light or they will fight the sheet */
  --sheet-offset: 3px 3px 0 rgba(25,23,19,.26);
}

@media (prefers-color-scheme: dark) {
  :root {
    /* the nine values that change — every other token is identical in both modes */
    --surface-panel:     #E0D9C8;
    --surface-raised:    #EAE4D6;
    --surface-sunken:    #D3CAB6;
    --surface-spotWash:  #F7CFDB;
    --border-hairline:   #BCAF93;
    --border-faint:      #CFC5AE;
    --border-sheet:      #B3A68C;
    --text-muted:        #565040;   /* also state.ok and state.unknown */
    --state-degraded:    #6F460A;
    --action-markDeep:   #A3002F;
    --text-inverse:      #E0D9C8;   /* tracks the ground, as does focus.ringInner */
    --focus-ringInner:   #E0D9C8;
    --selection-ground:  #F7CFDB;

    --sheet-offset: 3px 3px 0 rgba(0,0,0,.45);   /* paper on a dark desk casts harder */
  }
}
```

Read the list carefully for what is **absent**: `surface.stamp`, `border.strong`,
`text.primary`, `state.failed`, `action.primary`, `focus.ring` and all five `overlay.*`
tokens — including `signature` — are byte-identical in both modes. That is the property the
inversion could not have and the reason the whole thing is thirteen declarations rather than a
second stylesheet.

`surface.overlay` is deliberately not in the list either. **In-page sheets are never dimmed**:
a guest sheet drawn onto somebody else's page is not themed by its host's operator, and the
`[v2]` layer must look the same to Jarad on every site regardless of what his OS is set to.

**The live `change` event is honoured**, not sampled once at load — `EXPERIENCE.md` requires
the Cockpit to follow an OS theme change while open, and the media query does that for free.

---

## Gaps, conflicts and open questions

**For Jarad**

1. ~~**One ground or two?**~~ **CLOSED 2026-09-20 — two, in one register.**
   `prefers-color-scheme: dark` ships **Night Paper**: nine values, measured, material intact,
   stamp device intact, signature invariant. The full inversion stays rejected and stays
   priced above, because it is a second design system rather than a token swap.
   **Be honest about the size of the win:** Night Paper takes the 2am figure from ≈255 cd/m²
   to ≈209, so the luminance ratio against a `#0D1117` page falls from about **155× to about
   131×** — an 18% cut in emission, not a transformation. It is a comfort improvement, and if
   daily use proves 131× is still too much, the next move is a *darker paper*, not an
   inversion. See `.decision-log.md`.
2. **The signature is both the whole argument and the whole risk**, and it cannot be de-risked
   by recolouring — a quieter spot stops being unmistakable on white *and* black. What *has*
   been de-risked is the dependence on it: identity now rests on geometry (detached ticks, the
   ticked spine) with the hue as reinforcement, because `#FF2E63` is ΔE 8.0 from Tailwind
   `rose-500` and under 3:1 against 91% of sRGB. Confirm you are happy with that division of
   labour, because it is a real change to what "the spot carries the direction" means.
3. **Night Paper's one accepted failure — now live, not hypothetical.** With Night Paper
   shipped, `{colors.action.mark}` runs at **2.56:1** on `#E0D9C8` in every dark-OS session.
   The alternative is a `markDeep` spine at 4.44:1, which breaks signature invariance across
   modes; this document chose invariance and that choice now has daily consequences rather
   than theoretical ones. Overrule it if the night spine reads weak in use.
4. **Chrome labels moved from 8.5px to 10.5/11.5px.** This bought back the verbatim
   `DISPATCHED COMMAND` and cost the single-line context URL. Confirm the trade.
5. **The mock's `ink-3 #837A69` is 3.63:1 and fails body text**, so `{colors.text.muted}` ships
   at `#645D4E` (5.59:1) and `#837A69` is **dropped from the system entirely** — no token
   carries it. The panel reads slightly heavier than the mock did. Confirm that is wanted.
6. **Ochre `#8A5A0B` is the one hue added to the direction's palette.** If you would rather the
   state set be pure ink, degraded collapses onto `{colors.state.pending}`'s value and is
   carried by `marks.degraded` alone.
7. **The icon badge: cede it to Chrome, or draw it?** As shipped, Sidepiece sets only
   `setBadgeText` / `setBadgeBackgroundColor` / `setBadgeTextColor` and Chrome owns the shape,
   the face and the tracking. Drawing the 16 × 16 action bitmap with `OffscreenCanvas` +
   `setIcon` would let the roundel be a real Sidepiece mark with a real spine. That is a
   v2-sized amount of work on the always-on surface FR-3 leans hardest on, and it is your call
   whether it is worth it.
8. **Two `[v2]` platform decisions that are design decisions in disguise.** Annotations **do
   not print** (a fixed-position layer would otherwise paint over the first printed page), and
   an occluded pin **collapses to an edge-docked stub** rather than floating over a page's own
   sticky nav. Both are recorded above as spec; both are reversible if you want different
   behaviour, and reversing the print one changes the layer's positioning model.

**Findings from the two audits that were rejected, and why**

- **REJECTED — `colors.surface.desk` plus a 6px sheet inset, so the offset and four crop marks
  have somewhere to land.** Both auditors proposed it and it is the wrong trade. It spends 12px
  of a 340px panel to render a shadow onto a fake table *inside* the viewport, which is exactly
  the craft-fair move this direction cannot afford; the spine already does the edge job at
  3.61:1 against white for pixels that are spent anyway. The *finding* — that the signatures
  cannot render on the Cockpit — is correct and is fixed by splitting the law by surface.
- **REJECTED — night mode sets the spine and clip in `{colors.action.markDeep}`.** See Gaps
  item 3. It buys 4.44:1 by making the signature two values, and one value across every surface
  and both grounds is the property EXPERIENCE.md states as a behavioral constraint.
- **REJECTED — deleting `{colors.overlay.scrim}` as "a token that lies about doing work."** The
  measurement is right (1.15:1 over white at 0.10) and the conclusion is wrong: a hover tint is
  read against the *untinted* page beside it, which is a chromatic judgement and not a contrast
  ratio. It is raised to `0.14` and the section now says plainly that it is a relative tint and
  not a contrast device, which is the honest fix. It also drops entirely under the achromatic
  fallback, which is the one case where it genuinely would have lied.
- **PARTIALLY REJECTED — "cap the counted marks at `9+`."** The cap is right for the browser
  badge, where Chrome owns the rendering anyway, but `{typography.numeral}` at 6.00px/character
  puts two digits in 12.0px inside a 15px chord, so the pin holds 1–99 and losing the tens for
  no reason would be a worse instrument. Pins run 1–99; the layer does not mint a hundredth
  mark.
- **PARTIALLY REJECTED — "`border.strong` re-derived at `#6E6757`, 3.1:1."** The value is right
  and the ratio is 3.25:1, not 3.1:1; recomputed here. It is quoted only inside the
  *why-inversion-is-a-redesign* argument, because the inverted token set is deliberately not
  shipped.

**Conflicts with the spec, declared**

- **The spec says `colors` is a flat object with kebab-case keys; `impeccable`'s
  `reference/document.md` shows the same.** This document uses **nested** colour objects,
  because EXPERIENCE.md — the peer contract — references `{colors.surface.panel}`,
  `{colors.state.ok}`, `{colors.overlay.signature}` and `{colors.focus.ring}`, and the spec
  states that "the path follows the YAML structure." Nested is the only shape that resolves
  those references. Followed the token contract; noting the conflict.
- **`marks:` is a top-level key the spec does not name.** A deliberate extension, justified by
  the Glyph Law: the mark is half of every state, this document's strongest accessibility claim
  rests on it, and a YAML comment cannot be enforced by a generator. The spec's frontmatter
  table is a list of recognised keys rather than a prohibition, and `impeccable` states that
  "scale keys are open-ended." A resolver that ignores `marks` loses nothing that existed
  before; one that honours it can check the law. **`colors.state.*` deliberately stays a flat
  hex** so that EXPERIENCE.md's references still resolve to a colour.
- **`fontSizeAdjust` and `fontVariantNumeric` are typography props the bmad-ux spec does not
  list.** The spec says each typography value takes "any subset of" its five props;
  `impeccable` says to include "only the props that are real for the project" and names
  `fontFeature` / `fontVariation` as examples, so the list is open. Both are real here:
  `fontSizeAdjust` is the entire defence against metric collapse on a cold install, and
  `fontVariantNumeric` is what stops a board count jittering.
- **`impeccable` names the body sections `Overview / Colors / Typography / Layout / Elevation &
  Depth / Shapes / Components / Do's and Don'ts`. The bmad-ux spec names them `Brand & Style /
  Colors / Typography / Layout & Spacing / Elevation & Depth / Shapes / Components / Do's and
  Don'ts`.** Followed bmad-ux, as instructed. A DESIGN.md-aware tool keyed to `impeccable`'s
  headings will not find `Overview` or `Layout`.
- **`impeccable` caps component sub-tokens at a fixed eight-name vocabulary** (`backgroundColor`,
  `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`) which has no slot
  for a border colour. In a system whose entire structural device is a 1px printed rule, that
  omission is fatal, so `borderColor` is used as a ninth name while the **count** stays at or
  under eight props per component, which is the constraint that matters.
- **`impeccable` also requires a `.impeccable/design.json` sidecar** carrying tonal ramps,
  shadow and motion tokens and component HTML/CSS snippets. Not written — Sidepiece has zero
  frontend code, there is nothing to render into the live panel, and the shadow vocabulary is
  carried in prose here instead. Re-run `/impeccable document` in scan mode once there is code.

**For EXPERIENCE.md's parallel revision**

- **`{colors.overlay.signature}` is now defined**, at `#FF2E63`, as the one signature ink shared
  by the Cockpit and the in-page layer, invariant across surfaces and across both grounds. All
  five of EXPERIENCE.md's references resolve. **One amendment it should absorb:** the signature
  *treatment* is ink **plus geometry** — the detached registration ticks and the ticked spine —
  because the hue alone is under 3:1 against 91% of sRGB and ΔE 8.0 from Tailwind `rose-500`.
  The behavioral guarantee EXPERIENCE.md states ("must be the same mark in both") is satisfied
  and strengthened by that, but any sentence that treats the signature as *only* a colour is
  now too narrow.
- **`{typography}`'s note reads "Sans for people, mono for machines."** The chosen direction is
  **serif** for people; the mono half is unchanged. One word.
- **EXPERIENCE.md writes the column as 320px throughout.** The direction is drawn at 340px with
  a **304px** usable column after the spine, border and gutter. 320px is Chrome's floor, not the
  design target; at 320px the usable column is 284px and the ticket title column drops to 207px
  on SIDE. One number, many occurrences.
- **`{rounded.pill}` "is reserved for state markers so a state is never shaped like a control."**
  Here state markers are drawn marks and `pill` has exactly two `[v2]` consumers. The intent is
  over-satisfied but the sentence is now wrong.
- **Component count agrees.** EXPERIENCE.md's Foundation says "25 components — 17 v1 and 8
  marked `[v2]`," and this document defines all 25 at exactly those paths, plus
  `{components.freehandLayer}`.
- **EXPERIENCE.md's dark-mode resolution says "the Cockpit is dark-first."** Superseded by the
  section above, subject to Jarad's ruling — and note that the answer to its Gaps item 3 ("what
  is dark mode?") is now **Night Paper**, a fourth option its three-way framing (no dark mode /
  an inverted paper / a genuine second token set) did not contain.
- **EXPERIENCE.md should carry the three `[v2]` platform rules this document added**, because
  all three change behavior rather than appearance: the in-page layer does not print; a mark
  whose anchor is occluded collapses to an edge-docked stub; and the outline samples the page's
  computed background and drops its signature stroke below ΔE 25.
