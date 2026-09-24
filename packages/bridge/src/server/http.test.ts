import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { CONTRACT_VERSION } from '@sidepiece/contract';
import type { LogLine } from '../log.ts';
import { DegradedError } from './errors.ts';
import { createBridgeServer } from './http.ts';

const lines: LogLine[] = [];
const startedAt = new Date().toISOString();
const server = createBridgeServer({
  startedAt,
  log: (line) => lines.push(line),
  routes: {
    '/boom': {
      GET: () => {
        throw new Error('boom secret prose');
      },
    },
    '/degraded': {
      GET: async () => {
        throw new DegradedError({ ds: 'DS-7', params: { status: '502' } });
      },
    },
  },
});
let base = '';

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.closeAllConnections();
  server.close();
});

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(5_000) });
  const text = await res.text();
  assert.equal(res.headers.get('x-sidepiece-contract'), String(CONTRACT_VERSION));
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8');
  return { res, text, body: JSON.parse(text) as unknown };
}

const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertCamelKeys(value: unknown, at = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      assertCamelKeys(v, `${at}[${i}]`);
    });
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      assert.match(k, /^[a-z][a-zA-Z0-9]*$/, `${at}.${k} is not camelCase`);
      assertCamelKeys(v, `${at}.${k}`);
    }
  }
}

test('GET /v1/health returns the exact body, in key order', async () => {
  const { res, body } = await call('/v1/health');
  assert.equal(res.status, 200);
  const health = body as Record<string, unknown>;
  assert.deepEqual(Object.keys(health), [
    'status',
    'contractVersion',
    'node',
    'startedAt',
    'checkedAt',
    'degraded',
  ]);
  assert.equal(health.status, 'ok');
  assert.equal(health.contractVersion, CONTRACT_VERSION);
  assert.equal(health.node, process.version);
  assert.equal(health.startedAt, startedAt);
  assert.match(String(health.startedAt), ISO_Z);
  assert.match(String(health.checkedAt), ISO_Z);
  assert.deepEqual(health.degraded, []);
  assertCamelKeys(body);
});

test('the query string is ignored', async () => {
  const { res, body } = await call('/v1/health?x=1');
  assert.equal(res.status, 200);
  assert.equal((body as { status: string }).status, 'ok');
});

test('an unknown path is 404 not_found', async () => {
  const { res, body } = await call('/nope?q=1');
  assert.equal(res.status, 404);
  assert.deepEqual(body, { error: 'not_found', path: '/nope' });
});

test('a wrong method is 405 with Allow', async () => {
  const { res, body } = await call('/v1/health', { method: 'POST', body: '{}' });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET');
  assert.deepEqual(body, { error: 'method_not_allowed', method: 'POST', path: '/v1/health' });
});

test('a thrown Error is 500 internal_error, with no prose on the wire', async () => {
  const { res, text, body } = await call('/boom');
  assert.equal(res.status, 500);
  assert.deepEqual(body, { error: 'internal_error' });
  assert.doesNotMatch(text, /boom|secret|prose/);
  const failed = lines.find((l) => l.event === 'handler_failed');
  assert.ok(failed && failed.level === 'error');
  assert.equal(failed.ds, 'DS-5');
  assert.equal('detail' in failed ? failed.detail : undefined, 'boom secret prose');
});

test('a thrown DegradedError is 200 with degraded[]', async () => {
  const { res, body } = await call('/degraded');
  assert.equal(res.status, 200);
  assert.deepEqual(body, { degraded: [{ ds: 'DS-7', params: { status: '502' } }] });
  assertCamelKeys(body);
});

test('every request logs a request line; the client comes from X-Forwarded-For first hop', async () => {
  await call('/v1/health', { headers: { 'X-Forwarded-For': '100.64.0.7, 10.0.0.1' } });
  await new Promise((r) => setImmediate(r));
  const req = lines.filter((l) => l.event === 'request').at(-1);
  assert.ok(req && req.event === 'request');
  assert.equal(req.client, '100.64.0.7');
  assert.equal(req.status, 200);
  assert.equal(req.path, '/v1/health');
  const plain = lines.find((l) => l.event === 'request' && l.path === '/nope');
  assert.ok(plain && plain.event === 'request');
  assert.equal(plain.client, '127.0.0.1');
});
