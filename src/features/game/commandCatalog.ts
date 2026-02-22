export type TraitId = 'spring';

export interface CommandCatalogEntry {
  id: string;
  aliases: string[];
  description: string;
  usage: string;
  cooldownMs: number;
  successChance: number;
  rewardRange: { min: number; max: number };
  penaltyRange: { min: number; max: number };
  xpRange: { min: number; max: number };
  lessonSku?: string;
  softwareSku?: string;
  removedFromShop?: boolean;
}

export type ShopItemType = 'lesson' | 'software';

export interface ShopItem {
  sku: string;
  type: ShopItemType;
  commandId: string;
  title: string;
  description: string;
  cost: number;
  removedFromShop?: boolean;
}

export const TRAIT_SUFFIX: Record<TraitId, string> = {
  spring: 'TS',
};

export const TRAIT_ROLL_CHANCE = 0.00001;

export const COMMAND_CATALOG: CommandCatalogEntry[] = [
  {
    id: 'phish',
    aliases: ['ph'],
    usage: 'phish',
    description: 'Starter social engineering run with low risk/reward.',
    cooldownMs: 12_000,
    successChance: 0.56,
    rewardRange: { min: 22, max: 85 },
    penaltyRange: { min: 8, max: 34 },
    xpRange: { min: 8, max: 21 },
  },
  {
    id: 'spoof',
    aliases: ['sp'],
    usage: 'spoof',
    description: 'Identity spoof chain with stronger upside once trained.',
    cooldownMs: 20_000,
    successChance: 0.48,
    rewardRange: { min: 45, max: 130 },
    penaltyRange: { min: 18, max: 52 },
    xpRange: { min: 16, max: 38 },
    lessonSku: 'lesson_spoof_v1',
  },
  {
    id: 'packetstorm',
    aliases: ['ps'],
    usage: 'packetstorm',
    description: 'High-value network strike requiring PacketStorm suite.',
    cooldownMs: 30_000,
    successChance: 0.44,
    rewardRange: { min: 70, max: 180 },
    penaltyRange: { min: 25, max: 70 },
    xpRange: { min: 24, max: 48 },
    softwareSku: 'software_packetstorm',
  },
];

export const SHOP_ITEMS: ShopItem[] = [
  {
    sku: 'lesson_spoof_v1',
    type: 'lesson',
    commandId: 'spoof',
    title: 'Lesson: Spoof Identity Chains',
    description: 'Guided tutorial that permanently unlocks the spoof command on completion.',
    cost: 120,
  },
  {
    sku: 'software_packetstorm',
    type: 'software',
    commandId: 'packetstorm',
    title: 'PacketStorm Suite',
    description: 'Installable toolkit that unlocks packetstorm command execution.',
    cost: 320,
    removedFromShop: true,
  },
];
