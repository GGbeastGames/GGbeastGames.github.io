import { Checklist } from './components/Checklist';

const documents = [
  { label: '12-Phase Roadmap', path: 'docs/ROADMAP.md' },
  { label: 'Architecture Blueprint', path: 'docs/ARCHITECTURE.md' },
  { label: 'Economy Baseline', path: 'docs/ECONOMY_BASELINE.md' },
  { label: 'Phase 1 Definition of Done', path: 'docs/PHASE_01_CHECKLIST.md' }
];

export function App() {
  return (
    <main className="desktop">
      <header className="hero panel">
        <p className="kicker">Aionous / RootAccess</p>
        <h1>Phase 1 Foundation Build</h1>
        <p>
          Initial project scaffold is live with architecture, economy baseline, and a 12-phase delivery
          blueprint for the full hacker desktop game.
        </p>
      </header>

      <Checklist />

      <section className="panel">
        <h2>Blueprint Documents</h2>
        <ul>
          {documents.map((doc) => (
            <li key={doc.path}>
              <a href={doc.path} target="_blank" rel="noreferrer">
                {doc.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Asset Sources Activated</h2>
        <p>
          Local project assets will be sourced from <code>/Webgl</code> for images/UI textures and{' '}
          <code>/Sounds</code> for SFX in upcoming phases.
        </p>
      </section>
    </main>
  );
}
