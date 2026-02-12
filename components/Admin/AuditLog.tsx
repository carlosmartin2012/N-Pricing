import React, { useState, useEffect } from 'react';
import { Panel, Badge } from '../ui/LayoutComponents';
import { AuditEntry } from '../../types';
import { storage } from '../../utils/storage';
import { supabaseService } from '../../utils/supabaseService';
import { Search, Clock, User, Activity, FileText, Filter } from 'lucide-react';

const AuditLog: React.FC = () => {
    const [entries, setEntries] = useState<AuditEntry[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetch = async () => {
            const data = await storage.getAuditLog();
            setEntries(data);
        };
        fetch();

        const channel = supabaseService.subscribeToAll((payload) => {
            if (payload.table === 'audit_log' && payload.eventType === 'INSERT') {
                setEntries(prev => [payload.new as AuditEntry, ...prev]);
            }
        });

        return () => { channel.unsubscribe(); };
    }, []);

    const filteredEntries = entries.filter(e =>
        e.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Panel title="System Audit Log" className="h-full">
            <div className="flex flex-col h-full bg-slate-900/50">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
                    <div className="relative group w-1/3">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Filter actions, users, or modules..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 w-full"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded text-xs hover:bg-slate-700 transition-colors">
                            <Filter size={12} /> Filter by Module
                        </button>
                    </div>
                </div>

                {/* Table Header */}
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-950 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 pl-4 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800 w-44">Timestamp</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">User</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800 w-40">Action</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800 w-32">Module</th>
                                <th className="p-3 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-800">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-xs text-slate-300">
                            {filteredEntries.map((e) => (
                                <tr key={e.id} className="hover:bg-slate-800/50 transition-colors group">
                                    <td className="p-3 pl-4 font-mono text-slate-500 group-hover:text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} /> {new Date(e.timestamp).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-200">{e.userName}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">{e.userEmail}</span>
                                        </div>
                                    </td>
                                    <td className="p-3">
                                        <Badge variant="default" className="text-[10px] bg-slate-800 border-slate-700 text-slate-300">
                                            {e.action}
                                        </Badge>
                                    </td>
                                    <td className="p-3 font-mono text-cyan-500/70">{e.module}</td>
                                    <td className="p-3 text-slate-400 max-w-xs truncate">{e.description}</td>
                                </tr>
                            ))}
                            {filteredEntries.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-slate-500">
                                        <Activity size={32} className="mx-auto mb-4 opacity-20" />
                                        No audit logs found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </Panel>
    );
};

export default AuditLog;
