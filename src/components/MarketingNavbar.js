import React, { useEffect, useState } from 'react';
import PulseLogo from './PulseLogo';
import AuthModal from './AuthModal';
import ParentAuthModal from './ParentAuthModal';

export default function MarketingNavbar({
  items,
  activeKey,
  menuOpen,
  setMenuOpen,
  scrolled,
}) {
  const [showKindModal,   setShowKindModal]   = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);
  const navMenuId = 'marketing-nav-links';

  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen, setMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setMenuOpen(false);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setMenuOpen]);

  return (
    <nav className={`hp-nav${scrolled ? ' hp-nav--scrolled' : ''}`} aria-label="Hoofdnavigatie">
      <a className="hp-skip-link" href="#main-content">Ga naar inhoud</a>
      <a className="hp-nav-logo" href="/" aria-label="Ga naar de homepage van Pulse">
        <span aria-hidden="true">
          <PulseLogo size={30} textSize={20} color="#6c63ff" />
        </span>
      </a>

      <div
        id={navMenuId}
        className={`hp-nav-links${menuOpen ? ' hp-nav-links--open' : ''}`}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const className = isActive ? 'fp-nav-active' : (item.href ? 'fp-nav-link' : '');

          if (item.href) {
            return (
              <a
                key={item.key}
                href={item.href}
                className={className}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              className={className}
              onClick={() => {
                item.onClick?.();
                setMenuOpen(false);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {menuOpen && (
        <button
          type="button"
          className="hp-nav-backdrop"
          aria-label="Sluit het menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <button
        type="button"
        className="hp-nav-kind"
        onClick={() => { setShowKindModal(true); setMenuOpen(false); }}
        aria-label="Kind inloggen"
      >
        <span aria-hidden="true">👦</span> Kind
      </button>

      <button
        type="button"
        className="hp-nav-ouder"
        onClick={() => { setShowParentModal(true); setMenuOpen(false); }}
        aria-label="Open ouder login of registratie"
      >
        <span aria-hidden="true">❤️</span> Ouder
      </button>

      <button
        type="button"
        className="hp-nav-hamburger"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label={menuOpen ? 'Sluit menu' : 'Open menu'}
        aria-expanded={menuOpen}
        aria-controls={navMenuId}
      >
        <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
      </button>

      {showKindModal   && <AuthModal       onClose={() => setShowKindModal(false)}   />}
      {showParentModal && <ParentAuthModal onClose={() => setShowParentModal(false)} defaultTab="login" />}
    </nav>
  );
}
