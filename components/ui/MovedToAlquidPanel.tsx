import React from 'react';
import { ExternalLink, Layers } from 'lucide-react';
import {
  ALQUID_FEATURE_LABELS,
  getAlquidDeepLink,
  type AlquidFeature,
} from '../../constants/alquidDeepLinks';

interface Props {
  feature: AlquidFeature;
}

/**
 * Rendered in place of ALM-adjacent dashboards when
 * VITE_NPRICING_DEPRECATE_ALM=true. Provides a deep-link to Alquid
 * for continuity (piloto still gets the capability, just in its proper home).
 */
const MovedToAlquidPanel: React.FC<Props> = ({ feature }) => {
  const deepLink = getAlquidDeepLink(feature);
  const labels = ALQUID_FEATURE_LABELS[feature];

  return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-4 rounded-[24px] bg-[var(--nfq-bg-surface)] px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)]">
        <Layers size={28} className="text-[var(--nfq-accent)] opacity-80" />
      </div>
      <div className="max-w-md">
        <div className="text-[10px] uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)] font-mono">
          Moved to Alquid
        </div>
        <h3 className="mt-2 text-lg font-semibold text-[color:var(--nfq-text-primary)]">
          {labels.title}
        </h3>
        <p className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">
          {labels.blurb} N-Pricing focuses on pricing; ALM capabilities live in
          the Alquid module of the NFQ suite.
        </p>
      </div>
      {deepLink ? (
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded bg-[var(--nfq-accent)] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
        >
          Open in Alquid
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : (
        <p className="max-w-sm text-[11px] text-[color:var(--nfq-text-muted)]">
          Configure <code className="font-mono text-[var(--nfq-accent)]">VITE_ALQUID_BASE_URL</code>{' '}
          to enable deep-link navigation to Alquid.
        </p>
      )}
    </div>
  );
};

export default MovedToAlquidPanel;
