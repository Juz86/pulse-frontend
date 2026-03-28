// src/components/ParentAuthModal.js
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ParentAuthScreen from '../screens/ParentAuthScreen';

export default function ParentAuthModal({ onClose, defaultTab = 'register' }) {
  const [visible, setVisible] = useState(false);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

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

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) handleClose();
  }

  return createPortal(
    <div
      className={`auth-modal-overlay${visible ? ' auth-modal-overlay--visible' : ''}`}
      role="presentation"
      onClick={handleBackdrop}
    >
      <div
        className={`parent-auth-modal-card${visible ? ' parent-auth-modal-card--visible' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-auth-modal-title"
        aria-describedby="parent-auth-modal-description"
      >
        <button ref={closeButtonRef} type="button" className="auth-modal-close" onClick={handleClose} aria-label="Sluiten">
          <span aria-hidden="true">✕</span>
        </button>
        <h2 id="parent-auth-modal-title" className="sr-only">Ouderaccount</h2>
        <p id="parent-auth-modal-description" className="sr-only">Log in of registreer een ouderaccount.</p>
        <ParentAuthScreen isModal defaultTab={defaultTab} onBack={handleClose} />
      </div>
    </div>,
    document.body
  );
}
