import React, { useEffect } from 'react';
import { X, Moon, Sun, Languages, Check } from 'lucide-react';
import { translations, Language } from '../../translations';
import { MFASetup } from './MFASetup';

interface UserConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    userEmail?: string;
}

export const UserConfigModal: React.FC<UserConfigModalProps> = ({
    isOpen,
    onClose,
    language,
    setLanguage,
    theme,
    setTheme,
    userEmail = '',
}) => {
    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const t = translations[language];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal - Lateral Right */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="user-config-modal-title"
                className="fixed right-0 top-0 z-[101] flex h-full w-full max-w-sm transform flex-col border-l border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] shadow-dialog transition-transform duration-300"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[color:var(--nfq-border-ghost)] px-6 py-6">
                    <h2 id="user-config-modal-title" className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em] text-[color:var(--nfq-text-primary)]">
                        <span className="h-2 w-2 rounded-full bg-cyan-500"></span>
                        {t.userConfig}
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Close settings"
                        className="rounded-full p-2 text-[color:var(--nfq-text-secondary)] transition-colors hover:bg-[var(--nfq-bg-elevated)] hover:text-[color:var(--nfq-text-primary)]"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
                            <Moon size={16} />
                            {t.theme}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                { id: 'dark', label: t.dark, icon: Moon, tone: 'bg-[var(--nfq-bg-root)] text-white' },
                                { id: 'light', label: t.light, icon: Sun, tone: 'bg-white text-slate-900' },
                            ] as const).map(({ id, label, icon: Icon, tone }) => (
                                <button
                                    key={id}
                                    onClick={() => setTheme(id)}
                                    className={`rounded-2xl border p-4 text-left transition-all ${theme === id
                                        ? 'border-cyan-500/40 bg-cyan-500/10 shadow-[0_16px_28px_rgba(6,182,212,0.08)]'
                                        : 'border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] hover:border-cyan-500/20'
                                        }`}
                                >
                                    <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="text-sm font-semibold text-[color:var(--nfq-text-primary)]">{label}</div>
                                    <div className="mt-1 text-xs text-[color:var(--nfq-text-muted)]">
                                        {id === 'dark' ? t.darkModeDescription : t.lightModeDescription}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Language Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
                            <Languages size={16} />
                            {t.language}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {(['en', 'es'] as Language[]).map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => setLanguage(lang)}
                                    className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${language === lang
                                        ? 'border-cyan-500/40 bg-cyan-500/10 text-[color:var(--nfq-text-primary)]'
                                        : 'border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] text-[color:var(--nfq-text-secondary)] hover:border-cyan-500/20'
                                        }`}
                                >
                                    <span className="text-sm font-semibold uppercase tracking-[0.14em]">{lang}</span>
                                    {language === lang && <Check size={16} className="text-cyan-500" />}
                                </button>
                            ))}
                        </div>
                    </section>


                    {/* Security — MFA */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-[color:var(--nfq-text-muted)]">
                            {t.twoFactorAuth}
                        </div>
                        <MFASetup userEmail={userEmail} />
                    </section>

                    {/* Contrast Note */}
                    <div className="rounded-2xl border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] p-4">
                        <p className="text-xs italic leading-relaxed text-[color:var(--nfq-text-muted)]">
                            {t.configNote}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[color:var(--nfq-border-ghost)] p-6">
                    <button
                        onClick={onClose}
                        className="nfq-button nfq-button-primary w-full justify-center text-sm"
                    >
                        {t.save}
                    </button>
                </div>
            </div>
        </>
    );
};
