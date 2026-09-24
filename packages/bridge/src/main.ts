import { CONTRACT_VERSION } from '@sidepiece/contract';
import { log } from './log.ts';
import { nodeRefusal } from './node-pin.ts';
import { createBridgeServer } from './server/http.ts';

// The pin runs first: before any env parsing, listen, file or DB access. The static imports
// above carry no side effects (`node:http` opens nothing until `listen`), so the bundle stays
// one file with no dynamic import.
const refusal = nodeRefusal(process.versions.node, process.version);
if (refusal !== undefined) {
  process.stderr.write(`${refusal}\n`);
  process.exit(1);
}

/** Never configurable: the tailnet reaches the Bridge through `tailscale serve`, not a bind. */
const HOST = '127.0.0.1';
const DEFAULT_PORT = 8787;

function parsePort(raw: string | undefined): number | undefined {
  if (raw === undefined) return DEFAULT_PORT;
  if (!/^\d{1,5}$/.test(raw)) return undefined;
  const port = Number(raw);
  return port <= 65535 ? port : undefined;
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

const server = createBridgeServer({ startedAt: new Date().toISOString() });

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
  server.close(() => process.exit(0));
  server.closeAllConnections();
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
