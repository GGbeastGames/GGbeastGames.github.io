import { useEffect, useMemo, useState } from 'react';

type QueueState = 'idle' | 'queued' | 'matched' | 'ready' | 'active' | 'completed' | 'timeout';

interface SideState {
  uid: string;
  shards: number;
  steals: number;
  losses: number;
  connected: boolean;
}

const SHARD_TARGET = 20;

export const CompetitiveArena = () => {
  const [state, setState] = useState<QueueState>('idle');
  const [rankPoints, setRankPoints] = useState(1000);
  const [wallet, setWallet] = useState(600);
  const [opponentWallet, setOpponentWallet] = useState(600);
  const [mySide, setMySide] = useState<SideState>({ uid: 'you', shards: 0, steals: 0, losses: 0, connected: true });
  const [opponent, setOpponent] = useState<SideState>({ uid: 'opponent', shards: 0, steals: 0, losses: 0, connected: true });
  const [lastResult, setLastResult] = useState<string>('');

  const winner = useMemo(() => {
    if (mySide.shards >= SHARD_TARGET) {
      return 'you';
    }
    if (opponent.shards >= SHARD_TARGET) {
      return 'opponent';
    }
    return null;
  }, [mySide.shards, opponent.shards]);

  const boundedTransfer = Math.max(10, Math.min(250, Math.floor(opponentWallet * 0.08)));

  const queue = () => {
    setState('queued');
    setTimeout(() => setState('matched'), 400);
  };

  const ready = () => {
    setState('ready');
    setTimeout(() => setState('active'), 300);
  };

  const scoreShard = () => {
    if (state !== 'active') {
      return;
    }
    setMySide((current) => ({ ...current, shards: current.shards + 1 }));
  };

  const stealShard = () => {
    if (state !== 'active' || opponent.shards < 1) {
      return;
    }
    setMySide((current) => ({ ...current, shards: current.shards + 1, steals: current.steals + 1 }));
    setOpponent((current) => ({ ...current, shards: current.shards - 1, losses: current.losses + 1 }));
  };

  const opponentScores = () => {
    if (state !== 'active') {
      return;
    }
    setOpponent((current) => ({ ...current, shards: current.shards + 1 }));
  };

  const toggleDisconnect = () => {
    if (state !== 'active') {
      return;
    }
    setMySide((current) => ({ ...current, connected: !current.connected }));
    setState((current) => (current === 'active' ? 'timeout' : 'active'));
  };

  const rejoin = () => {
    setMySide((current) => ({ ...current, connected: true }));
    setState('active');
  };

  useEffect(() => {
    if (!winner || state === 'completed') {
      return;
    }

    setState('completed');
    const won = winner === 'you';
    const rankDelta = won ? 16 : -16;
    const transfer = won ? boundedTransfer : -boundedTransfer;
    setRankPoints((current) => Math.max(0, current + rankDelta));
    setWallet((current) => Math.max(0, current + transfer));
    setOpponentWallet((current) => Math.max(0, current - transfer));
    setLastResult(won ? `Victory +16 RP, +${boundedTransfer} credits (bounded 8%).` : `Defeat -16 RP, -${boundedTransfer} credits.`);
  }, [boundedTransfer, state, winner]);

  return (
    <section className="pvp-arena">
      <h2>Ranked PvP Lobby</h2>
      <p>State: {state}</p>
      <p>RP: {rankPoints} | Wallet: {wallet} | Opp Wallet: {opponentWallet}</p>
      <div className="pvp-controls">
        <button onClick={queue}>Queue</button>
        <button onClick={ready} disabled={state !== 'matched'}>Ready</button>
        <button onClick={scoreShard} disabled={state !== 'active'}>+1 Shard</button>
        <button onClick={stealShard} disabled={state !== 'active'}>Steal Shard</button>
        <button onClick={opponentScores} disabled={state !== 'active'}>Opponent +1</button>
        <button onClick={toggleDisconnect} disabled={state !== 'active'}>Sim Disconnect</button>
        <button onClick={rejoin} disabled={state !== 'timeout'}>Rejoin</button>
      </div>
      <div className="split-screen">
        <article>
          <h3>You</h3>
          <p>Shards: {mySide.shards}/{SHARD_TARGET}</p>
          <p>Steals: {mySide.steals}</p>
          <p>Losses: {mySide.losses}</p>
          <p>Connection: {mySide.connected ? 'online' : 'disconnected'}</p>
        </article>
        <article>
          <h3>Opponent</h3>
          <p>Shards: {opponent.shards}/{SHARD_TARGET}</p>
          <p>Steals: {opponent.steals}</p>
          <p>Losses: {opponent.losses}</p>
          <p>Connection: {opponent.connected ? 'online' : 'online'}</p>
        </article>
      </div>
      {lastResult ? <p>{lastResult}</p> : null}
    </section>
  );
};
