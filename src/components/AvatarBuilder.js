// src/components/AvatarBuilder.js
import React, { useState, useCallback } from 'react';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { updateProfile as fbUpdateProfile } from 'firebase/auth';
import { auth } from '../firebase';

// ── Option definitions ─────────────────────────────────────────────────────
const TOP_OPTIONS = [
  ['shortFlat','Kort strak'],['shortRound','Kort rond'],['shortCurly','Kort krullend'],
  ['shortWaved','Kort golvend'],['sides','Zijkanten'],['theCaesar','Caesar'],
  ['theCaesarAndSidePart','Caesar+scheiding'],['bob','Bob'],['bun','Knot'],
  ['curly','Krullend'],['curvy','Golvend'],['dreads','Dreadlocks'],
  ['dreads01','Dreads 1'],['dreads02','Dreads 2'],['frida','Frida'],
  ['fro','Afro'],['froBand','Afro+band'],['frizzle','Kroes'],
  ['longButNotTooLong','Lang haar'],['miaWallace','Mia Wallace'],
  ['shaggy','Wild'],['shaggyMullet','Shaggy'],['shavedSides','Geschoren zijkanten'],
  ['straight01','Stijl 1'],['straight02','Stijl 2'],['straightAndStrand','Stijl+lok'],
  ['bigHair','Groot haar'],['hat','Pet'],['hijab','Hijab'],
  ['turban','Tulband'],['winterHat1','Wintermuts 1'],['winterHat02','Wintermuts 2'],
  ['winterHat03','Wintermuts 3'],['winterHat04','Wintermuts 4'],
];
const EYES_OPTIONS = [
  ['default','Normaal'],['happy','Blij'],['wink','Knipoog'],['winkWacky','Knipoog gek'],
  ['closed','Gesloten'],['cry','Huilen'],['eyeRoll','Oogrol'],['hearts','Hartjes'],
  ['side','Opzij'],['squint','Samengek.'],['surprised','Verrast'],['xDizzy','Draaiend'],
];
const EYEBROWS_OPTIONS = [
  ['defaultNatural','Normaal'],['angryNatural','Boos'],['flatNatural','Plat'],
  ['frownNatural','Frons'],['raisedExcitedNatural','Opgetrokken'],
  ['sadConcernedNatural','Droevig'],['unibrowNatural','Monowenkbrauw'],
  ['upDownNatural','Omhoog/omlaag'],['angry','Boos (recht)'],
  ['raisedExcited','Opgetrokken (recht)'],['sadConcerned','Droevig (recht)'],
  ['upDown','Omhoog/omlaag (recht)'],
];
const MOUTH_OPTIONS = [
  ['smile','Glimlach'],['default','Normaal'],['serious','Serieus'],['twinkle','Twinkle'],
  ['tongue','Tong'],['concerned','Bezorgd'],['disbelief','Ongeloof'],
  ['eating','Etend'],['grimace','Grimas'],['sad','Droevig'],['screamOpen','Schreeuwend'],
];
const FACIAL_HAIR_OPTIONS = [
  ['none','Geen'],['beardLight','Lichte baard'],['beardMedium','Middellange baard'],
  ['beardMajestic','Volle baard'],['moustacheFancy','Snor chique'],['moustacheMagnum','Snor magnum'],
];
const ACCESSORIES_OPTIONS = [
  ['none','Geen'],['prescription01','Bril 1'],['prescription02','Bril 2'],
  ['round','Ronde bril'],['sunglasses','Zonnebril'],['wayfarers','Wayfarers'],
  ['kurt','Kurt bril'],['eyepatch','Ooglapje'],
];
const CLOTHING_OPTIONS = [
  ['hoodie','Hoodie'],['graphicShirt','Grafisch shirt'],['shirtCrewNeck','Shirt crew'],
  ['shirtScoopNeck','Shirt scoop'],['shirtVNeck','Shirt V-hals'],
  ['blazerAndShirt','Blazer+shirt'],['blazerAndSweater','Blazer+trui'],
  ['collarAndSweater','Kraag+trui'],['overall','Overall'],
];

const SKIN_COLORS   = ['ffdbb4','edb98a','d08b5b','ae5d29','614335','f8d25c','fd9841'];
const HAIR_COLORS   = ['a55728','2c1b18','b58143','d6b370','724133','4a312c','f59797','ecdcbf','c93305','e8e1e1'];
const CLOTHES_COLORS= ['65c9ff','5199e4','25557c','262e33','929598','e6e6e6','b1e2ff','a7ffc4','ffdeb5','ffafb9','ffffb1','ff488e','ff5c5c','ffffff'];
const BG_COLORS     = ['b6e3f4','c0aede','d1d4f9','ffd5dc','ffdfbf','transparent'];

const CATEGORIES = [
  { id:'top',         label:'Haar',         type:'chip',  options:TOP_OPTIONS },
  { id:'hairColor',   label:'Haarkleur',    type:'color', colors:HAIR_COLORS },
  { id:'skinColor',   label:'Huidskleur',   type:'color', colors:SKIN_COLORS },
  { id:'eyes',        label:'Ogen',         type:'chip',  options:EYES_OPTIONS },
  { id:'eyebrows',    label:'Wenkbrauwen',  type:'chip',  options:EYEBROWS_OPTIONS },
  { id:'mouth',       label:'Mond',         type:'chip',  options:MOUTH_OPTIONS },
  { id:'facialHair',  label:'Gezichtshaar', type:'chip',  options:FACIAL_HAIR_OPTIONS },
  { id:'accessories', label:'Accessoires',  type:'chip',  options:ACCESSORIES_OPTIONS },
  { id:'clothing',    label:'Kleding',      type:'chip',  options:CLOTHING_OPTIONS },
  { id:'clothesColor',label:'Kledingkleur', type:'color', colors:CLOTHES_COLORS },
  { id:'bgColor',     label:'Achtergrond',  type:'color', colors:BG_COLORS },
];

const DEFAULT_OPTS = {
  top:         'shortFlat',
  hairColor:   'a55728',
  skinColor:   'd08b5b',
  eyes:        'default',
  eyebrows:    'defaultNatural',
  mouth:       'smile',
  facialHair:  'none',
  accessories: 'none',
  clothing:    'hoodie',
  clothesColor:'65c9ff',
  bgColor:     'b6e3f4',
};

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildAvatarSvg(opts) {
  const dicebearOpts = {
    seed: 'pulse-' + Math.random(),
    top:         [opts.top],
    hairColor:   [opts.hairColor],
    skinColor:   [opts.skinColor],
    eyes:        [opts.eyes],
    eyebrows:    [opts.eyebrows],
    mouth:       [opts.mouth],
    clothing:    [opts.clothing],
    clothesColor:[opts.clothesColor],
    backgroundColor: opts.bgColor === 'transparent' ? ['transparent'] : [opts.bgColor],
    backgroundType:  ['circle'],
    facialHairProbability:  opts.facialHair  === 'none' ? 0 : 100,
    accessoriesProbability: opts.accessories === 'none' ? 0 : 100,
    ...(opts.facialHair  !== 'none' && { facialHair:  [opts.facialHair]  }),
    ...(opts.accessories !== 'none' && { accessories: [opts.accessories] }),
  };
  return createAvatar(avataaars, dicebearOpts).toString();
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
  const [opts, setOpts]       = useState({ ...DEFAULT_OPTS, ...(currentOptions || {}) });
  const [activeCategory, setActiveCategory] = useState('top');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const svgString = buildAvatarSvg(opts);

  const randomize = useCallback(() => {
    setOpts({
      top:         randomFrom(TOP_OPTIONS)[0],
      hairColor:   randomFrom(HAIR_COLORS),
      skinColor:   randomFrom(SKIN_COLORS),
      eyes:        randomFrom(EYES_OPTIONS)[0],
      eyebrows:    randomFrom(EYEBROWS_OPTIONS)[0],
      mouth:       randomFrom(MOUTH_OPTIONS)[0],
      facialHair:  randomFrom(FACIAL_HAIR_OPTIONS)[0],
      accessories: randomFrom(ACCESSORIES_OPTIONS)[0],
      clothing:    randomFrom(CLOTHING_OPTIONS)[0],
      clothesColor:randomFrom(CLOTHES_COLORS),
      bgColor:     randomFrom(BG_COLORS),
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const pngBlob = await svgToPng(svgString, 256);
      if (pngBlob.size > 1_000_000) throw new Error('Afbeelding te groot (max 1MB)');

      // Delete old photo if it's in Firebase Storage
      if (currentPhotoURL && currentPhotoURL.includes('firebasestorage')) {
        try {
          const oldRef = storageRef(storage, `users/${uid}/profilePhoto`);
          await deleteObject(oldRef);
        } catch {}
      }

      const newRef = storageRef(storage, `users/${uid}/profilePhoto`);
      await uploadBytes(newRef, pngBlob, { contentType: 'image/png' });
      const photoURL = await getDownloadURL(newRef);

      // Update Firestore
      await updateDoc(doc(db, 'users', uid), { photoURL, avatarOptions: opts });

      // Update Firebase Auth profile
      if (auth.currentUser) {
        await fbUpdateProfile(auth.currentUser, { photoURL });
      }

      onSave(photoURL, opts);
    } catch (err) {
      setError(err.message || 'Opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const cat = CATEGORIES.find(c => c.id === activeCategory);

  // ── Styles ────────────────────────────────────────────────────────────────
  const bg      = darkMode ? '#111118' : '#ffffff';
  const surface = darkMode ? '#1a1a24' : '#f4f4f8';
  const border  = darkMode ? 'rgba(255,255,255,0.08)' : '#e0e0e8';
  const text     = darkMode ? '#f0f0f8' : '#1a1a2e';
  const text2    = darkMode ? '#9090b0' : '#5a5a7a';
  const accent   = '#6c63ff';

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center',
      padding: 'env(safe-area-inset-top, 0) env(safe-area-inset-right, 0) env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:bg, borderRadius:20, width:'min(480px, 100vw)',
        maxHeight:'90dvh', display:'flex', flexDirection:'column',
        overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
      }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px 14px', borderBottom:`1px solid ${border}`, flexShrink:0 }}>
          <div style={{ fontSize:17, fontWeight:700, color:text }}>Avatar maken</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:text2, fontSize:22, lineHeight:1 }} aria-label="Sluiten">×</button>
        </div>

        {/* Preview */}
        <div style={{ display:'flex', justifyContent:'center', padding:'20px 20px 12px', flexShrink:0 }}>
          <div style={{ width:120, height:120, borderRadius:'50%', overflow:'hidden', border:`3px solid ${accent}`, background:surface }}
            dangerouslySetInnerHTML={{ __html: svgString }} />
        </div>

        {/* Category tabs */}
        <div style={{ display:'flex', overflowX:'auto', gap:6, padding:'0 16px 12px', flexShrink:0, scrollbarWidth:'none' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setActiveCategory(c.id)} style={{
              flexShrink:0, padding:'6px 12px', borderRadius:20, border:'none', cursor:'pointer',
              fontSize:12, fontWeight:600, transition:'.15s',
              background: activeCategory === c.id ? accent : surface,
              color:       activeCategory === c.id ? '#fff'  : text2,
            }}>{c.label}</button>
          ))}
        </div>

        {/* Options grid */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px' }}>
          {cat?.type === 'chip' && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {cat.options.map(([val, label]) => {
                const selected = opts[activeCategory] === val;
                return (
                  <button key={val} onClick={() => setOpts(p => ({ ...p, [activeCategory]: val }))} style={{
                    padding:'6px 12px', borderRadius:10, border:`1px solid ${selected ? accent : border}`,
                    background: selected ? `${accent}22` : surface, color: selected ? accent : text2,
                    fontSize:12, fontWeight: selected ? 600 : 400, cursor:'pointer', transition:'.15s',
                  }}>{label}</button>
                );
              })}
            </div>
          )}

          {cat?.type === 'color' && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {cat.colors.map(hex => {
                const key = activeCategory === 'bgColor' ? 'bgColor' : activeCategory;
                const selected = opts[key] === hex;
                return (
                  <button key={hex} onClick={() => setOpts(p => ({ ...p, [key]: hex }))} aria-label={hex} style={{
                    width:36, height:36, borderRadius:'50%', border:`3px solid ${selected ? accent : 'transparent'}`,
                    background: hex === 'transparent' ? 'linear-gradient(135deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%) 0 0/10px 10px' : `#${hex}`,
                    cursor:'pointer', outline: selected ? `2px solid ${accent}` : 'none', outlineOffset:2,
                    boxShadow:'0 2px 6px rgba(0,0,0,0.2)',
                  }} />
                );
              })}
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div style={{ margin:'0 16px 8px', padding:'10px 14px', borderRadius:10, background:'rgba(255,71,87,0.15)', color:'#ff4757', fontSize:13 }}>⚠️ {error}</div>}

        {/* Action buttons */}
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
