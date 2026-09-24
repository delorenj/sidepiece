import { stat } from 'node:fs/promises';
import { posix } from 'node:path';
import type { Degraded, ProjectRecord } from '@sidepiece/contract';

/** Present means `stat` (following symlinks) succeeds and names a directory. Never throws. */
async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The one module that probes a Project's paths on disk. Reports, in order:
 * - DS-9: the clone path is missing (the full absolute path, never truncated);
 * - per agent, in record order: DS-20 when the PM's `roleDir` is missing, DS-10 for any
 *   other role. `roleDir` is resolved against the clone path (an absolute one stands alone).
 *
 * Each path is probed independently. Read-only: it never creates, clones, fetches, chmods
 * or writes anything. The entries ride alongside a served record and gate nothing here.
 */
export async function probePaths(
  record: Pick<ProjectRecord, 'clonePath' | 'agents'>,
): Promise<Degraded[]> {
  const { clonePath, agents } = record;
  const [cloneOk, ...roleOk] = await Promise.all([
    isDirectory(clonePath),
    ...agents.map((a) => isDirectory(posix.resolve(clonePath, a.roleDir))),
  ]);
  const out: Degraded[] = [];
  if (!cloneOk) out.push({ ds: 'DS-9', params: { path: clonePath } });
  agents.forEach((agent, i) => {
    if (roleOk[i]) return;
    const roleDir = posix.resolve(clonePath, agent.roleDir);
    out.push(
      agent.role === 'pm'
        ? { ds: 'DS-20', params: { pm: agent.id, roleDir } }
        : { ds: 'DS-10', params: { agent: agent.id, roleDir } },
    );
  });
  return out;
}
