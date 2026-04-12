// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeAll } from 'vitest';
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

let Login: FC<{ onLogin: (email: string) => void; language: Language; whitelistedEmails?: string[] }>;

beforeAll(async () => {
  vi.resetModules();
  const mod = await import('../Login');
  Login = mod.Login;
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

    expect(loginFn).toHaveBeenCalledWith('demo@nfq.es');
  });

  it('demo login with invalid credentials shows error', async () => {
    const user = userEvent.setup();
    const loginFn = vi.fn();
    render(<Login onLogin={loginFn} language="en" />);

    await user.type(screen.getByTestId('demo-username'), 'wrong');
    await user.type(screen.getByTestId('demo-password'), 'wrong');
    await user.click(screen.getByTestId('demo-login-btn'));

    expect(loginFn).not.toHaveBeenCalled();
    expect(screen.getByTestId('login-error')).toBeInTheDocument();
    expect(screen.getByText('Invalid credentials.')).toBeInTheDocument();
  });

  it('clears error when retrying with valid credentials', async () => {
    const user = userEvent.setup();
    const loginFn = vi.fn();
    render(<Login onLogin={loginFn} language="en" />);

    await user.type(screen.getByTestId('demo-username'), 'wrong');
    await user.type(screen.getByTestId('demo-password'), 'wrong');
    await user.click(screen.getByTestId('demo-login-btn'));
    expect(screen.getByTestId('login-error')).toBeInTheDocument();

    await user.clear(screen.getByTestId('demo-username'));
    await user.clear(screen.getByTestId('demo-password'));
    await user.type(screen.getByTestId('demo-username'), 'demo');
    await user.type(screen.getByTestId('demo-password'), 'demo');
    await user.click(screen.getByTestId('demo-login-btn'));

    expect(screen.queryByTestId('login-error')).not.toBeInTheDocument();
    expect(loginFn).toHaveBeenCalledWith('demo@nfq.es');
  });
});
