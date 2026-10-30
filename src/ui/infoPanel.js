/**
 * Info panel: facts and figures for the currently selected body.
 */

const FACT_HI = {
  sun: 'सूर्य में सौरमंडल के कुल द्रव्यमान का लगभग 99.86% है। इसके केंद्र में नाभिकीय संलयन से हाइड्रोजन हीलियम में बदलती है और ऊर्जा निकलती है।',
  earth: 'पृथ्वी हमारी जानकारी में एकमात्र ऐसा ग्रह है जिसकी सतह पर स्थायी तरल पानी और जीवन है। इसका लगभग 23.4° अक्षीय झुकाव ऋतुओं का कारण बनता है।',
  moon: 'चंद्रमा पृथ्वी से ज्वारीय रूप से बंधा है, इसलिए हमें इसका लगभग वही भाग हमेशा दिखाई देता है। यह हर वर्ष पृथ्वी से लगभग 3.8 सेंटीमीटर दूर जा रहा है।'
};
const HI = { Sun:'सूर्य', Mercury:'बुध', Venus:'शुक्र', Earth:'पृथ्वी', 'The Moon':'चंद्रमा', Mars:'मंगल', Phobos:'फोबोस', Deimos:'डिमोस', Jupiter:'बृहस्पति', Io:'आयो', Europa:'यूरोपा', Ganymede:'गेनीमेड', Callisto:'कैलिस्टो', Saturn:'शनि', Titan:'टाइटन', Triton:'ट्राइटन', Uranus:'अरुण', Neptune:'वरुण', Pluto:'प्लूटो', Charon:'कैरोन', 'DIAMETER':'व्यास', 'DIST. FROM SUN':'सूर्य से दूरी', 'ORBITAL PERIOD':'परिक्रमण अवधि', 'DAY LENGTH':'दिन की अवधि', 'AXIAL TILT':'अक्षीय झुकाव', 'MOONS':'उपग्रह', 'G2V Star':'G2V तारा', 'Terrestrial Planet':'स्थलीय ग्रह', 'Gas Giant':'गैसीय दानव', 'Ice Giant':'बर्फीला दानव', 'Moon':'उपग्रह' };
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class InfoPanel {
  constructor(onClose) {
    this.panel = el('div', 'info-panel hidden');

    const header = el('div', 'info-header');
    this.nameEl = el('div', 'info-name');
    this.typeEl = el('div', 'info-type');
    const titleWrap = el('div', 'info-title-wrap');
    titleWrap.append(this.nameEl, this.typeEl);
    const closeBtn = el('button', 'info-close', '✕');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', onClose);
    header.append(titleWrap, closeBtn);

    this.rows = el('div', 'info-rows');
    this.factEl = el('div', 'info-fact');
    this.lang = 'en';
    this.currentData = null; this.currentParentName = null;
    this.panel.append(header, this.rows, this.factEl);
    document.body.append(this.panel);
  }

  #row(label, value) {
    const row = el('div', 'info-row');
    row.append(el('div', 'info-label', label), el('div', 'info-value', value));
    return row;
  }

  /** @param {object} data body data entry; @param {string|null} parentName */
  setLanguage(lang) { this.lang = lang; if (this.currentData) this.show(this.currentData, this.currentParentName); }

  show(data, parentName) {
    this.currentData = data; this.currentParentName = parentName;
    const tr = (v) => this.lang === 'hi' ? (HI[v] || v) : v;
    this.nameEl.textContent = tr(data.name).toUpperCase();
    this.typeEl.textContent = tr(data.type);
    this.rows.replaceChildren();

    this.rows.append(this.#row(tr('DIAMETER'), `${data.diameterKm.toLocaleString('en-US')} km`));

    if (data.distanceAU > 0) {
      const mkm = Math.round((data.distanceAU * 149_597_870) / 1e6);
      this.rows.append(this.#row(tr('DIST. FROM SUN'), `${data.distanceAU} AU (${mkm.toLocaleString('en-US')}M km)`));
    } else if (data.distanceKm) {
      this.rows.append(
        this.#row(this.lang === 'hi' ? `${tr(parentName ?? 'PARENT')} से दूरी` : `DIST. FROM ${(parentName ?? 'PARENT').toUpperCase()}`, `${data.distanceKm.toLocaleString('en-US')} km`),
      );
    }

    this.rows.append(this.#row(tr('ORBITAL PERIOD'), data.periodDisplay ?? '—'));
    this.rows.append(this.#row(tr('DAY LENGTH'), data.dayDisplay ?? '—'));
    this.rows.append(this.#row(tr('AXIAL TILT'), data.tiltDisplay ?? `${data.axialTiltDeg}°`));
    if (data.moonsDisplay !== undefined) {
      this.rows.append(this.#row(tr('MOONS'), data.moonsDisplay));
    }

    this.factEl.textContent = this.lang === 'hi' ? (FACT_HI[data.id] || data.fact || '') : (data.fact ?? '');
    this.panel.classList.remove('hidden');
  }

  hide() {
    this.panel.classList.add('hidden');
  }
}
