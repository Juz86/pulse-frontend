import React from 'react';

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="hp-footer" id="footer">
      <div className="hp-footer-inner">
        <div className="hp-footer-brand">
          <div className="hp-footer-logo">
            <img src="/logo192.png" alt="" aria-hidden="true" width={28} height={28} />
            <span>Pulse</span>
          </div>
          <p>Veilig communiceren voor elk kind.</p>
        </div>
        <nav className="hp-footer-col" aria-labelledby="footer-features-title">
          <h4 id="footer-features-title">Functies</h4>
          <ul className="hp-footer-list">
            <li><a href="/functies#chatten">Chatten</a></li>
            <li><a href="/functies#bellen">Bellen</a></li>
            <li><a href="/functies#videobellen">Videobellen</a></li>
            <li><a href="/hoe-werkt-het#hoe-werkt-pulse">Hoe werkt het</a></li>
            <li><a href="/ouderlijk-toezicht#dashboard">Ouderlijk toezicht</a></li>
          </ul>
        </nav>
        <nav className="hp-footer-col" aria-labelledby="footer-about-title">
          <h4 id="footer-about-title">Over Pulse</h4>
          <ul className="hp-footer-list">
            <li><a href="/over-pulse#waarom-pulse">Over ons</a></li>
            <li><a href="/over-pulse#privacy">Privacy</a></li>
            <li><a href="/over-pulse#privacy">AVG-beleid</a></li>
            <li><p className="hp-footer-text">Contact</p></li>
          </ul>
        </nav>
        <div className="hp-footer-col" aria-labelledby="footer-download-title">
          <h4 id="footer-download-title">Downloaden</h4>
          <ul className="hp-footer-list">
            <li><p className="hp-footer-text">Web app</p></li>
            <li><p className="hp-footer-text">iOS</p></li>
            <li><p className="hp-footer-text">Android</p></li>
          </ul>
        </div>
      </div>
      <div className="hp-footer-copy">© {currentYear} Pulse — Echt Nederlands. Echt veilig.</div>
    </footer>
  );
}
