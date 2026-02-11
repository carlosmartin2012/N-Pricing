import React from 'react';
import { X, Moon, Sun, Languages, Check } from 'lucide-react';
import { translations, Language } from '../../translations';

interface UserConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
}

export const UserConfigModal: React.FC<UserConfigModalProps> = ({
    isOpen,
    onClose,
    language,
    setLanguage,
    theme,
    setTheme,
}) => {
    if (!isOpen) return null;

    const t = translations[language];

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] transition-opacity"
                onClick={onClose}
            />

            {/* Modal - Lateral Right */}
            <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-[#050505] border-l border-slate-200 dark:border-slate-800 shadow-2xl z-[101] transform transition-transform duration-300 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="w-2 h-2 bg-cyan-500 rounded-full"></span>
                        {t.userConfig}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 space-y-8 overflow-y-auto">
                    {/* Language Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            <Languages size={18} />
                            {t.language}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {(['en', 'es'] as Language[]).map((lang) => (
                                <button
                                    key={lang}
                                    onClick={() => setLanguage(lang)}
                                    className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${language === lang
                                            ? 'border-cyan-500 bg-cyan-500/5 dark:bg-cyan-500/10 text-slate-900 dark:text-white'
                                            : 'border-slate-100 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 text-slate-500'
                                        }`}
                                >
                                    <span className="font-bold uppercase">{lang}</span>
                                    {language === lang && <Check size={16} className="text-cyan-500" />}
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Theme Section */}
                    <section className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                            {t.theme}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {(['light', 'dark'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setTheme(mode)}
                                    className={`flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all ${theme === mode
                                            ? 'border-cyan-500 bg-cyan-500/5 dark:bg-cyan-500/10 text-slate-900 dark:text-white'
                                            : 'border-slate-100 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700 text-slate-500'
                                        }`}
                                >
                                    <div className="w-full flex items-center justify-between">
                                        {mode === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                                        {theme === mode && <Check size={16} className="text-cyan-500" />}
                                    </div>
                                    <span className="font-bold">{t[mode]}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Contrast Note */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800/50">
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed italic">
                            Configura tus preferencias visuales y de idioma para una mejor experiencia en N Pricing.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-slate-900">
                    <button
                        onClick={onClose}
                        className="w-full bg-slate-900 dark:bg-white text-white dark:text-black py-3 rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors shadow-lg"
                    >
                        {t.save}
                    </button>
                </div>
            </div>
        </>
    );
};
