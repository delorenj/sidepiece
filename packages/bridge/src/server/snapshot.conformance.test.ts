import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import type { Degraded } from '@sidepiece/contract';
import { fixtureProjects, type StubRegistry, startStubRegistry } from '../../test/stub-registry.ts';
import { createHealth } from '../health/aggregator.ts';
import { registryHealth } from '../health/registry.ts';
import type { LogLine } from '../log.ts';
import { openSnapshot, type RegistrySnapshot } from '../registry/snapshot.ts';
import { openStore, type TurnStore } from '../turns/store.ts';
import { createBridgeServer, mutatingRoute } from './http.ts';
import { mutationResolver, type ProjectRoutesOptions, projectRoutes } from './project.ts';

/**
 * Story 1.9 end to end: every row of the snapshot I/O matrix against a live
 * `createBridgeServer`, a stub registry and a temp state dir. Bodies are asserted as the raw
 * text that leaves the Bridge.
 */

const REMEDY = 'systemctl --user start pjangler-project-registry.service';
const RECORD_KEYS = [
  'pjid',
  'generation',
  'repo',
  'clonePath',
  'boardId',
  'agents',
  'ticketProvider',
  'degraded',
];

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

type Env = { stateDir: string; store: TurnStore; snapshot: RegistrySnapshot; stub: StubRegistry };

async function env(): Promise<Env> {
  const stateDir = mkdtempSync(join(tmpdir(), 'sidepiece-snapshot-conf-'));
  const opened = openStore(stateDir);
  assert.equal(opened.kind, 'ready');
  const { store } = opened as Extract<typeof opened, { kind: 'ready' }>;
  const stub = await startStubRegistry(fixtureProjects());
  cleanups.push(async () => {
    await stub.close();
    store.close();
    rmSync(stateDir, { recursive: true, force: true });
  });
  return { stateDir, store, snapshot: openSnapshot(stateDir), stub };
}

async function bridge(e: Env, options: Partial<ProjectRoutesOptions> = {}) {
  const lines: LogLine[] = [];
  const log = (l: LogLine) => lines.push(l);
  const opts: ProjectRoutesOptions = {
    registryUrl: e.stub.url,
    store: e.store,
    snapshot: e.snapshot,
    probePaths: async () => [],
    log,
    ...options,
  };
  const invocations: string[] = [];
  const server = createBridgeServer({
    startedAt: new Date().toISOString(),
    log,
    health: createHealth({ probes: { registry: registryHealth(opts.registryUrl, e.snapshot) } }),
    routes: {
      ...projectRoutes(opts),
      '/v1/project/:pjid/fixture': {
        POST: mutatingRoute(mutationResolver(opts), (_req, { pjid }) => {
          invocations.push(pjid);
          return { status: 200, body: { fixture: 'ok' } };
        }),
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  cleanups.push(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await fetch(`${base}${path}`, { ...init, signal: AbortSignal.timeout(5_000) });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) as Record<string, unknown> };
  };
  return {
    lines,
    invocations,
    get: (path: string) => call(path),
    post: (path: string, body: string) => call(path, { method: 'POST', body }),
  };
}

const ds23Of = (body: Record<string, unknown>) =>
  (body.degraded as Degraded[]).find((d) => d.ds === 'DS-23');

test('healthy x3: every GET rewrites the snapshot whole, fetchedAt advancing', async () => {
  const e = await env();
  const b = await bridge(e);
  const past = new Date('2020-01-01T00:00:00Z');
  let lastFetchedAt = '';
  for (let i = 0; i < 3; i++) {
    try {
      utimesSync(e.snapshot.path, past, past);
    } catch {
      // the first GET creates it
    }
    const { status } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.ok(statSync(e.snapshot.path).mtimeMs > past.getTime(), `mtime advanced on GET ${i}`);
    const parsed = JSON.parse(readFileSync(e.snapshot.path, 'utf8')) as {
      fetchedAt: string;
      payload: { projects?: unknown };
    };
    assert.deepEqual(Object.keys(parsed), ['fetchedAt', 'payload']);
    assert.ok(parsed.payload.projects);
    assert.ok(parsed.fetchedAt >= lastFetchedAt);
    lastFetchedAt = parsed.fetchedAt;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(e.stub.requests, 3);
});

test('down with a snapshot: 200 full record, DS-23 then DS-6; resolutions untouched', async () => {
  const e = await env();
  const b = await bridge(e);
  const good = await b.get('/v1/project/sidepiece');
  const before = e.store.readResolution('sidepiece');
  assert.ok(before);
  await e.stub.close();

  const { status, body } = await b.get('/v1/project/sidepiece');
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(body), RECORD_KEYS);
  const { degraded: _g, ...goodRecord } = good.body;
  const { degraded, ...record } = body;
  assert.deepEqual(record, goodRecord, 'same record, same generation');
  const fetchedAt = (JSON.parse(readFileSync(e.snapshot.path, 'utf8')) as { fetchedAt: string })
    .fetchedAt;
  const [ds23, ds6, ...rest] = degraded as Degraded[];
  assert.equal(ds23?.ds, 'DS-23');
  assert.equal(ds23.params?.fetchedAt, fetchedAt);
  assert.match(ds23.params?.ageSeconds ?? '', /^\d+$/);
  assert.deepEqual(ds6, { ds: 'DS-6', params: { endpoint: e.stub.url }, remedy: REMEDY });
  assert.deepEqual(rest, []);
  assert.deepEqual(e.store.readResolution('sidepiece'), before);

  const warn = b.lines.find((l) => l.event === 'served_from_snapshot');
  assert.ok(warn && warn.event === 'served_from_snapshot');
  assert.equal(warn.level, 'warn');
  assert.equal(warn.ds, 'DS-23');
  assert.equal(warn.pjid, 'sidepiece');
  assert.equal(warn.generation, 1);
  assert.equal(warn.fetchedAt, fetchedAt);
  assert.equal(typeof warn.ageSeconds, 'number');
  assert.equal(b.lines.filter((l) => l.event === 'resolved').length, 1, 'no resolved line');
  assert.ok(!e.store.inspect().tables.some((t) => t.name === 'registry_snapshots'));
});

test('registry error with a snapshot: DS-23 then DS-7, error verbatim', async () => {
  let parseError = '';
  try {
    JSON.parse('not json');
  } catch (err) {
    parseError = (err as Error).message;
  }
  for (const [override, error] of [
    [{ status: 500, body: '{}' }, '500 Internal Server Error'],
    [{ status: 200, body: 'not json' }, parseError],
  ] as const) {
    const e = await env();
    const b = await bridge(e);
    await b.get('/v1/project/sidepiece');
    e.stub.override = override;
    const { status, body } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(body), RECORD_KEYS);
    const degraded = body.degraded as Degraded[];
    assert.deepEqual(
      degraded.map((d) => d.ds),
      ['DS-23', 'DS-7'],
    );
    assert.deepEqual(degraded[1], { ds: 'DS-7', params: { error } });
    assert.ok(b.lines.some((l) => l.event === 'served_from_snapshot'));
  }
});

test('down with no snapshot: exactly {"degraded":[DS-6]}', async () => {
  const e = await env();
  await e.stub.close();
  const b = await bridge(e);
  const { status, text } = await b.get('/v1/project/sidepiece');
  assert.equal(status, 200);
  assert.equal(
    text,
    JSON.stringify({
      degraded: [{ ds: 'DS-6', params: { endpoint: e.stub.url }, remedy: REMEDY }],
    }),
  );
  assert.deepEqual(
    b.lines.filter((l) => l.level !== 'info').map((l) => l.event),
    ['degraded'],
  );
});

test('registry error with no snapshot: exactly {"degraded":[DS-7]}', async () => {
  const e = await env();
  e.stub.override = { status: 500, body: '{}' };
  const b = await bridge(e);
  const { status, text } = await b.get('/v1/project/sidepiece');
  assert.equal(status, 200);
  assert.equal(
    text,
    JSON.stringify({ degraded: [{ ds: 'DS-7', params: { error: '500 Internal Server Error' } }] }),
  );
});

test('a 45-day-old snapshot is served, its age reported and never enforced', async () => {
  const e = await env();
  const b = await bridge(e);
  await b.get('/v1/project/sidepiece');
  const copy = JSON.parse(readFileSync(e.snapshot.path, 'utf8')) as { payload: unknown };
  const fetchedAt = new Date(Date.now() - 45 * 86_400_000).toISOString();
  writeFileSync(e.snapshot.path, JSON.stringify({ fetchedAt, payload: copy.payload }));
  await e.stub.close();
  const { status, body } = await b.get('/v1/project/sidepiece');
  assert.equal(status, 200);
  assert.equal(body.pjid, 'sidepiece');
  const ds23 = ds23Of(body);
  assert.equal(ds23?.params?.fetchedAt, fetchedAt);
  assert.ok(Number(ds23?.params?.ageSeconds) >= 3_888_000);
});

test('a pjid missing from the snapshot is the cause alone, never DS-2', async () => {
  const e = await env();
  const b = await bridge(e);
  await b.get('/v1/project/sidepiece');
  await e.stub.close();
  const { status, text } = await b.get('/v1/project/not-in-snapshot');
  assert.equal(status, 200);
  assert.equal(
    text,
    JSON.stringify({
      degraded: [{ ds: 'DS-6', params: { endpoint: e.stub.url }, remedy: REMEDY }],
    }),
  );
});

test('a corrupt snapshot is the cause alone, and logs snapshot_unreadable', async () => {
  const e = await env();
  writeFileSync(e.snapshot.path, '{bad');
  await e.stub.close();
  const b = await bridge(e);
  const { status, text } = await b.get('/v1/project/sidepiece');
  assert.equal(status, 200);
  assert.equal(
    text,
    JSON.stringify({
      degraded: [{ ds: 'DS-6', params: { endpoint: e.stub.url }, remedy: REMEDY }],
    }),
  );
  const warn = b.lines.find((l) => l.event === 'snapshot_unreadable');
  assert.ok(warn && warn.event === 'snapshot_unreadable');
  assert.equal(warn.ds, 'DS-6');
  assert.equal(warn.path, e.snapshot.path);
});

test('a non-loopback registry is DS-6 with its endpoint and no remedy key', async () => {
  const e = await env();
  const b = await bridge(e, { registryUrl: 'http://nonexistent.invalid' });
  const { status, text } = await b.get('/v1/project/sidepiece');
  assert.equal(status, 200);
  assert.equal(
    text,
    JSON.stringify({
      degraded: [{ ds: 'DS-6', params: { endpoint: 'http://nonexistent.invalid' } }],
    }),
  );
});

test('a snapshot record whose hash moved since the mint is served with generation 0', async () => {
  const e = await env();
  const b = await bridge(e);
  assert.equal((await b.get('/v1/project/sidepiece')).body.generation, 1);
  const minted = e.store.readResolution('sidepiece');
  // The registry moves sidepiece; a fetch for another pjid rewrites the snapshot, no mint.
  e.stub.projects.sidepiece = { ...e.stub.projects.sidepiece, repoPath: '/srv/moved/sidepiece' };
  await b.get('/v1/project/momo');
  await e.stub.close();
  const { status, body } = await b.get('/v1/project/sidepiece');
  assert.equal(status, 200);
  assert.equal(body.clonePath, '/srv/moved/sidepiece');
  assert.equal(body.generation, 0);
  assert.deepEqual(e.store.readResolution('sidepiece'), minted);
});

test('DS-25 bridge-wide first, then DS-23, the cause, then the on-disk probe', async () => {
  const e = await env();
  const ds25: Degraded = { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } };
  const ds10: Degraded = { ds: 'DS-10', params: { role: 'scrum-master' } };
  const warm = await bridge(e);
  await warm.get('/v1/project/sidepiece');
  await e.stub.close();
  const b = await bridge(e, {
    store: undefined,
    degraded: () => [ds25],
    probePaths: async () => [ds10],
  });
  const { body } = await b.get('/v1/project/sidepiece');
  assert.equal(body.generation, 0);
  assert.deepEqual(
    (body.degraded as Degraded[]).map((d) => d.ds),
    ['DS-25', 'DS-23', 'DS-6', 'DS-10'],
  );
});

test('a mutation never falls back: registry down with a snapshot is DS-6, handler never runs', async () => {
  const e = await env();
  const b = await bridge(e);
  await b.get('/v1/project/sidepiece');
  await e.stub.close();
  const { status, text } = await b.post('/v1/project/sidepiece/fixture', '{"generation":1}');
  assert.equal(status, 200);
  assert.equal(
    text,
    JSON.stringify({
      degraded: [{ ds: 'DS-6', params: { endpoint: e.stub.url }, remedy: REMEDY }],
    }),
  );
  assert.deepEqual(b.invocations, []);
});

test('health: a down registry is DS-6 in degraded, status still ok', async () => {
  const e = await env();
  const b = await bridge(e);
  const up = await b.get('/v1/health');
  assert.deepEqual(up.body.degraded, []);
  await e.stub.close();
  const { status, body } = await b.get('/v1/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
  assert.deepEqual(body.degraded, [
    { ds: 'DS-6', params: { endpoint: e.stub.url }, remedy: REMEDY },
  ]);
  const [registry] = body.dependencies as Record<string, unknown>[];
  assert.equal(registry?.name, 'registry');
  assert.equal(registry?.status, 'failing');
  assert.equal(registry?.ds, 'DS-6');
  assert.ok(!('detail' in (registry ?? {})));
});

test('the mutation guard writes the snapshot too: currentProject passes it', async () => {
  const e = await env();
  const b = await bridge(e);
  const started = new Date().toISOString();
  assert.throws(() => readFileSync(e.snapshot.path));
  // Generation 1 is what the guard's own fresh resolution mints, so the POST is current.
  const { status, body } = await b.post('/v1/project/sidepiece/fixture', '{"generation":1}');
  assert.equal(status, 200);
  assert.deepEqual(body, { fixture: 'ok' });
  assert.deepEqual(b.invocations, ['sidepiece']);
  const copy = JSON.parse(readFileSync(e.snapshot.path, 'utf8')) as { fetchedAt: string };
  assert.ok(copy.fetchedAt >= started, `${copy.fetchedAt} >= ${started}`);
});
