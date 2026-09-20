---
status: discovery-research
updated: 2026-09-20
project: sidepiece
run: ux-sidepiece-2026-09-20
sweep: prior art — in-page annotation and element pointing
feeds: EXPERIENCE.md § Inspiration and Anti-patterns
rule: facts only. No design solutions proposed. Decisions surfaced as open questions.
---

# Prior Art: In-Page Annotation and Element Pointing

Research sweep for the Sidepiece **Cockpit**. Every claim below is traceable to a page
I actually fetched or a search result I actually read; source quality is labeled inline.
Where a product's own documentation says nothing about something, this report says
**SILENT** — that is a finding, not a gap in the research.

**Source-quality legend**
- `[PRIMARY]` — the vendor's own docs/spec, fetched.
- `[PRIMARY-MKT]` — the vendor's own marketing page, fetched. Claims are self-serving.
- `[COMPETITOR]` — a comparison page written by a rival vendor. Directionally useful,
  structurally biased. Never treated as sole evidence for a negative claim.
- `[SECONDARY]` — third-party blog, review aggregate, or search-engine summary.
- `[BLOCKED]` — I tried to fetch it and could not. G2's pros-and-cons page returned
  **HTTP 403** to direct fetch, so every G2 review quote below arrived via search
  summary and is marked `[SECONDARY]`. Treat those as weaker than the rest.

---

## 1. Chrome DevTools "Inspect element" overlay

The pattern Jarad named by reference. Two vendor docs cover it: Chrome's
`inspect-mode` page and Microsoft Edge's `css/inspect` page (Edge DevTools is the same
Chromium code and documents the overlay in more detail). Both fetched.

### Entry affordance
- Icon: `[PRIMARY]` Chrome — "The selector picker is active when the Inspect mode icon
  is blue." Edge — "The button icon turns blue ... indicating that the **Inspect** tool
  is active."
- Keyboard: `[PRIMARY]` Chrome — macOS `Cmd+Option+C`; Windows/Linux/ChromeOS
  `Ctrl+Shift+C`. Edge — "when DevTools has focus, press **Ctrl+Shift+C** (Windows,
  Linux) or **Command+Shift+C** (macOS)."
- Third path: `[PRIMARY]` Edge — "Right-click anywhere in the demo webpage and then
  select **Inspect**". Context menu is a first-class entry, not a fallback.
- Precondition worth noting: the keyboard chord requires DevTools to already have focus.
  There is no documented way to arm inspect mode from a cold page with one key.

### Hover affordance — what it draws
- `[PRIMARY]` Edge: "When the **Inspect** tool is active, you *hover* over items in the
  webpage, and DevTools adds an information overlay information and grid highlighting on
  the webpage." Also: "When you hover over a page element on the rendered page, the DOM
  tree automatically expands to highlight the element that you are hovering over." —
  i.e. the hover drives a **second surface** simultaneously. Pointing updates the panel.
- Box-model band colors: `[SECONDARY]` (dev.to, Codecademy, and a Google Groups thread;
  **neither Chrome's nor Edge's official page states the color mapping**) — content
  **blue**, padding **green**, border **yellow**, margin **orange**. The official docs
  are SILENT on the color legend, which means the color language is convention, not
  contract.

### The floating info tooltip — exact field list
`[PRIMARY]` Chrome lists, in this order:
> "The selectors of the element. The element's dimensions, in pixels. The element's
> background color. The element's text color. The element's font properties. The
> element's padding, in pixels. The element's margin, in pixels."

`[PRIMARY]` Edge lists:
> "The name of the element. The element's dimensions, in pixels. The element's color, as
> a hexadecimal value and a color swatch. The element's font settings. The element's
> margin and padding, in pixels."

Conditional rendering — `[PRIMARY]` Edge: "Which information is shown depends on the
type of element and the styles applied to it." Layout badge — "If the element is
positioned using CSS grid or CSS flexbox, a different icon appears next to the element's
name."

Accessibility block — `[PRIMARY]` Edge, the tooltip's second section shows:
> "Text-color contrast. The name and the role of the element that's reported to
> assistive technology. Whether the element is keyboard focusable."

With a warning glyph on failures — "for the `Bad Contrast` button, the **Inspect**
overlay has a warning icon next to the contrast value of 1.77."

**The load-bearing detail for Sidepiece:** the first field in Chrome's list is *the
selectors of the element*. The overlay's primary job is to tell you, before you commit,
exactly which node the tool thinks you mean. That is the confidence loop the decision log
describes as "user points → agent says okay → user *trusts* it understood," already
solved by a tooltip.

### Modifier vocabulary
- `[PRIMARY]` Persist the tooltip while moving: hold `Ctrl+Alt` (Windows/Linux) or
  `Ctrl+Option` (macOS). Edge: "The existing tooltip and grid color overlay for the
  **Inspect** tool remains displayed while you hover over different parts of the
  rendered webpage."
- `[PRIMARY]` Temporarily hide the overlay: hold `Ctrl`. Edge: "To hide the **Inspect**
  tool's overlay while you move the mouse pointer over the rendered webpage."
- `[PRIMARY]` Reach an element behind `pointer-events: none`: hold `Shift`. Edge:
  "Elements that have the CSS property of `pointer-events: none` aren't available to the
  **Inspect** tool ... the parent element (`div.wrapper`) is shown instead." And the mode
  announces itself: "There's also a color overlay on page layout regions, indicating that
  you are in an advanced selection mode."

### Click behavior
`[PRIMARY]` Edge, verbatim — on click:
> "The **Inspect** tool is deactivated. The corresponding DOM node is highlighted. The
> **Styles** tool shows the CSS that's applied to the element."

and separately: "Clicking in the webpage also turns off **Inspect** mode in the webpage."

**One click both selects and disarms.** There is no sticky multi-select mode documented.
That is a direct structural conflict with Jarad's narrated journey, where he picks
several elements in a row and accumulates a list — see Open Question 7.

### Escape behavior
**SILENT.** Neither the Chrome `inspect-mode` page nor the Edge `css/inspect` page
documents `Escape` at all. The only documented exits are clicking an element or toggling
the icon. Do not assume Escape-to-cancel is an inherited convention here; it isn't
documented by the pattern Sidepiece is copying.

### Detailed-tooltip toggle
`[SECONDARY]` (search summary of opensauce.it and devtoolstips.org) — the rich tooltip
can be turned off at **Settings > Preferences > Elements > Show Detailed Inspect
Tooltip**. Not confirmed on a primary page in this sweep. Worth knowing that the vendor
itself treats tooltip density as a user preference.

---

## 2. Vercel Toolbar comments — closest architectural analogue

An injected overlay on a live page that anchors comments to DOM elements and routes them
to an external system. Four Vercel doc pages plus one Vercel engineering blog fetched.

### Anchoring payload
`[PRIMARY]` Vercel engineering blog ("Using Vercel comments to improve the Next.js 13
documentation"), verbatim:
> "A comment marks exactly in the UI where things need to improve as it's actually
> attached to the underlying DOM element."

That is the strongest primary-source statement in this entire sweep that element-anchored
commenting on a live page is a shipped, load-bearing production pattern. **However:** the
docs never disclose the serialization — no CSS selector, XPath, node path, or
`data-*` attribute is named anywhere in `/docs/comments`, `/docs/comments/using-comments`,
or `/docs/comments/managing-comments`. The anchor format is **SILENT / opaque**.

### Entry affordance
- `[PRIMARY]` `/docs/comments/using-comments`: "You must be logged in to create a
  comment. You can press `c` to enable the comment placement cursor."
- `[PRIMARY]` `/docs/comments`: "Open the toolbar menu and select **Comment** or the
  comment bubble icon in shortcuts. Then, click on the page or highlight text to place
  your comment."
- The cost before that keypress — `[PRIMARY]` `/docs/comments`:
  > "Comments are a feature of the Vercel Toolbar and the toolbar must be active to see
  > comments left on a page. ... By default, when the toolbar first shows up on your
  > deployments it is sleeping. This means it will not run any tools in the background or
  > show comments on pages."

  The documented remedy is to install the browser extension and toggle **Always
  Activate** in **Preferences**. Sleeping-by-default is a real, vendor-acknowledged
  friction tax; see Anti-pattern A1.

### Comment capture UI — three payload shapes from one mode
`[PRIMARY]` `/docs/comments/using-comments`, verbatim:
> "Click the plus icon that shows when drafting a comment to upload a file.
> Click the camera icon to take a screenshot of the page you are on.
> Click and drag while in commenting mode to automatically screenshot a portion of the
> page and start a comment with it attached."
> "The latter two options are only available to users with the browser extension
> installed."

**This is the single most relevant finding for Jarad's two-payload split.** Within one
armed mode, a *click* produces an element-anchored comment with no image, and a *drag*
produces a region-screenshot comment. The gesture itself selects the payload type, with
no mode switch. Vercel ships exactly the click-vs-drag distinction Jarad described as
"selector + comment" vs "image + relative coordinates" — except Vercel's drag is a
rectangular region capture, not freehand markup, and Vercel does **not** document
relative coordinates as part of the payload.

Also in the capture UI: `@` mentions, `:emoji:` autocomplete, emoji reactions, and full
Markdown (`Ctrl/⌘+B` bold, `+I` italic, `+Shift+X` strikethrough, `+E` code, `-`/`*`
lists, `>` quotes).

### List / review surface
`[PRIMARY]` `/docs/comments/using-comments`:
- "Every new comment placed on a page begins a thread. The comment author, PR owner, and
  anyone participating in the conversation will see the thread listed in their **Inbox**."
- "The Inbox can be opened by selecting the **Inbox** option in the toolbar menu. A small
  badge will indicate if any comments have been added since you last checked. You can
  navigate between threads using the up and down arrows near the top of the inbox."
- "You can move the **Inbox** to the left or right side of the screen by selecting the
  top of the Inbox modal and dragging it."
- Filters: "**Filter by page**: Show comments across all pages in the inbox, or only
  those that appear on the page you're currently viewing" and "**Filter by status**: Show
  comments in the inbox regardless of status, or either show resolved or unresolved."
- Deep-linking: "Select a comment in the **Inbox**. When you do, the URL will update with
  an anchor to the selected comment."

`[PRIMARY]` `/docs/comments/managing-comments`: resolve via a "**☐ Resolve** checkbox
that appears under each thread or comment," reachable "by selecting a comment wherever it
appears on the page, or by selecting the thread associated with the comment in the
**Inbox**." Dashboard notifications support filtering by Author, Status, Project, Page,
Branch, plus full-text search.

**Note the Inbox is a modal panel docked left or right of the page — a side panel
listing annotations for the page you are looking at.** Structurally identical to the
Cockpit position.

### Submission / batch model
**No batch.** Each comment is submitted individually and immediately becomes a thread.
There is no documented "send all" or end-of-session commit anywhere in Vercel's comment
docs. Routing to downstream systems is automatic and per-thread: comments surface on the
associated GitHub PR, and `[PRIMARY]` "When you configure Vercel's Slack integration,
comment threads on linked branches will create Slack threads."

Terminal path exists: `[PRIMARY]` `/docs/cli/comments` — "Review and manage Vercel
Toolbar comment threads from the terminal with the `vercel comments` CLI command."
Relevant to Sidepiece because Jarad's stated pain is that visual things are hard to
*describe* from a terminal; Vercel's answer is to let the terminal *read* what the
browser pointed at.

### Selector drift handling
**SILENT on the core case.** Nothing in Vercel's comment docs describes what happens when
the anchored DOM element changes, moves, or is removed. What *is* documented is
adjacent and instructive:

- `[PRIMARY]` Outdated deployments: "Sometimes, issues appear on a webpage for certain
  browsers and devices, but not for others. It's also possible for users to leave
  comments on a preview while viewing an outdated deployment." The remedy is not
  re-anchoring — it is **environment forensics**. A screen icon beside the commenter's
  name copies a session JSON:
  ```json
  { "browserInfo": { "ua": "...", "browser": {...}, "engine": {...}, "os": {...} },
    "screenWidth": 1619, "screenHeight": 1284,
    "devicePixelRatio": 1.7999999523162842,
    "deploymentUrl": "vercel-site-7p6d5t8vq.vercel.sh" }
  ```
  Hovering a timestamp shows an abbreviated version: browser name and version, window
  dimensions, device pixel ratio, and which deployment they were viewing.
- `[PRIMARY]` URL identity is a known failure: "Comments left on pages with query params
  in the URL may not appear on the page when you visit the base URL. Filter by page and
  search with a `*` wildcard to see all pages with similar URLs."
- `[PRIMARY]` Injection constraints: "The comments toolbar will only render on sites with
  HTML set as the Content-Type. Additionally, on Next.js sites, the comments toolbar will
  only render on Next.js pages and not on API routes or static files."
- `[PRIMARY]` When a new deployment lands: "a popup modal in the bottom-right corner of
  the deployment will prompt you to refresh your view."

### Documented outcome
`[PRIMARY]` Vercel blog, on the friction delta and the volume it unlocked:
> "A reviewer doesn't have to go through the process of taking screenshots, posting in
> other channels, or going out of their way to give extra detail to their product owner
> about the circumstances of their feedback."
> "Because of this ease, over 2,000 reviewers felt empowered to express their thoughts so
> far. With 509 discussion threads started..."
> "With comments, we were able to act on feedback faster and more precisely, while
> spending less time trying to figure out ***where*** the issue is so that we can address
> it."

---

## 3. BugHerd

The most mature element-pinning model in the commercial set. Feature pages and the
support Help Center fetched.

### Anchoring payload
- `[PRIMARY-MKT]` bugherd.com/website-annotation-tool: "Automatically attached to every
  user annotation is technical data like browser info, operating system, exact website
  URL, screen resolution, and even **the element where the problem occurs**."
- `[PRIMARY-MKT]` bugherd.com/feature/easy-website-annotations: pins "remain attached to
  the element until the feedback or bug is resolved."
- **But the serialization is not exposed.** `[PRIMARY]` The support article "Customizing
  the Metadata captured by BugHerd" documents only developer-supplied key/value pairs
  (`username`, `version`, `logged_in`, arbitrary keys; "The `metadata` object is comprised
  of simple key/value pairs" and "the values are strings") plus `reporter.email` and
  `reporter.required`. **No CSS selector, XPath, or DOM-path field is documented as
  readable by an integrator.** The anchor is internal.
- A screenshot is captured automatically alongside the pin, including the pin itself
  `[PRIMARY-MKT]`. So BugHerd ships *both* payloads on every item, whether or not the
  item needed a picture.

### Entry affordance
`[PRIMARY-MKT]`: "clients and team members simply click the plus button, then select
where to leave feedback." The sidebar is persistently docked — described as working
"like an overlay on your website."

### Hover affordance
`[PRIMARY-MKT]`, verbatim:
> "As you or your clients scroll over the page, BugHerd highlights each section, so you
> can be sure feedback is pinned to the right spot."

Note the wording: "highlights each **section**," not *element*. BugHerd markets
region-granularity confidence, where DevTools markets node-granularity identity. Nothing
in BugHerd's public pages shows a DevTools-class tooltip naming the resolved node.

### List / review surface — two of them
1. **On the page.** Pins persist visibly. `[COMPETITOR]` simplecommenter: "Every other
   reviewer visiting the page sees the existing pins, which is precisely what kills the
   duplicate-report problem." `[PRIMARY-MKT]` frames the same property as "preventing
   duplicated feedback on the same issue."
2. **Off the page.** `[PRIMARY-MKT]`: "every piece of feedback collected through BugHerd
   is automatically routed to a user-friendly kanban-style board."

### Submission / batch model
**No batch, and no draft state.** Each pin becomes a board task on creation. The board is
the triage surface *after* the fact. Nothing documents holding a set of pins and
committing them together.

### Selector drift handling
This is the only vendor in the sweep with a public article on anchor failure, and it is
about **URL identity, not DOM identity**:

- `[PRIMARY]` Help Center article title, verbatim: **"How do I make sure BugHerd shows
  pins on the correct screen in a single-page web app (SPA)?"** Documented fix: set or
  update `window.BugHerdConfig.location` to tell BugHerd the correct page URL. (I could
  not fetch the article body — the deep link 404'd — so the fix is sourced from the
  collection listing and search summary, `[SECONDARY]` for the body, `[PRIMARY]` for the
  title's existence.)
- Adjacent Help Center article titles, fetched verbatim from the Troubleshooting & FAQ
  collection: **"Help! The BugHerd sidebar isn't appearing!"**, **"Why is the BugHerd
  browser extension taking a long time to load?"**, **"Re-Install Browser Extensions"**,
  **"Why is BugHerd blocked from loading on my website?"**, **"Content Security Policy
  (CSP)"**.

The shape of that FAQ list is itself the finding: for an injected annotation layer, the
documented failure surface is *getting the layer onto the page at all* — CSP, blocking,
extension load time, sidebar absence — plus URL identity in SPAs. DOM drift is SILENT.

### Reporter cost — CONFLICTING SOURCES
- `[PRIMARY-MKT]` bugherd.com/website-annotation-tool comparison table lists "No login or
  account set up for clients."
- `[COMPETITOR]` simplecommenter: "Named reviewers must log in through BugHerd's hub
  first," with anonymous access only via a separate "public feedback" path.
- `[COMPETITOR]` commentblocks/feedbucket, via search: on BugHerd's entry-tier plan,
  "JavaScript installation is locked behind higher tiers" so "every client who needs to
  leave feedback must install the browser extension."

I could not adjudicate this. Marked as conflicting; the direction of each source's bias
is obvious and neither is disinterested. Irrelevant to Sidepiece's single-operator case
anyway, but it is the loudest complaint in the category.

### Complaints
`[SECONDARY]` — G2 pros-and-cons page was `[BLOCKED]` at HTTP 403, so these arrived via
search summary of that page and of third-party reviews. Weight accordingly:
- "The interface can feel slightly laggy when dealing with a high volume of tasks or
  comments."
- "Installing the browser plugin didn't work initially - reviewers had to quit and reopen
  their browser."
- Users "unable to view captured and uploaded screenshots without opening a new window."
- "Using some of the features can be a little tricky to set up right."

---

## 4. Marker.io

### Anchoring payload
**Screenshot-based. No element pinning documented anywhere.**
- `[PRIMARY]` help.marker.io integration article: "The screenshot can be annotated."
  Auto-captured metadata: "Page URL", "Browser", "Screen size", "Operating system";
  optional `reporter` identity and `customData`; and for member-level users "Session
  replay videos, console logs and network requests."
- `[PRIMARY-MKT]` marker.io/features: describes "visual markups," "website annotations,"
  "high-fidelity screen capture," "Metadata, screenshots, and technical logs," "Network
  logs," and "Browser, OS, webpage and screen size are automatically added to your
  issues." **The page never mentions element or selector pinning.** It also does not
  enumerate the drawing tools (arrow/box/pen/text are not listed).
- `[COMPETITOR]` simplecommenter's characterization of the loop: "You open the widget,
  capture a screenshot, fill out what is essentially a ticket form, and it lands in your
  tracker."

### Entry affordance
`[PRIMARY]` JS snippet or npm: `npm i -D @marker.io/browser`, then
`const widget = await markerSDK.loadWidget({ project: '...' });`.
`[PRIMARY-MKT]` the loop is branded "Click, annotate, send."

### List / review surface
**SILENT.** marker.io/features does not document any on-page list of existing reports.
`[COMPETITOR]` simplecommenter draws the consequence: "Reviewers cannot see existing
tickets on the page, so duplicates are routine." Treat the consequence as a competitor
claim; treat the silence as verified.

### Submission / batch model
Per-report, into an external tracker. `[PRIMARY-MKT]`: "Connect website feedback and bug
reports to the tools your team already uses" — Jira, Linear, Trello, GitHub, ClickUp,
Asana.

### Reporter cost — CONFLICTING
`[PRIMARY-MKT]` marker.io/features: "No account needed for reporting."
`[COMPETITOR]` simplecommenter: "Everyone leaving feedback must be logged in."
Unresolved. Flagged.

### Selector drift handling
**N/A by construction** — there is no selector. The image is the anchor, and images do
not drift; they go stale. See Anti-pattern A3.

---

## 5. Pastel

### Anchoring payload
`[PRIMARY-MKT]` usepastel.com/website-annotation-tool, verbatim and unusually explicit:
> "All their comments are on actual elements of the website, not screenshots."
> "Every annotations is pinned to a specific element and records information like screen
> resolution and browser type."

Pastel markets element-anchoring *as the differentiator against screenshots*. Same claim
class as BugHerd and Vercel; the serialization is again undocumented — **SILENT**.

### Entry affordance — the distinguishing cost
`[PRIMARY-MKT]`: "Type in a URL and share a link with anyone to invite them to start
annotating any website." Then "Your clients can click and type to start leaving
feedback."

**You do not annotate in your own tab.** You leave your tab, hand a URL to Pastel, get a
Pastel link, and review inside Pastel's surface. That is a different friction class from
everything else in this sweep — see the ladder in §10.

### Comment capture UI
`[SECONDARY]` (search summary of Pastel help/marketing): a **comment mode / browse mode**
toggle — "comment mode lets you click anywhere and type a comment, and browse mode lets
you browse the full website with all links fully working."

Two-mode design is a direct consequence of injecting a click-capturing layer over a page
whose own clicks still need to work. Every tool here faces it; Pastel is the one that
documents the toggle as a named user-facing mode.

### List / review surface
**SILENT** on the vendor page I fetched. `[SECONDARY]`: "You can easily hit the resolve
button to take comments to the resolve section."

### Selector drift handling
The closest thing to a documented drift story in the entire sweep, and it is a
*refresh-the-page* answer, not a re-anchor answer — `[SECONDARY]`:
> "When you make changes to your website during the feedback process, Pastel will pull in
> the latest version to keep everyone in the loop."

---

## 6. Usersnap

`[PRIMARY]` help.usersnap.com plus `[PRIMARY-MKT]` product pages.

- **Anchoring:** screenshot + drawn annotation. No element anchoring documented —
  **SILENT**.
- **Entry:** two deployment modes — browser extension or embedded widget. `[PRIMARY]`
  "Browser extensions allow teams to take screenshots and submit feedback to Usersnap
  without feedback widgets installed on target sites or web applications." Chrome and
  Firefox supported.
- **Capture UI:** "add comments, annotations, and draw on websites/web applications";
  notably, **"add multiple comments in one report."** That is the one documented instance
  in this sweep of multiple distinct pieces of feedback batched into a single submission
  — but they are batched onto *one screenshot*, not across a browsing session.
- **Metadata:** browser, screen size, URL, screen resolution, OS, location.
- **List surface:** SILENT on any on-page list.
- **Drift:** N/A — raster anchor.

## 7. Userback

`[PRIMARY-MKT]` userback.io/feature/screen-annotation plus `[PRIMARY]` support docs.

- **Anchoring:** explicitly on the raster. "Annotations are applied to screenshots"
  rather than marking live DOM elements.
- **Drawing tools — the most complete freehand toolset documented in this sweep:**
  "draw arrows, circles, and shapes on screenshots to highlight specific areas," "Adds
  text boxes and notes to explain issues in context," and "Provides freehand drawing for
  precise markup."
- **Auto-capture:** "Automatically capture session replays for even more context" and
  "Capture metadata and console logs to help your developers."
- **The one place Userback does use selectors** `[PRIMARY]` support.userback.io/session-
  replay — privacy masking: "during playback, you can specify which selectors to ignore,
  ensuring no sensitive information is ever displayed." Selectors are used to *exclude*
  DOM, never to *anchor* feedback to it.
- **Entry affordance, list surface, submission model:** SILENT on the pages fetched.

## 8. Ruttl

`[PRIMARY-MKT]` ruttl.com, fetched. Thin on mechanics.

- **Anchoring:** "pixel-level feedback" / "pixel-perfect" — coordinate language, not
  element language. Whether a comment holds a selector is **SILENT**.
- **The distinguishing capability:** a comment mode *and* an edit mode that makes real
  CSS changes. "Make live site changes using pixel-level feedback left via comments now!"
  Feedback and fix collapse into one surface.
- **Reporter cost:** collect feedback "without asking them to sign up." Guests join by
  link.
- **Install:** "Plug and play with WordPress, Shopify, Custom HTML + CSS and more,
  instantly." Per-site install.
- **List surface / batch model / drift:** SILENT on all three.
- Marketing metric, unverifiable: "Improve team efficiency by +50%."

## 9. Figma / FigJam comments — the pin-and-thread reference

`[PRIMARY]` help.figma.com "View and manage comments," fetched, plus `[SECONDARY]`
help-center and forum summaries.

### Entry affordance
`[PRIMARY]` "clicking in the main toolbar or pressing **C** to enter comment mode."
Same key as Vercel (`c`) and Linear (`C`). Three independent products converged on it.

### Anchoring payload — partial object-attachment, honestly documented
`[SECONDARY]` (help-center article "Move or edit comments", via search):
> "Figma will attach your comment to frames when you pin a comment or select a region
> inside a top-level frame, component, or group. If those frames are moved around the
> canvas, their comments move with them."
> "...comments won't attach to any nested frames, components, groups, or other layers. If
> the comment was linked to the canvas—not the layer or frame itself—Figma won't move the
> comment."

So Figma anchors to **top-level containers only**, and silently degrades to canvas
coordinates otherwise. The documented workaround is manual — `[PRIMARY]`: "To keep a
comment visible while you make edits to your designs, drag it to a new part of the
canvas."

This is a mature product choosing shallow anchoring over deep anchoring, and it is a
long-running user complaint: the Figma forum feature request **"Keep Comments pinned to
design elements (including nested)"** runs to eight-plus pages, alongside a separate
request **"comments stick to object instead of position on layout."** `[SECONDARY]`

### List / review surface — the "unresolved comments list" pattern
`[PRIMARY]`, verbatim:
- "view, search, sort, and filter comments. Click on a comment in the right sidebar to
  open it in the canvas"
- Sort: "**Date**: displayed in order from the first comment in a thread" or
  "**Unresolved**: displayed by date, prioritizing comments that haven't been read"
- Filter: "Check **Only your threads** to view the comments that are relevant to you";
  "You can also decide if you'd like to **Show resolved comments**"
- Resolve: "Once the feedback has been addressed, or a resolution reached, you can
  **Resolve** the comment. **This will hide the comment from both the right sidebar and
  the canvas.**"

The last clause is the pattern: one resolve action clears the item from *both* the list
and the surface simultaneously. List and overlay are two views of one state.

### Submission / batch model
No batch. Threads are live on post.

---

## 10. Linear and GitHub — the fast-capture-then-triage pattern

Not annotation tools. Included because they are the state of the art at the *other* half
of Jarad's loop: getting a thought out of working memory in one keystroke and sorting it
out later.

### Linear `[PRIMARY]` linear.app/docs/creating-issues
- "Use the keyboard shortcut `C` to open up an issue creation modal." From anywhere.
- "To create an issue from a template, use `Option/Alt + C`."
- Other entry points: "Click the **Create new issue** icon in the upper left of the app";
  "Enter https://linear.new into your browser URL bar"; "Highlight text and click the
  **Create issue from selection** icon in the formatting bar."
- **The grace window — the single best capture-then-triage mechanic found:**
  > "Changes made to an issue's properties in the first 3 minutes are considered part of
  > the issue creation process, and won't be added to the activity log as changes to the
  > issue."

  You can file it dirty and clean it up without the record accusing you of changing your
  mind. The cost of filing prematurely is engineered to zero.
- **Draft survival:**
  > "Linear will hide the issue modal and keep a temporary draft. The next time you go to
  > create an issue, the editor will re-open with the previous content draft."
  > "If you use `Esc` or click on the close button, a pop-up modal will appear giving you
  > the option to save the issue as a draft. This draft type persists across clients."
- Triage: `[SECONDARY]` `G` then `T` for Triage, `G` then `I` for Inbox; "Triage is meant
  to be worked quickly, with each action having keyboard shortcuts available."

### GitHub `[SECONDARY]` (docs + GitHub blog, via search)
- Highlight text, press `R` → the selection is inserted into your comment box already
  formatted as a blockquote. Selection becomes context in one key.
- Press `Y` while viewing a file → the URL is rewritten to a commit-pinned permalink.
  **An explicit act of freezing a reference so it cannot drift** — the inverse of a live
  selector, and the only prior art in this sweep for deliberately trading liveness for
  durability.
- `C` creates an issue from issue and PR lists. `?` shows the shortcut sheet.

---

## 11. Excalidraw — the incumbent being abandoned

Jarad: "I got tired of using it, so I stopped with only the annotate." This section
separates what is genuinely good from what makes it wrong for this loop.

### What it is genuinely good at — keep this
`[SECONDARY]` (Wikipedia, G2, multiple review roundups):
- **Zero setup, zero account.** "It's the kind of tool you can pull up mid-conversation
  to explain an idea, without needing to prepare or set anything up in advance."
- **Infinite canvas**, real-time multi-user collaboration with client-side end-to-end
  encryption, instant shareable room links (the `#room=` URL in Jarad's own journey).
- **The hand-drawn register carries meaning.** "The hand-drawn look keeps things informal
  and unintimidating, encouraging participation from teammates who might not be
  comfortable with traditional design tools." Freehand markup reads as *a thought*, not
  *a spec* — which is exactly right for "this is supposed to be a guy but looks like
  garbage."
- Free and open source.

### Why it is high-friction in *this* loop — five structural reasons

1. **It is a different application.** Nothing about the page under review travels with
   you: no URL, no DOM, no **Project Record**, no **pjid**. The reference has to be
   reconstructed by hand on the far side.
2. **The capture is static, and staleness is immediate.** `[SECONDARY]` ybug's annotation
   guide states the general failure: "Screenshots get outdated the moment the page
   changes. If a fix was already applied and someone's screenshot is from before that
   change, the team wastes time reviewing something that no longer exists." And on the
   specific pattern Jarad was running: "Trying to give feedback on a live site using
   annotated image exports is the pattern that leads to the most version confusion. **If
   the page exists, annotate it directly.**"
3. **Resolution is destroyed on import — documented, with a hard number.** `[PRIMARY]`
   GitHub discussion excalidraw/excalidraw#4302. The reporter uploaded a 2.1 MB PNG at
   1500 × 8500: "This got uploaded as a highly downscaled image, roughly 100 x 550
   pixels. It truly lost precision – making it larger shows the lack of pixels."
   Maintainer **dwelle** states the constraint: **"We have a 2MB limit, after resizing the
   image to 1440px (largest axis)."** A second user, on this exact use case: "I wanted to
   use excalidraw to annotate a large image...And this makes it difficult to use for this
   purpose." Maintainer on why it stays: "The problem is there are wildly different use
   cases and we likely won't be able to come up with a 'one size fits all' solution."

   A full-page screenshot of a real web page is precisely the input Excalidraw is
   documented as unable to hold at fidelity. The blurring Jarad hit is a known,
   maintainer-confirmed product constraint, not his setup.
4. **No output path.** The drawing is a drawing. There is no **Ticket**, no **Board**, no
   **Agent**, no **Dispatched Command** — the feedback must be retyped somewhere else by
   a human who still holds it in working memory. This is the step where Jarad's session
   died.
5. **No reusable primitives.** `[SECONDARY]` "You have to 'draw' a button (rectangle +
   text) every time, rather than dragging in a pre-made 'Button'." Every annotation
   restarts from nothing. Plus documented "performance issues on massive diagrams."

---

## 12. The anchoring-payload standard nobody in this sweep implements

`[PRIMARY]` W3C Web Annotation Data Model (`w3.org/TR/annotation-model/`), fetched.
This is the only formal spec for the payload question Jarad's journey raises, and it is
worth naming because **every commercial tool above keeps its anchor format private while
a W3C Recommendation for exactly this has existed for years.**

Selector types defined: `FragmentSelector`, `CssSelector`, `XPathSelector`,
`TextQuoteSelector`, `TextPositionSelector`, `DataPositionSelector`, `SvgSelector`,
`RangeSelector`.

The two clauses that matter here, verbatim:
> "Multiple Selectors _SHOULD_ select the same content, however some Selectors will not
> have the same precision as others. Consuming user agents _MUST_ pick one of the
> described segments, if they are different."

> "A Selector _MAY_ be `refinedBy` 1 or more other Selectors. If more than 1 is given,
> then they are considered to be alternatives that will result in the same selection."

So the standard's answer to drift is **redundancy**: ship several independent selectors
for the same target and let the consumer pick whichever still resolves. `[SECONDARY]`
Implementations pair `TextPositionSelector` with `TextQuoteSelector` "for robustness,"
with the text quote acting as the recovery path.

And the honest admission, `[SECONDARY]` from the W3C Web Annotation Working Group's own
status page:
> "The needs of a Client-Side API for Annotations as well as the topic of **Robust
> Anchoring** were under exploration, but **no output were produced during the current
> charter**."

**Robust anchoring is an openly unsolved problem at the standards level.** No tool in
this sweep has solved it either; they have all chosen to not document the failure.

---

## 13. Patterns worth stealing

Each with the tool it came from. These are observations, not recommendations — the
**Cockpit** design decisions remain Jarad's.

| # | Pattern | From | What it buys |
|---|---|---|---|
| P1 | Hover tooltip whose **first field is the element's selector** | Chrome DevTools | The tool proves what it resolved *before* you commit. This is the "agent says okay" trust loop, delivered pre-click. |
| P2 | Hovering the page simultaneously drives a second surface (DOM tree auto-expands to the hovered node) | Edge DevTools | Pointing on the page and the panel stay in lockstep without a round trip. |
| P3 | Mode-armed indicator: the icon turns blue | Chrome + Edge DevTools | One glance answers "am I about to click, or about to annotate?" |
| P4 | Modifier keys to **freeze** (`Ctrl+Alt`) and **hide** (`Ctrl`) the overlay | DevTools | You can point, hold, and read without committing — and get the page back without disarming. |
| P5 | `Shift` to reach elements under `pointer-events: none`, with the overlay announcing the advanced mode | DevTools | A documented escape hatch for exactly the overlay-covered case, plus a visible mode change so it isn't silent. |
| P6 | Click **selects and disarms** in one action | DevTools | No lingering armed state. (Conflicts with multi-annotation sessions — see OQ7.) |
| P7 | **Single-key mode entry**, and it is the same key everywhere: `c` | Vercel, Figma, Linear, GitHub | Four independent products converged on `c` for "start capturing a thing." |
| P8 | **Click vs. drag selects the payload type inside one armed mode** — click → element-anchored comment, drag → region screenshot attached | Vercel Toolbar | Ships Jarad's exact two-payload split with zero mode-switching cost. |
| P9 | Element-anchored comment with **no mandatory image** | Vercel, BugHerd, Pastel | Three shipped products prove the no-image path is viable. Pastel markets it as the differentiator: "on actual elements of the website, not screenshots." |
| P10 | Existing pins visible on the page | BugHerd | Kills duplicate feedback; the page itself becomes the memory. |
| P11 | Docked list panel with **filter-by-current-page** and **filter-by-status** | Vercel Inbox | The list can be global while reading as local. |
| P12 | Sort by **Unresolved**, "prioritizing comments that haven't been read" | Figma | The list self-orders toward what still needs you. |
| P13 | One **Resolve** clears the item from the list **and** the surface simultaneously | Figma | List and overlay are two views of one state, never two states. |
| P14 | Copyable environment JSON per comment (`browserInfo`, `screenWidth/Height`, `devicePixelRatio`, `deploymentUrl`) | Vercel | When the anchor is ambiguous, the environment disambiguates. Forensics as a fallback for anchoring. |
| P15 | **3-minute grace window** where edits count as part of creation and never hit the activity log | Linear | Makes filing-before-thinking free. Directly targets the ADHD cost of "is this worth a ticket yet?" |
| P16 | Draft survives closing the modal and **persists across clients** | Linear | Interruption does not destroy the capture. |
| P17 | Selection → formatted artifact in one key (`R` quotes selection, `Y` freezes a permalink) | GitHub | `Y` in particular: deliberately trading liveness for durability at capture time. |
| P18 | **Multiple redundant selectors per target**, with `refinedBy` alternatives and a text-quote recovery path | W3C Web Annotation Data Model | The only published answer to selector drift. |
| P19 | Named **comment mode / browse mode** toggle | Pastel | Acknowledges out loud that an annotation layer steals the page's own clicks. |
| P20 | Terminal-side read access to browser-placed comments (`vercel comments`) | Vercel CLI | The browser points; the terminal reads. Inverts Jarad's stated pain rather than replacing the terminal. |
| P21 | Zero-setup freehand on an infinite canvas in an informal hand-drawn register | Excalidraw | The part worth keeping: drawn markup reads as a thought, not a spec. |

---

## 14. Anti-patterns — observed failure modes, with citations

**A1 — The surface is asleep when you need it.** `[PRIMARY]` Vercel: "By default, when
the toolbar first shows up on your deployments it is sleeping. This means it will not run
any tools in the background or show comments on pages." The documented fix is to install
an extension and toggle **Always Activate**. A feedback layer that must be woken before
it will even *show you existing feedback* has already lost the dip-in-dip-out case.

**A2 — Login wall on the reporter.** `[PRIMARY]` Vercel: "You must be logged in to create
a comment," and "The only requirement is that all users must have a Vercel account."
`[COMPETITOR]` on the category: "none of these tools make it free to report, every one
expects the reporter to be someone you have set up." Moot for a single operator, but it
is the loudest complaint in the category and it is always an auth round-trip mid-thought.

**A3 — Mandatory screenshot on every item.** Marker.io, Usersnap, Userback all anchor to
a raster; BugHerd captures one automatically even for a pinned element. `[COMPETITOR]`
description of the Marker.io loop: "You open the widget, capture a screenshot, fill out
what is essentially a ticket form, and it lands in your tracker." Every note pays for a
capture + annotate + form-fill, including "this button is 2px off," which needed only a
selector. And the image starts rotting on arrival — `[SECONDARY]` ybug: "Screenshots get
outdated the moment the page changes."

**A4 — Page-breaking or blocked injection.** `[PRIMARY]` BugHerd's own Troubleshooting
FAQ article titles: **"Why is BugHerd blocked from loading on my website?"**, **"Content
Security Policy (CSP)"**, **"Help! The BugHerd sidebar isn't appearing!"**, **"Why is the
BugHerd browser extension taking a long time to load?"**. `[SECONDARY]` G2: "Installing
the browser plugin didn't work initially - reviewers had to quit and reopen their
browser." For injected layers, the documented failure surface is dominated by *getting
onto the page at all*.

**A5 — Content-type and route restrictions.** `[PRIMARY]` Vercel: "The comments toolbar
will only render on sites with HTML set as the Content-Type. Additionally, on Next.js
sites, the comments toolbar will only render on Next.js pages and not on API routes or
static files." The layer silently does not exist on some pages.

**A6 — Silent anchor loss, three documented flavors, zero documented user-facing
handling.**
- URL identity: `[PRIMARY]` Vercel — "Comments left on pages with query params in the URL
  may not appear on the page when you visit the base URL."
- SPA route identity: `[PRIMARY]` BugHerd — the article **"How do I make sure BugHerd
  shows pins on the correct screen in a single-page web app (SPA)?"** exists at all, and
  the fix is for the *site owner* to set `window.BugHerdConfig.location`.
- Depth of attachment: `[SECONDARY]` Figma — "comments won't attach to any nested frames,
  components, groups, or other layers," degrading silently to canvas coordinates. The
  documented workaround is to drag the comment by hand.

**No tool in this sweep documents what the user sees when the anchored element is
gone.** Every vendor asserts pins "remain attached to the element"; not one publishes
the failure state. `[SECONDARY]` industry commentary names the real hazard: "Silent
failure is the real enemy — not breakage itself."

**A7 — Losing the capture on navigation or reload.** `[SECONDARY]` ybug's friction table
scores the browser-extension method as: local only, "annotations lost on refresh or
browser switch." The worst possible failure for a working-memory externalization tool is
the one that eats what you already externalized.

**A8 — The list goes laggy exactly when it is full.** `[SECONDARY]` G2 on BugHerd: "The
interface can feel slightly laggy when dealing with a high volume of tasks or comments."
A running annotation list is a list that grows fastest during the session it matters in.

**A9 — Resolution destroyed in the capture path.** `[PRIMARY]` Excalidraw maintainer:
"We have a 2MB limit, after resizing the image to 1440px (largest axis)." A full-page
screenshot at 1500 × 8500 came back at roughly 100 × 550. Annotation on an unreadable
image is not annotation.

**A10 — Review lives in a different app than the thing being reviewed.** Pastel routes
you through a Pastel link rather than your own tab; Figma comments only exist where the
design does; Excalidraw is a separate tab entirely. `[SECONDARY]` huddlekit names the
cost plainly: "Context switching: Hard to reference exact elements."

**A11 — Every item commits immediately, with no draft and no batch.** Vercel, BugHerd,
Figma, Pastel all post on submit. BugHerd routes each pin straight onto a kanban board.
The counter-evidence that this is a *choice* and not a necessity is Linear's 3-minute
grace window and cross-client drafts. Nothing in this sweep offers "hold a set, commit
once."

**A12 — Screenshots trapped behind an extra window.** `[SECONDARY]` G2 on BugHerd: users
"unable to view captured and uploaded screenshots without opening a new window." The
evidence you attached to reduce a context switch becomes a context switch.

---

## 15. The friction ladder

Entry cost to place **one** piece of feedback on a page you are already looking at,
ranked from "already there" to "open a new app." Cost counted as: surfaces you must
leave, installs/auth you must clear, and gestures before the comment box is live.

| Rung | Tool | Entry cost | Evidence |
|---|---|---|---|
| **0** | **Chrome DevTools Inspect** | Already in the tab. Open DevTools, `Ctrl+Shift+C`, hover. **But: captures nothing, lists nothing, submits nothing.** Pure pointing, zero output. | `[PRIMARY]` Chrome/Edge inspect docs |
| **1** | **Vercel Toolbar (extension installed + Always Activate on)** | Toolbar already live on the page; press `c`; click or drag. Requires a Vercel account, an extension, a preference toggled, and an HTML Content-Type. | `[PRIMARY]` /docs/comments, /docs/comments/using-comments |
| **2** | **Vercel Toolbar (default, no extension)** | Toolbar is **sleeping** — click to wake, then menu → Comment, then place. Existing comments invisible until woken. | `[PRIMARY]` "when the toolbar first shows up ... it is sleeping" |
| **3** | **BugHerd / Ruttl / embedded widgets (JS snippet installed)** | Sidebar already docked; click `+`; select the spot. Per-site install; CSP can block it outright. | `[PRIMARY-MKT]` BugHerd; `[PRIMARY]` BugHerd CSP + blocked-loading FAQ articles |
| **4** | **BugHerd / Usersnap via browser extension** | Install extension (documented to sometimes need a browser restart), possibly log in to a hub, then annotate. | `[SECONDARY]` G2; `[COMPETITOR]` on extension-tier gating |
| **5** | **Marker.io / Usersnap / Userback** | Open widget → **mandatory screenshot capture** → draw → fill a ticket form → send. The form is the product. | `[PRIMARY]` help.marker.io; `[COMPETITOR]` "fill out what is essentially a ticket form" |
| **6** | **Pastel** | Leave your tab. Paste the URL into Pastel. Get a Pastel link. Review inside Pastel's surface, in comment mode. | `[PRIMARY-MKT]` "Type in a URL and share a link" |
| **7** | **Figma / FigJam comments** | Only reachable if the artifact lives in Figma. A live web page cannot be commented on at all. | `[PRIMARY]` help.figma.com |
| **8** | **Excalidraw (the incumbent)** | New tab → capture a screenshot with a separate tool → paste (downscaled to 1440px max, 2MB cap) → draw → **and then retype the finding somewhere else, by hand, from memory, because there is no output path.** | `[PRIMARY]` excalidraw#4302; journey narration in `.decision-log.md` |

### Where Sidepiece has to land

Jarad's brief is to beat rung 8 "by a wide margin." Two independent facts set the bar:

1. **The Cockpit is already docked to the tab, and the Project Record is already
   resolved from the page's `pjid` via the Bridge.** The identity work that rungs 3–6 pay
   for with per-site installs and URL re-entry is already done before Jarad reaches for
   anything. Structurally, Sidepiece starts at rung 0–1 — its natural entry cost is a
   single gesture inside a surface that is already open. No tool in this sweep starts
   there while also having somewhere to send the result.

2. **The margin over Excalidraw is not mainly about the drawing.** Rung 8's cost is
   dominated by steps 1 and 5 — leaving the page, and the absent output path. The
   sweep found *no* tool that routes an annotation to an **Agent**; all of them route to
   a tracker. Sidepiece's "one button → a **Ticket** per piece of feedback on the
   **Board**, or one button → the batch to the registered **PM**" has no prior art in
   this sweep at all. That is simultaneously the biggest differentiator and the least
   de-risked part of the design.

**Counter-metric note, flagged not resolved:** the PRD directive says panel open time
should stay LOW, and "bmad-ux should not reintroduce density as a goal." A running
annotation list is, structurally, a density surface, and it is the one surface in the
journey Jarad asked for by name. Every list pattern found here (Vercel Inbox, Figma
sidebar, BugHerd board) is a place you *dwell*. That tension is a decision, not a
finding — see OQ9.

---

## 16. What the prior art is silent on

Reported as findings, because each one is a place where Sidepiece has no map.

1. **Anchor serialization.** Vercel, BugHerd and Pastel all claim element attachment.
   **None publishes the format.** The only public spec is the W3C Web Annotation Data
   Model, which no tool in this sweep cites.
2. **Anchor-gone failure UX.** Zero documented user-facing handling anywhere. Vercel
   documents outdated deployments and query-param mismatch; BugHerd documents SPA route
   identity; Figma documents shallow attachment. Nobody documents "this comment's element
   no longer exists."
3. **End-of-session batch submission.** Not found in any tool. Usersnap's "multiple
   comments in one report" is the nearest neighbor, and it batches onto one screenshot,
   not across a session. Linear's Triage is post-hoc, not a batch commit.
4. **Routing annotations to an agent.** Every tool routes to a tracker. The **Dispatched
   Command** destination is unprecedented in this prior art.
5. **Relative coordinates as a first-class payload field beside an image.** Userback and
   Usersnap draw on the raster and ship the raster. Vercel's drag ships a region crop.
   Nobody documents coordinates as structured data the receiver can reason over.
6. **Escape-to-cancel in a picker.** Not documented by DevTools — the pattern Sidepiece
   is copying does not specify it.
7. **Freehand markup anchored to DOM at all.** The two payload kinds are treated as
   separate products everywhere: element-pinners don't draw, drawers don't pin. Vercel's
   click-vs-drag is the only single-mode two-payload design found, and its drag path is
   a rectangle, not a pen.

---

## 17. Sources

**Primary — vendor docs and specs, fetched**
- Chrome DevTools, Inspect mode — https://developer.chrome.com/docs/devtools/inspect-mode
- Microsoft Edge DevTools, Analyze pages using the Inspect tool — https://learn.microsoft.com/en-us/microsoft-edge/devtools/css/inspect
- Vercel, Comments Overview — https://vercel.com/docs/comments
- Vercel, Using Comments with Preview Deployments — https://vercel.com/docs/comments/using-comments
- Vercel, Managing Comments on Preview Deployments — https://vercel.com/docs/comments/managing-comments
- Vercel engineering blog, Using Vercel comments to improve the Next.js 13 documentation — https://vercel.com/blog/using-vercel-comments-to-improve-the-next-js-13-documentation
- Vercel blog, Introducing Commenting on Preview Deployments — https://vercel.com/blog/introducing-commenting-on-preview-deployments (fetched; contains **no** technical anchoring detail)
- BugHerd Help Center, Troubleshooting & FAQ collection — https://support.bugherd.com/en/collections/12946642-troubleshooting-faq
- BugHerd Help Center, Customizing the Metadata captured by BugHerd — https://support.bugherd.com/en/articles/11430697-customizing-the-metadata-captured-by-bugherd
- Marker.io Help Center, How to integrate Marker.io into your web app — https://help.marker.io/en/articles/5546520-how-to-integrate-marker-io-into-your-web-app
- Figma Learn, View and manage comments — https://help.figma.com/hc/en-us/articles/360041547593-View-and-manage-comments
- Linear Docs, Create issues — https://linear.app/docs/creating-issues
- W3C, Web Annotation Data Model — https://www.w3.org/TR/annotation-model/
- Excalidraw GitHub Discussion #4302, image downscaling — https://github.com/excalidraw/excalidraw/discussions/4302

**Primary marketing — vendor self-description, fetched**
- BugHerd, Website Annotation Tool — https://bugherd.com/website-annotation-tool
- BugHerd, Easy website annotations — https://bugherd.com/feature/easy-website-annotations
- Marker.io, Features & Product Tour — https://marker.io/features
- Pastel, Website annotation tool — https://usepastel.com/website-annotation-tool
- Userback, Screen Annotation — https://userback.io/feature/screen-annotation/
- ruttl — https://www.ruttl.com/
- Ybug, How to annotate a website — https://ybug.io/blog/how-to-annotate-a-website

**Competitor comparisons — biased by construction, used only for direction**
- Simple Commenter, Marker.io vs BugHerd — https://www.simplecommenter.com/posts/marker-io-vs-bugherd
- Huddlekit, How to annotate a website — https://huddlekit.com/blog/how-to-annotate-a-website

**Secondary / search-summarized**
- G2, BugHerd pros and cons — https://www.g2.com/products/bugherd/reviews?qs=pros-and-cons — **HTTP 403 on direct fetch**; quotes via search summary only
- Figma Forum, "Keep Comments pinned to design elements (including nested)" — https://forum.figma.com/suggest-a-feature-11/keep-comments-pinned-to-design-elements-including-nested-17753
- Figma Learn, Move or edit comments — https://help.figma.com/hc/en-us/articles/360041547853-Move-or-edit-comments
- Usersnap Help Center — https://help.usersnap.com/docs/feedback-with-a-screenshot , https://help.usersnap.com/docs/track-browser-extensions
- Userback, Session Replay — https://support.userback.io/en/articles/5762135-session-replay
- Box-model overlay colors — https://dev.to/amit_merchant/til---using-box-model-of-chrome-dev-tools , https://www.codecademy.com/article/f1-devtools-box-model
- W3C Web Annotation Working Group status — https://www.w3.org/annotation/
