// src/components/AvatarBuilder.js
import React, { useState, useCallback, useMemo } from 'react';
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { updateProfile as fbUpdateProfile } from 'firebase/auth';
import { auth } from '../firebase';

// ── Option definitions ─────────────────────────────────────────────────────
const HAIR_SHORT = Array.from({length:19}, (_,i) => [`short${String(i+1).padStart(2,'0')}`, `Kort ${i+1}`]);
const HAIR_LONG  = Array.from({length:26}, (_,i) => [`long${String(i+1).padStart(2,'0')}`,  `Lang ${i+1}`]);
const HAIR_OPTIONS = [['none','Geen'], ...HAIR_SHORT, ...HAIR_LONG];

const EYES_OPTIONS     = Array.from({length:26}, (_,i) => [`variant${String(i+1).padStart(2,'0')}`, `Stijl ${i+1}`]);
const EYEBROWS_OPTIONS = Array.from({length:15}, (_,i) => [`variant${String(i+1).padStart(2,'0')}`, `Stijl ${i+1}`]);
const MOUTH_OPTIONS    = Array.from({length:30}, (_,i) => [`variant${String(i+1).padStart(2,'0')}`, `Stijl ${i+1}`]);
const GLASSES_OPTIONS  = [['none','Geen'], ...Array.from({length:5}, (_,i) => [`variant0${i+1}`, `Bril ${i+1}`])];
const FEATURES_OPTIONS = [['none','Geen'],['blush','Blosjes'],['freckles','Sproeten'],['birthmark','Moedervlek'],['mustache','Snor']];

const SKIN_COLORS  = ['f2d3b1','ecad80','d8a96a','c68642','9e5622','763900','4a2c0a'];
const HAIR_COLORS  = ['ac6511','cb6820','ab2a18','e5d7a3','b9a05f','796a45','6a4e35','562306','0e0e0e','afafaf','ffffff','e03fd8'];
const BG_COLORS    = ['b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf','d4edda','f5f5f5','1a1a2e','transparent'];

const CATEGORIES = [
  { id:'hair',       label:'Haar',        type:'chip',  options:HAIR_OPTIONS },
  { id:'hairColor',  label:'Haarkleur',   type:'color', colors:HAIR_COLORS },
  { id:'skinColor',  label:'Huidskleur',  type:'color', colors:SKIN_COLORS },
  { id:'eyes',       label:'Ogen',        type:'chip',  options:EYES_OPTIONS },
  { id:'eyebrows',   label:'Wenkbrauwen', type:'chip',  options:EYEBROWS_OPTIONS },
  { id:'mouth',      label:'Mond',        type:'chip',  options:MOUTH_OPTIONS },
  { id:'glasses',    label:'Bril',        type:'chip',  options:GLASSES_OPTIONS },
  { id:'features',   label:'Extras',      type:'chip',  options:FEATURES_OPTIONS },
  { id:'bgColor',    label:'Achtergrond', type:'color', colors:BG_COLORS },
];

const DEFAULT_OPTS = {
  hair:      'short01',
  hairColor: 'ac6511',
  skinColor: 'ecad80',
  eyes:      'variant01',
  eyebrows:  'variant01',
  mouth:     'variant01',
  glasses:   'none',
  features:  'none',
  bgColor:   'b6e3f4',
};

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildAvatarSvg(opts, size = 100) {
  return createAvatar(adventurer, {
    seed: 'pulse',
    size,
    hair:              opts.hair    === 'none' ? [] : [opts.hair],
    hairColor:         [opts.hairColor],
    skinColor:         [opts.skinColor],
    eyes:              [opts.eyes],
    eyebrows:          [opts.eyebrows],
    mouth:             [opts.mouth],
    glasses:           opts.glasses === 'none' ? [] : [opts.glasses],
    glassesProbability: opts.glasses === 'none' ? 0 : 100,
    hairProbability:    opts.hair    === 'none' ? 0 : 100,
    features:          opts.features === 'none' ? [] : [opts.features],
    featuresProbability: opts.features === 'none' ? 0 : 100,
    backgroundColor:   opts.bgColor === 'transparent' ? ['transparent'] : [opts.bgColor],
  }).toString();
}

async function svgToPng(svgString, size = 256) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas toBlob failed')), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG load failed')); };
    img.src = url;
  });
}

export default function AvatarBuilder({ uid, currentOptions, currentPhotoURL, onSave, onClose, darkMode = true }) {
  const [opts, setOpts]     = useState({ ...DEFAULT_OPTS, ...(currentOptions || {}) });
  const [activeCategory, setActiveCategory] = useState('hair');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const svgString = useMemo(() => buildAvatarSvg(opts), [opts]);

  const randomize = useCallback(() => {
    setOpts({
      hair:      randomFrom(HAIR_OPTIONS)[0],
      hairColor: randomFrom(HAIR_COLORS),
      skinColor: randomFrom(SKIN_COLORS),
      eyes:      randomFrom(EYES_OPTIONS)[0],
      eyebrows:  randomFrom(EYEBROWS_OPTIONS)[0],
      mouth:     randomFrom(MOUTH_OPTIONS)[0],
      glasses:   randomFrom(GLASSES_OPTIONS)[0],
      features:  randomFrom(FEATURES_OPTIONS)[0],
      bgColor:   randomFrom(BG_COLORS),
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const highResSvg = buildAvatarSvg(opts, 256);
    const pngBlob = await svgToPng(highResSvg, 256);
      if (pngBlob.size > 1_000_000) throw new Error('Afbeelding te groot (max 1MB)');

      try { await deleteObject(storageRef(storage, `users/${uid}/profilePhoto`)); } catch (e) { /* geen foto aanwezig */ }

      const newRef = storageRef(storage, `users/${uid}/profilePhoto`);
      await uploadBytes(newRef, pngBlob, { contentType: 'image/png' });
      const photoURL = await getDownloadURL(newRef);

      await updateDoc(doc(db, 'users', uid), { photoURL, avatarOptions: opts });
      if (auth.currentUser) await fbUpdateProfile(auth.currentUser, { photoURL });

      onSave(photoURL, opts);
    } catch (err) {
      setError(err.message || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const cat = CATEGORIES.find(c => c.id === activeCategory);

  const bg     = darkMode ? '#111118' : '#ffffff';
  const surface= darkMode ? '#1a1a24' : '#f4f4f8';
  const border = darkMode ? 'rgba(255,255,255,0.08)' : '#e0e0e8';
  const text   = darkMode ? '#f0f0f8' : '#1a1a2e';
  const text2  = darkMode ? '#9090b0' : '#5a5a7a';
  const accent = '#6c63ff';

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:bg, borderRadius:20, width:'min(480px, 100vw)',
        height:'min(680px, 95dvh)', display:'flex', flexDirection:'column',
        overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px 14px', borderBottom:`1px solid ${border}`, flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:700, color:text }}>Avatar maken</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:text2, fontSize:22, lineHeight:1 }} aria-label="Sluiten">×</button>
        </div>

        {/* Preview */}
        <div style={{ display:'flex', justifyContent:'center', padding:'20px 20px 12px', flexShrink:0 }}>
          <div style={{ width:100, height:100, borderRadius:'50%', overflow:'hidden', border:`3px solid ${accent}`, background:surface }}
            dangerouslySetInnerHTML={{ __html: svgString }} />
        </div>

        {/* Category tabs */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'0 16px 12px', flexShrink:0 }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{
              padding:'6px 13px', borderRadius:20, border:'none', cursor:'pointer',
              fontSize:12, fontWeight:600, transition:'.15s', whiteSpace:'nowrap',
              background: activeCategory === c.id ? accent : surface,
              color:      activeCategory === c.id ? '#fff'  : text2,
            }}>{c.label}</button>
          ))}
        </div>

        {/* Options */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px' }}>
          {cat?.type === 'chip' && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {cat.options.map(([val, label]) => {
                const selected = opts[activeCategory] === val;
                return (
                  <button key={val} onClick={() => setOpts(p => ({ ...p, [activeCategory]: val }))} style={{
                    padding:'6px 12px', borderRadius:10,
                    border:`1px solid ${selected ? accent : border}`,
                    background: selected ? `${accent}22` : surface,
                    color: selected ? accent : text2,
                    fontSize:12, fontWeight: selected ? 600 : 400, cursor:'pointer', transition:'.15s',
                  }}>{label}</button>
                );
              })}
            </div>
          )}
          {cat?.type === 'color' && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {cat.colors.map(hex => {
                const selected = opts[activeCategory === 'bgColor' ? 'bgColor' : activeCategory] === hex;
                return (
                  <button key={hex} onClick={() => setOpts(p => ({ ...p, [activeCategory === 'bgColor' ? 'bgColor' : activeCategory]: hex }))}
                    aria-label={`#${hex}`} style={{
                      width:36, height:36, borderRadius:'50%', cursor:'pointer',
                      border:`3px solid ${selected ? accent : 'transparent'}`,
                      outline: selected ? `2px solid ${accent}` : 'none', outlineOffset:2,
                      background: hex === 'transparent'
                        ? 'linear-gradient(135deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%) 0 0/10px 10px'
                        : `#${hex}`,
                      boxShadow:'0 2px 6px rgba(0,0,0,0.2)',
                  }} />
                );
              })}
            </div>
          )}
        </div>

        {error && <div style={{ margin:'0 16px 8px', padding:'10px 14px', borderRadius:10, background:'rgba(255,71,87,0.15)', color:'#ff4757', fontSize:13 }}>⚠️ {error}</div>}

        {/* Buttons */}
        <div style={{ display:'flex', gap:10, padding:'12px 16px 20px', borderTop:`1px solid ${border}`, flexShrink:0 }}>
          <button onClick={randomize} style={{
            flex:1, padding:'12px', borderRadius:12, border:`1px solid ${border}`,
            background:surface, color:text, fontSize:13, fontWeight:600, cursor:'pointer',
          }}>🎲 Willekeurig</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex:2, padding:'12px', borderRadius:12, border:'none',
            background: saving ? '#9994d0' : accent, color:'#fff',
            fontSize:13, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? 'Opslaan…' : 'Opslaan als profielfoto'}</button>
        </div>
      </div>
    </div>
  );
}
