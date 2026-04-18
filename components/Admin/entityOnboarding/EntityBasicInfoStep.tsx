import React from 'react';
import { Building2 } from 'lucide-react';
import { InputGroup, TextInput, SelectInput } from '../../ui/LayoutComponents';
import {
  COUNTRY_OPTIONS,
  CURRENCY_OPTIONS,
  normaliseShortCode,
  type BasicInfo,
} from './types';

interface Props {
  value: BasicInfo;
  onChange: (patch: Partial<BasicInfo>) => void;
}

export const EntityBasicInfoStep: React.FC<Props> = ({ value, onChange }) => (
  <div className="space-y-1">
    <div className="mb-6 flex items-center gap-3 rounded border border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] p-4">
      <Building2 size={20} className="text-amber-400" />
      <div>
        <p className="text-xs font-semibold text-[color:var(--nfq-text-primary)]">Basic Info</p>
        <p className="text-[10px] text-[color:var(--nfq-text-muted)]">
          Core identity fields for the new legal entity.
        </p>
      </div>
    </div>

    <InputGroup label="Entity Name *">
      <TextInput
        value={value.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="e.g. NFQ Iberia S.A."
        autoFocus
      />
    </InputGroup>

    <InputGroup label="Legal Name" hint="Optional — defaults to Entity Name">
      <TextInput
        value={value.legalName}
        onChange={(e) => onChange({ legalName: e.target.value })}
        placeholder="e.g. NFQ Iberia Sociedad Anónima"
      />
    </InputGroup>

    <div className="grid grid-cols-3 gap-4">
      <InputGroup label="Short Code *" hint="Max 6 chars">
        <TextInput
          value={value.shortCode}
          onChange={(e) => onChange({ shortCode: normaliseShortCode(e.target.value) })}
          placeholder="NFQIB"
          maxLength={6}
          className="font-mono uppercase"
        />
      </InputGroup>

      <InputGroup label="Country">
        <SelectInput
          value={value.country}
          onChange={(e) => onChange({ country: e.target.value })}
        >
          {COUNTRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectInput>
      </InputGroup>

      <InputGroup label="Base Currency">
        <SelectInput
          value={value.baseCurrency}
          onChange={(e) => onChange({ baseCurrency: e.target.value })}
        >
          {CURRENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </SelectInput>
      </InputGroup>
    </div>
  </div>
);
