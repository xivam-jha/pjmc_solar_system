/**
 * Info panel: facts and figures for the currently selected body.
 */

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
    this.panel.append(header, this.rows, this.factEl);
    document.body.append(this.panel);
  }

  #row(label, value) {
    const row = el('div', 'info-row');
    row.append(el('div', 'info-label', label), el('div', 'info-value', value));
    return row;
  }

  /** @param {object} data body data entry; @param {string|null} parentName */
  show(data, parentName) {
    this.nameEl.textContent = data.name.toUpperCase();
    this.typeEl.textContent = data.type;
    this.rows.replaceChildren();

    this.rows.append(this.#row('DIAMETER', `${data.diameterKm.toLocaleString('en-US')} km`));

    if (data.distanceAU > 0) {
      const mkm = Math.round((data.distanceAU * 149_597_870) / 1e6);
      this.rows.append(this.#row('DIST. FROM SUN', `${data.distanceAU} AU (${mkm.toLocaleString('en-US')}M km)`));
    } else if (data.distanceKm) {
      this.rows.append(
        this.#row(`DIST. FROM ${(parentName ?? 'PARENT').toUpperCase()}`, `${data.distanceKm.toLocaleString('en-US')} km`),
      );
    }

    this.rows.append(this.#row('ORBITAL PERIOD', data.periodDisplay ?? '—'));
    this.rows.append(this.#row('DAY LENGTH', data.dayDisplay ?? '—'));
    this.rows.append(this.#row('AXIAL TILT', data.tiltDisplay ?? `${data.axialTiltDeg}°`));
    if (data.moonsDisplay !== undefined) {
      this.rows.append(this.#row('MOONS', data.moonsDisplay));
    }

    this.factEl.textContent = data.fact ?? '';
    this.panel.classList.remove('hidden');
  }

  hide() {
    this.panel.classList.add('hidden');
  }
}
