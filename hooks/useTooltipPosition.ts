import { useCallback, useEffect, useState, type RefObject } from 'react';

export type Placement = 'top' | 'bottom' | 'left' | 'right';

interface Position {
  top: number;
  left: number;
  actualPlacement: Placement;
}

const GAP = 8;

function computePosition(
  anchor: DOMRect,
  tooltip: DOMRect,
  preferred: Placement,
): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const fits = {
    top: anchor.top - tooltip.height - GAP > 0,
    bottom: anchor.bottom + tooltip.height + GAP < vh,
    left: anchor.left - tooltip.width - GAP > 0,
    right: anchor.right + tooltip.width + GAP < vw,
  };

  const placement = fits[preferred] ? preferred : (Object.keys(fits) as Placement[]).find((p) => fits[p]) ?? 'bottom';

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'top':
      top = anchor.top - tooltip.height - GAP;
      left = anchor.left + anchor.width / 2 - tooltip.width / 2;
      break;
    case 'bottom':
      top = anchor.bottom + GAP;
      left = anchor.left + anchor.width / 2 - tooltip.width / 2;
      break;
    case 'left':
      top = anchor.top + anchor.height / 2 - tooltip.height / 2;
      left = anchor.left - tooltip.width - GAP;
      break;
    case 'right':
      top = anchor.top + anchor.height / 2 - tooltip.height / 2;
      left = anchor.right + GAP;
      break;
  }

  // Clamp to viewport edges with 8px margin
  left = Math.max(8, Math.min(left, vw - tooltip.width - 8));
  top = Math.max(8, Math.min(top, vh - tooltip.height - 8));

  return { top, left, actualPlacement: placement };
}

export function useTooltipPosition(
  anchorRef: RefObject<HTMLElement | null>,
  tooltipRef: RefObject<HTMLElement | null>,
  placement: Placement,
  isOpen: boolean,
): Position {
  const [pos, setPos] = useState<Position>({ top: 0, left: 0, actualPlacement: placement });

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    const tooltip = tooltipRef.current;
    if (!anchor || !tooltip) return;
    setPos(computePosition(anchor.getBoundingClientRect(), tooltip.getBoundingClientRect(), placement));
  }, [anchorRef, tooltipRef, placement]);

  useEffect(() => {
    if (!isOpen) return;
    // Initial position (after paint so tooltip has dimensions)
    requestAnimationFrame(update);

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [isOpen, update]);

  return pos;
}
