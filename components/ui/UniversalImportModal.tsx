import React, { useState, useEffect } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Database, TrendingUp, LineChart, FileText, GitBranch, ArrowRight } from 'lucide-react';
import { parseExcel, REQUIRED_HEADERS } from '../../utils/excelUtils';
import { useUI } from '../../contexts/UIContext';

interface ImportSummary {
    module: string;
    imported: number;
    skipped: number;
    failures: Array<{ row: number; error: string }>;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onImport: (module: string, data: Record<string, unknown>[]) => Promise<ImportSummary | void>;
}

const MODULES = [
    { id: 'YIELD_CURVES', label: 'Yield Curves', icon: LineChart, color: 'text-cyan-400' },
    { id: 'METHODOLOGY', label: 'Pricing Rules', icon: FileText, color: 'text-purple-400' },
    { id: 'BEHAVIOURAL', label: 'Behavioural Models', icon: GitBranch, color: 'text-amber-400' },
    { id: 'SHOCKS', label: 'Scenario Shocks', icon: TrendingUp, color: 'text-red-400' },
    { id: 'DEALS', label: 'Deal Blotter', icon: Database, color: 'text-emerald-400' },
];

export const UniversalImportModal: React.FC<Props> = ({ isOpen, onClose, onImport }) => {
    const { t } = useUI();
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
    const [selectedModule, setSelectedModule] = useState<string>('');
    const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile || !selectedModule) return;

        setFile(selectedFile);
        setStatus('parsing');
        try {
            const data = await parseExcel(selectedFile);

            // VALIDATION LOGIC
            const required = REQUIRED_HEADERS[selectedModule as keyof typeof REQUIRED_HEADERS] || [];
            if (data.length > 0) {
                const actualHeaders = Object.keys(data[0]);
                const missing = required.filter(h => !actualHeaders.includes(h));

                if (missing.length > 0) {
                    throw new Error(`The file format does not match the template for ${selectedModule}. Missing columns: ${missing.join(', ')}`);
                }
            } else {
                throw new Error("The uploaded file is empty or could not be read.");
            }

            setParsedData(data);
            setStatus('ready');
        } catch (err) {
            console.error(err);
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : 'Failed to parse Excel file. Check format.');
        }
    };

    const handleConfirmImport = async () => {
        if (!selectedModule || parsedData.length === 0) return;

        setStatus('importing');
        try {
            const summary = await onImport(selectedModule, parsedData);
            if (summary) {
                setLastSummary(summary);
                if (summary.failures.length > 0 && summary.imported === 0) {
                    setStatus('error');
                    setErrorMessage(
                        `Import failed for ${summary.failures.length} record(s). First error: ${summary.failures[0]?.error || 'unknown'}`,
                    );
                    return;
                }
            }
            setStatus('success');
            setTimeout(() => {
                onClose();
                reset();
            }, 1500);
        } catch (err) {
            console.error(err);
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : 'Import failed. Please check data mapping.');
        }
    };

    const reset = () => {
        setFile(null);
        setParsedData([]);
        setSelectedModule('');
        setStatus('idle');
        setErrorMessage('');
        setLastSummary(null);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="universal-import-modal-title">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center border border-cyan-500/20">
                            <Upload className="text-cyan-400" size={20} />
                        </div>
                        <div>
                            <h2 id="universal-import-modal-title" className="text-lg font-bold text-white leading-tight">{t.universalDataImport}</h2>
                            <p className="text-xs text-slate-500">{t.selectDestinationFirst}</p>
                        </div>
                    </div>
                    <button onClick={onClose} aria-label="Close import dialog" className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* STEP 1: MODULE SELECTION */}
                    {status === 'idle' && (
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.selectImportDestination}</label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {MODULES.map((mod) => {
                                    const Icon = mod.icon;
                                    const isSelected = selectedModule === mod.id;
                                    return (
                                        <button
                                            key={mod.id}
                                            onClick={() => setSelectedModule(mod.id)}
                                            className={`flex flex-col items-center p-4 rounded-lg border transition-all ${isSelected ? 'bg-cyan-500/10 border-cyan-500 ring-1 ring-cyan-500' : 'bg-slate-800/30 border-slate-700 hover:border-slate-500'}`}
                                        >
                                            <Icon className={`${mod.color} mb-2`} size={24} />
                                            <span className="text-xs font-bold text-slate-300">{mod.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedModule && (
                                <div className="mt-6 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-cyan-400">
                                        <ArrowRight size={18} />
                                        <span className="text-sm font-medium">{t.readyToUpload} <strong>{MODULES.find(m => m.id === selectedModule)?.label}</strong></span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const input = document.getElementById('universal-upload');
                                            input?.click();
                                        }}
                                        className="px-4 py-2 bg-cyan-600 text-white rounded text-xs font-bold hover:bg-cyan-500 transition-colors"
                                    >
                                        {t.browseFile}
                                    </button>
                                </div>
                            )}

                            <input type="file" id="universal-upload" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
                        </div>
                    )}

                    {/* STEP 2: PARSING */}
                    {status === 'parsing' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">{t.analyzingFile}</h3>
                                <p className="text-sm text-slate-500">{t.validatingFormat}</p>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: READY / PREVIEW */}
                    {status === 'ready' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="text-emerald-400" size={18} />
                                    <div>
                                        <div className="text-sm font-bold text-white">{file?.name}</div>
                                        <div className="text-xs text-slate-500 text-emerald-500/80 font-bold">{parsedData.length} records validated for {MODULES.find(m => m.id === selectedModule)?.label}</div>
                                    </div>
                                </div>
                                <button onClick={reset} className="text-xs text-cyan-400 hover:underline">{t.changeDestination}</button>
                            </div>

                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{t.dataPreview}</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[10px] text-slate-400">
                                        <thead>
                                            <tr>
                                                {Object.keys(parsedData[0] || {}).filter(k => !k.startsWith('_')).slice(0, 5).map(k => (
                                                    <th key={k} className="text-left py-2 px-2 border-b border-slate-800">{k}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedData.slice(0, 3).map((row, i) => (
                                                <tr key={i}>
                                                    {Object.keys(row).filter(k => !k.startsWith('_')).slice(0, 5).map(k => (
                                                        <td key={k} className="py-2 px-2 border-b border-slate-900 truncate max-w-[100px]">
                                                            {row[k] == null ? '' : String(row[k])}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {status === 'importing' && (
                        <div className="py-12 flex flex-col items-center justify-center space-y-4">
                            <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-white">{t.importingData}</h3>
                                <p className="text-sm text-slate-500">{t.updatingRecords}</p>
                            </div>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="py-12 text-center">
                            <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
                            <h3 className="text-xl font-bold text-white">{t.importSuccessful}</h3>
                            <p className="text-sm text-slate-500 mt-2">{t.databaseUpdated}</p>
                            {lastSummary && lastSummary.failures.length > 0 && (
                                <p className="text-xs text-amber-400 mt-3">
                                    {lastSummary.imported} imported, {lastSummary.failures.length} failed (see audit log)
                                </p>
                            )}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="py-12 text-center px-8">
                            <AlertCircle size={64} className="text-red-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white">{t.validationError}</h3>
                            <p className="text-sm text-red-400 mt-2 leading-relaxed">{errorMessage}</p>
                            <div className="mt-8 flex justify-center gap-3">
                                <button onClick={reset} className="px-6 py-2 bg-slate-800 text-white rounded-lg text-xs hover:bg-slate-700">{t.backToSelection}</button>
                                {selectedModule && (
                                    <button
                                        onClick={() => document.getElementById('universal-upload')?.click()}
                                        className="px-6 py-2 bg-cyan-600 text-white rounded-lg text-xs hover:bg-cyan-500"
                                    >
                                        {t.tryAnotherFile}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {(status === 'ready' || status === 'importing') && (
                    <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                        <button onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">{t.cancel}</button>
                        <button
                            onClick={handleConfirmImport}
                            disabled={status === 'importing'}
                            className={`px-8 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${status === 'importing' ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-500/20'}`}
                        >
                            {status === 'importing' ? t.importing : t.completeImport}
                            {status !== 'importing' && <CheckCircle2 size={16} />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
