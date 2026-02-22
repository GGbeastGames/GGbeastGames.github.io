# Firestore Player Card Schema (Phase 1)

Document path: `players/{uid}`

```json
{
  "schemaVersion": 1,
  "profile": {
    "email": "operator@example.com",
    "alias": "operator@example.com",
    "photoURL": null
  },
  "roles": {
    "admin": false,
    "moderator": false
  },
  "economy": {
    "nops": 120,
    "flux": 5,
    "trace": 18,
    "level": 7,
    "xp": 42
  },
  "stats": {
    "totalRuns": 43,
    "successfulRuns": 31,
    "rankedPoints": 14,
    "streakDays": 3
  },
  "progression": {
    "ownedCommandCount": 5,
    "pendingLessonCount": 1
  },
  "desktopState": {
    "windows": [],
    "player": {},
    "cooldowns": {},
    "logs": [],
    "progression": {},
    "shopInventory": [],
    "retention": {},
    "casino": {},
    "ranked": {},
    "blockchain": {},
    "growth": {},
    "season": {},
    "admin": {},
    "displaySettings": {}
  },
  "meta": {
    "source": "aionous-client",
    "updatedAt": "serverTimestamp()"
  }
}
```

## Notes
- `roles.admin` controls admin panel visibility in-app (with env/local fallbacks still supported).
- Signed-in users now sync full desktop state to Firestore; guest mode remains local-only.
- Keep `roles.*` writes admin-restricted in Firestore rules.
