export const themeTokens = {
  colors: {
    bgBase: '#040c14',
    bgElevated: '#0b1c2a',
    panel: 'rgba(8, 25, 36, 0.82)',
    textPrimary: '#dbfff3',
    textMuted: '#78c9b1',
    neonPrimary: '#36ffb5',
    neonSecondary: '#38a8ff',
    neonDanger: '#ff5a83',
    borderGlow: 'rgba(54, 255, 181, 0.34)'
  },
  typography: {
    display: 'Rajdhani, Inter, Segoe UI, sans-serif',
    body: 'Inter, Segoe UI, sans-serif',
    mono: 'JetBrains Mono, Fira Code, monospace'
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '18px'
  },
  shadow: {
    neonSoft: '0 0 20px rgba(54, 255, 181, 0.15)',
    neonHard: '0 0 0 1px rgba(54, 255, 181, 0.4), 0 0 30px rgba(54, 255, 181, 0.22)'
  }
} as const;
