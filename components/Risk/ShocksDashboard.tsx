import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ApprovalMatrixConfig, Transaction, UserProfile } from '../../types';
import { DEFAULT_PRICING_SHOCKS, calculatePricing, type PricingShocks } from '../../utils/pricingEngine';
import { supabaseService } from '../../utils/supabaseService';
import { downloadTemplate, parseExcel } from '../../utils/excelUtils';
import { usePricingContext } from '../../hooks/usePricingContext';
import type { Language } from '../../translations';
import { ShockControlPanel } from './ShockControlPanel';
import { ShockImpactPanel } from './ShockImpactPanel';
import { parseImportedShocks } from './shockUtils';

interface Props {
  deal: Transaction;
  approvalMatrix: ApprovalMatrixConfig;
  language: Language;
  shocks: PricingShocks;
  setShocks: (shocks: PricingShocks) => void;
  user: UserProfile | null;
}

const ShocksDashboard: React.FC<Props> = ({
  deal,
  approvalMatrix,
  language,
  shocks,
  setShocks,
  user,
}) => {
  const pricingContext = usePricingContext();
  const auditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logShockAudit = useCallback(
    (description: string) => {
      if (auditTimerRef.current) {
        clearTimeout(auditTimerRef.current);
      }

      auditTimerRef.current = setTimeout(() => {
        supabaseService.addAuditEntry({
          userEmail: user?.email || 'unknown',
          userName: user?.name || 'Unknown User',
          action: 'APPLY_SHOCK',
          module: 'SHOCKS',
          description,
        });
      }, 500);
    },
    [user],
  );

  useEffect(() => {
    return () => {
      if (auditTimerRef.current) {
        clearTimeout(auditTimerRef.current);
      }
    };
  }, []);

  const baseResult = useMemo(
    () => calculatePricing(deal, approvalMatrix, pricingContext, DEFAULT_PRICING_SHOCKS),
    [deal, approvalMatrix, pricingContext],
  );

  const shockedResult = useMemo(
    () => calculatePricing(deal, approvalMatrix, pricingContext, shocks),
    [deal, approvalMatrix, pricingContext, shocks],
  );

  const updateShock = useCallback(
    (key: keyof PricingShocks, value: number) => {
      setShocks({ ...shocks, [key]: value });
      logShockAudit(
        `Adjusted ${key === 'interestRate' ? 'Interest Rate' : 'Liquidity Spread'} shock to ${value}bps for deal ${deal.id || 'NEW-DEAL'}`,
      );
    },
    [shocks, setShocks, logShockAudit, deal.id],
  );

  const applyPreset = useCallback(
    (nextShocks: PricingShocks) => {
      setShocks(nextShocks);
      logShockAudit(
        `Applied preset shocks IR ${nextShocks.interestRate}bps / Liq ${nextShocks.liquiditySpread}bps for deal ${deal.id || 'NEW-DEAL'}`,
      );
    },
    [setShocks, logShockAudit, deal.id],
  );

  const handleReset = useCallback(() => {
    setShocks(DEFAULT_PRICING_SHOCKS);
  }, [setShocks]);

  const handleDownloadTemplate = useCallback(
    async () => downloadTemplate('STRESS_TESTING', 'Stress_Testing_Template'),
    [],
  );

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const rows = await parseExcel(file);
        const importedShocks = parseImportedShocks(rows);

        if (importedShocks) {
          setShocks(importedShocks);
          logShockAudit(
            `Imported shocks IR ${importedShocks.interestRate}bps / Liq ${importedShocks.liquiditySpread}bps for deal ${deal.id || 'NEW-DEAL'}`,
          );
          alert(
            `Shocks imported: IR ${importedShocks.interestRate}bps, Liq ${importedShocks.liquiditySpread}bps`,
          );
        }
      } catch (error) {
        console.error('Error importing shocks:', error);
        alert('Error al importar shocks. Verifique el formato del archivo.');
      } finally {
        event.target.value = '';
      }
    },
    [setShocks, logShockAudit, deal.id],
  );

  return (
    <div className="flex h-full flex-col gap-6 lg:grid lg:grid-cols-12">
      <div className="h-full lg:col-span-4">
        <ShockControlPanel
          deal={deal}
          shocks={shocks}
          language={language}
          onShockChange={updateShock}
          onReset={handleReset}
          onDownloadTemplate={handleDownloadTemplate}
          onImport={handleImport}
          onApplyPreset={applyPreset}
        />
      </div>

      <div className="h-full lg:col-span-8">
        <ShockImpactPanel
          language={language}
          baseResult={baseResult}
          shockedResult={shockedResult}
        />
      </div>
    </div>
  );
};

export default ShocksDashboard;
