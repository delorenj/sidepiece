import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * A boardless Project's `boardId` is `""`, never null or absent, so board presence is tested
 * by truthiness only. A null check or `in` says "has a board" for all four boardless
 * Projects; so does comparing against `''` in one place and truthiness in another.
 */
const FIELD = 'board' + 'Id';
const COMPARISON = new RegExp(
  [
    `\\b${FIELD}\\s*(?:!==?|===?)\\s*(?:null|undefined|''|"")`,
    `(?:null|undefined|''|"")\\s*(?:!==?|===?)\\s*[\\w.?]*\\b${FIELD}\\b`,
    `\\b${FIELD}\\s*\\?\\?`,
    `['"]${FIELD}['"]\\s+in\\s`,
  ].join('|'),
);

export function presenceChecks(source: string): string[] {
  return source
    .split('\n')
    .flatMap((line, i) => (COMPARISON.test(line) ? [`${i + 1}: ${line.trim()}`] : []));
}

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [p] : [];
  });
}

test('the scanner flags a non-truthiness presence check and passes truthiness', () => {
  for (const bad of [
    `if (r.${FIELD} != null) {}`,
    `if (r.${FIELD} !== null) {}`,
    `const b = r.${FIELD} ?? 'none';`,
    `if ('${FIELD}' in r) {}`,
    `if (r.${FIELD} === '') {}`,
    `if (r.${FIELD} !== '') {}`,
    `if (null !== r.${FIELD}) {}`,
  ]) {
    assert.equal(presenceChecks(bad).length, 1, bad);
  }
  for (const good of [`if (r.${FIELD}) {}`, `if (!r.${FIELD}) {}`, `const x = { ${FIELD}: '' };`]) {
    assert.deepEqual(presenceChecks(good), [], good);
  }
});

test('no presence check in packages/bridge/src other than truthiness', () => {
  const root = fileURLToPath(new URL('.', import.meta.url));
  const offenders = sources(root).flatMap((file) =>
    presenceChecks(readFileSync(file, 'utf8')).map(
      (hit) => `${relative(root, file).split(sep).join('/')}:${hit}`,
    ),
  );
  assert.deepEqual(offenders, []);
});
