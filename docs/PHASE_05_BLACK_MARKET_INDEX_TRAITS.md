# Phase 05 — Black Market + Index + Traits

## Objective
Implement progression and collectability: players should earn Ø in Terminal, buy command unlocks in Black Market, complete lessons, then execute unlocked command keys (including rare trait variants).

## Implemented
- Added progression + inventory schema in `src/game/progression.ts`:
  - owned command instances (base + trait variants)
  - pending lesson queue
  - missed limited tracking with date tags
  - shop inventory model decoupled from owned inventory
- Added Black Market app in `src/components/apps/BlackMarketApp.tsx`:
  - buy lesson/software items
  - limited-time slot presentation
  - lesson completion workflow that unlocks commands
- Added Index app in `src/components/apps/IndexApp.tsx`:
  - owned command listing
  - locked command listing
  - missed limited section with date stamps
  - trait command section and command-key search/filter
- Updated terminal runtime (`src/game/terminal.ts`) and UI (`src/components/apps/TerminalApp.tsx`):
  - dynamic owned command keys (e.g. `phish`, `scan`, `phish-ts`)
  - spring trait reward multiplier support
  - per-command-key cooldown support
- Updated desktop shell (`src/App.tsx`) to wire market + index state and unlock flow.

## Trait storage schema
```ts
ownedCommands: Array<{
  instanceId: string;
  baseId: 'phish' | 'scan' | 'spoof';
  trait: 'spring' | null;
  unlockedAt: number;
  source: 'starter' | 'lesson' | 'software' | 'admin';
}>;
```

## Exit Criteria
- [x] Economy loop complete: earn → buy → unlock → optimize.
- [x] Remove-from-shop does not remove command from player inventory.
- [x] Index supports filtering/search across owned/locked/missed/traits.
