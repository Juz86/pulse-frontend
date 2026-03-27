// src/components/AuthModal.js
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AuthScreen from '../screens/AuthScreen';
import { Heart } from './Icons';
import PulseLogo from './PulseLogo';

export default function AuthModal({ onClose, onParentClick }) {
  const [visible, setVisible] = useState(false);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Fade-in
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const timer = setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      clearTimeout(timer);
      previousFocusRef.current?.focus?.();
    };
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
      <div
        className={`auth-modal-card${visible ? ' auth-modal-card--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-description"
      >

        {/* Sluitknop */}
        <button ref={closeButtonRef} type="button" className="auth-modal-close" onClick={handleClose} aria-label="Sluiten">✕</button>

        {/* Ouder knop */}
        <button type="button" className="auth-modal-parent-btn" onClick={handleParentClick}>
          <Heart size={13} color="#ef4444" /> Ouder
        </button>

        {/* Koptekst */}
        <div className="auth-modal-header">
          <PulseLogo size={28} textSize={22} />
          <h2 id="auth-modal-title" className="auth-modal-title">Welkom bij Pulse</h2>
          <p id="auth-modal-description" className="auth-modal-sub">Log in met je gebruikersnaam en wachtwoord</p>
        </div>

        {/* Loginformulier */}
        <AuthScreen isModal />

      </div>
    </div>,
    document.body
  );
}
