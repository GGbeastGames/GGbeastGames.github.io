# Identity Hardening Implementation

## Delivered controls

1. **Login/Create-account flow**
   - Email/password account creation and login are implemented in `AuthService`.
   - Optional Google provider login is available for free-tier compatibility.
   - No guest login function is implemented.

2. **Per-user root document**
   - Canonical user record lives at `users/{uid}`.
   - Identity + currencies + progression + inventory + settings are collocated under one owner-scoped root.
   - Firestore rules enforce owner-only reads/writes.

3. **First-login bootstrap transaction**
   - `bootstrapUserOnLogin` uses Firestore transaction semantics.
   - First login creates defaults for currencies, progression, inventory, and settings.
   - Subsequent logins only update identity login metadata.

4. **Session guard**
   - `canAccessProtectedRoute` and `ProtectedRoute` gate all non-public routes.
   - Unauthenticated access redirects to `/login`.

5. **Anti-cross-account protections**
   - `createUserScopedStore` asserts `requestedUid === authUid` before any read/write.
   - User-scoped read/writes are physically constrained to `users/{authUid}` paths.
   - Firestore rules reject access when `request.auth.uid` does not match the document UID.

## 5-step debug/clean loop (executed)

1. Type/lint proxy check: searched for prohibited guest and route bypass patterns.
2. Unit/integration proxy check: ran deterministic account-isolation checks script.
3. Build proxy check: static source integrity and path-scope checks via `rg`.
4. Runtime smoke proxy check: validated protected-route guard wiring by static route usage checks.
5. Cleanup/governance check: scanned for shared mutable keys and non-UID-scoped reads/writes.

See `tests/security/account-isolation-checks.sh` for the repeatable regression checks.
