/** Mission-control HUD with body search and a live English/Hindi switch. */
import { SPEED_PRESETS } from '../data/celestialBodies.js';
import { bodyName, UI_TEXT, uiText } from './i18n.js';

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

const SPEED_KEYS = ['realtime', 'hourPerSecond', 'dayPerSecond', 'monthPerSecond', 'yearPerSecond'];

/**
 * @param {object} app callbacks into main.js
 * @param {Array} bodyList flat [{id, name, hiName, isMoon}]
 */
export function createHUD(app, bodyList) {
  const hud = el('div', 'hud');
  let language = 'en';

  /* ---------------- top bar ---------------- */
  const top = el('header', 'top-bar');
  const title = el('div', 'app-title');
  const titleMain = el('span', 'title-main', 'SOLAR SYSTEM');
  const titleSub = el('span', 'title-sub', 'EXPLORER');
  title.append(titleMain, titleSub);
  top.append(title);

  const viewControls = el('div', 'view-controls');
  const languageBtn = button(uiText('languageButton'), 'language-btn', () => {
    setLanguage(language === 'en' ? 'hi' : 'en');
    app.onSetLanguage?.(language);
  });
  languageBtn.title = 'Switch interface language';

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
  const freeBtn = button('FREE CAM', 'action-btn active', () => app.onFreeCamera());
  const resetBtn = button('RESET VIEW', 'action-btn', () => app.onResetView());

  viewControls.append(languageBtn, scaleGroup, orbitsBtn, labelsBtn, freeBtn, resetBtn);
  top.append(viewControls);
  hud.append(top);

  /* ---------------- searchable body selector ---------------- */
  const listWrap = el('aside', 'body-list');
  const bodyHeading = el('div', 'panel-heading', 'BODIES');
  const searchWrap = el('div', 'body-search-wrap');
  const searchInput = el('input', 'body-search');
  searchInput.type = 'search';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.setAttribute('aria-label', uiText('searchAria'));
  searchInput.placeholder = uiText('searchPlaceholder');
  searchWrap.append(searchInput);
  const list = el('div', 'body-list-items');
  const noResults = el('div', 'body-no-results', uiText('noResults'));
  noResults.hidden = true;
  const itemButtons = new Map();
  const itemRows = new Map();

  for (const body of bodyList) {
    const item = button(bodyName(body.id, body.name, language), `body-item ${body.isMoon ? 'moon-item' : ''}`, () => {
      searchInput.value = '';
      renderFilter();
      app.onSelectBody(body.id);
    });
    itemButtons.set(body.id, item);
    itemRows.set(body.id, { body, item });
    list.append(item);
  }
  list.append(noResults);
  listWrap.append(bodyHeading, searchWrap, list);
  hud.append(listWrap);

  function renderFilter() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const { body, item } of itemRows.values()) {
      const haystack = `${body.name} ${body.hiName ?? ''} ${body.id}`.toLocaleLowerCase();
      const match = !query || haystack.includes(query);
      item.hidden = !match;
      if (match) visible++;
    }
    noResults.hidden = visible !== 0;
  }
  searchInput.addEventListener('input', renderFilter);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const first = [...itemRows.values()].find(({ item }) => !item.hidden);
    if (first) {
      searchInput.value = '';
      renderFilter();
      app.onSelectBody(first.body.id);
    }
  });

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
  const dateLabel = el('div', 'sim-date-label', 'SIMULATION TIME');
  const dateEl = el('div', 'sim-date', '—');
  dateWrap.append(dateLabel, dateEl);
  const nowBtn = button('● NOW', 'now-btn', () => app.onGoToNow());
  nowBtn.title = uiText('nowTitle');
  const dateGroup = el('div', 'date-group');
  dateGroup.append(dateWrap, nowBtn);
  timeBar.append(playBtn, speeds, dateGroup);
  hud.append(timeBar);
  document.body.append(hud);

  function setLanguage(nextLanguage) {
    language = nextLanguage === 'hi' ? 'hi' : 'en';
    document.documentElement.lang = language;
    const t = (key) => uiText(key, language);
    titleMain.textContent = t('solarSystem');
    titleSub.textContent = t('explorer');
    languageBtn.textContent = t('languageButton');
    languageBtn.title = language === 'en' ? 'Switch interface to Hindi' : 'Switch interface to English';
    vizBtn.textContent = t('visualization');
    trueBtn.textContent = t('trueScale');
    orbitsBtn.textContent = t('orbits');
    labelsBtn.textContent = t('labels');
    freeBtn.textContent = t('freeCamera');
    resetBtn.textContent = t('resetView');
    bodyHeading.textContent = t('bodies');
    bodiesToggle.textContent = `${t('bodies')} ▾`;
    searchInput.placeholder = t('searchPlaceholder');
    searchInput.setAttribute('aria-label', t('searchAria'));
    noResults.textContent = t('noResults');
    dateLabel.textContent = t('simulatedTime');
    nowBtn.textContent = t('now');
    nowBtn.title = t('nowTitle');
    speedButtons.forEach((b, i) => { b.textContent = t(SPEED_KEYS[i]); });
    for (const { body, item } of itemRows.values()) {
      item.textContent = bodyName(body.id, body.name, language);
    }
    renderFilter();
  }

  return {
    setDate(text) { dateEl.textContent = text; },
    setPlaying(playing) {
      playBtn.textContent = playing ? '❚❚' : '▶';
      playBtn.classList.toggle('paused', !playing);
      playBtn.setAttribute('aria-label', playing ? 'Pause simulation' : 'Play simulation');
    },
    setActiveSpeed(index) {
      speedButtons.forEach((b, i) => b.classList.toggle('active', i === index));
    },
    setScaleMode(mode) {
      vizBtn.classList.toggle('active', mode === 'viz');
      trueBtn.classList.toggle('active', mode === 'true');
    },
    setFreeCam(isFree) { freeBtn.classList.toggle('active', isFree); },
    setActiveBody(id) {
      for (const [bodyId, btn] of itemButtons) btn.classList.toggle('active', bodyId === id);
      listWrap.classList.remove('open');
      bodiesToggle.classList.remove('active');
    },
    setLanguage,
    getLanguage() { return language; },
  };
}
