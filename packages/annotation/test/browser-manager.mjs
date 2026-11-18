import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const extension = process.env.SIDEPIECE_USERSCRIPT_MANAGER;
if (!extension) throw new Error('Set SIDEPIECE_USERSCRIPT_MANAGER to an unpacked Violentmonkey MV3 extension directory');
const source = await readFile(new URL('../demo/sidepiece.user.js', import.meta.url));
const profile = await mkdtemp(join(tmpdir(), 'side49-manager-'));
const server = createServer((request, response) => {
  const script = request.url === '/sidepiece.user.js';
  response.setHeader('Content-Type', script ? 'application/javascript' : 'text/html');
  response.end(script ? source : '<!doctype html><html><head><meta name="sidepiece-version" content="manager-test"></head><body><h1 id="hero">Review document</h1><p>Mark this page</p></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const panel = page => page.locator('#sidepiece-root').locator('section');
let context;
try {
  context = await chromium.launchPersistentContext(profile, {
    headless: false,
    executablePath: process.env.CHROME_PATH || chromium.executablePath(),
    args: ['--no-sandbox', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1000, height: 700 },
    acceptDownloads: true,
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  assert.equal(worker.url(), `chrome-extension://${id}/sw.js`);
  const manager = await context.newPage();
  await manager.goto(`chrome://extensions/?id=${id}`);
  const userScripts = manager.locator('extensions-manager').locator('extensions-detail-view').locator('#allow-user-scripts').locator('#crToggle');
  await userScripts.waitFor();
  if (await userScripts.getAttribute('aria-pressed') !== 'true') await userScripts.click();
  assert.equal(await userScripts.getAttribute('aria-pressed'), 'true');
  await manager.goto(`chrome-extension://${id}/options/index.html`);
  await manager.getByText('Install from URL').click();
  await manager.locator('input[type=text]').fill(`${origin}/sidepiece.user.js`);
  await manager.getByRole('button', { name: 'OK', exact: true }).click();
  const confirmation = manager;
  await confirmation.getByText('Sidepiece Annotation Review, 0.1.1').waitFor();
  await confirmation.locator('button#confirm').click();
  await confirmation.getByText(/Script installed\./).waitFor();
  await confirmation.goto(`chrome-extension://${id}/options/index.html`);
  await confirmation.getByText('Sidepiece Annotation Review', { exact: true }).waitFor();
  console.log(`manager installation PASS: Violentmonkey 2.50.0 worker ${worker.url()}, Allow User Scripts enabled, installed script listed`);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/one`);
  assert.equal(await page.getByRole('button', { name: 'Open Sidepiece annotations' }).count(), 0);
  await page.evaluate(origin => localStorage.setItem('sidepiece:allowed-origins', JSON.stringify([origin])), origin);
  await page.reload();
  await page.getByRole('button', { name: 'Open Sidepiece annotations' }).click();
  const draw = async (tool, persona, note, x, y) => {
    await panel(page).getByRole('combobox', { name: 'Author' }).selectOption(persona);
    await panel(page).getByRole('textbox', { name: 'Annotation note' }).fill(note);
    await panel(page).getByRole('button', { name: tool, exact: true }).click();
    if (await panel(page).getByRole('button', { name: 'Start drawing' }).count()) await panel(page).getByRole('button', { name: 'Start drawing' }).click();
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 20, y + 20); await page.mouse.move(x + 60, y + 40); await page.mouse.up();
    await panel(page).locator('.item').filter({ hasText: note }).waitFor();
  };
  await draw('rectangle', 'jarad', 'Jarad rectangle', 80, 130);
  await draw('arrow', 'damian', 'Damian arrow', 180, 220);
  await draw('freehand', 'jarad', 'Jarad freehand', 280, 300);
  await draw('text', 'damian', 'Damian text', 80, 400);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem(`sidepiece:v2:${location.href}`)));
  assert.deepEqual(before.annotations.map(a => [a.shape, a.author.id, a.author.display, a.note]), [
    ['rectangle', 'jarad', 'Jarad', 'Jarad rectangle'],
    ['arrow', 'damian', 'Damian', 'Damian arrow'],
    ['freehand', 'jarad', 'Jarad', 'Jarad freehand'],
    ['text', 'damian', 'Damian', 'Damian text'],
  ]);
  assert.ok(before.annotations.every(a => Number.isFinite(Date.parse(a.createdAt))));
  await page.keyboard.press('Escape');
  assert.equal(await panel(page).getByRole('button', { name: 'Start drawing' }).getAttribute('aria-pressed'), 'false');
  const jsonDownload = page.waitForEvent('download');
  await panel(page).getByRole('button', { name: 'Export JSON' }).click();
  const exported = await readFile(await (await jsonDownload).path(), 'utf8');
  assert.deepEqual(JSON.parse(exported).annotations.map(a => a.author.id), ['jarad', 'damian', 'jarad', 'damian']);
  const markdownDownload = page.waitForEvent('download');
  await panel(page).getByRole('button', { name: 'Export Markdown' }).click();
  const markdown = await readFile(await (await markdownDownload).path(), 'utf8');
  for (const phrase of ['Jarad rectangle', 'Damian arrow', 'Jarad freehand', 'Damian text', 'Page:']) assert.ok(markdown.includes(phrase));
  assert.match(markdown, /\*\*Jarad\*\* \(jarad\)/);
  assert.match(markdown, /\*\*Damian\*\* \(damian\)/);
  page.once('dialog', dialog => dialog.accept('replace'));
  await panel(page).locator('input[accept=".json,application/json"]').setInputFiles({ name: 'review.sidepiece.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await panel(page).getByRole('status').getByText('Imported (replace).').waitFor();
  assert.deepEqual((await page.evaluate(() => JSON.parse(localStorage.getItem(`sidepiece:v2:${location.href}`)))).annotations, JSON.parse(exported).annotations);
  await page.reload();
  await page.getByRole('button', { name: 'Open Sidepiece annotations' }).click();
  assert.equal(await panel(page).locator('.item').count(), 4);
  const second = await context.newPage();
  second.on('pageerror', error => errors.push(error.message));
  await second.goto(`${origin}/two`);
  await second.getByRole('button', { name: 'Open Sidepiece annotations' }).click();
  await panel(second).locator('input[accept=".json,application/json"]').setInputFiles({ name: 'review.sidepiece.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
  await panel(second).getByRole('status').getByText(/Not imported: URL differs/).waitFor();
  assert.equal(await panel(second).locator('.item').count(), 0);
  assert.equal(await second.evaluate(() => localStorage.getItem(`sidepiece:v2:${location.href}`)), null);
  await panel(second).getByRole('button', { name: 'Send Slack' }).click();
  await panel(second).getByRole('status').getByText(/not configured/).waitFor();
  assert.deepEqual(errors, []);
  console.log('manager execution PASS: default off, explicit origin activation, Jarad/Damian rectangle/arrow/freehand/text and notes, immutable attribution/time, Escape, reload, JSON round-trip, attributed Markdown export, second-page import refusal, Slack unconfigured; no direct eval/addInitScript of bundle');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true });
}
