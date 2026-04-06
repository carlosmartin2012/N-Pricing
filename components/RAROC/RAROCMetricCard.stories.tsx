import type { Meta, StoryObj } from '@storybook/react';
import type { ReactRenderer } from '@storybook/react';
import { DollarSign, PieChart, Shield, TrendingUp } from 'lucide-react';
import { RAROCMetricCard } from './RAROCMetricCard';

/**
 * Metric card used in the RAROC calculator dashboard.
 * Displays a single KPI with tone-coded accent, trend indicator, and icon.
 */
const meta = {
  title: 'RAROC/MetricCard',
  component: RAROCMetricCard,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    tone: {
      control: 'select',
      options: ['cyan', 'emerald', 'amber', 'violet'],
    },
    trend: {
      control: 'select',
      options: ['positive', 'negative', 'neutral'],
    },
  },
} satisfies Meta<typeof RAROCMetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RarocPositive: Story = {
  args: {
    title: 'RAROC',
    value: '14.8%',
    subtext: 'Above hurdle rate (12.0%)',
    trend: 'positive',
    tone: 'emerald',
    icon: TrendingUp,
  },
};

export const RarocNegative: Story = {
  args: {
    title: 'RAROC',
    value: '8.2%',
    subtext: 'Below hurdle rate (12.0%)',
    trend: 'negative',
    tone: 'emerald',
    icon: TrendingUp,
  },
};

export const EconomicProfit: Story = {
  args: {
    title: 'Economic Profit',
    value: '€34,500',
    subtext: 'Net value after capital charge',
    trend: 'positive',
    tone: 'cyan',
    icon: DollarSign,
  },
};

export const EconomicProfitLoss: Story = {
  args: {
    title: 'Economic Profit',
    value: '-€12,300',
    subtext: 'Destroys shareholder value',
    trend: 'negative',
    tone: 'cyan',
    icon: DollarSign,
  },
};

export const RiskWeightedAssets: Story = {
  args: {
    title: 'RWA',
    value: '€600,000',
    subtext: '60% of EAD',
    trend: 'neutral',
    tone: 'amber',
    icon: Shield,
  },
};

export const CapitalConsumption: Story = {
  args: {
    title: 'Capital Consumption',
    value: '€48,000',
    subtext: '8.0% of RWA',
    trend: 'neutral',
    tone: 'violet',
    icon: PieChart,
  },
};

export const AllMetrics: StoryObj<ReactRenderer> = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: 580 }}>
      <RAROCMetricCard
        title="RAROC"
        value="14.8%"
        subtext="Above hurdle rate (12.0%)"
        trend="positive"
        tone="emerald"
        icon={TrendingUp}
      />
      <RAROCMetricCard
        title="Economic Profit"
        value="€34,500"
        subtext="Net value after capital charge"
        trend="positive"
        tone="cyan"
        icon={DollarSign}
      />
      <RAROCMetricCard
        title="RWA"
        value="€600,000"
        subtext="60% of EAD"
        trend="neutral"
        tone="amber"
        icon={Shield}
      />
      <RAROCMetricCard
        title="Capital Consumption"
        value="€48,000"
        subtext="8.0% of RWA"
        trend="neutral"
        tone="violet"
        icon={PieChart}
      />
    </div>
  ),
};
