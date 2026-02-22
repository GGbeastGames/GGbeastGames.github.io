# Phase 09 — Blockchain Market System

## Objective
Deliver mid/late-game economic depth with company shares, market simulation, and defensive progression.

## Implemented
- Added blockchain market engine in `src/game/blockchain.ts`:
  - 5 companies: VALK, GLYPH, ZERO, PULSE, TITAN
  - timed price trend refresh simulation
  - buy/sell flow with per-order limits
  - share ownership records
  - block security upgrade progression
- Added Blockchain app in `src/components/apps/BlockchainApp.tsx`:
  - company market cards with trends/prices
  - trade amount controls
  - buy/sell actions
  - security-upgrade actions after ownership unlock
- Updated desktop shell integration in `src/App.tsx`:
  - Blockchain app window + taskbar routing
  - market refresh timer loop
  - wallet impacts for trade/upgrade actions
  - phase marker updated to Phase 9

## Exit Criteria
- [x] Share ledger schema integrated.
- [x] Company event/refresh engine active.
- [x] Defensive upgrade progression implemented.
