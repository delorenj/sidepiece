import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Degraded } from '@sidepiece/contract';
import { storeHealth } from './store.ts';

const signal = new AbortController().signal;
const ds25: Degraded = { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } };

test('a ready store is ok', async () => {
  assert.deepEqual(await storeHealth(() => []).run(signal), { status: 'ok' });
});

test('a store ahead of this build is failing with its DS-25 entry, read per call', async () => {
  let current: Degraded[] = [];
  const probe = storeHealth(() => current);
  assert.deepEqual(await probe.run(signal), { status: 'ok' });
  current = [ds25];
  assert.deepEqual(await probe.run(signal), { status: 'failing', degraded: [ds25] });
  assert.deepEqual(probe.timedOut(), { status: 'failing', degraded: [ds25] });
});
