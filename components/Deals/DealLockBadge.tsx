import React from 'react';
import { Users } from 'lucide-react';
import { useDealLock } from '../../hooks/useDealLock';

/**
 * DealLockBadge — Ola 7 Bloque B.2.
 *
 * Soft-lock indicator for a deal. Renders nothing when nobody else is
 * viewing the deal; renders a compact "N editing" pill when 1+ other
 * users are tracked on it (via PresenceContext).
 *
 * The badge is **advisory only**. Click is decorative — the modal
 * conflict-resolution flow lives in Calculator (a separate component
 * landing later in Bloque B). Here we only inform.
 */

interface Props {
  dealId: string | null | undefined;
  /** Visual density. `inline` = sits flush in tables; `chip` = padded for headers. */
  variant?: 'inline' | 'chip';
}

const DealLockBadge: React.FC<Props> = ({ dealId, variant = 'inline' }) => {
  const { locked, lockedBy } = useDealLock(dealId);
  if (!locked) return null;

  const label = lockedBy.length === 1
    ? `${lockedBy[0]?.name || lockedBy[0]?.email || 'Someone else'} editing`
    : `${lockedBy.length} editing`;

  const title = lockedBy
    .map((u) => u.name || u.email || u.userId)
    .join(', ');

  const isChip = variant === 'chip';
  return (
    <span
      data-testid="deal-lock-badge"
      data-lock-count={lockedBy.length}
      role="status"
      aria-label={`Deal lock: ${label}`}
      title={title}
      className={
        isChip
          ? 'inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.12em] text-amber-200'
          : 'ml-2 inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/5 px-1 py-0 text-[9px] font-mono uppercase tracking-[0.08em] text-amber-200'
      }
    >
      <Users className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  );
};

export default DealLockBadge;
