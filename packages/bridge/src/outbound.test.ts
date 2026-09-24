import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * A-P7: every outbound call in `src/` carries an explicit timeout. For each call below, the
 * balanced argument list must mention `timeout` or `signal`. One exemption: in
 * `turns/store.ts` only, `db.exec(sql)` runs SQL on the local SQLite handle, which is not an
 * outbound call. Every other receiver, method and file is still scanned.
 */
const CALL =
  /(?:\b(?:fetch|spawn|spawnSync|fork|exec|execSync|execFile|execFileSync|connect|createConnection|request)|\bhttps?\.get|\bnew\s+WebSocket)\s*\(/g;

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^\s*\/\/.*$/gm, '');
}

/** The text between the call's `(` and its matching `)`, or the rest of the file if unbalanced. */
function argumentList(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return source.slice(open + 1, i);
  }
  return source.slice(open + 1);
}

const STORE_FILE = 'turns/store.ts';

/** @param file the path relative to `src/`, with `/` separators; decides the store exemption */
export function untimedCalls(source: string, file = ''): string[] {
  const clean = stripComments(source);
  const found: string[] = [];
  for (const m of clean.matchAll(CALL)) {
    const at = m.index ?? 0;
    if (file === STORE_FILE && m[0].startsWith('exec(') && clean.slice(at - 3, at) === 'db.') {
      continue;
    }
    const open = (m.index ?? 0) + m[0].length - 1;
    const args = argumentList(clean, open);
    if (!/\b(?:timeout|signal)\b/.test(args)) {
      const line = clean.slice(0, m.index).split('\n').length;
      found.push(`${line}: ${m[0]}`);
    }
  }
  return found;
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [p] : [];
  });
}

test('the scanner flags an untimed call and passes a timed one', () => {
  assert.deepEqual(untimedCalls("await fetch('http://x/v1');"), ['1: fetch(']);
  assert.deepEqual(untimedCalls("spawn('op', ['read', ref]);"), ['1: spawn(']);
  assert.deepEqual(untimedCalls("http.get('http://x', (res) => res);"), ['1: http.get(']);
  assert.deepEqual(untimedCalls("fork('./worker.js');"), ['1: fork(']);
  assert.deepEqual(untimedCalls("const ws = new WebSocket('ws://x');"), ['1: new WebSocket(']);
  assert.deepEqual(
    untimedCalls('await fetch(url(), { headers: h(1), signal: AbortSignal.timeout(2000) });'),
    [],
  );
  assert.deepEqual(untimedCalls("execFileSync('op', ['read'], { timeout: 2000 });"), []);
  // The balance matters: a `timeout` after the call's closing paren does not count.
  assert.deepEqual(untimedCalls('fetch(u); const timeout = 1;'), ['1: fetch(']);
  // `db.exec` is exempt in turns/store.ts only; any other receiver, method or file is not.
  assert.deepEqual(untimedCalls("db.exec('BEGIN IMMEDIATE');", 'turns/store.ts'), []);
  assert.deepEqual(untimedCalls("db.exec('BEGIN IMMEDIATE');"), ['1: exec(']);
  assert.deepEqual(untimedCalls("db.exec('BEGIN');", 'registry/client.ts'), ['1: exec(']);
  assert.deepEqual(untimedCalls("cp.exec('op read x');", 'turns/store.ts'), ['1: exec(']);
  for (const call of ['db.fetch(u);', 'db.request(u);', 'db.connect(u);']) {
    assert.equal(untimedCalls(call).length, 1, call);
    assert.equal(untimedCalls(call, 'turns/store.ts').length, 1, `${call} in the store`);
  }
  // Commented-out calls are not calls.
  assert.deepEqual(untimedCalls('// fetch(u)\n/* spawn(x) */'), []);
});

test('no untimed outbound call in src/', () => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const offenders = sources(root).flatMap((file) =>
    untimedCalls(readFileSync(file, 'utf8'), relative(root, file).split(sep).join('/')).map(
      (hit) => `${relative(root, file)}:${hit}`,
    ),
  );
  assert.deepEqual(offenders, []);
});
