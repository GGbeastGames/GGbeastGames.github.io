import { useState } from 'react';

import { DesktopEnvironment } from './components/DesktopEnvironment';
import { IntroCutscene } from './components/IntroCutscene';

import type { ReactNode } from 'react';

interface DesktopShellProps {
  loginWindow: ReactNode;
}

export const DesktopShell = ({ loginWindow }: DesktopShellProps) => {
  const [showIntro, setShowIntro] = useState(true);

  if (showIntro) {
    return <IntroCutscene onComplete={() => setShowIntro(false)} />;
  }

  return <DesktopEnvironment loginWindow={loginWindow} />;
};
