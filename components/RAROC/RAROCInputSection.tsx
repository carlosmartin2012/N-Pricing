import React from 'react';
import type { RAROCInputs } from '../../types';
import type { EditableRarocField, NumericFieldType, RarocInputSectionConfig } from './rarocCalculatorUtils';

interface FieldProps {
  label: string;
  value: number;
  type: NumericFieldType;
  onChange: (value: number) => void;
}

const RAROCInputField: React.FC<FieldProps> = ({ label, value, type, onChange }) => (
  <div className="flex flex-col gap-1.5">
    <label className="nfq-label text-[9px]">
      {label}
    </label>
    <div className="group relative">
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl border border-[color:var(--nfq-border-ghost)] bg-slate-950/70 px-3 py-2 text-xs font-mono text-[color:var(--nfq-text-primary)] outline-none transition-all group-hover:border-white/20 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase text-[color:var(--nfq-text-muted)]">
        {type === 'currency' ? '$' : '%'}
      </span>
    </div>
  </div>
);

interface Props {
  section: RarocInputSectionConfig;
  inputs: RAROCInputs;
  onChange: (key: EditableRarocField, value: number) => void;
}

export const RAROCInputSection: React.FC<Props> = ({ section, inputs, onChange }) => {
  return (
    <div className="space-y-3">
      <div className="border-b border-white/5 pb-2">
        <h4 className="text-[10px] font-black uppercase tracking-[0.24em] text-[color:var(--nfq-text-muted)]">
          {section.title}
        </h4>
        <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--nfq-text-muted)]">
          {section.description}
        </p>
      </div>

      <div className={`grid gap-4 ${section.columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {section.fields.map((field) => (
          <RAROCInputField
            key={field.key}
            label={field.label}
            value={inputs[field.key]}
            type={field.type}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </div>
  );
};
