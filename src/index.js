if (typeof window !== 'undefined' && !window.process) {
  window.process = { env: {}, nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0) };
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './App.css';
import App from './App';

// ── Sentry (alleen in productie) ──────────────────────────────────────────────
if (process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    enabled: process.env.NODE_ENV === 'production',
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Onafgehandelde promise rejections doorsturen naar Sentry
window.addEventListener('unhandledrejection', (event) => {
  if (process.env.REACT_APP_SENTRY_DSN) {
    Sentry.captureException(event.reason);
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

function AppCrashFallback() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100dvh', gap: 16,
      background: '#0f0f0f', color: '#fff',
      fontFamily: 'Inter, sans-serif', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Er is iets misgegaan</div>
      <div style={{ fontSize: 14, opacity: 0.6 }}>Ververs de pagina om opnieuw te proberen.</div>
      <button
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

// Service worker registreren voor PWA
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(e => { console.warn('[Pulse] Fout:', e.message); });
  });
}
