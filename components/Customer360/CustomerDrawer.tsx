import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useUI } from '../../contexts/UIContext';
import CustomerRelationshipPanel from './CustomerRelationshipPanel';

/**
 * Globally-invocable Customer 360 drawer.
 *
 * Reads `customerDrawerId` from UIContext. When non-null, renders a right-side
 * drawer with the relationship panel. Closes on ESC, overlay click, or close
 * button. A "View full page" link jumps to `/customers` with the id preselected
 * (for users who want the standalone workspace with positions upload, etc.).
 */
const CustomerDrawer: React.FC = () => {
  const { customerDrawerId, closeCustomerDrawer } = useUI();
  const navigate = useNavigate();

  useEffect(() => {
    if (!customerDrawerId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCustomerDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [customerDrawerId, closeCustomerDrawer]);

  if (!customerDrawerId) return null;

  const handleFullPage = () => {
    closeCustomerDrawer();
    navigate(`/customers?id=${encodeURIComponent(customerDrawerId)}`);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex"
      role="dialog"
      aria-modal="true"
      aria-label="Customer 360 drawer"
    >
      {/* Backdrop */}
      <div
        onClick={closeCustomerDrawer}
        className="flex-1 bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-150"
      />

      {/* Drawer */}
      <aside className="relative flex h-full w-full max-w-[640px] flex-col overflow-hidden border-l border-[var(--nfq-border-ghost)] bg-[var(--nfq-bg-root)] shadow-[0_0_60px_rgba(0,0,0,0.45)] animate-in slide-in-from-right duration-150">
        <header className="flex items-center justify-between border-b border-[var(--nfq-border-ghost)] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="nfq-label">Customer 360</span>
            <span className="font-mono text-[11px] text-[color:var(--nfq-text-muted)]">{customerDrawerId}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleFullPage}
              className="nfq-button flex items-center gap-1 px-2 py-1 text-[10px]"
              title="Open full customer workspace"
            >
              <ExternalLink className="h-3 w-3" />
              Full page
            </button>
            <button
              onClick={closeCustomerDrawer}
              className="rounded-lg p-1.5 text-[color:var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[color:var(--nfq-text-primary)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5">
          <CustomerRelationshipPanel clientId={customerDrawerId} />
        </div>
      </aside>
    </div>
  );
};

export default CustomerDrawer;
