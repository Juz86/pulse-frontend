import React, { lazy, Suspense } from 'react';
import './App.css';
import PulseLogo from './components/PulseLogo';

const Homepage = lazy(() => import('./screens/Homepage'));
const FunctiePagina = lazy(() => import('./screens/FunctiePagina'));
const OuderlijkToezichtPagina = lazy(() => import('./screens/OuderlijkToezichtPagina'));
const HoeWerktHetPagina = lazy(() => import('./screens/HoeWerktHetPagina'));
const OverPulsePagina = lazy(() => import('./screens/OverPulsePagina'));
const PrivacybeleidPagina = lazy(() => import('./screens/PrivacybeleidPagina'));
const ElektronischeCommunicatieBeleidPagina = lazy(() => import('./screens/ElektronischeCommunicatieBeleidPagina'));
const ContactPagina = lazy(() => import('./screens/ContactPagina'));
const SitemapPagina = lazy(() => import('./screens/SitemapPagina'));
const PrivacyFirstPagina = lazy(() => import('./screens/PrivacyFirstPagina'));

const splashFallback = (
  <div className="splash">
    <div className="splash-logo"><PulseLogo size={40} textSize={28} /></div>
    <div className="splash-spinner" />
  </div>
);

export default function LandingApp() {
  const pathname = window.location.pathname;

  const routes = {
    '/': Homepage,
    '/functies': FunctiePagina,
    '/ouderlijk-toezicht': OuderlijkToezichtPagina,
    '/hoe-werkt-het': HoeWerktHetPagina,
    '/over-pulse': OverPulsePagina,
    '/privacybeleid': PrivacybeleidPagina,
    '/avg-beleid-elektronische-communicatie': ElektronischeCommunicatieBeleidPagina,
    '/contact': ContactPagina,
    '/sitemap': SitemapPagina,
    '/privacy-first': PrivacyFirstPagina,
  };

  const Page = routes[pathname] || Homepage;

  return (
    <Suspense fallback={splashFallback}>
      <Page />
    </Suspense>
  );
}
