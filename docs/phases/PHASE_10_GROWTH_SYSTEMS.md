# Phase 10 — Growth Systems A-D

## Objective
Integrate social and replay loops: co-op-style ops contracts, faction progression, command crafting, and heat/risk dynamics.

## Implemented
- Added growth systems engine in `src/game/growth.ts`:
  - faction selection + weekly-style faction score buckets
  - ops contracts with timer-based completion and shared-reward style outcomes
  - command craft/fuse records with optional trait-chance booster
  - heat/notoriety accumulation + passive decay
- Added Growth Hub app in `src/components/apps/GrowthApp.tsx`:
  - faction picker and score display
  - contracts panel with start/resolve flow
  - command crafting interface and recent craft history
  - heat warning visibility for bounty-risk flavor
- Updated `src/App.tsx`:
  - new `growth` app window + taskbar integration
  - persisted growth state and periodic heat decay tick
  - handlers for faction, contract, and crafting actions
  - phase marker moved to Phase 10

## Debugging/Resilience updates this phase
- Strengthened `index.html` static boot/debug fallback so users no longer see a plain white page while runtime loads or if script execution stalls.
- Added runtime status message guidance for debugging cached/path issues directly in initial HTML.

## Exit Criteria
- [x] Ops contracts (co-op light) implemented.
- [x] Factions + score progression wired.
- [x] Command crafting loop with controlled trait chance boosts implemented.
- [x] Heat/notoriety gameplay pressure integrated.
