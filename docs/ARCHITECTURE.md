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
