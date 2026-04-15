import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Users,
  Calculator,
  Briefcase,
  BarChart4,
  GitBranch,
  ShieldAlert,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { useWalkthrough } from '../../contexts/WalkthroughContext';
import { useTooltipPosition, type Placement } from '../../hooks/useTooltipPosition';
import { getTranslations, type Language } from '../../translations';
import type { WalkthroughStep } from '../../constants/walkthroughTours';

const ICON_MAP: Record<NonNullable<WalkthroughStep['iconKey']>, LucideIcon> = {
  welcome: Sparkles,
  commercial: Users,
  pricing: Calculator,
  portfolio: Briefcase,
  analytics: BarChart4,
  config: GitBranch,
  governance: ShieldAlert,
  finish: Rocket,
};

interface StepCardProps {
  title: string;
  description: string;
  stepIndex: number;
  totalSteps: number;
  placement: Placement;
  anchorRef: React.RefObject<HTMLDivElement | null>;
  language: Language;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const StepCard: React.FC<StepCardProps> = ({
  title,
  description,
  stepIndex,
  totalSteps,
  placement,
  anchorRef,
  language,
  onNext,
  onPrev,
  onSkip,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const pos = useTooltipPosition(anchorRef, cardRef, placement, true);
  const t = getTranslations(language);
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      className="fixed z-[62] w-80 animate-[fadeIn_200ms_ease-out] rounded-xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-5 shadow-[var(--nfq-shadow-dialog)]"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--nfq-accent)]">
            {stepIndex + 1} {t.walkthrough_stepOf ?? 'of'} {totalSteps}
          </span>
          <h3 className="mt-1 text-sm font-semibold text-[color:var(--nfq-text-primary)]">{title}</h3>
        </div>
        <button
          onClick={onSkip}
          className="rounded-full p-1 text-[color:var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[color:var(--nfq-text-primary)]"
          aria-label="Close tour"
        >
          <X size={14} />
        </button>
      </div>

      {/* Description */}
      <p className="mb-4 text-xs leading-relaxed text-[color:var(--nfq-text-secondary)]">{description}</p>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-[11px] text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-secondary)]"
        >
          {t.walkthrough_skip ?? 'Skip tour'}
        </button>
        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 rounded-lg border border-[color:var(--nfq-border-ghost)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-elevated)]"
            >
              <ChevronLeft size={12} />
              {t.walkthrough_prev ?? 'Back'}
            </button>
          )}
          <button
            onClick={onNext}
            className="flex items-center gap-1 rounded-lg bg-[var(--nfq-accent)] px-3 py-1.5 text-[11px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            {isLast ? (t.walkthrough_finish ?? 'Finish') : (t.walkthrough_next ?? 'Next')}
            {!isLast && <ChevronRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Spotlight Overlay ──────────────────────────────────────────────── */

interface SpotlightProps {
  rect: DOMRect;
  padding: number;
}

const Spotlight: React.FC<SpotlightProps> = ({ rect, padding }) => {
  const x = rect.left - padding;
  const y = rect.top - padding;
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  const r = 12;

  return (
    <svg className="fixed inset-0 z-[61] h-full w-full" style={{ pointerEvents: 'none' }}>
      <defs>
        <mask id="walkthrough-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.65)"
        mask="url(#walkthrough-mask)"
        style={{ pointerEvents: 'auto' }}
      />
    </svg>
  );
};

/* ─── Centered modal card (business-flow tour) ───────────────────────── */

interface CenteredCardProps {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  stepIndex: number;
  totalSteps: number;
  language: Language;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const CenteredCard: React.FC<CenteredCardProps> = ({
  eyebrow,
  title,
  description,
  icon: Icon,
  stepIndex,
  totalSteps,
  language,
  onNext,
  onPrev,
  onSkip,
}) => {
  const t = getTranslations(language);
  const isLast = stepIndex === totalSteps - 1;
  const isFirst = stepIndex === 0;
  const progressPct = Math.round(((stepIndex + 1) / totalSteps) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="walkthrough-title"
      className="fixed left-1/2 top-1/2 z-[62] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 animate-[fadeIn_220ms_ease-out] rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-7 shadow-[var(--nfq-shadow-dialog)]"
    >
      {/* Close */}
      <button
        onClick={onSkip}
        className="absolute right-4 top-4 rounded-full p-1.5 text-[color:var(--nfq-text-muted)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[color:var(--nfq-text-primary)]"
        aria-label="Close tour"
      >
        <X size={16} />
      </button>

      {/* Icon */}
      {Icon && (
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(var(--nfq-accent-rgb),0.12)] text-[color:var(--nfq-accent)]">
          <Icon size={26} />
        </div>
      )}

      {/* Eyebrow */}
      {eyebrow && (
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--nfq-accent)]">
          {eyebrow}
        </div>
      )}

      {/* Title */}
      <h2 id="walkthrough-title" className="text-2xl font-semibold leading-tight tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
        {title}
      </h2>

      {/* Description */}
      <p className="mt-4 text-sm leading-6 text-[color:var(--nfq-text-secondary)]">
        {description}
      </p>

      {/* Progress bar */}
      <div className="mt-6 flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--nfq-bg-elevated)]">
          <div
            className="h-full rounded-full bg-[color:var(--nfq-accent)] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
          {stepIndex + 1} {t.walkthrough_stepOf ?? 'of'} {totalSteps}
        </span>
      </div>

      {/* Nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onSkip}
          className="text-[11px] text-[color:var(--nfq-text-muted)] transition-colors hover:text-[color:var(--nfq-text-secondary)]"
        >
          {t.walkthrough_skip ?? 'Skip tour'}
        </button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              onClick={onPrev}
              className="flex items-center gap-1 rounded-lg border border-[color:var(--nfq-border-ghost)] px-3 py-1.5 text-[11px] font-medium text-[color:var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-elevated)]"
            >
              <ChevronLeft size={12} />
              {t.walkthrough_prev ?? 'Back'}
            </button>
          )}
          <button
            onClick={onNext}
            className="flex items-center gap-1 rounded-lg bg-[color:var(--nfq-accent)] px-3 py-1.5 text-[11px] font-semibold text-black transition-opacity hover:opacity-90"
          >
            {isLast ? (t.walkthrough_finish ?? 'Finish') : (t.walkthrough_next ?? 'Next')}
            {!isLast && <ChevronRight size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Overlay ───────────────────────────────────────────────────── */

export const WalkthroughOverlay: React.FC<{ language: Language }> = ({ language }) => {
  const { isActive, currentStep, steps, next, prev, skip } = useWalkthrough();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const t = getTranslations(language);

  const step = steps[currentStep];

  // Find and track the target element
  useEffect(() => {
    if (!isActive || !step) {
      setTargetRect(null);
      return;
    }

    // Centered steps skip DOM querying entirely — they render as a modal.
    if (step.centered || !step.targetSelector) {
      setTargetRect(null);
      return;
    }

    // Wait a frame for view navigation / lazy load to settle
    let innerTimerId: ReturnType<typeof setTimeout> | null = null;
    const timerId = setTimeout(() => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Wait for scroll to finish before measuring
        innerTimerId = setTimeout(() => {
          setTargetRect(el.getBoundingClientRect());
        }, 350);
      } else {
        setTargetRect(null);
      }
    }, 150);

    return () => {
      clearTimeout(timerId);
      if (innerTimerId) clearTimeout(innerTimerId);
    };
  }, [isActive, step, currentStep]);

  // Keep anchor div positioned at target center for the StepCard
  useEffect(() => {
    if (!targetRect || !anchorRef.current) return;
    const anchor = anchorRef.current;
    anchor.style.position = 'fixed';
    anchor.style.top = `${targetRect.top + targetRect.height / 2}px`;
    anchor.style.left = `${targetRect.left + targetRect.width / 2}px`;
    anchor.style.width = '1px';
    anchor.style.height = '1px';
  }, [targetRect]);

  const handleSkip = useCallback(() => {
    skip();
  }, [skip]);

  if (!isActive || !step) return null;

  const isCentered = step.centered || !step.targetSelector;

  return ReactDOM.createPortal(
    <>
      {/* Spotlight mask (anchored tooltip tours only) */}
      {targetRect && !isCentered && <Spotlight rect={targetRect} padding={step.highlightPadding ?? 8} />}

      {/* Backdrop. Clicking outside does NOT skip the centered tour —
          the business-flow deck requires explicit skip/finish so the user
          does not dismiss the product overview by accident. */}
      {isCentered && (
        <div className="fixed inset-0 z-[61] bg-black/70 backdrop-blur-[2px]" aria-hidden="true" />
      )}
      {!targetRect && !isCentered && (
        <div className="fixed inset-0 z-[61] bg-black/65" onClick={handleSkip} />
      )}

      {/* Positioning anchor */}
      <div ref={anchorRef} className="pointer-events-none" aria-hidden="true" />

      {/* Centered modal card — business-flow tour or any centered step */}
      {isCentered && (
        <CenteredCard
          eyebrow={step.eyebrowKey ? ((t[step.eyebrowKey as keyof typeof t] as string) ?? step.eyebrowKey) : undefined}
          title={(t[step.titleKey as keyof typeof t] as string) ?? step.titleKey}
          description={(t[step.descriptionKey as keyof typeof t] as string) ?? step.descriptionKey}
          icon={step.iconKey ? ICON_MAP[step.iconKey] : undefined}
          stepIndex={currentStep}
          totalSteps={steps.length}
          language={language}
          onNext={next}
          onPrev={prev}
          onSkip={handleSkip}
        />
      )}

      {/* Tooltip-anchored step card */}
      {!isCentered && targetRect && (
        <StepCard
          title={t[step.titleKey as keyof typeof t] as string ?? step.titleKey}
          description={t[step.descriptionKey as keyof typeof t] as string ?? step.descriptionKey}
          stepIndex={currentStep}
          totalSteps={steps.length}
          placement={step.placement}
          anchorRef={anchorRef}
          language={language}
          onNext={next}
          onPrev={prev}
          onSkip={handleSkip}
        />
      )}

      {/* Fallback when an anchored target is not found */}
      {!isCentered && !targetRect && isActive && (
        <div className="fixed left-1/2 top-1/2 z-[62] w-80 -translate-x-1/2 -translate-y-1/2 animate-[fadeIn_200ms_ease-out] rounded-xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-5 shadow-[var(--nfq-shadow-dialog)]">
          <p className="mb-4 text-xs text-[color:var(--nfq-text-secondary)]">
            {t[step.descriptionKey as keyof typeof t] as string ?? step.descriptionKey}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={handleSkip} className="text-[11px] text-[color:var(--nfq-text-muted)]">
              {t.walkthrough_skip ?? 'Skip'}
            </button>
            <button
              onClick={next}
              className="rounded-lg bg-[var(--nfq-accent)] px-3 py-1.5 text-[11px] font-semibold text-black"
            >
              {t.walkthrough_next ?? 'Next'}
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
};
