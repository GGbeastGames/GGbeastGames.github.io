const ENTRY_HTML = "index.html";
const REQUIRED_DOM_IDS = [
  "root",
  "boot-fallback",
  "boot-status",
  "desktop-surface",
  "window-shell",
  "window-layer",
  "effects-toggle",
  "quality-chip",
];

const diagnostics = [];

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
  });

  logDiagnostic("log", "rendering pipeline initialized", {
    quality: computeQualityTier(),
    reducedMotion,
  });
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
}

boot();
