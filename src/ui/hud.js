/**
 * HUD: top bar (view controls), left body selector, bottom time bar.
 * Pure DOM — built once, driven through the small API object it returns.
 */

import { SPEED_PRESETS } from '../data/celestialBodies.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label, className, onClick) {
  const b = el('button', `hud-btn ${className ?? ''}`, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/**
 * @param {object} app callbacks into main:
 *   onSelectBody(id), onTogglePlay(), onSetSpeed(index), onSetScaleMode(mode),
 *   onResetView(), onFreeCamera(), onToggleOrbits(on), onToggleLabels(on)
 * @param {Array} bodyList flat [{id, name, isMoon}] in display order
 */
export function createHUD(app, bodyList) {
  const hud = el('div', 'hud');

  /* ---------------- top bar ---------------- */
  const top = el('header', 'top-bar');
  const title = el('div', 'app-title');
  title.append(el('span', 'title-main', 'SOLAR SYSTEM'), el('span', 'title-sub', 'EXPLORER'));
  top.append(title);

  const viewControls = el('div', 'view-controls');

  const vizBtn = button('VISUALIZATION', 'scale-btn active', () => app.onSetScaleMode('viz'));
  const trueBtn = button('TRUE SCALE', 'scale-btn', () => app.onSetScaleMode('true'));
  const scaleGroup = el('div', 'btn-group');
  scaleGroup.append(vizBtn, trueBtn);

  let orbitsOn = true;
  let labelsOn = true;
  const orbitsBtn = button('ORBITS', 'toggle-btn active', () => {
    orbitsOn = !orbitsOn;
    orbitsBtn.classList.toggle('active', orbitsOn);
    app.onToggleOrbits(orbitsOn);
  });
  const labelsBtn = button('LABELS', 'toggle-btn active', () => {
    labelsOn = !labelsOn;
    labelsBtn.classList.toggle('active', labelsOn);
    app.onToggleLabels(labelsOn);
  });
  // FREE CAM doubles as a mode indicator: lit while the camera is free,
  // unlit while following a body (clicking it then releases the follow).
  const freeBtn = button('FREE CAM', 'action-btn active', () => app.onFreeCamera());
  const resetBtn = button('RESET VIEW', 'action-btn', () => app.onResetView());

  viewControls.append(scaleGroup, orbitsBtn, labelsBtn, freeBtn, resetBtn);
  top.append(viewControls);
  hud.append(top);

  /* ---------------- body selector ---------------- */
  const listWrap = el('aside', 'body-list');
  listWrap.append(el('div', 'panel-heading', 'BODIES'));
  const list = el('div', 'body-list-items');
  const itemButtons = new Map();
  for (const body of bodyList) {
    const item = button(body.name, `body-item ${body.isMoon ? 'moon-item' : ''}`, () =>
      app.onSelectBody(body.id),
    );
    itemButtons.set(body.id, item);
    list.append(item);
  }
  listWrap.append(list);
  hud.append(listWrap);

  // Mobile toggle for the body list.
  const bodiesToggle = button('BODIES ▾', 'bodies-toggle', () => {
    listWrap.classList.toggle('open');
    bodiesToggle.classList.toggle('active', listWrap.classList.contains('open'));
  });
  hud.append(bodiesToggle);

  /* ---------------- time bar ---------------- */
  const timeBar = el('footer', 'time-bar');

  const playBtn = button('❚❚', 'play-btn', () => app.onTogglePlay());

  const speeds = el('div', 'speed-group');
  const speedButtons = SPEED_PRESETS.map((preset, i) => {
    const b = button(preset.label, 'speed-btn', () => app.onSetSpeed(i));
    speeds.append(b);
    return b;
  });

  const dateWrap = el('div', 'sim-date-wrap');
  dateWrap.append(el('div', 'sim-date-label', 'SIMULATED TIME'));
  const dateEl = el('div', 'sim-date', '—');
  dateWrap.append(dateEl);

  // NOW jumps the simulation clock back to the real current date & time.
  const nowBtn = button('● NOW', 'now-btn', () => app.onGoToNow());
  nowBtn.title = 'Jump to the current date and time';

  const dateGroup = el('div', 'date-group');
  dateGroup.append(dateWrap, nowBtn);

  timeBar.append(playBtn, speeds, dateGroup);
  hud.append(timeBar);

  document.body.append(hud);

  /* ---------------- public API ---------------- */
  return {
    setDate(text) {
      dateEl.textContent = text;
    },
    setPlaying(playing) {
      playBtn.textContent = playing ? '❚❚' : '▶';
      playBtn.classList.toggle('paused', !playing);
    },
    setActiveSpeed(index) {
      speedButtons.forEach((b, i) => b.classList.toggle('active', i === index));
    },
    setScaleMode(mode) {
      vizBtn.classList.toggle('active', mode === 'viz');
      trueBtn.classList.toggle('active', mode === 'true');
    },
    setFreeCam(isFree) {
      freeBtn.classList.toggle('active', isFree);
    },
    setActiveBody(id) {
      for (const [bodyId, btn] of itemButtons) {
        btn.classList.toggle('active', bodyId === id);
      }
      // Auto-close the mobile list after a pick.
      listWrap.classList.remove('open');
      bodiesToggle.classList.remove('active');
    },
  };
}
