import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { BRIDGE_STORE_VERSION, openStore, type StoreOpen, type TableInfo } from '../turns/store.ts';
import schemaSql from './schema.sql';

const root = mkdtempSync(join(tmpdir(), 'sidepiece-schema-'));
after(() => rmSync(root, { recursive: true, force: true }));

function inspectOf(dir: string, migrations?: readonly string[]) {
  const opened: StoreOpen = openStore(join(root, dir), migrations ? { migrations } : {});
  assert.equal(opened.kind, 'ready');
  const store = (opened as Extract<StoreOpen, { kind: 'ready' }>).store;
  try {
    return store.inspect();
  } finally {
    store.close();
  }
}

const migratedSchema = inspectOf('migrated');
const migrated: TableInfo[] = migratedSchema.tables;

test('001 creates exactly resolutions, with exactly these columns', () => {
  assert.deepEqual(
    migrated.map((t) => t.name),
    ['resolutions'],
  );
  assert.deepEqual(migrated[0]?.columns, [
    { name: 'pjid', type: 'TEXT', notNull: false, primaryKey: true },
    { name: 'generation', type: 'INTEGER', notNull: true, primaryKey: false },
    { name: 'record_hash', type: 'TEXT', notNull: true, primaryKey: false },
    { name: 'resolved_at', type: 'TEXT', notNull: true, primaryKey: false },
    { name: 'clone_path', type: 'TEXT', notNull: false, primaryKey: false },
    { name: 'board_id', type: 'TEXT', notNull: false, primaryKey: false },
  ]);
});

test('every timestamp column is TEXT (ISO-8601 UTC), never an INTEGER epoch', () => {
  for (const table of migrated) {
    for (const c of table.columns.filter((c) => /_at$/.test(c.name))) {
      assert.equal(c.type, 'TEXT', `${table.name}.${c.name}`);
    }
  }
});

test('no table this story must not create exists', () => {
  const names = migrated.map((t) => t.name);
  for (const forbidden of ['turns', 'dispatches', 'ticket_creates', 'registry_snapshots']) {
    assert.ok(!names.includes(forbidden), forbidden);
  }
});

test('migrating a fresh DB yields the same sqlite_master objects as schema.sql', () => {
  const reference = inspectOf('reference', [schemaSql]);
  assert.ok(migratedSchema.objects.length > 0);
  assert.deepEqual(migratedSchema.objects, reference.objects);
});

test('the migrations on disk are 001..N, contiguous, N = BRIDGE_STORE_VERSION, and are what runs', () => {
  const dir = fileURLToPath(new URL('./migrations/', import.meta.url));
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  assert.equal(files.length, BRIDGE_STORE_VERSION);
  files.forEach((f, i) => {
    assert.match(f, new RegExp(`^${String(i + 1).padStart(3, '0')}_[a-z0-9_]+\\.sql$`), f);
  });
  // Applying the files as found on disk yields exactly what the built-in list yields.
  const fromDisk = inspectOf(
    'from-disk',
    files.map((f) => readFileSync(join(dir, f), 'utf8')),
  );
  assert.deepEqual(fromDisk.objects, migratedSchema.objects);
});
