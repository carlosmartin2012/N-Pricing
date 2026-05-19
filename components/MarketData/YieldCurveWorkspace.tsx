import React, { useMemo } from 'react';
import {
  Calendar,
  ChevronDown,
  FileCheck,
  FileSpreadsheet,
  History,
  Save,
  Upload,
  Zap,
} from 'lucide-react';
import { Panel } from '../ui/LayoutComponents';
import type { YieldCurvePoint } from '../../types';
import {
  CURVE_PANEL_CURRENCIES,
  getCurveDateFromKey,
  getCurveHistoryKey,
  type CurveDisplayPoint,
} from './yieldCurveUtils';

interface Props {
  title: string;
  currency: string;
  selectedDate: string;
  shockBps: number;
  chartData: CurveDisplayPoint[];
  curvesHistory: Record<string, YieldCurvePoint[]>;
  onDateChange: (date: string) => void;
  onShockChange: (value: number) => void;
  onCurrencyChange: (currency: string) => void;
  onDownloadTemplate: () => void;
  onSaveSnapshot: () => void;
  onOpenImport: () => void;
}

const YieldCurveWorkspace: React.FC<Props> = ({
  title,
  currency,
  selectedDate,
  shockBps,
  chartData,
  curvesHistory,
  onDateChange,
  onShockChange,
  onCurrencyChange,
  onDownloadTemplate,
  onSaveSnapshot,
  onOpenImport,
}) => {
  const width = 800;
  const height = 300;
  const padding = 40;
  const minRate = (chartData.length > 0 ? Math.min(...chartData.map(point => Math.min(point.rate, point.prev ?? point.rate))) : 0) * 0.9;
  const maxRate = (chartData.length > 0 ? Math.max(...chartData.map(point => Math.max(point.rate, point.prev ?? point.rate))) : 5) * 1.1;
  const effectiveMax = Number.isNaN(maxRate) || maxRate === minRate
    ? (Number.isNaN(minRate) ? 5 : minRate + 1)
    : maxRate;
  const finalMin = Number.isNaN(minRate) ? 0 : minRate;
  const xStep = (width - padding * 2) / Math.max(1, chartData.length - 1);
  const getX = (index: number) => padding + index * xStep;
  const getY = (rate: number) =>
    height - padding - ((rate - finalMin) / (effectiveMax - finalMin)) * (height - padding * 2);
  const points = chartData.map((point, index) => `${getX(index)},${getY(point.rate)}`).join(' ');
  const prevPoints = chartData.map((point, index) => `${getX(index)},${getY(point.prev ?? point.rate)}`).join(' ');
  const basePoints = chartData.map((point, index) => `${getX(index)},${getY(point.baseRate)}`).join(' ');
  const areaPoints = `${getX(0)},${height - padding} ${points} ${getX(chartData.length - 1)},${height - padding}`;
  const snapshotKeys = useMemo(
    () => Object.keys(curvesHistory)
      .filter(key => key.startsWith(`${currency}-`))
      .sort((left, right) => right.localeCompare(left)),
    [currency, curvesHistory],
  );
  const isPersisted = Boolean(curvesHistory[getCurveHistoryKey(currency, selectedDate)]);

  return (
    <Panel
      title={`${title} (${currency})`}
      className="flex flex-1 flex-col overflow-hidden bg-white/50 dark:bg-[var(--nfq-bg-root)]/50"
    >
      <div className="flex h-full min-h-0 flex-col xl:flex-row">
        <div className="relative flex min-h-[300px] flex-1 flex-col border-b border-[color:var(--nfq-border)] dark:border-[color:var(--nfq-border-ghost)] xl:border-b-0 xl:border-r">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-[color:var(--nfq-border)] bg-[var(--nfq-bg-surface)] px-4 dark:border-[color:var(--nfq-border-ghost)] dark:bg-[var(--nfq-bg-root)]">
            <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <div className="flex shrink-0 items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 dark:border-[color:var(--nfq-warning)]/50 dark:bg-amber-950/30">
                <Zap size={12} className="text-[color:var(--nfq-warning)]" />
                <input
                  type="number"
                  value={shockBps}
                  onChange={(event) => onShockChange(Number(event.target.value) || 0)}
                  className="w-8 border-none bg-transparent text-center text-[10px] font-bold text-amber-600 focus:ring-0 dark:text-[color:var(--nfq-warning)]"
                />
                <span className="text-[9px] font-bold uppercase text-[color:var(--nfq-warning)]">bps</span>
              </div>
              <div className="mx-1 h-4 w-px shrink-0 bg-slate-300 dark:bg-[var(--nfq-bg-highest)]" />
              <div className="flex shrink-0 items-center gap-1.5 rounded border border-[color:var(--nfq-border)] bg-white px-2 py-0.5 dark:border-[color:var(--nfq-border-ghost)] dark:bg-[var(--nfq-bg-elevated)]">
                <Calendar size={12} className="text-[color:var(--nfq-text-muted)]" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => onDateChange(event.target.value)}
                  className="w-24 border-none bg-transparent font-mono text-[10px] text-[color:var(--nfq-text-primary)] focus:ring-0 dark:text-[color:var(--nfq-text-secondary)]"
                />
              </div>
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-2">
              <div className="flex rounded bg-[var(--nfq-bg-elevated)] p-0.5 dark:bg-[var(--nfq-bg-highest)]">
                {CURVE_PANEL_CURRENCIES.map(item => (
                  <button
                    key={item}
                    onClick={() => onCurrencyChange(item)}
                    className={`rounded px-2 py-0.5 text-[9px] font-bold transition-all ${currency === item
                      ? 'bg-white text-[color:var(--nfq-accent)] shadow-sm dark:bg-[var(--nfq-bg-bright)] dark:text-[color:var(--nfq-accent)]'
                      : 'text-[color:var(--nfq-text-faint)] hover:text-[color:var(--nfq-text-primary)] dark:hover:text-[color:var(--nfq-text-secondary)]'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button onClick={onDownloadTemplate} className="p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-warning)]" title="Download Template">
                <FileSpreadsheet size={14} />
              </button>
              <button onClick={onSaveSnapshot} className="p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-success)]" title="Save Snapshot">
                <Save size={14} />
              </button>
              <button onClick={onOpenImport} className="p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-accent)]" title="Import Data">
                <Upload size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden bg-white p-4 dark:bg-[var(--nfq-bg-input)]">
            <svg viewBox={`0 0 ${width} ${height}`} className="h-full max-h-[300px] w-full overflow-visible">
              {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                const y = padding + tick * (height - 2 * padding);
                const value = maxRate - tick * (maxRate - minRate);

                return (
                  <g key={tick}>
                    <line
                      x1={padding}
                      y1={y}
                      x2={width - padding}
                      y2={y}
                      stroke="currentColor"
                      className="text-[color:var(--nfq-text-secondary)] dark:text-[color:var(--nfq-text-primary)]"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={padding - 10}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 dark:fill-slate-600"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {value.toFixed(2)}%
                    </text>
                  </g>
                );
              })}

              <polygon points={areaPoints} fill="url(#curveGradient)" />
              <polyline points={prevPoints} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.4" />
              {shockBps !== 0 && (
                <polyline points={basePoints} fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />
              )}
              <polyline
                points={points}
                fill="none"
                stroke={shockBps !== 0 ? '#fbbf24' : '#22d3ee'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {chartData.map((point, index) => (
                <g key={`${point.tenor}-${index}`} className="group">
                  <circle
                    cx={getX(index)}
                    cy={getY(point.rate)}
                    r="4"
                    className="fill-white dark:fill-slate-900"
                    stroke={shockBps !== 0 ? '#fbbf24' : '#22d3ee'}
                    strokeWidth="2"
                  />
                  <text
                    x={getX(index)}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-slate-400 dark:fill-slate-500"
                    fontSize="10"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    {point.tenor}
                  </text>
                </g>
              ))}

              <defs>
                <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="flex h-8 shrink-0 items-center justify-between border-t border-[color:var(--nfq-border)] bg-[var(--nfq-bg-surface)] px-4 font-mono text-[10px] text-[color:var(--nfq-text-faint)] dark:border-[color:var(--nfq-border-ghost)] dark:bg-[var(--nfq-bg-root)]">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5">
                <div className={`h-0.5 w-3 rounded-full ${isPersisted ? 'bg-[var(--nfq-accent)]' : 'bg-[var(--nfq-warning)]'}`} />
                {isPersisted ? 'PERSISTED' : 'REALTIME'}
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 border border-dashed border-[color:var(--nfq-border)]" />
                PREV CLOSE
              </span>
            </div>
            <div className="hidden sm:block">CURRENCY: {currency} | AS OF: {selectedDate}</div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col bg-white dark:bg-[var(--nfq-bg-input)] xl:w-64">
          <div className="flex items-center justify-between border-b border-[color:var(--nfq-border)] bg-[var(--nfq-bg-surface)] p-3 dark:border-[color:var(--nfq-border-ghost)] dark:bg-[var(--nfq-bg-elevated)]/50">
            <span className="text-[10px] font-bold uppercase text-[color:var(--nfq-text-faint)] dark:text-[color:var(--nfq-text-muted)]">Saved Snapshots</span>
            <History size={14} className="text-[color:var(--nfq-text-muted)]" />
          </div>
          <div className="custom-scrollbar max-h-[150px] overflow-auto xl:max-h-none xl:flex-1">
            {snapshotKeys.length === 0 ? (
              <div className="p-4 text-center text-[10px] font-bold uppercase opacity-30">No snapshots</div>
            ) : (
              snapshotKeys.map((key) => {
                const date = getCurveDateFromKey(key);
                return (
                  <div
                    key={key}
                    onClick={() => onDateChange(date)}
                    className={`flex cursor-pointer items-center justify-between border-b border-[color:var(--nfq-border)] p-3 transition-colors hover:bg-[var(--nfq-bg-surface)] dark:border-[color:var(--nfq-border-ghost)] dark:hover:bg-[var(--nfq-bg-highest)]/50 ${selectedDate === date ? 'bg-[var(--nfq-accent)]/5 dark:bg-[var(--nfq-accent)]/20' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck size={14} className="text-[color:var(--nfq-success)]" />
                      <span className="font-mono text-xs dark:text-[color:var(--nfq-text-secondary)]">{date}</span>
                    </div>
                    <ChevronDown size={12} className="-rotate-90 text-[color:var(--nfq-text-muted)]" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
};

export default YieldCurveWorkspace;
