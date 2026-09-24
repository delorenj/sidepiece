import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { openStore, type StoreOpen, type TableInfo } from '../turns/store.ts';
import schemaSql from './schema.sql';

const root = mkdtempSync(join(tmpdir(), 'sidepiece-schema-'));
after(() => rmSync(root, { recursive: true, force: true }));

function tablesOf(dir: string, migrations?: readonly string[]): TableInfo[] {
  const opened: StoreOpen = openStore(join(root, dir), migrations ? { migrations } : {});
  assert.equal(opened.kind, 'ready');
  const store = (opened as Extract<StoreOpen, { kind: 'ready' }>).store;
  try {
    return store.inspect().tables;
  } finally {
    store.close();
  }
}

const migrated = tablesOf('migrated');

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

test('migrating a fresh DB yields the same sqlite_master SQL as schema.sql', () => {
  const reference = tablesOf('reference', [schemaSql]);
  assert.deepEqual(
    migrated.map((t) => ({ name: t.name, sql: t.sql })),
    reference.map((t) => ({ name: t.name, sql: t.sql })),
  );
});
