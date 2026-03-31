// src/components/ParentAuthModal.js
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ParentAuthScreen from '../screens/ParentAuthScreen';

export default function ParentAuthModal({ onClose, defaultTab = 'register' }) {
  const [visible, setVisible] = useState(false);
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const dialogRef = useRef(null);

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
    const onKey = (e) => {
      if (e.key === 'Escape') {
        handleClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable.length) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

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
        ref={dialogRef}
        tabIndex={-1}
      >
        <button ref={closeButtonRef} type="button" className="modal-close-btn modal-close-btn--light" onClick={handleClose} aria-label="Sluit ouderaccountvenster">
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
