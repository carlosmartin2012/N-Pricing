export type DomainEvent =
  | 'deal.created'
  | 'deal.updated'
  | 'deal.approved'
  | 'deal.rejected'
  | 'deal.booked'
  | 'curve.updated'
  | 'rule.changed'
  | 'alert.triggered'
  | 'snapshot.created'
  | 'user.login'
  | 'user.logout';

export interface WebhookConfig {
  id: string;
  entityId: string;
  name: string;
  url: string;
  events: DomainEvent[];
  secret?: string;
  isActive: boolean;
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
  };
  headers?: Record<string, string>;
  createdAt: string;
}

export interface EventPayload {
  event: DomainEvent;
  timestamp: string;
  entityId: string;
  data: Record<string, unknown>;
  correlationId: string;
}

type EventHandler = (payload: EventPayload) => void | Promise<void>;

class EventBusImpl {
  private handlers = new Map<DomainEvent, Set<EventHandler>>();
  private webhooks: WebhookConfig[] = [];

  on(event: DomainEvent, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  registerWebhooks(configs: WebhookConfig[]) {
    this.webhooks = configs.filter((c) => c.isActive);
  }

  async emit(event: DomainEvent, entityId: string, data: Record<string, unknown>): Promise<void> {
    const payload: EventPayload = {
      event,
      timestamp: new Date().toISOString(),
      entityId,
      data,
      correlationId: `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    };

    // Notify in-app handlers
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try { await handler(payload); } catch { /* swallow handler errors */ }
      }
    }

    // Dispatch to webhooks
    const matchingWebhooks = this.webhooks.filter((w) => w.events.includes(event));
    await Promise.allSettled(
      matchingWebhooks.map((webhook) => this.deliverWebhook(webhook, payload)),
    );
  }

  private async deliverWebhook(webhook: WebhookConfig, payload: EventPayload): Promise<void> {
    const { maxAttempts, backoffMs } = webhook.retryPolicy;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-NPricing-Event': payload.event,
          'X-NPricing-Correlation': payload.correlationId,
          ...webhook.headers,
        };

        if (webhook.secret) {
          headers['X-NPricing-Signature'] = await computeHmac(webhook.secret, JSON.stringify(payload));
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });

        if (response.ok) return;
        if (response.status >= 400 && response.status < 500) return; // don't retry client errors
      } catch {
        // Network error — retry
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
      }
    }
  }
}

async function computeHmac(secret: string, body: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return 'unsigned';
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Singleton event bus for the application */
export const eventBus = new EventBusImpl();

/** Pre-configured webhook templates */
export const WEBHOOK_TEMPLATES: Omit<WebhookConfig, 'id' | 'entityId' | 'createdAt'>[] = [
  {
    name: 'Deal Lifecycle',
    url: '',
    events: ['deal.created', 'deal.approved', 'deal.rejected', 'deal.booked'],
    isActive: false,
    retryPolicy: { maxAttempts: 3, backoffMs: 2000 },
  },
  {
    name: 'Market Data Updates',
    url: '',
    events: ['curve.updated', 'rule.changed'],
    isActive: false,
    retryPolicy: { maxAttempts: 2, backoffMs: 5000 },
  },
  {
    name: 'Alerts & Monitoring',
    url: '',
    events: ['alert.triggered'],
    isActive: false,
    retryPolicy: { maxAttempts: 5, backoffMs: 1000 },
  },
];
