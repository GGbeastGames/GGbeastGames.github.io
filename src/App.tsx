import assetManifest from './data/assetManifest.json';
import { CyberWindow } from './components/ui/CyberWindow';
import { TokenCard } from './components/ui/TokenCard';
import { freeAssetSources, libraryShortlist } from './data/libraryShortlist';
import { themeTokens } from './theme/tokens';

const docs = [
  'docs/PHASE_01_CHECKLIST.md',
  'docs/ROADMAP.md',
  'docs/ARCHITECTURE.md',
  'docs/ECONOMY_BASELINE.md',
  'docs/PHASE_02_VISUAL_SYSTEM.md',
  'docs/ASSET_PIPELINE.md'
];

const sampleAssets = assetManifest.packs.webgl.files.slice(0, 8);
const sampleSounds = assetManifest.packs.sounds.files.slice(0, 8);

export function App() {
  return (
    <main className="desktop">
      <header className="hero panel">
        <p className="kicker">Aionous / RootAccess</p>
        <h1>Phase 2 — Visual Identity + Asset Pipeline</h1>
        <p>
          Built a reusable cyberpunk UI kit, tokenized theme system, and generated manifest pipeline for
          local Webgl and Sounds folders.
        </p>
      </header>

      <div className="window-grid">
        <CyberWindow title="Design Tokens" subtitle="Core palette and visual consistency values">
          <div className="token-grid">
            {Object.entries(themeTokens.colors).map(([label, value]) => (
              <TokenCard key={label} label={label} value={value} />
            ))}
          </div>
        </CyberWindow>

        <CyberWindow title="Asset Inventory" subtitle="Auto-generated from local project resources">
          <p className="statline">
            Webgl assets: <strong>{assetManifest.packs.webgl.count}</strong>
          </p>
          <p className="statline">
            Sounds assets: <strong>{assetManifest.packs.sounds.count}</strong>
          </p>

          <h4>Webgl sample</h4>
          <ul>
            {sampleAssets.map((file) => (
              <li key={file.path}>{file.path}</li>
            ))}
          </ul>

          <h4>Sounds sample</h4>
          <ul>
            {sampleSounds.map((file) => (
              <li key={file.path}>{file.path}</li>
            ))}
          </ul>
        </CyberWindow>

        <CyberWindow title="Free Tooling from Internet" subtitle="Low-friction libraries for Phase 3+">
          <ul>
            {libraryShortlist.map((entry) => (
              <li key={entry.name}>
                <a href={entry.url} target="_blank" rel="noreferrer">
                  {entry.name}
                </a>{' '}
                — {entry.use}
              </li>
            ))}
          </ul>

          <h4>Free asset sources</h4>
          <ul>
            {freeAssetSources.map((entry) => (
              <li key={entry.name}>
                <a href={entry.url} target="_blank" rel="noreferrer">
                  {entry.name}
                </a>{' '}
                — {entry.type}
              </li>
            ))}
          </ul>
        </CyberWindow>

        <CyberWindow title="Blueprint Docs" subtitle="Phase-by-phase build guidance">
          <ul>
            {docs.map((doc) => (
              <li key={doc}>
                <a href={doc} target="_blank" rel="noreferrer">
                  {doc}
                </a>
              </li>
            ))}
          </ul>
        </CyberWindow>
      </div>
    </main>
  );
}
