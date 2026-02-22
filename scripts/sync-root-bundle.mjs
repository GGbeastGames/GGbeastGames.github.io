import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const distAssets = join(process.cwd(), 'dist', 'assets');
const rootAssets = join(process.cwd(), 'assets');

if (!existsSync(distAssets)) {
  throw new Error('dist/assets not found. Run npm run build first.');
}

mkdirSync(rootAssets, { recursive: true });

const files = readdirSync(distAssets);
const js = files.filter((name) => /^index-.*\.js$/.test(name)).sort().pop();
const css = files.filter((name) => /^index-.*\.css$/.test(name)).sort().pop();

if (!js || !css) {
  throw new Error('Could not find built index js/css assets.');
}

copyFileSync(join(distAssets, js), join(rootAssets, 'app.js'));
copyFileSync(join(distAssets, css), join(rootAssets, 'app.css'));

console.log(`Synced ${js} -> assets/app.js`);
console.log(`Synced ${css} -> assets/app.css`);
