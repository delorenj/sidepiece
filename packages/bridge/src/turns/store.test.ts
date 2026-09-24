import assert from 'node:assert/strict';
import {
  copyFileSync,
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
    // The read-only probe may leave -wal/-shm beside an ahead store; nothing else appears.
    assert.deepEqual(
      readdirSync(stateDir).filter((f) => !/^turns\.db-(wal|shm)$/.test(f)),
      ['turns.db'],
    );
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

test('a store at v9 only in its -wal is ahead, and the main file is not checkpointed', () => {
  // Nine migrations applied with the handle still open: every page, including the header
  // carrying user_version 9, is in turns.db-wal; the main file still says 0. Copying both
  // files is the on-disk state a crashed newer Bridge leaves.
  const writer = tempRoot();
  const nine = Array.from({ length: 9 }, (_, i) => `CREATE TABLE t${i} (a TEXT)`);
  const open = ready(openStore(writer, { migrations: nine }));
  const stateDir = tempRoot();
  try {
    copyFileSync(join(writer, 'turns.db'), join(stateDir, 'turns.db'));
    copyFileSync(join(writer, 'turns.db-wal'), join(stateDir, 'turns.db-wal'));
  } finally {
    open.close();
  }
  const file = join(stateDir, 'turns.db');
  const before = readFileSync(file);
  assert.equal(before.readInt32BE(60), 0, 'the version lives only in the WAL');
  assert.ok(readFileSync(`${file}-wal`).length > 0);
  assert.deepEqual(openStore(stateDir), {
    kind: 'ahead',
    path: file,
    storeVersion: 9,
    bridgeVersion: BRIDGE_STORE_VERSION,
  });
  assert.deepEqual(readFileSync(file), before, 'the main file is byte-identical');
});

test('a second open of a fresh store finds v1 and migrates nothing', () => {
  const stateDir = tempRoot();
  const first = openStore(stateDir);
  const second = openStore(stateDir);
  try {
    assert.equal((first as { migratedFrom: number }).migratedFrom, 0);
    assert.equal((second as { migratedFrom: number }).migratedFrom, 1);
    assert.equal(ready(second).userVersion(), 1);
  } finally {
    ready(first).close();
    ready(second).close();
  }
});

test('a step another process applied between the version read and BEGIN is skipped, not re-run', () => {
  const stateDir = tempRoot();
  let steps = 0;
  // 001 is not idempotent (a bare CREATE TABLE), so re-running it would throw.
  const opened = openStore(stateDir, {
    beforeStep: () => {
      if (steps++ === 0) ready(openStore(stateDir)).close();
    },
  });
  const store = ready(opened);
  try {
    assert.equal((opened as { migratedFrom: number }).migratedFrom, 0);
    assert.equal(store.userVersion(), 1);
    assert.deepEqual(
      store.inspect().tables.map((t) => t.name),
      ['resolutions'],
    );
  } finally {
    store.close();
  }
});

test('an upgrade from v1 applies only the new step', () => {
  const stateDir = tempRoot();
  ready(openStore(stateDir)).close();
  const opened = openStore(stateDir, {
    migrations: [m001, 'CREATE INDEX resolutions_generation ON resolutions (generation)'],
  });
  const store = ready(opened);
  try {
    assert.equal((opened as { migratedFrom: number }).migratedFrom, 1);
    assert.equal(store.userVersion(), 2);
    assert.ok(store.inspect().objects.some((o) => o.name === 'resolutions_generation'));
  } finally {
    store.close();
  }
});

test('a missing or empty migration throws "migration N missing" and does not advance', () => {
  for (const migrations of [
    [m001, ''],
    [m001, '   \n'],
    [m001, undefined as unknown as string],
  ]) {
    const stateDir = tempRoot();
    assert.throws(() => openStore(stateDir, { migrations }), /migration 2 missing/);
    const store = ready(openStore(stateDir));
    try {
      assert.equal(store.userVersion(), 1);
    } finally {
      store.close();
    }
  }
});

test('a migration that ends its own transaction still reports its own error', () => {
  const stateDir = tempRoot();
  // COMMIT inside the step closes the transaction; the next statement fails. The ROLLBACK
  // guard must not mask that failure with "no transaction is active".
  assert.throws(
    () => openStore(stateDir, { migrations: ['COMMIT; SELECT nope FROM missing'] }),
    /no such table: missing/,
  );
});

function resolution(pjid: string, generation = 1) {
  return {
    pjid,
    generation,
    recordHash: 'a'.repeat(64),
    resolvedAt: '2026-09-24T00:00:00.000Z',
    clonePath: `/home/x/code/${pjid}`,
    boardId: '',
  };
}

test('resolutions round-trip camelCase in and out, and a write replaces the row', () => {
  const store = ready(openStore(tempRoot()));
  try {
    assert.equal(store.readResolution('sidepiece'), undefined);
    store.writeResolution(resolution('sidepiece'));
    assert.deepEqual(store.readResolution('sidepiece'), resolution('sidepiece'));
    store.writeResolution({ ...resolution('sidepiece', 2), boardId: 'b' });
    assert.deepEqual(store.readResolution('sidepiece'), {
      ...resolution('sidepiece', 2),
      boardId: 'b',
    });
    assert.equal(store.readResolution('Sidepiece'), undefined, 'no normalisation');
  } finally {
    store.close();
  }
});

test('DW-3: an empty or non-string pjid is refused before it reaches SQLite', () => {
  const store = ready(openStore(tempRoot()));
  try {
    for (const bad of ['', null, undefined, 7] as unknown[]) {
      assert.throws(() => store.readResolution(bad as string), TypeError);
      assert.throws(
        () => store.writeResolution({ ...resolution('x'), pjid: bad as string }),
        TypeError,
      );
    }
    assert.equal(store.readResolution('x'), undefined, 'nothing was written');
  } finally {
    store.close();
  }
});

test('transaction commits on return and rolls back on throw', () => {
  const store = ready(openStore(tempRoot()));
  try {
    assert.equal(
      store.transaction(() => {
        store.writeResolution(resolution('a'));
        return 42;
      }),
      42,
    );
    assert.throws(
      () =>
        store.transaction(() => {
          store.writeResolution(resolution('b'));
          throw new Error('abort');
        }),
      /abort/,
    );
    assert.ok(store.readResolution('a'));
    assert.equal(store.readResolution('b'), undefined, 'rolled back');
    // Usable again after a rollback.
    store.transaction(() => store.writeResolution(resolution('c')));
    assert.ok(store.readResolution('c'));
  } finally {
    store.close();
  }
});
