import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, LockKeyhole, Loader2, ShieldCheck } from 'lucide-react';
import { translations, Language } from '../../translations';
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
  const t = translations[language];
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

  const handleDemoLogin = (event: React.FormEvent) => {
    event.preventDefault();
    if (username === DEMO_USER && password === DEMO_PASS) {
      setError(null);
      localStorage.setItem('n_pricing_auth_token', 'demo-token');
      onLogin(DEMO_EMAIL);
      return;
    }
    setError('Invalid credentials.');
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
            <span className="nfq-pill mb-8">Meridian Obsidian Control Shell</span>
            <h1 className="text-[clamp(3.1rem,5vw,5.4rem)] font-semibold leading-[1.02] tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
              Pricing, provisión y capital reconciliados por diseño.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--nfq-text-secondary)]">
              {t.subtitle}. Del parámetro al RAROC y del RAROC al comité sobre una única fuente de verdad — Anejo IX nativo, CRR3 con output floor, AI copilot grounded y replay bitemporal.
            </p>

            <div className="mt-12 grid max-w-3xl grid-cols-3 gap-4">
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Anejo IX</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-accent)]">IFRS 9</div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">Stage 1/2/3 con lifetime EL y SICR — segmentos BdE out-of-the-box.</div>
              </div>
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Capital</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-warning)]">CRR3</div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">Output floor phase-in 50 % → 72,5 % y buffer stack Basel III.</div>
              </div>
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Intelligence</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-violet-300">AI</div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">Waterfall explainer grounded, portfolio agent y lineage bitemporal.</div>
              </div>
            </div>
          </div>

          <div className="grid max-w-3xl grid-cols-3 gap-6 text-sm text-[color:var(--nfq-text-secondary)]">
            <div>
              <div className="nfq-label">Motor de cálculo</div>
              <p className="mt-3 leading-6">19 componentes FTP parametrizables — base rate, LP, LCR/NSFR, capital, CSRBB y delegación multi-dimensional.</p>
            </div>
            <div>
              <div className="nfq-label">Stress &amp; reconciliación</div>
              <p className="mt-3 leading-6">6 escenarios EBA, ΔEVE/ΔNII y reconciliación garantizada FTP ↔ provisión ↔ capital sobre un solo árbol.</p>
            </div>
            <div>
              <div className="nfq-label">Governance</div>
              <p className="mt-3 leading-6">MRM model inventory TRIM/SS1-23, audit trail inmutable, replay bitemporal para disputas y supervisor.</p>
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
                    className="rounded-[20px] bg-[var(--nfq-danger-subtle)] px-4 py-3 text-center text-xs text-[color:var(--nfq-danger)]"
                  >
                    {error}
                  </div>
                )}

                <div className="rounded-[22px] bg-[var(--nfq-bg-surface)] px-5 py-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:rgba(var(--nfq-accent-rgb),0.14)] text-[color:var(--nfq-accent)]">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">Workspace posture</div>
                      <div className="text-xs text-[color:var(--nfq-text-secondary)]">Pricing, governance and evidence shell</div>
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
