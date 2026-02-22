import { DisplaySettings, clampUiScale } from '../game/settings';
import { TerminalLog } from '../game/terminal';
import { MAX_LOGS, PersistedDesktop, WindowState, createDefaultDesktopState } from './desktopState';

export type DesktopAction =
  | { type: 'reset' }
  | { type: 'hydrate'; payload: PersistedDesktop }
  | { type: 'patch'; payload: Partial<PersistedDesktop> }
  | { type: 'setWindows'; payload: WindowState[] }
  | { type: 'setLogs'; payload: TerminalLog[] }
  | { type: 'appendLogs'; payload: TerminalLog[] }
  | { type: 'updateDisplay'; payload: Partial<DisplaySettings> };

export function desktopReducer(state: PersistedDesktop, action: DesktopAction): PersistedDesktop {
  switch (action.type) {
    case 'reset':
      return createDefaultDesktopState();
    case 'hydrate':
      return action.payload;
    case 'patch':
      return { ...state, ...action.payload };
    case 'setWindows':
      return { ...state, windows: action.payload };
    case 'setLogs':
      return { ...state, logs: action.payload.slice(-MAX_LOGS) };
    case 'appendLogs':
      return { ...state, logs: [...state.logs, ...action.payload].slice(-MAX_LOGS) };
    case 'updateDisplay':
      return {
        ...state,
        displaySettings: {
          ...state.displaySettings,
          ...action.payload,
          uiScale: action.payload.uiScale !== undefined ? clampUiScale(action.payload.uiScale) : state.displaySettings.uiScale
        }
      };
    default:
      return state;
  }
}
