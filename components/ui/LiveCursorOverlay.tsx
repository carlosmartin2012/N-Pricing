import React from 'react';
import type { RemoteCursor } from '../../utils/cursors/cursorReducer';

/**
 * LiveCursorOverlay — Ola 7 Bloque B.4b.
 *
 * Renders remote cursors as absolutely positioned SVG arrows with a
 * trailing name label. Pure presentational — receives the cursor list
 * and per-user color via props. The hook that feeds it
 * (useLiveCursors with Supabase Realtime broadcast) lands in B.4c.
 *
 * The overlay is `pointer-events: none` so it never intercepts user
 * interaction, and `z-index: 60` so it floats above the application
 * chrome but below modals.
 */

interface Props {
  cursors: ReadonlyArray<RemoteCursor>;
  /** Cap on simultaneous cursors rendered. Excess users are still
   *  counted in the avatar bar via PresenceContext but no SVG cursor
   *  is drawn for them. Default 5. */
  maxVisible?: number;
}

// Stable per-user palette. Picks deterministically from a small
// curated set of accessible-on-dark colors.
const PALETTE = ['#22d3ee', '#f59e0b', '#10b981', '#f43f5e', '#a855f7', '#fb923c'] as const;

function colorForUserId(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i += 1) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(h) % PALETTE.length] as string;
}

const LiveCursorOverlay: React.FC<Props> = ({ cursors, maxVisible = 5 }) => {
  const visible = cursors.slice(0, Math.max(0, maxVisible));
  if (visible.length === 0) return null;

  return (
    <div
      data-testid="live-cursor-overlay"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    >
      {visible.map((c) => (
        <CursorMarker key={c.userId} cursor={c} color={colorForUserId(c.userId)} />
      ))}
    </div>
  );
};

interface CursorMarkerProps {
  cursor: RemoteCursor;
  color: string;
}

const CursorMarker: React.FC<CursorMarkerProps> = ({ cursor, color }) => {
  const label = cursor.name?.trim() || 'guest';
  return (
    <div
      data-testid={`cursor-${cursor.userId}`}
      data-cursor-color={color}
      style={{
        position: 'absolute',
        transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)`,
        transition: 'transform 80ms linear',
        willChange: 'transform',
      }}
    >
      <svg width={16} height={20} viewBox="0 0 16 20" fill="none" aria-hidden="true">
        <path
          d="M0 0 L0 16 L4 12 L7 19 L10 18 L7 11 L13 11 Z"
          fill={color}
          stroke="black"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="ml-2 inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold text-black shadow-sm"
        style={{ background: color, marginTop: -6, transform: 'translateX(8px)' }}
      >
        {label}
      </span>
    </div>
  );
};

export default LiveCursorOverlay;
export { colorForUserId as __pickCursorColor };
