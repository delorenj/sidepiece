import { type ChildProcess, spawn } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

/**
 * Nothing listens on port 1: a spawned Bridge that was not handed a registry answers DS-6
 * rather than reaching the developer's `SIDEPIECE_REGISTRY_URL` or the live default.
 */
export const UNROUTABLE_REGISTRY_URL = 'http://127.0.0.1:1';

/** What the stub vault's fake `op` prints for any reference. Not a secret. */
export const FAKE_RESOLVED_VALUE = 'stub-resolved-credential-value';
/** The stub vault's `op-token` content. Not a secret. */
export const FAKE_OP_TOKEN = 'stub-op-bootstrap-token';

export type StubVault = {
  /** Pass as `CREDENTIALS_DIRECTORY`: holds `op-token`. */
  dir: string;
  /** Pass as `OP_BIN`: an executable `#!/bin/sh` fake `op`. */
  opBin: string;
  env: { CREDENTIALS_DIRECTORY: string; OP_BIN: string };
  remove(): void;
};

/**
 * A temp dir holding `op-token` and a fake `op` whose body is `script` (default: print
 * {@link FAKE_RESOLVED_VALUE}). The shebang is absolute and the default body uses only shell
 * builtins, so it works with PATH stripped. The caller removes it.
 */
export function stubVault(
  script = `printf '%s' '${FAKE_RESOLVED_VALUE}'`,
  token = FAKE_OP_TOKEN,
): StubVault {
  const dir = mkdtempSync(join(tmpdir(), 'sidepiece-vault-'));
  writeFileSync(join(dir, 'op-token'), `${token}\n`);
  const opBin = join(dir, 'op');
  writeFileSync(opBin, `#!/bin/sh\n${script}\n`);
  chmodSync(opBin, 0o755);
  return {
    dir,
    opBin,
    env: { CREDENTIALS_DIRECTORY: dir, OP_BIN: opBin },
    remove: () => rmSync(dir, { recursive: true, force: true }),
  };
}

let shared: StubVault | undefined;
/**
 * The default vault every spawned Bridge gets, so existing exact `degraded` assertions do not
 * gain DS-8. Created once per test process and removed on exit.
 */
export function defaultVaultEnv(): StubVault['env'] {
  if (shared === undefined) {
    const created = stubVault();
    shared = created;
    process.once('exit', () => created.remove());
  }
  return shared.env;
}

export type LogRecord = Record<string, unknown>;
export type Running = {
  child: ChildProcess;
  port: number;
  host: string;
  stateDir: string;
  /** Every JSON line the Bridge has logged so far; keeps filling while it runs. */
  lines: LogRecord[];
};

/**
 * A fresh temp state dir under the OS temp dir, so a spawned Bridge never writes into the
 * real `~/.local/state` and never under the bundle's own directory. The caller removes it.
 */
export function tempStateDir(): string {
  return mkdtempSync(join(tmpdir(), 'sidepiece-state-'));
}

/** State dirs `startBridge` created itself; `stopBridge` removes them. */
const owned = new WeakMap<ChildProcess, string>();

/**
 * Start a bundle and wait for its `listening` JSON line; rejects on exit or after 10s.
 * Without a state dir, a fresh one from {@link tempStateDir} is used and removed again by
 * {@link stopBridge} (or on a failed start). A caller-passed dir is the caller's to remove.
 * `extraEnv` is layered last, e.g. `SIDEPIECE_REGISTRY_URL` pointing at a stub registry. The
 * default stub vault ({@link defaultVaultEnv}) comes before it, so a test can override either.
 */
export function startBridge(
  bundle: string,
  cwd: string,
  given?: string,
  extraEnv: Record<string, string> = {},
): Promise<Running> {
  const stateDir = given ?? tempStateDir();
  const child = spawn(process.execPath, [bundle], {
    cwd,
    env: {
      ...process.env,
      SIDEPIECE_BRIDGE_PORT: '0',
      SIDEPIECE_STATE_DIR: stateDir,
      SIDEPIECE_REGISTRY_URL: UNROUTABLE_REGISTRY_URL,
      ...defaultVaultEnv(),
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 30_000,
  });
  if (given === undefined) owned.set(child, stateDir);
  const lines: LogRecord[] = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      dropOwned();
      reject(new Error('bridge did not log listening within 10s'));
    }, 10_000);
    // A no-op after resolve; never removeAllListeners('exit'), which would also drop the
    // listener that clears spawn()'s own timeout and keep the test process alive.
    const dropOwned = () => {
      if (given === undefined) rmSync(stateDir, { recursive: true, force: true });
    };
    child.once('exit', (code) => {
      clearTimeout(timer);
      dropOwned();
      reject(new Error(`bridge exited early with ${code}`));
    });
    child.once('error', (err) => {
      clearTimeout(timer);
      dropOwned();
      reject(err);
    });
    const stdout = child.stdout;
    if (stdout === null) return reject(new Error('no stdout'));
    createInterface({ input: stdout }).on('line', (line) => {
      let parsed: LogRecord;
      try {
        parsed = JSON.parse(line) as LogRecord;
      } catch {
        return; // not a log line; the Bridge only ever writes JSON, so the timeout will say so
      }
      lines.push(parsed);
      if (parsed.event === 'listening' && typeof parsed.port === 'number') {
        clearTimeout(timer);
        resolve({ child, port: parsed.port, host: String(parsed.host), stateDir, lines });
      }
    });
  });
}

export function stopBridge(child: ChildProcess): Promise<number | null> {
  const cleanup = (code: number | null) => {
    const dir = owned.get(child);
    if (dir !== undefined) {
      rmSync(dir, { recursive: true, force: true });
      owned.delete(child);
    }
    return code;
  };
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      return resolve(cleanup(child.exitCode));
    }
    child.once('exit', (code) => resolve(cleanup(code)));
    child.kill('SIGTERM');
  });
}
