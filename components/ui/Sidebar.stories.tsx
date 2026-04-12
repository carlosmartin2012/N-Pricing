import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Sidebar } from './Sidebar';
import { buildMainNavItems, buildBottomNavItems } from '../../appNavigation';
import { translations } from '../../translations';

const t = translations.en;
const mainNavItems = buildMainNavItems(t);
const bottomNavItems = buildBottomNavItems(t);

const meta = {
  title: 'UI/Sidebar',
  component: Sidebar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh', background: '#0e0e0e' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    currentView: 'CALCULATOR',
    setCurrentView: action('setCurrentView'),
    mainNavItems,
    bottomNavItems,
    onOpenConfig: action('onOpenConfig'),
    language: 'en',
    onClose: action('onClose'),
  },
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: { isSidebarOpen: true },
};

export const Collapsed: Story = {
  args: { isSidebarOpen: false },
};
