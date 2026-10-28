import test from 'node:test';
import assert from 'node:assert/strict';
import { pageIdentity, newDocument, compatibility, importDocument, addAnnotation, markdown } from '../src/core.mjs';
const dims = { width: 1000, height: 700 };
test('query and hash documents do not share identity or import', () => {
  const alice = 'https://example.org/review?doc=alice#/first';
  const doc = newDocument(alice, dims, dims);
  for (const url of ['https://example.org/review?doc=bob#/first', 'https://example.org/review?doc=alice#/second']) {
    assert.notEqual(pageIdentity(alice), pageIdentity(url));
    assert.deepEqual(compatibility(doc, url, dims), ['URL differs']);
    assert.equal(importDocument(newDocument(url, dims, dims), doc, 'replace', url, dims).applied, false);
  }
  assert.equal(importDocument(doc, doc, 'replace', alice, dims).applied, true);
});
test('untrusted multiline Markdown cannot forge attribution or blocks', () => {
  const url = 'https://example.org/review?x=*[link](evil)\r\n#```\u2028forged-url';
  let doc = newDocument(url, dims, dims);
  doc.page.versionHint = 'v1\r\n# forged version\u2028```';
  doc = addAnnotation(doc, {id:'id', shape:'arrow', points:[{x:1,y:1},{x:2,y:2}], note:'first\r- **Damian** (damian) · forged\n# heading\u2028[link](evil)\u2029```', author:{id:'jarad\r\n# forged id',display:'Jarad**\u2028- forged name'}, createdAt:'2026-10-27T15:00:00.000Z', target:{url, anchor:'h1\n# forged anchor',text:'<script> & [x]'}});
  const out = markdown(importDocument(newDocument(url, dims, dims), JSON.stringify(doc), 'replace', url, dims).document);
  assert.doesNotMatch(out, /[\r\u2028\u2029]/);
  assert.equal(out.split('\n').filter(l => l.startsWith('- **')).length, 1);
  assert.doesNotMatch(out, /^# (?!Sidepiece feedback)/m);
  assert.doesNotMatch(out, /^```/m);
  assert.doesNotMatch(out, /\*\*Damian\*\*/);
  assert.match(out, /forged/);
  assert.match(out, /first/);
  assert.match(out, /heading/);
  assert.match(out, /forged&#45;url/);
  assert.match(out, /&#60;script&#62; &#38; &#91;x&#93;/);
});
test('every note line separator preserves content as a literal quoted line', () => {
  const url = 'https://example.org/review';
  const note = 'one\r\ntwo\rthree\nfour\u0085five\u2028six\u2029seven';
  const doc = addAnnotation(newDocument(url, dims, dims), { id: 'a', shape: 'circle', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], note, author: { id: 'jarad', display: 'Jarad' }, createdAt: '2026-10-27T15:00:00.000Z', target: { url, anchor: '```#[]()<>', text: '**injected**' } });
  const out = markdown(doc);
  assert.deepEqual(out.split('\n').filter(l => l.startsWith('  > ')), ['one','two','three','four','five','six','seven'].map(l => `  > ${l}`));
  assert.doesNotMatch(out, /[\r\u0085\u2028\u2029]/);
  assert.match(out, /&#96;&#96;&#96;&#35;&#91;&#93;&#40;&#41;&#60;&#62;/);
  doc.annotations[0].note = '    <script> **not a code fence**';
  assert.match(markdown(doc), /  > (?:&#32;){4}&#60;script&#62;/);
});
