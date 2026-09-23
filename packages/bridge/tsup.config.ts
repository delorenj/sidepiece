import { defineConfig } from 'tsup';

// One self-contained file: every dependency (including `contract`, read from
// source via the `source` condition) is inlined because the rsync deploy cannot
// carry pnpm's workspace symlink or a node_modules. Only `node:*` stays external.
export default defineConfig({
  entry: { bridge: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outExtension: () => ({ js: '.mjs' }),
  noExternal: [/^(?!node:)/],
  external: [/^node:/],
  esbuildOptions(options) {
    options.conditions = ['source'];
  },
  clean: true,
});
