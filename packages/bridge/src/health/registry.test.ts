import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { type StubRegistry, startStubRegistry } from '../../test/stub-registry.ts';
import { openSnapshot } from '../registry/snapshot.ts';
import { registryHealth } from './registry.ts';

let stub: StubRegistry;
let dir: string;
before(async () => {
  stub = await startStubRegistry();
  dir = mkdtempSync(join(tmpdir(), 'sidepiece-health-registry-'));
});
after(async () => {
  await stub.close();
  rmSync(dir, { recursive: true, force: true });
});

test('a healthy registry is [] and rewrites the snapshot', async () => {
  const snapshot = openSnapshot(dir);
  assert.deepEqual(await registryHealth(stub.url, snapshot)(), []);
  assert.ok(existsSync(snapshot.path));
});

test('a registry error is DS-7 verbatim, from the shared discriminator', async () => {
  stub.override = { status: 503, body: '' };
  try {
    assert.deepEqual(await registryHealth(stub.url)(), [
      { ds: 'DS-7', params: { error: '503 Service Unavailable' } },
    ]);
  } finally {
    stub.override = undefined;
  }
});

test('an unreachable registry is DS-6, with a remedy only on loopback', async () => {
  assert.deepEqual(await registryHealth('http://127.0.0.1:1')(), [
    {
      ds: 'DS-6',
      params: { endpoint: 'http://127.0.0.1:1' },
      remedy: 'systemctl --user start pjangler-project-registry.service',
    },
  ]);
  assert.deepEqual(await registryHealth('http://nonexistent.invalid')(), [
    { ds: 'DS-6', params: { endpoint: 'http://nonexistent.invalid' } },
  ]);
});
