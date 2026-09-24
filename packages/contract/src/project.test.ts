import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProjectRecord, ProjectResponse } from './project.ts';
import { CONTRACT_VERSION } from './version.ts';

const record = {
  pjid: 'sidepiece',
  generation: 1,
  repo: 'sidepiece',
  clonePath: '/home/delorenj/code/sidepiece',
  boardId: '',
  agents: [{ id: 'sidepiece-pm', role: 'pm', roleDir: 'agents/hermes/pm' }],
  ticketProvider: { type: 'plane' },
} satisfies ProjectRecord;

// `boardId` is required and never null: a boardless Project carries `''`.
// @ts-expect-error boardId cannot be null
const _nullBoard: ProjectRecord = { ...record, boardId: null };
const { boardId: _dropped, ...withoutBoard } = record;
// @ts-expect-error boardId cannot be omitted
const _missingBoard: ProjectRecord = withoutBoard;

const response: ProjectResponse = { degraded: [{ ds: 'DS-2', params: { pjid: 'nope' } }] };

// A parameter is never narrowed by an assignment, so this is the un-narrowed union for real.
function _unnarrowed(r: ProjectResponse): string {
  // @ts-expect-error a record field cannot be read before narrowing
  return r.boardId;
}

// Narrowing on `'pjid' in r` is what makes the record fields readable.
function boardOf(r: ProjectResponse): string | undefined {
  return 'pjid' in r ? r.boardId : undefined;
}

test('narrowing reaches the record only when it is there', () => {
  assert.equal(boardOf(response), undefined);
  assert.equal(boardOf({ ...record, boardId: 'b1', degraded: [] }), 'b1');
});

test('CONTRACT_VERSION is the integer 1', () => {
  assert.equal(CONTRACT_VERSION, 1);
  assert.ok(Number.isInteger(CONTRACT_VERSION));
});
