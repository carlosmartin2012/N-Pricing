import React from 'react';
import { Trash2 } from 'lucide-react';
import { Drawer } from '../ui/Drawer';

interface DealDeleteDrawerProps {
  isOpen: boolean;
  dealId?: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DealDeleteDrawer: React.FC<DealDeleteDrawerProps> = ({ isOpen, dealId, onClose, onConfirm }) => (
  <Drawer
    isOpen={isOpen}
    onClose={onClose}
    title="Delete Transaction"
    footer={
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-xs text-[color:var(--nfq-text-muted)] hover:text-[color:var(--nfq-text-primary)]">
          Cancel
        </button>
        <button onClick={onConfirm} className="rounded bg-[var(--nfq-danger)] px-4 py-2 text-xs font-bold text-[color:var(--nfq-text-primary)] hover:bg-[var(--nfq-danger-hover)]">
          Confirm Delete
        </button>
      </div>
    }
  >
    <div className="p-4 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-950/50">
        <Trash2 size={32} className="text-[color:var(--nfq-danger)]" />
      </div>
      <h3 className="mb-2 font-bold text-[color:var(--nfq-text-secondary)]">Are you sure?</h3>
      <p className="text-xs text-[color:var(--nfq-text-muted)]">
        This action will permanently delete deal <span className="font-mono text-[color:var(--nfq-text-primary)]">{dealId}</span> and reverse
        all associated accounting entries.
      </p>
    </div>
  </Drawer>
);

export default DealDeleteDrawer;
