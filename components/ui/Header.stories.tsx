import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Header } from './Header';
import { EntityProvider } from '../../contexts/EntityContext';
import { buildMainNavItems, buildBottomNavItems } from '../../appNavigation';
import { translations } from '../../translations';
import type { UserProfile } from '../../types';

const t = translations.en;
const mainNav = buildMainNavItems(t).map(({ id, label }) => ({ id, label }));
const bottomNav = buildBottomNavItems(t).map(({ id, label }) => ({ id, label }));

const mockUser: UserProfile = {
  id: 'u1',
  email: 'trader@nfq.es',
  name: 'María García',
  role: 'Trader',
  status: 'Active',
  lastLogin: new Date().toISOString(),
  department: 'Global Markets',
};

const meta = {
  title: 'UI/Header',
  component: Header,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <EntityProvider>
        <div style={{ background: '#0e0e0e', minHeight: 80 }}>
          <Story />
        </div>
      </EntityProvider>
    ),
  ],
  args: {
    isSidebarOpen: true,
    setSidebarOpen: action('setSidebarOpen'),
    currentView: 'CALCULATOR',
    mainNavItems: mainNav,
    bottomNavItems: bottomNav,
    theme: 'dark',
    setTheme: action('setTheme'),
    language: 'en',
    setLanguage: action('setLanguage'),
    user: mockUser,
    onLogout: action('onLogout'),
    onOpenImport: action('onOpenImport'),
    offlinePendingCount: 2,
    offlineIsSyncing: false,
    onOfflineSync: action('onOfflineSync'),
    dataMode: 'live',
    syncStatus: 'synced',
    onDataModeChange: action('onDataModeChange'),
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const LightTheme: Story = {
  args: {
    theme: 'light',
  },
  decorators: [
    (Story) => (
      <EntityProvider>
        <div style={{ background: '#f5f5f5', minHeight: 80 }}>
          <Story />
        </div>
      </EntityProvider>
    ),
  ],
};
