import { addAnnotation, compatibility, importDocument, markdown, newDocument, removeAnnotation, sendSlack, validate } from './core.mjs';

export function mountSidepiece({ win = window, storage = window.localStorage, slackAdapter = null } = {}) {
  const { document: dom } = win;
  if (dom.getElementById('sidepiece-root')) return;
  const url = win.location.href;
  const identity = new URL(url).origin + new URL(url).pathname;
  const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
  const size = () => ({ width: Math.max(dom.documentElement.scrollWidth, win.innerWidth), height: Math.max(dom.documentElement.scrollHeight, win.innerHeight) });
  const versionHint = dom.querySelector('meta[name="sidepiece-version"]')?.content || '';
  const key = `sidepiece:${identity}`;
  let state;
  try { state = validate(JSON.parse(storage.getItem(key) || 'null')); } catch { state = newDocument(url, viewport(), size()); }
  if (!state.page.versionHint && !state.annotations.length) state.page.versionHint = versionHint;
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
  function persist(next) { history.push(state); state = next; storage.setItem(key, JSON.stringify(state)); render(); }
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
    if (visible && !compatibility(state, url, size(), versionHint).length) { state.annotations.forEach(draw); if (dragging) draw({ shape: tool, author: { id: authorId }, points: dragging.points }); }
    else if (state.annotations.length && visible) message(`Saved marks hidden: ${compatibility(state, url, size(), versionHint).join(', ')}.`);
    items.replaceChildren();
    for (const a of state.annotations) {
      const row = dom.createElement('div'); row.className = 'item';
      const label = dom.createElement('span'); label.textContent = `${a.author.display} · ${a.shape} · ${a.note || '(no note)'}`;
      const del = dom.createElement('button'); del.textContent = 'Delete'; del.setAttribute('aria-label', `Delete ${a.id}`); del.onclick = () => persist(removeAnnotation(state, a.id)); row.append(label, del); items.append(row);
    }
  }
  function position(e) { return { x: Math.round(e.clientX + win.scrollX), y: Math.round(e.clientY + win.scrollY) }; }
  function down(e) {
    if (!active || compatibility(state, url, size(), versionHint).length || panel.contains(e.composedPath()[0]) || e.button !== 0) return;
    e.preventDefault();
    const anchorElement = dom.elementFromPoint(e.clientX, e.clientY);
    const anchor = anchorElement && !host.contains(anchorElement) ? `${anchorElement.tagName.toLowerCase()}${anchorElement.id ? `#${anchorElement.id}` : ''}` : '';
    dragging = { points: [position(e)], anchor, text: anchorElement?.textContent?.trim().slice(0, 120) || '' };
  }
  function move(e) { if (!dragging) return; const p = position(e); if (tool === 'freehand') dragging.points.push(p); else dragging.points[1] = p; render(); }
  function up(e) {
    if (!dragging) return; move(e);
    const { points, anchor, text } = dragging; dragging = null;
    if (points.length < 2) { render(); return; }
    const a = { id: win.crypto.randomUUID(), shape: tool, points, note: note.value, author: { id: authorId, display: names[authorId] }, createdAt: new Date().toISOString(), target: { url, anchor, text }, assetId: currentAssetId };
    try { persist(addAnnotation(state, a)); note.value = ''; message('Saved locally.'); } catch (err) { message(err.message); render(); }
  }
  dom.addEventListener('pointerdown', down, true); dom.addEventListener('pointermove', move, true); dom.addEventListener('pointerup', up, true);
  dom.addEventListener('keydown', e => { if (e.key === 'Escape') { active = false; dragging = null; shadow.querySelector('[data-action=active]').setAttribute('aria-pressed', 'false'); shadow.querySelector('[data-action=active]').textContent = 'Start drawing'; render(); } });
  win.addEventListener('resize', render); win.addEventListener('scroll', render);
  author.onchange = () => { authorId = author.value; storage.setItem('sidepiece:author', authorId); };
  shadow.querySelectorAll('[data-tool]').forEach(button => button.onclick = () => { tool = button.dataset.tool; shadow.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b === button))); });
  shadow.querySelector('[data-tool=rectangle]').setAttribute('aria-pressed','true');
  shadow.querySelector('[data-action=active]').onclick = e => { active = !active; e.target.setAttribute('aria-pressed', String(active)); e.target.textContent = active ? 'Stop drawing' : 'Start drawing'; };
  shadow.querySelector('[data-action=visible]').onclick = e => { visible = !visible; e.target.textContent = visible ? 'Hide marks' : 'Show marks'; render(); };
  shadow.querySelector('[data-action=undo]').onclick = () => { if (history.length) { state = history.pop(); storage.setItem(key, JSON.stringify(state)); render(); } };
  const assetFile = shadow.querySelector('input[data-asset]');
  shadow.querySelector('[data-action=asset]').onclick = () => assetFile.click();
  assetFile.onchange = () => {
    const chosen = assetFile.files?.[0]; if (!chosen) return;
    const asset = { id: win.crypto.randomUUID(), name: chosen.name, type: chosen.type, ref: `manual:${chosen.name}` };
    try { persist(validate({ ...state, assets: [...state.assets, asset] })); currentAssetId = asset.id; message(`Reference only: keep ${chosen.name} alongside the JSON. No upload or image bytes saved.`); }
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
      const raw = await file.files[0].text();
      const proposed = validate(raw); const warnings = compatibility(proposed, url, size(), versionHint);
      if (warnings.length) { message(`Not imported: ${warnings.join(', ')}. Open the matching page.`); return; }
      const mode = win.prompt('Import mode: type merge or replace (Cancel makes no change)', 'merge');
      if (!mode) return;
      const result = importDocument(state, proposed, mode, url, size(), versionHint);
      if (result.applied) { persist(result.document); message(`Imported (${mode}).`); }
    } catch (err) { message(err.message); } finally { file.value = ''; }
  };
  render();
  return { getDocument: () => structuredClone(state), unmount: () => { host.remove(); dom.removeEventListener('pointerdown', down, true); dom.removeEventListener('pointermove', move, true); dom.removeEventListener('pointerup', up, true); win.removeEventListener('resize', render); win.removeEventListener('scroll', render); } };
}
