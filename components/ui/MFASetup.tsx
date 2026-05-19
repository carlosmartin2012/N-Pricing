import React, { useEffect, useState } from 'react';
import { Shield, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { useMFA } from '../../hooks/useMFA';

interface MFASetupProps {
  userEmail: string;
}

export const MFASetup: React.FC<MFASetupProps> = ({ userEmail: _userEmail }) => {
  const { mfaState, isLoading, error, checkMFAStatus, enrollMFA, verifyMFA, unenrollMFA } = useMFA();
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'status' | 'enroll' | 'verify'>('status');

  useEffect(() => {
    void checkMFAStatus();
  }, [checkMFAStatus]);

  const handleEnroll = async () => {
    await enrollMFA();
    setStep('enroll');
  };

  const handleVerify = async () => {
    const success = await verifyMFA(verificationCode);
    if (success) {
      setStep('status');
      setVerificationCode('');
    }
  };

  const handleUnenroll = async () => {
    await unenrollMFA();
    setStep('status');
  };

  return (
    <div className="rounded-[var(--nfq-radius-card)] border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-surface)] p-4">
      <div className="flex items-center gap-3 mb-4">
        {mfaState.isVerified ? (
          <ShieldCheck className="h-5 w-5 text-[color:var(--nfq-success)]" />
        ) : (
          <Shield className="h-5 w-5 text-[color:var(--nfq-warning)]" />
        )}
        <div>
          <h4 className="text-sm font-bold text-[color:var(--nfq-text-primary)]">Two-Factor Authentication</h4>
          <p className="text-xs text-[color:var(--nfq-text-muted)]">
            {mfaState.isVerified
              ? 'Enabled — your account is protected'
              : 'Not enabled — add an extra layer of security'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-[var(--nfq-danger)]/10 border border-[color:var(--nfq-danger)]/20 px-3 py-2 text-xs text-[color:var(--nfq-danger)]">
          {error}
        </div>
      )}

      {step === 'status' && (
        <div className="flex gap-2">
          {mfaState.isVerified ? (
            <button
              onClick={handleUnenroll}
              disabled={isLoading}
              className="nfq-button px-3 py-1.5 text-xs text-[color:var(--nfq-danger)] hover:bg-[var(--nfq-danger)]/10 rounded-lg transition-colors"
            >
              <ShieldOff className="h-3 w-3 mr-1 inline" />
              Disable 2FA
            </button>
          ) : (
            <button
              onClick={handleEnroll}
              disabled={isLoading}
              className="nfq-button nfq-button-primary px-3 py-1.5 text-xs"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 mr-1 inline animate-spin" />
              ) : (
                <Shield className="h-3 w-3 mr-1 inline" />
              )}
              Enable 2FA
            </button>
          )}
        </div>
      )}

      {step === 'enroll' && mfaState.qrCode && (
        <div className="space-y-3">
          <p className="text-xs text-[color:var(--nfq-text-muted)]">Scan this QR code with your authenticator app:</p>
          <div className="flex justify-center p-4 bg-white rounded-lg w-fit mx-auto">
            <img src={mfaState.qrCode} alt="MFA QR Code" className="h-40 w-40" />
          </div>
          {mfaState.secret && (
            <div className="text-center">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[color:var(--nfq-text-faint)]">Manual entry:</span>
              <code className="block mt-1 text-xs font-mono text-[color:var(--nfq-accent)] select-all break-all">
                {mfaState.secret}
              </code>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              className="flex-1 text-center font-mono text-lg tracking-[0.3em] rounded-lg border border-[color:var(--nfq-border-ghost)] bg-[var(--nfq-bg-elevated)] px-3 py-2 text-[color:var(--nfq-text-primary)] placeholder:text-[color:var(--nfq-text-faint)] focus:border-[color:var(--nfq-accent)]/40 focus:outline-none"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <button
              onClick={handleVerify}
              disabled={verificationCode.length !== 6 || isLoading}
              className="nfq-button nfq-button-primary px-4 py-2 text-sm disabled:opacity-40"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
