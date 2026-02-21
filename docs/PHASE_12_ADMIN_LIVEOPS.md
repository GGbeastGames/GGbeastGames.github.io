# Phase 12 — Admin Engine, LiveOps Control Tower, Launch Hardening

## Objective
Ship public-ready admin operations with moderation, live events, and resilient deployment behavior.

## Implemented
- Added admin systems module in `src/game/admin.ts`:
  - admin feature toggles (`chatOpen`, `pollsEnabled`)
  - global banner state
  - player watchlist/flag/ban records
  - immutable audit log append flow
  - helpers for trait command grants + admin shop item creation
- Added Admin app in `src/components/apps/AdminApp.tsx`:
  - banner push controls
  - feature toggle controls
  - grant command/trait controls
  - shop item create controls
  - player flag/temp-ban/perm-ban controls
  - audit log viewer
- Updated shell integration in `src/App.tsx`:
  - admin app window and role-gated taskbar visibility (`VITE_ADMIN_EMAILS` or local override)
  - global alert banner rendering in desktop
  - admin action handlers with audit logging
  - phase marker moved to Phase 12
- Launch hardening and root-cause Pages fix:
  - GitHub Pages Actions deployment workflow (`.github/workflows/deploy-pages.yml`) ensures built `dist/` is deployed, preventing accidental markdown/docs source serving.
  - Static HTML boot fallback + root runtime boundary reduce opaque white-screen outcomes.

## Exit Criteria
- [x] Admin command center available with role-gated access.
- [x] Audit trail implemented for admin actions.
- [x] Launch/deploy hardening in place for GitHub Pages.
