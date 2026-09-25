import { type ExecFileException, execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import type { Degraded } from '@sidepiece/contract';
import { log as defaultLog, type Logger } from '../log.ts';

/**
 * Every credential comes from 1Password (D18). The Bridge holds one bootstrap secret, the
 * service-account token systemd hands it as `$CREDENTIALS_DIRECTORY/op-token`, and resolves
 * each declared `op://` reference with `$OP_BIN read`, in a child that alone receives the token.
 *
 * A missing credential never exits the Bridge and never delays `listen`: it is DS-8 on health
 * (`{credential, dependency}`), and the next call that needs it retries. A success is cached
 * for the process lifetime; rotating a cached key needs a restart. No resolved value and no
 * token is ever logged, written, or returned in a response; the `op://` reference is.
 */
export type Credential = { ref: string; dependency: string };

/** The declared credentials, in declaration order (the order DS-8 entries follow). */
export const CREDENTIALS: readonly Credential[] = [
  { ref: 'op://DeLoSecrets/Plane/apiKey', dependency: 'plane' },
];

export const OP_READ_TIMEOUT_MS = 2_000;
/** `op read` of one field is a few hundred bytes; anything past this is not a credential. */
const OP_MAX_BUFFER = 64 * 1024;
/** The name systemd's `LoadCredential=op-token:...` gives the file in `$CREDENTIALS_DIRECTORY`. */
export const OP_TOKEN_CREDENTIAL = 'op-token';
const TOKEN_ENV = 'OP_SERVICE_ACCOUNT_TOKEN';

export type UnresolvedReason =
  | 'no_bootstrap_token'
  | 'op_bin_invalid'
  | 'op_failed'
  | 'timeout'
  | 'empty';

export type Resolution =
  | { ok: true; value: string }
  | { ok: false; reason: UnresolvedReason; detail?: string };

export type RunOutcome =
  | { kind: 'exited'; code: number; stdout: string; stderr: string }
  | { kind: 'timeout' }
  | { kind: 'spawn_error'; message: string };

/** Runs `file args` with exactly `env`; never rejects. Injectable for tests. */
export type Runner = (
  file: string,
  args: readonly string[],
  env: Record<string, string>,
) => Promise<RunOutcome>;

/**
 * Read the bootstrap token once, at startup: `$CREDENTIALS_DIRECTORY/op-token` with only the
 * trailing newline stripped. An unset dir, a missing or unreadable file, or empty content is
 * "no token" (`undefined`). `OP_SERVICE_ACCOUNT_TOKEN` is deleted from `env` either way and is
 * never a token source.
 */
export function readBootstrapToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  delete env[TOKEN_ENV];
  const dir = env.CREDENTIALS_DIRECTORY;
  if (!dir) return undefined;
  let raw: string;
  try {
    raw = readFileSync(join(dir, OP_TOKEN_CREDENTIAL), 'utf8');
  } catch {
    return undefined;
  }
  const token = raw.endsWith('\n') ? raw.slice(0, -1) : raw;
  return token === '' ? undefined : token;
}

/** A copy of `env` without the token. Every non-`op` child (`bb`, `tailscale`) is spawned with it. */
export function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const copy = { ...env };
  delete copy[TOKEN_ENV];
  return copy;
}

/** The `op` child's whole environment: the token and HOME, plus XDG_CONFIG_HOME when set. */
export function opEnv(token: string, env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const out: Record<string, string> = { [TOKEN_ENV]: token };
  if (env.HOME !== undefined) out.HOME = env.HOME;
  if (env.XDG_CONFIG_HOME !== undefined) out.XDG_CONFIG_HOME = env.XDG_CONFIG_HOME;
  return out;
}

/**
 * The real runner: `execFile` with an explicit timeout, SIGKILL, and a small `maxBuffer`.
 * A backstop timer answers `timeout` even when a killed child's grandchild keeps its stdout
 * open (execFile only calls back once the pipes close).
 */
export const execFileRunner: Runner = (file, args, env) =>
  new Promise((resolve) => {
    let settled = false;
    const settle = (outcome: RunOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(backstop);
      resolve(outcome);
    };
    const child = execFile(
      file,
      [...args],
      {
        env,
        timeout: OP_READ_TIMEOUT_MS,
        killSignal: 'SIGKILL',
        maxBuffer: OP_MAX_BUFFER,
        encoding: 'utf8',
        windowsHide: true,
      },
      (err: ExecFileException | null, stdout: string, stderr: string) => {
        if (err === null) return settle({ kind: 'exited', code: 0, stdout, stderr });
        if (typeof err.code === 'number') {
          return settle({ kind: 'exited', code: err.code, stdout, stderr });
        }
        // A string code is a spawn failure (ENOENT, EACCES) or ERR_CHILD_PROCESS_STDIO_MAXBUFFER.
        if (typeof err.code === 'string')
          return settle({ kind: 'spawn_error', message: err.message });
        if (err.killed) return settle({ kind: 'timeout' });
        return settle({ kind: 'spawn_error', message: err.message });
      },
    );
    const backstop = setTimeout(() => {
      child.kill('SIGKILL');
      child.stdout?.destroy();
      child.stderr?.destroy();
      settle({ kind: 'timeout' });
    }, OP_READ_TIMEOUT_MS + 250);
    backstop.unref();
  });

export type Vault = {
  /** The cached value, or a resolution attempt now. A failure is never cached. */
  get(ref: string): Promise<Resolution>;
  /** The startup pass: fire and forget. Never rejects. */
  resolveAll(): Promise<void>;
  /** One DS-8 per unresolved declared credential, in declaration order. Never throws. */
  probe(): Promise<Degraded[]>;
};

export type VaultOptions = {
  token: string | undefined;
  opBin: string | undefined;
  credentials?: readonly Credential[];
  run?: Runner;
  logger?: Logger;
  /** Where HOME and XDG_CONFIG_HOME for the `op` child come from. */
  env?: NodeJS.ProcessEnv;
};

export function createVault(options: VaultOptions): Vault {
  const {
    token,
    opBin,
    credentials = CREDENTIALS,
    run = execFileRunner,
    logger = defaultLog,
    env = process.env,
  } = options;
  const cache = new Map<string, string>();
  const inFlight = new Map<string, Promise<Resolution>>();

  /** Never let op's stderr echo the token into a log line. */
  const scrub = (text: string) =>
    token === undefined ? text : text.split(token).join('[redacted]');

  async function attempt(ref: string): Promise<Resolution> {
    if (token === undefined) return { ok: false, reason: 'no_bootstrap_token' };
    if (opBin === undefined || !isAbsolute(opBin)) return { ok: false, reason: 'op_bin_invalid' };
    const outcome = await run(opBin, ['read', '--no-newline', ref], opEnv(token, env));
    switch (outcome.kind) {
      case 'timeout':
        return { ok: false, reason: 'timeout' };
      case 'spawn_error':
        return { ok: false, reason: 'op_failed', detail: scrub(outcome.message) };
      case 'exited':
        if (outcome.code !== 0) {
          const detail = scrub(outcome.stderr.trim());
          return { ok: false, reason: 'op_failed', ...(detail ? { detail } : {}) };
        }
        if (outcome.stdout === '') return { ok: false, reason: 'empty' };
        return { ok: true, value: outcome.stdout };
    }
  }

  function dependencyOf(ref: string): string {
    const declared = credentials.find((c) => c.ref === ref);
    if (declared === undefined) throw new Error(`undeclared credential ${ref}`);
    return declared.dependency;
  }

  async function get(ref: string): Promise<Resolution> {
    const cached = cache.get(ref);
    if (cached !== undefined) return { ok: true, value: cached };
    const pending = inFlight.get(ref);
    if (pending !== undefined) return pending;
    const dependency = dependencyOf(ref);
    const started = (async (): Promise<Resolution> => {
      let result: Resolution;
      try {
        result = await attempt(ref);
      } catch (err) {
        result = {
          ok: false,
          reason: 'op_failed',
          detail: scrub(err instanceof Error ? err.message : String(err)),
        };
      }
      if (result.ok) {
        cache.set(ref, result.value);
        logger({ level: 'info', event: 'credential_resolved', credential: ref, dependency });
      } else {
        logger({
          level: 'warn',
          event: 'credential_unresolved',
          ds: 'DS-8',
          credential: ref,
          dependency,
          reason: result.reason,
          ...(result.detail !== undefined ? { detail: result.detail } : {}),
        });
      }
      return result;
    })().finally(() => inFlight.delete(ref));
    inFlight.set(ref, started);
    return started;
  }

  async function probe(): Promise<Degraded[]> {
    const results = await Promise.all(
      credentials.map(async (c) => {
        try {
          return { c, r: await get(c.ref) };
        } catch {
          return { c, r: { ok: false } as const };
        }
      }),
    );
    return results
      .filter(({ r }) => !r.ok)
      .map(({ c }) => ({ ds: 'DS-8', params: { credential: c.ref, dependency: c.dependency } }));
  }

  return {
    get,
    probe,
    resolveAll: async () => {
      await probe();
    },
  };
}
