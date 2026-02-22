import { AdminState, defaultAdminState } from '../game/admin';
import { BlockchainState, defaultBlockchainState } from '../game/blockchain';
import { CasinoState, defaultCasinoState } from '../game/casino';
import { DisplaySettings, defaultDisplaySettings } from '../game/settings';
import { GrowthState, defaultGrowthState } from '../game/growth';
import { ProgressionState, ShopItem, defaultProgressionState, defaultShopInventory } from '../game/progression';
import { RankedState, defaultRankedState } from '../game/pvp';
import { RetentionState, defaultRetentionState } from '../game/retention';
import { SeasonState, defaultSeasonState } from '../game/season';
import { Cooldowns, PlayerState, TerminalLog, defaultCooldowns, defaultPlayerState } from '../game/terminal';

export type AppId = 'terminal' | 'market' | 'index' | 'profile' | 'casino' | 'pvp' | 'blockchain' | 'growth' | 'season' | 'admin' | 'settings';

export type WindowState = {
  id: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  z: number;
};

export type PersistedDesktop = {
  windows: WindowState[];
  player: PlayerState;
  cooldowns: Cooldowns;
  logs: TerminalLog[];
  progression: ProgressionState;
  shopInventory: ShopItem[];
  retention: RetentionState;
  casino: CasinoState;
  ranked: RankedState;
  blockchain: BlockchainState;
  growth: GrowthState;
  season: SeasonState;
  admin: AdminState;
  displaySettings: DisplaySettings;
};

export const STORAGE_KEY = 'aionous.desktop.v5';
export const DESKTOP_SCHEMA_VERSION = 1;
export const MAX_LOGS = 100;

export function getStorageKey(uid: string): string {
  return `${STORAGE_KEY}.user.${uid}`;
}

export const appTemplates: Record<AppId, Omit<WindowState, 'isOpen' | 'isMinimized' | 'isMaximized' | 'z'>> = {
  terminal: { id: 'terminal', title: 'Terminal', x: 50, y: 90, width: 700, height: 460 },
  market: { id: 'market', title: 'Black Market', x: 190, y: 120, width: 500, height: 340 },
  index: { id: 'index', title: 'Index', x: 300, y: 180, width: 460, height: 360 },
  profile: { id: 'profile', title: 'Profile', x: 760, y: 100, width: 430, height: 470 },
  casino: { id: 'casino', title: 'Casino', x: 470, y: 120, width: 500, height: 390 },
  pvp: { id: 'pvp', title: 'PvP Arena', x: 380, y: 90, width: 620, height: 420 },
  blockchain: { id: 'blockchain', title: 'Blockchain', x: 260, y: 70, width: 640, height: 420 },
  growth: { id: 'growth', title: 'Growth Hub', x: 230, y: 95, width: 700, height: 430 },
  season: { id: 'season', title: 'Season Hub', x: 250, y: 85, width: 720, height: 430 },
  admin: { id: 'admin', title: 'Admin', x: 180, y: 70, width: 760, height: 460 },
  settings: { id: 'settings', title: 'Settings', x: 800, y: 250, width: 350, height: 240 }
};

export function seedWindows(): WindowState[] {
  return (Object.keys(appTemplates) as AppId[]).map((id, i) => ({
    ...appTemplates[id],
    isOpen: id === 'terminal' || id === 'profile',
    isMinimized: false,
    isMaximized: false,
    z: i + 1
  }));
}

export function makeLog(text: string, tone: TerminalLog['tone'] = 'info'): TerminalLog {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    text,
    tone
  };
}

export function createDefaultDesktopState(): PersistedDesktop {
  return {
    windows: seedWindows(),
    player: defaultPlayerState,
    cooldowns: defaultCooldowns,
    progression: defaultProgressionState,
    shopInventory: defaultShopInventory,
    retention: defaultRetentionState,
    casino: defaultCasinoState,
    ranked: defaultRankedState,
    blockchain: defaultBlockchainState,
    growth: defaultGrowthState,
    season: defaultSeasonState,
    admin: defaultAdminState,
    displaySettings: defaultDisplaySettings,
    logs: [
      makeLog('ROOTACCESS terminal online. Type `help` to list commands.', 'success'),
      makeLog('Mission set: run command loops, then claim mission rewards in Profile.', 'info')
    ]
  };
}

export function isPersistedDesktop(value: unknown): value is PersistedDesktop {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PersistedDesktop>;
  return Boolean(
    Array.isArray(candidate.windows) &&
      candidate.player &&
      candidate.cooldowns &&
      Array.isArray(candidate.logs) &&
      candidate.progression &&
      Array.isArray(candidate.shopInventory) &&
      candidate.retention &&
      candidate.casino &&
      candidate.ranked &&
      candidate.blockchain &&
      candidate.growth &&
      candidate.season &&
      candidate.admin &&
      candidate.displaySettings
  );
}

export function sanitizeDesktopState(value: PersistedDesktop): PersistedDesktop {
  return {
    ...value,
    windows: Array.isArray(value.windows) ? value.windows : seedWindows(),
    shopInventory: Array.isArray(value.shopInventory) ? value.shopInventory : defaultShopInventory,
    logs: Array.isArray(value.logs) ? value.logs.slice(-MAX_LOGS) : []
  };
}

export function parseDesktopEnvelope(value: unknown): PersistedDesktop | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { schemaVersion?: number; desktopState?: unknown };
  if (candidate.schemaVersion !== DESKTOP_SCHEMA_VERSION) return null;
  if (!isPersistedDesktop(candidate.desktopState)) return null;
  return sanitizeDesktopState(candidate.desktopState);
}

export function serializeDesktopEnvelope(desktopState: PersistedDesktop): { schemaVersion: number; desktopState: PersistedDesktop } {
  return {
    schemaVersion: DESKTOP_SCHEMA_VERSION,
    desktopState: sanitizeDesktopState(desktopState)
  };
}

export function resolveHydratedDesktopState(params: {
  cloudState: PersistedDesktop | null;
  localState: PersistedDesktop | null;
  defaults: PersistedDesktop;
}): PersistedDesktop {
  return params.cloudState ?? params.localState ?? params.defaults;
}
