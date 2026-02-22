import { COMMAND_CATALOG, SHOP_ITEMS, TRAIT_ROLL_CHANCE, TRAIT_SUFFIX, TraitId } from './commandCatalog';

export interface CasinoTelemetryEntry {
  id: string;
  gameId: string;
  bet: number;
  adjustedWinChancePct: number;
  payoutMultiplier: number;
  success: boolean;
  walletDelta: number;
  rolledValue: string;
  timestampMs: number;
}

export interface ActiveCharmState {
  sku: string;
  title: string;
  winBoostPct: number;
  usesRemaining: number;
}

export interface CasinoProfile {
  wins: number;
  losses: number;
  winStreak: number;
  bestWinStreak: number;
  totalBets: number;
  sessionLoss: number;
  consecutiveBets: number;
  lastBetAt: number;
  activeCharm: ActiveCharmState | null;
  telemetry: CasinoTelemetryEntry[];
}

export interface PlayerProgress {
  wallet: number;
  flux: number;
  xp: number;
  ownedCommands: string[];
  commandTraits: Record<string, TraitId[]>;
  completedLessons: string[];
  entitlements: string[];
  cooldowns: Record<string, number>;
  badges: string[];
  casino: CasinoProfile;
}

const STORAGE_KEY = 'aionous-progress-v3';

const baselineCasino: CasinoProfile = {
  wins: 0,
  losses: 0,
  winStreak: 0,
  bestWinStreak: 0,
  totalBets: 0,
  sessionLoss: 0,
  consecutiveBets: 0,
  lastBetAt: 0,
  activeCharm: null,
  telemetry: [],
};

const baseline: PlayerProgress = {
  wallet: 220,
  flux: 0,
  xp: 0,
  ownedCommands: ['phish'],
  commandTraits: {},
  completedLessons: [],
  entitlements: [],
  cooldowns: {},
  badges: [],
  casino: baselineCasino,
};

export const loadProgress = (): PlayerProgress => {
  if (typeof window === 'undefined') {
    return baseline;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return baseline;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    return {
      ...baseline,
      ...parsed,
      flux: parsed.flux ?? baseline.flux,
      ownedCommands: parsed.ownedCommands ?? baseline.ownedCommands,
      commandTraits: parsed.commandTraits ?? baseline.commandTraits,
      completedLessons: parsed.completedLessons ?? baseline.completedLessons,
      entitlements: parsed.entitlements ?? baseline.entitlements,
      cooldowns: parsed.cooldowns ?? baseline.cooldowns,
      badges: parsed.badges ?? baseline.badges,
      casino: {
        ...baselineCasino,
        ...(parsed.casino ?? {}),
        telemetry: parsed.casino?.telemetry ?? baselineCasino.telemetry,
      },
    };
  } catch {
    return baseline;
  }
};

export const persistProgress = (progress: PlayerProgress) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
};

export const canUseCommand = (progress: PlayerProgress, commandId: string) => {
  if (progress.ownedCommands.includes(commandId)) {
    return true;
  }

  const command = COMMAND_CATALOG.find((entry) => entry.id === commandId);
  if (!command?.softwareSku) {
    return false;
  }

  return progress.entitlements.includes(command.softwareSku);
};

export const rollTrait = (): TraitId | null => {
  if (Math.random() > TRAIT_ROLL_CHANCE) {
    return null;
  }

  return 'spring';
};

export const traitName = (commandId: string, trait: TraitId) => `${commandId}-${TRAIT_SUFFIX[trait]}`;

export const traitMultiplier = (trait: TraitId, isComplexDependency = false) => {
  if (trait !== 'spring') {
    return 1;
  }

  return isComplexDependency ? 3 : 5;
};

export const resolveOwnershipStatus = (progress: PlayerProgress, commandId: string) => {
  const command = COMMAND_CATALOG.find((entry) => entry.id === commandId);
  if (!command) {
    return 'locked';
  }

  if (canUseCommand(progress, commandId)) {
    return 'owned';
  }

  const item = SHOP_ITEMS.find((candidate) => candidate.commandId === commandId);
  if (item?.removedFromShop) {
    return 'missed';
  }

  return 'locked';
};
