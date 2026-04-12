export type SSOProvider = 'saml' | 'oidc';
export type SSOStatus = 'configured' | 'testing' | 'active' | 'disabled';

export interface SSOConfig {
  id: string;
  entityId: string;
  provider: SSOProvider;
  name: string;
  status: SSOStatus;
  config: SAMLConfig | OIDCConfig;
  attributeMapping: AttributeMapping;
  createdAt: string;
  updatedAt: string;
}

export interface SAMLConfig {
  type: 'saml';
  metadataUrl: string;
  entityId: string;
  acsUrl: string;
  sloUrl?: string;
  certificate: string;
  signRequests: boolean;
}

export interface OIDCConfig {
  type: 'oidc';
  issuerUrl: string;
  clientId: string;
  clientSecretRef: string;
  scopes: string[];
  redirectUri: string;
}

export interface AttributeMapping {
  email: string;
  name: string;
  role?: string;
  groups?: string;
  department?: string;
}

/** Pre-configured SSO provider templates */
export const SSO_PROVIDER_TEMPLATES: Record<string, Omit<SSOConfig, 'id' | 'entityId' | 'createdAt' | 'updatedAt'>> = {
  okta: {
    provider: 'oidc',
    name: 'Okta',
    status: 'disabled',
    config: {
      type: 'oidc',
      issuerUrl: 'https://{your-domain}.okta.com',
      clientId: '',
      clientSecretRef: 'SSO_OKTA_CLIENT_SECRET',
      scopes: ['openid', 'profile', 'email', 'groups'],
      redirectUri: '/api/auth/sso/callback',
    },
    attributeMapping: { email: 'email', name: 'name', role: 'custom:role', groups: 'groups' },
  },
  azure_ad: {
    provider: 'oidc',
    name: 'Azure Active Directory',
    status: 'disabled',
    config: {
      type: 'oidc',
      issuerUrl: 'https://login.microsoftonline.com/{tenant-id}/v2.0',
      clientId: '',
      clientSecretRef: 'SSO_AZURE_CLIENT_SECRET',
      scopes: ['openid', 'profile', 'email'],
      redirectUri: '/api/auth/sso/callback',
    },
    attributeMapping: { email: 'preferred_username', name: 'name', role: 'roles', groups: 'groups' },
  },
  auth0: {
    provider: 'oidc',
    name: 'Auth0',
    status: 'disabled',
    config: {
      type: 'oidc',
      issuerUrl: 'https://{your-domain}.auth0.com/',
      clientId: '',
      clientSecretRef: 'SSO_AUTH0_CLIENT_SECRET',
      scopes: ['openid', 'profile', 'email'],
      redirectUri: '/api/auth/sso/callback',
    },
    attributeMapping: { email: 'email', name: 'name', role: 'https://npricing.io/role' },
  },
  adfs: {
    provider: 'saml',
    name: 'Active Directory Federation Services',
    status: 'disabled',
    config: {
      type: 'saml',
      metadataUrl: 'https://{adfs-server}/FederationMetadata/2007-06/FederationMetadata.xml',
      entityId: 'https://npricing.io',
      acsUrl: '/api/auth/sso/saml/acs',
      certificate: '',
      signRequests: true,
    },
    attributeMapping: {
      email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
      role: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
    },
  },
};
