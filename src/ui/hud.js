/** Responsive DOM HUD for PJMC Solar System Explorer. */
import { SPEED_PRESETS } from '../data/celestialBodies.js';
import { BODY_NAMES_HI, UI_TEXT, bodyName } from './translations.js';

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

export function createHUD(app, bodyList) {
  let language = 'en';
  let lastSearchMatches = [];
  const words = () => UI_TEXT[language];
  const hud = el('div', 'hud');

  const top = el('header', 'top-bar');
  const brand = el('div', 'app-title');
  const brandMark = el('div', 'brand-mark', 'P');
  const brandCopy = el('div', 'brand-copy');
  const titleLine = el('div', 'brand-title-line');
  const titleMain = el('span', 'title-main', 'PJMC');
  const titleSub = el('span', 'title-sub', 'SOLAR SYSTEM');
  titleLine.append(titleMain, titleSub);
  const titleTagline = el('div', 'title-tagline', 'INTERACTIVE 3D EXPLORER');
  brandCopy.append(titleLine, titleTagline);
  brand.append(brandMark, brandCopy);

  const searchWrap = el('div', 'planet-search-wrap');
  const searchIcon = el('span', 'search-icon', '⌕');
  const searchInput = el('input', 'planet-search');
  searchInput.type = 'search';
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.setAttribute('aria-label', 'Search planets and moons');
  const searchResults = el('div', 'search-results');
  searchResults.hidden = true;
  searchWrap.append(searchIcon, searchInput, searchResults);

  const controls = el('div', 'view-controls');
  const scaleGroup = el('div', 'btn-group');
  const vizBtn = button('', 'scale-btn active', () => app.onSetScaleMode('viz'));
  const trueBtn = button('', 'scale-btn', () => app.onSetScaleMode('true'));
  scaleGroup.append(vizBtn, trueBtn);

  let orbitsOn = true;
  let labelsOn = true;
  const orbitsBtn = button('', 'toggle-btn active', () => {
    orbitsOn = !orbitsOn;
    orbitsBtn.classList.toggle('active', orbitsOn);
    app.onToggleOrbits(orbitsOn);
  });
  const labelsBtn = button('', 'toggle-btn active', () => {
    labelsOn = !labelsOn;
    labelsBtn.classList.toggle('active', labelsOn);
    app.onToggleLabels(labelsOn);
  });
  const freeBtn = button('', 'action-btn active', () => app.onFreeCamera());
  const resetBtn = button('', 'action-btn', () => app.onResetView());
  const languageBtn = button('हिंदी', 'language-btn', () => {
    language = language === 'en' ? 'hi' : 'en';
    applyLanguage();
    app.onLanguageChange?.(language);
  });
  const spacecraftBtn = button('🚀 SPACECRAFT', 'spacecraft-btn', () => app.onSpacecraftToggle?.());
  spacecraftBtn.setAttribute('aria-label', 'Enter or exit PJMC SPACE EXPLORER flight mode');

  // Large animated mobile launch button, kept separate from the crowded top toolbar.
  const mobileRocketBtn = el('button', 'mobile-spacecraft-launch');
  mobileRocketBtn.type = 'button';
  mobileRocketBtn.setAttribute('aria-label', 'Launch PJMC SPACE EXPLORER');
  mobileRocketBtn.innerHTML = '<span class="mobile-rocket-orbit" aria-hidden="true"></span><span class="mobile-rocket-icon" aria-hidden="true">🚀</span><span class="mobile-rocket-flame" aria-hidden="true"></span><span class="mobile-rocket-label">SPACE EXPLORER</span><span class="mobile-rocket-subtitle">TAP TO LAUNCH</span>';
  mobileRocketBtn.addEventListener('click', () => app.onSpacecraftToggle?.());

  controls.append(scaleGroup, orbitsBtn, labelsBtn, freeBtn, resetBtn, languageBtn, spacecraftBtn);
  top.append(brand, searchWrap, controls);
  hud.append(top, mobileRocketBtn);

  const listWrap = el('aside', 'body-list');
  const listHeading = el('div', 'panel-heading');
  const list = el('div', 'body-list-items');
  const itemButtons = new Map();
  const bodyById = new Map(bodyList.map((b) => [b.id, b]));
  for (const body of bodyList) {
    const item = button(body.name, `body-item ${body.isMoon ? 'moon-item' : ''}`, () => app.onSelectBody(body.id));
    itemButtons.set(body.id, item);
    list.append(item);
  }
  listWrap.append(listHeading, list);
  hud.append(listWrap);

  const bodiesToggle = button('', 'bodies-toggle', () => {
    listWrap.classList.toggle('open');
    bodiesToggle.classList.toggle('active', listWrap.classList.contains('open'));
  });
  hud.append(bodiesToggle);

  const timeBar = el('footer', 'time-bar');
  const playBtn = button('❚❚', 'play-btn', () => app.onTogglePlay());
  const speeds = el('div', 'speed-group');
  const speedButtons = SPEED_PRESETS.map((preset, i) => {
    const b = button(preset.label, 'speed-btn', () => app.onSetSpeed(i));
    speeds.append(b);
    return b;
  });
  const dateWrap = el('div', 'sim-date-wrap');
  const dateLabel = el('div', 'sim-date-label');
  const dateEl = el('div', 'sim-date', '—');
  dateWrap.append(dateLabel, dateEl);
  const nowBtn = button('● NOW', 'now-btn', () => app.onGoToNow());
  nowBtn.title = 'Jump to the current date and time (IST)';
  const dateGroup = el('div', 'date-group');
  dateGroup.append(dateWrap, nowBtn);
  timeBar.append(playBtn, speeds, dateGroup);
  hud.append(timeBar);

  const brandFooter = el('div', 'brand-footer');
  const footerTitle = el('div', 'brand-footer-title');
  const footerSubtitle = el('div', 'brand-footer-subtitle');
  brandFooter.append(footerTitle, footerSubtitle);
  hud.append(brandFooter);
  document.body.append(hud);

  function matchingBodies(query) {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return [];
    return bodyList.filter((body) => {
      const hindi = BODY_NAMES_HI[body.id] ?? '';
      return body.name.toLocaleLowerCase().includes(q) || hindi.toLocaleLowerCase().includes(q) || body.id.toLocaleLowerCase().includes(q);
    }).slice(0, 7);
  }

  function chooseSearchResult(id) {
    const body = bodyById.get(id);
    if (!body) return;
    searchInput.value = bodyName(body.id, body.name, language);
    searchResults.hidden = true;
    app.onSelectBody(id);
  }

  function renderSearchResults() {
    lastSearchMatches = matchingBodies(searchInput.value);
    searchResults.replaceChildren();
    if (!searchInput.value.trim()) {
      searchResults.hidden = true;
      return;
    }
    if (lastSearchMatches.length === 0) {
      searchResults.append(el('div', 'search-empty', words().searchEmpty));
    } else {
      for (const body of lastSearchMatches) {
        const item = el('button', 'search-result');
        item.type = 'button';
        const name = el('span', 'search-result-name', bodyName(body.id, body.name, language));
        const secondary = el('span', 'search-result-secondary', body.name);
        item.append(name, secondary);
        item.addEventListener('click', () => chooseSearchResult(body.id));
        searchResults.append(item);
      }
    }
    searchResults.hidden = false;
  }

  searchInput.addEventListener('input', renderSearchResults);
  searchInput.addEventListener('focus', renderSearchResults);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      if (lastSearchMatches[0]) chooseSearchResult(lastSearchMatches[0].id);
    } else if (event.key === 'Escape') {
      searchInput.value = '';
      searchResults.hidden = true;
      searchInput.blur();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!searchWrap.contains(event.target)) searchResults.hidden = true;
  });

  function applyLanguage() {
    const t = words();
    document.documentElement.lang = language === 'hi' ? 'hi' : 'en';
    titleMain.textContent = t.title;
    titleSub.textContent = t.subtitle;
    titleTagline.textContent = t.created.toUpperCase();
    vizBtn.textContent = t.visualization;
    trueBtn.textContent = t.trueScale;
    orbitsBtn.textContent = t.orbits;
    labelsBtn.textContent = t.labels;
    freeBtn.textContent = t.freeCam;
    resetBtn.textContent = t.resetView;
    listHeading.textContent = t.bodies;
    bodiesToggle.textContent = language === 'hi' ? 'पिंड ▾' : 'BODIES ▾';
    dateLabel.textContent = t.simulatedTime;
    nowBtn.textContent = t.now;
    languageBtn.textContent = language === 'en' ? 'हिंदी' : 'ENGLISH';
    searchInput.placeholder = t.search;
    searchInput.setAttribute('aria-label', t.search);
    speedButtons.forEach((b, i) => { b.textContent = t.speeds[i] ?? SPEED_PRESETS[i].label; });
    for (const body of bodyList) itemButtons.get(body.id).textContent = bodyName(body.id, body.name, language);
    footerTitle.textContent = t.about;
    footerSubtitle.textContent = t.school;
    if (!searchResults.hidden) renderSearchResults();
  }

  applyLanguage();
  return {
    setDate(text) { dateEl.textContent = text; },
    setPlaying(playing) {
      playBtn.textContent = playing ? '❚❚' : '▶';
      playBtn.classList.toggle('paused', !playing);
      playBtn.setAttribute('aria-label', playing ? 'Pause simulation' : 'Resume simulation');
    },
    setActiveSpeed(index) { speedButtons.forEach((b, i) => b.classList.toggle('active', i === index)); },
    setScaleMode(mode) {
      vizBtn.classList.toggle('active', mode === 'viz');
      trueBtn.classList.toggle('active', mode === 'true');
    },
    setFreeCam(isFree) { freeBtn.classList.toggle('active', isFree); },
    setSpacecraftActive(active) {
      spacecraftBtn.classList.toggle('active', active);
      spacecraftBtn.textContent = active ? '↩ EXIT FLIGHT' : '🚀 SPACECRAFT';
      spacecraftBtn.setAttribute('aria-pressed', String(active));
      mobileRocketBtn.classList.toggle('is-active', active);
      mobileRocketBtn.setAttribute('aria-pressed', String(active));
      mobileRocketBtn.setAttribute('aria-label', active ? 'Exit PJMC SPACE EXPLORER flight mode' : 'Launch PJMC SPACE EXPLORER');
      const label = mobileRocketBtn.querySelector('.mobile-rocket-label');
      const subtitle = mobileRocketBtn.querySelector('.mobile-rocket-subtitle');
      if (label) label.textContent = active ? 'FLIGHT ACTIVE' : 'SPACE EXPLORER';
      if (subtitle) subtitle.textContent = active ? 'TAP TO RETURN' : 'TAP TO LAUNCH';
    },
    setActiveBody(id) {
      for (const [bodyId, btn] of itemButtons) btn.classList.toggle('active', bodyId === id);
      listWrap.classList.remove('open');
      bodiesToggle.classList.remove('active');
    },
    getLanguage() { return language; },
  };
}
