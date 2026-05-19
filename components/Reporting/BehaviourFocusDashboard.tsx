import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from '../ui/charts/lazyRecharts';
import { Badge } from '../ui/LayoutComponents';
import type { BehaviouralModel } from '../../types';
import { useChartTokens } from '../../hooks/useChartTokens';

const BUCKETS = ['ON', '1M', '3M', '6M', '12M', '2Y', '4Y', '6Y', '10Y', '>10Y'];
const TENOR_TO_MONTHS: Record<string, number> = {
  ON: 0,
  '1M': 1,
  '3M': 3,
  '6M': 6,
  '12M': 12,
  '2Y': 24,
  '4Y': 48,
  '6Y': 72,
  '10Y': 120,
  '>10Y': 240,
};

interface Props {
  behaviouralModels: BehaviouralModel[];
}

const buildModelData = (model: BehaviouralModel) => (
  BUCKETS.map(bucket => {
    const ftp = (() => {
      if (model.type === 'NMD_Replication') {
        const profile = model.replicationProfile || [];
        const coreRatio = (model.coreRatio || 50) / 100;
        const beta = model.betaFactor || 0.5;
        const baseFTP = 25 + ((TENOR_TO_MONTHS[bucket] || 0) * 0.5);
        const spread = profile.find(item => item.term === bucket)?.spread || 0;
        const weight = profile.find(item => item.term === bucket)?.weight || 0;

        return weight === 0
          ? baseFTP * 0.8 * coreRatio
          : (baseFTP + spread) * (weight / 100) * coreRatio * (1 - beta);
      }

      const baseFTP = 35 + ((TENOR_TO_MONTHS[bucket] || 0) * 0.8);
      const cprImpact = (model.cpr || 5) * 2;
      return baseFTP + cprImpact;
    })();

    return { bucket, ftp: parseFloat(ftp.toFixed(2)) };
  })
);

const BehaviourFocusDashboard: React.FC<Props> = ({ behaviouralModels }) => {
  const tokens = useChartTokens();
  return (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    {behaviouralModels.map(model => {
      const data = buildModelData(model);

      return (
        <div key={model.id} className="flex flex-col gap-4 rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/40 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-bold uppercase text-[color:var(--nfq-text-primary)]">{model.name}</h4>
              <Badge
                variant="outline"
                className={`mt-1 text-[8px] ${model.type === 'NMD_Replication' ? 'border-[color:var(--nfq-cat-d)] text-[color:var(--nfq-cat-d)]' : 'border-[color:var(--nfq-warning)] text-[color:var(--nfq-warning)]'}`}
              >
                {model.type === 'NMD_Replication' ? 'NMD REPLICATION' : 'PREPAYMENT CPR'}
              </Badge>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] text-[color:var(--nfq-text-faint)]">ID: {model.id}</div>
            </div>
          </div>

          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id={`colorFtp-${model.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={model.type === 'NMD_Replication' ? '#a855f7' : '#f59e0b'} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={model.type === 'NMD_Replication' ? '#a855f7' : '#f59e0b'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tokens.grid} vertical={false} />
                <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fill: tokens.axis, fontSize: 9 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: tokens.axis, fontSize: 9 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(v: number) => `${v.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--nfq-bg-elevated)',
                    border: '1px solid var(--nfq-border-ghost)',
                    borderRadius: 'var(--nfq-radius-lg)',
                    padding: '8px 12px',
                    fontFamily: 'var(--nfq-font-mono)',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ftp"
                  stroke={model.type === 'NMD_Replication' ? '#a855f7' : '#f59e0b'}
                  strokeWidth={2}
                  fill={`url(#colorFtp-${model.id})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-[color:var(--nfq-border-ghost)] pt-2">
            {model.type === 'NMD_Replication' ? (
              <>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-[color:var(--nfq-text-faint)]">Core</div>
                  <div className="text-xs font-bold text-[color:var(--nfq-text-primary)] font-mono">{model.coreRatio}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-[color:var(--nfq-text-faint)]">Beta</div>
                  <div className="text-xs font-bold text-[color:var(--nfq-text-primary)] font-mono">{model.betaFactor}</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-[color:var(--nfq-text-faint)]">Tranches</div>
                  <div className="text-xs font-bold text-[color:var(--nfq-text-primary)] font-mono">{model.replicationProfile?.length || 0}</div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-[color:var(--nfq-text-faint)]">CPR</div>
                  <div className="text-xs font-bold text-[color:var(--nfq-text-primary)] font-mono">{model.cpr}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-[color:var(--nfq-text-faint)]">Exempt</div>
                  <div className="text-xs font-bold text-[color:var(--nfq-text-primary)] font-mono">{model.penaltyExempt}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-[color:var(--nfq-text-faint)]">Method</div>
                  <div className="text-xs font-bold uppercase text-[color:var(--nfq-text-primary)] font-mono">Standard</div>
                </div>
              </>
            )}
          </div>
        </div>
      );
    })}
  </div>
  );
};

export default BehaviourFocusDashboard;
