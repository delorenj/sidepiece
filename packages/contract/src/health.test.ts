import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEPENDENCY_NAMES, type DependencyHealth, type DependencyName } from './health.ts';

test('the dependency names, in row order', () => {
  assert.deepEqual(DEPENDENCY_NAMES, [
    'registry',
    'store',
    'vault',
    'fleet',
    'gateway',
    'plane',
    'bloodbank',
    'candystore',
  ]);
  const name: DependencyName = 'candystore';
  // @ts-expect-error: not a dependency
  const other: DependencyName = 'traefik';
  void [name, other];
});

test('a failing row must carry a ds, and an unprobed row cannot', () => {
  const checkedAt = '2026-09-25T00:00:00.000Z';
  const rows: DependencyHealth[] = [
    { name: 'registry', status: 'ok', checkedAt, latencyMs: 2 },
    { name: 'registry', status: 'failing', ds: 'DS-7', detail: '500', checkedAt, latencyMs: 3 },
    { name: 'fleet', status: 'unprobed', checkedAt },
  ];
  // @ts-expect-error: a failing row without ds
  const noDs: DependencyHealth = { name: 'registry', status: 'failing', checkedAt, latencyMs: 1 };
  // @ts-expect-error: an unprobed row with ds
  const probedDs: DependencyHealth = { name: 'fleet', status: 'unprobed', ds: 'DS-6', checkedAt };
  const clientDs: DependencyHealth = {
    name: 'registry',
    status: 'failing',
    // @ts-expect-error: a client-only code on a row
    ds: 'DS-4',
    checkedAt,
    latencyMs: 1,
  };
  void [noDs, probedDs, clientDs];
  assert.equal(rows.length, 3);
});
