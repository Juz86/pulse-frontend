// src/screens/FunctiePagina.js
import React, { useState, useEffect, useRef } from 'react';
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import PulseLogo from '../components/PulseLogo';
import MarketingNavbar from '../components/MarketingNavbar';
import MarketingFooter from '../components/MarketingFooter';
import AuthModal from '../components/AuthModal';
import ParentAuthModal from '../components/ParentAuthModal';
import PageMeta from '../components/PageMeta';
import {
  Phone, Video, VideoOff, Mic,
  Message, Users, User, Search, Bell,
  Pin, StarFilled, CheckDouble, Check,
  Forward, Reply, ImageIcon, Palette,
  Refresh, Clock, Wifi, Logout, Login,
  Lightbulb, Delete, PhoneCall, PhoneMissed, PhoneEnd,
} from '../components/Icons';
import { MdAlternateEmail, MdSend, MdSmartphone } from 'react-icons/md';

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
    <div
      className={`fp-deco-avatar ${className}`.trim()}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
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
      <div style={{ height: 8 }} />
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

// ── Mockup 5: Chatachtergrond ────────────────────────────────────────────────
function BgMockup() {
  return (
    <PhoneMockup>
      <ChatHeader letter="S" name="Sara" online />
      <div style={{ flex: 1, background: 'linear-gradient(135deg,#4c1d95,#7c3aed)', borderRadius: 8, display: 'flex', flexDirection: 'column', padding: 8, gap: 6, margin: '4px 0', position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            position: 'absolute',
            right: 18,
            bottom: 18,
            opacity: 0.22,
            transform: 'scale(1.7)',
          }}
          dangerouslySetInnerHTML={{ __html: bgAvatarSvg }}
        />
        <div className="hp-mock-msg hp-mock-msg--in" style={{ background: 'rgba(255,255,255,0.18)' }}>Mooie achtergrond! 🎨</div>
        <div className="hp-mock-msg hp-mock-msg--out" style={{ background: 'rgba(108,99,255,0.7)' }}>Dankjewel 😊</div>
        <div className="hp-mock-msg hp-mock-msg--in" style={{ background: 'rgba(255,255,255,0.18)' }}>Hoe stel je dat in?</div>
      </div>
      <div className="hp-mock-inputbar"><span style={{ flex: 1 }}>Bericht…</span></div>
    </PhoneMockup>
  );
}

// ── Mockup 6: Spraakoproep ───────────────────────────────────────────────────
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

// ── Mockup 7: Belgeschiedenis ────────────────────────────────────────────────
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

// ── Mockup 8: Videogesprek ───────────────────────────────────────────────────
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

// ── Mockup 9: Camera privacy ────────────────────────────────────────────────
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
      <div className="hp-feature-mockup" aria-hidden="true">{mockup}</div>
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
  const [callVideoSlide, setCallVideoSlide] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);
  const chatTabRefs     = useRef([]);
  const callTabRefs     = useRef([]);
  const chatTouchStartX = useRef(null);
  const callTouchStartX = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

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

  const handleCallTabKeyDown = (event, index) => {
    if (event.key === 'Home') {
      event.preventDefault();
      setCallVideoSlide(0);
      callTabRefs.current[0]?.focus();
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      const lastIndex = callVideoSlides.length - 1;
      setCallVideoSlide(lastIndex);
      callTabRefs.current[lastIndex]?.focus();
      return;
    }
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const nextIndex = event.key === 'ArrowRight'
      ? (index + 1) % callVideoSlides.length
      : (index - 1 + callVideoSlides.length) % callVideoSlides.length;
    setCallVideoSlide(nextIndex);
    callTabRefs.current[nextIndex]?.focus();
  };

  const navItems = [
    { key: 'functies', label: 'Functies', href: '/functies' },
    { key: 'hoe-werkt-het', label: 'Hoe werkt het', href: '/hoe-werkt-het' },
    { key: 'ouderlijk-toezicht', label: 'Ouderlijk toezicht', href: '/ouderlijk-toezicht' },
    { key: 'over-pulse', label: 'Over Pulse', href: '/over-pulse' },
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
        { icon: <Wifi size={15} />, label: 'Offline berichten via Redis' },
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
        { icon: <MdAlternateEmail size={15} />, label: '@ vermeldingen met melding' },
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
        { icon: <MdSmartphone size={15} />, label: 'Foto op chatachtergrond' },
        { icon: <ImageIcon size={15} />, label: 'Profielfoto uploaden' },
        { icon: <User size={15} />, label: 'Avatar kiezen' },
        
        { icon: <Palette size={15} />, label: 'Achtergrondkleur kiezen' },
      ],
    },
  ];

  const currentChatSlide = chatSlides[chatSlide];

  const callVideoSlides = [
    {
      key: 'hd-spraakoproepen',
      label: 'HD spraakoproepen',
      mockup: <CallMockup />,
      title: 'HD spraakoproepen',
      text: 'Bel met heldere geluidskwaliteit. Werkt op wifi en mobiel data, ook bij trage verbinding.',
      features: [
        { icon: <Phone size={15} />, label: '1-op-1 spraakoproepen' },
        { icon: <Mic size={15} />, label: 'Microfoon dempen / activeren' },
        { icon: <Clock size={15} />, label: 'Gespreksduur timer' },
        { icon: <PhoneMissed size={15} />, label: 'Gemiste oproepen badge' },
      ],
    },
    {
      key: 'belgeschiedenis',
      label: 'Belgeschiedenis',
      reverse: true,
      mockup: <CallHistoryMockup />,
      title: 'Belgeschiedenis',
      text: 'Zie al je gesprekken terug in de chat en in het belgeschiedenisoverzicht. Mis nooit een oproep.',
      features: [
        { icon: <PhoneCall size={15} />, label: 'Belgeschiedenis in gesprek' },
        { icon: <PhoneMissed size={15} />, label: 'Gemiste oproepen melding' },
        { icon: <Bell size={15} />, label: 'Push notificatie bij gemiste oproep' },
        { icon: <Phone size={15} />, label: 'Bezet-status bij dubbele oproep' },
      ],
    },
    {
      key: 'hd-videogesprekken',
      label: 'HD videogesprekken',
      mockup: <VideoMockup />,
      title: 'HD videogesprekken',
      text: 'Videobel met scherpe HD-kwaliteit. Wissel eenvoudig van spraak naar video tijdens een gesprek.',
      features: [
        { icon: <Video size={15} />, label: '1-op-1 videogesprekken' },
        { icon: <VideoOff size={15} />, label: 'Camera aan/uit' },
        { icon: <Mic size={15} />, label: 'Microfoon dempen' },
        { icon: <Phone size={15} />, label: 'Spraak upgraden naar video' },
        { icon: <Message size={15} />, label: 'Gesprek minimaliseren (overlay)' },
      ],
    },
    {
      key: 'jij-bepaalt-wat-zichtbaar-is',
      label: 'Jij bepaalt wat zichtbaar is',
      reverse: true,
      mockup: <PrivacyVideoMockup />,
      title: 'Jij bepaalt wat zichtbaar is',
      text: 'Schakel je camera uit wanneer je wilt. Je gesprekken zijn beveiligd en alleen jij en je gesprekspartner kunnen meedoen.',
      features: [
        { icon: <VideoOff size={15} />, label: 'Camera aan/uit tijdens gesprek' },
        { icon: <PhoneCall size={15} />, label: 'Beltoon bij inkomend gesprek' },
        { icon: <Bell size={15} />, label: 'Push notificatie bij gemiste video' },
      ],
    },
  ];

  const currentCallVideoSlide = callVideoSlides[callVideoSlide];

  return (
    <div className="hp-root">
      <PageMeta
        title="Functies van Pulse — Chatten, bellen en videobellen voor kinderen"
        description="Ontdek alle Pulse functies: veilig chatten, bellen, videobellen, groepsgesprekken, @-vermeldingen en rustige communicatie zonder afleiding."
        canonical="https://pulse-frontend-elt.pages.dev/functies"
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
      <section className="ot-hero">
        <div className="ot-hero-inner">
          <DecorativeAvatar svg={decorativeAvatars.heroTop} className="fp-deco-avatar--hero-top" />
          <DecorativeAvatar svg={decorativeAvatars.heroBottom} className="fp-deco-avatar--hero-bottom" />
          <div>
            <div className="fp-hero-badge">Functies</div>
            <h1 className="ot-hero-title fp-hero-title-compact">
              Alles wat je nodig hebt om
              veilig verbonden te blijven
            </h1>
            <p className="ot-hero-sub">
              Chatten, bellen en videobellen komen samen in één vertrouwde en beveiligde omgeving voor familie en vrienden.
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

            <div className="fp-slider-controls">
              <button
                type="button"
                className="fp-slider-arrow"
                aria-label="Vorige chatfunctie"
                onClick={() => setChatSlide((prev) => (prev === 0 ? chatSlides.length - 1 : prev - 1))}
              >
                <span aria-hidden="true">← </span>Vorige
              </button>
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
              <button
                type="button"
                className="fp-slider-arrow"
                aria-label="Volgende chatfunctie"
                onClick={() => setChatSlide((prev) => (prev === chatSlides.length - 1 ? 0 : prev + 1))}
              >
                Volgende <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── BELLEN ── */}
      <section className="hp-section hp-section--gray" id="bellen">
        <div className="hp-section-inner">
          <SectionHeader
            headingId="videobellen"
            title="Bellen & videobellen"
            sub="Bel of videobel gratis met vrienden en familie — zonder telefoonnummer, zonder tijdslimiet."
          />
          <div className="fp-slider">
            <div className="fp-slider-tabs" role="tablist" aria-label="Bel- en videofuncties" aria-orientation="horizontal">
              {callVideoSlides.map((slide, index) => (
                <button
                  key={slide.key}
                  ref={(element) => { callTabRefs.current[index] = element; }}
                  id={`call-tab-${slide.key}`}
                  type="button"
                  role="tab"
                  aria-selected={index === callVideoSlide}
                  aria-controls={`call-panel-${slide.key}`}
                  tabIndex={index === callVideoSlide ? 0 : -1}
                  className={`fp-slider-tab${index === callVideoSlide ? ' fp-slider-tab--active' : ''}`}
                  onClick={() => setCallVideoSlide(index)}
                  onKeyDown={(event) => handleCallTabKeyDown(event, index)}
                >
                  {slide.label}
                </button>
              ))}
            </div>

            <div
              id={`call-panel-${currentCallVideoSlide.key}`}
              role="tabpanel"
              aria-labelledby={`call-tab-${currentCallVideoSlide.key}`}
              tabIndex={0}
              onTouchStart={(e) => { callTouchStartX.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (callTouchStartX.current === null) return;
                const delta = e.changedTouches[0].clientX - callTouchStartX.current;
                if (delta < -40) setCallVideoSlide((prev) => (prev === callVideoSlides.length - 1 ? 0 : prev + 1));
                else if (delta > 40) setCallVideoSlide((prev) => (prev === 0 ? callVideoSlides.length - 1 : prev - 1));
                callTouchStartX.current = null;
              }}
            >
              <FeatureRow
                key={currentCallVideoSlide.key}
                reverse={currentCallVideoSlide.reverse}
                mockup={currentCallVideoSlide.mockup}
                title={currentCallVideoSlide.title}
                text={currentCallVideoSlide.text}
                features={currentCallVideoSlide.features}
              />
            </div>

            <div className="fp-slider-controls">
              <button
                type="button"
                className="fp-slider-arrow"
                aria-label="Vorige bel- of videofunctie"
                onClick={() => setCallVideoSlide((prev) => (prev === 0 ? callVideoSlides.length - 1 : prev - 1))}
              >
                <span aria-hidden="true">← </span>Vorige
              </button>
              <div className="fp-slider-dots">
                {callVideoSlides.map((slide, index) => (
                  <button
                    key={slide.key}
                    type="button"
                    aria-label={`Ga naar ${slide.label}`}
                    aria-current={index === callVideoSlide ? 'true' : undefined}
                    className={`fp-slider-dot${index === callVideoSlide ? ' fp-slider-dot--active' : ''}`}
                    onClick={() => setCallVideoSlide(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="fp-slider-arrow"
                aria-label="Volgende bel- of videofunctie"
                onClick={() => setCallVideoSlide((prev) => (prev === callVideoSlides.length - 1 ? 0 : prev + 1))}
              >
                Volgende <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURE GRID ── */}
      <section className="hp-section">
        <div className="hp-section-inner">
          <DecorativeAvatar svg={decorativeAvatars.gridCorner} className="fp-deco-avatar--grid" />
          <SectionHeader title="Alles in één overzicht" />
          <div className="fp-grid">
            <div className="fp-grid-col">
              <div className="fp-grid-col-header">💬 Chatten</div>
              <GridCard icon={<Message size={18} />} title="Real-time berichten" desc="Real-time delivery van chatberichten" />
              <GridCard icon={<MdAlternateEmail size={18} />} title="Groepen & @mentions" desc="Chatgroep maken en met @ iemand direct vermelden" />
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
              <GridCard icon={<CheckDouble size={18} />} title="WebRTC versleuteld" desc="Beveiligde verbinding" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
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

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onParentClick={onParentClick}
        />
      )}
      {showParentModal && (
        <ParentAuthModal onClose={() => setShowParentModal(false)} defaultTab="register" />
      )}

      </main>

      {/* ── FOOTER ── */}
      <MarketingFooter />

    </div>
  );
}
