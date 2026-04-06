import { useState, useCallback } from 'react';
import { isSupabaseConfigured, supabase } from '../utils/supabaseClient';
import { createLogger } from '../utils/logger';

const log = createLogger('mfa');

export interface MFAState {
  isEnrolled: boolean;
  isVerified: boolean;
  qrCode: string | null;
  secret: string | null;
}

export function useMFA() {
  const [mfaState, setMfaState] = useState<MFAState>({
    isEnrolled: false,
    isVerified: false,
    qrCode: null,
    secret: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkMFAStatus = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const totp = data?.totp ?? [];
      const verified = totp.find((f: { status: string }) => f.status === 'verified');
      setMfaState((prev) => ({
        ...prev,
        isEnrolled: totp.length > 0,
        isVerified: !!verified,
      }));
    } catch (err) {
      log.error('Failed to check MFA status', {}, err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  const enrollMFA = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('MFA requires Supabase connection');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'N-Pricing TOTP',
      });
      if (enrollError) throw enrollError;
      setMfaState((prev) => ({
        ...prev,
        qrCode: data?.totp?.qr_code ?? null,
        secret: data?.totp?.secret ?? null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enroll MFA';
      setError(message);
      log.error('MFA enrollment failed', {}, err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyMFA = useCallback(async (code: string, factorId?: string) => {
    if (!isSupabaseConfigured) return false;
    setIsLoading(true);
    setError(null);
    try {
      // Get factor ID if not provided
      let fId = factorId;
      if (!fId) {
        const { data } = await supabase.auth.mfa.listFactors();
        fId = data?.totp?.[0]?.id;
      }
      if (!fId) {
        setError('No MFA factor found');
        return false;
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: fId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: fId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      setMfaState((prev) => ({ ...prev, isVerified: true, isEnrolled: true }));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verification failed';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unenrollMFA = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const factor = data?.totp?.[0];
      if (factor) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
        setMfaState({ isEnrolled: false, isVerified: false, qrCode: null, secret: null });
      }
    } catch (err) {
      log.error('Failed to unenroll MFA', {}, err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  return {
    mfaState,
    isLoading,
    error,
    checkMFAStatus,
    enrollMFA,
    verifyMFA,
    unenrollMFA,
  };
}
