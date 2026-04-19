import React, { useEffect, useRef } from 'react';
import PulseLogo from './PulseLogo';
import { Heart, Shield, Users } from './Icons';
import { getWebAppLoginUrl, isLandingBuild } from '../lib/siteTarget';
import { requestMarketingAuth } from '../lib/marketingAuthEvents';

export default function MarketingNavbar({
  items,
  activeKey,
  menuOpen,
  setMenuOpen,
  scrolled,
}) {
  const navMenuId = 'marketing-nav-links';
  const menuRef      = useRef(null);
  const hamburgerRef = useRef(null);
  const childLoginUrl = getWebAppLoginUrl({ role: 'child', mode: 'login' });
  const parentLoginUrl = getWebAppLoginUrl({ role: 'parent', mode: 'login' });

  const openChildLogin = () => {
    setMenuOpen(false);
    if (isLandingBuild) {
      window.location.assign(childLoginUrl);
      return;
    }
    requestMarketingAuth({ role: 'child', mode: 'login' });
  };

  const openParentLogin = () => {
    setMenuOpen(false);
    if (isLandingBuild) {
      window.location.assign(parentLoginUrl);
      return;
    }
    requestMarketingAuth({ role: 'parent', mode: 'login' });
  };

  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
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
      <div className="hp-nav-inner">
        <a className="hp-nav-logo" href="/" aria-label="Ga naar de homepage van Pulse">
          <span aria-hidden="true">
            <PulseLogo size={30} textSize={20} color="#6c63ff" />
          </span>
        </a>

        <div
          id={navMenuId}
          ref={menuRef}
          className={`hp-nav-links${menuOpen ? ' hp-nav-links--open' : ''}`}
        >
          {items.map((item) => {
            const isActive = item.key === activeKey;
            const className = isActive ? 'fp-nav-active' : (item.href ? 'fp-nav-link' : '');
            const inner = item.highlight
              ? <span className="hp-nav-highlight"><Shield size={13} aria-hidden="true" />{item.label}</span>
              : item.label;

            if (item.href) {
              return (
                <a
                  key={item.key}
                  href={item.href}
                  className={`${className}${item.highlight ? ' hp-nav-highlight-link' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {inner}
                </a>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                className={`${className}${item.highlight ? ' hp-nav-highlight-link' : ''}`}
                onClick={() => {
                  item.onClick?.();
                  setMenuOpen(false);
                }}
              >
                {inner}
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

        <div className="hp-nav-actions">
          <button
            type="button"
            className="hp-nav-signin"
            onClick={openParentLogin}
            aria-label="Aanmelden bij Pulse"
          >
            Aanmelden
          </button>

          <button
            type="button"
            className="hp-nav-kind"
            onClick={openChildLogin}
            aria-label="Kind inloggen"
          >
            <Heart size={16} aria-hidden="true" /> Kind
          </button>

          <button
            type="button"
            className="hp-nav-ouder"
            onClick={openParentLogin}
            aria-label="Open ouder login of registratie"
          >
            <Users size={16} aria-hidden="true" /> Ouder
          </button>

          <button
            type="button"
            ref={hamburgerRef}
            className="hp-nav-hamburger"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Sluit menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls={navMenuId}
          >
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
