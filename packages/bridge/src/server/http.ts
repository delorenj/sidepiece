import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type BridgeError, type BridgeHealth, CONTRACT_VERSION } from '@sidepiece/contract';
import { log as defaultLog, type Logger } from '../log.ts';
import { toErrorResponse } from './errors.ts';

export type HandlerResult = { status: number; body: unknown };
export type Handler = (req: IncomingMessage) => HandlerResult | Promise<HandlerResult>;
/** pathname -> method -> handler. Routing uses the pathname only; the query is ignored. */
export type RouteTable = Record<string, Partial<Record<string, Handler>>>;

export type BridgeServerOptions = {
  /** Merged over the built-in routes; tests inject throwing handlers here. */
  routes?: RouteTable;
  /** ISO 8601 UTC process start, echoed on `/v1/health`. */
  startedAt: string;
  log?: Logger;
};

function healthHandler(startedAt: string): Handler {
  return () => {
    const body: BridgeHealth = {
      status: 'ok',
      contractVersion: CONTRACT_VERSION,
      node: process.version,
      startedAt,
      checkedAt: new Date().toISOString(),
      degraded: [],
    };
    return { status: 200, body };
  };
}

function clientOf(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  const first = raw?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

function send(
  res: ServerResponse,
  status: number,
  body: unknown,
  extra: Record<string, string> = {},
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'X-Sidepiece-Contract': String(CONTRACT_VERSION),
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(payload)),
    ...extra,
  });
  res.end(payload);
}

export function createBridgeServer(options: BridgeServerOptions): Server {
  const log = options.log ?? defaultLog;
  const routes: RouteTable = {
    '/v1/health': { GET: healthHandler(options.startedAt) },
    ...options.routes,
  };

  return createServer((req, res) => {
    const started = performance.now();
    const method = req.method ?? 'GET';
    let path = '/';
    try {
      path = new URL(req.url ?? '/', 'http://bridge.invalid').pathname;
    } catch {
      path = req.url ?? '/';
    }

    res.on('finish', () => {
      log({
        level: 'info',
        event: 'request',
        method,
        path,
        status: res.statusCode,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        client: clientOf(req),
      });
    });

    const route = routes[path];
    if (route === undefined) {
      const body: BridgeError = { error: 'not_found', path };
      send(res, 404, body);
      return;
    }
    const handler = route[method];
    if (handler === undefined) {
      const body: BridgeError = { error: 'method_not_allowed', method, path };
      send(res, 405, body, { Allow: Object.keys(route).join(', ') });
      return;
    }

    Promise.resolve()
      .then(() => handler(req))
      .then(
        (result) => send(res, result.status, result.body),
        (err: unknown) => {
          const mapped = toErrorResponse(err);
          if (mapped.status === 500) {
            log({
              level: 'error',
              event: 'handler_failed',
              ds: 'DS-5',
              method,
              path,
              ...(err instanceof Error ? { detail: err.message } : {}),
            });
          }
          send(res, mapped.status, mapped.body);
        },
      )
      .catch(() => {
        // `send` itself failed (e.g. the socket is gone); nothing left to answer.
        if (!res.headersSent) send(res, 500, { error: 'internal_error' } satisfies BridgeError);
      });
  });
}
