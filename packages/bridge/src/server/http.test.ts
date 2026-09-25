import assert from 'node:assert/strict';
import { type AddressInfo, connect } from 'node:net';
import { after, before, test } from 'node:test';
import {
  CONTRACT_VERSION,
  DEPENDENCY_NAMES,
  type Degraded,
  type ProjectRecord,
} from '@sidepiece/contract';
import { createHealth } from '../health/aggregator.ts';
import type { LogLine } from '../log.ts';
import { DegradedError } from './errors.ts';
import {
  builtinRoutes,
  createBridgeServer,
  type Handler,
  MAX_BODY_BYTES,
  type MutationResolver,
  matchRoute,
  mutatingRoute,
  pathOf,
  type RouteTable,
} from './http.ts';

/** A resolver that never fetches: every pjid is at `current`, and every call is counted. */
function stubResolver(current = 5) {
  const counter = { calls: 0, current };
  const resolve: MutationResolver = async (pjid) => {
    counter.calls++;
    const record: ProjectRecord = {
      pjid,
      generation: counter.current,
      repo: pjid,
      clonePath: `/r/${pjid}`,
      boardId: '',
      agents: [],
      ticketProvider: { type: 'plane' },
    };
    return record;
  };
  return { counter, resolve };
}

const guard = stubResolver();
let guardedRuns = 0;
/** Well past the 200ms handler deadline below. */
const SLOW_RESOLVE_MS = 400;
let slowRuns = 0;
/** Inside the 200ms deadline, so only a client disconnect can abort it. */
const GONE_RESOLVE_MS = 100;
const gone = { resolves: 0, runs: 0 };

let ownOptionsRuns = 0;

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
    '/v1/own-options': {
      GET: () => ({ status: 200, body: {} }),
      OPTIONS: () => {
        ownOptionsRuns++;
        return { status: 200, body: { handler: true } };
      },
    },
    '/v1/project/:pjid': { GET: (_req, { pjid }) => ({ status: 200, body: { pjid } }) },
    '/v1/thing/:id/sub/:pjid': {
      GET: (_req, { pjid }) => {
        throw new DegradedError({ ds: 'DS-2', params: { pjid: pjid ?? '' } });
      },
    },
    '/multi/:pjid': {
      GET: () => ({ status: 200, body: {} }),
      PUT: undefined,
      DELETE: mutatingRoute(stubResolver().resolve, () => ({ status: 200, body: {} })),
    },
    '/v1/slow/:pjid': {
      POST: mutatingRoute(
        async (pjid) => {
          await new Promise((r) => setTimeout(r, SLOW_RESOLVE_MS));
          return stubResolver().resolve(pjid);
        },
        () => {
          slowRuns++;
          return { status: 200, body: {} };
        },
      ),
    },
    '/v1/gone/:pjid': {
      POST: mutatingRoute(
        async (pjid) => {
          gone.resolves++;
          await new Promise((r) => setTimeout(r, GONE_RESOLVE_MS));
          return stubResolver().resolve(pjid);
        },
        () => {
          gone.runs++;
          return { status: 200, body: {} };
        },
      ),
    },
    '/v1/unminted/:pjid': {
      POST: mutatingRoute(stubResolver(0).resolve, () => {
        guardedRuns++;
        return { status: 200, body: {} };
      }),
    },
    '/v1/mut/:pjid': {
      POST: mutatingRoute(guard.resolve, (_req, { pjid, generation, body }) => {
        guardedRuns++;
        return { status: 200, body: { pjid, generation, bodyPjid: body.pjid ?? null } };
      }),
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
    'relayed',
    'dependencies',
    'degraded',
  ]);
  assert.equal(health.status, 'ok');
  assert.equal(health.relayed, false);
  // The default aggregator has nothing registered: every row unprobed, never ok.
  assert.deepEqual(
    (health.dependencies as { name: string; status: string }[]).map((d) => [d.name, d.status]),
    DEPENDENCY_NAMES.map((n) => [n, 'unprobed']),
  );
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
  const { res } = await call('/multi/x', { method: 'PATCH', body: '{}' });
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

test('two callers through tailscale serve log two distinct XFF clients, neither loopback', async () => {
  await call('/v1/health?caller=laptop', { headers: { 'X-Forwarded-For': '100.81.162.91' } });
  await call('/v1/health?caller=host', { headers: { 'X-Forwarded-For': '100.66.29.76' } });
  const laptop = await logged((l) => l.event === 'request' && l.client === '100.81.162.91');
  const host = await logged((l) => l.event === 'request' && l.client === '100.66.29.76');
  assert.ok(laptop.event === 'request' && host.event === 'request');
  assert.notEqual(laptop.client, host.client);
  assert.notEqual(laptop.client, '127.0.0.1');
  assert.notEqual(host.client, '127.0.0.1');
});

const EXT_ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

/** A preflight: 204, empty body, and the headers every preflight carries whatever the path. */
async function preflight(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}${path}`, {
    method: 'OPTIONS',
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
  assert.equal(res.headers.get('access-control-allow-private-network'), 'true');
  assert.equal(res.headers.get('access-control-max-age'), '600');
  assert.equal(res.headers.get('vary'), 'Origin');
  assert.equal(res.headers.get('x-sidepiece-contract'), String(CONTRACT_VERSION));
  return res;
}

test('preflight on a known route: 204, the origin reflected, the route methods plus OPTIONS', async () => {
  const res = await preflight('/v1/project/x', {
    Origin: EXT_ORIGIN,
    'Access-Control-Request-Method': 'GET',
    'Access-Control-Request-Private-Network': 'true',
  });
  assert.equal(res.headers.get('access-control-allow-origin'), EXT_ORIGIN);
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
  assert.equal(res.headers.get('access-control-allow-headers'), 'Content-Type');
});

test('preflight on an unknown path is 204 with ACAPN, not 404 or 405', async () => {
  const res = await preflight('/nope', { Origin: EXT_ORIGIN });
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
});

test('preflight with no Origin allows *', async () => {
  const res = await preflight('/v1/health');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
});

test('preflight echoes the requested headers', async () => {
  const res = await preflight('/v1/health', {
    Origin: EXT_ORIGIN,
    'Access-Control-Request-Headers': 'content-type, x-foo',
  });
  assert.equal(res.headers.get('access-control-allow-headers'), 'content-type, x-foo');
});

test('preflight on a mutating route lists its methods', async () => {
  const res = await preflight('/multi/x', { Origin: EXT_ORIGIN });
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET, DELETE, HEAD, OPTIONS');
});

test('a route that registers OPTIONS is still answered by the server; its handler never runs', async () => {
  const res = await preflight('/v1/own-options', { Origin: EXT_ORIGIN });
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET, OPTIONS, HEAD');
  assert.equal(ownOptionsRuns, 0);
});

test('a preflight logs a request line with its client', async () => {
  await preflight('/v1/health?pf=1', { 'X-Forwarded-For': '100.81.162.91' });
  const line = await logged(
    (l) => l.event === 'request' && l.method === 'OPTIONS' && l.client === '100.81.162.91',
  );
  assert.ok(line.event === 'request');
  assert.equal(line.status, 204);
});

test('a plain GET with Origin carries the CORS read headers', async () => {
  const { res } = await call('/v1/health', { headers: { Origin: 'o' } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'o');
  assert.equal(res.headers.get('vary'), 'Origin');
  assert.equal(res.headers.get('access-control-expose-headers'), 'X-Sidepiece-Contract');
});

test('every non-preflight response carries CORS read headers, errors included', async () => {
  for (const path of ['/nope', '/boom']) {
    const { res } = await call(path);
    assert.equal(res.headers.get('access-control-allow-origin'), '*', path);
    assert.equal(res.headers.get('access-control-expose-headers'), 'X-Sidepiece-Contract', path);
  }
});

async function healthFrom(options: Parameters<typeof createBridgeServer>[0], headers = {}) {
  const srv = createBridgeServer(options);
  await new Promise<void>((resolve) => srv.listen(0, '127.0.0.1', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${(srv.address() as AddressInfo).port}/v1/health`, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  } finally {
    srv.closeAllConnections();
    await new Promise((resolve) => srv.close(resolve));
  }
}

test('/v1/health rows follow DEPENDENCY_NAMES, and degraded follows the rows', async () => {
  const ds25: Degraded = { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } };
  const ds6: Degraded = { ds: 'DS-6', params: { endpoint: 'http://127.0.0.1:1' } };
  const failing = (d: Degraded) => ({
    run: async () => ({ status: 'failing' as const, degraded: [d] as [Degraded] }),
    timedOut: () => ({ status: 'failing' as const, degraded: [d] as [Degraded] }),
  });
  const { status, body } = await healthFrom({
    startedAt,
    log: () => {},
    // Registered store-first: row order is the name list's, never registration order.
    health: createHealth({ probes: { store: failing(ds25), registry: failing(ds6) } }),
  });
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  const rows = body.dependencies as Record<string, unknown>[];
  assert.deepEqual(
    rows.map((r) => r.name),
    [...DEPENDENCY_NAMES],
  );
  assert.deepEqual(
    rows.slice(0, 2).map((r) => [r.status, r.ds]),
    [
      ['failing', 'DS-6'],
      ['failing', 'DS-25'],
    ],
  );
  assert.deepEqual(body.degraded, [ds6, ds25]);
});

test('/v1/health passes the first X-Forwarded-For entry only, never the socket address', async () => {
  const seen: (string | undefined)[] = [];
  const health = createHealth({
    relay: async (ip) => {
      seen.push(ip);
      return ip === '100.81.162.91';
    },
  });
  const opts = { startedAt, log: () => {}, health };
  const relayed = await healthFrom(opts, { 'X-Forwarded-For': ' 100.81.162.91 , 10.0.0.1' });
  assert.equal(relayed.body.relayed, true);
  assert.deepEqual(relayed.body.degraded, [{ ds: 'DS-15' }]);
  const direct = await healthFrom(opts);
  assert.equal(direct.body.relayed, false);
  assert.deepEqual(direct.body.degraded, []);
  assert.deepEqual(seen, ['100.81.162.91', undefined]);
});

test('/v1/health does not read the Bridge-wide degraded option', async () => {
  let calls = 0;
  const { body } = await healthFrom({
    startedAt,
    log: () => {},
    degraded: () => {
      calls++;
      return [{ ds: 'DS-25' }];
    },
  });
  assert.deepEqual(body.degraded, []);
  assert.equal(calls, 0);
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

async function post(path: string, body: string, headers: Record<string, string> = {}) {
  return call(path, { method: 'POST', body, headers });
}

test('a current generation runs the guarded handler with the path pjid; ctx.body drops pjid', async () => {
  const before = guard.counter.calls;
  const { res, body } = await post('/v1/mut/sidepiece', '{"generation":5,"pjid":"vinyl"}');
  assert.equal(res.status, 200);
  assert.deepEqual(body, { pjid: 'sidepiece', generation: 5, bodyPjid: null });
  assert.equal(guard.counter.calls, before + 1);
});

test('a stale generation is 409 stale_generation, logged info, and the handler never runs', async () => {
  const runs = guardedRuns;
  const { res, text } = await post('/v1/mut/p', '{"generation":4}');
  assert.equal(res.status, 409);
  assert.equal(text, '{"error":"stale_generation","pjid":"p","received":4,"current":5}');
  assert.equal(guardedRuns, runs);
  const refused = await logged((l) => l.event === 'mutation_refused');
  assert.deepEqual(
    { ...refused },
    { level: 'info', event: 'mutation_refused', pjid: 'p', received: 4, current: 5 },
  );
  assert.ok(!lines.some((l) => l.event === 'degraded' && l.pjid === 'p'), 'no degraded warn');
});

test('an ahead generation is 500 internal_error, logged generation_ahead_of_bridge', async () => {
  const runs = guardedRuns;
  const { res, body } = await post('/v1/mut/ahead', '{"generation":9}');
  assert.equal(res.status, 500);
  assert.deepEqual(body, { error: 'internal_error' });
  assert.equal(guardedRuns, runs);
  const ahead = await logged((l) => l.event === 'generation_ahead_of_bridge');
  assert.deepEqual(
    { ...ahead },
    {
      level: 'error',
      event: 'generation_ahead_of_bridge',
      ds: 'DS-5',
      pjid: 'ahead',
      received: 9,
      current: 5,
    },
  );
});

test('a missing, invalid or unparseable generation is 400 and never resolves', async () => {
  const cases: [string, Record<string, string>, unknown][] = [
    ['{}', { 'X-Sidepiece-Generation': '4' }, missing()],
    ['{"gen":5}', {}, missing()],
    ['{"generation":"4"}', {}, invalid()],
    ['{"generation":4.5}', {}, invalid()],
    ['{"generation":-1}', {}, invalid()],
    ['{"generation":null}', {}, invalid()],
    ['{"generation":9007199254740993}', {}, invalid()],
    ['not json', {}, badBody()],
    ['[4]', {}, badBody()],
    ['4', {}, badBody()],
    ['null', {}, badBody()],
    ['', {}, badBody()],
    [' '.repeat(MAX_BODY_BYTES + 1), {}, badBody()],
  ];
  const before = guard.counter.calls;
  const runs = guardedRuns;
  for (const [payload, headers, expected] of cases) {
    const { res, text } = await post('/v1/mut/sidepiece', payload, headers);
    assert.equal(res.status, 400, payload.slice(0, 40));
    assert.equal(text, JSON.stringify(expected), payload.slice(0, 40));
  }
  assert.equal(guard.counter.calls, before, 'a 400 never resolves');
  assert.equal(guardedRuns, runs);
  assert.ok(!lines.some((l) => l.event === 'degraded' && l.pjid === 'sidepiece'));
  const rejected = lines.filter((l) => l.event === 'mutation_rejected').slice(-cases.length);
  assert.deepEqual(
    rejected,
    cases.map(([, , expected]) => ({
      level: 'info',
      event: 'mutation_rejected',
      pjid: 'sidepiece',
      error: (expected as { error: string }).error,
    })),
    'every 400 logs its own error code',
  );

  function missing() {
    return { error: 'missing_generation', pjid: 'sidepiece', field: 'generation' };
  }
  function invalid() {
    return { error: 'invalid_generation', pjid: 'sidepiece', field: 'generation' };
  }
  function badBody() {
    return { error: 'invalid_body', pjid: 'sidepiece' };
  }
});

test('a body at exactly MAX_BODY_BYTES is read, not refused as invalid_body', async () => {
  const json = '{"generation":5}';
  const padded = json + ' '.repeat(MAX_BODY_BYTES - json.length);
  const { res } = await post('/v1/mut/sidepiece', padded);
  assert.equal(res.status, 200);
});

test('a mutating method not registered through mutatingRoute refuses construction', () => {
  const raw: Handler = () => ({ status: 200, body: {} });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.throws(
      () =>
        createBridgeServer({
          startedAt,
          log: () => {},
          routes: { '/v1/x/:pjid': { [method]: raw } },
        }),
      (err: unknown) =>
        err instanceof TypeError &&
        err.message === `unguarded mutating route: ${method} /v1/x/:pjid`,
    );
  }
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.doesNotThrow(() =>
      createBridgeServer({ startedAt, log: () => {}, routes: { '/v1/x': { [method]: raw } } }),
    );
  }
  assert.doesNotThrow(() =>
    createBridgeServer({
      startedAt,
      log: () => {},
      routes: {
        '/v1/x/:pjid': {
          POST: mutatingRoute(stubResolver().resolve, () => ({ status: 200, body: {} })),
        },
      },
    }),
  );
});

test('a resolve that outlives the handler deadline is 500, and the mutation never runs', async () => {
  const { res, body } = await post('/v1/slow/sidepiece', '{"generation":5}');
  assert.equal(res.status, 500);
  assert.deepEqual(body, { error: 'internal_error' });
  // Wait until the resolver has settled and the guard has had its chance to (wrongly) run.
  await new Promise((r) => setTimeout(r, SLOW_RESOLVE_MS + 100));
  assert.equal(slowRuns, 0);
});

/** Write raw request bytes, then drop the connection after `dropAfterMs` without reading. */
async function sendThenDrop(raw: string, dropAfterMs: number) {
  const { port } = server.address() as AddressInfo;
  const socket = connect(port, '127.0.0.1');
  await new Promise<void>((resolve) => socket.once('connect', resolve));
  socket.write(raw);
  await new Promise((r) => setTimeout(r, dropAfterMs));
  socket.destroy();
}

test('a client that disconnects while resolve is pending never runs the mutation', async () => {
  const before = { ...gone };
  const payload = '{"generation":5}';
  await sendThenDrop(
    `POST /v1/gone/sidepiece HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\n` +
      `Content-Length: ${payload.length}\r\n\r\n${payload}`,
    20,
  );
  // Past the resolver, well inside the deadline: only the disconnect can have stopped the guard.
  await new Promise((r) => setTimeout(r, GONE_RESOLVE_MS + 50));
  assert.equal(
    gone.resolves,
    before.resolves + 1,
    'the resolve was in flight when the client left',
  );
  assert.equal(gone.runs, before.runs);
  assert.ok(!lines.some((l) => l.event === 'handler_failed' && l.path === '/v1/gone/sidepiece'));
});

test('a client that disconnects mid-body gets no registry fetch and no DS-5 line', async () => {
  const before = { ...gone };
  await sendThenDrop(
    'POST /v1/gone/sidepiece HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\n' +
      'Content-Length: 64\r\n\r\n{"generation":',
    20,
  );
  await new Promise((r) => setTimeout(r, GONE_RESOLVE_MS + 50));
  assert.deepEqual(gone, before);
  assert.ok(!lines.some((l) => l.event === 'handler_failed' && l.path === '/v1/gone/sidepiece'));
});

test('a resolver returning generation 0 is 500: the guard never runs at "cannot validate"', async () => {
  const runs = guardedRuns;
  const { res, body } = await post('/v1/unminted/sidepiece', '{"generation":0}');
  assert.equal(res.status, 500);
  assert.deepEqual(body, { error: 'internal_error' });
  assert.equal(guardedRuns, runs);
});

test('a mutatingRoute on a pattern without :pjid refuses construction', () => {
  const handler = mutatingRoute(stubResolver().resolve, () => ({ status: 200, body: {} }));
  assert.throws(
    () => createBridgeServer({ startedAt, log: () => {}, routes: { '/v1/x': { POST: handler } } }),
    (err: unknown) =>
      err instanceof TypeError && err.message === 'mutating route without :pjid: POST /v1/x',
  );
});
