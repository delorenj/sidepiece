import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import type { AgentBinding } from '@sidepiece/contract';
import { probePaths } from './paths.ts';

let root: string;
before(() => {
  root = mkdtempSync(join(tmpdir(), 'sidepiece-paths-'));
});
after(() => rmSync(root, { recursive: true, force: true }));

const PM: AgentBinding = { id: 'sidepiece-pm', role: 'pm', roleDir: 'agents/hermes/pm' };
const SM: AgentBinding = {
  id: 'sidepiece-scrum-master',
  role: 'scrum-master',
  roleDir: 'agents/hermes/scrum-master',
};

/** A fresh clone dir under the temp root, with the given relative dirs created in it. */
function clone(name: string, dirs: string[] = []): string {
  const dir = join(root, name);
  mkdirSync(dir);
  for (const d of dirs) mkdirSync(join(dir, d), { recursive: true });
  return dir;
}

test('all present is []', async () => {
  const c = clone('all', [PM.roleDir, SM.roleDir]);
  assert.deepEqual(await probePaths({ clonePath: c, agents: [PM, SM] }), []);
});

test('this repo today: pm present, scrum-master absent is exactly one DS-10', async () => {
  const c = clone('today', [PM.roleDir]);
  const out = await probePaths({ clonePath: c, agents: [PM, SM] });
  assert.equal(
    JSON.stringify(out),
    JSON.stringify([
      {
        ds: 'DS-10',
        params: { agent: 'sidepiece-scrum-master', roleDir: `${c}/agents/hermes/scrum-master` },
      },
    ]),
  );
});

test('a missing pm roleDir is DS-20 with pm and the resolved roleDir', async () => {
  const c = clone('pm-missing', [SM.roleDir]);
  const out = await probePaths({ clonePath: c, agents: [PM, SM] });
  assert.equal(
    JSON.stringify(out),
    JSON.stringify([
      { ds: 'DS-20', params: { pm: 'sidepiece-pm', roleDir: `${c}/agents/hermes/pm` } },
    ]),
  );
});

test('a missing clone is DS-9 with the full path, then DS-20 and DS-10; nothing created', async () => {
  const c = join(root, 'never', 'cloned', 'here');
  const out = await probePaths({ clonePath: c, agents: [PM, SM] });
  assert.equal(
    JSON.stringify(out),
    JSON.stringify([
      { ds: 'DS-9', params: { path: c } },
      { ds: 'DS-20', params: { pm: 'sidepiece-pm', roleDir: `${c}/agents/hermes/pm` } },
      {
        ds: 'DS-10',
        params: { agent: 'sidepiece-scrum-master', roleDir: `${c}/agents/hermes/scrum-master` },
      },
    ]),
  );
  assert.ok(!existsSync(join(root, 'never')), 'the probe never creates anything');
});

test('an absolute roleDir stands alone', async () => {
  const c = clone('absolute');
  const elsewhere = join(root, 'elsewhere', 'x');
  const out = await probePaths({
    clonePath: c,
    agents: [{ id: 'a', role: 'dev', roleDir: elsewhere }],
  });
  assert.deepEqual(out, [{ ds: 'DS-10', params: { agent: 'a', roleDir: elsewhere } }]);
});

test('a regular file is not a directory: DS-9 for the clone, DS-10 for a role dir', async () => {
  const file = join(root, 'a-file');
  writeFileSync(file, 'not a dir');
  assert.deepEqual(await probePaths({ clonePath: file, agents: [] }), [
    { ds: 'DS-9', params: { path: file } },
  ]);
  const c = clone('file-role');
  writeFileSync(join(c, 'role'), '');
  assert.deepEqual(
    await probePaths({ clonePath: c, agents: [{ id: 'a', role: 'dev', roleDir: 'role' }] }),
    [{ ds: 'DS-10', params: { agent: 'a', roleDir: join(c, 'role') } }],
  );
});

test('a dangling symlink is missing; a symlink to a directory is present', async () => {
  const dangling = join(root, 'dangling');
  symlinkSync(join(root, 'nowhere'), dangling);
  assert.deepEqual(await probePaths({ clonePath: dangling, agents: [] }), [
    { ds: 'DS-9', params: { path: dangling } },
  ]);
  const target = clone('link-target', [PM.roleDir]);
  const linked = join(root, 'linked');
  symlinkSync(target, linked);
  assert.deepEqual(await probePaths({ clonePath: linked, agents: [PM] }), []);
});

test('ENOTDIR under a file is missing, never a throw', async () => {
  const file = join(root, 'enotdir');
  writeFileSync(file, '');
  const out = await probePaths({ clonePath: file, agents: [PM] });
  assert.deepEqual(
    out.map((d) => d.ds),
    ['DS-9', 'DS-20'],
  );
});

test('no agents and a present clone is []', async () => {
  assert.deepEqual(await probePaths({ clonePath: clone('boardless'), agents: [] }), []);
});
