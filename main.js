import { initFirebaseAuthBridge, initFirebaseDataBridge } from "./src/core/firebase-client.js";
import { createTerminalEngine } from "./src/core/terminal-engine.js";

const ENTRY_HTML = "index.html";
const REQUIRED_DOM_IDS = [
  "root",
  "boot-fallback",
  "boot-status",
  "window-layer",
  "effects-toggle",
  "quality-chip",
  "intro-screen",
  "skip-intro",
  "login-screen",
  "login-form",
  "auth-mode-label",
  "auth-mode-toggle",
  "neural-id",
  "decrypt-key",
  "login-error",
  "desktop-shell",
];
const WINDOW_STORE_KEY = "rootaccess.windows.v1";
const MARKET_CACHE_KEY = "rootaccess.blockchain.v1";

const diagnostics = [];
const appRuntimeState = {
  startupWindowOpen: true,
  safeBootMode: false,
  lastWarning: "",
};
const windowState = {
  windows: new Map(),
  zCounter: 10,
  desktopInitialized: false,
};

let authBridge = null;
let dataBridge = null;
let currentUser = null;
const terminalEngine = createTerminalEngine();

const COMMAND_CATALOG = [
  { id: "phish", label: "phish", price: 0, tier: 1, description: "Starter phishing probe. Base payout: 1-5 Ø." },
  { id: "spoof", label: "spoof", price: 25, tier: 1, description: "Identity spoofing utility for future chains." },
  { id: "scrape", label: "scrape", price: 40, tier: 2, description: "Harvest low-tier public intel blocks." },
  { id: "pivot", label: "pivot", price: 75, tier: 2, description: "Lateral movement helper for advanced hacks." },
];

const playerState = {
  nops: 50,
  ownedCommands: new Set(["phish"]),
};

const stateListeners = new Set();

const appCatalog = {
  terminal: { title: "Terminal", subtitle: "Command shell and live logs" },
  market: { title: "Black Market", subtitle: "Acquire command lessons and software" },
  index: { title: "Index", subtitle: "Owned + locked command catalogue" },
  blockchain: { title: "Blockchain Exchange", subtitle: "Trade corp shares with safety controls" },
  social: { title: "Social Hub", subtitle: "Crews, factions, and cooperative progression" },
  pvp: { title: "PvP Hub", subtitle: "Ranked, raid, and practice combat modes" },
  events: { title: "Events Feed", subtitle: "Flash, weekly, and seasonal operations" },
  settings: { title: "Settings", subtitle: "Client quality and gameplay preferences" },
  admin: { title: "Admin", subtitle: "Role-restricted live-ops console (placeholder)" },
};

const MARKET_SYMBOLS = ["VALK", "GLYPH", "ZERO", "PULSE", "TITAN"];
const marketState = {
  companies: MARKET_SYMBOLS.map((symbol, idx) => ({
    symbol,
    price: 80 + idx * 22,
    prevPrice: 80 + idx * 22,
    volatility: 0.014 + idx * 0.002,
    halted: false,
  })),
  holdings: Object.fromEntries(MARKET_SYMBOLS.map((symbol) => [symbol, 0])),
  history: [],
  transactionCooldownUntil: 0,
  circuitBreakerUntil: 0,
  disconnected: !navigator.onLine,
  tickerHandle: null,
};

const roleState = {
  isAdmin: false,
  isModerator: false,
  isEconomyOps: false,
};

const adminState = {
  featureToggles: {
    chatEnabled: true,
    pvpEnabled: true,
    casinoEnabled: true,
    marketEnabled: true,
  },
  moderationCases: [],
  antiCheatQueue: [
    { uid: 'suspect_8841', reason: 'impossible earnings spike', severity: 'high' },
    { uid: 'suspect_1202', reason: 'rapid-fire auth failures', severity: 'medium' },
  ],
  auditLogs: [],
};


const socialState = {
  crews: [
    { id: 'crew_nova', name: 'Nova Reapers', members: 4, vaultTier: 2, operationReady: true },
    { id: 'crew_umbra', name: 'Umbra Node', members: 3, vaultTier: 1, operationReady: false },
  ],
  factions: [
    { id: 'VALK', bonus: '+5% terminal payout', reputation: 12 },
    { id: 'GLYPH', bonus: '-8% market fees', reputation: 8 },
    { id: 'ZERO', bonus: '+intel reveal chance', reputation: 4 },
    { id: 'PULSE', bonus: '+defense integrity', reputation: 6 },
    { id: 'TITAN', bonus: '+raid extraction speed', reputation: 3 },
  ],
};

const pvpState = {
  beginnerShield: true,
  dailyLossCap: 120,
  dailyLossUsed: 0,
  repeatTargetCooldownSec: 180,
  modes: [
    { id: 'ranked-duel', name: 'Ranked Duel', status: 'searching disabled (scaffold)' },
    { id: 'async-raid', name: 'Asynchronous Raid', status: 'beta queue placeholder' },
    { id: 'team-op', name: 'Team Operation 2v2', status: 'party integration pending' },
    { id: 'sandbox', name: 'Practice Sandbox', status: 'available' },
  ],
};

const eventsState = {
  flash: [
    { id: 'flash_terminal_boost', title: 'Terminal Surge', etaSec: 900, reward: '2x phish payout window' },
  ],
  weekly: [
    { id: 'weekly_faction_push', title: 'Faction Push: GLYPH', progress: 42, target: 100 },
  ],
  seasonal: {
    chapter: 'Season 01: Ghost Relay',
    daysRemaining: 23,
    antiFomo: 'Power rewards rotate into permanent unlock paths next season.',
  },
};



function logDiagnostic(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };
  diagnostics.push(payload);
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method]("[RootAccess Boot]", payload);
}

function getEl(id) {
  return document.getElementById(id);
}

function setBootMessage(message, { isError = false } = {}) {
  const bootFallback = getEl("boot-fallback");
  if (!bootFallback) return;
  bootFallback.textContent = message;
  bootFallback.classList.add("boot-fallback--visible");
  if (isError) bootFallback.style.borderColor = "rgba(255, 92, 138, 0.8)";
}

function failBoot(message, context = {}) {
  logDiagnostic("error", message, context);
  setBootMessage(`RootAccess failed to initialize: ${message}. Check entry file and script paths.`, {
    isError: true,
  });
  const root = getEl("root");
  if (root) root.hidden = true;
}

function warnBoot(message, context = {}) {
  appRuntimeState.safeBootMode = true;
  appRuntimeState.lastWarning = message;
  logDiagnostic("warn", message, context);

  const root = getEl("root");
  if (root) root.hidden = false;

  setBootMessage(`RootAccess warning: ${message}. Continuing in safe mode.`, { isError: false });
}

function guardAgainstWrongEntryPath() {
  const path = window.location.pathname.toLowerCase();
  const badExt = [".md", ".txt", ".json"];

  if (badExt.some((ext) => path.endsWith(ext))) {
    failBoot("wrong entry path detected (document URL points to non-HTML resource)", { path });
    return false;
  }

  const script = document.querySelector('script[src$="main.js"]');
  if (!script) {
    failBoot("main.js module script tag missing", { expectedScript: "./main.js" });
    return false;
  }

  const scriptSrc = script.getAttribute("src") || "";
  if (!scriptSrc.endsWith("main.js")) {
    failBoot("unexpected script source loaded", { scriptSrc });
    return false;
  }

  if (!path.endsWith("/") && !path.endsWith(`/${ENTRY_HTML}`)) {
    logDiagnostic("warn", "App loaded from non-standard route; continuing", { path });
  }

  return true;
}

function ensureDomContract() {
  const missing = REQUIRED_DOM_IDS.filter((id) => !getEl(id));
  if (missing.length > 0) {
    failBoot("required root DOM nodes missing", { missing });
    return false;
  }
  return true;
}

function computeQualityTier() {
  const smallScreen = window.innerWidth < 680;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion || smallScreen) return "Low";
  if (window.innerWidth >= 1200) return "Ultra";
  return "Balanced";
}

function initRenderingPipeline() {
  const root = getEl("root");
  const effectsToggle = getEl("effects-toggle");
  const qualityChip = getEl("quality-chip");

  if (!root || !effectsToggle || !qualityChip) {
    failBoot("rendering pipeline init failed due to missing UI controls");
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const initialEffects = reducedMotion ? "off" : "on";

  root.dataset.effects = initialEffects;
  qualityChip.textContent = `Quality: ${computeQualityTier()}`;
  effectsToggle.setAttribute("aria-pressed", initialEffects === "on" ? "true" : "false");
  effectsToggle.textContent = `Effects: ${initialEffects.toUpperCase()}`;

  effectsToggle.addEventListener("click", () => {
    const next = root.dataset.effects === "on" ? "off" : "on";
    root.dataset.effects = next;
    effectsToggle.setAttribute("aria-pressed", next === "on" ? "true" : "false");
    effectsToggle.textContent = `Effects: ${next.toUpperCase()}`;
    logDiagnostic("log", "effects toggle changed", { value: next });
  });

  let resizeRaf = null;
  window.addEventListener("resize", () => {
    if (resizeRaf) return;
    resizeRaf = window.requestAnimationFrame(() => {
      qualityChip.textContent = `Quality: ${computeQualityTier()}`;
      clampAllWindows();
      resizeRaf = null;
    });
  });
}

function getWindowLayerBounds() {
  const layer = getEl("window-layer");
  if (!layer) return { width: 1200, height: 720, left: 0, top: 0 };
  const rect = layer.getBoundingClientRect();
  return {
    width: Math.max(320, rect.width),
    height: Math.max(260, rect.height),
    left: rect.left,
    top: rect.top,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultWindowRect(index = 0) {
  const bounds = getWindowLayerBounds();
  const width = clamp(Math.floor(bounds.width * 0.48), 320, 760);
  const height = clamp(Math.floor(bounds.height * 0.48), 220, 520);
  const offset = index * 26;
  return {
    x: clamp(26 + offset, 0, bounds.width - width),
    y: clamp(24 + offset, 0, bounds.height - height),
    width,
    height,
  };
}

function saveWindowLayout() {
  try {
    const payload = Array.from(windowState.windows.values()).map((w) => ({
      appId: w.appId,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      minimized: w.minimized,
      maximized: w.maximized,
    }));
    localStorage.setItem(WINDOW_STORE_KEY, JSON.stringify(payload));
  } catch (error) {
    logDiagnostic("warn", "unable to persist window layout", { error: String(error) });
  }
}

function loadWindowLayout() {
  try {
    const raw = localStorage.getItem(WINDOW_STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logDiagnostic("warn", "unable to parse saved window layout", { error: String(error) });
    return [];
  }
}

function bringToFront(appId) {
  const win = windowState.windows.get(appId);
  if (!win) return;
  windowState.zCounter += 1;
  win.z = windowState.zCounter;
  win.element.style.zIndex = String(win.z);
}


function getOwnedCommandsSorted() {
  return COMMAND_CATALOG.filter((command) => playerState.ownedCommands.has(command.id));
}

function getLockedCommandsSorted() {
  return COMMAND_CATALOG.filter((command) => !playerState.ownedCommands.has(command.id));
}

function subscribePlayerState(listener) {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

function notifyPlayerState() {
  stateListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      logDiagnostic('warn', 'state listener failed', { error: String(error) });
    }
  });
}

async function hydratePlayerStateFromCloud() {
  if (!dataBridge || dataBridge.mode !== 'online') {
    notifyPlayerState();
    return;
  }

  const loaded = await dataBridge.loadState();
  if (!loaded.ok || !loaded.state) {
    notifyPlayerState();
    return;
  }

  if (Number.isFinite(Number(loaded.state.nops))) {
    playerState.nops = Math.max(0, Number(loaded.state.nops));
  }

  const cloudCommands = Array.isArray(loaded.state.ownedCommands) ? loaded.state.ownedCommands : [];
  const valid = cloudCommands.filter((id) => COMMAND_CATALOG.some((command) => command.id === id));
  playerState.ownedCommands = new Set(valid.length ? valid : ["phish"]);

  notifyPlayerState();
}

async function persistPlayerStateToCloud() {
  if (!dataBridge || dataBridge.mode !== 'online') return;
  await dataBridge.saveState({
    nops: playerState.nops,
    ownedCommands: Array.from(playerState.ownedCommands),
  });
}

function purchaseCommand(commandId) {
  const command = COMMAND_CATALOG.find((c) => c.id === commandId);
  if (!command) return { ok: false, message: 'Unknown command.' };
  if (playerState.ownedCommands.has(command.id)) return { ok: false, message: `${command.label} already owned.` };
  if (playerState.nops < command.price) return { ok: false, message: `Need ${command.price} Ø for ${command.label}.` };

  playerState.nops -= command.price;
  playerState.ownedCommands.add(command.id);
  notifyPlayerState();
  persistPlayerStateToCloud();

  return { ok: true, message: `Purchased ${command.label} for ${command.price} Ø.` };
}

function saveMarketCache() {
  try {
    const payload = {
      companies: marketState.companies,
      holdings: marketState.holdings,
      history: marketState.history.slice(0, 25),
      transactionCooldownUntil: marketState.transactionCooldownUntil,
    };
    localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    logDiagnostic("warn", "unable to persist market cache", { error: String(error) });
  }
}

function loadMarketCache() {
  try {
    const raw = localStorage.getItem(MARKET_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.companies)) {
      marketState.companies = parsed.companies
        .filter((item) => MARKET_SYMBOLS.includes(item.symbol))
        .map((item, idx) => ({
          symbol: item.symbol,
          price: Math.max(5, Number(item.price) || (80 + idx * 22)),
          prevPrice: Math.max(5, Number(item.prevPrice) || Number(item.price) || (80 + idx * 22)),
          volatility: Math.max(0.005, Math.min(0.05, Number(item.volatility) || (0.014 + idx * 0.002))),
          halted: Boolean(item.halted),
        }));
    }
    if (parsed?.holdings && typeof parsed.holdings === "object") {
      MARKET_SYMBOLS.forEach((symbol) => {
        marketState.holdings[symbol] = Math.max(0, Number(parsed.holdings[symbol]) || 0);
      });
    }
    if (Array.isArray(parsed?.history)) {
      marketState.history = parsed.history.slice(0, 25);
    }
  } catch (error) {
    logDiagnostic("warn", "unable to load market cache", { error: String(error) });
  }
}

function getPortfolioValue() {
  return marketState.companies.reduce((sum, company) => sum + company.price * (marketState.holdings[company.symbol] || 0), 0);
}

function getTotalEquity() {
  return playerState.nops + getPortfolioValue();
}

function marketTransactionGuard() {
  const now = Date.now();
  if (marketState.circuitBreakerUntil > now) {
    return { ok: false, message: `Exchange halted for ${formatSeconds(marketState.circuitBreakerUntil - now)}s due to volatility spike.` };
  }
  if (marketState.transactionCooldownUntil > now) {
    return { ok: false, message: `Trade cooldown active (${formatSeconds(marketState.transactionCooldownUntil - now)}s).` };
  }
  return { ok: true };
}

function transactShares(symbol, direction) {
  const company = marketState.companies.find((item) => item.symbol === symbol);
  if (!company) return { ok: false, message: "Unknown symbol." };

  const guard = marketTransactionGuard();
  if (!guard.ok) return guard;

  if (direction === "buy") {
    if (playerState.nops < company.price) return { ok: false, message: `Insufficient Ø. Need ${company.price.toFixed(2)} Ø.` };
    playerState.nops -= company.price;
    marketState.holdings[symbol] += 1;
  } else {
    if ((marketState.holdings[symbol] || 0) < 1) return { ok: false, message: `No ${symbol} shares available to sell.` };
    playerState.nops += company.price;
    marketState.holdings[symbol] -= 1;
  }

  marketState.transactionCooldownUntil = Date.now() + 3000;
  const action = direction === "buy" ? "BUY" : "SELL";
  marketState.history.unshift(`${new Date().toLocaleTimeString()} ${action} ${symbol} @ ${company.price.toFixed(2)} Ø`);
  marketState.history = marketState.history.slice(0, 25);
  notifyPlayerState();
  persistPlayerStateToCloud();
  saveMarketCache();

  return { ok: true, message: `${action} ${symbol} executed at ${company.price.toFixed(2)} Ø.` };
}

function tickMarketPrices() {
  if (marketState.disconnected) return;

  let breakerTriggered = false;
  marketState.companies = marketState.companies.map((company) => {
    const drift = (Math.random() - 0.5) * company.volatility * 2;
    const prevPrice = company.price;
    const nextPrice = Math.max(5, company.price * (1 + drift));
    const deltaPct = Math.abs((nextPrice - prevPrice) / prevPrice);
    if (deltaPct > 0.095) breakerTriggered = true;

    return {
      ...company,
      prevPrice,
      price: Number(nextPrice.toFixed(2)),
      halted: false,
    };
  });

  if (breakerTriggered) {
    const haltDuration = 15000;
    marketState.circuitBreakerUntil = Date.now() + haltDuration;
    marketState.history.unshift(`${new Date().toLocaleTimeString()} HALT Market paused due to volatility anomaly.`);
  }

  marketState.history = marketState.history.slice(0, 25);
  notifyPlayerState();
  saveMarketCache();
}

function startMarketTicker() {
  if (marketState.tickerHandle) return;
  loadMarketCache();
  marketState.tickerHandle = window.setInterval(tickMarketPrices, 5000);
  window.addEventListener("online", () => {
    marketState.disconnected = false;
    notifyPlayerState();
  });
  window.addEventListener("offline", () => {
    marketState.disconnected = true;
    notifyPlayerState();
  });
}

function canAccessAdminPanel() {
  return Boolean(roleState.isAdmin || roleState.isModerator || roleState.isEconomyOps);
}

function applyRoleAccessToUi() {
  const adminButton = document.querySelector('.taskbar-app[data-app="admin"]');
  if (adminButton) {
    adminButton.hidden = !canAccessAdminPanel();
    adminButton.setAttribute('aria-hidden', adminButton.hidden ? 'true' : 'false');
  }

  if (!canAccessAdminPanel()) {
    closeWindow('admin');
  }
}

async function loadRoleStateFromCloud() {
  if (!dataBridge || typeof dataBridge.loadRoles !== 'function') {
    applyRoleAccessToUi();
    return;
  }

  const result = await dataBridge.loadRoles();
  if (!result?.ok || !result.roles) {
    applyRoleAccessToUi();
    return;
  }

  roleState.isAdmin = Boolean(result.roles.isAdmin);
  roleState.isModerator = Boolean(result.roles.isModerator);
  roleState.isEconomyOps = Boolean(result.roles.isEconomyOps);
  applyRoleAccessToUi();
}

async function appendAdminAuditLog(action, details = {}) {
  const entry = {
    action,
    details,
    adminUid: currentUser?.uid || 'unknown',
    adminEmail: currentUser?.email || 'unknown',
    clientTs: Date.now(),
  };

  adminState.auditLogs.unshift(entry);
  adminState.auditLogs = adminState.auditLogs.slice(0, 100);

  if (dataBridge && typeof dataBridge.appendAuditLog === 'function') {
    await dataBridge.appendAuditLog(entry);
  }
}

function createAdminWindowView() {
  const wrapper = document.createElement('section');
  wrapper.className = 'app-window-body admin-app';

  const title = document.createElement('h2');
  title.textContent = 'Admin Operations Console';

  const roleTag = document.createElement('p');
  roleTag.className = 'admin-role';

  const message = document.createElement('p');
  message.className = 'admin-message';

  const moderation = document.createElement('section');
  moderation.className = 'admin-card';
  moderation.innerHTML = `
    <h3>Player Moderation</h3>
    <label>Target UID <input data-field="uid" type="text" placeholder="player uid" /></label>
    <label>Reason <input data-field="reason" type="text" placeholder="required reason" /></label>
    <div class="admin-actions-row">
      <button type="button" data-mod-action="warn">Warn</button>
      <button type="button" data-mod-action="temp-ban">Temp Ban</button>
      <button type="button" data-mod-action="perma-ban">Perma Ban</button>
    </div>
  `;

  const toggles = document.createElement('section');
  toggles.className = 'admin-card';
  toggles.innerHTML = `
    <h3>Emergency Feature Toggles</h3>
    <div class="admin-toggle-grid">
      <label><input type="checkbox" data-toggle="chatEnabled" /> Chat Enabled</label>
      <label><input type="checkbox" data-toggle="pvpEnabled" /> PvP Enabled</label>
      <label><input type="checkbox" data-toggle="casinoEnabled" /> Casino Enabled</label>
      <label><input type="checkbox" data-toggle="marketEnabled" /> Market Enabled</label>
    </div>
  `;

  const antiCheat = document.createElement('section');
  antiCheat.className = 'admin-card';
  antiCheat.innerHTML = '<h3>Anti-Cheat Review Queue</h3>';
  const antiCheatList = document.createElement('ul');
  antiCheatList.className = 'admin-list';

  const audit = document.createElement('section');
  audit.className = 'admin-card';
  audit.innerHTML = '<h3>Audit Logs</h3>';
  const auditList = document.createElement('ul');
  auditList.className = 'admin-list';

  const render = () => {
    roleTag.textContent = `Role scope: admin=${roleState.isAdmin} moderator=${roleState.isModerator} economyOps=${roleState.isEconomyOps}`;

    toggles.querySelectorAll('[data-toggle]').forEach((toggle) => {
      const key = toggle.getAttribute('data-toggle');
      toggle.checked = Boolean(adminState.featureToggles[key]);
      toggle.disabled = !roleState.isAdmin && !roleState.isEconomyOps;
    });

    moderation.querySelectorAll('button[data-mod-action]').forEach((btn) => {
      btn.disabled = !roleState.isAdmin && !roleState.isModerator;
    });

    antiCheatList.innerHTML = '';
    adminState.antiCheatQueue.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `${item.uid} · ${item.reason} · ${item.severity}`;
      antiCheatList.appendChild(li);
    });

    auditList.innerHTML = '';
    const logs = adminState.auditLogs.length ? adminState.auditLogs : [{ action: 'none', details: { msg: 'No audit entries yet' }, clientTs: Date.now() }];
    logs.slice(0, 20).forEach((entry) => {
      const li = document.createElement('li');
      li.textContent = `${new Date(entry.clientTs).toLocaleTimeString()} · ${entry.action} · ${JSON.stringify(entry.details)}`;
      auditList.appendChild(li);
    });
  };

  moderation.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-mod-action]');
    if (!btn) return;

    const uid = moderation.querySelector('[data-field="uid"]').value.trim();
    const reason = moderation.querySelector('[data-field="reason"]').value.trim();
    const action = btn.getAttribute('data-mod-action');

    if (!uid || !reason) {
      message.textContent = 'Moderation actions require target UID and reason.';
      return;
    }

    adminState.moderationCases.unshift({ uid, reason, action, ts: Date.now() });
    await appendAdminAuditLog(`moderation:${action}`, { uid, reason });
    message.textContent = `Moderation action queued: ${action} on ${uid}.`;
    render();
  });

  toggles.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-toggle]');
    if (!input) return;
    if (!roleState.isAdmin && !roleState.isEconomyOps) {
      message.textContent = 'Insufficient role privileges for feature toggles.';
      render();
      return;
    }

    const key = input.getAttribute('data-toggle');
    const approved = window.confirm(`Confirm feature toggle change for ${key}?`);
    if (!approved) {
      render();
      return;
    }

    adminState.featureToggles[key] = input.checked;
    await appendAdminAuditLog('feature-toggle', { key, enabled: input.checked });
    message.textContent = `Feature toggle updated: ${key}=${input.checked}`;
    render();
  });

  render();
  wrapper.append(title, roleTag, message, moderation, toggles, antiCheat, antiCheatList, audit, auditList);
  return wrapper;
}

function createLogLine(text, level = "normal") {
  const line = document.createElement("div");
  line.className = `terminal-log terminal-log--${level}`;
  line.textContent = text;
  return line;
}

function formatSeconds(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function createTerminalWindowView() {
  const wrapper = document.createElement("section");
  wrapper.className = "app-window-body terminal-app";

  const top = document.createElement("div");
  top.className = "terminal-header-row";
  top.innerHTML = '<h2>Terminal Console</h2><p>Run: <code>phish</code> for starter income.</p>';

  const output = document.createElement("div");
  output.className = "terminal-output";
  output.append(
    createLogLine("[SYS] RootAccess terminal initialized."),
    createLogLine("[TIP] Command available: phish", "hint")
  );

  const controls = document.createElement("form");
  controls.className = "terminal-controls";
  controls.innerHTML = `
    <input class="terminal-input" name="command" type="text" placeholder="Enter command" autocomplete="off" />
    <button class="terminal-run" type="submit">Run</button>
  `;

  const cooldownInfo = document.createElement("p");
  cooldownInfo.className = "terminal-cooldown";
  cooldownInfo.textContent = "Cooldown: ready";

  const appendResult = (result) => {
    if (result.type === "cooldown") {
      output.append(createLogLine(`[COOLDOWN] ${result.message}`, "warn"));
      cooldownInfo.textContent = `Cooldown: ${formatSeconds(result.remainingMs)}s remaining`;
      return;
    }

    if (!result.ok) {
      output.append(createLogLine(`[ERR] ${result.message}`, "error"));
      return;
    }

    const level = result.success ? "success" : "warn";
    output.append(createLogLine(`[EXEC] ${result.message}`, level));
    cooldownInfo.textContent = `Cooldown: ${formatSeconds(result.cooldownMs)}s after run`;
  };

  controls.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = controls.querySelector(".terminal-input");
    const command = input.value.trim();
    if (!command) {
      output.append(createLogLine("[ERR] Empty command.", "error"));
      return;
    }
    const result = terminalEngine.execute(command);
    appendResult(result);
    input.value = "";
    output.scrollTop = output.scrollHeight;
  });

  const inspect = terminalEngine.inspect().commands.map((c) => `${c.id} (cooldown ${Math.ceil(c.cooldownMs / 1000)}s)`).join(", ");
  output.append(createLogLine(`[DATA] Commands loaded: ${inspect}`));

  wrapper.append(top, output, controls, cooldownInfo);
  return wrapper;
}

function createBlackMarketWindowView() {
  const wrapper = document.createElement("section");
  wrapper.className = "app-window-body market-app";

  const title = document.createElement("h2");
  title.textContent = "Black Market";

  const wallet = document.createElement("p");
  wallet.className = "market-wallet";

  const message = document.createElement("p");
  message.className = "market-message";

  const list = document.createElement("div");
  list.className = "market-list";

  const render = () => {
    wallet.textContent = `Wallet: ${playerState.nops} Ø`;
    list.innerHTML = "";

    COMMAND_CATALOG.forEach((command) => {
      const row = document.createElement("article");
      row.className = "market-item";

      const owned = playerState.ownedCommands.has(command.id);
      row.innerHTML = `
        <div>
          <strong>${command.label}</strong>
          <p>${command.description}</p>
          <small>Tier ${command.tier} · Price ${command.price} Ø</small>
        </div>
      `;

      const buy = document.createElement("button");
      buy.className = "market-buy";
      buy.type = "button";
      buy.disabled = owned;
      buy.textContent = owned ? "Owned" : "Buy";
      buy.addEventListener("click", () => {
        const result = purchaseCommand(command.id);
        message.textContent = result.message;
      });

      row.appendChild(buy);
      list.appendChild(row);
    });
  };

  render();
  subscribePlayerState(render);

  wrapper.append(title, wallet, message, list);
  return wrapper;
}

function createIndexWindowView() {
  const wrapper = document.createElement("section");
  wrapper.className = "app-window-body index-app";

  const title = document.createElement("h2");
  title.textContent = "Command Index";

  const ownedTitle = document.createElement("h3");
  ownedTitle.textContent = "Owned Commands";
  const ownedList = document.createElement("ul");
  ownedList.className = "index-list";

  const lockedTitle = document.createElement("h3");
  lockedTitle.textContent = "Locked Commands";
  const lockedList = document.createElement("ul");
  lockedList.className = "index-list";

  const render = () => {
    ownedList.innerHTML = "";
    lockedList.innerHTML = "";

    getOwnedCommandsSorted().forEach((command) => {
      const li = document.createElement("li");
      li.textContent = `${command.label} (tier ${command.tier})`;
      ownedList.appendChild(li);
    });

    getLockedCommandsSorted().forEach((command) => {
      const li = document.createElement("li");
      li.textContent = `${command.label} (cost ${command.price} Ø)`;
      lockedList.appendChild(li);
    });
  };

  render();
  subscribePlayerState(render);

  wrapper.append(title, ownedTitle, ownedList, lockedTitle, lockedList);
  return wrapper;
}

function createBlockchainWindowView() {
  const wrapper = document.createElement("section");
  wrapper.className = "app-window-body blockchain-app";

  const title = document.createElement("h2");
  title.textContent = "Blockchain Exchange";

  const status = document.createElement("p");
  status.className = "blockchain-status";

  const summary = document.createElement("div");
  summary.className = "blockchain-summary";

  const table = document.createElement("div");
  table.className = "blockchain-table";

  const historyTitle = document.createElement("h3");
  historyTitle.textContent = "Recent Transactions";
  const history = document.createElement("ul");
  history.className = "blockchain-history";

  const render = () => {
    const now = Date.now();
    if (marketState.disconnected) {
      status.textContent = "Feed status: DISCONNECTED (showing cached prices)";
    } else if (marketState.circuitBreakerUntil > now) {
      status.textContent = `Feed status: HALTED ${formatSeconds(marketState.circuitBreakerUntil - now)}s remaining`;
    } else {
      status.textContent = "Feed status: LIVE";
    }

    summary.innerHTML = `
      <article><strong>Liquid Ø</strong><span>${playerState.nops.toFixed(2)}</span></article>
      <article><strong>Portfolio</strong><span>${getPortfolioValue().toFixed(2)} Ø</span></article>
      <article><strong>Total Equity</strong><span>${getTotalEquity().toFixed(2)} Ø</span></article>
    `;

    table.innerHTML = "";
    marketState.companies.forEach((company) => {
      const row = document.createElement("article");
      row.className = "blockchain-row";
      const direction = company.price >= company.prevPrice ? "up" : "down";
      const change = (((company.price - company.prevPrice) / company.prevPrice) * 100) || 0;
      row.innerHTML = `
        <div>
          <strong>${company.symbol}</strong>
          <p>Price: ${company.price.toFixed(2)} Ø</p>
          <small class="chip-${direction}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</small>
          <small>Held: ${marketState.holdings[company.symbol] || 0}</small>
        </div>
      `;
      const actionWrap = document.createElement("div");
      actionWrap.className = "blockchain-actions";
      const buyBtn = document.createElement("button");
      buyBtn.type = "button";
      buyBtn.textContent = "Buy 1";
      buyBtn.addEventListener("click", () => {
        const result = transactShares(company.symbol, "buy");
        status.textContent = result.message;
      });
      const sellBtn = document.createElement("button");
      sellBtn.type = "button";
      sellBtn.textContent = "Sell 1";
      sellBtn.addEventListener("click", () => {
        const result = transactShares(company.symbol, "sell");
        status.textContent = result.message;
      });
      actionWrap.append(buyBtn, sellBtn);
      row.appendChild(actionWrap);
      table.appendChild(row);
    });

    history.innerHTML = "";
    const events = marketState.history.length ? marketState.history : ["No transactions yet."];
    events.forEach((entry) => {
      const li = document.createElement("li");
      li.textContent = entry;
      history.appendChild(li);
    });
  };

  render();
  subscribePlayerState(render);
  wrapper.append(title, status, summary, table, historyTitle, history);
  return wrapper;
}

function createSocialHubWindowView() {
  const wrapper = document.createElement('section');
  wrapper.className = 'app-window-body social-app';

  const title = document.createElement('h2');
  title.textContent = 'Social Hub';

  const crews = document.createElement('section');
  crews.className = 'social-card';
  crews.innerHTML = '<h3>Crews</h3>';
  const crewList = document.createElement('ul');
  crewList.className = 'social-list';

  const factions = document.createElement('section');
  factions.className = 'social-card';
  factions.innerHTML = '<h3>Factions</h3>';
  const factionList = document.createElement('ul');
  factionList.className = 'social-list';

  const render = () => {
    crewList.innerHTML = '';
    socialState.crews.forEach((crew) => {
      const li = document.createElement('li');
      li.textContent = `${crew.name} · members ${crew.members} · vault T${crew.vaultTier} · op ${crew.operationReady ? 'ready' : 'pending'}`;
      crewList.appendChild(li);
    });

    factionList.innerHTML = '';
    socialState.factions.forEach((faction) => {
      const li = document.createElement('li');
      li.textContent = `${faction.id} · rep ${faction.reputation} · bonus ${faction.bonus}`;
      factionList.appendChild(li);
    });
  };

  render();
  wrapper.append(title, crews, crewList, factions, factionList);
  return wrapper;
}

function createPvpHubWindowView() {
  const wrapper = document.createElement('section');
  wrapper.className = 'app-window-body pvp-app';

  const title = document.createElement('h2');
  title.textContent = 'PvP Hub';

  const guardrails = document.createElement('section');
  guardrails.className = 'social-card';
  guardrails.innerHTML = `
    <h3>Fair-Play Guardrails</h3>
    <p>Beginner Shield: ${pvpState.beginnerShield}</p>
    <p>Daily Loss Cap: ${pvpState.dailyLossUsed}/${pvpState.dailyLossCap} Ø</p>
    <p>Repeat Target Cooldown: ${pvpState.repeatTargetCooldownSec}s</p>
  `;

  const modeTitle = document.createElement('h3');
  modeTitle.textContent = 'Modes';
  const modeList = document.createElement('ul');
  modeList.className = 'social-list';
  pvpState.modes.forEach((mode) => {
    const li = document.createElement('li');
    li.textContent = `${mode.name} · ${mode.status}`;
    modeList.appendChild(li);
  });

  wrapper.append(title, guardrails, modeTitle, modeList);
  return wrapper;
}

function createEventsWindowView() {
  const wrapper = document.createElement('section');
  wrapper.className = 'app-window-body events-app';

  const title = document.createElement('h2');
  title.textContent = 'Events Feed';

  const flash = document.createElement('section');
  flash.className = 'social-card';
  flash.innerHTML = '<h3>Flash Events</h3>';
  const flashList = document.createElement('ul');
  flashList.className = 'social-list';

  const weekly = document.createElement('section');
  weekly.className = 'social-card';
  weekly.innerHTML = '<h3>Weekly Operations</h3>';
  const weeklyList = document.createElement('ul');
  weeklyList.className = 'social-list';

  const seasonal = document.createElement('section');
  seasonal.className = 'social-card';

  const render = () => {
    flashList.innerHTML = '';
    eventsState.flash.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `${item.title} · starts in ${item.etaSec}s · reward: ${item.reward}`;
      flashList.appendChild(li);
    });

    weeklyList.innerHTML = '';
    eventsState.weekly.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = `${item.title} · ${item.progress}/${item.target}% community progress`;
      weeklyList.appendChild(li);
    });

    seasonal.innerHTML = `
      <h3>Seasonal Arc</h3>
      <p>${eventsState.seasonal.chapter}</p>
      <p>Days remaining: ${eventsState.seasonal.daysRemaining}</p>
      <p>${eventsState.seasonal.antiFomo}</p>
    `;
  };

  render();
  wrapper.append(title, flash, flashList, weekly, weeklyList, seasonal);
  return wrapper;
}

function renderWindowBody(appId) {
  const appDef = appCatalog[appId] || { title: "Unknown App", subtitle: "No app metadata found." };

  if (appId === "terminal") return createTerminalWindowView();
  if (appId === "market") return createBlackMarketWindowView();
  if (appId === "index") return createIndexWindowView();
  if (appId === "blockchain") return createBlockchainWindowView();
  if (appId === "social") return createSocialHubWindowView();
  if (appId === "pvp") return createPvpHubWindowView();
  if (appId === "events") return createEventsWindowView();
  if (appId === "admin") return createAdminWindowView();

  const container = document.createElement("div");
  container.className = "app-window-body";
  container.innerHTML = `
    <h2>${appDef.title}</h2>
    <p>${appDef.subtitle}</p>
    <p class="hint">Phase 10 running: social, PvP, and event scaffolding active.</p>
  `;
  return container;
}

function applyWindowRect(win) {
  win.element.style.left = `${Math.round(win.x)}px`;
  win.element.style.top = `${Math.round(win.y)}px`;
  win.element.style.width = `${Math.round(win.width)}px`;
  win.element.style.height = `${Math.round(win.height)}px`;
}

function clampWindow(win) {
  const bounds = getWindowLayerBounds();

  if (win.maximized) {
    win.x = 0;
    win.y = 0;
    win.width = bounds.width;
    win.height = bounds.height;
    applyWindowRect(win);
    return;
  }

  win.width = clamp(win.width, 320, bounds.width);
  win.height = clamp(win.height, 220, bounds.height);
  win.x = clamp(win.x, 0, bounds.width - win.width);
  win.y = clamp(win.y, 0, bounds.height - win.height);
  applyWindowRect(win);
}

function clampAllWindows() {
  for (const win of windowState.windows.values()) clampWindow(win);
  saveWindowLayout();
}

function toggleMinimize(appId) {
  const win = windowState.windows.get(appId);
  if (!win) return;
  win.minimized = !win.minimized;
  win.element.classList.toggle("window-hidden", win.minimized);
  const taskbarBtn = document.querySelector(`.taskbar-app[data-app="${appId}"]`);
  if (taskbarBtn) taskbarBtn.classList.toggle("taskbar-app--active", !win.minimized);
  if (!win.minimized) bringToFront(appId);
  saveWindowLayout();
}

function toggleMaximize(appId) {
  const win = windowState.windows.get(appId);
  if (!win) return;

  if (!win.maximized) {
    win.restoreRect = { x: win.x, y: win.y, width: win.width, height: win.height };
    win.maximized = true;
  } else {
    win.maximized = false;
    if (win.restoreRect) {
      win.x = win.restoreRect.x;
      win.y = win.restoreRect.y;
      win.width = win.restoreRect.width;
      win.height = win.restoreRect.height;
    }
  }

  clampWindow(win);
  bringToFront(appId);
  saveWindowLayout();
}

function attachDragHandlers(win, handle) {
  let dragState = null;

  const onPointerMove = (event) => {
    if (!dragState || win.maximized) return;
    const bounds = getWindowLayerBounds();
    win.x = clamp(event.clientX - bounds.left - dragState.offsetX, 0, bounds.width - win.width);
    win.y = clamp(event.clientY - bounds.top - dragState.offsetY, 0, bounds.height - win.height);
    applyWindowRect(win);
  };

  const onPointerUp = () => {
    if (!dragState) return;
    dragState.handle.classList.remove("dragging");
    try {
      dragState.handle.releasePointerCapture(dragState.pointerId);
    } catch (_e) {
      /* noop */
    }
    dragState = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    saveWindowLayout();
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || win.maximized) return;
    bringToFront(win.appId);
    const rect = win.element.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      handle,
    };
    handle.classList.add("dragging");
    try {
      handle.setPointerCapture(event.pointerId);
    } catch (_e) {
      /* noop */
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  });
}

function attachResizeHandlers(win, element) {
  const handles = element.querySelectorAll(".resize-handle");

  handles.forEach((handle) => {
    let resizeState = null;

    const onPointerMove = (event) => {
      if (!resizeState || win.maximized) return;
      const bounds = getWindowLayerBounds();
      const dx = event.clientX - resizeState.startX;
      const dy = event.clientY - resizeState.startY;

      if (resizeState.dir.includes("e")) {
        win.width = clamp(resizeState.startWidth + dx, 320, bounds.width - win.x);
      }
      if (resizeState.dir.includes("s")) {
        win.height = clamp(resizeState.startHeight + dy, 220, bounds.height - win.y);
      }

      applyWindowRect(win);
    };

    const onPointerUp = () => {
      if (!resizeState) return;
      try {
        resizeState.handle.releasePointerCapture(resizeState.pointerId);
      } catch (_e) {
        /* noop */
      }
      resizeState = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      saveWindowLayout();
    };

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || win.maximized) return;
      bringToFront(win.appId);
      resizeState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: win.width,
        startHeight: win.height,
        dir: handle.dataset.resize || "se",
        handle,
      };
      try {
        handle.setPointerCapture(event.pointerId);
      } catch (_e) {
        /* noop */
      }
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    });
  });
}

function createWindow(appId, presetRect = null) {
  if (appId === "admin" && !canAccessAdminPanel()) {
    logDiagnostic("warn", "blocked unauthorized admin panel open attempt", { appId, uid: currentUser?.uid || null });
    return;
  }

  if (windowState.windows.has(appId)) {
    const existing = windowState.windows.get(appId);
    existing.minimized = false;
    existing.element.classList.remove("window-hidden");
    bringToFront(appId);
    saveWindowLayout();
    return;
  }

  const layer = getEl("window-layer");
  if (!layer) {
    failBoot("window-layer missing while opening app window", { appId });
    return;
  }

  const defaultRect = presetRect || getDefaultWindowRect(windowState.windows.size);
  const appDef = appCatalog[appId] || { title: appId, subtitle: "Unknown app" };

  const element = document.createElement("article");
  element.className = "desktop-window";
  element.dataset.appId = appId;

  const header = document.createElement("header");
  header.className = "window-header";
  header.innerHTML = `
    <div class="window-title-group">
      <strong class="window-title">${appDef.title}</strong>
      <span class="window-subtitle">${appDef.subtitle}</span>
    </div>
    <div class="window-controls">
      <button type="button" class="window-btn" data-action="minimize" aria-label="Minimize">—</button>
      <button type="button" class="window-btn" data-action="maximize" aria-label="Maximize">▢</button>
    </div>
  `;

  const body = renderWindowBody(appId);
  const resizeE = document.createElement("div");
  resizeE.className = "resize-handle resize-handle-e";
  resizeE.dataset.resize = "e";
  const resizeS = document.createElement("div");
  resizeS.className = "resize-handle resize-handle-s";
  resizeS.dataset.resize = "s";
  const resizeSE = document.createElement("div");
  resizeSE.className = "resize-handle resize-handle-se";
  resizeSE.dataset.resize = "se";

  element.append(header, body, resizeE, resizeS, resizeSE);
  layer.appendChild(element);

  const win = {
    appId,
    element,
    x: defaultRect.x,
    y: defaultRect.y,
    width: defaultRect.width,
    height: defaultRect.height,
    minimized: false,
    maximized: false,
    restoreRect: null,
    z: ++windowState.zCounter,
  };

  windowState.windows.set(appId, win);
  element.style.zIndex = String(win.z);
  clampWindow(win);
  bringToFront(appId);

  element.addEventListener("pointerdown", () => bringToFront(appId));
  attachDragHandlers(win, header);
  attachResizeHandlers(win, element);

  header.querySelector('[data-action="minimize"]').addEventListener("click", () => toggleMinimize(appId));
  header.querySelector('[data-action="maximize"]').addEventListener("click", () => toggleMaximize(appId));

  const taskbarBtn = document.querySelector(`.taskbar-app[data-app="${appId}"]`);
  if (taskbarBtn) taskbarBtn.classList.add("taskbar-app--active");

  saveWindowLayout();
}

function initTaskbarAndWindows() {
  const buttons = document.querySelectorAll(".taskbar-app");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const appId = button.dataset.app;
      if (!appId) return;
      if (appId === "admin" && !canAccessAdminPanel()) return;

      const existing = windowState.windows.get(appId);
      if (existing) {
        if (existing.minimized) toggleMinimize(appId);
        else bringToFront(appId);
        return;
      }

      createWindow(appId);
    });
  });

  const stored = loadWindowLayout();
  stored.forEach((savedWin) => {
    if (!appCatalog[savedWin.appId]) return;
    createWindow(savedWin.appId, savedWin);
    if (savedWin.maximized) toggleMaximize(savedWin.appId);
    if (savedWin.minimized) toggleMinimize(savedWin.appId);
  });

  if (windowState.windows.size === 0) {
    createWindow("terminal");
    createWindow("index");
  }
}

function initAuthBridge() {
  const bootStatus = getEl("boot-status");

  authBridge = {
    mode: 'loading',
    authenticate: async () => ({ ok: false, message: 'Auth service still initializing...' }),
    register: async () => ({ ok: false, message: 'Auth service still initializing...' }),
  };

  initFirebaseAuthBridge({
    onStatus(status) {
      if (bootStatus && !windowState.desktopInitialized) {
        bootStatus.textContent = status === 'online' ? 'AUTH ONLINE' : status === 'offline' ? 'AUTH OFFLINE' : 'AUTH LOADING';
      }
    },
  })
    .then((bridge) => {
      authBridge = bridge;
      logDiagnostic('log', 'firebase auth bridge initialized', { mode: bridge.mode });
      applyRoleAccessToUi();
    })
    .catch((error) => {
      logDiagnostic('warn', 'firebase auth bridge promise rejected unexpectedly', { error: String(error) });
      authBridge = {
        mode: 'offline',
        authenticate: async () => ({ ok: false, message: 'Authentication unavailable. Check network/CSP and Firebase Auth provider settings.' }),
        register: async () => ({ ok: false, message: 'Signup unavailable. Enable Email/Password in Firebase and verify deployed config.' }),
      };
      if (bootStatus && !windowState.desktopInitialized) bootStatus.textContent = 'AUTH OFFLINE';
    });
}

function showDesktopAfterLogin() {
  const experienceLayer = getEl("experience-layer");
  const introScreen = getEl("intro-screen");
  const loginScreen = getEl("login-screen");
  const desktopShell = getEl("desktop-shell");
  const bootStatus = getEl("boot-status");

  if (introScreen) introScreen.hidden = true;
  if (loginScreen) loginScreen.hidden = true;
  if (experienceLayer) experienceLayer.hidden = true;
  if (desktopShell) desktopShell.hidden = false;
  if (bootStatus) bootStatus.textContent = "ONLINE";

  if (!windowState.desktopInitialized) {
    windowState.desktopInitialized = true;
    startMarketTicker();
    initTaskbarAndWindows();
  }
}

function validateLoginInput(neuralId, decryptKey) {
  if (!neuralId || neuralId.trim().length < 3) return "Neural_ID must be at least 3 characters.";
  if (!decryptKey || decryptKey.length < 6) return "Decrypt-Key must be at least 6 characters.";
  return "";
}

function initLoginFlow() {
  const introScreen = getEl("intro-screen");
  const skipIntro = getEl("skip-intro");
  const introStream = getEl("intro-stream");
  const loginScreen = getEl("login-screen");
  const loginForm = getEl("login-form");
  const authModeLabel = getEl("auth-mode-label");
  const authModeToggle = getEl("auth-mode-toggle");
  const loginError = getEl("login-error");
  const neuralId = getEl("neural-id");
  const decryptKey = getEl("decrypt-key");

  if (!introScreen || !skipIntro || !introStream || !loginScreen || !loginForm || !authModeLabel || !authModeToggle || !loginError || !neuralId || !decryptKey) {
    failBoot("intro/login flow failed to initialize due to missing nodes");
    return;
  }

  let authMode = "signin";
  const updateAuthModeUi = () => {
    const signingIn = authMode === "signin";
    authModeLabel.textContent = `Mode: ${signingIn ? "Sign in" : "Sign up"}`;
    authModeToggle.textContent = signingIn ? "Need an account? Create one" : "Already have an account? Sign in";
    const submit = getEl("login-submit");
    if (submit) submit.textContent = signingIn ? "Authenticate" : "Create account";
  };
  updateAuthModeUi();

  const introLines = [
    "Handshake established with relay-04…",
    "Decrypting protocol signatures…",
    "Hardening session route…",
    "Neural gate ready.",
  ];

  let introIndex = 0;
  const introInterval = window.setInterval(() => {
    introStream.textContent = introLines[introIndex % introLines.length];
    introIndex += 1;
  }, 720);

  const revealLogin = () => {
    window.clearInterval(introInterval);
    introScreen.hidden = true;
    loginScreen.hidden = false;
    neuralId.focus();
  };

  const introTimer = window.setTimeout(revealLogin, 3200);

  skipIntro.addEventListener("click", () => {
    window.clearTimeout(introTimer);
    revealLogin();
  });

  authModeToggle.addEventListener("click", () => {
    authMode = authMode === "signin" ? "signup" : "signin";
    loginError.textContent = "";
    updateAuthModeUi();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";

    try {
      const neuralValue = neuralId.value;
      const decryptValue = decryptKey.value;
      const validation = validateLoginInput(neuralValue, decryptValue);
      if (validation) {
        loginError.textContent = validation;
        return;
      }

      loginError.textContent = "Authenticating secure session…";

      const bridge = authBridge;
      if (!bridge || typeof bridge.authenticate !== 'function') {
        loginError.textContent = 'Authentication service not ready yet. Please retry in a second.';
        return;
      }

      const action = authMode === "signup" ? bridge.register : bridge.authenticate;
      if (typeof action !== "function") {
        loginError.textContent = "Authentication mode unavailable right now. Please retry.";
        return;
      }

      const result = await action(neuralValue, decryptValue);
      if (!result.ok) {
        loginError.textContent = result.message;
        return;
      }

      logDiagnostic('log', 'user authenticated', { uid: result.user?.uid, email: result.user?.email });
      currentUser = result.user || null;

      dataBridge = await initFirebaseDataBridge({
        uid: currentUser?.uid,
        onStatus(status) {
          logDiagnostic('log', 'firebase data bridge status', { status });
        },
      });

      await hydratePlayerStateFromCloud();
      if (typeof dataBridge.ensureRolesDoc === "function") {
        await dataBridge.ensureRolesDoc();
      }
      await loadRoleStateFromCloud();

      loginError.textContent = "";
      showDesktopAfterLogin();
    } catch (error) {
      logDiagnostic('warn', 'login flow failed unexpectedly', { error: String(error) });
      loginError.textContent = 'Login flow hit an unexpected error. Please retry.';
    }
  });
}

function mountExperienceShell() {
  const root = getEl("root");
  const bootFallback = getEl("boot-fallback");

  if (!root || !bootFallback) {
    failBoot("root shell mount failed due to missing root nodes");
    return;
  }

  root.hidden = false;
  bootFallback.classList.remove("boot-fallback--visible");

  initLoginFlow();

  // Keep warning visible briefly for diagnostics but do not block gameplay flow.
  window.setTimeout(() => {
    const fallback = getEl("boot-fallback");
    if (fallback && !appRuntimeState.startupWindowOpen) {
      fallback.classList.remove("boot-fallback--visible");
    }
  }, 2600);
}

function runPhase12HealthChecks() {
  const checks = [
    { name: 'entry-route-guard', ok: typeof guardAgainstWrongEntryPath === 'function' },
    { name: 'dom-contract-guard', ok: typeof ensureDomContract === 'function' },
    { name: 'auth-bridge-init', ok: typeof initAuthBridge === 'function' },
    { name: 'login-flow-init', ok: typeof initLoginFlow === 'function' },
    { name: 'window-manager', ok: typeof createWindow === 'function' && typeof initTaskbarAndWindows === 'function' },
    { name: 'terminal-engine', ok: typeof terminalEngine?.execute === 'function' },
    { name: 'market-system', ok: typeof createBlockchainWindowView === 'function' },
    { name: 'admin-gating', ok: typeof canAccessAdminPanel === 'function' },
    { name: 'social-pvp-events', ok: typeof createSocialHubWindowView === 'function' && typeof createPvpHubWindowView === 'function' && typeof createEventsWindowView === 'function' },
  ];

  const failed = checks.filter((item) => !item.ok);
  if (failed.length) {
    warnBoot('Phase 12 health checks found missing modules', { failed: failed.map((x) => x.name) });
  } else {
    logDiagnostic('log', 'phase 12 health checks passed', { checks: checks.length });
  }

  window.__ROOTACCESS_DIAGNOSTICS__ = {
    getDiagnostics: () => diagnostics.slice(-150),
    getAppRuntimeState: () => ({ ...appRuntimeState }),
  };
}

function installGlobalErrorGuards() {
  window.addEventListener("error", (event) => {
    const context = {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
    };

    if (appRuntimeState.startupWindowOpen) {
      warnBoot("runtime error detected during startup", context);
      return;
    }

    warnBoot("runtime error detected after startup", context);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const context = { reason: String(event.reason) };
    event.preventDefault?.();

    if (appRuntimeState.startupWindowOpen) {
      warnBoot("async rejection detected during startup", context);
      return;
    }

    warnBoot("unhandled async rejection detected after startup", context);
  });
}

function boot() {
  installGlobalErrorGuards();

  try {
    if (!guardAgainstWrongEntryPath()) return;
    if (!ensureDomContract()) return;

    initRenderingPipeline();
    initAuthBridge();
    mountExperienceShell();
    runPhase12HealthChecks();
  } catch (error) {
    failBoot('fatal boot exception', { error: String(error) });
  } finally {
    appRuntimeState.startupWindowOpen = false;
  }
}

boot();
