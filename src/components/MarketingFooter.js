import PulseLogo from './PulseLogo';

export default function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="hp-footer" id="footer">
      <div className="hp-footer-inner">
        <div className="hp-footer-brand">
          <div className="hp-footer-logo">
            <PulseLogo size={30} textSize={20} color="#6c63ff" gap={10} />
          </div>
          <p>
            Pulse houdt ouder en kind veilig verbonden.
            <br />
            Veilig chatten, bellen en videobellen in de app.
          </p>
        </div>

        <div className="hp-footer-nav-group">
          <nav className="hp-footer-col" aria-labelledby="footer-features-title">
            <h4 id="footer-features-title">Functies</h4>
            <ul className="hp-footer-list">
              <li><a href="/functies#chatten">Chatten</a></li>
              <li><a href="/functies#bellen">Bellen</a></li>
              <li><a href="/functies#videobellen">Videobellen</a></li>
              <li><a href="/ouderlijk-toezicht#dashboard">Ouderlijk toezicht</a></li>
            </ul>
          </nav>
          <nav className="hp-footer-col" aria-labelledby="footer-about-title">
            <h4 id="footer-about-title">Over</h4>
            <ul className="hp-footer-list">
              <li><a href="/over-pulse">Pulse</a></li>
              <li><a href="/privacy-first">Privacy-First</a></li>
              <li><a href="/hoe-werkt-het#hoe-werkt-pulse">Hoe werkt het</a></li>
              <li><a href="/contact">Contact</a></li>
            </ul>
          </nav>
          <nav className="hp-footer-col" aria-labelledby="footer-download-title">
            <h4 id="footer-download-title">Download</h4>
            <ul className="hp-footer-list">
              <li><button type="button" className="hp-footer-link-btn">Android</button></li>
              <li><button type="button" className="hp-footer-link-btn">iPhone/iPad</button></li>
              <li><button type="button" className="hp-footer-link-btn">Mac/Windows</button></li>
              <li><button type="button" className="hp-footer-link-btn">Pulse Web</button></li>
            </ul>
          </nav>
        </div>

        <div className="hp-footer-copy">
          <div className="hp-footer-copy-links">
            <a href="/privacybeleid">Privacybeleid</a>
            <a href="/avg-beleid-elektronische-communicatie">AVG-beleid</a>
            <a href="/sitemap">Sitemap</a>
          </div>
          <span>© {currentYear} Pulse — Voor ouder en kind. Veilig verbonden.</span>
        </div>
      </div>
    </footer>
  );
}
