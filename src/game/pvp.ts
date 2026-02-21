export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Inferno';

export type PvpQueueEntry = {
  id: string;
  alias: string;
  rankedPoints: number;
  queuedAt: number;
};

export type PvpMatchState = {
  id: string;
  opponentAlias: string;
  roundsPlayed: number;
  playerHacks: number;
  playerShards: number;
  opponentHacks: number;
  opponentShards: number;
  complete: boolean;
};

export type RankedState = {
  rankedPoints: number;
  wins: number;
  losses: number;
  season: number;
  matchLogs: Array<{
    id: string;
    ts: number;
    opponentAlias: string;
    result: 'win' | 'loss';
    pointsDelta: number;
  }>;
};

export const defaultRankedState: RankedState = {
  rankedPoints: 100,
  wins: 0,
  losses: 0,
  season: 1,
  matchLogs: []
};

export function getRankTier(points: number): RankTier {
  if (points >= 1700) return 'Inferno';
  if (points >= 1300) return 'Diamond';
  if (points >= 1000) return 'Platinum';
  if (points >= 700) return 'Gold';
  if (points >= 400) return 'Silver';
  return 'Bronze';
}

export function createMatch(opponentAlias: string): PvpMatchState {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    opponentAlias,
    roundsPlayed: 0,
    playerHacks: 0,
    playerShards: 0,
    opponentHacks: 0,
    opponentShards: 0,
    complete: false
  };
}

export function playRound(match: PvpMatchState): PvpMatchState {
  if (match.complete) return match;

  const playerHackSuccess = Math.random() <= 0.62;
  const oppHackSuccess = Math.random() <= 0.58;

  const playerShardsGain = playerHackSuccess ? 1 : 0;
  const oppShardsGain = oppHackSuccess ? 1 : 0;

  const roundsPlayed = match.roundsPlayed + 1;
  const complete = roundsPlayed >= 8;

  return {
    ...match,
    roundsPlayed,
    playerHacks: match.playerHacks + 1,
    opponentHacks: match.opponentHacks + 1,
    playerShards: match.playerShards + playerShardsGain,
    opponentShards: match.opponentShards + oppShardsGain,
    complete
  };
}

export function getShardRatio(shards: number, hacks: number): number {
  if (!hacks) return 0;
  return shards / hacks;
}

export function resolveMatch(match: PvpMatchState, ranked: RankedState): { ranked: RankedState; result: 'win' | 'loss'; pointsDelta: number; stolenNopsPct: number } {
  const playerRatio = getShardRatio(match.playerShards, match.playerHacks);
  const oppRatio = getShardRatio(match.opponentShards, match.opponentHacks);

  const won =
    match.playerShards > match.opponentShards ||
    (match.playerShards === match.opponentShards && playerRatio >= oppRatio);
  const result: 'win' | 'loss' = won ? 'win' : 'loss';

  const pointsDelta = won ? 24 : -16;
  const stolenNopsPct = won ? 0.08 : 0;

  return {
    result,
    pointsDelta,
    stolenNopsPct,
    ranked: {
      ...ranked,
      rankedPoints: Math.max(0, ranked.rankedPoints + pointsDelta),
      wins: ranked.wins + (won ? 1 : 0),
      losses: ranked.losses + (won ? 0 : 1),
      matchLogs: [
        {
          id: match.id,
          ts: Date.now(),
          opponentAlias: match.opponentAlias,
          result,
          pointsDelta
        },
        ...ranked.matchLogs
      ].slice(0, 30)
    }
  };
}
