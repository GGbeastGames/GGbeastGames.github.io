# Stability & Simplification Pass

## Static Bug Inventory

| Bug ID | File | Function/Effect | Trigger | User Impact | Fix Approach |
|---|---|---|---|---|---|
| B1 | `src/App.tsx` | `handleSignOut` | Sign-out path executes `setCloudHydrated(false)` undefined symbol | Build/type failure and broken sign-out flow | Removed dead call and kept deterministic reset flow. |
| B2 | `src/App.tsx` | Firestore snapshot apply | Cloud doc has malformed `desktopState` | Runtime state corruption from invalid payload | Validate with `isPersistedDesktop` before apply, fallback to defaults. |
| B3 | `src/App.tsx` | Cloud sync error handling | Firestore read/write fails | User is shown auth failure despite successful login | Decoupled auth error from sync warning; keep desktop session active. |
| B4 | `src/App.tsx` | `onTogglePvpQueue` | Rapid click / stale closure on queue boolean | Join/leave request can invert unexpectedly | Deterministic queue intent helper + explicit state assignment. |
| B5 | `src/App.tsx` | Admin handlers | Client allowlist email but no trusted role guard | Non-trusted users could invoke privileged handlers in edge paths | Central `canPerformAdminAction` trusted-role guard in all admin mutators. |
| B6 | `src/App.tsx` + persistence paths | Repeated serialization branches | Different branches save slightly different desktop shapes | Hidden drift bugs and hydration mismatch risk | Introduced centralized desktop schema envelope + parse/serialize helpers. |

## Before/After Architecture Notes

- **Before:** `App.tsx` mixed auth, cloud sync, local persistence, queue sync, and rendering concerns with repeated serialization logic and stale event reads.
- **After:** extracted reusable modules under `src/app/*` for desktop schema/reducer, auth/cloud/local/queue hooks scaffolding, and session policy guards. `App.tsx` now consumes shared policy/util logic and has safer state transitions while preserving gameplay outputs.

## Feature Preservation Confirmation

- No gameplay feature was removed.
- Commands, rewards, progression, windows, and app modules remain present.
- Changes are bug fixes, hardening, and persistence/safety simplification only.
