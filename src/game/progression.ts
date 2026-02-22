import { BaseCommandId, baseCommandSpecs } from './terminal';

export type TraitId = 'spring';

export type OwnedCommand = {
  instanceId: string;
  baseId: BaseCommandId;
  trait: TraitId | null;
  unlockedAt: number;
  source: 'starter' | 'lesson' | 'software' | 'admin';
};

export type ShopItem = {
  id: string;
  baseId: BaseCommandId;
  type: 'lesson' | 'software';
  price: number;
  slot: number;
  limitedUntil: number | null;
  removedAt: number | null;
  lessonSteps: string[];
};

export type ProgressionState = {
  ownedCommands: OwnedCommand[];
  pendingLessons: ShopItem[];
  missedLimited: Array<{ itemId: string; baseId: BaseCommandId; expiredAt: number }>;
};

export const TRAIT_VARIANT_SUFFIX: Record<TraitId, string> = {
  spring: 'ts'
};

export const defaultShopInventory: ShopItem[] = [
  {
    id: 'scan-lesson-v1',
    baseId: 'scan',
    type: 'lesson',
    price: 45,
    slot: 1,
    limitedUntil: null,
    removedAt: null,
    lessonSteps: ['Launch packet sniffer', 'Trace open ports', 'Run scan --silent']
  },
  {
    id: 'spoof-suite-v1',
    baseId: 'spoof',
    type: 'software',
    price: 125,
    slot: 2,
    limitedUntil: null,
    removedAt: null,
    lessonSteps: ['Install spoof runtime', 'Mask digital signature', 'Execute spoof --proxy']
  },
  {
    id: 'scan-lesson-limited',
    baseId: 'scan',
    type: 'lesson',
    price: 80,
    slot: 3,
    limitedUntil: Date.now() - 86_400_000,
    removedAt: Date.now() - 86_400_000,
    lessonSteps: ['Expired slot sample']
  }
];

export const defaultProgressionState: ProgressionState = {
  ownedCommands: [
    {
      instanceId: 'starter-phish',
      baseId: 'phish',
      trait: null,
      unlockedAt: Date.now(),
      source: 'starter'
    }
  ],
  pendingLessons: [],
  missedLimited: [
    {
      itemId: 'scan-lesson-limited',
      baseId: 'scan',
      expiredAt: Date.now() - 86_400_000
    }
  ]
};

export function toCommandKey(baseId: BaseCommandId, trait: TraitId | null): string {
  if (!trait) return baseId;
  return `${baseId}-${TRAIT_VARIANT_SUFFIX[trait]}`;
}

export function getOwnedCommandKeys(ownedCommands: OwnedCommand[]): string[] {
  return ownedCommands.map((item) => toCommandKey(item.baseId, item.trait));
}

export function getTraitMultiplier(trait: TraitId | null): number {
  if (trait === 'spring') return 5;
  return 1;
}

export function getComboTraitMultiplier(trait: TraitId | null): number {
  if (trait === 'spring') return 3;
  return 1;
}

export function randomTraitRoll(): TraitId | null {
  if (Math.random() <= 0.001) return 'spring';
  return null;
}

export function isShopItemAvailable(item: ShopItem, now = Date.now()): boolean {
  if (item.removedAt) return false;
  if (item.limitedUntil && item.limitedUntil < now) return false;
  return true;
}

export function canUnlock(ownedCommands: OwnedCommand[], baseId: BaseCommandId) {
  return ownedCommands.some((item) => item.baseId === baseId && item.trait === null);
}

export function formatShopItemName(item: ShopItem): string {
  const commandName = baseCommandSpecs[item.baseId].label;
  return `${commandName} ${item.type === 'lesson' ? 'Lesson' : 'Software'}`;
}
