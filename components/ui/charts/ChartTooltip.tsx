import React from 'react';

interface TooltipEntry {
  name: string;
  value: number | string;
  color: string;
  unit?: string;
}

interface Props {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; unit?: string }>;
  label?: string;
  formatter?: (value: number, name: string) => string;
}

/**
 * Custom Recharts tooltip with NFQ Meridian Obsidian styling.
 * Replaces the default tooltip with dark surface, monospace values,
 * and color-coded series indicators.
 */
export const ChartTooltip: React.FC<Props> = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      {label && (
        <div className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--nfq-text-faint)]">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[var(--nfq-text-muted)]">{entry.name}</span>
            <span className="ml-auto font-mono font-semibold text-[var(--nfq-text-primary)]">
              {formatter ? formatter(entry.value, entry.name) : entry.value.toFixed(2)}
              {entry.unit && <span className="ml-0.5 text-[var(--nfq-text-faint)]">{entry.unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Percentage formatter for chart tooltips.
 */
export function pctFormatter(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Currency formatter for chart tooltips (K/M/B).
 */
export function currencyFormatter(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toFixed(0);
}

/**
 * Basis points formatter for chart tooltips.
 */
export function bpsFormatter(value: number): string {
  return `${value.toFixed(0)}bp`;
}
