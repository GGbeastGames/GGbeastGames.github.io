import { describe, expect, it } from 'vitest';
import { canPerformAdminAction, authSuccessEntersDesktop, nextQueueIntent } from './sessionPolicy';
import { createDefaultDesktopState, resolveHydratedDesktopState, serializeDesktopEnvelope, parseDesktopEnvelope } from './desktopState';

describe('stability policies', () => {
  it('auth success enters desktop even when datastore fails', () => {
    expect(authSuccessEntersDesktop(true)).toBe('desktop');
  });

  it('local snapshot fallback loads when cloud missing', () => {
    const defaults = createDefaultDesktopState();
    const local = { ...defaults, player: { ...defaults.player, nops: defaults.player.nops + 50 } };
    const resolved = resolveHydratedDesktopState({ cloudState: null, localState: local, defaults });
    expect(resolved.player.nops).toBe(local.player.nops);
  });

  it('admin-only actions blocked for non-admins', () => {
    expect(canPerformAdminAction(false)).toBe(false);
    expect(canPerformAdminAction(true)).toBe(true);
  });

  it('queue intent toggles deterministically for cleanup flows', () => {
    expect(nextQueueIntent(false)).toBe('join');
    expect(nextQueueIntent(true)).toBe('leave');
  });

  it('serialization/hydration roundtrip preserves gameplay state', () => {
    const initial = createDefaultDesktopState();
    const serialized = serializeDesktopEnvelope(initial);
    const parsed = parseDesktopEnvelope(serialized);
    expect(parsed).toEqual(initial);
  });
});
