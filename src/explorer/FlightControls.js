/**
 * PJMC Space Explorer — FlightControls.
 *
 * Professional Mobile Game Spacecraft Control System:
 * - Left Thumb: 4-Way Directional Flight Stick
 *   - ▲ AAGE (Forward Thrust / Accelerate)
 *   - ▼ PICHE (Brake / Decelerate)
 *   - ◄ LEFT (Turn Left with visual banking)
 *   - RIGHT ► (Turn Right with visual banking)
 * - Right Thumb: Vertical Altitude & Pitch Lever (Liver)
 *   - ▲ UPER (Nose Up / Ascend)
 *   - ▼ NICHE (Nose Down / Descend)
 *   - Center Spring-Return to level flight
 * - Right Action Cluster:
 *   - ⚡ BOOST: Hold for maximum warp thruster speed
 *   - 👁 CAM: Toggle 3rd-person chase / 1st-person cockpit
 *   - ⏸ PAUSE: Pause flight & open mission menu
 *   - ⚙ CONFIG: In-flight sensitivity and layout options
 * - Desktop Keyboard Bindings:
 *   - W / ArrowUp: Aage (Forward)
 *   - S / ArrowDown: Piche (Brake)
 *   - A / ArrowLeft: Left
 *   - D / ArrowRight: Right
 *   - R / PageUp: Uper (Pitch Up)
 *   - F / PageDown: Niche (Pitch Down)
 *   - Space / Shift: Boost
 *   - C: Camera
 *   - Esc: Pause
 */

export class FlightControls {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;

    // Load persisted settings
    this.settings = {
      sensitivity: 1.0,
      invertPitch: false,
      autoBank: true,
      layout: 'standard', // 'standard' or 'southpaw'
      leverRole: 'throttle', // 'throttle' (default: Lever=Aage/Piche) or 'pitch' (Lever=Uper/Niche)
    };
    this.#loadSettings();

    // Raw input states (-1 to +1, or boolean)
    this.input = {
      thrust: 0, // 0.0 (Idle Stop) to +1.0 (Aage) or -1.0 (Piche/Brake)
      yaw: 0,    // -1.0 (Left) to +1.0 (Right)
      pitch: 0,  // -1.0 (Niche/Down) to +1.0 (Uper/Up)
      roll: 0,   // -1.0 to +1.0
      boost: false,
      brake: false,
    };

    this.enabled = false;
    this.keys = new Set();

    // Left Thumb Joystick tracking
    this.joystickPointerId = null;
    this.maxJoystickRadius = 56; // pixels
    this.joystickDeadzone = 5.5; // ~10%

    // Right Thumb Vertical Lever tracking
    this.leverPointerId = null;
    this.maxLeverTravel = 52; // pixels up/down
    this.leverDeadzone = 4.0;

    this.#buildDOM();
    this.#bindEvents();
    this.applyLayout();
    this.applyControlLabels();
  }

  #loadSettings() {
    try {
      const saved = localStorage.getItem('pjmc_flight_settings_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.sensitivity === 'number') this.settings.sensitivity = parsed.sensitivity;
        if (typeof parsed.invertPitch === 'boolean') this.settings.invertPitch = parsed.invertPitch;
        if (typeof parsed.autoBank === 'boolean') this.settings.autoBank = parsed.autoBank;
        if (parsed.layout === 'standard' || parsed.layout === 'southpaw') this.settings.layout = parsed.layout;
        if (parsed.leverRole === 'throttle' || parsed.leverRole === 'pitch') this.settings.leverRole = parsed.leverRole;
      }
    } catch (_) {}
  }

  saveSettings() {
    try {
      localStorage.setItem('pjmc_flight_settings_v2', JSON.stringify(this.settings));
    } catch (_) {}
  }

  #buildDOM() {
    this.root = document.createElement('div');
    this.root.className = 'pjmc-controls-root hidden';
    this.root.id = 'pjmc-flight-controls-root';
    this.root.style.display = 'none'; // NEVER show on initial Solar System load

    // -------------------------------------------------------------
    // 1. LEFT THUMB — Directional Joystick (Aage, Piche, Left, Right)
    // -------------------------------------------------------------
    this.joystickZone = document.createElement('div');
    this.joystickZone.className = 'pjmc-joystick-zone';
    this.joystickZone.setAttribute('aria-label', 'Directional Flight Stick');

    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'pjmc-joystick-base';

    // Clear Hindi / English directional labels (Yaw + Pitch steering yoke)
    this.joystickBase.innerHTML = `
      <div class="pjmc-joy-grid"></div>
      <div class="pjmc-joy-dir dir-uper" id="pjmc-joy-label-up">▲ UPER</div>
      <div class="pjmc-joy-dir dir-niche" id="pjmc-joy-label-down">▼ NICHE</div>
      <div class="pjmc-joy-dir dir-left">◄ LEFT</div>
      <div class="pjmc-joy-dir dir-right">RIGHT ►</div>
      <div class="pjmc-joy-center-ring"></div>
    `;

    this.joystickKnob = document.createElement('div');
    this.joystickKnob.className = 'pjmc-joystick-knob';
    this.joystickKnob.innerHTML = `
      <div class="pjmc-knob-core"></div>
      <div class="pjmc-knob-pip"></div>
    `;

    this.joystickBase.appendChild(this.joystickKnob);
    this.joystickZone.appendChild(this.joystickBase);

    // -------------------------------------------------------------
    // 2. RIGHT THUMB — Vertical Throttle Accelerator Lever (Liver)
    // -------------------------------------------------------------
    this.leverZone = document.createElement('div');
    this.leverZone.className = 'pjmc-lever-zone';
    this.leverZone.setAttribute('aria-label', 'Flight Throttle Accelerator Lever');

    this.leverBase = document.createElement('div');
    this.leverBase.className = 'pjmc-lever-base';

    this.leverBase.innerHTML = `
      <div class="pjmc-lever-dir dir-aage" id="pjmc-lever-label-top">▲ AAGE</div>
      <div class="pjmc-lever-track">
        <div class="pjmc-lever-slot"></div>
        <div class="pjmc-lever-ticks">
          <span>MAX</span><span>75%</span><span>50%</span><span>25%</span><span>0</span>
        </div>
        <div class="pjmc-lever-center-mark" id="pjmc-lever-center-text">— 0 STOP —</div>
      </div>
      <div class="pjmc-lever-dir dir-piche" id="pjmc-lever-label-bottom">▼ PICHE</div>
    `;

    // Slidable lever knob
    this.leverHandle = document.createElement('div');
    this.leverHandle.className = 'pjmc-lever-handle';
    this.leverHandle.innerHTML = `
      <div class="pjmc-handle-ribs"></div>
      <div class="pjmc-handle-lamp"></div>
    `;

    this.leverBase.querySelector('.pjmc-lever-track').appendChild(this.leverHandle);
    this.leverZone.appendChild(this.leverBase);

    // -------------------------------------------------------------
    // 3. RIGHT THUMB — Action Button Cluster
    // -------------------------------------------------------------
    this.actionsZone = document.createElement('div');
    this.actionsZone.className = 'pjmc-actions-zone';

    // Boost Button (Large glowing orange turbo button)
    this.boostBtn = document.createElement('button');
    this.boostBtn.type = 'button';
    this.boostBtn.className = 'pjmc-action-btn boost-btn';
    this.boostBtn.setAttribute('aria-label', 'Turbo Boost');
    this.boostBtn.innerHTML = `
      <span class="action-icon">⚡</span>
      <span class="action-label">BOOST</span>
    `;

    // Camera Switch Button (Chase / Cockpit)
    this.camBtn = document.createElement('button');
    this.camBtn.type = 'button';
    this.camBtn.className = 'pjmc-action-btn cam-btn';
    this.camBtn.setAttribute('aria-label', 'Toggle Camera');
    this.camBtn.innerHTML = `
      <span class="action-icon">👁</span>
      <span class="action-label">CAM</span>
    `;

    // Pause Button
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.type = 'button';
    this.pauseBtn.className = 'pjmc-action-btn pause-btn';
    this.pauseBtn.setAttribute('aria-label', 'Pause Game');
    this.pauseBtn.innerHTML = `
      <span class="action-icon">⏸</span>
      <span class="action-label">PAUSE</span>
    `;

    // Settings Button
    this.settingsBtn = document.createElement('button');
    this.settingsBtn.type = 'button';
    this.settingsBtn.className = 'pjmc-action-btn settings-btn';
    this.settingsBtn.setAttribute('aria-label', 'Flight Settings');
    this.settingsBtn.innerHTML = `<span class="action-icon">⚙</span>`;

    // Clustered arrangement
    const actionCol = document.createElement('div');
    actionCol.className = 'pjmc-action-col';
    actionCol.append(this.settingsBtn, this.pauseBtn, this.camBtn, this.boostBtn);

    this.actionsZone.append(actionCol, this.leverZone);

    // -------------------------------------------------------------
    // 4. Quick Flight Settings Modal
    // -------------------------------------------------------------
    this.settingsModal = document.createElement('div');
    this.settingsModal.className = 'pjmc-modal pjmc-flight-settings-modal hidden';
    this.settingsModal.style.display = 'none';
    this.settingsModal.innerHTML = `
      <div class="pjmc-modal-backdrop"></div>
      <div class="pjmc-modal-window flight-settings-box">
        <div class="pjmc-modal-header">
          <h2 class="pjmc-modal-title">FLIGHT CONTROLS CONFIG</h2>
          <button type="button" class="pjmc-settings-close-btn" id="pjmc-set-close">✕</button>
        </div>
        <div class="flight-settings-content">
          <div class="flight-setting-item">
            <div class="setting-desc">
              <strong>UPER / NICHE LEVER DIRECTION</strong>
              <span class="setting-hint">Slide lever UP: Rocket pitches nose upward</span>
            </div>
            <button type="button" class="flight-setting-toggle" id="pjmc-toggle-invert">
              ${this.settings.invertPitch ? 'INVERTED' : 'NORMAL'}
            </button>
          </div>

          <div class="flight-setting-item">
            <div class="setting-desc">
              <strong>STEERING SENSITIVITY</strong>
              <span class="setting-hint">Turn responsiveness</span>
            </div>
            <button type="button" class="flight-setting-toggle" id="pjmc-toggle-sens">
              ${this.settings.sensitivity < 0.9 ? 'LOW (0.7x)' : this.settings.sensitivity > 1.2 ? 'HIGH (1.4x)' : 'NORMAL (1.0x)'}
            </button>
          </div>

          <div class="flight-setting-item">
            <div class="setting-desc">
              <strong>AUTO-BANKING</strong>
              <span class="setting-hint">Natural aircraft tilt during horizontal turns</span>
            </div>
            <button type="button" class="flight-setting-toggle ${this.settings.autoBank ? 'active' : ''}" id="pjmc-toggle-bank">
              ${this.settings.autoBank ? 'ON' : 'OFF'}
            </button>
          </div>

          <div class="flight-setting-item">
            <div class="setting-desc">
              <strong>CONTROLS LAYOUT</strong>
              <span class="setting-hint">Joystick left / Lever right vs Swapped</span>
            </div>
            <button type="button" class="flight-setting-toggle" id="pjmc-toggle-layout">
              ${this.settings.layout === 'southpaw' ? 'SOUTHPAW (SWAPPED)' : 'STANDARD (DEFAULT)'}
            </button>
          </div>

          <div class="flight-setting-item">
            <div class="setting-desc">
              <strong>RIGHT LEVER FUNCTION</strong>
              <span class="setting-hint">Lever controls AAGE/PICHE speed vs UPER/NICHE pitch</span>
            </div>
            <button type="button" class="flight-setting-toggle" id="pjmc-toggle-lever-role">
              ${this.settings.leverRole === 'pitch' ? 'ALTITUDE (UPER/NICHE)' : 'THROTTLE (AAGE/PICHE)'}
            </button>
          </div>
        </div>

        <div class="flight-settings-keys">
          <div class="key-help-title">DESKTOP KEYBOARD CONTROLS:</div>
          <div class="key-help-grid">
            <span><strong>W / S:</strong> Aage (Forward) / Piche (Brake)</span>
            <span><strong>A / D:</strong> Left / Right Turn</span>
            <span><strong>R / F:</strong> Uper (Up) / Niche (Down)</span>
            <span><strong>SPACE:</strong> Turbo Boost</span>
            <span><strong>C:</strong> Camera Mode</span>
            <span><strong>ESC:</strong> Pause</span>
          </div>
        </div>

        <div class="flight-settings-actions">
          <button type="button" class="pjmc-btn-primary" id="pjmc-set-done">SAVE & RESUME</button>
        </div>
      </div>
    `;

    this.root.append(this.joystickZone, this.actionsZone, this.settingsModal);
    document.body.append(this.root);

    this.#bindSettingsEvents();
  }

  applyLayout() {
    if (this.settings.layout === 'southpaw') {
      this.root.classList.add('southpaw');
    } else {
      this.root.classList.remove('southpaw');
    }
  }

  applyControlLabels() {
    const joyUp = this.joystickBase.querySelector('#pjmc-joy-label-up');
    const joyDown = this.joystickBase.querySelector('#pjmc-joy-label-down');
    const levTop = this.leverBase.querySelector('#pjmc-lever-label-top');
    const levBottom = this.leverBase.querySelector('#pjmc-lever-label-bottom');
    const levCenter = this.leverBase.querySelector('#pjmc-lever-center-text');

    if (this.settings.leverRole === 'throttle') {
      if (joyUp) { joyUp.textContent = '▲ UPER'; joyUp.className = 'pjmc-joy-dir dir-uper'; }
      if (joyDown) { joyDown.textContent = '▼ NICHE'; joyDown.className = 'pjmc-joy-dir dir-niche'; }
      if (levTop) { levTop.textContent = '▲ AAGE'; levTop.className = 'pjmc-lever-dir dir-aage'; }
      if (levBottom) { levBottom.textContent = '▼ PICHE'; levBottom.className = 'pjmc-lever-dir dir-piche'; }
      if (levCenter) levCenter.textContent = '— 0 STOP —';
    } else {
      if (joyUp) { joyUp.textContent = '▲ AAGE'; joyUp.className = 'pjmc-joy-dir dir-aage'; }
      if (joyDown) { joyDown.textContent = '▼ PICHE'; joyDown.className = 'pjmc-joy-dir dir-piche'; }
      if (levTop) { levTop.textContent = '▲ UPER'; levTop.className = 'pjmc-lever-dir dir-uper'; }
      if (levBottom) { levBottom.textContent = '▼ NICHE'; levBottom.className = 'pjmc-lever-dir dir-niche'; }
      if (levCenter) levCenter.textContent = '— LEVEL —';
    }
  }

  #bindEvents() {
    // -------------------------------------------------------------
    // 1. LEFT THUMB: Directional Stick (Aage / Piche / Left / Right)
    // -------------------------------------------------------------
    const updateJoystickFromPointer = (clientX, clientY) => {
      const rect = this.joystickBase.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      // Clamp knob movement to circular boundary
      let clampedX = dx;
      let clampedY = dy;
      if (dist > this.maxJoystickRadius) {
        clampedX = (dx / dist) * this.maxJoystickRadius;
        clampedY = (dy / dist) * this.maxJoystickRadius;
      }

      this.joystickKnob.style.transition = 'none';
      this.joystickKnob.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;

      if (dist <= this.joystickDeadzone) {
        this.input.yaw = 0;
        if (this.settings.leverRole === 'throttle') {
          this.input.pitch = 0;
        } else {
          this.input.thrust = 0;
        }
        return;
      }

      const normDist = Math.min(1.0, (dist - this.joystickDeadzone) / (this.maxJoystickRadius - this.joystickDeadzone));
      const factor = normDist * 0.8 + Math.pow(normDist, 2) * 0.2;

      const normX = (dx / dist) * factor;
      const normY = (dy / dist) * factor;

      // Horizontal (X): Turn Left (-1.0) / Right (+1.0) with Banking
      this.input.yaw = normX;

      // Vertical (Y)
      if (this.settings.leverRole === 'throttle') {
        // Stick controls Pitch: Drag UP = UPER (+1.0 Nose Up), Drag DOWN = NICHE (-1.0 Nose Down)
        const rawPitch = -normY;
        this.input.pitch = this.settings.invertPitch ? -rawPitch : rawPitch;
      } else {
        // Stick controls Thrust: Drag UP = AAGE (+1.0), Drag DOWN = PICHE (-1.0)
        this.input.thrust = -normY;
      }
    };

    const handleJoystickDown = (e) => {
      if (!this.enabled || this.joystickPointerId !== null) return;
      e.preventDefault();
      this.joystickPointerId = e.pointerId;
      try {
        this.joystickZone.setPointerCapture(e.pointerId);
      } catch (_) {}

      this.joystickBase.classList.add('active');
      updateJoystickFromPointer(e.clientX, e.clientY);
    };

    const handleJoystickMove = (e) => {
      if (!this.enabled || e.pointerId !== this.joystickPointerId) return;
      e.preventDefault();
      updateJoystickFromPointer(e.clientX, e.clientY);
    };

    const handleJoystickUp = (e) => {
      if (e && e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;

      this.input.yaw = 0;
      if (this.settings.leverRole === 'throttle') {
        this.input.pitch = 0;
      } else {
        this.input.thrust = 0;
      }
      this.joystickBase.classList.remove('active');

      // Spring return to center
      this.joystickKnob.style.transition = 'transform 0.18s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    };

    this.joystickZone.addEventListener('pointerdown', handleJoystickDown, { passive: false });
    window.addEventListener('pointermove', handleJoystickMove, { passive: false });
    window.addEventListener('pointerup', handleJoystickUp, { passive: false });
    window.addEventListener('pointercancel', handleJoystickUp, { passive: false });

    // -------------------------------------------------------------
    // 2. RIGHT THUMB: Throttle Accelerator Lever (Aage / Piche)
    // -------------------------------------------------------------
    const updateLeverFromPointer = (clientY) => {
      const track = this.leverBase.querySelector('.pjmc-lever-track');
      const rect = track.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;

      let dy = clientY - centerY;
      // Clamp vertical travel between -maxLeverTravel and +maxLeverTravel
      let clampedY = Math.max(-this.maxLeverTravel, Math.min(this.maxLeverTravel, dy));

      this.leverHandle.style.transition = 'none';
      this.leverHandle.style.transform = `translate(-50%, calc(-50% + ${clampedY}px))`;

      const dist = Math.abs(clampedY);
      if (dist <= this.leverDeadzone) {
        if (this.settings.leverRole === 'throttle') {
          this.input.thrust = 0;
        } else {
          this.input.pitch = 0;
        }
        return;
      }

      const normTravel = Math.min(1.0, (dist - this.leverDeadzone) / (this.maxLeverTravel - this.leverDeadzone));
      const factor = normTravel * 0.85 + Math.pow(normTravel, 2) * 0.15;

      if (this.settings.leverRole === 'throttle') {
        // Sliding UP (clampedY < 0) = AAGE (Forward throttle 0.0 to +1.0)
        // Sliding DOWN (clampedY > 0) = PICHE / BRAKE (0.0 to -1.0)
        this.input.thrust = -(clampedY / dist) * factor;
      } else {
        // Sliding UP = UPER, Sliding DOWN = NICHE
        const rawPitch = -(clampedY / dist) * factor;
        this.input.pitch = this.settings.invertPitch ? -rawPitch : rawPitch;
      }
    };

    const handleLeverDown = (e) => {
      if (!this.enabled || this.leverPointerId !== null) return;
      e.preventDefault();
      this.leverPointerId = e.pointerId;
      try {
        this.leverZone.setPointerCapture(e.pointerId);
      } catch (_) {}

      this.leverBase.classList.add('active');
      updateLeverFromPointer(e.clientY);
    };

    const handleLeverMove = (e) => {
      if (!this.enabled || e.pointerId !== this.leverPointerId) return;
      e.preventDefault();
      updateLeverFromPointer(e.clientY);
    };

    const handleLeverUp = (e) => {
      if (e && e.pointerId !== this.leverPointerId) return;
      this.leverPointerId = null;

      // Lever released: reset throttle/pitch to 0 so jet comes to a gradual stop ("dhire dhire ruk jae")
      if (this.settings.leverRole === 'throttle') {
        this.input.thrust = 0;
      } else {
        this.input.pitch = 0;
      }
      this.leverBase.classList.remove('active');

      // Spring return to center
      this.leverHandle.style.transition = 'transform 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28)';
      this.leverHandle.style.transform = 'translate(-50%, -50%)';
    };

    this.leverZone.addEventListener('pointerdown', handleLeverDown, { passive: false });
    window.addEventListener('pointermove', handleLeverMove, { passive: false });
    window.addEventListener('pointerup', handleLeverUp, { passive: false });
    window.addEventListener('pointercancel', handleLeverUp, { passive: false });

    // -------------------------------------------------------------
    // 3. Action Buttons (Boost, Cam, Pause, Settings)
    // -------------------------------------------------------------
    const bindHoldButton = (btn, onDown, onUp) => {
      let activePointer = null;

      const down = (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        activePointer = e.pointerId ?? 1;
        try {
          if (e.pointerId !== undefined && btn.setPointerCapture) {
            btn.setPointerCapture(e.pointerId);
          }
        } catch (_) {}
        btn.classList.add('active');
        onDown();
      };

      const up = (e) => {
        if (activePointer === null) return;
        if (e && e.pointerId !== undefined && activePointer !== 1 && e.pointerId !== activePointer) return;
        try {
          if (activePointer !== null && activePointer !== 1 && btn.hasPointerCapture?.(activePointer)) {
            btn.releasePointerCapture(activePointer);
          }
        } catch (_) {}
        activePointer = null;
        btn.classList.remove('active');
        onUp();
      };

      btn.addEventListener('pointerdown', down, { passive: false });
      window.addEventListener('pointerup', up, { passive: false });
      window.addEventListener('pointercancel', up, { passive: false });
      window.addEventListener('touchend', up, { passive: false });
      window.addEventListener('touchcancel', up, { passive: false });
      window.addEventListener('mouseup', up, { passive: false });
      btn.addEventListener('lostpointercapture', up, { passive: false });
    };

    // BOOST: Hold for turbo speed
    bindHoldButton(
      this.boostBtn,
      () => {
        this.input.boost = true;
        this.callbacks.onBoostChange?.(true);
      },
      () => {
        this.input.boost = false;
        this.callbacks.onBoostChange?.(false);
      }
    );

    const bindTapButton = (btn, onTap) => {
      let started = false;
      btn.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        e.stopPropagation();
        started = true;
        btn.classList.add('active');
      }, { passive: false });

      btn.addEventListener('pointerup', (e) => {
        if (!started) return;
        started = false;
        btn.classList.remove('active');
        if (this.enabled) onTap();
      }, { passive: false });

      btn.addEventListener('pointercancel', () => {
        started = false;
        btn.classList.remove('active');
      }, { passive: false });
    };

    // CAM: Toggle View
    bindTapButton(this.camBtn, () => this.callbacks.onCameraToggle?.());

    // PAUSE: Pause flight
    bindTapButton(this.pauseBtn, () => this.callbacks.onPauseToggle?.());

    // SETTINGS: Open quick drawer
    bindTapButton(this.settingsBtn, () => this.openSettingsModal());

    // -------------------------------------------------------------
    // 4. Desktop Keyboard Bindings
    // -------------------------------------------------------------
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      const wasBoosting = this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      this.keys.add(e.code);

      if (e.code === 'KeyC') {
        this.callbacks.onCameraToggle?.();
      } else if (e.code === 'Escape') {
        this.callbacks.onPauseToggle?.();
      } else if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!wasBoosting && !this.input.boost) {
          this.callbacks.onBoostChange?.(true);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.enabled) return;
      this.keys.delete(e.code);

      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        const stillBoosting = this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        if (!stillBoosting && !this.input.boost) {
          this.callbacks.onBoostChange?.(false);
        }
      }
    });

    const handleResetAllInputs = () => {
      this.keys.clear();
      handleJoystickUp();
      handleLeverUp();
      const wasBoosting = this.input.boost;
      this.input.boost = false;
      this.input.brake = false;
      this.boostBtn?.classList.remove('active');
      if (wasBoosting) {
        this.callbacks.onBoostChange?.(false);
      }
    };

    window.addEventListener('blur', handleResetAllInputs);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleResetAllInputs();
      }
    });
  }

  #bindSettingsEvents() {
    const invertBtn = this.settingsModal.querySelector('#pjmc-toggle-invert');
    invertBtn.addEventListener('click', () => {
      this.settings.invertPitch = !this.settings.invertPitch;
      invertBtn.textContent = this.settings.invertPitch ? 'INVERTED' : 'NORMAL';
      this.saveSettings();
    });

    const sensBtn = this.settingsModal.querySelector('#pjmc-toggle-sens');
    sensBtn.addEventListener('click', () => {
      if (this.settings.sensitivity < 0.9) {
        this.settings.sensitivity = 1.0;
        sensBtn.textContent = 'NORMAL (1.0x)';
      } else if (this.settings.sensitivity < 1.2) {
        this.settings.sensitivity = 1.4;
        sensBtn.textContent = 'HIGH (1.4x)';
      } else {
        this.settings.sensitivity = 0.7;
        sensBtn.textContent = 'LOW (0.7x)';
      }
      this.saveSettings();
    });

    const bankBtn = this.settingsModal.querySelector('#pjmc-toggle-bank');
    bankBtn.addEventListener('click', () => {
      this.settings.autoBank = !this.settings.autoBank;
      bankBtn.textContent = this.settings.autoBank ? 'ON' : 'OFF';
      bankBtn.classList.toggle('active', this.settings.autoBank);
      this.saveSettings();
    });

    const layoutBtn = this.settingsModal.querySelector('#pjmc-toggle-layout');
    layoutBtn.addEventListener('click', () => {
      this.settings.layout = this.settings.layout === 'standard' ? 'southpaw' : 'standard';
      layoutBtn.textContent = this.settings.layout === 'southpaw' ? 'SOUTHPAW (SWAPPED)' : 'STANDARD (DEFAULT)';
      this.applyLayout();
      this.saveSettings();
    });

    const leverRoleBtn = this.settingsModal.querySelector('#pjmc-toggle-lever-role');
    leverRoleBtn?.addEventListener('click', () => {
      this.settings.leverRole = this.settings.leverRole === 'throttle' ? 'pitch' : 'throttle';
      leverRoleBtn.textContent = this.settings.leverRole === 'pitch' ? 'ALTITUDE (UPER/NICHE)' : 'THROTTLE (AAGE/PICHE)';
      this.applyControlLabels();
      this.saveSettings();
    });

    const closeBtn = this.settingsModal.querySelector('#pjmc-set-close');
    const doneBtn = this.settingsModal.querySelector('#pjmc-set-done');
    const close = () => {
      this.closeSettingsModal();
    };
    closeBtn.addEventListener('click', close);
    doneBtn.addEventListener('click', close);
  }

  openSettingsModal() {
    this.settingsModal.style.display = 'flex';
    this.settingsModal.classList.remove('hidden');
  }

  closeSettingsModal() {
    this.settingsModal.style.display = 'none';
    this.settingsModal.classList.add('hidden');
  }

  /**
   * Sample all inputs (joystick + lever + keyboard) for this physics frame.
   * Returns:
   * - thrust: -1.0 (Piche/Brake) to +1.0 (Aage/Forward)
   * - yaw: -1.0 (Left) to +1.0 (Right)
   * - pitch: -1.0 (Niche/Down) to +1.0 (Uper/Up)
   * - boost: boolean
   * - brake: boolean
   */
  getInput() {
    let keyThrust = 0;
    let keyYaw = 0;
    let keyPitch = 0;
    let keyBoost = false;

    // Desktop W/S or Arrow Up/Down -> Aage (Forward) / Piche (Brake)
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) keyThrust += 1.0;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) keyThrust -= 1.0;

    // Desktop A/D or Arrow Left/Right -> Left / Right Turn
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) keyYaw -= 1.0;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) keyYaw += 1.0;

    // Desktop R/F or PageUp/PageDown -> Uper (Pitch Up) / Niche (Pitch Down)
    if (this.keys.has('KeyR') || this.keys.has('PageUp')) keyPitch += 1.0;
    if (this.keys.has('KeyF') || this.keys.has('PageDown')) keyPitch -= 1.0;

    // Boost keys: Space or Shift
    if (this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) keyBoost = true;

    // Blend touch and keyboard
    const finalThrust = Math.abs(this.input.thrust) > 0.02 ? this.input.thrust : keyThrust;
    const finalYaw = Math.abs(this.input.yaw) > 0.02 ? this.input.yaw : keyYaw;
    const finalPitch = Math.abs(this.input.pitch) > 0.02 ? this.input.pitch : keyPitch;
    const finalBoost = this.input.boost || keyBoost;

    const sens = this.settings.sensitivity;

    return {
      thrust: Math.max(-1.0, Math.min(1.0, finalThrust)),
      yaw: Math.max(-1.0, Math.min(1.0, finalYaw)) * sens,
      pitch: Math.max(-1.0, Math.min(1.0, finalPitch)) * sens,
      roll: 0,
      boost: finalBoost,
      brake: finalThrust < -0.15,
      forward: true,
    };
  }

  getSteer() {
    const inp = this.getInput();
    return { x: inp.yaw, y: inp.pitch };
  }

  isBoosting() {
    return this.getInput().boost;
  }

  isBraking() {
    return this.getInput().brake;
  }

  enable() {
    this.enabled = true;
    this.root.style.display = 'block';
    this.root.classList.remove('hidden');
    this.root.classList.add('active');
  }

  show() {
    this.enable();
  }

  disable() {
    this.enabled = false;
    this.keys.clear();
    const wasBoosting = this.input.boost;
    this.input.boost = false;
    this.input.brake = false;
    this.input.pitch = 0;
    this.input.yaw = 0;
    this.input.thrust = 0;
    this.joystickPointerId = null;
    this.leverPointerId = null;
    this.root.style.display = 'none';
    this.root.classList.add('hidden');
    this.root.classList.remove('active');
    this.joystickBase.classList.remove('active');
    this.leverBase.classList.remove('active');
    this.boostBtn?.classList.remove('active');
    this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    this.leverHandle.style.transform = 'translate(-50%, -50%)';
    this.closeSettingsModal();
    if (wasBoosting) {
      this.callbacks.onBoostChange?.(false);
    }
  }

  hide() {
    this.disable();
  }

  destroy() {
    this.disable();
    this.root.remove();
  }
}
