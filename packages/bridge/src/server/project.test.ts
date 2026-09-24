import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
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
import { REGISTRY_TIMEOUT_MS } from '../registry/client.ts';
import { probePaths } from '../registry/paths.ts';
import { openStore, type TurnStore } from '../turns/store.ts';
import { createBridgeServer, HANDLER_DEADLINE_MS } from './http.ts';
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

/**
 * A Bridge on an ephemeral port with only the project routes; `get` fetches a path. The
 * on-disk probe is a no-op unless the test passes one, so record-shape asserts never depend
 * on `/home/delorenj/code/*` existing on the test host.
 */
async function bridge(options: Partial<ProjectRoutesOptions> = {}, handlerDeadlineMs?: number) {
  const lines: LogLine[] = [];
  const log = (l: LogLine) => lines.push(l);
  const routes = projectRoutes({
    registryUrl: stub.url,
    store,
    log,
    probePaths: async () => [],
    ...options,
  });
  const server = createBridgeServer({
    startedAt: new Date().toISOString(),
    routes,
    log,
    ...(handlerDeadlineMs !== undefined ? { handlerDeadlineMs } : {}),
  });
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

for (const hang of ['no-response', 'stall-body'] as const) {
  test(`a registry that accepts and then stalls (${hang}) is DS-6 at the registry timeout`, async () => {
    stub.projects = fixtureProjects();
    // Well under the default 10s deadline; a lost registry timeout would answer 500 here.
    const deadline = 4_000;
    assert.ok(REGISTRY_TIMEOUT_MS < deadline && deadline < HANDLER_DEADLINE_MS);
    const b = await bridge({}, deadline);
    stub.hang = hang;
    try {
      const started = performance.now();
      const { status, text } = await b.get('/v1/project/sidepiece');
      const elapsed = performance.now() - started;
      assert.equal(status, 200);
      assert.equal(
        text,
        JSON.stringify({ degraded: [{ ds: 'DS-6', params: { endpoint: stub.url } }] }),
      );
      assert.ok(elapsed >= REGISTRY_TIMEOUT_MS - 50, `answered after ${elapsed}ms`);
      assert.ok(elapsed < deadline - 500, `answered after ${elapsed}ms`);
      assert.ok(!b.lines.some((l) => l.event === 'handler_timed_out'));
    } finally {
      stub.hang = undefined;
      await b.close();
    }
  });
}

/** A mkdtemp clone mirroring this repo: `agents/hermes/pm` present, `scrum-master` absent. */
function sidepieceClone(): string {
  const clone = join(stateDir, `clone-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(clone, 'agents/hermes/pm'), { recursive: true });
  return clone;
}

test('the real probe: a clone mirroring this repo serves the full record plus exactly DS-10', async () => {
  const clone = sidepieceClone();
  stub.projects = fixtureProjects();
  stub.projects.sidepiece = { ...stub.projects.sidepiece, repoPath: clone };
  const b = await bridge({ probePaths });
  try {
    const { status, text, body } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.deepEqual(body, {
      pjid: 'sidepiece',
      generation: body.generation,
      repo: clone.split('/').at(-1),
      clonePath: clone,
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
      degraded: [
        {
          ds: 'DS-10',
          params: {
            agent: 'sidepiece-scrum-master',
            roleDir: `${clone}/agents/hermes/scrum-master`,
          },
        },
      ],
    });
    assert.ok(text.includes(`"degraded":[{"ds":"DS-10","params":{"agent":`), 'key order');
    assert.ok(!text.includes('remedy'));
    assert.ok(!text.includes('DS-20'));
    assert.ok(!b.lines.some((l) => l.event === 'degraded'), 'not a warn: the record is served');
  } finally {
    await b.close();
  }
});

test('the real probe: a missing pm roleDir is DS-20', async () => {
  const clone = sidepieceClone();
  mkdirSync(join(clone, 'agents/hermes/scrum-master'), { recursive: true });
  stub.projects = fixtureProjects();
  stub.projects.sidepiece = {
    repoPath: clone,
    boardId: SIDEPIECE_BOARD,
    agents: {
      'sidepiece-pm': { role: 'pm', roleDir: 'agents/hermes/not-here' },
      'sidepiece-scrum-master': { role: 'scrum-master', roleDir: 'agents/hermes/scrum-master' },
    },
  };
  const b = await bridge({ probePaths });
  try {
    const { status, body } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.deepEqual(body.degraded, [
      { ds: 'DS-20', params: { pm: 'sidepiece-pm', roleDir: `${clone}/agents/hermes/not-here` } },
    ]);
  } finally {
    await b.close();
  }
});

test('the real probe: a missing clone is DS-9 with the full path, and is not created', async () => {
  const clone = join(stateDir, 'no', 'such', 'clone');
  stub.projects = fixtureProjects();
  stub.projects.sidepiece = { ...stub.projects.sidepiece, repoPath: clone };
  const b = await bridge({ probePaths });
  try {
    const { status, body } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.equal(body.clonePath, clone);
    assert.deepEqual(body.degraded, [
      { ds: 'DS-9', params: { path: clone } },
      { ds: 'DS-20', params: { pm: 'sidepiece-pm', roleDir: `${clone}/agents/hermes/pm` } },
      {
        ds: 'DS-10',
        params: { agent: 'sidepiece-scrum-master', roleDir: `${clone}/agents/hermes/scrum-master` },
      },
    ]);
    assert.ok(!existsSync(join(stateDir, 'no')), 'the probe never creates anything');
  } finally {
    await b.close();
  }
});

test('the real probe: Bridge-wide DS-25 comes first, then DS-10; the record is still served', async () => {
  const clone = sidepieceClone();
  stub.projects = fixtureProjects();
  stub.projects.sidepiece = { ...stub.projects.sidepiece, repoPath: clone };
  const ds25: Degraded = { ds: 'DS-25', params: { storeVersion: '9', bridgeVersion: '1' } };
  const b = await bridge({ store: undefined, degraded: () => [ds25], probePaths });
  try {
    const { status, body } = await b.get('/v1/project/sidepiece');
    assert.equal(status, 200);
    assert.equal(body.pjid, 'sidepiece');
    assert.equal(body.generation, 0);
    assert.deepEqual(body.degraded, [
      ds25,
      {
        ds: 'DS-10',
        params: { agent: 'sidepiece-scrum-master', roleDir: `${clone}/agents/hermes/scrum-master` },
      },
    ]);
    assert.ok(!b.lines.some((l) => l.event === 'degraded'), 'no warn line');
  } finally {
    await b.close();
  }
});

test('an unknown pjid never calls the probe', async () => {
  stub.projects = fixtureProjects();
  let calls = 0;
  const b = await bridge({
    probePaths: async (r) => {
      calls++;
      return probePaths(r);
    },
  });
  try {
    const { text } = await b.get('/v1/project/nope');
    assert.equal(text, JSON.stringify({ degraded: [{ ds: 'DS-2', params: { pjid: 'nope' } }] }));
    assert.equal(calls, 0);
  } finally {
    await b.close();
  }
});
