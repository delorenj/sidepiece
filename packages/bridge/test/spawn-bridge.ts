import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

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

/**
 * Start a bundle and wait for its `listening` JSON line; rejects on exit or after 10s.
 * Without `stateDir`, a fresh one from {@link tempStateDir} is used.
 */
export function startBridge(
  bundle: string,
  cwd: string,
  stateDir = tempStateDir(),
): Promise<Running> {
  const child = spawn(process.execPath, [bundle], {
    cwd,
    env: { ...process.env, SIDEPIECE_BRIDGE_PORT: '0', SIDEPIECE_STATE_DIR: stateDir },
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 30_000,
  });
  const lines: LogRecord[] = [];
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('bridge did not log listening within 10s'));
    }, 10_000);
    // A no-op after resolve; never removeAllListeners('exit'), which would also drop the
    // listener that clears spawn()'s own timeout and keep the test process alive.
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`bridge exited early with ${code}`));
    });
    child.once('error', (err) => {
      clearTimeout(timer);
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
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(child.exitCode);
    child.once('exit', (code) => resolve(code));
    child.kill('SIGTERM');
  });
}
