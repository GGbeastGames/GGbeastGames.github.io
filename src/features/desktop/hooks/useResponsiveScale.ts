import { useEffect, useState } from 'react';

const MIN_WIDTH = 320;
const MIN_HEIGHT = 520;
const BASE_WIDTH = 1440;
const BASE_HEIGHT = 900;

export const useResponsiveScale = () => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const safeWidth = Math.max(window.innerWidth, MIN_WIDTH);
      const safeHeight = Math.max(window.innerHeight, MIN_HEIGHT);
      const ratioX = safeWidth / BASE_WIDTH;
      const ratioY = safeHeight / BASE_HEIGHT;
      setScale(Math.max(0.7, Math.min(1, Math.min(ratioX, ratioY))));
    };

    updateScale();
    window.addEventListener('resize', updateScale);

    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return {
    scale,
    viewportClass: scale < 0.8 ? 'mobile' : scale < 0.95 ? 'tablet' : 'desktop',
  };
};
