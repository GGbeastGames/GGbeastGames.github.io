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
  "neural-id",
  "decrypt-key",
  "login-error",
  "desktop-shell",
];
const WINDOW_STORE_KEY = "rootaccess.windows.v1";

const diagnostics = [];
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
  settings: { title: "Settings", subtitle: "Client quality and gameplay preferences" },
  admin: { title: "Admin", subtitle: "Role-restricted live-ops console (placeholder)" },
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

function renderWindowBody(appId) {
  const appDef = appCatalog[appId] || { title: "Unknown App", subtitle: "No app metadata found." };

  if (appId === "terminal") return createTerminalWindowView();
  if (appId === "market") return createBlackMarketWindowView();
  if (appId === "index") return createIndexWindowView();

  const container = document.createElement("div");
  container.className = "app-window-body";
  container.innerHTML = `
    <h2>${appDef.title}</h2>
    <p>${appDef.subtitle}</p>
    <p class="hint">Phase 7 running: market/index systems active with player-state sync.</p>
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
  };

  initFirebaseAuthBridge({
    onStatus(status) {
      if (bootStatus && !windowState.desktopInitialized) {
        bootStatus.textContent = status === 'online' ? 'AUTH ONLINE' : status === 'offline' ? 'AUTH OFFLINE' : 'AUTH LOADING';
      }
    },
  }).then((bridge) => {
    authBridge = bridge;
    logDiagnostic('log', 'firebase auth bridge initialized', { mode: bridge.mode });
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
  const loginError = getEl("login-error");
  const neuralId = getEl("neural-id");
  const decryptKey = getEl("decrypt-key");

  if (!introScreen || !skipIntro || !introStream || !loginScreen || !loginForm || !loginError || !neuralId || !decryptKey) {
    failBoot("intro/login flow failed to initialize due to missing nodes");
    return;
  }

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

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.textContent = "";

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

    const result = await bridge.authenticate(neuralValue, decryptValue);
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

    loginError.textContent = "";
    showDesktopAfterLogin();
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
}

function installGlobalErrorGuards() {
  window.addEventListener("error", (event) => {
    failBoot("runtime error during startup", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      col: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    failBoot("unhandled async rejection during startup", {
      reason: String(event.reason),
    });
  });
}

function boot() {
  installGlobalErrorGuards();

  if (!guardAgainstWrongEntryPath()) return;
  if (!ensureDomContract()) return;

  initRenderingPipeline();
  initAuthBridge();
  mountExperienceShell();
}

boot();
