import { resolveActiveEntityId } from './activeEntity';

const BASE = '/api';

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('n_pricing_auth_token');
  } catch {
    return null;
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const entityId = resolveActiveEntityId();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-entity-id': entityId,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    if (res.status === 401) {
      // Token expired or invalid — clear token and signal the auth context to
      // end the session so the login screen is shown instead of FALLBACK mode.
      try {
        localStorage.removeItem('n_pricing_auth_token');
        window.dispatchEvent(new CustomEvent('auth:token-expired'));
      } catch { /* SSR/test safe */ }
    }
    const text = await res.text().catch(() => '');
    throw new Error(`API ${options?.method ?? 'GET'} ${path} failed (${res.status}): ${text}`);
  }
  // 204 No Content (and other empty 2xx) carry no body — calling res.json()
  // would throw "Unexpected end of JSON input". The previous behaviour broke
  // every DELETE that returned 204 (e.g. /target-grid/templates/:id,
  // /market-benchmarks/:id) — the row was removed server-side but the caller
  // saw a thrown error and surfaced "delete failed" to the user.
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);

export const apiPost = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const apiPatch = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const apiPut = <T>(path: string, body: unknown) =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) });

export const apiDelete = (path: string) =>
  apiFetch<void>(path, { method: 'DELETE' });

export default apiFetch;
