import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PulseLogo from '../components/PulseLogo';
import ParentAuthModal from '../components/ParentAuthModal';
import AuthModal from '../components/AuthModal';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import PageMeta from '../components/PageMeta';
import {
  Activity,
  Bell,
  Check,
  Clock,
  Delete,
  KeyRound,
  Login,
  PauseCircle,
  Refresh,
  Users,
  Wifi,
} from '../components/Icons';

function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.14 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, visible];
}

function PhoneFrame({ children, tall = false, className = '' }) {
  return (
    <div className={`hp-phone fp-phone ot-phone${tall ? ' fp-phone--tall' : ''} ${className}`.trim()}>
      <div className="hp-phone-notch" />
      <div className="hp-phone-screen fp-phone-screen ot-phone-screen">
        {children}
      </div>
    </div>
  );
}

function SectionHeader({ title, text, list }) {
  return (
    <div className="ot-copy">
      <h3>{title}</h3>
      <p>{text}</p>
      <ul className="ot-feature-list">
        {list.map((item) => (
          <li key={item}>
            <span className="ot-feature-check"><Check size={14} /></span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionRow({ reverse, mockup, title, text, list, id }) {
  const [ref, visible] = useFadeIn();
  return (
    <div
      id={id}
      ref={ref}
      className={`hp-feature-row${reverse ? ' hp-feature-row--reverse' : ''} ot-row${visible ? ' fp-visible' : ''}`}
    >
      <div className="hp-feature-mockup" aria-hidden="true">{mockup}</div>
      <SectionHeader title={title} text={text} list={list} />
    </div>
  );
}

function DashboardMockup() {
  return (
    <div className="ot-dashboard-card">
      <div className="ot-dashboard-head">
        <div className="ot-dashboard-title">Ouderportaal</div>
        <div className="ot-dashboard-tabs">
          <span className="ot-dashboard-tab ot-dashboard-tab--active">Mijn kinderen</span>
          <span className="ot-dashboard-tab">Activiteiten</span>
        </div>
      </div>

      <div className="ot-child-card">
        <div className="ot-child-avatar">T</div>
        <div className="ot-child-main">
          <div className="ot-child-name">Tim</div>
          <div className="ot-child-meta"><span className="ot-dot ot-dot--online" /> Online · 2 min geleden</div>
          <div className="ot-stat-row">
            <span>5 contacten</span>
            <span>8 chats</span>
          </div>
          <button type="button" className="ot-pause-btn">⏸ Pauze</button>
        </div>
        <div className="ot-child-actions">
          <span><KeyRound size={16} /></span>
          <span><Delete size={16} /></span>
        </div>
      </div>

      <div className="ot-child-card">
        <div className="ot-child-avatar ot-child-avatar--soft">M</div>
        <div className="ot-child-main">
          <div className="ot-child-name">Maria</div>
          <div className="ot-child-meta"><span className="ot-dot" /> Offline · 1 uur geleden</div>
          <div className="ot-stat-row">
            <span>3 contacten</span>
            <span>4 chats</span>
          </div>
          <button type="button" className="ot-pause-btn">⏸ Pauze</button>
        </div>
        <div className="ot-child-actions">
          <span><KeyRound size={16} /></span>
          <span><Delete size={16} /></span>
        </div>
      </div>
    </div>
  );
}

function PauseMockup() {
  return (
    <PhoneFrame className="ot-phone--pause">
      <div className="ot-phone-top">
        <PulseLogo size={16} textSize={12} color="#fff" />
        <span className="ot-phone-badge">Pauzeren</span>
      </div>
      <div className="ot-select-card">
        <div className="ot-select-head">
          <span>Functie kiezen</span>
          <Refresh size={13} />
        </div>
        <div className="ot-option ot-option--warning">⏸ Chat</div>
        <div className="ot-option">⏸ Bellen</div>
        <div className="ot-option">⏸ Videobellen</div>
      </div>
      <div className="ot-kid-notice">
        <div className="ot-kid-notice-icon"><PauseCircle size={18} /></div>
        <div>
          <strong>Chatten is gepauzeerd</strong>
          <span>door je ouder</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

function ActivityMockup() {
  const items = [
    { icon: '✓', text: 'Jeroen heeft een vriendschapsverzoek van Nick geaccepteerd.', time: '2 min geleden' },
    { icon: '↑', text: 'Jeroen heeft een vriendschapsverzoek naar Sanne gestuurd.', time: '8 min geleden' },
    { icon: '↑', text: 'Pim heeft een vriendschapsverzoek naar Michel gestuurd.', time: '18 min geleden' },
  ];

  return (
    <div className="ot-activity-card">
      <div className="ot-activity-head">
        <Activity size={16} />
        <span>Activiteitenlog</span>
      </div>
      {items.map((item) => (
        <div key={item.text} className="ot-activity-item">
          <div className="ot-activity-icon">{item.icon}</div>
          <div>
            <div className="ot-activity-text">{item.text}</div>
            <div className="ot-activity-time">{item.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsMockup() {
  const stats = [
    ['Schermtijd', '1u 23m'],
    ['Berichten', '47'],
    ['Oproepen', '3'],
    ['Contacten', '5'],
  ];

  return (
    <div className="ot-stats-card">
      <div className="ot-activity-head">
        <Clock size={16} />
        <span>Gebruik vandaag</span>
      </div>
      <div className="ot-stats-grid">
        {stats.map(([label, value]) => (
          <div key={label} className="ot-stat-card">
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationMockup() {
  return (
    <PhoneFrame className="ot-phone--notification">
      <div className="ot-push-shell">
        <div className="ot-push-banner">
          <Bell size={16} />
          <div>
            <strong>Pulse</strong>
            <span>Tim heeft een vriendschapsverzoek van Nick geaccepteerd</span>
          </div>
        </div>
        <div className="ot-push-preview">
          <div className="ot-push-row">
            <Users size={16} />
            <span>Real-time oudermeldingen</span>
          </div>
          <div className="ot-push-row">
            <Wifi size={16} />
            <span>Werkt ook wanneer de app dicht is</span>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function StepsOverview() {
  const steps = [
    {
      title: 'Maak je ouderaccount aan',
      text: 'Registreer jezelf en krijg toegang tot het ouderportaal.',
    },
    {
      title: 'Voeg je kind toe',
      text: 'Maak per kind een account aan met eigen gebruikersnaam en wachtwoord.',
    },
    {
      title: 'Beheer per functie',
      text: 'Bekijk activiteiten, ontvang meldingen en pauzeer het kindaccount wanneer nodig.',
    },
  ];

  return (
    <div className="hp-steps">
      {steps.map((step, index) => (
        <React.Fragment key={step.title}>
          <div className="hp-step">
            <div className="hp-step-num">{index + 1}</div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
          {index < steps.length - 1 && <div className="hp-step-arrow" aria-hidden="true">→</div>}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function OuderlijkToezichtPagina({ onParentClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);
  const [showAuthModal,   setShowAuthModal]   = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    setMenuOpen(false);
  };

  const navItems = [
    { key: 'privacy-first', label: 'Privacy-First', href: '/privacy-first', highlight: true },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'hoe-werkt-het',      label: 'Hoe werkt het',      href: '/hoe-werkt-het' },
    { key: 'functies',           label: 'Functies',           href: '/functies' },
  ];

  return (
    <div className="hp-root">
      <PageMeta
        title="Ouderlijk toezicht met Pulse — Overzicht en controle voor ouders"
        description="Met het ouderportaal van Pulse hou je overzicht, pauzeer je chatten, bellen of videobellen per kind en ontvang je real-time meldingen."
        canonical="https://pulse-messenger.com/ouderlijk-toezicht"
      />
      <MarketingNavbar
        items={navItems}
        activeKey="ouderlijk-toezicht"
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
        onParentClick={onParentClick}
      />

      <main id="main-content">
      <section className="ot-hero hw-hero">
        <DecorativeAvatar svg={avatarSvgs.otTop}    className="fp-deco-avatar--hero-top" />
        <DecorativeAvatar svg={avatarSvgs.otBottom} className="fp-deco-avatar--hero-bottom" />
        <div className="ot-hero-inner hw-hero-inner">
          <div className="ot-hero-copy hw-hero-copy marketing-hero-copy">
            <div className="fp-hero-badge">Ouderlijk toezicht</div>
            <h1 className="ot-hero-title ot-hero-title--marketing">Veilig online, onder ouderlijk toezicht.</h1>
            <p className="ot-hero-sub">
              Het ouderportaal van Pulse geeft jou als ouder volledige controle over de
              communicatie van je kind — real-time, eenvoudig en direct vanuit je telefoon.
            </p>
            <div className="ot-hero-actions">
              <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>Ouderaccount aanmaken</button>
              <button type="button" className="ot-secondary-btn" onClick={() => scrollTo('dashboard')}>Meer informatie</button>
            </div>
          </div>
          <div className="ot-hero-visual" aria-hidden="true">
            <DashboardMockup />
          </div>
        </div>
      </section>

      <section className="hp-section" id="dashboard">
        <div className="hp-section-inner">
          <SectionRow
            id="kindoverzicht"
            mockup={<DashboardMockup />}
            title="Altijd zicht op je kinderen"
            text="Zie in één oogopslag welke kinderen online zijn, wanneer ze voor het laatst actief waren en hoeveel contacten en chats ze hebben."
            list={[
              'Naam, profielfoto en online status',
              'Laatste activiteit tijdstip',
              'Aantal contacten per kind',
              'Aantal chats per kind',
              'Automatisch vernieuwen elke 30 seconden',
            ]}
          />
        </div>
      </section>

      <section className="hp-section hp-section--gray">
        <div className="hp-section-inner">
          <SectionRow
            reverse
            mockup={<PauseMockup />}
            title="Pauzeer per functie"
            text="Niet één grote aan/uit knop — maar volledige controle per functie. Pauzeer alleen chatten tijdens huiswerk, of alleen bellen tijdens bedtijd."
            list={[
              'Chat pauzeren / hervatten',
              'Bellen pauzeren / hervatten',
              'Videobellen pauzeren / hervatten',
              'Kind ziet directe melding bij pauzeren',
              'Lopende gesprekken worden beëindigd',
            ]}
          />
        </div>
      </section>

      <section className="hp-section">
        <div className="hp-section-inner">
          <SectionRow
            mockup={<ActivityMockup />}
            title="Weet wat je kind doet"
            text="Het activiteitenlog toont alle vriendschapsverzoeken die je kind verstuurt en ontvangt. Jij blijft altijd op de hoogte."
            list={[
              'Vriendschapsverzoeken verstuurd',
              'Vriendschapsverzoeken geaccepteerd',
              'Real-time activiteitsnotificaties',
              'Automatisch bijgewerkt',
            ]}
          />
        </div>
      </section>

      <section className="hp-section hp-section--gray">
        <div className="hp-section-inner">
          <SectionRow
            reverse
            mockup={<StatsMockup />}
            title="Inzicht in gebruik"
            text="Bekijk per kind hoeveel tijd er wordt besteed aan chatten en oproepen in de app. Zo houd je schermtijd gezond zonder te streng te zijn."
            list={[
              'Schermtijd per kind',
              'Aantal berichten per kind',
              'Aantal oproepen per kind',
              'Overzicht per dag',
            ]}
          />
        </div>
      </section>

      <section className="hp-section">
        <div className="hp-section-inner">
          <SectionRow
            mockup={<NotificationMockup />}
            title="Direct een melding op je telefoon"
            text="Ontvang een push notificatie zodra je kind een vriendschapsverzoek verstuurt of accepteert — ook als de app niet open staat."
            list={[
              'Push notificaties in real-time',
              'Melding bij vriendschapsverzoek verstuurd',
              'Melding bij vriendschapsverzoek geaccepteerd',
              'Werkt op iOS en Android',
            ]}
          />
        </div>
      </section>

      <section className="hp-section hp-section--steps" id="stappen">
        <div className="hp-section-inner">
          <div className="hp-section-header">
            <h2>In 3 stappen in controle</h2>
            <p>Zo richt je Pulse in en houd je als ouder overzicht zonder gedoe.</p>
          </div>
          <StepsOverview />
        </div>
      </section>

      <div style={{ padding: '0 0' }}>
        <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb' }} />
      </div>

      <section className="ot-final-cta">
        <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
        <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>Ouderaccount aanmaken</button>
          <button
            type="button"
            className="hp-cta-btn"
            style={{ background: '#fff', border: '1.5px solid rgba(108,99,255,0.4)', color: '#6c63ff', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowAuthModal(true)}
          >
            <Login size={18} /> Inloggen
          </button>
        </div>
      </section>
      </main>

      <MarketingFooter />

      {showParentModal && (
        <ParentAuthModal onClose={() => setShowParentModal(false)} defaultTab="register" />
      )}
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}
