import { useEffect } from 'react';

const DEFAULT_META = {
  title: 'Pulse — Veilig communiceren voor elk kind',
  description: 'De enige Nederlandse chat app voor kinderen zonder telefoonnummer. Veilig, afleidingsvrij en antipesten by design. Volledig onder ouderlijk toezicht.',
  canonical: 'https://pulse-frontend-elt.pages.dev/',
  image: 'https://pulse-frontend-elt.pages.dev/logo512.png',
};

function resolveCanonical(url) {
  try {
    return new URL(url || DEFAULT_META.canonical, DEFAULT_META.canonical).toString();
  } catch {
    return DEFAULT_META.canonical;
  }
}

function upsertMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
}

export default function PageMeta({ title, description, canonical, image }) {
  useEffect(() => {
    const next = {
      ...DEFAULT_META,
      title,
      description,
      canonical: resolveCanonical(canonical),
      image,
    };

    document.title = next.title;

    upsertMeta('meta[name="description"]', { name: 'description', content: next.description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: next.title });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: next.description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: next.canonical });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: next.image });
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: next.title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: next.description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: next.image });

    let canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', next.canonical);
  }, [canonical, description, image, title]);

  return null;
}
