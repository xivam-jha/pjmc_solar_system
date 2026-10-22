function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeButton(text, className, onClick) {
  const button = element('button', className, text);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

/** UI for piloting and exploring with PJMC SPACE EXPLORER. */
export function createSpacecraftHUD({ targets, onCameraToggle, onExit, onAutopilot, onControl, onGestureToggle, onStop }) {
  const root = element('section', 'spacecraft-flight-hud');
  root.hidden = true;
  root.setAttribute('aria-label', 'Spacecraft flight controls');

  const heading = element('div', 'flight-panel-heading');
  const title = element('div', 'flight-panel-title', 'PJMC SPACE EXPLORER');
  const status = element('div', 'flight-status', 'PREPARING LAUNCH');
  heading.append(title, status);

  const instruments = element('div', 'flight-instruments');
  const speedBox = element('div', 'flight-instrument');
  speedBox.append(element('span', 'flight-instrument-label', 'VELOCITY'), element('strong', 'flight-speed', '0.0 u/s'));
  const modeBox = element('div', 'flight-instrument');
  modeBox.append(element('span', 'flight-instrument-label', 'CAMERA'), element('strong', 'flight-camera-state', 'EXTERNAL'));
  instruments.append(speedBox, modeBox);

  const nav = element('div', 'flight-navigation');
  const navLabel = element('label', 'flight-label', 'DESTINATION');
  const select = element('select', 'flight-target-select');
  select.setAttribute('aria-label', 'Choose destination planet');
  select.append(new Option('Select a planet…', ''));
  for (const target of targets) select.append(new Option(target.name, target.id));
  navLabel.append(select);
  const autoButton = makeButton('AUTO-PILOT', 'flight-action-btn', () => {
    if (autoButton.dataset.active === 'true') {
      onAutopilot(null);
    } else if (select.value) {
      onAutopilot(select.value);
    } else {
      select.focus();
      select.classList.add('needs-selection');
      window.setTimeout(() => select.classList.remove('needs-selection'), 900);
    }
  });
  const cameraButton = makeButton('SWITCH TO COCKPIT', 'flight-action-btn', onCameraToggle);
  const gestureButton = makeButton('ENABLE HAND CONTROL', 'flight-action-btn flight-gesture-toggle', onGestureToggle);
  nav.append(navLabel, autoButton, cameraButton, gestureButton);

  const gesturePanel = element('div', 'flight-gesture-panel');
  gesturePanel.hidden = true;
  const gesturePreview = element('div', 'flight-gesture-preview');
  const gestureStatus = element('div', 'flight-gesture-status', 'CAMERA OFF');
  const gestureHelp = element('div', 'flight-gesture-help', 'ONE HAND: PUSH/PULL TO THRUST · MOVE LEFT/RIGHT TO TURN · UP/DOWN TO CLIMB/DESCEND · TWO HANDS: SPREAD/PINCH TO ZOOM');
  gesturePanel.append(gesturePreview, gestureStatus, gestureHelp);

  const keyLegend = element('div', 'flight-key-legend', 'DRAG TO LOOK · EXTERNAL WHEEL = ZOOM · W / ↑ THRUST · A / D TURN · Q / E ALTITUDE · SHIFT BOOST');
  const hideControlsButton = makeButton('HIDE CONTROLS', 'flight-hide-ui-btn', () => setControlsHidden(true));
  const touchControls = element('div', 'spacecraft-touch-controls');
  const stopButton = makeButton('■ STOP / BRAKE', 'flight-stop-btn', () => {
    onStop?.();
    for (const id of ['forward', 'back', 'yawLeft', 'yawRight', 'up', 'down', 'boost']) onControl(id, false);
    onAutopilot(null);
    status.textContent = 'BRAKES ENGAGED';
  });
  const dpad = element('div', 'flight-dpad');
  const controls = [
    { id: 'yawLeft', label: '◀', title: 'Turn left' },
    { id: 'forward', label: '▲', title: 'Move forward' },
    { id: 'yawRight', label: '▶', title: 'Turn right' },
    { id: 'back', label: '▼', title: 'Move backward' },
  ];
  for (const item of controls) {
    const button = element('button', 'flight-key', item.label);
    button.type = 'button';
    button.title = item.title;
    button.dataset.control = item.id;
    button.setAttribute('aria-label', item.title);
    const press = (event) => {
      event.preventDefault();
      onControl(item.id, true);
      try { button.setPointerCapture(event.pointerId); } catch {}
    };
    const release = (event) => {
      if (event) event.preventDefault();
      onControl(item.id, false);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    dpad.append(button);
  }
  const vertical = element('div', 'flight-vertical-controls');
  // Aircraft-style pitch/altitude lever: push up to climb, pull down to descend.
  const leverWrap = element('div', 'flight-lever-wrap');
  leverWrap.append(element('span', 'flight-lever-caption', 'CLIMB / DESCEND'));
  const leverTrack = element('div', 'flight-lever-track');
  leverTrack.setAttribute('role', 'group');
  leverTrack.setAttribute('aria-label', 'Altitude lever: move up to climb and down to descend');
  const lever = element('button', 'flight-lever-handle', '↕');
  lever.type = 'button';
  lever.setAttribute('aria-label', 'Altitude lever');
  lever.style.top = '50%';
  leverTrack.append(lever);
  leverWrap.append(leverTrack);
  let leverPointer = null;
  function setLeverFromY(clientY) {
    const rect = leverTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    lever.style.top = `${ratio * 100}%`;
    onControl('up', ratio < 0.40);
    onControl('down', ratio > 0.60);
  }
  function releaseLever() {
    leverPointer = null;
    onControl('up', false);
    onControl('down', false);
    lever.style.top = '50%';
  }
  lever.addEventListener('pointerdown', (event) => {
    event.preventDefault(); leverPointer = event.pointerId;
    try { lever.setPointerCapture(event.pointerId); } catch {}
    setLeverFromY(event.clientY);
  });
  lever.addEventListener('pointermove', (event) => {
    if (leverPointer === event.pointerId) { event.preventDefault(); setLeverFromY(event.clientY); }
  });
  lever.addEventListener('pointerup', releaseLever);
  lever.addEventListener('pointercancel', releaseLever);
  lever.addEventListener('lostpointercapture', releaseLever);

  for (const item of [
    { id: 'boost', label: 'BOOST' },
  ]) {
    const button = element('button', 'flight-key flight-key-small', item.label);
    button.type = 'button';
    button.setAttribute('aria-label', item.label);
    const press = (event) => {
      event.preventDefault();
      onControl(item.id, true);
      try { button.setPointerCapture(event.pointerId); } catch {}
    };
    const release = (event) => {
      if (event) event.preventDefault();
      onControl(item.id, false);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    vertical.append(button);
  }
  vertical.prepend(leverWrap);
  touchControls.append(dpad, vertical, stopButton);
  const exitButton = makeButton('EXIT FLIGHT', 'flight-exit-btn', onExit);
  const restoreControlsButton = makeButton('SHOW CONTROLS', 'flight-restore-btn', () => setControlsHidden(false));
  restoreControlsButton.hidden = true;
  root.append(heading, instruments, nav, gesturePanel, keyLegend, hideControlsButton, exitButton);
  document.body.append(root);
  document.body.append(touchControls);
  document.body.append(restoreControlsButton);

  let flightVisible = false;
  let controlsMinimized = false;

  function applyVisibility() {
    root.hidden = !flightVisible || controlsMinimized;
    // Hide only the large information panel; keep flight controls available.
    touchControls.hidden = !flightVisible;
    restoreControlsButton.hidden = !flightVisible || !controlsMinimized;
    document.body.classList.toggle('spacecraft-ui-minimized', flightVisible && controlsMinimized);
  }

  function setControlsHidden(hidden) {
    if (!flightVisible) return;
    controlsMinimized = Boolean(hidden);
    applyVisibility();
  }

  applyVisibility();

  return {
    setVisible(visible) {
      flightVisible = Boolean(visible);
      if (!flightVisible) controlsMinimized = false;
      applyVisibility();
    },
    setControlsHidden,
    setStatus(text) { status.textContent = text; },
    setSpeed(speed) { speedBox.querySelector('.flight-speed').textContent = `${speed.toFixed(1)} u/s`; },
    setCameraMode(mode) {
      const isCockpit = mode === 'cockpit';
      modeBox.querySelector('.flight-camera-state').textContent = isCockpit ? 'COCKPIT' : 'EXTERNAL';
      cameraButton.textContent = isCockpit ? 'SWITCH TO EXTERNAL' : 'SWITCH TO COCKPIT';
    },
    setGestureVideo(video) {
      if (video && video.parentElement !== gesturePreview) gesturePreview.replaceChildren(video);
    },
    setGestureEnabled(enabled) {
      gestureButton.textContent = enabled ? 'STOP HAND CONTROL' : 'ENABLE HAND CONTROL';
      gestureButton.classList.toggle('active', enabled);
      gesturePanel.hidden = !enabled;
      if (!enabled) gestureStatus.textContent = 'CAMERA OFF';
    },
    setGestureStatus(text) { gestureStatus.textContent = text; },
    setAutopilot(active, targetId = '') {
      autoButton.dataset.active = active ? 'true' : 'false';
      autoButton.classList.toggle('active', active);
      autoButton.textContent = active ? 'STOP AUTO-PILOT' : 'AUTO-PILOT';
      if (targetId) select.value = targetId;
    },
    getTargetId() { return select.value; },
  };
}
