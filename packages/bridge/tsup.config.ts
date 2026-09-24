import { defineConfig } from 'tsup';

// One self-contained file: every dependency (including `contract`, read from
// source via the `source` condition, and every `.sql` migration) is inlined because the rsync deploy cannot
// carry pnpm's workspace symlink or a node_modules. Only `node:*` stays external.
export default defineConfig({
  entry: { bridge: 'src/main.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outExtension: () => ({ js: '.mjs' }),
  noExternal: [/^(?!node:)/],
  external: [/^node:/],
  // Migrations are inlined as strings, so the bundle stays one file (AR27).
  loader: { '.sql': 'text' },
  // tsup strips `node:` by default; `node:sqlite` exists only under its prefix.
  removeNodeProtocol: false,
  esbuildOptions(options) {
    options.conditions = ['source'];
  },
  clean: true,
});
