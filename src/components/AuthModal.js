// src/components/AuthModal.js
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AuthScreen from '../screens/AuthScreen';

export default function AuthModal({ onClose }) {
  const [visible, setVisible] = useState(false);
  const previousFocusRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const timer = setTimeout(() => dialogRef.current?.focus(), 0);
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
      onClick={handleBackdrop}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="child-auth-title"
        aria-describedby="child-auth-subtitle"
        className="auth-modal-dialog"
        tabIndex={-1}
      >
        <AuthScreen inModal onClose={handleClose} />
      </div>
    </div>,
    document.body
  );
}
