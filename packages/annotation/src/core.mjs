// Sidepiece portable annotation document. No DOM or host dependencies.
export const FORMAT = 'sidepiece.annotations';
export const VERSION = 1;
const shapes = new Set(['circle', 'rectangle', 'arrow', 'freehand']);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const text = (s, max = 4096) => typeof s === 'string' && s.length <= max;
const dimensions = d => d && finite(d.width) && finite(d.height) && d.width > 0 && d.height > 0;
const point = p => p && finite(p.x) && finite(p.y) && p.x >= 0 && p.y >= 0;
const fail = reason => { throw new Error(`Invalid .sidepiece.json: ${reason}`); };

export function pageIdentity(url) {
  const u = new URL(url);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only HTTP(S) pages are supported');
  // Conservative document identity: retain query order/values and every fragment.
  // Even a plain #fragment may be an SPA document; never guess it is decoration.
  return u.href;
}
export function newDocument(url, viewport, documentSize) {
  if (!dimensions(viewport) || !dimensions(documentSize)) fail('dimensions');
  return { format: FORMAT, version: VERSION, page: { url, identity: pageIdentity(url), viewport, documentSize, versionHint: '' }, annotations: [], assets: [] };
}
export function validate(input) {
  let d;
  try { d = typeof input === 'string' ? JSON.parse(input) : input; } catch { fail('JSON syntax'); }
  if (!d || typeof d !== 'object' || Array.isArray(d)) fail('root');
  if (d.format !== FORMAT || d.version !== VERSION) fail('unsupported format/version');
  if (!d.page || !text(d.page.url, 8192) || !text(d.page.identity, 8192) || d.page.identity !== pageIdentity(d.page.url) || !text(d.page.versionHint, 256) || !dimensions(d.page.viewport) || !dimensions(d.page.documentSize)) fail('page');
  if (!Array.isArray(d.annotations) || d.annotations.length > 10000 || !Array.isArray(d.assets) || d.assets.length > 1000) fail('collections');
  const ids = new Set();
  for (const a of d.annotations) {
    if (!a || !text(a.id, 128) || !a.id || ids.has(a.id) || !shapes.has(a.shape) || !Array.isArray(a.points) || a.points.length < 1 || a.points.length > 20000 || !a.points.every(point) || !text(a.note) || !text(a.author?.id, 128) || !a.author.id || !text(a.author?.display, 256) || !a.author.display || !text(a.createdAt, 64) || !Number.isFinite(Date.parse(a.createdAt)) || !text(a.target?.url, 8192) || !text(a.target?.anchor, 1024) || !text(a.target?.text, 1024) || !text(a.assetId ?? '', 128)) fail('annotation');
    if ((a.shape === 'freehand' && a.points.length < 2) || (a.shape !== 'freehand' && a.points.length !== 2)) fail('geometry');
    if (pageIdentity(a.target.url) !== d.page.identity) fail('annotation target');
    ids.add(a.id);
  }
  const assetIds = new Set();
  for (const a of d.assets) {
    if (!a || !text(a.id, 128) || !a.id || assetIds.has(a.id) || !text(a.name, 256) || !text(a.type, 128) || !text(a.ref, 8192)) fail('asset');
    assetIds.add(a.id);
  }
  if (d.annotations.some(a => a.assetId && !assetIds.has(a.assetId))) fail('missing asset reference');
  return structuredClone(d);
}
export function compatibility(doc, url, documentSize, versionHint = '') {
  const issues = [];
  if (doc.page.identity !== pageIdentity(url)) issues.push('URL differs');
  if (versionHint && doc.page.versionHint && versionHint !== doc.page.versionHint) issues.push('version hint differs');
  if (documentSize && (Math.abs(doc.page.documentSize.width - documentSize.width) > 1 || Math.abs(doc.page.documentSize.height - documentSize.height) > 1)) issues.push('document size differs');
  return issues;
}
export function importDocument(current, raw, mode, url, documentSize, versionHint = '') {
  const incoming = validate(raw);
  if (!['merge', 'replace'].includes(mode)) fail('import mode');
  const warnings = compatibility(incoming, url, documentSize, versionHint);
  if (warnings.length) return { document: current, warnings, applied: false };
  if (mode === 'replace') return { document: incoming, warnings: [], applied: true };
  const existing = new Set(current.annotations.map(a => a.id));
  const assets = new Set(current.assets.map(a => a.id));
  const collisions = incoming.annotations.filter(a => existing.has(a.id) && JSON.stringify(current.annotations.find(b => b.id === a.id)) !== JSON.stringify(a));
  if (collisions.length || incoming.assets.some(a => assets.has(a.id) && JSON.stringify(current.assets.find(b => b.id === a.id)) !== JSON.stringify(a))) fail('conflicting ID; use an explicit replace or fix source');
  return { document: validate({ ...current, annotations: [...current.annotations, ...incoming.annotations.filter(a => !existing.has(a.id))], assets: [...current.assets, ...incoming.assets.filter(a => !assets.has(a.id))] }), warnings: [], applied: true };
}
export function addAnnotation(doc, annotation) { return validate({ ...doc, annotations: [...doc.annotations, annotation] }); }
export function removeAnnotation(doc, id) { return validate({ ...doc, annotations: doc.annotations.filter(a => a.id !== id) }); }
const normalizeLines = value => value.replace(/\r\n|[\r\n\u0085\u2028\u2029]/g, '\n');
// Entities render the literal characters AFTER Markdown parsing: no links, HTML,
// fences, headings or attribution can be created by any untrusted field.
const literal = value => value.replace(/[\x00-\x1f!-/:-@\[-`{-~]/g, c => `&#${c.codePointAt(0)};`);
const inline = value => literal(normalizeLines(value).replaceAll('\n', ' ↵ '));
export function markdown(doc, authorId = '') {
  validate(doc);
  const list = doc.annotations.filter(a => !authorId || a.author.id === authorId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const lines = [`# Sidepiece feedback`, '', `Page: ${inline(doc.page.url)}`, `Version hint: ${inline(doc.page.versionHint || '(none)')}`, ''];
  for (const a of list) {
    lines.push(`- **${inline(a.author.display)}** (${inline(a.author.id)}) · ${inline(a.createdAt)} · ${a.shape} · ${inline(a.target.anchor || 'page')} · ${inline(a.target.text || '')}`);
    for (const line of normalizeLines(a.note || '(no note)').split('\n')) lines.push(`  > ${literal(line).replace(/^ +/, spaces => '&#32;'.repeat(spaces.length))}`);
    lines.push(`  - Target: ${inline(a.target.url)}; geometry: ${a.points.map(p => `${p.x},${p.y}`).join(' → ')}${a.assetId ? `; asset: ${inline(a.assetId)}` : ''}`);
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
// No browser credential or network implementation. Supply a trusted server-side adapter later.
export async function sendSlack(markdownText, adapter) {
  if (!adapter?.send) return { sent: false, reason: 'Slack destination not configured; copy Markdown instead.' };
  return adapter.send(markdownText);
}
