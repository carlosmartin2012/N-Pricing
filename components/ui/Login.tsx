import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, LockKeyhole, Loader2 } from 'lucide-react';
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
    return () => { scriptEl?.removeEventListener('load', initGis); };
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
    if (!GOOGLE_CLIENT_ID) { setError('Google Sign-In is not configured.'); return; }
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
      if (!res.ok || !data.token) { setError(data.error ?? 'Invalid credentials.'); return; }
      localStorage.setItem('n_pricing_auth_token', data.token);
      onLogin(data.email ?? DEMO_EMAIL);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  };

  return (
    <div data-testid="login-page" className="relative min-h-screen overflow-hidden bg-[var(--nfq-bg-root)]">
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(var(--nfq-border-ghost) 1px, transparent 1px), linear-gradient(90deg, var(--nfq-border-ghost) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />
      {/* Glow accents */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_10%_20%,rgba(83,221,252,0.08),transparent),radial-gradient(ellipse_40%_40%_at_90%_10%,rgba(139,92,246,0.07),transparent)]" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">

        {/* ── Left panel ── */}
        <section className="hidden min-h-screen flex-col justify-between px-12 py-10 lg:flex xl:px-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--nfq-radius-card)] bg-[color:rgba(var(--nfq-accent-rgb),0.12)] shadow-[inset_0_0_0_1px_rgba(var(--nfq-accent-rgb),0.18)]">
              <Logo className="h-6 w-6" />
            </div>
            <span className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--nfq-text-muted)]">
              NFQ Advisory · N Pricing
            </span>
          </div>

          {/* Headline */}
          <div>
            <h1 className="text-[clamp(3rem,4.8vw,5rem)] font-semibold leading-[1.03] tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
              Pricing de banca,<br />
              <span className="text-[color:var(--nfq-accent)]">de extremo</span><br />
              a extremo.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-[color:var(--nfq-text-secondary)]">
              Motor FTP unificado para pricing cliente, canal en tiempo real y transfer pricing interno — con gobierno MRM y stress EBA integrados.
            </p>
          </div>

          {/* 3 bullets */}
          <ul className="space-y-5 text-sm text-[color:var(--nfq-text-secondary)]">
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--nfq-accent)]" />
              <div>
                <span className="font-semibold text-[color:var(--nfq-text-primary)]">Customer 360 &amp; campañas</span>
                <br />
                Visión relacional, cross-bonus por posiciones reales, targets top-down y campañas versionadas.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--nfq-accent)]" />
              <div>
                <span className="font-semibold text-[color:var(--nfq-text-primary)]">Motor de 19 componentes</span>
                <br />
                Base, liquidez, capital, ESG, floor CRR3, RAROC con economic profit y stress EBA en 6 escenarios.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--nfq-accent)]" />
              <div>
                <span className="font-semibold text-[color:var(--nfq-text-primary)]">Gobierno y reproducibilidad</span>
                <br />
                Multi-tenant RLS, snapshot con hash-chain, MRM SR 11-7 / EBA y SLO alerting integrado.
              </div>
            </li>
          </ul>
        </section>

        {/* ── Right panel — login card ── */}
        <section className="flex min-h-screen items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-sm">
            <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-surface)] p-1.5 shadow-[var(--nfq-shadow-dialog)]">
              <div className="rounded-[var(--nfq-radius-card)] bg-[var(--nfq-bg-elevated)] px-7 py-8">

                <h2 className="text-2xl font-semibold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-text-primary)]">
                  Bienvenido
                </h2>
                <p className="mt-1.5 text-sm text-[color:var(--nfq-text-secondary)]">
                  Inicia sesión con tu cuenta corporativa para continuar.
                </p>

                <div className="mt-7 space-y-3">
                  {/* Google SSO */}
                  {GOOGLE_CLIENT_ID && !showFallbackBtn && (
                    <button
                      data-testid="google-login-btn"
                      onClick={handleGoogleClick}
                      disabled={googleLoading}
                      className="flex w-full items-center gap-3 rounded-[var(--nfq-radius-card)] bg-white px-4 py-3.5 text-black transition-colors hover:bg-[var(--nfq-bg-surface)] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--nfq-bg-surface)]">
                        {googleLoading
                          ? <Loader2 size={18} className="animate-spin text-[color:var(--nfq-text-faint)]" />
                          : <img src="https://www.google.com/favicon.ico" alt="Google" className="h-5 w-5" />
                        }
                      </div>
                      <span className="flex-1 text-left text-sm font-semibold">
                        {gisReady ? 'Continuar con Google' : 'Cargando Google…'}
                      </span>
                      <ArrowRight size={16} className="text-[color:var(--nfq-text-muted)]" />
                    </button>
                  )}

                  {GOOGLE_CLIENT_ID && showFallbackBtn && (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-[color:var(--nfq-text-secondary)]">Usa el botón para acceder con Google:</p>
                      <div ref={fallbackRef} className="w-full" />
                    </div>
                  )}

                  {/* Divider */}
                  {(DEMO_USER && DEMO_PASS) && (
                    <div className="flex items-center gap-3 py-1">
                      <div className="h-px flex-1 bg-[color:var(--nfq-border-ghost)]" />
                      <span className="text-[11px] uppercase tracking-[0.12em] text-[color:var(--nfq-text-muted)]">o</span>
                      <div className="h-px flex-1 bg-[color:var(--nfq-border-ghost)]" />
                    </div>
                  )}

                  {/* Demo form */}
                  {(DEMO_USER && DEMO_PASS) && (
                    <form onSubmit={handleDemoLogin} className="space-y-2.5">
                      <input
                        data-testid="demo-username"
                        type="text"
                        placeholder="Usuario"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="nfq-input-field"
                      />
                      <input
                        data-testid="demo-password"
                        type="password"
                        placeholder="Contraseña"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="nfq-input-field"
                      />
                      <button
                        data-testid="demo-login-btn"
                        type="submit"
                        className="nfq-button nfq-button-primary w-full justify-center text-sm"
                      >
                        <LockKeyhole size={14} />
                        Acceder
                      </button>
                    </form>
                  )}

                  {error && (
                    <div
                      data-testid="login-error"
                      role="alert"
                      aria-live="polite"
                      className="flex items-start gap-2.5 rounded-[var(--nfq-radius-card)] bg-[var(--nfq-danger-subtle)] px-4 py-3 text-xs leading-5 text-[color:var(--nfq-danger)]"
                    >
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Legal */}
            <p className="mt-5 text-center text-[11px] leading-5 text-[color:var(--nfq-text-muted)]">
              {t.agree}{' '}
              <a href="#" className="underline underline-offset-4">{t.terms}</a>{' '}
              {t.and}{' '}
              <a href="#" className="underline underline-offset-4">{t.privacy}</a>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
