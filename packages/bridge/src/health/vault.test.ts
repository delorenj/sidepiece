import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Degraded } from '@sidepiece/contract';
import { CREDENTIALS } from '../credentials/vault.ts';
import { vaultHealth } from './vault.ts';

const signal = new AbortController().signal;
const ds8 = (credential: string): Degraded => ({
  ds: 'DS-8',
  params: { credential, dependency: 'plane' },
});

test('every credential resolved is ok', async () => {
  assert.deepEqual(await vaultHealth({ probe: async () => [] }).run(signal), { status: 'ok' });
});

test('any DS-8 is failing with every one of them, and no detail', async () => {
  const entries = [ds8('op://a'), ds8('op://b')];
  assert.deepEqual(await vaultHealth({ probe: async () => entries }).run(signal), {
    status: 'failing',
    degraded: entries,
  });
});

test('timedOut is DS-8 for every declared credential', () => {
  assert.deepEqual(vaultHealth({ probe: async () => [] }).timedOut(), {
    status: 'failing',
    degraded: CREDENTIALS.map((c) => ({
      ds: 'DS-8',
      params: { credential: c.ref, dependency: c.dependency },
    })),
  });
  const two = [
    { ref: 'op://x', dependency: 'plane' },
    { ref: 'op://y', dependency: 'bloodbank' },
  ];
  const outcome = vaultHealth({ probe: async () => [] }, two).timedOut();
  assert.deepEqual(
    outcome.degraded.map((d) => d.params?.credential),
    ['op://x', 'op://y'],
  );
});
