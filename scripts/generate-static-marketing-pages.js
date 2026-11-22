const fs = require('fs');
const path = require('path');

const buildDir = path.join(process.cwd(), 'build');
const indexPath = path.join(buildDir, 'index.html');
const siteUrl = 'https://pulse-messenger.com';

const pages = [
  {
    path: '/',
    title: 'Pulse — Veilig communiceren voor elk kind',
    description: 'Pulse is een veilige Nederlandse chat-app voor kinderen, zonder telefoonnummer en e-mailadres, onder ouderlijk toezicht.',
    heading: 'Veilig chatten voor elk kind',
    intro: 'Pulse helpt kinderen veilig in contact te blijven met familie en vrienden. Zonder telefoonnummer of e-mailadres, met ouderlijk toezicht.',
    links: [['Hoe werkt Pulse?', '/hoe-werkt-het'], ['Ontdek de functies', '/functies'], ['Privacy-First', '/privacy-first']],
  },
  {
    path: '/functies',
    title: 'Functies — Pulse Messenger',
    description: 'Ontdek veilig chatten, bellen en ouderlijk toezicht in Pulse Messenger.',
    heading: 'Alles voor veilig contact',
    intro: 'Pulse brengt chatten, bellen en videogesprekken samen in een rustige omgeving voor kinderen en hun vertrouwde contacten.',
    links: [['Veilig chatten', '/functies#chatten'], ['Ouderlijk toezicht', '/ouderlijk-toezicht'], ['Hoe werkt Pulse?', '/hoe-werkt-het']],
  },
  {
    path: '/ouderlijk-toezicht',
    title: 'Ouderlijk toezicht — Pulse Messenger',
    description: 'Ontdek hoe Pulse ouders helpt om het contact van hun kind veilig en overzichtelijk te beheren.',
    heading: 'Overzicht en controle voor ouders',
    intro: 'Met een eigen ouderaccount beheren ouders de vertrouwde contacten en instellingen van hun kind, terwijl het kind eenvoudig kan communiceren.',
    links: [['Bekijk de functies', '/functies'], ['Hoe werkt Pulse?', '/hoe-werkt-het'], ['Privacy-First', '/privacy-first']],
  },
  {
    path: '/hoe-werkt-het',
    title: 'Hoe werkt Pulse? — Pulse Messenger',
    description: 'Lees hoe gezinnen starten met Pulse en veilig verbonden blijven.',
    heading: 'Zo werkt Pulse',
    intro: 'Een ouder maakt een account aan, nodigt vertrouwde contacten uit en helpt het kind veilig contact te houden met de mensen die ertoe doen.',
    links: [['Start met Pulse', '/'], ['Ouderlijk toezicht', '/ouderlijk-toezicht'], ['Veelgestelde functies', '/functies']],
  },
  {
    path: '/privacy-first',
    title: 'Privacy-First — Pulse Messenger',
    description: 'Lees hoe Pulse privacy en veilige communicatie voor gezinnen centraal zet.',
    heading: 'Privacy staat voorop',
    intro: 'Pulse verzamelt alleen wat nodig is voor veilige communicatie. Geen advertenties, gedragsprofielen of onnodige gegevensverzameling.',
    links: [['Privacybeleid', '/privacybeleid'], ['AVG-beleid', '/avg-beleid-elektronische-communicatie'], ['Veilig chatten', '/functies#chatten']],
  },
  {
    path: '/over-pulse',
    title: 'Over Pulse — Pulse Messenger',
    description: 'Lees waar Pulse voor staat: veilige, rustige communicatie voor kinderen en gezinnen.',
    heading: 'Over Pulse',
    intro: 'Pulse is gemaakt voor gezinnen die kinderen online contact willen laten houden in een veilige, rustige en begrijpelijke omgeving.',
    links: [['Hoe werkt Pulse?', '/hoe-werkt-het'], ['Contact', '/contact'], ['Privacy-First', '/privacy-first']],
  },
  {
    path: '/contact',
    title: 'Contact — Pulse Messenger',
    description: 'Neem contact op met Pulse Messenger voor vragen over veilige communicatie voor gezinnen.',
    heading: 'Contact met Pulse',
    intro: 'Heb je een vraag over Pulse, privacy of veilig communiceren? Neem contact met ons op.',
    links: [['Over Pulse', '/over-pulse'], ['Privacybeleid', '/privacybeleid'], ['Naar de homepage', '/']],
  },
  {
    path: '/privacybeleid',
    title: 'Privacybeleid — Pulse Messenger',
    description: 'Lees het privacybeleid van Pulse Messenger.',
    heading: 'Privacybeleid',
    intro: 'Lees hoe Pulse zorgvuldig met persoonsgegevens en communicatiegegevens omgaat.',
    links: [['Privacy-First', '/privacy-first'], ['AVG-beleid', '/avg-beleid-elektronische-communicatie'], ['Contact', '/contact']],
  },
  {
    path: '/avg-beleid-elektronische-communicatie',
    title: 'AVG-beleid — Pulse Messenger',
    description: 'Lees het AVG-beleid voor elektronische communicatie van Pulse Messenger.',
    heading: 'AVG-beleid elektronische communicatie',
    intro: 'Dit beleid licht toe hoe Pulse elektronische communicatie en gegevensverwerking zorgvuldig organiseert.',
    links: [['Privacybeleid', '/privacybeleid'], ['Privacy-First', '/privacy-first'], ['Contact', '/contact']],
  },
  {
    path: '/sitemap',
    title: 'Sitemap — Pulse Messenger',
    description: 'Overzicht van alle publieke pagina’s van Pulse Messenger.',
    heading: 'Sitemap',
    intro: 'Vind informatie over Pulse, functies, ouderlijk toezicht, privacy en contact.',
    links: [['Homepage', '/'], ['Functies', '/functies'], ['Ouderlijk toezicht', '/ouderlijk-toezicht'], ['Privacy-First', '/privacy-first']],
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function canonicalUrl(pagePath) {
  return pagePath === '/' ? `${siteUrl}/` : `${siteUrl}${pagePath}`;
}

function replaceMeta(html, selector, replacement) {
  return html.replace(selector, replacement);
}

function renderContent(page) {
  const links = page.links
    .map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`)
    .join('');

  return `<main class="pulse-static-marketing" aria-labelledby="pulse-static-title">
  <nav aria-label="Pulse navigatie"><a href="/">Pulse</a></nav>
  <article>
    <p>Pulse Messenger</p>
    <h1 id="pulse-static-title">${escapeHtml(page.heading)}</h1>
    <p>${escapeHtml(page.intro)}</p>
    <ul>${links}</ul>
  </article>
</main>`;
}

function renderPage(shell, page) {
  const canonical = canonicalUrl(page.path);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const content = renderContent(page);
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Pulse Messenger', url: `${siteUrl}/` },
  });

  let html = shell;
  html = replaceMeta(html, /<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = replaceMeta(html, /(<meta name="description" content=")[^"]*(" \/>)/, `$1${description}$2`);
  html = replaceMeta(html, /(<link rel="canonical" href=")[^"]*(" \/>)/, `$1${canonical}$2`);
  html = replaceMeta(html, /(<meta property="og:title" content=")[^"]*(" \/>)/, `$1${title}$2`);
  html = replaceMeta(html, /(<meta property="og:description" content=")[^"]*(" \/>)/, `$1${description}$2`);
  html = replaceMeta(html, /(<meta property="og:url" content=")[^"]*(" \/>)/, `$1${canonical}$2`);
  html = replaceMeta(html, /(<meta name="twitter:title" content=")[^"]*(" \/>)/, `$1${title}$2`);
  html = replaceMeta(html, /(<meta name="twitter:description" content=")[^"]*(" \/>)/, `$1${description}$2`);
  html = html.replace('</head>', `<style>
    .pulse-static-marketing { max-width: 72rem; margin: 7rem auto 4rem; padding: 0 1.5rem; color: #1a1a2e; font: 1rem/1.65 Arial, sans-serif; }
    .pulse-static-marketing article { max-width: 46rem; }
    .pulse-static-marketing a { color: #5b4ee8; }
    .pulse-js .pulse-static-marketing { display: none; }
  </style>
  <script>document.documentElement.classList.add('pulse-js');</script>
  <script type="application/ld+json">${structuredData}</script>\n</head>`);
  html = html.replace('<div id="root"></div>', `<div id="root"></div>\n${content}`);
  return html;
}

if (!fs.existsSync(indexPath)) {
  throw new Error('Landing build ontbreekt. Voer eerst react-scripts build uit.');
}

const shell = fs.readFileSync(indexPath, 'utf8');
for (const page of pages) {
  const outputPath = page.path === '/'
    ? indexPath
    : path.join(buildDir, page.path.slice(1), 'index.html');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderPage(shell, page), 'utf8');
}

console.log(`Generated static marketing HTML for ${pages.length} public routes.`);
