import React from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
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

export const Login: React.FC<LoginProps> = ({ onLogin, language }) => {
  const t = translations[language];
  const [error, setError] = React.useState<string | null>(null);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleGoogleLogin = () => {
    // Google OAuth disabled — use demo credentials or configure Google Cloud Console
    setError('Google Sign-In is being configured. Please use demo credentials below.');
  };

  // Google credential response handler placeholder
  const handleCredentialResponse = (_response: unknown) => {
    // Placeholder — Google OAuth not loaded
    setError('Google Sign-In not available. Use demo credentials.');
  };

  // Compatibility shim
  const login = handleGoogleLogin;
  void handleCredentialResponse;

  const [showFallbackLogin, setShowFallbackLogin] = React.useState(false);
  void showFallbackLogin;
  void setShowFallbackLogin;

  const handleDemoLogin = (event: React.FormEvent) => {
    event.preventDefault();
    if (username === DEMO_USER && password === DEMO_PASS) {
      setError(null);
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
              Governed pricing operations for treasury, risk and committee review.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--nfq-text-secondary)]">
              {t.subtitle}. Dark-first, capital-aware and structured around the Meridian Obsidian system from NFQ.
            </p>

            <div className="mt-12 grid max-w-3xl grid-cols-3 gap-4">
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Governance</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-accent)]">
                  M/C
                </div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">
                  Maker-checker workflows and live methodology traceability.
                </div>
              </div>
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Decisioning</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-[color:var(--nfq-warning)]">
                  RAROC
                </div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">
                  FTP, risk, ESG and accounting under one controlled flow.
                </div>
              </div>
              <div className="rounded-[24px] bg-[var(--nfq-bg-surface)] px-5 py-5 shadow-[var(--nfq-shadow-platform)]">
                <div className="nfq-label">Evidence</div>
                <div className="mt-3 font-mono text-[34px] font-bold tracking-[var(--nfq-tracking-tight)] text-violet-300">
                  AI
                </div>
                <div className="mt-2 text-sm text-[color:var(--nfq-text-secondary)]">
                  Grounded dossiers, committee packs and governed export trails.
                </div>
              </div>
            </div>
          </div>

          <div className="grid max-w-3xl grid-cols-3 gap-6 text-sm text-[color:var(--nfq-text-secondary)]">
            <div>
              <div className="nfq-label">Pricing stack</div>
              <p className="mt-3 leading-6">
                Matched maturity, moving average, rate cards and zero discount methodologies.
              </p>
            </div>
            <div>
              <div className="nfq-label">Portfolio view</div>
              <p className="mt-3 leading-6">
                Snapshots, shocks, reporting and accounting views operating in the same shell.
              </p>
            </div>
            <div>
              <div className="nfq-label">Visual posture</div>
              <p className="mt-3 leading-6">
                Tonal layering, restrained chrome and machine-grade data typography throughout.
              </p>
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
                <button
                  data-testid="google-login-btn"
                  onClick={() => login()}
                  className="flex w-full items-center justify-between rounded-[22px] bg-white px-5 py-4 text-black transition-colors hover:bg-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="h-6 w-6" />
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold tracking-[-0.01em]">Continue with your NFQ account</div>
                      <div className="text-xs text-slate-500">Google OAuth (coming soon)</div>
                    </div>
                  </div>
                  <ArrowRight size={18} />
                </button>

                {false && (
                  <button
                    onClick={() => {}}
                    className="mt-2 w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-400 transition hover:bg-cyan-500/20"
                  >
                    Popup blocked? Try alternative Sign-In method
                  </button>
                )}

                {DEMO_USER && DEMO_PASS && (
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
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        className="nfq-input-field"
                      />
                      <input
                        data-testid="demo-password"
                        type="password"
                        placeholder="Password"
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
                      <div className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">
                        Workspace posture
                      </div>
                      <div className="text-xs text-[color:var(--nfq-text-secondary)]">
                        Pricing, governance and evidence shell
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[11px] leading-5 text-[color:var(--nfq-text-muted)]">
                  {t.agree}{' '}
                  <a href="#" className="underline underline-offset-4">
                    {t.terms}
                  </a>{' '}
                  {t.and}{' '}
                  <a href="#" className="underline underline-offset-4">
                    {t.privacy}
                  </a>
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
