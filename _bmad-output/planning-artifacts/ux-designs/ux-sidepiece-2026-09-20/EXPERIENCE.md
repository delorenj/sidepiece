---
status: draft
updated: 2026-09-22
project: sidepiece
sources:
  - ../../prds/prd-sidepiece-2026-09-17/prd.md
  - ../../prds/prd-sidepiece-2026-09-17/addendum.md
  - .decision-log.md
  - .working/research-prd-behaviors.md
  - .working/research-mv3-platform.md
  - .working/research-annotation-prior-art.md
  - .working/research-house-design-language.md
  - .working/direction-foreign.html
---

# Sidepiece — Experience Spine

Peer contract to `DESIGN.md`. This file owns **how it works**: information architecture,
behavior, states, interactions, accessibility, journeys. `DESIGN.md` owns **how it looks**
and is the visual identity reference; every token named below in brace syntax is a name
`DESIGN.md` must define. No hex value, font name or pixel radius appears in this file.
Both spines win on conflict with any mock, wireframe or import.

**Vocabulary is PRD §3 and is verbatim.** Cockpit, Turn, Streamed Exchange, Dispatched
Command, Project, Project Record, pjid, Bridge, Registry, Board, Ticket, Agent, PM,
Tailnet, Bloodbank, Candystore. Introducing a synonym anywhere is a discipline violation
(PRD §3). Two borrowed words are used deliberately and only as named here: **pane** is the
PRD's own word for a region of the Cockpit that can fail on its own (§5, §6); **panel
document** is Chrome's word for the object the Cockpit is rendered into, used only when
naming the platform object rather than the product. PRD §11's metric is literally named
"Panel open time"; it is quoted by that name and the name is not adopted as vocabulary.

**Scope posture: design the full arc, mark the seam.** v1 is PRD §8.1. Everything marked
**`[v2]`** is PRD §9 plus the annotation loop Jarad narrated on 2026-09-20; it is specified
so v1's information architecture can reserve the seats it needs, and it is labelled so
nobody builds it in v1. No `[v2]` element ships in v1. Every reserved seat is named in
**Version Seam and Reserved Seats**.

**The visual direction is chosen.** On 2026-09-20 Jarad picked direction 04, **"Deliberately
Foreign"** — [`.working/direction-foreign.html`](.working/direction-foreign.html) — from four
rendered at true panel width and shown side by side
([`.working/directions-compare.html`](.working/directions-compare.html)). The other three
(`direction-chrome-native.html`, `direction-inherited.html`,
`direction-severity-ladder.html`) are retained as the rejected alternatives. Its palette,
type and shape belong to `DESIGN.md` and are not restated here. Three of its consequences are
*behavioral* and are therefore this spine's, and they are taken in **Foundation**: the usable
column, the travelling register, and the one PRD literal the mock could not fit. No
`mockups/`, `wireframes/` or `imports/` artifacts exist yet; the picked direction is the
promotion candidate at Finalize, and when key-screen mocks are rendered they are linked
inline from the sections they illustrate.

---

## Foundation

Sidepiece is **multi-surface**, and this is the most under-specified fact in every document
before this one. It is not "a Chrome side panel." It is three surfaces with three different
owners, three different lifetimes and three different failure modes, only one of which
Sidepiece controls.

| Surface | What it is | Lifetime | Who owns the pixels |
|---|---|---|---|
| **Cockpit** | The Chrome side panel document, ~320px minimum, scoped to exactly one resolved Project (PRD §3) | Destroyed on close **and on collapse** — the document is fully torn down and reloaded each time the panel document is collapsed (`research-mv3-platform.md` §1.3) | Sidepiece, entirely |
| **In-page layer** `[v2]` | Hover outline, comment bubble, freehand markup, annotation pins, drawn into the live page by the content script | Dies on page reload and on navigation; survives Cockpit collapse | The page owns the pixels; Sidepiece is a guest in a closed shadow root — and the guest must still be **identifiable as Sidepiece** against a page whose own colours are unknown, which is what `{colors.overlay.signature}` is for |
| **Extension icon** | The `"this tab is resolvable"` signal (PRD §5) — FR-3's only always-on affordance, and the one gesture that both opens and closes the Cockpit | Always present, in browser chrome, on every tab — **once it is pinned**; see **Responsive & Platform § First run** | Chrome owns the frame; Sidepiece owns the glyph and the title |

### What each surface owns, and what it must never own

**The Cockpit owns** the Project Record and every consequence of it: resolved identity,
Turns, Tickets, Bridge health, every degraded-state message, every mutating control.
**The Cockpit must never own** anything whose loss on collapse would lose work. The panel
document is not durable and, per FR-7, "cannot be the system of record." Anything typed,
drawn or accumulated is written outside the Cockpit before it is worth anything — see
**State Patterns Rule 4** for exactly what "outside" means and where it conflicts with
PRD §5.

**The in-page layer `[v2]` owns** pointing: which element, what was drawn, where. **It must
never own** Project identity, Ticket data, Turn content, or any message about the Bridge.
Two reasons, both hard. First, the layer is injected into someone else's document and will
be broken by some pages — an ancestor `transform`, `filter` or `contain` can clip a
`position: fixed` overlay regardless of its `z-index`, and a page can establish a stacking
context above the insertion point (`research-mv3-platform.md` §4.2). A surface that can
silently fail to exist cannot be load-bearing. Second, BugHerd's own troubleshooting FAQ is
dominated by *getting the layer onto the page at all* — CSP, blocked loading, missing
sidebar (`research-annotation-prior-art.md` A4). We design as if the in-page layer may be
absent on any given page, and the Cockpit is complete without it.

**The extension icon owns** exactly one bit of *state* — is this tab resolvable — and one
*gesture*: open the Cockpit, and close it again. **It must never own** a Project name, a
Ticket count, an unread count, or a menu. A badge that counts inbound work is a badge that
pulls, and SM-C1 counts pulling as failure. The one carve-out, stated once here and once in
**The Density Contract**, is `[v2]`'s count of the operator's *own* undischarged
annotations — a reminder to leave, never a count of inbound work.

### Form factor consequences

- **~320px is a hard floor**, current as of Chrome 149, hard-coded with no flag and no
  override, and **the extension can neither set, suggest, nor read the width**
  (`research-mv3-platform.md` §8). The width is not a breakpoint the design chooses; it is a
  floor the design is handed.
- **The usable column is narrower than the floor, and the usable column is what layout claims
  are written against.** The chosen visual direction pays a fixed horizontal cost on every
  surface for its signature; its own author measured the result at **roughly 300 CSS pixels
  of usable column inside a 340px panel** and recorded that cost as the strongest argument
  against the direction. The floor is Chrome's and cannot be negotiated; the usable column is
  `DESIGN.md`'s consequence of the pick and could be. Until `DESIGN.md` says otherwise,
  **every layout claim in this document is written to hold in the usable column, not in the
  floor** — it is the stricter of the two and the one that actually decides whether a line
  wraps.
- **The Cockpit cannot open itself. It has no in-document control that can close it — but
  the icon closes it.** `sidePanel.open()` requires a genuine user gesture and must be the
  first synchronous call in the handler; an `await` before it silently no-ops (PRD §5).
  `sidePanel.close()` and `toggle()` do not exist inside the panel document — they are a
  standing feature request (w3c/webextensions#521), so no control the Cockpit renders can
  ever dismiss it. What *does* dismiss it is the action itself:
  `setPanelBehavior({ openPanelOnActionClick: true })` "enables **toggling** the extension's
  side panel entry by clicking its icon" (`research-mv3-platform.md` §1.1, quoting Chrome's
  reference). A second icon click, and `Alt+Shift+S`, close the Cockpit.
- **That toggle is the dip-out gesture, and it is what makes SM-C1 winnable.** The product
  does have a one-gesture exit — the same gesture as the entrance, in the same place, with
  no aim required. The design's contribution to SM-C1 is therefore two things, not one: not
  giving him a reason to stay, and never rendering a control that competes with the icon for
  "how do I get out of this." Nothing inside the Cockpit claims to close it, because nothing
  inside the Cockpit can.
- **Reopening is a cold start of roughly seven network reads** plus re-establishing SSE
  (`research-mv3-platform.md` §2.4), and SM-C1 explicitly wants opens to be frequent. Those
  pull against each other and **State Patterns § Reopen cold start** is where that is paid
  for.

### No component library, and no inherited design language

Sidepiece has **zero frontend code today** — no `package.json`, no `src/`, no
`manifest.json`, no CSS (`research-house-design-language.md` §5). There is no house design
language to inherit: not one hex value is shared between any two Jarad-authored projects
(§3 of the same note). What repeats is posture only — dark-first, monospace reserved for
machine data, structure from 1px borders, no drop shadows — and the chosen direction keeps
exactly one of those four (mono for machine data) and breaks the other three on purpose. That
argument is `DESIGN.md`'s to make and it is made in the direction's own self-critique; this
spine only records that the house posture is no longer something a reader of this file should
assume.

**Consequence for `DESIGN.md`:** it cannot be an override layer over a component library's
defaults. It must carry the full primitive set from zero — surfaces, borders, text roles, a
state palette **paired with glyphs**, a focus ring, control heights, and the serif/mono
split — because this spine references those primitives by name and nothing else defines
them.

The primitives this spine names, and which `DESIGN.md` must therefore define:

| Group | Tokens | Behavioral load they carry here |
|---|---|---|
| Surfaces | `{colors.surface.panel}` · `{colors.surface.raised}` · `{colors.surface.sunken}` · `{colors.surface.overlay}` | The Cockpit body, the pinned header and action bar, the collapsed group interiors, and `[v2]`'s in-page layer. Layering is surface lightness plus a hairline rule, never a shadow |
| Structure | `{colors.border.hairline}` · `{colors.border.strong}` | Every region boundary in the usable column. `strong` is reserved for the seam between a pinned region and the scrolling body, so the operator can always see what will not move |
| Text roles | `{colors.text.primary}` · `{colors.text.muted}` · `{colors.text.machine}` | `machine` is the third role, not a shade of `muted`: pjid, clone path, Board identifier, correlation identifier and command strings are machine data and are separated by role, not by weight |
| State | `{colors.state.ok}` · `{colors.state.pending}` · `{colors.state.degraded}` · `{colors.state.failed}` · `{colors.state.unknown}` | The five values the health marker, the pane-switch markers and every state notice resolve to. **Each must ship with a paired glyph** — State Patterns Rule 3 makes the glyph part of the state's identity, not decoration |
| Action | `{colors.action.primary}` | Exactly one: the current pane's submit. A second action colour would make "which control writes" a guess |
| Overlay | `{colors.overlay.outline}` `[v2]` · `{colors.overlay.scrim}` `[v2]` · `{colors.overlay.signature}` | The hover outline and the freehand stroke, drawn over a page whose own colours are unknown; both must read against an arbitrary background. `signature` is **not** `[v2]` and is the one token shared by the Cockpit and the in-page layer: it is what makes a mark identifiable as Sidepiece's on a white docs site and a black dashboard alike, and the chosen direction's whole argument rests on it being one treatment rather than three |
| Type | `{typography.heading}` · `{typography.body}` · `{typography.label}` · `{typography.micro}` · `{typography.mono}` | Serif for people, mono for machines, never mixed within one value. `micro` is the floor for static chrome only; anything variable sits at `label` or above, because density comes from leading rather than from shrinking type |
| Shape | `{rounded.control}` · `{rounded.panel}` · `{rounded.pill}` | `pill` is reserved for state markers so a state is never shaped like a control |
| Rhythm | `{spacing.gutter}` · `{spacing.stack}` · `{spacing.inset}` · `{spacing.row}` | `gutter` is the only horizontal inset in the column and it is what makes the usable column survivable; `row` is the list-row rhythm the Accessibility Floor's 32px minimum is expressed against |
| Focus | `{colors.focus.ring}` | One ring, on every interactive element, including the clone-path region |
| **Components** | **The 25 `{components.*}` names enumerated in Component Patterns** | Every `{components.*}` name in **Component Patterns** is a `DESIGN.md.Components` key as well as a behavioral spec. The count is stated so the `DESIGN.md` author can check it off: **25 components — 17 v1 and 8 marked `[v2]`.** (Component Patterns has 26 rows: the 25 keys plus the clone-path line, which is a sub-element of `{components.identityHeader}` and not a key of its own.) A component with a behavioral row here and no visual row there is an incomplete handoff, and `references/validate.md` Pass 1 #3 checks exactly that |

### The visual fork is closed, and three of its consequences are behavioral

Whether the Cockpit looks native to **Chrome** (the precedent is `kapture`'s
`extension/panel.css`, the VS Code / DevTools dark theme) or native to **33GOD** was parked
by the abandoned 2026-08-25 DeloHQ `bmad-ux` run as "pending Jarad's decision on visual
inheritance," never answered, and hit again here. Jarad's answer, on 2026-09-20, is
**neither**: direction 04, *"Deliberately Foreign"* — a printed instrument, a sheet laid **on**
the page rather than a chrome panel beside it. Its palette, type, shape and the defence of
its two deliberate house-rule breaks are `DESIGN.md`'s. This spine takes three consequences
from it and nothing else, because all three change behavior rather than appearance:

1. **The usable column** (above). Every layout claim is written against it, not against the
   320px floor.
2. **The register travels, and that is a behavioral guarantee.** The direction's carrying
   argument is that the Cockpit, the `[v2]` hover tooltip and the `[v2]` comment bubble wear
   one signature, so a Sidepiece mark reads as Sidepiece's on a white docs site and a black
   dashboard alike. That is not decoration. It is the only thing that tells the operator
   which marks on someone else's page belong to his tool, on a surface **Sidepiece does not
   own the pixels of**. It is named `{colors.overlay.signature}` so `DESIGN.md` owes it as
   one token shared across surfaces rather than as three per-surface treatments.
3. **One PRD literal did not fit, and this spine does not let it shrink.** The mock's own
   self-critique records that `Dispatched Command` would not set in the composer's flip
   control at the usable width, and set it as `DISPATCHED CMD` — "the one string in the mock
   that is not the PRD's literal, and it is a real finding, not a preference." **The finding
   is upheld and the abbreviation is refused.** PRD §3 makes the glossary verbatim and an
   abbreviation is a synonym; a classification control that renders a term the Glossary does
   not contain is the same discipline violation as writing "sidebar" for Cockpit. Making the
   complete term fit is `DESIGN.md`'s problem and it has options this spine does not take
   away — wrap it, stack the two values rather than setting them side by side, or spend
   leading rather than characters. See `{components.classificationControl}`.

---

## Information Architecture

### The column, top to bottom

In the usable column, with a pinned identity header, there is not room for the Tickets pane
and the Chat pane to be simultaneously present *and* for each to have its own pinned input.
The Ticket create box and the Turn composer are both bottom-anchored single-line-first
inputs; stacking them puts two inputs in one bottom region and pins neither. So:

| Region | Position | Contents | Scrolls |
|---|---|---|---|
| **Identity header** | Pinned top, always present when a Project is resolved | Repo name · clone path · Board identifier · health marker · degraded-connection indicator when it applies | Never |
| **Pane switch** | Bottom edge of the header | Two items in v1 — **Tickets**, **Chat**. Each carries its own status marker. Third slot reserved `[v2]` | Never |
| **Body** | Between header and action bar | Exactly one pane at a time | One scroll region, only one on screen |
| **Action bar** | Pinned bottom | The current pane's input: Ticket create box, or Turn composer | Never; grows upward to a cap, then scrolls internally |

The identity header is **not a pane**. It is chrome. FR-4 requires repo name, clone path and
Board identifier visible "without opening a menu or a detail view" — a pane behind a switch
is a detail view, so the header cannot be one. **The header holds no overflow, no kebab and
no menu of any kind**, for the same reason: P12 forbids it, and there is nothing that needs
one.

**Order at rest.** Header, switch, pane, input. Nothing is above the identity. Nothing is
below the input.

**Nothing in a pane outlives its pjid.** FR-12 is explicit — the Tickets list "is fetched
fresh on Project resolution, **not served from a prior Project's cache**" (P13). The IA
consequence is a boundary rule that governs the whole column: **when the pjid changes, every
pane's content is discarded in the same frame as the header.** Not faded, not kept as a
placeholder, not left under a new header. The Tickets pane renders `Reading the Board.` for
the new Project; the Chat pane renders `Loading this Project's Turns.` A row, a Turn or a
group header that survives a pjid boundary is the SM-3 failure this whole document exists to
prevent. The never-blank guarantee on **refetch** is scoped strictly inside one Project —
see `{components.refetchControl}`.

**What collapses.** Inside the Tickets pane, a Board-state group collapses to its header and
count; the group holding the Board's default entry state is expanded and the rest are
collapsed on first render `[ASSUMPTION: collapse state is per-Project in
chrome.storage.local (permitted by Rule 4); rationale — a Board with eight states cannot show
eight expanded groups in 320px, and the default entry state is the group UJ-1 writes into.]`
Inside the Chat pane, the Turn list renders the most recent Turns and loads older on demand
rather than rendering the whole history on open `[ASSUMPTION: cold-start cost plus SM-C1;
FR-11 requires history be restored, not that all of it be rendered at once.]` Inside the
composer, the description field on the Ticket create box and the context detail on the Turn
composer are collapsed by default.

**What is pinned and never collapses.** The three FR-4 fields, the health marker, the pane
switch, and the current pane's input.

**Which pane opens.** The Cockpit opens on the pane it was last showing **for this
Project**; a Project change resets to **Tickets** `[ASSUMPTION: deterministic-on-change
beats globally-remembered. Tickets is the reset target because SM-1 is the primary metric
and FR-5 guarantees Tickets survives both degraded Agent states, so it is the pane most
likely to be usable. The stored value is a single key plus the pjid it was set under, in
chrome.storage.local; if the read throws or returns empty the reset target applies.]`

### Need → surface → journey

IA closes when every stated need has a surface and every surface has a journey landing on
it. Four rows do not close; they are marked and not papered over.

| Need | Source | Surface | Journey | Closed |
|---|---|---|---|---|
| Know which Project this page is | FR-2, FR-4 | Identity header | UJ-1, UJ-2, UJ-3 | yes |
| Copy the clone path into a terminal | FR-4 | Clone path line, selectable, plus a copy control | UJ-3 | yes |
| Know which Board a create will write to | FR-4, FR-13 | Identity header + create submit label | UJ-1 | yes |
| Know a tab is worth opening the Cockpit for | §5 | Extension icon | UJ-1 step 1 | yes |
| Know why nothing resolved, per cause | FR-3 | State notice in the body | UJ-3 + edge case | yes |
| Re-try resolution from any failure | FR-2, FR-3 | Re-resolve control inside every state notice | UJ-3 edge case | yes |
| Know whether the PM exists and is reachable | FR-5 | Chat pane state notice + switch marker | UJ-3 | yes |
| Get the exact provisioning command | FR-5 | Command string in the Chat pane notice | UJ-3 | yes |
| Ask the PM and read the answer | FR-7 | Chat pane: composer, Turn card | UJ-2 | yes |
| Know the Turn was accepted before any answer | FR-7 | Turn card, `"the PM has your turn"` | UJ-2 | yes |
| Know the session is cold | FR-7 | Turn card, `"warming up the PM"` | UJ-2 | yes |
| See and flip the classification before sending | FR-6 | Classification control on the composer | UJ-2 | yes |
| See what context is attached before sending | FR-10 | Context chip on the composer | UJ-2 | yes |
| Know work was dispatched, with its identifier | FR-8 | Turn card, dispatched variant | UJ-2 | yes |
| Read the **result content** of dispatched work | FR-9 | Turn card, dispatched variant | UJ-2 | **no — see (a)** |
| Resume a conversation per Project | FR-11 | Chat pane on open | UJ-2 | yes |
| See the Board's shape at a glance | FR-12 | Tickets pane, grouped in Board state order | UJ-1 | yes |
| Open a Ticket in Plane | FR-12 | Ticket row link, new tab | UJ-1 tail | yes |
| Refetch the Board on demand | FR-12 | Refetch control on the Tickets pane | UJ-1 failure branch | yes |
| File a Ticket with a title alone | FR-13 | Ticket create box | UJ-1 | yes |
| Know which Bridge dependency is failing | FR-14 | Health marker + the gated pane's notice | UJ-3 edge case | yes |
| Know a Bridge restart does not need an extension reload | FR-15 | Transient degraded states that clear on re-resolve | UJ-3 edge case | yes |
| Notice the tailnet fell back to a relay | §5 | Degraded-connection indicator in the header | — | **no — see (b)** |
| Point at an exact element `[v2]` | §9 + decision log | In-page layer | UJ-4 | yes |
| Mark up something a selector cannot express `[v2]` | Decision log | In-page freehand layer | UJ-4 | yes |
| Accumulate feedback, then discharge it `[v2]` | Decision log | Annotations pane + discharge control | UJ-4 | yes |
| Attach an annotation to a Ticket `[v2]` | §9 | Attachment chip on the create box | UJ-4 | yes |
| Provision the missing Agent in one click `[v2]` | §9 | Action slot beside the command string in the no-PM notice | — | not v1; seat reserved |
| List recently active Projects `[v2]` | §9 | — | — | **no — see (c)** |
| Tail Project-scoped events live `[v2]` | §9 | — | — | not v1; competes for the **unreserved** fourth switch slot — see (e) |
| See whether an Agent is already working this repo `[v2]` | §9 | — | — | not v1; competes for the same unreserved slot — see (e) |

**(a) FR-9's result content has a surface and no data.** The Turn card's dispatched variant
is specified below to render result content. PRD §12 Q2 records that
`BloodbankAdapter.send()` discards its `content` argument, so outcome events carry status
only and "FR-9's 'renders its result content' is therefore unbuildable until the Bloodbank
gateway is changed." The UI is specified; until that repo changes, every completed dispatch
renders as **completed with no result content returned** — which is an honest state, not a
blank. It is never rendered as a bare checkmark, because a status is not an answer and
FR-6's bias toward dispatch is only justified by FR-9.

**(b) The degraded-connection indicator has a surface and no journey.** No narrated session
lands on a DERP fallback. Accepted as unclosed rather than inventing a journey for it: it is
an ambient marker on the header, not a destination.

**(c) §9's recent-Projects list has no surface that does not cost the one-click open.** The
obvious home is an action popup on the extension icon. `[ASSUMPTION: an action with a
`default_popup` opens the popup on click, which displaces
`setPanelBehavior({openPanelOnActionClick: true})` — not verified in this run's sweep, but
it is how the action API is shaped.]` v1 therefore keeps the action **popup-less** so the
icon opens and closes the Cockpit in one click, and v2's recent-Projects list must find
another home — a switch slot or a context-menu item on the action — not a popup. Recorded
here so v2 does not spend the icon click without noticing.

**(d) The most common state is "no pjid declared", and that is a v1 fact, not an edge
case.** PRD §12 Q4 is open: nothing yet emits the declaration into served pages, so "v1 is
inert until some number of Projects actually declare one." Every tab in the browser is the
no-pjid state until that changes. The IA consequence is that the unresolved state must be
cheap, quiet and non-accusatory — it is the wallpaper, not an error — and **State Patterns
§ DS-1 is the only state in the product that does not render a
`{components.stateNotice}`**, precisely so that prescription is executed rather than only
written down.

**(e) The fourth switch slot is not reserved, and two §9 panes want it.** v1 lays the switch
out so a **third** item fits in the usable column without wrapping; it makes no claim about a fourth.
The Candystore live event feed and the Agent-session list both land naturally as panes and
both would take that slot. Recorded as an unresolved v2 contention rather than silently
double-booked: when the first of them is built, the switch's layout at four items is a real
question to answer, not an assumption to inherit.

---

## Version Seam and Reserved Seats

Every `[v2]` element and the v1 seat it will occupy. v1 builds the seat's container; it does
not build the occupant.

| `[v2]` element | Reserved seat in v1 | What v1 builds | What v1 does not build |
|---|---|---|---|
| Annotations pane (the running list) | **Third slot in the pane switch.** The switch is built as an n-item control with two items rendered | The switch, sized and laid out so a third item fits in the usable column without wrapping | The pane, the list, the slot's label |
| Attachment on a Turn | **Leading slot in the Turn composer's action row**, left of the classification control | The action row as a row, with the leading slot empty | Any attachment affordance or payload |
| Attachment on a Ticket | **Leading slot in the Ticket create box's submit row** | The submit row as a row, with the leading slot empty — stated in `{components.ticketCreateBox}`, not only here | Any attachment affordance or payload |
| Batch create — one Ticket per annotation | **Secondary slot beside the create box's primary submit**, in the same submit row | That row holding a primary control and one empty secondary slot — stated in `{components.ticketCreateBox}` | The secondary control |
| Batch discharge to the PM | **Reuses the Dispatched Command path** (FR-8) already built for UJ-2 | The whole dispatch path, subject validation, acknowledgement, correlation | The batch payload shape |
| In-page hover outline, comment bubble, **freehand markup**, pins | **The content script already injected for FR-1 detection** | The content script, its SPA re-detection, and its message channel to the service worker | Any rendering in the page at all |
| Page click summons the Cockpit | **The service worker's `onMessage` handler**, written callback-style with zero awaits from day one | A callback-style handler, because a promise chain here silently loses the curried gesture | The in-page control that sends the message |
| One-click Agent provisioning (§9) | **The action slot beside the command string** in the DS-11 and DS-14 notices | The notice's control row, containing only the copy control in v1 | Any control that runs a command. v1 states the command and does not run it (FR-5) |

**Not a reserved seat: the icon badge.** `{components.iconBadge}` `[v2]` is **new surface
area in v2, reserved by nothing in v1.** The icon renders no badge in v1 and v1 builds no
badge surface. It is recorded here rather than in the table above so the seam table stays
honest about what v1 actually constructs — a row claiming a seat that does not exist is
worse than no row. What v1 *does* owe v2 is not a widget but a scoped prohibition: see
**State Patterns § Extension icon states**, where "no badge" is stated as a v1 rule rather
than as an absolute, so v2 is not re-litigating a principle.

The one rule that makes the seam safe: **a reserved seat renders as nothing in v1, not as a
disabled control.** A greyed-out attachment button is a promise; an empty slot is a layout
decision. P17 (do not reintroduce density) and SM-C2 (feature count) both argue against
showing v1 a menu of things it cannot do.

---

## The Density Contract

PRD §1's directive to this workflow is a resolved blocker, not a preference: "the cockpit is
a means, not the thesis. bmad-ux should not reintroduce density as a goal on the strength of
the braindump alone." SM-C1 makes panel open time a **failure** signal. Six things in the
requirement set pull toward density. Each is named with how the design resolves it.

| Pull | Why it pulls | Resolution |
|---|---|---|
| FR-4 pins three fields permanently | Permanent chrome is the definition of density | The header carries the three FR-4 fields plus one health marker (FR-14), and the degraded-connection indicator only while it applies (§5) — **four lines at most, and normally four**. That is the whole of the permanently pinned *data* in the product, and SM-3 is unobservable without it (FR-4 says so). Not a precedent: nothing else gets pinned by citing this |
| FR-14 reports per-dependency health | Seven dependencies invites a status board | One marker in the header, carrying one of four states. The per-dependency **name** appears only inside the notice of the pane it gates, and only while it is failing. Health is never a dashboard |
| FR-12 groups Tickets by state | A board in a column | Groups collapse to header plus count; only the default entry state's group is open on first render. The pane is a *shape*, read at a glance, not a workspace |
| FR-11 history grows without bound | A chat log is an archive | Recent Turns render; older load on demand. Reopening restores the conversation, not the transcript |
| FR-10 attaches page context | A context card | One line: the page title. The URL appears on focus or hover of that line, not beside it |
| The running annotation list `[v2]` | **The live collision.** Every list surface in the category — Vercel's Inbox, Figma's sidebar, BugHerd's kanban — is a place you *dwell* | See below |

### The annotation list, resolved

Jarad asked for a running list by name, and the counter-metric says a list is where sessions
go to die. The resolution is that the prior art's lists are **archives** and this one is a
**staging area with exactly one exit**.

The Annotations pane `[v2]` has: no filter, no search, no sort, no resolved/unresolved split,
no per-item thread, no status, no assignee, no history. It has a row per annotation, a
delete on each row, and one discharge control. **It empties on discharge.**

**It is scoped to the Project, not to the page, and that costs one unit of density on
purpose.** The obvious cheaper design — show only the current page's batch — inverts the
contract: a reminder that vanishes when you navigate is not a reminder, and an undischarged
batch you can no longer see is A7 ("annotations lost on refresh or browser switch") with a
database behind it and a quieter failure. So:

- The pane lists every undischarged annotation for the **resolved Project**, grouped by page
  URL. The current page's group is expanded; every other group is collapsed to its URL and a
  count. That group header is the entire density cost of the decision, and it is priced here
  rather than discovered later.
- `{components.iconBadge}` counts the same set — undischarged annotations for the resolved
  Project — so leaving the page does not silence the reminder. It still counts only *his own
  uncommitted work*.
- **Nothing expires and nothing is silently deleted.** Each row carries its capture time, so
  a batch that has gone stale looks stale instead of disappearing. The only exits are
  discharge and an explicit per-row delete.
- The third switch slot renders only while the Project has a non-empty batch. With nothing
  in it, there is no slot.

`[ASSUMPTION: Project-scoped rather than page-scoped, no expiry. Rationale — the Cockpit is
scoped to one Project by construction, so the Project is the only wider scope available
without inventing a cross-Project surface the density contract forbids; and a silent
time-based eviction of work the operator externalized is the one failure a
working-memory tool cannot have. Whether Jarad wants an expiry at all is in **Gaps**.]`

That is the difference from Vercel's Inbox and Figma's sidebar: those are where feedback
*lives*. This is where feedback *waits*, for as long as one working session. Nothing about
it rewards returning to it, and everything about it nags you to empty it.

### What "good" looks like, stated so it can be checked

A healthy Sidepiece session is: icon says resolvable → one click → act → one click → gone,
inside a minute. The design's contribution is negative — it does not give a reason to stay —
and the exit is the same gesture as the entrance. Two concrete consequences, both
load-bearing:

- **A created Ticket does not navigate anywhere.** No confirmation screen, no "view Ticket",
  no auto-open in Plane. The row appears at the top of its group and the caret returns to an
  empty title field (FR-13 requires the row without a manual refresh; the rest is this
  contract).
- **No pane pulls.** No unread markers, no counts of inbound things, no notifications, no
  badge that grows while you are away. The only count Sidepiece will ever render is a count
  of *your own uncommitted work* `[v2]`, and that one is a reminder to leave, not to return.

---

## Voice and Tone

Microcopy. Brand voice and aesthetic posture live in `DESIGN.md.Brand & Style`.

**The register: a colleague reporting a fact.** Not a product apologising, not a product
reassuring, not a product being clever. The PRD dictates the *fact* a message must carry 29
times and the *sentence* five times; the five are literal and are never paraphrased.

### The five literal strings

| String | Where it renders | Rule |
|---|---|---|
| `"the PM has your turn"` | Turn card, within 500ms of send (FR-7) | Exact. Distinct from a response. Never "Sending…" |
| `"warming up the PM"` | Turn card, cold session (FR-7) | Exact. Replaces the first-token budget; never shown warm |
| `"this tab is resolvable"` | Extension icon title (§5) | Exact, and it is the icon's title **in the resolvable state**. The icon carries four titles in total plus one transient — the other three are ours and are required to be distinct by FR-2 and FR-3. See **State Patterns § Extension icon states** |
| `"declared but unknown"` | Resolution state notice (FR-2) | Exact. Names the state, in the state |
| degraded-connection indicator | Identity header (§5) | The *thing* is named by the PRD; its sentence is ours. Rendered, not suppressed |

### The rules

1. **Name what failed.** Never "something went wrong", never "an error occurred", never a
   status code alone. FR-14: "rather than a generic error."
2. **Distinct causes get distinct sentences.** No sentence is reused across two states. FR-3
   requires six separately worded; FR-2, FR-5, FR-12 and §6 each require a specific
   distinction (obligations 1–5 in `research-prd-behaviors.md` §6).
3. **Name the fix when there is one, and let the Bridge write it.** A remedy command is
   rendered verbatim as the Bridge returned it, in `{typography.mono}`, selectable, never
   truncated. The Cockpit never composes a command string itself `[ASSUMPTION: the Bridge
   owns command text because it knows the installed pjangler and Hermes surface; a command
   the Cockpit invents goes stale the first time a flag changes. FR-5 and FR-12 require the
   command be named, not that the Cockpit author it.]` Where an FR *requires* a command and
   the Bridge returns none, that is a Bridge bug and is said out loud — see
   `{components.commandString}`.
4. **Machine identifiers are complete or absent.** pjid, clone path, Board identifier,
   correlation identifier, command string: `{typography.mono}`, never elided, never
   `text-overflow: ellipsis`. An ellipsised path that looks copyable and copies wrong is
   worse than no path.
5. **Honesty over comfort.** "unknown" is a word we use (FR-9). "probably", "should", "may
   have" are not. A rejection is surfaced (FR-8); an unobserved outcome is unknown, not
   success (FR-9); a dead stream is failed, not pending (FR-7).
6. **Never blame the operator, never apologise, never cute.** No "Oops", no "Sorry", no
   exclamation marks, no emoji, no encouragement.
7. **Second person only when he must act.** Otherwise the sentence is about the system.
8. **Glossary or nothing.** Never "sidebar" or "the panel" for Cockpit, "message" for Turn,
   "issue" or "bug" for Ticket, "bot" or "assistant" for PM, "server" for Bridge, "project"
   lowercase for anything that is not a Project. The one permitted use of "panel" is the
   compound **panel document**, naming Chrome's object rather than the product.
9. **Sentence case. One sentence where one will do. Period on a sentence, none on a label.**

### Do / Don't, with the real strings

| Do | Don't |
|---|---|
| `the PM has your turn` | `Sending…` · `Message sent!` |
| `warming up the PM` | `Thinking…` · a spinner with no words |
| `This page declares no pjid.` | `No project detected` · `Not supported on this site` |
| `Sidepiece can't read this page.` | reusing the sentence above on a page nothing was read from |
| `` `holocene-x` — declared but unknown. `` | `Project not found` · `Unknown project ID` |
| `The laptop is off the tailnet.` | `Network error` · `Check your connection` |
| `` `big-chungus` isn't answering. `` | `Server unavailable` · `Service down` |
| `The Bridge is up. Plane is failing.` | `Something went wrong loading tickets.` |
| `The Bridge is up. Bloodbank isn't reachable.` | `Failed to dispatch` · disabling all of Chat |
| `The Bridge is up. Candystore isn't reachable.` | showing a dispatch as completed because nothing said otherwise |
| `The pjangler Registry service isn't running.` | `Registry error` |
| `The Registry answered with an error.` | (reusing the sentence above — different cause, different fix) |
| `Relayed connection. Timings below are not the usual ones.` | hiding it · `Slow connection` |
| `No PM is declared for holocene.` + the command | `Chat unavailable` · `Agent not configured` |
| `` `sidepiece-pm` is declared but isn't in the Hermes fleet registry. `` | `Agent offline` |
| `` `sidepiece-pm` is registered but isn't answering. `` | (reusing the sentence above) |
| `` `sidepiece-pm` is bound to a role directory that isn't on disk. `` | reusing the Scrum Master's sentence — different Agent, different blast radius |
| `holocene has no Board.` + the command | `No tickets` (that is the *empty* state, a different thing) |
| `This Board is empty.` | `No tickets found` · `Nothing here yet!` |
| `This Board has no states. Nothing to create into.` | `This Board is empty.` (it is not empty; it is unshaped) |
| `The Board read didn't come back inside 2s.` | a spinner that keeps spinning |
| `Still waiting on the Board read. The connection is relayed, so there is no budget for this.` | a relayed read with no deadline at all |
| `The stream stopped before the answer finished.` | leaving the Turn pending |
| `` Dispatched. `c7f2a91e`. `` | a green checkmark |
| `No outcome after 20 minutes. Status unknown.` | `Completed` · `Done` |
| `Bloodbank refused the command: the subject is not five tokens.` | `Failed to send` |
| `Plane refused the create: 403. Your title is still here.` | `Error creating issue` |
| `Created, but the Board read didn't come back. Refetch to see it.` | silently retrying the create · leaving the title in the box |
| `The Project changed while that was in flight. Nothing was written.` | silently retargeting · `Please try again` |
| `` `/home/delorenj/code/holocene` isn't on disk. `` | `Path error` · `Invalid clone path` |
| `The Bridge did not return the command for this. That is a Bridge bug.` | an empty command block · a command the Cockpit invented |
| `Sidepiece was reloaded. Reload this tab to reconnect.` | silence |
| `Completed. The gateway returned no result content.` | `Completed` alone |

---

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components` — **every `{components.*}` name below
is also a `DESIGN.md.Components` key**, and there are 25 of them: **17 v1 and 8 marked
`[v2]`**. The table has 26 rows; the extra one is the clone-path line, which is a sub-element
of `{components.identityHeader}` and carries behavior of its own without being a key.

| Component | Job | Persists, and where | On every failure path |
|---|---|---|---|
| `{components.identityHeader}` | Renders repo name, clone path, Board identifier, health marker, degraded-connection indicator. Present whenever a Project is resolved, without a menu or detail view (FR-4). **It holds no overflow and no menu** (P12) | Nothing of its own. Re-derived from the Project Record on every resolution | Never renders a half-Project. Identity changes **in the same frame** as the body and the switch — one atomic render keyed by `(pjid, generation)`, never one pane on a Project the others left (FR-4, P11). On total outage the header is replaced by the shared notice, not left showing a Project we can no longer vouch for |
| Clone path line (inside the header) | Selectable as text so it can be copied into a terminal (FR-4) | — | Wraps; never truncates, never ellipsises. Carries a `{components.copyControl}` as well. When the path is missing on disk (DS-9) it still renders, marked, because the path is the thing he needs to go look at |
| `{components.copyControl}` | Copies a complete machine string — clone path, command string, correlation identifier — to the clipboard | — | Confirms by swapping its own label for one beat, not by a toast. If the clipboard write throws, it says so in place and the text remains selectable, which was always the primary path (FR-4). `[ASSUMPTION: FR-4 requires only that the clone path be selectable text, not that a copy control exist. One is added because a wrapped path in a 320px column is a poor drag target and the paste is the whole point of UJ-3. Removing it does not break FR-4; removing the selectability would.]` |
| `{components.degradedConnectionIndicator}` | The §5 **degraded-connection indicator**: renders in the header while the Tailnet is on a DERP relay | — | It is a fact, not a fault, and it renders at `{colors.state.degraded}` rather than `{colors.state.failed}`. §5 says budgets are "explicitly **not** guaranteed" on a relay, so while it is present **the budget's promise is dropped but its deadline is not**: every in-flight state keeps a terminal transition and says on expiry that the connection is relayed and there is no budget for this, with a retry. Suspending the deadlines outright would re-admit the permanent spinner Rule 1 and P5 forbid |
| `{components.paneSwitch}` | Selects which pane the body shows. Two items in v1, third slot reserved `[v2]`, fourth unreserved (IA note (e)) | Selected pane, per Project, in `chrome.storage.local` (Rule 4) | Each item carries its own status marker, so a pane that is failing says so **while hidden**. This is how "every pane fails independently and says why" (§5) survives a one-pane-at-a-time body |
| `{components.healthMarker}` | One marker in the header: Bridge reachable / unreachable / reachable-but-unhealthy / not yet known (FR-14) | — | Never shows reachable before it has an answer — an unknown marker, not a green one. Naming the failing dependency is the *pane notice's* job, not the marker's |
| `{components.stateNotice}` | The one block every degraded state renders into: a headline sentence, an optional detail line, an optional command string, and a recovery control | — | It **is** the failure path. It never renders as an empty region and never as a spinner (P1, P2). It always contains at least one control. **DS-1 is the single state that does not use it**, and DS-21 follows DS-1 — both are facts about the tab rather than faults in the product, and dressing the browser's most common condition as a failure is how a tool starts feeling like it is scolding you |
| `{components.reResolveControl}` | Re-runs detection and resolution for the active tab, bypassing the FR-2 cache | — | Present in **every** state notice (FR-2, FR-3), including ones it cannot fix — a Plane outage does not resolve by re-resolving, but the operator does not have to know that to reach for it. While running it disables and says so; when it returns the same state it says the state again rather than flashing. Two states render it demoted or absent and say why: DS-1 and DS-21 |
| `{components.turnComposer}` | Collects a Turn. Holds the classification control, the context chip, and the reserved attachment slot `[v2]` | Draft text debounced to `chrome.storage.local` keyed by pjid (Rule 4); restored on open | Disabled with a distinct reason in both degraded Agent states (FR-5); the draft is kept while disabled. When only the *dispatch* half is down (DS-18) it stays live and says which half. On send failure the text stays in the box. If storage throws or returns empty, the box renders empty and works |
| `{components.classificationControl}` | Shows the Turn's classification **before commit** and flips it in one control (FR-6) | Override lives for this Turn only and is discarded on send (FR-6, P14) | Renders the glossary term **verbatim and complete** — **Streamed Exchange** / **Dispatched Command** — plus one plain line of consequence. **Neither term is ever abbreviated, at any width.** The chosen direction's mock could not fit `Dispatched Command` in the usable column and set `DISPATCHED CMD`; its author flagged that as a real finding and it is upheld here — an abbreviation is a synonym and PRD §3 forbids one. The control wraps, stacks its two values, or spends leading; it does not shorten the word. It is never absent either: an unclassifiable Turn classifies as Dispatched Command, per FR-6's stated bias, and says so rather than showing nothing. Its corpus and its recompute rule are below this table |
| `{components.contextChip}` | Shows what FR-10 will attach: the active tab's title, with the URL on focus or hover | — | If the tab's title or URL cannot be read, the chip says which one is missing and the Turn still sends — a Turn with partial context beats a blocked Turn |
| `{components.turnCard}` | Renders one Turn. Two visibly distinct variants: Streamed Exchange and Dispatched Command (FR-8) | Turn state lives in the **Bridge**, keyed by pjid and Turn id (FR-15, P26). The card holds nothing | Streamed: a dead stream renders as failed with the partial text kept (FR-7). Dispatched: rejection is surfaced with its reason (FR-8); no outcome inside the window renders as unknown (FR-9); an unreachable Candystore renders as *unobservable*, worded differently (DS-19); a completed outcome renders its result content, or says the gateway returned none (see IA note (a)). Never a bare checkmark |
| `{components.jumpToLatest}` | Appears in the Chat pane when the operator has scrolled up away from a streaming Turn; returns to the bottom and re-arms bottom-anchoring | — | Appears only while the anchor is broken and something is arriving. It never appears on a quiet thread, because a control that offers to move you somewhere is a control that pulls |
| `{components.ticketGroupHeader}` | One per Board state, in the Board's own state order (FR-12, P7). Collapses to name plus count | Collapse state per Project in `chrome.storage.local` (Rule 4) | A group with zero Tickets renders with a zero count rather than disappearing — the Board's shape includes its empty columns. On an empty Board the group skeleton still renders, **beneath** the `This Board is empty.` line, because the shape is the point |
| `{components.ticketRow}` | Human key, title, state (FR-12). Opens the Plane URL in a new tab | — | A Ticket missing a field renders the fields it has and marks the gap; it is never dropped from the list. **No row survives a pjid change** (P13) |
| `{components.ticketCreateBox}` | Creates with a title alone. Description and target state optional (FR-13). **Renders a submit row containing a leading slot, the primary submit, and one secondary slot; the leading and secondary slots are empty in v1** and are the seats for `[v2]`'s attachment and batch-create. Submit names the Board it will write to | Draft debounced to `chrome.storage.local` keyed by pjid (Rule 4) | Does not wait on the Board read: `[ASSUMPTION: when target state is omitted the **Bridge** applies the Board's default entry state server-side and the created Ticket comes back carrying the state it was assigned. Rationale — FR-13 says the omitted state "uses the Board's default entry state" without saying who resolves it, and the Bridge is the only component that already derives the Board from the pjid. The alternative, holding the submit until the Board read lands, costs UJ-1 its entire margin. NOTE FOR ARCHITECTURE.]` On failure the entered text is preserved and the error is shown (FR-13). With no Board it is **disabled with the reason, not failing on submit** (FR-12, P19); with a Board that returns zero states, likewise (DS-22). A stale generation is refused before the network call, and says so (§5) |
| `{components.refetchControl}` | User-initiated Board refetch (FR-12) | — | **The never-blank guarantee is scoped to one Project.** While a refetch *within* the current Project runs, the current list stays on screen and a failure leaves the previous list in place with the failure stated above it. A **Project change is not a refetch**: the list is discarded in the same frame as the header and the pane renders `Reading the Board.` for the new Project. FR-12 is explicit that the list is fetched fresh on resolution and never served from a prior Project's cache (P13), and a row that outlives its pjid is the SM-3 failure |
| `{components.commandString}` | Renders a remedy command the Bridge returned: mono, selectable, complete, with a copy control and one empty action slot `[v2]` | — | Two rules, because the states differ. **Where an FR mandates a command** — DS-11 (FR-5, "names the exact provisioning command") and DS-14 (FR-12, "names the command that binds one") — a missing command is a **Bridge contract violation**, not a rendering variant: the notice renders its sentence plus `The Bridge did not return the command for this. That is a Bridge bug.` and the client logs it. **Where no FR mandates one** — DS-6, DS-8 and any notice that merely benefits from a remedy — the block is omitted entirely rather than rendered empty. The Cockpit never invents command text in either case |
| `{components.hoverOutline}` `[v2]` | Outlines the element under the cursor while the select tool is armed, and prints the resolved selector **before** the click | — | If the layer cannot render on this page, the arm gesture reports that it could not arm. It never arms invisibly |
| `{components.commentBubble}` `[v2]` | Opens at the clicked element; collects text; yields selector + context, **no image** | Draft to `chrome.storage.local` keyed by (pjid, page URL) | Escape closes it and **keeps** the draft (Linear P16). A navigation while it is open keeps the draft against that URL |
| `{components.freehandLayer}` `[v2]` | The drawing surface for the kind of feedback a selector cannot express — "this is supposed to be a guy but looks like garbage." **A drag inside the armed mode is a pen, not a rectangle**, and that is the one place this design leaves Vercel's: Vercel's drag crops a region, and `research-annotation-prior-art.md` §16 records that freehand markup anchored to the DOM at all is unprecedented in the sweep. Pointer-down inside the armed mode with any movement begins a stroke; pointer-up commits that stroke and the annotation stays open, so strokes accumulate. A single click with no movement is the element-anchored path instead — same armed mode, no mode switch, the branch is movement | Strokes and the committed annotation to `chrome.storage.local` keyed by (pjid, page URL) | **Undo removes the last stroke**, repeatedly, back to an empty layer; an empty layer on exit yields no annotation. **Strokes are drawn as vectors over the live DOM — nothing is captured.** **A commit control on the layer yields the annotation**: the stroke geometry in *relative* coordinates, the strokes' bounding box in relative coordinates, and **the set of elements the strokes cross** — each carrying the same selector and context payload the element-anchored kind sends. Relative coordinates because a stroke drawn at one viewport size must replay at another. **Escape exits drawing and keeps the strokes as a draft** against that URL; it never discards them, matching the comment bubble. One failure path, and it belongs to the layer rather than to any capture: if the layer cannot render — an ancestor `transform`, `filter` or `contain`, or the top layer, displacing a fixed overlay — the drag reports it could not arm, nothing is committed, and the operator is told which page defeated it rather than being handed a mark that lies about where it is. `[DECIDED 2026-09-20: the image is not load-bearing. "It has to feel like drawing" was the requirement; "the PM needs a picture" was not. Strokes render as SVG over the live DOM, which deletes `captureVisibleTab`, its two-calls-per-second limit, HiDPI physical-pixel handling, the `activeTab` permission and the whole capture-failure path. The payload is strictly richer for an Agent that cannot see the page: a raster must be interpreted, a selector set can be acted on. See `.decision-log.md`.]` |
| `{components.annotationPin}` `[v2]` | Marks an annotated element on the page | — | When the anchor no longer resolves, the pin does not render and the row says so — see **Annotation Anchoring and Drift** |
| `{components.annotationRow}` `[v2]` | One row in the Annotations pane, grouped by page URL. Hovering it outlines its element in the page, or replays its strokes for the freehand kind. Carries its capture time | — | Keeps its text and captured context when the anchor is lost; stays dischargeable |
| `{components.dischargeControl}` `[v2]` | The one-button finale: a Ticket per annotation, or the batch to the PM as a Dispatched Command | — | Partial failure is itemised — the pane keeps exactly the annotations that did not land, and says which |
| `{components.attachmentChip}` `[v2]` | Shows an annotation attached to a Turn or a Ticket before it sends | — | Removable before send; never silently dropped |
| `{components.iconBadge}` `[v2]` | Count of undischarged annotations **for the resolved Project**, across its pages | — | Absent in v1. Absent whenever the count is zero. Never counts anything inbound |

### The classifier's corpus and its recompute rule

FR-6 requires that "three example Turns per branch are specified and used as test cases" and
names four of the six. All six, with the two additions marked:

| Turn | Classifies as | Source |
|---|---|---|
| `what's in progress?` | Streamed Exchange | FR-6, verbatim |
| `summarize the board` | Streamed Exchange | FR-6, verbatim |
| `why did the resolver ticket stall?` | Streamed Exchange | ours — a question about state, answerable from what the PM already knows |
| `start on the resolver ticket` | Dispatched Command | FR-6, verbatim |
| `fix the failing test` | Dispatched Command | FR-6, verbatim |
| `open a PR for the width fix` | Dispatched Command | ours — an imperative that changes something outside the conversation |

The shape the corpus encodes, for whoever writes the rule: **a Turn that can be answered
from knowledge is a Streamed Exchange; a Turn that asks for the world to change is a
Dispatched Command**, and anything the rule cannot place goes to Dispatched Command (FR-6's
bias). The rule's form — verb allowlist, LLM pre-pass, mode toggle — is an architecture
decision; these six are its test cases.

**When it recomputes.** `[ASSUMPTION: classification is computed on a typing pause, never on
a keystroke, and once the operator flips it the classification is pinned until send. An
empty composer shows the standing default, Dispatched Command, and the first pause after
typing begins replaces it. Rationale — the PRD is explicitly silent here
(`research-prd-behaviors.md` §3, "whether classification re-runs as the operator keeps
typing"), and a control that flips under the caret mid-sentence is flicker that makes FR-6's
whole pre-commit promise untrustworthy. FR-6 requires the classification visible before
commit; it does not require it live.]`

---

## State Patterns

The heart of this document. Four rules govern everything below.

**Rule 1 — no pane may render a failure as an empty state or a permanent spinner. Ever.**
(FR-3, §5, FR-7: P1, P2, P3.) Three corollaries:

- Every in-flight state **names what it is waiting on** and carries its §5 budget as a
  deadline.
- When the deadline passes, the in-flight state **becomes a timeout state with a retry
  control**. It does not keep spinning (P5). **This holds on a relayed connection too** —
  see Rule 1a.
- An **empty state is a result**, and only a successful read may render one. "This Board is
  empty." renders after a 200, never instead of one.

**Rule 1a — a dropped promise is not a dropped deadline.** §5 says budgets are "explicitly
**not** guaranteed" when the tailnet falls back to a DERP relay, and that the case "renders a
degraded-connection indicator rather than silently missing the budget." That licenses the
Cockpit to stop *promising* a number. It does not license it to stop *terminating*: §5's very
next rule is "Missing a budget renders a timeout state, never an indefinite pending one"
(P5), and Rule 1 is absolute. So while DS-15 is up, every in-flight state keeps a deadline
and changes only what expiry **says** — a relay-aware timeout naming the relay as the reason
there is no budget, with a retry, e.g. `Still waiting on the Board read. The connection is
relayed, so there is no budget for this.` `[ASSUMPTION: the relayed deadline is generous
relative to the direct budget rather than equal to it, since a relay is genuinely slower and
a timeout that fires on every relayed read teaches the operator to ignore it. The multiple is
an architecture tuning value, not a UX one.]`

**Rule 2 — total outage is one message; partial outage is per-pane.** §5 says "Every pane
fails independently and says why." UJ-3 says when the Bridge is unreachable "every pane says
so with one shared message rather than each failing in its own way." The PRD never
reconciles these. **`[ASSUMPTION: the split is total versus partial. When the Bridge itself
is unreachable, or the Registry behind it is down, nothing in the Cockpit can be true — the
body renders ONE shared notice, the header is replaced by it, and the pane switch is
inert. When the Bridge answers and a single dependency behind it has failed, the panes that
do not depend on it stay fully live and the one that does renders its own notice. Rationale:
per-pane messages during a total outage are six ways of saying the tailnet is down, and
FR-4's atomicity rule forbids showing an identity we cannot currently vouch for.]`** §6's
dependency table already encodes exactly this split — Tailnet and Registry are marked
"Total", everything else names one pane.

*(Amended 2026-09-22, in the same change as DS-6 and DS-7's rows. "The Registry behind it is
down" is total only while **nothing can be true**. `architecture.md` D2 gives the Bridge a
last-good snapshot on disk, and when it holds one the Project resolves from it: the header
renders marked stale, the panes stay live, and DS-23 carries the age — a **partial** outage
by this rule's own test. With no snapshot the sentence above stands unchanged. §6's "Total"
for the Registry was written against a Bridge with no fallback; the rule is unchanged, the
fact underneath it moved.)*

**Rule 3 — no state is carried by hue alone.** Every state renders a glyph and a word
alongside its `{colors.state.*}` value. This is behavioral, not visual: the glyph is part of
the state's identity, and `DESIGN.md` must pair one with each state color.

**Rule 4 — the client holds continuity; the Bridge holds the record.** This spine puts
drafts, pane selection and group-collapse state in `chrome.storage.local`, and `[v2]`'s
annotations too. PRD §5 says, verbatim: *"Anything that must outlive it is held by the Bridge
(FR-15), **not persisted client-side**."* That is a direct conflict and it is resolved here
rather than left for an architect to discover.
**`[ASSUMPTION: §5's sentence governs system-of-record state, not UI continuity. Everything
the product is answerable for — Turns, their answers, dispatch outcomes, Tickets — lives in
the Bridge, exactly as FR-15 and P26 require, and the Cockpit caches none of it beyond FR-2's
explicitly bounded resolution cache. What `chrome.storage.local` holds is per-operator
continuity with no authority: an unsent draft, which pane was last open, which group was
collapsed, and `[v2]`'s pre-discharge annotations. Rationale, in three parts. First, the
panel document is destroyed on every collapse, so "hold it in the document" is not an option
and the alternative to client storage is losing an unsent sentence every time he collapses
the Cockpit — the exact interruption-destroys-the-capture failure that killed the Excalidraw
session. Second, none of it is a record: losing all of it costs one retyped sentence and a
pane selection, and nothing downstream reads it. Third, `[v2]`'s annotations are pre-commit
by construction — discharge is the moment they cross the network, and before that moment
there is nothing for the Bridge to be the record of. The line, stated so it can be checked:
if losing it would make the product wrong, it is the Bridge's; if losing it would only make
the product annoying, it may be the client's.]`**
Every read is wrapped: if storage throws or returns empty, the surface renders its empty
default and works.

### Degraded states

FR-3 calls itself "the single authoritative enumeration" and lists six. It is short. FR-5's
two Agent states and FR-12's no-Board state each gate a whole pane and appear in none of the
six; three of FR-14's four named dependencies — Plane, Bloodbank and Candystore — have their
own blast radius in §6 and appear in none of the six either; and §5's relay fallback, the
dev-reload case, the Board with no states, and the tab Chrome will not let Sidepiece read at
all appear nowhere in the document set.

**The enumeration below is resolution-, transport-, dependency-, Agent-, Board- and
environment-scoped, and it runs to twenty-eight.** *(Twenty-two until 2026-09-22.
`bmad-create-architecture`'s validation step allocated **DS-23 through DS-28** and wrote them
here in the same change, which is the rule this table already imposed on itself: a failure
mode gets a code and a row together or it gets neither. Five of the six were demanded by
architectural decisions that named a state and never made one; the sixth, DS-27, is this
document's own **Bridge contract drift**, handed to architecture below the table and now
answered. `architecture.md` D2, D3, D7, D12 and D15 carry the reasoning.)* Two further classes
of degradation are
real and deliberately live elsewhere, named here so the enumeration does not pretend to
cover them: **mutation-scoped** refusals — the stale-generation refusal — are in the
normal-path table below, because the mutation is the thing that failed and nothing is
degraded once it is refused; and **in-flight subscription** failure — SSE not established —
is in **Reopen cold start** rule 6, because it is a property of the open, not of the
Project. Each state below is separately worded, as FR-3 requires.

| # | Scope | Trigger | Panes gated | Wording | Recovery | Resolves when |
|---|---|---|---|---|---|---|
| **DS-1** | Resolution | Active tab declares no pjid (FR-3 ①) | All — body shows the resting line; no header | `This page declares no pjid.` / `Nothing to resolve. Sidepiece never guesses a Project from a URL.` | **Demoted, not absent** — see below the table | A tab that declares one becomes active, or this page starts declaring one (FR-1 re-detects without a navigation) |
| **DS-2** | Resolution | pjid declared, absent from the Registry (FR-3 ②) | All — body; no header | `` `<pjid>` — declared but unknown. `` / `The page declares this pjid. The Registry has no Project under it.` | Re-resolve | The Registry gains the Project, or the page declares a different pjid |
| **DS-3** | Transport | Bridge unreachable, laptop off the Tailnet (FR-3 ③, distinguishable case) | **Total** — one shared notice | `The laptop is off the tailnet.` / `` `burro-salmon.ts.net` isn't up on this machine, so the Bridge can't be reached. `` | Re-resolve | Tailnet returns; the FR-2 cache is invalidated on the unreachable→reachable transition |
| **DS-4** | Transport | Bridge unreachable, Tailnet up, host not answering (FR-3 ③, distinguishable case) | **Total** | `` `big-chungus` isn't answering. `` / `The tailnet is up. Nothing is listening at the Bridge.` | Re-resolve | Host or Bridge returns — including a Bridge restart, which needs no extension reload (FR-15) |
| **DS-5** | Transport | Bridge unreachable, cause not distinguishable | **Total** | `Can't reach the Bridge.` / `The tailnet looks up, but Sidepiece can't tell whether the host is down or the Bridge is stopped.` | Re-resolve | Either of the above becomes true and DS-3/DS-4 replaces this |
| **DS-6** | Dependency | Bridge up, pjangler Registry **service not running** (FR-14) | **Total when the Bridge holds no snapshot** — §6 marks Registry failure total, and with nothing to fall back on nothing can be true, so Rule 2 applies unchanged. **Partial when it holds one:** the Project resolves from the last-good snapshot, the header renders marked stale, the panes stay live, and **DS-23** carries the age *(amended 2026-09-22 — `architecture.md` D2 gave the Bridge a fallback, which moves this row across the total/partial line whenever the fallback exists)* | `The pjangler Registry service isn't running.` + command when the Bridge returns one | Re-resolve | Service starts |
| **DS-7** | Dependency | Bridge up, Registry **returned an error** (FR-14 — "the former has a different fix") | **Total without a snapshot, partial with one** — exactly as DS-6, and for the same reason *(amended 2026-09-22)* | `The Registry answered with an error.` / `<the error, as the Bridge reported it>` | Re-resolve | Registry answers cleanly |
| **DS-8** | Dependency | Bridge up, a credential did not resolve from `DeLoSecrets` (FR-16 → FR-14) | Whichever dependency it feeds; named | `` The Bridge started without `<credential>`. `<dependency>` can't be trusted. `` | Re-resolve | Credential resolves at the next Bridge start or per-request retry |
| **DS-9** | Resolution | Registry readable, clone path missing on disk (FR-3 ⑤) | None — informational; header renders and marks the path | `` `<path>` isn't on disk. `` / `The Registry has this Project. big-chungus doesn't have the clone.` | Re-resolve, plus the path stays selectable and copyable | Clone appears. Sidepiece never clones it (§4.1 Out of Scope) |
| **DS-10** | Agent | A **non-PM** Agent binding whose `role_dir` does not exist (FR-3 ⑥) | **None — informational.** The Scrum Master role "may be declared but is **not a chat target**" (§3), and FR-5 gates Chat on the PM's three states alone; FR-3 ⑥ asks for a separate *message*, never a pane gate | `` `<agent>` is bound to `<role_dir>`, which doesn't exist. `` / `That role isn't a chat target, so nothing here depends on it.` | Re-resolve | The directory exists, or the binding changes. **Occurs today:** `.project.json` binds `sidepiece-scrum-master` to a path not in this repo — and gating Chat on it would kill Chat on the repo being built, for a reason the PRD says is irrelevant to Chat |
| **DS-11** | Agent | No PM declared (FR-5 state 1) | Chat only — **Tickets stays fully live** (FR-5, P20) | `No PM is declared for <repo>.` **+ command, mandatory** (FR-5) | Re-resolve; the command is copyable and **is not run by v1**. Its action slot is `[v2]`'s one-click provisioning seat | A PM is declared in the Registry |
| **DS-12** | Agent | PM declared, absent from the Hermes fleet registry (FR-5 state 2, cause a) | Chat only | `` `<pm>` is declared but isn't in the Hermes fleet registry. `` | Re-resolve | The Agent is registered. Occurs today: `sidepiece-pm` |
| **DS-13** | Agent | PM declared and registered, not answering (FR-5 state 2, cause b; §6 "agent-unreachable") | Chat only | `` `<pm>` is registered but isn't answering. `` | Re-resolve | The gateway answers |
| **DS-14** | Board | Project has no Board binding (FR-12) | Tickets — list unavailable, **create disabled not failing** (P19); Chat fully usable | `<repo> has no Board.` / `Nothing to list, and nothing to create against.` **+ command, mandatory** (FR-12) | Re-resolve; the command's action slot is the same `[v2]` seat as DS-11's | A Board is bound. Occurs today for four of nineteen Projects. The check is for a **truthy** identifier — the field is an empty string, never null (FR-12) |
| **DS-15** | Environment | Tailnet fell back to a DERP relay (§5) — the **degraded-connection indicator** | None; marks the header. **Deadlines are kept; only what expiry says changes** (Rule 1a) | `Relayed connection. Timings below are not the usual ones.` | **None — it is a fact, not a fault, and it gates no pane.** Re-resolve is reachable from whatever notice is actually showing; this state renders none and the header holds no menu to hide one in | Direct path returns |
| **DS-16** | Environment | Extension reloaded; this tab's content script context is invalidated (addendum §C) | Detection, therefore all | `Sidepiece was reloaded. Reload this tab to reconnect.` | Re-resolve, which will fail until the tab reloads, and says so | The tab reloads. **Not** a Bridge restart — that needs no reload of anything (FR-15) |
| **DS-17** | Dependency | Bridge up, **Plane** failing (FR-14; §6 "Tickets pane only") | Tickets — list unavailable and **create disabled with the reason**; Chat and resolution fully live | `The Bridge is up. Plane is failing.` / `<the error, as the Bridge reported it>` | Re-resolve, plus the refetch control on the pane | Plane answers. The previous list is **not** left on screen under a failure; a list we cannot refresh is a list we cannot vouch for |
| **DS-18** | Dependency | Bridge up, **Bloodbank** unreachable at the transport (FR-14; §6 "Dispatch only. Streaming chat still works") | **Half of Chat.** The Streamed Exchange path stays fully live; the composer stays enabled and states which half is down | `The Bridge is up. Bloodbank isn't reachable.` / `Questions still work. Anything that would be dispatched can't be published right now.` | Re-resolve. A Turn that classifies as Dispatched Command is refused before publish with this sentence and the text is kept; the flip control is right there and a flip to Streamed Exchange sends | Bloodbank answers. Distinct from a five-token subject rejection, which is Bloodbank *answering* and refusing (see **Dispatch rejected**) |
| **DS-19** | Dependency | Bridge up, **Candystore** unreachable (FR-14; §6 "Outcomes show as unknown; dispatch still succeeds") | None — dispatch still succeeds; outstanding dispatched Turns are marked | `The Bridge is up. Candystore isn't reachable.` / `Dispatches still go out. Their outcomes can't be observed until it's back.` Rendered on the affected Turn cards, not as a pane gate | Re-resolve | Candystore answers; outstanding outcomes reconcile on the next read. **Distinct from FR-9's `No outcome after <window>. Status unknown.`** — that one means nothing arrived; this one means we cannot look. The fixes differ, so the sentences differ |
| **DS-20** | Agent | The **PM's own** `role_dir` does not exist (FR-3 ⑥ ∩ FR-5) | Chat only | `` `<pm>` is bound to a role directory that isn't on disk. `` / `The PM is declared, but the directory it runs out of isn't there.` | Re-resolve | The directory exists, or the binding changes. Split from DS-10 because the blast radius differs: this is the one Agent whose broken binding FR-5 makes a Chat concern |
| **DS-21** | Resolution | Chrome will not run the content script on this tab — a `chrome://` page, the new-tab page, another extension's page, the Web Store, a `data:` URL | All — body shows the resting line; no header | `Sidepiece can't read this page.` / `Chrome doesn't let an extension look at its own pages, other extensions' pages, or the Web Store.` | **None, and that is deliberate** — see below the table | A readable tab becomes active |
| **DS-22** | Board | Board binding present, Board returns **zero states** | Tickets — the list renders whatever it has; **create disabled with the reason** (P19, mirroring DS-14) | `This Board has no states. Nothing to create into.` + command when the Bridge returns one | Re-resolve, plus refetch | The Board gains a state. A DS-14 sibling, not an empty Board: DS-14 is no *binding*, `This Board is empty.` is a Board with states and no Tickets, and this is a Board with neither |
| **DS-23** | Resolution | Registry not answering, and the Bridge **has a last-good snapshot on disk** (`architecture.md` D2) | None — informational; the header renders and carries the snapshot's age | `` Resolved from a snapshot taken <age> ago. `` / `The Registry isn't answering. This is the last good copy big-chungus had.` | Re-resolve | The Registry answers and the resolution is refetched. The age is **surfaced, never enforced** (D9): a snapshot is never withheld for being old, because expiry turns a working degraded state into a broken one and the operator is the only reader. **Produced by the Bridge.** It is what stops DS-6 and DS-7 being total, and it is the reason serving a snapshot silently was never an option |
| **DS-24** | Agent | Bridge up, the Hermes gateway refused a new session at its **active-session cap** — gateway error 4090 | Chat only — Tickets and resolution fully live | `The Hermes gateway is at its session limit.` / `Something else on big-chungus is holding the sessions. Nothing here can free one.` | Re-resolve; the Turn text is kept | A session frees up elsewhere. **Produced by the Bridge.** Distinct from DS-28: this cap is the *gateway's*, shared with every other Hermes consumer on the machine, and no amount of Sidepiece restraint reaches it — which is why the sentence says so rather than offering a retry |
| **DS-25** | Environment | The Bridge's Turn store is at a `user_version` this Bridge binary does not recognise — a rollback, not an upgrade (`architecture.md` D7) | Chat — Turn history and Turn state *are* the store. Resolution and Tickets are storeless reads and stay fully live | `This Bridge is older than its Turn store.` / `The store was written by a newer Bridge. Nothing has been read, and nothing has been migrated.` | Re-resolve, which will keep failing until the Bridge is redeployed, and says so | The Bridge is redeployed at or above the version that wrote the store. **Produced by the Bridge.** Migrations are forward-only, so there is no downgrade path and the Bridge refuses rather than guessing — a Bridge that half-reads a store it does not understand is the confidently-wrong outcome §5 forbids |
| **DS-26** | Agent | Bridge up, `tui_gateway` **answering** but not with the JSON-RPC surface this Bridge pinned — a method it calls has been renamed or removed | Chat only | `` The Hermes gateway answered with a surface Sidepiece doesn't know. `` / `<the method, as the Bridge named it>` | Re-resolve; the Turn text is kept | The pinned Hermes release and the running one agree again. **Produced by the Bridge.** Distinct from DS-13: the gateway is **not** silent here, so `isn't answering` would be the wrong sentence and a restart would be the wrong fix. The surface is Hermes *internals*, not a published API, so this is a version pin drifting rather than an outage |
| **DS-27** | Environment | The Bridge's `CONTRACT_VERSION` and the Cockpit's disagree (`architecture.md` D12) | **Total** — no response body can be trusted to parse into what a pane expects, and a half-parsed Project Record is worse than none | `` Sidepiece and the Bridge are on different contracts. `` / `` `<side>` is the older one. `` — where `<side>` is `Sidepiece` or `the Bridge`, because naming it *is* the fix | Re-resolve, which re-checks the handshake and says which side to move | The older side is rebuilt: reload the extension, or redeploy the Bridge. **Produced by the Cockpit** — the Bridge cannot know what the client was built against. This is the state flagged below this table on 2026-09-20 as *Bridge contract drift* and handed to architecture; it is answered and grounded here. It is **not** DS-16: nothing needs reloading a *tab*, and FR-15's promise that a Bridge restart costs no extension reload is exactly the condition that lets the two halves drift apart routinely |
| **DS-28** | Agent | Every warm session is busy and the bounded wait expired without one freeing (`architecture.md` D3, D15) | Chat only — and the Turn was **not** started | `No PM session was free for that turn.` / `Your other Projects are mid-Turn. Nothing was sent, and the text is still here.` | Re-resolve, plus resend — the text is kept | A session goes idle. **Produced by the Bridge.** Distinct from DS-24: that cap is the gateway's and is shared, this one is Sidepiece's own pool of 3–5 — so one of his *own* Turns finishing is the fix, and the sentence says which. It exists because a request that waits without a deadline is the permanent pending state Rule 1 forbids |

**DS-1 and DS-21 are not failures, and are not dressed as them.** Every other row above
renders a `{components.stateNotice}`: a failure glyph, a headline, a detail line, and at
least one control. These two do not, because both are facts about the tab rather than faults
in the product, and PRD §12 Q4 makes DS-1 the browser's default condition on almost every
page until something starts emitting the declaration. Their treatment:

- One line at rest, at `{colors.text.muted}`, in the body. **No failure glyph** — Rule 3's
  glyph pairing applies to states, and these are the absence of one. No detail line unless
  the second sentence is what makes the first non-accusatory, as it is in both.
- **DS-1 demotes the re-resolve control rather than dropping it.** FR-3 requires every
  failure state to carry one and re-resolution genuinely can succeed here — FR-1 re-detects a
  declaration that appears without a navigation. So the control is present as a quiet
  secondary affordance under the line, not as the primary button a failure notice leads with.
- **DS-21 renders no re-resolve control at all**, and this is the single stated exception to
  FR-3's blanket rule. Re-resolving a `chrome://` tab cannot ever succeed — Chrome will not
  run the content script there, so there is nothing to read and no amount of retrying changes
  that. Offering a control that structurally cannot work violates Voice rule 5 more
  seriously than omitting it violates FR-3. The state clears itself when a readable tab
  becomes active.
- **DS-21 exists because DS-1 would otherwise lie.** DS-1's sentence is a positive claim
  about what the page contains — and on a `chrome://` page nothing was read, so the claim is
  unsupported. §5 concedes the boundary directly: "the content script that reads the
  declaration is bound by its host match pattern," and a broad match does not reach Chrome's
  own pages. Asserting a fact we do not have is exactly what Voice rule 1 forbids.

One further state is real but not yet groundable, and is recorded rather than designed
around. *(There were two. The second — **Bridge contract drift** — was flagged for
architecture on 2026-09-20 and answered on 2026-09-22: `architecture.md` D12 specifies a
`CONTRACT_VERSION` exported from `contract/`, echoed on health and on every response, and
compared once per open. It is **DS-27** in the table above. The paragraph that flagged it is
kept below, struck, because the handover is the useful part of the record.)*

- **Local Network Access denial.** Chrome's prompt reads "Look for and connect to any device
  on your local network." The blog documents no denial behavior and no recovery path
  (`research-mv3-platform.md` §6.3). `[ASSUMPTION: a denial presents to the Cockpit as an
  ordinary fetch failure and therefore renders as DS-5, which is honest but unhelpful. If
  the failure is distinguishable in practice, it earns its own row with its own wording
  naming the permission. Prior has moved: CGNAT `100.64.0.0/10` is explicitly `local` in the
  WICG spec and Chrome states extensions with host permissions are unaffected, so the
  expected result is no prompt at all.]`
- ~~**Bridge contract drift** — a Bridge older or newer than the Cockpit expects. Nothing in
  the source set specifies a version handshake. Not invented here; flagged for
  architecture.~~ **CLOSED 2026-09-22 — `architecture.md` D12, rendered as DS-27.** The
  handshake is one integer in `contract/`, echoed as a header on every response and compared
  once per open. Worth noting why it was not an edge case: FR-15 requires that "restarting
  the Bridge does not require reloading the extension", the Bridge is rsynced to a box the
  operator is not sitting at, and the extension is loaded unpacked and reloaded by hand —
  every one of those is a routine way for the two halves to end up at different commits.

### Normal-path states

| State | Surface | Treatment |
|---|---|---|
| **Detecting** | None | Detection is local to the browser, ≤500ms, unaffected by the network (§5). It renders nothing. A state for a sub-half-second local read is noise |
| **Resolving** | Body | `` Resolving `<pjid>`. `` One line, in the body, with the §5 budget (≤1s p95) as its deadline. Measured at 2.4ms p50 locally, so this line is nearly never seen — and it still exists, because a relay fallback or a cold Bridge will surface it |
| **Resolution timed out** | Body | `` Resolution didn't come back inside 1s for `<pjid>`. `` + re-resolve |
| **Resolved** | Header + body | Header renders the three FR-4 fields and the health marker. Body renders the selected pane. One atomic render keyed by `(pjid, generation)` |
| **Resolved from cache** | Header | The header renders immediately from the bounded FR-2 cache and carries an as-of marker until the Bridge confirms. The cache expires on its TTL and is invalidated on an unreachable→reachable transition (FR-2, P25). **Only resolution is ever served from cache** — no Ticket, Turn or outcome is (P13, P26) |
| **Reading the Board** | Tickets pane | `Reading the Board.` Deadline ≤2s p95. On expiry → `The Board read didn't come back inside 2s.` + retry (FR-12). On a relayed connection the deadline holds and the sentence changes (Rule 1a) |
| **Board empty** | Tickets pane | `This Board is empty.` After a 200 only. Distinct from DS-14, from DS-22 and from a failed fetch (FR-12). The line renders **above** the group skeleton, not instead of it: every Board state still renders its header with a zero count, because the Board's shape is what the pane is for |
| **Refetching** | Tickets pane | The existing list stays on screen with an in-progress marker on the refetch control. A refetch never blanks the pane — **within one Project only**; a Project change is not a refetch (P13) |
| **Project changed** | Whole Cockpit | One atomic re-render keyed by the new `(pjid, generation)`. Header, switch and body change in the same frame (FR-4, P11). Every pane's content is **discarded, never carried**: the Tickets list is refetched from zero (P13), the Chat pane loads the new Project's Turns (P15), the pane resets to Tickets. Focus lands on the pane switch |
| **Loading Turns** | Chat pane | `Loading this Project's Turns.` The composer is live immediately; history arriving late does not gate sending |
| **Turn accepted** | Turn card | `the PM has your turn` within 500ms of send (measured 79ms). **Distinct from a response.** This is the state that kills the feeling of a hang (FR-7) |
| **Warming** | Turn card | `warming up the PM` on a cold session. No first-token budget applies; measured cold at 7.1–17.1s. This is the longest wait in the product and the only state that exists purely to cover it (FR-7) |
| **Streaming** | Turn card | Partial output renders as it arrives. **The gateway's `thinking.delta` placeholder is not content and is never rendered as the answer** — rendering it "would be measuring an animation" (FR-7, P4). Between accept and first real token the card shows the accepted state, not a spinner |
| **Stream died** | Turn card | `The stream stopped before the answer finished.` Partial text kept and marked partial. Reported as failed, never left pending (FR-7) |
| **Reopened mid-stream** | Turn card | The completed answer is retrievable on reopen; partial tokens are best-effort and may be lost (FR-7). The card says which it is showing: the finished answer, or a partial that did not survive |
| **Project changed mid-Turn** | Turn card, in the Project that owns it | The Cockpit re-renders atomically onto the new Project, and **the outstanding Turn stays owned by its originating pjid in the Bridge and continues there** (FR-15) — it is not cancelled by a tab switch. The Cockpit drops its client-side stream subscription for the Project it left. **It is never rendered in the new Project's thread**: two Projects never share history (P15), and a Turn appearing under the wrong header is the same class of error as a confidently wrong Ticket. Partial text accumulated before the switch is **discarded, not carried** — partial tokens are explicitly best-effort (FR-7), and a partial re-rendered after a round trip is indistinguishable from a stale one. On returning to the original Project, the Turn appears in its own thread, in its original position, carrying whatever terminal state it reached: the completed answer (FR-7's reopen guarantee, which must survive a Project change as well as a collapse) or failed. **The same rule governs an outstanding Dispatched Command**, which is asynchronous by construction: the Bridge holds it, and its outcome lands on its originating Turn in that Project's thread on the next open of that Project (FR-9). **Nothing is rendered about the Project he left** — no marker, no count, no toast. The Cockpit is scoped to one Project and says nothing about any other; a badge for work happening elsewhere is exactly the pull SM-C1 counts as failure |
| **Dispatched — pending** | Turn card | `` Dispatched. `<correlation id>`. `` Acknowledgement within the §5 budget (≤2s), carrying the identifier (FR-8). Visibly distinct from a Streamed Exchange |
| **Dispatch rejected** | Turn card | The rejection and its reason, e.g. `Bloodbank refused the command: the subject is not five tokens.` Never silent success (FR-8). Distinct from DS-18: this is Bloodbank answering and refusing, not Bloodbank being unreachable |
| **Dispatched — unknown** | Turn card | `No outcome after <window>. Status unknown.` Shown as unknown, **not** as success (FR-9, P9). The window is long enough that ordinary agent work does not routinely trip it. Distinct from DS-19, where the outcome is unobservable rather than absent |
| **Dispatched — completed** | Turn card | Terminal status **plus result content** in the Turn (FR-9). Correlated by identifier, never by ordering or recency (P8). Until the gateway carries content: `Completed. The gateway returned no result content.` |
| **Dispatched — failed / timed out** | Turn card | The terminal status as reported, with whatever the outcome carried |
| **Creating a Ticket** | Create box | Submit disabled with an in-progress marker; the title text stays visible and editable-on-failure |
| **Ticket created** | Tickets pane + create box | The row appears at the top of its group without a manual refresh (FR-13), carrying the state the Bridge assigned it. Title clears, focus stays in the title field, description collapses. Nothing navigates. **If the Board read has not landed yet**, the pane is still showing `Reading the Board.` and the created row renders as a single row above that line, marked as just created; when the list arrives it takes its place inside its group and the standalone row is gone |
| **Ticket created, not renderable** | Create box + Tickets pane | The write was acknowledged and the response could not be used — a 2xx whose body did not parse, or the connection lost after the write. `Created, but the Board read didn't come back. Refetch to see it.` **The title field clears**, because the work landed and leaving it populated invites a duplicate. **Resubmitting the same text is not offered**: `[ASSUMPTION: create is not idempotent — nothing in the source set gives Plane's create an idempotency key — so a retry after an unknown outcome can double-file, and "a confidently wrong ticket is worse than a failed one" (§5) has a duplicated sibling. The honest path is the refetch control, which is pointed at explicitly. NOTE FOR ARCHITECTURE: if the Bridge can mint an idempotency key for create, this state gains a safe retry and should.]` |
| **Ticket create failed** | Create box | The entered text is preserved and the error is shown (FR-13), e.g. `Plane refused the create: 403. Your title is still here.` |
| **Generation stale** | Wherever the mutation was attempted | `The Project changed while that was in flight. Nothing was written.` Refused by both the Cockpit and the Bridge (§5). A confidently wrong Ticket is worse than a failed one. **It carries no re-resolve control, and that is correct rather than an omission**: resolution already happened — that is *why* the generation is stale — so re-resolving is the one action guaranteed to change nothing. The text is kept; the operator resubmits against the new Project deliberately, or does not. This is a mutation-scoped refusal, not a degraded state, which is why it is here and not in the DS table |
| **Outcome reconciliation on open** | Chat pane | Outcomes that arrived while the Cockpit was closed land on their originating Turns on next open (FR-9). They appear in place in the thread, not as a notification |

### Extension icon states

The icon is a surface, so it has states, and it is the only surface that renders while the
Cockpit is closed. Its states are states of **the active tab's resolvability**, and on that
axis there are four. Whether the Cockpit is currently open is a separate axis the icon does
not render — see the note below the table.

| State | Trigger | Rendering | Title text |
|---|---|---|---|
| **Resolvable** | The active tab declares a pjid that resolved, or that is cached as resolved (FR-2's bounded cache) | Active glyph at `{colors.state.ok}` | `this tab is resolvable` — verbatim, §5 |
| **Not resolvable** | The active tab declares no pjid (DS-1) | Inactive glyph at `{colors.text.muted}` | `This tab declares no pjid.` |
| **Unreadable** | Chrome will not run the content script on this tab (DS-21) | The same inactive glyph, with its own title | `Sidepiece can't read this page.` |
| **Declared, not resolved** | A pjid is declared but the Bridge has not answered, or answered DS-2 | Glyph at `{colors.state.unknown}` | `This tab declares a pjid Sidepiece hasn't resolved.` |

**One transient, not a fifth state.** If `sidePanel.open()` throws the known Chromium gesture
error on a reopen (issues.chromium.org/415694848), the service worker replaces the current
state's title with `Sidepiece couldn't open. Click again.` until the next successful open,
then restores it. It is a transient overlay on whichever of the four states is current,
because a click that silently does nothing is the worst possible first impression and the
console is not a user surface.

**The click is a toggle, and the icon does not render which way it will go.**
`setPanelBehavior({openPanelOnActionClick: true})` "enables toggling the extension's side
panel entry by clicking its icon" (`research-mv3-platform.md` §1.1), so a click opens a
closed Cockpit and closes an open one, in every one of the four states above — including the
degraded ones, which are exactly where the operator most needs the Cockpit's sentence about
why. Rendering an open/closed indication on the icon would be a fifth thing to read for a
fact already visible at full size on the right of the screen, so the icon does not.

**No badge in v1.** The icon renders no count, no Project name, and no dot that means
"something happened." That is a **v1 rule, not a principle**: the Density Contract's one
carve-out stands — *the only count Sidepiece will ever render is a count of your own
uncommitted work `[v2]`, and that one is a reminder to leave, not to return* — so `[v2]`'s
`{components.iconBadge}` is a fourth *surface* on the icon, never a count of inbound work,
and never a fifth resolvability state.

### Reopen cold start

**No document in the source set says what a reopen renders while its reads are in flight.**
That gap is closed here, because a reopen is roughly **seven network reads plus
re-establishing SSE** (`research-mv3-platform.md` §2.4) and SM-C1 wants reopens to be
frequent and short. The reads are: the active tab and its declared pjid; Project Record
resolution; a fresh generation number; per-dependency Bridge health; the Board; the
Project's Turn history; any Dispatched Command outcomes that landed while closed. Plus the
SSE subscription.

The rendering rule, in order:

1. **Detection first, locally, before anything paints.** Detection is browser-local and
   ≤500ms; the Cockpit does not paint a Project until it knows which pjid the *current* tab
   declares. This is what keeps FR-1's "never a stale previous Project" true across a
   reopen: the pjid is re-read, not remembered.
2. **The identity header paints next, from cache if the cache is valid for that pjid.**
   FR-2's cache is explicitly bounded and explicitly permitted; serving the header from it
   is the difference between a reopen that feels instant and one that feels like a load. It
   carries an as-of marker until the Bridge confirms. If the pjid is new or the entry has
   expired, the header renders the pjid and one `Resolving` line. **The cache serves the
   header and nothing else** — no Ticket list, no Turn, ever (P13).
3. **At most three progress lines, never a whole-panel spinner.** One for resolution (if
   uncached), one in the Tickets pane, one in the Chat pane. Health and the SSE subscription
   render nothing while in flight — the health marker sits at *not yet known*, which is a
   real state, not a placeholder.
4. **No pane waits on another.** The composer is live before the Turn history arrives. The
   create box is live before the Board arrives, because the Bridge resolves the default entry
   state server-side; it disables only if the Board read returns DS-14 or DS-22.
5. **Every progress line carries its budget as a deadline** and converts to a timeout state
   on expiry, per Rule 1 — and per Rule 1a on a relayed connection.
6. **The subscription is silent unless it fails.** If SSE cannot be established:
   `Not subscribed to outcomes. Dispatched results won't land here until this reconnects.`
   with a retry. This is the one reopen read that has no PRD-stated budget
   `[ASSUMPTION: treat it as the dispatch acknowledgement budget, ≤2s, for lack of a better
   anchor.]` It lives here rather than in the DS table because it is a property of this
   open, not of the Project: it resolves on retry without re-resolution and gates no pane.

`chrome.sidePanel.onOpened` and `onClosed` exist as of Chrome 141+, and the fleet runs
151–155 (`research-mv3-platform.md` §1.4). They are the save/restore hooks for the drafts
and pane selection Rule 4 puts in `chrome.storage.local`. `[ASSUMPTION: onClosed is
treated as a notification, not a guaranteed drain — nothing in the sweep establishes it
fires early enough to flush. Drafts are therefore debounced continuously during typing and
onClosed is a belt, not the braces.]`

---

## Trust and Correctness

SM-3 is "resolution is never wrong," and §5 states the stake plainly: **"A confidently wrong
ticket is worse than a failed one."** Correctness is not only a Bridge property; the UI's job
is making it *visible*, and that job deserves its own treatment.

**The identity header is the correctness display.** FR-4 says SM-3 "is unobservable" without
it. So the header is not decoration and not a nicety — it is the instrument the metric is
read off. It follows that it renders whenever a Project is resolved, it renders the whole
clone path, and it is replaced (not partially updated) on a total outage.

**One generation, one frame.** Every render of header, switch and body is keyed by
`(pjid, generation)`. There is no code path in which two regions render from different
generations. FR-4: "never one pane showing a Project the others have moved on from" (P11).

**Nothing crosses a pjid boundary.** Not a Ticket row, not a group header, not a Turn, not a
partial stream, not a cached list. FR-12 names the specific case — the list is fetched fresh
on resolution and never served from a prior Project's cache (P13) — and the general rule is
the same one: the only thing the FR-2 cache is allowed to make fast is the header, and even
that carries an as-of marker until the Bridge confirms it.

**Every mutating control states its target inside itself.** The create submit names the
Board. The send control names the PM. This is DevTools' tooltip pattern, moved:
DevTools' hover overlay prints "the selectors of the element" *first*, because the overlay's
whole job is to prove which node it resolved **before** you commit
(`research-annotation-prior-art.md` P1). The confidence loop Jarad described — "user points
→ agent says okay → user trusts it" — does not need a round trip. It needs the target
printed on the trigger.

**A stale generation is a visible refusal, not a silent retry.** Both the Cockpit and the
Bridge refuse a mutation whose generation is stale (§5). The Cockpit says so and keeps the
text. It never retargets to the new Project and it never resubmits.

**An unknown write outcome is never retried for you.** A create whose result could not be
read clears the field and points at the refetch, because a silent duplicate is the sibling of
a confidently wrong Ticket and the operator is the only one who can tell them apart.

**Classification correctness is pre-commit too.** FR-6 requires the classification visible on
the composer before commit and one control to flip it. The composer renders the glossary
term and one plain line of consequence, so the flip is made on the outcome, not on the
label. It recomputes on a pause and never under the caret, and a flip pins it until send. The
override lives for that Turn only (P14). The bias toward Dispatched Command is
only safe because FR-9 renders result content — which is currently blocked (IA note (a)).
**Until FR-9's result content exists, the dispatch bias costs more than the PRD priced it
at**, and the composer's consequence line must say what actually happens today:
`This will be published and acknowledged. The result arrives later.`

**Freshness is stated exactly twice.** The header carries an as-of marker for resolution;
the Tickets pane carries one for the Board read, beside its refetch control. Nowhere else.
Two markers is instrumentation; five is a dashboard.

**Sidepiece never guesses.** No URL heuristic, no hostname match, no Traefik import, no
fuzzy matching, no "did you mean" (§4.1, §7, P23). A page that does not declare a pjid is
not a Project, full stop, and the UI says exactly that rather than offering a way around it —
and on a page it could not read at all, it says *that* instead, because claiming the page
declared nothing would be a guess of the same kind.

---

## Interaction Primitives

Derived from what Chrome actually permits, not from what feels natural.

### Opening, closing, and the gesture rules

- The Cockpit opens **only** on a user gesture, and `sidePanel.open()` must be the first
  synchronous call in the handler. An `await` before it — even awaiting `setOptions` —
  breaks the chain and Chrome **silently no-ops with no thrown error** (PRD §5, addendum
  §C). This presents as an intermittent "sometimes doesn't open" heisenbug, so it is an
  interaction rule, not an implementation note.
- **The icon click is a toggle.** With `setPanelBehavior({openPanelOnActionClick: true})`,
  Chrome's own reference says the flag "enables **toggling** the extension's side panel entry
  by clicking its icon" (`research-mv3-platform.md` §1.1). So the product has exactly one
  close gesture and it is the same gesture as the open: click the icon, or press
  `Alt+Shift+S`, which triggers the same action. This is the dip-out SM-C1 is measuring, and
  it costs the operator no aim and no search.
- **No control inside the Cockpit can close it.** `sidePanel.close()` and `toggle()` do not
  exist in the panel document (w3c/webextensions#521). Nothing the Cockpit renders may claim
  to dismiss it, and nothing does — an X that does not work is worse than no X.
- **A click inside the page can open the Cockpit.** Chrome curries a user gesture across
  exactly one `runtime.sendMessage` hop, so content-script control → service worker →
  `sidePanel.open()` works, provided the chain is **callbacks with zero awaits**
  (`research-mv3-platform.md` §1.2). The curried gesture is *restricted* and cannot be
  re-forwarded through a second hop. This is what lets `[v2]`'s in-page flow summon the
  Cockpit, and it is why the service worker's `onMessage` handler is written callback-style
  in v1 even though v1 has nothing to summon it with.
- A known Chromium bug throws the gesture error on the *second* open after a manual close
  (issues.chromium.org/415694848), unverified on 151–155. `[ASSUMPTION: if it reproduces,
  the failure is silent-to-the-user and must not be swallowed — the icon click that does
  nothing is the worst possible first impression, so the service worker surfaces it through
  the icon's transient title, enumerated under **Extension icon states**, rather than only to
  the console.]`
- **Collapse is the same event as close** for the document. Anything unsaved at collapse is
  gone, which is why Rule 4 puts every draft in `chrome.storage.local` rather than in the
  document.

### Keyboard

The manifest budget is **exactly four** suggested shortcuts; each must contain `Ctrl` or
`Alt`; `Ctrl+Alt` is prohibited outright; `Shift` is optional; global chords are limited to
`Ctrl+Shift+[0..9]`; `_execute_action` is a reserved command name that triggers the action
(`research-mv3-platform.md` §7). The narrated journey has exactly four verbs. Zero headroom.

| # | Verb | Command | Binding | Global | Notes |
|---|---|---|---|---|---|
| 1 | **Toggle** the Cockpit | `_execute_action` | `Alt+Shift+S` | No | Reserved name; triggers the action, which with `setPanelBehavior({openPanelOnActionClick:true})` **opens a closed Cockpit and closes an open one**. Requires the action stay popup-less — see IA note (c) |
| 2 | File a Ticket | `focus-ticket-title` | `Alt+Shift+N` | No | Opens the Cockpit if closed, switches to Tickets, puts the caret in the title field. Never closes it — it is its own command calling `open()`, not the action. A `commands` keypress is a permitted gesture, so the open call is legal from this handler |
| 3 | Arm the select tool `[v2]` | `arm-picker` | `Alt+Shift+A` | No | Messages the active tab's content script. Renders nothing in v1 |
| 4 | Discharge the batch `[v2]` | `discharge-batch` | `Alt+Shift+D` | No | Renders nothing in v1 |

`[ASSUMPTION: all four are Alt+Shift rather than Ctrl+Shift, to stay clear of Chrome's own
Ctrl+Shift chords (C inspect, J console, T reopen tab, N incognito, D bookmark-all).]`
`[ASSUMPTION: none is global. Global buys firing when Chrome lacks focus and costs the
Ctrl+Shift+[0..9] straitjacket; all four verbs operate on the active tab, which is
meaningless with Chrome unfocused.]`

**In-document keys cost nothing from the budget of four** — they are ordinary key handlers
in the Cockpit document, not `chrome.commands`:

| Key | Context | Action |
|---|---|---|
| `Enter` | Composer, create-box title | Send / create |
| `Shift+Enter` | Composer, description | Newline |
| `Alt+M` | Composer focused | Flip the classification, pinning it until send `[ASSUMPTION: the flip needs a key because FR-6 makes it a per-Turn decision and reaching a button by Tab on every Turn is a tax. The control is also a button, so the key is an accelerator, not the only path.]` |
| `Tab` / `Shift+Tab` | Everywhere | Focus traversal in reading order |
| `Escape` | See below | Cancel, never destroy |
| `1` / `2` with `Alt` | Cockpit | Select pane by position `[ASSUMPTION: in-document, so it costs no command budget; mirrors the switch's visible order.]` |

### Escape and cancel semantics

**Escape-to-cancel is not inherited.** Neither Chrome's `inspect-mode` page nor Edge's
`css/inspect` page documents `Escape` at all — the only documented exits from DevTools
inspect are clicking an element or toggling the icon
(`research-annotation-prior-art.md` §1). We are choosing Escape deliberately, not copying
it, and therefore we also have to teach it: the armed state `[v2]` names its exit.

| Context | Escape does | Escape never does |
|---|---|---|
| Composer or create box with text | Blurs the field. **Text stays.** | Clears the field |
| A collapsed section just expanded | Collapses it | — |
| Armed select tool `[v2]` | Disarms, and the indicator goes away | Discards accumulated annotations |
| Comment bubble open `[v2]` | Closes the bubble, **keeps the draft** against that URL (Linear P16) | Discards the text |
| Freehand layer with strokes `[v2]` | Exits drawing, **keeps the strokes** as a draft against that URL | Discards the strokes — that is what per-stroke undo and the row's delete are for |
| Anywhere in the Cockpit | Nothing else | Close the Cockpit — only the icon can |

### Pointer

- **Click to act.** One primary action per control.
- **Hover reveals nothing that is not also reachable by keyboard.** At 320px with an
  operator who lives in a terminal, hover-only affordances are a trap. Hover may *add*
  information (the URL behind the context chip; the page outline behind an annotation row),
  never expose the only path to an action.
- **Drag, in exactly one place: `[v2]` the armed select tool**, where a click with no
  movement yields an element-anchored annotation and a drag yields a stroke-bearing one.
  One armed mode, two payloads, no mode switch — this is Vercel Toolbar's
  shipped design, verbatim: "Click and drag while in commenting mode to automatically
  screenshot a portion of the page and start a comment with it attached"
  (`research-annotation-prior-art.md` §2, P8). **Where we leave Vercel: their drag crops a
  rectangle, ours draws.** The sweep records freehand markup anchored to the DOM as
  unprecedented (§16 item 7), so the pen is ours to specify — see
  `{components.freehandLayer}`.
- **The armed state announces itself** and does not silently steal the page's clicks. Pastel
  is the tool that names this out loud as a mode (P19); DevTools turns its icon blue (P3).
  Both are right and we do both.
- **DevTools disarms on click** — "Clicking in the webpage also turns off Inspect mode." We
  deliberately diverge `[v2]`: the tool **stays armed** across clicks, because the journey is
  accumulate-then-discharge and re-arming per item is the friction the product exists to
  remove. This is the one place we break the pattern Jarad named by reference, and the
  reason is the rhythm he narrated, not a preference.

### Focus

- Focus order is reading order on every surface: header (clone path region → copy → health
  marker) → pane switch → pane content → action bar.
- **A re-render never steals focus and never drops it.** When the Project changes under an
  open Cockpit (a tab switch), focus moves to the pane switch — a defined landing — rather
  than being lost to `<body>`. When the composer or title field has focus and the pane
  re-renders around it for any other reason, focus stays in the field.
- The focus ring is `{colors.focus.ring}` and is visible on every interactive element,
  including the clone-path region, which is focusable so it can be reached and copied
  without a mouse.

### Scroll

- **One scroll region on screen at a time**: the body. The header and the action bar are
  pinned. Nested scroll regions in a 320px column are a trap-the-wheel bug waiting to
  happen.
- The Turn list is bottom-anchored while streaming and **stops following the moment the
  operator scrolls up**, surfacing a jump-to-latest control. Text that scrolls away under
  you while you are reading it is the fastest way to make a Cockpit feel hostile.
- The Tickets pane scrolls with group headers sticky to the top of the region, so the state
  a row belongs to is never off screen.

### Text selection

- **The clone path is selectable text** (FR-4) and is the only field the PRD names as such.
  It **wraps rather than truncates**: no ellipsis, ever, because an ellipsised path looks
  copyable and copies wrong. It also carries a copy control, tagged as an assumption in
  **Component Patterns**, because a drag-selection in a 320px column across a wrapped line is
  not a primary interaction.
- The Board identifier, the pjid, every correlation identifier and every command string are
  equally selectable and equally complete, by rule 4 of Voice and Tone.
- Turn text is selectable. Annotation text `[v2]` is selectable.
- **Selection is never hijacked.** No control captures `mousedown` inside a selectable
  region, and `[v2]` the armed select tool is the one exception — which is exactly why it is
  a named mode with a visible indicator and a documented exit.

---

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md`.

**Stakes, honestly: a single-operator internal tool.** One sighted, keyboard-heavy operator,
one language, one OS, no second user by design (§2.2, and the assumption that it "stays true
indefinitely"). The floor below is real work that pays for itself in this session; the
things below it are not compliance we are skipping, they are work with no reader.

**In the floor:**

- **Every control is reachable and operable from the keyboard**, including the clone-path
  region and every state notice's recovery control. There is no mouse-only path to any
  action.
- **Focus is never lost.** The re-render rules in Interaction Primitives are the
  accessibility rule as much as the interaction one: a focus that lands on `<body>` after a
  tab switch is a keyboard operator being teleported.
- **Focus is always visible.** One ring token, `{colors.focus.ring}`, on every interactive
  element. Holocene's audit found "exactly one `:focus` rule and no `:focus-visible`" — that
  is the specific failure not to repeat.
- **Live regions, used sparingly and correctly.** Streaming text goes into a `polite` live
  region that announces **the completed answer**, not every token — announcing token by
  token floods a screen reader and communicates nothing. State transitions announce once
  each: turn accepted, warming, stream failed, dispatched, outcome arrived, Ticket created,
  create failed. Degraded-state notices announce on appearance. DS-1 and DS-21 announce once
  on appearance and never re-announce on a tab switch between two unreadable tabs, because
  the wallpaper is not news. Nothing announces twice.
- **No state is carried by hue alone** (Rule 3 of State Patterns). Every state renders a
  glyph and a word. This is the one accessibility rule that is also a correctness rule: two
  of the house severity hues differ by 1.01:1 in luminance, so a hue without a glyph is not
  a signal at all.
- **Reduced motion is honored.** Under `prefers-reduced-motion: reduce`, the streaming caret
  does not pulse, progress lines do not shimmer, pane switches do not slide, and every state
  change is a text swap. Nothing in this product needs motion to be understood, so nothing
  loses meaning when motion is off.
- **Hit targets: no interactive target smaller than 24 × 24 CSS px**, and list rows at least
  32px tall. 24 × 24 is WCAG 2.2's Target Size (Minimum); 44px is a touch floor and this is a
  mouse-and-keyboard desktop panel at a 320px width where 44px rows would cost real
  information.
- **Text scales.** The Cockpit is readable at the browser's larger default sizes without a
  control being clipped or a row overlapping. At 320px this is the constraint that bites
  first, and it is the reason nothing in the header is laid out in fixed columns.

**Deliberately out of scope, and why:**

- **A full WCAG 2.2 AA conformance pass and audit.** There is no second user and no
  compliance driver; the effort buys an artifact nobody reads.
- **Screen-reader QA across NVDA / JAWS / VoiceOver.** The live-region and label discipline
  above is written to be correct; it is not verified against three readers.
- **Localization and RTL.** One operator, one language (§2.2).
- **Forced-colors / high-contrast-mode theming.** Not in use on this machine.
- **Touch.** Chrome's side panel on a desktop browser; there is no touch surface.

**Revisit trigger, stated once:** if §7's "not portable" non-goal is ever reopened, every
line in the out-of-scope list comes back, and the in-the-floor list is what makes that
recoverable rather than a rewrite.

---

## Key Flows

Journey names are the PRD's own, verbatim (§2.3). UJ-4 is Jarad's narrated session from
`.decision-log.md` and is **`[v2]`** in full.

### UJ-1. Jarad files a bug against the thing he's staring at

Jarad, late morning, on `holocene.delo.sh`. A row in the systems table renders wrong.

1. He notices the extension icon is in its resolvable state — its title reads
   `this tab is resolvable`. He has not opened anything yet; the icon is the whole
   pre-open surface.
2. `Alt+Shift+N`. The Cockpit opens, switches to Tickets, and the caret lands in the title
   field. One gesture from noticing to typing.
3. The identity header is already painted from the FR-2 cache: `holocene`, the clone path,
   the Board identifier, health marker steady. The Tickets pane is still reading the Board —
   one line, `Reading the Board.` The create box does not wait for it, because the Bridge
   resolves the omitted target state server-side.
4. He types `systems table row renders at 0 height`. Nothing else. No description, no state,
   no label — description and target state are optional (FR-13).
5. The submit control reads `Create on HOL`. He does not have to trust that it resolved the
   right Board; the control says which one.
6. `Enter`.
7. **Climax.** The Ticket comes back carrying the state the Bridge assigned it — the Board's
   default entry state — with its human key filled in by Plane. If the Board read has landed,
   the row appears at the top of that state's group, the one group whose header is expanded.
   If it has not, the row renders on its own above the `Reading the Board.` line and slots
   into its group when the list arrives. Either way the title field is empty again with the
   caret still in it. **Nothing navigated.** Plane did not open, no confirmation appeared, no
   "view Ticket" beckoned. The thought is out of his head and onto the Board, and the Cockpit
   has given him no reason to still be looking at it.
8. He clicks the icon. The Cockpit closes and he is back on the page. Elapsed: under fifteen
   seconds.

**Tail.** Later, from the Tickets pane, he clicks the row's key and Plane opens in a new tab
(FR-12) — the one moment the product deliberately hands him off, because editing a Ticket is
out of scope for v1 (P21).

**Failure — create refused.** `Plane refused the create: 403. Your title is still here.` The
text is preserved and the error is shown (FR-13). The refetch control is right there; the
list on screen is untouched.

**Failure — created, but the result could not be read.**
`Created, but the Board read didn't come back. Refetch to see it.` The title field clears,
because the work landed. No resubmit is offered against the same text; the refetch is.

**Failure — the Board read timed out while he typed.** The Tickets pane shows
`The Board read didn't come back inside 2s.` with a retry. **Create still works** — creating
does not depend on having read. The new Ticket appears once the retry lands.

**Failure — Plane is down entirely.** `The Bridge is up. Plane is failing.` The list is
unavailable and create is **disabled with the reason**, not failing on submit. Chat is
untouched and the switch marks Tickets degraded (DS-17).

**Failure — the Project changed under him.** He switched tabs mid-type. The submit is
refused before the network call: `The Project changed while that was in flight. Nothing was
written.` His title is still in the box, and the header now reads the new Project so he can
see exactly what happened.

### UJ-2. Jarad asks the PM what's going on

Same Cockpit, Chat pane. Two Turns, two different mechanics.

1. He switches to Chat. The composer is live; `Loading this Project's Turns.` runs above it
   and does not gate him.
2. He types `what's in progress?`. He pauses, and the classification control settles on
   **Streamed Exchange**, with one line under it: `This will stream back here.` It does not
   flicker while he types — it recomputes on the pause, not on the keystroke. The context
   chip shows the page title; focusing it reveals the URL (FR-10).
3. `Enter`. Within 79ms the Turn card shows `the PM has your turn` — the accepted state,
   distinct from a response (FR-7).
4. The session is cold. Instead of a first-token budget the card reads `warming up the PM`.
   It sits there for eleven seconds. It is not a spinner and it is not a fake answer: the
   gateway's `thinking.delta` placeholder is arriving and is deliberately not rendered,
   because "rendering that as the answer would be measuring an animation" (FR-7, P4).
5. Real tokens start. Partial output renders as it arrives.
6. He reads it, then types `start on the resolver ticket`. On the pause the classification
   control settles on **Dispatched Command**, with the line
   `This will be published and acknowledged. The result arrives later.` He does not flip it.
   The classifier biases toward dispatch when uncertain (FR-6) and this one is not uncertain.
7. `Enter`. Within two seconds the card reads `` Dispatched. `c7f2a91e`. `` — visibly a
   different kind of card from the streamed one above it (FR-8).
8. **Climax.** He clicks the icon and goes and does something else. The panel document is
   destroyed; the stream is gone; nothing is listening. Twenty minutes later he reopens
   the Cockpit on a `holocene` tab, and the dispatched Turn — the same card, in the same
   thread, in its original position — now carries its terminal status and its result
   content. Not a notification, not a badge, not a green check in a list somewhere. **The
   thread he left is the thread he came back to, with the answer in it.** Outcomes are
   correlated by identifier, never by ordering or recency (FR-9, P8).
9. He reads it and closes the Cockpit again.

**Reality check on step 8.** FR-9's result content is currently unbuildable — the Bloodbank
gateway's `send()` discards its content argument (§12 Q2). Until that changes, step 8 lands
on `Completed. The gateway returned no result content.` The card is the same card, the
correlation is real, and the missing piece is named rather than dressed up. This is the
single largest gap between the specified experience and the buildable one.

**Failure — the stream dies mid-answer.** `The stream stopped before the answer finished.`
The partial text stays, marked partial. Reported as failed, never left pending (FR-7).

**Failure — he switches to a tab on a different Project mid-stream.** The Cockpit re-renders
onto the new Project in one frame. The Turn keeps running in the Bridge under the pjid that
owns it; it never appears in the new Project's thread; the partial text he had is discarded.
When he comes back to `holocene`, the Turn is in its own thread, in its original position,
with the finished answer — or marked failed if the stream died while he was away. Nothing
about `holocene` was rendered while he was elsewhere.

**Failure — the dispatch is rejected.**
`Bloodbank refused the command: the subject is not five tokens.` Surfaced, never silent
success (FR-8). Worth expecting: the live `agents/hermes/pm/role.yaml` currently subscribes
to illegal subjects (§6), so this is a state that exists on this repo today.

**Failure — Bloodbank is unreachable, not refusing.** `The Bridge is up. Bloodbank isn't
reachable.` / `Questions still work. Anything that would be dispatched can't be published
right now.` The composer stays live, the Turn is not published, the text is kept, and the
flip to Streamed Exchange is one control away (DS-18).

**Failure — Candystore is unreachable.** Dispatches still go out and are acknowledged. The
outstanding cards say `The Bridge is up. Candystore isn't reachable.` — the outcome cannot be
*observed*, which is a different sentence and a different fix from `No outcome after 20
minutes. Status unknown.` (DS-19 vs FR-9).

**Failure — no outcome inside the window.** `No outcome after 20 minutes. Status unknown.`
Unknown, not success (FR-9, P9).

**Failure — reopened mid-stream.** The completed answer is retrievable; partial tokens are
best-effort and may be lost (FR-7). The card says which one he is looking at.

### UJ-3. Jarad lands on a project with no PM

Jarad opens a tab on a Project he has not touched in weeks.

1. Detection finds the pjid in under 500ms. Resolution returns in single-digit milliseconds.
2. The identity header paints: repo name, clone path, Board identifier, health marker
   steady. Everything about the Project is right.
3. The pane switch shows **Tickets** live and **Chat** carrying a degraded marker. He is on
   Tickets and it works completely — grouped in the Board's own state order, create
   available. Neither degraded Agent state disables the Tickets pane (FR-5, P20).
4. He switches to Chat. The composer is disabled — visibly, with the reason stated
   (UJ-3's own words) — above a notice: `No PM is declared for <repo>.`
5. Below it, the exact provisioning command, rendered verbatim as the Bridge returned it, in
   mono, complete, with a copy control. FR-5 makes that command mandatory: if the Bridge
   returned none, the notice says `The Bridge did not return the command for this. That is a
   Bridge bug.` rather than rendering an empty block.
6. **Climax.** He hits the command's copy control, then the clone path's copy control in the
   header, and pastes both into a terminal. **He never looked anything up, and he never
   dragged a selection across a wrapped path in a 320px column.** The one thing the Cockpit
   could not do for him, it handed him in a form he could paste — and the reason chat is
   unavailable and the fix for it are the same sentence. v1 states the command; it does not
   run it (FR-5). The empty action slot beside it is where `[v2]` will.

**Variant — the PM is declared but not running.** Different sentence, different fix:
`` `sidepiece-pm` is declared but isn't in the Hermes fleet registry. `` This is not
hypothetical; it is true of this repo today.

**Variant — the PM is registered but silent.**
`` `sidepiece-pm` is registered but isn't answering. `` A third sentence, because it is a
third fix.

**Variant — the PM's role directory is missing.**
`` `sidepiece-pm` is bound to a role directory that isn't on disk. `` A fourth sentence
(DS-20). Note what does **not** happen: the Scrum Master's role directory is also missing on
this repo today, and that gates nothing — it renders one informational line and Chat stays
exactly as available as the PM's own state makes it (DS-10, §3).

**Edge case — the Bridge is unreachable.** He is on the train; the laptop dropped off the
tailnet.

1. Detection still works — it is browser-local and never touches the network.
2. Resolution fails at the transport.
3. **The whole Cockpit renders one notice.** Not the header plus three failures: **one**.
   `The laptop is off the tailnet.` / `` `burro-salmon.ts.net` isn't up on this machine, so
   the Bridge can't be reached. `` The pane switch is inert. The identity header is gone,
   because nothing Sidepiece could put in it is currently something it can vouch for.
4. One re-resolve control, in the notice.
5. **Climax.** There is exactly one thing wrong and exactly one sentence about it. He knows
   within a second that this is his laptop and not `big-chungus`, because the two have
   different fixes and therefore different sentences (FR-3). He does not re-resolve. He puts
   the laptop away.
6. The tailnet returns. He re-resolves; the cache was invalidated on the
   unreachable→reachable transition (FR-2), so what comes back is fresh.

**Variant — the host, not the laptop.** `` `big-chungus` isn't answering. `` — same shape,
different sentence, different fix.

**Variant — the Bridge was restarted.** Indistinguishable from the above while it is down,
and it resolves the same way: one re-resolve when it comes back. **Nothing is reloaded** —
not the tab, not the extension (FR-15). DS-16's "reload this tab" sentence belongs to a
different cause and never appears here.

**Variant — the Bridge answers but Plane is down.** Now it is **partial**, so the shared
notice does not apply. The header renders normally. Chat is fully live. The Tickets pane
alone says `The Bridge is up. Plane is failing.`, create is disabled with that reason, and
the switch marks Tickets degraded while he is looking at Chat. This is the exact boundary
Rule 2 draws.

**Variant — a relayed connection.** The header carries `Relayed connection. Timings below
are not the usual ones.` Nothing is gated. Reads still terminate: the Board read that would
have said `didn't come back inside 2s` instead says `Still waiting on the Board read. The
connection is relayed, so there is no budget for this.` with a retry. The promise is dropped;
the deadline is not.

### UJ-4. The Garbage Man `[v2]`

**`[v2]` — NOT IN v1. NOTHING IN THIS FLOW SHIPS IN v1.** It is specified so v1's IA reserves
the right seats (see **Version Seam and Reserved Seats**) and so v2 does not re-litigate the
shape. Every element below is `[v2]`.

Jarad, on his **Slow Burns** page. It looks great overall. He has a batch of feedback, and
one element at the bottom "is supposed to be a guy but looks like garbage." The incumbent is
Excalidraw at `draw.delo.sh`, where this session died once already after a single pretend
annotation, because there is no output path and the finding has to be retyped from working
memory.

1. `Alt+Shift+A`. The select tool arms. The in-page indicator says so, and the Cockpit —
   whether open or not — is not required for this step. Annotation time is page time, not
   Cockpit time, which is why beats 1–6 cost SM-C1 nothing: the Cockpit is opened exactly
   once in this journey, at beat 7, for the discharge.
2. He moves the cursor. Each element under it gets a live outline, and the overlay's tooltip
   prints **the resolved selector first** — the same field DevTools prints first, for the
   same reason: to prove which node the tool thinks he means, before he commits. The
   confidence loop resolves here, with no round trip to the PM.
3. He clicks a mis-aligned heading. A comment bubble opens at the element. He types
   `this is 2px off the column above it`. The payload is **selector + context, no image** —
   the element-anchored kind. Three shipped products prove the no-image path is viable
   (Vercel, BugHerd, Pastel).
4. **The tool stays armed.** DevTools disarms on click; we deliberately do not, because the
   rhythm is accumulate-then-discharge. He clicks two more elements and types two more
   notes.
5. He reaches the guy at the bottom. A click will not express this. He **drags** — same
   armed mode, no mode switch, the branch is simply that the pointer moved — and the
   freehand layer takes the stroke. He draws three times over the figure; each pointer-up
   commits a stroke and the annotation stays open. One stroke goes wrong and he undoes it.
   Then he commits. The strokes are vectors over the live DOM; **nothing is captured**. The
   payload is **relative coordinates + the elements the strokes cross**: the stroke geometry
   and its bounding box in relative coordinates, plus each crossed element's selector and
   context — the same payload the element-anchored kind sends. Relative, because a stroke
   drawn at one viewport size has to replay at another. The PM does not receive a picture; it
   receives the marks and the things they were drawn over, which is what it can actually act
   on.
6. The extension icon now carries a count — of **his own uncommitted work**, the only kind of
   count this product will ever render. It counts the whole Project's undischarged batch, so
   it will still be there if he wanders onto another Slow Burns page before he discharges.
7. He opens the Cockpit. The pane switch has a third item: **Annotations**, present because
   the batch is non-empty. Four rows, grouped under this page's URL, with the group expanded.
   Hovering a row outlines its element in the page, or replays its strokes for the freehand
   one; the list and the overlay are two views of one state, never two states to reconcile
   (Figma's one genuinely correct decision here). No filters. No search. No status. No sort.
8. One row's anchor no longer resolves — the page re-rendered under him. The row says so,
   keeps its text and its captured context, and stays dischargeable. It does not silently
   degrade to page coordinates and it is not dropped. **No tool in the prior-art sweep
   documents this state at all.**
9. **Climax.** One control, two destinations. He picks *a Ticket per piece of feedback*:
   four Tickets land on Slow Burns' Board, each carrying its annotation, each appearing in
   the Tickets pane's default entry state group without a refresh. **The Annotations pane
   empties and its switch slot disappears.** The alternative — *send the batch to the PM* —
   publishes one Dispatched Command carrying all four, acknowledged with a correlation
   identifier, its outcome landing in the Chat pane's thread. Either way the feedback left
   his head, left the page, and landed somewhere that will act on it, without him retyping a
   word. **That last clause is the entire margin over Excalidraw**, and it has no prior art
   in the sweep: every tool found routes annotations to a tracker; none routes them to an
   Agent.
10. He clicks the icon. The Cockpit closes and the page is clean.

**Failure — the layer cannot render on this page.** The arm gesture reports that it could not
arm, and names the page. **It never arms invisibly, and it never renders an outline it cannot
place correctly** — a displaced mark is worse than no mark, because the whole confidence loop
is the operator trusting that what he pointed at is what got sent. Some pages will break a
hand-built overlay via an ancestor `transform`, `filter` or `contain`, or by establishing a
stacking context above it. `[DECIDED 2026-09-20: the overlay is a hand-built closed shadow
root — CSS-layer reset, `position:fixed`, `z-index:2147483647`, the technique DevTools' own UI
uses. `chrome.debugger`'s `Overlay.setInspectMode` is rejected and **no fallback to it is
built**. It pins a "Sidepiece started debugging this browser" infobar to every tab on every
activation, suppressible only by a Chrome launch flag — but the argument that decides it is
that the native outline is *Chrome's* mark, not Sidepiece's, and cannot wear
`{colors.overlay.signature}`. A mark the operator cannot attribute to Sidepiece defeats the
direction's entire thesis. The broken-page cost is accepted and surfaced. See
`.decision-log.md`.]`

**Failure — partial discharge.** Two of four Tickets land. The pane keeps exactly the two
that did not, says which, and the discharge control stays. It never reports four.

**Failure — the page reloads mid-session.** Annotations survive: they live in
`chrome.storage.local` keyed by (pjid, page URL) per Rule 4, not in the page and not in the
Cockpit document. `[ASSUMPTION: this answers the open question of where annotation state
lives. Not the Cockpit — the document is destroyed on every collapse. Not the page — a reload
eats it, which is the single worst failure for a working-memory externalization tool (A7).
Not the Bridge in v2's first cut — a network round trip per annotation is friction on the one
loop that exists to remove friction, and nothing pre-discharge is a record. Discharge is the
only thing that crosses the network.]`

**Failure — he navigates away with the batch undischarged.** The batch does not vanish. The
count on the icon holds while he is anywhere on that Project, and the Annotations pane lists
the earlier page's rows under their own collapsed group header. This is the one place the
design pays density on purpose, and **The Density Contract** prices it.

---

## Annotation Anchoring and Drift `[v2]`

This section exists because the gap is ours to close. Vercel, BugHerd and Pastel all claim
element attachment and **none publishes its anchor serialization**. The only public spec —
the W3C Web Annotation Data Model — answers drift with redundancy, and the W3C Working Group
itself concedes that "Robust Anchoring were under exploration, but no output were produced."
And across the entire prior-art sweep, **no tool documents what the user sees when the
anchored element is gone.** Every vendor asserts pins "remain attached"; not one publishes
the failure state.

### What an annotation carries

Not a pointer. A pointer that stops resolving is worthless; an annotation that stops
resolving is still feedback. So every annotation carries, at capture time:

- The operator's text, and its capture time.
- The page URL and the page title (FR-10's floor, already carried by every Turn).
- The captured context the PRD §9 payload specifies: tag, text snippet, `outerHTML`.
- A **redundant selector set**, below — for the element-anchored kind.
- For the freehand kind: the stroke geometry in **relative** coordinates, the strokes'
  bounding box in relative coordinates, and **a selector set per element the strokes cross**
  — captured the same way, and ranked by the same order, as the element-anchored kind. There
  is no image. `[DECIDED 2026-09-20 — see `.decision-log.md`.]`

Because the context is captured at capture time, **a lost anchor degrades an annotation; it
never destroys one.** That single decision is what makes the failure states in the next
subsections survivable.

### The selector set and its pick order

The W3C model's answer is redundancy: "Multiple Selectors SHOULD select the same content…
Consuming user agents MUST pick one of the described segments, if they are different." The
spec does not publish a pick order. Ours, highest first, applying the addendum's stated
practical priority:

| Rank | Selector | Why here |
|---|---|---|
| 1 | `data-testid` / other `data-*` | Author-stable by intent; survives a rebuild |
| 2 | `id`, if unique **and not hash-shaped** | Stable when hand-written; a build-hashed id is worse than no id and is rejected by shape |
| 3 | Short, capped structural path | DevTools' own approach. Breaks when sibling count or order changes, so it is capped in depth rather than made exhaustive |
| 4 | Text quote of the element's own text | The W3C recovery path. Survives a re-render that changes every class name |
| 5 | Role plus accessible name | Survives a DOM restructure that keeps the semantics |

**Resolution rule at re-anchor time:** try in rank order; the first selector resolving to
**exactly one** node wins. More than one node is *ambiguous*, which is **not** a match — a
confidently wrong anchor is the same class of mistake as a confidently wrong Ticket.
`querySelector` crosses neither a shadow boundary nor an iframe boundary, so an element
inside either is either addressed with a frame-aware path or is honestly reported as
unaddressable at capture time — never captured as if it worked.

### What the operator sees — the four outcomes

The first three apply to both kinds. **Since the freehand kind carries a selector set per
crossed element, it degrades by the same three outcomes** — evaluated per element rather than
once — and adds a fourth failure the element-anchored kind cannot have, because only strokes
carry geometry that a re-layout can invalidate while every selector still resolves.

| Outcome | Row in the Annotations pane | Pin in the page |
|---|---|---|
| **Anchored** — rank 1–3 resolved to one node | Row is live; hovering it outlines the element | Renders |
| **Re-anchored weakly** — rank 4 or 5 resolved | `Re-matched by text, not by selector.` Hovering still outlines. The discharge payload says which rank matched, so the PM knows how much to trust the pointer | Renders, marked |
| **Anchor lost** — nothing resolved, or more than one node did | `The element this was pinned to is gone.` The row keeps its text and its captured context and **stays dischargeable** | Does not render |
| **Drifted** `[v2]` — the freehand kind only | Every crossed element still resolves, but the strokes no longer sit over them: the page re-laid out and the geometry and the selectors now disagree. **This is the one drift the selector set cannot catch**, and it is detectable precisely because both halves of the payload exist — the row compares each crossed element's current box against the strokes' relative bounding box and says `The page moved under these marks.` The row always renders and stays dischargeable; the discharge payload carries both the strokes and the selector set, so the PM has the elements even when the geometry has gone stale | Strokes replay at their relative coordinates, marked. **Never silently re-positioned** onto where the elements moved to — the operator drew where he drew, and inventing a new position is the confidently-wrong-anchor failure in another costume |

**What never happens:** the annotation is not deleted, not hidden, not silently re-pointed at
a nearby node, and not degraded to raw page coordinates. Figma's documented behavior —
silently falling back to canvas coordinates with a manual drag as the workaround — is the
specific failure this table exists to avoid. Silent failure is the enemy, not breakage.

### Drift the anchor cannot cover

- **URL identity.** Vercel documents that comments on URLs with query params do not appear
  at the base URL. Annotations are keyed by (pjid, page URL); `[ASSUMPTION: the key strips
  the query string and the fragment, because a `?tab=systems` deep link is the same page for
  feedback purposes. If that proves wrong in practice it is one key change.]`
- **SPA route identity.** BugHerd's answer is for the *site owner* to set a config value. Our
  content script already observes history transitions for FR-1, so the route change is
  observable without the page's cooperation — this is one of the few places Sidepiece is
  structurally better off than the category.
- **A redeploy under an open session.** Not detectable from the page. The annotation's
  captured `outerHTML` — and, for the freehand kind, the captured context of every element its
  strokes crossed — is what lets a human, or the PM, see what it *was*. There is no image;
  nothing is captured as a raster `[DECIDED 2026-09-20]`.

---

## Inspiration & Anti-patterns

Each item names its source. These are what to steal and what to refuse, not a survey.

### Steal

- **DevTools' overlay tooltip, whose first field is the resolved selector.** Chrome's own
  docs list the tooltip's fields in order, and the first is "The selectors of the element."
  The overlay's entire job is to prove which node it resolved *before* you commit. This is
  the confidence loop from the brain dump — "user points → agent says okay → user trusts it"
  — and it is solved by a tooltip, with **no round trip to any agent**. Taken twice: in
  `[v2]`'s hover outline, and in v1's rule that every mutating control names its target
  inside itself (**Trust and Correctness**).
- **Vercel Toolbar's single armed mode with two payloads.** Verbatim: "Click and drag while
  in commenting mode to automatically screenshot a portion of the page and start a comment
  with it attached." Click yields element-anchored; drag yields the heavier payload.
  **No mode switch between them.** This is exactly Jarad's two payloads, already shipped as
  one gesture vocabulary, and it is why `[v2]` has one armed mode and not two tools. **Taken
  as the gesture split, not as the payload** — and we diverge on the payload twice. Vercel's
  drag crops a rectangle and ours draws, because "this is supposed to be a guy but looks like
  garbage" is not a region. And Vercel's drag produces a *screenshot* where ours produces
  *vectors plus the selectors underneath them*, because our reader is an Agent that cannot
  look at a picture, not a human who can.
- **Figma's list-and-pins-as-one-state.** Resolving a comment "will hide the comment from
  both the right sidebar and the canvas." Two views, never two states to reconcile. Taken as:
  the Annotations pane and the in-page pins are one state; hovering a row outlines its
  element; discharging empties both.
- **Linear's grace window for filing dirty.** "Changes made to an issue's properties in the
  first 3 minutes are considered part of the issue creation process, and won't be added to
  the activity log." The mechanic does not transfer — v1 cannot edit a Ticket at all (P21) —
  but the *principle* does, and Sidepiece gets it for free: **the cost of filing a bad title
  is paid by the PM, not by the operator**, so the create box validates nothing beyond
  non-empty and says nothing that implies the title must be good.
- **Linear's drafts that survive `Esc` and persist across clients.** Taken as: every draft in
  this product — composer, Ticket title, comment bubble, freehand strokes — is debounced to
  `chrome.storage.local` under Rule 4, because the Cockpit document is destroyed on every
  collapse and "interruption destroys the capture" is fatal to a working-memory tool.
- **DevTools' armed-mode indicator** (the icon turns blue) and **Pastel's named
  comment-mode / browse-mode toggle.** Both acknowledge out loud that an annotation layer
  steals the page's own clicks. `[v2]` does both: a visible armed indicator and a documented
  exit.
- **GitHub's `Y` permalink.** The only prior art anywhere in the sweep for *deliberately
  trading liveness for durability at capture time*. It is the philosophical ancestor of
  capturing `outerHTML` and a text quote alongside the selector — and of capturing the
  freehand kind's crossed-element context at the moment the strokes are drawn, which is what
  it has instead of an image `[DECIDED 2026-09-20: nothing is captured as a raster]`.
- **Excalidraw's hand-drawn register.** The one thing worth keeping from the incumbent:
  freehand markup reads as *a thought*, not *a spec*, which is exactly the right voice for
  "this is supposed to be a guy but looks like garbage."

### Refuse

- **Mandatory screenshots on every item** — Marker.io, Usersnap, Userback anchor to a raster;
  BugHerd captures one automatically even for a pinned element. Every note pays for capture
  + annotate + form-fill, including "this button is 2px off", which needed only a selector.
  And the image starts rotting on arrival: "Screenshots get outdated the moment the page
  changes." **Sidepiece captures no raster at all** — not for the element-anchored kind and,
  after 2026-09-20, not for the freehand kind either. Strokes are vectors over the live DOM
  and they replay against the *current* page, so the mark cannot go stale in the way a
  screenshot does; when the page moves under it, that is detected and said rather than
  frozen into a picture of how things used to look.
- **Mode-entry cost and sleeping surfaces** — Vercel's toolbar is "sleeping" by default and
  "will not run any tools in the background or show comments on pages" until woken; the
  documented remedy is installing an extension and toggling a preference. A feedback layer
  that must be woken before it will even *show you existing feedback* has already lost the
  dip-in case. Sidepiece's icon is always in its resolvable state or not, with no wake step.
- **Modal takeovers and review-in-a-different-app** — Pastel routes you out of your own tab
  into a Pastel link; Figma comments only exist where the design does; Excalidraw is a
  separate tab. "Context switching: hard to reference exact elements." Everything in this
  product happens beside the page or on it, never instead of it.
- **Losing a comment on navigation or reload** — scored in ybug's own friction table as the
  browser-extension method's defect: "annotations lost on refresh or browser switch." The
  worst possible failure for a tool whose job is externalizing working memory. Answered by
  `chrome.storage.local` keyed by (pjid, page URL) — **and by scoping the pane and the badge
  to the Project rather than the page**, because a batch you can no longer see is the same
  defect wearing a database.
- **A list that dwells** — Vercel's Inbox, Figma's sidebar, BugHerd's kanban are all archives
  with filters, statuses, sorts and threads, and G2 reports BugHerd's "can feel slightly
  laggy when dealing with a high volume of tasks or comments." A running list is a list that
  grows fastest during the session it matters in. See **The Density Contract**.
- **Excalidraw's fatal defect: no output path at all.** Its maintainer-confirmed 2MB /
  1440px-longest-axis limit turned a 1500 × 8500 page capture into roughly 100 × 550 — but
  the resolution loss is not what killed the session. **The drawing is a drawing.** There is
  no Ticket, no Board, no Agent, no Dispatched Command, so the finding must be retyped from
  working memory by a human who still holds it. That is precisely where Jarad stopped. The
  one-button finale in UJ-4 is the entire answer to this, and it is the least de-risked beat
  in the design because nothing in the sweep does it.
- **Every item commits immediately** — Vercel, BugHerd, Figma and Pastel all post on submit;
  BugHerd routes each pin straight onto a kanban board. Nothing in the sweep offers "hold a
  set, commit once." `[v2]`'s batch is unprecedented, which is a differentiator and a risk in
  the same sentence.
- **A login wall or an auth round-trip mid-thought** — the loudest complaint in the category
  and moot here by construction (single operator, tailnet as the trust boundary), recorded so
  nobody reintroduces it as "just a quick confirm dialog."

---

## Responsive & Platform

### Width

- **~320 CSS pixels is a hard floor**, current as of Chrome 149, "hard-coded — no flag, no
  setting, no extension override." One older source says 360px; 320 is the more recent, and
  the real number should be measured on Jarad's own Chrome rather than trusted from either.
- **User-resizable above the floor** by dragging the inner edge.
- **The extension can neither set, suggest, nor read the width.** There is no API, and the
  open feature requests (issues 378404989, 40926440, samples#1011) have no movement. **There
  are no breakpoints in this product**, because there is no way to observe one. Every layout
  claim in this spine is written to hold in the **usable column** — the floor less whatever
  the chosen direction's signature costs, measured at roughly 300 CSS pixels in the mock (see
  **Foundation § Form factor consequences**) — and to degrade gracefully upward. Extra width
  buys longer unwrapped clone paths and more visible Turn text, never a second column and
  never a revealed pane.
- **The user's resize may not stick.** One source reports that closing and reopening resets
  the panel document to its default width; unverified on current Chrome. `[ASSUMPTION: treat 320px as
  the design target on every open, not as a worst case. If geometry resets on close the way
  state does, designing for a comfortable 480px would be designing for a width he rarely
  sees.]`

### First run

The one setup step the product depends on, and the one platform prompt it accepts by design.
Both are one-time and neither is a journey, which is why they are two paragraphs rather than
a flow.

- **The broad host match prompts once, at install, and is accepted.** §5 is explicit: "A
  narrow allowlist reintroduces exactly the origin coupling the model was chosen to remove.
  Sidepiece takes the broad match and **accepts the permission prompt** — it is a
  personally-loaded extension, the prompt is a one-time cost, and no store review applies."
  Chrome renders that prompt; Sidepiece does not, and it renders nothing before or after it.
  There is no onboarding screen, no welcome tab and no first-run Cockpit state — the first
  open is an ordinary open.
- **The action icon must be pinned, and that is the product's only setup step.** Chrome
  hides a newly installed extension's action behind the puzzle-piece overflow until the
  operator pins it. Every journey in this document opens on the icon, the Foundation calls it
  FR-3's only always-on affordance, and an unpinned icon renders its resolvability signal
  into a menu nobody has open. So: **pin the icon.** It is worth saying out loud in whatever
  the install note is, because it is the difference between the icon being a signal and being
  nothing. `[ASSUMPTION: no in-product nudge to pin. A personally-loaded extension installed
  by its only user does not need a coach mark, and a first-run overlay is exactly the kind of
  surface SM-C1 and SM-C2 exist to refuse.]`

### Lifecycle across browser events

| Event | What happens | Consequence |
|---|---|---|
| **Tab switch, same Project** | The panel document **survives**. DOM, JS state and open sockets persist; the service worker messages the long-lived document to re-render (addendum §C) | FR-1's re-evaluation is an in-place re-render keyed by the same `(pjid, generation)`, not a reload. Focus lands on the pane switch. Chat state survives with no persistence work |
| **Tab switch, different Project** | The panel document still survives, but **every pane's content does not**. One atomic re-render onto the new `(pjid, generation)`: the Tickets list is discarded and refetched (P13), the Chat pane loads the new Project's Turns (P15), the pane resets to Tickets, and any Turn in flight stays with the Project that owns it (see **Project changed mid-Turn**) | The document persisting is a platform fact, not a licence to carry content across a pjid boundary. This is the row that keeps SM-3 true on the most common gesture in the product |
| **Switch to a tab with no pjid** | The Cockpit re-renders into DS-1 | Never a stale previous Project (FR-1, P10). The Cockpit does not keep showing the last Project because the last Project is more interesting |
| **Switch to a tab Chrome won't let us read** | The Cockpit re-renders into DS-21 | Distinct from DS-1, because nothing was read and the sentence must not claim otherwise. Routine: `chrome://extensions`, the new-tab page, the Web Store |
| **Panel collapse** | The document is **fully torn down and reloaded** — collapse is the same event as close (`research-mv3-platform.md` §1.3). Real-world consequence reported upstream: "live sync silently stopped on every collapse" | Everything in **Reopen cold start** applies to a collapse, not only to a close. This is the single most commonly misunderstood fact about the platform and it decides where every draft lives |
| **Panel close (icon click or `Alt+Shift+S`)** | Same as collapse | Same. And this is the *intended* exit — the toggle is the dip-out gesture SM-C1 rewards |
| **Bridge restart** | The Bridge goes away and comes back; **nothing in Chrome is reloaded**. FR-15: "Restarting the Bridge does not require reloading the extension." While it is down the Cockpit renders DS-4 or DS-5 (or DS-3 if the tailnet went with it); when it returns, **one re-resolve** is the whole recovery | No tab reload, no extension reload, and DS-16's "reload this tab" sentence must never appear for this cause — it would teach the wrong reflex for the most routine Bridge event there is. The FR-2 cache is invalidated on the unreachable→reachable transition, so what comes back is fresh |
| **Window switch / multi-window** | Chrome's side panel is per-window: two windows are two Cockpit documents with independent caches and independent resolution state. v1 does not synchronize them (§5) | Two Cockpits may legitimately disagree, and **no sync indicator is rendered** — inventing one would imply a guarantee v1 does not make. FR-11's append-per-Turn rule keeps them from clobbering each other. The pane-selection preference is a single global key, so a switch in one window follows to the next open of the other; accepted `[ASSUMPTION: not worth a per-window key for a two-item toggle.]` |
| **SPA navigation** | The panel document is unaffected; the *content script* is the problem. A history-API transition never unloads the document, so a declarative content script does not re-inject. FR-1 requires detection anyway | Detection is re-triggered by an explicit observer, not by injection. UX-visible consequence: a route change inside a SPA re-resolves exactly like a navigation, including into DS-1 if the new route declares nothing |
| **Chrome restart** | **Preserved:** Turn history, because the Bridge holds it keyed by pjid and Turn id (FR-11, FR-15); drafts, pane selection and group-collapse state, because Rule 4 puts them in `chrome.storage.local`. **Not preserved:** anything in the panel document, the SSE subscription, the resolution cache's in-memory copy. **Unknown:** whether Chrome reopens the side panel at all, and whether it restores the resized width | `[ASSUMPTION: assume the Cockpit is closed after a restart and that the first open is a full cold start. Designing for a restored panel document would be designing for behavior nothing in the sweep confirms.]` |
| **Extension reload (dev)** | Content-script contexts are invalidated exactly as a real update does, throwing "Extension context invalidated" in open tabs. The side panel document **does not hot-reload** — it must be closed and reopened | DS-16 exists for this, because in a repo with one operator who is also the developer, a dev-loop failure is a user-facing failure. It is the **only** state that tells the operator to reload anything |

### Local Network Access as a UX-visible event

Chrome's permission prompt reads **"Look for and connect to any device on your local
network."** It is a standard omnibox-anchored bubble, and it is the one moment the transport
becomes visible to the operator.

The prior has moved substantially since the PRD was written, and four of addendum §C's facts
are stale: LNA shipped in **Chrome 142** (2025-09-29), not 153; HTTPS is a **precondition for
asking**, not an exemption; Chrome 146+ splits the permission into Local Network and Loopback
and extends it to WebSockets, WebTransport and WebRTC; and the WICG spec classifies
`100.64.0.0/10` as **`local`**, not ambiguous — with Chrome's Patrick Kettner stating that
extensions with correct host permissions "will not be impacted." The two bugs that broke that
guarantee were fixed by Chrome 144, below the fleet's entire 151–155 range.

**Expected UX: no prompt.** If one appears anyway, the Cockpit's only honest handling is DS-5
plus the note in **State Patterns**, because Chrome's own documentation states no denial
behavior and no recovery path. `[NOTE FOR ARCHITECTURE: correct addendum §C before
`bmad-create-architecture` and `bmad-create-epics-and-stories` consume it — §12 Q7 drops from
discovery to confirmation.]`

### Dark mode, and the seam the extension cannot see

- The Cockpit is an ordinary extension page, so `@media (prefers-color-scheme: dark)` and
  `matchMedia("(prefers-color-scheme: dark)")` both work, and the `change` event fires on a
  live OS theme change. The Cockpit honors it.
- **`prefers-color-scheme` reports the operating system's setting and never Chrome's own
  theme**, and there is no API to read the browser theme from an extension
  (w3c/webextensions#242). Firefox has `browser.theme`; Chrome has nothing.
- **The concrete failure:** a light OS with a dark Chrome theme produces a light Cockpit
  sitting flush against dark browser chrome, with a seam the extension can neither detect nor
  correct.
- **The seam got wider, not narrower, and that was chosen knowingly.** The dark-first default
  this section carried until 2026-09-20 no longer holds: direction 04 is a **light, warm
  paper ground**, and its own author names that as a bet against four years of dark-first
  behavior across every surface Jarad owns. So the common case is now a light Cockpit against
  dark browser chrome — the seam described above, by construction rather than by accident.
  The direction's answer is that the seam *is* the semantics: a sheet laid **on** the page is
  supposed to look laid on, and a panel that blends into the chrome would be camouflage. This
  spine records the trade and does not re-open it.
- **What dark mode is was answered on 2026-09-20: a dark variant in the same register.**
  `prefers-color-scheme: dark` renders **Night Paper** — the paper dimmed, never inverted.
  `DESIGN.md` owns the values; the two constraints this spine set both held. The Cockpit
  **honors `prefers-color-scheme` and the live `change` event** rather than sampling once at
  load, so an OS theme change while the Cockpit is open is followed. And
  **`{colors.overlay.signature}` survives both grounds unchanged** — the register's whole job
  is being recognizable on someone else's page, so a signature that needs a theme to be
  legible is not a signature. `DESIGN.md` bought that invariance at a measured cost (a 2.56:1
  spine on the night ground) and recorded it rather than trading the invariant away.
- **The `[v2]` in-page layer is never themed by this signal.** A guest sheet drawn onto
  somebody else's page is not themed by its host's operator: the hover outline, the comment
  bubble and the annotation pins look the same to Jarad on every site, whatever his OS is set
  to. Only the Cockpit's own ground moves.
- A manual theme override is **not** built in v1 `[DECIDED 2026-09-20: the OS signal drives
  both grounds and no control ships. A single operator on a single machine does not need a
  per-surface theme switch, and one is a preference screen the product otherwise does not
  have. The known imprecision — `prefers-color-scheme` reports the OS and never Chrome's own
  theme, so a light-OS/dark-Chrome session gets Day paper — is accepted, because both grounds
  are the same material and every token that carries meaning is measured on both. Guessing
  wrong here costs comfort, not correctness. If the night ground proves too bright in daily
  use, the fix is a darker paper in `DESIGN.md`, not a control in the Cockpit.]`

---

## Gaps

Decisions only Jarad can make. Carried forward rather than assumed away, because each one
changes what gets built rather than how it is worded.

1. ~~**Does `[v2]`'s element picker justify the `debugger` permission?**~~ **CLOSED
   2026-09-20 — hand-built closed shadow root; `chrome.debugger` rejected, no fallback
   built.** The infobar cost was real, but the deciding argument was that a browser-native
   outline is *Chrome's* mark and cannot wear `{colors.overlay.signature}`. Some pages will
   break the overlay; the design says so out loud rather than rendering a displaced mark.
   See `.decision-log.md`.
2. **The light ground — do you want to live with it?** *Closed as a decision, open as a
   trade.* Direction 04 was picked on 2026-09-20 and the visual fork that blocked two BMAD
   runs is shut. But the direction's author recorded three tensions with it, and two are
   yours rather than `DESIGN.md`'s: a light Cockpit is a bet against four years of dark-first
   behavior on every other surface you own, and the spot hue is simultaneously the whole
   argument and the whole risk — it cannot be de-risked by quietening it, because a quieter
   spot stops being unmistakable on white *and* black. The third tension is a standing cost
   rather than a question: the direction inherits nothing, so it is a second visual world to
   maintain beside Holocene's. None of the three changes what this spine specifies. All three
   change whether you still like it in a week.
3. ~~**What is dark mode, given a light-ground direction?**~~ **CLOSED 2026-09-20 — a dark
   variant in the same register.** `prefers-color-scheme: dark` renders **Night Paper**: the
   paper is *dimmed, not inverted*. Inversion was priced as a second design system rather
   than a token swap — the seven `#191713`-valued tokens all collapse to ~1.02:1 on an
   inverted panel, because "stamped = inverted" has no inverse left. Night Paper changes
   fifteen of the thirty-two colour tokens and keeps the stamp device intact. **This spine's one behavioral constraint held:**
   `{colors.overlay.signature}` is the same mark in both grounds, at the cost of a 2.56:1
   spine on Night Paper, accepted so the signature stays invariant. The OS-signal caveat
   stands — `prefers-color-scheme` reports the OS and never Chrome's theme. See
   `.decision-log.md`.
4. **Is "selector + comment" the whole element-anchored payload, or the PRD §9 payload
   (selector + tag + text snippet + `outerHTML` + URL)?** This spine assumes the larger one
   because a lost anchor has to degrade rather than die — but it changes what the comment
   bubble shows him before he commits.
5. ~~**Is the freehand image load-bearing for the PM?**~~ **CLOSED 2026-09-20 — it is not.**
   "It has to feel like drawing" was the requirement. Strokes render as SVG over the live
   DOM, which deletes `captureVisibleTab`, its two-calls-per-second limit, HiDPI
   physical-pixel handling, the `activeTab` permission and the entire capture-failure path.
   The payload became *richer*, not poorer: stroke geometry in relative coordinates **plus a
   selector set per crossed element**. A raster has to be interpreted; a selector set can be
   acted on. The knock-on is in **Annotation Anchoring and Drift** — the freehand kind is now
   selector-bearing, so it degrades by the same three outcomes as the element-anchored kind
   and adds one of its own. See `.decision-log.md`.
6. **Should an undischarged annotation batch ever expire?** This spine says no — nothing
   expires, nothing is silently deleted, and each row carries its capture time so a stale
   batch looks stale. The alternative is a stated lifetime announced at capture. Silent
   eviction is the one option ruled out here; between "never" and "after N hours, and it says
   so", the call is yours.
7. **Do cross-origin iframes and shadow-DOM elements need to be pickable?** `querySelector`
   crosses neither boundary. This spine reports them as unaddressable at capture time rather
   than capturing an anchor that never resolves.
8. **PRD §12 Q4 — what emits the `pjid` declaration into served pages?** Not a design
   question, but it decides whether DS-1 is an edge case or the product's default state, and
   therefore how much care the unresolved state deserves.
