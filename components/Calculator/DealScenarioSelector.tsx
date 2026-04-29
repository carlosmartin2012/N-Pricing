import React from 'react';
import { FileSearch } from 'lucide-react';
import type { ClientEntity, Transaction } from '../../types';
import { Badge, InputGroup, SelectInput } from '../ui/LayoutComponents';
import type { Language } from '../../translations';
import { getTranslations } from '../../translations';
import DealLockBadge from '../Deals/DealLockBadge';

interface Props {
  values: Transaction;
  deals: Transaction[];
  clients: ClientEntity[];
  clientDisplayName: string;
  language: Language;
  onTransactionSelect: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export const DealScenarioSelector: React.FC<Props> = ({
  values,
  deals,
  clients,
  clientDisplayName,
  language,
  onTransactionSelect,
}) => {
  const t = getTranslations(language);
  const selectedClient = clients.find((client) => client.id === values.clientId);
  const hasCurrentDeal = Boolean(values.id);

  return (
    <div className="border-b border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
      <InputGroup label={t.activeScenario}>
        <div className="relative">
          <FileSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600 dark:text-cyan-400"
          />
          <SelectInput
            value={hasCurrentDeal ? values.id : 'NEW'}
            onChange={onTransactionSelect}
            className="border-cyan-500/25 bg-[var(--nfq-bg-input)] pl-9 font-bold text-cyan-400 focus:border-cyan-400"
          >
            <option value="NEW">{t.newDeal}</option>
            {deals.map((deal) => (
              <option key={deal.id} value={deal.id}>
                {deal.id} - {deal.clientId} ({deal.productType})
              </option>
            ))}
          </SelectInput>
        </div>
      </InputGroup>

      <div className="mt-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Badge variant="default">{clientDisplayName}</Badge>
          <span className="text-xs text-[color:var(--nfq-text-muted)]">
            {selectedClient?.type || values.clientType}
          </span>
          {/* Soft-lock indicator (Ola 7 Bloque B.3): only visible when
              another user is currently on the same deal — otherwise
              renders null, so the metadata row stays clean for the
              normal solo-edit flow. */}
          <DealLockBadge dealId={values.id} variant="chip" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default">{values.productType || t.noProduct}</Badge>
          <Badge variant={values.currency === 'USD' ? 'success' : 'warning'}>
            {values.currency}
          </Badge>
        </div>
      </div>
    </div>
  );
};
