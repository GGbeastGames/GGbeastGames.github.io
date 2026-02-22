export type FactionId = 'corp' | 'syndicate' | 'ghost-cell';

export type OpsContract = {
  id: string;
  name: string;
  requiredPlayers: number;
  durationSec: number;
  rewardNops: number;
  rewardXp: number;
  heatGain: number;
};

export type CraftedCommand = {
  id: string;
  recipe: [string, string];
  resultKey: string;
  boostedTraitChance: number;
};

export type GrowthState = {
  faction: FactionId | null;
  factionScore: Record<FactionId, number>;
  heat: number;
  activeContractId: string | null;
  contractEndsAt: number;
  completedContracts: number;
  craftingHistory: CraftedCommand[];
};

export const contracts: OpsContract[] = [
  {
    id: 'ops-datavault',
    name: 'DataVault Breach',
    requiredPlayers: 2,
    durationSec: 120,
    rewardNops: 90,
    rewardXp: 70,
    heatGain: 7
  },
  {
    id: 'ops-shard-heist',
    name: 'Shard Heist',
    requiredPlayers: 3,
    durationSec: 180,
    rewardNops: 130,
    rewardXp: 95,
    heatGain: 10
  }
];

export const defaultGrowthState: GrowthState = {
  faction: null,
  factionScore: {
    corp: 0,
    syndicate: 0,
    'ghost-cell': 0
  },
  heat: 0,
  activeContractId: null,
  contractEndsAt: 0,
  completedContracts: 0,
  craftingHistory: []
};

export function chooseFaction(state: GrowthState, faction: FactionId): GrowthState {
  return { ...state, faction };
}

export function startContract(state: GrowthState, contractId: string, now = Date.now()): { next: GrowthState; ok: boolean; message: string } {
  const contract = contracts.find((item) => item.id === contractId);
  if (!contract) return { next: state, ok: false, message: 'Contract not found.' };
  if (state.activeContractId) return { next: state, ok: false, message: 'A contract is already active.' };

  return {
    ok: true,
    message: `${contract.name} started.`,
    next: {
      ...state,
      activeContractId: contract.id,
      contractEndsAt: now + contract.durationSec * 1000
    }
  };
}

export function resolveContract(
  state: GrowthState,
  now = Date.now()
): { next: GrowthState; finished: boolean; rewardNops: number; rewardXp: number; message: string } {
  if (!state.activeContractId) {
    return { next: state, finished: false, rewardNops: 0, rewardXp: 0, message: 'No active contract.' };
  }

  if (now < state.contractEndsAt) {
    return { next: state, finished: false, rewardNops: 0, rewardXp: 0, message: 'Contract still running.' };
  }

  const contract = contracts.find((item) => item.id === state.activeContractId);
  if (!contract) {
    return {
      next: { ...state, activeContractId: null, contractEndsAt: 0 },
      finished: false,
      rewardNops: 0,
      rewardXp: 0,
      message: 'Contract data unavailable.'
    };
  }

  const faction = state.faction;
  const next = {
    ...state,
    activeContractId: null,
    contractEndsAt: 0,
    completedContracts: state.completedContracts + 1,
    heat: Math.min(100, state.heat + contract.heatGain),
    factionScore: faction
      ? {
          ...state.factionScore,
          [faction]: state.factionScore[faction] + contract.rewardXp
        }
      : state.factionScore
  };

  return {
    next,
    finished: true,
    rewardNops: contract.rewardNops,
    rewardXp: contract.rewardXp,
    message: `${contract.name} complete.`
  };
}

export function craftCommand(
  state: GrowthState,
  left: string,
  right: string,
  useBoost: boolean
): { next: GrowthState; resultKey: string; boostedChance: number } {
  const boostedChance = useBoost ? 0.01 : 0.002;
  const resultKey = `${left}+${right}`;
  const crafted: CraftedCommand = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    recipe: [left, right],
    resultKey,
    boostedTraitChance: boostedChance
  };

  return {
    resultKey,
    boostedChance,
    next: {
      ...state,
      craftingHistory: [crafted, ...state.craftingHistory].slice(0, 20),
      heat: Math.min(100, state.heat + 2)
    }
  };
}

export function decayHeat(state: GrowthState): GrowthState {
  if (state.heat <= 0) return state;
  return { ...state, heat: Math.max(0, state.heat - 1) };
}
