# Aionous Architecture Blueprint (Free Tier)

## Platform Constraints
- **Hosting:** GitHub Pages (static deploy)
- **Backend:** Firebase Auth + Firestore + Realtime Database only
- **Budget:** $0 hard cap

## Runtime Layers
1. **Client Shell (React + Vite)**
   - Desktop simulator, app windows, taskbar, boot/login views
2. **Game Domain Layer (Client Logic + Server Rules)**
   - Command parsing, cooldown UI, economy state rendering
3. **Firebase Layer**
   - Auth for identity
   - Firestore for profiles, inventories, static catalogs, admin logs
   - Realtime Database for queue/presence/live toggles

## Service Split
- **Firestore (authoritative long-lived data)**
  - players
  - command catalogs
  - inventory and unlocks
  - market snapshots
  - admin audit logs
- **Realtime DB (fast-changing lightweight state)**
  - PvP queue and presence
  - temporary global event flags
  - UI live signals

## Security Model
- Players can read/write only their own profile surface.
- Economy mutations should be server-authoritative in later phases (functions or rule-validated writes).
- Admin capabilities gated by custom claim: `admin: true`.
- All admin actions append to immutable audit log documents.

## Deployment Pattern
- GitHub Actions:
  1. install
  2. build
  3. deploy `dist/` to GitHub Pages
- Vite `base` is set to `/Aionous/` for Pages compatibility.

## Update-Friendly Client State Layout
To make future updates safer and faster, keep these boundaries clear:

1. **Session/Auth boundary**
   - Only auth listeners should decide whether app is in boot/login/desktop.
   - Never force login from a timer if auth has a signed-in user.

2. **Hydration boundary**
   - Only write local cache or Firestore after the active UID is fully hydrated.
   - Ignore stale async updates from previous users after account switches.

3. **Persistence boundary**
   - Keep cache strictly per user key: `aionous.desktop.v5.user.<uid>`.
   - No signed-out/guest cache keys.

4. **Cloud bootstrap boundary**
   - New player docs are created from canonical defaults, not mutable in-memory state.
   - Existing player docs remain the source of truth for settings/economy.

5. **Failure visibility**
   - Firestore sync failures must be user-visible in UI and include project context.
   - Keep login blocked when cloud identity sync fails.
