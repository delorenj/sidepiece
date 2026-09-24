import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  BridgeDsCode,
  ClientDsCode,
  Degraded,
  DsCode,
  IconTransient,
  Refusal,
  SubscriptionState,
} from './state.ts';

const CLIENT = [
  'DS-1',
  'DS-3',
  'DS-4',
  'DS-5',
  'DS-16',
  'DS-21',
  'DS-27',
] as const satisfies readonly ClientDsCode[];

const BRIDGE = [
  'DS-2',
  'DS-6',
  'DS-7',
  'DS-8',
  'DS-9',
  'DS-10',
  'DS-11',
  'DS-12',
  'DS-13',
  'DS-14',
  'DS-15',
  'DS-17',
  'DS-18',
  'DS-19',
  'DS-20',
  'DS-22',
  'DS-23',
  'DS-24',
  'DS-25',
  'DS-26',
  'DS-28',
] as const satisfies readonly BridgeDsCode[];

// Exhaustiveness: a union member missing from its array is a type error here.
type MissingClient = Exclude<ClientDsCode, (typeof CLIENT)[number]>;
type MissingBridge = Exclude<BridgeDsCode, (typeof BRIDGE)[number]>;
const _clientComplete: [MissingClient] extends [never] ? true : false = true;
const _bridgeComplete: [MissingBridge] extends [never] ? true : false = true;

// `Degraded.ds` is exactly `BridgeDsCode`, in both directions.
const _dsIsBridge: [Degraded['ds']] extends [BridgeDsCode]
  ? [BridgeDsCode] extends [Degraded['ds']]
    ? true
    : false
  : false = true;

// A Cockpit-only code can never ride in the Bridge's `degraded[]`.
// @ts-expect-error DS-1 is a ClientDsCode
const _clientInDegraded: Degraded = { ds: 'DS-1' };

// The three non-DS code spaces are not assignable to `DsCode`.
const refusal: Refusal = { error: 'stale_generation', pjid: 'sidepiece', received: 1, current: 2 };
// @ts-expect-error a Refusal is not a DsCode
const _refusalAsDs: DsCode = refusal;
// @ts-expect-error a Refusal's error code is not a DsCode
const _refusalErrorAsDs: DsCode = refusal.error;
const subscription: SubscriptionState = 'not_established';
// @ts-expect-error a SubscriptionState is not a DsCode
const _subscriptionAsDs: DsCode = subscription;
const icon: IconTransient = 'open_gesture_rejected';
// @ts-expect-error an IconTransient is not a DsCode
const _iconAsDs: DsCode = icon;

test('7 client codes, 21 bridge codes, 28 total', () => {
  assert.equal(new Set(CLIENT).size, 7);
  assert.equal(new Set(BRIDGE).size, 21);
  assert.equal(CLIENT.length + BRIDGE.length, 28);
});

test('client and bridge codes are disjoint', () => {
  const bridge = new Set<string>(BRIDGE);
  assert.deepEqual(
    CLIENT.filter((ds) => bridge.has(ds)),
    [],
  );
});

test('the union is DS-1…DS-28 with no gap and no duplicate', () => {
  const all: readonly DsCode[] = [...CLIENT, ...BRIDGE];
  const numbers = all.map((ds) => Number(ds.slice(3))).sort((a, b) => a - b);
  assert.deepEqual(
    numbers,
    Array.from({ length: 28 }, (_, i) => i + 1),
  );
});
