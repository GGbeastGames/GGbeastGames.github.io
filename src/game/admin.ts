import { BaseCommandId } from './terminal';
import { ShopItem, TraitId } from './progression';

export type AdminFeatureToggles = {
  chatOpen: boolean;
  pollsEnabled: boolean;
};

export type AdminAuditLog = {
  id: string;
  ts: number;
  actor: string;
  action: string;
  detail: string;
};

export type AdminPlayerFlag = {
  alias: string;
  flagged: boolean;
  note: string;
  tempBanUntil: number | null;
  permBanned: boolean;
};

export type AdminState = {
  globalBanner: string;
  featureToggles: AdminFeatureToggles;
  watchlist: AdminPlayerFlag[];
  auditLogs: AdminAuditLog[];
};

export const defaultAdminState: AdminState = {
  globalBanner: '',
  featureToggles: {
    chatOpen: false,
    pollsEnabled: false
  },
  watchlist: [],
  auditLogs: []
};

function logEntry(actor: string, action: string, detail: string): AdminAuditLog {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    actor,
    action,
    detail
  };
}

export function appendAudit(state: AdminState, actor: string, action: string, detail: string): AdminState {
  return {
    ...state,
    auditLogs: [logEntry(actor, action, detail), ...state.auditLogs].slice(0, 200)
  };
}

export function grantCommandWithTrait(command: BaseCommandId, trait: TraitId | null): string {
  return trait ? `${command}-${trait}` : command;
}

export function createShopItemTemplate(baseId: BaseCommandId, slot: number, limited: boolean): ShopItem {
  const now = Date.now();
  return {
    id: `${baseId}-admin-${now}`,
    baseId,
    type: 'lesson',
    price: 80,
    slot,
    limitedUntil: limited ? now + 3 * 86_400_000 : null,
    removedAt: null,
    lessonSteps: ['Admin generated lesson step 1', 'Admin generated lesson step 2']
  };
}

export function upsertPlayerFlag(
  state: AdminState,
  alias: string,
  patch: Partial<AdminPlayerFlag>
): AdminState {
  const current = state.watchlist.find((entry) => entry.alias === alias) ?? {
    alias,
    flagged: false,
    note: '',
    tempBanUntil: null,
    permBanned: false
  };

  const next = {
    ...current,
    ...patch,
    alias
  };

  return {
    ...state,
    watchlist: [next, ...state.watchlist.filter((entry) => entry.alias !== alias)]
  };
}
