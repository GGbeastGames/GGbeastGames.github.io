# Aionous Foundation Architecture & Project Standards (Phase 0 Lock)

## 1) Final App Architecture (before gameplay features)

### 1.1 Application shell: React + TypeScript (TSX)
- **Architecture style:** modular, feature-sliced React app built with TypeScript.
- **Rendering entrypoint:** root `main.html` loads root `main.js` (bootstrap script) and global `main.css`.
- **React mount strategy:** `main.js` mounts the TSX app shell (`AppShell`) into `#root`.
- **Core shell responsibilities:**
  - Auth gate and session bootstrap.
  - Global layout and desktop/window manager host.
  - Event bus + state store providers.
  - Route/app launcher coordination.

### 1.2 Firebase usage policy
Firebase is the backend platform and must be accessed through a centralized service layer only.

- **Firebase Auth:**
  - Email/password and provider login supported.
  - Auth state observer initializes user context before protected UI renders.
  - No guest account fallback.
- **Firestore:**
  - Source of truth for player profile, progression, inventory metadata, and app/window state snapshots.
  - Security rules enforce per-user ownership and server-validated update paths.
- **Storage:**
  - Binary assets (uploads, user content, generated media references).
  - Paths are namespaced by user ID and feature domain.

### 1.3 WebGL rendering layer
- WebGL runs as an isolated rendering subsystem under `src/features/rendering/webgl/`.
- The layer is wrapped in React-friendly adapters:
  - `RendererCanvas` component owns canvas lifecycle.
  - `RendererController` service owns initialization, tick/update loop, resize handling, and disposal.
- Game/UI code may publish render intents through typed events; direct low-level WebGL state mutation from random components is disallowed.

### 1.4 Desktop-style app-window system
- UI paradigm is a desktop workspace with multiple draggable windows.
- Each app module is launched in a managed window and must support:
  - **Drag/move**
  - **Minimize**
  - **Maximize/restore**
  - **Focus/z-index activation**
  - **Close/unmount**
- Window manager keeps canonical state (position, size, mode, focus order) in store and can persist user layout.
- Apps communicate through typed contracts and the event bus; no hidden cross-window coupling.

---

## 2) Strict folder map (locked)

> Requirement: root `main.html`, `main.css`, and `main.js` stay top-level.

```text
/
├── main.html                     # top-level HTML entrypoint (locked)
├── main.css                      # top-level global CSS baseline (locked)
├── main.js                       # top-level bootstrap entrypoint (locked)
├── package.json
├── tsconfig.json
├── vite.config.ts (or build config)
├── .env.example
├── docs/
│   ├── FOUNDATION_ARCHITECTURE.md
│   ├── STANDARDS.md
│   └── SECURITY.md
├── public/
│   ├── icons/
│   ├── fonts/
│   └── static/
├── assets/
│   ├── audio/
│   ├── textures/
│   ├── shaders/
│   └── ui/
├── src/
│   ├── app/
│   │   ├── AppShell.tsx
│   │   ├── providers/
│   │   ├── routes/
│   │   └── startup/
│   ├── core/
│   │   ├── types/
│   │   ├── constants/
│   │   ├── utils/
│   │   ├── events/
│   │   └── store/
│   ├── services/
│   │   ├── firebase/
│   │   ├── auth/
│   │   ├── firestore/
│   │   ├── storage/
│   │   └── economy/
│   ├── features/
│   │   ├── desktop/
│   │   │   ├── window-manager/
│   │   │   └── apps/
│   │   ├── rendering/
│   │   │   └── webgl/
│   │   ├── profile/
│   │   ├── inventory/
│   │   └── gameplay/
│   ├── components/
│   └── styles/
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

### Folder rules
1. Do not place feature logic in root files.
2. Do not place Firebase calls inside UI component files.
3. Shared types live in `src/core/types` or in feature-local `types.ts` for isolated modules.
4. New features must declare ownership under `src/features/<feature-name>/`.

---

## 3) Coding standards (enforced)

### 3.1 Type safety and contracts
- TypeScript strict mode required.
- Export explicit interfaces/types for every service boundary and event payload.
- `any` is prohibited unless justified with inline TODO + tracking issue.

### 3.2 Economy write restrictions
- **No direct client economy writes.**
- Currency, premium balances, and reward ledger updates must go through secure server-authoritative paths (Cloud Functions or trusted backend endpoint).
- Client may request transactions, never finalize them.

### 3.3 Centralized service layer
- UI, hooks, and components call only service interfaces (not raw Firebase SDK clients directly).
- Firebase SDK initialization is single-instance and encapsulated in `src/services/firebase`.
- Domain services expose typed methods and return typed result objects.

### 3.4 Event bus + store conventions
- Event namespaced format: `<domain>.<entity>.<action>` (example: `window.app.opened`).
- Payloads are typed and versionable.
- Store owns long-lived state; event bus handles cross-domain notifications.
- No service may mutate store state outside approved reducers/actions.

---

## 4) Authentication policy: no guest mode (hard requirement)

- Guest play is not supported.
- All feature routes except login/recovery/legal pages are protected.
- On app start:
  1. Auth state loads.
  2. If unauthenticated, route to login gate.
  3. After successful login, bootstrap profile and permissions.
  4. Only then mount desktop/workspace features.
- Any auth token loss/expiry immediately re-enters login gate.

---

## 5) Environment variable and Firebase key strategy

### 5.1 Public config handling
- Firebase web config values are treated as **identifiers**, not secrets, but still managed via environment variables for environment separation and operational hygiene.
- Use `.env` per environment and commit only `.env.example`.

### 5.2 Required variables (example)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### 5.3 Secret management rules
- Service account keys/private admin credentials are never shipped to client and never committed.
- CI/CD injects environment values at build/deploy time.
- Rotate keys if exposed in logs or incident reports.
- Enforce Firebase App Check and strict Firestore/Storage rules to compensate for public client config visibility.

---

## 6) Mandatory 5-step debug/clean loop

Run this loop before any phase sign-off or merge:

1. **Type & lint pass**  
   `npm run typecheck && npm run lint`
2. **Unit/integration tests**  
   `npm test`
3. **Build verification**  
   `npm run build`
4. **Runtime smoke test**  
   Launch app, verify login gate, window drag/min/max/restore, and WebGL canvas initialization.
5. **Cleanup & governance check**  
   - Remove dead code/debug logs.
   - Confirm no direct Firebase usage in UI.
   - Confirm no economy writes from client paths.

A phase is blocked until all five steps pass or explicit, documented exceptions are approved.

---

## 7) Phase sign-off checklist (required)

- [ ] Root entry files (`main.html`, `main.css`, `main.js`) remain top-level and minimal.
- [ ] Folder structure follows locked map.
- [ ] Auth gate enforced; no guest paths.
- [ ] Firebase access occurs only through service layer.
- [ ] Economy updates are server-authoritative only.
- [ ] Typed interfaces exist for service/event boundaries.
- [ ] Event bus/store conventions followed.
- [ ] Environment variables documented and `.env.example` maintained.
- [ ] 5-step debug/clean loop executed and logged.
- [ ] Architecture/standards docs updated for deviations.

**Status:** Phase 0 architecture baseline is defined and locked. Gameplay feature implementation begins only after this checklist is green.
