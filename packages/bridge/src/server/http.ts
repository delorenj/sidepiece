import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  type BridgeError,
  type BridgeHealth,
  CONTRACT_VERSION,
  type Degraded,
} from '@sidepiece/contract';
import { log as defaultLog, type Logger } from '../log.ts';
import { toErrorResponse } from './errors.ts';

export type HandlerResult = { status: number; body: unknown };
/** The `:name` segments a pattern route matched, each `decodeURIComponent`-ed once. */
export type RouteParams = Readonly<Record<string, string>>;
export type Handler = (
  req: IncomingMessage,
  params: RouteParams,
) => HandlerResult | Promise<HandlerResult>;
/**
 * pathname -> method -> handler. Routing uses the pathname only; the query is ignored. A key
 * may hold `:name` segments (`'/v1/project/:pjid'`), each matching one non-empty segment; an
 * exact key wins over a pattern.
 */
export type RouteTable = Record<string, Partial<Record<string, Handler>>>;

export type BridgeServerOptions = {
  /**
   * Replaces whole pathname entries of the built-in table (not individual methods); tests
   * inject throwing handlers here.
   */
  routes?: RouteTable;
  /** ISO 8601 UTC process start, echoed on `/v1/health`. */
  startedAt: string;
  log?: Logger;
  /** A-P7: a handler that has not settled by then is answered 500 and logged. */
  handlerDeadlineMs?: number;
  /** Bridge-wide degraded states echoed on `/v1/health` (e.g. DS-25); read per request. */
  degraded?: () => Degraded[];
};

export const HANDLER_DEADLINE_MS = 10_000;

class HandlerDeadline extends Error {}

/** The pathname of a request target, query dropped; never parses a `//host` prefix as a host. */
export function pathOf(url: string | undefined): string {
  const raw = url ?? '/';
  if (!raw.startsWith('/')) {
    try {
      return new URL(raw).pathname;
    } catch {
      // not absolute-form either; fall through to the plain split
    }
  }
  return raw.split('?')[0] || '/';
}

function healthHandler(startedAt: string, degraded: () => Degraded[]): Handler {
  return () => {
    const body: BridgeHealth = {
      status: 'ok',
      contractVersion: CONTRACT_VERSION,
      node: process.version,
      startedAt,
      checkedAt: new Date().toISOString(),
      degraded: degraded(),
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

/** The Bridge's own routes. Exported so tests can force every one of them to throw. */
export function builtinRoutes(
  startedAt: string,
  degraded: () => Degraded[] = () => [],
): RouteTable {
  return { '/v1/health': { GET: healthHandler(startedAt, degraded) } };
}

type Route = Partial<Record<string, Handler>>;

/**
 * The route for a pathname: the exact entry, else the first pattern whose segments all match.
 * A `:name` segment whose escape is malformed matches nothing, so the answer is a 404.
 */
export function matchRoute(
  routes: RouteTable,
  path: string,
): { route: Route; params: RouteParams } | undefined {
  // A request for a pattern's own spelling (`/v1/project/:pjid`) is matched as a pattern.
  if (!path.includes('/:') && Object.hasOwn(routes, path)) {
    const route = routes[path];
    if (route !== undefined) return { route, params: {} };
  }
  const segments = path.split('/');
  for (const [pattern, route] of Object.entries(routes)) {
    if (route === undefined || !pattern.includes('/:')) continue;
    const want = pattern.split('/');
    if (want.length !== segments.length) continue;
    const params: Record<string, string> = {};
    const matched = want.every((w, i) => {
      const got = segments[i] ?? '';
      if (!w.startsWith(':')) return w === got;
      if (got === '') return false;
      try {
        params[w.slice(1)] = decodeURIComponent(got);
        return true;
      } catch {
        return false;
      }
    });
    if (matched) return { route, params };
  }
  return undefined;
}

/** Methods a route actually answers; a defined GET implies HEAD. */
function allowOf(route: Route): string[] {
  const methods = Object.entries(route)
    .filter(([, h]) => h !== undefined)
    .map(([m]) => m);
  if (methods.includes('GET') && !methods.includes('HEAD')) methods.push('HEAD');
  return methods;
}

export function createBridgeServer(options: BridgeServerOptions): Server {
  const log = options.log ?? defaultLog;
  const deadlineMs = options.handlerDeadlineMs ?? HANDLER_DEADLINE_MS;
  const routes: RouteTable = {
    ...builtinRoutes(options.startedAt, options.degraded),
    ...options.routes,
  };

  return createServer((req, res) => {
    const started = performance.now();
    const method = req.method ?? 'GET';
    const path = pathOf(req.url);

    // 'close' fires for finished and aborted responses alike; 'finish' misses the latter.
    res.once('close', () => {
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

    const matched = matchRoute(routes, path);
    if (matched === undefined) {
      const body: BridgeError = { error: 'not_found', path };
      send(res, 404, body);
      return;
    }
    const { route, params } = matched;
    const handler = route[method] ?? (method === 'HEAD' ? route.GET : undefined);
    if (handler === undefined) {
      const body: BridgeError = { error: 'method_not_allowed', method, path };
      send(res, 405, body, { Allow: allowOf(route).join(', ') });
      return;
    }

    const internalError = (detail?: string) => {
      log({
        level: 'error',
        event: 'handler_failed',
        ds: 'DS-5',
        method,
        path,
        ...(detail !== undefined ? { detail } : {}),
      });
      if (!res.headersSent) send(res, 500, { error: 'internal_error' } satisfies BridgeError);
      else res.destroy();
    };

    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new HandlerDeadline()), deadlineMs);
    });

    Promise.race([Promise.resolve().then(() => handler(req, params)), deadline])
      .then(
        (result) => send(res, result.status, result.body),
        (err: unknown) => {
          if (err instanceof HandlerDeadline) {
            log({
              level: 'error',
              event: 'handler_timed_out',
              ds: 'DS-5',
              method,
              path,
              deadlineMs,
            });
            send(res, 500, { error: 'internal_error' } satisfies BridgeError);
            return;
          }
          const mapped = toErrorResponse(err);
          if (mapped.status === 500) {
            internalError(err instanceof Error ? err.message : undefined);
            return;
          }
          for (const d of mapped.body.degraded) {
            log({
              level: 'warn',
              event: 'degraded',
              ds: d.ds,
              method,
              path,
              ...(params.pjid !== undefined ? { pjid: params.pjid } : {}),
            });
          }
          send(res, mapped.status, mapped.body);
        },
      )
      .catch((err: unknown) => {
        // `send` itself threw, e.g. a body `JSON.stringify` cannot serialise.
        try {
          internalError(err instanceof Error ? err.message : undefined);
        } catch {
          res.destroy();
        }
      })
      .finally(() => clearTimeout(timer));
  });
}
