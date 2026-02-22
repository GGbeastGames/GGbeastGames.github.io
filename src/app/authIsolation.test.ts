import { describe, expect, it } from 'vitest';
import { canWriteForHydratedUser, shouldApplySnapshotForActiveUser, shouldResetForUidChange } from './authIsolation';

describe('auth isolation guards', () => {
  it('resets runtime state whenever uid changes including sign out/in', () => {
    expect(shouldResetForUidChange('user-a', 'user-b')).toBe(true);
    expect(shouldResetForUidChange('user-a', null)).toBe(true);
    expect(shouldResetForUidChange(null, 'user-a')).toBe(true);
    expect(shouldResetForUidChange('user-a', 'user-a')).toBe(false);
  });

  it('blocks cross-user and pre-hydration cloud writes', () => {
    expect(canWriteForHydratedUser({ authUid: 'user-a', hydratedUid: 'user-a', payloadUid: 'user-a' })).toBe(true);
    expect(canWriteForHydratedUser({ authUid: 'user-a', hydratedUid: null, payloadUid: 'user-a' })).toBe(false);
    expect(canWriteForHydratedUser({ authUid: 'user-a', hydratedUid: 'user-b', payloadUid: 'user-a' })).toBe(false);
    expect(canWriteForHydratedUser({ authUid: 'user-a', hydratedUid: 'user-a', payloadUid: 'user-b' })).toBe(false);
  });

  it('ignores late snapshots from stale users during rapid account switching', () => {
    expect(shouldApplySnapshotForActiveUser({ snapshotUid: 'user-a', activeHydrationUid: 'user-a', authUid: 'user-a' })).toBe(true);
    expect(shouldApplySnapshotForActiveUser({ snapshotUid: 'user-a', activeHydrationUid: 'user-b', authUid: 'user-b' })).toBe(false);
    expect(shouldApplySnapshotForActiveUser({ snapshotUid: 'user-a', activeHydrationUid: 'user-a', authUid: 'user-b' })).toBe(false);
  });
});
