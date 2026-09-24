import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  DEFAULT_PORT,
  DEPLOY_TARGET_DIR,
  HOST,
  parsePort,
  requestedStateDir,
  resolveStateDir,
} from './config.ts';

test('the bind host is loopback and the default port is 8787', () => {
  assert.equal(HOST, '127.0.0.1');
  assert.equal(DEFAULT_PORT, 8787);
  assert.equal(parsePort(undefined), 8787);
});

test('SIDEPIECE_BRIDGE_PORT accepts 0..65535 and refuses anything else', () => {
  assert.equal(parsePort('0'), 0);
  assert.equal(parsePort('18787'), 18787);
  assert.equal(parsePort('65535'), 65535);
  for (const bad of ['', 'abc', '-1', '65536', '8787.5', ' 8787', '123456']) {
    assert.equal(parsePort(bad), undefined, bad);
  }
});

test('SIDEPIECE_STATE_DIR defaults to ~/.local/state/sidepiece', () => {
  assert.equal(
    resolveStateDir(undefined, { home: '/home/u', bundleDir: '/home/u/.local/lib/sidepiece' }),
    '/home/u/.local/state/sidepiece',
  );
  assert.equal(DEPLOY_TARGET_DIR, '.local/lib/sidepiece');
});

test('SIDEPIECE_STATE_DIR accepts an absolute dir outside the deploy tree and the bundle dir', () => {
  const ctx = { home: '/home/u', bundleDir: '/opt/b', realpath: () => undefined };
  assert.equal(resolveStateDir('/tmp/s', ctx), '/tmp/s');
  assert.equal(resolveStateDir('/tmp/s/', ctx), '/tmp/s');
  assert.equal(
    resolveStateDir('/home/u/.local/lib/sidepiece-state', ctx),
    '/home/u/.local/lib/sidepiece-state',
  );
  assert.equal(resolveStateDir('/opt/bundle', ctx), '/opt/bundle');
});

test('SIDEPIECE_STATE_DIR refuses empty, relative, deploy-tree and bundle-dir values', () => {
  const ctx = { home: '/home/u', bundleDir: '/opt/b', realpath: () => undefined };
  for (const bad of [
    '',
    'rel/dir',
    './x',
    '/home/u/.local/lib/sidepiece',
    '/home/u/.local/lib/sidepiece/x',
    '/home/u/.local/state/../lib/sidepiece/x',
    '/opt/b',
    '/opt/b/state',
  ]) {
    assert.equal(resolveStateDir(bad, ctx), undefined, bad);
  }
  // `..state` is a sibling name, not a parent traversal.
  assert.equal(resolveStateDir('/home/u/.local/lib/sidepiece/..state', ctx), undefined);
  assert.equal(resolveStateDir('/opt/b/..state', ctx), undefined);
  // The default itself is refused when the bundle is run from inside it.
  assert.equal(
    resolveStateDir(undefined, { home: '/home/u', bundleDir: '/home/u/.local/state' }),
    undefined,
  );
});

test('SIDEPIECE_STATE_DIR refuses a path that reaches the deploy tree or bundle dir through a symlink', () => {
  const root = mkdtempSync(join(tmpdir(), 'sidepiece-home-'));
  try {
    const home = join(root, 'home');
    const deploy = join(home, DEPLOY_TARGET_DIR);
    const bundleDir = join(root, 'bundle');
    mkdirSync(deploy, { recursive: true });
    mkdirSync(bundleDir);
    symlinkSync(deploy, join(root, 'to-deploy'));
    symlinkSync(bundleDir, join(root, 'to-bundle'));
    const ctx = { home, bundleDir };
    assert.equal(resolveStateDir(join(root, 'to-deploy'), ctx), undefined);
    assert.equal(resolveStateDir(join(root, 'to-deploy', 'state', 'x'), ctx), undefined);
    assert.equal(resolveStateDir(join(root, 'to-bundle', 'state'), ctx), undefined);
    assert.equal(resolveStateDir(join(root, 'elsewhere'), ctx), join(root, 'elsewhere'));
    assert.equal(existsSync(join(root, 'to-deploy', 'state')), false, 'nothing created');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('requestedStateDir names the default when the variable is unset', () => {
  assert.equal(requestedStateDir(undefined, '/home/u'), '/home/u/.local/state/sidepiece');
  assert.equal(requestedStateDir('/x', '/home/u'), '/x');
});
