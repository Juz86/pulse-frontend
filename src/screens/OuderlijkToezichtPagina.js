import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PulseLogo from '../components/PulseLogo';
import {
  Activity,
  Bell,
  Check,
  Clock,
  Delete,
  KeyRound,
  Message,
  PauseCircle,
  Phone,
  Refresh,
  Users,
  Video,
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

function PhoneFrame({ children, tall = false }) {
  return (
    <div className={`hp-phone fp-phone ot-phone${tall ? ' fp-phone--tall' : ''}`}>
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
      <div className="hp-feature-mockup">{mockup}</div>
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
          <button className="ot-pause-btn">⏸ Pauze</button>
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
          <button className="ot-pause-btn">⏸ Pauze</button>
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
    <PhoneFrame>
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
    <PhoneFrame>
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

export default function OuderlijkToezichtPagina({ onParentClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const navItems = [
    { key: 'functies', label: 'Functies', href: '/functies' },
    { key: 'hoe-werkt-het', label: 'Hoe werkt het', href: '/hoe-werkt-het' },
    { key: 'veiligheid', label: 'Veiligheid', href: '/' },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'over-pulse', label: 'Over Pulse', onClick: () => scrollTo('footer') },
  ];

  return (
    <div className="hp-root">
      <MarketingNavbar
        items={navItems}
        activeKey="ouderlijk-toezicht"
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
        onParentClick={onParentClick}
      />

      <section className="ot-hero">
        <div className="ot-hero-inner">
          <div className="ot-hero-copy">
            <div className="fp-hero-badge">Ouderlijk toezicht</div>
            <h1 className="ot-hero-title">Jij bepaalt. Altijd.</h1>
            <p className="ot-hero-sub">
              Het ouderportaal van Pulse geeft jou als ouder volledige controle over de
              communicatie van je kind — real-time, eenvoudig en direct vanuit je telefoon.
            </p>
            <div className="ot-hero-actions">
              <button className="hp-cta-btn" onClick={onParentClick}>Ouderaccount aanmaken</button>
              <button className="ot-secondary-btn" onClick={() => scrollTo('dashboard')}>Meer informatie</button>
            </div>
          </div>
          <div className="ot-hero-visual">
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
            text="Bekijk per kind hoeveel tijd er wordt besteed aan chatten, bellen en videobellen. Zo houd je schermtijd gezond zonder te streng te zijn."
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

      <section className="ot-final-cta">
        <div className="hp-cta-inner">
          <h2>Geef je kind de vrijheid om te communiceren — met jouw toezicht.</h2>
          <button className="hp-cta-btn" onClick={onParentClick}>Ouderaccount aanmaken</button>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
