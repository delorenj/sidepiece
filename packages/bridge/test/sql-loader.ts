import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// Under native type stripping a `.sql` import has no loader. This mirrors tsup's
// `loader: {'.sql': 'text'}`: the file becomes `export default "<its text>"`.
registerHooks({
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.sql')) {
      const text = readFileSync(fileURLToPath(url), 'utf8');
      return {
        format: 'module',
        source: `export default ${JSON.stringify(text)};`,
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});
