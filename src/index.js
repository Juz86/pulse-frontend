import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './App.css';
import {
  isLocalHost,
  MARKETING_HOSTNAME,
  SENTRY_DSN,
  WEB_APP_HOSTNAME,
} from './config/runtimeConfig';
import App from './generated/targetApp';

const SITE_TARGET = process.env.REACT_APP_SITE_TARGET === 'landing' ? 'landing' : 'webapp';

if (typeof window !== 'undefined' && !window.process) {
  window.process = { env: {}, nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0) };
}

// ── Sentry (alleen in productie) ──────────────────────────────────────────────
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    enabled: process.env.NODE_ENV === 'production',
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Onafgehandelde promise rejections doorsturen naar Sentry
const CHUNK_RELOAD_KEY = 'pulse:last-chunk-reload-at';

function isChunkLoadFailure(reason) {
  const message = String(reason?.message || reason || '');
  return /ChunkLoadError|Loading chunk \d+ failed|MIME type.*not executable|Failed to fetch dynamically imported module/i.test(message);
}

function reloadOnceForFreshAssets(reason) {
  if (!isChunkLoadFailure(reason)) return false;

  const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - lastReload < 60000) return false;

  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

window.addEventListener('unhandledrejection', (event) => {
  if (reloadOnceForFreshAssets(event.reason)) {
    event.preventDefault();
    return;
  }

  if (SENTRY_DSN) {
    Sentry.captureException(event.reason);
  }
});

function renderTargetMismatch({ expectedTarget, hostname }) {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  const expectedHost = expectedTarget === 'webapp' ? WEB_APP_HOSTNAME : MARKETING_HOSTNAME;

  root.render(
    <React.StrictMode>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        gap: 16,
        background: '#0f0f0f',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        padding: 24,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Deployment mismatch</div>
        <div style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.6, opacity: 0.8 }}>
          Deze host draait de verkeerde Pulse-build. Verwacht target: <strong>{expectedTarget}</strong> voor <strong>{expectedHost}</strong>,
          maar de huidige host is <strong>{hostname}</strong>.
        </div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          Controleer de Cloudflare Pages build command en redeploy het juiste target.
        </div>
      </div>
    </React.StrictMode>
  );
}

const runtimeHostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isNativeLocalHost = isLocalHost(runtimeHostname);
const isProductionMismatch =
  process.env.NODE_ENV === 'production' &&
  !isNativeLocalHost &&
  runtimeHostname &&
  (
    (runtimeHostname === WEB_APP_HOSTNAME && SITE_TARGET !== 'webapp') ||
    (runtimeHostname === MARKETING_HOSTNAME && SITE_TARGET !== 'landing')
  );

if (isProductionMismatch) {
  console.error(`[Pulse] Deployment mismatch: host "${runtimeHostname}" draait target "${SITE_TARGET}".`);
  renderTargetMismatch({
    expectedTarget: runtimeHostname === WEB_APP_HOSTNAME ? 'webapp' : 'landing',
    hostname: runtimeHostname,
  });
} else {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <Sentry.ErrorBoundary fallback={<AppCrashFallback />}>
        <App />
      </Sentry.ErrorBoundary>
    </React.StrictMode>
  );
}

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
if (
  SITE_TARGET !== 'landing' &&
  'serviceWorker' in navigator &&
  process.env.NODE_ENV === 'production'
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(e => { console.warn('[Pulse] Fout:', e.message); });
  });
}
