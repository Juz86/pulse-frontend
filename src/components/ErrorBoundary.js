import React from 'react';
import * as Sentry from '@sentry/react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[Pulse] ErrorBoundary caught:', error, info);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" aria-live="assertive" style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100dvh', gap: 16,
          background: 'var(--bg, #0f0f0f)', color: 'var(--text, #fff)',
          fontFamily: 'Inter, sans-serif', padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40 }} aria-hidden="true">⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Er is iets misgegaan</div>
          <div style={{ fontSize: 14, opacity: 0.6 }}>Ververs de pagina om opnieuw te proberen.</div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 24px', borderRadius: 8,
              background: '#6c63ff', color: '#fff', border: 'none',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Pagina verversen
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
