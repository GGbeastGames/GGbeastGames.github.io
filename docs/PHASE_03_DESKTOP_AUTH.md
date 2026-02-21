# Phase 03 — Login + Desktop OS

## Objective
Deliver the first playable operating-system fantasy layer: boot sequence, authentication, desktop shell, draggable app windows, and taskbar management.

## Completed in Code
- Added a boot cutscene screen with neon grid style and timed transition.
- Added Firebase auth UI supporting sign-in and account creation.
- Added guest-mode fallback to keep the prototype playable even before full backend setup.
- Implemented desktop shell with:
  - draggable windows
  - minimize / close controls
  - taskbar launcher and restore behavior
  - z-index focus management
- Added session persistence of window layout and open/minimized state in local storage.

## Firebase Configuration
- `src/config/firebase.ts` now supports both env-driven config and fallback defaults using the provided project configuration.

## Exit Criteria
- [x] Boot-to-login flow exists.
- [x] Login and sign-up flow exists.
- [x] Desktop and taskbar interactions are functional.
- [x] Window state is restored after reload.
