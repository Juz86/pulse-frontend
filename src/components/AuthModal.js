// src/components/AuthModal.js
import React, { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import AuthScreen from '../screens/AuthScreen';
import { Heart } from './Icons';
import PulseLogo from './PulseLogo';

export default function AuthModal({ onClose, onParentClick }) {
  const [visible, setVisible] = useState(false);

  // Fade-in
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Body scroll vergrendelen
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // ESC-toets
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) handleClose();
  }

  function handleParentClick() {
    handleClose();
    setTimeout(() => onParentClick?.(), 220);
  }

  return createPortal(
    <div
      className={`auth-modal-overlay${visible ? ' auth-modal-overlay--visible' : ''}`}
      onClick={handleBackdrop}
    >
      <div className={`auth-modal-card${visible ? ' auth-modal-card--visible' : ''}`}>

        {/* Sluitknop */}
        <button className="auth-modal-close" onClick={handleClose} aria-label="Sluiten">✕</button>

        {/* Ouder knop */}
        <button className="auth-modal-parent-btn" onClick={handleParentClick}>
          <Heart size={13} color="#ef4444" /> Ouder
        </button>

        {/* Koptekst */}
        <div className="auth-modal-header">
          <PulseLogo size={28} textSize={22} />
          <h2 className="auth-modal-title">Welkom bij Pulse</h2>
          <p className="auth-modal-sub">Log in met je gebruikersnaam en wachtwoord</p>
        </div>

        {/* Loginformulier */}
        <AuthScreen isModal />

      </div>
    </div>,
    document.body
  );
}
