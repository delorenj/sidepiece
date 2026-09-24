import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CONTRACT_VERSION } from '@sidepiece/contract';
import { startBridge, stopBridge, tempStateDir } from './spawn-bridge.ts';

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
  const stateDir = tempStateDir();
  let running: Awaited<ReturnType<typeof startBridge>> | undefined;
  try {
    running = await startBridge(copy, dir, stateDir);
    const { port, host } = running;
    assert.equal(host, '127.0.0.1', 'the Bridge binds loopback only');
    const res = await fetch(`http://127.0.0.1:${port}/v1/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-sidepiece-contract'), String(CONTRACT_VERSION));
    const body = (await res.json()) as { contractVersion: number };
    assert.equal(body.contractVersion, CONTRACT_VERSION);
    assert.ok(readdirSync(stateDir).includes('turns.db'), 'turns.db is created in the state dir');
    assert.ok(!readdirSync(dir).includes('turns.db'), 'and never beside the bundle');
  } finally {
    const code = running ? await stopBridge(running.child) : 0;
    rmSync(dir, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
    assert.equal(code, 0);
  }
});
