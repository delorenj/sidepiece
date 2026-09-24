/**
 * The degraded-state taxonomy (FR-3). A new failure mode adds a `DsCode` and its row in
 * `EXPERIENCE.md`'s degraded-state table in the same change. That table is the authority
 * for every code, its producer and its wording; see `DEFINITION-OF-DONE.md` item 2.
 * The split by producer below is A-P2's: the Bridge can only ever send a `BridgeDsCode`.
 */

/** Codes only the Cockpit can know: the tab, the transport to the Bridge, the handshake. */
export type ClientDsCode = 'DS-1' | 'DS-3' | 'DS-4' | 'DS-5' | 'DS-16' | 'DS-21' | 'DS-27';

/** Codes the Bridge produces and sends in `degraded[]`. */
export type BridgeDsCode =
  | 'DS-2'
  | 'DS-6'
  | 'DS-7'
  | 'DS-8'
  | 'DS-9'
  | 'DS-10'
  | 'DS-11'
  | 'DS-12'
  | 'DS-13'
  | 'DS-14'
  | 'DS-15'
  | 'DS-17'
  | 'DS-18'
  | 'DS-19'
  | 'DS-20'
  | 'DS-22'
  | 'DS-23'
  | 'DS-24'
  | 'DS-25'
  | 'DS-26'
  | 'DS-28';

export type DsCode = BridgeDsCode | ClientDsCode;

/** One degraded state as the Bridge sends it: a code plus typed params, never prose. */
export type Degraded = {
  ds: BridgeDsCode;
  params?: Record<string, string>;
  remedy?: string;
};

/** Not a `DsCode`: a refused mutation is scoped to that mutation, and nothing is degraded once it is refused. */
export type Refusal = {
  error: 'stale_generation';
  pjid: string;
  received: number;
  current: number;
};

/** Not a `DsCode`: SSE subscription state is a property of one open, not of the Project (EXPERIENCE.md "Reopen cold start" rule 6). */
export type SubscriptionState = 'pending' | 'established' | 'not_established';

/** Not a `DsCode`: a `sidePanel.open()` gesture error is an icon transient, not a Project state (EXPERIENCE.md "Extension icon states"). */
export type IconTransient = 'open_gesture_rejected';
