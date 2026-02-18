import React, { useEffect, useState, useCallback } from 'react';
import { Panel, Badge } from '../ui/LayoutComponents';
import { supabase } from '../../utils/supabaseClient';
import { storage } from '../../utils/storage';
import { AuditEntry } from '../../types';
import { Activity, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react';

const mapAuditRow = (row: any): AuditEntry => ({
    id: String(row.id || `audit-${Math.random()}`),
    timestamp: row.timestamp || new Date().toISOString(),
    userEmail: row.user_email || 'unknown@system.com',
    userName: row.user_name || 'System User',
    action: row.action || 'UNKNOWN',
    module: row.module || 'SYSTEM',
    description: row.description || '',
    details: row.details || {}
});

const AuditLog: React.FC = () => {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [status, setStatus] = useState<'connecting' | 'live' | 'error'>('connecting');
    const [statusMsg, setStatusMsg] = useState('Conectando...');
    const [isLoading, setIsLoading] = useState(false);

    const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        setStatusMsg('Cargando datos...');
        try {
            const { data, error } = await supabase
                .from('audit_log')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Error fetching audit log:', error);
                setStatus('error');
                setStatusMsg(`Error: ${error.message} (${error.code})`);
                alert(`Error al leer audit_log:\nCódigo: ${error.code}\nMensaje: ${error.message}`);
            } else {
                setLogs((data || []).map(mapAuditRow));
                setStatus('live');
                setStatusMsg('En vivo');
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLogs();

        // Realtime subscription directly on audit_log table
        const channel = supabase
            .channel('audit-log-live')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'audit_log' },
                (payload) => {
                    const newLog = mapAuditRow(payload.new);
                    setLogs(prev => [newLog, ...prev]);
                    setStatusMsg('¡Nueva actividad!');
                    setTimeout(() => setStatusMsg('En vivo'), 2000);
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
        await storage.addAuditEntry({
            action: 'TEST_CONNECTION',
            module: 'AUDIT_LOG',
            description: 'Prueba manual de escritura desde el Monitor de Actividad.',
            userEmail: 'test@user.com',
            userName: 'Test User'
        });
        // If no error alert appeared, it worked
        setTimeout(() => setStatusMsg('En vivo'), 2000);
    };

    const getActionColor = (action: string) => {
        if (action.startsWith('DELETE') || action === 'LOGOUT') return 'text-red-400';
        if (action.startsWith('CREATE') || action === 'LOGIN') return 'text-emerald-400';
        if (action.startsWith('UPDATE') || action.startsWith('APPLY')) return 'text-amber-400';
        if (action === 'TEST_CONNECTION' || action === 'TEST_MANUAL') return 'text-purple-400';
        return 'text-cyan-400';
    };

    return (
        <Panel title="Monitor de Actividad del Sistema" className="h-full">
            <div className="flex flex-col h-full bg-slate-900 rounded-b-lg overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-950 flex-shrink-0">
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
                        <span className="text-slate-600 ml-2">{logs.length} registros</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleTestEntry}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 rounded hover:bg-emerald-800/60 text-xs transition-colors font-medium"
                        >
                            <ShieldCheck size={12} />
                            Generar Evento de Prueba
                        </button>
                        <button
                            onClick={fetchLogs}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-xs transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
                            Recargar
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {logs.length === 0 && !isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                            <Activity size={32} />
                            <p className="text-sm">Sin registros. Pulsa "Generar Evento de Prueba" para validar la conexión.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800 bg-slate-950 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-2.5">Hora</th>
                                    <th className="px-4 py-2.5">Usuario</th>
                                    <th className="px-4 py-2.5">Acción</th>
                                    <th className="px-4 py-2.5">Módulo</th>
                                    <th className="px-4 py-2.5">Descripción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="hover:bg-slate-800/40 transition-colors text-slate-400"
                                    >
                                        <td className="px-4 py-2.5 font-mono text-slate-500 whitespace-nowrap">
                                            {new Date(log.timestamp).toLocaleString('es-ES', {
                                                day: '2-digit', month: '2-digit',
                                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-2.5 text-cyan-400 font-medium whitespace-nowrap">
                                            {log.userName}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                            <span className={`font-mono font-bold text-[10px] ${getActionColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <Badge variant="outline">{log.module}</Badge>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-300 max-w-xs truncate">
                                            {log.description}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </Panel>
    );
};

export default AuditLog;
