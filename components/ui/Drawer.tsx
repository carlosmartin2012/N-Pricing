import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'md' | 'xl';
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, footer, size = 'md' }) => {
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/55 backdrop-blur-md transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className={`fixed top-0 right-0 z-50 flex h-full w-full transform flex-col bg-[var(--nfq-bg-surface)] shadow-[var(--nfq-shadow-dialog)] transition-transform duration-300 ease-out ${
          size === 'xl' ? 'md:w-[46rem]' : 'md:w-[26rem]'
        } ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between bg-[var(--nfq-bg-elevated)] px-6 py-5">
          <div>
            <div className="nfq-eyebrow">Detail Layer</div>
            <h2 id="drawer-title" className="mt-3 text-lg font-semibold tracking-[var(--nfq-tracking-snug)] text-[color:var(--nfq-text-primary)]">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--nfq-bg-highest)] text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-primary)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer && <div className="bg-[var(--nfq-bg-elevated)] px-6 py-5">{footer}</div>}
      </div>
    </>
  );
};
