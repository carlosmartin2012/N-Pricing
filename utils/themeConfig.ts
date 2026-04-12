export interface ThemeConfig {
  id: string;
  name: string;
  colors: {
    accent: string;
    accentRgb: string;
    success: string;
    warning: string;
    danger: string;
    bgRoot: string;
    bgSurface: string;
    bgElevated: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textFaint: string;
    borderGhost: string;
  };
  logo?: string;
}

export const NFQ_THEME: ThemeConfig = {
  id: 'nfq-default',
  name: 'NFQ Meridian Obsidian',
  colors: {
    accent: '#06b6d4',
    accentRgb: '6, 182, 212',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#f43f5e',
    bgRoot: '#0e0e0e',
    bgSurface: '#141414',
    bgElevated: '#1a1a1a',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textFaint: '#475569',
    borderGhost: 'rgba(255,255,255,0.06)',
  },
};

export const SANTANDER_THEME: ThemeConfig = {
  id: 'santander',
  name: 'Santander Corporate',
  colors: {
    accent: '#ec0000',
    accentRgb: '236, 0, 0',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    bgRoot: '#0d0d0d',
    bgSurface: '#131313',
    bgElevated: '#1c1c1c',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',
    textFaint: '#475569',
    borderGhost: 'rgba(255,255,255,0.06)',
  },
};

export const BBVA_THEME: ThemeConfig = {
  id: 'bbva',
  name: 'BBVA Digital',
  colors: {
    accent: '#004481',
    accentRgb: '0, 68, 129',
    success: '#48ae64',
    warning: '#f5a623',
    danger: '#da3b01',
    bgRoot: '#0a0e14',
    bgSurface: '#101820',
    bgElevated: '#192230',
    textPrimary: '#e8ecf0',
    textSecondary: '#8fa0b4',
    textMuted: '#5c7080',
    textFaint: '#3d5068',
    borderGhost: 'rgba(255,255,255,0.07)',
  },
};

export const THEME_PRESETS: ThemeConfig[] = [NFQ_THEME, SANTANDER_THEME, BBVA_THEME];

/** Apply a theme by setting CSS custom properties on the document root */
export function applyTheme(theme: ThemeConfig): void {
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty('--nfq-accent', c.accent);
  root.style.setProperty('--nfq-accent-rgb', c.accentRgb);
  root.style.setProperty('--nfq-success', c.success);
  root.style.setProperty('--nfq-warning', c.warning);
  root.style.setProperty('--nfq-danger', c.danger);
  root.style.setProperty('--nfq-bg-root', c.bgRoot);
  root.style.setProperty('--nfq-bg-surface', c.bgSurface);
  root.style.setProperty('--nfq-bg-elevated', c.bgElevated);
  root.style.setProperty('--nfq-text-primary', c.textPrimary);
  root.style.setProperty('--nfq-text-secondary', c.textSecondary);
  root.style.setProperty('--nfq-text-muted', c.textMuted);
  root.style.setProperty('--nfq-text-faint', c.textFaint);
  root.style.setProperty('--nfq-border-ghost', c.borderGhost);
}
