import type { Degraded } from '@sidepiece/contract';
import { fetchRegistry, registryFailure } from '../registry/client.ts';
import type { RegistrySnapshot } from '../registry/snapshot.ts';

/**
 * The health leg for the pjangler Registry: one whole fetch (which rewrites the snapshot, as
 * every successful fetch does), judged by the same DS-6/DS-7 discriminator as resolution.
 * `[]` is healthy. Anything that is not a registry failure is a Bridge bug and is rethrown.
 */
export function registryHealth(
  registryUrl: string,
  snapshot?: RegistrySnapshot,
): () => Promise<Degraded[]> {
  return async () => {
    try {
      await fetchRegistry(registryUrl, snapshot);
      return [];
    } catch (err) {
      const failure = registryFailure(err, registryUrl);
      if (failure === undefined) throw err;
      return [failure];
    }
  };
}
