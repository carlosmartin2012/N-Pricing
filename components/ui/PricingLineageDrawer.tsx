import React from 'react';
import { GitBranch, TrendingUp, Brain, Building2, Clock } from 'lucide-react';
import { Drawer } from './Drawer';
import type { PricingLineageRef } from '../../types/pricingLineage';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lineage: PricingLineageRef | null;
  dealId?: string;
}

export const PricingLineageDrawer: React.FC<Props> = ({ isOpen, onClose, lineage, dealId }) => {
  if (!lineage) return null;

  const steps = [
    { icon: TrendingUp, label: 'YIELD CURVE', value: lineage.curveId ?? 'Default', sub: lineage.curveDate ? `As of ${lineage.curveDate}` : 'Latest', color: '#06b6d4' },
    { icon: GitBranch, label: 'PRICING RULE', value: lineage.ruleId ?? 'Auto-matched', sub: lineage.ruleVersion ? `v${lineage.ruleVersion}` : 'Latest', color: '#F48B4A' },
    { icon: Brain, label: 'BEHAVIOURAL MODEL', value: lineage.modelId ?? 'None', sub: 'Deterministic', color: '#9B59B6' },
    { icon: Building2, label: 'ENTITY', value: lineage.entityId?.slice(0, 8) ?? 'Default', sub: '', color: '#E04870' },
    { icon: Clock, label: 'CALCULATED', value: lineage.calculatedAt ? new Date(lineage.calculatedAt).toLocaleString() : '—', sub: lineage.engineVersion ?? 'v4.6', color: '#10b981' },
  ];

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Pricing Lineage" size="md">
      <div className="space-y-1 p-4">
        {dealId && (
          <div className="mb-4 rounded-lg bg-white/5 px-4 py-3">
            <span className="nfq-label text-[10px]">DEAL ID</span>
            <div className="font-mono text-sm text-white">{dealId}</div>
          </div>
        )}

        <div className="relative">
          {steps.map((step, i) => (
            <div key={step.label} className="flex gap-4 pb-6 last:pb-0">
              {/* Vertical line */}
              <div className="flex flex-col items-center">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: step.color + '22', color: step.color }}
                >
                  <step.icon size={16} />
                </div>
                {i < steps.length - 1 && (
                  <div className="mt-1 h-full w-[1px] bg-white/10" />
                )}
              </div>

              {/* Content */}
              <div className="pt-1">
                <span className="nfq-label text-[10px]" style={{ color: step.color }}>{step.label}</span>
                <div className="text-sm font-medium text-white">{step.value}</div>
                {step.sub && <div className="text-xs text-slate-400">{step.sub}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Drawer>
  );
};
