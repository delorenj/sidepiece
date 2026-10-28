import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const bundle = await readFile(new URL('../demo/sidepiece.user.js', import.meta.url), 'utf8');
const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><body><h1 id="hero">Review document</h1><p>Review me</p></body></html>'); });
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const alice = `${origin}/review?doc=alice#/one`, bob = `${origin}/review?doc=bob#/one`, hash = `${origin}/review?doc=alice#/two`;
const profile = await mkdtemp(join(tmpdir(), 'SIDE-49-browser-'));
const options = { headless: true, executablePath: process.env.CHROME_PATH || '/home/delorenj/.local/bin/google-chrome', args: ['--no-sandbox'], viewport: { width: 1000, height: 700 }, acceptDownloads: true };
let context;
const panel = page => page.locator('#sidepiece-root').locator('section');
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem(`sidepiece:v2:${location.href}`)));
const rows = page => panel(page).locator('.item');
async function waitRows(page, n) { await page.waitForFunction(n => document.getElementById('sidepiece-root').shadowRoot.querySelectorAll('.item').length === n, n); }
async function open(page, url) { await page.goto(url); await page.getByRole('button', { name: 'Open Sidepiece annotations' }).click(); }
async function draw(page, who, text, x = 120) {
  await panel(page).getByRole('combobox', { name: 'Author' }).selectOption(who);
  await panel(page).getByRole('textbox', { name: 'Annotation note' }).fill(text);
  const button = panel(page).getByRole('button', { name: 'Start drawing', exact: true });
  if (await button.count()) await button.click();
  await page.mouse.move(x, 160); await page.mouse.down(); await page.mouse.move(x + 50, 210); await page.mouse.up();
}
async function edit(page, text) {
  await page.evaluate(text => { window.prompt = () => text; }, text);
  await rows(page).first().getByRole('button', { name: 'Edit note' }).click();
  await panel(page).getByRole('status').getByText('Note saved locally.', { exact: true }).waitFor();
}
async function inject(ctx) {
  await ctx.addInitScript(({ origin, bundle }) => { if (location.origin !== origin) return; localStorage.setItem('sidepiece:allowed-origins', JSON.stringify([origin])); document.addEventListener('DOMContentLoaded', () => (0, eval)(bundle)); }, { origin, bundle });
}
async function importFile(page, text, mode = 'merge') {
  await page.evaluate(mode => { window.prompt = () => mode; }, mode);
  await panel(page).locator('input[accept=".json,application/json"]').setInputFiles({ name: 'review.sidepiece.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}
try {
  context = await chromium.launchPersistentContext(profile, options);
  await inject(context);
  const errors = [];
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const a = await context.newPage(), b = await context.newPage();
  // Register before mount so this target-phase listener precedes the UI listener.
  await b.addInitScript(() => { window.blockNotifications = e => e.stopImmediatePropagation(); window.addEventListener('storage', window.blockNotifications, true); window.addEventListener('focus', window.blockNotifications, true); });
  await open(a, alice); await open(b, alice);
  // Both start empty. Suppress B notifications temporarily to force the baseline's
  // exact stale-two-tab repro, not a lucky refreshed sequential save.
  await draw(a, 'jarad', 'Jarad first'); await waitRows(a, 1);
  assert.equal(await rows(b).count(), 0);
  await draw(b, 'damian', 'Damian second', 250);
  await waitRows(a, 2); await waitRows(b, 2);
  assert.deepEqual((await saved(a)).annotations.map(a => a.author.id), ['jarad', 'damian']);
  await b.evaluate(() => { window.removeEventListener('storage', window.blockNotifications, true); window.removeEventListener('focus', window.blockNotifications, true); });
  // Native storage notifications update panels; stale row callbacks model an edit
  // begun before another tab commits (the exact same production handler).
  await b.evaluate(() => { window.staleEdit = document.getElementById('sidepiece-root').shadowRoot.querySelector('.item button').onclick; window.staleDelete = document.getElementById('sidepiece-root').shadowRoot.querySelector('.item button[aria-label^="Delete"]').onclick; });
  await edit(a, 'Jarad winning edit');
  await rows(b).filter({ hasText: 'Jarad winning edit' }).waitFor();
  await b.evaluate(async () => { window.prompt = () => 'stale losing edit'; await window.staleEdit(); });
  await panel(b).getByRole('status').getByText(/Save conflict/).waitFor();
  assert.equal((await saved(a)).annotations[0].note, 'Jarad winning edit');
  assert.equal(await panel(b).getByRole('textbox', { name: 'Annotation note' }).inputValue(), 'stale losing edit');
  await b.evaluate(async () => window.staleDelete());
  await panel(b).getByRole('status').getByText(/Save conflict/).waitFor();
  assert.equal((await saved(a)).annotations[0].note, 'Jarad winning edit');
  // Delete wins against the edit's old base; stale edits cannot resurrect it.
  await b.evaluate(() => { window.staleEdit = document.getElementById('sidepiece-root').shadowRoot.querySelector('.item button').onclick; });
  const deletedId = (await saved(a)).annotations[0].id;
  await rows(a).first().getByRole('button', { name: /^Delete/ }).click();
  await waitRows(a, 1); await waitRows(b, 1);
  await b.evaluate(async () => { window.prompt = () => 'resurrect'; await window.staleEdit(); });
  await panel(b).getByRole('status').getByText(/Save conflict/).waitFor();
  assert.ok((await saved(a)).localState.tombstones[deletedId]);
  await draw(b, 'damian', 'After delete', 310); await waitRows(a, 2);
  assert.ok(!(await saved(a)).annotations.some(a => a.id === deletedId));
  await panel(a).getByRole('button', { name: 'Undo', exact: true }).click();
  await waitRows(a, 3); await waitRows(b, 3);
  assert.equal((await saved(a)).annotations.find(a => a.id === deletedId).author.id, 'jarad');
  // The undo restored only this deletion; it did not remove B's later addition.
  assert.ok((await saved(a)).annotations.some(a => a.note === 'After delete'));
  const exported = await a.evaluate(() => { const { localState, ...doc } = JSON.parse(localStorage.getItem(`sidepiece:v2:${location.href}`)); return JSON.stringify(doc); });
  const other = await context.newPage();
  for (const url of [bob, hash]) {
    await open(other, url); assert.equal(await rows(other).count(), 0);
    await importFile(other, exported); await panel(other).getByRole('status').getByText(/Not imported: URL differs/).waitFor();
    assert.equal(await saved(other), null);
    await draw(other, 'damian', 'Separate document'); await waitRows(other, 1);
  }
  assert.equal((await saved(a)).annotations.length, 3);
  await importFile(a, exported, 'replace'); await panel(a).getByRole('status').getByText('Imported (replace).', { exact: true }).waitFor();
  const imported = JSON.parse(exported); const newMark = structuredClone(imported.annotations[0]); newMark.id = 'external'; newMark.author = { id: 'reviewer-17', display: 'Outside reviewer' }; imported.annotations = [newMark];
  await importFile(a, JSON.stringify(imported)); await panel(a).getByRole('status').getByText('Imported (merge).', { exact: true }).waitFor();
  assert.equal((await saved(a)).annotations.at(-1).author.id, 'reviewer-17');
  // pushState changes have no browser event: our route watcher hides marks and
  // store's final URL guard refuses writes even before the next animation frame.
  await a.evaluate(() => history.pushState({}, '', '?doc=bob#/one'));
  await panel(a).getByRole('status').getByText(/URL changed/).waitFor();
  await rows(a).first().getByRole('button', { name: /^Delete/ }).click();
  await panel(a).getByRole('status').getByText(/URL differs/).waitFor();
  await context.close(); context = null;
  // Actual browser process restart with the isolated on-disk profile.
  context = await chromium.launchPersistentContext(profile, options); await inject(context);
  const restarted = await context.newPage(); await open(restarted, alice); await waitRows(restarted, 4);
  assert.equal((await saved(restarted)).annotations.at(-1).author.id, 'reviewer-17');
  await open(restarted, bob); await waitRows(restarted, 1);
  const readonly = await context.newPage();
  await readonly.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await open(readonly, `${origin}/no-locks`);
  await draw(readonly, 'jarad', 'Keep this draft');
  await panel(readonly).getByRole('status').getByText(/Web Locks unavailable/).waitFor();
  assert.equal(await saved(readonly), null);
  assert.equal(await panel(readonly).getByRole('textbox', { name: 'Annotation note' }).inputValue(), 'Keep this draft');
  assert.deepEqual(errors, []);
  console.log('browser review PASS: stale two-tab Jarad/Damian adds; native storage refresh; edit/edit and delete/edit refusal; tombstones; selective undo; separate query/hash keys and import refusal; same-page replace/merge author preservation; pushState guard; browser-process restart; no-lock write refusal; no page errors');
} finally { await context?.close(); await new Promise(ok => server.close(ok)); await rm(profile, { recursive: true, force: true }); }
