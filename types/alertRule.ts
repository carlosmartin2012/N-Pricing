export type AlertOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

export interface AlertRule {
  id: string;
  entityId: string;
  name: string;
  metricName: string;
  operator: AlertOperator;
  threshold: number;
  recipients: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}
