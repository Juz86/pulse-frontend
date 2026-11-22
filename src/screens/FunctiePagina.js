// src/screens/FunctiePagina.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import PulseLogo from '../components/PulseLogo';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import PageMeta from '../components/PageMeta';
import SafeSvgImage from '../components/SafeSvgImage';
import useMarketingAuth from '../hooks/useMarketingAuth';
import {
  Phone, Video,
  Message, Users, User, Search, Bell,
  Pin, StarFilled, CheckDouble,
  Forward, Reply, ImageIcon, Palette,
  Clock, Login,
  AtSign, Send, Smartphone,
} from '../components/Icons';

function makeAdventurerAvatar(options) {
  return createAvatar(adventurer, {
    size: 64,
    backgroundColor: ['transparent'],
    features: [],
    featuresProbability: 0,
    ...options,
  }).toString();
}

const bgAvatarSvg = createAvatar(adventurer, {
  seed: 'yousef-pulse',
  size: 64,
  hair: ['short19'],
  hairColor: ['ab2a18'],
  skinColor: ['d8a96a'],
  eyes: ['variant24'],
  eyebrows: ['variant12'],
  mouth: ['variant23'],
  glasses: ['variant05'],
  glassesProbability: 100,
  hairProbability: 100,
  features: [],
  featuresProbability: 0,
  backgroundColor: ['transparent'],
}).toString();

const decorativeAvatars = {
  heroTop: makeAdventurerAvatar({
    seed: 'pulse-hero-top',
    hair: ['short12'],
    hairColor: ['e03fd8'],
    skinColor: ['ecad80'],
    eyes: ['variant09'],
    eyebrows: ['variant07'],
    mouth: ['variant12'],
    glasses: ['none'],
    glassesProbability: 0,
    hairProbability: 100,
  }),
  heroBottom: makeAdventurerAvatar({
    seed: 'pulse-hero-bottom',
    hair: ['long11'],
    hairColor: ['6a4e35'],
    skinColor: ['f2d3b1'],
    eyes: ['variant20'],
    eyebrows: ['variant10'],
    mouth: ['variant18'],
    glasses: ['variant01'],
    glassesProbability: 100,
    hairProbability: 100,
  }),
  chatSide: makeAdventurerAvatar({
    seed: 'pulse-chat-side',
    hair: ['short06'],
    hairColor: ['cb6820'],
    skinColor: ['c68642'],
    eyes: ['variant05'],
    eyebrows: ['variant04'],
    mouth: ['variant25'],
    glasses: ['none'],
    glassesProbability: 0,
    hairProbability: 100,
  }),
  gridCorner: makeAdventurerAvatar({
    seed: 'pulse-grid-corner',
    hair: ['long20'],
    hairColor: ['0e0e0e'],
    skinColor: ['d8a96a'],
    eyes: ['variant14'],
    eyebrows: ['variant09'],
    mouth: ['variant27'],
    glasses: ['variant03'],
    glassesProbability: 100,
    hairProbability: 100,
  }),
};

function DecorativeAvatar({ svg, className = '' }) {
  return (
    <SafeSvgImage
      svg={svg}
      alt=""
      className={`fp-deco-avatar ${className}`.trim()}
      aria-hidden="true"
      focusable="false"
    />
  );
}

// ── Scroll-in animatie hook ──────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// ── Phone frame ──────────────────────────────────────────────────────────────
function PhoneMockup({ children, tall, style, className = '' }) {
  return (
    <div className={`hp-phone fp-phone${tall ? ' fp-phone--tall' : ''} ${className}`.trim()} style={style}>
      <div className="hp-phone-notch" />
      <div className="hp-phone-screen fp-phone-screen">
        {children}
      </div>
    </div>
  );
}

// ── Avatar helper ────────────────────────────────────────────────────────────
function MockAvatar({ letter, gradient = 'linear-gradient(135deg,#7c3aed,#a78bfa)', size = 28, online, ringColor = '#1a1830' }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: gradient, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#fff',
        fontSize: size * 0.38, fontWeight: 700,
      }}>{letter}</div>
      {online && (
        <div style={{
          position: 'absolute', bottom: 0, right: 0,
          width: size * 0.34, height: size * 0.34,
          borderRadius: '50%', background: '#22c55e',
          border: `1.5px solid ${ringColor}`,
        }} />
      )}
    </div>
  );
}

// ── Mockup 1: Sidebar (hoofd chatscherm) ─────────────────────────────────────
function SidebarMockup() {
  const chats = [
    { letter: 'N', name: 'Nova', sub: 'Geen antwoord', time: 'Gisteren', gradient: 'linear-gradient(135deg,#fed7df,#f7b267)', online: true },
    { letter: 'R', name: 'Ravi', sub: 'Ik stuur je later een foto', time: '22 aug', gradient: 'linear-gradient(135deg,#f4d35e,#8b5cf6)', unread: 2 },
    { letter: 'M', name: 'Mira', sub: 'Dat klinkt goed!', time: '4 aug', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
    { letter: 'S', name: 'Sami', sub: 'Tot vanmiddag', time: '3 aug', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', unread: 1 },
    { letter: 'W', name: 'Weekendclub', sub: 'Robin: Ik neem snacks mee', time: '1 aug', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', unread: 3 },
    { letter: 'T', name: 'Thuisgroep', sub: 'Noa: Eten staat klaar', time: '21 jul', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
  ];

  return (
    <PhoneMockup tall className="fp-hero-chat-phone" style={{ width: 240 }}>
      <div className="fp-hero-chat-topbar">
        <PulseLogo size={20} textSize={18} color="#312e65" />
        <div className="fp-hero-chat-topbar-actions">
          <span className="fp-hero-chat-topbar-action fp-hero-chat-topbar-action--active"><Message size={14} /></span>
          <span className="fp-hero-chat-topbar-action"><Users size={14} /></span>
          <span className="fp-hero-chat-topbar-action"><Search size={14} /></span>
        </div>
      </div>
      <div className="fp-hero-chat-filters">
        {['Alles', 'Familie', 'Vrienden', 'Groepen 2'].map((f, i) => (
          <div key={f} className={`fp-hero-chat-filter${i === 0 ? ' fp-hero-chat-filter--active' : ''}`}>{f}</div>
        ))}
      </div>
      <div className="fp-hero-chat-list">
      {chats.map(c => (
        <div key={c.name} className="fp-hero-chat-row">
          <MockAvatar letter={c.letter} gradient={c.gradient} size={28} online={c.online} ringColor="#fff" />
          <div className="fp-hero-chat-contact">
            <div className="fp-hero-chat-name">{c.name}</div>
            <div className="fp-hero-chat-preview">{c.name === 'Nova' && <Phone size={8} />} {c.sub}</div>
          </div>
          <div className="fp-hero-chat-meta">
            <span className="fp-hero-chat-time">{c.time}</span>
            {c.unread && <span className="fp-hero-chat-unread">{c.unread}</span>}
          </div>
        </div>
      ))}
      </div>
      <div className="fp-hero-chat-footer">
        <span><User size={13} /><small>Jij</small></span>
        <span className="fp-hero-chat-footer-active"><Message size={13} /><small>Chats</small></span>
        <span><Phone size={13} /><small>Oproepen</small></span>
        <span><Bell size={13} /><small>Portaal</small></span>
        <span className="fp-hero-chat-footer-add"><strong>+</strong><small>Meer</small></span>
      </div>
    </PhoneMockup>
  );
}

// ── Mockup 3: Groep ──────────────────────────────────────────────────────────
function GroupMockup() {
  return (
    <PhoneMockup className="fp-group-chat-phone" style={{ width: 240 }}>
      <div className="fp-group-chat-header">
        <span className="fp-group-chat-back">←</span>
        <MockAvatar letter="SP" gradient="linear-gradient(135deg,#12b981,#57d49a)" size={27} ringColor="#fff" />
        <div className="fp-group-chat-title">
          <strong>Samen op pad</strong>
          <span>Groep</span>
        </div>
        <span className="fp-group-chat-call"><Phone size={11} /></span>
        <span className="fp-group-chat-video"><Video size={11} /></span>
      </div>
      <div className="fp-group-chat-messages">
        <div className="fp-group-chat-message fp-group-chat-message--in">
          <strong>Noa</strong>
          Wie gaat er mee wandelen?
        </div>
        <div className="fp-group-chat-message fp-group-chat-message--in fp-group-chat-message--second">
          <strong>Robin</strong>
          Ik ben erbij!
        </div>
        <div className="fp-group-chat-message fp-group-chat-message--out">
          <span>@Noa</span> leuk, ik ook!
          <CheckDouble size={10} />
        </div>
      </div>
      <div className="fp-group-chat-input">
        <AtSign size={12} />
        <span>Typ een bericht</span>
        <b><Send size={11} /></b>
      </div>
    </PhoneMockup>
  );
}

// ── Mockup 4: Berichten beheren ──────────────────────────────────────────────
function ManageMockup() {
  return (
    <PhoneMockup className="fp-manage-chat-phone" style={{ width: 240 }}>
      <div className="fp-manage-chat-header">
        <span className="fp-manage-chat-back">←</span>
        <MockAvatar letter="L" gradient="linear-gradient(135deg,#f4d35e,#9a62f5)" size={27} online ringColor="#fff" />
        <div className="fp-manage-chat-title"><strong>Lina</strong><span>Online</span></div>
        <span className="fp-manage-chat-action fp-manage-chat-action--video"><Video size={11} /></span>
        <span className="fp-manage-chat-action"><Phone size={11} /></span>
      </div>
      <div className="fp-manage-chat-messages">
        <div className="fp-manage-message fp-manage-message--out">Goedemorgen! <StarFilled size={9} /></div>
        <div className="fp-manage-message fp-manage-message--in">Morgen! Klaar voor school?</div>
        <div className="fp-manage-message fp-manage-message--out fp-manage-message--pinned"><Pin size={9} /> Vergeet je boek niet!</div>
        <div className="fp-manage-message fp-manage-message--removed"><Reply size={9} /> Bericht verwijderd</div>
      </div>
      <div className="fp-manage-chat-input"><span>Doorzoek berichten</span><Search size={11} /></div>
    </PhoneMockup>
  );
}

// ── Mockup 5: Chatachtergrond ────────────────────────────────────────────────
function BgMockup() {
  return (
    <PhoneMockup className="fp-bg-chat-phone" style={{ width: 240 }}>
      <div className="fp-bg-chat-header">
        <span className="fp-bg-chat-back">←</span>
        <MockAvatar letter="A" gradient="linear-gradient(135deg,#f4d35e,#9a62f5)" size={27} online ringColor="#fff" />
        <div className="fp-bg-chat-title"><strong>Alex</strong><span>Online</span></div>
        <span className="fp-bg-chat-action fp-bg-chat-action--video"><Video size={11} /></span>
        <span className="fp-bg-chat-action"><Phone size={11} /></span>
      </div>
      <div className="fp-bg-chat-canvas">
        <SafeSvgImage
          svg={bgAvatarSvg}
          alt=""
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            opacity: 0.14,
            transform: 'scale(1.7)',
          }}
          aria-hidden="true"
          focusable="false"
        />
        <div className="fp-bg-chat-message fp-bg-chat-message--in">Mooie achtergrond!</div>
        <div className="fp-bg-chat-message fp-bg-chat-message--out">Dankjewel</div>
        <div className="fp-bg-chat-message fp-bg-chat-message--in">Hoe stel je dat in?</div>
      </div>
      <div className="fp-bg-chat-input"><span>Typ een bericht</span><b><Send size={11} /></b></div>
    </PhoneMockup>
  );
}

// ── Feature rij ──────────────────────────────────────────────────────────────
function FeatureRow({ reverse, mockup, title, text, features, id }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} id={id}
      className={`hp-feature-row${reverse ? ' hp-feature-row--reverse' : ''} fp-feature-row${visible ? ' fp-visible' : ''}`}
    >
      <div className="hp-feature-mockup" aria-hidden="true">{mockup}</div>
      <div className="hp-feature-text">
        <h2>{title}</h2>
        <p>{text}</p>
        <ul className="fp-feature-list">
          {features.map(f => (
            <li key={f.label}>
              <span className="fp-feature-icon">{f.icon}</span>
              {f.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Feature grid kaart ────────────────────────────────────────────────────────
function GridCard({ icon, title, desc }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`fp-grid-card${visible ? ' fp-visible' : ''}`}>
      <div className="fp-grid-icon">{icon}</div>
      <div className="fp-grid-title">{title}</div>
      <div className="fp-grid-desc">{desc}</div>
    </div>
  );
}

function SectionHeader({ title, sub, headingId }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`hp-section-header fp-section-header${visible ? ' fp-visible' : ''}`}>
      <h2 id={headingId}>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
export default function FunctiePagina({ onParentClick }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [chatSlide,     setChatSlide]     = useState(0);
  const [activeGridTab, setActiveGridTab] = useState('chatten');
  const [expandedGridTabs, setExpandedGridTabs] = useState({
    chatten: false,
  });
  const { openParentSignup, openLogin, modals: marketingAuthModals } = useMarketingAuth({ onParentClick });
  const chatTabRefs     = useRef([]);
  const gridTabRefs     = useRef([]);
  const gridTabsMenuRef = useRef(null);
  const chatTouchStartX = useRef(null);

  const chatSlideInitial    = useRef(true);
  const gridTabInitial      = useRef(true);

  const scrollTabRowToActive = (tabElement) => {
    const tabRow = tabElement?.parentElement;
    if (!tabElement || !tabRow) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    tabRow.scrollTo({
      left: Math.max(tabElement.offsetLeft - 16, 0),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  const scrollGridSectionIntoView = () => {
    const targetElement = gridTabsMenuRef.current || document.getElementById('functies-overzicht');
    if (!targetElement) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetTop = window.scrollY + targetElement.getBoundingClientRect().top - 84;
    window.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (chatSlideInitial.current) { chatSlideInitial.current = false; return; }
    scrollTabRowToActive(chatTabRefs.current[chatSlide]);
  }, [chatSlide]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const scrollTo = (id) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    setMenuOpen(false);
  };

  const handleChatTabKeyDown = (event, index) => {
    if (event.key === 'Home') {
      event.preventDefault();
      setChatSlide(0);
      chatTabRefs.current[0]?.focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = chatSlides.length - 1;
      setChatSlide(lastIndex);
      chatTabRefs.current[lastIndex]?.focus();
      return;
    }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex = event.key === 'ArrowRight'
      ? (index + 1) % chatSlides.length
      : (index - 1 + chatSlides.length) % chatSlides.length;
    setChatSlide(nextIndex);
    chatTabRefs.current[nextIndex]?.focus();
  };

  const navItems = [
    { key: 'privacy-first', label: 'Privacy-First', href: '/privacy-first', highlight: true },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'hoe-werkt-het',      label: 'Hoe werkt het',      href: '/hoe-werkt-het' },
    { key: 'functies',           label: 'Functies',           href: '/functies' },
  ];

  const chatSlides = [
    {
      key: 'real-time-berichten',
      label: 'Real-time berichten',
      mockup: <SidebarMockup />,
      title: 'Real-time berichten',
      text: 'Berichten komen instant aan — net als WhatsApp. Met bezorgstatus en leesbevestiging in blauw.',
      features: [
        { icon: <Message size={15} />, label: '1-op-1 en groepsgesprekken' },
        { icon: <CheckDouble size={15} />, label: 'Bezorgd- en leesbevestiging' },
        { icon: <Clock size={15} />, label: 'Typ-indicator' },
      ],
    },
    {
      key: 'groepen-en-vermeldingen',
      label: 'Groepen en @ vermeldingen',
      reverse: true,
      mockup: <GroupMockup />,
      title: 'Groepen en @ vermeldingen',
      text: 'Maak groepen aan voor familie of vrienden. Vermeld iemand direct met @naam voor een directe melding.',
      features: [
        { icon: <Users size={15} />, label: 'Groep aanmaken met naam en foto' },
        { icon: <AtSign size={15} />, label: '@ vermeldingen met melding' },
        { icon: <Users size={15} />, label: 'Groepsleden beheren' },
        { icon: <Bell size={15} />, label: 'Ongelezen badge per gesprek' },
      ],
    },
    {
      key: 'volledige-berichtencontrole',
      label: 'Volledige berichtencontrole',
      mockup: <ManageMockup />,
      title: 'Volledige berichtencontrole',
      text: 'Beantwoord, bewerk, verwijder of stuur berichten door. Sla belangrijke berichten op met een ster.',
      features: [
        { icon: <Reply size={15} />, label: 'Reply, bewerken, verwijderen' },
        { icon: <Forward size={15} />, label: 'Berichten doorsturen' },
        { icon: <StarFilled size={15} />, label: 'Berichten sterren & overzicht' },
        { icon: <Pin size={15} />, label: 'Berichten vastzetten' },
        { icon: <Search size={15} />, label: 'Berichten zoeken in gesprek' },
      ],
    },
    {
      key: 'persoonlijk-chatachtergrond',
      label: 'Persoonlijk',
      reverse: true,
      mockup: <BgMockup />,
      title: 'Persoonlijk',
      text: 'Geef je chat een persoonlijke uitstraling met een eigen foto, avatar of kleur als achtergrond. Alleen jij ziet deze achtergrond.',
      features: [
        { icon: <Smartphone size={15} />, label: 'Foto op chatachtergrond' },
        { icon: <ImageIcon size={15} />, label: 'Profielfoto uploaden' },
        { icon: <User size={15} />, label: 'Avatar kiezen' },
        
        { icon: <Palette size={15} />, label: 'Achtergrondkleur kiezen' },
      ],
    },
  ];

  const currentChatSlide = chatSlides[chatSlide];

  const featureGridGroups = useMemo(() => [
    {
      key: 'chatten',
      label: 'Chatten',
      tabIcon: <Message size={16} />,
      headerIcon: <Message size={16} />,
      items: [
        { icon: <Message size={18} />, title: 'Real-time berichten', desc: 'Real-time delivery van chatberichten' },
        { icon: <AtSign size={18} />, title: 'Groepen & @mentions', desc: 'Chatgroep maken en met @ iemand direct vermelden' },
        { icon: <ImageIcon size={18} />, title: 'Chatachtergrond', desc: 'Foto of kleur naar keuze' },
        { icon: <StarFilled size={18} />, title: 'Berichten sterren', desc: 'Sla belangrijke berichten op' },
        { icon: <Message size={18} />, title: 'Conceptberichten', desc: 'Bewaard per gesprek' },
      ],
    },
    {
      key: 'bellen',
      label: 'Bellen',
      tabIcon: <Phone size={16} />,
      headerIcon: <Phone size={16} />,
      items: [
        { icon: <Phone size={18} />, title: 'Audio-oproepen', desc: 'Bel rechtstreeks vanuit een gesprek' },
        { icon: <Clock size={18} />, title: 'Oproepgeschiedenis', desc: 'Bekijk recente en gemiste oproepen' },
        { icon: <Bell size={18} />, title: 'Inkomende oproepen', desc: 'Melding wanneer iemand je belt' },
        { icon: <Clock size={18} />, title: 'Gespreksduur', desc: 'Altijd zichtbaar tijdens een gesprek' },
        { icon: <Phone size={18} />, title: 'Opnieuw bellen', desc: 'Bel eenvoudig terug vanuit de chat' },
      ],
    },
    {
      key: 'videobellen',
      label: 'Videobellen',
      tabIcon: <Video size={16} />,
      headerIcon: <Video size={16} />,
      items: [
        { icon: <Video size={18} />, title: 'Videogesprekken', desc: 'Zie elkaar direct tijdens een gesprek' },
        { icon: <Video size={18} />, title: 'Camera aan of uit', desc: 'Jij bepaalt wanneer je in beeld bent' },
        { icon: <Phone size={18} />, title: 'Van audio naar video', desc: 'Schakel over tijdens een gesprek' },
        { icon: <Bell size={18} />, title: 'Inkomende videogesprekken', desc: 'Melding wanneer iemand je videobelt' },
        { icon: <Message size={18} />, title: 'Gesprek minimaliseren', desc: 'Blijf chatten terwijl je belt' },
      ],
    },
  ], []);

  useEffect(() => {
    if (gridTabInitial.current) { gridTabInitial.current = false; return; }
    const activeIndex = featureGridGroups.findIndex((group) => group.key === activeGridTab);
    scrollTabRowToActive(gridTabRefs.current[activeIndex]);
  }, [activeGridTab, featureGridGroups]);

  const activeFeatureGroup = featureGridGroups.find((group) => group.key === activeGridTab) || featureGridGroups[0];
  const activeFeatureItems = expandedGridTabs[activeFeatureGroup.key]
    ? activeFeatureGroup.items
    : activeFeatureGroup.items.slice(0, 3);

  return (
    <div className="hp-root">
      <PageMeta
        title="Functies van Pulse — Veilig chatten"
        description="Ontdek Pulse functies: veilig chatten, groepsgesprekken, @-vermeldingen en rustige communicatie zonder afleiding."
        canonical="/functies"
      />

      {/* ── NAVIGATIE ── */}
      <MarketingNavbar
        items={navItems}
        activeKey="functies"
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        scrolled={scrolled}
        onParentClick={onParentClick}
      />

      <main id="main-content">
      {/* ── HERO ── */}
      <section className="ot-hero hw-hero">
        <DecorativeAvatar svg={decorativeAvatars.heroTop} className="fp-deco-avatar--hero-top" />
        <DecorativeAvatar svg={decorativeAvatars.heroBottom} className="fp-deco-avatar--hero-bottom" />
        <div className="ot-hero-inner hw-hero-inner">
          <div className="ot-hero-copy hw-hero-copy marketing-hero-copy">
            <div className="fp-hero-badge">Functies</div>
            <h1 className="ot-hero-title ot-hero-title--marketing fp-hero-title-compact">
              Veilig verbonden blijven.
            </h1>
            <p className="ot-hero-sub">
              Veilig chatten met familie en vrienden in één vertrouwde en beveiligde omgeving.
            </p>
            <div className="ot-hero-actions">
              <button type="button" className="hp-cta-btn" onClick={() => scrollTo('chatten')}>
                Bekijk functies
              </button>
              <a
                className="ot-secondary-btn"
                href="/ouderlijk-toezicht"
              >
                Ouderlijk toezicht
              </a>
            </div>
          </div>

          <div className="ot-hero-visual" aria-hidden="true">
            <SidebarMockup />
          </div>
        </div>
      </section>

      {/* ── CHATTEN ── */}
      <section className="hp-section" id="chatten">
        <div className="hp-section-inner">
          <DecorativeAvatar svg={decorativeAvatars.chatSide} className="fp-deco-avatar--chat" />
          <SectionHeader title="Chatten" sub="Snel en veilig berichten sturen zonder telefoonnummer." />
          <div className="fp-slider">
            <div className="fp-slider-header">
              <button
                type="button"
                className="fp-slider-arrow"
                aria-label="Vorige chatfunctie"
                onClick={() => setChatSlide((prev) => (prev === 0 ? chatSlides.length - 1 : prev - 1))}
              >
                <span aria-hidden="true">←</span> Vorige
              </button>
              <div className="fp-slider-tabs" role="tablist" aria-label="Chatfuncties" aria-orientation="horizontal">
                {chatSlides.map((slide, index) => (
                  <button
                    key={slide.key}
                    ref={(element) => { chatTabRefs.current[index] = element; }}
                    id={`chat-tab-${slide.key}`}
                    type="button"
                    role="tab"
                    aria-selected={index === chatSlide}
                    aria-controls={`chat-panel-${slide.key}`}
                    tabIndex={index === chatSlide ? 0 : -1}
                    className={`fp-slider-tab${index === chatSlide ? ' fp-slider-tab--active' : ''}`}
                    onClick={() => setChatSlide(index)}
                    onKeyDown={(event) => handleChatTabKeyDown(event, index)}
                  >
                    {slide.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="fp-slider-arrow"
                aria-label="Volgende chatfunctie"
                onClick={() => setChatSlide((prev) => (prev === chatSlides.length - 1 ? 0 : prev + 1))}
              >
                Volgende <span aria-hidden="true">→</span>
              </button>
            </div>

            <div
              id={`chat-panel-${currentChatSlide.key}`}
              role="tabpanel"
              aria-labelledby={`chat-tab-${currentChatSlide.key}`}
              tabIndex={0}
              onTouchStart={(e) => { chatTouchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (chatTouchStartX.current === null) return;
                const delta = e.changedTouches[0].clientX - chatTouchStartX.current;
                if (delta < -40) setChatSlide((prev) => (prev === chatSlides.length - 1 ? 0 : prev + 1));
                else if (delta > 40) setChatSlide((prev) => (prev === 0 ? chatSlides.length - 1 : prev - 1));
                chatTouchStartX.current = null;
              }}
            >
              <FeatureRow
                key={currentChatSlide.key}
                reverse={currentChatSlide.reverse}
                mockup={currentChatSlide.mockup}
                title={currentChatSlide.title}
                text={currentChatSlide.text}
                features={currentChatSlide.features}
              />
            </div>

            <div className="fp-slider-dots">
              {chatSlides.map((slide, index) => (
                <button
                  key={slide.key}
                  type="button"
                  aria-label={`Ga naar ${slide.label}`}
                  aria-current={index === chatSlide ? 'true' : undefined}
                  className={`fp-slider-dot${index === chatSlide ? ' fp-slider-dot--active' : ''}`}
                  onClick={() => setChatSlide(index)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE GRID ── */}
      <section className="hp-section" id="functies-overzicht">
        <div className="hp-section-inner">
          <DecorativeAvatar svg={decorativeAvatars.gridCorner} className="fp-deco-avatar--grid" />
          <SectionHeader title="Alles in één overzicht" />
          <div className="fp-grid fp-grid--desktop">
            {featureGridGroups.map((group) => (
              <div key={group.key} className="fp-grid-col">
                <div className="fp-grid-col-header">
                  <span className="fp-grid-col-header-icon" aria-hidden="true">{group.headerIcon}</span>
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <GridCard key={item.title} icon={item.icon} title={item.title} desc={item.desc} />
                ))}
              </div>
            ))}
          </div>
          <div className="fp-grid-mobile">
            <div
              id="fp-grid-mobile-panel"
              role="tabpanel"
              aria-labelledby={`fp-grid-mobile-tab-${activeFeatureGroup.key}`}
              className="fp-grid-mobile-panel"
            >
              <div ref={gridTabsMenuRef} className="fp-grid-mobile-header" role="tablist" aria-label="Overzichtsfuncties">
                {featureGridGroups.map((group, index) => (
                  <button
                    key={group.key}
                    id={`fp-grid-mobile-tab-${group.key}`}
                    ref={(element) => { gridTabRefs.current[index] = element; }}
                    type="button"
                    role="tab"
                    aria-selected={activeGridTab === group.key}
                    aria-controls="fp-grid-mobile-panel"
                    className={`fp-grid-mobile-inline-tab${activeGridTab === group.key ? ' fp-grid-mobile-inline-tab--active' : ''}`}
                    onClick={() => setActiveGridTab(group.key)}
                  >
                    <span className="fp-grid-mobile-tab-icon" aria-hidden="true">{group.tabIcon}</span>
                    <span>{group.label}</span>
                  </button>
                ))}
              </div>
              <div className="fp-grid-mobile-cards">
                {activeFeatureItems.map((item) => (
                  <GridCard key={`${activeFeatureGroup.key}-${item.title}`} icon={item.icon} title={item.title} desc={item.desc} />
                ))}
              </div>
              {activeFeatureGroup.items.length > 3 && (
                <button
                  type="button"
                  className="fp-grid-more-btn"
                  aria-expanded={expandedGridTabs[activeFeatureGroup.key]}
                  onClick={() => {
                    setExpandedGridTabs((prev) => ({
                      ...prev,
                      [activeFeatureGroup.key]: !prev[activeFeatureGroup.key],
                    }));
                    requestAnimationFrame(() => {
                      scrollGridSectionIntoView();
                    });
                  }}
                >
                  {expandedGridTabs[activeFeatureGroup.key] ? 'Minder tonen' : 'Meer tonen'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="ot-final-cta">
        <h2>Veilig verbonden.<br className="ot-final-cta-break" />{' '}Met wie echt telt.</h2>
        <p>Pulse helpt gezinnen om in contact te blijven op een manier die vertrouwd, veilig en rustig voelt. Voor kinderen. Voor ouders. Voor iedereen die erom geeft.</p>
        <div className="ot-final-cta-actions">
          <button type="button" className="hp-cta-btn" onClick={openParentSignup}>Ouderaccount aanmaken</button>
          <button
            type="button"
            className="hp-cta-btn hp-cta-btn--secondary"
            onClick={openLogin}
          >
            <Login size={18} /> Inloggen
          </button>
        </div>
      </section>

      {marketingAuthModals}

      </main>

      {/* ── FOOTER ── */}
      <MarketingFooter />

    </div>
  );
}
