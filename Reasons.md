# Reasons / Design Notes

## Why backend authority for ranked PvP?

Client-only matchmaking and scoring are easy to spoof. Ranked state, transfers, and progression are therefore implemented in cloud functions and Firestore transactions to preserve fairness.

## Why bounded transfer rewards?

Winner-takes-all systems create runaway snowballing and abuse risk. A bounded percentage transfer with hard floor/ceiling keeps matches meaningful while limiting economic damage per match.

## Why anti-farm constraints?

Repeated collusive matches between the same pair can inflate rank and currency. Pair-day counters reduce rank and transfer value after the threshold is reached.

## Why disconnect/rejoin tracking?

Real players disconnect; intentional disconnects should not be a free dodge. Match documents track disconnect windows so players can rejoin while stale sessions can still be finalized.
