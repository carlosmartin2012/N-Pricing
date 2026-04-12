import React from 'react';
import type { Transaction } from '../../types';
import { InputGroup, TextInput } from '../ui/LayoutComponents';
import type { translations } from '../../translations';

interface Props {
  values: Transaction;
  t: (typeof translations)['en'];
  onFieldInputChange: (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    field: keyof Transaction,
  ) => void;
}

const Section: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={`grid gap-4 pb-4 border-b border-slate-800/50 ${className ?? 'grid-cols-2'}`}>
    {children}
  </div>
);

export const RegulatorySection: React.FC<Props> = ({ values, t, onFieldInputChange }) => (
  <Section>
    <InputGroup label={t.riskWeight} tooltip={t.tooltip_calc_riskWeight}>
      <TextInput
        type="number"
        value={values.riskWeight}
        onChange={(event) => onFieldInputChange(event, 'riskWeight')}
      />
    </InputGroup>
    <InputGroup label={t.targetRoe} tooltip={t.tooltip_calc_targetRoe}>
      <TextInput
        type="number"
        value={values.targetROE}
        onChange={(event) => onFieldInputChange(event, 'targetROE')}
      />
    </InputGroup>
    <InputGroup label={t.capitalRatio} tooltip={t.tooltip_calc_capitalRatio}>
      <TextInput
        type="number"
        step="0.1"
        value={values.capitalRatio}
        onChange={(event) => onFieldInputChange(event, 'capitalRatio')}
      />
    </InputGroup>
    <InputGroup label={t.opCost}>
      <TextInput
        type="number"
        value={values.operationalCostBps}
        onChange={(event) => onFieldInputChange(event, 'operationalCostBps')}
      />
    </InputGroup>
    <InputGroup label={t.lcrOutflow} tooltip={t.tooltip_calc_lcrOutflow}>
      <TextInput
        type="number"
        value={values.lcrOutflowPct || 0}
        onChange={(event) => onFieldInputChange(event, 'lcrOutflowPct')}
      />
    </InputGroup>
  </Section>
);
