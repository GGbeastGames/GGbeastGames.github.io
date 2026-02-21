export type CompanyTicker = 'VALK' | 'GLYPH' | 'ZERO' | 'PULSE' | 'TITAN';

export type CompanyState = {
  ticker: CompanyTicker;
  name: string;
  price: number;
  trend: 'up' | 'down' | 'flat';
  volatility: number;
};

export type BlockOwnership = {
  ticker: CompanyTicker;
  shares: number;
  securityLevel: number;
};

export type BlockchainState = {
  companies: Record<CompanyTicker, CompanyState>;
  ownership: Record<CompanyTicker, BlockOwnership>;
  lastRefreshAt: number;
  refreshEveryMs: number;
};

const TICKERS: CompanyTicker[] = ['VALK', 'GLYPH', 'ZERO', 'PULSE', 'TITAN'];

export const defaultBlockchainState: BlockchainState = {
  companies: {
    VALK: { ticker: 'VALK', name: 'Valk-Yrie', price: 240, trend: 'flat', volatility: 0.12 },
    GLYPH: { ticker: 'GLYPH', name: 'Mind-Glyph', price: 40, trend: 'flat', volatility: 0.2 },
    ZERO: { ticker: 'ZERO', name: 'Zero-Gen', price: 90, trend: 'flat', volatility: 0.16 },
    PULSE: { ticker: 'PULSE', name: 'Neon-Pulse', price: 120, trend: 'flat', volatility: 0.22 },
    TITAN: { ticker: 'TITAN', name: 'Titan-Core', price: 300, trend: 'flat', volatility: 0.1 }
  },
  ownership: {
    VALK: { ticker: 'VALK', shares: 0, securityLevel: 0 },
    GLYPH: { ticker: 'GLYPH', shares: 0, securityLevel: 0 },
    ZERO: { ticker: 'ZERO', shares: 0, securityLevel: 0 },
    PULSE: { ticker: 'PULSE', shares: 0, securityLevel: 0 },
    TITAN: { ticker: 'TITAN', shares: 0, securityLevel: 0 }
  },
  lastRefreshAt: Date.now(),
  refreshEveryMs: 60_000
};

export function maybeRefreshMarket(state: BlockchainState, now = Date.now()): BlockchainState {
  if (now - state.lastRefreshAt < state.refreshEveryMs) return state;

  const companies = { ...state.companies };
  TICKERS.forEach((ticker) => {
    const current = companies[ticker];
    const drift = (Math.random() * 2 - 1) * current.volatility;
    const trend = drift > 0.03 ? 'up' : drift < -0.03 ? 'down' : 'flat';
    const nextPrice = Math.max(5, Math.round(current.price * (1 + drift)));
    companies[ticker] = { ...current, price: nextPrice, trend };
  });

  return {
    ...state,
    companies,
    lastRefreshAt: now
  };
}

export function buyShares(state: BlockchainState, ticker: CompanyTicker, amount: number, balance: number): { next: BlockchainState; cost: number; message: string } {
  if (amount <= 0) return { next: state, cost: 0, message: 'Amount must be at least 1.' };
  if (amount > 100) return { next: state, cost: 0, message: 'Max 100 shares per order.' };

  const company = state.companies[ticker];
  const cost = company.price * amount;
  if (cost > balance) return { next: state, cost: 0, message: 'Insufficient Ø for share purchase.' };

  return {
    cost,
    message: `Bought ${amount} ${ticker} shares for ${cost} Ø.`,
    next: {
      ...state,
      ownership: {
        ...state.ownership,
        [ticker]: {
          ...state.ownership[ticker],
          shares: state.ownership[ticker].shares + amount
        }
      }
    }
  };
}

export function sellShares(state: BlockchainState, ticker: CompanyTicker, amount: number): { next: BlockchainState; payout: number; message: string } {
  const owned = state.ownership[ticker].shares;
  if (amount <= 0) return { next: state, payout: 0, message: 'Amount must be at least 1.' };
  if (amount > owned) return { next: state, payout: 0, message: 'You do not own that many shares.' };

  const payout = state.companies[ticker].price * amount;
  return {
    payout,
    message: `Sold ${amount} ${ticker} shares for ${payout} Ø.`,
    next: {
      ...state,
      ownership: {
        ...state.ownership,
        [ticker]: {
          ...state.ownership[ticker],
          shares: owned - amount
        }
      }
    }
  };
}

export function upgradeBlockSecurity(state: BlockchainState, ticker: CompanyTicker, balance: number): { next: BlockchainState; cost: number; message: string } {
  const current = state.ownership[ticker].securityLevel;
  const cost = 60 + current * 40;
  if (state.ownership[ticker].shares <= 0) {
    return { next: state, cost: 0, message: 'Own at least 1 share to unlock management tools.' };
  }
  if (balance < cost) {
    return { next: state, cost: 0, message: `Need ${cost} Ø for security upgrade.` };
  }

  return {
    cost,
    message: `${ticker} security upgraded to L${current + 1}.`,
    next: {
      ...state,
      ownership: {
        ...state.ownership,
        [ticker]: {
          ...state.ownership[ticker],
          securityLevel: current + 1
        }
      }
    }
  };
}
