// src/components/AuthModal.js
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AuthScreen from '../screens/AuthScreen';

export default function AuthModal({ onClose }) {
  const [visible, setVisible] = useState(false);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    return () => previousFocusRef.current?.focus?.();
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
      onClick={handleBackdrop}
      role="presentation"
    >
      <AuthScreen inModal onClose={handleClose} />
    </div>,
    document.body
  );
}
