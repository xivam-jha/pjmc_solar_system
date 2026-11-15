/**
 * Flight HUD & UI Overlays for PJMC Space Explorer.
 *
 * Implements:
 * - Telemetry header (spacecraft ID, speed, boost meter, target distance)
 * - Navigation waypoint 3D-to-2D screen arrow & distance indicator
 * - Cockpit first-person holographic HUD reticle
 * - Mission Selection modal with cards
 * - In-flight Pause menu with quality & sound settings
 * - Mission Accomplished victory dialog
 * - Mobile portrait orientation advisor
 */

import { LESSONS } from './StudentProgress.js';
import { MISSIONS } from './Missions.js';
import { BRAND, getMonogramSvg } from '../config/brand.js';

export class FlightHUD {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.progress = callbacks.progress;
    // callbacks: onResume, onRestart, onSelectMission, onExitExplore, onToggleSound, onToggleQuality

    this.root = document.createElement('div');
    this.root.className = 'pjmc-explorer-ui hidden';
    this.root.id = 'pjmc-explorer-ui';
    this.root.style.display = 'none';

    this.isCockpit = false;
    this.screenPos = { x: 0, y: 0, visible: false, angle: 0, distance: 0 };

    this.buildTelemetryHUD();
    this.buildCockpitOverlay();
    this.buildNavArrow();
    this.buildMissionModal();
    this.buildPauseModal();
    this.buildVictoryModal();
    this.buildPortraitBanner();
    this.tip = document.createElement('div');
    this.tip.className = 'student-flight-tip';
    this.tip.setAttribute('role', 'status');
    this.root.append(this.tip);
    this.buildDiary();

    document.body.appendChild(this.root);
  }

  buildTelemetryHUD() {
    this.telemetryEl = document.createElement('div');
    this.telemetryEl.className = 'pjmc-telemetry-bar';

    this.telemetryEl.innerHTML = `
      <div class="pjmc-hud-left">
        <div class="pjmc-ship-tag">
          ${getMonogramSvg(26, 'pjmc-hud-monogram')}
          <div class="pjmc-ship-tag-details">
            <div class="pjmc-ship-row">
              <span class="pjmc-tag-dot"></span>
              <span class="pjmc-ship-name">${BRAND.spacecraft}</span>
              <span class="pjmc-ship-inst">PJMC STUDENT</span>
            </div>
            <span class="pjmc-ship-status">FLIGHT SYSTEM ONLINE</span>
          </div>
        </div>
        <div class="pjmc-mission-badge" id="pjmc-hud-mission">EARTH ORBIT</div>
      </div>

      <div class="pjmc-hud-center">
        <div class="pjmc-speed-gauge">
          <span class="pjmc-gauge-val" id="pjmc-hud-speed">0</span>
          <span class="pjmc-gauge-unit">GAME u/s</span>
        </div>
        <div class="pjmc-boost-wrap">
          <div class="pjmc-boost-track">
            <div class="pjmc-boost-fill" id="pjmc-hud-boost-fill"></div>
          </div>
          <span class="pjmc-boost-label">BOOST</span>
        </div>
      </div>

      <div class="pjmc-hud-right">
        <div class="pjmc-nav-info">
          <div class="pjmc-target-row">
            <span class="pjmc-label-dim">TARGET:</span>
            <span class="pjmc-target-val" id="pjmc-hud-target">EARTH</span>
          </div>
          <div class="pjmc-dist-row">
            <span class="pjmc-label-dim">DIST:</span>
            <span class="pjmc-dist-val" id="pjmc-hud-dist">0 KM</span>
          </div>
          <div class="pjmc-waypoint-row" id="pjmc-hud-wp-row">
            <span class="pjmc-label-dim">GATE:</span>
            <span class="pjmc-wp-val" id="pjmc-hud-wp">1/5</span>
          </div>
        </div>
        <button type="button" class="pjmc-hud-pause-btn" id="pjmc-hud-pause-btn" title="Pause Game">
          <span>❚❚</span>
        </button>
      </div>
    `;

    this.root.appendChild(this.telemetryEl);

    this.speedValEl = this.telemetryEl.querySelector('#pjmc-hud-speed');
    this.boostFillEl = this.telemetryEl.querySelector('#pjmc-hud-boost-fill');
    this.missionBadgeEl = this.telemetryEl.querySelector('#pjmc-hud-mission');
    this.targetValEl = this.telemetryEl.querySelector('#pjmc-hud-target');
    this.distValEl = this.telemetryEl.querySelector('#pjmc-hud-dist');
    this.wpRowEl = this.telemetryEl.querySelector('#pjmc-hud-wp-row');
    this.wpValEl = this.telemetryEl.querySelector('#pjmc-hud-wp');

    const pauseBtn = this.telemetryEl.querySelector('#pjmc-hud-pause-btn');
    pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onPauseClick?.();
    });
  }

  buildCockpitOverlay() {
    this.cockpitEl = document.createElement('div');
    this.cockpitEl.className = 'pjmc-cockpit-overlay';
    this.cockpitEl.style.display = 'none';

    this.cockpitEl.innerHTML = `
      <div class="pjmc-cockpit-frame">
        <div class="pjmc-cockpit-strut strut-left"></div>
        <div class="pjmc-cockpit-strut strut-right"></div>
        <div class="pjmc-cockpit-glass"></div>
      </div>
      <div class="pjmc-cockpit-reticle">
        <div class="pjmc-reticle-circle"></div>
        <div class="pjmc-reticle-pip"></div>
        <div class="pjmc-horizon-bar left"></div>
        <div class="pjmc-horizon-bar right"></div>
      </div>
      <div class="pjmc-cockpit-footer">
        <span>${BRAND.name} • FLIGHT COMPUTER • HUD ACTIVE</span>
      </div>
    `;

    this.root.appendChild(this.cockpitEl);
  }

  buildNavArrow() {
    this.navArrowEl = document.createElement('div');
    this.navArrowEl.className = 'pjmc-nav-pointer';
    this.navArrowEl.style.display = 'none';

    this.navArrowEl.innerHTML = `
      <div class="pjmc-pointer-arrow">▲</div>
      <div class="pjmc-pointer-dist" id="pjmc-pointer-dist">2.4 AU</div>
    `;

    this.root.appendChild(this.navArrowEl);
    this.navDistEl = this.navArrowEl.querySelector('#pjmc-pointer-dist');
  }

  buildMissionModal() {
    this.missionModalEl = document.createElement('div');
    this.missionModalEl.className = 'pjmc-modal pjmc-mission-select-modal';
    this.missionModalEl.style.display = 'none';

    const cardsHtml = MISSIONS.map(
      (m) => `
      <div class="pjmc-mission-card ${m.id === 'mission_01' ? 'active-card' : ''}" data-id="${m.id}">
        <div class="pjmc-card-header">
          <span class="pjmc-card-num">PJMC ${m.num}</span>
          <span class="pjmc-card-diff diff-${m.difficulty.toLowerCase()}">${m.difficulty}</span>
        </div>
        <h3 class="pjmc-card-title">${m.title}</h3>
        <p class="pjmc-card-desc">${m.desc}</p>
        <div class="pjmc-card-reward">
          <span class="pjmc-badge-icon">🎖</span> ${m.reward}
        </div>
        <button type="button" class="pjmc-select-mission-btn" data-id="${m.id}">
          SELECT MISSION
        </button>
      </div>
    `
    ).join('');

    this.missionModalEl.innerHTML = `
      <div class="pjmc-modal-backdrop"></div>
      <div class="pjmc-modal-window">
        <div class="pjmc-modal-header">
          <div class="pjmc-title-group" style="display: flex; align-items: center; gap: 12px;">
            ${getMonogramSvg(38, 'pjmc-mission-head-logo')}
            <div>
              <span class="pjmc-sub-title">${BRAND.institute}</span>
              <h2 class="pjmc-modal-title">PJMC STUDENT SPACE MISSION CONTROL</h2>
              <span class="pjmc-mission-briefing-label">MISSION BRIEFING • LEARN • EXPLORE • DISCOVER</span>
            </div>
          </div>
          <button type="button" class="pjmc-modal-close-btn" id="pjmc-mission-close">✕</button>
        </div>

        <label class="student-pilot-name">Pilot name <input id="student-pilot-name" maxlength="24" placeholder="Your name" /></label>
        <p id="student-progress-summary"></p>
        <div class="pjmc-mission-grid">
          ${cardsHtml}
        </div>

        <div class="pjmc-modal-footer">
          <button type="button" class="pjmc-btn-secondary" id="pjmc-back-to-solar">
            ← BACK TO SOLAR SYSTEM
          </button>
          <button type="button" class="pjmc-btn-primary" id="pjmc-launch-btn">
            🚀 LAUNCH ${BRAND.spacecraft}
          </button>
        </div>
        <div class="pjmc-mission-footer-signature">A LEARNING EXPERIENCE BY PAWAN JHA MATHEMATICS CLASSES</div>
      </div>
    `;

    this.root.appendChild(this.missionModalEl);

    // Wire clicks
    let selectedMissionId = 'mission_01';
    const nameInput = this.missionModalEl.querySelector('#student-pilot-name');
    nameInput.value = this.progress.data.name;
    nameInput.readOnly = Boolean(this.progress.student);
    if (this.progress.student) nameInput.title = 'PJMC account से सत्यापित नाम';
    nameInput.addEventListener('input', () => {
      if (this.progress.student) return;
      this.progress.data.name = nameInput.value.trim().slice(0, 24) || 'Pilot';
      if (!this.progress.save()) this.showTip('नाम इस सत्र तक रहेगा। ब्राउज़र storage उपलब्ध नहीं है।');
    });
    const cards = this.missionModalEl.querySelectorAll('.pjmc-mission-card');
    cards.forEach((card) => {
      card.addEventListener('click', () => {
        if (card.dataset.locked === 'true') return;
        cards.forEach((c) => c.classList.remove('active-card'));
        card.classList.add('active-card');
        selectedMissionId = card.dataset.id;
      });
    });

    const closeBtn = this.missionModalEl.querySelector('#pjmc-mission-close');
    closeBtn.addEventListener('click', () => this.callbacks.onExitExplore?.());

    const backBtn = this.missionModalEl.querySelector('#pjmc-back-to-solar');
    backBtn.addEventListener('click', () => this.callbacks.onExitExplore?.());

    const launchBtn = this.missionModalEl.querySelector('#pjmc-launch-btn');
    launchBtn.addEventListener('click', () => {
      this.closeMissionModal();
      this.callbacks.onSelectMission?.(selectedMissionId);
    });
  }

  buildPauseModal() {
    this.pauseModalEl = document.createElement('div');
    this.pauseModalEl.className = 'pjmc-modal pjmc-pause-modal';
    this.pauseModalEl.style.display = 'none';

    this.pauseModalEl.innerHTML = `
      <div class="pjmc-modal-backdrop"></div>
      <div class="pjmc-modal-window small">
        <div class="pjmc-modal-header" style="display: flex; align-items: center; gap: 12px;">
          ${getMonogramSvg(30, 'pjmc-pause-head-logo')}
          <div>
            <span class="pjmc-sub-title">${BRAND.institute}</span>
            <h2 class="pjmc-modal-title">${BRAND.name} • FLIGHT PAUSED</h2>
          </div>
        </div>

        <div class="pjmc-pause-options">
          <button type="button" class="pjmc-btn-primary" id="pjmc-pause-resume">
            ▶ RESUME FLIGHT
          </button>
          <button type="button" class="pjmc-btn-secondary" id="pjmc-pause-restart">
            ↺ RESTART MISSION
          </button>
          <button type="button" class="pjmc-btn-secondary" id="pjmc-pause-settings">
            ⚙ FLIGHT CONTROLS SETTINGS
          </button>

          <div class="pjmc-settings-row">
            <span class="pjmc-opt-label">SOUND FX</span>
            <button type="button" class="pjmc-opt-toggle active" id="pjmc-sound-toggle">ON</button>
          </div>

          <div class="pjmc-settings-row">
            <span class="pjmc-opt-label">GRAPHICS QUALITY</span>
            <button type="button" class="pjmc-opt-toggle" id="pjmc-quality-toggle">HIGH</button>
          </div>

          <button type="button" class="pjmc-btn-secondary" id="student-camera">Switch camera</button>
          <button type="button" class="pjmc-btn-secondary" id="student-photo">Take photo</button>
          <button type="button" class="pjmc-btn-secondary" id="student-diary">Space Diary & Jet colors</button>
          <button type="button" class="pjmc-btn-danger" id="pjmc-pause-exit">
            EXIT TO SOLAR SYSTEM
          </button>
        </div>

        <div class="pjmc-controls-reminder">
          <strong>CONTROLS:</strong> W/S Speed • A/D Turn • R/F Up/Down • SPACE Brake • C Camera • ESC Pause
        </div>
        <div class="pjmc-pause-footer-inst">${BRAND.product} • ${BRAND.spacecraft}</div>
      </div>
    `;

    this.root.appendChild(this.pauseModalEl);

    this.pauseModalEl.querySelector('#student-camera').addEventListener('click', () => {
      this.callbacks.onCameraToggle?.(); this.callbacks.onResume?.();
    });
    this.pauseModalEl.querySelector('#student-photo').addEventListener('click', () => this.callbacks.onPhoto?.());
    this.pauseModalEl.querySelector('#student-diary').addEventListener('click', () => this.openDiary());
    const resumeBtn = this.pauseModalEl.querySelector('#pjmc-pause-resume');
    resumeBtn.addEventListener('click', () => this.callbacks.onResume?.());

    const restartBtn = this.pauseModalEl.querySelector('#pjmc-pause-restart');
    restartBtn.addEventListener('click', () => this.callbacks.onRestart?.());

    const settingsBtn = this.pauseModalEl.querySelector('#pjmc-pause-settings');
    settingsBtn.addEventListener('click', () => this.callbacks.onOpenSettings?.());

    const exitBtn = this.pauseModalEl.querySelector('#pjmc-pause-exit');
    exitBtn.addEventListener('click', () => this.callbacks.onExitExplore?.());

    const soundToggle = this.pauseModalEl.querySelector('#pjmc-sound-toggle');
    let soundOn = true;
    soundToggle.addEventListener('click', () => {
      soundOn = !soundOn;
      soundToggle.textContent = soundOn ? 'ON' : 'MUTED';
      soundToggle.classList.toggle('active', soundOn);
      this.callbacks.onToggleSound?.(soundOn);
    });

    const qualToggle = this.pauseModalEl.querySelector('#pjmc-quality-toggle');
    const qualities = ['HIGH', 'MED', 'LOW'];
    let qualIdx = 0;
    qualToggle.addEventListener('click', () => {
      qualIdx = (qualIdx + 1) % qualities.length;
      qualToggle.textContent = qualities[qualIdx];
      this.callbacks.onToggleQuality?.(qualities[qualIdx]);
    });
  }

  buildVictoryModal() {
    this.victoryModalEl = document.createElement('div');
    this.victoryModalEl.className = 'pjmc-modal pjmc-victory-modal';
    this.victoryModalEl.style.display = 'none';

    this.victoryModalEl.innerHTML = `
      <div class="pjmc-modal-backdrop"></div>
      <div class="pjmc-modal-window">
        <div class="pjmc-victory-logo-wrap" style="display: flex; justify-content: center; margin-bottom: 8px;">
          ${getMonogramSvg(44, 'pjmc-vic-logo')}
        </div>
        <div class="pjmc-victory-brand-lead">${BRAND.name}</div>
        <div class="pjmc-victory-badge">★ ★ ★</div>
        <h2 class="pjmc-victory-title">MISSION ACCOMPLISHED!</h2>
        <div class="pjmc-victory-cert-badge">PJMC SPACE PILOT</div>
        <div class="pjmc-victory-sub" id="pjmc-vic-name">EARTH ORBIT CHALLENGE COMPLETE</div>

        <div class="pjmc-stats-grid">
          <div class="pjmc-stat-box">
            <span class="pjmc-stat-label">TIME</span>
            <span class="pjmc-stat-value" id="pjmc-vic-time">00:45s</span>
          </div>
          <div class="pjmc-stat-box">
            <span class="pjmc-stat-label">PILOT STATUS</span>
            <span class="pjmc-stat-value highlight" id="student-pilot-badge"></span>
          </div>
        </div>

        <div id="student-lesson"></div>
        <div class="pjmc-modal-footer">
          <button type="button" class="pjmc-btn-secondary" id="pjmc-vic-free">
            FREE FLIGHT
          </button>
          <button type="button" class="pjmc-btn-primary" id="pjmc-vic-next">
            NEXT MISSION →
          </button>
        </div>
        <div class="pjmc-victory-footer-note">POWERED BY PAWAN JHA MATHEMATICS CLASSES</div>
      </div>
    `;

    this.root.appendChild(this.victoryModalEl);

    const freeBtn = this.victoryModalEl.querySelector('#pjmc-vic-free');
    freeBtn.addEventListener('click', () => {
      this.hideVictoryModal();
      this.callbacks.onSelectMission?.('free_flight');
    });

    const nextBtn = this.victoryModalEl.querySelector('#pjmc-vic-next');
    nextBtn.addEventListener('click', () => {
      this.hideVictoryModal();
      this.callbacks.onNextMission?.();
    });
  }

  showTip(message) {
    this.tip.textContent = message;
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => { this.tip.textContent = ''; }, 7000);
  }

  buildDiary() {
    this.diaryModal = document.createElement('div');
    this.diaryModal.className = 'pjmc-modal student-diary';
    this.diaryModal.style.display = 'none';
    this.diaryModal.innerHTML = `<div class="pjmc-modal-window"><h2>Space Diary</h2><p>इस ब्राउज़र में आपकी अंतिम 8 तस्वीरें सेव रहेंगी।</p><div class="student-badges"></div><div class="student-paints"></div><div class="student-photos"></div><button type="button" class="pjmc-btn-secondary">Close</button></div>`;
    this.diaryModal.querySelector('button').addEventListener('click', () => { this.diaryModal.style.display = 'none'; });
    this.root.append(this.diaryModal);
  }

  openDiary() {
    this.diaryModal.querySelector('.student-badges').textContent = `${this.progress.data.name} • ${this.progress.stars} ★ • ${Object.keys(this.progress.data.badges).map(id => MISSIONS.find(m => m.id === id)?.reward).join(' · ') || 'पहले मिशन से अपना पहला बैज पाएँ'}`;
    const paints = this.diaryModal.querySelector('.student-paints'); paints.replaceChildren();
    [['Silver', '#ecf2f8', 0], ['Gold', '#f4b942', 3], ['Violet', '#ad8cff', 6]].forEach(([name, color, stars]) => {
      const button = document.createElement('button'); button.className = 'pjmc-btn-secondary'; button.textContent = `${name} • ${stars} ★`;
      button.disabled = this.progress.stars < stars;
      button.addEventListener('click', () => {
        this.progress.data.color = color;
        const saved = this.progress.save();
        this.callbacks.onColor?.(color);
        this.showTip(saved ? `${name} रंग चुना गया।` : 'रंग इस सत्र तक रहेगा।');
      }); paints.append(button);
    });
    const photos = this.diaryModal.querySelector('.student-photos'); photos.replaceChildren();
    if (!this.progress.data.photos.length) photos.textContent = 'Pause → Take photo से पहली तस्वीर जोड़ें।';
    for (const photo of this.progress.data.photos) {
      const figure = document.createElement('figure'); const img = document.createElement('img');
      img.src = photo.image; img.alt = photo.title; const caption = document.createElement('figcaption'); caption.textContent = photo.title;
      figure.append(img, caption); photos.append(figure);
    }
    this.diaryModal.style.display = 'flex';
  }

  buildPortraitBanner() {
    this.portraitBanner = document.createElement('div');
    this.portraitBanner.className = 'pjmc-portrait-hint';
    this.portraitBanner.innerHTML = `
      <span class="pjmc-rotate-icon">📱 ↺</span>
      <span>Rotate to <strong>Landscape</strong> for optimal space flight controls</span>
      <button type="button" class="pjmc-hint-dismiss">✕</button>
    `;
    this.root.appendChild(this.portraitBanner);

    const dismiss = this.portraitBanner.querySelector('.pjmc-hint-dismiss');
    dismiss.addEventListener('click', () => {
      this.portraitBanner.style.display = 'none';
    });

    window.addEventListener('resize', () => this.checkOrientation());
    this.checkOrientation();
  }

  checkOrientation() {
    const isPortrait = window.innerHeight > window.innerWidth && window.innerWidth < 800;
    this.portraitBanner.style.display = isPortrait ? 'flex' : 'none';
  }

  show() {
    this.root.style.display = 'block';
    this.root.classList.add('active');
    this.root.classList.remove('hidden');
  }

  hide() {
    this.root.style.display = 'none';
    this.root.classList.remove('active');
    this.root.classList.add('hidden');
    this.closeMissionModal();
    this.hidePauseModal();
    this.hideVictoryModal();
    this.diaryModal.style.display = 'none';
  }

  openMissionModal() {
    this.missionModalEl.querySelector('#student-progress-summary').textContent = `${this.progress.stars} ★ • मिशन पूरा करके नए सफ़र और जेट के रंग खोलें`;
    this.missionModalEl.querySelectorAll('.pjmc-mission-card').forEach((card, index) => {
      const unlocked = this.progress.unlocked(index);
      card.dataset.locked = String(!unlocked);
      const button = card.querySelector('button');
      button.disabled = !unlocked;
      button.textContent = unlocked ? 'SELECT MISSION' : 'पहला मिशन पूरा करें';
    });
    this.show();
    this.missionModalEl.style.display = 'flex';
    this.telemetryEl.style.display = 'none';
    this.navArrowEl.style.display = 'none';
  }

  closeMissionModal() {
    this.missionModalEl.style.display = 'none';
    this.telemetryEl.style.display = 'flex';
  }

  showPauseModal() {
    this.pauseModalEl.style.display = 'flex';
  }

  hidePauseModal() {
    this.pauseModalEl.style.display = 'none';
  }

  showVictoryModal(mission, elapsedSec) {
    const vicName = this.victoryModalEl.querySelector('#pjmc-vic-name');
    const vicTime = this.victoryModalEl.querySelector('#pjmc-vic-time');

    vicName.textContent = `${mission.title.toUpperCase()} COMPLETED`;
    const mins = Math.floor(elapsedSec / 60);
    const secs = Math.floor(elapsedSec % 60);
    vicTime.textContent = `${mins > 0 ? mins + 'm ' : ''}${secs}s`;

    this.victoryModalEl.querySelector('#student-pilot-badge').textContent = this.progress.data.name;
    const badge = this.victoryModalEl.querySelector('.pjmc-victory-badge');
    badge.textContent = mission.reward;
    const nextButton = this.victoryModalEl.querySelector('#pjmc-vic-next');
    nextButton.disabled = !this.progress.data.badges[mission.id];
    const lesson = LESSONS[mission.id];
    const container = this.victoryModalEl.querySelector('#student-lesson');
    container.replaceChildren();
    if (lesson) {
      const fact = document.createElement('p'); fact.textContent = lesson.fact;
      const question = document.createElement('p'); question.textContent = lesson.question;
      const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
      container.append(fact, question);
      lesson.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'pjmc-btn-secondary'; button.textContent = answer;
        button.addEventListener('click', () => {
          if (index !== lesson.correct) {
            feedback.textContent = 'ऊपर दी गई जानकारी पढ़कर फिर कोशिश करें।'; return;
          }
          const saved = this.progress.award(mission.id);
          feedback.textContent = saved ? `सही जवाब! 3 ★ और ${mission.reward} मिल गया।` : 'सही जवाब! बैज इस सत्र में उपलब्ध है, ब्राउज़र में सेव नहीं हो सका।';
          if (this.progress.student) {
            feedback.textContent += ' Online record सेव हो रहा है…';
            this.progress.syncOnline().then(ok => {
              feedback.textContent = ok ? 'सही जवाब! आपका online record सेव हो गया। 3 ★' : 'बैज मिला। Online save बाकी है; internet आने पर जवाब फिर दबाएँ या गेम दोबारा खोलें।';
            });
          }
          badge.textContent = `★ ★ ★  ${mission.reward}`;
          nextButton.disabled = false;
        });
        container.append(button);
      });
      const source = document.createElement('a'); source.href = lesson.source; source.textContent = 'NASA पर पढ़ें'; source.target = '_blank'; source.rel = 'noopener';
      container.append(feedback, source);
    }
    this.victoryModalEl.style.display = 'flex';
  }

  hideVictoryModal() {
    this.victoryModalEl.style.display = 'none';
  }

  setCockpitMode(isCockpit) {
    this.isCockpit = isCockpit;
    this.cockpitEl.style.display = isCockpit ? 'block' : 'none';
  }

  updateTelemetry({
    speed = 0,
    boostPercent = 100,
    missionTitle = 'EARTH ORBIT',
    targetName = 'EARTH',
    targetDistance = 0,
    waypointCurrent = 1,
    waypointTotal = 5,
    isFreeFlight = false,
  }) {
    this.speedValEl.textContent = Math.round(speed).toString();
    this.boostFillEl.style.width = `${Math.max(0, Math.min(100, boostPercent))}%`;
    this.missionBadgeEl.textContent = missionTitle.toUpperCase();
    this.targetValEl.textContent = targetName.toUpperCase();

    this.distValEl.textContent = `${targetDistance.toFixed(1)} u`;

    if (isFreeFlight) {
      this.wpRowEl.style.display = 'none';
    } else {
      this.wpRowEl.style.display = 'flex';
      this.wpValEl.textContent = `${waypointCurrent}/${waypointTotal}`;
    }
  }

  updateNavArrow(screenX, screenY, distanceText, visible) {
    if (!visible) {
      this.navArrowEl.style.display = 'none';
      return;
    }

    this.navArrowEl.style.display = 'flex';
    this.navArrowEl.style.left = `${screenX}px`;
    this.navArrowEl.style.top = `${screenY}px`;
    this.navDistEl.textContent = distanceText;
  }

  destroy() {
    this.root.remove();
  }
}
