import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACT_VERSION, type Degraded } from '@sidepiece/contract';
import { HOST, parsePort, resolveStateDir } from './config.ts';
import { log } from './log.ts';
import { nodeRefusal } from './node-pin.ts';
import { createBridgeServer } from './server/http.ts';
import { openStore, STORE_FILE, type TurnStore } from './turns/store.ts';

// The pin runs first: before any env parsing, listen, file or DB access. The static imports
// above carry no side effects (`node:http` opens nothing until `listen`), so the bundle stays
// one file with no dynamic import.
const refusal = nodeRefusal(process.versions.node, process.version);
if (refusal !== undefined) {
  process.stderr.write(`${refusal}\n`);
  process.exit(1);
}

const rawPort = process.env.SIDEPIECE_BRIDGE_PORT;
const port = parsePort(rawPort);
if (port === undefined) {
  log({
    level: 'error',
    event: 'config_invalid',
    ds: 'DS-4',
    key: 'SIDEPIECE_BRIDGE_PORT',
    value: rawPort ?? '',
  });
  process.exit(1);
}

// Startup order: pin -> port -> state dir -> store -> listen.
const rawStateDir = process.env.SIDEPIECE_STATE_DIR;
const stateDir = resolveStateDir(rawStateDir, {
  home: homedir(),
  bundleDir: dirname(fileURLToPath(import.meta.url)),
});
if (stateDir === undefined) {
  log({
    level: 'error',
    event: 'config_invalid',
    ds: 'DS-4',
    key: 'SIDEPIECE_STATE_DIR',
    value: rawStateDir ?? '',
  });
  process.exit(1);
}

// A store this build cannot open or migrate is DS-4: the listener never comes up, and
// `Restart=always` retries. A store ahead of this build is DS-25: the Bridge keeps serving.
let store: TurnStore | undefined;
let degraded: Degraded[] = [];
try {
  const opened = openStore(stateDir);
  if (opened.kind === 'ready') {
    store = opened.store;
    log({
      level: 'info',
      event: 'store_opened',
      path: store.path,
      userVersion: store.userVersion(),
      migratedFrom: opened.migratedFrom,
    });
  } else {
    log({
      level: 'warn',
      event: 'store_ahead',
      ds: 'DS-25',
      path: opened.path,
      storeVersion: opened.storeVersion,
      bridgeVersion: opened.bridgeVersion,
    });
    degraded = [
      {
        ds: 'DS-25',
        params: {
          storeVersion: String(opened.storeVersion),
          bridgeVersion: String(opened.bridgeVersion),
        },
      },
    ];
  }
} catch (err) {
  log({
    level: 'error',
    event: 'store_open_failed',
    ds: 'DS-4',
    path: join(stateDir, STORE_FILE),
    ...(err instanceof Error ? { detail: err.message } : {}),
  });
  process.exit(1);
}

const server = createBridgeServer({
  startedAt: new Date().toISOString(),
  degraded: () => degraded,
});

server.on('error', (err: NodeJS.ErrnoException) => {
  log({
    level: 'error',
    event: 'listen_failed',
    ds: 'DS-4',
    host: HOST,
    port,
    ...(err.code ? { code: err.code } : {}),
    detail: err.message,
  });
  process.exit(1);
});

server.listen(port, HOST, () => {
  const address = server.address();
  log({
    level: 'info',
    event: 'listening',
    host: HOST,
    port: typeof address === 'object' && address !== null ? address.port : port,
    contractVersion: CONTRACT_VERSION,
    node: process.version,
  });
});

function shutdown(signal: NodeJS.Signals) {
  log({ level: 'info', event: 'shutdown', signal });
  server.close(() => {
    store?.close();
    process.exit(0);
  });
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
