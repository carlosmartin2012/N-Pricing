import React from 'react';
import { Activity, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { MACRO_SCENARIOS, toPricingShocks } from '../../utils/pricing/macroStressScenarios';
import type { MacroScenario } from '../../utils/pricing/macroStressScenarios';

interface MacroScenarioPickerProps {
  activeScenarioId?: string;
  onSelectScenario: (
    scenarioId: string,
    shocks: { interestRate: number; liquiditySpread: number },
  ) => void;
}

function fmtBps(bps: number): string {
  const sign = bps >= 0 ? '+' : '';
  return `${sign}${bps}bp`;
}

function fmtPct(p: number): string {
  const sign = p >= 0 ? '+' : '';
  return `${sign}${(p * 100).toFixed(0)}%`;
}

function fmtMult(m: number): string {
  return `×${m.toFixed(1)}`;
}

function getScenarioIcon(id: string): React.ReactNode {
  switch (id) {
    case 'BASELINE':
      return <Activity size={16} className="text-[var(--nfq-text-muted)]" />;
    case 'ADVERSE_MILD':
    case 'ADVERSE_SEVERE':
      return <AlertTriangle size={16} className="text-amber-500" />;
    case 'LIQUIDITY_STRESS':
      return <Activity size={16} className="text-cyan-500" />;
    case 'RATE_SHOCK_UP':
      return <TrendingUp size={16} className="text-rose-500" />;
    case 'RATE_SHOCK_DOWN':
      return <TrendingDown size={16} className="text-emerald-500" />;
    default:
      return <Activity size={16} className="text-[var(--nfq-text-muted)]" />;
  }
}

export const MacroScenarioPicker: React.FC<MacroScenarioPickerProps> = ({
  activeScenarioId,
  onSelectScenario,
}) => {
  const scenarios = Object.values(MACRO_SCENARIOS);

  return (
    <section className="rounded-[14px] border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-6">
      <header className="mb-5">
        <h2 className="text-base font-semibold text-[var(--nfq-text-primary)]">
          Escenarios de stress EBA
        </h2>
        <p className="mt-1 text-xs text-[var(--nfq-text-muted)]">
          Selecciona un escenario para aplicar los shocks al portfolio
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario}
            isActive={scenario.id === activeScenarioId}
            onSelect={onSelectScenario}
          />
        ))}
      </div>
    </section>
  );
};

interface ScenarioCardProps {
  scenario: MacroScenario;
  isActive: boolean;
  onSelect: (
    scenarioId: string,
    shocks: { interestRate: number; liquiditySpread: number },
  ) => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, isActive, onSelect }) => {
  const isBaseline = scenario.id === 'BASELINE';

  const baseClasses =
    'rounded-[14px] bg-[var(--nfq-bg-elevated)] p-4 border cursor-pointer transition-colors text-left w-full';
  const borderClasses = isBaseline
    ? 'border-dashed border-[var(--nfq-border-ghost)] hover:border-[var(--nfq-accent)]'
    : 'border-[var(--nfq-border-ghost)] hover:border-[var(--nfq-accent)]';
  const activeClasses = isActive
    ? 'ring-1 ring-[var(--nfq-accent)] border-[var(--nfq-accent)]'
    : '';

  const handleClick = () => {
    onSelect(scenario.id, toPricingShocks(scenario));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${baseClasses} ${borderClasses} ${activeClasses}`}
      aria-pressed={isActive}
    >
      <div className="flex items-center justify-between">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--nfq-text-muted)]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {scenario.id}
        </span>
        {getScenarioIcon(scenario.id)}
      </div>

      <div className="mt-2 text-sm font-bold text-[var(--nfq-text-primary)]">
        {scenario.label}
      </div>

      <p className="mt-1 text-xs text-[var(--nfq-text-muted)]">{scenario.description}</p>

      {isBaseline ? (
        <div
          className="mt-3 font-mono text-xs text-[var(--nfq-text-muted)]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Sin stress aplicado
        </div>
      ) : (
        <div
          className="mt-3 font-mono text-xs text-[var(--nfq-text-secondary)]"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          IR: {fmtBps(scenario.interestRateShift)} · HPI: {fmtPct(scenario.hpiShock)} · PD:{' '}
          {fmtMult(scenario.pdMultiplier)}
        </div>
      )}
    </button>
  );
};

export default MacroScenarioPicker;
