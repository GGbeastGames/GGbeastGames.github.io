# Phase 13 — Stability, Deployment Diagnostics, and GUI Modernization

## Objective
Lock down launch reliability and improve first-impression UX with modern tuning controls.

## Implemented
- Added runtime boot diagnostics directly in `index.html`:
  - matrix binary rain fallback layer while JS boots
  - explicit module/runtime error messaging
  - clear guidance when GitHub Pages is serving source files instead of `dist/`
- Upgraded mount signaling in `src/main.tsx`:
  - dispatches `aionous:mounted` event and sets `window.__AIONOUS_MOUNTED`
  - ensures fallback screen hides only when React actually mounts
- Added display settings system in `src/game/settings.ts`:
  - theme palette (`matrix`, `oasis`, `inferno`)
  - UI scale control with clamps
  - reduced-motion + high-contrast toggles
- Extended Settings app in `src/App.tsx`:
  - functional controls instead of placeholder text
  - dynamic desktop classes/styles for user-selected visual profile
- Style polish in `src/styles.css`:
  - theme variants and accessibility-focused contrast improvements
  - reduced-motion enforcement for animation-heavy screens

## Deployment Root-Cause Guidance
If you only see the fallback card on GitHub Pages:
1. Open **Settings → Pages** for the repo.
2. Set source to **GitHub Actions**.
3. Confirm `.github/workflows/deploy-pages.yml` completed successfully.
4. Hard refresh with cache clear.

## Exit Criteria
- [x] Better boot diagnostics for non-rendering production builds.
- [x] Settings app now performs visual customization live.
- [x] Accessibility controls integrated into desktop rendering.
