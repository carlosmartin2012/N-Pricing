import React from 'react';
import { RefreshCw, RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { Button, SelectInput, TextInput } from '../ui/LayoutComponents';
import {
  AUDIT_ACTION_FAMILY_OPTIONS,
  type AuditFilters,
} from './auditLogUtils';

interface Props {
  filters: AuditFilters;
  filteredCount: number;
  totalCount: number;
  moduleOptions: string[];
  isLoading: boolean;
  onChange: (nextFilters: AuditFilters) => void;
  onRefresh: () => void;
  onReset: () => void;
  onGenerateTest: () => void;
}

export const AuditLogToolbar: React.FC<Props> = ({
  filters,
  filteredCount,
  totalCount,
  moduleOptions,
  isLoading,
  onChange,
  onRefresh,
  onReset,
  onGenerateTest,
}) => {
  return (
    <div className="border-b border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)]/80 px-4 py-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="nfq-label mb-1.5 block text-[9px]">Search Event Trail</label>
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--nfq-text-muted)]"
              />
              <TextInput
                value={filters.searchTerm}
                onChange={(event) => onChange({ ...filters, searchTerm: event.target.value })}
                placeholder="Search user, action, module, description, or payload"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="nfq-label mb-1.5 block text-[9px]">Module</label>
            <SelectInput
              value={filters.module}
              onChange={(event) => onChange({ ...filters, module: event.target.value })}
            >
              <option value="ALL">All Modules</option>
              {moduleOptions.map((module) => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
            </SelectInput>
          </div>

          <div>
            <label className="nfq-label mb-1.5 block text-[9px]">Action Family</label>
            <SelectInput
              value={filters.actionFamily}
              onChange={(event) =>
                onChange({
                  ...filters,
                  actionFamily: event.target.value as AuditFilters['actionFamily'],
                })
              }
            >
              {AUDIT_ACTION_FAMILY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--nfq-text-muted)]">
            Showing {filteredCount} of {totalCount} persisted events
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onGenerateTest}>
              <ShieldCheck size={12} />
              Generate Test Event
            </Button>
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw size={12} />
              Reset Filters
            </Button>
            <Button variant="primary" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
