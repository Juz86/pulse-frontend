import React, { useEffect, useRef, useState } from 'react';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import ParentAuthModal from '../components/ParentAuthModal';
import AuthModal from '../components/AuthModal';
import DecorativeAvatar, { avatarSvgs } from '../components/DecorativeAvatars';
import PulseLogo from '../components/PulseLogo';
import PageMeta from '../components/PageMeta';
import {
  KeyRound,
  Login,
  Message,
  Phone,
  Search,
  UserPlus,
  Users,
  Video,
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

function StepCopy({ step, title, text }) {
  return (
    <div className="hw-copy">
      <div className="hw-step-tag">Stap {step}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function StepRow({ step, title, text, mockup, reverse = false, stacked = false, id }) {
  const [ref, visible] = useFadeIn();
  return (
    <div
      id={id}
      ref={ref}
      className={`hp-feature-row${reverse ? ' hp-feature-row--reverse' : ''} hw-row${stacked ? ' hw-row--stacked' : ''}${visible ? ' fp-visible' : ''}`}
    >
      <StepCopy step={step} title={title} text={text} />
      <div className="hp-feature-mockup" aria-hidden="true">{mockup}</div>
    </div>
  );
}

function SectionIntro({ badge, title, text }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`hp-section-header fp-section-header${visible ? ' fp-visible' : ''} hw-section-intro`}>
      <div className="fp-section-kicker">{badge}</div>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function BrowserMockup({ children, wide = false }) {
  return (
    <div className={`hw-browser${wide ? ' hw-browser--wide' : ''}`}>
      <div className="hw-browser-bar">
        <span />
        <span />
        <span />
      </div>
      <div className="hw-browser-body">{children}</div>
    </div>
  );
}

function PhoneMockup({ children }) {
  return (
    <div className="ot-phone hw-phone">
      <div className="hp-phone-notch" />
      <div className="hp-phone-screen fp-phone-screen hw-phone-screen">{children}</div>
    </div>
  );
}

function RegistrationMockup() {
  return (
    <BrowserMockup>
      <div className="hw-form-shell">
        <div className="hw-form-head">
          <PulseLogo size={22} textSize={16} color="#1f2a44" />
          <span className="hw-pill-badge">Ouder</span>
        </div>
        <h4>Maak je ouderaccount aan</h4>
        <div className="hw-field">Naam</div>
        <div className="hw-field">E-mailadres</div>
        <div className="hw-field">Wachtwoord</div>
        <button type="button" className="hw-primary-btn">Account aanmaken</button>
      </div>
    </BrowserMockup>
  );
}

function AddChildMockup() {
  return (
    <BrowserMockup>
      <div className="hw-form-shell">
        <div className="hw-form-head">
          <PulseLogo size={22} textSize={16} color="#1f2a44" />
          <span className="hw-pill-badge">Ouder</span>
        </div>
        <div className="hw-soft-panel hw-soft-panel--plain">
          <h4>Kind toevoegen</h4>
          <div className="hw-field">Naam van het kind</div>
          <div className="hw-field">Gebruikersnaam</div>
          <div className="hw-field">Wachtwoord</div>
          <button type="button" className="hw-primary-btn">Kindaccount aanmaken</button>
        </div>
      </div>
    </BrowserMockup>
  );
}

function ConnectedMockup() {
  return (
    <BrowserMockup>
      <div className="hw-form-shell">
        <div className="hw-form-head">
          <PulseLogo size={22} textSize={16} color="#1f2a44" />
          <span className="hw-pill-badge">Ouder</span>
        </div>
        <div className="hw-connected-grid hw-connected-grid--stacked hw-connected-grid--balanced">
          <div className="hw-connected-card hw-connected-card--plain">
            <div className="hw-connected-top">
              <div className="hw-connected-avatar">O</div>
              <div>
                <strong>Ouderaccount</strong>
                <span>Beheer en overzicht</span>
              </div>
            </div>
          </div>

          <div className="hw-connection-bridge">
            <div className="hw-connection-dot" />
            <div className="hw-connection-text">Verbonden</div>
          </div>

          <div className="hw-connected-card hw-connected-card--plain">
            <div className="hw-connected-top">
              <div className="hw-connected-avatar hw-connected-avatar--soft">K</div>
              <div>
                <strong>Kindaccount</strong>
                <span>Klaar om contact te maken</span>
              </div>
            </div>
            <div className="hw-action-row">
              <span><Message size={13} /> Chatten</span>
              <span><Phone size={13} /> Bellen</span>
              <span><Video size={13} /> Videobellen</span>
            </div>
          </div>
        </div>
      </div>
    </BrowserMockup>
  );
}

function ContactsOverviewMockup() {
  return (
    <BrowserMockup>
      <div className="hw-contacts-top">
        <div className="hw-contacts-tabs">
          <span className="hw-portal-tab">Chats</span>
          <span className="hw-portal-tab hw-portal-tab--active">Contacten</span>
        </div>
        <div className="hw-search-light">
          <Search size={14} />
          <span>Zoeken…</span>
        </div>
      </div>
      <div className="hw-contact-card">
        <div className="hw-contact-avatar">S</div>
        <div>
          <strong>Stephan</strong>
          <span>@stephan</span>
        </div>
      </div>
      <div className="hw-contact-card">
        <div className="hw-contact-avatar hw-contact-avatar--soft">K</div>
        <div>
          <strong>Kamilah</strong>
          <span>@kamilah</span>
        </div>
      </div>
    </BrowserMockup>
  );
}

function AddContactButtonMockup() {
  return (
    <BrowserMockup>
      <div className="hw-contacts-top">
        <div className="hw-contacts-tabs">
          <span className="hw-portal-tab">Chats</span>
          <span className="hw-portal-tab hw-portal-tab--active">Contacten</span>
        </div>
        <div className="hw-search-light">
          <Search size={14} />
          <span>nick@pulse...</span>
        </div>
      </div>
      <div className="hw-choice-row">
        <span>E-mailadres</span>
        <span>Gebruikersnaam</span>
        <span>Zoekresultaat</span>
      </div>
      <div className="hw-contact-card hw-contact-card--muted">
        <div className="hw-contact-avatar">N</div>
        <div>
          <strong>Stephan</strong>
          <span>@stephan</span>
        </div>
      </div>
    </BrowserMockup>
  );
}

function SearchContactMockup() {
  return (
    <BrowserMockup>
      <div className="hw-form-shell hw-form-shell--compact">
        <div className="hw-contacts-top">
          <div className="hw-contacts-tabs">
            <span className="hw-portal-tab">Chats</span>
            <span className="hw-portal-tab hw-portal-tab--active">Contacten</span>
          </div>
          <div className="hw-search-light">
            <Search size={14} />
            <span>Zoeken…</span>
          </div>
        </div>
        <div className="hw-result-card">
          <div className="hw-contact-avatar">N</div>
          <div>
            <strong>Nick</strong>
            <span>@nick</span>
          </div>
        </div>
        <button type="button" className="hw-primary-btn hw-primary-btn--wide">Verzoek sturen</button>
      </div>
    </BrowserMockup>
  );
}

export default function HoeWerktHetPagina({ onParentClick }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
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
    { key: 'functies', label: 'Functies', href: '/functies' },
    { key: 'hoe-werkt-het', label: 'Hoe werkt het', href: '/hoe-werkt-het' },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'over-pulse', label: 'Over Pulse', href: '/over-pulse' },
  ];

  return (
    <div className="hp-root">
      <PageMeta
        title="Hoe Werkt Pulse? — Van ouderaccount tot veilig contact"
        description="Bekijk stap voor stap hoe Pulse werkt: ouderaccount aanmaken, kind toevoegen, accounts koppelen en veilig communiceren met vertrouwde contacten."
        canonical="https://pulse-frontend-elt.pages.dev/hoe-werkt-het"
      />
      <MarketingNavbar
        items={navItems}
        activeKey="hoe-werkt-het"
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
        onParentClick={onParentClick}
      />

      <main id="main-content">
      <section className="ot-hero hw-hero">
        <DecorativeAvatar svg={avatarSvgs.hwTop}    className="fp-deco-avatar--hero-top" />
        <DecorativeAvatar svg={avatarSvgs.hwBottom} className="fp-deco-avatar--hero-bottom" />
        <div className="ot-hero-inner hw-hero-inner">
          <div className="hw-hero-copy">
            <div className="fp-hero-badge">Hoe werkt het</div>
            <h1 className="ot-hero-title">Van ouderaccount tot veilig contact</h1>
            <p className="ot-hero-sub">
              Met Pulse ontdekt je kind op een veilige en eenvoudige manier hoe contact houden werkt, terwijl jij als ouder toezicht en controle houdt.
            </p>
            <div className="ot-hero-actions">
              <button type="button" className="hp-cta-btn" onClick={() => setShowParentModal(true)}>Ouderaccount aanmaken</button>
              <button type="button" className="ot-secondary-btn" onClick={() => scrollTo('contact-toevoegen')}>Bekijk contact toevoegen</button>
            </div>
          </div>
          <div className="hw-hero-visual">
            <div className="hw-hero-preview hw-hero-preview--single" aria-hidden="true">
              <ConnectedMockup />
            </div>
          </div>
        </div>
      </section>

      <section className="hp-section" id="hoe-werkt-pulse">
        <div className="hp-section-inner">
          <SectionIntro
            badge="Hoe werkt Pulse?"
            title="In 3 stappen veilig contact met je geliefden"
            text="Veilig contact hoeft niet ingewikkeld te zijn. Met Pulse stel je in drie overzichtelijke stappen een vertrouwde omgeving in waarin je kind kan chatten, bellen en videobellen met de mensen die ertoe doen."
          />

          <div className="hw-steps-grid">
            <StepRow
              id="registreren"
              step="1"
              stacked
              title="Ouder registreert zich"
              text="De ouder maakt eerst een eigen account aan. Vanaf daar wordt alles beheerd in een vertrouwde, eenvoudige omgeving."
              mockup={<RegistrationMockup />}
            />

            <StepRow
            step="2"
            stacked
            title="Ouder voegt een kind toe"
            text="In het ouderportaal maakt de ouder een kindaccount aan met een unieke gebruikersnaam en wachtwoord. Het kind logt daarna in met deze gegevens."
            mockup={<AddChildMockup />}
          />

            <StepRow
            step="3"
            stacked
            title="Ouder en kind zijn verbonden"
            text="Zodra het account actief is, zijn ouder en kind gekoppeld. Ouder en kind kunnen veilig chatten, bellen en videobellen."
            mockup={<ConnectedMockup />}
          />
          </div>
        </div>
      </section>

      <section className="hp-section hp-section--gray" id="contact-toevoegen">
        <div className="hp-section-inner">
          <SectionIntro
            badge="Contact toevoegen"
            title="In contact met familie en vrienden"
            text="Met Pulse blijven ouder en kind dichtbij de mensen die echt tellen, zoals opa en oma, ooms en tantes, buren en vertrouwde vrienden van school. Ouders houden regie over de contacten van hun kind."
          />

          <div className="hw-steps-grid">
            <StepRow
              step="1"
              stacked
              title="Klik op Contacten"
              text="Ga in de app naar het tabblad Contacten om bestaande contacten te bekijken en nieuwe contacten toe te voegen."
              mockup={<ContactsOverviewMockup />}
            />

            <StepRow
              step="2"
              stacked
              title="Zoek een contactpersoon"
              text="Voeg familie en vrienden eenvoudig toe via e-mailadres of gebruikersnaam."
              mockup={<AddContactButtonMockup />}
            />

            <StepRow
              step="3"
              stacked
              title="Contactpersoon toevoegen"
              text="Zie je de juiste contactpersoon? Klik dan op ‘Verzoek sturen’."
              mockup={<SearchContactMockup />}
            />
          </div>
        </div>
      </section>

      <section className="ot-final-cta">
        <h2>Veilig verbonden. Met wie echt telt.</h2>
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
