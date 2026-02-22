// TypeScript source mirror for Task 1 foundation.
// Keep this file in sync with main.js until a build tool is introduced.

type DiagnosticLevel = "log" | "warn" | "error";

interface DiagnosticRecord {
  timestamp: string;
  level: DiagnosticLevel;
  message: string;
  context: Record<string, unknown>;
}

const ENTRY_HTML = "index.html";
const REQUIRED_DOM_IDS = ["root", "boot-fallback", "boot-status", "desktop-surface", "window-shell"];
const diagnostics: DiagnosticRecord[] = [];

function logDiagnostic(level: DiagnosticLevel, message: string, context: Record<string, unknown> = {}): void {
  const payload: DiagnosticRecord = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  diagnostics.push(payload);
  const method = level === "error" ? "error" : level === "warn" ? "warn" : "log";
  console[method]("[RootAccess Boot]", payload);
}

function getEl(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function setBootMessage(message: string, options: { isError?: boolean } = {}): void {
  const bootFallback = getEl("boot-fallback");
  if (!bootFallback) return;

  bootFallback.textContent = message;
  bootFallback.classList.add("boot-fallback--visible");
  if (options.isError) {
    bootFallback.style.borderColor = "rgba(255, 92, 138, 0.8)";
  }
}

function failBoot(message: string, context: Record<string, unknown> = {}): void {
  logDiagnostic("error", message, context);
  setBootMessage(`RootAccess failed to initialize: ${message}. Check entry file and script paths.`, {
    isError: true,
  });

  const root = getEl("root");
  if (root) root.hidden = true;
}

function guardAgainstWrongEntryPath(): boolean {
  const path = window.location.pathname.toLowerCase();
  const badExt = [".md", ".txt", ".json"];

  if (badExt.some((ext) => path.endsWith(ext))) {
    failBoot("wrong entry path detected (document URL points to non-HTML resource)", { path });
    return false;
  }

  const script = document.querySelector<HTMLScriptElement>('script[src$="main.js"]');
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

function ensureDomContract(): boolean {
  const missing = REQUIRED_DOM_IDS.filter((id) => !getEl(id));
  if (missing.length > 0) {
    failBoot("required root DOM nodes missing", { missing });
    return false;
  }
  return true;
}

function mountDesktopShell(): void {
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

function installGlobalErrorGuards(): void {
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

function boot(): void {
  installGlobalErrorGuards();

  if (!guardAgainstWrongEntryPath()) return;
  if (!ensureDomContract()) return;

  mountDesktopShell();
}

boot();
