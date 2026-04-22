// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { FC } from 'react';
import type { Language } from '../../../translations';

vi.stubEnv('VITE_DEMO_USER', 'demo');
vi.stubEnv('VITE_DEMO_PASS', 'demo');
vi.stubEnv('VITE_DEMO_EMAIL', 'demo@nfq.es');
vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');

const mockStorage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => mockStorage.get(key) ?? null,
  setItem: (key: string, value: string) => mockStorage.set(key, value),
  removeItem: (key: string) => mockStorage.delete(key),
  clear: () => mockStorage.clear(),
});

vi.mock('../Logo', () => ({
  Logo: (props: Record<string, unknown>) => <svg data-testid="logo" {...props} />,
}));

// Login.tsx posts credentials to /api/auth/demo and awaits a JSON body with a
// JWT on success or an {error} on failure. We stub fetch with a tiny server
// stand-in so the tests can run without a real network and still exercise the
// success / error branches of handleDemoLogin.
function installFetchStub(): void {
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url !== '/api/auth/demo') {
      return new Response(JSON.stringify({ error: 'not stubbed' }), { status: 404 });
    }
    const body = init?.body ? JSON.parse(init.body as string) : {};
    if (body.username === 'demo' && body.password === 'demo') {
      return new Response(
        JSON.stringify({ token: 'fake-jwt', email: 'demo@nfq.es', name: 'demo', role: 'Trader' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({ error: 'Invalid credentials.' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetchStub);
}

let Login: FC<{ onLogin: (email: string) => void; language: Language; whitelistedEmails?: string[] }>;

beforeAll(async () => {
  vi.resetModules();
  const mod = await import('../Login');
  Login = mod.Login;
});

beforeEach(() => {
  mockStorage.clear();
  installFetchStub();
});

describe('Login', () => {
  const onLogin = vi.fn();

  it('renders the login page with demo form', () => {
    render(<Login onLogin={onLogin} language="en" />);
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.getByTestId('demo-username')).toBeInTheDocument();
    expect(screen.getByTestId('demo-password')).toBeInTheDocument();
    expect(screen.getByTestId('demo-login-btn')).toBeInTheDocument();
  });

  it('demo login with valid credentials calls onLogin', async () => {
    const user = userEvent.setup();
    const loginFn = vi.fn();
    render(<Login onLogin={loginFn} language="en" />);

    await user.type(screen.getByTestId('demo-username'), 'demo');
    await user.type(screen.getByTestId('demo-password'), 'demo');
    await user.click(screen.getByTestId('demo-login-btn'));

    await waitFor(() => expect(loginFn).toHaveBeenCalledWith('demo@nfq.es'));
    expect(mockStorage.get('n_pricing_auth_token')).toBe('fake-jwt');
  });

  it('demo login with invalid credentials shows error', async () => {
    const user = userEvent.setup();
    const loginFn = vi.fn();
    render(<Login onLogin={loginFn} language="en" />);

    await user.type(screen.getByTestId('demo-username'), 'wrong');
    await user.type(screen.getByTestId('demo-password'), 'wrong');
    await user.click(screen.getByTestId('demo-login-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('login-error')).toHaveTextContent('Invalid credentials.'),
    );
    expect(loginFn).not.toHaveBeenCalled();
  });

  it('clears error when retrying with valid credentials', async () => {
    const user = userEvent.setup();
    const loginFn = vi.fn();
    render(<Login onLogin={loginFn} language="en" />);

    await user.type(screen.getByTestId('demo-username'), 'wrong');
    await user.type(screen.getByTestId('demo-password'), 'wrong');
    await user.click(screen.getByTestId('demo-login-btn'));
    await waitFor(() => expect(screen.getByTestId('login-error')).toBeInTheDocument());

    await user.clear(screen.getByTestId('demo-username'));
    await user.clear(screen.getByTestId('demo-password'));
    await user.type(screen.getByTestId('demo-username'), 'demo');
    await user.type(screen.getByTestId('demo-password'), 'demo');
    await user.click(screen.getByTestId('demo-login-btn'));

    await waitFor(() => expect(loginFn).toHaveBeenCalledWith('demo@nfq.es'));
    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
  });
});
