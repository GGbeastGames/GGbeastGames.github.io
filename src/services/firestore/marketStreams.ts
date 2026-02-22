import { Firestore, doc, onSnapshot } from 'firebase/firestore';

import { MarketState } from '../../features/game/playerProgress';

export const observeUserMarketState = (
  firestore: Firestore,
  uid: string,
  onChange: (market: Partial<MarketState>) => void,
) => {
  const ref = doc(firestore, 'users', uid, 'market', 'state');

  return onSnapshot(ref, (snapshot) => {
    if (!snapshot.exists()) {
      return;
    }

    onChange(snapshot.data() as Partial<MarketState>);
  });
};
