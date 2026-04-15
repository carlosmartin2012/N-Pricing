/**
 * Generic SSO provider abstraction. Concrete adapters (Okta, AzureAD, Auth0)
 * implement the same shape so the rest of the auth code stays provider-agnostic.
 *
 * For Sprint 1 we only formalise the interface + a fake "DemoSso" provider
 * for tests. Wiring the real OIDC discovery, JWT verification, and entity_users
 * upsert lives in subsequent sprints.
 */

export type SsoProtocol = 'oidc' | 'saml';

export interface SsoProviderConfig {
  id: string;
  protocol: SsoProtocol;
  displayName: string;
  /** Discovery endpoint for OIDC providers, metadata URL for SAML. */
  discoveryUrl: string;
  clientId: string;
  /** SCIM / claim that maps to user_id in entity_users. Default 'email'. */
  userIdClaim?: string;
}

export interface SsoIdentity {
  /** Stable subject identifier from the IdP (sub claim, NameID, etc.). */
  sub: string;
  email: string;
  displayName: string;
  /** Tenant / entity hint, if the IdP carries one (Azure AD: tid). */
  tenantHint?: string;
  /** Group memberships, used to derive role on first login. */
  groups: string[];
}

export interface SsoProvider {
  config: SsoProviderConfig;
  /**
   * Validate the bearer token and resolve the identity. Real providers pull
   * the JWKS, verify signature, claims, audience and expiry; the demo
   * provider just splits the token.
   */
  verifyToken(token: string): Promise<SsoIdentity | null>;
}

// ---------- Reference DemoSso ----------
// Token shape: 'demo:<sub>:<email>:<displayName>:<groups csv>'
export class DemoSsoProvider implements SsoProvider {
  readonly config: SsoProviderConfig;
  constructor(config?: Partial<SsoProviderConfig>) {
    this.config = {
      id: 'demo',
      protocol: 'oidc',
      displayName: 'Demo SSO',
      discoveryUrl: 'about:blank',
      clientId: 'demo',
      userIdClaim: 'email',
      ...config,
    };
  }
  async verifyToken(token: string): Promise<SsoIdentity | null> {
    if (!token.startsWith('demo:')) return null;
    const parts = token.slice(5).split(':');
    if (parts.length < 3) return null;
    const [sub, email, displayName, groupsCsv] = parts;
    return {
      sub,
      email,
      displayName,
      groups: groupsCsv ? groupsCsv.split(',').map((g) => g.trim()).filter(Boolean) : [],
    };
  }
}

/** Resolve a role from group claims using a configurable map. */
export function deriveRoleFromGroups(
  groups: string[],
  map: Record<string, string>,
  fallback = 'Trader',
): string {
  for (const g of groups) {
    if (map[g]) return map[g];
  }
  return fallback;
}
