import { ReactNode } from 'react';

type CyberWindowProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function CyberWindow({ title, subtitle, children }: CyberWindowProps) {
  return (
    <section className="cyber-window">
      <header className="cyber-window__header">
        <div>
          <p className="cyber-window__kicker">Aionous OS</p>
          <h3>{title}</h3>
          {subtitle ? <p className="cyber-window__subtitle">{subtitle}</p> : null}
        </div>
        <div className="cyber-window__controls" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </header>
      <div className="cyber-window__body">{children}</div>
    </section>
  );
}
