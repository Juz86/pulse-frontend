// src/screens/FunctiePagina.js
import React, { useState, useEffect, useRef } from 'react';
import PulseLogo from '../components/PulseLogo';
import {
  MessageSquare, Users, AtSign, Star, Pin, Search, ArrowRight,
  Mic, Image, Phone, PhoneCall, PhoneMissed, Video, VideoOff,
  Bell, Timer, CheckCheck, Wifi, Clock, Repeat,
} from 'lucide-react';

// ── Scroll-in animatie hook ──────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

// ── Kleine CSS phone mockup helpers ─────────────────────────────────────────
function PhoneMockup({ children }) {
  return (
    <div className="hp-phone fp-phone">
      <div className="hp-phone-notch" />
      <div className="hp-phone-screen fp-phone-screen">
        {children}
      </div>
    </div>
  );
}

function ChatMockup() {
  return (
    <PhoneMockup>
      <div className="hp-mock-topbar">
        <div className="hp-mock-avatar-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff' }}>S</div>
        <span>Sara</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Phone size={12} color="rgba(255,255,255,0.5)" />
          <Video size={12} color="rgba(255,255,255,0.5)" />
        </div>
      </div>
      <div className="hp-mock-msgs">
        <div className="hp-mock-msg hp-mock-msg--in">Hoi! Alles goed? 👋</div>
        <div className="hp-mock-msg hp-mock-msg--out">Ja super! Jij?<span className="fp-ticks">✓✓</span></div>
        <div className="hp-mock-msg hp-mock-msg--in">Heel goed 😊</div>
        <div className="hp-mock-msg hp-mock-msg--out fp-msg-replied">
          <div className="fp-reply-quote">Heel goed 😊</div>
          Fijn! 🎉
          <span className="fp-ticks fp-ticks--blue">✓✓</span>
        </div>
      </div>
      <div className="hp-mock-inputbar" style={{ gap: 6 }}>
        <Mic size={11} color="rgba(255,255,255,0.4)" />
        <span style={{ flex: 1 }}>Bericht…</span>
        <ArrowRight size={11} color="#7c3aed" />
      </div>
    </PhoneMockup>
  );
}

function GroupMockup() {
  return (
    <PhoneMockup>
      <div className="hp-mock-topbar">
        <div className="hp-mock-avatar-sm" style={{ background: 'linear-gradient(135deg,#059669,#34d399)', color: '#fff', fontSize: 10 }}>GR</div>
        <span>Groep Familie</span>
        <div className="fp-badge-sm" style={{ marginLeft: 'auto' }}>3</div>
      </div>
      <div className="hp-mock-msgs">
        <div className="hp-mock-msg hp-mock-msg--in"><span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700 }}>Sara</span><br />Wie komt er zondag? 🗓️</div>
        <div className="hp-mock-msg hp-mock-msg--in"><span style={{ fontSize: 9, color: '#34d399', fontWeight: 700 }}>Papa</span><br />Wij zijn er!</div>
        <div className="hp-mock-msg hp-mock-msg--out"><span className="fp-mention">@Sara</span> wij ook!</div>
      </div>
      <div className="hp-mock-inputbar"><span>Bericht…</span></div>
    </PhoneMockup>
  );
}

function ManageMockup() {
  return (
    <PhoneMockup>
      <div className="hp-mock-topbar">
        <div className="hp-mock-avatar-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff' }}>S</div>
        <span>Sara</span>
      </div>
      <div className="hp-mock-msgs">
        <div className="hp-mock-msg hp-mock-msg--out" style={{ position: 'relative' }}>
          Goedemorgen! ☀️
          <span className="fp-star">★</span>
        </div>
        <div className="hp-mock-msg hp-mock-msg--in">Morgen! Klaar voor school?</div>
        <div className="hp-mock-msg hp-mock-msg--out fp-pinned-msg">
          <Pin size={9} color="#a78bfa" style={{ marginRight: 3 }} />
          Vergeet je boek niet!
        </div>
      </div>
      <div className="hp-mock-inputbar"><span>Bericht zoeken…</span><Search size={11} color="rgba(255,255,255,0.3)" /></div>
    </PhoneMockup>
  );
}

function VoiceMockup() {
  return (
    <PhoneMockup>
      <div className="hp-mock-topbar">
        <div className="hp-mock-avatar-sm" style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff' }}>S</div>
        <span>Sara</span>
      </div>
      <div className="hp-mock-msgs">
        <div className="hp-mock-msg hp-mock-msg--out">
          <Mic size={10} color="#a78bfa" style={{ marginRight: 4 }} />
          <div className="fp-voice-bar"><span /><span /><span /><span /><span /></div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>0:12</span>
        </div>
        <div className="hp-mock-msg hp-mock-msg--in">
          <Mic size={10} color="#34d399" style={{ marginRight: 4 }} />
          <div className="fp-voice-bar fp-voice-bar--in"><span /><span /><span /><span /><span /></div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>0:08</span>
        </div>
      </div>
      <div className="hp-mock-inputbar">
        <div className="fp-record-btn"><Mic size={11} color="#fff" /></div>
        <span>Ingedrukt houden…</span>
      </div>
    </PhoneMockup>
  );
}

function BgMockup() {
  return (
    <PhoneMockup>
      <div style={{ flex: 1, background: 'linear-gradient(135deg,#4c1d95,#7c3aed)', borderRadius: 8, display: 'flex', flexDirection: 'column', padding: 8, gap: 6 }}>
        <div className="hp-mock-msg hp-mock-msg--in" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>Mooie achtergrond! 🎨</div>
        <div className="hp-mock-msg hp-mock-msg--out" style={{ background: 'rgba(108,99,255,0.7)' }}>Dankjewel 😊</div>
        <div className="hp-mock-msg hp-mock-msg--in" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>Hoe stel je dat in?</div>
      </div>
      <div className="hp-mock-inputbar"><span>Bericht…</span></div>
    </PhoneMockup>
  );
}

function CallMockup() {
  return (
    <PhoneMockup>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff' }}>S</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Sara</div>
        <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>02:47</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div className="fp-call-btn fp-call-btn--mute"><Mic size={13} color="#fff" /></div>
          <div className="fp-call-btn fp-call-btn--end"><Phone size={13} color="#fff" style={{ transform: 'rotate(135deg)' }} /></div>
        </div>
      </div>
    </PhoneMockup>
  );
}

function CallHistoryMockup() {
  return (
    <PhoneMockup>
      <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', padding: '2px 4px', marginBottom: 2 }}>Belgeschiedenis</div>
        {[
          { name: 'Sara', icon: <PhoneCall size={10} color="#22c55e" />, time: 'Vandaag 14:02', dur: '3m 12s' },
          { name: 'Papa', icon: <PhoneMissed size={10} color="#ef4444" />, time: 'Gisteren', dur: 'Gemist' },
          { name: 'Sara', icon: <PhoneCall size={10} color="#22c55e" />, time: 'Ma 10:00', dur: '8m 55s' },
        ].map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 4px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', flexShrink: 0 }}>{c.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{c.name}</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 3 }}>{c.icon}{c.time}</div>
            </div>
            <div style={{ fontSize: 9, color: c.dur === 'Gemist' ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>{c.dur}</div>
          </div>
        ))}
      </div>
    </PhoneMockup>
  );
}

function VideoMockup() {
  return (
    <PhoneMockup>
      <div style={{ flex: 1, background: '#1a1a2e', borderRadius: 8, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 32 }}>👩</div>
        <div style={{ position: 'absolute', bottom: 8, right: 8, width: 36, height: 50, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧒</div>
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 6, padding: '2px 6px', fontSize: 9, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />05:33
        </div>
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
          <div className="fp-call-btn fp-call-btn--sm"><Mic size={10} color="#fff" /></div>
          <div className="fp-call-btn fp-call-btn--end fp-call-btn--sm"><Phone size={10} color="#fff" style={{ transform: 'rotate(135deg)' }} /></div>
          <div className="fp-call-btn fp-call-btn--sm"><VideoOff size={10} color="#fff" /></div>
        </div>
      </div>
    </PhoneMockup>
  );
}

function PrivacyVideoMockup() {
  return (
    <PhoneMockup>
      <div style={{ flex: 1, background: '#1a1a2e', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <VideoOff size={20} color="rgba(255,255,255,0.4)" />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Camera uitgeschakeld</div>
        <div style={{ fontSize: 20, marginTop: 4 }}>👩</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Sara</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <div className="fp-call-btn fp-call-btn--sm"><Mic size={10} color="#fff" /></div>
          <div className="fp-call-btn fp-call-btn--end fp-call-btn--sm"><Phone size={10} color="#fff" style={{ transform: 'rotate(135deg)' }} /></div>
          <div className="fp-call-btn fp-call-btn--sm fp-call-btn--active"><Video size={10} color="#fff" /></div>
        </div>
      </div>
    </PhoneMockup>
  );
}

// ── Feature rij ─────────────────────────────────────────────────────────────
function FeatureRow({ reverse, mockup, title, text, features, id }) {
  const [ref, visible] = useFadeIn();
  return (
    <div
      ref={ref}
      id={id}
      className={`hp-feature-row${reverse ? ' hp-feature-row--reverse' : ''} fp-feature-row${visible ? ' fp-visible' : ''}`}
    >
      <div className="hp-feature-mockup">{mockup}</div>
      <div className="hp-feature-text">
        <h3>{title}</h3>
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

// ── Feature grid kaart ───────────────────────────────────────────────────────
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

// ── Sectie koptekst ──────────────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`hp-section-header fp-section-header${visible ? ' fp-visible' : ''}`}>
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

// ── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function FunctiePagina({ onParentClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('chatten');

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

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    scrollTo(tab);
  };

  return (
    <div className="hp-root">

      {/* ── NAVIGATIE ── */}
      <nav className={`hp-nav${scrolled ? ' hp-nav--scrolled' : ''}`}>
        <a className="hp-nav-logo" href="/">
          <PulseLogo size={30} textSize={20} color="#fff" />
        </a>
        <div className={`hp-nav-links${menuOpen ? ' hp-nav-links--open' : ''}`}>
          <a href="/functies" className="fp-nav-active">Functies</a>
          <button onClick={() => { window.location.href = '/'; setMenuOpen(false); }}>Veiligheid</button>
          <button onClick={() => { window.location.href = '/'; setMenuOpen(false); }}>Ouderlijk toezicht</button>
          <button onClick={() => { window.location.href = '/'; setMenuOpen(false); }}>Over Pulse</button>
        </div>
        <button className="hp-nav-ouder" onClick={onParentClick}>❤️ Ouder</button>
        <button className="hp-nav-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="hp-hero fp-hero">
        <div className="fp-hero-inner">
          <div className="fp-hero-badge">✨ Alles wat je nodig hebt</div>
          <h1 className="fp-hero-title">
            Alles wat je nodig hebt om<br />verbonden te blijven
          </h1>
          <p className="fp-hero-sub">
            Pulse biedt alle communicatiefuncties die kinderen en ouders nodig hebben —
            veilig, afleidingsvrij en by design zonder pesterij.
          </p>
          <div className="fp-tabs">
            {[
              { id: 'chatten', label: '💬 Chatten' },
              { id: 'bellen', label: '📞 Bellen' },
              { id: 'videobellen', label: '🎥 Videobellen' },
            ].map(t => (
              <button
                key={t.id}
                className={`fp-tab${activeTab === t.id ? ' fp-tab--active' : ''}`}
                onClick={() => handleTabClick(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTIE: CHATTEN ── */}
      <section className="hp-section" id="chatten">
        <div className="hp-section-inner">
          <SectionHeader
            title="Chatten"
            sub="Snel en veilig berichten sturen zonder telefoonnummer."
          />
          <FeatureRow
            mockup={<ChatMockup />}
            title="Real-time berichten"
            text="Berichten komen instant aan via Socket.IO — net als WhatsApp. Met bezorgstatus ✓ ✓✓ en leesbevestiging in blauw."
            features={[
              { icon: <MessageSquare size={14} />, label: '1-op-1 en groepsgesprekken' },
              { icon: <CheckCheck size={14} />, label: 'Bezorgd- en leesbevestiging' },
              { icon: <Clock size={14} />, label: 'Typ-indicator' },
              { icon: <Wifi size={14} />, label: 'Offline berichten via Redis' },
            ]}
          />
          <FeatureRow
            reverse
            mockup={<GroupMockup />}
            title="Groepen en @ vermeldingen"
            text="Maak groepen aan voor familie of vrienden. Vermeld iemand direct met @naam voor een directe melding."
            features={[
              { icon: <Users size={14} />, label: 'Groep aanmaken met naam en foto' },
              { icon: <AtSign size={14} />, label: '@ vermeldingen met melding' },
              { icon: <Users size={14} />, label: 'Groepsleden beheren' },
              { icon: <Bell size={14} />, label: 'Ongelezen badge per gesprek' },
            ]}
          />
          <FeatureRow
            mockup={<ManageMockup />}
            title="Volledige berichtencontrole"
            text="Beantwoord, bewerk, verwijder of stuur berichten door. Sla belangrijke berichten op met een ster."
            features={[
              { icon: <ArrowRight size={14} />, label: 'Reply, bewerken, verwijderen' },
              { icon: <Repeat size={14} />, label: 'Berichten doorsturen' },
              { icon: <Star size={14} />, label: 'Berichten sterren & overzicht' },
              { icon: <Pin size={14} />, label: 'Berichten vastzetten' },
              { icon: <Search size={14} />, label: 'Berichten zoeken in gesprek' },
            ]}
          />
          <FeatureRow
            reverse
            mockup={<VoiceMockup />}
            title="Spraakberichten"
            text="Neem een spraakbericht op met één druk op de microfoonknop. Berichten worden na 30 dagen automatisch verwijderd."
            features={[
              { icon: <Mic size={14} />, label: 'Ingedrukt houden om op te nemen' },
              { icon: <Timer size={14} />, label: 'Afspelen met voortgangsbalk' },
              { icon: <Clock size={14} />, label: 'Automatisch verwijderd na 30 dagen' },
            ]}
          />
          <FeatureRow
            mockup={<BgMockup />}
            title="Persoonlijke chatachtergrond"
            text="Maak je chat persoonlijk met een eigen foto of kleur als achtergrond. Alleen jij ziet je eigen achtergrond."
            features={[
              { icon: <Image size={14} />, label: "Foto uploaden als achtergrond" },
              { icon: <span style={{ fontSize: 14 }}>🎨</span>, label: 'Kleur kiezen' },
              { icon: <span style={{ fontSize: 14 }}>✦</span>, label: 'Standaard achtergrond' },
            ]}
          />
        </div>
      </section>

      {/* ── SECTIE: BELLEN ── */}
      <section className="hp-section hp-section--gray" id="bellen">
        <div className="hp-section-inner">
          <SectionHeader
            title="Bellen"
            sub="Bel gratis met vrienden en familie — zonder telefoonnummer, zonder tijdslimiet."
          />
          <FeatureRow
            mockup={<CallMockup />}
            title="HD spraakoproepen"
            text="Bel met heldere geluidskwaliteit via WebRTC. Werkt op wifi en mobiel data, ook bij trage verbinding."
            features={[
              { icon: <Phone size={14} />, label: '1-op-1 spraakoproepen' },
              { icon: <Mic size={14} />, label: 'Microfoon dempen / activeren' },
              { icon: <Timer size={14} />, label: 'Gespreksduur timer' },
              { icon: <PhoneMissed size={14} />, label: 'Gemiste oproepen badge' },
            ]}
          />
          <FeatureRow
            reverse
            mockup={<CallHistoryMockup />}
            title="Belgeschiedenis"
            text="Zie al je gesprekken terug in de chat en in het belgeschiedenisoverzicht. Mis nooit een oproep."
            features={[
              { icon: <PhoneCall size={14} />, label: 'Belgeschiedenis in gesprek' },
              { icon: <PhoneMissed size={14} />, label: 'Gemiste oproepen melding' },
              { icon: <Bell size={14} />, label: 'Push notificatie bij gemiste oproep' },
              { icon: <Phone size={14} />, label: 'Bezet-status bij dubbele oproep' },
            ]}
          />
        </div>
      </section>

      {/* ── SECTIE: VIDEOBELLEN ── */}
      <section className="hp-section" id="videobellen">
        <div className="hp-section-inner">
          <SectionHeader
            title="Videobellen"
            sub="Zie wie je belt in HD kwaliteit — alsof je samen in dezelfde kamer bent."
          />
          <FeatureRow
            mockup={<VideoMockup />}
            title="HD videogesprekken"
            text="Videobel met scherpe kwaliteit via WebRTC. Wissel eenvoudig van spraak naar video tijdens een gesprek."
            features={[
              { icon: <Video size={14} />, label: '1-op-1 videogesprekken' },
              { icon: <VideoOff size={14} />, label: 'Camera aan/uit' },
              { icon: <Mic size={14} />, label: 'Microfoon dempen' },
              { icon: <ArrowRight size={14} />, label: 'Spraak upgraden naar video' },
              { icon: <span style={{ fontSize: 14 }}>⊡</span>, label: 'Gesprek minimaliseren (overlay)' },
            ]}
          />
          <FeatureRow
            reverse
            mockup={<PrivacyVideoMockup />}
            title="Jij bepaalt wat zichtbaar is"
            text="Schakel je camera uit wanneer je wilt. Je gesprekken zijn beveiligd en alleen jij en je gesprekspartner kunnen meedoen."
            features={[
              { icon: <VideoOff size={14} />, label: 'Camera aan/uit tijdens gesprek' },
              { icon: <Bell size={14} />, label: 'Beltoon bij inkomend gesprek' },
              { icon: <Bell size={14} />, label: 'Push notificatie bij gemiste video' },
            ]}
          />
        </div>
      </section>

      {/* ── FEATURE GRID ── */}
      <section className="hp-section hp-section--gray fp-grid-section">
        <div className="hp-section-inner">
          <SectionHeader title="Alles in één overzicht" sub="" />
          <div className="fp-grid">
            {/* Chatten */}
            <div className="fp-grid-col">
              <div className="fp-grid-col-header">💬 Chatten</div>
              <GridCard icon={<MessageSquare size={18} />} title="Real-time berichten" desc="Socket.IO voor instant delivery" />
              <GridCard icon={<AtSign size={18} />} title="Groepen & @mentions" desc="Vermeld iemand direct" />
              <GridCard icon={<Mic size={18} />} title="Spraakberichten" desc="Opnemen & afspelen" />
              <GridCard icon={<Image size={18} />} title="Chatachtergrond" desc="Foto of kleur naar keuze" />
              <GridCard icon={<Star size={18} />} title="Berichten sterren" desc="Sla belangrijke berichten op" />
              <GridCard icon={<MessageSquare size={18} />} title="Conceptberichten" desc="Bewaard per gesprek" />
            </div>
            {/* Bellen */}
            <div className="fp-grid-col">
              <div className="fp-grid-col-header">📞 Bellen</div>
              <GridCard icon={<Phone size={18} />} title="HD Spraakoproepen" desc="Helder geluid via WebRTC" />
              <GridCard icon={<PhoneCall size={18} />} title="Belgeschiedenis" desc="Overzicht in chat & logboek" />
              <GridCard icon={<PhoneMissed size={18} />} title="Gemiste oproepen melding" desc="Badge & notificatie" />
              <GridCard icon={<Bell size={18} />} title="Push notificaties" desc="Ook als app op achtergrond" />
              <GridCard icon={<Timer size={18} />} title="Gespreksduur timer" desc="Altijd zichtbaar tijdens gesprek" />
              <GridCard icon={<Phone size={18} />} title="Bezet-status" desc="Automatisch bij dubbele oproep" />
            </div>
            {/* Videobellen */}
            <div className="fp-grid-col">
              <div className="fp-grid-col-header">🎥 Videobellen</div>
              <GridCard icon={<Video size={18} />} title="HD Videogesprekken" desc="Scherp beeld via WebRTC" />
              <GridCard icon={<VideoOff size={18} />} title="Camera aan/uit" desc="Jij bepaalt wat zichtbaar is" />
              <GridCard icon={<ArrowRight size={18} />} title="Spraak → Video upgrade" desc="Wissel tijdens gesprek" />
              <GridCard icon={<span style={{ fontSize: 18 }}>⊡</span>} title="Gesprek minimaliseren" desc="Overlay terwijl je chat" />
              <GridCard icon={<Bell size={18} />} title="Beltoon inkomend gesprek" desc="Nooit een oproep missen" />
              <GridCard icon={<CheckCheck size={18} />} title="WebRTC end-to-end" desc="Beveiligde verbinding" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="hp-cta">
        <div className="hp-cta-inner">
          <h2>Klaar om te starten?</h2>
          <p>Maak gratis een account aan.</p>
          <button className="hp-cta-btn" onClick={() => window.location.href = '/'}>
            Gratis registreren
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="hp-footer" id="footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-brand">
            <div className="hp-footer-logo">
              <img src="/logo192.png" alt="Pulse" width={28} height={28} />
              <span>Pulse</span>
            </div>
            <p>Veilig communiceren voor elk kind.</p>
          </div>
          <div className="hp-footer-col">
            <h4>Functies</h4>
            <span onClick={() => scrollTo('chatten')}>Chatten</span>
            <span onClick={() => scrollTo('bellen')}>Bellen</span>
            <span onClick={() => scrollTo('videobellen')}>Videobellen</span>
            <span>Ouderlijk toezicht</span>
          </div>
          <div className="hp-footer-col">
            <h4>Over Pulse</h4>
            <span>Over ons</span>
            <span>Privacy</span>
            <span>AVG-beleid</span>
            <span>Contact</span>
          </div>
          <div className="hp-footer-col">
            <h4>Downloaden</h4>
            <span>Web app</span>
            <span>iOS</span>
            <span>Android</span>
          </div>
        </div>
        <div className="hp-footer-copy">© 2025 Pulse — Echt Nederlands. Echt veilig.</div>
      </footer>

    </div>
  );
}
