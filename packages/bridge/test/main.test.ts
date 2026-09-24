import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { startBridge, stopBridge, tempStateDir } from './spawn-bridge.ts';
import { startStubRegistry } from './stub-registry.ts';

const bundle = fileURLToPath(new URL('../dist/bridge.mjs', import.meta.url));
const installs = join(homedir(), '.local/share/mise/installs/node');

/**
 * Run the bundle to exit. Unless the caller sets `SIDEPIECE_STATE_DIR` (even to ''), it gets
 * its own temp state dir, removed afterwards, so no run touches the real `~/.local/state`.
 */
function run(node: string, env: Record<string, string>, cwd?: string) {
  const own = 'SIDEPIECE_STATE_DIR' in env ? undefined : tempStateDir();
  try {
    return spawnSync(node, [bundle], {
      env: { ...process.env, ...(own ? { SIDEPIECE_STATE_DIR: own } : {}), ...env },
      encoding: 'utf8',
      timeout: 10_000,
      ...(cwd ? { cwd } : {}),
    });
  } finally {
    if (own) rmSync(own, { recursive: true, force: true });
  }
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

test('a bad SIDEPIECE_REGISTRY_URL logs config_invalid DS-4 and exits 1 before the store', () => {
  for (const bad of ['', '127.0.0.1:8764', 'ftp://registry', 'not a url']) {
    const stateDir = tempStateDir();
    try {
      const r = run(process.execPath, {
        SIDEPIECE_STATE_DIR: stateDir,
        SIDEPIECE_BRIDGE_PORT: '0',
        SIDEPIECE_REGISTRY_URL: bad,
      });
      assert.equal(r.status, 1, `registry url ${JSON.stringify(bad)}`);
      const lines = jsonLines(r.stdout);
      assert.equal(lines.length, 1, 'refused before the store or the listener');
      const [line] = lines;
      assert.equal(line?.event, 'config_invalid');
      assert.equal(line?.level, 'error');
      assert.equal(line?.ds, 'DS-4');
      assert.equal(line?.key, 'SIDEPIECE_REGISTRY_URL');
      assert.equal(line?.value, bad);
      assert.deepEqual(readdirSync(stateDir), [], 'no turns.db');
    } finally {
      rmSync(stateDir, { recursive: true, force: true });
    }
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

test('a bad SIDEPIECE_STATE_DIR logs config_invalid DS-4, exits 1 and creates no turns.db', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sidepiece-cwd-'));
  const deployChild = join(homedir(), '.local/lib/sidepiece', `x-${process.pid}`);
  const bundleDir = dirname(bundle);
  const deployChildExisted = existsSync(deployChild);
  try {
    for (const bad of ['', 'rel/dir', deployChild, bundleDir]) {
      const r = run(
        process.execPath,
        { SIDEPIECE_STATE_DIR: bad, SIDEPIECE_BRIDGE_PORT: '0' },
        cwd,
      );
      assert.equal(r.status, 1, `state dir ${JSON.stringify(bad)}`);
      const lines = jsonLines(r.stdout);
      assert.equal(lines.length, 1, 'refused before the store or the listener');
      const [line] = lines;
      assert.equal(line?.event, 'config_invalid');
      assert.equal(line?.level, 'error');
      assert.equal(line?.ds, 'DS-4');
      assert.equal(line?.key, 'SIDEPIECE_STATE_DIR');
      assert.equal(line?.value, bad);
    }
    assert.deepEqual(readdirSync(cwd), [], 'nothing created for the relative dir');
    assert.equal(existsSync(deployChild), deployChildExisted, 'nothing created in the deploy tree');
    assert.ok(!existsSync(join(bundleDir, 'turns.db')), 'no turns.db beside the bundle');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an unopenable store logs store_open_failed DS-4 and exits 1', () => {
  const stateDir = tempStateDir();
  try {
    // A directory where the DB file should be: SQLite cannot open it.
    mkdirSync(join(stateDir, 'turns.db'));
    const r = run(process.execPath, { SIDEPIECE_STATE_DIR: stateDir, SIDEPIECE_BRIDGE_PORT: '0' });
    assert.equal(r.status, 1);
    const lines = jsonLines(r.stdout);
    assert.ok(!lines.some((l) => l.event === 'listening'), 'the listener never comes up');
    const failed = lines.find((l) => l.event === 'store_open_failed');
    assert.ok(failed);
    assert.equal(failed.level, 'error');
    assert.equal(failed.ds, 'DS-4');
    assert.equal(failed.path, join(stateDir, 'turns.db'));
    assert.equal(typeof failed.detail, 'string');
  } finally {
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test('a rolled-back Bridge serves DS-25 from a store ahead of it, and leaves it byte-identical', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sidepiece-cwd-'));
  const stateDir = tempStateDir();
  const file = join(stateDir, 'turns.db');
  const stub = await startStubRegistry();
  try {
    const first = await startBridge(bundle, cwd, stateDir);
    assert.ok(first.lines.some((l) => l.event === 'store_opened' && l.userVersion === 1));
    assert.equal(await stopBridge(first.child), 0);

    // What `sqlite3 turns.db 'PRAGMA user_version = 9'` leaves: big-endian int32 at offset 60.
    const bytes = readFileSync(file);
    bytes.writeInt32BE(9, 60);
    writeFileSync(file, bytes);

    const running = await startBridge(bundle, cwd, stateDir, {
      SIDEPIECE_REGISTRY_URL: stub.url,
    });
    const ahead = running.lines.find((l) => l.event === 'store_ahead');
    assert.ok(ahead, 'a store_ahead line is logged');
    assert.equal(ahead.level, 'warn');
    assert.equal(ahead.ds, 'DS-25');
    assert.equal(ahead.storeVersion, 9);
    assert.equal(ahead.bridgeVersion, 1);
    const pid = running.child.pid;
    for (let i = 0; i < 2; i++) {
      const res = await fetch(`http://127.0.0.1:${running.port}/v1/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { status: string; degraded: unknown };
      assert.equal(body.status, 'ok');
      assert.deepEqual(body.degraded, [
        { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } },
      ]);
      assert.equal(running.child.pid, pid);
      assert.equal(running.child.exitCode, null, 'the same process keeps answering');
    }
    // Resolution keeps working: the record is served, not minted (generation 0).
    const project = await fetch(`http://127.0.0.1:${running.port}/v1/project/sidepiece`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(project.status, 200);
    const record = (await project.json()) as { generation: number; degraded: unknown };
    assert.equal(record.generation, 0);
    assert.deepEqual(record.degraded, [
      { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } },
    ]);
    assert.equal(await stopBridge(running.child), 0);
    assert.deepEqual(readFileSync(file), bytes, 'the store is byte-identical afterwards');
    assert.deepEqual(
      readdirSync(stateDir).filter((f) => !/^turns\.db-(wal|shm)$/.test(f)),
      ['turns.db'],
    );
  } finally {
    await stub.close();
    rmSync(cwd, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

/** The environment minus `SIDEPIECE_STATE_DIR`, with HOME pointed at a temp home. */
function envWithoutStateDir(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, SIDEPIECE_BRIDGE_PORT: '0' };
  delete env.SIDEPIECE_STATE_DIR;
  return env;
}

test('with SIDEPIECE_STATE_DIR unset, the store opens at ~/.local/state/sidepiece/turns.db', async () => {
  const home = mkdtempSync(join(tmpdir(), 'sidepiece-home-'));
  const expected = join(home, '.local/state/sidepiece/turns.db');
  const child = spawn(process.execPath, [bundle], {
    cwd: home,
    env: envWithoutStateDir(home),
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 30_000,
  });
  const lines: Record<string, unknown>[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no listening line within 10s')), 10_000);
      child.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`bridge exited early with ${code}`));
      });
      createInterface({ input: child.stdout }).on('line', (line) => {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        lines.push(parsed);
        if (parsed.event === 'listening') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const opened = lines.find((l) => l.event === 'store_opened');
    assert.ok(opened, 'store_opened is logged');
    assert.equal(opened.path, expected);
    assert.ok(existsSync(expected));
  } finally {
    assert.equal(await stopBridge(child), 0);
    rmSync(home, { recursive: true, force: true });
  }
});

test('a refused default state dir logs the default path it refused, not an empty value', () => {
  // The bundle sits in ~/.local/state, so the default ~/.local/state/sidepiece is under it.
  const home = mkdtempSync(join(tmpdir(), 'sidepiece-home-'));
  try {
    const bundleDir = join(home, '.local/state');
    mkdirSync(bundleDir, { recursive: true });
    const copy = join(bundleDir, 'bridge.mjs');
    copyFileSync(bundle, copy);
    const r = spawnSync(process.execPath, [copy], {
      cwd: home,
      env: envWithoutStateDir(home),
      encoding: 'utf8',
      timeout: 10_000,
    });
    assert.equal(r.status, 1);
    const [line] = jsonLines(r.stdout);
    assert.equal(line?.event, 'config_invalid');
    assert.equal(line?.key, 'SIDEPIECE_STATE_DIR');
    assert.equal(line?.value, `(default) ${join(home, '.local/state/sidepiece')}`);
    assert.ok(!existsSync(join(bundleDir, 'sidepiece')), 'nothing created');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
