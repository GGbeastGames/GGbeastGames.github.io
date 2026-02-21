import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const roots = [
  { key: 'webgl', dir: 'Webgl' },
  { key: 'sounds', dir: 'Sounds' }
];

const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.wav', '.mp3', '.ogg']);

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }

    const lower = entry.name.toLowerCase();
    const ext = lower.slice(lower.lastIndexOf('.'));
    if (!exts.has(ext)) {
      continue;
    }

    files.push(full);
  }

  return files;
}

const manifest = {
  generatedAt: new Date().toISOString(),
  packs: {}
};

for (const root of roots) {
  const files = walk(root.dir).map((fullPath) => {
    const normalized = fullPath.split(sep).join('/');
    const stats = statSync(fullPath);
    return {
      path: normalized,
      bytes: stats.size,
      ext: normalized.split('.').pop()?.toLowerCase() ?? 'unknown',
      folder: relative(root.dir, fullPath).split(sep)[0]
    };
  });

  manifest.packs[root.key] = {
    count: files.length,
    files
  };
}

writeFileSync('src/data/assetManifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`asset manifest generated: ${manifest.packs.webgl.count} webgl assets, ${manifest.packs.sounds.count} sounds`);
