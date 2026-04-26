import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileUp, X, Download, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';

type UploadedCsvRow = Record<string, string>;

const MAX_CSV_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_CSV_EXTENSIONS = new Set(['csv', 'txt']);

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (data: UploadedCsvRow[]) => void;
    title: string;
    templateName: string;
    templateContent: string;
}

export const FileUploadModal: React.FC<Props> = ({ isOpen, onClose, onUpload, title, templateName, templateContent }) => {
    const { t } = useUI();
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [status, setStatus] = useState<'idle' | 'parsing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const parseDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fileReaderRef = useRef<FileReader | null>(null);

    useEffect(() => {
        return () => {
            if (parseDelayTimerRef.current) {
                clearTimeout(parseDelayTimerRef.current);
                parseDelayTimerRef.current = null;
            }
            if (fileReaderRef.current) {
                try {
                    fileReaderRef.current.abort();
                } catch { /* noop */ }
                fileReaderRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
        else if (e.type === 'dragleave') setIsDragging(false);
    };

    const processFile = async (f: File) => {
        const extension = f.name.split('.').pop()?.toLowerCase() ?? '';
        if (!ALLOWED_CSV_EXTENSIONS.has(extension)) {
            setFile(f);
            setStatus('error');
            setErrorMessage('Unsupported file type. Please upload a .csv file.');
            return;
        }
        if (f.size > MAX_CSV_UPLOAD_BYTES) {
            setFile(f);
            setStatus('error');
            setErrorMessage('File too large. Maximum supported size is 5 MB.');
            return;
        }

        setFile(f);
        setStatus('parsing');

        // Simulate parsing latency without leaking timers across unmounts
        if (parseDelayTimerRef.current) clearTimeout(parseDelayTimerRef.current);
        parseDelayTimerRef.current = setTimeout(() => {
            parseDelayTimerRef.current = null;
            const reader = new FileReader();
            fileReaderRef.current = reader;
            reader.onload = (e) => {
                if (fileReaderRef.current !== reader) return; // stale read after abort
                fileReaderRef.current = null;
                try {
                    const text = (e.target?.result as string | null) ?? '';
                    const lines = text.split(/\r?\n/).filter(l => l.trim());
                    if (lines.length === 0) {
                        setStatus('error');
                        setErrorMessage('The uploaded CSV file is empty.');
                        return;
                    }
                    const headers = lines[0].split(',').map(h => h.trim()).filter(Boolean);
                    if (headers.length === 0) {
                        setStatus('error');
                        setErrorMessage('The CSV header row is empty or malformed.');
                        return;
                    }
                    const data = lines.slice(1).map(line => {
                        const values = line.split(',').map(v => v.trim());
                        return headers.reduce<UploadedCsvRow>((obj, header, i) => {
                            obj[header] = values[i] ?? '';
                            return obj;
                        }, {});
                    });

                    onUpload(data);
                    setStatus('success');
                } catch {
                    setStatus('error');
                    setErrorMessage('Failed to parse file. Please ensure it follows the template format.');
                }
            };
            reader.onerror = () => {
                if (fileReaderRef.current !== reader) return;
                fileReaderRef.current = null;
                setStatus('error');
                setErrorMessage('Failed to read file. Please try again.');
            };
            try {
                reader.readAsText(f);
            } catch {
                fileReaderRef.current = null;
                setStatus('error');
                setErrorMessage('Failed to read file. Please try again.');
            }
        }, 1000);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const downloadTemplate = () => {
        const blob = new Blob([templateContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = templateName;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="file-upload-modal-title">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-[var(--nfq-radius-card)] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div className="flex items-center gap-3">
                        <Upload size={18} className="text-cyan-500" />
                        <h3 id="file-upload-modal-title" className="text-sm font-bold text-white tracking-normal">{title}</h3>
                    </div>
                    <button onClick={onClose} aria-label="Close upload dialog" className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4">
                    {status === 'idle' || status === 'parsing' ? (
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-[var(--nfq-radius-card)] p-12 flex flex-col items-center justify-center transition-all cursor-pointer ${isDragging ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/50'
                                }`}
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                                className="hidden"
                                accept=".csv"
                            />

                            {status === 'parsing' ? (
                                <div className="flex flex-col items-center">
                                    <div className="w-12 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-4" />
                                    <p className="text-sm text-cyan-400 font-medium">{t.parsingValidating}</p>
                                </div>
                            ) : (
                                <>
                                    <FileUp size={48} className={`mb-4 transition-colors ${isDragging ? 'text-cyan-400' : 'text-slate-600'}`} />
                                    <p className="text-sm text-slate-300 font-medium text-center">
                                        {t.dragDropCsv} <span className="text-cyan-500">{t.csvFile}</span> {t.here}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2 text-center">{t.orClickToBrowse}</p>
                                </>
                            )}
                        </div>
                    ) : status === 'success' ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 size={32} className="text-emerald-500" />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2">{t.importSuccessful}</h4>
                            <p className="text-sm text-slate-400 mb-8">
                                {file?.name} {t.fileProcessedMessage}
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                {t.closeAndRefresh}
                            </button>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <AlertCircle size={32} className="text-red-500" />
                            </div>
                            <h4 className="text-lg font-bold text-white mb-2">{t.importFailed}</h4>
                            <p className="text-sm text-slate-400 mb-8">{errorMessage}</p>
                            <button
                                onClick={() => setStatus('idle')}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                {t.tryAgain}
                            </button>
                        </div>
                    )}

                    {status === 'idle' && (
                        <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-800 rounded-lg">
                                    <FileText size={18} className="text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-300 uppercase tracking-tight">{t.needTemplate}</p>
                                    <p className="text-[10px] text-slate-500">{t.downloadCsvFormat}</p>
                                </div>
                            </div>
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[10px] font-bold transition-colors uppercase"
                            >
                                <Download size={12} /> Template
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
