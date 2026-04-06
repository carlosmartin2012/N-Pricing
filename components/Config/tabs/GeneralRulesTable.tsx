import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { Badge } from '../../ui/LayoutComponents';
import type { GeneralRule } from '../../../types';

interface Props {
  rules: GeneralRule[];
  onEditRule: (rule: GeneralRule) => void;
  onDeleteRule: (id: number) => void;
}

const GeneralRulesTable: React.FC<Props> = ({
  rules,
  onEditRule,
  onDeleteRule,
}) => (
  <div className="flex-1 overflow-auto">
    <table className="w-full text-left">
      <thead className="sticky top-0 z-10 bg-[var(--nfq-bg-surface)]">
        <tr>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Priority</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Business Unit</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Product Dimension</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Segment</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Tenor</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Base Method</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Base Ref</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Liq. Method</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Liq. Ref</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Formula</th>
          <th className="border-b border-[color:var(--nfq-border)] px-4 py-2 font-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">Strategic Spread</th>
          <th className="w-16 border-b border-[color:var(--nfq-border)] px-4 py-2" />
        </tr>
      </thead>
      <tbody className="font-mono text-xs text-[color:var(--nfq-text-secondary)]">
        {rules.map(rule => (
          <tr key={rule.id} className="group cursor-pointer transition-colors even:bg-[var(--nfq-bg-surface)] odd:bg-[var(--nfq-bg-root)] hover:bg-[var(--nfq-bg-elevated)]">
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-center text-[color:var(--nfq-text-muted)] [font-variant-numeric:tabular-nums]">{rule.id}</td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">{rule.businessUnit || 'All'}</td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 font-sans">{rule.product}</td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
              <span className="rounded bg-[var(--nfq-bg-elevated)] px-2 py-0.5 text-[10px]">{rule.segment}</span>
            </td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">{rule.tenor}</td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
              <Badge variant={rule.baseMethod === 'Matched Maturity' ? 'success' : 'default'}>
                {rule.baseMethod}
              </Badge>
            </td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-tertiary)]">{rule.baseReference || '-'}</td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
              <Badge variant="warning">{rule.spreadMethod}</Badge>
            </td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-[color:var(--nfq-text-tertiary)]">{rule.liquidityReference || '-'}</td>
            <td className="border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
              {rule.formulaSpec ? (
                <span className="rounded bg-indigo-950/30 px-1.5 py-0.5 font-mono text-[10px] text-indigo-400">
                  {rule.formulaSpec.baseRateKey}|{rule.formulaSpec.lpFormula}
                </span>
              ) : (
                <span className="text-[10px] text-[color:var(--nfq-text-faint)]">auto</span>
              )}
            </td>
            <td className="flex items-center justify-between border-b border-[color:var(--nfq-border-ghost)] px-4 py-2">
              <span className={`[font-variant-numeric:tabular-nums] ${rule.strategicSpread > 0 ? 'text-[var(--nfq-accent)]' : 'text-[color:var(--nfq-text-muted)]'}`}>
                {rule.strategicSpread} bps
              </span>
            </td>
            <td className="flex gap-2 border-b border-[color:var(--nfq-border-ghost)] px-4 py-2 text-right opacity-0 transition-opacity group-hover:opacity-100">
              <button onClick={() => onEditRule(rule)} className="text-[color:var(--nfq-text-muted)] hover:text-[var(--nfq-accent)]">
                <Edit size={14} />
              </button>
              <button onClick={() => onDeleteRule(rule.id)} className="text-[color:var(--nfq-text-muted)] hover:text-[var(--nfq-danger)]">
                <Trash2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default GeneralRulesTable;
