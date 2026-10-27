import test from 'node:test';
import assert from 'node:assert/strict';
import { newDocument, validate, addAnnotation, importDocument, compatibility, markdown, sendSlack } from '../src/core.mjs';
const url = 'https://example.org/one?draft=2';
const dims = { width: 1024, height: 768 };
const create = () => newDocument(url, dims, dims);
const entry = (id, shape, who, points = [{x:10,y:20},{x:60,y:80}]) => ({ id, shape, points, note: `${who.display} note`, author: who, createdAt: '2026-10-27T15:00:00.000Z', target: { url, anchor: 'h1#title', text: 'Hero' } });
const jarad = {id:'jarad',display:'Jarad'}, damian = {id:'damian',display:'Damian'};
test('versioned round trip preserves two authors, all shapes, notes, references and attribution', () => {
  let d = create(); d.page.versionHint = 'abc123'; d.assets.push({id:'capture1',name:'manual.png',type:'image/png',ref:'manual:manual.png'});
  for (const [i, shape] of ['circle','rectangle','arrow','freehand'].entries()) d = addAnnotation(d, { ...entry(String(i),shape,i % 2 ? damian : jarad), assetId:'capture1' });
  const imported = importDocument(create(), JSON.stringify(d), 'replace', url, dims, 'abc123');
  assert.equal(imported.applied,true); assert.deepEqual(imported.document,d);
  assert.deepEqual(importDocument(d, JSON.stringify(d),'merge',url,dims).document,d);
  assert.equal(imported.document.annotations[1].author.display, 'Damian');
});
test('merge preserves other author and refuses ID collisions', () => {
  const a = addAnnotation(create(), entry('a','circle',jarad)); const b = addAnnotation(create(), entry('b','arrow',damian));
  assert.deepEqual(importDocument(a,b,'merge',url,dims).document.annotations.map(x => x.author.id),['jarad','damian']);
  assert.throws(() => importDocument(a, addAnnotation(create(),entry('a','rectangle',damian)),'merge',url,dims),/conflicting ID/);
});
test('malformed, future versions, invalid geometry and unsafe targets rejected', () => {
  for (const bad of ['garbage','null',JSON.stringify({...create(),version:2}),JSON.stringify({...create(),annotations:[entry('x','freehand',jarad,[{x:0,y:0}])]}),JSON.stringify({...create(),annotations:[{...entry('x','circle',jarad),target:{url:'https://elsewhere.test/',anchor:'',text:''}}]})]) assert.throws(() => validate(bad));
});
test('mismatched URL, version or size warns and does not overlay', () => {
  const original = addAnnotation(create(),entry('a','circle',jarad));
  assert.deepEqual(compatibility(original,'https://example.org/two',dims),['URL differs']);
  const imported = importDocument(create(), original,'replace','https://example.org/two',dims);
  assert.equal(imported.applied,false); assert.equal(imported.document.annotations.length,0);
  original.page.versionHint='v2'; assert.deepEqual(compatibility(original,url,dims,'v3'),['version hint differs']);
  assert.deepEqual(compatibility(original,url,{width:2048,height:768}),['document size differs']);
});
test('Markdown stable and filter by author with no inference', () => {
  let d = addAnnotation(create(),entry('b','rectangle',damian)); d = addAnnotation(d,entry('a','circle',jarad));
  const text = markdown(d); assert.equal(text,markdown(JSON.parse(JSON.stringify(d))));
  assert.ok(text.includes('**Jarad** (jarad)')); assert.ok(text.includes('**Damian** (damian)'));
  assert.ok(text.indexOf('Jarad') < text.indexOf('Damian'));
  assert.ok(markdown(d,'damian').includes('Damian')); assert.ok(!markdown(d,'damian').includes('Jarad'));
});
test('Slack unavailable without adapter, mock adapter receives exact Markdown', async () => {
  assert.equal((await sendSlack('x')).sent,false);
  let observed; const result = await sendSlack('review', {send: async s => { observed = s; return {sent:true}; }});
  assert.equal(observed,'review'); assert.equal(result.sent,true);
});
