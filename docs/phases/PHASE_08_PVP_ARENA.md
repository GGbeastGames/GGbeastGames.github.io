# Phase 08 — PvP Arena (Ranked Hack Battles)

## Objective
Introduce competitive multiplayer-style progression with queueing, duel lifecycle, shards/hack ratios, and ranked point advancement.

## Implemented
- Added PvP domain module in `src/game/pvp.ts`:
  - queue entry schema
  - match state lifecycle
  - shard/hack ratio scoring
  - ranked state + tier mapping
  - match resolution and points deltas
- Added PvP Arena UI in `src/components/apps/PvpApp.tsx`:
  - inferno queue lobby
  - ready/accept start flow
  - split-screen duel simulation panel
  - ranked log display
- Updated `src/App.tsx`:
  - new PvP app window in desktop/taskbar
  - queue state and match lifecycle wiring
  - ranked points integrated into header metrics
  - queue synchronization path via Realtime Database (`pvp/queue/*`)

## Exit Criteria
- [x] PvP queue + match lifecycle active.
- [x] Ranking progression/tier logic integrated.
- [x] Match logs persisted in ranked state.
