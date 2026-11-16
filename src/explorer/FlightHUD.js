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
import { FLIGHT_SKINS } from './FlightRewards.js';
import { MISSIONS } from './Missions.js';
import { BRAND, getMonogramSvg } from '../config/brand.js';

const ASSET_BASE = import.meta.env?.BASE_URL || '/';

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
    this.buildMeteorHUD();
    this.buildChallengeHUD();
    this.buildTrainingComplete();
    this.tip = document.createElement('div');
    this.tip.className = 'student-flight-tip';
    this.tip.setAttribute('role', 'status');
    this.root.append(this.tip);
    this.buildDiary();

    document.body.appendChild(this.root);
  }

  buildMeteorHUD() {
    this.meteorPanel=document.createElement('div');this.meteorPanel.className='meteor-health glass';
    this.meteorPanel.innerHTML='<div class="meteor-health-heading"><span>HULL HEALTH</span><strong>100</strong></div><progress max="100" value="100" aria-label="Jet health"></progress><span class="meteor-status" role="status">Ready to fly</span>';
    this.meteorPanel.hidden=true;this.root.append(this.meteorPanel);
    this.meteorMarker=document.createElement('div');this.meteorMarker.className='meteor-danger-marker';this.meteorMarker.textContent='!';this.meteorMarker.hidden=true;this.root.append(this.meteorMarker);
    this.meteorFailure=document.createElement('div');this.meteorFailure.className='pjmc-modal meteor-failure';this.meteorFailure.style.display='none';
    this.meteorFailure.innerHTML='<div class="pjmc-modal-backdrop"></div><div class="pjmc-modal-window small" role="dialog" aria-modal="true" aria-label="Jet disabled"><span class="pjmc-sub-title">MISSION RECOVERY</span><h2 class="pjmc-modal-title">Jet disabled</h2><p>Health खत्म हो गई। आपका collected Gold सुरक्षित है।</p><button class="pjmc-btn-primary meteor-retry" type="button">Checkpoint से फिर कोशिश करें</button><button class="pjmc-btn-secondary meteor-exit" type="button">Solar System में वापस</button></div>';
    this.meteorFailure.querySelector('.meteor-retry').onclick=()=>this.callbacks.onRetryMeteor?.();
    this.meteorFailure.querySelector('.meteor-exit').onclick=()=>this.callbacks.onExitExplore?.();this.root.append(this.meteorFailure);
  }
  updateMeteorHUD(challenge,camera) {
    this.meteorPanel.hidden=challenge.phase==='idle';
    this.meteorPanel.querySelector('strong').textContent=challenge.health;
    this.meteorPanel.querySelector('progress').value=challenge.health;
    this.meteorPanel.classList.toggle('low',challenge.health<=30);
    const text=challenge.phase==='warning' ? `⚠ Meteor shower in ${Math.max(1,Math.ceil(challenge.timer))}…` : challenge.phase==='active' ? `Dodge meteors • ${Math.max(0,Math.ceil(challenge.timer))}s${challenge.shield?' • SHIELD ON':''}` : challenge.phase==='complete' ? 'Meteor zone cleared ✓' : 'Hull secure';
    const status=this.meteorPanel.querySelector('.meteor-status');if(status.textContent!==text)status.textContent=text;
    this.root.classList.toggle('meteor-impact',challenge.phase==='active' && challenge.impactTime>0);
    if(challenge.phase==='warning'||challenge.phase==='active')this.portraitBanner.style.display='none';
    const target=challenge.warningTarget();this.meteorMarker.hidden=!target;
    if(target){
      const screen=target.clone().project(camera);
      this.meteorMarker.hidden=screen.z>1||screen.z< -1;
      this.meteorMarker.style.left=`${Math.max(24,Math.min(window.innerWidth-24,(screen.x*.5+.5)*window.innerWidth))}px`;
      this.meteorMarker.style.top=`${Math.max(100,Math.min(window.innerHeight-100,(-screen.y*.5+.5)*window.innerHeight))}px`;
    }
  }
  showMeteorFailure({ reason = 'Health खत्म हो गई। आपका collected Gold सुरक्षित है।', retry = 'Checkpoint से फिर कोशिश करें', title = 'Jet disabled' } = {}) {
    this.meteorFailure.querySelector('h2').textContent = title;
    this.meteorFailure.querySelector('p').textContent = reason;
    this.meteorFailure.querySelector('.meteor-retry').textContent = retry;
    this.meteorFailure.style.display = 'flex'; this.meteorMarker.hidden = true;
    this.meteorFailure.querySelector('.meteor-retry').focus();
  }
  hideMeteorFailure(){this.meteorFailure.style.display='none';this.meteorPanel.hidden=true;this.meteorMarker.hidden=true;this.root.classList.remove('meteor-impact');}

  buildChallengeHUD() {
    this.challengePanel = document.createElement('section');
    this.challengePanel.className = 'challenge-panel'; this.challengePanel.hidden = true;
    this.challengePanel.setAttribute('aria-label', 'Challenge objective');
    this.challengePanel.innerHTML = `
      <div class="challenge-eyebrow"><span>FLIGHT OBJECTIVE <b class="challenge-step"></b></span><span class="challenge-clock"></span></div>
      <h3 class="challenge-title"></h3><p class="challenge-instruction" role="status"></p>
      <div class="challenge-meter"><label><span></span><b></b></label><progress max="100"></progress></div>
      <progress class="challenge-hold" max="100" value="0" aria-label="Objective work completed"></progress>
      <button class="pjmc-btn-secondary challenge-hint" data-action="hint" type="button">Direction hint · 8s</button>
      <div class="challenge-relay" hidden>
        <svg class="beam-map" viewBox="0 0 100 94" role="img" aria-label="Beam path from source through three mirrors to Earth link"><path d="M50 85V53" stroke="#b4dad9" fill="none"/>${[0,1,2].map(() => '<line stroke-width="1.8"/>').join('')}${['1','2','3','E'].map(label => `<g><circle r="4" fill="#e7cea0"/><text y="-7" text-anchor="middle">${label}</text></g>`).join('')}<text x="50" y="93" text-anchor="middle">SOURCE</text></svg>
        <div class="relay-work"><p class="relay-reading"></p><div class="relay-buttons">
          <button type="button" data-action="left" aria-label="Turn mirror left 45 degrees">−45°</button>
          <button type="button" data-action="right" aria-label="Turn mirror right 45 degrees">+45°</button>
          <button type="button" data-action="link">Link ↗</button>
        </div></div>
      </div>
      <div class="challenge-sample" hidden><p class="sample-fact"></p><div class="sample-buttons">
        <button type="button" data-action="sample:C">C · Carbonaceous</button>
        <button type="button" data-action="sample:S">S · Stony</button>
        <button type="button" data-action="sample:M">M · Metallic</button>
      </div></div>
      <span class="challenge-docking"></span>
      <button class="challenge-skip" data-action="skip-training" type="button" hidden>Skip practice →</button>`;
    this.challengePanel.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => this.callbacks.onChallengeAction?.(button.dataset.action)));
    this.root.append(this.challengePanel);
    this.challengeUI = Object.fromEntries(['step', 'clock', 'title', 'instruction', 'meter', 'hold', 'hint', 'relay', 'sample', 'docking', 'skip'].map(name => [name, this.challengePanel.querySelector(`.challenge-${name}`)]));
  }

  updateChallengeHUD(state) {
    this.challengePanel.hidden = !state.visible;
    this.root.classList.toggle('has-challenge', Boolean(state.visible));
    if (!state.visible) return;
    const ui = this.challengeUI;
    ui.step.textContent = state.step; ui.title.textContent = state.title;
    ui.instruction.classList.toggle('warning', Boolean(state.warning));
    ui.skip.hidden = !state.training;
    ui.sample.hidden = !state.sample;
    ui.sample.querySelector('.sample-fact').textContent = state.sampleFact || '';
    ui.docking.textContent = state.docking ? (state.dockReady ? '● DOCKING POSITION SECURE' : '◌ DOCKING RING AHEAD') : state.rescued != null ? `${state.rescued}/3 CAPSULES ABOARD` : '';
    ui.docking.hidden = !ui.docking.textContent;
    if (ui.instruction.textContent !== state.instruction) ui.instruction.textContent = state.instruction;
    const seconds = Math.ceil(state.timeLeft || 0);
    ui.clock.textContent = state.timeLeft === null ? '' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    ui.meter.hidden = !state.showMeter;
    ui.meter.querySelector('label span').textContent = state.meterLabel;
    ui.meter.querySelector('b').textContent = `${state.meter}%`;
    const meter = ui.meter.querySelector('progress'); meter.value = state.meter;
    meter.setAttribute('aria-label', state.meterLabel);
    ui.meter.classList.toggle('low', state.meterLabel !== 'SIGNAL' && state.meter < 35);
    ui.hold.value = state.progress; ui.hold.hidden = state.progress <= 0;
    ui.hint.hidden = !state.hint; ui.hint.disabled = state.hintCooldown > 0;
    ui.hint.textContent = state.hintCooldown > 0 ? `Hint फिर ${state.hintCooldown}s में` : 'Direction hint · 8s';
    ui.relay.hidden = !state.relay;
    if (state.relay) {
      ui.relay.querySelector('.relay-reading').textContent = `Mirror ${state.angle}° · ${state.beamAligned ? 'Beam connected ✓' : 'Follow the reflected beam'}`;
      const map = ui.relay.querySelector('.beam-map');
      map.setAttribute('aria-label', `Mirror ${state.angle} degrees. ${state.beamAligned ? 'Beam connected' : 'Beam not connected'}. Top view of three relays and Earth link.`);
      if (state.beamPlan) {
        map.querySelectorAll('g').forEach((node, i) => node.setAttribute('transform', `translate(${state.beamPlan.nodes[i].x} ${state.beamPlan.nodes[i].y})`));
        map.querySelectorAll('line').forEach((line, i) => {
          const segment = state.beamPlan.lines[i];
          for (const key of ['x1', 'x2', 'y1', 'y2']) line.setAttribute(key, segment[key]);
          line.setAttribute('stroke', segment.aligned ? '#a0e7bd' : '#efb988');
          line.style.display = segment.visible ? '' : 'none';
        });
      }
      ui.relay.classList.toggle('aligned', state.beamAligned);
    }
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
            <span class="pjmc-label-dim gold-label">PJMC GOLD</span>
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

    const cardsHtml = MISSIONS.filter(m => m.kind !== 'training').map(
      (m) => `
      <div class="pjmc-mission-card ${m.id === 'mission_01' ? 'active-card' : ''}" data-id="${m.id}" data-category="${m.category || 'missions'}">
        <span class="mission-planet planet-${m.target}" style="background-image:url('${ASSET_BASE}textures/${m.target}.jpg')" aria-hidden="true"></span>
        <div class="pjmc-card-header">
          <span class="pjmc-card-num">${m.num}</span>
          <span class="pjmc-card-diff diff-${m.difficulty.toLowerCase()}">${m.difficulty}</span>
        </div>
        <h3 class="pjmc-card-title">${m.title}</h3>
        <p class="pjmc-card-desc">${m.summary || (m.waypoints.length ? m.waypoints.length + ' PJMC Gold' : 'Fly anywhere')}</p>
        <span class="mission-status"></span>
        <div class="pjmc-card-reward">
          <span class="pjmc-badge-icon">🎖</span> ${m.reward}
        </div>
        <button type="button" class="pjmc-select-mission-btn" data-id="${m.id}" aria-label="Select ${m.title}">
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
              <span class="pjmc-sub-title">PJMC SPACE EXPLORERS</span>
              <h2 class="pjmc-modal-title">Choose your mission</h2>
              <span class="pjmc-mission-briefing-label">Collect Gold. Discover more.</span>
            </div>
          </div>
          <button type="button" class="pjmc-modal-close-btn" id="pjmc-mission-close">✕</button>
        </div>

        <label class="student-pilot-name"><span>PILOT</span> <input id="student-pilot-name" maxlength="24" placeholder="Your name" /></label>
        <div class="mission-meta"><p id="student-progress-summary"></p><button type="button" class="practice-button">Practice · ~30 sec ↗</button></div>
        <div class="mission-tabs" role="tablist" aria-label="Flight categories">
          <button type="button" role="tab" id="tab-missions" data-tab="missions" aria-controls="mission-cards" aria-selected="true">Missions <span>4</span></button>
          <button type="button" role="tab" id="tab-challenges" data-tab="challenges" aria-controls="mission-cards" aria-selected="false" tabindex="-1">Challenges <span>6</span></button>
        </div>
        <div class="pjmc-mission-grid" id="mission-cards" role="tabpanel" aria-labelledby="tab-missions">
          ${cardsHtml}
        </div>
        <div class="mission-brief" aria-live="polite"><p></p><span></span></div>

        <div class="pjmc-modal-footer">
          <button type="button" class="pjmc-btn-secondary" id="pjmc-back-to-solar">
            ← Back
          </button>
          <button type="button" class="pjmc-btn-primary" id="pjmc-launch-btn">
            Launch mission ↗
          </button>
        </div>
        <div class="pjmc-mission-footer-signature">A LEARNING EXPERIENCE BY PAWAN JHA MATHEMATICS CLASSES</div>
      </div>
    `;

    this.root.appendChild(this.missionModalEl);

    this.missionModalEl.querySelector('.practice-button').onclick = () => this.callbacks.onPractice?.();
    // Wire clicks
    this.selectedMissionId = 'mission_01';
    this.missionCategory = 'missions';
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
        this.selectMissionCard(card.dataset.id);
      });
    });

    const closeBtn = this.missionModalEl.querySelector('#pjmc-mission-close');
    closeBtn.addEventListener('click', () => this.callbacks.onExitExplore?.());

    const backBtn = this.missionModalEl.querySelector('#pjmc-back-to-solar');
    backBtn.addEventListener('click', () => this.callbacks.onExitExplore?.());

    const launchBtn = this.missionModalEl.querySelector('#pjmc-launch-btn');
    launchBtn.addEventListener('click', () => {
      if (!this.progress.unlocked(this.selectedMissionId)) return;
      this.closeMissionModal();
      this.callbacks.onSelectMission?.(this.selectedMissionId);
    });
    const tabs = this.missionModalEl.querySelectorAll('[data-tab]');
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.selectMissionCategory(tab.dataset.tab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index;
        tabs[next].click(); tabs[next].focus();
      });
    });
    this.selectMissionCategory('missions');
  }

  selectMissionCard(id) {
    const mission = MISSIONS.find(m => m.id === id);
    if (!mission || !this.progress.unlocked(id)) return;
    this.selectedMissionId = id;
    this.missionModalEl.querySelectorAll('.pjmc-mission-card').forEach(card => {
      const selected = card.dataset.id === id;
      card.classList.toggle('active-card', selected);
      card.querySelector('button').setAttribute('aria-pressed', String(selected));
    });
    const brief = this.missionModalEl.querySelector('.mission-brief');
    brief.querySelector('p').textContent = mission.category === 'challenges' ? mission.descHi : mission.id === 'free_flight' ? 'अपनी मर्जी से उड़ें। कोई timer या mission objective नहीं।' : `${mission.waypoints.length} PJMC Gold collect करें, meteor shower से बचें और learning question पूरा करें।`;
    brief.querySelector('span').textContent = mission.id === 'free_flight' ? 'FREE EXPLORATION' : `${mission.reward} · 3 ★${mission.duration ? ' · ' + mission.duration : ''}`;
    const best = this.progress.data.flights[mission.id]?.best;
    if (best) brief.querySelector('span').textContent += ` · Best ${best.seconds}s · ${best.medal} (this device)`;
    this.missionModalEl.querySelector('#pjmc-launch-btn').textContent = `Launch ${mission.num} ↗`;
  }

  selectMissionCategory(category) {
    this.missionCategory = category;
    this.missionModalEl.querySelectorAll('[data-tab]').forEach(tab => {
      const selected = tab.dataset.tab === category;
      tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
    });
    this.missionModalEl.querySelectorAll('.pjmc-mission-card').forEach(card => { card.hidden = card.dataset.category !== category; });
    const grid = this.missionModalEl.querySelector('.pjmc-mission-grid');
    grid.setAttribute('aria-labelledby', `tab-${category}`); grid.scrollTop = 0;
    const selected = MISSIONS.find(m => m.id === this.selectedMissionId);
    if ((selected?.category || 'missions') !== category || !this.progress.unlocked(this.selectedMissionId)) {
      this.selectedMissionId = MISSIONS.find(m => (m.category || 'missions') === category && this.progress.unlocked(m.id)).id;
    }
    this.selectMissionCard(this.selectedMissionId);
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
            <h2 class="pjmc-modal-title">Flight paused</h2>
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

        <p class="flight-record" role="status"></p>
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

  buildTrainingComplete() {
    this.trainingModal = document.createElement('div');
    this.trainingModal.className = 'pjmc-modal training-complete'; this.trainingModal.style.display = 'none';
    this.trainingModal.innerHTML = `<div class="pjmc-modal-backdrop"></div><div class="pjmc-modal-window small" role="dialog" aria-modal="true" aria-label="Practice complete">
      <span class="pjmc-sub-title">READY FOR YOUR FIRST FLIGHT</span><h2>You're ready, Pilot.</h2>
      <p>✓ दिशा बदलना &nbsp; ✓ Speed बढ़ाना<br>✓ Brake लगाना &nbsp; ✓ Capsule collect करना</p>
      <p>अब mission में यही controls इस्तेमाल करें। Practice से stars नहीं जुड़ते।</p>
      <button class="pjmc-btn-primary" type="button">Choose a mission ↗</button></div>`;
    this.trainingModal.querySelector('button').onclick = () => this.callbacks.onTrainingContinue?.();
    this.root.append(this.trainingModal);
  }

  showTrainingComplete(hasNext) {
    const button = this.trainingModal.querySelector('button');
    button.textContent = hasNext ? 'Launch selected mission ↗' : 'Choose a mission ↗';
    this.trainingModal.style.display = 'flex'; button.focus();
  }
  hideTrainingComplete() { this.trainingModal.style.display = 'none'; }

  showTip(message) {
    this.tip.textContent = message;
    clearTimeout(this.tipTimer);
    this.tipTimer = setTimeout(() => { this.tip.textContent = ''; }, 7000);
  }

  buildDiary() {
    this.diaryModal = document.createElement('div');
    this.diaryModal.className = 'pjmc-modal student-diary';
    this.diaryModal.style.display = 'none';
    this.diaryModal.innerHTML = `<div class="pjmc-modal-window"><h2>Space Diary</h2><p>Medals, best time, jet रंग और अंतिम 8 तस्वीरें इस device पर सेव होते हैं।</p><p class="medal-guide">Gold: बिना damage या गलत जवाब। Silver: अधिकतम 40 damage और 2 गलत कोशिशें। Checkpoint retry पर Bronze; best time में retry नहीं गिना जाता।</p><div class="student-badges"></div><div class="student-paints"></div><div class="student-photos"></div><button type="button" class="pjmc-btn-secondary">Close</button></div>`;
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
        this.progress.data.color = color; this.progress.data.skin = null;
        const saved = this.progress.save();
        this.callbacks.onColor?.(color);
        this.showTip(saved ? `${name} रंग चुना गया।` : 'रंग इस सत्र तक रहेगा।');
      }); paints.append(button);
    });
    for (const skin of FLIGHT_SKINS) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'pjmc-btn-secondary jet-skin'; button.style.setProperty('--skin', skin.base);
      button.disabled = !this.progress.data.badges[skin.mission];
      button.textContent = `${skin.name} · ${button.disabled ? 'Complete ' + MISSIONS.find(m => m.id === skin.mission).num : 'Unlocked'}`;
      button.setAttribute('aria-pressed', String(this.progress.data.skin === skin.id));
      button.onclick = () => {
        if (!this.progress.selectSkin(skin.id)) return;
        this.callbacks.onSkin?.(skin); this.openDiary(); this.showTip(`${skin.name} चुना गया।`);
      };
      paints.append(button);
    }
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
    this.hideMeteorFailure();
    this.updateChallengeHUD({ visible: false });
    this.hidePauseModal();
    this.hideVictoryModal();
    this.hideTrainingComplete();
    this.diaryModal.style.display = 'none';
  }

  openMissionModal() {
    this.meteorPanel.hidden=true;this.meteorMarker.hidden=true;
    this.updateChallengeHUD({ visible: false });
    const count = Object.keys(LESSONS).length;
    this.missionModalEl.querySelector('#student-progress-summary').textContent = `${this.progress.stars} ★ / ${count * 3} • ${Object.keys(this.progress.data.badges).length}/${count} missions complete`;
    this.missionModalEl.querySelectorAll('.pjmc-mission-card').forEach((card, index) => {
      const unlocked = this.progress.unlocked(card.dataset.id);
      card.dataset.locked = String(!unlocked);
      const button = card.querySelector('button');
      button.disabled = !unlocked;
      button.textContent = unlocked ? 'Select mission' : 'Locked';
      button.setAttribute('aria-pressed', String(card.classList.contains('active-card')));
      card.querySelector('.mission-status').textContent = this.progress.data.badges[card.dataset.id] ? '✓ Completed' : unlocked ? 'Ready to fly' : '🔒 Locked';
    });
    this.selectMissionCategory(this.missionCategory);
    this.show();
    this.missionModalEl.style.display = 'flex';
    if (window.parent !== window) window.parent.postMessage({type:'pjmc:overlay',open:true},'https://shivamonline.gt.tc');
    this.telemetryEl.style.display = 'none';
    this.navArrowEl.style.display = 'none';
  }

  closeMissionModal() {
    this.missionModalEl.style.display = 'none';
    if (window.parent !== window) window.parent.postMessage({type:'pjmc:overlay',open:false},'https://shivamonline.gt.tc');
    this.telemetryEl.style.display = 'flex';
  }

  showPauseModal() {
    this.pauseModalEl.style.display = 'flex';
  }

  hidePauseModal() {
    this.pauseModalEl.style.display = 'none';
  }

  setPauseBlocked(blocked) {
    const button = this.pauseModalEl.querySelector('#pjmc-pause-resume');
    button.disabled = blocked;
    button.textContent = blocked ? 'Close overlay to resume' : '▶ RESUME FLIGHT';
  }

  showVictoryModal(mission, elapsedSec, record) {
    const result = this.victoryModalEl.querySelector('.flight-record');
    result.hidden = !record;
    if (record) result.textContent = `${record.medal} medal · ${record.seconds}s${record.personalBest ? ' · New personal best' : ''}${record.retries ? ' · Checkpoint retry — no best time' : ''} · ${record.saved ? 'Saved on this device' : 'Session only: storage unavailable'}`;
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
    hideTarget = false,
  }) {
    this.speedValEl.textContent = Math.round(speed).toString();
    this.boostFillEl.style.width = `${Math.max(0, Math.min(100, boostPercent))}%`;
    this.missionBadgeEl.textContent = missionTitle.toUpperCase();
    this.targetValEl.textContent = targetName.toUpperCase();

    this.distValEl.textContent = `${targetDistance.toFixed(1)} u`;
    this.targetValEl.closest('.pjmc-target-row').hidden = hideTarget;
    this.distValEl.closest('.pjmc-dist-row').hidden = hideTarget;

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
    clearTimeout(this.tipTimer);
    this.root.remove();
  }
}
