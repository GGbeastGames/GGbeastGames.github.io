export type SessionMode = 'viewer' | 'player';

export function authSuccessEntersDesktop(_userPresent: boolean): 'desktop' | 'login' {
  return 'desktop';
}

export function getSessionMode(userPresent: boolean): SessionMode {
  return userPresent ? 'player' : 'viewer';
}

export function canPerformAdminAction(hasTrustedRole: boolean, sessionMode: SessionMode = 'player'): boolean {
  return sessionMode === 'player' && hasTrustedRole;
}

export function nextQueueIntent(inQueue: boolean): 'join' | 'leave' {
  return inQueue ? 'leave' : 'join';
}
