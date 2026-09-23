import { defineConfig } from 'tsup';

// One self-contained file: `contract` is inlined because the rsync deploy
// cannot carry pnpm's workspace symlink. Only `node:*` stays external.
export default defineConfig({
  entry: { bridge: 'src/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outExtension: () => ({ js: '.mjs' }),
  noExternal: ['@sidepiece/contract'],
  external: [/^node:/],
  clean: true,
});
