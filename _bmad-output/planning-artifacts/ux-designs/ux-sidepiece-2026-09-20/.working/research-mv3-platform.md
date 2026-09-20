# Research — MV3 / Chrome platform constraints bounding the Sidepiece interaction design

Run: `ux-sidepiece-2026-09-20` · Sweep: MV3 platform · Date: 2026-09-20 · Phase: **Discovery**

> **Scope discipline.** This document reports facts and cites where each came from.
> It authors no design solution, picks no pattern, and proposes no direction.
> Every place a human decision is required is pushed to **§11 Open questions**.

## Source legend

| Tag | Meaning |
|---|---|
| `[PRD]` | `prds/prd-sidepiece-2026-09-17/prd.md` — read in full for §4.1, §4.2, §4.4, §5, §6, §7, §9, §12 |
| `[ADD]` | `prds/prd-sidepiece-2026-09-17/addendum.md` — read in full |
| `[ARCH]` | `planning-artifacts/architecture.md` — read in full (2 of N steps complete) |
| `[LOG]` | `ux-designs/ux-sidepiece-2026-09-20/.decision-log.md` |
| `[WEB]` | Fetched 2026-09-20 from live Chrome/Chromium/WICG sources; URL given inline |

**Vocabulary held verbatim throughout:** Cockpit, Turn, Streamed Exchange, Dispatched
Command, Project, Project Record, pjid, Bridge, Board, Ticket, Agent, PM, Registry,
Bloodbank, Candystore, Tailnet.

**Standing directive honoured:** `[PRD]` §1 — *"the cockpit is a means, not the thesis…
bmad-ux should not reintroduce density as a goal on the strength of the braindump
alone."* Counter-metric `[PRD]` §11 SM-C1: *"Panel open time. If I'm **living** in the
panel rather than dipping into it, the loop got heavier, not lighter."*

---

## 0. The one-paragraph summary a UX pass needs

The Cockpit cannot open itself, is destroyed every time it closes, is at minimum ~320 CSS
pixels wide, cannot be widened or narrowed by the extension, cannot see the browser's own
theme, and gets at most four keyboard shortcuts. The "finger on the clipboard" mechanic is
buildable — a click inside the page **can** open the Cockpit, in exactly one message hop,
with no `await` anywhere in the chain — but every established way to draw a DevTools-style
hover outline is hand-built, and the one official primitive costs a permanent
"started debugging this browser" infobar on every tab. The single largest correction to
the PRD's own beliefs is that Local Network Access almost certainly does **not** prompt for
extension fetches to the Tailnet, and that `100.64.0.0/10` is *not* ambiguous in the spec —
it is explicitly classified `local`.

---

## 1. Side panel lifetime and opening

### 1.1 Opening requires a user gesture — confirmed, and the mechanism quoted

`[PRD]` §5, *Opening the panel* (verbatim):

> "Chrome requires a genuine user gesture to open a side panel, and the open call must be
> the first synchronous call in the gesture handler — anything awaited first silently
> no-ops with no error. Sidepiece therefore cannot auto-open on detection; the extension
> icon carries the 'this tab is resolvable' signal so opening it is an informed click."

`[ADD]` §C sharpens the failure mode (verbatim):

> "`chrome.sidePanel.open()` has required a genuine user gesture since Chrome 116, and must
> be the *first synchronous call* in the gesture handler. An `await` before it — even
> awaiting `setOptions` — breaks the gesture chain and Chrome **silently no-ops with no
> thrown error**. There is no supported way to auto-open on navigation; this is by design,
> not a permission that can be requested."

**Confirmed against live docs.** `[WEB]` https://developer.chrome.com/docs/extensions/reference/api/sidePanel —
`open()` "may only be called in response to a user action." Permitted gestures named:
action clicks, keyboard shortcuts, context menu interactions, or user gestures **on
extension pages or content scripts**.

**Also confirmed, and PRD-silent:** the panel can be opened by the extension icon alone
via `setPanelBehavior({ openPanelOnActionClick: true })`, which "enables toggling the
extension's side panel entry by clicking its icon, defaulting to **false**." `[WEB]` same
source. The PRD's "the extension icon carries the 'this tab is resolvable' signal" is
therefore implementable with no service-worker gesture handling at all.

### 1.2 NEW FACT — a click *inside the page* can open the Cockpit

This is the single most consequential platform fact for the "finger on the clipboard"
journey `[LOG]`, and it is **not in the PRD or the addendum** (both are silent on
cross-context gesture propagation).

`[WEB]` https://groups.google.com/a/chromium.org/g/chromium-extensions/c/d5ky9SiZlqQ —
a button click in a **content script** that `sendMessage`s the service worker, whose
`onMessage` handler then calls `chrome.sidePanel.open({windowId})`, **works**. The thread
demonstrates it empirically (Jackie Han's sample).

`[WEB]` https://developer.chrome.com/docs/extensions/reference/api/sidePanel search
digest, corroborating: *"User gestures in extensions are 'curried' across messages, so if
a message is sent via `runtime.sendMessage()` while a user gesture is active, Chrome will
synthesize a user gesture on the receiving end… However, the gesture created on receipt of
the message is a 'restricted' user gesture, meaning it cannot then be used to create a new
message with another user gesture."*

The three hard edges on this, all verified `[WEB]`:

1. **One hop only.** The curried gesture is *restricted*; it cannot be re-forwarded through
   a second message.
2. **Callbacks, not promises.** `[WEB]` d5ky9SiZlqQ: async/await before `open()` loses the
   gesture and throws `"sidePanel.open() may only be called in response to a user gesture."`
   The callback form preserves it. The working pattern shown is
   `chrome.storage.local.get('date', (items) => { chrome.sidePanel.open({tabId: tab.id}); })`.
3. **Known reopen bug.** `[WEB]` https://issues.chromium.org/issues/415694848 —
   `sidePanel.open()` throws the gesture error on the *second* click after the user has
   manually closed the panel. Filed, and the search surface gives no fix version.
   Unverified against Chrome 151–155.

Also unsupported from an `omnibox.onInputEntered` listener: `[WEB]`
https://issues.chromium.org/issues/325442903.

### 1.3 What survives panel close: nothing

`[PRD]` §5, *Panel lifetime* (verbatim):

> "All long-lived connections — chat streams, event subscriptions — live in the panel
> document, never in the extension service worker… The panel document stays alive across
> tab switches while open, so in-panel state survives navigation; **it does not survive the
> panel closing.** Anything that must outlive it is held by the Bridge (FR-15), not
> persisted client-side."

`[ARCH]` states the same thing as the dominant architectural constraint (verbatim):

> "The dominant constraint is not performance. It is that **the client is not durable**…
> That single fact shapes more of this design than every latency budget combined."

**Confirmed and sharpened** `[WEB]` https://github.com/GoogleChrome/chrome-extensions-samples/issues/998
and https://groups.google.com/a/chromium.org/g/chromium-extensions/c/o1_-Su6DkCI —
*"The side panel document is fully torn down and reloaded each time the panel is
collapsed."* Real-world consequence reported in the same thread: *"live sync silently
stopped on every collapse, even though the user never turned it off or closed the tab."*
Note the wording: **collapse**, not just close. Collapsing the panel is the same event as
closing it, as far as the document is concerned.

The official `chrome.sidePanel` reference page is **silent** on document lifetime — it
documents no teardown behaviour at all `[WEB]`. This is community-verified, not
vendor-documented.

### 1.4 NEW SINCE 2026-09-17 — `onOpened` / `onClosed` lifecycle events exist

`[ADD]` §D's research pass did not surface these; both the PRD and the addendum are
**silent**.

`[WEB]` (search digest over developer.chrome.com + w3c/webextensions#517):
`chrome.sidePanel.onOpened` (payload `PanelOpenedInfo`) and `chrome.sidePanel.onClosed`
(payload `PanelClosedInfo`) exist, **added in Chrome 141+**. `PanelClosedInfo` carries the
`windowId` for both global and tab-specific panels, and the `tabId` only when the panel is
tab-specific. Separately, `chrome.runtime.getContexts({contextTypes: ["SIDE_PANEL"]})` can
be used to test whether the Cockpit is currently open.

Jarad's Chrome versions span 151–155 `[PRD]` §12 Q7, so these are available on every
machine on the Tailnet.

**Why this matters to UX and not just to engineering:** there is now a hook that fires
before/around the teardown. Whether it is early enough to flush un-saved annotation state
is **not established by anything I read** — the samples issue discusses it as a
notification, not a guaranteed-drain beforeunload equivalent.

`sidePanel.close()` and `sidePanel.toggle()` are a **standing feature request, not shipped**:
`[WEB]` https://github.com/w3c/webextensions/issues/521. The Cockpit cannot close itself.

### 1.5 Tab switch, window switch, multi-window, SPA navigation

**Tab switch — the panel document survives.** `[ADD]` §C (verbatim, flagged there as
*"(Corrects the earlier draft.)"*):

> "A global panel's document persists across tab switches within a window — DOM, JS state,
> and open sockets survive, similar to a DevTools panel… The right pattern here is a single
> global panel document, with the service worker listening on `tabs.onActivated` /
> `tabs.onUpdated` and messaging that long-lived document to re-render. Good news for
> FR-11: chat state survives tab switching with no persistence work, and only needs
> persisting across the panel *closing*."

`[WEB]` confirms with a caveat the addendum omits: when the user "temporarily switch[es]
to a tab without an enabled side panel, the side panel will be hidden" and will
"automatically show again when the user switches to a tab where it was previously open."
Navigating to a **disabled** site "closes the panel entirely."

That caveat is live for Sidepiece only if per-tab disabling is ever used. `[ADD]` §C
recommends against per-tab overrides on drift grounds (verbatim): per-tab `setOptions`
"loads a *distinct document* per tab and is prone to override drift, where a stale per-tab
override silently diverges from the global default and produces 'correct on some tabs,
stale on others'."

**Window switch / multi-window.** `[PRD]` §5, *Multiple windows* (verbatim):

> "Chrome's side panel is per-window, so two Chrome windows mean two Cockpit documents with
> independent caches and independent resolution state. v1 does not attempt to synchronize
> them: each is independently correct for its own window, and FR-11's append-per-Turn
> history rule keeps them from clobbering each other."

Carried as `[ASSUMPTION]` in `[PRD]` §13: *"concurrent multi-window use is rare enough that
per-window independence is acceptable."* `[WEB]` corroborates per-window identity —
`PanelOpenedInfo`/`PanelClosedInfo` are keyed by `windowId`.

**SPA navigation.** The panel document is unaffected; the *content script* is the problem.
`[ADD]` §C (verbatim):

> "A content script is injected once per *document load*. A history-API transition
> (`pushState` / `replaceState`) never unloads the document, so it does not re-inject — and
> widening the host match does nothing to change that, because the match pattern is a
> permission knob, not a re-injection trigger."

Three named options, with the addendum's own preference (verbatim): a `MutationObserver` on
`<head>` — *"cheapest, needs no additional permission, and the recommended default"*;
monkey-patching `history.pushState`/`replaceState` — with the note that *"`popstate` alone
is insufficient: it fires on back/forward, not on a `pushState` call"*; or
`chrome.webNavigation.onHistoryStateUpdated`, *"Reserve this for when the service worker
itself needs to know about the transition."*

`[PRD]` FR-1 makes the requirement testable: *"A client-side route change that replaces the
page without a document load re-triggers detection. A declarative content script alone does
not satisfy this — history transitions must be observed explicitly."*

### 1.6 Auto-open: confirmed impossible

`[ADD]` §C: *"There is no supported way to auto-open on navigation; this is by design, not
a permission that can be requested."* Nothing in the 2026-09-20 web sweep contradicts this.
The **only** softening found is §1.2 above: the gesture may originate in the *page*, not
just in browser chrome — which changes who can trigger the open, not whether a human must.

---

## 2. Service worker death, and what breaks

### 2.1 The timer, as currently documented

`[ADD]` §C (verbatim): *"The service worker dies after ~30s idle, taking in-memory state
and open connections with it. Sharper than the earlier draft: WebSocket traffic is
documented to reset the idle timer, but **EventSource has no equivalent documented
exemption** — an SSE connection held in the service worker cannot be trusted to survive."*

`[WEB]` https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
and https://developer.chrome.com/blog/longer-esw-lifetimes, current as of this sweep:

- Termination after **30 seconds of inactivity**.
- **Receiving an event or calling an extension API resets the timer.** As of **Chrome 110,
  all events reset the idle timer**, and the idle timeout does not occur while there are
  pending events.
- **WebSocket** traffic (send or receive) in the service worker resets the idle timer.
- Messages **sent from an offscreen document** reset the timers.
- **Hard ceiling:** a single request — event or API call — taking longer than **5 minutes**
  to process causes termination regardless.
- A `fetch()` whose response takes more than **30 seconds to arrive** causes termination.

The addendum's EventSource claim is not contradicted by any source found: the exemption
list names WebSocket, not EventSource. **Treat "EventSource has no documented exemption" as
still true on 2026-09-20.**

### 2.2 The 30-second `fetch` ceiling is a UX fact, not just an engineering one

`[PRD]` §5 sets *"first content token ≤8s p95 warm with no budget cold"*, and `[PRD]` FR-7
records measurements of *"Warm… 3.8–5.1s and cold at 7.1–17.1s."* A cold Streamed Exchange
is therefore routinely **over 8s and can reach 17.1s**. If any part of that round trip were
ever made through a service-worker `fetch`, the 30s ceiling is uncomfortably close. The
PRD's mitigation is structural, not a timeout tweak — `[PRD]` §5 mandates streams live in
the panel document.

### 2.3 What UI guarantees break

Cross-referencing the PRD's own testable consequences against the lifecycle facts:

| Guarantee | Source | What the platform does to it |
|---|---|---|
| *"Closing and reopening the panel mid-stream does not lose the Turn: the completed answer is retrievable on reopen. Partial tokens are best-effort and may be lost; the answer is not."* | `[PRD]` FR-7 | Panel teardown kills the stream. Only satisfiable because the **Bridge** is the system of record — `[PRD]` FR-7 says so outright: *"the panel document cannot be the system of record."* |
| *"Outcomes arriving while the panel is closed are reconciled on next open."* | `[PRD]` FR-9 | Confirmed necessary: nothing in the extension is alive to receive them. `[ADD]` §C: *"outcomes arriving while the panel is closed are reconciled on next open rather than streamed to a listener that isn't there."* |
| *"History survives a Chrome restart and an extension service worker termination."* | `[PRD]` FR-11 | Satisfiable only from Bridge state or `chrome.storage`. |
| *"Reopening the Cockpit on the same Project restores that Project's prior Turns."* | `[PRD]` FR-11 | Requires a re-fetch on every open. |

### 2.4 The re-fetch / re-subscribe set on every panel reopen

Derived from the above; **no document states this list**, so it is my synthesis of stated
facts and should be confirmed:

- Active tab + its declared pjid (the panel cannot assume the tab it last saw is current).
- Project Record resolution, subject to `[PRD]` FR-2's bounded cache — which *"expires on a
  stated TTL, is invalidated when Bridge health transitions from unreachable to reachable."*
- A fresh generation number `[PRD]` FR-2 / §5 *"cost of being wrong"*.
- Bridge health per-dependency `[PRD]` FR-14.
- Board read — `[PRD]` FR-12 requires it *"fetched fresh on Project resolution, not served
  from a prior Project's cache."*
- Turn history for the Project `[PRD]` FR-11.
- Any Dispatched Command outcomes that landed while closed `[PRD]` FR-9.
- The SSE subscription itself, re-established from scratch.

**UX consequence, stated as fact not as a design:** every panel open is a cold start of
roughly seven network reads, and `[PRD]` SM-C1 explicitly *wants* panel opens to be
frequent and short. Those two pull against each other. The document set is **silent** on
how a reopen should render while those reads are in flight, except for the blanket rule in
`[PRD]` §5: *"No pane may render a failure as an empty state or a permanent spinner."*

### 2.5 SSE across the boundary

`[ARCH]` (verbatim): *"Two distinct streaming protocols meet in the Bridge: JSON-RPC over
WebSocket upstream, SSE downstream (SSE because FR-15 requires `curl -N` to tail it)."*

The SSE connection therefore terminates in the **panel document**, which dies on close.
`[ADD]` §C names the escape hatch if that ever becomes insufficient: *"Live streams belong
in the panel document (alive while open), or an **offscreen document** if they must outlive
panel visibility."* `[WEB]` confirms offscreen-document messages reset the service worker
idle timer, so an offscreen document is a viable host — at the cost of another context to
reason about. **No document in this repo decides this**; `[ARCH]` is only 2 steps in.

---

## 3. Content script ↔ side panel messaging

Both `[PRD]` and `[ADD]` are **silent on the mechanism** — the addendum's §C covers the
content script's *detection* job but never the picker's *bidirectional* job. Everything
below is `[WEB]` from
https://developer.chrome.com/docs/extensions/develop/concepts/messaging and
https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts.

### 3.1 There is no direct content-script ↔ side-panel channel

- **Content script → Cockpit:** `chrome.runtime.sendMessage()`. This is a broadcast to
  every extension context with a `runtime.onMessage` listener *except the sender* — the
  Cockpit receives it only if it has a listener registered and is **currently open**. A
  closed Cockpit is not a slow receiver; it does not exist.
- **Cockpit → content script:** `chrome.tabs.sendMessage(tabId, msg)`. This needs a
  `tabId`, and the Cockpit has no ambient one — it is a global panel document, not a tab.
  It must obtain the tab via `chrome.tabs.query({active: true, currentWindow: true})` or be
  told by the service worker. **Not stated in any doc I read; inferred from the API shape —
  confirm before building.**
- **Long-lived:** `chrome.runtime.connect()` from the content script /
  `chrome.tabs.connect()` from the extension page, both yielding a `runtime.Port`.
  Verbatim `[WEB]`: *"When establishing a connection, each end is assigned a `runtime.Port`
  object for sending and receiving messages through that connection."*

### 3.2 Frames

Verbatim `[WEB]`: *"If there are multiple frames in a tab, calling `tabs.connect()` invokes
the `runtime.onConnect` event once for each frame in the tab."* The messaging doc excerpt I
fetched exposes **no `frameId` selector on `connect()`**. For a picker that must address
*one* frame, this means a port fan-out and an application-level frame identity — the docs
are **silent** on the recommended approach.

### 3.3 Latency shape

**No source I found publishes a latency figure for `runtime.sendMessage`.** What is
documented is the *structure*: it is a same-process-tree IPC with structured-clone
serialization, not a network call, and it is asynchronous in every direction. Treat the
in-page → Cockpit round trip as sub-frame-budget but **unmeasured**; the PRD's own budgets
(`[PRD]` §5) never cover it because no v1 FR crosses this boundary.

**Contrast that with the measured numbers that do exist** `[PRD]` §5 / FR-7 / `[ARCH]`:
Registry resolution 2.4ms p50 (loopback), Turn accepted 79ms against the live gateway,
first token 3.8–5.1s warm / 7.1–17.1s cold. `[PRD]` §5 warns all of these are *"measured
over the tailnet"* targets while every measurement to date is loopback-only, and `[ARCH]`
repeats it: *"Every measured figure to date is loopback-only; the tailnet hop is additive
and unmeasured."*

### 3.4 What breaks the picker

| Hazard | What is true | Source |
|---|---|---|
| **Page CSS/JS** | Content scripts run in an **isolated world** — *"a private execution environment that isn't accessible to the page or other extensions"*, and *"none of these (web page, content scripts, and any running extensions) can access the context and variables of the others."* JS is safe. **DOM the content script injects is not** — it lives in the page's document and inherits the page's CSS. | `[WEB]` content-scripts |
| **Cross-origin iframes** | Reached only with `"all_frames": true`. A selector does not cross the boundary — `[ADD]` §C: *"Shadow DOM and iframes need special-casing because `querySelector` crosses neither boundary."* | `[WEB]` + `[ADD]` |
| **`about:blank` / `srcdoc` frames** | Need `match_about_blank` — *"Whether the script should inject into an `about:blank` frame where the parent or opener frame matches one of the patterns declared in `matches`."* | `[WEB]` |
| **Sandboxed / `data:` / `blob:` / `filesystem:` frames** | Need `match_origin_as_fallback`, which *"examine[s] the origin of the initiator of the frame to determine whether the frame matches."* The docs do **not** separately address `sandbox`-attribute iframes. | `[WEB]`, partially silent |
| **Shadow DOM** | `querySelector` does not cross it. `css-selector-generator` has *"explicit Shadow DOM support"*; `optimal-select` is named without that claim. | `[ADD]` §C |
| **Sites that mutate the DOM under you** | `[ADD]` §C names the failure modes directly: *"framework-hashed and utility class names churn on every rebuild; `nth-child` and structural selectors break when sibling count or order changes."* `[PRD]` §9 repeats them as *"Known failure modes: hashed CSS-in-JS class names, `nth-child` brittleness under re-render, shadow DOM."* | `[ADD]`, `[PRD]` |
| **Extension reload during dev** | `[ADD]` §C: the reload button *"invalidates content-script contexts exactly as a real update does, throwing 'Extension context invalidated' in already-open tabs"*, and *"the side panel document does not hot-reload on extension reload — it must be closed and reopened to pick up new code."* | `[ADD]` |

`[ADD]` §C's stated mitigation for selector decay, verbatim: *"Practical priority:
`data-testid` / `data-*` → id → short capped structural path, with fallback text and role
stored so a human can re-match a selector that went stale after a redeploy. This is why the
deferred element-picker payload carries context rather than relying on the selector alone."*

And `[PRD]` §9, verbatim, on the payload: *"send a stable CSS selector **plus** context —
tag, text snippet, `outerHTML`, page URL"*, with the `[ASSUMPTION]`: *"a bare selector is
useless to an agent that cannot see the page, so context is part of the payload, not an
enhancement."*

**Note the tension with `[LOG]`.** Jarad's narrated journey says element-anchored feedback
is *"delivered to the agent as selector + comment — no image required."* The PRD says the
payload is *selector plus tag, text snippet, `outerHTML`, page URL*. These are not in
conflict on the image question — neither includes one — but "selector + comment" is a
smaller payload than the PRD specifies. **Not resolvable from documents; §11.**

---

## 4. In-page overlay rendering

### 4.1 Is there an official inspect-overlay primitive? Yes — behind `chrome.debugger`

`[WEB]` https://developer.chrome.com/docs/extensions/reference/api/debugger lists the CDP
domains an extension may use, and **`Overlay` is in the allowlist**, verbatim:

> "Accessibility, Audits, CacheStorage, Console, CSS, Database, Debugger, DOM, DOMDebugger,
> DOMSnapshot, Emulation, Fetch, IO, Input, Inspector, Log, Network, **Overlay**, Page,
> Performance, Profiler, Runtime, Storage, Target, Tracing, WebAudio, and WebAuthn."

The relevant CDP surface `[WEB]` (chromedp bindings mirror the protocol):
`Overlay.setInspectMode` — *"triggers events when user manually inspects an element"*;
`Overlay.highlightNode` — *"highlights DOM node with given id or with the given JavaScript
object wrapper"*; and the events `Overlay.inspectNodeRequested` (*"fired when the node
should be inspected, which happens after call to `setInspectMode` or when user manually
inspects an element"*) and `Overlay.nodeHighlightRequested`.

**This is literally the DevTools inspect overlay, drawn by the browser, immune to page CSS.**

**Its cost is a UX-visible, per-tab, persistent infobar.** `[WEB]`
https://issues.chromium.org/issues/40141220 and the surrounding sources: Chrome shows
`"<Extension> started debugging this browser"` on **every tab** whenever an extension
attaches via `chrome.debugger`. Verbatim from a vendor FAQ describing the same behaviour:
*"It is not a warning about Claude: it is what Chrome does for any extension using the
debugger API."* The user can dismiss it with **Cancel**, but *"the debugging banner
reappears every time you start an interactive selection or when the extension uses the
debugger API again."*

Two documented suppressions, both hostile to a personally-loaded extension: the
`--silent-debugger-extension-api` command-line flag, which *"must be added to every
shortcut and Chrome must be fully restarted"*; or force-install via the
`ExtensionInstallForcelist` enterprise policy, since *"policy-managed extensions don't
trigger the banner."* `[WEB]`

`[ADD]` §C already flagged `chrome.debugger` in the *capture* context, verbatim: *"the
latter needs the `debugger` permission and its alarming 'debug your browser' warning. A
real tradeoff for the deferred snapshot feature (PRD §9), not an implementation detail."*
**It did not connect that same permission to the element picker's overlay**, which is where
its cost lands hardest — the picker is used constantly, the snapshot occasionally.

Two further `chrome.debugger` restrictions `[WEB]`: attachment is blocked when enterprise
policy sets `runtime_blocked_hosts`, or when *"Screenshot capture is restricted by policy"*
or DLP rules apply, failing with *"Host access is restricted by policy."* Not applicable to
a solo homelab, recorded for completeness.

### 4.2 The hand-built technique, and what it has to defeat

Everything below is `[WEB]`; both `[PRD]` and `[ADD]` are **silent on overlay rendering
technique**. The established pattern, consistently described across sources:

1. **A shadow root**, `Element.attachShadow({ mode: "closed" })`. Verbatim from the
   collected sources: *"Closed Shadow DOM can inject content into web pages to guarantee
   total isolation from host page styles"*, and *"CSS defined inside a Shadow DOM is scoped
   locally and won't be affected by external styles."* Precedent named: *"Chrome DevTools
   uses Shadow DOM extensively to ensure its UI doesn't inherit styles from the inspected
   page."*
2. **A CSS reset inside it**, applied via CSS layers, *"to prevent host stylesheet
   inheritance."* (Shadow DOM blocks selectors from crossing in, but a small set of
   inheritable properties — font, color, line-height, direction — still cross; the reset is
   what stops those.)
3. **`position: fixed` and `z-index: 2147483647`** — the maximum 32-bit signed integer,
   named explicitly in the sources as the convention.

**Known tradeoffs, from the same sources:**

- **Closed mode is hostile to your own debugging.** Verbatim: *"Shadow DOM can create
  headaches when you need to fix style bugs, as the extension's UI is wrapped in a Shadow
  DOM creating a 'shadow boundary' that blocks external styles."* The named workaround is
  the Constructable Stylesheets API (Chrome 73+).
- **`z-index` is not a guarantee.** A `z-index` only competes within its stacking context;
  a page that establishes one above the overlay's insertion point wins regardless of the
  value. Not stated by the sources; a property of CSS. **Flagged as my inference.**
- **Nothing in the sweep addressed CSS `contain`, `filter`, `transform` or `will-change` on
  an ancestor**, each of which creates a containing block that can clip a `position: fixed`
  overlay. **Silent.**
- **The top layer (`<dialog>` / Popover API)** is the modern escape from stacking-context
  and clipping problems entirely. **No source in this sweep discussed using it for an
  extension content-script overlay.** Silent — and a genuinely open technical question.

### 4.3 Page CSP

`[WEB]` content-scripts: the isolated world means the page's CSP does not govern the
content script's own script execution. The docs I fetched are **silent** on whether page
CSP blocks styles injected by `chrome.scripting.insertCSS` versus an injected `<style>`
element. The `[ADD]` and `[PRD]` are silent too. **Unverified either way.**

---

## 5. `captureVisibleTab`

`[ADD]` §C, verbatim: *"`captureVisibleTab` is viewport-only and rate-limited — a handful
of calls per second, no full-page stitching, and blocked on `chrome://` and other
extensions' pages without `activeTab`."* `[PRD]` §9, verbatim: *"Constrained by
`captureVisibleTab`: visible viewport only, not full-page, and rate-limited."*

**Exact numbers, `[WEB]`** https://developer.chrome.com/docs/extensions/reference/api/tabs:

- **Permissions:** *"In order to call this method, the extension must have either the
  `<all_urls>` permission or the `activeTab` permission."*
- **Sensitive sites:** *"These sensitive sites can only be captured with the `activeTab`
  permission. File URLs may be captured only if the extension has been granted file
  access."* The reference also notes `activeTab` *"allows extensions to capture sensitive
  sites that are otherwise restricted, including `chrome:`-scheme pages, other extensions'
  pages, and `data:` URLs."* — i.e. `activeTab` is strictly more capable here than
  `<all_urls>`, which corrects the addendum's looser "blocked… without `activeTab`."
- **Rate limit — the exact number:** `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND` = **2**.
  Docs note: *"`captureVisibleTab` is expensive and should not be called too often."*
  The addendum's *"a handful of calls per second"* is loose; **it is two.**
- **Scope:** *"Captures the visible area of the currently active tab"* — viewport only,
  confirmed.
- **Format/quality:** an `ImageDetails` options object exists; the reference excerpt I
  fetched does not enumerate its fields. Partially silent.

**devicePixelRatio — the docs are silent, the ecosystem is not.** `[WEB]`
https://outof.me/chrome-extension-retina-capturevisibletab-translate3d-2-x-res/ and
related: on a HiDPI display the returned image comes back at **physical pixel dimensions**,
i.e. roughly `innerWidth × devicePixelRatio` — double-resolution on a 2× display. The
published workaround is `canvasContext.scale(1/window.devicePixelRatio, 1/window.devicePixelRatio)`
when drawing the capture to a canvas. A Firefox-side bug shows the same class of problem
gets worse with iframes present: `[WEB]` https://bugzilla.mozilla.org/show_bug.cgi?id=1751961
— *"returns wrong image if `iframe` is on the page AND user has `devicePixelRatio` above 1."*

**This is exactly why `[LOG]`'s freehand payload is specified as "relative coordinates".**
Jarad's own narration: freehand markup *"delivered with relative coordinates + an image
(image required here)."* Relative coordinates survive the DPR mismatch; absolute pixels do
not. The two independently arrived at the same answer.

**Silent / unverified:**

- **Scrolled regions** — no source states what a capture taken mid-scroll contains beyond
  "the visible area". Full-page requires manual scroll-and-stitch, or `chrome.debugger` +
  `Page.captureScreenshot({captureBeyondViewport: true})` `[ADD]` §C.
- **Fixed headers** — a stitched multi-scroll capture will repeat any `position: fixed`
  element once per tile. **No source addressed this.** It is the standard failure of
  scroll-and-stitch and worth stating, but I found no citation.
- **Cross-origin content** — nothing in the docs suggests cross-origin iframes are
  redacted; `captureVisibleTab` captures rendered pixels, and the permission gate is on the
  *tab*, not per-frame. **Inference, not cited.**

---

## 6. Local Network Access / PNA — the biggest correction in this sweep

### 6.1 What the PRD believes

`[PRD]` §5, verbatim:

> "The Bridge is no longer on loopback but on a tailnet address in `100.64.0.0/10` (CGNAT),
> **whose PNA address-space classification is *less* clearly documented than loopback's**.
> A Bridge call that works today can start failing after an unrelated Chrome auto-update."

`[ADD]` §C, verbatim: *"Loopback at least has an unambiguous place in PNA's address-space
taxonomy; **CGNAT does not**, so the uncertainty is strictly greater than the earlier draft
assumed."* And: *"**Whether extension-context fetches receive the same treatment as
page-context ones is not clearly documented** — unverified either way."*

`[PRD]` §12 Q7, verbatim: *"Note Chrome 153+ ships **Local Network Access**, which gates on
the address-space transition with a permission prompt rather than on secure context — so
HTTPS likely removes the PNA class but may **not** remove the LNA class."*

### 6.2 What is actually true, as of 2026-09-20

**Correction 1 — `100.64.0.0/10` is not ambiguous. It is explicitly `local`.**

`[WEB]` https://wicg.github.io/local-network-access/ — the address-space taxonomy
classifies as **local**: `10.0.0.0/8`, **`100.64.0.0/10` (Carrier-Grade NAT, RFC 6598)**,
`172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, and IPv6 `fc00::/7`, `fe80::/10`,
`fec0::/10`, `2001:db8::/32`, `3fff::/20`. **Loopback** is its own class: `127.0.0.0/8`,
`::1/128`. Everything else is **public**.

The spec is **silent on `chrome-extension://` contexts** — verbatim from the fetch: *"The
specification does not address `chrome-extension://` URLs or extension contexts. The
document focuses exclusively on HTTP/HTTPS requests."*

**Correction 2 — extensions with host permissions are stated to be exempt.**

`[WEB]` https://groups.google.com/a/chromium.org/g/chromium-extensions/c/pUDh8RiTjJk —
Chrome's Patrick Kettner, verbatim: **"as long as an extension has the correct host
permissions, then they will not be impacted by this."**

With two bug caveats from the same thread: a developer reported failures *despite*
`"host_permissions": ["<all_urls>"]`; Kettner identified that as crbug.com/435246545, fixed
5 November, **requiring Chrome ≥ 144.0.7512.0**. A second related bug, issue 456078996, was
reported fixed shortly after. Jarad's Tailnet spans Chrome 151–155 `[PRD]` §12 Q7, so both
fixes are already in on every machine.

**Correction 3 — the version number in the PRD is wrong.**

`[WEB]` https://developer.chrome.com/blog/local-network-access: **Chrome 142** shipped the
LNA permission prompt (launched 29 September 2025); Chrome 138 enabled opt-in testing via
`chrome://flags#local-network-access-check`. `[PRD]` §12 Q7's *"Chrome 153+ ships Local
Network Access"* is off by eleven milestones. LNA has been shipping for nearly a year.

**Correction 4 — it is about to get more granular, not less.**

`[WEB]`: *"In Chrome 146 and later, the 'Local Network Access' permission is split into two
more granular permissions called 'Local Network' and 'Loopback Network'. Additionally,
upcoming Chrome releases will apply the permission model to additional technologies,
including WebSockets, WebTransport, and WebRTC connections."* Relevant to `[ARCH]`'s
upstream WebSocket leg only if that ever ran browser-side, which it does not.

### 6.3 What the prompt looks like — the UX-visible event

`[WEB]` https://developer.chrome.com/blog/local-network-access. The example permission
string shown is:

> **"Look for and connect to any device on your local network."**

A second `[WEB]` source describing the Chrome 142 rollout in the field:
*"Chrome asks for permission and wants to look for and connect to any device on your local
network."* It is a standard Chrome permission bubble anchored to the omnibox.

**The blog does not state what happens on denial**, and does not describe the recovery
path. **Silent.**

Secure context does **not** exempt a request: verbatim `[WEB]`, *"The ability to request
this permission is restricted to secure contexts"* — i.e. HTTPS is a *precondition for
asking*, not an exemption from asking. `[PRD]` §12 Q7's instinct here was right;
`[PRD]` §12 Q8 (*"Does serving the Bridge over HTTPS with a real certificate remove the PNA
problem entirely?"*) is answered **no for LNA, yes for the older mixed-content class** —
`[WEB]` notes *"mixed content restrictions are exempted for known local destinations"* and
that *"Permission-gated local network requests are exempted from mixed content checks."*

Also documented and absent from both repo docs: `fetch()` can be annotated
`targetAddressSpace: "local"` to *"declare intent to access local network resources"*,
which lets Chrome know the destination before DNS resolution. `[WEB]`

### 6.4 Net effect on Q7

The empirical test `[PRD]` §12 Q7 demands (*"the test machine is `carries-macbook-air`
(macOS). Run it there and nowhere else"*) is **still worth running** — Kettner's statement
is a mailing-list assurance, not reference documentation, and the same thread shows it was
wrong in practice for months. But the prior has moved substantially: the expected result is
**no prompt**, not "uncertain leaning bad."

The two unconditional mitigations `[PRD]` §5 mandates — the Bridge answering preflights
with `Access-Control-Allow-Private-Network: true`, and TLS via a Tailscale-issued MagicDNS
certificate — remain correct and cost nothing. Neither is invalidated.

---

## 7. Keyboard

Both `[PRD]` and `[ADD]` are **completely silent on keyboard shortcuts**. `[LOG]` records
the same gap: *"No doc says anything about visual style, branding, theming, keyboard
shortcuts, or notifications — greenfield for DESIGN.md."*

All of the following is `[WEB]`
https://developer.chrome.com/docs/extensions/reference/api/commands:

- **Budget: four.** Verbatim: *"An extension can have many commands, but **may specify at
  most four suggested keyboard shortcuts**."* Commands beyond four exist but ship unbound;
  the user assigns them by hand at `chrome://extensions/shortcuts`.
- **Modifier rules:** a shortcut *must* include `Ctrl` or `Alt`. `Shift` is optional on all
  platforms. `Search` is ChromeOS-only. **`Ctrl+Alt` is prohibited** — *"to avoid conflicts
  with the `AltGr` key."* Modifiers cannot be combined with Media Keys.
- **Reserved:** `_execute_action` is a reserved command name that triggers the extension's
  action. Verbatim: *"These commands don't dispatch `command.onCommand` events like
  standard commands."*
- **Focus, page vs panel:** by default, *"when the browser does not have focus, command
  shortcuts are inactive."* Commands are dispatched at the browser level, so the
  page-versus-panel distinction is **not** what gates them — Chrome having focus is. **The
  docs do not state whether a page that captures a key event can pre-empt a registered
  command; silent.**
- **Global scope:** commands can be marked `"global"` to fire when Chrome lacks focus, but
  *"Global shortcuts are limited to `Ctrl+Shift+[0..9]`"*, and *"ChromeOS does not support
  global commands."*

**Worth noting against `[LOG]`:** Jarad's narrated journey has four distinct verbs — arm
the picker, open the Cockpit, file a Ticket, discharge the batch. That is exactly the
suggested-shortcut budget, with zero headroom.

---

## 8. Panel width — the hardest constraint on information architecture

`[PRD]` and `[ADD]` are **silent on panel width entirely.** The official `chrome.sidePanel`
reference is also silent: verbatim from my fetch, *"The documentation contains no
information regarding panel width control, minimum/default widths, or whether panel
documents persist after closure."* `[WEB]`

What the ecosystem establishes `[WEB]`:

- **A hard minimum floor of ~320 CSS pixels**, current as of **Chrome 149 (June 2026)** —
  *"Chrome's side panel has a built-in minimum width of roughly 320 pixels, and dragging
  the inner edge past that point does nothing — the panel snaps back."* And: *"that floor
  is hard-coded — no flag, no setting, no extension override."* One older source cites 360px
  as the floor; the 320px figure is the more recent. **The exact number should be measured
  on Jarad's own Chrome rather than trusted from either.**
- **User-resizable above the floor**, by dragging the inner edge.
- **The extension cannot set, suggest, or read the width.** Verbatim: *"The new Chrome
  Extension side panel API does not provide a way to set the minimum or default width of
  the side panel."* Open feature requests: `[WEB]` https://issues.chromium.org/issues/378404989
  (*"Allow each SidePanel extension to specify a minimum width"*) and
  https://issues.chromium.org/issues/40926440 (*"Side Panel minimum width could be smaller"*).
  Also https://github.com/GoogleChrome/chrome-extensions-samples/issues/1011 (*"Setting
  sidePanel default width"*) — *"the Chrome team knows about this feature request but there
  are no updates."*
- **The user's resize may not stick.** `[WEB]`: *"closing and re-opening, or opening the
  extension in an incognito browser, resets the resized side panel to the default width."*
  **Unverified on current Chrome** — the source is not dated and this may have been fixed.
  If true, it compounds §1.3: not only does the Cockpit's *state* reset on close, its
  *geometry* may too.

**What this means as a fact, not a design:** `[PRD]` FR-4 requires *"Repo name, local clone
path, and Board identifier… visible whenever a Project is resolved, **without opening a
menu or a detail view**"*, and *"The local clone path is selectable as text so it can be
copied into a terminal."* A clone path on `big-chungus` is a long string. At the 320px
floor, FR-4's three fields, the chat composer with FR-6's visible classification and its
flip control, FR-10's attached page context preview, the FR-12 Ticket list grouped by
Board state, and `[LOG]`'s running annotation list are all competing for the same column.
**Recording the collision; not resolving it.**

---

## 9. Theming

`[PRD]`, `[ADD]` and `[ARCH]` are **entirely silent on theming**, confirmed against `[LOG]`.

`[WEB]` (https://groups.google.com/a/chromium.org/g/chromium-extensions/c/vq4F0YtmA5U,
.../Kc7ufSB35js, https://github.com/w3c/webextensions/issues/242, MDN `prefers-color-scheme`):

- **The mechanism that works:** the side panel is an ordinary extension page, so
  `@media (prefers-color-scheme: dark)` and
  `window.matchMedia("(prefers-color-scheme: dark)").matches` both work, and
  `matchMedia(...).addEventListener("change", …)` fires on live OS theme changes.
- **The trap:** `prefers-color-scheme` reports the **operating system** preference, not the
  Chrome browser theme. Verbatim: *"The `prefer-color-scheme` setting follows the OS
  setting, so a user can have an OS in light mode and a dark theme, and the icon color will
  not work anymore."* And: *"when changing the Chrome color theme from Dark to Light mode,
  the `prefers-color-scheme` media query continues to reflect the device's theme, rather
  than updating to match the Chrome application's color theme."*
- **There is no API to read Chrome's own theme from an extension.** Verbatim: *"there's no
  documented standard way to detect the Chrome browser theme itself (separate from the OS
  preference) for use in side panels."* This is tracked upstream as
  https://github.com/w3c/webextensions/issues/242. Firefox has `browser.theme`; Chrome has
  no equivalent.

**The concrete failure this produces:** a light-OS + dark-Chrome-theme user gets a light
Cockpit sitting flush against dark browser chrome, with no seam the extension can detect or
correct. Jarad runs Linux (`Linux 6.17.0-41-generic`) on this host; his laptop's OS is not
stated in any document I read. **Whether this configuration actually occurs for him is
unknown — §11.**

---

## 10. Cross-cutting: what the platform does to the "finger on the clipboard" journey

Restating `[LOG]`'s five narrated beats against the platform facts above. **Facts only; the
mapping is descriptive, not prescriptive.**

| Beat (`[LOG]`, Jarad's words) | Platform facts that bound it |
|---|---|
| **1. "Select tool, DevTools-style"** — hover → live border outline | Hand-built (closed shadow root + reset + `z-index: 2147483647`, §4.2) **or** `chrome.debugger` + `Overlay.setInspectMode`, which draws the real DevTools overlay but pins a *"started debugging this browser"* infobar to every tab (§4.1). No third option found. |
| **2. "Click element → comment bubble"**, delivered as **selector + comment, no image** | Bubble is the same overlay problem. Selector generation has named libraries and named decay modes (§3.4). `[PRD]` §9 specifies a *larger* payload than "selector + comment" — tag, text snippet, `outerHTML`, page URL. Cross-origin iframe and shadow-DOM elements are not addressable by a plain selector. |
| **3. Freehand markup**, delivered as **image + relative coordinates** | `captureVisibleTab`: 2 calls/sec max, viewport only, image arrives at physical (DPR-scaled) pixel dimensions (§5). "Relative coordinates" is the correct choice and is what survives the DPR mismatch. Needs `activeTab` or `<all_urls>`. |
| **4. "A running list of annotations"** | Lives either in-page (survives panel close, competes with the page) or in the Cockpit (dies on every panel close, §1.3; competes for ~320px, §8). Nothing in any document decides this. |
| **5. ONE button → a Ticket per item, *or* the batch to the PM** | Both destinations are in-scope-adjacent: `[PRD]` FR-13 creates a Ticket, `[PRD]` FR-8 publishes a Dispatched Command. `[PRD]` §9 states the Ticket destination *"is deferred with the annotation features, not dropped — FR-13 gains an attachment surface when they land."* `[PRD]` FR-8's subject must conform to the five-token Bloodbank contract and be validated before publish. |

**The standing tension `[LOG]` already named, restated with platform weight:** every beat of
Jarad's stated north star lives in `[PRD]` §9 *Deferred Scope*, i.e. explicitly out of the
v1 MVP `[PRD]` §8.2. `[PRD]` §11 SM-C2 argues against pulling it in: *"Shipping §8 and
stopping beats shipping §9 late. This died once already at 44 tickets and zero code."*

**The counter-metric, restated for whatever the design pass decides:** `[PRD]` §11 SM-C1
says panel open time should stay **low**. Beats 1–4 of the journey happen **in the page**,
not in the Cockpit. On the platform facts, that is compatible with SM-C1 rather than in
tension with it — annotation time is page time, not panel time. Only beat 5 needs the
Cockpit, and §1.2 establishes a page click can open it.

---

## 11. Open questions — decisions only Jarad can make

1. **Does the element picker justify the `debugger` permission?** The official
   `Overlay.setInspectMode` primitive draws a pixel-perfect DevTools outline the page cannot
   break — at the cost of a *"Sidepiece started debugging this browser"* infobar on **every
   tab**, re-appearing on every picker activation, suppressible only by a Chrome launch flag
   or enterprise policy. The alternative is hand-building in a closed shadow root and
   accepting that some pages will break it. Which cost is the one you'd rather live with?

2. **Where does annotation state live between panel closes?** The Cockpit document is
   destroyed on every collapse. `[PRD]` FR-15 makes the **Bridge** the system of record for
   Turn state; nothing says the same for annotations. Options: the Bridge (survives
   everything, costs a network round trip per annotation), `chrome.storage.local` (survives
   panel close and Chrome restart, invisible to the Bridge), or in-page only (dies on page
   reload). Which?

3. **Should a first annotation auto-open the Cockpit?** It is possible — a content-script
   click curries a user gesture exactly one message hop to the service worker. But
   `[PRD]` §11 SM-C1 counts panel-open time as a *cost*. Does the annotation flow open the
   Cockpit at beat 1, or only at beat 5 when you discharge the batch?

4. **Where does the running annotation list render?** In the page (survives panel close,
   costs page real estate, is drawn over someone's UI) or in the Cockpit (dies on close,
   competes with chat + tickets + FR-4's identity block inside ~320px)?

5. **Is "selector + comment" really the whole element-anchored payload?** `[LOG]` says
   selector + comment, no image. `[PRD]` §9 specifies selector **plus** tag, text snippet,
   `outerHTML`, page URL — with the `[ASSUMPTION]` that a bare selector is useless to an
   agent that cannot see the page. Which is binding, and do you want to *see* what's being
   attached before it sends (`[PRD]` FR-10 requires exactly that for URL and title)?

6. **Which four keyboard shortcuts?** The manifest budget is exactly four, and the journey
   has exactly four verbs: arm the picker, open the Cockpit, file a Ticket, discharge the
   batch. Global chords (working when Chrome is unfocused) are restricted to
   `Ctrl+Shift+[0..9]`. Do any of them need to be global?

7. **Is the 320px floor acceptable, or does that change what the Cockpit shows at rest?**
   FR-4's clone path alone (`/home/delorenj/code/<repo>` and longer) plus the chat composer
   plus grouped Tickets plus an annotation list do not obviously coexist there. This is an
   information-architecture decision, not a styling one.

8. **Dark mode: is a manual theme override needed?** `prefers-color-scheme` tracks the OS,
   never Chrome's own theme, and there is no API for the latter. Do you actually run a
   Chrome theme that diverges from your OS setting on the laptop? If not, this is a
   non-problem and should be recorded as such rather than designed around.

9. **Do cross-origin iframes and shadow-DOM elements need to be pickable?** `querySelector`
   crosses neither boundary. Supporting them means per-frame content-script ports and
   shadow-path-aware selectors. Which of your actual pages (Slow Burns, Holocene, the
   `delo.sh` surfaces) contain elements you'd want to annotate that live inside one?

10. **Freehand: screenshot, or vector overlay with no capture at all?** `[LOG]` specifies
    "image + relative coordinates", and `captureVisibleTab` can supply that at 2 fps,
    viewport-only, DPR-scaled. An SVG-over-the-DOM alternative needs no capture, no
    `activeTab`, and no rate limit — but produces no image for the PM to look at. Is the
    image load-bearing for the agent, or was it shorthand for "it has to look like I drew
    on the page"?

11. **Should Q7's LNA test still gate the transport lock?** The evidence moved: CGNAT
    `100.64.0.0/10` is explicitly `local` in the spec (not ambiguous, as the addendum
    believed), Chrome states extensions with host permissions are unaffected, and the two
    bugs that broke that guarantee were fixed by Chrome 144 — below your entire 151–155
    range. The `carries-macbook-air` test is now a confirmation, not a discovery. Still
    blocking, or downgrade it?

12. **Does the addendum get corrected in place?** Four of its factual claims are now stale
    (§6.2 above, plus the `captureVisibleTab` rate limit being exactly 2 rather than "a
    handful", and `activeTab` being *more* capable than `<all_urls>` for capture, not just
    a fallback). The addendum is an input to `bmad-create-architecture` and
    `bmad-create-epics-and-stories`. Fix it now, or annotate from here?

---

## 12. Corrections this sweep makes to the repo's own documents

For whoever maintains `addendum.md` §C and `prd.md` §12.

| Claim | Where | Status |
|---|---|---|
| *"CGNAT does not [have an unambiguous place in PNA's address-space taxonomy]"* | `[ADD]` §C | **False.** WICG LNA spec lists `100.64.0.0/10` (Carrier-Grade NAT, RFC 6598) explicitly as `local`. |
| *"Whether extension-context fetches receive the same treatment as page-context ones is not clearly documented"* | `[ADD]` §C | **Now documented, informally.** Chrome's Patrick Kettner: *"as long as an extension has the correct host permissions, then they will not be impacted by this."* Mailing list, not reference docs. |
| *"Chrome 153+ ships Local Network Access"* | `[PRD]` §12 Q7 | **Wrong version.** Chrome **142**, launched 2025-09-29. Chrome 138 had the flag. |
| *"a handful of calls per second"* (captureVisibleTab) | `[ADD]` §C | **Imprecise.** `MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND` = **2**. |
| *"blocked on `chrome://` and other extensions' pages without `activeTab`"* | `[ADD]` §C | **Understated.** `activeTab` is strictly *more* capable than `<all_urls>` for capture — it is what unlocks sensitive sites, `chrome:`-scheme pages, other extensions' pages, and `data:` URLs. |
| Panel open/close lifecycle events | `[ADD]` §D (research digest) | **Incomplete.** `sidePanel.onOpened` / `onClosed` exist as of Chrome 141+, plus `runtime.getContexts({contextTypes:["SIDE_PANEL"]})`. The 2026-09-17 pass missed them. |
| Gesture propagation from a content script | `[PRD]` §5, `[ADD]` §C | **Silent, and load-bearing.** A click in the page *can* open the Cockpit, one message hop, callbacks only. This is what makes the in-page picker able to summon the panel. |
| Panel width, keyboard, theming | all | **Silent.** Confirmed by `[LOG]`. Greenfield. |

---

## Sources

Repo documents (read in full):
`/home/delorenj/code/sidepiece/_bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/addendum.md` ·
`/home/delorenj/code/sidepiece/_bmad-output/planning-artifacts/prds/prd-sidepiece-2026-09-17/prd.md` ·
`/home/delorenj/code/sidepiece/_bmad-output/planning-artifacts/architecture.md` ·
`/home/delorenj/code/sidepiece/_bmad-output/planning-artifacts/ux-designs/ux-sidepiece-2026-09-20/.decision-log.md`

Web (fetched 2026-09-20):
- [chrome.sidePanel API reference](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [chrome.sidePanel.open user gesture error (chromium-extensions)](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/d5ky9SiZlqQ)
- [sidePanel.open() gesture error after manual close — issue 415694848](https://issues.chromium.org/issues/415694848)
- [sidePanel.open() from omnibox — issue 325442903](https://issues.chromium.org/issues/325442903)
- [Accessing the open/close state of a sidePanel — samples#998](https://github.com/GoogleChrome/chrome-extensions-samples/issues/998)
- [sidePanel.close()/toggle() — w3c/webextensions#521](https://github.com/w3c/webextensions/issues/521)
- [sidePanel lifecycle events — w3c/webextensions#517](https://github.com/w3c/webextensions/issues/517)
- [Setting sidePanel default width — samples#1011](https://github.com/GoogleChrome/chrome-extensions-samples/issues/1011)
- [Side Panel minimum width — issue 40926440](https://issues.chromium.org/issues/40926440)
- [Allow each SidePanel extension to specify a minimum width — issue 378404989](https://issues.chromium.org/issues/378404989)
- [The extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [Longer extension service worker lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes)
- [Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [chrome.tabs API reference (captureVisibleTab)](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [chrome.commands API reference](https://developer.chrome.com/docs/extensions/reference/api/commands)
- [chrome.debugger API reference](https://developer.chrome.com/docs/extensions/reference/api/debugger)
- [New permission prompt for Local Network Access](https://developer.chrome.com/blog/local-network-access)
- [Local Network Access specification (WICG)](https://wicg.github.io/local-network-access/)
- [Local network access restrictions (chromium-extensions)](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/pUDh8RiTjJk)
- [Intent to Ship: Local network access restrictions (blink-dev)](https://groups.google.com/a/chromium.org/g/blink-dev/c/cwu_RUmBpzY)
- [chrome.debugger banner does not disappear after detach — issue 40141220](https://issues.chromium.org/issues/40141220)
- [Detect Theme Color Dark/Light (chromium-extensions)](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/vq4F0YtmA5U)
- [Detect Chrome color theme (chromium-extensions)](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/Kc7ufSB35js)
- [Expose browser theme to extensions — w3c/webextensions#242](https://github.com/w3c/webextensions/issues/242)
- [prefers-color-scheme (MDN)](https://developer.mozilla.org/docs/Web/CSS/@media/prefers-color-scheme)
- [Chrome Extension + Retina + captureVisibleTab](https://outof.me/chrome-extension-retina-capturevisibletab-translate3d-2-x-res/index.html)
- [captureVisibleTab wrong image with iframe + devicePixelRatio > 1 (Bugzilla 1751961)](https://bugzilla.mozilla.org/show_bug.cgi?id=1751961)
- [Content-script overlay for shadow dom (crxjs#239)](https://github.com/crxjs/chrome-extension-tools/discussions/239)
- [How do you isolate your shadow DOM styles? (crxjs#910)](https://github.com/crxjs/chrome-extension-tools/discussions/910)
- [The secrets of Chrome Extensions and Shadow DOM (Railwaymen)](https://blog.railwaymen.org/chrome-extensions-shadow-dom)
- [CDP Overlay domain bindings (setInspectMode / highlightNode)](https://pkg.go.dev/github.com/dtynn/chromedp/cdp/overlay)
