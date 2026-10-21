/** Information panel for a selected celestial body. */
import { BODY_FACTS_HI, UI_TEXT, bodyName } from './translations.js';

function localizeValue(value, language) {
  if (language !== 'hi' || !value || value === '—') return value ?? '—';
  return String(value)
    .replace(/synchronous/gi, 'समकालिक घूर्णन')
    .replace(/retrograde/gi, 'विपरीत दिशा')
    .replace(/none shown/gi, 'कोई प्रदर्शित नहीं')
    .replace(/shown/gi, 'दिखाए गए')
    .replace(/equator/gi, 'भूमध्य रेखा')
    .replace(/\bdays?\b/gi, 'दिन')
    .replace(/\byears?\b/gi, 'वर्ष')
    .replace(/\bhours?\b/gi, 'घंटे');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class InfoPanel {
  constructor(onClose) {
    this.onClose = onClose;
    this.language = 'en';
    this.currentData = null;
    this.parentName = null;
    this.currentDistanceAU = null;
    this.panel = el('section', 'info-panel hidden');
    this.panel.setAttribute('aria-live', 'polite');

    const header = el('div', 'info-header');
    this.titleWrap = el('div', 'info-title-wrap');
    this.nameEl = el('div', 'info-name');
    this.typeEl = el('div', 'info-type');
    this.titleWrap.append(this.nameEl, this.typeEl);
    const closeBtn = el('button', 'info-close', '✕');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Close panel');
    closeBtn.addEventListener('click', onClose);
    header.append(this.titleWrap, closeBtn);

    this.rows = el('div', 'info-rows');
    this.factEl = el('div', 'info-fact');
    const brandStamp = el('div', 'info-brand-stamp');
    this.brandTitle = el('div', 'info-brand-title', 'PJMC SOLAR SYSTEM');
    this.brandSubtitle = el('div', 'info-brand-subtitle', 'PAWAN JHA MATHEMATICS CLASSES · SUKHPUR');
    brandStamp.append(this.brandTitle, this.brandSubtitle);
    this.panel.append(header, this.rows, this.factEl, brandStamp);
    document.body.append(this.panel);
    this.closeBtn = closeBtn;
  }

  #row(label, value) {
    const row = el('div', 'info-row');
    row.append(el('div', 'info-label', label), el('div', 'info-value', value));
    return row;
  }

  setLanguage(language) {
    this.language = language === 'hi' ? 'hi' : 'en';
    const t = UI_TEXT[this.language];
    this.closeBtn.setAttribute('aria-label', t.close);
    this.brandTitle.textContent = t.about;
    this.brandSubtitle.textContent = t.school;
    if (this.currentData) this.show(this.currentData, this.parentName, this.currentDistanceAU);
  }

  show(data, parentName, currentDistanceAU = null) {
    this.currentData = data;
    this.parentName = parentName;
    this.currentDistanceAU = currentDistanceAU;
    const t = UI_TEXT[this.language];
    this.nameEl.textContent = bodyName(data.id, data.name, this.language).toLocaleUpperCase();
    this.typeEl.textContent = t.type[data.type] ?? data.type;
    this.rows.replaceChildren();

    this.rows.append(this.#row(t.diameter, `${data.diameterKm.toLocaleString(this.language === 'hi' ? 'hi-IN' : 'en-US')} km`));
    if (data.distanceAU > 0) {
      const distanceAU = Number.isFinite(currentDistanceAU) ? currentDistanceAU : data.distanceAU;
      const mkm = Math.round((distanceAU * 149_597_870) / 1e6);
      this.rows.append(this.#row(t.distanceSun, `${distanceAU.toFixed(3)} AU (${mkm.toLocaleString(this.language === 'hi' ? 'hi-IN' : 'en-US')}M km)`));
    } else if (data.distanceKm) {
      const parent = parentName ? bodyName(parentName.toLowerCase(), parentName, this.language).toLocaleUpperCase() : (this.language === 'hi' ? 'मूल पिंड' : 'PARENT');
      this.rows.append(this.#row(`${t.distanceParent} ${parent}`, `${data.distanceKm.toLocaleString(this.language === 'hi' ? 'hi-IN' : 'en-US')} km`));
    }
    this.rows.append(this.#row(t.period, localizeValue(data.periodDisplay ?? '—', this.language)));
    this.rows.append(this.#row(t.day, localizeValue(data.dayDisplay ?? '—', this.language)));
    this.rows.append(this.#row(t.tilt, localizeValue(data.tiltDisplay ?? `${data.axialTiltDeg ?? 0}°`, this.language)));
    if (data.moonsDisplay !== undefined) this.rows.append(this.#row(t.moons, localizeValue(data.moonsDisplay, this.language)));

    this.factEl.textContent = this.language === 'hi' ? (BODY_FACTS_HI[data.id] ?? data.fact ?? '') : (data.fact ?? '');
    this.panel.classList.remove('hidden');
  }

  hide() {
    this.currentData = null;
    this.parentName = null;
    this.currentDistanceAU = null;
    this.panel.classList.add('hidden');
  }
}
