# Phase 04 — Terminal Core Loop

## Objective
Ship the first real gameplay loop: command execution with probabilistic outcomes, cooldowns, payouts, penalties, XP/level progression, and persistent session state.

## Implemented
- Added a production-grade terminal engine module in `src/game/terminal.ts`:
  - command specifications (`phish`, `scan`, `spoof`)
  - success/failure resolution
  - payout ranges and cooldown enforcement
  - trace penalties and passive trace decay
  - XP and level-up progression
  - typed result contracts for UI safety
- Added `TerminalApp` UI component with:
  - scrolling terminal logs
  - command parser (`help`, `status`, `clear`, plus attack commands)
  - command readiness indicators with live cooldown status
  - HUD for balance/trace/level/xp
- Updated desktop shell to wire terminal state into profile + index placeholders.
- Added maximize button support for windows and persisted game/window session data.

## Exit Criteria
- [x] Starter command loop is playable.
- [x] Cooldowns are enforced and visible.
- [x] Rewards and penalties update player state.
- [x] Session data persists through reload.
