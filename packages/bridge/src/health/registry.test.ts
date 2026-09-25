import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { type StubRegistry, startStubRegistry } from '../../test/stub-registry.ts';
import { RegistryUnreachable, registryFailure } from '../registry/client.ts';
import { openSnapshot } from '../registry/snapshot.ts';
import { registryHealth } from './registry.ts';

const REMEDY = 'systemctl --user start pjangler-project-registry.service';
const signal = new AbortController().signal;

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

test('a healthy registry is ok and rewrites the snapshot', async () => {
  const snapshot = openSnapshot(dir);
  assert.deepEqual(await registryHealth(stub.url, snapshot).run(signal), { status: 'ok' });
  assert.ok(existsSync(snapshot.path));
});

test('a registry 500 is DS-7 with the error verbatim as detail', async () => {
  stub.override = { status: 500, body: '' };
  try {
    assert.deepEqual(await registryHealth(stub.url).run(signal), {
      status: 'failing',
      degraded: [{ ds: 'DS-7', params: { error: '500 Internal Server Error' } }],
      detail: '500 Internal Server Error',
    });
  } finally {
    stub.override = undefined;
  }
});

test('an unreachable registry is DS-6 with no detail, a remedy only on loopback', async () => {
  assert.deepEqual(await registryHealth('http://127.0.0.1:1').run(signal), {
    status: 'failing',
    degraded: [{ ds: 'DS-6', params: { endpoint: 'http://127.0.0.1:1' }, remedy: REMEDY }],
  });
  assert.deepEqual(await registryHealth('http://nonexistent.invalid').run(signal), {
    status: 'failing',
    degraded: [{ ds: 'DS-6', params: { endpoint: 'http://nonexistent.invalid' } }],
  });
});

test('timedOut is the shared discriminator on RegistryUnreachable: DS-6', () => {
  const url = 'http://127.0.0.1:9';
  assert.deepEqual(registryHealth(url).timedOut(), {
    status: 'failing',
    degraded: [registryFailure(new RegistryUnreachable('x'), url)],
  });
});

test('the probe imports registryFailure and spells no DS-6/DS-7 of its own', () => {
  const source = readFileSync(new URL('./registry.ts', import.meta.url), 'utf8');
  assert.match(
    source,
    /import \{[^}]*\bregistryFailure\b[^}]*\} from '\.\.\/registry\/client\.ts'/,
  );
  assert.doesNotMatch(source, /'DS-[67]'/);
});
