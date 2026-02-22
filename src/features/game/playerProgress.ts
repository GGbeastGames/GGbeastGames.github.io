import { COMMAND_CATALOG, SHOP_ITEMS, TRAIT_ROLL_CHANCE, TRAIT_SUFFIX, TraitId } from './commandCatalog';

export interface PlayerProgress {
  wallet: number;
  xp: number;
  ownedCommands: string[];
  commandTraits: Record<string, TraitId[]>;
  completedLessons: string[];
  entitlements: string[];
  cooldowns: Record<string, number>;
}

const STORAGE_KEY = 'aionous-progress-v2';

const baseline: PlayerProgress = {
  wallet: 220,
  xp: 0,
  ownedCommands: ['phish'],
  commandTraits: {},
  completedLessons: [],
  entitlements: [],
  cooldowns: {},
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
      ownedCommands: parsed.ownedCommands ?? baseline.ownedCommands,
      commandTraits: parsed.commandTraits ?? baseline.commandTraits,
      completedLessons: parsed.completedLessons ?? baseline.completedLessons,
      entitlements: parsed.entitlements ?? baseline.entitlements,
      cooldowns: parsed.cooldowns ?? baseline.cooldowns,
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
