import React from 'react';

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="hp-footer" id="footer">
      <div className="hp-footer-inner">
        <div className="hp-footer-brand">
          <div className="hp-footer-logo">
            <img src="/logo192.png" alt="Pulse" width={28} height={28} />
            <span>Pulse</span>
          </div>
          <p>Veilig communiceren voor elk kind.</p>
        </div>
        <div className="hp-footer-col">
          <h4>Functies</h4>
          <a href="/functies">Chatten</a>
          <a href="/functies">Bellen</a>
          <a href="/functies">Videobellen</a>
          <a href="/hoe-werkt-het">Hoe werkt het</a>
          <a href="/ouderlijk-toezicht">Ouderlijk toezicht</a>
        </div>
        <div className="hp-footer-col">
          <h4>Over Pulse</h4>
          <a href="/over-pulse">Over ons</a>
          <a href="/over-pulse">Privacy</a>
          <a href="/over-pulse">AVG-beleid</a>
          <p className="hp-footer-text">Contact</p>
        </div>
        <div className="hp-footer-col">
          <h4>Downloaden</h4>
          <p className="hp-footer-text">Web app</p>
          <p className="hp-footer-text">iOS</p>
          <p className="hp-footer-text">Android</p>
        </div>
      </div>
      <div className="hp-footer-copy">© {currentYear} Pulse — Echt Nederlands. Echt veilig.</div>
    </footer>
  );
}
