import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { CONTRACT_VERSION, type Degraded } from '@sidepiece/contract';
import type { LogLine } from '../log.ts';
import { DegradedError } from './errors.ts';
import {
  builtinRoutes,
  createBridgeServer,
  type Handler,
  matchRoute,
  pathOf,
  type RouteTable,
} from './http.ts';

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
    '/unserialisable': { GET: () => ({ status: 200, body: { n: 1n } }) },
    '/hang': { GET: () => new Promise(() => {}) },
    '/v1/thing/:id': {
      GET: (_req, params) => ({ status: 200, body: { params } }),
    },
    '/v1/thing/exact': { GET: () => ({ status: 200, body: { exact: true } }) },
    '/v1/thing/:id/sub/:pjid': {
      GET: (_req, { pjid }) => {
        throw new DegradedError({ ds: 'DS-2', params: { pjid: pjid ?? '' } });
      },
    },
    '/multi': {
      GET: () => ({ status: 200, body: {} }),
      PUT: undefined,
      DELETE: () => ({ status: 200, body: {} }),
    },
  },
  handlerDeadlineMs: 200,
});
let base = '';

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

/** Poll the captured log until a line matches; the server logs on 'close', after the client has its answer. */
async function logged(pred: (l: LogLine) => boolean): Promise<LogLine> {
  for (let i = 0; i < 100; i++) {
    const hit = lines.findLast(pred);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail('expected log line never appeared');
}

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
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
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
  const warn = await logged((l) => l.event === 'degraded');
  assert.ok(warn.event === 'degraded');
  assert.equal(warn.level, 'warn');
  assert.equal(warn.ds, 'DS-7');
});

test('HEAD /v1/health is answered like GET, with no body', async () => {
  const res = await fetch(`${base}/v1/health`, {
    method: 'HEAD',
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-sidepiece-contract'), String(CONTRACT_VERSION));
  assert.equal(await res.text(), '');
});

test('Allow lists only methods with a handler', async () => {
  const { res } = await call('/multi', { method: 'PATCH', body: '{}' });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, DELETE, HEAD');
});

test('a body that cannot be serialised is 500 internal_error, and logged with ds', async () => {
  const { res, body } = await call('/unserialisable');
  assert.equal(res.status, 500);
  assert.deepEqual(body, { error: 'internal_error' });
  const failed = await logged((l) => l.event === 'handler_failed' && l.path === '/unserialisable');
  assert.ok(failed.level === 'error');
  assert.equal(failed.ds, 'DS-5');
});

test('a handler that never settles is answered 500 at its deadline, and logged with ds', async () => {
  const { res, body } = await call('/hang');
  assert.equal(res.status, 500);
  assert.deepEqual(body, { error: 'internal_error' });
  const timedOut = await logged((l) => l.event === 'handler_timed_out');
  assert.ok(timedOut.event === 'handler_timed_out');
  assert.equal(timedOut.ds, 'DS-5');
  assert.equal(timedOut.deadlineMs, 200);
});

test('every built-in route, forced to throw, answers a typed code and no prose', async () => {
  const builtins = builtinRoutes(startedAt);
  const thrower: Handler = () => {
    throw new Error('forced secret prose');
  };
  const forced: RouteTable = {};
  for (const [path, methods] of Object.entries(builtins)) {
    forced[path] = Object.fromEntries(Object.keys(methods).map((m) => [m, thrower]));
  }
  const faulty = createBridgeServer({ startedAt, routes: forced, log: () => {} });
  await new Promise<void>((resolve) => faulty.listen(0, '127.0.0.1', resolve));
  const port = (faulty.address() as AddressInfo).port;
  try {
    for (const [path, methods] of Object.entries(builtins)) {
      for (const method of Object.keys(methods)) {
        const res = await fetch(`http://127.0.0.1:${port}${path}`, {
          method,
          signal: AbortSignal.timeout(5_000),
        });
        const text = await res.text();
        assert.equal(res.status, 500, `${method} ${path}`);
        assert.deepEqual(JSON.parse(text), { error: 'internal_error' });
        assert.doesNotMatch(text, /forced|secret|prose/);
      }
    }
  } finally {
    faulty.closeAllConnections();
    await new Promise((resolve) => faulty.close(resolve));
  }
});

test('pathOf drops the query and never reads a // prefix as a host', () => {
  assert.equal(pathOf('/v1/health?x=1'), '/v1/health');
  assert.equal(pathOf('//evil/v1/health'), '//evil/v1/health');
  assert.equal(pathOf('http://h/v1/health?x'), '/v1/health');
  assert.equal(pathOf(undefined), '/');
  assert.equal(pathOf('?q'), '/');
});

test('every request logs a request line; the client comes from X-Forwarded-For first hop', async () => {
  await call('/v1/health', { headers: { 'X-Forwarded-For': '100.64.0.7, 10.0.0.1' } });
  const req = await logged((l) => l.event === 'request' && l.client === '100.64.0.7');
  assert.ok(req.event === 'request');
  assert.equal(req.client, '100.64.0.7');
  assert.equal(req.status, 200);
  assert.equal(req.path, '/v1/health');
  const plain = await logged((l) => l.event === 'request' && l.path === '/nope');
  assert.ok(plain && plain.event === 'request');
  assert.equal(plain.client, '127.0.0.1');
});

test('/v1/health echoes the injected degraded[], read per request, and stays 200 ok', async () => {
  let current: Degraded[] = [];
  let calls = 0;
  const srv = createBridgeServer({
    startedAt,
    log: () => {},
    degraded: () => {
      calls++;
      return current;
    },
  });
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/v1/health`;
  const get = async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  try {
    const empty = await get();
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body.degraded, []);
    current = [{ ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } }];
    for (let i = 0; i < 2; i++) {
      const { status, body } = await get();
      assert.equal(status, 200);
      assert.equal(body.status, 'ok');
      assert.deepEqual(body.degraded, [
        { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } },
      ]);
    }
    assert.equal(calls, 3);
  } finally {
    srv.closeAllConnections();
    await new Promise((resolve) => srv.close(resolve));
  }
});

test('a :name segment matches one non-empty segment, decoded once, and reaches the handler', async () => {
  const { res, body } = await call('/v1/thing/a%2Fb%2520c');
  assert.equal(res.status, 200);
  assert.deepEqual(body, { params: { id: 'a/b%20c' } });
  for (const miss of ['/v1/thing/', '/v1/thing', '/v1/thing/a/b', '/v1/thing/%E0%A4%A']) {
    const r = await call(miss);
    assert.equal(r.res.status, 404, miss);
    assert.deepEqual(r.body, { error: 'not_found', path: miss });
  }
});

test('an exact route wins over a pattern that also matches', async () => {
  const { body } = await call('/v1/thing/exact');
  assert.deepEqual(body, { exact: true });
  assert.deepEqual(matchRoute({ '/a/:x': {}, '/a/b': {} }, '/a/b')?.params, {});
  assert.deepEqual(
    matchRoute({ '/a/:x': { GET: () => ({ status: 200, body: {} }) } }, '/a/:x')?.params,
    { x: ':x' },
  );
});

test('a pattern route keeps HEAD and 405 semantics', async () => {
  const head = await fetch(`${base}/v1/thing/x`, {
    method: 'HEAD',
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const { res, body } = await call('/v1/thing/x', { method: 'POST', body: '{}' });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET, HEAD');
  assert.deepEqual(body, { error: 'method_not_allowed', method: 'POST', path: '/v1/thing/x' });
});

test('a degraded warn line carries the matched pjid top-level', async () => {
  const { res, body } = await call('/v1/thing/1/sub/nope');
  assert.equal(res.status, 200);
  assert.deepEqual(body, { degraded: [{ ds: 'DS-2', params: { pjid: 'nope' } }] });
  const warn = await logged((l) => l.event === 'degraded' && l.ds === 'DS-2');
  assert.equal(warn.pjid, 'nope');
});
