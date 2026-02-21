# Aionous (RootAccess)

Cyberpunk desktop hacking game built phase-by-phase on a $0 stack.

## Stack
- Vite + React + TypeScript
- Firebase (Auth, Firestore, Realtime DB)
- GitHub Pages deployment

## Local development
1. Copy `.env.example` to `.env` and set Firebase values (optional for prototype mode; defaults exist in firebase config).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate asset manifest:
   ```bash
   npm run assets:manifest
   ```
4. Start dev server:
   ```bash
   npm run dev
   ```

## Build
```bash
npm run build
```

## Implemented phases
- ✅ Phase 1: Foundation
- ✅ Phase 2: Visual Identity + Asset Pipeline
- ✅ Phase 3: Boot/Login/Desktop OS shell

## Phase docs
- `docs/PHASE_01_CHECKLIST.md`
- `docs/PHASE_02_VISUAL_SYSTEM.md`
- `docs/PHASE_03_DESKTOP_AUTH.md`
- `docs/ASSET_PIPELINE.md`
- `docs/ARCHITECTURE.md`
- `docs/ECONOMY_BASELINE.md`
- `docs/ROADMAP.md`
