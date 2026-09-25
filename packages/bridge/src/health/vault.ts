import type { Degraded } from '@sidepiece/contract';
import { CREDENTIALS, type Credential, type Vault } from '../credentials/vault.ts';
import type { DependencyProbe } from './aggregator.ts';

/**
 * The `vault` row: every DS-8 `vault.probe()` reports, in declaration order. No `detail`: the
 * `op` error is logged on `credential_unresolved`, not sent. A timeout is DS-8 for every
 * declared credential, since none is known to have resolved.
 */
export function vaultHealth(
  vault: Pick<Vault, 'probe'>,
  credentials: readonly Credential[] = CREDENTIALS,
): DependencyProbe {
  const all = (): Degraded[] =>
    credentials.map((c) => ({
      ds: 'DS-8',
      params: { credential: c.ref, dependency: c.dependency },
    }));
  return {
    async run() {
      const [first, ...rest] = await vault.probe();
      return first === undefined
        ? { status: 'ok' }
        : { status: 'failing', degraded: [first, ...rest] };
    },
    timedOut() {
      const [first, ...rest] = all();
      if (first === undefined)
        throw new Error('vault health timed out with no credential declared');
      return { status: 'failing', degraded: [first, ...rest] };
    },
  };
}
