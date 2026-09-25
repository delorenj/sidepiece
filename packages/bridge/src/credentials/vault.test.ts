import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { LogLine } from '../log.ts';
import {
  CREDENTIALS,
  childEnv,
  createVault,
  execFileRunner,
  MAX_DETAIL_CHARS,
  OP_READ_TIMEOUT_MS,
  type Runner,
  type RunOutcome,
  readBootstrapToken,
} from './vault.ts';

const REF = 'op://DeLoSecrets/Plane/apiKey';
const VALUE = 'fake-plane-value-for-vault-tests';
const TOKEN = 'fake-bootstrap-token-for-vault-tests';
const DS8 = { ds: 'DS-8', params: { credential: REF, dependency: 'plane' } };

const dirs: string[] = [];
after(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'sidepiece-vault-test-'));
  dirs.push(d);
  return d;
}
/** A real executable fake `op` with an absolute shebang. */
function fakeOp(body: string): string {
  const file = join(tempDir(), 'op');
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
  return file;
}

type Call = { file: string; args: readonly string[]; env: Record<string, string> };
function recordingRunner(outcomes: RunOutcome[]): { run: Runner; calls: Call[] } {
  const calls: Call[] = [];
  const run: Runner = async (file, args, env) => {
    calls.push({ file, args, env });
    const next = outcomes.shift();
    if (next === undefined) throw new Error('unexpected op call');
    return next;
  };
  return { run, calls };
}
function capture(): { logger: (l: LogLine) => void; lines: LogLine[] } {
  const lines: LogLine[] = [];
  return { logger: (l) => lines.push(l), lines };
}
const ok: RunOutcome = { kind: 'exited', code: 0, stdout: VALUE, stderr: '' };

test('the declared list is exactly the Plane key, title form', () => {
  assert.deepEqual(CREDENTIALS, [{ ref: REF, dependency: 'plane' }]);
});

test('healthy: no DS-8, one credential_resolved, the op args and env are exact', async () => {
  const { run, calls } = recordingRunner([ok]);
  const { logger, lines } = capture();
  const vault = createVault({
    token: TOKEN,
    opBin: '/usr/bin/op',
    run,
    logger,
    env: { HOME: '/home/x', PATH: '/bin', SECRET_THING: 'y' },
  });
  assert.deepEqual(await vault.probe(), []);
  assert.deepEqual(await vault.probe(), [], 'cached: no second child');
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.file, '/usr/bin/op');
  assert.deepEqual(calls[0]?.args, ['read', '--no-newline', REF]);
  assert.deepEqual(calls[0]?.env, { OP_SERVICE_ACCOUNT_TOKEN: TOKEN, HOME: '/home/x' });
  assert.deepEqual(lines, [
    { level: 'info', event: 'credential_resolved', credential: REF, dependency: 'plane' },
  ]);
  assert.deepEqual(await vault.get(REF), { ok: true, value: VALUE });
});

test('XDG_CONFIG_HOME rides along when set, nothing else does', async () => {
  const { run, calls } = recordingRunner([ok]);
  const vault = createVault({
    token: TOKEN,
    opBin: '/usr/bin/op',
    run,
    logger: () => {},
    env: { HOME: '/h', XDG_CONFIG_HOME: '/h/.cfg', OP_SERVICE_ACCOUNT_TOKEN: 'other' },
  });
  await vault.probe();
  assert.deepEqual(calls[0]?.env, {
    OP_SERVICE_ACCOUNT_TOKEN: TOKEN,
    HOME: '/h',
    XDG_CONFIG_HOME: '/h/.cfg',
  });
});

test('no credentials dir: DS-8 no_bootstrap_token, op never spawned, and the env token is deleted', async () => {
  const env: NodeJS.ProcessEnv = { OP_SERVICE_ACCOUNT_TOKEN: 'from-env', HOME: '/h' };
  const token = readBootstrapToken(env);
  assert.equal(token, undefined);
  assert.equal('OP_SERVICE_ACCOUNT_TOKEN' in env, false, 'deleted, never a token source');
  const { run, calls } = recordingRunner([]);
  const { logger, lines } = capture();
  const vault = createVault({ token, opBin: '/usr/bin/op', run, logger });
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.equal(calls.length, 0);
  assert.deepEqual(lines, [
    {
      level: 'warn',
      event: 'credential_unresolved',
      ds: 'DS-8',
      credential: REF,
      dependency: 'plane',
      reason: 'no_bootstrap_token',
    },
  ]);
});

test('readBootstrapToken: empty (SetCredential fallback), missing and unreadable are no token', () => {
  const dir = tempDir();
  writeFileSync(join(dir, 'op-token'), '');
  assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: dir }), undefined, 'empty');
  writeFileSync(join(dir, 'op-token'), '\n');
  assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: dir }), undefined, 'newline only');
  assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: tempDir() }), undefined, 'missing');
  assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: '' }), undefined, 'empty dir var');
  const unreadable = tempDir();
  writeFileSync(join(unreadable, 'op-token'), 'x');
  chmodSync(join(unreadable, 'op-token'), 0o000);
  if (process.getuid?.() !== 0) {
    assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: unreadable }), undefined);
  }
});

test('readBootstrapToken strips only the trailing newline', () => {
  const dir = tempDir();
  writeFileSync(join(dir, 'op-token'), ` ${TOKEN} \n`);
  assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: dir }), ` ${TOKEN} `);
  writeFileSync(join(dir, 'op-token'), TOKEN);
  assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: dir }), TOKEN);
});

test('readBootstrapToken strips a trailing CRLF, and only one line ending', () => {
  const dir = tempDir();
  writeFileSync(join(dir, 'op-token'), `${TOKEN}\r\n`);
  assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: dir }), TOKEN);
  writeFileSync(join(dir, 'op-token'), `${TOKEN}\n\n`);
  assert.equal(readBootstrapToken({ CREDENTIALS_DIRECTORY: dir }), `${TOKEN}\n`);
});

test('whitespace-only op-token is no token: DS-8 no_bootstrap_token, op never spawned', async () => {
  const dir = tempDir();
  for (const content of ['   ', '\r\n', ' \t\n', '\n\n']) {
    writeFileSync(join(dir, 'op-token'), content);
    const token = readBootstrapToken({ CREDENTIALS_DIRECTORY: dir });
    assert.equal(token, undefined, JSON.stringify(content));
    const { run, calls } = recordingRunner([]);
    const { logger, lines } = capture();
    const vault = createVault({ token, opBin: '/usr/bin/op', run, logger });
    assert.deepEqual(await vault.probe(), [DS8]);
    assert.equal(calls.length, 0);
    assert.equal((lines[0] as { reason?: string }).reason, 'no_bootstrap_token');
  }
});

test('empty token (0-byte op-token): DS-8 no_bootstrap_token, op never spawned', async () => {
  const dir = tempDir();
  writeFileSync(join(dir, 'op-token'), '');
  const { run, calls } = recordingRunner([]);
  const { logger, lines } = capture();
  const vault = createVault({
    token: readBootstrapToken({ CREDENTIALS_DIRECTORY: dir }),
    opBin: '/usr/bin/op',
    run,
    logger,
  });
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.equal(calls.length, 0);
  assert.equal((lines[0] as { reason?: string }).reason, 'no_bootstrap_token');
});

test('bad OP_BIN (relative or unset): DS-8 op_bin_invalid, op never spawned', async () => {
  for (const opBin of ['op', undefined, '']) {
    const { run, calls } = recordingRunner([]);
    const { logger, lines } = capture();
    const vault = createVault({ token: TOKEN, opBin, run, logger });
    assert.deepEqual(await vault.probe(), [DS8], String(opBin));
    assert.equal(calls.length, 0);
    assert.equal((lines[0] as { reason?: string }).reason, 'op_bin_invalid');
  }
});

test('invalid token / vault down: op exits 1, DS-8 op_failed with its stderr verbatim, trimmed', async () => {
  const opBin = fakeOp(
    `echo '[ERROR] 2026/09/25 could not read secret: format is invalid' >&2\nexit 1`,
  );
  const { logger, lines } = capture();
  const vault = createVault({ token: TOKEN, opBin, logger });
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.deepEqual(lines, [
    {
      level: 'warn',
      event: 'credential_unresolved',
      ds: 'DS-8',
      credential: REF,
      dependency: 'plane',
      reason: 'op_failed',
      detail: '[ERROR] 2026/09/25 could not read secret: format is invalid',
    },
  ]);
});

test('a spawn error is op_failed with err.message', async () => {
  const { logger, lines } = capture();
  const vault = createVault({ token: TOKEN, opBin: '/nonexistent/op', logger });
  assert.deepEqual(await vault.probe(), [DS8]);
  const line = lines[0] as { reason?: string; detail?: string };
  assert.equal(line.reason, 'op_failed');
  assert.match(line.detail ?? '', /ENOENT/);
});

test('empty stdout is DS-8 empty', async () => {
  const { logger, lines } = capture();
  const vault = createVault({ token: TOKEN, opBin: fakeOp('exit 0'), logger });
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.equal((lines[0] as { reason?: string }).reason, 'empty');
});

test('whitespace-only stdout is DS-8 empty, and is never cached', async () => {
  const { run, calls } = recordingRunner([
    { kind: 'exited', code: 0, stdout: ' \n\t', stderr: '' },
    { kind: 'exited', code: 0, stdout: '\n', stderr: '' },
    ok,
  ]);
  const { logger, lines } = capture();
  const vault = createVault({ token: TOKEN, opBin: '/usr/bin/op', run, logger });
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.deepEqual(await vault.probe(), []);
  assert.equal(calls.length, 3, 'each whitespace answer was retried');
  assert.deepEqual(
    lines.map((l) => (l as { reason?: string }).reason ?? l.event),
    ['empty', 'empty', 'credential_resolved'],
  );
});

test('a logged op_failed detail is capped at 1000 chars, after token redaction', async () => {
  // The token sits past the cap: redaction runs first, so no truncated token prefix survives.
  const stderr = `${'x'.repeat(MAX_DETAIL_CHARS - 5)}${TOKEN}${'y'.repeat(2_000)}`;
  const { run } = recordingRunner([{ kind: 'exited', code: 1, stdout: '', stderr }]);
  const { logger, lines } = capture();
  const vault = createVault({ token: TOKEN, opBin: '/usr/bin/op', run, logger });
  assert.deepEqual(await vault.probe(), [DS8]);
  const detail = (lines[0] as { detail?: string }).detail ?? '';
  assert.equal(MAX_DETAIL_CHARS, 1_000);
  assert.equal(detail.length, MAX_DETAIL_CHARS);
  assert.equal(detail, `${'x'.repeat(MAX_DETAIL_CHARS - 5)}[reda`);
  assert.ok(!detail.includes(TOKEN.slice(0, 5)));
});

test('hung op: DS-8 timeout within ~2s, and the child is killed', async () => {
  const dir = tempDir();
  const marker = join(dir, 'survived');
  // A plain `sleep` would be a grandchild still holding stdout; exec keeps it one process.
  const opBin = fakeOp(`echo $$ > '${join(dir, 'pid')}'\nexec sleep 10\ntouch '${marker}'`);
  const { logger, lines } = capture();
  const vault = createVault({ token: TOKEN, opBin, logger });
  const started = Date.now();
  assert.deepEqual(await vault.probe(), [DS8]);
  const elapsed = Date.now() - started;
  assert.ok(
    elapsed >= OP_READ_TIMEOUT_MS - 50 && elapsed < OP_READ_TIMEOUT_MS + 1_000,
    `${elapsed}ms`,
  );
  assert.equal((lines[0] as { reason?: string }).reason, 'timeout');
  const pid = Number(readFileSync(join(dir, 'pid'), 'utf8'));
  assert.throws(() => process.kill(pid, 0), /ESRCH/, 'the child is gone');
});

test('a hung op whose grandchild holds stdout still answers timeout (backstop)', async () => {
  const opBin = fakeOp('sleep 5');
  const vault = createVault({ token: TOKEN, opBin, logger: () => {} });
  const started = Date.now();
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.ok(Date.now() - started < OP_READ_TIMEOUT_MS + 1_000);
});

test('recovery: first op fails, second succeeds, in one process: DS-8 then []', async () => {
  const { run, calls } = recordingRunner([
    { kind: 'exited', code: 1, stdout: '', stderr: 'vault down\n' },
    ok,
  ]);
  const { logger, lines } = capture();
  const vault = createVault({ token: TOKEN, opBin: '/usr/bin/op', run, logger });
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.deepEqual(await vault.probe(), []);
  assert.deepEqual(await vault.probe(), []);
  assert.equal(calls.length, 2, 'the failure was not cached; the success was');
  assert.deepEqual(
    lines.map((l) => l.event),
    ['credential_unresolved', 'credential_resolved'],
  );
});

test('every failed attempt logs; a real op recovering is picked up without a restart', async () => {
  const dir = tempDir();
  const flag = join(dir, 'up');
  const opBin = fakeOp(`[ -f '${flag}' ] || { echo down >&2; exit 1; }\nprintf '%s' '${VALUE}'`);
  const { logger, lines } = capture();
  const vault = createVault({ token: TOKEN, opBin, logger });
  assert.deepEqual(await vault.probe(), [DS8]);
  assert.deepEqual(await vault.probe(), [DS8]);
  writeFileSync(flag, '');
  assert.deepEqual(await vault.probe(), []);
  assert.deepEqual(
    lines.map((l) => l.event),
    ['credential_unresolved', 'credential_unresolved', 'credential_resolved'],
  );
});

test('concurrent get calls share one in-flight child', async () => {
  let release: (o: RunOutcome) => void = () => {};
  let spawned = 0;
  const run: Runner = () => {
    spawned++;
    return new Promise((r) => {
      release = r;
    });
  };
  const vault = createVault({ token: TOKEN, opBin: '/usr/bin/op', run, logger: () => {} });
  const a = vault.get(REF);
  const b = vault.get(REF);
  const p = vault.probe();
  release(ok);
  assert.deepEqual(await a, { ok: true, value: VALUE });
  assert.deepEqual(await b, { ok: true, value: VALUE });
  assert.deepEqual(await p, []);
  assert.equal(spawned, 1);
});

test('probe keeps declaration order and never throws, even when the runner does', async () => {
  const credentials = [
    { ref: 'op://DeLoSecrets/A/x', dependency: 'a' },
    { ref: 'op://DeLoSecrets/B/y', dependency: 'b' },
    { ref: 'op://DeLoSecrets/C/z', dependency: 'c' },
  ];
  const run: Runner = async (_f, args) => {
    if (args[2] === 'op://DeLoSecrets/B/y') return ok;
    if (args[2] === 'op://DeLoSecrets/A/x') await new Promise((r) => setTimeout(r, 20));
    throw new Error('runner bug');
  };
  const vault = createVault({
    token: TOKEN,
    opBin: '/usr/bin/op',
    credentials,
    run,
    logger: () => {},
  });
  assert.deepEqual(await vault.probe(), [
    { ds: 'DS-8', params: { credential: 'op://DeLoSecrets/A/x', dependency: 'a' } },
    { ds: 'DS-8', params: { credential: 'op://DeLoSecrets/C/z', dependency: 'c' } },
  ]);
  await vault.resolveAll();
});

test('token isolation: childEnv omits the token and CREDENTIALS_DIRECTORY, and copies the rest', () => {
  const env = {
    OP_SERVICE_ACCOUNT_TOKEN: TOKEN,
    CREDENTIALS_DIRECTORY: '/run/user/1000/credentials/sidepiece-bridge.service',
    PATH: '/bin',
    HOME: '/h',
  };
  assert.deepEqual(childEnv(env), { PATH: '/bin', HOME: '/h' });
  assert.equal(env.OP_SERVICE_ACCOUNT_TOKEN, TOKEN, 'a copy; the input is untouched');
  assert.ok(env.CREDENTIALS_DIRECTORY, 'a copy; the input is untouched');
});

test('the real runner passes exactly the given env to op', async () => {
  const dir = tempDir();
  const dump = join(dir, 'env');
  const opBin = fakeOp(`/usr/bin/env > '${dump}'\nprintf '%s' "$3"`);
  const outcome = await execFileRunner(opBin, ['read', '--no-newline', REF], {
    OP_SERVICE_ACCOUNT_TOKEN: TOKEN,
    HOME: '/h',
  });
  assert.deepEqual(outcome, { kind: 'exited', code: 0, stdout: REF, stderr: '' });
  const keys = readFileSync(dump, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => l.split('=')[0])
    .filter((k) => k !== 'PWD' && k !== 'SHLVL' && k !== '_');
  assert.deepEqual(keys.sort(), ['HOME', 'OP_SERVICE_ACCOUNT_TOKEN']);
});

test('redaction: no log line or degraded entry carries the value or the token', async () => {
  const lines: string[] = [];
  const logger = (l: LogLine) => lines.push(JSON.stringify(l));
  const failing = createVault({
    token: TOKEN,
    // op echoing the token into stderr must not smuggle it into a log line.
    opBin: fakeOp(`echo "bad token $OP_SERVICE_ACCOUNT_TOKEN" >&2\nexit 1`),
    logger,
  });
  const degraded = JSON.stringify(await failing.probe());
  const healthy = createVault({ token: TOKEN, opBin: fakeOp(`printf '%s' '${VALUE}'`), logger });
  const clean = JSON.stringify(await healthy.probe());
  assert.equal((await healthy.get(REF)).ok, true);
  const all = [...lines, degraded, clean].join('\n');
  assert.ok(lines.length >= 2);
  assert.ok(all.includes(REF), 'the reference does appear');
  assert.ok(!all.includes(VALUE), 'never the value');
  assert.ok(!all.includes(TOKEN), 'never the token');
});
