import * as Sentry from '@sentry/react';
import { recordLegacyMessagesFallback } from './legacyApiTelemetry';

jest.mock('@sentry/react', () => ({
  addBreadcrumb: jest.fn(),
  metrics: { count: jest.fn() },
}));

describe('legacy API telemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('records only the consumer and primary response status', () => {
    recordLegacyMessagesFallback('call_history', 404);

    expect(Sentry.metrics.count).toHaveBeenCalledWith(
      'pulse.legacy_messages_fallback',
      1,
      {
        attributes: {
          consumer: 'call_history',
          primary_status: '404',
        },
      },
    );
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      category: 'api.compatibility',
      data: {
        consumer: 'call_history',
        primary_status: '404',
      },
    }));
  });
});
