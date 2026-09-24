import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, before, test } from 'node:test';
import type { Degraded } from '@sidepiece/contract';
import { fixtureProjects, type StubRegistry, startStubRegistry } from '../../test/stub-registry.ts';
import type { LogLine } from '../log.ts';
import { openStore, type TurnStore } from '../turns/store.ts';
import { createBridgeServer, MAX_BODY_BYTES, mutatingRoute } from './http.ts';
import { mutationResolver, type ProjectRoutesOptions, projectRoutes } from './project.ts';

/**
 * SM-3 end to end: `projectRoutes` plus a fixture `POST /v1/project/:pjid/fixture` guarded by
 * `mutatingRoute(mutationResolver(...))`, over raw sockets so the status line and body bytes
 * are asserted exactly as they leave the Bridge.
 */

let stub: StubRegistry;
before(async () => {
  stub = await startStubRegistry();
});
after(async () => {
  await stub.close();
});

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
  stub.projects = fixtureProjects();
  stub.override = undefined;
});

function freshStore(): TurnStore {
  const dir = mkdtempSync(join(tmpdir(), 'sidepiece-mutating-'));
  const opened = openStore(dir);
  assert.equal(opened.kind, 'ready');
  const { store } = opened as Extract<typeof opened, { kind: 'ready' }>;
  cleanups.push(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return store;
}

type Raw = { statusLine: string; headers: Record<string, string>; body: string };

/** One HTTP/1.1 exchange on a raw socket; nothing between the Bridge and the bytes. */
function raw(port: number, method: string, path: string, body = '', extra = ''): Promise<Raw> {
  return new Promise((resolve, reject) => {
    const socket = connect({ port, host: '127.0.0.1', timeout: 5_000 });
    const chunks: Buffer[] = [];
    socket.on('timeout', () => socket.destroy(new Error('raw request timed out')));
    socket.on('error', reject);
    socket.on('data', (c: Buffer) => chunks.push(c));
    socket.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      const split = text.indexOf('\r\n\r\n');
      const [statusLine = '', ...headerLines] = text.slice(0, split).split('\r\n');
      const headers: Record<string, string> = {};
      for (const line of headerLines) {
        const at = line.indexOf(':');
        headers[line.slice(0, at).toLowerCase()] = line.slice(at + 1).trim();
      }
      resolve({ statusLine, headers, body: text.slice(split + 4) });
    });
    socket.write(
      `${method} ${path} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n` +
        `Content-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n${extra}\r\n`,
    );
    socket.write(body);
  });
}

async function bridge(options: Partial<ProjectRoutesOptions> = {}) {
  const lines: LogLine[] = [];
  const log = (l: LogLine) => lines.push(l);
  const store = 'store' in options ? options.store : freshStore();
  const opts: ProjectRoutesOptions = { registryUrl: stub.url, log, ...options, store };
  const invocations: { pjid: string; generation: number }[] = [];
  const bodies: Readonly<Record<string, unknown>>[] = [];
  const server = createBridgeServer({
    startedAt: new Date().toISOString(),
    log,
    routes: {
      ...projectRoutes(opts),
      '/v1/project/:pjid/fixture': {
        POST: mutatingRoute(mutationResolver(opts), (_req, { pjid, generation, body }) => {
          invocations.push({ pjid, generation });
          bodies.push(body);
          return { status: 200, body: { fixture: 'ok', pjid, generation } };
        }),
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  cleanups.push(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return {
    lines,
    invocations,
    bodies,
    get: (path: string) => raw(port, 'GET', path),
    post: (path: string, body: string, extra = '') => raw(port, 'POST', path, body, extra),
  };
}

/** Walk sidepiece to `target` by changing `repoPath` and re-resolving with a GET each time. */
async function walkTo(b: Awaited<ReturnType<typeof bridge>>, target: number) {
  for (let g = 1; g <= target; g++) {
    if (g > 1) stub.projects.sidepiece = { ...stub.projects.sidepiece, repoPath: `/r/walk-${g}` };
    const { body } = await b.get('/v1/project/sidepiece');
    assert.equal((JSON.parse(body) as { generation: number }).generation, g);
  }
}

function assertWire(r: Raw) {
  assert.match(r.headers['content-type'] ?? '', /^application\/json/);
  assert.equal(r.headers['x-sidepiece-contract'], '1');
}

test('stale after a rename no GET has seen: 409 byte-exact, and the handler never runs', async () => {
  const b = await bridge();
  await walkTo(b, 4);
  stub.projects.sidepiece = { ...stub.projects.sidepiece, repoPath: '/r/moved-again' };
  const r = await b.post('/v1/project/sidepiece/fixture', '{"generation":4}');
  assert.equal(r.statusLine, 'HTTP/1.1 409 Conflict');
  assertWire(r);
  assert.equal(r.body, '{"error":"stale_generation","pjid":"sidepiece","received":4,"current":5}');
  assert.equal(b.invocations.length, 0);
  const refused = b.lines.find((l) => l.event === 'mutation_refused');
  assert.deepEqual(refused && { ...refused }, {
    level: 'info',
    event: 'mutation_refused',
    pjid: 'sidepiece',
    received: 4,
    current: 5,
  });
  assert.ok(!b.lines.some((l) => l.event === 'degraded'));

  const ok = await b.post('/v1/project/sidepiece/fixture', '{"generation":5}');
  assert.equal(ok.statusLine, 'HTTP/1.1 200 OK');
  assertWire(ok);
  assert.equal(ok.body, '{"fixture":"ok","pjid":"sidepiece","generation":5}');
  assert.deepEqual(b.invocations, [{ pjid: 'sidepiece', generation: 5 }]);
});

test('current: the fixture answers its own 200 and runs exactly once', async () => {
  const b = await bridge();
  await walkTo(b, 1);
  const r = await b.post('/v1/project/sidepiece/fixture', '{"generation":1}');
  assert.equal(r.statusLine, 'HTTP/1.1 200 OK');
  assert.equal(r.body, '{"fixture":"ok","pjid":"sidepiece","generation":1}');
  assert.equal(b.invocations.length, 1);
});

test('ahead: 500 internal_error, logged generation_ahead_of_bridge, handler never runs', async () => {
  const b = await bridge();
  await walkTo(b, 5);
  const r = await b.post('/v1/project/sidepiece/fixture', '{"generation":9}');
  assert.equal(r.statusLine, 'HTTP/1.1 500 Internal Server Error');
  assertWire(r);
  assert.equal(r.body, '{"error":"internal_error"}');
  assert.equal(b.invocations.length, 0);
  const ahead = b.lines.find((l) => l.event === 'generation_ahead_of_bridge');
  assert.deepEqual(ahead && { ...ahead }, {
    level: 'error',
    event: 'generation_ahead_of_bridge',
    ds: 'DS-5',
    pjid: 'sidepiece',
    received: 9,
    current: 5,
  });
});

test('400s: header-only, bad values and bad bodies never fetch the registry', async () => {
  const b = await bridge();
  const missing = '{"error":"missing_generation","pjid":"sidepiece","field":"generation"}';
  const invalid = '{"error":"invalid_generation","pjid":"sidepiece","field":"generation"}';
  const badBody = '{"error":"invalid_body","pjid":"sidepiece"}';
  const cases: [string, string, string][] = [
    ['{}', 'X-Sidepiece-Generation: 4\r\n', missing],
    ['{"generation":"4"}', '', invalid],
    ['{"generation":4.5}', '', invalid],
    ['{"generation":-1}', '', invalid],
    ['{"generation":null}', '', invalid],
    ['not json', '', badBody],
    ['[4]', '', badBody],
    [`{"generation":1,"pad":"${'x'.repeat(MAX_BODY_BYTES)}"}`, '', badBody],
  ];
  const requests = stub.requests;
  for (const [body, extra, expected] of cases) {
    const r = await b.post('/v1/project/sidepiece/fixture', body, extra);
    assert.equal(r.statusLine, 'HTTP/1.1 400 Bad Request', body.slice(0, 40));
    assertWire(r);
    assert.equal(r.body, expected, body.slice(0, 40));
  }
  assert.equal(stub.requests, requests, 'no registry fetch');
  assert.equal(b.invocations.length, 0);
  assert.ok(!b.lines.some((l) => l.event === 'degraded' || l.event === 'resolved'));
});

test('a pjid in the body is ignored: guard and handler see the path pjid', async () => {
  const b = await bridge();
  await walkTo(b, 1);
  const r = await b.post(
    '/v1/project/sidepiece/fixture',
    '{"generation":1,"pjid":"vinyl","title":"t"}',
  );
  assert.equal(r.statusLine, 'HTTP/1.1 200 OK');
  assert.equal(r.body, '{"fixture":"ok","pjid":"sidepiece","generation":1}');
  assert.deepEqual(b.invocations, [{ pjid: 'sidepiece', generation: 1 }]);
  assert.deepEqual(b.bodies, [{ title: 't' }], 'ctx.body carries no pjid and no generation');
});

test('an unknown pjid is 200 DS-2 and the handler never runs', async () => {
  const b = await bridge();
  const r = await b.post('/v1/project/nope/fixture', '{"generation":1}');
  assert.equal(r.statusLine, 'HTTP/1.1 200 OK');
  assertWire(r);
  assert.equal(r.body, JSON.stringify({ degraded: [{ ds: 'DS-2', params: { pjid: 'nope' } }] }));
  assert.equal(b.invocations.length, 0);
});

test('registry down is 200 DS-6 and the handler never runs', async () => {
  const b = await bridge({ registryUrl: 'http://127.0.0.1:1' });
  const r = await b.post('/v1/project/sidepiece/fixture', '{"generation":1}');
  assert.equal(r.statusLine, 'HTTP/1.1 200 OK');
  assert.equal(
    r.body,
    JSON.stringify({ degraded: [{ ds: 'DS-6', params: { endpoint: 'http://127.0.0.1:1' } }] }),
  );
  assert.equal(b.invocations.length, 0);
});

test('a registry error is 200 DS-7 and the handler never runs', async () => {
  const b = await bridge();
  stub.override = { status: 500, body: 'oops' };
  const r = await b.post('/v1/project/sidepiece/fixture', '{"generation":1}');
  assert.equal(r.statusLine, 'HTTP/1.1 200 OK');
  assert.equal(
    r.body,
    JSON.stringify({ degraded: [{ ds: 'DS-7', params: { error: '500 Internal Server Error' } }] }),
  );
  assert.equal(b.invocations.length, 0);
});

test('DS-25 (no store, generation 0): 200 with exactly the DS-25 entry; cannot validate', async () => {
  const ds25: Degraded = { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } };
  const b = await bridge({ store: undefined, degraded: () => [ds25] });
  const requests = stub.requests;
  for (const generation of [0, 1]) {
    const r = await b.post('/v1/project/sidepiece/fixture', `{"generation":${generation}}`);
    assert.equal(r.statusLine, 'HTTP/1.1 200 OK');
    assertWire(r);
    assert.equal(r.body, JSON.stringify({ degraded: [ds25] }));
  }
  assert.equal(b.invocations.length, 0);
  assert.equal(stub.requests, requests, 'no registry fetch under DS-25');
  assert.ok(!b.lines.some((l) => l.event === 'resolved'), 'nothing resolved under DS-25');
});

test('the GET record is unchanged by the refactor, and a POST to it is still 405', async () => {
  const b = await bridge();
  const r = await b.get('/v1/project/sidepiece');
  assert.deepEqual(Object.keys(JSON.parse(r.body) as object), [
    'pjid',
    'generation',
    'repo',
    'clonePath',
    'boardId',
    'agents',
    'ticketProvider',
    'degraded',
  ]);
  const post = await b.post('/v1/project/sidepiece', '{"generation":1}');
  assert.equal(post.statusLine, 'HTTP/1.1 405 Method Not Allowed');
});
