import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import type { LogLine } from '../log.ts';
import { relayHealth } from './relay.ts';

const LAPTOP = '100.81.162.91';
const SELF = '100.66.29.76';
const dir = mkdtempSync(join(tmpdir(), 'sidepiece-relay-'));
after(() => rmSync(dir, { recursive: true, force: true }));

/** The shape of `tailscale status --json` that relay reads; real field names. */
function status(peer: { CurAddr: string; Relay: string }) {
  return JSON.stringify({
    Self: { TailscaleIPs: [SELF, 'fd7a:115c:a1e0::1'], CurAddr: '', Relay: 'nyc' },
    Peer: {
      'nodekey:laptop': { TailscaleIPs: [LAPTOP, 'fd7a:115c:a1e0::2'], PeerRelay: '', ...peer },
      'nodekey:phone': { TailscaleIPs: ['100.100.1.1'], CurAddr: '', Relay: 'nyc' },
    },
  });
}

let n = 0;
/** A fake `tailscale` as an executable `#!/bin/sh` script. */
function fake(body: string): string {
  const path = join(dir, `tailscale-${n++}`);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}
function printing(json: string): string {
  const file = join(dir, `status-${n++}.json`);
  writeFileSync(file, json);
  return fake(`cat '${file}'`);
}

function probe(tailscaleBin: string | undefined) {
  const lines: LogLine[] = [];
  const relay = relayHealth({ tailscaleBin, logger: (l) => lines.push(l) });
  return { lines, ask: (ip: string | undefined) => relay(ip, new AbortController().signal) };
}

const relayed = printing(status({ CurAddr: '', Relay: 'nyc' }));
const direct = printing(status({ CurAddr: '192.168.1.36:41641', Relay: 'nyc' }));

test('a peer with no direct address and a DERP region is relayed', async () => {
  const { ask, lines } = probe(relayed);
  assert.equal(await ask(LAPTOP), true);
  assert.deepEqual(lines, []);
});

test('a direct peer is not relayed, though its home Relay is set', async () => {
  const { ask, lines } = probe(direct);
  assert.equal(await ask(LAPTOP), false);
  assert.deepEqual(lines, []);
});

test('no client IP, Self, loopback, or an unknown IP is false with no log', async () => {
  const { ask, lines } = probe(relayed);
  for (const ip of [undefined, SELF, '127.0.0.1', '::1', '100.99.99.99']) {
    assert.equal(await ask(ip), false, String(ip));
  }
  assert.deepEqual(lines, []);
});

test('a peer with no DERP region at all is not relayed', async () => {
  const { ask } = probe(printing(status({ CurAddr: '', Relay: '' })));
  assert.equal(await ask(LAPTOP), false);
});

test('a lone node (Peer null) is false and not unparseable', async () => {
  const { ask, lines } = probe(printing(JSON.stringify({ Self: {}, Peer: null })));
  assert.equal(await ask(LAPTOP), false);
  assert.deepEqual(lines, []);
});

test('an unset or relative TAILSCALE_BIN is false, spawns nothing, logs tailscale_bin_invalid', async () => {
  for (const bin of [undefined, 'tailscale', './tailscale']) {
    const { ask, lines } = probe(bin);
    assert.equal(await ask(LAPTOP), false);
    assert.deepEqual(lines, [
      { level: 'info', event: 'relay_unknown', client: LAPTOP, reason: 'tailscale_bin_invalid' },
    ]);
  }
});

test('tailscale exiting 1 is false, with its stderr verbatim as detail', async () => {
  const { ask, lines } = probe(fake('echo "failed to connect to local tailscaled" >&2; exit 1'));
  assert.equal(await ask(LAPTOP), false);
  assert.deepEqual(lines, [
    {
      level: 'info',
      event: 'relay_unknown',
      client: LAPTOP,
      reason: 'tailscale_failed',
      detail: 'failed to connect to local tailscaled',
    },
  ]);
});

test('a missing binary is tailscale_failed', async () => {
  const { ask, lines } = probe(join(dir, 'nope'));
  assert.equal(await ask(LAPTOP), false);
  assert.equal(lines[0]?.event === 'relay_unknown' && lines[0].reason, 'tailscale_failed');
});

test('bad JSON, or a non-object Peer, is unparseable', async () => {
  for (const out of ['not json', JSON.stringify({ Peer: [] }), '42']) {
    const { ask, lines } = probe(printing(out));
    assert.equal(await ask(LAPTOP), false, out);
    assert.equal(lines.length, 1, out);
    const [line] = lines;
    assert.ok(line?.event === 'relay_unknown');
    assert.equal(line.reason, 'unparseable');
    assert.equal(line.level, 'info');
  }
});

test('a tailscale that hangs past 2s is false by about 2s, logged timeout', async () => {
  // `exec sleep` would be killed with the shell; a child sleep keeps stdout open past SIGKILL.
  const { ask, lines } = probe(fake('sleep 10; echo {}'));
  const started = performance.now();
  assert.equal(await ask(LAPTOP), false);
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 3_000, `${elapsed}ms`);
  assert.deepEqual(lines, [
    { level: 'info', event: 'relay_unknown', client: LAPTOP, reason: 'timeout' },
  ]);
});

test('an abort answers false at once, logged timeout', async () => {
  const lines: LogLine[] = [];
  const relay = relayHealth({ tailscaleBin: fake('sleep 10'), logger: (l) => lines.push(l) });
  const controller = new AbortController();
  const pending = relay(LAPTOP, controller.signal);
  setTimeout(() => controller.abort(), 100);
  const started = performance.now();
  assert.equal(await pending, false);
  assert.ok(performance.now() - started < 1_000);
  assert.equal(lines[0]?.event === 'relay_unknown' && lines[0].reason, 'timeout');
});

test('the tailscale child never sees the op token or the credentials directory', async () => {
  const dump = join(dir, 'env.txt');
  const json = join(dir, 'env-status.json');
  writeFileSync(json, status({ CurAddr: '', Relay: 'nyc' }));
  const bin = fake(`env > '${dump}'; cat '${json}'`);
  process.env.OP_SERVICE_ACCOUNT_TOKEN = 'ops_secret_token';
  process.env.CREDENTIALS_DIRECTORY = '/run/credentials/sidepiece-bridge.service';
  try {
    assert.equal(await probe(bin).ask(LAPTOP), true);
  } finally {
    delete process.env.OP_SERVICE_ACCOUNT_TOKEN;
    delete process.env.CREDENTIALS_DIRECTORY;
  }
  const env = readFileSync(dump, 'utf8');
  assert.doesNotMatch(env, /OP_SERVICE_ACCOUNT_TOKEN|ops_secret_token/);
  assert.doesNotMatch(env, /CREDENTIALS_DIRECTORY/);
  assert.match(env, /^PATH=/m);
});
