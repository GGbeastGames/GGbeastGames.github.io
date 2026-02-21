import { useMemo, useState } from 'react';
import { FactionId, GrowthState, OpsContract, contracts } from '../../game/growth';

type GrowthAppProps = {
  growth: GrowthState;
  onPickFaction: (faction: FactionId) => void;
  onStartContract: (contractId: string) => void;
  onResolveContract: () => void;
  onCraft: (left: string, right: string, useBoost: boolean) => void;
};

const factions: Array<{ id: FactionId; label: string }> = [
  { id: 'corp', label: 'Corp' },
  { id: 'syndicate', label: 'Syndicate' },
  { id: 'ghost-cell', label: 'Ghost Cell' }
];

export function GrowthApp({ growth, onPickFaction, onStartContract, onResolveContract, onCraft }: GrowthAppProps) {
  const [left, setLeft] = useState('phish');
  const [right, setRight] = useState('scan');
  const [useBoost, setUseBoost] = useState(false);

  const activeContract = useMemo(() => contracts.find((item) => item.id === growth.activeContractId) ?? null, [growth.activeContractId]);
  const timeLeft = Math.max(0, growth.contractEndsAt - Date.now());

  return (
    <div className="growth-app">
      <h4>Growth Systems // Ops + Factions + Crafting + Heat</h4>
      <p>Heat: {growth.heat}% {growth.heat >= 65 ? '⚠️ bounty exposure risk is high' : ''}</p>

      <div className="growth-grid">
        <section>
          <h5>Factions</h5>
          <p>Current: {growth.faction ?? 'none selected'}</p>
          <div className="actions-inline">
            {factions.map((faction) => (
              <button key={faction.id} type="button" onClick={() => onPickFaction(faction.id)}>
                Join {faction.label}
              </button>
            ))}
          </div>
          <ul>
            {factions.map((faction) => (
              <li key={faction.id}>{faction.label}: {growth.factionScore[faction.id]} score</li>
            ))}
          </ul>
        </section>

        <section>
          <h5>Ops Contracts (2-4 players)</h5>
          {contracts.map((contract: OpsContract) => (
            <article key={contract.id}>
              <p>{contract.name}</p>
              <p>Team: {contract.requiredPlayers} · Duration: {contract.durationSec}s</p>
              <p>Rewards: {contract.rewardNops} Ø + {contract.rewardXp} XP</p>
              <button type="button" onClick={() => onStartContract(contract.id)} disabled={!!growth.activeContractId}>Start</button>
            </article>
          ))}
          <p>Active: {activeContract ? `${activeContract.name} (${(timeLeft / 1000).toFixed(0)}s left)` : 'none'}</p>
          <button type="button" onClick={onResolveContract}>Resolve Contract</button>
        </section>

        <section>
          <h5>Command Crafting</h5>
          <label>
            Left command
            <input value={left} onChange={(event) => setLeft(event.target.value.toLowerCase())} />
          </label>
          <label>
            Right command
            <input value={right} onChange={(event) => setRight(event.target.value.toLowerCase())} />
          </label>
          <label>
            <input type="checkbox" checked={useBoost} onChange={(event) => setUseBoost(event.target.checked)} /> Use trait chance booster
          </label>
          <button type="button" onClick={() => onCraft(left, right, useBoost)}>Craft/Fuse</button>
          <ul>
            {growth.craftingHistory.length === 0 ? <li>No crafts yet.</li> : growth.craftingHistory.slice(0, 5).map((item) => <li key={item.id}>{item.resultKey} · trait chance {Math.round(item.boostedTraitChance * 10000) / 100}%</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
