/**
 * PJMC Student Brand Identity & Configuration
 * Master Brand: PJMC STUDENT
 * Institute: PAWAN JHA MATHEMATICS CLASSES
 * Product: PJMC SPACE EXPLORER
 * Spacecraft: PJMC-01
 * Tagline: LEARN • EXPLORE • DISCOVER
 */

export const BRAND = {
  name: 'PJMC STUDENT',
  institute: 'PAWAN JHA MATHEMATICS CLASSES',
  product: 'PJMC SPACE EXPLORER',
  spacecraft: 'PJMC-01',
  shortBrand: 'PJMC',
  tagline: 'LEARN • EXPLORE • DISCOVER',
  taglineHi: 'सीखें • खोजें • समझें',

  // Educational Mission statement
  aboutTitle: 'PJMC STUDENT',
  aboutSubtitle: 'PAWAN JHA MATHEMATICS CLASSES',
  aboutDesc:
    'PJMC Student is an educational platform designed to support students through interactive learning experiences and digital study resources. This Space Explorer experience introduces students to planets, moons, orbital motion and the Solar System through interactive 3D visualization.',
  aboutDescHi:
    'PJMC Student एक शैक्षणिक मंच है जिसे विद्यार्थियों को संवादात्मक शिक्षण अनुभवों और डिजिटल अध्ययन संसाधनों के माध्यम से सशक्त बनाने के लिए तैयार किया गया है। यह स्पेस एक्सप्लोरर संवादात्मक 3D विज़ुअलाइज़ेशन के माध्यम से सौरमंडल, ग्रहों, चंद्रमाओं और कक्षीय गति का परिचय देता है।',

  // Colors
  colors: {
    bg: '#050B18',
    panel: '#0B1630',
    cyan: '#48D9FF',
    blue: '#397BFF',
    gold: '#FFC36B',
    white: '#F5FAFF',
    dimText: '#8fa7be',
  },
};

/**
 * High-definition standalone vector monogram logo.
 * Features an orbital planetary ring, geometric PJMC monogram typography,
 * and a 4-point spark of mathematical knowledge and discovery.
 */
export function getMonogramSvg(size = 36, extraClass = '') {
  return `
    <svg class="pjmc-brand-logo ${extraClass}" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PJMC Student Logo">
      <defs>
        <linearGradient id="pjmc-grad-core" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#48D9FF" />
          <stop offset="50%" stop-color="#397BFF" />
          <stop offset="100%" stop-color="#0055ff" />
        </linearGradient>
        <linearGradient id="pjmc-grad-ring" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#FFC36B" />
          <stop offset="45%" stop-color="#48D9FF" />
          <stop offset="100%" stop-color="#397BFF" stop-opacity="0.2" />
        </linearGradient>
        <filter id="pjmc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Outer Cosmic Orbit Ring (tilted ellipse) -->
      <ellipse cx="32" cy="32" rx="27" ry="12" transform="rotate(-28 32 32)" stroke="url(#pjmc-grad-ring)" stroke-width="2" stroke-dasharray="82 6" fill="none" opacity="0.9" />

      <!-- Orbiting Celestial Knowledge Node -->
      <circle cx="53" cy="21" r="3.2" fill="#FFC36B" filter="url(#pjmc-glow)" />

      <!-- Central Hex-Shield Base -->
      <polygon points="32,6 54,18 54,46 32,58 10,46 10,18" fill="#0B1630" stroke="url(#pjmc-grad-core)" stroke-width="2.2" />

      <!-- Inner Geometry Accent Lines -->
      <polygon points="32,10 50,20 50,44 32,54 14,44 14,20" fill="#050B18" opacity="0.85" />

      <!-- Sharp Geometric PJMC Monogram Lettering -->
      <text x="32" y="38" font-family="'Cascadia Code', 'Consolas', 'SF Pro Display', system-ui, sans-serif" font-weight="900" font-size="14.5" fill="#F5FAFF" text-anchor="middle" letter-spacing="1.4" filter="url(#pjmc-glow)">PJMC</text>

      <!-- Knowledge Spark Crest at Apex -->
      <path d="M32 11 L33.2 14.5 L36.7 15.7 L33.2 16.9 L32 20.4 L30.8 16.9 L27.3 15.7 L30.8 14.5 Z" fill="#FFC36B" />
    </svg>
  `.trim();
}

/**
 * Full Horizontal Brand Header Logo (Monogram + Text block)
 */
export function getFullBrandHeaderSvg(height = 36) {
  return `
    <div class="pjmc-full-brand-badge">
      ${getMonogramSvg(height, 'pjmc-header-monogram')}
      <div class="pjmc-brand-text-block">
        <div class="pjmc-brand-row-top">
          <span class="pjmc-brand-primary">PJMC STUDENT</span>
          <span class="pjmc-brand-pill">SPACE EXPLORER</span>
        </div>
        <div class="pjmc-brand-sub">PAWAN JHA MATHEMATICS CLASSES</div>
      </div>
    </div>
  `.trim();
}

/**
 * Favicon Data URI containing the official SVG brand mark
 */
export function getFaviconDataUri() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#48D9FF" />
          <stop offset="100%" stop-color="#397BFF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#050B18" />
      <ellipse cx="32" cy="32" rx="27" ry="11" transform="rotate(-28 32 32)" stroke="#FFC36B" stroke-width="2.5" fill="none" opacity="0.85" />
      <polygon points="32,8 53,20 53,44 32,56 11,44 11,20" fill="#0B1630" stroke="url(#g)" stroke-width="2.8" />
      <text x="32" y="38" font-family="sans-serif" font-weight="900" font-size="14.5" fill="#F5FAFF" text-anchor="middle" letter-spacing="1">PJMC</text>
      <circle cx="52" cy="21" r="3.5" fill="#48D9FF" />
    </svg>
  `.trim();
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
