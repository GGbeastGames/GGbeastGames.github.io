# Phase 06 — Profile + Missions + Retention Core

## Objective
Increase daily return behavior with profile depth, mission loops, streak rewards, and leaderboard scaffolding.

## Implemented
- Added retention engine in `src/game/retention.ts`:
  - mission templates (daily + weekly)
  - daily reset logic (`applyDailyReset`)
  - activity tracking (`applyActivity`) for runs/success/earnings
  - streak rewards (`claimDailyStreak`)
  - mission claim rewards (`claimMissionReward`)
  - achievement and badge framework
  - command mastery counters
- Added full Profile app in `src/components/apps/ProfileApp.tsx`:
  - stats card with XP progress bar
  - mission claim controls
  - daily streak claim button
  - badge shelf + achievements list
  - leaderboard panels (richest, level, command mastery)
  - profile photo upload control (size-limited)
- Updated app shell (`src/App.tsx`) to:
  - persist retention state with desktop session data
  - process mission progress from terminal command executions
  - grant mission XP/NOP rewards with level-up handling
  - upload profile image to Firebase Storage for authenticated users
  - fallback to local photo preview in guest mode

## Daily reset logic
- Daily missions reset when `Date.now() >= dailyResetAt`.
- `dailyResetAt` advances to next UTC midnight.
- Weekly missions persist through daily resets.

## Mission templates
- `Signal Warmup` — run 5 commands (daily)
- `Cashflow Ping` — earn 30 Ø (daily)
- `Silent Week` — 20 successful runs (weekly)

## Exit Criteria
- [x] Retention systems v1 active.
- [x] Daily reset logic implemented.
- [x] Mission templates integrated.
