import { isAbsolute, join, relative, resolve } from 'node:path';

/** Never configurable: the tailnet reaches the Bridge through `tailscale serve`, not a bind. */
export const HOST = '127.0.0.1';
export const DEFAULT_PORT = 8787;

/**
 * `SIDEPIECE_BRIDGE_PORT`, for tests only: unset means {@link DEFAULT_PORT}, `0` means
 * ephemeral, anything that is not an integer in 0..65535 is `undefined` (refuse to start).
 */
export function parsePort(raw: string | undefined): number | undefined {
  if (raw === undefined) return DEFAULT_PORT;
  if (!/^\d{1,5}$/.test(raw)) return undefined;
  const port = Number(raw);
  return port <= 65535 ? port : undefined;
}

/** The deploy target (architecture L482), relative to home. State must never live under it. */
export const DEPLOY_TARGET_DIR = '.local/lib/sidepiece';
/** The default state dir, relative to home, when `SIDEPIECE_STATE_DIR` is unset. */
export const DEFAULT_STATE_DIR = '.local/state/sidepiece';

function isAtOrUnder(child: string, parent: string): boolean {
  const rel = relative(resolve(parent), child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * `SIDEPIECE_STATE_DIR`: unset means `~/.local/state/sidepiece`. An empty or relative value,
 * or one at or under the deploy target or the running bundle's own directory, is `undefined`
 * (refuse to start): a deploy must never be able to overwrite the Turn store. Pure.
 */
export function resolveStateDir(
  raw: string | undefined,
  { home, bundleDir }: { home: string; bundleDir: string },
): string | undefined {
  if (raw !== undefined && (raw === '' || !isAbsolute(raw))) return undefined;
  const dir = resolve(raw ?? join(home, DEFAULT_STATE_DIR));
  if (isAtOrUnder(dir, join(home, DEPLOY_TARGET_DIR))) return undefined;
  if (isAtOrUnder(dir, bundleDir)) return undefined;
  return dir;
}
