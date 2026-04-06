import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '../ui/LayoutComponents';
import type { BehaviouralModel } from '../../types';

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

const BehaviourFocusDashboard: React.FC<Props> = ({ behaviouralModels }) => (
  <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
    {behaviouralModels.map(model => {
      const data = buildModelData(model);

      return (
        <div key={model.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#0f172a]/40 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-bold uppercase text-white">{model.name}</h4>
              <Badge
                variant="outline"
                className={`mt-1 text-[8px] ${model.type === 'NMD_Replication' ? 'border-purple-500 text-purple-400' : 'border-amber-500 text-amber-400'}`}
              >
                {model.type === 'NMD_Replication' ? 'NMD REPLICATION' : 'PREPAYMENT CPR'}
              </Badge>
            </div>
            <div className="text-right">
              <div className="font-mono text-[9px] italic text-slate-500">ID: {model.id}</div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 9 }} />
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

          <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2">
            {model.type === 'NMD_Replication' ? (
              <>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-slate-500">Core</div>
                  <div className="text-xs font-bold text-white font-mono">{model.coreRatio}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-slate-500">Beta</div>
                  <div className="text-xs font-bold text-white font-mono">{model.betaFactor}</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-slate-500">Tranches</div>
                  <div className="text-xs font-bold text-white font-mono">{model.replicationProfile?.length || 0}</div>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-slate-500">CPR</div>
                  <div className="text-xs font-bold text-white font-mono">{model.cpr}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-slate-500">Exempt</div>
                  <div className="text-xs font-bold text-white font-mono">{model.penaltyExempt}%</div>
                </div>
                <div className="text-center">
                  <div className="text-[8px] uppercase text-slate-500">Method</div>
                  <div className="text-xs font-bold uppercase italic text-white font-mono">Standard</div>
                </div>
              </>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

export default BehaviourFocusDashboard;
