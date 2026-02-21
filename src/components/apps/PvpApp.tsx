import { PvpMatchState, PvpQueueEntry, RankedState, getRankTier, getShardRatio } from '../../game/pvp';

type PvpAppProps = {
  queue: PvpQueueEntry[];
  inQueue: boolean;
  alias: string;
  ranked: RankedState;
  activeMatch: PvpMatchState | null;
  onToggleQueue: () => void;
  onStartMatch: (opponentAlias: string) => void;
  onPlayRound: () => void;
};

export function PvpApp({ queue, inQueue, alias, ranked, activeMatch, onToggleQueue, onStartMatch, onPlayRound }: PvpAppProps) {
  const tier = getRankTier(ranked.rankedPoints);

  return (
    <div className="pvp-app">
      <h4>PvP Arena // Inferno Queue</h4>
      <p>
        Rank: {tier} · {ranked.rankedPoints} RP · W/L {ranked.wins}/{ranked.losses}
      </p>

      <div className="pvp-grid">
        <section>
          <h5>Queue Lobby</h5>
          <button type="button" onClick={onToggleQueue}>{inQueue ? 'Leave Queue' : 'Join Queue'}</button>
          <ul>
            {queue.length === 0 ? <li>No operators queued.</li> : queue.map((entry) => <li key={entry.id}>{entry.alias} · {entry.rankedPoints} RP</li>)}
          </ul>
          <button
            type="button"
            onClick={() => onStartMatch((queue.find((entry) => entry.alias !== alias) ?? { alias: 'GhostCell' }).alias)}
            disabled={!!activeMatch}
          >
            Ready / Accept Match
          </button>
        </section>

        <section>
          <h5>Split-Screen Duel</h5>
          {!activeMatch ? <p>No active duel.</p> : null}
          {activeMatch ? (
            <>
              <div className="duel-row">
                <article>
                  <h6>{alias}</h6>
                  <p>Shards: {activeMatch.playerShards}</p>
                  <p>Hacks: {activeMatch.playerHacks}</p>
                  <p>Ratio: {getShardRatio(activeMatch.playerShards, activeMatch.playerHacks).toFixed(2)}</p>
                </article>
                <article>
                  <h6>{activeMatch.opponentAlias}</h6>
                  <p>Shards: {activeMatch.opponentShards}</p>
                  <p>Hacks: {activeMatch.opponentHacks}</p>
                  <p>Ratio: {getShardRatio(activeMatch.opponentShards, activeMatch.opponentHacks).toFixed(2)}</p>
                </article>
              </div>
              <p>Round {activeMatch.roundsPlayed}/8</p>
              <button type="button" onClick={onPlayRound} disabled={activeMatch.complete}>Run Duel Round</button>
            </>
          ) : null}
        </section>

        <section>
          <h5>Recent Match Logs</h5>
          <ul>
            {ranked.matchLogs.length === 0 ? (
              <li>No ranked matches yet.</li>
            ) : (
              ranked.matchLogs.slice(0, 6).map((log) => (
                <li key={log.id}>
                  {new Date(log.ts).toLocaleTimeString()} vs {log.opponentAlias} — {log.result.toUpperCase()} ({log.pointsDelta > 0 ? '+' : ''}{log.pointsDelta} RP)
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
