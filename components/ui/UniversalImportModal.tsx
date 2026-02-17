import React, { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Database, TrendingUp, LineChart, FileText, GitBranch } from 'lucide-react';
import { parseExcel } from '../../utils/excelUtils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onImport: (module: string, data: any[]) => Promise<void>;
}

const MODULES = [
    { id: 'YIELD_CURVES', label: 'Yield Curves', icon: LineChart, color: 'text-cyan-400' },
    { id: 'METHODOLOGY', label: 'Pricing Rules', icon: FileText, color: 'text-purple-400' },
    { id: 'BEHAVIOURAL', label: 'Behavioural Models', icon: GitBranch, color: 'text-amber-400' },
    { id: 'SHOCKS', label: 'Scenario Shocks', icon: TrendingUp, color: 'text-red-400' },
    { id: 'DEALS', label: 'Deal Blotter', icon: Database, color: 'text-emerald-400' },
];

export const UniversalImportModal: React.FC<Props> = ({ isOpen, onClose, onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [selectedModule, setSelectedModule] = useState<string>('');
    const [status, setStatus] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setStatus('parsing');
            try {
                const data = await parseExcel(selectedFile);
                setParsedData(data);
                setStatus('ready');
            } catch (err) {
                console.error(err);
                setStatus('error');
                setErrorMessage('Failed to parse Excel file. Check format.');
            }
        }
    };

    const handleConfirmImport = async () => {
        if (!selectedModule || parsedData.length === 0) return;

        setStatus('importing');
        try {
            await onImport(selectedModule, parsedData);
            setStatus('success');
            setTimeout(() => {
                onClose();
                reset();
            }, 1500);
        } catch (err) {
            console.error(err);
            setStatus('error');
            setErrorMessage('Import failed. Please check data mapping.');
        }
    };

    const reset = () => {
        setFile(null);
        setParsedData([]);
        setSelectedModule('');
        setStatus('idle');
        setErrorMessage('');
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-500/10 rounded-lg flex items-center justify-center border border-cyan-500/20">
                            <Upload className="text-cyan-400" size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white leading-tight">Universal Data Import</h2>
                            <p className="text-xs text-slate-500">Upload Excel template and choose destination</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {status === 'idle' || status === 'parsing' ? (
                        <div className="border-2 border-dashed border-slate-800 rounded-xl p-12 text-center hover:border-cyan-500/50 transition-colors bg-slate-950/50">
                            <input type="file" id="universal-upload" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
                            <label htmlFor="universal-upload" className="cursor-pointer flex flex-col items-center">
                                <FileSpreadsheet size={48} className="text-slate-700 mb-4" />
                                <span className="text-sm font-medium text-slate-300">Drop your file here or click to browse</span>
                                <span className="text-xs text-slate-500 mt-2">Supports .xlsx, .xls, .csv templates</span>
                            </label>
                            {status === 'parsing' && (
                                <div className="mt-4 flex items-center justify-center gap-2 text-cyan-400 animate-pulse">
                                    <span className="text-xs font-bold uppercase tracking-wider">Parsing file...</span>
                                </div>
                            )}
                        </div>
                    ) : status === 'ready' || status === 'importing' ? (
                        <div className="space-y-6">
                            {/* File Info */}
                            <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="text-emerald-400" size={18} />
                                    <div>
                                        <div className="text-sm font-bold text-white">{file?.name}</div>
                                        <div className="text-xs text-slate-500">{parsedData.length} rows detected</div>
                                    </div>
                                </div>
                                <button onClick={reset} className="text-xs text-cyan-400 hover:underline">Change file</button>
                            </div>

                            {/* Module Selector */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select Import Destination</label>
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
                            </div>
                        </div>
                    ) : status === 'success' ? (
                        <div className="py-12 text-center">
                            <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
                            <h3 className="text-xl font-bold text-white">Import Successful!</h3>
                            <p className="text-sm text-slate-500 mt-2">Database updated and synchronized.</p>
                        </div>
                    ) : status === 'error' ? (
                        <div className="py-12 text-center">
                            <AlertCircle size={64} className="text-red-500 mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white">Import Failed</h3>
                            <p className="text-sm text-red-400 mt-2">{errorMessage}</p>
                            <button onClick={reset} className="mt-6 px-6 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700">Try Again</button>
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                {(status === 'ready' || status === 'importing') && (
                    <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
                        <button onClick={onClose} className="px-5 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                        <button
                            onClick={handleConfirmImport}
                            disabled={!selectedModule || status === 'importing'}
                            className={`px-8 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${!selectedModule || status === 'importing' ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-lg shadow-cyan-500/20'}`}
                        >
                            {status === 'importing' ? 'Importing...' : 'Complete Import'}
                            {status !== 'importing' && <CheckCircle2 size={16} />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
