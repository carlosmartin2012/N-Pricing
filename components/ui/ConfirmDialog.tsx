import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';

export type ConfirmTone = 'danger' | 'warning' | 'info';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_STYLES: Record<ConfirmTone, { icon: string; ring: string; button: string }> = {
  danger: {
    icon: 'text-[color:var(--nfq-danger)]',
    ring: 'border-[color:var(--nfq-danger)]/30',
    button: 'border-[color:var(--nfq-danger)]/40 text-[color:var(--nfq-danger)] hover:bg-[var(--nfq-danger)]/10',
  },
  warning: {
    icon: 'text-[color:var(--nfq-warning)]',
    ring: 'border-[color:var(--nfq-warning)]/30',
    button: 'border-[color:var(--nfq-warning)]/40 text-[color:var(--nfq-warning)] hover:bg-[var(--nfq-warning)]/10',
  },
  info: {
    icon: 'text-[color:var(--nfq-accent)]',
    ring: 'border-[color:var(--nfq-accent)]/30',
    button: 'border-[color:var(--nfq-accent)]/40 text-[color:var(--nfq-accent)] hover:bg-[var(--nfq-accent)]/10',
  },
};

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  onConfirm,
  onCancel,
}) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const styles = TONE_STYLES[tone];

  useEffect(() => {
    if (!isOpen) return;
    confirmButtonRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-md rounded-[var(--nfq-radius-card)] border ${styles.ring} bg-[var(--nfq-bg-surface)] p-5 shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className={`h-6 w-6 ${styles.icon}`} aria-hidden />
          <h3 id="confirm-dialog-title" className="text-lg font-bold text-[color:var(--nfq-text-primary)]">
            {title}
          </h3>
        </div>
        <div className="mb-6 text-sm text-[color:var(--nfq-text-secondary)]">{message}</div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="nfq-button nfq-button-ghost px-4 py-2 text-sm">
            <X className="mr-1 inline h-4 w-4" />
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className={`nfq-button nfq-button-ghost px-4 py-2 text-sm ${styles.button}`}
          >
            <Check className="mr-1 inline h-4 w-4" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
