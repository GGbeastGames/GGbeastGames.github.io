import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const indexFile = resolve(distDir, 'index.html');
const notFoundFile = resolve(distDir, '404.html');
const noJekyll = resolve(distDir, '.nojekyll');

if (existsSync(indexFile)) {
  copyFileSync(indexFile, notFoundFile);
}

writeFileSync(noJekyll, '');
console.log('GitHub Pages hardening complete: 404.html + .nojekyll created.');
