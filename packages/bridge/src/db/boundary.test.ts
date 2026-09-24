import assert from 'node:assert/strict';
import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// AR31: one module opens the store, and the column names never leak out of it. The needles
// are built by concatenation so this file never matches itself.
const packages = fileURLToPath(new URL('../../../', import.meta.url));
const STORE = ['bridge', 'src', 'turns', 'store.ts'].join('/');
const DB_DIR = ['bridge', 'src', 'db', ''].join('/');

const DRIVER = `node:${'sqlite'}`;
const COLUMNS = [`record${'_'}hash`, `clone${'_'}path`, `board${'_'}id`, `created${'_'}at`];

function* walk(dir: string): Generator<string> {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

/** Every file under packages/*\/src and packages/*\/test, as `<pkg>/src/...` with `/` separators. */
function sources(): { rel: string; text: string }[] {
  const out: { rel: string; text: string }[] = [];
  for (const pkg of readdirSync(packages, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    for (const sub of ['src', 'test']) {
      for (const file of walk(join(packages, pkg.name, sub))) {
        out.push({
          rel: relative(packages, file).split(sep).join('/'),
          text: readFileSync(file, 'utf8'),
        });
      }
    }
  }
  return out;
}

const files = sources();

test('the guard actually sees the store and this file', () => {
  const rels = files.map((f) => f.rel);
  assert.ok(rels.includes(STORE));
  assert.ok(rels.includes(`${DB_DIR}boundary.test.ts`));
});

test('the SQLite driver is imported only by turns/store.ts', () => {
  const hits = files.filter((f) => f.text.includes(DRIVER)).map((f) => f.rel);
  assert.deepEqual(hits, [STORE]);
});

test('snake_case column names appear only in turns/store.ts and under src/db/', () => {
  const leaks = files
    .filter((f) => f.rel !== STORE && !f.rel.startsWith(DB_DIR))
    .flatMap((f) => COLUMNS.filter((c) => f.text.includes(c)).map((c) => `${f.rel}: ${c}`));
  assert.deepEqual(leaks, []);
});
