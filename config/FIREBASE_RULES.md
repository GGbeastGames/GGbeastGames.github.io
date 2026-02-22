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

## Realtime Database Rules (`Realtime Database > Rules`)
> Realtime DB rules below are legacy/optional; matchmaking now uses Firestore `pvpQueue` by default.
```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "pvp": {
      "queue": {
        ".read": "auth != null",
        "$entry": {
          ".write": "auth != null && newData.child('uid').val() === auth.uid",
          "uid": { ".validate": "newData.val() === auth.uid" },
          "alias": { ".validate": "newData.isString() && newData.val().length <= 32" },
          "rankedPoints": { ".validate": "newData.isNumber()" },
          "queuedAt": { ".validate": "newData.isNumber()" }
        }
      }
    },
    "chat": {
      ".read": "auth != null && root.child('admin/featureToggles/chatOpen').val() === true",
      ".write": "auth != null && root.child('admin/featureToggles/chatOpen').val() === true"
    },
    "admin": {
      ".read": "auth != null && auth.token.admin === true",
      ".write": "auth != null && auth.token.admin === true"
    }
  }
}
```

## Storage Rules (`Storage > Rules`)
```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    match /profiles/{uid}/{allPaths=**} {
      allow read: if true;
      allow write: if isOwner(uid)
        && request.resource.size < 2 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Admin claim note
To enable `auth.token.admin`, set custom claims from a trusted server/admin script, then force user token refresh.
