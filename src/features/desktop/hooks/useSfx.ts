import { useMemo } from 'react';

type SfxKey = 'open' | 'close' | 'focus' | 'confirm';

const SOUND_MAP: Record<SfxKey, string> = {
  open: '/Sounds/Reverse_Ring_2_Mid.wav',
  close: '/Sounds/Click_2.wav',
  focus: '/Sounds/High_Click_2.wav',
  confirm: '/Sounds/Ting_Pitched_Up.wav',
};

interface HowlerLike {
  Howl: new (options: { src: string[]; volume?: number }) => { play: () => void };
}

export const useSfx = () => {
  return useMemo(() => {
    let adapterPromise: Promise<HowlerLike | null> | null = null;

    const getHowler = () => {
      if (!adapterPromise) {
        adapterPromise = import('howler').catch(() => null) as Promise<HowlerLike | null>;
      }

      return adapterPromise;
    };

    const play = async (key: SfxKey) => {
      const src = SOUND_MAP[key];
      const howler = await getHowler();

      if (howler?.Howl) {
        new howler.Howl({ src: [src], volume: 0.3 }).play();
        return;
      }

      const fallback = new Audio(src);
      fallback.volume = 0.2;
      void fallback.play();
    };

    return { play };
  }, []);
};
