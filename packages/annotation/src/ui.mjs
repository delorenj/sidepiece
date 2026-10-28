import { addAnnotation, compatibility, importDocument, markdown, newDocument, removeAnnotation, sendSlack, validate } from './core.mjs';
import { createLocalStore } from './store.mjs';

export function mountSidepiece({ win = window, storage = window.localStorage, slackAdapter = null } = {}) {
  const { document: dom } = win;
  if (dom.getElementById('sidepiece-root')) return;
  const url = win.location.href;
  const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
  const size = () => ({ width: Math.max(dom.documentElement.scrollWidth, win.innerWidth), height: Math.max(dom.documentElement.scrollHeight, win.innerHeight) });
  const versionHint = dom.querySelector('meta[name="sidepiece-version"]')?.content || '';
  const create = () => { const doc = newDocument(url, viewport(), size()); doc.page.versionHint = versionHint; return doc; };
  const store = createLocalStore({ storage, locks: win.navigator.locks, url, create });
  let snapshot, loadError = '';
  try { snapshot = store.read(); } catch (err) { loadError = err.message; snapshot = { document: create(), revision: 0, tombstones: {}, records: { annotations: {}, assets: {} } }; }
  let state = snapshot.document;
  const issues = () => compatibility(state, win.location.href, size(), versionHint);
  let currentAssetId = '';
  const history = [];
  let active = false, visible = true, dragging = null, tool = 'rectangle';
  let authorId = storage.getItem('sidepiece:author') || 'jarad';
  const names = { jarad: 'Jarad', damian: 'Damian' };
  const host = dom.createElement('div'); host.id = 'sidepiece-root';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none;font:14px system-ui;color:#e8edf6';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    *{box-sizing:border-box} .panel{position:fixed;right:12px;top:12px;width:300px;max-height:calc(100vh - 24px);overflow:auto;background:#182232;color:#e8edf6;border:1px solid #8095af;border-radius:10px;padding:12px;box-shadow:0 8px 30px #0008;pointer-events:auto;font:13px system-ui}
    button,select,input,textarea{font:inherit;border-radius:5px;padding:4px;background:#2d4057;color:white;border:1px solid #758ca5;margin:2px}button{cursor:pointer}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid #ffca69}button[aria-pressed=true]{background:#97651a}
    .bar{display:flex;flex-wrap:wrap;gap:2px}.item{border-top:1px solid #58677b;padding:6px 0;overflow-wrap:anywhere}.muted{color:#bccbdc}.error{color:#ffbd9c;min-height:18px}textarea{width:100%;height:48px}canvas{position:fixed;inset:0;pointer-events:none}
  </style><canvas></canvas><section class="panel" aria-label="Sidepiece annotations"><strong>Sidepiece · review</strong><div class="bar"><select aria-label="Author"><option value="jarad">Jarad</option><option value="damian">Damian</option></select><button data-action="active" aria-pressed="false">Start drawing</button><button data-action="visible">Hide marks</button></div><div class="bar">${['circle','rectangle','arrow','freehand'].map(x => `<button data-tool="${x}">${x}</button>`).join('')}</div><textarea aria-label="Annotation note" placeholder="Note for next mark"></textarea><div class="bar"><button data-action="undo">Undo</button><button data-action="asset">Reference screenshot</button><input type="file" accept="image/png,image/jpeg,image/webp" data-asset hidden><button data-action="export">Export JSON</button><button data-action="import">Import JSON</button><input type="file" accept=".json,application/json" hidden><button data-action="markdown">Copy Markdown</button><button data-action="markdown-export">Export Markdown</button><button data-action="slack">Send Slack</button></div><div class="error" role="status" aria-live="polite"></div><div class="items"></div></section>`;
  dom.documentElement.append(host);
  const canvas = shadow.querySelector('canvas'), ctx = canvas.getContext('2d');
  const panel = shadow.querySelector('.panel'), status = shadow.querySelector('.error'), items = shadow.querySelector('.items');
  const author = shadow.querySelector('select'), note = shadow.querySelector('textarea');
  if (authorId === 'damian') author.value = authorId;
  else { authorId = 'jarad'; author.value = 'jarad'; }
  const message = s => { status.textContent = s; };
  function refresh() { snapshot = store.read(); state = snapshot.document; render(); }
  async function persist(next, base = snapshot, options = {}) {
    try {
      const saved = await store.commit(base, next, { ...options, currentUrl: () => win.location.href });
      if (!options.undo) {
        // Invert only this operation, never the whole stale document.
        const inverse = structuredClone(saved.document);
        for (const field of ['annotations', 'assets']) {
          const before = new Map(base.document[field].map(a => [a.id, a]));
          const after = new Map(next[field].map(a => [a.id, a]));
          const records = new Map(inverse[field].map(a => [a.id, a]));
          for (const id of new Set([...before.keys(), ...after.keys()])) {
            if (JSON.stringify(before.get(id)) === JSON.stringify(after.get(id))) continue;
            if (before.has(id)) records.set(id, before.get(id)); else records.delete(id);
          }
          inverse[field] = [...records.values()];
        }
        if (JSON.stringify(base.document.page) !== JSON.stringify(next.page)) inverse.page = base.document.page;
        history.push({ saved, inverse });
      }
      snapshot = saved; state = saved.document; render();
    } catch (err) { try { refresh(); } catch {} throw err; }
  }
  const attempt = async action => { try { await action(); } catch (err) { message(err.message); } };
  function draw(a) {
    const pts = a.points.map(p => ({ x: p.x - win.scrollX, y: p.y - win.scrollY }));
    if (!pts.length) return;
    ctx.strokeStyle = a.author.id === 'damian' ? '#7adbbf' : '#ffbc5b'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    const end = pts.at(-1);
    if (a.shape === 'circle') { const r = Math.hypot(end.x - pts[0].x, end.y - pts[0].y); ctx.arc(pts[0].x, pts[0].y, r, 0, Math.PI * 2); }
    else if (a.shape === 'rectangle') ctx.rect(pts[0].x, pts[0].y, end.x - pts[0].x, end.y - pts[0].y);
    else { for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    if (a.shape === 'arrow') { const angle = Math.atan2(end.y - pts[0].y, end.x - pts[0].x); ctx.beginPath(); ctx.moveTo(end.x - 12*Math.cos(angle-.5),end.y-12*Math.sin(angle-.5));ctx.lineTo(end.x,end.y);ctx.lineTo(end.x-12*Math.cos(angle+.5),end.y-12*Math.sin(angle+.5));ctx.stroke(); }
  }
  function render() {
    canvas.width = win.innerWidth * win.devicePixelRatio; canvas.height = win.innerHeight * win.devicePixelRatio;
    canvas.style.width = `${win.innerWidth}px`; canvas.style.height = `${win.innerHeight}px`; ctx.setTransform(win.devicePixelRatio,0,0,win.devicePixelRatio,0,0);
    if (visible && !issues().length) { state.annotations.forEach(draw); if (dragging) draw({ shape: tool, author: { id: authorId }, points: dragging.points }); }
    else if (state.annotations.length && visible) message(`Saved marks hidden: ${issues().join(', ')}. Reload after URL changes.`);
    items.replaceChildren();
    for (const a of state.annotations) {
      const row = dom.createElement('div'); row.className = 'item';
      const label = dom.createElement('span'); label.textContent = `${a.author.display} · ${a.shape} · ${a.note || '(no note)'}`;
      const base = snapshot;
      const edit = dom.createElement('button'); edit.textContent = 'Edit note'; edit.onclick = () => attempt(async () => {
        const value = win.prompt('Edit annotation note (author stays unchanged)', a.note);
        if (value !== null) {
          try { await persist({ ...base.document, annotations: base.document.annotations.map(mark => mark.id === a.id ? { ...mark, note: value } : mark) }, base); message('Note saved locally.'); }
          catch (err) { note.value = value; throw new Error(`${err.message} Unsaved edit kept in the note field.`); }
        }
      });
      const del = dom.createElement('button'); del.textContent = 'Delete'; del.setAttribute('aria-label', `Delete ${a.id}`); del.onclick = () => attempt(async () => { await persist(removeAnnotation(base.document, a.id), base); message('Deleted locally.'); }); row.append(label, edit, del); items.append(row);
    }
  }
  function position(e) { return { x: Math.round(e.clientX + win.scrollX), y: Math.round(e.clientY + win.scrollY) }; }
  function down(e) {
    if (!active || issues().length || panel.contains(e.composedPath()[0]) || e.button !== 0) return;
    e.preventDefault();
    const anchorElement = dom.elementFromPoint(e.clientX, e.clientY);
    const anchor = anchorElement && !host.contains(anchorElement) ? `${anchorElement.tagName.toLowerCase()}${anchorElement.id ? `#${anchorElement.id}` : ''}` : '';
    dragging = { base: snapshot, points: [position(e)], anchor, text: anchorElement?.textContent?.trim().slice(0, 120) || '' };
  }
  function move(e) { if (!dragging) return; const p = position(e); if (tool === 'freehand') dragging.points.push(p); else dragging.points[1] = p; render(); }
  async function up(e) {
    if (!dragging) return; move(e);
    const { points, anchor, text, base } = dragging; dragging = null;
    if (points.length < 2) { render(); return; }
    const a = { id: win.crypto.randomUUID(), shape: tool, points, note: note.value, author: { id: authorId, display: names[authorId] }, createdAt: new Date().toISOString(), target: { url, anchor, text }, assetId: currentAssetId };
    try { await persist(addAnnotation(base.document, a), base); if (note.value === a.note) note.value = ''; message('Saved locally.'); } catch (err) { message(err.message); render(); }
  }
  dom.addEventListener('pointerdown', down, true); dom.addEventListener('pointermove', move, true); dom.addEventListener('pointerup', up, true);
  dom.addEventListener('keydown', e => { if (e.key === 'Escape') { active = false; dragging = null; shadow.querySelector('[data-action=active]').setAttribute('aria-pressed', 'false'); shadow.querySelector('[data-action=active]').textContent = 'Start drawing'; render(); } });
  win.addEventListener('resize', render); win.addEventListener('scroll', render);
  author.onchange = () => { authorId = author.value; storage.setItem('sidepiece:author', authorId); };
  shadow.querySelectorAll('[data-tool]').forEach(button => button.onclick = () => { tool = button.dataset.tool; shadow.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); });
  shadow.querySelector('[data-tool=rectangle]').setAttribute('aria-pressed','true');
  shadow.querySelector('[data-action=active]').onclick = e => { active = !active; e.target.setAttribute('aria-pressed', String(active)); e.target.textContent = active ? 'Stop drawing' : 'Start drawing'; };
  shadow.querySelector('[data-action=visible]').onclick = e => { visible = !visible; e.target.textContent = visible ? 'Hide marks' : 'Show marks'; render(); };
  shadow.querySelector('[data-action=undo]').onclick = () => attempt(async () => {
    const entry = history.at(-1); if (!entry) return;
    await persist(entry.inverse, entry.saved, { undo: true, restore: true });
    history.pop(); message('Undid this tab’s last change.');
  });
  const assetFile = shadow.querySelector('input[data-asset]');
  shadow.querySelector('[data-action=asset]').onclick = () => assetFile.click();
  assetFile.onchange = async () => {
    const chosen = assetFile.files?.[0]; if (!chosen) return;
    const asset = { id: win.crypto.randomUUID(), name: chosen.name, type: chosen.type, ref: `manual:${chosen.name}` };
    try { await persist(validate({ ...state, assets: [...state.assets, asset] })); currentAssetId = asset.id; message(`Reference only: keep ${chosen.name} alongside the JSON. No upload or image bytes saved.`); }
    catch (err) { message(err.message); } finally { assetFile.value = ''; }
  };
  function download(contents, type, name) { const blob = new Blob([contents], { type }); const link = dom.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
  shadow.querySelector('[data-action=export]').onclick = () => download(JSON.stringify(state, null, 2), 'application/json', 'review.sidepiece.json');
  shadow.querySelector('[data-action=markdown-export]').onclick = () => download(markdown(state), 'text/markdown', 'review.sidepiece.md');
  shadow.querySelector('[data-action=markdown]').onclick = async () => { try { await win.navigator.clipboard.writeText(markdown(state)); message('Attributed Markdown copied.'); } catch { message('Clipboard unavailable. Export JSON still works.'); } };
  shadow.querySelector('[data-action=slack]').onclick = async () => { try { const result = await sendSlack(markdown(state), slackAdapter); message(result.sent ? 'Sent to configured Slack destination.' : result.reason); } catch (err) { message(`Slack send failed: ${err.message}`); } };
  const file = shadow.querySelector('input[accept=".json,application/json"]');
  shadow.querySelector('[data-action=import]').onclick = () => file.click();
  file.onchange = async () => {
    try {
      const base = snapshot;
      const raw = await file.files[0].text();
      const proposed = validate(raw); const warnings = compatibility(proposed, win.location.href, size(), versionHint);
      if (warnings.length) { message(`Not imported: ${warnings.join(', ')}. Open the matching page.`); return; }
      const mode = win.prompt('Import mode: type merge or replace (Cancel makes no change)', 'merge');
      if (!mode) return;
      const result = importDocument(base.document, proposed, mode, win.location.href, size(), versionHint);
      if (result.applied) { await persist(result.document, base, { replace: mode === 'replace' }); message(`Imported (${mode}).`); }
    } catch (err) { message(err.message); } finally { file.value = ''; }
  };
  const onStorage = event => { if (event.key === store.key || event.key === null) attempt(async () => { refresh(); message('Updated from another tab.'); }); };
  win.addEventListener('storage', onStorage);
  const onFocus = () => attempt(async () => refresh());
  win.addEventListener('focus', onFocus);
  let routeFrame, observedUrl = url, mounted = true;
  function watchRoute() {
    if (!mounted) return;
    if (observedUrl !== win.location.href) { observedUrl = win.location.href; dragging = null; render(); message('URL changed: reload/reopen annotations before editing.'); }
    routeFrame = win.requestAnimationFrame(watchRoute);
  }
  watchRoute(); render();
  if (loadError) message(loadError);
  else if (!win.navigator.locks?.request) message('Saving disabled: Web Locks unavailable. Read/export only.');
  else if (storage.getItem(`sidepiece:${new URL(url).origin}${new URL(url).pathname}`)) message('Legacy path-only data is untouched. Export it with the old version and explicitly verify its page before migration.');
  return { getDocument: () => structuredClone(state), unmount: () => { mounted = false; win.cancelAnimationFrame(routeFrame); win.removeEventListener('storage', onStorage); win.removeEventListener('focus', onFocus); host.remove(); dom.removeEventListener('pointerdown', down, true); dom.removeEventListener('pointermove', move, true); dom.removeEventListener('pointerup', up, true); win.removeEventListener('resize', render); win.removeEventListener('scroll', render); } };
}
