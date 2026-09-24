import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PORT, HOST, parsePort } from './config.ts';

test('the bind host is loopback and the default port is 8787', () => {
  assert.equal(HOST, '127.0.0.1');
  assert.equal(DEFAULT_PORT, 8787);
  assert.equal(parsePort(undefined), 8787);
});

test('SIDEPIECE_BRIDGE_PORT accepts 0..65535 and refuses anything else', () => {
  assert.equal(parsePort('0'), 0);
  assert.equal(parsePort('18787'), 18787);
  assert.equal(parsePort('65535'), 65535);
  for (const bad of ['', 'abc', '-1', '65536', '8787.5', ' 8787', '123456']) {
    assert.equal(parsePort(bad), undefined, bad);
  }
});
