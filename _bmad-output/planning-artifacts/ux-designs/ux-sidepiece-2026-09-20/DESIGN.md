---
# Frontmatter key order: doc-meta keys FIRST (name, description, status, updated, project,
# sources), then the token blocks in spec order (colors, typography, rounded, spacing,
# components). 'status' and 'updated' are top-level because the bmad-ux resume scanner
# reads them there.
#
# Token paths are NESTED, not flat kebab-case. EXPERIENCE.md is the peer contract and it
# references tokens as {colors.surface.panel}, {colors.state.ok}, {typography.mono}. The
# spec says "the path follows the YAML structure", so nested is the only shape that
# resolves those references. See "Conflicts with the spec, declared" at the foot of this
# document.
name: Sidepiece
description: A printed instrument laid on top of somebody else's screen. Warm paper, serif ink, a fluorescent spot spine and crop marks that make a Sidepiece mark unmistakable on a white docs site and a black dashboard alike.
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
    spotWash: '#FFE4EC'       # spot at fill strength; fills only, never type
  border:
    hairline: '#CFC3AB'       # the 1px printed rule — box edges, section rules
    strong: '#191713'         # the pinned/scrolling seam, group headers, stamped bands
    faint: '#E0D7C4'          # row separators inside a list
    sheet: '#C9BDA6'          # the outer edge of any Sidepiece sheet
  text:
    primary: '#191713'        # serif body and headings, full-strength rules
    muted: '#645D4E'          # captions, metadata, secondary lines
    machine: '#1B3FA0'        # ALL machine data, in mono: paths, pjid, cid, commands
    inverse: '#F2EDE3'        # type on {colors.surface.stamp}
    onSpot: '#191713'         # type on {colors.action.mark} — ink, never white
  state:
    ok: '#645D4E'             # glyph ─  · OK is grey. Nothing is ever green.
    pending: '#4C463A'        # glyph »  · ink still wet
    degraded: '#8A5A0B'       # glyph ▲  · the one hue admitted to the state set
    failed: '#191713'         # glyph ■  · stamped, inverted, never coloured
    unknown: '#645D4E'        # glyph ○  · shares ok's ink on purpose; the mark carries it
  action:
    primary: '#191713'        # the submit. Committing is a stamp.
    mark: '#FF2E63'           # THE SPOT. Identity and armed/active marks only. Never state.
    markDeep: '#C2003F'       # the only spot that may set type on paper
  overlay:
    outline: '#FF2E63'        # [v2] hover outline and freehand stroke
    scrim: 'rgba(255, 46, 99, 0.10)'
    keylineDark: '#191713'    # [v2] outer keyline — carries the mark on light pages
    keylineLight: '#FFFFFF'   # [v2] inner keyline — carries the mark on dark pages
  focus:
    ring: '#191713'           # outer ink of the two-tone keyline
    ringInner: '#F2EDE3'      # inner paper of the two-tone keyline

typography:
  heading:
    fontFamily: '"Charis SIL", "Bitstream Charter", Charter, "Source Serif 4", "Iowan Old Style", Georgia, "Noto Serif", "Liberation Serif", serif'
    fontSize: 22px
    fontWeight: '700'
    lineHeight: '1.05'
    letterSpacing: -0.015em
  body:
    fontFamily: '"Charis SIL", "Bitstream Charter", Charter, "Source Serif 4", "Iowan Old Style", Georgia, "Noto Serif", "Liberation Serif", serif'
    fontSize: 13.5px
    fontWeight: '400'
    lineHeight: '1.55'
    letterSpacing: normal
  label:
    fontFamily: '"IBM Plex Mono", "Cascadia Mono", ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace'
    fontSize: 11.5px
    fontWeight: '500'
    lineHeight: '1.35'
    letterSpacing: 0.08em
  micro:
    fontFamily: '"IBM Plex Mono", "Cascadia Mono", ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace'
    fontSize: 10.5px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.18em
  mono:
    fontFamily: '"IBM Plex Mono", "Cascadia Mono", ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace'
    fontSize: 11.5px
    fontWeight: '400'
    lineHeight: '1.45'
    letterSpacing: 0.01em

rounded:
  control: 0px
  panel: 0px
  pill: 9999px

spacing:
  hair: 4px
  tight: 6px
  inset: 9px
  gutter: 14px
  stack: 15px
  row: 32px
  section: 24px

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
    padding: '0 0 0 14px'
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
    textColor: '{colors.state.ok}'
    typography: '{typography.label}'
    padding: '0'
    size: 12px
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
    rounded: '{rounded.panel}'
  classificationControl:
    backgroundColor: '{colors.surface.raised}'
    textColor: '{colors.text.primary}'
    borderColor: '{colors.border.strong}'
    typography: '{typography.label}'
    padding: '0 9px'
    height: 30px
    width: 100%
  contextChip:
    backgroundColor: '{colors.surface.sunken}'
    textColor: '{colors.text.muted}'
    borderColor: '{colors.border.hairline}'
    typography: '{typography.mono}'
    padding: '6px 8px'
    rounded: '{rounded.control}'
  turnCard:
    backgroundColor: transparent
    textColor: '{colors.text.primary}'
    borderColor: '{colors.action.mark}'
    typography: '{typography.body}'
    padding: '1px 0 1px 9px'
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
    height: '{spacing.row}'
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
    textColor: '{colors.overlay.keylineLight}'
    size: 3px
    width: 100%
    height: 100%
  annotationPin:
    backgroundColor: '{colors.action.mark}'
    textColor: '{colors.text.onSpot}'
    borderColor: '{colors.overlay.keylineLight}'
    typography: '{typography.label}'
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
    padding: '0 14px'
    height: 32px
    rounded: '{rounded.control}'
  attachmentChip:
    backgroundColor: '{colors.surface.spotWash}'
    textColor: '{colors.action.markDeep}'
    borderColor: '{colors.action.markDeep}'
    typography: '{typography.label}'
    padding: '0 7px'
    height: 24px
    rounded: '{rounded.control}'
  iconBadge:
    backgroundColor: '{colors.action.mark}'
    textColor: '{colors.text.onSpot}'
    typography: '{typography.micro}'
    size: 16px
    rounded: '{rounded.pill}'
---

# Sidepiece — DESIGN.md

**DESIGN.md owns how it looks. `EXPERIENCE.md` owns how it behaves.** Where this document
names a state, a control or a component, it specifies only its appearance; what it does,
when it appears and what it says are the spine's, and are not restated here.

---

## Brand & Style

**Creative North Star: "The Printed Instrument."**

Sidepiece is a warm paper sheet laid on top of somebody else's screen. Serif throughout,
ruled in ink, stamped rather than styled, carrying an offset shadow with no blur and signed
at its left edge with a perforated fluorescent spine and ink crop marks at every corner.
Nothing in it is a card, a pill, a gradient or a glass panel. It looks like a proof sheet
on a light table, because that is exactly what it is doing.

This register was chosen against three alternatives at true panel width, and it was chosen
for one reason: **Sidepiece is the only tool Jarad owns that draws on other people's
screens.** A hover outline, a comment bubble, a numbered pin, freehand markup — all of it
renders into a page whose colours, type and chrome are unknown and hostile. The moment a
Sidepiece mark is ambiguous with the page's own marks, the "finger on the clipboard"
confidence loop breaks: he points, and he is not sure what he pointed at. So the panel does
not try to belong. It carries a register that survives leaving the panel — the same spine,
the same crop marks, the same spot hue are drawn on the Cockpit, on the hover tooltip and
on the in-page comment bubble, **so that a Sidepiece mark is unmistakably a Sidepiece mark
on a white docs site and on a black dashboard alike.**

That single requirement settles two house rules against themselves, and this document
defends both breaks with measured numbers rather than taste.

- **It is light, on a machine where every other surface is dark-first.** A dark panel beside
  a dark dashboard is camouflage, and camouflage is the one thing this direction cannot
  afford. The measurement: paper `#F2EDE3` on a dark dashboard ground `#0E1116` is
  **16.21:1** — the sheet is unmissable. The same paper against a white docs page is
  **1.17:1** — it nearly vanishes. That asymmetry is the whole argument. You cannot be
  foreign to both grounds with one ground, so you pick the ground where the sheet does the
  most work by itself, and you make the *signature* carry the other case. The spine, the
  crop marks and the unblurred offset shadow are that carry, and they are not decoration —
  they are the half of the job the paper cannot do.
- **It has a shadow, in a house that bans drop shadows.** The shadow is `3px 3px 0` with
  **zero blur**. A blurred shadow is atmosphere. An unblurred offset is a second sheet of
  paper. It is the semantics of *laid on top of, not part of*, and it is the only thing
  separating the sheet from a white page at 1.17:1.

One house rule is kept exactly: **monospace is reserved for machine-generated data.** What
changes is the other half of that pairing — the house says "sans for people," and here it
is **serif for people**, because web UI chrome is sans and a serif panel is instantly
not-the-page and not-the-browser. Charter and Georgia are among the very few serifs drawn
for small sizes on screen, which is the specific reason 13.5px body type is viable in a
300px column at all.

**Key characteristics**

- Warm paper ground, never white, never grey, never navy.
- Serif for human text; monospace for machine text; no sans-serif anywhere in the Cockpit.
- Square. Nothing has a corner radius except one `[v2]` annotation pin.
- One fluorescent spot hue, spent only on identity and on armed marks — never on status.
- Status is glyph plus word plus ink weight. Nothing is green, and red is not available
  because red is the signature.
- Structure from 1px printed rules and one unblurred offset shadow. No elevation on hover,
  no motion as hierarchy, nothing that floats.

### Earning the register

Paper-and-ink is one bad decision away from being a novelty skin. Three things keep it
craft:

1. **The ink does real work.** Every rule in the Cockpit is a boundary a developer can name
   — a region seam, a row separator, a stamped band. There is no rule drawn "for texture."
2. **The spot is rationed.** There are exactly four places it appears in v1: the clip band,
   the spine, the active pane marker, and the operator's own turn edge. Everything else is
   ink. If a screen at rest shows spot anywhere other than the spine and the clip, something
   is miscoloured.
3. **The typography is the density mechanism.** Density comes from leading, never from
   shrinking type. The rendered direction set chrome labels at 8.5px; this document raises
   the floor to 10.5px static / 11.5px variable, and pays for it in leading and in one
   layout change (see **Layout & Spacing → What the raised type floor cost**). That
   correction is what separates a print-*look* from a printed *instrument*.

---

## Colors

The palette is four warm papers, four inks, one blue, and one fluorescent spot. It is small
on purpose: a proof sheet has the ink that is on the press, and no more.

### Grounds

- **Paper (`#F2EDE3`)** — the sheet. The Cockpit ground and the `[v2]` in-page sheet ground,
  which are **the same value on purpose**: the bubble on the page is not a variant of the
  panel, it is the same sheet, and law 3 of the direction makes that literal.
- **Paper Raised (`#FBF8F1`)** — anything lifted off the sheet: the pinned identity header,
  the action bar, the composer, a dispatch result block, a state notice.
- **Paper Sunk (`#E8E0D0`)** — anything pressed into the sheet: input wells, collapsed group
  interiors, and every machine-data block (clone path, command string).
- **Stamp (`#191713`)** — the inverted band ground. A dispatch header, a failure band, a
  submit control. Not a "dark surface"; a stamp.

### Inks

- **Ink (`#191713`)** — serif body, headings, full-strength rules, the stamp ground, the
  submit, and failure. One black doing four jobs. See **The One Black Rule**.
- **Ink Muted (`#645D4E`)** — captions, metadata, secondary lines, and the quiet states.
  This is a **deliberate darkening of the rendered direction's `ink-3 #837A69`**, which
  measures 3.63:1 on paper and fails the 4.5:1 body floor. The original value survives in
  the system only as a non-text mark colour; it is not a text token.
- **Machine Blue (`#1B3FA0`)** — **all** machine-generated data, always in mono: the clone
  path, the pjid, the Board identifier, correlation identifiers, command strings, the
  dispatch acknowledgement. This is the third text role EXPERIENCE.md demands, and it is a
  role rather than a shade: on a printed instrument the operator's text is black and the
  machine's stamp is blue. A developer never has to ask whether a string is machine data —
  if it is blue and monospaced, it came from a machine, and it is complete and selectable.

### The spot

- **Spot (`#FF2E63`)** — the signature. Clip band, spine, active-pane marker, the operator's
  own turn edge, the `[v2]` in-page outline and pin. It measures 3.09:1 on paper, which
  clears the 3:1 non-text floor and fails the 4.5:1 text floor, exactly as the direction
  claimed. **It fills, it rules, it outlines; it never sets small type on paper.**
- **Spot Deep (`#C2003F`)** — the only spot permitted to set type on paper, at 5.35:1.
  Reserved for `[v2]`'s attachment chip label and nothing else in v1.
- **Spot Wash (`#FFE4EC`)** — spot at fill strength. Fills only. Ink on it measures 14.97:1.

### Named rules

**The One Black Rule.** `{colors.text.primary}`, `{colors.state.failed}` and
`{colors.action.primary}` are all `#191713`, and that is not an oversight to be tidied away.
The sheet has one black ink and it does three jobs — it sets type, it stamps, and it fails.
What distinguishes them is never hue: a failure is an inverted band with a `■` and a
sentence; a submit is a 32px control with a verb in it; body type is neither. If a future
token needs a fourth black, the answer is a fourth *form*, not a fourth value.

**The Spot Is Identity Rule.** The spot hue never states a status. Not ok, not degraded, not
failed, not a count, not a severity, not a priority. It says *this is Sidepiece* and *this
is the thing you armed*. The consequence is deliberate and load-bearing: **there is no red
available for errors**, which is why failure is stamped in black instead — and a stamped
black band is louder on warm paper than any red would be.

**The OK Is Grey Rule.** Harvested verbatim from direction 03 and kept. `{colors.state.ok}`
is `#645D4E`, the same value as `{colors.text.muted}` — a healthy Bridge is exactly as loud
as a caption, which is to say barely. **Nothing in Sidepiece is ever green.** The colour
green does not exist in this system.

**The Glyph Law.** No state renders without its glyph, ever, and no glyph is decorative.
`{colors.state.ok}` and `{colors.state.unknown}` share one ink value on purpose: in this
register hue is not asked to carry status, so two states that are semantically adjacent are
allowed to be chromatically identical. What separates `─ Reachable` from `○ Not yet known`
is the mark and the word. This also means the panel is legible to a colourblind operator and
legible in a screenshot pasted into a terminal, which is where half of Sidepiece's output
ends up.

### The state set

Five values, five glyphs, five weights. Every state ships all three.

| Token | Value | Glyph | Weight | On paper | On raised | On sunk | Reading |
|---|---|---|---|---|---|---|---|
| `{colors.state.ok}` | `#645D4E` | `─` U+2500 | 400 | **5.59:1** ✓ | **6.15:1** ✓ | **4.97:1** ✓ | A ruled line. Nothing to report. |
| `{colors.state.pending}` | `#4C463A` | `»` U+00BB | 500 | **8.02:1** ✓ | **8.82:1** ✓ | **7.13:1** ✓ | Ink still wet. In flight. |
| `{colors.state.degraded}` | `#8A5A0B` | `▲` U+25B2 | 500 | **5.07:1** ✓ | **5.58:1** ✓ | **4.51:1** ✓ | Archival ochre. A fact, not a fault. |
| `{colors.state.failed}` | `#191713` | `■` U+25A0 | 600 | **15.34:1** ✓ | **16.87:1** ✓ | **13.64:1** ✓ | Stamped and inverted. |
| `{colors.state.unknown}` | `#645D4E` | `○` U+25CB | 400 | **5.59:1** ✓ | **6.15:1** ✓ | **4.97:1** ✓ | A hollow mark. Nothing in it yet. |

Every state value clears 4.5:1 on all three paper grounds, so a state word is legible
wherever a state can appear. Glyph shapes were picked for distinct silhouettes at 10.5px —
a line, a double angle, a filled triangle, a filled square, a hollow circle — and all five
sit in Latin-1 or the Geometric Shapes block, which every fallback in the mono stack covers.

**Ochre is the single hue admitted to the state set**, and it earns the exception: the
`{components.degradedConnectionIndicator}` sits in the header for as long as the tailnet is
on a DERP relay, which can be hours. It has to be noticeable without reading as a fault, and
an ink weight cannot do "persistent but not broken." Ochre on warm paper is a pencil note in
the margin, which is precisely the meaning.

### Measured contrast — every pair this document specifies

Body text floor 4.5:1, non-text and large-text floor 3:1. Failures are reported, not
substituted.

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
| `#C9BDA6` | `surface.stamp` `#191713` | **9.64:1** | ✓ | ✓ | cid on a band |
| `text.onSpot` `#191713` | `action.mark` `#FF2E63` | **4.96:1** | ✓ | ✓ | clip mark, pin digit |
| `action.markDeep` `#C2003F` | `surface.panel` `#F2EDE3` | **5.35:1** | ✓ | ✓ | `[v2]` chip label |
| `action.markDeep` `#C2003F` | `surface.spotWash` `#FFE4EC` | **5.22:1** | ✓ | ✓ | `[v2]` chip |
| `action.mark` `#FF2E63` | `surface.panel` `#F2EDE3` | **3.09:1** | ✗ **FAIL** | ✓ | spine, rules, fills — **never type** |
| `action.mark` `#FF2E63` | `surface.stamp` `#191713` | **4.96:1** | ✓ | ✓ | spot on a failed clip |
| `focus.ring` `#191713` | `surface.panel` `#F2EDE3` | **15.34:1** | — | ✓ | focus, light grounds |
| `focus.ringInner` `#F2EDE3` | `surface.stamp` `#191713` | **15.34:1** | — | ✓ | focus, on the submit |
| `focus.ringInner` `#F2EDE3` | `action.mark` `#FF2E63` | **3.09:1** | — | ✓ | focus, on a spot mark |
| `border.strong` `#191713` | `surface.panel` `#F2EDE3` | **15.34:1** | — | ✓ | the pinned/scroll seam |
| `border.hairline` `#CFC3AB` | `surface.panel` `#F2EDE3` | **1.49:1** | — | ✗ **FAIL** | decorative rule — see note |
| `border.faint` `#E0D7C4` | `surface.panel` `#F2EDE3` | **1.23:1** | — | ✗ **FAIL** | row separator — see note |
| `border.sheet` `#C9BDA6` | `surface.panel` `#F2EDE3` | **1.59:1** | — | ✗ **FAIL** | sheet edge — see note |
| `surface.raised` `#FBF8F1` | `surface.panel` `#F2EDE3` | **1.10:1** | — | ✗ **FAIL** | tonal layer — see note |
| `surface.sunken` `#E8E0D0` | `surface.panel` `#F2EDE3` | **1.12:1** | — | ✗ **FAIL** | tonal layer — see note |
| `surface.panel` `#F2EDE3` | white page `#FFFFFF` | **1.17:1** | — | ✗ **FAIL** | the sheet on a light page |
| `surface.panel` `#F2EDE3` | dark page `#0E1116` | **16.21:1** | — | ✓ | the sheet on a dark page |
| `overlay.outline` `#FF2E63` | white page `#FFFFFF` | **3.61:1** | — | ✓ | `[v2]` outline |
| `overlay.outline` `#FF2E63` | dark page `#0E1116` | **5.24:1** | — | ✓ | `[v2]` outline |
| `overlay.outline` `#FF2E63` | mid-grey page `#808080` | **1.10:1** | — | ✗ **FAIL** | **the hole — see below** |
| tri-tone keyline | **worst sRGB ground** | **≥4.23:1** | — | ✓ | `[v2]`, guaranteed |

**Five of those failures are accepted and one is fixed.**

- **The four sub-3:1 rules and the two tonal steps are accepted.** WCAG 1.4.11 governs UI
  components and graphical objects *required to understand the content*. A printed rule and a
  tonal step are not: every boundary that carries meaning is drawn in
  `{colors.border.strong}` at 15.34:1 — the pinned/scrolling seam, the group header, the
  stamped band. The hairlines are what a printed rule looks like, and making them clear 3:1
  would turn the sheet into a wireframe. **The audit test: remove every hairline from a
  screen; if a region becomes ambiguous, that region was leaning on a hairline and needs a
  `strong` rule instead.**
- **`{colors.action.mark}` at 3.09:1 on paper is accepted and scoped.** It fails body text and
  it is never used for body text. The direction stated this as law 2 before it was measured
  and the measurement confirms it.
- **The mid-grey hole is a real defect and is fixed.** The spot alone collapses to **1.10:1
  against `#808080`** — on a mid-grey page the in-page outline is invisible, which breaks the
  one claim the whole direction rests on. The fix is a **tri-tone keyline**: the spot stroke
  is drawn between a `{colors.overlay.keylineDark}` `#191713` outer hairline and a
  `{colors.overlay.keylineLight}` `#FFFFFF` inner hairline. Swept across the greyscale ramp
  and a coarse sRGB sample, the best of those three tones never drops below **4.23:1 against
  any background** (worst cases `#7B7B7B` and `#AA6688`). One of the three always carries the
  mark. This is a registration keyline, which is the most in-register fix available.

### One correction to the rendered direction, stated plainly

The mock sets `SIDEPIECE`, `MARK 2` and the active flip half in **white on the spot**, which
measures **3.61:1 — below the 4.5:1 text floor**. Text on the spot ground is therefore **ink
`#191713` at 4.96:1**, not white. This is not a compromise: black on fluorescent stock is
exactly how fluorescent paper is printed, and it reads harder than the white did.

---

## Typography

**Human voice:** Charis SIL — a hinted, screen-drawn, OFL descendant of Bitstream Charter.
**Machine voice:** IBM Plex Mono.
**There is no sans-serif in the Cockpit.**

Charter is the load-bearing choice, not a flourish. It and Georgia are among the very few
serifs engineered for small sizes and low-resolution screens, and that is the only reason
13.5px body type survives a 300px column. Substituting a display serif here collapses the
whole layout.

### MV3 forbids fetching a font, so both faces ship in the bundle

- **`fonts/CharisSIL-Regular.woff2` and `-Bold.woff2`** (SIL OFL 1.1), declared
  `@font-face { font-family: "Charis SIL"; src: local("Charis SIL"), url("fonts/CharisSIL-Regular.woff2") format("woff2"); font-display: block; }`. Inside an extension page a relative
  URL already resolves to `chrome-extension://<id>/…`; no remote fetch, no CSP exception.
- **`fonts/IBMPlexMono-Regular.woff2`, `-Medium.woff2`, `-SemiBold.woff2`** (SIL OFL 1.1),
  same shape.
- **`font-display: block`, not `swap`.** A swap reflows the identity header and the clone
  path one beat after the panel opens, and the Cockpit's whole premise is dip-in-dip-out. A
  block period on a local-origin font is imperceptible.
- **The `[v2]` in-page layer needs one extra step.** `@font-face` rules declared inside a
  shadow root are ignored by spec, so the content script must register the faces on the host
  document with the `FontFace` API and `chrome.runtime.getURL()`. That requires the woff2
  files in `web_accessible_resources` with **`"use_dynamic_url": false`** — a dynamic URL
  changes per page load and defeats the font cache.

### What a cold install sees, verified on this machine today

| Named family | `fc-match` resolves to | Usable in Chrome? |
|---|---|---|
| `Charter` | Noto Sans | **No** — no such family here |
| `Bitstream Charter` | Bitstream Charter | **Only as a legacy Type 1 `.pfb`** from the X11 package — no woff2, no screen hinting, and Chrome's Type 1 support is not something to bet a type system on |
| `Charis SIL` | Noto Sans | **No** — not installed; this is why it is bundled |
| `Source Serif 4` | Noto Sans | No |
| `Iowan Old Style` | Noto Sans | No (macOS only) |
| `Georgia` | **Noto Serif** | Yes, via fontconfig alias |
| `IBM Plex Mono` | Noto Sans | **No** — not installed; this is why it is bundled |
| `Cascadia Mono` | Cascadia Mono | **Yes** — installed |
| `Cascadia Code` | Cascadia Code | Installed, and **banned from the stack** — its programming ligatures rewrite `->` and `=>` inside a clone path or a correlation id |

**So: without the bundle, this machine renders the Cockpit in Noto Serif and Cascadia Mono.**
Noto Serif's x-height is roughly 10% larger than Charter's and its advances are wider, so the
measured 300px fits do not hold — the clone path loses its single line and the identity
header runs long. That is the concrete cost of not bundling, and it is why the bundle is
mandatory rather than an optimisation.

### Degrading without metric collapse

Both stacks carry `font-size-adjust`, which normalises any fallback's x-height to the
intended face:

- Serif: `font-size-adjust: 0.481` (Charis SIL's x-height ratio). Noto Serif at 0.536 and
  DejaVu Serif at 0.519 both come back into register instead of blowing the leading.
- Mono: `font-size-adjust: 0.516` (IBM Plex Mono). Cascadia Mono at ~0.53 lands within a
  hair.
- **Advance width is already safe**: IBM Plex Mono and Cascadia Mono are both 0.6em, so every
  monospace column measurement in **Layout & Spacing** holds on the fallback too.

### The ramp

| Role | Family | Size | Weight | Leading | Tracking | Purpose |
|---|---|---|---|---|---|---|
| `{typography.heading}` | Charis SIL | 22px | 700 | 1.05 | −0.015em | The repo name in the identity header. One per Cockpit. |
| `{typography.body}` | Charis SIL | 13.5px | 400 | 1.55 | normal | Turn text, notice sentences, ticket titles, bubble text. The default voice. |
| `{typography.label}` | IBM Plex Mono | 11.5px | 500 | 1.35 | 0.08em | **Anything variable**: control text, classification values, group names, counts, state words. |
| `{typography.micro}` | IBM Plex Mono | 10.5px | 600 | 1.3 | 0.18em | **Static chrome only**, uppercase: section rules, band words, stamp chips, the clip mark. |
| `{typography.mono}` | IBM Plex Mono | 11.5px | 400 | 1.45 | 0.01em | Machine data, `tabular-nums`, always `{colors.text.machine}`. |

### Named rules

**The Two Voices Rule.** Serif for people, mono for machines, and never mixed inside a single
value. A repo name is serif. A clone path is mono. A sentence that contains a path sets the
sentence in serif and the path in mono, and the path stays complete.

**The 10.5 Floor Rule.** Harvested from direction 03 and enforced here.
*10.5px is the floor for static chrome at ≥4.5:1; 11.5px is the floor for anything variable.*
Density comes from leading, not from shrinking type. **The rendered direction violated this
at 8.5px and this document overrides it**, which cost one layout (see below) and bought back
the PRD's literal strings.

**The Complete String Rule.** Machine data is never elided, never truncated, never given a
tooltip in place of itself. It wraps. An ellipsised path looks copyable and copies wrong.

---

## Layout & Spacing

### The column is 300px, and that is the only number that matters

```
340px  Chrome side panel at Sidepiece's design width (floor is 320, unreadable)
 −2px  sheet border, 1px each side
−10px  the perforated spot spine
−28px  gutter, {spacing.gutter} × 2
─────
300px  usable column
```

**The extension can neither read, set nor suggest the width**, so there are no breakpoints in
this product and none can be observed. Every measurement below is written to hold at 300px
and to degrade upward — extra width buys longer unwrapped paths and more visible Turn text,
never a second column.

The 12px the spine and border take is the cost of the signature, paid on every surface. It is
the strongest argument against this direction and it is accepted knowingly.

### Scale

| Token | Value | Use |
|---|---|---|
| `{spacing.hair}` | 4px | Glyph-to-word, chip internals |
| `{spacing.tight}` | 6px | Between a label and the thing it labels |
| `{spacing.inset}` | 9px | Inside any bordered box |
| `{spacing.gutter}` | 14px | **The only horizontal inset in the column.** Never overridden |
| `{spacing.stack}` | 15px | Between sibling blocks in the scroll region |
| `{spacing.row}` | 32px | Minimum list-row height, ticket and annotation |
| `{spacing.section}` | 24px | Above a section rule |

### Verified fits at the shipped type ramp

IBM Plex Mono and Cascadia Mono both advance 0.6em, so a monospace character is 6.9px at
11.5px and 6.3px at 10.5px.

| Element | Measurement | Verdict |
|---|---|---|
| Clone path, `/home/delorenj/code/sidepiece` | 29 ch × 6.9px = 200px in a 284px well | **Fits, one line** |
| Clone path, longest before wrap | **41 characters** at 11.5px mono | Longer paths wrap; they never truncate |
| Classification control, `DISPATCHED COMMAND` | 18 ch × 7.82px = 141px in a 298px row | **Fits — the PRD literal survives** |
| Ticket key column | 76px = 11 mono characters | Fits `SIDE-12`, `HOLOCENE-12` |
| Ticket title column | 300 − 10 glyph − 8 − 76 − 8 = **198px** | ≈30 serif characters per line; two-line wrap is the norm and is correct |
| Identity header repo name | 22px serif, ≈0.5em average advance | Fits to **27 characters** before wrapping |
| Clip band | `SIDEPIECE` 79px + `BRIDGE UP · LAN` 117px + 17px padding = 213px of 338px | **Fits** |
| Ticket row, two-line title | 36px of text + 16px padding = 52px | Clears the 32px `{spacing.row}` floor |

### What the raised type floor cost

Raising chrome type from the mock's 8.5px to 10.5/11.5px has three consequences, stated
honestly:

1. **The side-by-side classification flip does not fit and is replaced.** Two halves each
   holding a full glossary term in one 300px row is impossible at 11.5px. The control becomes
   **two full-width stacked rows**, one per value, 30px each. It costs ~30px of vertical and
   it **buys back the PRD's literal string**: the mock had to abbreviate `Dispatched Command`
   to `DISPATCHED CMD`, and at the shipped ramp it does not.
2. **The FR-10 context URL no longer fits on one line.** `https://plane.delo.sh/33god/projects/side/issues` is 47 characters = 324px against 282px of well. It wraps to two lines.
   EXPERIENCE.md renders the URL on focus or hover inside `{components.contextChip}`, so two
   lines in a revealed state is acceptable — but it is a real loss against the mock's
   single-line claim and it is recorded as one.
3. **The clip band is now 21px → 24px tall** to carry 10.5px type with its leading.

### Rhythm

- **One scroll region on screen**: the body. Header and action bar are pinned. Nested scroll
  regions in a 300px column are a trap-the-wheel bug.
- **Group headers are `position: sticky`** inside the Tickets pane, on
  `{colors.surface.panel}` with a `{colors.border.strong}` bottom rule, so the state a row
  belongs to is never off screen and its glyph never has to be remembered.
- **Vertical rhythm is 3px-quantised**, which falls out of 13.5px × 1.55 ≈ 21px line boxes.
- **Nothing is centred.** A proof sheet is left-ruled. Every label, every value, every row
  starts at the gutter.

---

## Elevation & Depth

**The system has exactly two shadows and both are literal.** There is no ambient shadow, no
hover lift, no elevation ramp, and no z-index vocabulary beyond "the sheet is on top."

### Shadow vocabulary

| Name | Value | Where |
|---|---|---|
| **Sheet offset** | `3px 3px 0 rgba(25, 23, 19, 0.26)` | Every Sidepiece sheet: the Cockpit, the hover tooltip, the comment bubble. Zero blur. |
| **Sheet offset, dark ground** | `3px 3px 0 rgba(0, 0, 0, 0.45)` | The same offset when the sheet is over a dark page, and under `prefers-color-scheme: dark`. |
| **Panel cast** | `-10px 0 28px rgba(0, 0, 0, 0.30)` | The Cockpit's left edge only — the shadow the sheet casts onto the page it abuts. Never on an in-page sheet. |
| **Pin halo** | `0 0 0 2px rgba(255, 46, 99, 0.28)` | `[v2]` annotation pin. A registration halo, not a shadow. |
| **Focus keyline** | `0 0 0 1px {colors.focus.ringInner}, 0 0 0 3px {colors.focus.ring}` | Every interactive element. See **Shapes**. |

### Named rules

**The No-Blur Rule.** The offset shadow has **zero blur radius**. A blurred shadow is
atmosphere and this house bans it. An unblurred offset is a second sheet of paper, and it is
the only thing separating the Cockpit from a white page at 1.17:1. If someone adds a blur,
they have turned semantics back into decoration and the rule is broken.

**The Nothing Lifts Rule.** No element gains a shadow on hover, focus, press or selection. A
shadow states a permanent physical fact — *this object is laid on top of that one* — and a
fact that changes on mouseover is not a fact. Interaction is expressed by ink weight, by the
spot mark, and by the focus keyline. Never by depth.

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

`{rounded.pill}` is `9999px` and has **exactly one consumer in the whole system**: the `[v2]`
`{components.annotationPin}`, a numbered roundel drawn on somebody else's page, and its `[v2]`
sibling `{components.iconBadge}`. **Nothing inside the Cockpit is ever a pill.** This is a
deliberate departure from EXPERIENCE.md's note that "pill is reserved for state markers so a
state is never shaped like a control" — here state markers are **unshaped glyphs**, which
satisfies that intent more strongly than a pill would, because they are not shaped like
anything. Flagged in **Gaps** for the spine's revision.

### The three signatures

These three marks are what make a Sidepiece surface recognisable, and they are drawn
identically on the Cockpit, the hover tooltip, the comment bubble and the `[v2]` freehand
commit sheet. **A Sidepiece surface without all three is not a Sidepiece surface.**

1. **The spine.** A solid `{colors.action.mark}` bar on the left edge, running the full height
   below the clip band, perforated by
   `repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0 7px, rgba(255,255,255,.62) 7px 9px)`.
   **10px** on the Cockpit, **7px** on in-page sheets with a 6px/8px perforation. The
   perforation is what stops it reading as a generic accent bar.
2. **Crop marks.** Four corner registration marks, inset −5px, **9 × 9px at 1px
   `{colors.text.primary}`** on the Cockpit. On the `[v2]` in-page layer they are **10 × 10px
   at 2px `{colors.overlay.outline}`** with the tri-tone keyline, because they must survive an
   unknown ground.
3. **The unblurred offset shadow**, specified in **Elevation & Depth**.

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

### Line weights

| Weight | Where |
|---|---|
| 1px `{colors.border.faint}` | Row separators inside a list |
| 1px `{colors.border.hairline}` | Box edges, section rules, dashed internal dividers |
| 1px `{colors.border.sheet}` | The outer edge of any Sidepiece sheet |
| 1px `{colors.border.strong}` | The pinned/scrolling seam, group headers, stamped-band outlines |
| 2px `{colors.action.mark}` | The operator's own turn edge; `[v2]` outline stroke |
| 3px `{colors.overlay.outline}` | `[v2]` freehand stroke |

---

## Components

Visual specification only. Behavior, copy, state machines and when each appears belong to
EXPERIENCE.md and are not restated. Per the house schema, component token sets are capped at
**8 props** and **exclude shadows, motion and focus rings** — those are system-level and live
in **Elevation & Depth** and `{colors.focus.ring}`.

The seven `[v2]` components render into arbitrary third-party pages through a closed shadow
root, so each one states how it holds up over an unknown background.

### v1 — the Cockpit

**`{components.identityHeader}`** — Pinned top on `{colors.surface.raised}`, closed by a 1px
`{colors.border.strong}` seam. Repo name in `{typography.heading}` at `{colors.text.primary}`.
Clone path directly beneath in a `{colors.surface.sunken}` well with a 2px
`{colors.border.hairline}` left edge, set in `{typography.mono}` at `{colors.text.machine}`,
wrapping and `user-select: all`. Board identifier as a `{colors.surface.stamp}` chip, paper
text, `{typography.micro}`. Health marker and degraded indicator sit on the meta row at
`{spacing.tight}` intervals. **No overflow, no kebab, no menu** — there is nothing to put in
one and the header must never imply there is.

**`{components.copyControl}`** — 32px transparent control, 1px `{colors.border.hairline}`,
`{typography.micro}` at `{colors.text.muted}`. Sits inline at the end of any machine string.
Confirms by swapping its own label for one beat; it never draws a toast, a tick or a colour
change.

**`{components.degradedConnectionIndicator}`** — `▲` plus one word in
`{typography.micro}` at `{colors.state.degraded}`, on the header meta row. **No box, no fill,
no border** — it is a pencil note in the margin, not a badge, because it is a fact and not a
fault.

**`{components.paneSwitch}`** — A single 32px strip on the header's bottom edge, ruled top and
bottom in `{colors.border.strong}`, divided into equal cells by 1px `{colors.border.hairline}`.
Cell label in `{typography.label}`, uppercase. **The selected cell carries a 2px
`{colors.action.mark}` underline inside the cell and steps its label to
`{colors.text.primary}`**; unselected cells sit at `{colors.text.muted}`. Each cell carries its
own state glyph at its leading edge, so a pane that is failing says so while hidden. The
reserved `[v2]` third slot renders as an empty ruled cell, not as a gap.

**`{components.healthMarker}`** — One 12px glyph plus its word, `{typography.label}`, coloured
by the matching `{colors.state.*}`. No ring, no dot, no fill. The glyph *is* the marker.

**`{components.stateNotice}`** — A bordered block on `{colors.surface.raised}`, 1px
`{colors.border.strong}`, `{spacing.inset}` padding. Anatomy top to bottom: a
`{colors.surface.stamp}` band carrying the state glyph and one `{typography.micro}` word in
`{colors.text.inverse}`; the headline sentence in `{typography.body}` at
`{colors.text.primary}`; an optional detail line at `{colors.text.muted}`; an optional
`{components.commandString}`; then the control row. The band is the whole distinction between
a notice and a paragraph — **a state notice is stamped, not tinted.**

**`{components.reResolveControl}`** — 32px, `{colors.action.primary}` ground,
`{colors.text.inverse}` label in `{typography.label}`, square. The primary control of any
notice. Its demoted form, where the spine calls for one, is a transparent ground with a 1px
`{colors.border.hairline}` and a `{colors.text.muted}` label at the same height. Its disabled
form drops the label to `{colors.text.muted}` on `{colors.surface.sunken}` and keeps the 32px.

**`{components.turnComposer}`** — Bottom-anchored on `{colors.surface.raised}`, boxed in 1px
`{colors.border.hairline}`. Stacked: context chip, classification control, then the text field
at `{typography.body}` on `{colors.surface.raised}` with a 1px `{colors.border.faint}` top
rule, then the action row. Placeholder text is `{colors.text.muted}` **italic** — the serif
italic is the resting-state signal, and it is the only italic in the Cockpit besides the
operator's own turn. Grows upward to a cap, then scrolls internally.

**`{components.classificationControl}`** — **Two full-width stacked 30px rows**, boxed in 1px
`{colors.border.strong}`, divided by a 1px internal rule. Each row carries its glossary term
verbatim in `{typography.label}`, uppercase. **The active row fills with
`{colors.action.mark}` and sets its label in `{colors.text.onSpot}` ink at 4.96:1** — never
white. The inactive row is transparent with a `{colors.text.muted}` label. This is the only
place in v1 where the spot fills a control, and it qualifies under the direction's law as an
armed/active mark rather than a status.

**`{components.contextChip}`** — A `{colors.surface.sunken}` block with a dashed 1px
`{colors.border.hairline}` bottom rule, sitting at the top of the composer. Its kicker is
`{typography.micro}` at `{colors.text.muted}`; the page title is `{typography.body}` at 11.5px
in `{colors.text.primary}`; the URL, when revealed, is `{typography.mono}` at
`{colors.text.machine}`, wrapping to two lines, never elided.

**`{components.turnCard}`** — Two visibly distinct variants, and the distinction is
**printed vs stamped**:

- *The operator's turn* — a 2px `{colors.action.mark}` left rule, 9px inset, serif **italic**
  at `{colors.text.primary}`. It is the only spot-marked content in the scroll region.
- *Streamed Exchange* — a `{typography.micro}` kicker at `{colors.text.muted}`, then the reply
  in `{typography.body}` at `{colors.text.primary}`. No box, no ground, no border. It is
  printed directly onto the sheet.
- *Dispatched Command* — a bordered block, 1px `{colors.border.strong}`, opening with a
  `{colors.surface.stamp}` band carrying the state word in `{typography.micro}`
  `{colors.text.inverse}` and the correlation id right-aligned in `#C9BDA6` at 9.64:1. Inner
  body on `{colors.surface.raised}`; the acknowledgement in `{typography.mono}` at
  `{colors.text.machine}`; the outcome as a bordered `{typography.micro}` stamp chip; the
  result separated by a **dashed** `{colors.border.hairline}` rule. Turns are separated from
  each other by a 1px `{colors.border.faint}` rule at `{spacing.stack}`.

**`{components.jumpToLatest}`** — A 28px `{colors.action.primary}` control, paper label in
`{typography.label}`, floating bottom-right above the action bar with a
`{colors.surface.panel}` 1px keyline so it reads as a separate slip of paper over the scroll.
No shadow — it is inside the sheet, not on top of it.

**`{components.ticketGroupHeader}`** — Sticky to the top of the Tickets region on
`{colors.surface.panel}` (opaque, so rows do not ghost through), 30px, closed by a 1px
`{colors.border.strong}` bottom rule. State glyph, then the state name in `{typography.label}`
uppercase at `{colors.text.primary}`, then the count right-aligned in `{typography.label}` at
`{colors.text.muted}`. A zero count renders; the group never disappears.

**`{components.ticketRow}`** — `{spacing.row}` minimum, `8px 0` padding, separated by 1px
`{colors.border.faint}`. Three columns: a 10px state glyph at its `{colors.state.*}` value; a
**76px** key column in `{typography.mono}` at `{colors.text.machine}`; the title filling the
remaining 198px in `{typography.body}` at `{colors.text.primary}`, wrapping to two lines.
Hover raises the row ground to `{colors.surface.raised}` — a tonal step, never a shadow. A
missing field renders as an ink em-dash at `{colors.text.muted}`, never as blank space.

**`{components.ticketCreateBox}`** — Opens with a `{typography.micro}` kicker at
`{colors.text.muted}` above a 1px `{colors.border.strong}` top rule. The title field is a
**ruled blank**: no box, no ground, just a 1px `{colors.border.strong}` baseline with serif
italic placeholder at `{colors.text.muted}` — a form to be filled in by hand. The submit row
is three cells at 32px: an empty leading slot, `{colors.action.primary}` primary submit with
its target Board named in `{typography.label}`, and an empty secondary slot. **The two empty
slots render as ruled space, not as gaps**, so the `[v2]` seats are visibly reserved.

**`{components.refetchControl}`** — 28px, transparent, 1px `{colors.border.strong}`,
`{typography.label}` at `{colors.text.primary}`. Deliberately quieter than the primary
submit — it reads as a secondary stamp.

**`{components.commandString}`** — A `{colors.surface.sunken}` block with a 2px
`{colors.border.hairline}` left edge, `5px 7px` padding, `{typography.mono}` at
`{colors.text.machine}`, `user-select: all`, `word-break: break-all`, never elided. Carries a
`{components.copyControl}` and one empty `[v2]` action slot at its trailing edge.

### `[v2]` — the in-page layer

All seven render into a closed shadow root over an unknown page. Common requirements: every
sheet declares `color-scheme: light` and an explicit opaque `background`, sets
`isolation: isolate` and `filter: none` so no ancestor page filter tints it, and is drawn at
`z-index: 2147483647` inside a `position: fixed` root. Every stroke drawn *on* the page rather
than inside a sheet uses the **tri-tone keyline**.

**`{components.hoverOutline}` `[v2]`** — A 2px `{colors.overlay.outline}` box with a
`{colors.overlay.scrim}` fill, plus 10 × 10px corner ticks at the same weight. **Tri-tone
keyline mandatory**: a 1px `{colors.overlay.keylineDark}` outside the stroke and a 1px
`{colors.overlay.keylineLight}` inside it, guaranteeing ≥4.23:1 against any sRGB ground where
the spot alone falls to 1.10:1. Its resolved-selector tooltip is a full Sidepiece sheet —
paper ground, 7px spine, crop marks, offset shadow — with the selector in `{typography.mono}`
at `{colors.text.primary}` and the dimensions beneath at `{colors.text.muted}`.

**`{components.commentBubble}` `[v2]`** — A 280px Sidepiece sheet on
`{colors.surface.overlay}`, 1px `{colors.border.sheet}`, 7px spine, crop marks, `3px 3px 0`
offset at the dark-ground opacity. Header row: the anchor in `{typography.mono}` at
`{colors.text.machine}`, and the mark number as a `{colors.action.mark}` chip with
`{colors.text.onSpot}` ink. Body in `{typography.body}`. Footer above a dashed rule: count at
`{colors.text.muted}`, and a `{colors.surface.stamp}` commit control at 32px. Because it is a
fully opaque sheet, its interior contrast is identical to the Cockpit's on any page.

**`{components.freehandLayer}` `[v2]`** — A transparent full-viewport drawing surface. Strokes
are **3px `{colors.overlay.outline}` with a 5px `{colors.overlay.keylineDark}` under-stroke and
a 1px `{colors.overlay.keylineLight}` over-stroke**, round cap and round join — three tones on
every stroke, which is the same guarantee as the hover outline applied to freehand geometry.
Strokes never change colour, thickness or opacity by tool, age or pressure; the layer has one
mark. The active bounding box of committed strokes is drawn as a 1px dashed
`{colors.overlay.outline}` rectangle, and the commit affordance is a Sidepiece sheet pinned to
the viewport corner, not an in-canvas widget.

**`{components.annotationPin}` `[v2]`** — An 18px `{rounded.pill}` roundel: `{colors.action.mark}`
fill, `{colors.text.onSpot}` ink digit in `{typography.label}` at 4.96:1, a 1.5px
`{colors.overlay.keylineLight}` ring and the `0 0 0 2px rgba(255,46,99,0.28)` halo outside it.
**This is the only curved shape in the entire system**, and the curve is the point: it is a
mark made *on* the page, not a piece of Sidepiece chrome, and every piece of Sidepiece chrome
is square. Its leader to an open bubble is a 1.5px `{colors.overlay.outline}` line with the
same dark under-stroke.

**`{components.annotationRow}` `[v2]`** — Inside the Cockpit, so it is ordinary paper:
`{spacing.row}` minimum, 1px `{colors.border.faint}` separator, a leading pin number as a
small square `{colors.action.mark}` chip with ink text, the annotation text in
`{typography.body}`, and the capture time in `{typography.label}` at `{colors.text.muted}`.
A lost anchor marks the row with `{colors.state.unknown}`'s `○` glyph at the leading edge; the
row is never dimmed, because a dim row reads as disabled and this one is still dischargeable.

**`{components.dischargeControl}` `[v2]`** — The one-button finale. 32px,
`{colors.action.primary}` ground, `{colors.text.inverse}` label in `{typography.label}`, full
width of the action bar. **It is the largest stamp in the product and it is the only control
that is ever full-width** — the finale of a batch is the one moment the instrument commits
everything at once, and its width is how that reads.

**`{components.attachmentChip}` `[v2]`** — 24px, `{colors.surface.spotWash}` fill, 1px
`{colors.action.markDeep}` border, label in `{typography.label}` at `{colors.action.markDeep}`
(5.22:1 on the wash). **The only place `markDeep` sets type in the system**, and the only
place the spot family appears as a fill inside the Cockpit body — which is correct, because an
attachment is a piece of the in-page layer riding into a Turn.

**`{components.iconBadge}` `[v2]`** — A 16px `{rounded.pill}` roundel on the browser action
icon: `{colors.action.mark}` fill, `{colors.text.onSpot}` ink count in `{typography.micro}`.
It must read at 16px against Chrome's own toolbar in both browser themes, which is exactly the
job the spot is best at and the job no ink could do.

---

## Do's and Don'ts

### Do

- **Do spend the spot on identity and armed marks only** — the spine, the clip band, the
  active classification row, the operator's own turn edge, the `[v2]` outline and pin. On a
  screen at rest the only spot pixels are the spine and the clip.
- **Do pair every state with its glyph and its word.** `─ » ▲ ■ ○`. No exceptions, including
  in a tooltip, including in a one-line row, including when space is tight.
- **Do set machine data in `{typography.mono}` at `{colors.text.machine}`, complete and
  selectable.** A path, a pjid, a Board id, a correlation id and a command are blue, they
  wrap, and they are `user-select: all`.
- **Do draw every meaningful boundary in `{colors.border.strong}`.** Hairlines are texture;
  a seam the operator must see is ink.
- **Do keep 10.5px as the floor for static chrome and 11.5px for anything variable**, and buy
  density back with leading.
- **Do put all three signatures on every Sidepiece surface** — spine, crop marks, unblurred
  offset. A tooltip without them is indistinguishable from the page's own tooltip and the
  whole direction has failed at that point.
- **Do use the tri-tone keyline on anything drawn on a page.** The spot alone is 1.10:1 on
  mid-grey and that is not a hypothetical page colour.
- **Do set text on the spot ground in ink `#191713`** (4.96:1), never white (3.61:1).
- **Do let text wrap.** Ticket titles wrap to two lines, paths wrap, URLs wrap. Truncation is
  how SIDE-12 becomes indistinguishable from SIDE-15.

### Don't

- **Don't put a corner radius on anything but the `[v2]` pin and icon badge.** No cards, no
  rounded buttons, no rounded inputs, no rounded chips.
- **Don't blur a shadow, and don't add a third one.** The offset says "laid on top of." A
  blur says "generic web UI," and this house bans drop shadows for exactly that reason.
- **Don't let anything lift, glow, scale or elevate on hover.** Hover is a tonal step at most.
- **Don't use green. Ever.** There is no green in this system, no success fill, no green tick.
  OK is grey and it is supposed to be boring.
- **Don't colour a status with the spot**, and don't invent a red for errors. Failure is a
  stamped black band.
- **Don't use Inter** — *"the default safe font. Zero character. Banned."* (Jarad,
  `Dompacolypse/site/DESIGN.md`.) Don't use any sans-serif in the Cockpit at all. The one
  sans in this design system is whatever the third-party page brought with it, and the point
  is to not look like it.
- **Don't reach for the cyan/violet neon signature** — *"`#00f0ff` cyan + `#8b5cf6` violet…
  the single most recognizable 'an AI made this' signature."* The spot is `#FF2E63` and it is
  the only chromatic hue with an identity job.
- **Don't make everything a glass card.** *"When every element floats with the same blur +
  shadow, elevation stops meaning anything."* There are two shadows here and both mean one
  specific thing.
- **Don't let a rung hue onto chrome.** A `{colors.state.*}` value never colours a control, a
  filter, a caption, an explainer, a section rule or a border. It colours a glyph, a state
  word, or a stamped band, and nothing else.
- **Don't fetch a font.** MV3 forbids it and the bundle is not optional. No Google Fonts link,
  no CDN, no `@import`.
- **Don't name Cascadia Code in a mono stack** — its ligatures rewrite `->` inside a path.
  Cascadia **Mono** is the correct fallback.
- **Don't add a second accent, a gradient, a texture image, or a paper-grain overlay.** The
  paper is a flat hex value. A literal paper texture is where this direction stops being a
  design system and becomes a skin.
- **Don't shrink type to fit.** If it does not fit at the floor, change the layout. That is
  how the classification control got its verbatim PRD strings back.

---

## Dark mode

**Position: Sidepiece is light-only in v1, deliberately, and `prefers-color-scheme: dark`
does not invert it. FLAGGED FOR JARAD'S CONFIRMATION.**

This is the one place this document knowingly contradicts four years of behaviour on every
other surface Jarad owns, and it contradicts `EXPERIENCE.md`'s current sentence — *"the
Cockpit is dark-first… and it follows `prefers-color-scheme` for the light case"* — which
must be revised to match whichever way this is ruled.

**The argument, in three measured parts.**

1. **A dark panel beside a dark dashboard is camouflage, and camouflage is the one thing this
   direction cannot afford.** Paper on a dark page is **16.21:1**. Paper on a white page is
   **1.17:1**. The sheet is self-evident on half the web and invisible on the other half, and
   the spine, crop marks and unblurred shadow exist precisely to carry that other half. Invert
   the ground and you have not removed the problem, you have **moved it onto the half of the
   web where Sidepiece's north star actually lives** — the dark dashboards and dark app UIs he
   is reviewing.
2. **Following `prefers-color-scheme` here would be following the wrong signal.** In a side
   panel it reports the **OS** setting and never Chrome's own theme, and no API exposes the
   browser theme (w3c/webextensions#242). A design that changes ground on that signal is
   guessing, and it will guess wrong for any light-OS/dark-Chrome combination. **A design that
   does not follow the theme cannot follow it wrong.** The seam the extension cannot close is
   an argument *for* a fixed ground, not against one.
3. **The register is not a palette, it is a material.** "Paper" that is sometimes black is not
   paper. The direction's whole claim — a printed instrument laid on somebody else's screen —
   has a ground built into the noun.

**What `prefers-color-scheme: dark` actually does.** It is honoured, in exactly one place and
never on the ground:

```css
:root { color-scheme: light; }              /* always — forces Chrome's own form controls,
                                               scrollbars and default canvas to render light
                                               regardless of the OS setting */
@media (prefers-color-scheme: dark) {
  :root {
    --sheet-offset: 3px 3px 0 rgba(0,0,0,.45);   /* was rgba(25,23,19,.26) */
    --panel-cast:  -10px 0 28px rgba(0,0,0,.55); /* was rgba(0,0,0,.30)    */
  }
}
```

A paper sheet on a dark desk casts a harder shadow. That is the entire dark-mode response, it
is physically true, and it strengthens the one signature that carries the light-page case.
Nothing else changes: no token flips, no `data-theme` attribute, no swap.

**The escape hatch, costed in advance.** If Jarad rules against light-only, this is a token
swap and not a redesign, and the values are pre-measured so nobody has to re-argue it:

| Token | Light (shipped) | Dark variant | On dark panel |
|---|---|---|---|
| `surface.panel` | `#F2EDE3` | `#17150F` | — |
| `surface.raised` | `#FBF8F1` | `#221F17` | — |
| `surface.sunken` | `#E8E0D0` | `#100E0A` | — |
| `text.primary` | `#191713` | `#EDE7DA` | **14.81:1** ✓ |
| `text.muted` | `#645D4E` | `#9C9483` | **6.06:1** ✓ |
| `text.machine` | `#1B3FA0` | `#7FA0FF` | **7.28:1** ✓ |
| `state.degraded` | `#8A5A0B` | `#E0B25C` | **9.29:1** ✓ |
| `action.mark` | `#FF2E63` | `#FF2E63` — **unchanged** | **5.06:1** ✓ |

**The spot and both keylines never change**, in either direction, on any surface. That is what
makes the escape hatch cheap: the signature is theme-independent by construction, which is the
same property that makes it work on a stranger's page.

---

## Gaps, conflicts and open questions

**For Jarad**

1. **Light-only is the biggest call in this document.** It is defended above with measured
   numbers, but it reverses a four-year habit and it needs a yes or a no. A no costs one token
   swap; the table is already written.
2. **The spot is both the whole argument and the whole risk**, and it cannot be de-risked by
   recolouring — a quieter spot stops being unmistakable on white *and* black. The one thing
   that *can* be tuned without losing the argument is how much surface it occupies: the spine
   is currently 10px of a 340px panel. A 7px spine buys back 3px of column and weakens the
   signature by roughly that much.
3. **The rendered mock's `ink-3 #837A69` is 3.63:1 and fails body text.** This document ships
   `{colors.text.muted}` at `#645D4E` (5.59:1) instead. The panel will read slightly heavier
   than the mock did. Confirm that is wanted rather than a loss of the mock's lightness.
4. **Chrome labels moved from 8.5px to 10.5/11.5px.** This is what bought back the verbatim
   `DISPATCHED COMMAND`, and it is what cost the single-line context URL. Confirm the trade.
5. **Ochre `#8A5A0B` is the one hue added to the direction's palette.** If you would rather the
   state set be pure ink, degraded collapses onto `{colors.state.pending}`'s value and is
   carried by `▲` alone.

**Conflicts with the spec, declared**

- **`bmad-ux/references/design-md-spec.md` says `colors` is a flat object with kebab-case
  keys; the `impeccable` skill's `reference/document.md` shows the same.** This document uses
  **nested** colour objects, because EXPERIENCE.md — the peer contract — references
  `{colors.surface.panel}`, `{colors.state.ok}` and `{colors.focus.ring}`, and the spec states
  that "the path follows the YAML structure." Nested is the only shape that resolves those 54
  references. Followed the token contract; noting the conflict.
- **`impeccable/reference/document.md` names the body sections
  `Overview / Colors / Typography / Layout / Elevation & Depth / Shapes / Components / Do's and
  Don'ts`. The bmad-ux spec names them `Brand & Style / Colors / Typography / Layout & Spacing /
  Elevation & Depth / Shapes / Components / Do's and Don'ts`.** Followed bmad-ux, as instructed.
  A DESIGN.md-aware tool keyed to impeccable's headings will not find `Overview` or `Layout`.
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

- **`{typography}`'s note reads "Sans for people, mono for machines."** The chosen direction is
  **serif** for people; the mono half is unchanged. That line needs one word changed.
- **EXPERIENCE.md writes the column as 320px throughout.** The direction is drawn at 340px with
  a **300px** usable column after the spine, border and gutter. 320px is Chrome's floor, not the
  design target; at 320px the usable column is 280px and the ticket title column drops to 178px.
  One number, many occurrences.
- **`{rounded.pill}` "is reserved for state markers so a state is never shaped like a control."**
  Here state markers are unshaped glyphs and `pill` has exactly two `[v2]` consumers. The intent
  is over-satisfied but the sentence is now wrong.
- **EXPERIENCE.md's Foundation states "25 components, 19 of them v1 and 6 marked `[v2]`."** The
  component table marks **eight** `[v2]` — `hoverOutline`, `commentBubble`, `freehandLayer`,
  `annotationPin`, `annotationRow`, `dischargeControl`, `attachmentChip`, `iconBadge` — so the
  real split is 17 v1 and 8 v2. This document defines all 25.
- **EXPERIENCE.md's dark-mode resolution says "the Cockpit is dark-first."** Superseded by the
  section above, subject to Jarad's ruling.
