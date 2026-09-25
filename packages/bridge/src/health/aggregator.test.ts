import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEPENDENCY_NAMES, type Degraded } from '@sidepiece/contract';
import { createHealth, type DependencyProbe, type FailingOutcome } from './aggregator.ts';

const ds6: Degraded = { ds: 'DS-6', params: { endpoint: 'http://127.0.0.1:1' } };
const ds7: Degraded = { ds: 'DS-7', params: { error: '500 Internal Server Error' } };
const ds8a: Degraded = { ds: 'DS-8', params: { credential: 'op://a', dependency: 'plane' } };
const ds8b: Degraded = { ds: 'DS-8', params: { credential: 'op://b', dependency: 'plane' } };

const ok: DependencyProbe = {
  run: async () => ({ status: 'ok' }),
  timedOut: () => ({ status: 'failing', degraded: [ds6] }),
};
function failing(outcome: FailingOutcome): DependencyProbe {
  return { run: async () => outcome, timedOut: () => outcome };
}

const ROW_KEYS = new Set(['name', 'status', 'ds', 'detail', 'checkedAt', 'latencyMs']);

test('eight rows in DEPENDENCY_NAMES order; nothing registered is all unprobed', async () => {
  const now = new Date('2026-09-25T12:00:00.000Z');
  const answer = await createHealth({ now: () => now })(undefined);
  assert.deepEqual(answer, {
    relayed: false,
    dependencies: DEPENDENCY_NAMES.map((name) => ({
      name,
      status: 'unprobed',
      checkedAt: now.toISOString(),
    })),
    degraded: [],
  });
});

test('a bloodbank registration changes only the bloodbank row', async () => {
  const { dependencies } = await createHealth({ probes: { bloodbank: ok } })(undefined);
  for (const row of dependencies) {
    assert.equal(row.status, row.name === 'bloodbank' ? 'ok' : 'unprobed', row.name);
  }
  const bloodbank = dependencies.find((r) => r.name === 'bloodbank');
  assert.ok(bloodbank?.status === 'ok' && typeof bloodbank.latencyMs === 'number');
  assert.equal(dependencies.find((r) => r.name === 'candystore')?.status, 'unprobed');
});

test('degraded is every failing row in row order, then DS-15 when relayed', async () => {
  const health = createHealth({
    // Registration order is irrelevant: vault before registry here.
    probes: {
      vault: failing({ status: 'failing', degraded: [ds8a, ds8b] }),
      store: ok,
      registry: failing({
        status: 'failing',
        degraded: [ds7],
        detail: '500 Internal Server Error',
      }),
    },
    relay: async () => true,
  });
  const { relayed, dependencies, degraded } = await health('100.81.162.91');
  assert.equal(relayed, true);
  assert.deepEqual(degraded, [ds7, ds8a, ds8b, { ds: 'DS-15' }]);
  const [registry, store, vault] = dependencies;
  assert.ok(registry?.status === 'failing');
  assert.equal(registry.ds, 'DS-7');
  assert.equal(registry.detail, '500 Internal Server Error');
  assert.equal(store?.status, 'ok');
  assert.ok(vault?.status === 'failing');
  assert.equal(vault.ds, 'DS-8');
  assert.ok(!('detail' in vault));
  for (const row of dependencies) {
    for (const key of Object.keys(row)) assert.ok(ROW_KEYS.has(key), `${row.name}.${key}`);
  }
  // A failing row's keys in contract order.
  assert.deepEqual(Object.keys(registry), [
    'name',
    'status',
    'ds',
    'detail',
    'checkedAt',
    'latencyMs',
  ]);
});

test('not relayed means no DS-15', async () => {
  const { degraded } = await createHealth({ relay: async () => false })('100.81.162.91');
  assert.deepEqual(degraded, []);
});

test('a hung probe and a hung relay: terminal rows, under 3s, signal aborted', async () => {
  let aborted: AbortSignal | undefined;
  let relayAborted: AbortSignal | undefined;
  const hung: DependencyProbe = {
    run: (signal) => {
      aborted = signal;
      return new Promise(() => {});
    },
    timedOut: () => ({ status: 'failing', degraded: [ds6] }),
  };
  const started = performance.now();
  const answer = await createHealth({
    probes: { registry: hung, store: ok },
    relay: (_ip, signal) => {
      relayAborted = signal;
      return new Promise(() => {});
    },
  })('100.81.162.91');
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 3_000, `${elapsed}ms`);
  assert.ok(elapsed >= 1_900, `${elapsed}ms`);
  assert.equal(aborted?.aborted, true);
  assert.equal(relayAborted?.aborted, true);
  assert.equal(answer.relayed, false);
  for (const row of answer.dependencies) {
    assert.ok(['ok', 'failing', 'unprobed'].includes(row.status), row.name);
  }
  const [registry] = answer.dependencies;
  assert.ok(registry?.status === 'failing');
  assert.equal(registry.ds, 'DS-6');
  assert.ok(registry.latencyMs >= 1_900);
  assert.deepEqual(answer.degraded, [ds6]);
});

test('a failing outcome with an empty degraded is a TypeError', async () => {
  const bug: DependencyProbe = {
    run: async () => ({ status: 'failing', degraded: [] as unknown as [Degraded] }),
    timedOut: () => ({ status: 'failing', degraded: [ds6] }),
  };
  await assert.rejects(createHealth({ probes: { plane: bug } })(undefined), TypeError);
});

test('a probe that throws a non-timeout error propagates', async () => {
  const boom = new Error('bridge bug');
  const thrower: DependencyProbe = {
    run: async () => {
      throw boom;
    },
    timedOut: () => ({ status: 'failing', degraded: [ds6] }),
  };
  await assert.rejects(
    createHealth({ probes: { registry: thrower } })(undefined),
    (err) => err === boom,
  );
});
