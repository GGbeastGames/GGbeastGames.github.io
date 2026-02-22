export function shouldResetForUidChange(previousUid: string | null, nextUid: string | null): boolean {
  return previousUid !== nextUid;
}

export function canWriteForHydratedUser(params: {
  authUid: string | null;
  hydratedUid: string | null;
  payloadUid: string;
}): boolean {
  return Boolean(params.authUid && params.authUid === params.hydratedUid && params.authUid === params.payloadUid);
}

export function shouldApplySnapshotForActiveUser(params: {
  snapshotUid: string;
  activeHydrationUid: string | null;
  authUid: string | null;
}): boolean {
  return params.snapshotUid === params.activeHydrationUid && params.snapshotUid === params.authUid;
}
