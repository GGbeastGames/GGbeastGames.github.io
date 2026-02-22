export function authSuccessEntersDesktop(userPresent: boolean): 'desktop' | 'login' {
  return userPresent ? 'desktop' : 'login';
}

export function canPerformAdminAction(hasTrustedRole: boolean): boolean {
  return hasTrustedRole;
}

export function nextQueueIntent(inQueue: boolean): 'join' | 'leave' {
  return inQueue ? 'leave' : 'join';
}
