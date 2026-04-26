import React from 'react';
import { AlertCircle, Sparkles, Upload, Zap } from 'lucide-react';

/**
 * Reusable empty-state banner for the Customer 360 surface.
 *
 * Two shapes the banker sees when landing on a freshly-selected client:
 *
 *   1. `variant="no-data"` — client has no positions at all. Next step is
 *      importing from the CSV or seeding demo data. No CLV button here
 *      because there is nothing to project.
 *
 *   2. `variant="no-snapshot"` — client has positions but no LTV snapshot
 *      yet. Next step is a single-click "Initialize CLV" that fires the
 *      recompute + nba-generate composite mutation and unlocks all 4 tabs.
 *
 * Kept as a single component (not two) because they share 90% of the
 * shell (same spacing, same typography, same NFQ dark tokens) and we
 * want a future accessibility / design audit to only touch one place.
 */

type BannerVariant = 'no-data' | 'no-snapshot';

interface ActionButton {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  /** Renders a `<a href>` instead of a `<button>` — used for anchor CTAs
   *  like "Import positions" that should deep-link to an endpoint. */
  href?: string;
}

interface Props {
  variant: BannerVariant;
  title: string;
  body: string;
  /** Optional smaller hint line below the body (e.g. dev seed tip). */
  hint?: string;
  /** Optional error message to show below the actions (red). */
  errorMessage?: string;
  actions: ActionButton[];
  /** Optional testid override — for a11y-targeted E2E. */
  'data-testid'?: string;
}

const VARIANT_STYLES: Record<BannerVariant, { icon: React.ComponentType<{ className?: string }>; accent: string; ring: string }> = {
  'no-data':     { icon: AlertCircle, accent: 'text-amber-300',   ring: 'border-amber-400/30 bg-amber-500/[0.03]' },
  'no-snapshot': { icon: Sparkles,    accent: 'text-emerald-300', ring: 'border-emerald-400/30 bg-emerald-500/[0.03]' },
};

const ClientEmptyStateBanner: React.FC<Props> = ({
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
      data-testid={testId ?? `client-empty-state-${variant}`}
      className={`rounded-lg border ${ring} p-5 md:p-6 space-y-4`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${accent}`} />
        <div className="min-w-0 space-y-1">
          <h3 className="font-mono text-xs font-medium text-white">{title}</h3>
          <p className="text-xs leading-relaxed text-slate-300">{body}</p>
          {hint && (
            <p className="font-mono text-[10px] text-slate-500">{hint}</p>
          )}
        </div>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pl-8">
          {actions.map((a, i) => {
            const commonClass = `flex items-center gap-2 px-3 py-1.5 text-[11px] disabled:opacity-60 ${
              a.variant === 'primary'
                ? 'nfq-btn-primary'
                : 'nfq-btn-ghost'
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
        <p className="pl-8 font-mono text-[10px] text-rose-300">{errorMessage}</p>
      )}
    </section>
  );
};

export { Upload as ImportIcon, Zap as InitializeIcon };
export default ClientEmptyStateBanner;
