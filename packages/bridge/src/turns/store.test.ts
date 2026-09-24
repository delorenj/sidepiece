import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import m001 from '../db/migrations/001_resolutions.sql';
import { BRIDGE_STORE_VERSION, openStore, type StoreOpen, type TurnStore } from './store.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function tempRoot(): string {
  const d = mkdtempSync(join(tmpdir(), 'sidepiece-store-'));
  dirs.push(d);
  return d;
}

function ready(opened: StoreOpen): TurnStore {
  assert.equal(opened.kind, 'ready');
  return (opened as Extract<StoreOpen, { kind: 'ready' }>).store;
}

/** What `sqlite3 turns.db 'PRAGMA user_version = n'` leaves on disk: big-endian int32 at offset 60. */
function forceUserVersion(file: string, n: number) {
  const bytes = readFileSync(file);
  bytes.writeInt32BE(n, 60);
  writeFileSync(file, bytes);
}

test('BRIDGE_STORE_VERSION is the number of migrations this build carries', () => {
  assert.equal(BRIDGE_STORE_VERSION, 1);
});

test('an absent state dir is created 0700, with turns.db at user_version 1 holding only resolutions', () => {
  const stateDir = join(tempRoot(), 'nested', 'state');
  const opened = openStore(stateDir);
  const store = ready(opened);
  try {
    assert.equal((opened as { migratedFrom: number }).migratedFrom, 0);
    assert.equal(statSync(stateDir).mode & 0o777, 0o700);
    assert.equal(store.path, join(stateDir, 'turns.db'));
    assert.equal(store.userVersion(), 1);
    assert.deepEqual(
      store.inspect().tables.map((t) => t.name),
      ['resolutions'],
    );
  } finally {
    store.close();
  }
  assert.deepEqual(readdirSync(stateDir), ['turns.db'], 'a clean close leaves no -wal/-shm');
});

test('a restart at v1 runs no migration and leaves the file byte-identical', () => {
  const stateDir = tempRoot();
  ready(openStore(stateDir)).close();
  const file = join(stateDir, 'turns.db');
  const before = readFileSync(file);
  const opened = openStore(stateDir);
  const store = ready(opened);
  assert.equal((opened as { migratedFrom: number }).migratedFrom, 1);
  assert.equal(store.userVersion(), 1);
  assert.deepEqual(
    store.inspect().tables.map((t) => t.name),
    ['resolutions'],
  );
  store.close();
  assert.deepEqual(readFileSync(file), before);
});

for (const version of [9, -1]) {
  test(`a store at user_version ${version} is ahead: nothing read, migrated or written`, () => {
    const stateDir = tempRoot();
    ready(openStore(stateDir)).close();
    const file = join(stateDir, 'turns.db');
    forceUserVersion(file, version);
    const before = readFileSync(file);
    const opened = openStore(stateDir);
    assert.deepEqual(opened, {
      kind: 'ahead',
      path: file,
      storeVersion: version,
      bridgeVersion: BRIDGE_STORE_VERSION,
    });
    assert.deepEqual(readFileSync(file), before, 'the DB file is byte-identical');
    assert.deepEqual(readdirSync(stateDir), ['turns.db']);
  });
}

test('a failing migration rolls back: user_version unchanged, no partial objects, openStore throws', () => {
  const stateDir = tempRoot();
  ready(openStore(stateDir)).close();
  const bad = 'CREATE TABLE partials (a TEXT); CREATE TABLE (';
  assert.throws(() => openStore(stateDir, { migrations: [m001, bad] }));
  const store = ready(openStore(stateDir));
  try {
    assert.equal(store.userVersion(), 1);
    assert.deepEqual(
      store.inspect().tables.map((t) => t.name),
      ['resolutions'],
    );
  } finally {
    store.close();
  }
});

test('a failing first migration on a fresh store leaves user_version 0 and no tables', () => {
  const stateDir = tempRoot();
  assert.throws(() =>
    openStore(stateDir, { migrations: ['CREATE TABLE ok (a); SELECT nope FROM missing'] }),
  );
  assert.ok(existsSync(join(stateDir, 'turns.db')));
  const store = ready(openStore(stateDir, { migrations: [] }));
  try {
    assert.equal(store.userVersion(), 0);
    assert.deepEqual(store.inspect().tables, []);
  } finally {
    store.close();
  }
});

test('each migration advances user_version by exactly 1', () => {
  const stateDir = tempRoot();
  const store = ready(openStore(stateDir, { migrations: [m001, 'CREATE TABLE seconds (a TEXT)'] }));
  try {
    assert.equal(store.userVersion(), 2);
  } finally {
    store.close();
  }
  // And this build (one migration) now sees that store as ahead.
  const opened = openStore(stateDir);
  assert.equal(opened.kind, 'ahead');
});
