import React from 'react';
import PulseLogo from './PulseLogo';

export default function MarketingNavbar({
  items,
  activeKey,
  menuOpen,
  setMenuOpen,
  scrolled,
  onParentClick,
}) {
  return (
    <nav className={`hp-nav${scrolled ? ' hp-nav--scrolled' : ''}`}>
      <a className="hp-nav-logo" href="/">
        <PulseLogo size={30} textSize={20} color="#6c63ff" />
      </a>

      <div className={`hp-nav-links${menuOpen ? ' hp-nav-links--open' : ''}`}>
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const className = isActive ? 'fp-nav-active' : (item.href ? 'fp-nav-link' : '');

          if (item.href) {
            return (
              <a
                key={item.key}
                href={item.href}
                className={className}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            );
          }

          return (
            <button
              key={item.key}
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

      <button className="hp-nav-ouder" onClick={onParentClick}>
        ❤️ Ouder
      </button>

      <button
        className="hp-nav-hamburger"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="Menu"
      >
        {menuOpen ? '✕' : '☰'}
      </button>
    </nav>
  );
}
