import { useEffect, useMemo, useState } from 'react';

interface IntroCutsceneProps {
  onComplete: () => void;
}

export const IntroCutscene = ({ onComplete }: IntroCutsceneProps) => {
  const [fade, setFade] = useState(false);
  const rainRows = useMemo(
    () =>
      Array.from({ length: 20 }, (_, row) =>
        `${(row % 2 === 0 ? '10' : '01').repeat(120).slice(Math.floor(Math.random() * 8))}`,
      ),
    [],
  );

  useEffect(() => {
    const fadeTimeout = window.setTimeout(() => setFade(true), 2600);
    const doneTimeout = window.setTimeout(onComplete, 3400);

    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(doneTimeout);
    };
  }, [onComplete]);

  return (
    <div className={`intro-cutscene ${fade ? 'fade-out' : ''}`}>
      <div className="intro-cutscene__rain" aria-hidden="true">
        {rainRows.map((row, index) => (
          <p key={`${row}-${index}`} style={{ animationDelay: `${index * 0.14}s` }}>
            {row}
          </p>
        ))}
      </div>
      <div className="intro-cutscene__title">
        <span>AIONOUS</span>
      </div>
    </div>
  );
};
