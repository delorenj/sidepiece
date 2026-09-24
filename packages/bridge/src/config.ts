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
