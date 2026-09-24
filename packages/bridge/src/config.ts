import { realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

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
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** `realpathSync`, or `undefined` when the path does not exist (or cannot be read). */
export function realpathOrUndefined(path: string): string | undefined {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

/**
 * The canonical form of a path that may not exist yet: the realpath of its longest existing
 * ancestor, with the missing tail appended. Defeats a symlink into the deploy tree.
 */
function canonical(path: string, realpath: (p: string) => string | undefined): string {
  let head = resolve(path);
  const tail: string[] = [];
  for (;;) {
    const real = realpath(head);
    if (real !== undefined) return join(real, ...tail);
    const parent = dirname(head);
    if (parent === head) return resolve(path);
    tail.unshift(basename(head));
    head = parent;
  }
}

export type StateDirContext = {
  home: string;
  bundleDir: string;
  /** Injected for tests; defaults to {@link realpathOrUndefined}. Only reads the filesystem. */
  realpath?: (path: string) => string | undefined;
};

/** The state dir a raw `SIDEPIECE_STATE_DIR` asks for, before any refusal (for logging). */
export function requestedStateDir(raw: string | undefined, home: string): string {
  return raw ?? join(home, DEFAULT_STATE_DIR);
}

/**
 * `SIDEPIECE_STATE_DIR`: unset means `~/.local/state/sidepiece`. An empty or relative value,
 * or one at or under the deploy target or the running bundle's own directory (lexically or
 * through a symlink), is `undefined` (refuse to start): a deploy must never be able to
 * overwrite the Turn store. Creates nothing.
 */
export function resolveStateDir(
  raw: string | undefined,
  { home, bundleDir, realpath = realpathOrUndefined }: StateDirContext,
): string | undefined {
  if (raw !== undefined && (raw === '' || !isAbsolute(raw))) return undefined;
  const dir = resolve(requestedStateDir(raw, home));
  const real = canonical(dir, realpath);
  for (const forbidden of [resolve(home, DEPLOY_TARGET_DIR), resolve(bundleDir)]) {
    if (isAtOrUnder(dir, forbidden)) return undefined;
    if (isAtOrUnder(real, canonical(forbidden, realpath))) return undefined;
  }
  return dir;
}

/** The live `pjangler-project-registry.service`. */
export const DEFAULT_REGISTRY_URL = 'http://127.0.0.1:8764';

/**
 * `SIDEPIECE_REGISTRY_URL`: unset means {@link DEFAULT_REGISTRY_URL}. Anything that is not an
 * absolute `http:`/`https:` URL is `undefined` (refuse to start). Trailing slashes are dropped
 * so `<url>/v1/registry` joins cleanly.
 */
export function parseRegistryUrl(raw: string | undefined): string | undefined {
  if (raw === undefined) return DEFAULT_REGISTRY_URL;
  if (!/^https?:\/\/[^/]/i.test(raw)) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
  } catch {
    return undefined;
  }
  return raw.replace(/\/+$/, '');
}
