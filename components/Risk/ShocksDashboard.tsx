import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logAudit } from '../../api/audit';
import type { Transaction } from '../../types';
import { DEFAULT_PRICING_SHOCKS, calculatePricing, type PricingShocks } from '../../utils/pricingEngine';
import { downloadTemplate, parseExcel } from '../../utils/excelUtils';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { usePricingContext } from '../../hooks/usePricingContext';
import { createLogger } from '../../utils/logger';
import { ShockControlPanel } from './ShockControlPanel';
import { ShockImpactPanel } from './ShockImpactPanel';
import { parseImportedShocks } from './shockUtils';
import { MacroScenarioPicker } from './MacroScenarioPicker';

const log = createLogger('ShocksDashboard');

interface Props {
  deal: Transaction;
}

const ShocksDashboard: React.FC<Props> = ({ deal }) => {
  const { currentUser: user } = useAuth();
  const { approvalMatrix, shocks, setShocks } = useData();
  const { language } = useUI();
  const pricingContext = usePricingContext();
  const auditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAuditDescriptionRef = useRef<string | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | undefined>(undefined);

  const flushShockAudit = useCallback(() => {
    const pendingDescription = pendingAuditDescriptionRef.current;
    if (!pendingDescription) return;

    pendingAuditDescriptionRef.current = null;
    void logAudit({
      userEmail: user?.email || 'unknown',
      userName: user?.name || 'Unknown User',
      action: 'APPLY_SHOCK',
      module: 'SHOCKS',
      description: pendingDescription,
    });
  }, [user]);

  const logShockAudit = useCallback(
    (description: string) => {
      if (auditTimerRef.current) {
        clearTimeout(auditTimerRef.current);
      }

      pendingAuditDescriptionRef.current = description;
      auditTimerRef.current = setTimeout(() => {
        flushShockAudit();
        auditTimerRef.current = null;
      }, 500);
    },
    [flushShockAudit],
  );

  useEffect(() => {
    return () => {
      if (auditTimerRef.current) {
        clearTimeout(auditTimerRef.current);
        auditTimerRef.current = null;
        flushShockAudit();
      }
    };
  }, [flushShockAudit]);

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
    setActiveScenarioId(undefined);
  }, [setShocks]);

  const handleSelectMacroScenario = useCallback(
    (scenarioId: string, scenarioShocks: { interestRate: number; liquiditySpread: number }) => {
      setShocks(scenarioShocks);
      setActiveScenarioId(scenarioId);
      logShockAudit(
        `Applied macro scenario ${scenarioId} (IR ${scenarioShocks.interestRate}bps / Liq ${scenarioShocks.liquiditySpread}bps) for deal ${deal.id || 'NEW-DEAL'}`,
      );
    },
    [setShocks, logShockAudit, deal.id],
  );

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
        log.error('Error importing shocks', {}, error instanceof Error ? error : undefined);
        alert('Error al importar shocks. Verifique el formato del archivo.');
      } finally {
        event.target.value = '';
      }
    },
    [setShocks, logShockAudit, deal.id],
  );

  return (
    <div className="flex h-full flex-col gap-6">
      {/* Macro scenario picker (EBA-style) */}
      <MacroScenarioPicker
        activeScenarioId={activeScenarioId}
        onSelectScenario={handleSelectMacroScenario}
      />

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-12">
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
    </div>
  );
};

export default ShocksDashboard;
