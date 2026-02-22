# Firestore Rule Test Cases

## Valid scenarios

1. **Owner reads own user profile**
   - Auth: `uid = alice`
   - Path: `users/alice`
   - Operation: `get`
   - Expected: **ALLOW**

2. **Owner updates settings without touching money fields**
   - Auth: `uid = alice`
   - Path: `users/alice`
   - Operation: `update`
   - Payload only changes `settings` and keeps `wallet`, `bank`, `netWorth` unchanged.
   - Expected: **ALLOW**

3. **Owner writes cooldown with valid shape**
   - Auth: `uid = alice`
   - Path: `cooldowns/alice/commands/daily`
   - Operation: `create`
   - Payload has matching `uid`, `commandId`, and `nextAllowedAt > request.time`.
   - Expected: **ALLOW**

4. **Admin creates global event**
   - Auth token includes `isAdmin: true`
   - Path: `events/x2-weekend`
   - Operation: `create`
   - Expected: **ALLOW**

## Invalid scenarios

1. **User reads another user's private profile**
   - Auth: `uid = bob`
   - Path: `users/alice`
   - Operation: `get`
   - Expected: **DENY**

2. **User directly edits wallet balance**
   - Auth: `uid = alice`
   - Path: `users/alice`
   - Operation: `update`
   - Payload changes `wallet`
   - Expected: **DENY**

3. **Cooldown write forged for someone else**
   - Auth: `uid = bob`
   - Path: `cooldowns/alice/commands/daily`
   - Operation: `create`
   - Expected: **DENY**

4. **Cooldown with expired `nextAllowedAt`**
   - Auth: `uid = alice`
   - Path: `cooldowns/alice/commands/daily`
   - Operation: `create`
   - Payload sets `nextAllowedAt <= request.time`
   - Expected: **DENY**

5. **Non-admin writes admin logs**
   - Auth token omits `isAdmin`
   - Path: `adminLogs/entry-1`
   - Operation: `create`
   - Expected: **DENY**

6. **Non-admin performs stock mutation**
   - Auth: regular signed-in user
   - Path: `stocks/ABC`
   - Operation: `update`
   - Expected: **DENY**
