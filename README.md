# Aionous

Aionous is a cyberpunk strategy game shell with a browser front-end and Firebase backend authority.

## What ships in this repo

- Ranked PvP queue and ready flow with opponent matching (`queueForRankedMatch`, `setMatchReady`).
- Split-screen shard score model with steal/loss tracking and winner detection (`submitShardScore`).
- Ranked point gain/loss and anti-farm reduction (`resolveRankedMatch`).
- Backend-authoritative winner reward transfer bounded to 8% (with lower/upper caps).
- Disconnect/rejoin handling with reconnect timeout windows.

## Project structure

- `src/`: front-end React app.
- `functions/`: Firebase Cloud Functions and gameplay authority logic.
- `firestore.rules`: security boundaries and write constraints.
- `tests/security/`: command scripts and rule-case notes.

## Local development

```bash
npm install
npm run dev
```

Backend functions:

```bash
cd functions
npm install
npm run build
```

## Fair-play guardrails

- Economy updates happen server-side in transactions.
- Rank farming from repeated pairings is reduced automatically.
- Reward transfers are bounded by capped percentages.
- Disconnects are tracked and can be resolved with rejoin windows.
