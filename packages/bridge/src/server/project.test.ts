import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import type { Degraded } from '@sidepiece/contract';
import {
  fixtureProjects,
  SIDEPIECE_BOARD,
  type StubRegistry,
  startStubRegistry,
} from '../../test/stub-registry.ts';
import type { LogLine } from '../log.ts';
import { openStore, type TurnStore } from '../turns/store.ts';
import { createBridgeServer } from './http.ts';
import { type ProjectRoutesOptions, projectRoutes } from './project.ts';

let stub: StubRegistry;
let stateDir: string;
let store: TurnStore;
before(async () => {
  stub = await startStubRegistry();
  stateDir = mkdtempSync(join(tmpdir(), 'sidepiece-project-'));
  const opened = openStore(stateDir);
  assert.equal(opened.kind, 'ready');
  store = (opened as Extract<typeof opened, { kind: 'ready' }>).store;
});
after(async () => {
  store.close();
  rmSync(stateDir, { recursive: true, force: true });
  await stub.close();
});

/** A Bridge on an ephemeral port with only the project routes; `get` fetches a path. */
async function bridge(options: Partial<ProjectRoutesOptions> = {}) {
  const lines: LogLine[] = [];
  const log = (l: LogLine) => lines.push(l);
  const routes = projectRoutes({ registryUrl: stub.url, store, log, ...options });
  const server = createBridgeServer({ startedAt: new Date().toISOString(), routes, log });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    routes,
    lines,
    get: async (path: string) => {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(5_000) });
      const text = await res.text();
      return { status: res.status, text, body: JSON.parse(text) as Record<string, unknown> };
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test('a known pjid is 200 with the unwrapped record, in key order, generation 1', async () => {
  stub.projects = fixtureProjects();
  const b = await bridge();
  try {
    const { status, body } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.deepEqual(Object.keys(body), [
      'pjid',
      'generation',
      'repo',
      'clonePath',
      'boardId',
      'agents',
      'ticketProvider',
      'degraded',
    ]);
    assert.deepEqual(body, {
      pjid: 'sidepiece',
      generation: 1,
      repo: 'sidepiece',
      clonePath: '/home/delorenj/code/sidepiece',
      boardId: SIDEPIECE_BOARD,
      agents: [
        { id: 'sidepiece-pm', role: 'pm', roleDir: 'agents/hermes/pm' },
        {
          id: 'sidepiece-scrum-master',
          role: 'scrum-master',
          roleDir: 'agents/hermes/scrum-master',
        },
      ],
      ticketProvider: { type: 'plane' },
      degraded: [],
    });
    const resolved = b.lines.find((l) => l.event === 'resolved');
    assert.deepEqual(resolved && { ...resolved }, {
      level: 'info',
      event: 'resolved',
      pjid: 'sidepiece',
      generation: 1,
      minted: true,
    });
    // Re-resolution is not an event.
    assert.equal((await b.get('/v1/project/sidepiece')).body.generation, 1);
    assert.equal(b.lines.filter((l) => l.event === 'resolved').at(-1)?.minted, false);
  } finally {
    await b.close();
  }
});

test('a renamed repo advances the generation on the wire', async () => {
  stub.projects = fixtureProjects();
  const b = await bridge();
  try {
    const first = (await b.get('/v1/project/momo')).body.generation as number;
    stub.projects.momo = { repoPath: '/home/delorenj/code/momo-renamed' };
    const { body } = await b.get('/v1/project/momo');
    assert.equal(body.generation, first + 1);
    assert.equal(body.repo, 'momo-renamed');
    assert.equal(body.boardId, '', 'a boardless Project is "", never null');
  } finally {
    await b.close();
  }
});

test('an unknown pjid, or a case variant, is 200 with exactly the DS-2 body', async () => {
  stub.projects = fixtureProjects();
  const b = await bridge();
  try {
    for (const pjid of ['not-a-real-pjid', 'Sidepiece']) {
      const { status, text } = await b.get(`/v1/project/${pjid}`);
      assert.equal(status, 200);
      assert.equal(text, JSON.stringify({ degraded: [{ ds: 'DS-2', params: { pjid } }] }));
      const warn = b.lines.findLast((l) => l.event === 'degraded');
      assert.equal(warn?.level, 'warn');
      assert.equal(warn?.pjid, pjid);
    }
    assert.equal(store.readResolution('not-a-real-pjid'), undefined, 'nothing minted');
  } finally {
    await b.close();
  }
});

test('the path segment is decoded once; a malformed escape is 404 not_found', async () => {
  stub.projects = { 'a b': { repoPath: '/r/a b' }, ...fixtureProjects() };
  const b = await bridge();
  try {
    assert.equal((await b.get('/v1/project/a%20b')).body.pjid, 'a b');
    const bad = await b.get('/v1/project/%E0%A4%A');
    assert.equal(bad.status, 404);
    assert.deepEqual(bad.body, { error: 'not_found', path: '/v1/project/%E0%A4%A' });
    assert.equal((await b.get('/v1/project/')).status, 404);
  } finally {
    await b.close();
  }
});

test('registry down is 200 DS-6, a registry error is 200 DS-7; never a 5xx', async () => {
  const down = await bridge({ registryUrl: 'http://127.0.0.1:1' });
  try {
    const { status, body } = await down.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.deepEqual(body, {
      degraded: [{ ds: 'DS-6', params: { endpoint: 'http://127.0.0.1:1' } }],
    });
    assert.equal(down.lines.findLast((l) => l.event === 'degraded')?.pjid, 'sidepiece');
  } finally {
    await down.close();
  }
  const b = await bridge();
  stub.override = { status: 500, body: 'oops' };
  try {
    const { status, body } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.deepEqual(body, {
      degraded: [{ ds: 'DS-7', params: { error: '500 Internal Server Error' } }],
    });
  } finally {
    stub.override = undefined;
    await b.close();
  }
});

test('DS-25 (no store): the record is served with generation 0 and the DS-25 entry', async () => {
  stub.projects = fixtureProjects();
  const ds25: Degraded = { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } };
  const b = await bridge({ store: undefined, degraded: () => [ds25] });
  try {
    const { status, body } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.equal(body.generation, 0);
    assert.equal(body.pjid, 'sidepiece');
    assert.deepEqual(body.degraded, [ds25]);
    assert.ok(!b.lines.some((l) => l.event === 'degraded'), 'not a warn: the record is served');
  } finally {
    await b.close();
  }
});

test('every /v1/project/:pjid… route returns a top-level numeric generation', async () => {
  stub.projects = fixtureProjects();
  const b = await bridge();
  try {
    const patterns = Object.keys(b.routes).filter((p) => p.startsWith('/v1/project/:pjid'));
    assert.ok(patterns.length > 0);
    for (const pattern of patterns) {
      const { body } = await b.get(pattern.replace(':pjid', 'sidepiece'));
      assert.equal(typeof body.generation, 'number', pattern);
      assert.ok((body.generation as number) >= 1, pattern);
    }
  } finally {
    await b.close();
  }
});
