import { type ExecFileException, execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { childEnv } from '../credentials/vault.ts';
import { log as defaultLog, type Logger } from '../log.ts';
import type { RelayProbe } from './aggregator.ts';

/**
 * `relayed` on `/v1/health`: whether the caller's tailnet path goes through DERP (DS-15). It
 * is read from `tailscale status --json` for the Peer whose `TailscaleIPs` holds the client IP
 * from `X-Forwarded-For`: relayed when there is no direct address (`CurAddr === ''`) and a
 * DERP region is set (`Relay !== ''`). `Relay` alone is the peer's home region, set even when
 * direct, so it is never enough. Never inferred from latency.
 *
 * Anything that cannot be known (no client IP, Self, loopback, an unknown IP, a missing or
 * failing `tailscale`) is `false`. A failure to ask is an info line, not a warn: no DsCode
 * names "could not ask tailscale", and reporting DS-15 from it would be a guess.
 */
export const TAILSCALE_TIMEOUT_MS = 2_000;
/** A tailnet's whole status; generous, since a large tailnet lists every peer. */
const TAILSCALE_MAX_BUFFER = 4 * 1024 * 1024;

export type RelayUnknownReason =
  | 'tailscale_bin_invalid'
  | 'tailscale_failed'
  | 'timeout'
  | 'unparseable';

export type TailscaleOutcome =
  | { kind: 'ok'; stdout: string }
  | { kind: 'failed'; detail: string }
  | { kind: 'timeout' };

/** Runs `bin status --json`; never rejects. */
export type TailscaleRunner = (bin: string, signal: AbortSignal) => Promise<TailscaleOutcome>;

/**
 * The real runner: `execFile` with an explicit timeout, SIGKILL, and its own `maxBuffer` (the
 * vault's 64 KiB is too small for a status dump). An abort, or a backstop just past the
 * timeout, answers `timeout` even while a killed child's grandchild holds the pipes open.
 */
export const execTailscale: TailscaleRunner = (bin, signal) =>
  new Promise((resolve) => {
    let settled = false;
    const settle = (outcome: TailscaleOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(backstop);
      signal.removeEventListener('abort', stop);
      resolve(outcome);
    };
    const child = execFile(
      bin,
      ['status', '--json'],
      {
        env: childEnv(process.env),
        timeout: TAILSCALE_TIMEOUT_MS,
        killSignal: 'SIGKILL',
        maxBuffer: TAILSCALE_MAX_BUFFER,
        encoding: 'utf8',
        windowsHide: true,
      },
      (err: ExecFileException | null, stdout: string, stderr: string) => {
        if (err === null) return settle({ kind: 'ok', stdout });
        if (err.killed && typeof err.code !== 'string') return settle({ kind: 'timeout' });
        settle({ kind: 'failed', detail: stderr.trim() || err.message });
      },
    );
    const stop = () => {
      child.kill('SIGKILL');
      child.stdout?.destroy();
      child.stderr?.destroy();
      settle({ kind: 'timeout' });
    };
    const backstop = setTimeout(stop, TAILSCALE_TIMEOUT_MS + 250);
    backstop.unref();
    if (signal.aborted) stop();
    else signal.addEventListener('abort', stop, { once: true });
  });

export type RelayOptions = {
  tailscaleBin: string | undefined;
  run?: TailscaleRunner;
  logger?: Logger;
};

type Peer = { TailscaleIPs?: unknown; CurAddr?: unknown; Relay?: unknown };

function peersOf(status: unknown): Peer[] | undefined {
  if (typeof status !== 'object' || status === null) return undefined;
  const { Peer: peers } = status as { Peer?: unknown };
  // A lone node has no peers: `Peer` is absent or null, which is not unparseable.
  if (peers === undefined || peers === null) return [];
  if (typeof peers !== 'object' || Array.isArray(peers)) return undefined;
  return Object.values(peers).filter((p): p is Peer => typeof p === 'object' && p !== null);
}

export function relayHealth(options: RelayOptions): RelayProbe {
  const { tailscaleBin: bin, run = execTailscale, logger = defaultLog } = options;
  const unknown = (client: string, reason: RelayUnknownReason, detail?: string): false => {
    logger({
      level: 'info',
      event: 'relay_unknown',
      client,
      reason,
      ...(detail !== undefined && detail !== '' ? { detail } : {}),
    });
    return false;
  };

  return async (clientIp, signal) => {
    if (clientIp === undefined || clientIp === '') return false;
    if (bin === undefined || !isAbsolute(bin)) return unknown(clientIp, 'tailscale_bin_invalid');
    const outcome = await run(bin, signal);
    if (outcome.kind === 'timeout') return unknown(clientIp, 'timeout');
    if (outcome.kind === 'failed') return unknown(clientIp, 'tailscale_failed', outcome.detail);
    let peers: Peer[] | undefined;
    try {
      peers = peersOf(JSON.parse(outcome.stdout));
    } catch (err) {
      return unknown(clientIp, 'unparseable', err instanceof Error ? err.message : String(err));
    }
    if (peers === undefined) return unknown(clientIp, 'unparseable');
    const peer = peers.find(
      (p) => Array.isArray(p.TailscaleIPs) && p.TailscaleIPs.includes(clientIp),
    );
    if (peer === undefined) return false;
    return peer.CurAddr === '' && typeof peer.Relay === 'string' && peer.Relay !== '';
  };
}
