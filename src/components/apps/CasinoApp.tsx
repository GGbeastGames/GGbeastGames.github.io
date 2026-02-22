import { useMemo, useState } from 'react';
import { CASINO_RULES, CasinoState, getEffectiveWinRate } from '../../game/casino';

type CasinoAppProps = {
  casino: CasinoState;
  balance: number;
  onPlay: (game: 'high-low' | 'neon-wheel', wager: number) => void;
  onBuyCharm: () => void;
};

export function CasinoApp({ casino, balance, onPlay, onBuyCharm }: CasinoAppProps) {
  const [wager, setWager] = useState(10);
  const highLowOdds = useMemo(() => Math.round(getEffectiveWinRate(CASINO_RULES.highLowBaseWinRate, casino.luckBonus) * 100), [casino.luckBonus]);
  const wheelOdds = useMemo(() => Math.round(getEffectiveWinRate(CASINO_RULES.wheelBaseWinRate, casino.luckBonus) * 100), [casino.luckBonus]);
  const cooldownLeft = Math.max(0, casino.cooldownUntil - Date.now());

  return (
    <div className="casino-app">
      <h4>Casino // Neon Oasis</h4>
      <p>Balance: {balance} Ø · Flux: {casino.flux} ƒ · Luck Buff: +{Math.round(casino.luckBonus * 100)}%</p>
      <p className="muted">Visible odds, wager cap ({CASINO_RULES.maxWager} Ø), and cooldowns keep economy healthy.</p>

      <div className="casino-row">
        <label>
          Wager
          <input
            type="number"
            min={1}
            max={Math.min(CASINO_RULES.maxWager, balance)}
            value={wager}
            onChange={(event) => setWager(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <p>{cooldownLeft > 0 ? `Cooldown: ${(cooldownLeft / 1000).toFixed(1)}s` : 'Ready to play'}</p>
      </div>

      <div className="casino-grid">
        <article>
          <h5>High / Low</h5>
          <p>Win odds: {highLowOdds}%</p>
          <button type="button" onClick={() => onPlay('high-low', wager)} disabled={wager > balance}>
            Play
          </button>
          <p>Current streak: {casino.highLowStreak}</p>
        </article>

        <article>
          <h5>Neon Wheel</h5>
          <p>Win odds: {wheelOdds}%</p>
          <button type="button" onClick={() => onPlay('neon-wheel', wager)} disabled={wager > balance}>
            Spin
          </button>
          <p>High payout, lower base odds.</p>
        </article>

        <article>
          <h5>Flux Store</h5>
          <p>Luck Charm · Cost 10 ƒ</p>
          <button type="button" onClick={onBuyCharm}>
            Buy Charm
          </button>
          <p>Bounded buff cap: +20% max odds bonus.</p>
        </article>
      </div>

      <section>
        <h5>Casino Badges</h5>
        <ul>
          {casino.badges.length === 0 ? <li>No badges yet.</li> : casino.badges.map((badge) => <li key={badge}>{badge}</li>)}
        </ul>
      </section>
    </div>
  );
}
