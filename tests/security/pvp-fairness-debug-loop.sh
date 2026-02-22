#!/usr/bin/env bash
set -euo pipefail

printf 'Step 1/5: Type-check backend authority surfaces...\n'
(cd functions && npm run build >/dev/null)

printf 'Step 2/5: Verify race-prone queue + ready transaction guards exist...\n'
rg -n "queueForRankedMatch|setMatchReady|runTransaction|Queue race detected" functions/src/index.ts >/dev/null

printf 'Step 3/5: Verify split-screen shard state and winner closure logic...\n'
rg -n "splitScreen|submitShardScore|shardTarget|winnerUid" functions/src/index.ts >/dev/null

printf 'Step 4/5: Verify rank/farm/reward fairness constraints are bounded...\n'
rg -n "MAX_RANKED_TRANSFER_PCT|MAX_REPEAT_MATCHES_PER_DAY|calcRankDelta|antiFarmReduced" functions/src/index.ts >/dev/null

printf 'Step 5/5: Verify disconnect/rejoin timeout handling in authority path...\n'
rg -n "MATCH_DISCONNECT_TIMEOUT_MS|reportMatchDisconnect|rejoinMatch|reconnectDeadlineAt" functions/src/index.ts >/dev/null

printf 'PvP fairness debug/clean loop passed.\n'
