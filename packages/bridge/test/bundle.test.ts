import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CONTRACT_VERSION } from '@sidepiece/contract';
import { startBridge, stopBridge, tempStateDir } from './spawn-bridge.ts';
import { SIDEPIECE_BOARD, startStubRegistry } from './stub-registry.ts';

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

test('bundle resolves against a stub registry: sidepiece, an unknown pjid, then 50 timed', async (t) => {
  const stub = await startStubRegistry();
  const stateDir = tempStateDir();
  let running: Awaited<ReturnType<typeof startBridge>> | undefined;
  try {
    running = await startBridge(fileURLToPath(bundle), tmpdir(), stateDir, {
      SIDEPIECE_REGISTRY_URL: stub.url,
    });
    const base = `http://127.0.0.1:${running.port}/v1/project`;
    const get = async (pjid: string) => {
      const res = await fetch(`${base}/${pjid}`, { signal: AbortSignal.timeout(5_000) });
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    };

    const known = await get('sidepiece');
    assert.equal(known.status, 200);
    assert.equal(known.body.generation, 1);
    assert.equal(known.body.boardId, SIDEPIECE_BOARD);
    assert.deepEqual(
      (known.body.agents as { id: string }[]).map((a) => a.id),
      ['sidepiece-pm', 'sidepiece-scrum-master'],
    );
    assert.deepEqual(known.body.degraded, []);

    const unknown = await get('not-a-real-pjid');
    assert.equal(unknown.status, 200);
    assert.deepEqual(unknown.body, {
      degraded: [{ ds: 'DS-2', params: { pjid: 'not-a-real-pjid' } }],
    });

    const samples: number[] = [];
    for (let i = 0; i < 50; i++) {
      const started = performance.now();
      const { body } = await get('sidepiece');
      samples.push(performance.now() - started);
      assert.equal(body.generation, 1, 'an unchanged Project never advances');
    }
    samples.sort((a, b) => a - b);
    const pct = (p: number) =>
      samples[Math.min(samples.length - 1, Math.ceil(p * samples.length) - 1)] ?? 0;
    const p50 = pct(0.5);
    const p95 = pct(0.95);
    t.diagnostic(`resolution p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms (n=50)`);
    assert.ok(p95 < 1_000, `p95 ${p95}ms`);
  } finally {
    const code = running ? await stopBridge(running.child) : 0;
    await stub.close();
    rmSync(stateDir, { recursive: true, force: true });
    assert.equal(code, 0);
  }
});
