import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await mkdir(new URL('../demo/', import.meta.url), { recursive: true });
await build({ entryPoints: [new URL('../src/userscript.mjs', import.meta.url).pathname], outfile: new URL('../demo/sidepiece.user.js', import.meta.url).pathname, bundle: true, format: 'iife', target: 'es2022', banner: { js: `// ==UserScript==
// @name         Sidepiece Annotation Review
// @namespace    https://github.com/delorenj/sidepiece
// @version      0.1.0
// @description  Opt-in, local-first attributed page review
// @match        http://*/*
// @match        https://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==` } });
