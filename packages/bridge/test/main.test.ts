import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const bundle = fileURLToPath(new URL('../dist/bridge.mjs', import.meta.url));
const installs = join(homedir(), '.local/share/mise/installs/node');

function run(node: string, env: Record<string, string>) {
  return spawnSync(node, [bundle], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 10_000,
  });
}

function jsonLines(stdout: string): Record<string, unknown>[] {
  return stdout
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

for (const version of ['22.22.2', '24.6.0', '26.5.0']) {
  const node = join(installs, version, 'bin/node');
  test(`Node ${version} is refused before anything else`, (t) => {
    if (!existsSync(node)) {
      t.skip(`${node} is not installed`);
      return;
    }
    const stateDir = mkdtempSync(join(tmpdir(), 'sidepiece-state-'));
    chmodSync(stateDir, 0o500);
    try {
      const r = run(node, { SIDEPIECE_STATE_DIR: stateDir, SIDEPIECE_BRIDGE_PORT: '0' });
      assert.equal(r.status, 1);
      assert.equal(
        r.stderr,
        `sidepiece-bridge requires Node >=24.15.0 <25; this is v${version}. Refusing to start.\n`,
      );
      assert.equal(r.stdout, '', 'nothing logged, so nothing listened');
      assert.deepEqual(readdirSync(stateDir), []);
    } finally {
      chmodSync(stateDir, 0o700);
      rmSync(stateDir, { recursive: true, force: true });
    }
  });
}

test('an invalid SIDEPIECE_BRIDGE_PORT logs config_invalid and exits 1', () => {
  for (const bad of ['abc', '65536', '-1', '80.5', '']) {
    const r = run(process.execPath, { SIDEPIECE_BRIDGE_PORT: bad });
    assert.equal(r.status, 1, `port ${JSON.stringify(bad)}`);
    const [line] = jsonLines(r.stdout);
    assert.equal(line?.event, 'config_invalid');
    assert.equal(line?.level, 'error');
    assert.equal(line?.ds, 'DS-4');
    assert.equal(line?.value, bad);
  }
});

test('a busy port logs listen_failed with ds DS-4 and code, and exits 1', async () => {
  const blocker = createServer();
  await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
  const address = blocker.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  try {
    const r = run(process.execPath, { SIDEPIECE_BRIDGE_PORT: String(port) });
    assert.equal(r.status, 1);
    const line = jsonLines(r.stdout).find((l) => l.event === 'listen_failed');
    assert.ok(line);
    assert.equal(line.level, 'error');
    assert.equal(line.ds, 'DS-4');
    assert.equal(line.code, 'EADDRINUSE');
    assert.equal(line.port, port);
  } finally {
    blocker.close();
  }
});
