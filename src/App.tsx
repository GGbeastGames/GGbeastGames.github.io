import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { onValue, ref as dbRef, remove, set } from 'firebase/database';
import { auth, rtdb, storage } from './config/firebase';
import { BlackMarketApp } from './components/apps/BlackMarketApp';
import { BlockchainApp } from './components/apps/BlockchainApp';
import { CasinoApp } from './components/apps/CasinoApp';
import { GrowthApp } from './components/apps/GrowthApp';
import { IndexApp } from './components/apps/IndexApp';
import { AdminApp } from './components/apps/AdminApp';
import { SeasonApp } from './components/apps/SeasonApp';
import { PvpApp } from './components/apps/PvpApp';
import { ProfileApp } from './components/apps/ProfileApp';
import { TerminalApp } from './components/apps/TerminalApp';
import {
  BaseCommandId,
  Cooldowns,
  PlayerState,
  TerminalLog,
  defaultCooldowns,
  defaultPlayerState,
  getSuccessRate,
  passiveTraceDecay
} from './game/terminal';
import {
  ProgressionState,
  ShopItem,
  canUnlock,
  defaultProgressionState,
  defaultShopInventory,
  getOwnedCommandKeys,
  isShopItemAvailable,
  randomTraitRoll,
  toCommandKey
} from './game/progression';
import { RetentionState, applyActivity, applyDailyReset, claimDailyStreak, claimMissionReward, defaultRetentionState } from './game/retention';
import { CasinoState, buyLuckCharm, defaultCasinoState, playCasinoRound } from './game/casino';
import { PvpMatchState, PvpQueueEntry, RankedState, createMatch, defaultRankedState, playRound, resolveMatch } from './game/pvp';
import {
  BlockchainState,
  buyShares,
  defaultBlockchainState,
  maybeRefreshMarket,
  sellShares,
  upgradeBlockSecurity
} from './game/blockchain';
import {
  FactionId,
  GrowthState,
  chooseFaction,
  craftCommand,
  decayHeat,
  defaultGrowthState,
  resolveContract,
  startContract
} from './game/growth';
import { SeasonState, applyTheme, buyCosmetic, createMentorTicket, defaultSeasonState, matchMentor } from './game/season';
import { AdminState, appendAudit, createShopItemTemplate, defaultAdminState, grantCommandWithTrait, upsertPlayerFlag } from './game/admin';
import { DisplaySettings, clampUiScale, defaultDisplaySettings } from './game/settings';

type AppPhase = 'boot' | 'login' | 'desktop';
type AppId = 'terminal' | 'market' | 'index' | 'profile' | 'casino' | 'pvp' | 'blockchain' | 'growth' | 'season' | 'admin' | 'settings';

type WindowState = {
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

type PersistedDesktop = {
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

const STORAGE_KEY = 'aionous.desktop.v4';
const BOOT_MS = 2600;
const MAX_LOGS = 100;

const appTemplates: Record<AppId, Omit<WindowState, 'isOpen' | 'isMinimized' | 'isMaximized' | 'z'>> = {
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

function seedWindows(): WindowState[] {
  return (Object.keys(appTemplates) as AppId[]).map((id, i) => ({
    ...appTemplates[id],
    isOpen: id === 'terminal' || id === 'profile',
    isMinimized: false,
    isMaximized: false,
    z: i + 1
  }));
}

function makeLog(text: string, tone: TerminalLog['tone'] = 'info'): TerminalLog {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    text,
    tone
  };
}

function xpToNextLevel(level: number) {
  return 80 + level * 35;
}

function grantXpRewards(state: PlayerState, xpReward: number): { next: PlayerState; logs: TerminalLog[] } {
  const nextState = { ...state, xp: state.xp + xpReward };
  const nextLogs: TerminalLog[] = [makeLog(`Mission reward: +${xpReward} XP`, 'success')];

  while (nextState.xp >= xpToNextLevel(nextState.level)) {
    nextState.xp -= xpToNextLevel(nextState.level);
    nextState.level += 1;
    nextLogs.push(makeLog(`LEVEL UP // Operator level ${nextState.level}`, 'success'));
  }

  return { next: nextState, logs: nextLogs };
}

function readPersisted(): PersistedDesktop {
  const defaults: PersistedDesktop = {
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

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedDesktop>;
    return {
      windows: Array.isArray(parsed.windows) ? parsed.windows : defaults.windows,
      player: parsed.player ? { ...defaults.player, ...parsed.player } : defaults.player,
      cooldowns: parsed.cooldowns ? { ...defaults.cooldowns, ...parsed.cooldowns } : defaults.cooldowns,
      progression: parsed.progression ? { ...defaults.progression, ...parsed.progression } : defaults.progression,
      shopInventory: Array.isArray(parsed.shopInventory) ? parsed.shopInventory : defaults.shopInventory,
      retention: parsed.retention ? { ...defaults.retention, ...parsed.retention } : defaults.retention,
      casino: parsed.casino ? { ...defaults.casino, ...parsed.casino } : defaults.casino,
      ranked: parsed.ranked ? { ...defaults.ranked, ...parsed.ranked } : defaults.ranked,
      blockchain: parsed.blockchain ? { ...defaults.blockchain, ...parsed.blockchain } : defaults.blockchain,
      growth: parsed.growth ? { ...defaults.growth, ...parsed.growth } : defaults.growth,
      season: parsed.season ? { ...defaults.season, ...parsed.season } : defaults.season,
      admin: parsed.admin ? { ...defaults.admin, ...parsed.admin } : defaults.admin,
      displaySettings: parsed.displaySettings ? { ...defaults.displaySettings, ...parsed.displaySettings } : defaults.displaySettings,
      logs: Array.isArray(parsed.logs) ? parsed.logs.slice(-MAX_LOGS) : defaults.logs
    };
  } catch {
    return defaults;
  }
}

export function App() {
  const [phase, setPhase] = useState<AppPhase>('boot');
  const initial = useMemo(() => readPersisted(), []);
  const [windows, setWindows] = useState<WindowState[]>(initial.windows);
  const [player, setPlayer] = useState<PlayerState>(initial.player);
  const [cooldowns, setCooldowns] = useState<Cooldowns>(initial.cooldowns);
  const [progression, setProgression] = useState<ProgressionState>(initial.progression);
  const [shopInventory, setShopInventory] = useState<ShopItem[]>(initial.shopInventory);
  const [retention, setRetention] = useState<RetentionState>(initial.retention);
  const [casino, setCasino] = useState<CasinoState>(initial.casino);
  const [ranked, setRanked] = useState<RankedState>(initial.ranked);
  const [pvpQueue, setPvpQueue] = useState<PvpQueueEntry[]>([]);
  const [inPvpQueue, setInPvpQueue] = useState(false);
  const [activeMatch, setActiveMatch] = useState<PvpMatchState | null>(null);
  const [blockchain, setBlockchain] = useState<BlockchainState>(initial.blockchain);
  const [growth, setGrowth] = useState<GrowthState>(initial.growth);
  const [season, setSeason] = useState<SeasonState>(initial.season);
  const [admin, setAdmin] = useState<AdminState>(initial.admin);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(initial.displaySettings);
  const [logs, setLogs] = useState<TerminalLog[]>(initial.logs);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);

  const dragRef = useRef<{ id: AppId; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('login'), BOOT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) setPhase('desktop');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        windows,
        player,
        cooldowns,
        progression,
        shopInventory,
        retention,
        casino,
        ranked,
        blockchain,
        growth,
        season,
        admin,
        displaySettings,
        logs: logs.slice(-MAX_LOGS)
      } satisfies PersistedDesktop)
    );
  }, [windows, player, cooldowns, progression, shopInventory, retention, casino, ranked, blockchain, growth, season, admin, displaySettings, logs]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlayer((prev) => passiveTraceDecay(prev));
      setRetention((prev) => applyDailyReset(prev));
    }, 5_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBlockchain((prev) => maybeRefreshMarket(prev));
      setGrowth((prev) => decayHeat(prev));
    }, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const queuePath = dbRef(rtdb, 'pvp/queue');
    const unsub = onValue(queuePath, (snap) => {
      const raw = snap.val() as Record<string, { alias: string; rankedPoints: number; queuedAt: number }> | null;
      if (!raw) {
        setPvpQueue([]);
        return;
      }

      const rows: PvpQueueEntry[] = Object.entries(raw).map(([id, value]) => ({
        id,
        alias: value.alias,
        rankedPoints: value.rankedPoints,
        queuedAt: value.queuedAt
      }));
      rows.sort((a, b) => b.queuedAt - a.queuedAt);
      setPvpQueue(rows);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current) return;
      const { id, offsetX, offsetY } = dragRef.current;
      const maxX = Math.max(window.innerWidth - 240, 12);
      const maxY = Math.max(window.innerHeight - 210, 48);

      setWindows((prev) =>
        prev.map((w) =>
          w.id === id && !w.isMaximized
            ? {
                ...w,
                x: Math.min(Math.max(12, event.clientX - offsetX), maxX),
                y: Math.min(Math.max(48, event.clientY - offsetY), maxY)
              }
            : w
        )
      );
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const desktopIdentity = useMemo(() => (guestMode ? 'Guest Operator' : user?.email ?? 'Anonymous'), [guestMode, user]);
  const isAdmin = useMemo(() => {
    const adminEmails = String(import.meta.env.VITE_ADMIN_EMAILS ?? '');
    const allow = adminEmails
      .split(',')
      .map((item: string) => item.trim().toLowerCase())
      .filter(Boolean);
    const email = user?.email?.toLowerCase() ?? '';
    const override = localStorage.getItem('aionous.admin') === 'true';
    return override || (!!email && allow.includes(email));
  }, [user]);
  const topZ = useMemo(() => Math.max(...windows.map((windowItem) => windowItem.z), 0), [windows]);
  const successRate = useMemo(() => Math.round(getSuccessRate(player) * 100), [player]);
  const ownedCommandKeys = useMemo(() => getOwnedCommandKeys(progression.ownedCommands), [progression.ownedCommands]);
  const availableShopItems = useMemo(() => shopInventory.filter((item) => isShopItemAvailable(item)), [shopInventory]);

  function appendLogs(nextLogs: TerminalLog[]) {
    setLogs((prev) => [...prev, ...nextLogs].slice(-MAX_LOGS));
  }

  function onBuyMarketItem(itemId: string) {
    const item = shopInventory.find((shopItem) => shopItem.id === itemId);
    if (!item || !isShopItemAvailable(item) || player.nops < item.price) return;

    setPlayer((prev) => ({ ...prev, nops: prev.nops - item.price }));
    setProgression((prev) => ({
      ...prev,
      pendingLessons: [...prev.pendingLessons, item]
    }));
    appendLogs([makeLog(`Purchased ${item.baseId} ${item.type}. Complete lesson in market queue.`, 'success')]);
  }

  function onCompleteLesson(itemId: string) {
    const pendingItem = progression.pendingLessons.find((item) => item.id === itemId);
    if (!pendingItem) return;
    const trait = randomTraitRoll();

    setProgression((prev) => {
      const nextOwned = [...prev.ownedCommands];
      if (!canUnlock(nextOwned, pendingItem.baseId)) {
        nextOwned.push({
          instanceId: `${pendingItem.baseId}-${Date.now()}`,
          baseId: pendingItem.baseId,
          trait: null,
          unlockedAt: Date.now(),
          source: pendingItem.type
        });
      }

      if (trait) {
        nextOwned.push({
          instanceId: `${pendingItem.baseId}-${trait}-${Date.now()}`,
          baseId: pendingItem.baseId,
          trait,
          unlockedAt: Date.now(),
          source: pendingItem.type
        });
      }

      return {
        ...prev,
        ownedCommands: nextOwned,
        pendingLessons: prev.pendingLessons.filter((item) => item.id !== itemId)
      };
    });

    appendLogs([
      makeLog(`Lesson complete: unlocked ${toCommandKey(pendingItem.baseId, null)}.`, 'success'),
      ...(trait ? [makeLog(`Rare trait found! Unlocked ${toCommandKey(pendingItem.baseId, trait)}.`, 'success')] : [])
    ]);
  }

  function onClaimMission(missionId: string) {
    const result = claimMissionReward(retention, missionId);
    if (!result.xp && !result.nops) return;

    setRetention(result.next);
    setPlayer((prev) => {
      const withNops = { ...prev, nops: prev.nops + result.nops };
      const reward = grantXpRewards(withNops, result.xp);
      appendLogs([...reward.logs, makeLog(`Mission reward: +${result.nops} Ø`, 'success')]);
      return reward.next;
    });
  }

  function onClaimDailyStreak() {
    const result = claimDailyStreak(retention);
    if (!result.nops) return;
    setRetention(result.next);
    setPlayer((prev) => ({ ...prev, nops: prev.nops + result.nops }));
    appendLogs([makeLog(`Streak reward claimed: +${result.nops} Ø`, 'success')]);
  }

  function onPlayCasino(game: 'high-low' | 'neon-wheel', wager: number) {
    if (wager > player.nops) {
      appendLogs([makeLog('Casino wager denied: insufficient Ø balance.', 'warn')]);
      return;
    }

    const outcome = playCasinoRound(casino, game, wager);
    if (outcome.blocked) {
      appendLogs([makeLog(outcome.message, 'warn')]);
      return;
    }

    setCasino(outcome.next);
    setPlayer((prev) => ({ ...prev, nops: prev.nops - wager + outcome.payout }));
    appendLogs([makeLog(`Casino ${game}: ${outcome.message}`, outcome.won ? 'success' : 'warn')]);
  }

  function onBuyCasinoCharm() {
    const result = buyLuckCharm(casino);
    setCasino(result.next);
    appendLogs([makeLog(result.message, result.ok ? 'success' : 'warn')]);
  }

  function onTogglePvpQueue() {
    setInPvpQueue((prev) => !prev);
    const queueId = user?.uid ?? `guest-${desktopIdentity.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const queuePath = dbRef(rtdb, `pvp/queue/${queueId}`);

    if (!inPvpQueue) {
      const newEntry: PvpQueueEntry = {
        id: queueId,
        alias: desktopIdentity,
        rankedPoints: ranked.rankedPoints,
        queuedAt: Date.now()
      };
      void set(queuePath, {
        alias: newEntry.alias,
        rankedPoints: newEntry.rankedPoints,
        queuedAt: newEntry.queuedAt
      });
      setPvpQueue((prev) => [newEntry, ...prev.filter((entry) => entry.id !== queueId)]);
      appendLogs([makeLog('PvP queue joined. Awaiting challenger...', 'info')]);
      return;
    }

    void remove(queuePath);
    setPvpQueue((prev) => prev.filter((entry) => entry.id !== queueId));
    appendLogs([makeLog('PvP queue left.', 'warn')]);
  }

  function onStartPvpMatch(opponentAlias: string) {
    if (activeMatch) return;
    const match = createMatch(opponentAlias);
    setActiveMatch(match);
    appendLogs([makeLog(`PvP match ready: ${desktopIdentity} vs ${opponentAlias}.`, 'success')]);
  }

  function onPlayPvpRound() {
    if (!activeMatch) return;
    const next = playRound(activeMatch);
    setActiveMatch(next);

    appendLogs([
      makeLog(
        `PvP round ${next.roundsPlayed}: You ${next.playerShards}/${next.playerHacks} shards/hacks | Opp ${next.opponentShards}/${next.opponentHacks}.`,
        'info'
      )
    ]);

    if (next.complete) {
      const outcome = resolveMatch(next, ranked);
      setRanked(outcome.ranked);

      if (outcome.result === 'win') {
        setPlayer((prev) => ({ ...prev, nops: prev.nops + Math.floor(prev.nops * outcome.stolenNopsPct) }));
      }

      appendLogs([
        makeLog(
          `PvP result ${outcome.result.toUpperCase()} (${outcome.pointsDelta > 0 ? '+' : ''}${outcome.pointsDelta} RP).`,
          outcome.result === 'win' ? 'success' : 'warn'
        )
      ]);
    }
  }

  function onBuyShares(ticker: keyof BlockchainState['companies'], amount: number) {
    const result = buyShares(blockchain, ticker, amount, player.nops);
    if (!result.cost) {
      appendLogs([makeLog(result.message, 'warn')]);
      return;
    }

    setBlockchain(result.next);
    setPlayer((prev) => ({ ...prev, nops: prev.nops - result.cost }));
    appendLogs([makeLog(result.message, 'success')]);
  }

  function onSellShares(ticker: keyof BlockchainState['companies'], amount: number) {
    const result = sellShares(blockchain, ticker, amount);
    if (!result.payout) {
      appendLogs([makeLog(result.message, 'warn')]);
      return;
    }

    setBlockchain(result.next);
    setPlayer((prev) => ({ ...prev, nops: prev.nops + result.payout }));
    appendLogs([makeLog(result.message, 'success')]);
  }

  function onUpgradeBlockSecurity(ticker: keyof BlockchainState['companies']) {
    const result = upgradeBlockSecurity(blockchain, ticker, player.nops);
    if (!result.cost) {
      appendLogs([makeLog(result.message, 'warn')]);
      return;
    }

    setBlockchain(result.next);
    setPlayer((prev) => ({ ...prev, nops: prev.nops - result.cost }));
    appendLogs([makeLog(result.message, 'success')]);
  }

  function onPickFaction(faction: FactionId) {
    setGrowth((prev) => chooseFaction(prev, faction));
    appendLogs([makeLog(`Faction selected: ${faction}.`, 'success')]);
  }

  function onStartGrowthContract(contractId: string) {
    const result = startContract(growth, contractId);
    setGrowth(result.next);
    appendLogs([makeLog(result.message, result.ok ? 'success' : 'warn')]);
  }

  function onResolveGrowthContract() {
    const result = resolveContract(growth);
    setGrowth(result.next);
    appendLogs([makeLog(result.message, result.finished ? 'success' : 'warn')]);

    if (result.finished) {
      setPlayer((prev) => ({ ...prev, nops: prev.nops + result.rewardNops, xp: prev.xp + result.rewardXp }));
      appendLogs([makeLog(`Ops rewards: +${result.rewardNops} Ø and +${result.rewardXp} XP.`, 'success')]);
    }
  }

  function onCraftGrowthCommand(left: string, right: string, useBoost: boolean) {
    const result = craftCommand(growth, left, right, useBoost);
    setGrowth(result.next);
    appendLogs([
      makeLog(
        `Crafted ${result.resultKey} with trait chance ${Math.round(result.boostedChance * 10000) / 100}%${useBoost ? ' (boosted)' : ''}.`,
        'info'
      )
    ]);
  }

  function onBuySeasonCosmetic(itemId: string, price: number) {
    if (player.nops < price) {
      appendLogs([makeLog('Not enough Ø to buy cosmetic.', 'warn')]);
      return;
    }
    const result = buyCosmetic(season, itemId);
    if (!result.ok) {
      appendLogs([makeLog(result.message, 'warn')]);
      return;
    }
    setSeason(result.next);
    setPlayer((prev) => ({ ...prev, nops: prev.nops - price }));
    appendLogs([makeLog(result.message, 'success')]);
  }

  function onApplySeasonTheme(itemId: string) {
    setSeason((prev) => applyTheme(prev, itemId));
    appendLogs([makeLog(`Theme applied: ${itemId}.`, 'info')]);
  }

  function onCreateSeasonMentorTicket() {
    const result = createMentorTicket(season, desktopIdentity);
    setSeason(result.next);
    appendLogs([makeLog(`Mentor ticket created: ${result.id}.`, 'success')]);
  }

  function onMatchSeasonMentor(ticketId: string) {
    if (!ticketId) return;
    setSeason((prev) => matchMentor(prev, ticketId, desktopIdentity));
    appendLogs([makeLog(`Mentor ticket matched: ${ticketId}.`, 'success')]);
  }

  function onAdminSetBanner(text: string) {
    setAdmin((prev) => appendAudit({ ...prev, globalBanner: text }, desktopIdentity, 'set_banner', text || '<clear>'));
    appendLogs([makeLog(`Admin banner ${text ? 'updated' : 'cleared'}.`, 'success')]);
  }

  function onAdminToggleFeature(key: 'chatOpen' | 'pollsEnabled') {
    setAdmin((prev) => {
      const next = {
        ...prev,
        featureToggles: { ...prev.featureToggles, [key]: !prev.featureToggles[key] }
      };
      return appendAudit(next, desktopIdentity, 'toggle_feature', `${key}=${next.featureToggles[key]}`);
    });
  }

  function onAdminGrantCommand(command: BaseCommandId, withTrait: boolean) {
    const trait = withTrait ? 'spring' : null;
    const commandKey = grantCommandWithTrait(command, trait);
    setProgression((prev) => ({
      ...prev,
      ownedCommands: [
        ...prev.ownedCommands,
        {
          instanceId: `admin-${commandKey}-${Date.now()}`,
          baseId: command,
          trait,
          unlockedAt: Date.now(),
          source: 'admin'
        }
      ]
    }));
    setAdmin((prev) => appendAudit(prev, desktopIdentity, 'grant_command', commandKey));
    appendLogs([makeLog(`Admin granted command: ${commandKey}.`, 'success')]);
  }

  function onAdminAddShopItem(command: BaseCommandId, limited: boolean) {
    const item = createShopItemTemplate(command, Math.floor(Math.random() * 9) + 1, limited);
    setShopInventory((prev) => [item, ...prev]);
    setAdmin((prev) => appendAudit(prev, desktopIdentity, 'shop_item_create', item.id));
    appendLogs([makeLog(`Admin created shop item ${item.id}.`, 'success')]);
  }

  function onAdminFlagPlayer(alias: string, note: string) {
    setAdmin((prev) => appendAudit(upsertPlayerFlag(prev, alias, { flagged: true, note }), desktopIdentity, 'flag_player', alias));
  }

  function onAdminTempBan(alias: string, hours: number) {
    setAdmin((prev) =>
      appendAudit(
        upsertPlayerFlag(prev, alias, { tempBanUntil: Date.now() + hours * 3600_000, flagged: true }),
        desktopIdentity,
        'temp_ban',
        `${alias} ${hours}h`
      )
    );
  }

  function onAdminPermBan(alias: string) {
    setAdmin((prev) => appendAudit(upsertPlayerFlag(prev, alias, { permBanned: true, flagged: true }), desktopIdentity, 'perm_ban', alias));
  }

  async function onUploadProfilePhoto(file: File) {
    const maxSize = 1_000_000;
    if (file.size > maxSize) {
      appendLogs([makeLog('Profile upload failed: image must be <= 1MB.', 'error')]);
      return;
    }

    if (!user) {
      const localUrl = URL.createObjectURL(file);
      setRetention((prev) => ({ ...prev, profilePhotoUrl: localUrl, profilePhotoPath: null }));
      appendLogs([makeLog('Guest mode: profile image set locally (not uploaded).', 'warn')]);
      return;
    }

    try {
      const path = `profiles/${user.uid}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      setRetention((prev) => ({ ...prev, profilePhotoUrl: downloadUrl, profilePhotoPath: path }));
      appendLogs([makeLog('Profile image uploaded successfully.', 'success')]);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      appendLogs([makeLog(`Profile upload failed: ${reason}`, 'error')]);
    }
  }

  function bringToFront(id: AppId) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w)));
  }

  function openWindow(id: AppId) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isOpen: true, isMinimized: false, z: topZ + 1 } : w)));
  }

  function closeWindow(id: AppId) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isOpen: false, isMinimized: false } : w)));
  }

  function toggleMinimize(id: AppId) {
    setWindows((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              isMinimized: !w.isMinimized,
              isMaximized: false,
              z: !w.isMinimized ? w.z : topZ + 1
            }
          : w
      )
    );
  }

  function toggleMaximize(id: AppId) {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized, isMinimized: false, z: topZ + 1 } : w)));
  }

  async function onSubmitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setPhase('desktop');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    setGuestMode(false);
    setPhase('login');
  }

  if (phase === 'boot') {
    return (
      <main className="boot-screen">
        <div className="matrix-rain" aria-hidden="true" />
        <div className="boot-overlay" />
        <div className="boot-content">
          <p>ROOTACCESS // BOOTING NEURAL GRID</p>
          <h1>01001110 01000101 01001111 01001110</h1>
          <div className="boot-loader" />
        </div>
      </main>
    );
  }

  if (phase === 'login') {
    return (
      <main className="login-screen">
        <section className="login-card phase4">
          <p className="kicker">ACCESS TERMINAL</p>
          <h1>Neural Link Login</h1>
          <p className="muted">Authenticate with Firebase or enter Guest mode for local-only prototype sessions.</p>

          <form onSubmit={onSubmitAuth} className="auth-form">
            <label>
              Neural_ID
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="operator@aionous.net"
              />
            </label>
            <label>
              Decrypt-Key
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••"
              />
            </label>

            <button type="submit" disabled={authLoading}>
              {authLoading ? 'Authenticating...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="login-actions">
            <button type="button" onClick={() => setAuthMode((prev) => (prev === 'signin' ? 'signup' : 'signin'))}>
              Switch to {authMode === 'signin' ? 'Create Account' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => {
                setGuestMode(true);
                setPhase('desktop');
              }}
            >
              Enter as Guest
            </button>
          </div>

          {authError ? <p className="error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main
      className={`desktop-shell phase4-desktop theme-${displaySettings.theme}${displaySettings.highContrast ? ' theme-high-contrast' : ''}${displaySettings.reducedMotion ? ' reduced-motion' : ''}`}
      style={{ '--ui-scale': String(clampUiScale(displaySettings.uiScale)) } as CSSProperties}
    >
      <div className="desktop-wallpaper" />
      <header className="desktop-header">
        <div>
          <p className="kicker">Aionous OS // Phase 13</p>
          <h2>Operator: {desktopIdentity}</h2>
        </div>
        <div className="header-metrics">
          <span>Balance: {player.nops} Ø</span>
          <span>Trace: {player.trace}%</span>
          <span>Win rate: {successRate}%</span>
          <span>Streak: {retention.streakDays}d</span>
          <span>Flux: {casino.flux}ƒ</span>
          <span>Ranked: {ranked.rankedPoints} RP</span>
        </div>
        <button type="button" onClick={handleSignOut} className="danger">
          Sign Out
        </button>
      </header>

      {admin.globalBanner ? <div className="global-banner">{admin.globalBanner}</div> : null}

      <section className="window-layer">
        {windows
          .filter((w) => w.isOpen && !w.isMinimized)
          .sort((a, b) => a.z - b.z)
          .map((w) => (
            <article
              key={w.id}
              className="app-window"
              style={
                w.isMaximized
                  ? { top: 52, left: 8, width: 'calc(100vw - 16px)', height: 'calc(100vh - 116px)', zIndex: w.z }
                  : { top: w.y, left: w.x, width: w.width, height: w.height, zIndex: w.z }
              }
              onMouseDown={() => bringToFront(w.id)}
            >
              <header
                className="window-bar"
                onMouseDown={(event) => {
                  if (w.isMaximized) return;
                  dragRef.current = { id: w.id, offsetX: event.clientX - w.x, offsetY: event.clientY - w.y };
                  bringToFront(w.id);
                }}
              >
                <p>{w.title}</p>
                <div className="window-buttons">
                  <button type="button" onClick={() => toggleMinimize(w.id)} title="Minimize">
                    _
                  </button>
                  <button type="button" onClick={() => toggleMaximize(w.id)} title="Maximize">
                    □
                  </button>
                  <button type="button" onClick={() => closeWindow(w.id)} title="Close">
                    ×
                  </button>
                </div>
              </header>
              <div className="window-content">
                {renderWindowContent(w.id, {
                  player,
                  cooldowns,
                  logs,
                  progression,
                  shopInventory,
                  availableShopItems,
                  ownedCommandKeys,
                  retention,
                  casino,
                  ranked,
                  pvpQueue,
                  inPvpQueue,
                  activeMatch,
                  blockchain,
                  growth,
                  season,
                  admin,
                  isAdmin,
                  identity: desktopIdentity,
                  setPlayer,
                  setCooldowns,
                  setRetention,
                  appendLogs,
                  setLogs,
                  onBuyMarketItem,
                  onCompleteLesson,
                  onClaimMission,
                  onClaimDailyStreak,
                  onPlayCasino,
                  onBuyCasinoCharm,
                  onTogglePvpQueue,
                  onStartPvpMatch,
                  onPlayPvpRound,
                  onBuyShares,
                  onSellShares,
                  onUpgradeBlockSecurity,
                  onPickFaction,
                  onStartGrowthContract,
                  onResolveGrowthContract,
                  onCraftGrowthCommand,
                  onBuySeasonCosmetic,
                  onApplySeasonTheme,
                  onCreateSeasonMentorTicket,
                  onMatchSeasonMentor,
                  onAdminSetBanner,
                  onAdminToggleFeature,
                  onAdminGrantCommand,
                  onAdminAddShopItem,
                  onAdminFlagPlayer,
                  onAdminTempBan,
                  onAdminPermBan,
                  onUploadProfilePhoto,
                  displaySettings,
                  onUpdateDisplaySettings: (patch) => setDisplaySettings((prev) => ({ ...prev, ...patch, uiScale: patch.uiScale !== undefined ? clampUiScale(patch.uiScale) : prev.uiScale }))
                })}
              </div>
            </article>
          ))}
      </section>

      <footer className="taskbar">
        {(Object.keys(appTemplates) as AppId[])
          .filter((id) => (id === 'admin' ? isAdmin : true))
          .map((id) => {
            const win = windows.find((w) => w.id === id);
            if (!win) return null;
            const active = win.isOpen && !win.isMinimized;
            return (
              <button
                key={id}
                type="button"
                className={active ? 'active' : ''}
                onClick={() => {
                  if (active) {
                    toggleMinimize(id);
                  } else {
                    openWindow(id);
                  }
                }}
              >
                {win.title}
              </button>
            );
          })}
      </footer>
    </main>
  );
}

type RenderContext = {
  player: PlayerState;
  cooldowns: Cooldowns;
  logs: TerminalLog[];
  progression: ProgressionState;
  shopInventory: ShopItem[];
  availableShopItems: ShopItem[];
  ownedCommandKeys: string[];
  retention: RetentionState;
  casino: CasinoState;
  ranked: RankedState;
  pvpQueue: PvpQueueEntry[];
  inPvpQueue: boolean;
  activeMatch: PvpMatchState | null;
  blockchain: BlockchainState;
  growth: GrowthState;
  season: SeasonState;
  admin: AdminState;
  isAdmin: boolean;
  identity: string;
  setPlayer: (state: PlayerState) => void;
  setCooldowns: (cooldowns: Cooldowns) => void;
  setRetention: (state: RetentionState) => void;
  appendLogs: (logs: TerminalLog[]) => void;
  setLogs: (next: TerminalLog[]) => void;
  onBuyMarketItem: (itemId: string) => void;
  onCompleteLesson: (itemId: string) => void;
  onClaimMission: (missionId: string) => void;
  onClaimDailyStreak: () => void;
  onPlayCasino: (game: 'high-low' | 'neon-wheel', wager: number) => void;
  onBuyCasinoCharm: () => void;
  onTogglePvpQueue: () => void;
  onStartPvpMatch: (opponentAlias: string) => void;
  onPlayPvpRound: () => void;
  onBuyShares: (ticker: keyof BlockchainState['companies'], amount: number) => void;
  onSellShares: (ticker: keyof BlockchainState['companies'], amount: number) => void;
  onUpgradeBlockSecurity: (ticker: keyof BlockchainState['companies']) => void;
  onPickFaction: (faction: FactionId) => void;
  onStartGrowthContract: (contractId: string) => void;
  onResolveGrowthContract: () => void;
  onCraftGrowthCommand: (left: string, right: string, useBoost: boolean) => void;
  onBuySeasonCosmetic: (itemId: string, price: number) => void;
  onApplySeasonTheme: (itemId: string) => void;
  onCreateSeasonMentorTicket: () => void;
  onMatchSeasonMentor: (ticketId: string) => void;
  onAdminSetBanner: (text: string) => void;
  onAdminToggleFeature: (key: 'chatOpen' | 'pollsEnabled') => void;
  onAdminGrantCommand: (command: BaseCommandId, withTrait: boolean) => void;
  onAdminAddShopItem: (command: BaseCommandId, limited: boolean) => void;
  onAdminFlagPlayer: (alias: string, note: string) => void;
  onAdminTempBan: (alias: string, hours: number) => void;
  onAdminPermBan: (alias: string) => void;
  onUploadProfilePhoto: (file: File) => Promise<void>;
  displaySettings: DisplaySettings;
  onUpdateDisplaySettings: (patch: Partial<DisplaySettings>) => void;
};

function renderWindowContent(id: AppId, ctx: RenderContext) {
  switch (id) {
    case 'terminal':
      return (
        <TerminalApp
          player={ctx.player}
          cooldowns={ctx.cooldowns}
          logs={ctx.logs}
          ownedCommandKeys={ctx.ownedCommandKeys}
          onUpdate={(state, nextCooldowns, appendedLogs, meta) => {
            ctx.setPlayer(state);
            ctx.setCooldowns(nextCooldowns);
            if (meta && state.totalRuns > ctx.player.totalRuns) {
              const nextRetention = applyActivity(ctx.retention, {
                commandKey: meta.commandKey,
                success: meta.success,
                payout: meta.payout
              });
              ctx.setRetention(nextRetention);
            }
            ctx.appendLogs(appendedLogs);
          }}
          onClearLogs={() => ctx.setLogs([makeLog('Terminal log cleared.', 'info')])}
        />
      );
    case 'market':
      return (
        <BlackMarketApp
          player={ctx.player}
          progression={ctx.progression}
          inventory={ctx.availableShopItems}
          onBuyItem={ctx.onBuyMarketItem}
          onCompleteLesson={ctx.onCompleteLesson}
        />
      );
    case 'index':
      return <IndexApp progression={ctx.progression} catalog={ctx.shopInventory} />;
    case 'profile':
      return (
        <ProfileApp
          identity={ctx.identity}
          player={ctx.player}
          retention={ctx.retention}
          onClaimMission={ctx.onClaimMission}
          onClaimDailyStreak={ctx.onClaimDailyStreak}
          onUploadProfilePhoto={ctx.onUploadProfilePhoto}
        />
      );
    case 'casino':
      return <CasinoApp casino={ctx.casino} balance={ctx.player.nops} onPlay={ctx.onPlayCasino} onBuyCharm={ctx.onBuyCasinoCharm} />;
    case 'pvp':
      return (
        <PvpApp
          queue={ctx.pvpQueue}
          inQueue={ctx.inPvpQueue}
          alias={ctx.identity}
          ranked={ctx.ranked}
          activeMatch={ctx.activeMatch}
          onToggleQueue={ctx.onTogglePvpQueue}
          onStartMatch={ctx.onStartPvpMatch}
          onPlayRound={ctx.onPlayPvpRound}
        />
      );
    case 'blockchain':
      return (
        <BlockchainApp
          blockchain={ctx.blockchain}
          balance={ctx.player.nops}
          onBuy={ctx.onBuyShares}
          onSell={ctx.onSellShares}
          onUpgradeSecurity={ctx.onUpgradeBlockSecurity}
        />
      );
    case 'growth':
      return (
        <GrowthApp
          growth={ctx.growth}
          onPickFaction={ctx.onPickFaction}
          onStartContract={ctx.onStartGrowthContract}
          onResolveContract={ctx.onResolveGrowthContract}
          onCraft={ctx.onCraftGrowthCommand}
        />
      );
    case 'season':
      return (
        <SeasonApp
          season={ctx.season}
          balance={ctx.player.nops}
          alias={ctx.identity}
          onBuyCosmetic={ctx.onBuySeasonCosmetic}
          onApplyTheme={ctx.onApplySeasonTheme}
          onCreateMentorTicket={ctx.onCreateSeasonMentorTicket}
          onMatchMentor={ctx.onMatchSeasonMentor}
        />
      );
    case 'admin':
      if (!ctx.isAdmin) {
        return <div className="placeholder"><h4>Access denied</h4><p>Admin claim required.</p></div>;
      }
      return (
        <AdminApp
          actor={ctx.identity}
          admin={ctx.admin}
          onSetBanner={ctx.onAdminSetBanner}
          onToggleFeature={ctx.onAdminToggleFeature}
          onGrantCommand={ctx.onAdminGrantCommand}
          onAddShopItem={ctx.onAdminAddShopItem}
          onFlagPlayer={ctx.onAdminFlagPlayer}
          onTempBanPlayer={ctx.onAdminTempBan}
          onPermBanPlayer={ctx.onAdminPermBan}
        />
      );
    case 'settings':
      return (
        <div className="settings-app">
          <h4>System Settings</h4>
          <label>
            Theme Palette
            <select value={ctx.displaySettings.theme} onChange={(event) => ctx.onUpdateDisplaySettings({ theme: event.target.value as DisplaySettings['theme'] })}>
              <option value="matrix">Matrix Grid</option>
              <option value="oasis">Neon Oasis</option>
              <option value="inferno">Inferno PvP</option>
            </select>
          </label>
          <label>
            UI Scale: {ctx.displaySettings.uiScale.toFixed(2)}x
            <input
              type="range"
              min={0.85}
              max={1.2}
              step={0.01}
              value={ctx.displaySettings.uiScale}
              onChange={(event) => ctx.onUpdateDisplaySettings({ uiScale: Number(event.target.value) })}
            />
          </label>
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={ctx.displaySettings.reducedMotion}
              onChange={(event) => ctx.onUpdateDisplaySettings({ reducedMotion: event.target.checked })}
            />
            Reduced Motion
          </label>
          <label className="inline-toggle">
            <input
              type="checkbox"
              checked={ctx.displaySettings.highContrast}
              onChange={(event) => ctx.onUpdateDisplaySettings({ highContrast: event.target.checked })}
            />
            High Contrast
          </label>
          <p className="muted">Phase 13 polish: live theme tuning, better readability, and accessibility toggles.</p>
        </div>
      );
    default:
      return null;
  }
}
