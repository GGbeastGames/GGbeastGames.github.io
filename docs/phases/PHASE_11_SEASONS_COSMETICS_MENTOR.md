# Phase 11 — Cosmetics, Story Seasons, Mentor System

## Objective
Scale retention, identity, and onboarding with cosmetics, story arcs, and a mentor pipeline.

## Implemented
- Added seasonal systems module in `src/game/season.ts`:
  - cosmetic catalog (theme/title-card/desktop-anim)
  - owned cosmetics + active theme state
  - monthly story event records
  - mentor ticket lifecycle (open/matched)
- Added Season Hub app in `src/components/apps/SeasonApp.tsx`:
  - cosmetic marketplace purchase/apply controls
  - monthly story arc panel
  - mentor request + ticket matching controls
- Updated shell wiring in `src/App.tsx`:
  - new `season` window/taskbar app
  - persistent season state storage
  - purchase, apply-theme, mentor-ticket handlers
  - phase marker upgraded to Phase 11

## White-screen root fix guidance added
- Added GitHub Actions Pages deployment workflow (`.github/workflows/deploy-pages.yml`) to ensure Pages serves built `dist` output, not markdown/branch source.
- `README.md` now includes explicit Pages source configuration steps to avoid serving the wrong content.

## Exit Criteria
- [x] Cosmetics marketplace loop active.
- [x] Story season panel active.
- [x] Mentor system v1 active.
