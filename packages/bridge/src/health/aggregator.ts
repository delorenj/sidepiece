import {
  DEPENDENCY_NAMES,
  type Degraded,
  type DependencyHealth,
  type DependencyName,
} from '@sidepiece/contract';

/**
 * The `/v1/health` aggregator (Story 1.13). One row per `DEPENDENCY_NAMES` entry, in that
 * order. A probe is registered against exactly one name and never names its row: the
 * aggregator stamps the key, so no probe can report for two upstreams. A name with nothing
 * registered is `unprobed`. A later story adds an upstream by registering here, not by editing.
 *
 * `degraded[]` is derived only from the rows (each failing row's entries, in row order),
 * then `{ds:'DS-15'}` when the caller's path is relayed. There is no other list.
 */
export const HEALTH_PROBE_TIMEOUT_MS = 2_000;

export type FailingOutcome = {
  status: 'failing';
  /** The row's `ds` is `degraded[0].ds`; an empty list is a probe bug (`TypeError`). */
  degraded: [Degraded, ...Degraded[]];
  /** The upstream's own error text, verbatim. Never a sentence of ours. */
  detail?: string;
};
export type ProbeOutcome = { status: 'ok' } | FailingOutcome;

export type DependencyProbe = {
  /** `signal` aborts once the row has taken {@link DependencyProbe.timedOut}. */
  run(signal: AbortSignal): Promise<ProbeOutcome>;
  /** The row when `run` has not settled within the timeout. */
  timedOut(): FailingOutcome;
};

/** Whether the caller's tailnet path is DERP-relayed; `false` whenever it cannot be known. */
export type RelayProbe = (clientIp: string | undefined, signal: AbortSignal) => Promise<boolean>;

export type HealthAnswer = {
  relayed: boolean;
  dependencies: DependencyHealth[];
  degraded: Degraded[];
};
export type Health = (clientIp: string | undefined) => Promise<HealthAnswer>;

export type HealthOptions = {
  probes?: Partial<Record<DependencyName, DependencyProbe>>;
  relay?: RelayProbe;
  now?: () => Date;
  timeoutMs?: number;
};

type Row = { row: DependencyHealth; degraded: readonly Degraded[] };

class Timeout extends Error {}

/** `work(signal)`, or {@link Timeout} after `ms`, whichever first; `signal` aborts on expiry. */
async function raced<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort(new Timeout(`timed out after ${ms}ms`));
      reject(new Timeout());
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), expired]);
  } finally {
    clearTimeout(timer);
  }
}

function assertFailing(name: DependencyName, outcome: FailingOutcome): Degraded {
  const first = outcome.degraded[0];
  if (first === undefined) {
    throw new TypeError(`health probe ${name} reported failing with no degraded entry`);
  }
  return first;
}

export function createHealth(options: HealthOptions = {}): Health {
  const {
    probes = {},
    relay = async () => false,
    now = () => new Date(),
    timeoutMs = HEALTH_PROBE_TIMEOUT_MS,
  } = options;

  async function row(name: DependencyName, checkedAt: string): Promise<Row> {
    const probe = probes[name];
    if (probe === undefined) {
      return { row: { name, status: 'unprobed', checkedAt }, degraded: [] };
    }
    const started = performance.now();
    let outcome: ProbeOutcome;
    try {
      outcome = await raced(timeoutMs, (signal) => probe.run(signal));
    } catch (err) {
      if (!(err instanceof Timeout)) throw err;
      outcome = probe.timedOut();
    }
    const latencyMs = Math.round((performance.now() - started) * 100) / 100;
    const at = now().toISOString();
    if (outcome.status === 'ok') {
      return { row: { name, status: 'ok', checkedAt: at, latencyMs }, degraded: [] };
    }
    const first = assertFailing(name, outcome);
    const failing: DependencyHealth = {
      name,
      status: 'failing',
      ds: first.ds,
      ...(outcome.detail !== undefined ? { detail: outcome.detail } : {}),
      checkedAt: at,
      latencyMs,
    };
    return { row: failing, degraded: outcome.degraded };
  }

  return async (clientIp) => {
    const checkedAt = now().toISOString();
    const [relayed, ...rows] = await Promise.all([
      raced(timeoutMs, (signal) => relay(clientIp, signal)).catch((err: unknown) => {
        if (err instanceof Timeout) return false;
        throw err;
      }),
      ...DEPENDENCY_NAMES.map((name) => row(name, checkedAt)),
    ]);
    const degraded: Degraded[] = rows.flatMap((r) => r.degraded);
    if (relayed) degraded.push({ ds: 'DS-15' });
    return { relayed, dependencies: rows.map((r) => r.row), degraded };
  };
}
