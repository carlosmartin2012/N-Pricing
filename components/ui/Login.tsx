import React from 'react';
import { translations, Language } from '../../translations';
import { Sidebar } from './Sidebar';

import { useGoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { WHITELISTED_EMAILS } from '../../constants';

interface LoginProps {
    onLogin: (email: string) => void;
    language: Language;
}

export const Login: React.FC<LoginProps> = ({ onLogin, language }) => {
    const t = translations[language];
    const [error, setError] = React.useState<string | null>(null);

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                // Fetch user info using the access token
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                const userInfo = await userInfoResponse.json();

                const email = userInfo.email;

                if (!email) {
                    setError('Could not retrieve email.');
                    return;
                }

                // Check Domain
                if (!email.endsWith('@nfq.es')) {
                    setError('Access Restricted: Only @nfq.es emails are allowed.');
                    return;
                }

                // Check Whitelist
                if (!WHITELISTED_EMAILS.includes(email)) {
                    setError('Access Denied: Your email is not whitelisted.');
                    return;
                }

                setError(null);
                onLogin(email);

            } catch (err) {
                console.error(err);
                setError('Authentication failed.');
            }
        },
        onError: () => {
            setError('Login Failed');
        },
    });

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            {/* Header Logo & Title */}
            <div className="flex flex-col items-center mb-12">
                <div className="flex items-center gap-4 mb-2">
                    <img src="/assets/logo_final.png" alt="Logo" className="w-12 h-12 object-contain mix-blend-screen" onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/48?text=N')} />
                    <h1 className="text-4xl font-bold text-white tracking-tight">{t.pricing}</h1>
                </div>
                <p className="text-slate-400 text-lg">{t.subtitle}</p>
            </div>

            {/* Login Card */}
            <div className="w-full max-w-md bg-[#111111] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col items-center mt-10">
                    <button
                        onClick={() => login()}
                        className="w-full bg-white text-black rounded-full py-4 px-6 flex items-center justify-between hover:bg-slate-100 transition-colors mb-6"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden">
                                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold">{t.continueAs} Google User</div>
                                <div className="text-xs text-slate-500">@nfq.es only</div>
                            </div>
                        </div>
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    </button>

                    {error && (
                        <div className="mb-6 p-3 bg-red-900/30 border border-red-800 rounded text-red-200 text-xs text-center w-full">
                            {error}
                        </div>
                    )}

                    <div className="w-full h-px bg-white/5 mb-8"></div>

                    <div className="text-[10px] text-slate-500 text-center leading-relaxed max-w-[280px]">
                        {t.agree} <a href="#" className="underline">{t.terms}</a> {t.and} <a href="#" className="underline">{t.privacy}</a>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-12 text-[10px] text-slate-600 tracking-widest font-medium">
                {t.footer}
            </div>
        </div>
    );
};
