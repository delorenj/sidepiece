import type { Degraded } from './state.ts';

/** One Agent bound to a Project. The generation hash sorts agents by `id`. */
export type AgentBinding = {
  id: string;
  role: string;
  roleDir: string;
};

/** Left an open string: D21 renders an unrecognised provider as DS-14 rather than crashing on it. */
export type TicketProvider = {
  type: string;
};

/** A Project resolved from the pjangler Registry. */
export type ProjectRecord = {
  pjid: string;
  generation: number;
  repo: string;
  clonePath: string;
  /**
   * The Plane project bound as this Project's Board. An empty string for a boardless Project,
   * never null or absent; test board presence by truthiness only.
   */
  boardId: string;
  agents: AgentBinding[];
  ticketProvider: TicketProvider;
};

/** A resolution: the record plus what is degraded, or only what is degraded (e.g. DS-2). */
export type ProjectResponse = (ProjectRecord & { degraded: Degraded[] }) | { degraded: Degraded[] };
