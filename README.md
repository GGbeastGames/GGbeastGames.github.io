# Aionous (RootAccess)

Cyberpunk desktop hacking game built phase-by-phase on a $0 stack.

## Stack
- Vite + React + TypeScript
- Firebase (Auth, Firestore, Realtime DB, Storage)
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

### GitHub Pages base-path safety
This repo uses a relative Vite base by default (`./`) to prevent blank-page deploys on GitHub Pages.
If you need a custom subpath, set `VITE_BASE_PATH` during build (example: `/Aionous/`).
Build also creates `dist/404.html` + `dist/.nojekyll` for GitHub Pages SPA fallback hardening.

## Implemented phases
- ✅ Phase 1: Foundation
- ✅ Phase 2: Visual Identity + Asset Pipeline
- ✅ Phase 3: Boot/Login/Desktop OS shell
- ✅ Phase 4: Terminal command loop (phish / scan / spoof)
- ✅ Phase 5: Black Market + Index + Trait variants
- ✅ Phase 6: Profile + Missions + retention systems
- ✅ Phase 7: Casino + Flux side-economy
- ✅ Phase 8: PvP Arena + ranked progression
- ✅ Phase 9: Blockchain market + defensive upgrades
- ✅ Phase 10: Ops/Factions/Crafting/Heat growth systems
- ✅ Phase 11: Cosmetics, Story Seasons, Mentor system
- ✅ Phase 12: Admin control tower + LiveOps launch hardening
- ✅ Phase 13: Stability, UX modernization, diagnostics, and settings controls

## Phase docs
- `docs/PHASE_01_CHECKLIST.md`
- `docs/PHASE_02_VISUAL_SYSTEM.md`
- `docs/PHASE_03_DESKTOP_AUTH.md`
- `docs/PHASE_04_TERMINAL_CORE.md`
- `docs/PHASE_05_BLACK_MARKET_INDEX_TRAITS.md`
- `docs/PHASE_06_PROFILE_MISSIONS_RETENTION.md`
- `docs/PHASE_07_CASINO_FLUX.md`
- `docs/PHASE_08_PVP_ARENA.md`
- `docs/PHASE_09_BLOCKCHAIN_MARKET.md`
- `docs/PHASE_10_GROWTH_SYSTEMS.md`
- `docs/PHASE_11_SEASONS_COSMETICS_MENTOR.md`
- `docs/PHASE_12_ADMIN_LIVEOPS.md`
- `docs/PHASE_13_STABILITY_GUI_ENHANCEMENTS.md`
- `config/FIREBASE_RULES.md`
- `docs/ASSET_PIPELINE.md`
- `docs/ARCHITECTURE.md`
- `docs/ECONOMY_BASELINE.md`
- `docs/ROADMAP.md`


## GitHub Pages root-cause checklist (white screen)
1. In repo **Settings → Pages**, set **Build and deployment** to **GitHub Actions** (not branch/Docs).
2. Ensure workflow `.github/workflows/deploy-pages.yml` runs successfully and deploys `dist/` artifact.
3. If previously configured to serve from `/docs` or branch root with markdown index, Pages can show a plain white/blank page instead of app runtime.
4. After changing Pages source, hard refresh with cache clear (Ctrl/Cmd+Shift+R).
