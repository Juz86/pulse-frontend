import * as Sentry from '@sentry/react';

export function recordLegacyMessagesFallback(consumer, primaryStatus) {
  const status = Number.isFinite(Number(primaryStatus))
    ? String(Number(primaryStatus))
    : 'unknown';
  const attributes = {
    consumer: String(consumer || 'unknown'),
    primary_status: status,
  };

  Sentry.metrics.count('pulse.legacy_messages_fallback', 1, { attributes });
  Sentry.addBreadcrumb({
    category: 'api.compatibility',
    level: 'warning',
    message: 'legacy_messages_fallback',
    data: attributes,
  });
}
