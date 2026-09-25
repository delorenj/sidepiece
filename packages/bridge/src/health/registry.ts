import { fetchRegistry, RegistryUnreachable, registryFailure } from '../registry/client.ts';
import type { RegistrySnapshot } from '../registry/snapshot.ts';
import type { DependencyProbe, FailingOutcome } from './aggregator.ts';

/**
 * The `registry` row: one whole fetch (which rewrites the snapshot, as every successful fetch
 * does), judged by the same DS-6/DS-7 discriminator as resolution (`registryFailure`, Story
 * 1.9); there is no second one here. DS-7's `detail` is the registry's own error, verbatim.
 * Anything that is not a registry failure is a Bridge bug and is rethrown.
 */
export function registryHealth(registryUrl: string, snapshot?: RegistrySnapshot): DependencyProbe {
  const failing = (err: unknown): FailingOutcome | undefined => {
    const failure = registryFailure(err, registryUrl);
    if (failure === undefined) return undefined;
    // Only DS-7 carries `error`; DS-6's params are `{endpoint}`, so it gets no detail.
    const detail = failure.params?.error;
    return { status: 'failing', degraded: [failure], ...(detail !== undefined ? { detail } : {}) };
  };
  return {
    async run() {
      try {
        await fetchRegistry(registryUrl, snapshot);
        return { status: 'ok' };
      } catch (err) {
        const outcome = failing(err);
        if (outcome === undefined) throw err;
        return outcome;
      }
    },
    timedOut() {
      const outcome = failing(new RegistryUnreachable('health probe timed out'));
      if (outcome === undefined) throw new Error('registryFailure did not classify a timeout');
      return outcome;
    },
  };
}
