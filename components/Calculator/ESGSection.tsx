import React from 'react';
import type { Transaction } from '../../types';
import { InputGroup, SelectInput } from '../ui/LayoutComponents';
import {
  DEAL_GREEN_FORMAT_OPTIONS,
  DEAL_PHYSICAL_RISK_OPTIONS,
  DEAL_TRANSITION_RISK_OPTIONS,
} from './dealInputPanelUtils';
import type { translations } from '../../translations';

interface Props {
  values: Transaction;
  t: (typeof translations)['en'];
  onFieldInputChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof Transaction,
  ) => void;
  onBooleanChange: (field: keyof Transaction, value: boolean) => void;
}

export const ESGSection: React.FC<Props> = ({ values, t, onFieldInputChange, onBooleanChange }) => (
  <div className="grid grid-cols-2 gap-4">
    <InputGroup label={t.transitionRisk} tooltip={t.tooltip_calc_transitionRisk}>
      <SelectInput
        value={values.transitionRisk}
        onChange={(event) => onFieldInputChange(event, 'transitionRisk')}
      >
        {DEAL_TRANSITION_RISK_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectInput>
    </InputGroup>
    <InputGroup label={t.physicalRisk} tooltip={t.tooltip_calc_physicalRisk}>
      <SelectInput
        value={values.physicalRisk}
        onChange={(event) => onFieldInputChange(event, 'physicalRisk')}
      >
        {DEAL_PHYSICAL_RISK_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectInput>
    </InputGroup>
    <InputGroup label={t.greenFormat} tooltip={t.tooltip_calc_greenFormat}>
      <SelectInput
        value={values.greenFormat || 'None'}
        onChange={(event) => onFieldInputChange(event, 'greenFormat')}
      >
        {DEAL_GREEN_FORMAT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === 'None' ? t.noneOption : option.replace(/_/g, ' ')}
          </option>
        ))}
      </SelectInput>
    </InputGroup>
    <div className="flex flex-col gap-2 justify-center">
      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={values.dnshCompliant || false}
          onChange={(e) => onBooleanChange('dnshCompliant', e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
        />
        {t.dnshCompliant}
      </label>
      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={values.isfEligible || false}
          onChange={(e) => onBooleanChange('isfEligible', e.target.checked)}
          className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
        />
        {t.isfEligible}
      </label>
    </div>
  </div>
);
