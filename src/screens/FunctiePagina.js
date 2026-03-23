// src/screens/FunctiePagina.js
import React, { useState, useEffect, useRef } from 'react';
import PulseLogo from '../components/PulseLogo';
import {
  Phone, Video, VideoOff, Mic, MicOff,
  Message, Users, User, Search, Bell,
  Pin, StarFilled, CheckDouble, Check,
  Forward, Reply, ImageIcon, Palette,
  Refresh, Clock, Wifi, Logout,
  Lightbulb, Delete, PhoneCall, PhoneMissed, PhoneEnd,
} from '../components/Icons';
import { MdAlternateEmail, MdSend } from 'react-icons/md';

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
function PhoneMockup({ children, tall }) {
  return (
    <div className={`hp-phone fp-phone${tall ? ' fp-phone--tall' : ''}`}>
      <div className="hp-phone-notch" />
      <div className="hp-phone-screen fp-phone-screen">
        {children}
      </div>
    </div>
  );
}

// ── Avatar helper ────────────────────────────────────────────────────────────
function MockAvatar({ letter, gradient = 'linear-gradient(135deg,#7c3aed,#a78bfa)', size = 28, online }) {
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
          border: '1.5px solid #1a1830',
        }} />
      )}
    </div>
  );
}

// ── Gedeelde chat-header (terug + avatar + naam + bel/video/zoek knoppen) ────
function ChatHeader({ letter, name, gradient = 'linear-gradient(135deg,#7c3aed,#a78bfa)', online, isGroup }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 8px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
      {/* Terug */}
      <div style={{ width: 22, height: 22, borderRadius: 7, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>←</span>
      </div>
      {/* Avatar */}
      <MockAvatar letter={letter} gradient={gradient} size={26} online={online} />
      {/* Naam */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        {online && !isGroup && <div style={{ fontSize: 8, color: '#22c55e' }}>Online</div>}
        {isGroup && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>Groep</div>}
      </div>
      {/* Actieknoppen */}
      <div style={{ width: 24, height: 24, borderRadius: 8, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Phone size={12} color="#fff" />
      </div>
      <div style={{ width: 24, height: 24, borderRadius: 8, background: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Video size={12} color="#fff" />
      </div>
      <div style={{ width: 24, height: 24, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Search size={12} color="rgba(255,255,255,0.6)" />
      </div>
    </div>
  );
}

// ── Mockup 1: Sidebar (hoofd chatscherm) ─────────────────────────────────────
function SidebarMockup() {
  return (
    <PhoneMockup tall>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 0 8px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <PulseLogo size={16} textSize={12} color="#fff" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
          <Message size={14} color="rgba(255,255,255,0.5)" />
          <Phone size={14} color="rgba(255,255,255,0.5)" />
          <Users size={14} color="rgba(255,255,255,0.5)" />
          <Bell size={14} color="rgba(255,255,255,0.5)" />
        </div>
      </div>
      {/* Zoekbalk */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '5px 8px', margin: '6px 0' }}>
        <Search size={11} color="rgba(255,255,255,0.3)" />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Zoeken…</span>
      </div>
      {/* Tabs */}
      <div style={{ display: 'flex', borderRadius: 10, background: 'rgba(255,255,255,0.06)', padding: 2, marginBottom: 6 }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', borderRadius: 8, background: '#7c3aed', fontSize: 9, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <Message size={10} color="#fff" />Chats
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 9, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <Users size={10} color="rgba(255,255,255,0.4)" />Contacten
        </div>
      </div>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {['Alles', 'Familie', 'Vrienden', 'Groepen'].map((f, i) => (
          <div key={f} style={{
            padding: '2px 7px', borderRadius: 20, fontSize: 8, fontWeight: 600,
            background: i === 0 ? '#7c3aed' : 'rgba(255,255,255,0.07)',
            color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)',
          }}>{f}</div>
        ))}
      </div>
      {/* Contact rij */}
      {[
        { letter: 'Y', name: 'Yousef', sub: 'Spraakoproep', gradient: 'linear-gradient(135deg,#ec4899,#8b5cf6)', online: true, unread: null },
        { letter: 'S', name: 'Sara', sub: 'Goedemorgen! ☀️', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)', online: true, unread: 2 },
        { letter: 'GR', name: 'Groep Familie', sub: 'Papa: Wij zijn er!', gradient: 'linear-gradient(135deg,#059669,#34d399)', online: false, unread: null },
      ].map(c => (
        <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <MockAvatar letter={c.letter} gradient={c.gradient} size={28} online={c.online} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.sub}</div>
          </div>
          {c.unread && (
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#7c3aed', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.unread}</div>
          )}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      {/* Footer met gebruiker + knoppen */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 8, marginTop: 4 }}>
        <MockAvatar letter="K" gradient="linear-gradient(135deg,#ec4899,#8b5cf6)" size={26} online />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>Kamilah</div>
          <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 600 }}>● Online</div>
        </div>
        <div className="fp-footer-icon-btn"><Lightbulb size={12} color="rgba(255,255,255,0.6)" /></div>
        <div className="fp-footer-icon-btn"><Logout size={12} color="rgba(255,255,255,0.6)" /></div>
      </div>
    </PhoneMockup>
  );
}

// ── Mockup 2: Chat berichten ─────────────────────────────────────────────────
function ChatMockup() {
  return (
    <PhoneMockup>
      <ChatHeader letter="S" name="Sara" online />
      <div className="hp-mock-msgs">
        <div className="hp-mock-msg hp-mock-msg--in">Hoi! Alles goed? 👋</div>
        <div className="hp-mock-msg hp-mock-msg--out" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          Ja super! Jij?
          <CheckDouble size={11} color="#60a5fa" />
        </div>
        <div className="hp-mock-msg hp-mock-msg--in">Heel goed 😊</div>
        <div className="hp-mock-msg hp-mock-msg--out">
          <div style={{ fontSize: 9, color: 'rgba(167,139,250,0.8)', borderLeft: '2px solid #7c3aed', paddingLeft: 5, marginBottom: 3 }}>Heel goed 😊</div>
          Fijn! 🎉
          <CheckDouble size={11} color="#60a5fa" style={{ marginLeft: 4 }} />
        </div>
      </div>
      <div className="hp-mock-inputbar" style={{ gap: 6 }}>
        <Mic size={12} color="rgba(255,255,255,0.4)" />
        <span style={{ flex: 1 }}>Bericht…</span>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MdSend size={11} color="#fff" />
        </div>
      </div>
    </PhoneMockup>
  );
}

// ── Mockup 3: Groep ──────────────────────────────────────────────────────────
function GroupMockup() {
  return (
    <PhoneMockup>
      <ChatHeader letter="GR" name="Groep Familie" gradient="linear-gradient(135deg,#059669,#34d399)" isGroup />
      <div className="hp-mock-msgs">
        <div className="hp-mock-msg hp-mock-msg--in">
          <span style={{ fontSize: 9, color: '#a78bfa', fontWeight: 700, display: 'block', marginBottom: 2 }}>Sara</span>
          Wie komt er zondag? 🗓️
        </div>
        <div className="hp-mock-msg hp-mock-msg--in">
          <span style={{ fontSize: 9, color: '#34d399', fontWeight: 700, display: 'block', marginBottom: 2 }}>Papa</span>
          Wij zijn er!
        </div>
        <div className="hp-mock-msg hp-mock-msg--out">
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>@Sara</span> wij ook!
          <CheckDouble size={11} color="#60a5fa" style={{ marginLeft: 4 }} />
        </div>
      </div>
      <div className="hp-mock-inputbar">
        <MdAlternateEmail size={12} color="rgba(255,255,255,0.4)" />
        <span style={{ flex: 1 }}>Bericht…</span>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MdSend size={11} color="#fff" />
        </div>
      </div>
    </PhoneMockup>
  );
}

// ── Mockup 4: Berichten beheren ──────────────────────────────────────────────
function ManageMockup() {
  return (
    <PhoneMockup>
      <ChatHeader letter="S" name="Sara" online />
      <div className="hp-mock-msgs">
        <div className="hp-mock-msg hp-mock-msg--out" style={{ position: 'relative' }}>
          Goedemorgen! ☀️
          <StarFilled size={10} color="#fbbf24" style={{ position: 'absolute', top: 4, right: 6 }} />
        </div>
        <div className="hp-mock-msg hp-mock-msg--in">Morgen! Klaar voor school?</div>
        <div className="hp-mock-msg hp-mock-msg--out" style={{ borderLeft: '2px solid #7c3aed', paddingLeft: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <Pin size={10} color="#a78bfa" />
          Vergeet je boek niet!
        </div>
        <div className="hp-mock-msg hp-mock-msg--in" style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.6, fontStyle: 'italic' }}>
          <Reply size={10} color="rgba(255,255,255,0.4)" />
          bericht verwijderd
        </div>
      </div>
      <div className="hp-mock-inputbar"><span style={{ flex: 1 }}>Doorzoek berichten…</span><Search size={11} color="rgba(255,255,255,0.3)" /></div>
    </PhoneMockup>
  );
}

// ── Mockup 5: Spraakberichten ────────────────────────────────────────────────
function VoiceMockup() {
  return (
    <PhoneMockup>
      <ChatHeader letter="S" name="Sara" online />
      <div className="hp-mock-msgs">
        <div className="hp-mock-msg hp-mock-msg--out" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Mic size={12} color="#a78bfa" />
          <div className="fp-voice-bar"><span /><span /><span /><span /><span /></div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>0:12</span>
          <CheckDouble size={10} color="#60a5fa" />
        </div>
        <div className="hp-mock-msg hp-mock-msg--in" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Mic size={12} color="#34d399" />
          <div className="fp-voice-bar fp-voice-bar--in"><span /><span /><span /><span /><span /></div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginLeft: 2 }}>0:08</span>
        </div>
      </div>
      <div className="hp-mock-inputbar">
        <div className="fp-record-btn"><Mic size={12} color="#fff" /></div>
        <span style={{ flex: 1, fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>Houd ingedrukt om op te nemen…</span>
      </div>
    </PhoneMockup>
  );
}

// ── Mockup 6: Chatachtergrond ────────────────────────────────────────────────
function BgMockup() {
  return (
    <PhoneMockup>
      <ChatHeader letter="S" name="Sara" online />
      <div style={{ flex: 1, background: 'linear-gradient(135deg,#4c1d95,#7c3aed)', borderRadius: 8, display: 'flex', flexDirection: 'column', padding: 8, gap: 6, margin: '4px 0' }}>
        <div className="hp-mock-msg hp-mock-msg--in" style={{ background: 'rgba(255,255,255,0.18)' }}>Mooie achtergrond! 🎨</div>
        <div className="hp-mock-msg hp-mock-msg--out" style={{ background: 'rgba(108,99,255,0.7)' }}>Dankjewel 😊</div>
        <div className="hp-mock-msg hp-mock-msg--in" style={{ background: 'rgba(255,255,255,0.18)' }}>Hoe stel je dat in?</div>
      </div>
      <div className="hp-mock-inputbar"><span style={{ flex: 1 }}>Bericht…</span></div>
    </PhoneMockup>
  );
}

// ── Mockup 7: Spraakoproep ───────────────────────────────────────────────────
function CallMockup() {
  return (
    <PhoneMockup>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <MockAvatar letter="S" size={56} online />
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Sara</div>
        <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>02:47</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          <div className="fp-call-btn"><Mic size={14} color="#fff" /></div>
          <div className="fp-call-btn fp-call-btn--end"><PhoneEnd size={14} color="#fff" /></div>
        </div>
      </div>
    </PhoneMockup>
  );
}

// ── Mockup 8: Belgeschiedenis ────────────────────────────────────────────────
function CallHistoryMockup() {
  const items = [
    { letter: 'S', name: 'Sara', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)', Icon: PhoneCall, iconColor: '#22c55e', time: 'Vandaag 14:02', dur: '3m 12s' },
    { letter: 'P', name: 'Papa', gradient: 'linear-gradient(135deg,#059669,#34d399)', Icon: PhoneMissed, iconColor: '#ef4444', time: 'Gisteren', dur: 'Gemist' },
    { letter: 'S', name: 'Sara', gradient: 'linear-gradient(135deg,#7c3aed,#a78bfa)', Icon: PhoneCall, iconColor: '#22c55e', time: 'Ma 10:00', dur: '8m 55s' },
  ];
  return (
    <PhoneMockup>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Belgeschiedenis</div>
      {items.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <MockAvatar letter={c.letter} gradient={c.gradient} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{c.name}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <c.Icon size={10} color={c.iconColor} />{c.time}
            </div>
          </div>
          <div style={{ fontSize: 9, color: c.dur === 'Gemist' ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>{c.dur}</div>
        </div>
      ))}
    </PhoneMockup>
  );
}

// ── Mockup 9: Videogesprek ───────────────────────────────────────────────────
function VideoMockup() {
  return (
    <PhoneMockup>
      {/* Volledig scherm: remote persoon */}
      <div style={{ flex: 1, background: 'linear-gradient(180deg,#1a0a2e 0%,#0d0820 100%)', borderRadius: 8, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 260 }}>
        {/* Remote: grote emoji + naam */}
        <div style={{ fontSize: 56, lineHeight: 1, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}>👩</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Sara</div>

        {/* Timer linksboven */}
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 8px', fontSize: 9, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />05:33
        </div>

        {/* PiP: lokale camera rechtsonder */}
        <div style={{ position: 'absolute', bottom: 44, right: 8, width: 44, height: 60, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
          <div style={{ fontSize: 22, lineHeight: 1 }}>🧒</div>
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>Jij</div>
        </div>

        {/* Bediening onderaan */}
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="fp-call-btn fp-call-btn--sm"><Mic size={11} color="#fff" /></div>
          <div className="fp-call-btn fp-call-btn--end fp-call-btn--sm"><PhoneEnd size={11} color="#fff" /></div>
          <div className="fp-call-btn fp-call-btn--sm"><VideoOff size={11} color="#fff" /></div>
        </div>
      </div>
    </PhoneMockup>
  );
}

// ── Mockup 10: Camera privacy ────────────────────────────────────────────────
function PrivacyVideoMockup() {
  return (
    <PhoneMockup>
      <div style={{ flex: 1, background: 'linear-gradient(180deg,#1a0a2e 0%,#0d0820 100%)', borderRadius: 8, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 260 }}>
        {/* Remote: grote emoji + naam */}
        <div style={{ fontSize: 56, lineHeight: 1 }}>👩</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Sara</div>

        {/* PiP: camera uit */}
        <div style={{ position: 'absolute', bottom: 44, right: 8, width: 44, height: 60, background: 'rgba(255,255,255,0.06)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: '2px solid rgba(255,255,255,0.1)' }}>
          <VideoOff size={16} color="rgba(255,255,255,0.4)" />
          <div style={{ fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>Jij</div>
        </div>

        {/* Timer */}
        <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '2px 8px', fontSize: 9, color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />03:21
        </div>

        {/* Bediening */}
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
          <div className="fp-call-btn fp-call-btn--sm"><Mic size={11} color="#fff" /></div>
          <div className="fp-call-btn fp-call-btn--end fp-call-btn--sm"><PhoneEnd size={11} color="#fff" /></div>
          <div className="fp-call-btn fp-call-btn--sm fp-call-btn--active"><Video size={11} color="#fff" /></div>
        </div>
      </div>
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

function SectionHeader({ title, sub }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} className={`hp-section-header fp-section-header${visible ? ' fp-visible' : ''}`}>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );
}

// ── Hoofdcomponent ────────────────────────────────────────────────────────────
export default function FunctiePagina({ onParentClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('chatten');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <div className="hp-root">

      {/* ── NAVIGATIE ── */}
      <nav className={`hp-nav${scrolled ? ' hp-nav--scrolled' : ''}`}>
        <a className="hp-nav-logo" href="/"><PulseLogo size={30} textSize={20} color="#fff" /></a>
        <div className={`hp-nav-links${menuOpen ? ' hp-nav-links--open' : ''}`}>
          <a href="/functies" className="fp-nav-active">Functies</a>
          <button onClick={() => { window.location.href = '/'; }}>Veiligheid</button>
          <button onClick={() => { window.location.href = '/'; }}>Ouderlijk toezicht</button>
          <button onClick={() => { window.location.href = '/'; }}>Over Pulse</button>
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
              <button key={t.id}
                className={`fp-tab${activeTab === t.id ? ' fp-tab--active' : ''}`}
                onClick={() => { setActiveTab(t.id); scrollTo(t.id); }}
              >{t.label}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHATTEN ── */}
      <section className="hp-section" id="chatten">
        <div className="hp-section-inner">
          <SectionHeader title="Chatten" sub="Snel en veilig berichten sturen zonder telefoonnummer." />

          <FeatureRow
            mockup={<SidebarMockup />}
            title="Real-time berichten"
            text="Berichten komen instant aan via Socket.IO — net als WhatsApp. Met bezorgstatus ✓ ✓✓ en leesbevestiging in blauw."
            features={[
              { icon: <Message size={15} />, label: '1-op-1 en groepsgesprekken' },
              { icon: <CheckDouble size={15} />, label: 'Bezorgd- en leesbevestiging' },
              { icon: <Clock size={15} />, label: 'Typ-indicator' },
              { icon: <Wifi size={15} />, label: 'Offline berichten via Redis' },
            ]}
          />
          <FeatureRow reverse
            mockup={<GroupMockup />}
            title="Groepen en @ vermeldingen"
            text="Maak groepen aan voor familie of vrienden. Vermeld iemand direct met @naam voor een directe melding."
            features={[
              { icon: <Users size={15} />, label: 'Groep aanmaken met naam en foto' },
              { icon: <MdAlternateEmail size={15} />, label: '@ vermeldingen met melding' },
              { icon: <Users size={15} />, label: 'Groepsleden beheren' },
              { icon: <Bell size={15} />, label: 'Ongelezen badge per gesprek' },
            ]}
          />
          <FeatureRow
            mockup={<ManageMockup />}
            title="Volledige berichtencontrole"
            text="Beantwoord, bewerk, verwijder of stuur berichten door. Sla belangrijke berichten op met een ster."
            features={[
              { icon: <Reply size={15} />, label: 'Reply, bewerken, verwijderen' },
              { icon: <Forward size={15} />, label: 'Berichten doorsturen' },
              { icon: <StarFilled size={15} />, label: 'Berichten sterren & overzicht' },
              { icon: <Pin size={15} />, label: 'Berichten vastzetten' },
              { icon: <Search size={15} />, label: 'Berichten zoeken in gesprek' },
            ]}
          />
          <FeatureRow reverse
            mockup={<VoiceMockup />}
            title="Spraakberichten"
            text="Neem een spraakbericht op met één druk op de microfoonknop. Berichten worden na 30 dagen automatisch verwijderd."
            features={[
              { icon: <Mic size={15} />, label: 'Ingedrukt houden om op te nemen' },
              { icon: <Clock size={15} />, label: 'Afspelen met voortgangsbalk' },
              { icon: <Clock size={15} />, label: 'Automatisch verwijderd na 30 dagen' },
            ]}
          />
          <FeatureRow
            mockup={<BgMockup />}
            title="Persoonlijke chatachtergrond"
            text="Maak je chat persoonlijk met een eigen foto of kleur als achtergrond. Alleen jij ziet je eigen achtergrond."
            features={[
              { icon: <ImageIcon size={15} />, label: 'Foto uploaden als achtergrond' },
              { icon: <Palette size={15} />, label: 'Kleur kiezen' },
              { icon: <Palette size={15} />, label: 'Standaard achtergrond' },
            ]}
          />
        </div>
      </section>

      {/* ── BELLEN ── */}
      <section className="hp-section hp-section--gray" id="bellen">
        <div className="hp-section-inner">
          <SectionHeader title="Bellen" sub="Bel gratis met vrienden en familie — zonder telefoonnummer, zonder tijdslimiet." />
          <FeatureRow
            mockup={<CallMockup />}
            title="HD spraakoproepen"
            text="Bel met heldere geluidskwaliteit via WebRTC. Werkt op wifi en mobiel data, ook bij trage verbinding."
            features={[
              { icon: <Phone size={15} />, label: '1-op-1 spraakoproepen' },
              { icon: <Mic size={15} />, label: 'Microfoon dempen / activeren' },
              { icon: <Clock size={15} />, label: 'Gespreksduur timer' },
              { icon: <PhoneMissed size={15} />, label: 'Gemiste oproepen badge' },
            ]}
          />
          <FeatureRow reverse
            mockup={<CallHistoryMockup />}
            title="Belgeschiedenis"
            text="Zie al je gesprekken terug in de chat en in het belgeschiedenisoverzicht. Mis nooit een oproep."
            features={[
              { icon: <PhoneCall size={15} />, label: 'Belgeschiedenis in gesprek' },
              { icon: <PhoneMissed size={15} />, label: 'Gemiste oproepen melding' },
              { icon: <Bell size={15} />, label: 'Push notificatie bij gemiste oproep' },
              { icon: <Phone size={15} />, label: 'Bezet-status bij dubbele oproep' },
            ]}
          />
        </div>
      </section>

      {/* ── VIDEOBELLEN ── */}
      <section className="hp-section" id="videobellen">
        <div className="hp-section-inner">
          <SectionHeader title="Videobellen" sub="Zie wie je belt in HD kwaliteit — alsof je samen in dezelfde kamer bent." />
          <FeatureRow
            mockup={<VideoMockup />}
            title="HD videogesprekken"
            text="Videobel met scherpe kwaliteit via WebRTC. Wissel eenvoudig van spraak naar video tijdens een gesprek."
            features={[
              { icon: <Video size={15} />, label: '1-op-1 videogesprekken' },
              { icon: <VideoOff size={15} />, label: 'Camera aan/uit' },
              { icon: <Mic size={15} />, label: 'Microfoon dempen' },
              { icon: <Phone size={15} />, label: 'Spraak upgraden naar video' },
              { icon: <Message size={15} />, label: 'Gesprek minimaliseren (overlay)' },
            ]}
          />
          <FeatureRow reverse
            mockup={<PrivacyVideoMockup />}
            title="Jij bepaalt wat zichtbaar is"
            text="Schakel je camera uit wanneer je wilt. Je gesprekken zijn beveiligd en alleen jij en je gesprekspartner kunnen meedoen."
            features={[
              { icon: <VideoOff size={15} />, label: 'Camera aan/uit tijdens gesprek' },
              { icon: <Bell size={15} />, label: 'Beltoon bij inkomend gesprek' },
              { icon: <Bell size={15} />, label: 'Push notificatie bij gemiste video' },
            ]}
          />
        </div>
      </section>

      {/* ── FEATURE GRID ── */}
      <section className="hp-section hp-section--gray">
        <div className="hp-section-inner">
          <SectionHeader title="Alles in één overzicht" />
          <div className="fp-grid">
            <div className="fp-grid-col">
              <div className="fp-grid-col-header">💬 Chatten</div>
              <GridCard icon={<Message size={18} />} title="Real-time berichten" desc="Socket.IO voor instant delivery" />
              <GridCard icon={<MdAlternateEmail size={18} />} title="Groepen & @mentions" desc="Vermeld iemand direct" />
              <GridCard icon={<Mic size={18} />} title="Spraakberichten" desc="Opnemen & afspelen" />
              <GridCard icon={<ImageIcon size={18} />} title="Chatachtergrond" desc="Foto of kleur naar keuze" />
              <GridCard icon={<StarFilled size={18} />} title="Berichten sterren" desc="Sla belangrijke berichten op" />
              <GridCard icon={<Message size={18} />} title="Conceptberichten" desc="Bewaard per gesprek" />
            </div>
            <div className="fp-grid-col">
              <div className="fp-grid-col-header">📞 Bellen</div>
              <GridCard icon={<Phone size={18} />} title="HD Spraakoproepen" desc="Helder geluid via WebRTC" />
              <GridCard icon={<PhoneCall size={18} />} title="Belgeschiedenis" desc="Overzicht in chat & logboek" />
              <GridCard icon={<PhoneMissed size={18} />} title="Gemiste oproepen melding" desc="Badge & notificatie" />
              <GridCard icon={<Bell size={18} />} title="Push notificaties" desc="Ook als app op achtergrond" />
              <GridCard icon={<Clock size={18} />} title="Gespreksduur timer" desc="Altijd zichtbaar tijdens gesprek" />
              <GridCard icon={<Phone size={18} />} title="Bezet-status" desc="Automatisch bij dubbele oproep" />
            </div>
            <div className="fp-grid-col">
              <div className="fp-grid-col-header">🎥 Videobellen</div>
              <GridCard icon={<Video size={18} />} title="HD Videogesprekken" desc="Scherp beeld via WebRTC" />
              <GridCard icon={<VideoOff size={18} />} title="Camera aan/uit" desc="Jij bepaalt wat zichtbaar is" />
              <GridCard icon={<Phone size={18} />} title="Spraak → Video upgrade" desc="Wissel tijdens gesprek" />
              <GridCard icon={<Message size={18} />} title="Gesprek minimaliseren" desc="Overlay terwijl je chat" />
              <GridCard icon={<Bell size={18} />} title="Beltoon inkomend gesprek" desc="Nooit een oproep missen" />
              <GridCard icon={<CheckDouble size={18} />} title="WebRTC end-to-end" desc="Beveiligde verbinding" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="hp-cta">
        <div className="hp-cta-inner">
          <h2>Klaar om te starten?</h2>
          <p>Maak gratis een account aan.</p>
          <button className="hp-cta-btn" onClick={() => window.location.href = '/'}>Gratis registreren</button>
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
            <span>Over ons</span><span>Privacy</span><span>AVG-beleid</span><span>Contact</span>
          </div>
          <div className="hp-footer-col">
            <h4>Downloaden</h4>
            <span>Web app</span><span>iOS</span><span>Android</span>
          </div>
        </div>
        <div className="hp-footer-copy">© 2025 Pulse — Echt Nederlands. Echt veilig.</div>
      </footer>

    </div>
  );
}
