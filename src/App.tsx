import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc, collection, query, orderBy, deleteDoc } from 'firebase/firestore';
import { auth, authPersistenceReady, db } from './config/firebase';
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
import { SessionMode, canPerformAdminAction, getSessionMode, nextQueueIntent } from './app/sessionPolicy';
import { canWriteForHydratedUser, shouldApplySnapshotForActiveUser, shouldResetForUidChange } from './app/authIsolation';
import { DESKTOP_SCHEMA_VERSION } from './app/desktopState';

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


type CloudPlayerCard = {
  uid: string;
  schemaVersion: number;
  profile: {
    email: string;
    alias: string;
    photoURL: string | null;
  };
  roles: {
    admin: boolean;
    moderator: boolean;
  };
  economy: {
    nops: number;
    flux: number;
    trace: number;
    level: number;
    xp: number;
  };
  stats: {
    totalRuns: number;
    successfulRuns: number;
    rankedPoints: number;
    streakDays: number;
  };
  progression: {
    ownedCommandCount: number;
    pendingLessonCount: number;
  };
  desktopState: PersistedDesktop;
  meta: {
    source: 'aionous-client';
    updatedAt: unknown;
  };
};

const BOOT_MS = 2600;
const MAX_LOGS = 100;

function createDefaultDesktopState(): PersistedDesktop {
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

function isPersistedDesktop(value: unknown): value is PersistedDesktop {
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

export function App() {
  const [phase, setPhase] = useState<AppPhase>('boot');
  const initial = useMemo(() => createDefaultDesktopState(), []);
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
  const [cloudAdmin, setCloudAdmin] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [hydratedUid, setHydratedUid] = useState<string | null>(null);
  const [migrationNotice, setMigrationNotice] = useState<string>('');

  const dragRef = useRef<{ id: AppId; offsetX: number; offsetY: number } | null>(null);
  const cloudApplyRef = useRef(false);
  const prevAuthUidRef = useRef<string | null>(null);
  const writeTimerRef = useRef<number | null>(null);
  const activeHydrationUidRef = useRef<string | null>(null);
  const writeEpochRef = useRef(0);

  const sessionMode: SessionMode = getSessionMode(Boolean(user));
  const isViewer = sessionMode === 'viewer';

  function requirePlayerSession(): boolean {
    return Boolean(user?.uid && sessionMode === 'player');
  }

  function resetStateToDefaults() {
    const defaults = createDefaultDesktopState();
    setWindows(defaults.windows);
    setPlayer(defaults.player);
    setCooldowns(defaults.cooldowns);
    setProgression(defaults.progression);
    setShopInventory(defaults.shopInventory);
    setRetention(defaults.retention);
    setCasino(defaults.casino);
    setRanked(defaults.ranked);
    setBlockchain(defaults.blockchain);
    setGrowth(defaults.growth);
    setSeason(defaults.season);
    setAdmin(defaults.admin);
    setDisplaySettings(defaults.displaySettings);
    setLogs(defaults.logs);
  }

  function replaceDesktopState(next: PersistedDesktop) {
    setWindows(Array.isArray(next.windows) ? next.windows : seedWindows());
    setPlayer(next.player);
    setCooldowns(next.cooldowns);
    setProgression(next.progression);
    setShopInventory(Array.isArray(next.shopInventory) ? next.shopInventory : defaultShopInventory);
    setRetention(next.retention);
    setCasino(next.casino);
    setRanked(next.ranked);
    setBlockchain(next.blockchain);
    setGrowth(next.growth);
    setSeason(next.season);
    setAdmin(next.admin);
    setDisplaySettings(next.displaySettings);
    setLogs(Array.isArray(next.logs) ? next.logs.slice(-MAX_LOGS) : []);
  }

  function clearSessionGuards() {
    writeEpochRef.current += 1;
    cloudApplyRef.current = false;
    activeHydrationUidRef.current = null;
    if (writeTimerRef.current !== null) {
      window.clearTimeout(writeTimerRef.current);
      writeTimerRef.current = null;
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (phase === 'boot' && authReady) {
        setPhase('desktop');
      }
    }, BOOT_MS);
    return () => window.clearTimeout(timer);
  }, [phase, authReady, user]);

  useEffect(() => {
    let unsub: () => void = () => {};
    void authPersistenceReady.then(() => {
      unsub = onAuthStateChanged(auth, (nextUser) => {
        const nextUid = nextUser?.uid ?? null;
        const prevUid = prevAuthUidRef.current;

        if (prevUid && prevUid !== nextUid) {
          void deleteDoc(doc(db, 'pvpQueue', prevUid));
        }

        if (shouldResetForUidChange(prevUid, nextUid)) {
          clearSessionGuards();
          setHydratedUid(null);
          setInPvpQueue(false);
          setActiveMatch(null);
          setPvpQueue([]);
          setSessionReady(false);
          resetStateToDefaults();
        }

        prevAuthUidRef.current = nextUid;
        setCloudSyncError('');
        setUser(nextUser);
        setAuthReady(true);

        setPhase('boot');
      });
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSessionReady(false);
      setCloudAdmin(false);
      setCloudSyncError('');
      setHydratedUid(null);
      return;
    }

    const activeUid = user.uid;
    activeHydrationUidRef.current = activeUid;
    const playerRef = doc(db, 'players', activeUid);

    const unsub = onSnapshot(
      playerRef,
      async (snapshot) => {
        try {
          if (!shouldApplySnapshotForActiveUser({ snapshotUid: activeUid, activeHydrationUid: activeHydrationUidRef.current, authUid: auth.currentUser?.uid ?? null })) return;

          if (!snapshot.exists()) {
            const defaults = createDefaultDesktopState();
            const bootstrap: CloudPlayerCard & { uid: string; meta: CloudPlayerCard['meta'] & { createdAt: unknown } } = {
              uid: activeUid,
              schemaVersion: DESKTOP_SCHEMA_VERSION,
              profile: {
                email: user.email ?? '',
                alias: user.email ?? 'Operator',
                photoURL: null
              },
              roles: { admin: false, moderator: false },
              economy: {
                nops: defaults.player.nops,
                flux: defaults.casino.flux,
                trace: defaults.player.trace,
                level: defaults.player.level,
                xp: defaults.player.xp
              },
              stats: {
                totalRuns: defaults.player.totalRuns,
                successfulRuns: defaults.player.totalSuccess,
                rankedPoints: defaults.ranked.rankedPoints,
                streakDays: defaults.retention.streakDays
              },
              progression: {
                ownedCommandCount: defaults.progression.ownedCommands.length,
                pendingLessonCount: defaults.progression.pendingLessons.length
              },
              desktopState: defaults,
              meta: {
                source: 'aionous-client',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              }
            };

            await setDoc(playerRef, bootstrap);
            setCloudSyncError('');
          }

          const data = snapshot.data() as Partial<CloudPlayerCard>;
          if (!shouldApplySnapshotForActiveUser({ snapshotUid: activeUid, activeHydrationUid: activeHydrationUidRef.current, authUid: auth.currentUser?.uid ?? null })) {
            return;
          }

          const hasValidDesktop = data?.schemaVersion === DESKTOP_SCHEMA_VERSION && isPersistedDesktop(data.desktopState);
          if (!hasValidDesktop) {
            const defaults = createDefaultDesktopState();
            await setDoc(playerRef, {
              uid: activeUid,
              schemaVersion: DESKTOP_SCHEMA_VERSION,
              profile: {
                email: user.email ?? '',
                alias: user.email ?? 'Operator',
                photoURL: null
              },
              roles: { admin: false, moderator: false },
              economy: {
                nops: defaults.player.nops,
                flux: defaults.casino.flux,
                trace: defaults.player.trace,
                level: defaults.player.level,
                xp: defaults.player.xp
              },
              stats: {
                totalRuns: defaults.player.totalRuns,
                successfulRuns: defaults.player.totalSuccess,
                rankedPoints: defaults.ranked.rankedPoints,
                streakDays: defaults.retention.streakDays
              },
              progression: {
                ownedCommandCount: defaults.progression.ownedCommands.length,
                pendingLessonCount: defaults.progression.pendingLessons.length
              },
              desktopState: defaults,
              meta: {
                source: 'aionous-client',
                updatedAt: serverTimestamp()
              }
            });
          }

          setCloudAdmin(Boolean(data.roles?.admin));
          const remote: PersistedDesktop = hasValidDesktop ? (data.desktopState as PersistedDesktop) : createDefaultDesktopState();
          cloudApplyRef.current = true;
          replaceDesktopState(remote);
          window.setTimeout(() => {
            cloudApplyRef.current = false;
          }, 0);

          setSessionReady(true);
          setHydratedUid(activeUid);
          setPhase('desktop');
          setCloudSyncError('');
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unknown Firestore error';
          setCloudSyncError(reason);
          setSessionReady(true);
          setPhase('desktop');
          // Keep auth and cloud sync concerns decoupled: sync failures are non-blocking warnings.
        }
      },
      (error) => {
        setCloudSyncError(error.message);
        setSessionReady(true);
        setPhase('desktop');
        // Keep auth and cloud sync concerns decoupled: sync failures are non-blocking warnings.
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !sessionReady || cloudApplyRef.current || hydratedUid !== user.uid) return;
    writeTimerRef.current = window.setTimeout(() => {
      const authUid = auth.currentUser?.uid ?? null;
      if (!canWriteForHydratedUser({ authUid, hydratedUid, payloadUid: user.uid })) return;
      const playerRef = doc(db, 'players', user.uid);
      const payload: Partial<CloudPlayerCard> & { uid: string } = {
        uid: user.uid,
        schemaVersion: DESKTOP_SCHEMA_VERSION,
        profile: {
          email: user.email ?? '',
          alias: user.email ?? 'Operator',
          photoURL: null
        },
        roles: {
          admin: cloudAdmin,
          moderator: false
        },
        economy: {
          nops: player.nops,
          flux: casino.flux,
          trace: player.trace,
          level: player.level,
          xp: player.xp
        },
        stats: {
          totalRuns: player.totalRuns,
          successfulRuns: player.totalSuccess,
          rankedPoints: ranked.rankedPoints,
          streakDays: retention.streakDays
        },
        progression: {
          ownedCommandCount: progression.ownedCommands.length,
          pendingLessonCount: progression.pendingLessons.length
        },
        desktopState: {
          windows,
          player,
          cooldowns,
          logs: logs.slice(-MAX_LOGS),
          progression,
          shopInventory,
          retention,
          casino,
          ranked,
          blockchain,
          growth,
          season,
          admin,
          displaySettings
        },
        meta: {
          source: 'aionous-client',
          updatedAt: serverTimestamp()
        }
      };

      const writeEpoch = writeEpochRef.current;
      void setDoc(playerRef, payload)
        .then(() => {
          if (writeEpoch !== writeEpochRef.current) return;
          setCloudSyncError('');
        })
        .catch((error: unknown) => {
          if (writeEpoch !== writeEpochRef.current) return;
          const reason = error instanceof Error ? error.message : 'Unknown Firestore error';
          setCloudSyncError(reason);
        });
    }, 500);

    return () => {
      if (writeTimerRef.current !== null) {
        window.clearTimeout(writeTimerRef.current);
        writeTimerRef.current = null;
      }
    };
  }, [
    user,
    sessionReady,
    hydratedUid,
    cloudAdmin,
    windows,
    player,
    cooldowns,
    logs,
    progression,
    shopInventory,
    retention,
    casino,
    ranked,
    blockchain,
    growth,
    season,
    admin,
    displaySettings
  ]);

  useEffect(() => {
    const migrationMarker = 'aionous.desktop.v7.migrated';
    if (localStorage.getItem(migrationMarker)) return;
    const legacyKeys = [
      'aionous.desktop.v4',
      'aionous.desktop.v5.guest',
      'aionous.desktop.v5.signed-default',
      'aionous.desktop.v5.signed-out',
      'aionous.desktop.v6.guest',
      'aionous.desktop.v6.shared'
    ];
    let removed = 0;
    legacyKeys.forEach((key) => {
      if (localStorage.getItem(key) !== null) {
        localStorage.removeItem(key);
        removed += 1;
      }
    });
    Object.keys(localStorage)
      .filter((key) => key.startsWith('aionous.desktop.v5') || key.startsWith('aionous.desktop.v6'))
      .forEach((key) => {
        localStorage.removeItem(key);
        removed += 1;
      });
    localStorage.setItem(migrationMarker, '1');
    const message = `Desktop schema v${DESKTOP_SCHEMA_VERSION} migration: cleared ${removed} legacy guest/shared keys.`;
    setMigrationNotice(message);
    console.info(message);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPlayer((prev) => (user ? passiveTraceDecay(prev) : prev));
      setRetention((prev) => (user ? applyDailyReset(prev) : prev));
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBlockchain((prev) => (user ? maybeRefreshMarket(prev) : prev));
      setGrowth((prev) => (user ? decayHeat(prev) : prev));
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPvpQueue([]);
      setInPvpQueue(false);
      return;
    }

    const queueQuery = query(collection(db, 'pvpQueue'), orderBy('queuedAt', 'desc'));
    const unsub = onSnapshot(
      queueQuery,
      (snap) => {
        const rows: PvpQueueEntry[] = snap.docs.map((row) => {
          const value = row.data() as { alias: string; rankedPoints: number; queuedAt: number };
          return {
            id: row.id,
            alias: value.alias,
            rankedPoints: value.rankedPoints,
            queuedAt: value.queuedAt
          };
        });
        setPvpQueue(rows);
        setInPvpQueue(rows.some((entry) => entry.id === user.uid));
      },
      () => {
        setPvpQueue([]);
        setInPvpQueue(false);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!dragRef.current || isViewer) return;
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
  }, [isViewer]);

  const desktopIdentity = useMemo(() => user?.email ?? 'Anonymous', [user]);
  const isAdmin = useMemo(() => {
    const adminEmails = String(import.meta.env.VITE_ADMIN_EMAILS ?? '');
    const allow = adminEmails
      .split(',')
      .map((item: string) => item.trim().toLowerCase())
      .filter(Boolean);
    const email = user?.email?.toLowerCase() ?? '';
    return cloudAdmin || (!!email && allow.includes(email));
  }, [user, cloudAdmin]);
  const hasTrustedAdminRole = cloudAdmin;
  const topZ = useMemo(() => Math.max(...windows.map((windowItem) => windowItem.z), 0), [windows]);
  const successRate = useMemo(() => Math.round(getSuccessRate(player) * 100), [player]);
  const ownedCommandKeys = useMemo(() => getOwnedCommandKeys(progression.ownedCommands), [progression.ownedCommands]);
  const availableShopItems = useMemo(() => shopInventory.filter((item) => isShopItemAvailable(item)), [shopInventory]);

  function appendLogs(nextLogs: TerminalLog[]) {
    setLogs((prev) => [...prev, ...nextLogs].slice(-MAX_LOGS));
  }

  function onBuyMarketItem(itemId: string) {
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
    const result = claimDailyStreak(retention);
    if (!result.nops) return;
    setRetention(result.next);
    setPlayer((prev) => ({ ...prev, nops: prev.nops + result.nops }));
    appendLogs([makeLog(`Streak reward claimed: +${result.nops} Ø`, 'success')]);
  }

  function onPlayCasino(game: 'high-low' | 'neon-wheel', wager: number) {
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
    const result = buyLuckCharm(casino);
    setCasino(result.next);
    appendLogs([makeLog(result.message, result.ok ? 'success' : 'warn')]);
  }

  function onTogglePvpQueue() {
    if (!requirePlayerSession()) return;
    if (!user?.uid) {
      appendLogs([makeLog('PvP queue requires a signed-in account for Firestore matchmaking.', 'warn')]);
      return;
    }

    const queueRef = doc(db, 'pvpQueue', user.uid);

    if (nextQueueIntent(inPvpQueue) === 'join') {
      setInPvpQueue(true);
      const newEntry: PvpQueueEntry = {
        id: user.uid,
        alias: desktopIdentity,
        rankedPoints: ranked.rankedPoints,
        queuedAt: Date.now()
      };
      void setDoc(queueRef, {
        uid: user.uid,
        alias: newEntry.alias,
        rankedPoints: newEntry.rankedPoints,
        queuedAt: newEntry.queuedAt
      });
      appendLogs([makeLog('PvP queue joined. Awaiting challenger...', 'info')]);
      return;
    }

    setInPvpQueue(false);
    void deleteDoc(queueRef);
    appendLogs([makeLog('PvP queue left.', 'warn')]);
  }

  function onStartPvpMatch(opponentAlias: string) {
    if (!requirePlayerSession()) return;
    if (activeMatch) return;
    const match = createMatch(opponentAlias);
    setActiveMatch(match);
    appendLogs([makeLog(`PvP match ready: ${desktopIdentity} vs ${opponentAlias}.`, 'success')]);
  }

  function onPlayPvpRound() {
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
    setGrowth((prev) => chooseFaction(prev, faction));
    appendLogs([makeLog(`Faction selected: ${faction}.`, 'success')]);
  }

  function onStartGrowthContract(contractId: string) {
    if (!requirePlayerSession()) return;
    const result = startContract(growth, contractId);
    setGrowth(result.next);
    appendLogs([makeLog(result.message, result.ok ? 'success' : 'warn')]);
  }

  function onResolveGrowthContract() {
    if (!requirePlayerSession()) return;
    const result = resolveContract(growth);
    setGrowth(result.next);
    appendLogs([makeLog(result.message, result.finished ? 'success' : 'warn')]);

    if (result.finished) {
      setPlayer((prev) => ({ ...prev, nops: prev.nops + result.rewardNops, xp: prev.xp + result.rewardXp }));
      appendLogs([makeLog(`Ops rewards: +${result.rewardNops} Ø and +${result.rewardXp} XP.`, 'success')]);
    }
  }

  function onCraftGrowthCommand(left: string, right: string, useBoost: boolean) {
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
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
    if (!requirePlayerSession()) return;
    setSeason((prev) => applyTheme(prev, itemId));
    appendLogs([makeLog(`Theme applied: ${itemId}.`, 'info')]);
  }

  function onCreateSeasonMentorTicket() {
    if (!requirePlayerSession()) return;
    const result = createMentorTicket(season, desktopIdentity);
    setSeason(result.next);
    appendLogs([makeLog(`Mentor ticket created: ${result.id}.`, 'success')]);
  }

  function onMatchSeasonMentor(ticketId: string) {
    if (!requirePlayerSession()) return;
    if (!ticketId) return;
    setSeason((prev) => matchMentor(prev, ticketId, desktopIdentity));
    appendLogs([makeLog(`Mentor ticket matched: ${ticketId}.`, 'success')]);
  }

  function onAdminSetBanner(text: string) {
    if (!requirePlayerSession()) return;
    if (!canPerformAdminAction(hasTrustedAdminRole, sessionMode)) return;
    setAdmin((prev) => appendAudit({ ...prev, globalBanner: text }, desktopIdentity, 'set_banner', text || '<clear>'));
    appendLogs([makeLog(`Admin banner ${text ? 'updated' : 'cleared'}.`, 'success')]);
  }

  function onAdminToggleFeature(key: 'chatOpen' | 'pollsEnabled') {
    if (!requirePlayerSession()) return;
    if (!canPerformAdminAction(hasTrustedAdminRole, sessionMode)) return;
    setAdmin((prev) => {
      const next = {
        ...prev,
        featureToggles: { ...prev.featureToggles, [key]: !prev.featureToggles[key] }
      };
      return appendAudit(next, desktopIdentity, 'toggle_feature', `${key}=${next.featureToggles[key]}`);
    });
  }

  function onAdminGrantCommand(command: BaseCommandId, withTrait: boolean) {
    if (!requirePlayerSession()) return;
    if (!canPerformAdminAction(hasTrustedAdminRole, sessionMode)) return;
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
    if (!requirePlayerSession()) return;
    if (!canPerformAdminAction(hasTrustedAdminRole, sessionMode)) return;
    const item = createShopItemTemplate(command, Math.floor(Math.random() * 9) + 1, limited);
    setShopInventory((prev) => [item, ...prev]);
    setAdmin((prev) => appendAudit(prev, desktopIdentity, 'shop_item_create', item.id));
    appendLogs([makeLog(`Admin created shop item ${item.id}.`, 'success')]);
  }

  function onAdminFlagPlayer(alias: string, note: string) {
    if (!requirePlayerSession()) return;
    if (!canPerformAdminAction(hasTrustedAdminRole, sessionMode)) return;
    setAdmin((prev) => appendAudit(upsertPlayerFlag(prev, alias, { flagged: true, note }), desktopIdentity, 'flag_player', alias));
  }

  function onAdminTempBan(alias: string, hours: number) {
    if (!requirePlayerSession()) return;
    if (!canPerformAdminAction(hasTrustedAdminRole, sessionMode)) return;
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
    if (!requirePlayerSession()) return;
    if (!canPerformAdminAction(hasTrustedAdminRole, sessionMode)) return;
    setAdmin((prev) => appendAudit(upsertPlayerFlag(prev, alias, { permBanned: true, flagged: true }), desktopIdentity, 'perm_ban', alias));
  }

  function bringToFront(id: AppId) {
    if (isViewer) return;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, z: topZ + 1 } : w)));
  }

  function openWindow(id: AppId) {
    if (isViewer) return;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isOpen: true, isMinimized: false, z: topZ + 1 } : w)));
  }

  function closeWindow(id: AppId) {
    if (isViewer) return;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isOpen: false, isMinimized: false } : w)));
  }

  function toggleMinimize(id: AppId) {
    if (isViewer) return;
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
    if (isViewer) return;
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
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    if (user?.uid) {
      await deleteDoc(doc(db, 'pvpQueue', user.uid));
    }
    await signOut(auth);
    clearSessionGuards();
    setHydratedUid(null);
    setSessionReady(false);
    resetStateToDefaults();
    setPhase('desktop');
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
          <p className="muted">Authenticate with Firebase to access your account-specific cloud progression. Session persistence is tab-session scoped: closing the browser signs you out.</p>

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
          </div>

          {authError ? <p className="error">{authError}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main
      className={`desktop-shell phase4-desktop ${isViewer ? 'viewer-readonly' : ''} theme-${displaySettings.theme}${displaySettings.highContrast ? ' theme-high-contrast' : ''}${displaySettings.reducedMotion ? ' reduced-motion' : ''}`}
      style={{ '--ui-scale': String(clampUiScale(displaySettings.uiScale)) } as CSSProperties}
    >
      <div className="desktop-wallpaper" />
      <header className="desktop-header">
        <div>
          <p className="kicker">Aionous OS // Phase 13</p>
          <h2>Operator: {desktopIdentity}</h2>
        </div>
        <div className="header-metrics">
          <article><small>Balance</small><strong>{player.nops} Ø</strong></article>
          <article><small>Trace</small><strong>{player.trace}%</strong></article>
          <article><small>Success</small><strong>{successRate}%</strong></article>
          <article><small>Streak</small><strong>{retention.streakDays}d</strong></article>
          <article><small>Flux</small><strong>{casino.flux}ƒ</strong></article>
          <article><small>Rank</small><strong>{ranked.rankedPoints} RP</strong></article>
        </div>
        {user ? (
          <button type="button" onClick={handleSignOut} className="danger">
            Sign Out
          </button>
        ) : (
          <button type="button" onClick={() => setPhase('login')}>
            Sign In
          </button>
        )}
      </header>

      {isViewer ? <div className="global-banner">Viewer mode: read-only preview. Sign in to enable progression and saving.</div> : null}
      {migrationNotice ? <div className="global-banner">{migrationNotice}</div> : null}
      {cloudSyncError ? <div className="global-banner">Firestore sync error: {cloudSyncError}</div> : null}
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
          onUpgradeSecurity={ctx.onUpgradeBlockSecurity}
          onSell={ctx.onSellShares}
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
