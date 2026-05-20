import React from 'react';
import { AlertCircle, Sparkles, Upload, Zap } from 'lucide-react';

/**
 * Reusable empty-state banner. Originally lived under Customer360 — promoted
 * here when ControlRoom, Pipeline and Campaigns needed the same pattern.
 *
 * Two visual shapes:
 *
 *   1. `variant="no-data"` (amber/warning) — there is genuinely nothing to
 *      render and the user needs to bring data in (import, create, seed).
 *
 *   2. `variant="no-snapshot"` (green/success) — data exists but a derived
 *      artefact is missing; one click initialises it.
 *
 * Kept as one component with two variants (not two components) because they
 * share 90% of the shell — a future a11y / design audit only touches one
 * place.
 */

type BannerVariant = 'no-data' | 'no-snapshot';

interface ActionButton {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  /** Renders an `<a href>` instead of `<button>` — useful for anchor CTAs
   *  that deep-link to a route (so middle-click / cmd-click opens a tab). */
  href?: string;
}

interface Props {
  variant: BannerVariant;
  title: string;
  body: string;
  /** Optional smaller hint below the body (e.g. dev seed tip). */
  hint?: string;
  /** Optional error message under the actions (red). */
  errorMessage?: string;
  actions: ActionButton[];
  /** Optional testid override — for a11y-targeted E2E. */
  'data-testid'?: string;
}

const VARIANT_STYLES: Record<BannerVariant, { icon: React.ComponentType<{ className?: string }>; accent: string; ring: string }> = {
  'no-data':     { icon: AlertCircle, accent: 'text-[color:var(--nfq-warning)]', ring: 'border-[color:var(--nfq-warning)]/30 bg-[var(--nfq-warning)]/[0.03]' },
  'no-snapshot': { icon: Sparkles,    accent: 'text-[color:var(--nfq-success)]', ring: 'border-[color:var(--nfq-success)]/30 bg-[var(--nfq-success)]/[0.03]' },
};

const EmptyStateBanner: React.FC<Props> = ({
  variant,
  title,
  body,
  hint,
  errorMessage,
  actions,
  'data-testid': testId,
}) => {
  const { icon: Icon, accent, ring } = VARIANT_STYLES[variant];
  return (
    <section
      data-testid={testId ?? `empty-state-${variant}`}
      className={`rounded-lg border ${ring} p-5 md:p-6 space-y-4`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${accent}`} />
        <div className="min-w-0 space-y-1">
          <h3 className="font-mono text-xs font-medium text-[color:var(--nfq-text-primary)]">{title}</h3>
          <p className="text-xs leading-relaxed text-[color:var(--nfq-text-secondary)]">{body}</p>
          {hint && (
            <p className="font-mono text-[10px] text-[color:var(--nfq-text-faint)]">{hint}</p>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pl-8">
          {actions.map((a, i) => {
            const commonClass = `flex items-center gap-2 px-3 py-1.5 text-[11px] disabled:opacity-60 ${
              a.variant === 'primary'
                ? 'nfq-button nfq-button-primary'
                : 'nfq-button nfq-button-ghost'
            }`;
            const IconA = a.icon;
            if (a.href) {
              return (
                <a
                  key={i}
                  href={a.href}
                  onClick={(e) => { e.preventDefault(); a.onClick(); }}
                  className={commonClass}
                  data-testid={`banner-action-${i}`}
                >
                  {IconA && <IconA className="h-3 w-3" />}
                  {a.label}
                </a>
              );
            }
            return (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                className={commonClass}
                data-testid={`banner-action-${i}`}
              >
                {IconA && <IconA className="h-3 w-3" />}
                {a.label}
              </button>
            );
          })}
        </div>
      )}

      {errorMessage && (
        <p className="pl-8 font-mono text-[10px] text-[color:var(--nfq-danger)]">{errorMessage}</p>
      )}
    </section>
  );
};

export { Upload as ImportIcon, Zap as InitializeIcon };
export default EmptyStateBanner;
