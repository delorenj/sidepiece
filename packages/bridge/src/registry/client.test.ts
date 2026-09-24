import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { after, before, test } from 'node:test';
import {
  BOARDLESS,
  fixtureProjects,
  PJID_KEY,
  registryEntry,
  SIDEPIECE_BOARD,
  type StubRegistry,
  startStubRegistry,
} from '../../test/stub-registry.ts';
import { DegradedError } from '../server/errors.ts';
import {
  deriveRecord,
  indexRegistry,
  REGISTRY_TIMEOUT_MS,
  RegistryUnparseable,
  RegistryUnreachable,
  registryFailure,
  resolveProject,
} from './client.ts';

let stub: StubRegistry;
before(async () => {
  stub = await startStubRegistry();
});
after(() => stub.close());

async function degradedOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    assert.ok(err instanceof DegradedError, String(err));
    return err.degraded;
  }
  assert.fail('expected a DegradedError');
}

test('the registry timeout is 2s', () => {
  assert.equal(REGISTRY_TIMEOUT_MS, 2_000);
});

test('sidepiece resolves to the derived record, agents sorted by id', async () => {
  stub.projects = fixtureProjects();
  assert.deepEqual(await resolveProject(stub.url, 'sidepiece'), {
    pjid: 'sidepiece',
    repo: 'sidepiece',
    clonePath: '/home/delorenj/code/sidepiece',
    boardId: SIDEPIECE_BOARD,
    agents: [
      { id: 'sidepiece-pm', role: 'pm', roleDir: 'agents/hermes/pm' },
      { id: 'sidepiece-scrum-master', role: 'scrum-master', roleDir: 'agents/hermes/scrum-master' },
    ],
    ticketProvider: { type: 'plane' },
  });
});

test('one fetch of the whole registry per resolution, and no cache', async () => {
  stub.projects = fixtureProjects();
  const before = stub.requests;
  await resolveProject(stub.url, 'sidepiece');
  await resolveProject(stub.url, 'sidepiece');
  assert.equal(stub.requests, before + 2);
  stub.projects.sidepiece = { ...stub.projects.sidepiece, repoPath: '/srv/renamed' };
  assert.equal((await resolveProject(stub.url, 'sidepiece'))?.repo, 'renamed');
});

test('every entry is indexed, with no hardcoded count', () => {
  const projects: Record<string, unknown> = {};
  for (let i = 0; i < 23; i++) projects[`p${i}`] = registryEntry(`p${i}`, { repoPath: `/r/${i}` });
  assert.equal(indexRegistry({ projects }).size, 23);
});

test('the index is keyed by the identifier field, renamed to pjid', () => {
  const entry = { ...registryEntry('real', { repoPath: '/r/real' }), [PJID_KEY]: 'real' };
  const index = indexRegistry({ projects: { 'some-other-key': entry } });
  assert.deepEqual([...index.keys()], ['real']);
});

test('lookup is byte for byte: case, whitespace and escapes are not normalised', async () => {
  stub.projects = fixtureProjects();
  for (const variant of ['Sidepiece', 'sidepiece ', ' sidepiece', 'SIDEPIECE', 'side%70iece']) {
    assert.equal(await resolveProject(stub.url, variant), undefined, variant);
  }
  assert.equal(await resolveProject(stub.url, 'not-a-real-pjid'), undefined);
});

test('the four boardless Projects: boardId is "", which a null check or `in` calls a board', async () => {
  stub.projects = fixtureProjects();
  for (const pjid of BOARDLESS) {
    const record = await resolveProject(stub.url, pjid);
    assert.ok(record, pjid);
    assert.equal(record.boardId, '', pjid);
    // Why presence is tested by truthiness only: the other two tests both say "has a board".
    assert.equal(record.boardId !== null, true, pjid);
    assert.equal('boardId' in record, true, pjid);
    assert.equal(Boolean(record.boardId), false, pjid);
    assert.deepEqual(record.agents, [], pjid);
  }
});

test('missing ticket_provider fields default to empty strings, never null', () => {
  const entry = { [PJID_KEY]: 'x', repo_path: '/r/x', ticket_provider: { type: 7 } };
  assert.deepEqual(deriveRecord('x', entry), {
    pjid: 'x',
    repo: 'x',
    clonePath: '/r/x',
    boardId: '',
    agents: [],
    ticketProvider: { type: '' },
  });
  assert.equal(deriveRecord('x', { repo_path: '/r/x' }).ticketProvider.type, '');
});

test('a requested entry without a non-empty repo_path is DS-7', async () => {
  for (const repoPath of ['', undefined, 42, null]) {
    stub.projects = { broken: { repoPath } };
    const d = await degradedOf(resolveProject(stub.url, 'broken'));
    assert.equal(d.ds, 'DS-7', String(repoPath));
    assert.equal(typeof d.params?.error, 'string');
  }
  // Only the requested entry is judged.
  stub.projects = { ...fixtureProjects(), broken: { repoPath: '' } };
  assert.ok(await resolveProject(stub.url, 'sidepiece'));
});

test('a non-2xx answer is DS-7 with the status line verbatim', async () => {
  stub.override = { status: 500, body: '{}' };
  try {
    assert.deepEqual(await degradedOf(resolveProject(stub.url, 'sidepiece')), {
      ds: 'DS-7',
      params: { error: '500 Internal Server Error' },
    });
  } finally {
    stub.override = undefined;
  }
});

test('an unparseable body is DS-7 with the parse error verbatim', async () => {
  let expected = '';
  try {
    JSON.parse('not json');
  } catch (err) {
    expected = (err as Error).message;
  }
  stub.override = { status: 200, body: 'not json' };
  try {
    assert.deepEqual(await degradedOf(resolveProject(stub.url, 'sidepiece')), {
      ds: 'DS-7',
      params: { error: expected },
    });
    stub.override = { status: 200, body: '{"projects":[]}' };
    assert.equal((await degradedOf(resolveProject(stub.url, 'sidepiece'))).ds, 'DS-7');
  } finally {
    stub.override = undefined;
  }
});

test('a refused connection is DS-6 with the registry URL as endpoint', async () => {
  const probe = createServer();
  await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = (probe.address() as { port: number }).port;
  await new Promise((resolve) => probe.close(resolve));
  const url = `http://127.0.0.1:${port}`;
  assert.deepEqual(await degradedOf(resolveProject(url, 'sidepiece')), {
    ds: 'DS-6',
    params: { endpoint: url },
  });
});

test('the discriminator: unreachable is DS-6, unparseable is DS-7, anything else is not mine', () => {
  assert.deepEqual(registryFailure(new RegistryUnreachable('x'), 'http://r'), {
    ds: 'DS-6',
    params: { endpoint: 'http://r' },
  });
  assert.deepEqual(registryFailure(new RegistryUnparseable('502 Bad Gateway'), 'http://r'), {
    ds: 'DS-7',
    params: { error: '502 Bad Gateway' },
  });
  assert.equal(registryFailure(new Error('bug'), 'http://r'), undefined);
  assert.equal(registryFailure('x', 'http://r'), undefined);
});
