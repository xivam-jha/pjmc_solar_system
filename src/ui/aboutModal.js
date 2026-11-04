/**
 * PJMC Student — About Modal
 * Presents genuine educational mission information for Pawan Jha Mathematics Classes
 */

import { BRAND, getMonogramSvg } from '../config/brand.js';

export class AboutModal {
  constructor() {
    this.lang = 'en';
    this.isOpen = false;
    this.#buildDOM();
  }

  #buildDOM() {
    this.root = document.createElement('div');
    this.root.className = 'pjmc-modal pjmc-about-modal hidden';
    this.root.id = 'pjmc-about-modal';
    this.root.style.display = 'none';

    this.root.innerHTML = `
      <div class="pjmc-modal-backdrop"></div>
      <div class="pjmc-modal-window pjmc-about-window">
        <div class="pjmc-modal-header">
          <div class="pjmc-title-group" style="display: flex; align-items: center; gap: 12px;">
            ${getMonogramSvg(38, 'pjmc-about-logo')}
            <div>
              <span class="pjmc-sub-title" id="pjmc-about-sub">${BRAND.institute}</span>
              <h2 class="pjmc-modal-title" id="pjmc-about-title">${BRAND.name}</h2>
            </div>
          </div>
          <button type="button" class="pjmc-modal-close-btn" id="pjmc-about-close" aria-label="Close">✕</button>
        </div>

        <div class="pjmc-about-body">
          <div class="pjmc-about-banner">
            <span class="pjmc-about-tagline" id="pjmc-about-tagline">${BRAND.tagline}</span>
            <span class="pjmc-about-badge">OFFICIAL EDUCATIONAL PLATFORM</span>
          </div>

          <p class="pjmc-about-desc" id="pjmc-about-desc">
            ${BRAND.aboutDesc}
          </p>

          <div class="pjmc-about-pillars">
            <div class="pjmc-pillar-card">
              <span class="pillar-icon">🪐</span>
              <strong class="pillar-title" id="pjmc-p1-title">SOLAR EXPLORATION</strong>
              <span class="pillar-desc" id="pjmc-p1-desc">Interactive 3D orbits and celestial physics for Sun, planets, and moons.</span>
            </div>
            <div class="pjmc-pillar-card">
              <span class="pillar-icon">🚀</span>
              <strong class="pillar-title" id="pjmc-p2-title">PJMC-01 FLIGHT</strong>
              <span class="pillar-desc" id="pjmc-p2-desc">Spacecraft navigation, planetary flybys, and orbital waypoint missions.</span>
            </div>
            <div class="pjmc-pillar-card">
              <span class="pillar-icon">📐</span>
              <strong class="pillar-title" id="pjmc-p3-title">MATHEMATICS & PHYSICS</strong>
              <span class="pillar-desc" id="pjmc-p3-desc">Real-world scale ratios, orbital velocities, and aerospace dynamics.</span>
            </div>
          </div>

          <div class="pjmc-about-footer-card">
            <div class="pjmc-about-inst-name">${BRAND.institute}</div>
            <div class="pjmc-about-prod-name">${BRAND.product} • SPACECRAFT ${BRAND.spacecraft}</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.root);

    const closeBtn = this.root.querySelector('#pjmc-about-close');
    const backdrop = this.root.querySelector('.pjmc-modal-backdrop');

    closeBtn.addEventListener('click', () => this.close());
    backdrop.addEventListener('click', () => this.close());

    window.addEventListener('keydown', (e) => {
      if (this.isOpen && e.key === 'Escape') this.close();
    });
  }

  setLanguage(lang) {
    this.lang = lang;
    const isHi = lang === 'hi';

    const taglineEl = this.root.querySelector('#pjmc-about-tagline');
    const descEl = this.root.querySelector('#pjmc-about-desc');
    const p1Title = this.root.querySelector('#pjmc-p1-title');
    const p1Desc = this.root.querySelector('#pjmc-p1-desc');
    const p2Title = this.root.querySelector('#pjmc-p2-title');
    const p2Desc = this.root.querySelector('#pjmc-p2-desc');
    const p3Title = this.root.querySelector('#pjmc-p3-title');
    const p3Desc = this.root.querySelector('#pjmc-p3-desc');

    if (isHi) {
      if (taglineEl) taglineEl.textContent = BRAND.taglineHi;
      if (descEl) descEl.textContent = BRAND.aboutDescHi;
      if (p1Title) p1Title.textContent = 'सौरमंडल अन्वेषण';
      if (p1Desc) p1Desc.textContent = 'सूर्य, ग्रहों और चंद्रमाओं के लिए 3D कक्षाएं और खगोलीय भौतिकी।';
      if (p2Title) p2Title.textContent = 'PJMC-01 अंतरिक्ष उड़ान';
      if (p2Desc) p2Desc.textContent = 'अंतरिक्ष यान संचालन, ग्रहों के समीप उड़ान और कक्षीय मिशन।';
      if (p3Title) p3Title.textContent = 'गणित एवं भौतिकी';
      if (p3Desc) p3Desc.textContent = 'वास्तविक माप अनुपात, कक्षीय वेग और एयरोस्पेस गतिशीलता।';
    } else {
      if (taglineEl) taglineEl.textContent = BRAND.tagline;
      if (descEl) descEl.textContent = BRAND.aboutDesc;
      if (p1Title) p1Title.textContent = 'SOLAR EXPLORATION';
      if (p1Desc) p1Desc.textContent = 'Interactive 3D orbits and celestial physics for Sun, planets, and moons.';
      if (p2Title) p2Title.textContent = 'PJMC-01 FLIGHT';
      if (p2Desc) p2Desc.textContent = 'Spacecraft navigation, planetary flybys, and orbital waypoint missions.';
      if (p3Title) p3Title.textContent = 'MATHEMATICS & PHYSICS';
      if (p3Desc) p3Desc.textContent = 'Real-world scale ratios, orbital velocities, and aerospace dynamics.';
    }
  }

  open() {
    this.isOpen = true;
    this.root.style.display = 'flex';
    this.root.classList.remove('hidden');
    this.root.classList.add('active');
  }

  close() {
    this.isOpen = false;
    this.root.style.display = 'none';
    this.root.classList.add('hidden');
    this.root.classList.remove('active');
  }
}
