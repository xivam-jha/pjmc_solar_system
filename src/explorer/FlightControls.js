/**
 * PJMC Space Explorer — FlightControls.
 * Mobile-first virtual joystick and touch action buttons (BOOST, BRAKE,
 * CAMERA, PAUSE), combined with responsive desktop keyboard controls.
 * Pointer-event isolated, multitouch-safe, zero scroll interference.
 */

export class FlightControls {
  constructor(containerOrCallbacks, maybeCallbacks = {}) {
    if (typeof containerOrCallbacks === 'object' && containerOrCallbacks instanceof Element) {
      this.container = containerOrCallbacks;
      this.callbacks = maybeCallbacks || {};
    } else {
      this.container = document.body;
      this.callbacks = containerOrCallbacks || {};
    }

    this.input = {
      forward: false,
      pitch: 0,
      yaw: 0,
      boost: false,
      brake: false,
    };

    this.enabled = false;
    this.keys = new Set();
    this.joystickPointerId = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickDelta = { x: 0, y: 0 };
    this.maxJoystickRadius = 55;

    this.#buildDOM();
    this.#bindEvents();
  }

  #buildDOM() {
    this.root = document.createElement('div');
    this.root.className = 'pjmc-controls-root hidden';

    // Left Area: Virtual Touch Joystick
    this.joystickZone = document.createElement('div');
    this.joystickZone.className = 'pjmc-joystick-zone';

    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'pjmc-joystick-base';

    this.joystickKnob = document.createElement('div');
    this.joystickKnob.className = 'pjmc-joystick-knob';

    this.joystickBase.append(this.joystickKnob);
    this.joystickZone.append(this.joystickBase);

    // Right Area: Action Buttons
    this.actionsZone = document.createElement('div');
    this.actionsZone.className = 'pjmc-actions-zone';

    // Boost Button
    this.boostBtn = document.createElement('button');
    this.boostBtn.className = 'pjmc-action-btn boost-btn';
    this.boostBtn.setAttribute('aria-label', 'Boost Thruster');
    this.boostBtn.innerHTML = '<span class="action-icon">⚡</span><span class="action-label">BOOST</span>';

    // Brake Button
    this.brakeBtn = document.createElement('button');
    this.brakeBtn.className = 'pjmc-action-btn brake-btn';
    this.brakeBtn.setAttribute('aria-label', 'Reverse Brake');
    this.brakeBtn.innerHTML = '<span class="action-icon">⏹</span><span class="action-label">BRAKE</span>';

    // Camera Switch Button
    this.camBtn = document.createElement('button');
    this.camBtn.className = 'pjmc-action-btn cam-btn';
    this.camBtn.setAttribute('aria-label', 'Toggle Camera');
    this.camBtn.innerHTML = '<span class="action-icon">👁</span><span class="action-label">CAM</span>';

    // Pause Button
    this.pauseBtn = document.createElement('button');
    this.pauseBtn.className = 'pjmc-action-btn pause-btn';
    this.pauseBtn.setAttribute('aria-label', 'Pause Game');
    this.pauseBtn.innerHTML = '<span class="action-icon">⏸</span>';

    this.actionsZone.append(this.camBtn, this.brakeBtn, this.boostBtn, this.pauseBtn);
    this.root.append(this.joystickZone, this.actionsZone);
    this.container.append(this.root);
  }

  #bindEvents() {
    // 1. Mobile Virtual Joystick Touch Handling
    this.joystickZone.addEventListener('pointerdown', (e) => {
      if (!this.enabled || this.joystickPointerId !== null) return;
      this.joystickPointerId = e.pointerId;
      this.joystickZone.setPointerCapture(e.pointerId);

      const rect = this.joystickZone.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      this.joystickOrigin = { x: localX, y: localY };
      this.joystickBase.style.left = `${localX}px`;
      this.joystickBase.style.top = `${localY}px`;
      this.joystickBase.classList.add('active');
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    });

    this.joystickZone.addEventListener('pointermove', (e) => {
      if (!this.enabled || e.pointerId !== this.joystickPointerId) return;

      const rect = this.joystickZone.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      let dx = currentX - this.joystickOrigin.x;
      let dy = currentY - this.joystickOrigin.y;
      const dist = Math.hypot(dx, dy);

      if (dist > this.maxJoystickRadius) {
        dx = (dx / dist) * this.maxJoystickRadius;
        dy = (dy / dist) * this.maxJoystickRadius;
      }

      this.joystickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      // Deadzone & Normalization (-1 to 1)
      const deadzone = 8;
      this.input.yaw = Math.abs(dx) > deadzone ? dx / this.maxJoystickRadius : 0;
      this.input.pitch = Math.abs(dy) > deadzone ? dy / this.maxJoystickRadius : 0;
    });

    const releaseJoystick = (e) => {
      if (e && e.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.input.yaw = 0;
      this.input.pitch = 0;
      this.joystickBase.classList.remove('active');
      this.joystickKnob.style.transform = 'translate(-50%, -50%)';
    };

    this.joystickZone.addEventListener('pointerup', releaseJoystick);
    this.joystickZone.addEventListener('pointercancel', releaseJoystick);

    // 2. Mobile Action Buttons
    const bindPressButton = (element, onDown, onUp) => {
      element.addEventListener('pointerdown', (e) => {
        if (!this.enabled) return;
        e.preventDefault();
        element.setPointerCapture(e.pointerId);
        element.classList.add('pressed');
        onDown();
      });
      const end = (e) => {
        element.classList.remove('pressed');
        onUp();
      };
      element.addEventListener('pointerup', end);
      element.addEventListener('pointercancel', end);
    };

    bindPressButton(this.boostBtn, () => { this.input.boost = true; }, () => { this.input.boost = false; });
    bindPressButton(this.brakeBtn, () => { this.input.brake = true; }, () => { this.input.brake = false; });

    this.camBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.enabled) this.callbacks.onCameraToggle?.();
    });

    this.pauseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.enabled) this.callbacks.onPauseToggle?.();
    });

    // 3. Desktop Keyboard Event Listeners
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      this.keys.add(e.code);

      if (e.code === 'KeyC') {
        this.callbacks.onCameraToggle?.();
      } else if (e.code === 'Escape') {
        this.callbacks.onPauseToggle?.();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (!this.enabled) return;
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      releaseJoystick();
    });
  }

  /** Poll inputs every frame */
  getInput() {
    // If keyboard is used on desktop, blend with joystick
    let keyPitch = 0;
    let keyYaw = 0;
    let keyForward = false;
    let keyBoost = false;
    let keyBrake = false;

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) {
      keyPitch += 1.0;
      keyForward = true;
    }
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) {
      keyPitch -= 1.0;
      keyBrake = true;
    }
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) keyYaw -= 1.0;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) keyYaw += 1.0;
    if (this.keys.has('Space')) keyBoost = true;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) keyBrake = true;

    return {
      pitch: Math.abs(this.input.pitch) > 0.05 ? this.input.pitch : keyPitch,
      yaw: Math.abs(this.input.yaw) > 0.05 ? this.input.yaw : keyYaw,
      forward: keyForward || this.input.pitch < -0.1,
      boost: this.input.boost || keyBoost,
      brake: this.input.brake || keyBrake,
    };
  }

  enable() {
    this.enabled = true;
    this.root.classList.remove('hidden');
  }

  show() {
    this.enable();
  }

  disable() {
    this.enabled = false;
    this.keys.clear();
    this.input.boost = false;
    this.input.brake = false;
    this.input.pitch = 0;
    this.input.yaw = 0;
    this.root.classList.add('hidden');
    this.joystickBase.classList.remove('active');
  }

  hide() {
    this.disable();
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

  destroy() {
    this.disable();
    this.root.remove();
  }
}
