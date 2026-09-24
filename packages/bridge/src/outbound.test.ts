import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * A-P7: every outbound call in `src/` carries an explicit timeout. For each call below, the
 * balanced argument list must mention `timeout` or `signal`. A call on a SQLite handle named
 * `db` (`db.exec(sql)`, in `turns/store.ts`) is local and synchronous, not outbound, so the
 * lookbehind exempts exactly that receiver.
 */
const CALL =
  /(?<!\bdb\.)(?:\b(?:fetch|spawn|spawnSync|fork|exec|execSync|execFile|execFileSync|connect|createConnection|request)|\bhttps?\.get|\bnew\s+WebSocket)\s*\(/g;

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

export function untimedCalls(source: string): string[] {
  const clean = stripComments(source);
  const found: string[] = [];
  for (const m of clean.matchAll(CALL)) {
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
  // A SQLite handle's `exec` is not outbound; any other receiver's still is.
  assert.deepEqual(untimedCalls("db.exec('BEGIN IMMEDIATE');"), []);
  assert.deepEqual(untimedCalls("cp.exec('op read x');"), ['1: exec(']);
  // Commented-out calls are not calls.
  assert.deepEqual(untimedCalls('// fetch(u)\n/* spawn(x) */'), []);
});

test('no untimed outbound call in src/', () => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const offenders = sources(root).flatMap((file) =>
    untimedCalls(readFileSync(file, 'utf8')).map((hit) => `${relative(root, file)}:${hit}`),
  );
  assert.deepEqual(offenders, []);
});
