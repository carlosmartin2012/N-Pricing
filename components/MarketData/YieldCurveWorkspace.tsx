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
      className="flex flex-1 flex-col overflow-hidden bg-white/50 dark:bg-slate-950/50"
    >
      <div className="flex h-full min-h-0 flex-col xl:flex-row">
        <div className="relative flex min-h-[300px] flex-1 flex-col border-b border-slate-200 dark:border-slate-800 xl:border-b-0 xl:border-r">
          <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-200 bg-slate-100 px-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="scrollbar-none flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <div className="flex shrink-0 items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 dark:border-amber-900/50 dark:bg-amber-950/30">
                <Zap size={12} className="text-amber-500" />
                <input
                  type="number"
                  value={shockBps}
                  onChange={(event) => onShockChange(Number(event.target.value) || 0)}
                  className="w-8 border-none bg-transparent text-center text-[10px] font-bold text-amber-600 focus:ring-0 dark:text-amber-400"
                />
                <span className="text-[9px] font-bold uppercase text-amber-500">bps</span>
              </div>
              <div className="mx-1 h-4 w-px shrink-0 bg-slate-300 dark:bg-slate-700" />
              <div className="flex shrink-0 items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-0.5 dark:border-slate-800 dark:bg-slate-900">
                <Calendar size={12} className="text-slate-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => onDateChange(event.target.value)}
                  className="w-24 border-none bg-transparent font-mono text-[10px] text-slate-700 focus:ring-0 dark:text-slate-300"
                />
              </div>
            </div>

            <div className="ml-2 flex shrink-0 items-center gap-2">
              <div className="flex rounded bg-slate-200 p-0.5 dark:bg-slate-800">
                {CURVE_PANEL_CURRENCIES.map(item => (
                  <button
                    key={item}
                    onClick={() => onCurrencyChange(item)}
                    className={`rounded px-2 py-0.5 text-[9px] font-bold transition-all ${currency === item
                      ? 'bg-white text-cyan-600 shadow-sm dark:bg-slate-600 dark:text-cyan-400'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <button onClick={onDownloadTemplate} className="p-1 text-slate-400 transition-colors hover:text-amber-500" title="Download Template">
                <FileSpreadsheet size={14} />
              </button>
              <button onClick={onSaveSnapshot} className="p-1 text-slate-400 transition-colors hover:text-emerald-500" title="Save Snapshot">
                <Save size={14} />
              </button>
              <button onClick={onOpenImport} className="p-1 text-slate-400 transition-colors hover:text-cyan-500" title="Import Data">
                <Upload size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-hidden bg-white p-4 dark:bg-black/20">
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
                      className="text-slate-200 dark:text-slate-800"
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

          <div className="flex h-8 shrink-0 items-center justify-between border-t border-slate-200 bg-slate-100 px-4 font-mono text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5">
                <div className={`h-0.5 w-3 rounded-full ${isPersisted ? 'bg-cyan-500' : 'bg-amber-400'}`} />
                {isPersisted ? 'PERSISTED' : 'REALTIME'}
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 border border-dashed border-slate-400" />
                PREV CLOSE
              </span>
            </div>
            <div className="hidden sm:block">CURRENCY: {currency} | AS OF: {selectedDate}</div>
          </div>
        </div>

        <div className="flex w-full shrink-0 flex-col bg-white dark:bg-black/30 xl:w-64">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Saved Snapshots</span>
            <History size={14} className="text-slate-400" />
          </div>
          <div className="custom-scrollbar max-h-[150px] overflow-auto xl:max-h-none xl:flex-1">
            {snapshotKeys.length === 0 ? (
              <div className="p-8 text-center text-[10px] font-bold uppercase opacity-30">No snapshots</div>
            ) : (
              snapshotKeys.map((key) => {
                const date = getCurveDateFromKey(key);
                return (
                  <div
                    key={key}
                    onClick={() => onDateChange(date)}
                    className={`flex cursor-pointer items-center justify-between border-b border-slate-100 p-3 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800/50 ${selectedDate === date ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck size={14} className="text-emerald-500" />
                      <span className="font-mono text-xs dark:text-slate-300">{date}</span>
                    </div>
                    <ChevronDown size={12} className="-rotate-90 text-slate-400" />
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
