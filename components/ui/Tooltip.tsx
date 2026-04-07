import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Info } from 'lucide-react';
import { useTooltipPosition, type Placement } from '../../hooks/useTooltipPosition';

/* ─── Tooltip Bubble ─────────────────────────────────────────────────── */

interface TooltipBubbleProps {
  content: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  placement?: Placement;
  variant?: 'default' | 'formula';
  onClose: () => void;
  id: string;
}

const TooltipBubble: React.FC<TooltipBubbleProps> = ({
  content,
  anchorRef,
  placement = 'top',
  variant = 'default',
  onClose,
  id,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pos = useTooltipPosition(anchorRef, tooltipRef, placement, true);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (
        tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose, anchorRef]);

  const arrowClass = {
    top: 'left-1/2 -translate-x-1/2 -bottom-1 rotate-45',
    bottom: 'left-1/2 -translate-x-1/2 -top-1 rotate-45',
    left: 'top-1/2 -translate-y-1/2 -right-1 rotate-45',
    right: 'top-1/2 -translate-y-1/2 -left-1 rotate-45',
  }[pos.actualPlacement];

  return ReactDOM.createPortal(
    <div
      ref={tooltipRef}
      id={id}
      role="tooltip"
      className={`fixed z-[60] animate-[fadeIn_150ms_ease-out] rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] px-3 py-2.5 shadow-[var(--nfq-shadow-soft)] ${
        variant === 'formula' ? 'max-w-xs sm:max-w-sm' : 'max-w-xs'
      }`}
      style={{ top: pos.top, left: pos.left }}
    >
      <p
        className={`text-xs leading-relaxed text-[color:var(--nfq-text-secondary)] ${
          variant === 'formula' ? 'font-mono text-[11px]' : ''
        }`}
      >
        {content}
      </p>
      <span
        className={`absolute h-2 w-2 border-b border-r border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-highest)] ${arrowClass}`}
        aria-hidden="true"
      />
    </div>,
    document.body,
  );
};

/* ─── Tooltip Trigger (info icon) ────────────────────────────────────── */

interface TooltipTriggerProps {
  content: string;
  placement?: Placement;
  variant?: 'default' | 'formula';
  size?: number;
}

export const TooltipTrigger: React.FC<TooltipTriggerProps> = ({
  content,
  placement = 'top',
  variant = 'default',
  size = 13,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        aria-describedby={isOpen ? tooltipId : undefined}
        className="ml-1 inline-flex shrink-0 items-center text-[color:var(--nfq-text-faint)] transition-colors hover:text-[color:var(--nfq-accent)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--nfq-accent)] rounded-sm"
        aria-label="More information"
      >
        <Info size={size} />
      </button>
      {isOpen && (
        <TooltipBubble
          content={content}
          anchorRef={anchorRef}
          placement={placement}
          variant={variant}
          onClose={close}
          id={tooltipId}
        />
      )}
    </>
  );
};

/* ─── Inline Tooltip (wraps any children as trigger) ─────────────────── */

interface TooltipProps {
  content: string;
  placement?: Placement;
  variant?: 'default' | 'formula';
  children: React.ReactElement;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  placement = 'top',
  variant = 'default',
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  return (
    <div
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      aria-describedby={isOpen ? tooltipId : undefined}
    >
      {children}
      {isOpen && (
        <TooltipBubble
          content={content}
          anchorRef={anchorRef}
          placement={placement}
          variant={variant}
          onClose={() => setIsOpen(false)}
          id={tooltipId}
        />
      )}
    </div>
  );
};
