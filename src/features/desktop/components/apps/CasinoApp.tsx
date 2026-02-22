import { CASINO_GAMES } from '../../../game/commandCatalog';
import { PlayerProgress } from '../../../game/playerProgress';

interface CasinoAppProps {
  progress: PlayerProgress;
  onPlay: (gameId: string, bet: number) => void;
}

export const CasinoApp = ({ progress, onPlay }: CasinoAppProps) => {
  return (
    <section className="casino-app">
      <h2>Neon Casino</h2>
      <p>Wallet: Ø{progress.wallet} · Flux: ƒ{progress.flux}</p>
      <p>
        Record {progress.casino.wins}W / {progress.casino.losses}L · Streak {progress.casino.winStreak} (best {progress.casino.bestWinStreak})
      </p>
      {progress.casino.activeCharm ? (
        <p className="casino-app__charm">
          Charm active: {progress.casino.activeCharm.title} (+{progress.casino.activeCharm.winBoostPct.toFixed(1)}% win chance), uses left{' '}
          {progress.casino.activeCharm.usesRemaining}
        </p>
      ) : null}

      <div className="casino-app__games">
        {CASINO_GAMES.map((game) => {
          const suggestedBet = Math.min(game.maxBet, Math.max(game.minBet, Math.floor(progress.wallet * 0.08) || game.minBet));
          return (
            <article key={game.id} className="casino-app__game">
              <strong>{game.title}</strong>
              <p>{game.description}</p>
              <p>Bet range: Ø{game.minBet} - Ø{game.maxBet} · RTP telemetry edge {game.houseEdgePct}%</p>
              <button type="button" disabled={progress.wallet < game.minBet} onClick={() => onPlay(game.id, suggestedBet)}>
                Play Ø{suggestedBet}
              </button>
            </article>
          );
        })}
      </div>

      <div className="casino-app__telemetry">
        <h3>Fair Telemetry (latest rounds)</h3>
        {progress.casino.telemetry.length === 0 ? <p>No rounds yet.</p> : null}
        {progress.casino.telemetry.map((entry) => (
          <p key={entry.id}>
            [{new Date(entry.timestampMs).toLocaleTimeString()}] {entry.gameId} bet Ø{entry.bet}, chance {entry.adjustedWinChancePct.toFixed(1)}%, payout x
            {entry.payoutMultiplier.toFixed(2)}, roll {entry.rolledValue} → {entry.success ? 'WIN' : 'LOSS'} ({entry.walletDelta >= 0 ? '+' : ''}
            {entry.walletDelta})
          </p>
        ))}
      </div>
    </section>
  );
};
