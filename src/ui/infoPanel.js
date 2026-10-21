/** Fact and measurement panel for the currently focused celestial body. */
import { BODY_NAMES_HI, FACTS_HI, TYPE_NAMES_HI, bodyName } from './i18n.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const LABELS = {
  en: { diameter: 'DIAMETER', distanceSun: 'DIST. FROM SUN', distanceParent: 'DIST. FROM', orbitalPeriod: 'ORBITAL PERIOD', dayLength: 'DAY LENGTH', axialTilt: 'AXIAL TILT', moons: 'MOONS' },
  hi: { diameter: 'व्यास', distanceSun: 'सूर्य से दूरी', distanceParent: 'दूरी:', orbitalPeriod: 'परिक्रमा अवधि', dayLength: 'दिन की अवधि', axialTilt: 'अक्षीय झुकाव', moons: 'चंद्रमा' },
};
const PARENT_NAMES_HI = { Sun: 'सूर्य', Earth: 'पृथ्वी', Mars: 'मंगल', Jupiter: 'बृहस्पति', Saturn: 'शनि', Uranus: 'अरुण', Neptune: 'वरुण', Pluto: 'प्लूटो' };

function localizedValue(value, language) {
  if (language !== 'hi' || value == null) return value ?? '—';
  return String(value)
    .replace(/\bdays\b/gi, 'दिन')
    .replace(/\bday\b/gi, 'दिन')
    .replace(/\bhours\b/gi, 'घंटे')
    .replace(/\bhour\b/gi, 'घंटा')
    .replace(/\byears\b/gi, 'वर्ष')
    .replace(/\byear\b/gi, 'वर्ष')
    .replace(/\bmonths\b/gi, 'महीने')
    .replace(/\bmonth\b/gi, 'महीना')
    .replace(/\bretrograde\b/gi, 'वक्री')
    .replace(/\bsynchronous\b/gi, 'समकालिक');
}

export class InfoPanel {
  constructor(onClose) {
    this.language = 'en';
    this.currentData = null;
    this.parentName = null;
    this.panel = el('div', 'info-panel hidden');

    const header = el('div', 'info-header');
    this.nameEl = el('div', 'info-name');
    this.typeEl = el('div', 'info-type');
    const titleWrap = el('div', 'info-title-wrap');
    titleWrap.append(this.nameEl, this.typeEl);
    const closeBtn = el('button', 'info-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close information panel');
    closeBtn.addEventListener('click', onClose);
    header.append(titleWrap, closeBtn);

    this.rows = el('div', 'info-rows');
    this.factEl = el('div', 'info-fact');
    this.panel.append(header, this.rows, this.factEl);
    document.body.append(this.panel);
  }

  #row(label, value) {
    const row = el('div', 'info-row');
    row.append(el('div', 'info-label', label), el('div', 'info-value', value));
    return row;
  }

  show(data, parentName) {
    this.currentData = data;
    this.parentName = parentName;
    this.#render();
  }

  setLanguage(language) {
    this.language = language === 'hi' ? 'hi' : 'en';
    if (this.currentData) this.#render();
  }

  #render() {
    const data = this.currentData;
    if (!data) return;
    const language = this.language;
    const labels = LABELS[language];
    this.nameEl.textContent = language === 'hi' ? bodyName(data.id, data.name, 'hi') : data.name.toUpperCase();
    this.typeEl.textContent = language === 'hi' ? (TYPE_NAMES_HI[data.type] ?? data.type) : data.type;
    this.rows.replaceChildren();

    this.rows.append(this.#row(labels.diameter, `${data.diameterKm.toLocaleString('en-IN')} km`));

    if (data.distanceAU > 0) {
      const mkm = Math.round((data.distanceAU * 149_597_870) / 1e6);
      this.rows.append(this.#row(labels.distanceSun, `${data.distanceAU} AU (${mkm.toLocaleString('en-IN')}M km)`));
    } else if (data.distanceKm) {
      const localizedParent = language === 'hi' ? (PARENT_NAMES_HI[this.parentName] ?? this.parentName ?? 'मूल पिंड') : (this.parentName ?? 'PARENT');
      this.rows.append(this.#row(`${labels.distanceParent} ${localizedParent.toUpperCase()}`, `${data.distanceKm.toLocaleString('en-IN')} km`));
    }

    this.rows.append(this.#row(labels.orbitalPeriod, localizedValue(data.periodDisplay, language)));
    this.rows.append(this.#row(labels.dayLength, localizedValue(data.dayDisplay, language)));
    const tiltLabel = data.tiltDisplay ?? (data.axialTiltDeg == null ? '—' : `${data.axialTiltDeg}°`);
    this.rows.append(this.#row(labels.axialTilt, tiltLabel));
    if (data.moonsDisplay !== undefined) this.rows.append(this.#row(labels.moons, data.moonsDisplay));

    this.factEl.textContent = language === 'hi' ? (FACTS_HI[data.id] ?? data.fact ?? '') : (data.fact ?? '');
    this.panel.classList.remove('hidden');
  }

  hide() {
    this.panel.classList.add('hidden');
    this.currentData = null;
  }
}
