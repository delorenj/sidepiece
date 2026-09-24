import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DEFAULT_STATE_DIR, DEPLOY_TARGET_DIR } from '../src/config.ts';

// The deploy script, the unit and config.ts each spell the two directories. If they drift, the
// blast-radius guard checks a directory the Bridge does not use, and the Turn store is unguarded.
const script = readFileSync(
  new URL('../../../.mise/scripts/deploy-bridge.sh', import.meta.url),
  'utf8',
);
const unit = readFileSync(new URL('../deploy/sidepiece-bridge.service', import.meta.url), 'utf8');

const scriptVar = (name: string) => script.match(new RegExp(`^${name}="([^"]+)"$`, 'm'))?.[1];
const unitKey = (key: string) => unit.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1];

test('deploy-bridge.sh uses config.ts lib and state dirs', () => {
  assert.equal(scriptVar('LIB_REL'), DEPLOY_TARGET_DIR);
  assert.equal(scriptVar('STATE_REL'), DEFAULT_STATE_DIR);
});

test('the unit runs the bundle from the deploy target and works in the state dir', () => {
  assert.equal(unitKey('ExecStart')?.split(' ')[1], `%h/${DEPLOY_TARGET_DIR}/bridge.mjs`);
  assert.equal(unitKey('WorkingDirectory'), `%h/${DEFAULT_STATE_DIR}`);
  assert.equal(`.local/state/${unitKey('StateDirectory')}`, DEFAULT_STATE_DIR);
});
