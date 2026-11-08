/**
 * Dynamic SEO and Open Graph Management for Rentu
 * Updates document title, meta tags, and structured schema reactively.
 */

export interface SeoConfig {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  keywords?: string[];
}

const DEFAULT_TITLE = 'Rentu — Peer-to-Peer Rental Marketplace | Rent & Lend Gear';
const DEFAULT_DESC = 'Rentu is the community platform to rent, lend, and borrow anything. Save money by renting cameras, tech, tools, and creative gear, or earn cash by lending what you own.';
const DEFAULT_IMAGE = 'https://www.rentu.site/og-image.png';
const BASE_URL = 'https://www.rentu.site';

export const updateSeo = (config: SeoConfig) => {
  if (typeof document === 'undefined') return;

  const title = config.title ? `${config.title} | Rentu` : DEFAULT_TITLE;
  const description = config.description || DEFAULT_DESC;
  const image = config.image || DEFAULT_IMAGE;
  const url = config.canonicalUrl || (typeof window !== 'undefined' ? window.location.href : BASE_URL);

  // 1. Update Title
  document.title = title;

  // Helper to set or create meta tag
  const setMeta = (attrName: string, attrVal: string, content: string) => {
    let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  // 2. Primary Meta Tags
  setMeta('name', 'description', description);
  if (config.keywords && config.keywords.length > 0) {
    setMeta('name', 'keywords', config.keywords.join(', '));
  }

  // 3. Open Graph
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:type', config.type || 'website');

  // 4. Twitter Card
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);

  // 5. Canonical Link
  let canonicalEl = document.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.setAttribute('rel', 'canonical');
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.setAttribute('href', url.split('?')[0]); // Clean canonical apex URL
};

