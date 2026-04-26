import React from 'react';
import {
  InputGroup,
  SelectInput,
  TextInput,
} from '../../ui/LayoutComponents';
import { TooltipTrigger } from '../../ui/Tooltip';
import type {
  BusinessUnit,
  FormulaBaseRateKey,
  FormulaLPType,
  FtpRateCard,
  GeneralRule,
} from '../../../types';
import { useUI } from '../../../contexts/UIContext';
import {
  AVAILABLE_BASE_CURVES,
  GENERAL_RULE_PRODUCT_OPTIONS,
  GENERAL_RULE_SEGMENT_OPTIONS,
  GENERAL_RULE_TENOR_OPTIONS,
} from './generalRulesUtils';

interface Props {
  editingRule: Partial<GeneralRule>;
  businessUnits: BusinessUnit[];
  ftpRateCards: FtpRateCard[];
  onChange: (updates: Partial<GeneralRule>) => void;
}

const DEFAULT_FORMULA_SPEC = {
  baseRateKey: 'DTM' as FormulaBaseRateKey,
  lpFormula: 'LP_DTM' as FormulaLPType,
  lpCurveType: 'unsecured' as const,
  sign: 1 as 1 | -1,
};

const GeneralRuleEditor: React.FC<Props> = ({
  editingRule,
  businessUnits,
  ftpRateCards,
  onChange,
}) => {
  const { t } = useUI();

  const updateFormulaSpec = (updates: Partial<NonNullable<GeneralRule['formulaSpec']>>) => {
    onChange({
      formulaSpec: {
        ...DEFAULT_FORMULA_SPEC,
        ...editingRule.formulaSpec,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-4">
      <InputGroup label="Business Unit">
        <SelectInput
          value={editingRule.businessUnit}
          onChange={(event) => onChange({ businessUnit: event.target.value })}
        >
          {businessUnits.map(unit => (
            <option key={unit.id} value={unit.name}>
              {unit.name}
            </option>
          ))}
          <option value="All">All Units</option>
        </SelectInput>
      </InputGroup>

      <InputGroup label="Product Type">
        <SelectInput
          value={editingRule.product}
          onChange={(event) => onChange({ product: event.target.value })}
        >
          {GENERAL_RULE_PRODUCT_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
      </InputGroup>

      <InputGroup label="Segment">
        <SelectInput
          value={editingRule.segment}
          onChange={(event) => onChange({ segment: event.target.value })}
        >
          {GENERAL_RULE_SEGMENT_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
      </InputGroup>

      <InputGroup label="Tenor Logic" tooltip={t.tooltip_config_tenorLogic}>
        <SelectInput
          value={editingRule.tenor}
          onChange={(event) => onChange({ tenor: event.target.value })}
        >
          {GENERAL_RULE_TENOR_OPTIONS.map(option => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </SelectInput>
      </InputGroup>

      <div className="my-4 rounded border border-slate-800 bg-slate-900 p-3">
        <h5 className="mb-2 flex items-center text-[10px] font-bold uppercase text-slate-500">Base Method<TooltipTrigger content={t.tooltip_config_baseMethod} size={11} /></h5>
        <div className="mb-3 space-y-2">
          {['Matched Maturity', 'Rate Card', 'Moving Average'].map(method => (
            <label key={method} className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="radio"
                checked={editingRule.baseMethod === method}
                onChange={() => onChange({ baseMethod: method })}
              />
              {method === 'Matched Maturity'
                ? 'Matched Maturity (Standard)'
                : method === 'Rate Card'
                  ? 'Rate Card / Grid Pricing'
                  : 'Moving Average (Smoothed)'}
            </label>
          ))}
        </div>

        <InputGroup label="Base Reference Curve">
          <SelectInput
            value={editingRule.baseReference}
            onChange={(event) => onChange({ baseReference: event.target.value })}
          >
            {AVAILABLE_BASE_CURVES.map(curve => (
              <option key={curve} value={curve}>
                {curve}
              </option>
            ))}
          </SelectInput>
        </InputGroup>
      </div>

      <div className="my-4 rounded border border-slate-800 bg-slate-900 p-3">
        <h5 className="mb-2 text-[10px] font-bold uppercase text-slate-500">Liquidity / Spread Method</h5>
        <div className="mb-3 space-y-2">
          {['Curve Lookup', 'Fixed Spread', 'Grid Pricing', 'Dynamic Beta'].map(method => (
            <label key={method} className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input
                type="radio"
                checked={editingRule.spreadMethod === method}
                onChange={() => onChange({ spreadMethod: method })}
              />
              {method === 'Curve Lookup'
                ? 'Curve Lookup (Standard)'
                : method === 'Fixed Spread'
                  ? 'Fixed Spread (Flat)'
                  : method === 'Grid Pricing'
                    ? 'Grid Pricing (Tenor/Credit)'
                    : 'Dynamic Beta'}
            </label>
          ))}
        </div>

        <InputGroup label="Liquidity Reference">
          <SelectInput
            value={editingRule.liquidityReference}
            onChange={(event) => onChange({ liquidityReference: event.target.value })}
          >
            <option value="">-- Select Liquidity Curve --</option>
            {ftpRateCards.filter(card => card.type === 'Liquidity').map(card => (
              <option key={card.id} value={card.id}>
                {card.name} ({card.currency})
              </option>
            ))}
          </SelectInput>
        </InputGroup>
      </div>

      <div className="my-4 rounded border border-indigo-800/50 bg-indigo-950/30 p-3">
        <h5 className="mb-2 text-[11px] font-medium text-indigo-400">Product Formula (V5.0)</h5>
        <div className="space-y-3">
          <InputGroup label="Base Rate Key">
            <SelectInput
              value={editingRule.formulaSpec?.baseRateKey || DEFAULT_FORMULA_SPEC.baseRateKey}
              onChange={(event) => updateFormulaSpec({ baseRateKey: event.target.value as FormulaBaseRateKey })}
            >
              <option value="DTM">DTM (Contractual Maturity)</option>
              <option value="BM">BM (Behavioral Maturity)</option>
              <option value="RM">RM (Repricing Maturity)</option>
              <option value="MIN_BM_RM">min(BM, RM)</option>
            </SelectInput>
          </InputGroup>

          <InputGroup label="LP Formula" tooltip={t.tooltip_config_lpFormula}>
            <SelectInput
              value={editingRule.formulaSpec?.lpFormula || DEFAULT_FORMULA_SPEC.lpFormula}
              onChange={(event) => updateFormulaSpec({ lpFormula: event.target.value as FormulaLPType })}
            >
              <option value="LP_DTM">LP(DTM) — Standard</option>
              <option value="LP_BM">LP(BM) — Behavioral</option>
              <option value="50_50_DTM_1Y">50% LP(DTM) + 50% LP(1Y) — NSFR Floor</option>
              <option value="SECURED_LP">Secured LP — Collateral Adjusted</option>
              <option value="BLENDED">Blended LP — SDR Modulated</option>
            </SelectInput>
          </InputGroup>

          <InputGroup label="LP Curve Type">
            <SelectInput
              value={editingRule.formulaSpec?.lpCurveType || DEFAULT_FORMULA_SPEC.lpCurveType}
              onChange={(event) => updateFormulaSpec({ lpCurveType: event.target.value as 'unsecured' | 'secured' })}
            >
              <option value="unsecured">Unsecured</option>
              <option value="secured">Secured</option>
            </SelectInput>
          </InputGroup>

          <InputGroup label="Sign (Asset/Liability)">
            <SelectInput
              value={String(editingRule.formulaSpec?.sign ?? DEFAULT_FORMULA_SPEC.sign)}
              onChange={(event) => updateFormulaSpec({ sign: parseInt(event.target.value, 10) as 1 | -1 })}
            >
              <option value="1">+1 (Asset — LP charged)</option>
              <option value="-1">-1 (Liability — LP benefit)</option>
            </SelectInput>
          </InputGroup>
        </div>
      </div>

      <InputGroup label="Strategic Spread (bps)" tooltip={t.tooltip_config_strategicSpread}>
        <TextInput
          type="number"
          value={editingRule.strategicSpread}
          onChange={(event) => onChange({ strategicSpread: Number(event.target.value) || 0 })}
        />
      </InputGroup>
    </div>
  );
};

export default GeneralRuleEditor;
