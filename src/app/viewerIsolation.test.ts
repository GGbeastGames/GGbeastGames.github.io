import { describe, expect, it } from 'vitest';
import { canWriteForHydratedUser, shouldApplySnapshotForActiveUser } from './authIsolation';
import { createDefaultDesktopState, resolveHydratedDesktopState } from './desktopState';
import { getSessionMode } from './sessionPolicy';

describe('viewer/player isolation regressions', () => {
  it('viewer mode cannot write progression updates', () => {
    expect(getSessionMode(false)).toBe('viewer');
    expect(canWriteForHydratedUser({ authUid: null, hydratedUid: null, payloadUid: 'user-a' })).toBe(false);
  });

  it('account state stays isolated between account A and B', () => {
    const defaultsA = createDefaultDesktopState();
    const accountA = {
      ...defaultsA,
      player: { ...defaultsA.player, nops: defaultsA.player.nops + 400 },
      displaySettings: { ...defaultsA.displaySettings, theme: 'inferno' as const }
    };

    const defaultsB = createDefaultDesktopState();
    const hydratedB = resolveHydratedDesktopState({ cloudState: defaultsB, localState: accountA, defaults: defaultsB });
    expect(hydratedB.player.nops).toBe(defaultsB.player.nops);
    expect(hydratedB.displaySettings.theme).toBe(defaultsB.displaySettings.theme);
  });

  it('rapid account switching ignores stale async payload from account A', () => {
    expect(shouldApplySnapshotForActiveUser({ snapshotUid: 'account-a', activeHydrationUid: 'account-b', authUid: 'account-b' })).toBe(false);
  });
});
