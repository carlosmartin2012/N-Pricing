import React, { useEffect, useState } from 'react';
import { Panel, Badge } from '../ui/LayoutComponents';
import { supabaseService } from '../../utils/supabaseService';
import { AuditEntry } from '../../types';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';

const AuditLog: React.FC = () => {
    const [logs, setLogs] = useState<AuditEntry[]>([]);
    const [status, setStatus] = useState('Conectando...');

    // 1. Carga inicial
    const fetchLogs = async () => {
        setStatus('Cargando datos...');
        const data = await supabaseService.fetchAuditLog();
        setLogs(data);
        setStatus('Sincronizado');
    };

    useEffect(() => {
        fetchLogs();

        // 2. Suscripción en Tiempo Real (Live)
        const channel = supabaseService.subscribeToAll((payload) => {
            if (payload.table === 'audit_log' && payload.eventType === 'INSERT') {
                const newLog = payload.mapped as AuditEntry;
                setLogs(prev => [newLog, ...prev]);
                setStatus('¡Nueva actividad detectada!');
                setTimeout(() => setStatus('En vivo'), 2000);
            }
        });

        return () => {
            if (channel && typeof channel.unsubscribe === 'function') {
                channel.unsubscribe();
            }
        };
    }, []);

    const handleTestEntry = async () => {
        setStatus('Enviando test...');
        await supabaseService.addAuditEntry({
            userEmail: 'test@system.com',
            userName: 'Probador de Sistema',
            action: 'TEST_MANUAL',
            module: 'AUDIT_LOG',
            description: 'Test manual del usuario para validar permisos de escritura.'
        });
        setStatus('Vistazo en vivo');
        setTimeout(() => setStatus('En vivo'), 2000);
    };

    return (
        <Panel title="Monitor de Actividad del Sistema (Live)" className="h-full">
            <div className="flex flex-col h-full bg-slate-900">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
                        <Activity size={14} className="animate-pulse" />
                        {status}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleTestEntry} className="flex items-center gap-2 px-3 py-1 bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 rounded hover:bg-emerald-800/60 text-xs transition-colors">
                            <ShieldCheck size={12} /> Generar Evento de Prueba
                        </button>
                        <button onClick={fetchLogs} className="flex items-center gap-2 px-3 py-1 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-xs">
                            <RefreshCw size={12} /> Forzar Recarga
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                    <table className="w-full text-left text-xs text-slate-400">
                        <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800 bg-slate-900 sticky top-0">
                            <tr>
                                <th className="p-3">Hora</th>
                                <th className="p-3">Usuario</th>
                                <th className="p-3">Acción</th>
                                <th className="p-3">Descripción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-800/50 transition-colors animate-in fade-in slide-in-from-top-2">
                                    <td className="p-3 font-mono text-slate-500 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </td>
                                    <td className="p-3 text-cyan-400 font-bold">{log.userName}</td>
                                    <td className="p-3"><Badge variant="default">{log.action}</Badge></td>
                                    <td className="p-3 text-slate-300">{log.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && (
                        <div className="p-10 text-center opacity-50">Esperando registros de actividad...</div>
                    )}
                </div>
            </div>
        </Panel>
    );
};

export default AuditLog;
