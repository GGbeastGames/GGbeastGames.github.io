import { ReactNode, useMemo, useState } from 'react';

import { useResponsiveScale } from '../hooks/useResponsiveScale';
import { useSfx } from '../hooks/useSfx';
import { toThemeCssVariables, webglThemeSkin } from '../theme/webglTheme';

interface DesktopEnvironmentProps {
  loginWindow: ReactNode;
}

type WindowState = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  z: number;
  content: ReactNode;
};

export const DesktopEnvironment = ({ loginWindow }: DesktopEnvironmentProps) => {
  const { scale, viewportClass } = useResponsiveScale();
  const sfx = useSfx();
  const [counter, setCounter] = useState(5);
  const [windows, setWindows] = useState<WindowState[]>([
    {
      id: 'auth',
      title: 'Identity Access',
      x: 100,
      y: 80,
      width: 420,
      height: 420,
      minimized: false,
      maximized: false,
      z: 2,
      content: loginWindow,
    },
  ]);

  const focusWindow = (id: string) => {
    setWindows((previous) => {
      const nextZ = Math.max(...previous.map((windowState) => windowState.z), 1) + 1;
      return previous.map((windowState) =>
        windowState.id === id ? { ...windowState, z: nextZ } : windowState,
      );
    });
    void sfx.play('focus');
  };

  const updateWindow = (id: string, patch: Partial<WindowState>) => {
    setWindows((previous) =>
      previous.map((windowState) => (windowState.id === id ? { ...windowState, ...patch } : windowState)),
    );
  };

  const launchTerminal = () => {
    const id = `term-${counter}`;
    setCounter((current) => current + 1);
    setWindows((previous) => [
      ...previous,
      {
        id,
        title: `Console ${id}`,
        x: 180,
        y: 140,
        width: 360,
        height: 220,
        minimized: false,
        maximized: false,
        z: Math.max(...previous.map((windowState) => windowState.z), 1) + 1,
        content: <pre className="console-window">Boot sequence stable. Awaiting command...</pre>,
      },
    ]);
    void sfx.play('open');
  };

  const themeVariables = useMemo(() => toThemeCssVariables(webglThemeSkin), []);

  return (
    <div className={`desktop-shell ${viewportClass}`} style={{ ...themeVariables, ['--ui-scale' as string]: `${scale}` }}>
      <div className="desktop-shell__wallpaper" />
      <div className="desktop-shell__workspace">
        {windows.map((windowState) => {
          if (windowState.minimized) {
            return null;
          }

          return (
            <article
              key={windowState.id}
              className={`desktop-window ${windowState.maximized ? 'is-maximized' : ''}`}
              style={{
                zIndex: windowState.z,
                left: windowState.maximized ? 0 : windowState.x,
                top: windowState.maximized ? 0 : windowState.y,
                width: windowState.maximized ? '100%' : windowState.width,
                height: windowState.maximized ? 'calc(100% - 56px)' : windowState.height,
              }}
              onMouseDown={() => focusWindow(windowState.id)}
            >
              <header
                className="desktop-window__bar"
                onMouseDown={(event) => {
                  if (windowState.maximized) {
                    return;
                  }

                  const originX = event.clientX - windowState.x;
                  const originY = event.clientY - windowState.y;
                  const onMove = (moveEvent: MouseEvent) => {
                    updateWindow(windowState.id, {
                      x: Math.max(0, moveEvent.clientX - originX),
                      y: Math.max(0, moveEvent.clientY - originY),
                    });
                  };

                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };

                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
              >
                <strong>{windowState.title}</strong>
                <div>
                  <button type="button" onClick={() => updateWindow(windowState.id, { minimized: true })}>
                    _
                  </button>
                  <button
                    type="button"
                    onClick={() => updateWindow(windowState.id, { maximized: !windowState.maximized })}
                  >
                    {windowState.maximized ? '❐' : '□'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      updateWindow(windowState.id, { minimized: true });
                      void sfx.play('close');
                    }}
                  >
                    ✕
                  </button>
                </div>
              </header>
              <div className="desktop-window__content">{windowState.content}</div>
            </article>
          );
        })}
      </div>

      <footer className="taskbar">
        <button type="button" onClick={launchTerminal}>
          Launch Console
        </button>
        {windows.map((windowState) => (
          <button
            key={windowState.id}
            type="button"
            className={windowState.minimized ? 'is-minimized' : ''}
            onClick={() => {
              updateWindow(windowState.id, { minimized: false });
              focusWindow(windowState.id);
            }}
          >
            {windowState.title}
          </button>
        ))}
      </footer>
    </div>
  );
};
