export type ThemeId = 'matrix' | 'oasis' | 'inferno';

export type DisplaySettings = {
  theme: ThemeId;
  uiScale: number;
  reducedMotion: boolean;
  highContrast: boolean;
};

export const defaultDisplaySettings: DisplaySettings = {
  theme: 'matrix',
  uiScale: 1,
  reducedMotion: false,
  highContrast: false
};

export function clampUiScale(value: number) {
  return Math.min(1.2, Math.max(0.85, Number.isFinite(value) ? value : 1));
}
