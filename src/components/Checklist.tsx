const phaseOneChecklist = [
  'Freeze product pillars and constraints (0$ budget, free Firebase only)',
  'Establish architecture for GitHub Pages + Firebase service map',
  'Define game economy baseline for Ø NOP and unlock progression',
  'Set coding standards, folder structure, and app module boundaries',
  'Prepare phase-gated roadmap for implementation handoff'
];

export function Checklist() {
  return (
    <section className="panel">
      <h2>Phase 1 Checklist (Completed)</h2>
      <ul>
        {phaseOneChecklist.map((item) => (
          <li key={item}>✅ {item}</li>
        ))}
      </ul>
    </section>
  );
}
