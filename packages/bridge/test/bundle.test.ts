import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const bundle = new URL('../dist/bridge.mjs', import.meta.url);

// Static `from`, side-effect `import`, dynamic `import()` and esbuild's `__require()` shim.
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]([^'"]+)['"]/g;

const isBuiltin = (spec: string) => spec.startsWith('node:') || builtinModules.includes(spec);

test('bundle imports nothing but node builtins', () => {
  const source = readFileSync(bundle, 'utf8');
  const bare = [...source.matchAll(SPECIFIER)]
    .map((m) => m[1] ?? '')
    .filter((spec) => !isBuiltin(spec));
  assert.deepEqual(bare, []);
});

test('bundle runs outside the workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidepiece-bridge-'));
  try {
    const copy = join(dir, 'bridge.mjs');
    copyFileSync(bundle, copy);
    const out = execFileSync(process.execPath, [copy], {
      cwd: dir,
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.match(out, /contract v\d+/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
