import { pageIdentity, validate } from './core.mjs';

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const conflict = () => { throw new Error('Save conflict: another tab changed this mark/document. Review the latest state and retry; your draft was not saved.'); };
export const storageKey = url => `sidepiece:v2:${pageIdentity(url)}`;

// All participating v2 tabs serialize read/reconcile/write with the same Web Lock.
// localStorage has no compare-and-swap. Without Web Locks, writes are refused.
export function createLocalStore({ storage, locks, url, create }) {
  const key = storageKey(url), identity = pageIdentity(url);
  function read() {
    const raw = storage.getItem(key);
    if (raw === null) return { document: create(), revision: 0, tombstones: {}, records: { annotations: {}, assets: {} } };
    const { localState, ...document } = JSON.parse(raw);
    if (!localState || !Number.isSafeInteger(localState.revision) || localState.revision < 1 || !localState.tombstones || Array.isArray(localState.tombstones) || typeof localState.tombstones !== 'object' || Object.values(localState.tombstones).some(r => !Number.isSafeInteger(r) || r < 1 || r > localState.revision)) throw new Error('Invalid local annotation state; export/recover storage before saving.');
    if (!localState.records || ['annotations', 'assets'].some(field => !localState.records[field] || typeof localState.records[field] !== 'object' || Array.isArray(localState.records[field]) || Object.values(localState.records[field]).some(r => !Number.isSafeInteger(r) || r < 1 || r > localState.revision))) throw new Error('Invalid local record revisions; refusing to overwrite.');
    const doc = validate(document);
    if (doc.page.identity !== identity || ['annotations', 'assets'].some(field => doc[field].some(a => !Object.hasOwn(localState.records[field], a.id))) || doc.annotations.some(a => Object.hasOwn(localState.tombstones, a.id))) throw new Error('Invalid local page identity/tombstones; refusing to overwrite.');
    return { document: doc, revision: localState.revision, tombstones: localState.tombstones, records: localState.records };
  }
  async function commit(base, proposed, { replace = false, restore = false, currentUrl = () => url } = {}) {
    const next = validate(proposed);
    if (!locks?.request) throw new Error('Saving disabled: Web Locks unavailable. Use a supported secure-context browser; no unsafe localStorage fallback.');
    return locks.request(key, () => {
      if (pageIdentity(currentUrl()) !== identity || next.page.identity !== identity) throw new Error('URL differs: reload/reopen annotations on this page before saving.');
      const latest = read();
      if (latest.document.page.identity !== base.document.page.identity || JSON.stringify(latest.document.page.documentSize) !== JSON.stringify(base.document.page.documentSize) || latest.document.page.versionHint !== base.document.page.versionHint) conflict();
      if (replace && latest.revision !== base.revision) conflict();
      const tombstones = { ...latest.tombstones };
      const revision = latest.revision + 1;
      const records = structuredClone(latest.records);
      const reconcile = (field, trackDeletes) => {
        const before = new Map(base.document[field].map(a => [a.id, a]));
        const wanted = new Map(next[field].map(a => [a.id, a]));
        const live = new Map(latest.document[field].map(a => [a.id, a]));
        for (const id of new Set([...before.keys(), ...wanted.keys()])) {
          const old = before.get(id), value = wanted.get(id);
          if (equal(old, value)) continue; // Untouched stale records never get reinserted.
          if (!equal(live.get(id), old) || latest.records[field][id] !== base.records[field][id]) conflict();
          if (trackDeletes && value && old && (!equal(value.author, old.author) || value.createdAt !== old.createdAt)) throw new Error('Annotation attribution is immutable.');
          if (trackDeletes && value && Object.hasOwn(tombstones, id)) {
            if (!restore || base.tombstones[id] !== tombstones[id]) conflict();
            delete tombstones[id];
          }
          Object.defineProperty(records[field], id, { value: revision, enumerable: true, writable: true, configurable: true });
          if (value) live.set(id, value);
          else { live.delete(id); if (trackDeletes) Object.defineProperty(tombstones, id, { value: revision, enumerable: true, writable: true, configurable: true }); }
        }
        return [...live.values()];
      };
      // Metadata edits also use optimistic comparison rather than last-writer-wins.
      if (!equal(base.document.page, next.page) && !equal(base.document.page, latest.document.page)) conflict();
      const document = validate({ ...latest.document, page: equal(base.document.page, next.page) ? latest.document.page : next.page, annotations: reconcile('annotations', true), assets: reconcile('assets', false) });
      storage.setItem(key, JSON.stringify({ ...document, localState: { revision, tombstones, records } }));
      return { document, revision, tombstones, records };
    });
  }
  return { key, read, commit };
}
