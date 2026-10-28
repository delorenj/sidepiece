import test from 'node:test';
import assert from 'node:assert/strict';
import { newDocument, addAnnotation, removeAnnotation, importDocument } from '../src/core.mjs';
import { createLocalStore, storageKey } from '../src/store.mjs';
const url = 'https://example.org/review?doc=alice#/one';
const dims = { width: 1000, height: 700 };
const create = () => newDocument(url, dims, dims);
const mark = (id, author = 'jarad') => ({ id, shape: 'arrow', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], note: id, author: { id: author, display: author === 'jarad' ? 'Jarad' : 'Damian' }, createdAt: '2026-10-27T15:00:00.000Z', target: { url, anchor: '', text: '' } });
function setup() {
  const values = new Map();
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  let queue = Promise.resolve();
  const locks = { request: (_key, work) => { const result = queue.then(work); queue = result.catch(() => {}); return result; } };
  const tab = (override = {}) => createLocalStore({ storage, locks, url, create, ...override });
  return { tab, values, storage };
}
const edit = (base, id, note) => ({ ...base.document, annotations: base.document.annotations.map(a => a.id === id ? { ...a, note } : a) });
test('full URL keys separate query, query ordering and hash; canonical same URL shares key', () => {
  for (const other of ['https://example.org/review?doc=bob#/one', 'https://example.org/review?doc=alice#/two']) assert.notEqual(storageKey(url), storageKey(other));
  assert.notEqual(storageKey('https://example.org/?a=1&b=2'), storageKey('https://example.org/?b=2&a=1'));
  assert.equal(storageKey('https://EXAMPLE.org:443/review?doc=alice#/one'), storageKey(url));
});
test('two concurrent tabs add distinct marks without loss and retain imported author IDs', async () => {
  const { tab } = setup(), a = tab(), b = tab();
  const initialA = a.read(), initialB = b.read();
  await Promise.all([a.commit(initialA, addAnnotation(initialA.document, mark('a'))), b.commit(initialB, addAnnotation(initialB.document, mark('b', 'damian')))]);
  const saved = a.read();
  assert.deepEqual(saved.document.annotations.map(a => a.author.id), ['jarad', 'damian']);
  assert.equal(saved.revision, 2);
  const imported = addAnnotation(create(), mark('imported', 'external-id'));
  await a.commit(saved, importDocument(saved.document, imported, 'merge', url, dims).document);
  assert.equal(a.read().document.annotations.at(-1).author.id, 'external-id');
});
test('stale unrelated additions do not resurrect deletions; reimport of tombstoned ID refuses', async () => {
  const { tab } = setup(), a = tab(), b = tab();
  const saved = await a.commit(a.read(), addAnnotation(create(), mark('a'))), stale = b.read();
  await a.commit(saved, removeAnnotation(saved.document, 'a'));
  await b.commit(stale, addAnnotation(stale.document, mark('b', 'damian')));
  assert.deepEqual(a.read().document.annotations.map(a => a.id), ['b']);
  const current = a.read();
  await assert.rejects(a.commit(current, addAnnotation(current.document, mark('a'))), /Save conflict/);
  assert.equal(a.read().tombstones.a, 2);
});
test('edit/edit and edit/delete conflicts refuse whole operation, leaving latest mark and attribution', async () => {
  for (const first of ['edit', 'delete']) {
    const { tab } = setup(), a = tab(), b = tab();
    const base = await a.commit(a.read(), addAnnotation(create(), mark('a'))), stale = b.read();
    await a.commit(base, first === 'edit' ? edit(base, 'a', 'winner') : removeAnnotation(base.document, 'a'));
    await assert.rejects(b.commit(stale, edit(stale, 'a', 'loser')), /Save conflict/);
    await assert.rejects(b.commit(stale, removeAnnotation(stale.document, 'a')), /Save conflict/);
    assert.deepEqual(a.read().document.annotations.map(a => a.note), first === 'edit' ? ['winner'] : []);
  }
  const { tab } = setup(), a = tab();
  const base = await a.commit(a.read(), addAnnotation(create(), mark('a')));
  // ABA (edit and revert) is still an intervening revision, not a safe stale base.
  const unchanged = base;
  const edited = await a.commit(base, edit(base, 'a', 'temporary'));
  await a.commit(edited, edit(edited, 'a', 'a'));
  await assert.rejects(a.commit(unchanged, edit(unchanged, 'a', 'stale')), /Save conflict/);
  const changed = structuredClone(a.read().document); changed.annotations[0].author.id = 'damian';
  await assert.rejects(a.commit(a.read(), changed), /attribution is immutable/);
});
test('explicit replace and undo cannot overwrite intervening edits; selective restore respects tombstone revision', async () => {
  const { tab } = setup(), a = tab(), b = tab();
  const base = await a.commit(a.read(), addAnnotation(create(), mark('a')));
  await b.commit(base, addAnnotation(base.document, mark('b')));
  await assert.rejects(a.commit(base, create(), { replace: true }), /Save conflict/);
  const beforeDelete = a.read();
  const deleted = await a.commit(beforeDelete, removeAnnotation(beforeDelete.document, 'a'));
  await b.commit(b.read(), addAnnotation(b.read().document, mark('c')));
  await a.commit(deleted, beforeDelete.document, { restore: true });
  assert.deepEqual(a.read().document.annotations.map(a => a.id).sort(), ['a', 'b', 'c']);
  const restored = a.read();
  await b.commit(restored, edit(restored, 'a', 'someone else'));
  await assert.rejects(a.commit(restored, removeAnnotation(restored.document, 'a'), { restore: true }), /Save conflict/);
});
test('observed A-B-A navigation permanently blocks store writes in this mounted session', async () => {
  const { tab, values } = setup(), store = tab();
  const base = await store.commit(store.read(), addAnnotation(create(), mark('original')));
  const raw = values.get(store.key);
  assert.equal(store.observeRoute('https://example.org/review?doc=bob#/one'), false);
  assert.equal(store.observeRoute(url), false);
  for (const proposed of [
    addAnnotation(base.document, mark('new')),
    edit(base, 'original', 'edited'),
    removeAnnotation(base.document, 'original'),
    importDocument(base.document, addAnnotation(create(), mark('imported')), 'merge', url, dims).document,
    create()
  ]) await assert.rejects(store.commit(base, proposed, { currentUrl: () => url, restore: true, replace: true }), /URL differs/);
  assert.equal(values.get(store.key), raw);
  assert.equal(tab().observeRoute(url), true);
});

test('no unsafe lock-free fallback; corrupt storage and SPA route changes never get overwritten', async () => {
  const { tab, values } = setup(), a = tab({ locks: undefined });
  await assert.rejects(a.commit(a.read(), addAnnotation(create(), mark('a'))), /Web Locks unavailable/);
  assert.equal(values.size, 0);
  const good = tab(), base = good.read();
  await assert.rejects(good.commit(base, addAnnotation(create(), mark('a')), { currentUrl: () => url + 'different' }), /URL differs/);
  values.set(good.key, 'broken');
  await assert.rejects(good.commit(base, addAnnotation(create(), mark('a'))));
  assert.equal(values.get(good.key), 'broken');
});
