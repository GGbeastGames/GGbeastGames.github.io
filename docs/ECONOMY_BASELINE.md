# Economy Baseline v1

## Core Currency Design
- **Ø (NOP)**: primary currency earned in terminal and spent in black market.
- **ƒ (Flux)**: casino-only reward and sink currency (phase 7+).
- **RP**: ranked points for PvP progression (phase 8+).

## Early Progression (Phase 1-4)
- Starter commands: `phish`, `scan`, `spoof`
- Reward model per command:
  - success chance
  - payout min/max
  - cooldown seconds
  - fail penalty

## Balance Guardrails
- Keep terminal income stable enough for progression but capped by cooldowns.
- Do not allow casino payouts to outpace terminal loop in early game.
- Separate competitive ladder rewards from direct currency inflation.

## Anti-Inflation Rules
1. Reward increases tied to command unlock tier and player level.
2. Store sinks (lessons/software) scale with player power.
3. Limited events offer temporary multipliers with strict duration.
