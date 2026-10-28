// ==UserScript==
// @name         Sidepiece Annotation Review
// @namespace    https://github.com/delorenj/sidepiece
// @version      0.1.1
// @description  Opt-in, local-first attributed page review
// @match        http://*/*
// @match        https://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(() => {
  // src/core.mjs
  var FORMAT = "sidepiece.annotations";
  var VERSION = 1;
  var shapes = /* @__PURE__ */ new Set(["circle", "rectangle", "arrow", "freehand"]);
  var finite = (n) => typeof n === "number" && Number.isFinite(n);
  var text = (s, max = 4096) => typeof s === "string" && s.length <= max;
  var dimensions = (d) => d && finite(d.width) && finite(d.height) && d.width > 0 && d.height > 0;
  var point = (p) => p && finite(p.x) && finite(p.y) && p.x >= 0 && p.y >= 0;
  var fail = (reason) => {
    throw new Error(`Invalid .sidepiece.json: ${reason}`);
  };
  function pageIdentity(url) {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP(S) pages are supported");
    return u.href;
  }
  function newDocument(url, viewport, documentSize) {
    if (!dimensions(viewport) || !dimensions(documentSize)) fail("dimensions");
    return { format: FORMAT, version: VERSION, page: { url, identity: pageIdentity(url), viewport, documentSize, versionHint: "" }, annotations: [], assets: [] };
  }
  function validate(input) {
    let d;
    try {
      d = typeof input === "string" ? JSON.parse(input) : input;
    } catch {
      fail("JSON syntax");
    }
    if (!d || typeof d !== "object" || Array.isArray(d)) fail("root");
    if (d.format !== FORMAT || d.version !== VERSION) fail("unsupported format/version");
    if (!d.page || !text(d.page.url, 8192) || !text(d.page.identity, 8192) || d.page.identity !== pageIdentity(d.page.url) || !text(d.page.versionHint, 256) || !dimensions(d.page.viewport) || !dimensions(d.page.documentSize)) fail("page");
    if (!Array.isArray(d.annotations) || d.annotations.length > 1e4 || !Array.isArray(d.assets) || d.assets.length > 1e3) fail("collections");
    const ids = /* @__PURE__ */ new Set();
    for (const a of d.annotations) {
      if (!a || !text(a.id, 128) || !a.id || ids.has(a.id) || !shapes.has(a.shape) || !Array.isArray(a.points) || a.points.length < 1 || a.points.length > 2e4 || !a.points.every(point) || !text(a.note) || !text(a.author?.id, 128) || !a.author.id || !text(a.author?.display, 256) || !a.author.display || !text(a.createdAt, 64) || !Number.isFinite(Date.parse(a.createdAt)) || !text(a.target?.url, 8192) || !text(a.target?.anchor, 1024) || !text(a.target?.text, 1024) || !text(a.assetId ?? "", 128)) fail("annotation");
      if (a.shape === "freehand" && a.points.length < 2 || a.shape !== "freehand" && a.points.length !== 2) fail("geometry");
      if (pageIdentity(a.target.url) !== d.page.identity) fail("annotation target");
      ids.add(a.id);
    }
    const assetIds = /* @__PURE__ */ new Set();
    for (const a of d.assets) {
      if (!a || !text(a.id, 128) || !a.id || assetIds.has(a.id) || !text(a.name, 256) || !text(a.type, 128) || !text(a.ref, 8192)) fail("asset");
      assetIds.add(a.id);
    }
    if (d.annotations.some((a) => a.assetId && !assetIds.has(a.assetId))) fail("missing asset reference");
    return structuredClone(d);
  }
  function compatibility(doc, url, documentSize, versionHint = "") {
    const issues = [];
    if (doc.page.identity !== pageIdentity(url)) issues.push("URL differs");
    if (versionHint && doc.page.versionHint && versionHint !== doc.page.versionHint) issues.push("version hint differs");
    if (documentSize && (Math.abs(doc.page.documentSize.width - documentSize.width) > 1 || Math.abs(doc.page.documentSize.height - documentSize.height) > 1)) issues.push("document size differs");
    return issues;
  }
  function importDocument(current, raw, mode, url, documentSize, versionHint = "") {
    const incoming = validate(raw);
    if (!["merge", "replace"].includes(mode)) fail("import mode");
    const warnings = compatibility(incoming, url, documentSize, versionHint);
    if (warnings.length) return { document: current, warnings, applied: false };
    if (mode === "replace") return { document: incoming, warnings: [], applied: true };
    const existing = new Set(current.annotations.map((a) => a.id));
    const assets = new Set(current.assets.map((a) => a.id));
    const collisions = incoming.annotations.filter((a) => existing.has(a.id) && JSON.stringify(current.annotations.find((b) => b.id === a.id)) !== JSON.stringify(a));
    if (collisions.length || incoming.assets.some((a) => assets.has(a.id) && JSON.stringify(current.assets.find((b) => b.id === a.id)) !== JSON.stringify(a))) fail("conflicting ID; use an explicit replace or fix source");
    return { document: validate({ ...current, annotations: [...current.annotations, ...incoming.annotations.filter((a) => !existing.has(a.id))], assets: [...current.assets, ...incoming.assets.filter((a) => !assets.has(a.id))] }), warnings: [], applied: true };
  }
  function addAnnotation(doc, annotation) {
    return validate({ ...doc, annotations: [...doc.annotations, annotation] });
  }
  function removeAnnotation(doc, id) {
    return validate({ ...doc, annotations: doc.annotations.filter((a) => a.id !== id) });
  }
  var normalizeLines = (value) => value.replace(/\r\n|[\r\n\u0085\u2028\u2029]/g, "\n");
  var literal = (value) => value.replace(/[\x00-\x1f!-/:-@\[-`{-~]/g, (c) => `&#${c.codePointAt(0)};`);
  var inline = (value) => literal(normalizeLines(value).replaceAll("\n", " \u21B5 "));
  function markdown(doc, authorId = "") {
    validate(doc);
    const list = doc.annotations.filter((a) => !authorId || a.author.id === authorId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const lines = [`# Sidepiece feedback`, "", `Page: ${inline(doc.page.url)}`, `Version hint: ${inline(doc.page.versionHint || "(none)")}`, ""];
    for (const a of list) {
      lines.push(`- **${inline(a.author.display)}** (${inline(a.author.id)}) \xB7 ${inline(a.createdAt)} \xB7 ${a.shape} \xB7 ${inline(a.target.anchor || "page")} \xB7 ${inline(a.target.text || "")}`);
      for (const line of normalizeLines(a.note || "(no note)").split("\n")) lines.push(`  > ${literal(line).replace(/^ +/, (spaces) => "&#32;".repeat(spaces.length))}`);
      lines.push(`  - Target: ${inline(a.target.url)}; geometry: ${a.points.map((p) => `${p.x},${p.y}`).join(" \u2192 ")}${a.assetId ? `; asset: ${inline(a.assetId)}` : ""}`);
    }
    return `${lines.join("\n").trimEnd()}
`;
  }
  async function sendSlack(markdownText, adapter) {
    if (!adapter?.send) return { sent: false, reason: "Slack destination not configured; copy Markdown instead." };
    return adapter.send(markdownText);
  }

  // src/store.mjs
  var equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  var conflict = () => {
    throw new Error("Save conflict: another tab changed this mark/document. Review the latest state and retry; your draft was not saved.");
  };
  var storageKey = (url) => `sidepiece:v2:${pageIdentity(url)}`;
  function createLocalStore({ storage, locks, url, create }) {
    const key = storageKey(url), identity = pageIdentity(url);
    let routeInvalidated = false;
    function observeRoute(currentUrl = url) {
      if (pageIdentity(currentUrl) !== identity) routeInvalidated = true;
      return !routeInvalidated;
    }
    function read() {
      const raw = storage.getItem(key);
      if (raw === null) return { document: create(), revision: 0, tombstones: {}, records: { annotations: {}, assets: {} } };
      const { localState, ...document2 } = JSON.parse(raw);
      if (!localState || !Number.isSafeInteger(localState.revision) || localState.revision < 1 || !localState.tombstones || Array.isArray(localState.tombstones) || typeof localState.tombstones !== "object" || Object.values(localState.tombstones).some((r) => !Number.isSafeInteger(r) || r < 1 || r > localState.revision)) throw new Error("Invalid local annotation state; export/recover storage before saving.");
      if (!localState.records || ["annotations", "assets"].some((field) => !localState.records[field] || typeof localState.records[field] !== "object" || Array.isArray(localState.records[field]) || Object.values(localState.records[field]).some((r) => !Number.isSafeInteger(r) || r < 1 || r > localState.revision))) throw new Error("Invalid local record revisions; refusing to overwrite.");
      const doc = validate(document2);
      if (doc.page.identity !== identity || ["annotations", "assets"].some((field) => doc[field].some((a) => !Object.hasOwn(localState.records[field], a.id))) || doc.annotations.some((a) => Object.hasOwn(localState.tombstones, a.id))) throw new Error("Invalid local page identity/tombstones; refusing to overwrite.");
      return { document: doc, revision: localState.revision, tombstones: localState.tombstones, records: localState.records };
    }
    async function commit(base, proposed, { replace = false, restore = false, currentUrl = () => url } = {}) {
      const next = validate(proposed);
      if (!locks?.request) throw new Error("Saving disabled: Web Locks unavailable. Use a supported secure-context browser; no unsafe localStorage fallback.");
      return locks.request(key, () => {
        if (!observeRoute(currentUrl()) || next.page.identity !== identity) throw new Error("URL differs: reload/reopen annotations on this page before saving.");
        const latest = read();
        if (latest.document.page.identity !== base.document.page.identity || JSON.stringify(latest.document.page.documentSize) !== JSON.stringify(base.document.page.documentSize) || latest.document.page.versionHint !== base.document.page.versionHint) conflict();
        if (replace && latest.revision !== base.revision) conflict();
        const tombstones = { ...latest.tombstones };
        const revision = latest.revision + 1;
        const records = structuredClone(latest.records);
        const reconcile = (field, trackDeletes) => {
          const before = new Map(base.document[field].map((a) => [a.id, a]));
          const wanted = new Map(next[field].map((a) => [a.id, a]));
          const live = new Map(latest.document[field].map((a) => [a.id, a]));
          for (const id of /* @__PURE__ */ new Set([...before.keys(), ...wanted.keys()])) {
            const old = before.get(id), value = wanted.get(id);
            if (equal(old, value)) continue;
            if (!equal(live.get(id), old) || latest.records[field][id] !== base.records[field][id]) conflict();
            if (trackDeletes && value && old && (!equal(value.author, old.author) || value.createdAt !== old.createdAt)) throw new Error("Annotation attribution is immutable.");
            if (trackDeletes && value && Object.hasOwn(tombstones, id)) {
              if (!restore || base.tombstones[id] !== tombstones[id]) conflict();
              delete tombstones[id];
            }
            Object.defineProperty(records[field], id, { value: revision, enumerable: true, writable: true, configurable: true });
            if (value) live.set(id, value);
            else {
              live.delete(id);
              if (trackDeletes) Object.defineProperty(tombstones, id, { value: revision, enumerable: true, writable: true, configurable: true });
            }
          }
          return [...live.values()];
        };
        if (!equal(base.document.page, next.page) && !equal(base.document.page, latest.document.page)) conflict();
        const document2 = validate({ ...latest.document, page: equal(base.document.page, next.page) ? latest.document.page : next.page, annotations: reconcile("annotations", true), assets: reconcile("assets", false) });
        storage.setItem(key, JSON.stringify({ ...document2, localState: { revision, tombstones, records } }));
        return { document: document2, revision, tombstones, records };
      });
    }
    return { key, read, commit, observeRoute };
  }

  // src/ui.mjs
  function mountSidepiece({ win = window, storage = window.localStorage, slackAdapter = null } = {}) {
    const { document: dom } = win;
    if (dom.getElementById("sidepiece-root")) return;
    const url = win.location.href;
    const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
    const size = () => ({ width: Math.max(dom.documentElement.scrollWidth, win.innerWidth), height: Math.max(dom.documentElement.scrollHeight, win.innerHeight) });
    const versionHint = dom.querySelector('meta[name="sidepiece-version"]')?.content || "";
    const create = () => {
      const doc = newDocument(url, viewport(), size());
      doc.page.versionHint = versionHint;
      return doc;
    };
    const store = createLocalStore({ storage, locks: win.navigator.locks, url, create });
    let snapshot, loadError = "";
    try {
      snapshot = store.read();
    } catch (err) {
      loadError = err.message;
      snapshot = { document: create(), revision: 0, tombstones: {}, records: { annotations: {}, assets: {} } };
    }
    let state = snapshot.document;
    const issues = () => !store.observeRoute(win.location.href) ? ["URL changed"] : compatibility(state, win.location.href, size(), versionHint);
    let currentAssetId = "";
    const history = [];
    let active = false, visible = true, dragging = null, tool = "rectangle";
    let authorId = storage.getItem("sidepiece:author") || "jarad";
    const names = { jarad: "Jarad", damian: "Damian" };
    const host = dom.createElement("div");
    host.id = "sidepiece-root";
    host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;font:14px system-ui;color:#e8edf6";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
    *{box-sizing:border-box} .panel{position:fixed;right:12px;top:12px;width:300px;max-height:calc(100vh - 24px);overflow:auto;background:#182232;color:#e8edf6;border:1px solid #8095af;border-radius:10px;padding:12px;box-shadow:0 8px 30px #0008;pointer-events:auto;font:13px system-ui}
    button,select,input,textarea{font:inherit;border-radius:5px;padding:4px;background:#2d4057;color:white;border:1px solid #758ca5;margin:2px}button{cursor:pointer}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #ffca69}button[aria-pressed=true]{background:#97651a}
    .bar{display:flex;flex-wrap:wrap;gap:2px}.item{border-top:1px solid #58677b;padding:6px 0;overflow-wrap:anywhere}.muted{color:#bccbdc}.error{color:#ffbd9c;min-height:18px}textarea{width:100%;height:48px}canvas{position:fixed;inset:0;pointer-events:none}
  </style><canvas></canvas><section class="panel" aria-label="Sidepiece annotations"><strong>Sidepiece \xB7 review</strong><div class="bar"><select aria-label="Author"><option value="jarad">Jarad</option><option value="damian">Damian</option></select><button data-action="active" aria-pressed="false">Start drawing</button><button data-action="visible">Hide marks</button></div><div class="bar">${["circle", "rectangle", "arrow", "freehand"].map((x) => `<button data-tool="${x}">${x}</button>`).join("")}</div><textarea aria-label="Annotation note" placeholder="Note for next mark"></textarea><div class="bar"><button data-action="undo">Undo</button><button data-action="asset">Reference screenshot</button><input type="file" accept="image/png,image/jpeg,image/webp" data-asset hidden><button data-action="export">Export JSON</button><button data-action="import">Import JSON</button><input type="file" accept=".json,application/json" hidden><button data-action="markdown">Copy Markdown</button><button data-action="markdown-export">Export Markdown</button><button data-action="slack">Send Slack</button></div><div class="error" role="status" aria-live="polite"></div><div class="items"></div></section>`;
    dom.documentElement.append(host);
    const canvas = shadow.querySelector("canvas"), ctx = canvas.getContext("2d");
    const panel = shadow.querySelector(".panel"), status = shadow.querySelector(".error"), items = shadow.querySelector(".items");
    const author = shadow.querySelector("select"), note = shadow.querySelector("textarea");
    if (authorId === "damian") author.value = authorId;
    else {
      authorId = "jarad";
      author.value = "jarad";
    }
    const message = (s) => {
      status.textContent = s;
    };
    function refresh() {
      snapshot = store.read();
      state = snapshot.document;
      render();
    }
    async function persist(next, base = snapshot, options = {}) {
      try {
        const saved = await store.commit(base, next, { ...options, currentUrl: () => win.location.href });
        if (!options.undo) {
          const inverse = structuredClone(saved.document);
          for (const field of ["annotations", "assets"]) {
            const before = new Map(base.document[field].map((a) => [a.id, a]));
            const after = new Map(next[field].map((a) => [a.id, a]));
            const records = new Map(inverse[field].map((a) => [a.id, a]));
            for (const id of /* @__PURE__ */ new Set([...before.keys(), ...after.keys()])) {
              if (JSON.stringify(before.get(id)) === JSON.stringify(after.get(id))) continue;
              if (before.has(id)) records.set(id, before.get(id));
              else records.delete(id);
            }
            inverse[field] = [...records.values()];
          }
          if (JSON.stringify(base.document.page) !== JSON.stringify(next.page)) inverse.page = base.document.page;
          history.push({ saved, inverse });
        }
        snapshot = saved;
        state = saved.document;
        render();
      } catch (err) {
        try {
          refresh();
        } catch {
        }
        throw err;
      }
    }
    const attempt = async (action) => {
      try {
        await action();
      } catch (err) {
        message(err.message);
      }
    };
    function draw(a) {
      const pts = a.points.map((p) => ({ x: p.x - win.scrollX, y: p.y - win.scrollY }));
      if (!pts.length) return;
      ctx.strokeStyle = a.author.id === "damian" ? "#7adbbf" : "#ffbc5b";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      const end = pts.at(-1);
      if (a.shape === "circle") {
        const r = Math.hypot(end.x - pts[0].x, end.y - pts[0].y);
        ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2);
      } else if (a.shape === "rectangle") ctx.rect(pts[0].x, pts[0].y, end.x - pts[0].x, end.y - pts[0].y);
      else {
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      if (a.shape === "arrow") {
        const angle = Math.atan2(end.y - pts[0].y, end.x - pts[0].x);
        ctx.beginPath();
        ctx.moveTo(end.x - 12 * Math.cos(angle - 0.5), end.y - 12 * Math.sin(angle - 0.5));
        ctx.lineTo(end.x, end.y);
        ctx.lineTo(end.x - 12 * Math.cos(angle + 0.5), end.y - 12 * Math.sin(angle + 0.5));
        ctx.stroke();
      }
    }
    function render() {
      canvas.width = win.innerWidth * win.devicePixelRatio;
      canvas.height = win.innerHeight * win.devicePixelRatio;
      canvas.style.width = `${win.innerWidth}px`;
      canvas.style.height = `${win.innerHeight}px`;
      ctx.setTransform(win.devicePixelRatio, 0, 0, win.devicePixelRatio, 0, 0);
      if (visible && !issues().length) {
        state.annotations.forEach(draw);
        if (dragging) draw({ shape: tool, author: { id: authorId }, points: dragging.points });
      } else if (state.annotations.length && visible) message(`Saved marks hidden: ${issues().join(", ")}. Reload after URL changes.`);
      items.replaceChildren();
      for (const a of state.annotations) {
        const row = dom.createElement("div");
        row.className = "item";
        const label = dom.createElement("span");
        label.textContent = `${a.author.display} \xB7 ${a.shape} \xB7 ${a.note || "(no note)"}`;
        const base = snapshot;
        const edit = dom.createElement("button");
        edit.textContent = "Edit note";
        edit.onclick = () => attempt(async () => {
          const value = win.prompt("Edit annotation note (author stays unchanged)", a.note);
          if (value !== null) {
            try {
              await persist({ ...base.document, annotations: base.document.annotations.map((mark) => mark.id === a.id ? { ...mark, note: value } : mark) }, base);
              message("Note saved locally.");
            } catch (err) {
              note.value = value;
              throw new Error(`${err.message} Unsaved edit kept in the note field.`);
            }
          }
        });
        const del = dom.createElement("button");
        del.textContent = "Delete";
        del.setAttribute("aria-label", `Delete ${a.id}`);
        del.onclick = () => attempt(async () => {
          await persist(removeAnnotation(base.document, a.id), base);
          message("Deleted locally.");
        });
        row.append(label, edit, del);
        items.append(row);
      }
    }
    function position(e) {
      return { x: Math.round(e.clientX + win.scrollX), y: Math.round(e.clientY + win.scrollY) };
    }
    function down(e) {
      if (!active || issues().length || panel.contains(e.composedPath()[0]) || e.button !== 0) return;
      e.preventDefault();
      const anchorElement = dom.elementFromPoint(e.clientX, e.clientY);
      const anchor = anchorElement && !host.contains(anchorElement) ? `${anchorElement.tagName.toLowerCase()}${anchorElement.id ? `#${anchorElement.id}` : ""}` : "";
      dragging = { base: snapshot, points: [position(e)], anchor, text: anchorElement?.textContent?.trim().slice(0, 120) || "" };
    }
    function move(e) {
      if (!dragging) return;
      const p = position(e);
      if (tool === "freehand") dragging.points.push(p);
      else dragging.points[1] = p;
      render();
    }
    async function up(e) {
      if (!dragging) return;
      move(e);
      const { points, anchor, text: text2, base } = dragging;
      dragging = null;
      if (points.length < 2) {
        render();
        return;
      }
      const a = { id: win.crypto.randomUUID(), shape: tool, points, note: note.value, author: { id: authorId, display: names[authorId] }, createdAt: (/* @__PURE__ */ new Date()).toISOString(), target: { url, anchor, text: text2 }, assetId: currentAssetId };
      try {
        await persist(addAnnotation(base.document, a), base);
        if (note.value === a.note) note.value = "";
        message("Saved locally.");
      } catch (err) {
        message(err.message);
        render();
      }
    }
    dom.addEventListener("pointerdown", down, true);
    dom.addEventListener("pointermove", move, true);
    dom.addEventListener("pointerup", up, true);
    dom.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        active = false;
        dragging = null;
        shadow.querySelector("[data-action=active]").setAttribute("aria-pressed", "false");
        shadow.querySelector("[data-action=active]").textContent = "Start drawing";
        render();
      }
    });
    win.addEventListener("resize", render);
    win.addEventListener("scroll", render);
    author.onchange = () => {
      authorId = author.value;
      storage.setItem("sidepiece:author", authorId);
    };
    shadow.querySelectorAll("[data-tool]").forEach((button) => button.onclick = () => {
      tool = button.dataset.tool;
      shadow.querySelectorAll("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    });
    shadow.querySelector("[data-tool=rectangle]").setAttribute("aria-pressed", "true");
    shadow.querySelector("[data-action=active]").onclick = (e) => {
      active = !active;
      e.target.setAttribute("aria-pressed", String(active));
      e.target.textContent = active ? "Stop drawing" : "Start drawing";
    };
    shadow.querySelector("[data-action=visible]").onclick = (e) => {
      visible = !visible;
      e.target.textContent = visible ? "Hide marks" : "Show marks";
      render();
    };
    shadow.querySelector("[data-action=undo]").onclick = () => attempt(async () => {
      const entry = history.at(-1);
      if (!entry) return;
      await persist(entry.inverse, entry.saved, { undo: true, restore: true });
      history.pop();
      message("Undid this tab\u2019s last change.");
    });
    const assetFile = shadow.querySelector("input[data-asset]");
    shadow.querySelector("[data-action=asset]").onclick = () => assetFile.click();
    assetFile.onchange = async () => {
      const chosen = assetFile.files?.[0];
      if (!chosen) return;
      const asset = { id: win.crypto.randomUUID(), name: chosen.name, type: chosen.type, ref: `manual:${chosen.name}` };
      try {
        await persist(validate({ ...state, assets: [...state.assets, asset] }));
        currentAssetId = asset.id;
        message(`Reference only: keep ${chosen.name} alongside the JSON. No upload or image bytes saved.`);
      } catch (err) {
        message(err.message);
      } finally {
        assetFile.value = "";
      }
    };
    function download(contents, type, name) {
      const blob = new Blob([contents], { type });
      const link = dom.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1e3);
    }
    shadow.querySelector("[data-action=export]").onclick = () => download(JSON.stringify(state, null, 2), "application/json", "review.sidepiece.json");
    shadow.querySelector("[data-action=markdown-export]").onclick = () => download(markdown(state), "text/markdown", "review.sidepiece.md");
    shadow.querySelector("[data-action=markdown]").onclick = async () => {
      try {
        await win.navigator.clipboard.writeText(markdown(state));
        message("Attributed Markdown copied.");
      } catch {
        message("Clipboard unavailable. Export JSON still works.");
      }
    };
    shadow.querySelector("[data-action=slack]").onclick = async () => {
      try {
        const result = await sendSlack(markdown(state), slackAdapter);
        message(result.sent ? "Sent to configured Slack destination." : result.reason);
      } catch (err) {
        message(`Slack send failed: ${err.message}`);
      }
    };
    const file = shadow.querySelector('input[accept=".json,application/json"]');
    shadow.querySelector("[data-action=import]").onclick = () => file.click();
    file.onchange = async () => {
      try {
        if (issues().includes("URL changed")) throw new Error("URL differs: reload/reopen annotations on this page before importing.");
        const base = snapshot;
        const raw = await file.files[0].text();
        const proposed = validate(raw);
        const warnings = compatibility(proposed, win.location.href, size(), versionHint);
        if (warnings.length) {
          message(`Not imported: ${warnings.join(", ")}. Open the matching page.`);
          return;
        }
        const mode = win.prompt("Import mode: type merge or replace (Cancel makes no change)", "merge");
        if (!mode) return;
        const result = importDocument(base.document, proposed, mode, win.location.href, size(), versionHint);
        if (result.applied) {
          await persist(result.document, base, { replace: mode === "replace" });
          message(`Imported (${mode}).`);
        }
      } catch (err) {
        message(err.message);
      } finally {
        file.value = "";
      }
    };
    const onStorage = (event) => {
      if (event.key === store.key || event.key === null) attempt(async () => {
        refresh();
        message("Updated from another tab.");
      });
    };
    win.addEventListener("storage", onStorage);
    const onFocus = () => attempt(async () => refresh());
    win.addEventListener("focus", onFocus);
    let routeFrame, mounted = true, routeAnnounced = false;
    const routeChanged = (event) => {
      if (event?.newURL) store.observeRoute(event.newURL);
      if (!store.observeRoute(win.location.href) && !routeAnnounced) {
        routeAnnounced = true;
        dragging = null;
        render();
        message("URL changed: reload/reopen annotations before editing.");
      }
    };
    const navigationMethods = ["pushState", "replaceState"].map((name) => {
      const original = win.history[name];
      const wrapped = function(...args) {
        const result = original.apply(this, args);
        routeChanged();
        return result;
      };
      win.history[name] = wrapped;
      return [name, original, wrapped];
    });
    win.addEventListener("popstate", routeChanged);
    win.addEventListener("hashchange", routeChanged);
    win.addEventListener("pageshow", routeChanged);
    function watchRoute() {
      if (!mounted) return;
      routeChanged();
      routeFrame = win.requestAnimationFrame(watchRoute);
    }
    watchRoute();
    render();
    if (loadError) message(loadError);
    else if (!win.navigator.locks?.request) message("Saving disabled: Web Locks unavailable. Read/export only.");
    else if (storage.getItem(`sidepiece:${new URL(url).origin}${new URL(url).pathname}`)) message("Legacy path-only data is untouched. Export it with the old version and explicitly verify its page before migration.");
    return { getDocument: () => structuredClone(state), unmount: () => {
      mounted = false;
      win.cancelAnimationFrame(routeFrame);
      for (const [name, original, wrapped] of navigationMethods) if (win.history[name] === wrapped) win.history[name] = original;
      win.removeEventListener("popstate", routeChanged);
      win.removeEventListener("hashchange", routeChanged);
      win.removeEventListener("pageshow", routeChanged);
      win.removeEventListener("storage", onStorage);
      win.removeEventListener("focus", onFocus);
      host.remove();
      dom.removeEventListener("pointerdown", down, true);
      dom.removeEventListener("pointermove", move, true);
      dom.removeEventListener("pointerup", up, true);
      win.removeEventListener("resize", render);
      win.removeEventListener("scroll", render);
    } };
  }

  // src/userscript.mjs
  var origins;
  try {
    origins = JSON.parse(localStorage.getItem("sidepiece:allowed-origins") || "[]");
  } catch {
    origins = [];
  }
  if (Array.isArray(origins) && origins.includes(location.origin)) {
    const button = document.createElement("button");
    button.textContent = "Sidepiece";
    button.setAttribute("aria-label", "Open Sidepiece annotations");
    button.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:2147483647;background:#182232;color:white;padding:8px;border:1px solid #8095af;border-radius:6px;cursor:pointer";
    button.onclick = () => {
      mountSidepiece();
      button.remove();
    };
    document.documentElement.append(button);
  }
})();
