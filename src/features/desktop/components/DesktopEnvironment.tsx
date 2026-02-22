import { ReactNode, useEffect, useMemo, useState } from 'react';

import { useResponsiveScale } from '../hooks/useResponsiveScale';
import { useSfx } from '../hooks/useSfx';
import { toThemeCssVariables, webglThemeSkin } from '../theme/webglTheme';
import { COMMAND_CATALOG, SHOP_ITEMS } from '../../game/commandCatalog';
import {
  canUseCommand,
  loadProgress,
  persistProgress,
  PlayerProgress,
  rollTrait,
  traitMultiplier,
} from '../../game/playerProgress';
import { CommandOutcome, TerminalConsole } from './TerminalConsole';
import { IndexApp } from './apps/IndexApp';
import { BlackMarketApp } from './apps/BlackMarketApp';

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

const XP_PER_LEVEL = 100;

const randomInRange = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const DesktopEnvironment = ({ loginWindow }: DesktopEnvironmentProps) => {
  const { scale, viewportClass } = useResponsiveScale();
  const sfx = useSfx();
  const [counter, setCounter] = useState(5);
  const [progress, setProgress] = useState<PlayerProgress>(() => loadProgress());
  const [windows, setWindows] = useState<WindowState[]>([]);

  useEffect(() => {
    setWindows((prev) => {
      const withoutDynamic = prev.filter((windowState) => !['auth', 'index', 'market'].includes(windowState.id));
      return [
        ...withoutDynamic,
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
        {
          id: 'index',
          title: 'Index',
          x: 560,
          y: 120,
          width: 400,
          height: 360,
          minimized: false,
          maximized: false,
          z: 3,
          content: <IndexApp progress={progress} />,
        },
        {
          id: 'market',
          title: 'Black Market',
          x: 220,
          y: 180,
          width: 430,
          height: 380,
          minimized: false,
          maximized: false,
          z: 4,
          content: <BlackMarketApp progress={progress} onBuy={buyShopItem} onCompleteLesson={completeLesson} />,
        },
      ];
    });

    persistProgress(progress);

    function buyShopItem(sku: string) {
      const item = SHOP_ITEMS.find((candidate) => candidate.sku === sku && !candidate.removedFromShop);
      if (!item) {
        return;
      }

      setProgress((current) => {
        if (current.entitlements.includes(item.sku) || current.wallet < item.cost) {
          return current;
        }

        return {
          ...current,
          wallet: current.wallet - item.cost,
          entitlements: [...current.entitlements, item.sku],
        };
      });
    }

    function completeLesson(sku: string) {
      const item = SHOP_ITEMS.find((candidate) => candidate.sku === sku && candidate.type === 'lesson');
      if (!item) {
        return;
      }

      setProgress((current) => {
        if (!current.entitlements.includes(sku) || current.completedLessons.includes(sku)) {
          return current;
        }

        const updated: PlayerProgress = {
          ...current,
          completedLessons: [...current.completedLessons, sku],
          ownedCommands: current.ownedCommands.includes(item.commandId)
            ? current.ownedCommands
            : [...current.ownedCommands, item.commandId],
        };

        const trait = rollTrait();
        if (trait) {
          updated.commandTraits[item.commandId] = [...(updated.commandTraits[item.commandId] ?? []), trait];
        }

        return { ...updated, commandTraits: { ...updated.commandTraits } };
      });
    }

    return () => undefined;
  }, [loginWindow, progress]);

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

  const executeLocalCommand = async (input: string): Promise<CommandOutcome> => {
    const base = input.toLowerCase().endsWith('-ts') ? input.toLowerCase().slice(0, -3) : input.toLowerCase();
    const useTrait = input.toLowerCase().endsWith('-ts');
    const command = COMMAND_CATALOG.find((entry) => entry.id === base || entry.aliases.includes(base));
    if (!command) {
      throw new Error('Unsupported command.');
    }

    if (!canUseCommand(progress, command.id)) {
      throw new Error('Command locked. Buy lesson/software first.');
    }

    const now = Date.now();
    const cooldown = progress.cooldowns[command.id] ?? 0;
    if (cooldown > now) {
      throw new Error(`Cooldown active. Retry in ${Math.ceil((cooldown - now) / 1000)}s.`);
    }

    const didSucceed = Math.random() <= command.successChance;
    const multiplier = useTrait && (progress.commandTraits[command.id] ?? []).includes('spring') ? traitMultiplier('spring') : 1;
    const walletDelta = didSucceed
      ? randomInRange(command.rewardRange.min, command.rewardRange.max) * multiplier
      : -randomInRange(command.penaltyRange.min, command.penaltyRange.max);
    const xpDelta = randomInRange(command.xpRange.min, command.xpRange.max);

    const nextWallet = Math.max(0, progress.wallet + walletDelta);
    const nextXp = progress.xp + xpDelta;
    const level = Math.floor(nextXp / XP_PER_LEVEL) + 1;
    const cooldownUntilMs = now + command.cooldownMs;

    setProgress((current) => ({
      ...current,
      wallet: nextWallet,
      xp: nextXp,
      cooldowns: { ...current.cooldowns, [command.id]: cooldownUntilMs },
    }));

    return {
      ok: true,
      commandId: command.id,
      success: didSucceed,
      walletDelta,
      walletAfter: nextWallet,
      xpDelta,
      xpAfter: nextXp,
      levelAfter: level,
      cooldownUntilMs,
      message: didSucceed
        ? `${command.id} execution succeeded${multiplier > 1 ? ` with Spring trait x${multiplier}` : ''}.`
        : `${command.id} execution failed.`,
    };
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
        content: (
          <TerminalConsole
            commands={COMMAND_CATALOG.filter((command) => canUseCommand(progress, command.id)).map((command) => ({
              id: command.id,
              aliases: command.aliases,
              usage: command.usage,
              description: command.description,
              cooldownMs: command.cooldownMs,
            }))}
            executeCommandRequest={executeLocalCommand}
          />
        ),
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
