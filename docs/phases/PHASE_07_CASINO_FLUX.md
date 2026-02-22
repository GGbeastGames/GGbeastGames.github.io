# Phase 07 — Casino App + Flux Economy

## Objective
Add a high-excitement side economy that remains bounded and transparent.

## Implemented
- Added casino domain state in `src/game/casino.ts`:
  - mini-games: `high-low`, `neon-wheel`
  - Flux currency + ledger entries
  - Luck Charm store (bounded odds buff)
  - anti-abuse controls: visible odds helpers, wager cap, cooldown gates
  - badge trigger support (`Luck 10`)
- Added casino UI in `src/components/apps/CasinoApp.tsx`:
  - neon-oasis themed panel
  - odds display and wager control
  - game actions and cooldown feedback
  - Flux store purchase action
  - badge list
- Wired casino state into `src/App.tsx`:
  - persisted casino state in local desktop session
  - NOP wallet updates from wins/losses
  - terminal log notifications for outcomes
  - desktop header Flux indicator

## Exit Criteria
- [x] Casino gameplay loop integrated.
- [x] Flux ledger and currency implemented.
- [x] Badge trigger pathway wired (`Luck 10`).
- [x] Anti-abuse controls in place (visible odds, wager cap, cooldown).
