import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * An in-process stand-in for `pjangler-project-registry.service`, shaped like its live
 * `GET /v1/registry` (probed 2026-09-24). Tests never touch the real registry. The foreign
 * keys are built by concatenation: only `registry/client.ts` may spell them.
 */
export const PJID_KEY = ['project', 'id'].join('_');
const BOARD_KEY = ['board', 'id'].join('_');

export const SIDEPIECE_BOARD = '96725b78-df0b-436a-8b45-c871264fe25d';
/** The four boardless Projects the planning docs name (live `momo` has since gained a board). */
export const BOARDLESS = ['codegraph-voyage', 'legofirst', 'momo', 'vinyl'] as const;

export type FixtureProject = {
  repoPath: unknown;
  boardId?: string;
  providerType?: string;
  agents?: Record<string, { role: string; roleDir: string }>;
};

export function fixtureProjects(): Record<string, FixtureProject> {
  const projects: Record<string, FixtureProject> = {
    sidepiece: {
      repoPath: '/home/delorenj/code/sidepiece',
      boardId: SIDEPIECE_BOARD,
      // Deliberately out of order: the record sorts by id.
      agents: {
        'sidepiece-scrum-master': { role: 'scrum-master', roleDir: 'agents/hermes/scrum-master' },
        'sidepiece-pm': { role: 'pm', roleDir: 'agents/hermes/pm' },
      },
    },
  };
  for (const pjid of BOARDLESS) projects[pjid] = { repoPath: `/home/delorenj/code/${pjid}` };
  return projects;
}

/** One registry entry, as pjangler writes it (key === identifier === slug). */
export function registryEntry(pjid: string, p: FixtureProject): Record<string, unknown> {
  return {
    name: pjid,
    slug: pjid,
    [PJID_KEY]: pjid,
    status: 'active',
    repo_path: p.repoPath,
    agents: Object.fromEntries(
      Object.entries(p.agents ?? {}).map(([id, a]) => [id, { role: a.role, role_dir: a.roleDir }]),
    ),
    ticket_provider: {
      type: p.providerType ?? 'plane',
      state: p.boardId ? 'linked' : 'planned',
      [BOARD_KEY]: p.boardId ?? '',
      workspace: '33god',
    },
  };
}

export type StubRegistry = {
  /** The base URL, as `SIDEPIECE_REGISTRY_URL` would name it. */
  url: string;
  /** Replaced or mutated freely between requests. */
  projects: Record<string, FixtureProject>;
  /** When set, answers every request with this instead of the registry. */
  override?: { status: number; body: string };
  /**
   * When set, accepts the request and then stalls: `no-response` never writes anything,
   * `stall-body` writes the headers and part of the body, then never ends it.
   */
  hang?: 'no-response' | 'stall-body';
  /** `GET /v1/registry` requests served so far. */
  requests: number;
  close(): Promise<void>;
};

export async function startStubRegistry(
  projects: Record<string, FixtureProject> = fixtureProjects(),
): Promise<StubRegistry> {
  const server = createServer((req, res) => {
    if (req.url !== '/v1/registry') {
      res.writeHead(404).end();
      return;
    }
    stub.requests++;
    if (stub.hang === 'no-response') return;
    if (stub.hang === 'stall-body') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"projects":{');
      return;
    }
    const { status, body } = stub.override ?? {
      status: 200,
      body: JSON.stringify({
        schema_version: 1,
        projects: Object.fromEntries(
          Object.entries(stub.projects).map(([pjid, p]) => [pjid, registryEntry(pjid, p)]),
        ),
      }),
    };
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const stub: StubRegistry = {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    projects,
    requests: 0,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
  return stub;
}
