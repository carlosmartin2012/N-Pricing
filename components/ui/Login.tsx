import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, LockKeyhole, Loader2, ShieldCheck } from 'lucide-react';
import { getTranslations, Language } from '../../translations';
import { Logo } from './Logo';

interface LoginProps {
  onLogin: (email: string) => void;
  whitelistedEmails?: string[];
  language: Language;
}

const DEMO_USER = import.meta.env.VITE_DEMO_USER || '';
const DEMO_PASS = import.meta.env.VITE_DEMO_PASS || '';
const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL || '';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// _gisInitialized moved to useRef inside Login component (survives HMR correctly)

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (momentListener?: (n: GoogleNotification) => void) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          cancel: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

interface GoogleNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getNotDisplayedReason: () => string;
}

export const Login: React.FC<LoginProps> = ({ onLogin, language }) => {
  const t = getTranslations(language);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gisReady, setGisReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showFallbackBtn, setShowFallbackBtn] = useState(false);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const gisInitializedRef = useRef(false);
  const googleLoadingResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (googleLoadingResetRef.current) {
        clearTimeout(googleLoadingResetRef.current);
        googleLoadingResetRef.current = null;
      }
    };
  }, []);

  const handleCredentialResponse = useCallback(async (response: { credential: string }) => {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json() as { email?: string; name?: string; token?: string; error?: string };
      if (!res.ok || !data.email) {
        throw new Error(data.error || 'Google authentication failed');
      }
      if (data.token) {
        localStorage.setItem('n_pricing_auth_token', data.token);
      }
      onLogin(data.email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed. Please try demo access.');
    } finally {
      setGoogleLoading(false);
    }
  }, [onLogin]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const initGis = () => {
      if (!window.google?.accounts?.id || gisInitializedRef.current) return;
      gisInitializedRef.current = true;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
        itp_support: true,
      });
      setGisReady(true);
    };

    let scriptEl: HTMLScriptElement | null = null;
    if (window.google?.accounts?.id) {
      initGis();
    } else {
      scriptEl = document.querySelector<HTMLScriptElement>('script[src*="accounts.google.com/gsi"]');
      scriptEl?.addEventListener('load', initGis, { once: true });
    }

    return () => {
      scriptEl?.removeEventListener('load', initGis);
    };
  }, [handleCredentialResponse]);

  useEffect(() => {
    if (showFallbackBtn && fallbackRef.current && window.google?.accounts?.id && GOOGLE_CLIENT_ID) {
      fallbackRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(fallbackRef.current, {
        theme: 'filled_black',
        size: 'large',
        type: 'standard',
        shape: 'pill',
        text: 'continue_with',
        width: String(fallbackRef.current.offsetWidth || 360),
        logo_alignment: 'left',
      });
    }
  }, [showFallbackBtn]);

  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Sign-In is not configured.');
      return;
    }
    if (!gisReady || !window.google?.accounts?.id) {
      setError('Google Sign-In is loading. Please try again in a moment.');
      return;
    }

    setError(null);
    setGoogleLoading(true);

    window.google.accounts.id.prompt((notification: GoogleNotification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setShowFallbackBtn(true);
        setGoogleLoading(false);
      }
    });

    if (googleLoadingResetRef.current) clearTimeout(googleLoadingResetRef.current);
    googleLoadingResetRef.current = setTimeout(() => {
      googleLoadingResetRef.current = null;
      setGoogleLoading(false);
    }, 3000);
  };

  const handleDemoLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/auth/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json() as { token?: string; email?: string; name?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? 'Invalid credentials.');
        return;
      }
      localStorage.setItem('n_pricing_auth_token', data.token);
      onLogin(data.email ?? DEMO_EMAIL);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  };

  return (
    <div data-testid="login-page" className="relative min-h-screen overflow-hidden bg-[var(--nfq-bg-root)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(83,221,252,0.15),transparent_22%),radial-gradient(circle_at_85%_12%,rgba(139,92,246,0.11),transparent_16%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_25%)]" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.12fr_0.88fr]">
        <section className="hidden min-h-screen flex-col justify-between px-10 py-10 lg:flex xl:px-14">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[color:rgba(var(--nfq-accent-rgb),0.12)] shadow-[inset_0_0_0_1px_rgba(var(--nfq-accent-rgb),0.18)]">
              <Logo className="h-8 w-8" />
            </div>
            <div>
              <div className="nfq-label">NFQ Advisory</div>
              <div className="text-2xl font-semibold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
                N Pricing
              </div>
            </div>
          </div>

          <div className="max-w-3xl">
            <span className="nfq-pill mb-8">Integrated Bank Pricing Platform</span>
            <h1 className="text-[clamp(3.1rem,5vw,5.4rem)] font-semibold leading-[1.02] tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
              Pricing de banca, de extremo a extremo.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--nfq-text-secondary)]">
              Pricing cliente, canal en tiempo real y transfer pricing interno sobre un mismo motor. Multi-tenant con RLS estricto, snapshot inmutable con <span className="text-[color:var(--nfq-text-primary)]">tamper-evidence chain</span> por requerimiento regulatorio, stress EBA de 6 escenarios y gobierno MRM integrado.
            </p>

            <div className="mt-12 grid max-w-3xl grid-cols-2 gap-4 xl:grid-cols-4 xl:gap-3">
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Customer</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-warning)]">360°</div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">Visión relacional, cross-bonus por posiciones reales, targets top-down y campañas versionadas.</div>
              </div>
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Channel</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-accent)]">API</div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">Quote en tiempo real — API key, rate-limit y token bucket por canal (sucursal, web, móvil, partner).</div>
              </div>
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Engine</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-violet-300">FTP · 19</div>
                <div className="mt-3 flex flex-wrap gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--nfq-text-muted)]">
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">Base</span>
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">LP</span>
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">LCR</span>
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">NSFR</span>
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">Capital</span>
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">CSRBB</span>
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">ESG</span>
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">Floor CRR3</span>
                  <span className="rounded-md bg-white/[0.035] px-1.5 py-0.5">RAROC</span>
                </div>
              </div>
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Stress</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-cyan-300">EBA · 6</div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">Parallel ±200, short ±250, steepener, flattener — ΔFTP, ΔMargin, ΔRAROC per-tenor, no solo ΔEVE.</div>
              </div>
            </div>
          </div>

          <div className="grid max-w-3xl grid-cols-3 gap-6 text-sm text-[color:var(--nfq-text-secondary)]">
            <div>
              <div className="nfq-label">Cliente y canal</div>
              <p className="mt-3 leading-6">Customer 360 relacional con cross-bonus por posiciones reales, targets top-down, campañas con state machine y channel API con rate-limit + token bucket por canal.</p>
            </div>
            <div>
              <div className="nfq-label">Motor de pricing</div>
              <p className="mt-3 leading-6">19 componentes parametrizables (base, liquidez, capital, ESG, output floor CRR3), RAROC con economic profit, stress EBA 6 escenarios y reconciliación FTP ↔ provisión ↔ capital.</p>
            </div>
            <div>
              <div className="nfq-label">Gobierno y reproducibilidad</div>
              <p className="mt-3 leading-6">Multi-tenant strict RLS, snapshot por ejecución con <span className="text-[color:var(--nfq-text-primary)]">hash chain + replay diff</span>, MRM SR 11-7 / EBA, y SLO con alertas auto-seeded en 5 canales + widget de tenancy violations.</p>
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-md rounded-[30px] bg-[var(--nfq-bg-surface)] p-2 shadow-[var(--nfq-shadow-dialog)]">
            <div className="rounded-[26px] bg-[var(--nfq-bg-elevated)] px-7 py-7">
              <div className="nfq-eyebrow">Secure Access</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
                {t.login}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[color:var(--nfq-text-secondary)]">
                Enter the governed pricing workspace with your NFQ identity.
              </p>

              <div className="mt-8 space-y-4">

                {GOOGLE_CLIENT_ID && !showFallbackBtn && (
                  <button
                    data-testid="google-login-btn"
                    onClick={handleGoogleClick}
                    disabled={googleLoading}
                    className="flex w-full items-center justify-between rounded-[22px] bg-white px-5 py-4 text-black transition-colors hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                        {googleLoading
                          ? <Loader2 size={22} className="animate-spin text-slate-500" />
                          : <img src="https://www.google.com/favicon.ico" alt="Google" className="h-6 w-6" />
                        }
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold tracking-[-0.01em]">Continue with your NFQ account</div>
                        <div className="text-xs text-slate-500">
                          {gisReady ? 'Sign in with Google' : 'Loading Google Sign-In…'}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={18} />
                  </button>
                )}

                {GOOGLE_CLIENT_ID && showFallbackBtn && (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-[color:var(--nfq-text-secondary)]">
                      Use the button below to sign in with Google:
                    </p>
                    <div ref={fallbackRef} className="w-full" />
                  </div>
                )}

                {(DEMO_USER && DEMO_PASS) && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-[color:var(--nfq-border-ghost)]" />
                      <span className="nfq-label">Demo access</span>
                      <div className="h-px flex-1 bg-[color:var(--nfq-border-ghost)]" />
                    </div>

                    <form onSubmit={handleDemoLogin} className="space-y-3">
                      <input
                        data-testid="demo-username"
                        type="text"
                        placeholder="Username"
                        autoComplete="username"
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className="nfq-input-field"
                      />
                      <input
                        data-testid="demo-password"
                        type="password"
                        placeholder="Password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="nfq-input-field"
                      />
                      <button
                        data-testid="demo-login-btn"
                        type="submit"
                        className="nfq-button nfq-button-primary w-full justify-center text-sm"
                      >
                        <LockKeyhole size={15} />
                        Sign In
                      </button>
                    </form>
                  </>
                )}

                {error && (
                  <div
                    data-testid="login-error"
                    role="alert"
                    aria-live="polite"
                    className="flex items-start gap-3 rounded-[20px] bg-[var(--nfq-danger-subtle)] px-4 py-3 text-left text-xs leading-5 text-[color:var(--nfq-danger)]"
                  >
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="rounded-[22px] bg-[var(--nfq-bg-surface)] px-5 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:rgba(var(--nfq-accent-rgb),0.14)] text-[color:var(--nfq-accent)]">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">Workspace posture</div>
                      <div className="text-xs text-[color:var(--nfq-text-secondary)]">Strict RLS · hash-chain snapshots · MRM inventory · SLO alerting</div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">
                    <div className="rounded-lg bg-[rgba(var(--nfq-accent-rgb),0.06)] px-2 py-1.5 text-center">
                      <span className="block text-[color:var(--nfq-accent)]">360°</span>
                      <span>customer</span>
                    </div>
                    <div className="rounded-lg bg-[rgba(var(--nfq-accent-rgb),0.06)] px-2 py-1.5 text-center">
                      <span className="block text-[color:var(--nfq-accent)]">API</span>
                      <span>channels</span>
                    </div>
                    <div className="rounded-lg bg-[rgba(var(--nfq-accent-rgb),0.06)] px-2 py-1.5 text-center">
                      <span className="block text-[color:var(--nfq-accent)]">FTP · 19</span>
                      <span>engine</span>
                    </div>
                    <div className="rounded-lg bg-[rgba(var(--nfq-accent-rgb),0.06)] px-2 py-1.5 text-center">
                      <span className="block text-[color:var(--nfq-accent)]">EBA · 6</span>
                      <span>stress</span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[11px] leading-5 text-[color:var(--nfq-text-muted)]">
                  {t.agree}{' '}
                  <a href="#" className="underline underline-offset-4">{t.terms}</a>{' '}
                  {t.and}{' '}
                  <a href="#" className="underline underline-offset-4">{t.privacy}</a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-0 right-0 z-10 text-center text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--nfq-text-faint)]">
        {t.footer}
      </div>
    </div>
  );
};
