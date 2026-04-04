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
          <p>
            Pulse houdt ouder en kind veilig verbonden.
            <br />
            Chatten, bellen en videobellen met wie echt telt.
          </p>
        </div>

        <div className="hp-footer-nav-group">
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
              <li><a href="/privacybeleid">Privacybeleid</a></li>
              <li><a href="/avg-beleid-elektronische-communicatie">AVG-beleid</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </nav>
        </div>

        <div className="hp-footer-col hp-footer-download" aria-labelledby="footer-download-title">
          <h4 id="footer-download-title">Downloaden</h4>
          <div className="hp-footer-download-row">
            <span className="hp-footer-download-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Web
            </span>
            <span className="hp-footer-download-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              iOS
            </span>
            <span className="hp-footer-download-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84 1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C14.15 1.23 13.1 1 12 1c-1.1 0-2.15.23-3.12.63L7.4.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C6.14 3.07 5 5.06 5 7h14c0-1.94-1.14-3.93-3.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
              Android
            </span>
          </div>
        </div>
      </div>
      <div className="hp-footer-copy">© {currentYear} Pulse — Voor ouder en kind. Veilig verbonden.</div>
    </footer>
  );
}
