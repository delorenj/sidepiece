import assert from 'node:assert/strict';
import {
  chmodSync,
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
import { after, test } from 'node:test';
import type { LogLine } from '../log.ts';
import { openSnapshot, SNAPSHOT_FILE, snapshotAge } from './snapshot.ts';

const dirs: string[] = [];
after(() => {
  for (const d of dirs) {
    chmodSync(d, 0o700);
    rmSync(d, { recursive: true, force: true });
  }
});
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'sidepiece-snapshot-'));
  dirs.push(d);
  return d;
}

test('the snapshot file is registry-snapshot.json in the state dir', () => {
  const dir = tempDir();
  assert.equal(SNAPSHOT_FILE, 'registry-snapshot.json');
  assert.equal(openSnapshot(dir).path, join(dir, SNAPSHOT_FILE));
});

test('write is whole, 0600, {fetchedAt, payload} in key order, and leaves no temp file', () => {
  const dir = tempDir();
  const at = new Date('2026-09-24T12:00:00.000Z');
  const snapshot = openSnapshot(dir, { now: () => at });
  snapshot.write({ schema_version: 1, projects: { a: { x: 1 } } });
  snapshot.write({ projects: { b: {} } });
  const text = readFileSync(snapshot.path, 'utf8');
  assert.equal(text, '{"fetchedAt":"2026-09-24T12:00:00.000Z","payload":{"projects":{"b":{}}}}');
  assert.equal(statSync(snapshot.path).mode & 0o777, 0o600);
  assert.deepEqual(readdirSync(dir), [SNAPSHOT_FILE]);
  assert.deepEqual(snapshot.read(), {
    fetchedAt: '2026-09-24T12:00:00.000Z',
    payload: { projects: { b: {} } },
  });
});

test('a failed write logs snapshot_write_failed and never throws', () => {
  const dir = tempDir();
  const lines: LogLine[] = [];
  const snapshot = openSnapshot(dir, { log: (l) => lines.push(l) });
  snapshot.write({ projects: {} });
  const before = readFileSync(snapshot.path, 'utf8');
  chmodSync(dir, 0o500);
  try {
    assert.doesNotThrow(() => snapshot.write({ projects: { new: {} } }));
  } finally {
    chmodSync(dir, 0o700);
  }
  assert.equal(readFileSync(snapshot.path, 'utf8'), before, 'the last good copy stands');
  assert.equal(lines.length, 1);
  const [line] = lines;
  assert.ok(line && line.event === 'snapshot_write_failed');
  assert.equal(line.level, 'error');
  assert.equal(line.ds, 'DS-5');
  assert.equal(line.path, snapshot.path);
  assert.equal(typeof line.detail, 'string');
});

test('read: a missing file is undefined; a corrupt one throws', () => {
  const dir = tempDir();
  const snapshot = openSnapshot(dir);
  assert.equal(existsSync(snapshot.path), false);
  assert.equal(snapshot.read(), undefined);
  for (const body of [
    '{bad',
    '[]',
    'null',
    '{"payload":{}}',
    '{"fetchedAt":"not a date","payload":{}}',
    '{"fetchedAt":7,"payload":{}}',
    '{"fetchedAt":"2026-09-24T12:00:00.000Z"}',
  ]) {
    writeFileSync(snapshot.path, body);
    assert.throws(() => snapshot.read(), body);
  }
});

test('snapshotAge floors to whole seconds and never goes negative', () => {
  const at = '2026-09-24T12:00:00.000Z';
  assert.equal(snapshotAge(at, new Date('2026-09-24T12:00:00.999Z')), 0);
  assert.equal(snapshotAge(at, new Date('2026-09-24T12:00:01.999Z')), 1);
  assert.equal(snapshotAge(at, new Date('2026-09-24T11:59:00.000Z')), 0);
  assert.equal(snapshotAge(at, new Date('2026-11-08T12:00:00.000Z')), 45 * 86_400);
});
