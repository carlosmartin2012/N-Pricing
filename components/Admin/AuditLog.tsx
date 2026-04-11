import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';
import * as auditApi from '../../api/audit';
import { mapAuditFromDB } from '../../api/mappers';
import { AuditEntry } from '../../types';
import { supabase } from '../../utils/supabaseClient';
import { Panel } from '../ui/LayoutComponents';
import { AuditEntryDrawer } from './AuditEntryDrawer';
import { AuditLogTable } from './AuditLogTable';
import { AuditLogToolbar } from './AuditLogToolbar';
import {
    DEFAULT_AUDIT_FILTERS,
    filterAuditEntries,
    getAuditModuleOptions,
    summarizeAuditEntries,
} from './auditLogUtils';

const PAGE_SIZE = 200;

const SummaryTile: React.FC<{
    label: string;
    value: number;
    toneClass: string;
}> = ({ label, value, toneClass }) => (
    <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] px-4 py-3">
        <div className="nfq-label">{label}</div>
        <div className={`mt-2 font-mono-nums text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
);

const AuditLog: React.FC = () => {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
    const [statusMsg, setStatusMsg] = useState('Conectando...');
    const [isLoading, setIsLoading] = useState(false);
    const [filters, setFilters] = useState(DEFAULT_AUDIT_FILTERS);
    const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
    const statusResetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        setStatus(status === 'error' ? 'connecting' : status);
        setStatusMsg('Cargando actividad...');
        try {
            const { data, total, errorMessage } = await auditApi.listAuditLogPaginated({ page: 1, pageSize: PAGE_SIZE });

            if (errorMessage) {
                setStatus('error');
                setStatusMsg(errorMessage);
            } else {
                setLogs(data);
                setTotalCount(total);
                setStatus('live');
                setStatusMsg('En vivo');
            }
        } finally {
            setIsLoading(false);
        }
    }, [status]);

    useEffect(() => {
        return () => {
            if (statusResetTimeout.current) {
                clearTimeout(statusResetTimeout.current);
            }
        };
    }, []);

    useEffect(() => {
        fetchLogs();

        const channel = supabase
            .channel('audit-log-live')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'audit_log' },
                (payload) => {
                    const newLog = mapAuditFromDB(payload.new);
                    setLogs(prev => [newLog, ...prev.slice(0, PAGE_SIZE - 1)]);
                    setTotalCount(prev => prev + 1);
                    setStatus('live');
                    setStatusMsg('Nueva actividad recibida');
                    if (statusResetTimeout.current) {
                        clearTimeout(statusResetTimeout.current);
                    }
                    statusResetTimeout.current = setTimeout(() => setStatusMsg('En vivo'), 2200);
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setStatus('live');
                    setStatusMsg('En vivo');
                } else if (status === 'CHANNEL_ERROR') {
                    setStatus('error');
                    setStatusMsg('Error de conexión Realtime');
                }
            });

        return () => { supabase.removeChannel(channel); };
    }, [fetchLogs]);

    const handleTestEntry = async () => {
        setStatusMsg('Enviando prueba...');
        const result = await auditApi.createAuditEntry({
            action: 'TEST_CONNECTION',
            module: 'AUDIT_LOG',
            description: 'Prueba manual de escritura desde el Monitor de Actividad.',
            userEmail: 'test@user.com',
            userName: 'Test User'
        });
        if (!result.ok) {
            setStatus('error');
            setStatusMsg(result.errorMessage || 'No se pudo registrar el evento de prueba');
            return;
        }
        setStatus('live');
        setStatusMsg('Prueba enviada');
        if (statusResetTimeout.current) {
            clearTimeout(statusResetTimeout.current);
        }
        statusResetTimeout.current = setTimeout(() => setStatusMsg('En vivo'), 2000);
    };

    const visibleLogs = useMemo(() => filterAuditEntries(logs, filters), [logs, filters]);
    const moduleOptions = useMemo(() => getAuditModuleOptions(logs), [logs]);
    const summary = useMemo(() => summarizeAuditEntries(visibleLogs), [visibleLogs]);

    return (
        <Panel title="Monitor de Actividad del Sistema" className="h-full min-h-0">
            <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-b-lg bg-[var(--nfq-bg-surface)]">
                <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--nfq-border-ghost)] bg-slate-950 px-4 py-3">
                    <div className="flex items-center gap-2 font-mono text-xs">
                        {status === 'live' ? (
                            <Wifi size={13} className="text-emerald-400" />
                        ) : status === 'error' ? (
                            <WifiOff size={13} className="text-red-400" />
                        ) : (
                            <Activity size={13} className="text-amber-400 animate-pulse" />
                        )}
                        <span className={
                            status === 'live' ? 'text-emerald-400' :
                                status === 'error' ? 'text-red-400' : 'text-amber-400'
                        }>
                            {statusMsg}
                        </span>
                        <span className="ml-2 text-slate-600">{totalCount} registros persistidos</span>
                    </div>
                </div>

                <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] px-4 py-4 md:grid-cols-4">
                    <SummaryTile label="Visible Events" value={summary.total} toneClass="text-cyan-400" />
                    <SummaryTile label="Destructive Ops" value={summary.destructiveCount} toneClass="text-rose-400" />
                    <SummaryTile label="Access Events" value={summary.accessCount} toneClass="text-emerald-400" />
                    <SummaryTile label="Modules in Scope" value={summary.modules} toneClass="text-amber-400" />
                </div>

                <AuditLogToolbar
                    filters={filters}
                    filteredCount={visibleLogs.length}
                    totalCount={totalCount}
                    moduleOptions={moduleOptions}
                    isLoading={isLoading}
                    onChange={setFilters}
                    onRefresh={fetchLogs}
                    onReset={() => setFilters(DEFAULT_AUDIT_FILTERS)}
                    onGenerateTest={handleTestEntry}
                />

                {visibleLogs.length === 0 && !isLoading ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-600">
                            <Activity size={32} />
                        <p className="text-sm">
                            No hay eventos para el filtro actual. Puedes limpiar filtros o generar un evento de prueba.
                        </p>
                    </div>
                ) : (
                    <AuditLogTable
                        entries={visibleLogs}
                        selectedId={selectedLog?.id || null}
                        onSelect={setSelectedLog}
                    />
                )}
            </div>

            <AuditEntryDrawer
                entry={selectedLog}
                isOpen={selectedLog !== null}
                onClose={() => setSelectedLog(null)}
            />
        </Panel>
    );
};

export default AuditLog;
