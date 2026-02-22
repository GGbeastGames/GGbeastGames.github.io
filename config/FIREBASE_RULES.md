# Firebase Rules Starter Pack (RootAccess / Aionous)

Copy/paste these into Firebase Console and adjust as your schema evolves.

## Firestore Rules (`Firestore Database > Rules`)
```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function isAdmin() {
      return signedIn() && request.auth.token.admin == true;
    }

    match /players/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow create: if isOwner(uid);
      allow update: if isAdmin()
        || (isOwner(uid)
          && request.resource.data.roles.admin == resource.data.roles.admin
          && request.resource.data.roles.moderator == resource.data.roles.moderator);
      allow delete: if isAdmin();
    }


    match /pvpQueue/{uid} {
      allow read: if signedIn();
      allow create, update: if isOwner(uid) || isAdmin();
      allow delete: if isOwner(uid) || isAdmin();
    }

    match /leaderboards/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /adminAudit/{entryId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if false; // immutable audit intent
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Storage
Firebase Storage is intentionally not used by the current client build.
