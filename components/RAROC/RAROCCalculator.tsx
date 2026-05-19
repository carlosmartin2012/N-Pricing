import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Info,
    PieChart,
    Settings,
    Shield,
    Zap,
} from 'lucide-react';
import { Panel, Badge } from '../ui/LayoutComponents';
import { RAROCInputs } from '../../types';
import { saveRarocInputs } from '../../api/config';
import { useData } from '../../contexts/DataContext';
import { RAROCBreakdownPanel } from './RAROCBreakdownPanel';
import { RAROCInputSection } from './RAROCInputSection';
import { createLogger } from '../../utils/logger';

const logger = createLogger('RAROCCalculator');
import { RAROCMetricCard } from './RAROCMetricCard';
import {
    INITIAL_RAROC_INPUTS,
    RAROC_INPUT_SECTIONS,
    areRarocInputsEqual,
    buildCapitalBreakdown,
    buildCommercialBreakdown,
    buildRarocMetricCards,
    buildRarocResults,
    buildRevenueBreakdown,
    buildUpdatedRarocInputs,
    formatRarocCurrency,
    formatRarocPercent,
    normalizeRarocInputs,
    type EditableRarocField,
} from './rarocCalculatorUtils';

const RAROCCalculator: React.FC = () => {
    const { rarocInputs: externalInputs, setRarocInputs } = useData();
    const onUpdateExternal = useCallback((inputs: RAROCInputs) => {
        setRarocInputs(inputs);
        saveRarocInputs(inputs).catch((err) => logger.error('Failed to save RAROC inputs', undefined, err));
    }, [setRarocInputs]);
    const [inputs, setInputs] = useState<RAROCInputs>(() => normalizeRarocInputs(externalInputs || INITIAL_RAROC_INPUTS));
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        if (!externalInputs) return;
        const normalizedInputs = normalizeRarocInputs(externalInputs);
        setInputs((prev) => (areRarocInputsEqual(prev, normalizedInputs) ? prev : normalizedInputs));
    }, [externalInputs]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const queueExternalUpdate = useCallback((nextInputs: RAROCInputs) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            onUpdateExternal(nextInputs);
        }, 600);
    }, [onUpdateExternal]);

    const handleInputChange = useCallback((key: EditableRarocField, value: number) => {
        setInputs((prev) => {
            const nextInputs = buildUpdatedRarocInputs(prev, key, value);
            queueExternalUpdate(nextInputs);
            return nextInputs;
        });
    }, [queueExternalUpdate]);

    const results = useMemo(() => buildRarocResults(inputs), [inputs]);
    const metricCards = useMemo(() => buildRarocMetricCards(inputs, results), [inputs, results]);
    const revenueRows = useMemo(() => buildRevenueBreakdown(inputs, results), [inputs, results]);
    const capitalRows = useMemo(() => buildCapitalBreakdown(inputs, results), [inputs, results]);
    const commercialRows = useMemo(() => buildCommercialBreakdown(inputs, results), [inputs, results]);

    return (
        <div className="flex flex-col gap-4 p-2 animate-in fade-in duration-500">
            {/* Discrete eyebrow — model + transaction context without the
                meta-status posturing. Detail moved out of permanent strip. */}
            <div className="nfq-eyebrow text-[color:var(--nfq-text-tertiary)]">
                <span>Basel III · Model v4.2 · Tx&nbsp;</span>
                <span className="font-mono text-[color:var(--nfq-text-secondary)]">{inputs.transactionId}</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 xl:items-start">
                <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-2 xl:self-start xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
                    <Panel title="Configuration Inputs" icon={<Settings size={18} className="text-[color:var(--nfq-accent)]" />}>
                        <div className="space-y-6 p-2">
                            {RAROC_INPUT_SECTIONS.map((section) => (
                                <RAROCInputSection
                                    key={section.id}
                                    section={section}
                                    inputs={inputs}
                                    onChange={handleInputChange}
                                />
                            ))}

                            <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-accent)]/15 bg-[var(--nfq-accent-subtle)] p-4">
                                <div className="flex items-center gap-2 text-[color:var(--nfq-accent)]">
                                    <Info size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.22em]">
                                        Pricing Relationship
                                    </span>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-[color:var(--nfq-text-muted)]">
                                    The calculator now uses the shared RAROC engine. Commercial spread stays aligned with
                                    client rate and FTP so the dashboard and pricing engine read the same economics.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="outline">Client {formatRarocPercent(inputs.interestRate)}</Badge>
                                    <Badge variant="outline">FTP {formatRarocPercent(inputs.cofRate)}</Badge>
                                    <Badge variant="success">Spread {formatRarocPercent(inputs.interestSpread)}</Badge>
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>

                <div className="xl:col-span-8 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {metricCards.map((card) => (
                            <RAROCMetricCard key={card.title} {...card} />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <RAROCBreakdownPanel
                            title="Revenue & Costs"
                            icon={<Zap size={16} className="text-[color:var(--nfq-warning)]" />}
                            rows={revenueRows}
                            totalLabel="Risk-Adjusted Return"
                            totalValue={formatRarocCurrency(results.riskAdjustedReturn)}
                            totalToneClass={results.riskAdjustedReturn >= 0 ? 'text-[color:var(--nfq-accent)]' : 'text-[color:var(--nfq-danger)]'}
                        />

                        <RAROCBreakdownPanel
                            title="Capital Structure"
                            icon={<PieChart size={16} className="text-[color:var(--nfq-cat-d)]" />}
                            rows={capitalRows}
                            totalLabel="Total Regulatory Capital"
                            totalValue={formatRarocCurrency(results.totalRegCapital)}
                            totalToneClass="text-[color:var(--nfq-cat-d)]"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <RAROCBreakdownPanel
                            title="Commercial Stack"
                            icon={<Shield size={16} className="text-[color:var(--nfq-accent)]" />}
                            rows={commercialRows}
                            totalLabel="RAROC Buffer vs Hurdle"
                            totalValue={formatRarocPercent(results.eva)}
                            totalToneClass={results.eva >= 0 ? 'text-[color:var(--nfq-success)]' : 'text-[color:var(--nfq-danger)]'}
                        />

                        <div className="bg-[var(--nfq-accent-subtle)] border border-[color:var(--nfq-accent)]/20 rounded-[var(--nfq-radius-card)] p-4 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-[color:var(--nfq-accent)]">
                                <Info size={16} />
                                <h5 className="text-xs font-medium">Methodology Note</h5>
                            </div>
                            <p className="text-xs text-[color:var(--nfq-text-muted)] font-mono leading-relaxed">
                                RAROC = (Spread Revenue + Fees − FTP − ECL − OpCost + Capital Income) / Total Regulatory Capital
                            </p>
                            <p className="text-xs leading-relaxed text-[color:var(--nfq-text-muted)]">
                                Capital income is now computed from the same engine used by pricing, and spread revenue is
                                derived from commercial spread instead of duplicating a separate client-rate formula.
                            </p>
                            <div className="mt-auto rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-root)]/40 p-4">
                                <div className="nfq-label">Current Margin Stack</div>
                                <div className="mt-3 flex items-end justify-between gap-4">
                                    <div>
                                        <div className="nfq-label text-[10px]">Spread</div>
                                        <div className="font-mono-nums text-2xl font-bold text-[color:var(--nfq-accent)]">
                                            {formatRarocPercent(inputs.interestSpread)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="nfq-label text-[10px]">Return Buffer</div>
                                        <div className={`font-mono-nums text-2xl font-bold ${results.eva >= 0 ? 'text-[color:var(--nfq-success)]' : 'text-[color:var(--nfq-danger)]'}`}>
                                            {formatRarocPercent(results.eva)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RAROCCalculator;
