import React, { useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Panel, SelectInput } from '../ui/LayoutComponents';
import { useData } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { usePricingContext } from '../../hooks/usePricingContext';
import { AccountingEntryDetail } from './AccountingEntryDetail';
import { AccountingLedgerTable } from './AccountingLedgerTable';
import { AccountingSummaryCard } from './AccountingSummaryCard';
import { buildLedgerEntries, summarizeLedgerEntries } from './accountingLedgerUtils';

const AccountingLedger: React.FC = () => {
  const { t } = useUI();
  const data = useData();
  const pricingContext = usePricingContext();

  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const ledgerEntries = useMemo(
    () =>
      buildLedgerEntries(
        data.deals,
        data.approvalMatrix,
        pricingContext,
        data.businessUnits,
        data.products,
      ),
    [
      data.deals,
      data.approvalMatrix,
      pricingContext,
      data.businessUnits,
      data.products,
    ],
  );

  const businessUnitNames = useMemo(() => {
    const names = new Set(ledgerEntries.map((entry) => entry.unit));
    return Array.from(names).sort();
  }, [ledgerEntries]);

  const filteredLedger = useMemo(
    () =>
      selectedUnit === 'ALL'
        ? ledgerEntries
        : ledgerEntries.filter((entry) => entry.unit === selectedUnit),
    [selectedUnit, ledgerEntries],
  );

  const ledgerSummary = useMemo(
    () => summarizeLedgerEntries(filteredLedger),
    [filteredLedger],
  );

  const activeEntry = useMemo(() => {
    if (!filteredLedger.length) {
      return undefined;
    }

    return (
      filteredLedger.find((entry) => entry.id === selectedEntryId) ||
      filteredLedger[0]
    );
  }, [filteredLedger, selectedEntryId]);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex h-32 flex-col gap-4 md:h-24 md:flex-row">
        <div className="flex w-full flex-col justify-center rounded border border-slate-800 bg-slate-900 p-4 shadow md:w-1/4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase text-slate-500">
            <Building2 size={12} /> {t.businessUnitView}
          </div>
          <SelectInput
            value={selectedUnit}
            onChange={(event) => {
              setSelectedUnit(event.target.value);
              setSelectedEntryId(null);
            }}
            className="w-full"
          >
            <option value="ALL">{t.globalConsolidated}</option>
            {businessUnitNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </SelectInput>
        </div>

        <div className="grid w-full grid-cols-2 rounded border border-slate-800 bg-slate-900 p-4 shadow md:w-3/4 md:grid-cols-4 md:divide-x md:divide-slate-800">
          <AccountingSummaryCard
            title={t.assetsLoans}
            emptyLabel={t.noLoanExposure}
            breakdown={ledgerSummary.assets}
            accentClassName="text-emerald-400"
          />
          <AccountingSummaryCard
            title={t.liabilitiesDeposits}
            emptyLabel={t.noDepositExposure}
            breakdown={ledgerSummary.liabilities}
            accentClassName="text-rose-400"
          />
          <AccountingSummaryCard
            title={t.commitments}
            emptyLabel={t.noOffBalanceExposure}
            breakdown={ledgerSummary.commitments}
            accentClassName="text-indigo-400"
          />
          <AccountingSummaryCard
            title={t.annFtpIncome}
            emptyLabel={t.noFtpIncome}
            breakdown={ledgerSummary.ftpIncome}
            accentClassName="text-cyan-400"
          />
        </div>
      </div>

      <Panel
        title={`FTP Ledger — ${selectedUnit === 'ALL' ? t.consolidated : selectedUnit}`}
        className="min-h-[250px] flex-1"
      >
        <AccountingLedgerTable
          entries={filteredLedger}
          activeEntryId={activeEntry?.id}
          onSelectEntry={setSelectedEntryId}
        />
      </Panel>

      {activeEntry && <AccountingEntryDetail entry={activeEntry} />}
    </div>
  );
};

export default AccountingLedger;
