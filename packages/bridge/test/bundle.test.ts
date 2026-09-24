import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CONTRACT_VERSION } from '@sidepiece/contract';
import { startBridge, stopBridge } from './spawn-bridge.ts';

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

test('bundle runs outside the workspace and answers /v1/health', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sidepiece-bridge-'));
  const copy = join(dir, 'bridge.mjs');
  copyFileSync(bundle, copy);
  const { child, port } = await startBridge(copy, dir);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/v1/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-sidepiece-contract'), String(CONTRACT_VERSION));
    const body = (await res.json()) as { contractVersion: number };
    assert.equal(body.contractVersion, CONTRACT_VERSION);
  } finally {
    assert.equal(await stopBridge(child), 0);
    rmSync(dir, { recursive: true, force: true });
  }
});
