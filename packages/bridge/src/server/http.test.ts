import assert from 'node:assert/strict';
import { type AddressInfo, connect } from 'node:net';
import { after, before, test } from 'node:test';
import { CONTRACT_VERSION, type Degraded, type ProjectRecord } from '@sidepiece/contract';
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
