import { useEffect, useState } from 'react';

/**
 * Resolves NFQ design-system color tokens into literal hex/rgb strings
 * for chart libraries (Recharts, Visx, raw SVG) that cannot read CSS
 * custom properties.
 *
 * Usage:
 *   const { axis, grid, danger, success } = useChartTokens();
 *   <XAxis tick={{ fill: axis, fontSize: 10 }} />
 *
 * The hook reads `getComputedStyle(document.documentElement)` once on
 * mount and again whenever the `html.dark` / `html.light` class flips
 * — so chart colors respond to runtime theme switching.
 *
 * Tokens exposed mirror the semantic palette in index.css:
 *   axis        --nfq-text-muted     (chart axis tick fill)
 *   grid        --nfq-border-ghost   (CartesianGrid stroke)
 *   text        --nfq-text-secondary (tooltip text)
 *   accent      --nfq-accent
 *   success     --nfq-success
 *   warning     --nfq-warning
 *   danger      --nfq-danger
 *   catA..catH  --nfq-cat-{a..h}     (categorical series palette)
 *
 * SSR-safe: returns hex fallbacks when `window` is undefined.
 */
export interface ChartTokens {
  axis: string;
  grid: string;
  text: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  catA: string;
  catB: string;
  catC: string;
  catD: string;
  catE: string;
  catF: string;
  catG: string;
  catH: string;
}

const FALLBACK: ChartTokens = {
  axis: '#94a3b8',
  grid: 'rgba(255,255,255,0.08)',
  text: '#c4bfb6',
  accent: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#f43f5e',
  catA: '#0ea5e9',
  catB: '#f59e0b',
  catC: '#f43f5e',
  catD: '#8b5cf6',
  catE: '#10b981',
  catF: '#f97316',
  catG: '#ec4899',
  catH: '#14b8a6',
};

function readTokens(): ChartTokens {
  if (typeof window === 'undefined') return FALLBACK;
  const root = document.documentElement;
  const styles = window.getComputedStyle(root);
  const read = (name: string, fallback: string): string => {
    const value = styles.getPropertyValue(name).trim();
    return value.length > 0 ? value : fallback;
  };
  return {
    axis:    read('--nfq-text-muted',     FALLBACK.axis),
    grid:    read('--nfq-border-ghost',   FALLBACK.grid),
    text:    read('--nfq-text-secondary', FALLBACK.text),
    accent:  read('--nfq-accent',         FALLBACK.accent),
    success: read('--nfq-success',        FALLBACK.success),
    warning: read('--nfq-warning',        FALLBACK.warning),
    danger:  read('--nfq-danger',         FALLBACK.danger),
    catA:    read('--nfq-cat-a',          FALLBACK.catA),
    catB:    read('--nfq-cat-b',          FALLBACK.catB),
    catC:    read('--nfq-cat-c',          FALLBACK.catC),
    catD:    read('--nfq-cat-d',          FALLBACK.catD),
    catE:    read('--nfq-cat-e',          FALLBACK.catE),
    catF:    read('--nfq-cat-f',          FALLBACK.catF),
    catG:    read('--nfq-cat-g',          FALLBACK.catG),
    catH:    read('--nfq-cat-h',          FALLBACK.catH),
  };
}

export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(() => readTokens());

  useEffect(() => {
    // Re-read tokens whenever the theme class on <html> changes. The
    // theme switcher in App.tsx toggles `dark` / `light` on
    // documentElement.classList, so a MutationObserver on the class
    // attribute is the cheapest invalidation signal.
    if (typeof window === 'undefined') return;
    const observer = new MutationObserver(() => {
      setTokens(readTokens());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-accent', 'data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return tokens;
}
