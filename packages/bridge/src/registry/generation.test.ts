import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { openStore, type TurnStore } from '../turns/store.ts';
import type { DerivedRecord } from './client.ts';
import { mintGeneration, recordHash } from './generation.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const c of cleanups.splice(0)) c();
});

function freshStore(): TurnStore {
  const dir = mkdtempSync(join(tmpdir(), 'sidepiece-gen-'));
  const opened = openStore(dir);
  assert.equal(opened.kind, 'ready');
  const { store } = opened as Extract<typeof opened, { kind: 'ready' }>;
  cleanups.push(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  return store;
}

/** Counts writes, so "no write" is observed rather than inferred. */
function counting(store: TurnStore) {
  let writes = 0;
  return {
    get writes() {
      return writes;
    },
    store: {
      readResolution: store.readResolution,
      transaction: store.transaction,
      writeResolution: (row: Parameters<TurnStore['writeResolution']>[0]) => {
        writes++;
        store.writeResolution(row);
      },
    },
  };
}

const sidepiece = (): DerivedRecord => ({
  pjid: 'sidepiece',
  repo: 'sidepiece',
  clonePath: '/home/delorenj/code/sidepiece',
  boardId: '96725b78-df0b-436a-8b45-c871264fe25d',
  agents: [
    { id: 'sidepiece-pm', role: 'pm', roleDir: 'agents/hermes/pm' },
    { id: 'sidepiece-scrum-master', role: 'scrum-master', roleDir: 'agents/hermes/scrum-master' },
  ],
  ticketProvider: { type: 'plane' },
});

test('recordHash is lowercase hex sha256', () => {
  assert.match(recordHash(sidepiece()), /^[0-9a-f]{64}$/);
});

test('pjid, generation and resolved_at are outside the hash; agent order is too', () => {
  const base = recordHash(sidepiece());
  const extra = { ...sidepiece(), pjid: 'other', generation: 99, resolvedAt: 'now' };
  assert.equal(recordHash(extra), base);
  const reversed = { ...sidepiece(), agents: [...sidepiece().agents].reverse() };
  assert.equal(recordHash(reversed), base);
});

test('every hashed field moves the hash', () => {
  const base = recordHash(sidepiece());
  const changes: Partial<DerivedRecord>[] = [
    { repo: 'x' },
    { clonePath: '/x' },
    { boardId: '' },
    { ticketProvider: { type: 'trello' } },
    { agents: [] },
    { agents: [{ id: 'sidepiece-pm', role: 'pm', roleDir: 'agents/hermes/pm2' }] },
  ];
  for (const change of changes) {
    assert.notEqual(recordHash({ ...sidepiece(), ...change }), base, JSON.stringify(change));
  }
});

test('first mint is 1; ×20 unchanged keeps 1 with no write and a byte-identical row', () => {
  const store = freshStore();
  const c = counting(store);
  assert.deepEqual(mintGeneration(c.store, sidepiece()), { generation: 1, minted: true });
  const row = store.readResolution('sidepiece');
  assert.ok(row);
  assert.equal(row.recordHash, recordHash(sidepiece()));
  assert.equal(row.clonePath, '/home/delorenj/code/sidepiece');
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(mintGeneration(c.store, sidepiece()), { generation: 1, minted: false });
  }
  assert.equal(c.writes, 1);
  assert.deepEqual(store.readResolution('sidepiece'), row);
});

test('a rename advances to 2 and changes the hash', () => {
  const store = freshStore();
  mintGeneration(store, sidepiece());
  const before = store.readResolution('sidepiece');
  const renamed = {
    ...sidepiece(),
    repo: 'sidepiece2',
    clonePath: '/home/delorenj/code/sidepiece2',
  };
  assert.deepEqual(mintGeneration(store, renamed), { generation: 2, minted: true });
  const after = store.readResolution('sidepiece');
  assert.notEqual(after?.recordHash, before?.recordHash);
  assert.equal(after?.clonePath, '/home/delorenj/code/sidepiece2');
});

test('a Project that leaves and re-enters changed continues from its high-water mark', () => {
  const store = freshStore();
  mintGeneration(store, sidepiece());
  mintGeneration(store, { ...sidepiece(), clonePath: '/a', repo: 'a' });
  // It left the registry (nothing is minted, nothing deleted), then came back elsewhere.
  const back = mintGeneration(store, { ...sidepiece(), clonePath: '/b', repo: 'b' });
  assert.deepEqual(back, { generation: 3, minted: true });
  // Even back at its original content, a generation is never reused.
  assert.equal(mintGeneration(store, sidepiece()).generation, 4);
});

test('generations are per pjid', () => {
  const store = freshStore();
  mintGeneration(store, sidepiece());
  mintGeneration(store, { ...sidepiece(), repo: 'x' });
  assert.equal(mintGeneration(store, { ...sidepiece(), pjid: 'momo' }).generation, 1);
});
