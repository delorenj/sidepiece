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
import {
  defaultVaultEnv,
  FAKE_OP_TOKEN,
  FAKE_RESOLVED_VALUE,
  startBridge,
  stopBridge,
  stubVault,
  tempStateDir,
  UNROUTABLE_REGISTRY_URL,
} from './spawn-bridge.ts';
import { fixtureProjects, startStubRegistry } from './stub-registry.ts';

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
      env: {
        ...process.env,
        SIDEPIECE_REGISTRY_URL: UNROUTABLE_REGISTRY_URL,
        ...defaultVaultEnv(),
        ...(own ? { SIDEPIECE_STATE_DIR: own } : {}),
        ...env,
      },
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
  // Hermetic: the sidepiece clone is a temp dir with every role dir present, so the on-disk
  // probe adds nothing and `degraded` is exactly the Bridge-wide DS-25.
  const clone = mkdtempSync(join(tmpdir(), 'sidepiece-clone-'));
  mkdirSync(join(clone, 'agents/hermes/pm'), { recursive: true });
  mkdirSync(join(clone, 'agents/hermes/scrum-master'), { recursive: true });
  const projects = fixtureProjects();
  projects.sidepiece = { ...projects.sidepiece, repoPath: clone };
  const stub = await startStubRegistry(projects);
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
    const { child, port } = running;
    const pid = child.pid;
    for (let i = 0; i < 2; i++) {
      const res: Response = await fetch(`http://127.0.0.1:${port}/v1/health`, {
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
      readdirSync(stateDir)
        .filter((f) => !/^turns\.db-(wal|shm)$/.test(f))
        .sort(),
      ['registry-snapshot.json', 'turns.db'],
      'the snapshot is kept beside the store under DS-25 too',
    );
  } finally {
    await stub.close();
    rmSync(clone, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
  }
});

test('the bundle serves the last good copy with DS-23 when the registry goes down, and health says DS-6', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sidepiece-cwd-'));
  const stateDir = tempStateDir();
  const stub = await startStubRegistry(fixtureProjects());
  const endpoint = stub.url;
  const remedy = 'systemctl --user start pjangler-project-registry.service';
  let running: Awaited<ReturnType<typeof startBridge>> | undefined;
  try {
    running = await startBridge(bundle, cwd, stateDir, { SIDEPIECE_REGISTRY_URL: stub.url });
    const base = `http://127.0.0.1:${running.port}`;
    const get = async (path: string) => {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5_000) });
      return { status: res.status, body: (await res.json()) as Record<string, unknown> };
    };
    const fresh = await get('/v1/project/sidepiece');
    assert.equal(fresh.status, 200);
    assert.equal(fresh.body.generation, 1);
    assert.ok(
      !(fresh.body.degraded as { ds: string }[]).some((d) => d.ds === 'DS-23'),
      'a fresh answer carries no DS-23',
    );

    await stub.close();
    const served = await get('/v1/project/sidepiece');
    assert.equal(served.status, 200);
    for (const key of ['pjid', 'generation', 'repo', 'clonePath', 'boardId', 'agents']) {
      assert.ok(key in served.body, key);
    }
    assert.equal(served.body.generation, 1);
    const degraded = served.body.degraded as { ds: string; params?: Record<string, string> }[];
    const at = degraded.findIndex((d) => d.ds === 'DS-23');
    assert.ok(at >= 0, 'DS-23 is present');
    assert.match(degraded[at]?.params?.ageSeconds ?? '', /^\d+$/);
    assert.deepEqual(degraded[at + 1], { ds: 'DS-6', params: { endpoint }, remedy });

    const health = await get('/v1/health');
    assert.equal(health.status, 200);
    assert.deepEqual(health.body.degraded, [{ ds: 'DS-6', params: { endpoint }, remedy }]);
  } finally {
    const code = running ? await stopBridge(running.child) : 0;
    await stub.close().catch(() => {});
    rmSync(cwd, { recursive: true, force: true });
    rmSync(stateDir, { recursive: true, force: true });
    assert.equal(code, 0);
  }
});

/** The environment minus `SIDEPIECE_STATE_DIR`, with HOME pointed at a temp home. */
function envWithoutStateDir(home: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    SIDEPIECE_BRIDGE_PORT: '0',
    SIDEPIECE_REGISTRY_URL: UNROUTABLE_REGISTRY_URL,
  };
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

const DS8_PLANE = {
  ds: 'DS-8',
  params: { credential: 'op://DeLoSecrets/Plane/apiKey', dependency: 'plane' },
};

test('with no credentials dir the bundle stays up, health is 200 with exactly DS-8, and SIGTERM exits 0', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sidepiece-cwd-'));
  const stub = await startStubRegistry(fixtureProjects());
  let running: Awaited<ReturnType<typeof startBridge>> | undefined;
  try {
    running = await startBridge(bundle, cwd, undefined, {
      SIDEPIECE_REGISTRY_URL: stub.url,
      CREDENTIALS_DIRECTORY: '',
    });
    const { child, port } = running;
    const pid = child.pid;
    for (let i = 0; i < 2; i++) {
      const res: Response = await fetch(`http://127.0.0.1:${port}/v1/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { degraded: unknown };
      assert.deepEqual(body.degraded, [DS8_PLANE]);
      assert.equal(child.pid, pid);
      assert.equal(child.exitCode, null, 'the Bridge never exits on a credential');
    }
    const warn = running.lines.find((l) => l.event === 'credential_unresolved');
    assert.ok(warn);
    assert.equal(warn.level, 'warn');
    assert.equal(warn.ds, 'DS-8');
    assert.equal(warn.reason, 'no_bootstrap_token');
    assert.equal(warn.credential, 'op://DeLoSecrets/Plane/apiKey');
  } finally {
    const code = running ? await stopBridge(running.child) : 0;
    await stub.close();
    rmSync(cwd, { recursive: true, force: true });
    assert.equal(code, 0);
  }
});

test('the token reaches only the op child: its env is exactly token + HOME, and never the Bridge environ', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'sidepiece-cwd-'));
  const dumpDir = mkdtempSync(join(tmpdir(), 'sidepiece-opdump-'));
  const dump = join(dumpDir, 'env');
  const vault = stubVault(`/usr/bin/env > '${dump}'\nprintf '%s' '${FAKE_RESOLVED_VALUE}'`);
  const stub = await startStubRegistry(fixtureProjects());
  const parentToken = 'parent-env-token-must-not-travel';
  let running: Awaited<ReturnType<typeof startBridge>> | undefined;
  try {
    running = await startBridge(bundle, cwd, undefined, {
      SIDEPIECE_REGISTRY_URL: stub.url,
      OP_SERVICE_ACCOUNT_TOKEN: parentToken,
      ...vault.env,
    });
    const res = await fetch(`http://127.0.0.1:${running.port}/v1/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.deepEqual(((await res.json()) as { degraded: unknown }).degraded, []);
    const env = readFileSync(dump, 'utf8');
    assert.ok(
      env.includes(`OP_SERVICE_ACCOUNT_TOKEN=${FAKE_OP_TOKEN}\n`),
      'the op child has the token',
    );
    assert.ok(!env.includes(parentToken), 'the parent env token is never a token source');
    const keys = env
      .split('\n')
      .filter(Boolean)
      .map((l) => l.split('=')[0])
      .filter((k) => k !== 'PWD' && k !== 'SHLVL' && k !== '_');
    assert.deepEqual(
      keys.sort(),
      [
        'HOME',
        'OP_SERVICE_ACCOUNT_TOKEN',
        ...(process.env.XDG_CONFIG_HOME ? ['XDG_CONFIG_HOME'] : []),
      ].sort(),
    );
    const environ = `/proc/${running.child.pid}/environ`;
    if (!existsSync(environ)) {
      t.diagnostic('no /proc; environ check skipped');
    } else {
      assert.ok(
        !readFileSync(environ, 'utf8').includes(FAKE_OP_TOKEN),
        'not in the Bridge environ',
      );
    }
    assert.ok(
      running.lines.some((l) => l.event === 'credential_resolved' && l.dependency === 'plane'),
    );
  } finally {
    const code = running ? await stopBridge(running.child) : 0;
    await stub.close();
    vault.remove();
    rmSync(dumpDir, { recursive: true, force: true });
    rmSync(cwd, { recursive: true, force: true });
    assert.equal(code, 0);
  }
});

test('no stdout line ever carries the resolved value or the token', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'sidepiece-cwd-'));
  const stub = await startStubRegistry(fixtureProjects());
  const child = spawn(process.execPath, [bundle], {
    cwd,
    env: {
      ...process.env,
      ...defaultVaultEnv(),
      SIDEPIECE_BRIDGE_PORT: '0',
      SIDEPIECE_STATE_DIR: cwd,
      SIDEPIECE_REGISTRY_URL: stub.url,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 30_000,
  });
  let raw = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    raw += chunk;
  });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setInterval(() => {
        const m = raw.match(/"event":"listening"[^\n]*"port":(\d+)/);
        if (m) {
          clearInterval(timer);
          resolve(Number(m[1]));
        }
      }, 20);
      child.once('exit', (code) => {
        clearInterval(timer);
        reject(new Error(`bridge exited early with ${code}`));
      });
    });
    for (const path of ['/v1/health', '/v1/project/sidepiece', '/v1/health']) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        signal: AbortSignal.timeout(5_000),
      });
      const text = await res.text();
      assert.ok(!text.includes(FAKE_RESOLVED_VALUE), `${path} response`);
      assert.ok(!text.includes(FAKE_OP_TOKEN), `${path} response`);
    }
  } finally {
    assert.equal(await stopBridge(child), 0);
    await stub.close();
    rmSync(cwd, { recursive: true, force: true });
  }
  assert.ok(raw.includes('"event":"credential_resolved"'), 'the credential did resolve');
  assert.ok(raw.includes('op://DeLoSecrets/Plane/apiKey'), 'the reference is logged');
  assert.ok(!raw.includes(FAKE_RESOLVED_VALUE), 'no line carries the value');
  assert.ok(!raw.includes(FAKE_OP_TOKEN), 'no line carries the token');
});
