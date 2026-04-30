import { OAuth2Client } from 'google-auth-library';
import type { SsoIdentity, SsoProvider, SsoProviderConfig } from '../sso';

/**
 * Production-ready Google SSO provider implementing the SsoProvider
 * interface. Verifies an ID token (JWT) issued by Google's OAuth2 endpoint
 * and resolves it to an SsoIdentity that the rest of the system can use
 * for tenancy + role mapping.
 *
 * Configuration:
 *   - clientId: Google OAuth client ID (Workspace or generic)
 *   - hd:       optional hosted-domain restriction (e.g. 'bbva.es')
 *
 * The `hd` claim, when present in the token, lets us refuse identities
 * from outside the configured Workspace domain. This is a hard tenant
 * boundary for bank-internal deployments.
 */

export interface GoogleSsoConfig extends Partial<SsoProviderConfig> {
  clientId: string;
  /** Restrict accepted identities to this Workspace domain. */
  allowedHostedDomain?: string;
}

export class GoogleSsoProvider implements SsoProvider {
  readonly config: SsoProviderConfig;
  private readonly client: OAuth2Client;
  private readonly allowedHd?: string;

  constructor(cfg: GoogleSsoConfig) {
    this.config = {
      id: cfg.id ?? 'google',
      protocol: 'oidc',
      displayName: cfg.displayName ?? 'Google',
      discoveryUrl: cfg.discoveryUrl ?? 'https://accounts.google.com/.well-known/openid-configuration',
      clientId: cfg.clientId,
      userIdClaim: cfg.userIdClaim ?? 'email',
    };
    this.client = new OAuth2Client(cfg.clientId);
    this.allowedHd = cfg.allowedHostedDomain;
  }

  async verifyToken(idToken: string): Promise<SsoIdentity | null> {
    if (!idToken || typeof idToken !== 'string') return null;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.sub) {
        console.warn('[sso/google] verify rejected: payload missing email or sub');
        return null;
      }
      // Reject email_verified=false. Google emite tokens con
      // email_verified=false en cuentas Workspace mal configuradas. Usar
      // un email no verificado para autenticar permite ataques de
      // suplantación si el dominio fue alguna vez secundario de otro tenant.
      if (payload.email_verified === false) {
        console.warn('[sso/google] verify rejected: email_verified=false', {
          email: payload.email,
        });
        return null;
      }
      if (this.allowedHd && payload.hd !== this.allowedHd) {
        // Distinguible en logs: domain mismatch es un evento de seguridad
        // (intento de auth desde dominio no autorizado), no un fallo de
        // configuración del usuario.
        console.warn('[sso/google] verify rejected: hd mismatch', {
          expected: this.allowedHd,
          got: payload.hd,
          email: payload.email,
        });
        return null;
      }

      // Google ID tokens don't carry group claims in their default profile —
      // groups for role derivation must come from a separate Workspace
      // Directory API call (out of scope for this sprint). For now we surface
      // the hosted domain as a single-element groups array so the tenant
      // mapping can use it.
      const groups = payload.hd ? [`hd:${payload.hd}`] : [];

      return {
        sub: payload.sub,
        email: payload.email,
        displayName: payload.name ?? payload.email.split('@')[0],
        tenantHint: payload.hd,
        groups,
      };
    } catch (err) {
      // Distinguir tipos de fallo en log: token expirado (esperado) vs
      // audience mismatch (alarma) vs JWKS unreachable (network) vs
      // malformed token (posible ataque). Antes era un `catch {}` mudo
      // que escondía intentos de auth con audience equivocada.
      const message = err instanceof Error ? err.message : String(err);
      // Categorización heurística por mensaje de google-auth-library.
      const reason = /audience/i.test(message)         ? 'audience_mismatch'
                   : /expired|exp/i.test(message)      ? 'token_expired'
                   : /signature|verify/i.test(message) ? 'signature_invalid'
                   : /malformed|jwt|format/i.test(message) ? 'token_malformed'
                   : /network|jwks|fetch/i.test(message) ? 'jwks_unreachable'
                   : 'unknown';
      console.warn('[sso/google] verify failed', { reason, message });
      return null;
    }
  }
}
