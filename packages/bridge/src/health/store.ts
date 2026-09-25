import type { Degraded } from '@sidepiece/contract';
import type { DependencyProbe } from './aggregator.ts';

/**
 * The `store` row. The Turn store is opened once, at startup; the only state health can
 * report is DS-25 (a store ahead of this build), read per request from `degraded()`.
 */
export function storeHealth(degraded: () => readonly Degraded[]): DependencyProbe {
  const ahead = () => degraded().find((d) => d.ds === 'DS-25');
  return {
    async run() {
      const ds25 = ahead();
      return ds25 === undefined ? { status: 'ok' } : { status: 'failing', degraded: [ds25] };
    },
    timedOut() {
      const ds25 = ahead();
      if (ds25 === undefined) throw new Error('store health timed out with no DS-25 to report');
      return { status: 'failing', degraded: [ds25] };
    },
  };
}
