import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nodeRefusal } from './node-pin.ts';

const ALLOWED = ['24.15.0', '24.99.1'];
const REFUSED = [
  '24.14.9',
  '24.6.0',
  '25.0.0',
  '22.22.2',
  '26.5.0',
  '24.15.0-rc.1',
  '24.16.0-nightly20260901',
];

for (const v of ALLOWED) {
  test(`Node ${v} is allowed`, () => {
    assert.equal(nodeRefusal(v, `v${v}`), undefined);
  });
}

for (const v of REFUSED) {
  test(`Node ${v} is refused with the exact message`, () => {
    assert.equal(
      nodeRefusal(v, `v${v}`),
      `sidepiece-bridge requires Node >=24.15.0 <25; this is v${v}. Refusing to start.`,
    );
  });
}

test('an unparseable version is refused', () => {
  assert.match(nodeRefusal('garbage', 'vgarbage') ?? '', /Refusing to start\.$/);
});
