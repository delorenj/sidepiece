import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const bundle = await readFile(new URL('../demo/sidepiece.user.js', import.meta.url), 'utf8');
let version = 'v1', height = 700;
const server = createServer((_request, response) => {
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><html><head><meta name="sidepiece-version" content="${version}"></head><body><div style="height:${height}px">Mark this</div></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const panel = page => page.locator('#sidepiece-root').locator('section');
const saved = page => page.evaluate(() => localStorage.getItem(`sidepiece:v2:${location.href}`));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || chromium.executablePath(), args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  await page.goto(`${origin}/review`);
  await page.evaluate(({ origin, bundle }) => {
    localStorage.setItem('sidepiece:allowed-origins', JSON.stringify([origin]));
    (0, eval)(bundle);
  }, { origin, bundle });
  await page.getByRole('button', { name: 'Open Sidepiece annotations' }).click();
  await panel(page).getByRole('textbox', { name: 'Annotation note' }).fill('saved note');
  await panel(page).getByRole('button', { name: 'Start drawing' }).click();
  await page.mouse.move(80, 120); await page.mouse.down(); await page.mouse.move(150, 180); await page.mouse.up();
  await panel(page).locator('.item').filter({ hasText: 'saved note' }).waitFor();
  const original = await saved(page);
  assert.equal(JSON.parse(original).annotations.length, 1);
  for (const mismatch of ['version', 'dimensions']) {
    if (mismatch === 'version') version = 'v2';
    else { version = 'v1'; height = 1400; }
    await page.reload();
    await page.evaluate(bundle => (0, eval)(bundle), bundle);
    await page.getByRole('button', { name: 'Open Sidepiece annotations' }).click();
    await panel(page).getByRole('status').getByText(/Saved marks hidden/).waitFor();
    await panel(page).locator('.item').getByRole('button', { name: /^Delete/ }).click();
    await panel(page).getByRole('status').getByText(/Page differs/).waitFor();
    assert.equal(await saved(page), original, `${mismatch} delete must not change the envelope`);
    page.once('dialog', dialog => dialog.accept('unsaved edit'));
    await panel(page).locator('.item').getByRole('button', { name: 'Edit note' }).click();
    await panel(page).getByRole('status').getByText(/Page differs/).waitFor();
    assert.equal(await saved(page), original, `${mismatch} edit must not change the envelope`);
  }
  console.log('browser mismatch PASS: version and dimensions hide marks and refuse edit/delete without changing stored annotations/revision');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
