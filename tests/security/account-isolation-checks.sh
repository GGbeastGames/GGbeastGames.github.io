#!/usr/bin/env bash
set -euo pipefail

printf '1) Checking for guest auth usage...\n'
if rg -n "signInAnonymously|guest" src >/dev/null; then
  echo 'Found guest path references in src/.'
  exit 1
fi

printf '2) Checking owner checks are present in security boundaries...\n'
rg -n "assertUid|request\.auth\.uid == uid|isOwner\(uid\)" src firestore.rules >/dev/null

printf '3) Checking auth guard usage in routes...\n'
rg -n "ProtectedRoute|canAccessProtectedRoute" src/app src/features >/dev/null

printf '4) Checking bootstrap transaction exists...\n'
rg -n "runTransaction\(|bootstrapUserOnLogin" src/services/firestore/bootstrap.ts >/dev/null

printf '5) Checking for shared mutable cross-account key patterns...\n'
if rg -n "currentUserData|globalUserState|sharedUser" src >/dev/null; then
  echo 'Potential shared mutable user key found.'
  exit 1
fi

echo 'Account isolation checks passed.'
