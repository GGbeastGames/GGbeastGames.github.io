const ENTRY_HTML = "index.html";
const REQUIRED_DOM_IDS = [
  "root",
  "boot-fallback",
  "boot-status",
  "desktop-surface",
  "window-layer",
  "effects-toggle",
  "quality-chip",
];
const WINDOW_STORE_KEY = "rootaccess.windows.v1";

const diagnostics = [];
const windowState = {
  windows: new Map(),
  zCounter: 10,
};

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
  if (isError) {
    bootFallback.style.borderColor = "rgba(255, 92, 138, 0.8)";
  }
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

  window.addEventListener("resize", () => {
    qualityChip.textContent = `Quality: ${computeQualityTier()}`;
    clampAllWindows();
  });

  logDiagnostic("log", "rendering pipeline initialized", {
    quality: computeQualityTier(),
    reducedMotion,
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

function renderWindowBody(appId) {
  const appDef = appCatalog[appId] || { title: "Unknown App", subtitle: "No app metadata found." };
  const container = document.createElement("div");
  container.className = "app-window-body";

  try {
    container.innerHTML = `
      <h2>${appDef.title}</h2>
      <p>${appDef.subtitle}</p>
      <p class="hint">Window manager task complete: drag, minimize, maximize, focus, and persist position.</p>
    `;
  } catch (error) {
    container.innerHTML = `<p class="window-error">Window content failed to render safely.</p>`;
    logDiagnostic("error", "window content render failed", { appId, error: String(error) });
  }

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
  for (const win of windowState.windows.values()) {
    clampWindow(win);
  }
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
    win.element.classList.add("window-maximized");
  } else {
    win.maximized = false;
    win.element.classList.remove("window-maximized");
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
  let drag = null;

  const onPointerMove = (event) => {
    if (!drag || win.maximized) return;

    const bounds = getWindowLayerBounds();
    win.x = clamp(event.clientX - bounds.left - drag.offsetX, 0, bounds.width - win.width);
    win.y = clamp(event.clientY - bounds.top - drag.offsetY, 0, bounds.height - win.height);
    applyWindowRect(win);
  };

  const onPointerUp = () => {
    if (!drag) return;
    drag = null;
    handle.classList.remove("dragging");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    saveWindowLayout();
  };

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || win.maximized) return;
    bringToFront(win.appId);
    const rect = win.element.getBoundingClientRect();
    drag = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    handle.classList.add("dragging");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
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
  element.append(header, body);
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
        if (existing.minimized) {
          toggleMinimize(appId);
        } else {
          bringToFront(appId);
        }
        return;
      }

      createWindow(appId);
    });
  });

  const stored = loadWindowLayout();
  stored.forEach((savedWin) => {
    if (!appCatalog[savedWin.appId]) return;
    createWindow(savedWin.appId, savedWin);
    if (savedWin.maximized) {
      toggleMaximize(savedWin.appId);
    }
    if (savedWin.minimized) {
      toggleMinimize(savedWin.appId);
    }
  });

  if (windowState.windows.size === 0) {
    createWindow("terminal");
    createWindow("index");
  }
}

function mountDesktopShell() {
  const root = getEl("root");
  const bootFallback = getEl("boot-fallback");
  const bootStatus = getEl("boot-status");

  if (!root || !bootFallback || !bootStatus) {
    failBoot("desktop shell mount failed due to missing DOM refs");
    return;
  }

  root.hidden = false;
  bootFallback.classList.remove("boot-fallback--visible");
  bootStatus.textContent = "ONLINE";

  logDiagnostic("log", "Desktop shell mounted", {
    viewport: { w: window.innerWidth, h: window.innerHeight },
  });
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
  mountDesktopShell();
  initTaskbarAndWindows();
}

boot();
