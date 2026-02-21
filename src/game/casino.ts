export type CasinoMiniGameId = 'high-low' | 'neon-wheel';

export type FluxLedgerEntry = {
  id: string;
  ts: number;
  reason: string;
  delta: number;
};

export type CasinoState = {
  flux: number;
  luckBonus: number;
  cooldownUntil: number;
  highLowStreak: number;
  badges: string[];
  fluxLedger: FluxLedgerEntry[];
};

export const defaultCasinoState: CasinoState = {
  flux: 0,
  luckBonus: 0,
  cooldownUntil: 0,
  highLowStreak: 0,
  badges: [],
  fluxLedger: []
};

export const CASINO_RULES = {
  maxWager: 80,
  cooldownMs: 4_000,
  highLowBaseWinRate: 0.48,
  wheelBaseWinRate: 0.42
};

function makeLedger(reason: string, delta: number): FluxLedgerEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    reason,
    delta
  };
}

export function getEffectiveWinRate(base: number, luckBonus: number): number {
  return Math.min(0.75, base + luckBonus);
}

export function playCasinoRound(
  state: CasinoState,
  gameId: CasinoMiniGameId,
  wager: number,
  now = Date.now()
): { next: CasinoState; won: boolean; payout: number; message: string; blocked: boolean } {
  if (wager <= 0) {
    return { next: state, won: false, payout: 0, message: 'Wager must be above 0.', blocked: true };
  }
  if (wager > CASINO_RULES.maxWager) {
    return { next: state, won: false, payout: 0, message: `Wager cap exceeded. Max ${CASINO_RULES.maxWager} Ø.`, blocked: true };
  }
  if (now < state.cooldownUntil) {
    const left = ((state.cooldownUntil - now) / 1000).toFixed(1);
    return { next: state, won: false, payout: 0, message: `Casino cooldown active (${left}s).`, blocked: true };
  }

  const base = gameId === 'high-low' ? CASINO_RULES.highLowBaseWinRate : CASINO_RULES.wheelBaseWinRate;
  const odds = getEffectiveWinRate(base, state.luckBonus);
  const won = Math.random() <= odds;
  const payout = won ? Math.ceil(wager * (gameId === 'high-low' ? 1.85 : 2.2)) : 0;

  let streak = won && gameId === 'high-low' ? state.highLowStreak + 1 : gameId === 'high-low' ? 0 : state.highLowStreak;
  const badges = [...state.badges];
  const fluxLedger = [...state.fluxLedger];
  let fluxGain = 0;

  if (streak >= 10 && !badges.includes('Luck 10')) {
    badges.push('Luck 10');
    fluxGain += 6;
    fluxLedger.push(makeLedger('Badge: Luck 10', 6));
  }

  const next: CasinoState = {
    ...state,
    cooldownUntil: now + CASINO_RULES.cooldownMs,
    highLowStreak: streak,
    badges,
    flux: state.flux + fluxGain,
    fluxLedger
  };

  return {
    next,
    won,
    payout,
    message: won ? `You won ${payout} Ø.` : `You lost ${wager} Ø.`,
    blocked: false
  };
}

export function buyLuckCharm(state: CasinoState): { next: CasinoState; ok: boolean; message: string } {
  const cost = 10;
  if (state.flux < cost) {
    return { next: state, ok: false, message: `Need ${cost} ƒ Flux for a Luck Charm.` };
  }

  const nextBonus = Math.min(0.2, state.luckBonus + 0.02);
  const next: CasinoState = {
    ...state,
    flux: state.flux - cost,
    luckBonus: nextBonus,
    fluxLedger: [...state.fluxLedger, makeLedger('Bought Luck Charm', -cost)]
  };

  return { next, ok: true, message: `Luck Charm installed. Odds buff +${Math.round(nextBonus * 100)}%.` };
}
