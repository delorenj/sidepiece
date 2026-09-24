/**
 * The Node pin (AR25, FR-15(d)). A drifted runtime must refuse to start, loudly, rather than
 * fail hours later as a Degraded nobody can attribute. Pure: no process access, no I/O.
 */
export const NODE_PIN = '>=24.15.0 <25';

const MIN = [24, 15, 0] as const;
const MAJOR = 24;

/**
 * @param versions `process.versions.node`, e.g. `24.15.0`
 * @param version `process.version`, e.g. `v24.15.0`, quoted verbatim in the refusal
 * @returns the refusal line (without newline), or `undefined` when the runtime satisfies the pin
 */
export function nodeRefusal(versions: string, version: string): string | undefined {
  const refusal = `sidepiece-bridge requires Node ${NODE_PIN}; this is ${version}. Refusing to start.`;
  // Anchored: a prerelease or nightly (`24.15.0-rc.1`) is not the pinned release, so it is refused.
  const match = versions.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (match === null) return refusal;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (parts[0] !== MAJOR) return refusal;
  for (let i = 0; i < 3; i++) {
    const have = parts[i] ?? 0;
    const need = MIN[i] ?? 0;
    if (have > need) return undefined;
    if (have < need) return refusal;
  }
  return undefined;
}
