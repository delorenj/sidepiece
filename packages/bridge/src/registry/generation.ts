import { createHash } from 'node:crypto';
import type { AgentBinding, ProjectRecord, Refusal } from '@sidepiece/contract';
import type { TurnStore } from '../turns/store.ts';

/**
 * Content-addressed generations (architecture D11). The hash covers only what a mutation is
 * written against; `pjid`, `generation` and `resolved_at` are not part of it. A generation
 * advances only when the hash changes, and a row is never deleted, so a value is never reused.
 */

type Hashed = Pick<ProjectRecord, 'repo' | 'clonePath' | 'boardId' | 'ticketProvider' | 'agents'>;

/** Agents by `id`, in code-unit order (not locale order). Returns a new array. */
export function sortAgents(agents: readonly AgentBinding[]): AgentBinding[] {
  return [...agents].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Lowercase hex sha256 of the record's content, in fixed key order. */
export function recordHash(record: Hashed): string {
  const canonical = {
    repo: record.repo,
    clonePath: record.clonePath,
    boardId: record.boardId,
    ticketProvider: { type: record.ticketProvider.type },
    agents: sortAgents(record.agents).map(({ id, role, roleDir }) => ({ id, role, roleDir })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export type Minted = { generation: number; minted: boolean };

/**
 * The generation for a record, under one `BEGIN IMMEDIATE`. An unchanged hash returns the
 * stored generation and writes nothing (re-resolution is not an event); a new pjid is 1; a
 * changed hash is the stored value + 1.
 */
export function mintGeneration(
  store: Pick<TurnStore, 'readResolution' | 'writeResolution' | 'transaction'>,
  record: Hashed & Pick<ProjectRecord, 'pjid'>,
): Minted {
  const hash = recordHash(record);
  return store.transaction(() => {
    const row = store.readResolution(record.pjid);
    if (row !== undefined && row.recordHash === hash) {
      return { generation: row.generation, minted: false };
    }
    const generation = (row?.generation ?? 0) + 1;
    store.writeResolution({
      pjid: record.pjid,
      generation,
      recordHash: hash,
      resolvedAt: new Date().toISOString(),
      clonePath: record.clonePath,
      boardId: record.boardId,
    });
    return { generation, minted: true };
  });
}

/** A mutation written against an older generation: answered `409` with {@link refusal}. */
export class StaleGenerationError extends Error {
  readonly refusal: Refusal;
  constructor(refusal: Refusal) {
    super('stale_generation');
    this.name = 'StaleGenerationError';
    this.refusal = refusal;
  }
}

/** A generation this Bridge never minted (D11: a Bridge bug). Answered `500`, never a refusal. */
export class GenerationAheadError extends Error {
  readonly pjid: string;
  readonly received: number;
  readonly current: number;
  constructor(pjid: string, received: number, current: number) {
    super('generation_ahead_of_bridge');
    this.name = 'GenerationAheadError';
    this.pjid = pjid;
    this.received = received;
    this.current = current;
  }
}

/**
 * The one definition of stale (SM-3): `received < current` throws {@link StaleGenerationError},
 * `received > current` throws {@link GenerationAheadError}, equal returns. No other file
 * compares generations; `current` must come from a fresh resolution, never a stored row.
 */
export function assertCurrentGeneration(pjid: string, received: number, current: number): void {
  if (received < current) {
    throw new StaleGenerationError({ error: 'stale_generation', pjid, received, current });
  }
  if (received > current) throw new GenerationAheadError(pjid, received, current);
}
