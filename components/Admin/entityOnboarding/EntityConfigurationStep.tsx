import React from 'react';
import { Settings } from 'lucide-react';
import { InputGroup, TextInput, SelectInput } from '../../ui/LayoutComponents';
import { TIMEZONE_OPTIONS, type ConfigState } from './types';

interface Props {
  value: ConfigState;
  onChange: (patch: Partial<ConfigState>) => void;
}

export const EntityConfigurationStep: React.FC<Props> = ({ value, onChange }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3 rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
      <Settings size={20} className="text-amber-400" />
      <div>
        <p className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">Configuration</p>
        <p className="text-[10px] text-[color:var(--nfq-text-muted)]">
          Approval matrix thresholds and operational timezone.
        </p>
      </div>
    </div>

    <div className="rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
      <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-[color:var(--nfq-text-faint)]">
        Approval Matrix
      </p>
      <div className="grid grid-cols-3 gap-4">
        <InputGroup label="Auto-Approval (€)" hint="Below → auto">
          <TextInput
            type="number"
            value={value.autoApproval}
            onChange={(e) => onChange({ autoApproval: e.target.value })}
            min="0"
            step="100000"
            className="font-mono"
          />
        </InputGroup>
        <InputGroup label="L1 Threshold (€)" hint="Requires L1">
          <TextInput
            type="number"
            value={value.l1}
            onChange={(e) => onChange({ l1: e.target.value })}
            min="0"
            step="500000"
            className="font-mono"
          />
        </InputGroup>
        <InputGroup label="L2 Threshold (€)" hint="Requires L2">
          <TextInput
            type="number"
            value={value.l2}
            onChange={(e) => onChange({ l2: e.target.value })}
            min="0"
            step="1000000"
            className="font-mono"
          />
        </InputGroup>
      </div>
      <p className="mt-2 text-[10px] text-[color:var(--nfq-text-faint)]">
        Auto ≤ amount → auto-approved · Auto &lt; amount ≤ L1 → L1 review · L1 &lt; amount ≤
        L2 → L2 review
      </p>
    </div>

    <InputGroup label="Timezone">
      <SelectInput
        value={value.timezone}
        onChange={(e) => onChange({ timezone: e.target.value })}
      >
        {TIMEZONE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </SelectInput>
    </InputGroup>
  </div>
);
