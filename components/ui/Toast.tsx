import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

/* ── Icon lookup ── */
const iconMap: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

/* ── Color schemes (dark-theme, matches app slate/cyan palette) ── */
const colorMap: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: 'bg-emerald-950/90',
    border: 'border-emerald-500/40',
    icon: 'text-emerald-400',
    text: 'text-emerald-100',
  },
  error: {
    bg: 'bg-red-950/90',
    border: 'border-red-500/40',
    icon: 'text-red-400',
    text: 'text-red-100',
  },
  warning: {
    bg: 'bg-amber-950/90',
    border: 'border-amber-500/40',
    icon: 'text-amber-400',
    text: 'text-amber-100',
  },
  info: {
    bg: 'bg-cyan-950/90',
    border: 'border-cyan-500/40',
    icon: 'text-cyan-400',
    text: 'text-cyan-100',
  },
};

/* ── Single toast item ── */
const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const colors = colorMap[toast.type];
  const Icon = iconMap[toast.type];

  useEffect(() => {
    if (!toast.duration) return;
    const timer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm
        shadow-lg shadow-black/30 max-w-sm w-full
        animate-slide-in-right
        ${colors.bg} ${colors.border}
      `}
      role="alert"
    >
      <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${colors.icon}`} />
      <p className={`text-sm leading-snug flex-1 ${colors.text}`}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-slate-400 hover:text-white transition-colors flex-shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

/* ── Toast container (fixed bottom-right) ── */
const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-auto">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
};
