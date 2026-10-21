/**
 * Solar System Explorer — entry point.
 *
 * Owns the renderer, camera, simulation clock, dual scale system
 * (visualization <-> true scale), body focus/follow, picking, and UI wiring.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  CELESTIAL_BODIES,
  SUN_DATA,
  SPEED_PRESETS,
  DEFAULT_SPEED_INDEX,
  J2000_MS,
  AU_KM,
} from './data/celestialBodies.js';
import { createTextureSet } from './textures/proceduralTextures.js';
import { Sun } from './objects/Sun.js';
import { Planet } from './objects/Planet.js';
import { createStarfield } from './objects/Starfield.js';
import { AsteroidBelt } from './objects/AsteroidBelt.js';
import { BrandingArch } from './objects/BrandingArch.js';
import { Spacecraft } from './objects/Spacecraft.js';
import { HandGestureController } from './objects/HandGestureController.js';
import { createHUD } from './ui/hud.js';
import { createSpacecraftHUD } from './ui/spacecraftHUD.js';
import { InfoPanel } from './ui/infoPanel.js';
import { Labels } from './ui/labels.js';
import './styles.css';

/* ------------------------------------------------------------------ */
/* Scale system                                                        */
/* ------------------------------------------------------------------ */

// True scale: 1 AU = 60 world units, everything proportional.
const AU_UNIT = 60;
const KM_TO_UNIT = AU_UNIT / AU_KM;

// Visualization scale: power-law compression keeps every body visible and
// every orbit inside one comfortable camera view (see README for choices).
const vizRadiusOf = (data, isMoon) =>
  Math.max(0.9 * (data.diameterKm / 12742) ** 0.45, isMoon ? 0.14 : 0.3);
const vizOrbitOfAU = (au) => 11 + 16 * au ** 0.65;
const trueRadiusOf = (data) => data.diameterKm * 0.5 * KM_TO_UNIT;

const scaleState = { mix: 0 }; // 0 = visualization, 1 = true scale
const lerp = (a, b, t) => a + (b - a) * t;

const scaleAPI = {
  bodyRadius(p) {
    return lerp(vizRadiusOf(p.data, p.isMoon), trueRadiusOf(p.data), scaleState.mix);
  },
  orbitRadius(p, days = 0) {
    if (p.isMoon) {
      const viz = vizRadiusOf(p.parent.data, false) * p.data.vizDistanceFactor;
      return lerp(viz, p.data.distanceKm * KM_TO_UNIT, scaleState.mix);
    }
    if (!p.data.distanceAU) return 0;
    const elements = p.data.orbitElements;
    const centuries = THREE.MathUtils.clamp(days / 36525, -50, 10);
    const aAU = p.data.distanceAU + (elements?.aRate ?? 0) * centuries;
    return lerp(vizOrbitOfAU(aAU), aAU * AU_UNIT, scaleState.mix);
  },
  orbitRadiusOfAU(au) {
    return lerp(vizOrbitOfAU(au), au * AU_UNIT, scaleState.mix);
  },
};

// Representative system radius, used to scale both the 3D branding and overview.
const systemRadius = (mix) => lerp(vizOrbitOfAU(30.05), 30.05 * AU_UNIT, mix);
const overviewTarget = (mix, out) => out.set(0, systemRadius(mix) * 1.12, 0);

// Fit the system plus the complete PJMC semicircular arch. On narrow screens,
// horizontal fit becomes the limiting dimension and the initial view pulls back.
function overviewDistance(mix) {
  const r = systemRadius(mix);
  const width = r * 4.5;
  const height = r * 4.55;
  const halfFov = THREE.MathUtils.degToRad(50 / 2);
  const margin = 0.78;
  const aspect = Math.max(window.innerWidth / Math.max(window.innerHeight, 1), 0.35);
  return Math.max(
    height / (2 * Math.tan(halfFov) * margin),
    width / (2 * Math.tan(halfFov) * aspect * margin),
  );
}

const defaultCameraPos = (mix, out) => {
  const target = overviewTarget(mix, new THREE.Vector3());
  const distance = overviewDistance(mix);
  const elevationRatio = 0.18;
  return out.set(0, target.y + distance * elevationRatio, distance * Math.sqrt(1 - elevationRatio ** 2));
};

/* ------------------------------------------------------------------ */
/* Tween helper                                                        */
/* ------------------------------------------------------------------ */

const tweens = [];
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function addTween({ duration, onUpdate, onComplete }) {
  const tween = { t: 0, duration, onUpdate, onComplete, done: false };
  tweens.push(tween);
  return tween;
}

function updateTweens(dt) {
  for (const tw of tweens) {
    if (tw.done) continue;
    tw.t = Math.min(tw.t + dt / tw.duration, 1);
    tw.onUpdate(easeInOutCubic(tw.t));
    if (tw.t >= 1) {
      tw.done = true;
      tw.onComplete?.();
    }
  }
  for (let i = tweens.length - 1; i >= 0; i--) {
    if (tweens[i].done) tweens.splice(i, 1);
  }
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

const loadingStatus = document.getElementById('loading-status');
const setStatus = (text) => {
  loadingStatus.textContent = text;
};

async function init() {
  /* ---------- renderer / scene / camera ---------- */
  setStatus('CREATING RENDERER…');
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    // Logarithmic depth handles the huge near/far range of true scale
    // (sub-unit moons up to a 12,000-unit starfield) without z-fighting.
    logarithmicDepthBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000308);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  document.getElementById('app').append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.005, 50000);
  defaultCameraPos(0, camera.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  overviewTarget(0, controls.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = Math.max(26000, overviewDistance(1) * 1.5);
  controls.minDistance = 0.01;

  /* ---------- lighting ---------- */
  // Single point light at the Sun (decay 0: at true scale, physical falloff
  // would leave the outer planets black) + faint ambient so night sides
  // stay readable.
  scene.add(new THREE.PointLight(0xfff3e0, 2.2, 0, 0));
  scene.add(new THREE.AmbientLight(0x8fa3bd, 0.3));

  /* ---------- post-processing (graceful fallback) ---------- */
  setStatus('SETTING UP POST-PROCESSING…');
  let composer = null;
  let bloomPass = null;
  try {
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] =
      await Promise.all([
        import('three/addons/postprocessing/EffectComposer.js'),
        import('three/addons/postprocessing/RenderPass.js'),
        import('three/addons/postprocessing/UnrealBloomPass.js'),
        import('three/addons/postprocessing/OutputPass.js'),
      ]);
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.65, // strength
      0.4, // radius
      0.95, // threshold — mainly the Sun blooms
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  } catch (err) {
    // The corona sprites and emissive sun still glow without bloom.
    console.info('Bloom post-processing unavailable, falling back to sprite glow.', err);
    composer = null;
  }

  /* ---------- textures ---------- */
  const textures = await createTextureSet((label) => setStatus(`GENERATING TEXTURES — ${label}`));

  /* ---------- celestial bodies ---------- */
  setStatus('BUILDING SOLAR SYSTEM…');
  const sun = new Sun(SUN_DATA, textures);
  scene.add(sun.bodyGroup);

  const planets = CELESTIAL_BODIES.map((data) => {
    const planet = new Planet(data, textures);
    scene.add(planet.root);
    return planet;
  });

  // Flat registry of every focusable body.
  const entries = [];
  const entryById = new Map();
  const addEntry = (body, parentEntry) => {
    const entry = {
      id: body.data.id,
      name: body.data.name,
      data: body.data,
      body,
      isMoon: body.isMoon,
      parentId: parentEntry?.id ?? null,
      parentName: parentEntry?.name ?? null,
    };
    entries.push(entry);
    entryById.set(entry.id, entry);
    return entry;
  };
  addEntry(sun, null);
  for (const planet of planets) {
    const planetEntry = addEntry(planet, null);
    for (const moon of planet.moons) addEntry(moon, planetEntry);
  }

  const pickMeshes = entries.map((e) => e.body.surfaceMesh);

  /* ---------- belt + stars ---------- */
  setStatus('SCATTERING ASTEROIDS…');
  const belt = new AsteroidBelt(4500);
  scene.add(belt.mesh);

  setStatus('IGNITING STARFIELD…');
  scene.add(createStarfield(textures));

  // The PJMC wordmark lives in world space high above the outer orbit. It scales
  // with Visualization/True Scale and is never pinned to the screen.
  const baseSystemRadius = systemRadius(0);
  const brandingArch = new BrandingArch(baseSystemRadius);
  brandingArch.setScale(systemRadius(scaleState.mix) / baseSystemRadius);
  scene.add(brandingArch.group);

  // Optional player-controlled vehicle. It stays hidden until Spacecraft mode is opened.
  const spacecraft = new Spacecraft();
  scene.add(spacecraft.group);

  /* ---------- simulation clock ---------- */
  const epochMs = Date.now();
  let simMs = 0;
  let playing = true;
  let speedIndex = DEFAULT_SPEED_INDEX;
  const MAX_SIM_MS = 8.6e15 - epochMs; // keep Date arithmetic valid
  const daysSinceJ2000 = () => (epochMs + simMs - J2000_MS) / 86_400_000;

  /* ---------- focus / follow state ---------- */
  let followed = null;
  let focusTweenActive = false;
  let activeCamTween = null; // only one camera tween may run at a time
  const lastFollowPos = new THREE.Vector3();
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();

  const focusSystemId = () => {
    if (!followed) return null;
    if (followed.isMoon) return followed.parentId;
    return followed.body.moons?.length ? followed.id : null;
  };

  let orbitsEnabled = true;
  function updateOrbitVisibility() {
    const systemId = focusSystemId();
    for (const planet of planets) {
      planet.orbitLine.visible = orbitsEnabled;
      const showMoons = orbitsEnabled && planet.data.id === systemId;
      for (const moon of planet.moons) moon.orbitLine.visible = showMoons;
    }
  }

  function focusBody(entry) {
    followed = entry;
    focusTweenActive = true;
    controls.enabled = false;
    if (activeCamTween) activeCamTween.done = true; // cancel a running tween

    const startCam = camera.position.clone();
    const startTarget = controls.target.clone();
    const bodyPos0 = entry.body.getWorldPosition(_v1);
    const dir = camera.position.clone().sub(bodyPos0);
    if (dir.lengthSq() < 1e-9) dir.set(0.5, 0.35, 1);
    dir.normalize();
    // Bias the arrival direction toward the sunlit side (plus a little
    // elevation) so a focused body isn't seen as a dark disc against glare.
    if (bodyPos0.lengthSq() > 1e-6) {
      const sunward = bodyPos0.clone().multiplyScalar(-1).normalize();
      dir.multiplyScalar(0.45).addScaledVector(sunward, 0.55).normalize();
      dir.y += 0.25;
      dir.normalize();
    }

    activeCamTween = addTween({
      duration: 1.4,
      onUpdate(e) {
        const bodyPos = entry.body.getWorldPosition(_v1);
        // Ringed planets get a wider framing so the rings fit in view.
        const ringSpan = entry.data.rings ? entry.data.rings.outer * 2.6 : 0;
        const dist = Math.max(entry.body.radiusWorld * Math.max(4.5, ringSpan), 0.01);
        const desired = _v2.copy(dir).multiplyScalar(dist).add(bodyPos);
        camera.position.lerpVectors(startCam, desired, e);
        controls.target.lerpVectors(startTarget, bodyPos, e);
      },
      onComplete() {
        focusTweenActive = false;
        controls.enabled = true;
        activeCamTween = null;
        entry.body.getWorldPosition(lastFollowPos);
      },
    });

    hud.setActiveBody(entry.id);
    hud.setFreeCam(false);
    infoPanel.show(entry.data, entry.parentName, entry.body.distanceFromSunAU ?? null);
    updateOrbitVisibility();
  }

  function releaseFocus() {
    followed = null;
    controls.minDistance = 0.01;
    hud.setActiveBody(null);
    hud.setFreeCam(true);
    infoPanel.hide();
    updateOrbitVisibility();
  }

  function resetView() {
    releaseFocus();
    focusTweenActive = true;
    controls.enabled = false;
    if (activeCamTween) activeCamTween.done = true;
    const startCam = camera.position.clone();
    const startTarget = controls.target.clone();
    const endCam = defaultCameraPos(scaleState.mix, new THREE.Vector3());
    const endTarget = overviewTarget(scaleState.mix, new THREE.Vector3());
    activeCamTween = addTween({
      duration: 1.2,
      onUpdate(e) {
        camera.position.lerpVectors(startCam, endCam, e);
        controls.target.lerpVectors(startTarget, endTarget, e);
      },
      onComplete() {
        focusTweenActive = false;
        controls.enabled = true;
        activeCamTween = null;
      },
    });
  }

  // Per-frame follow: keep the camera glued to the moving body.
  function followUpdate() {
    if (!followed || focusTweenActive) return;
    const bodyPos = followed.body.getWorldPosition(_v1);
    const delta = _v2.copy(bodyPos).sub(lastFollowPos);
    camera.position.add(delta);
    controls.target.copy(bodyPos);
    lastFollowPos.copy(bodyPos);
    controls.minDistance = Math.max(followed.body.radiusWorld * 1.5, 0.001);
  }

  /* ---------- scale mode toggle ---------- */
  let scaleMode = 'viz';
  let activeMixTween = null;
  function setScaleMode(mode) {
    if (mode === scaleMode) return;
    scaleMode = mode;
    hud.setScaleMode(mode);
    if (activeMixTween) activeMixTween.done = true;
    const startMix = scaleState.mix;
    const endMix = mode === 'true' ? 1 : 0;

    let prevSystem = systemRadius(startMix);
    activeMixTween = addTween({
      duration: 1.6,
      onUpdate(e) {
        scaleState.mix = lerp(startMix, endMix, e);
        if (!followed) {
          // Free camera: rescale view with the system so the framing holds.
          const sys = systemRadius(scaleState.mix);
          const f = sys / prevSystem;
          prevSystem = sys;
          camera.position.multiplyScalar(f);
          controls.target.multiplyScalar(f);
        }
      },
    });
    // While following a body, re-run the focus tween in parallel so the
    // camera lands at a sensible distance for the body's new size.
    if (followed) focusBody(followed);
  }

  /* ---------- UI ---------- */
  const bodyList = entries.map((e) => ({ id: e.id, name: e.name, isMoon: e.isMoon }));
  const infoPanel = new InfoPanel(() => releaseFocus());
  const hud = createHUD(
    {
      onSelectBody: (id) => focusBody(entryById.get(id)),
      onTogglePlay: () => {
        playing = !playing;
        hud.setPlaying(playing);
      },
      onSetSpeed: (i) => {
        speedIndex = i;
        hud.setActiveSpeed(i);
      },
      onGoToNow: () => {
        simMs = Date.now() - epochMs; // sim time = real present time
        speedIndex = 0; // drop to real time so the clock stays at "now"
        hud.setActiveSpeed(0);
        refreshDateReadout(); // immediate feedback, even while paused
      },
      onSetScaleMode: setScaleMode,
      onResetView: resetView,
      onFreeCamera: releaseFocus,
      onToggleOrbits: (on) => {
        orbitsEnabled = on;
        updateOrbitVisibility();
      },
      onToggleLabels: (on) => labels.setEnabled(on),
      onLanguageChange: (language) => {
        labels.setLanguage(language);
        infoPanel.setLanguage(language);
        refreshDateReadout();
      },
      onSpacecraftToggle: () => {
        if (spacecraftActive) exitSpacecraftMode();
        else startSpacecraftMode();
      },
    },
    bodyList,
  );
  hud.setActiveSpeed(speedIndex);
  hud.setPlaying(playing);

  const labels = new Labels(
    document.getElementById('labels'),
    entries.map((e) => ({ id: e.id, name: e.name, isMoon: e.isMoon, parentId: e.parentId, body: e.body })),
    (id) => focusBody(entryById.get(id)),
  );

  /* ---------- PJMC SPACE EXPLORER flight mode ---------- */
  let spacecraftActive = false;
  let flightCameraMode = 'external';
  let flightLaunchElapsed = 0;
  let flightLaunchDuration = 3.8;
  let flightElapsed = 0;
  let flightSavedCamera = null;
  let flightSavedTarget = null;
  let flightSavedControlsEnabled = true;
  let flightAutopilotTarget = null;
  const keyboardFlightControls = new Set();
  const touchFlightControls = new Set();
  const gestureFlightControls = new Set();
  let handGestureController = null;
  let gestureControlActive = false;
  let gestureControlBusy = false;
  let gestureRequestId = 0;
  const flightVelocity = new THREE.Vector3();
  const flightForward = new THREE.Vector3();
  const flightUp = new THREE.Vector3();
  const flightTemp = new THREE.Vector3();
  const launchStart = new THREE.Vector3();
  const launchEnd = new THREE.Vector3();
  const cockpitLocalOffset = new THREE.Vector3(0, 0.62, -1.02);
  const flightLookRotation = new THREE.Quaternion();
  const externalOrbitRotation = new THREE.Quaternion();
  let flightLookYaw = 0;
  let flightLookPitch = 0;
  let externalCameraDistance = 8.2;
  let flightLookDragging = false;
  let flightLookPointerId = null;
  let flightLookPointerX = 0;
  let flightLookPointerY = 0;
  const localForward = new THREE.Vector3(0, 0, -1);
  const autopilotQuaternion = new THREE.Quaternion();
  let spacecraftHud = null;

  const keyControlMap = new Map([
    ['w', 'forward'], ['arrowup', 'forward'],
    ['s', 'back'], ['arrowdown', 'back'],
    ['a', 'yawLeft'], ['arrowleft', 'yawLeft'],
    ['d', 'yawRight'], ['arrowright', 'yawRight'],
    ['q', 'down'], ['e', 'up'], ['shift', 'boost'],
  ]);

  function setFlightControl(control, pressed) {
    if (pressed) touchFlightControls.add(control);
    else touchFlightControls.delete(control);
  }

  function isFlightControlPressed(control) {
    return keyboardFlightControls.has(control) || touchFlightControls.has(control) || gestureFlightControls.has(control);
  }

  function clearFlightControls() {
    keyboardFlightControls.clear();
    touchFlightControls.clear();
    gestureFlightControls.clear();
  }

  function setFlightCameraMode(mode) {
    flightCameraMode = mode === 'cockpit' ? 'cockpit' : 'external';
    flightLookYaw = 0;
    flightLookPitch = 0;
    spacecraft.setCockpitMode(flightCameraMode === 'cockpit');
    spacecraftHud?.setCameraMode(flightCameraMode);
  }

  function startSpacecraftMode() {
    if (spacecraftActive) return;
    if (activeCamTween) activeCamTween.done = true;
    activeCamTween = null;
    if (activeMixTween) {
      activeMixTween.done = true;
      const currentSystemRadius = systemRadius(scaleState.mix);
      scaleState.mix = scaleMode === 'true' ? 1 : 0;
      const targetSystemRadius = systemRadius(scaleState.mix);
      const scaleCameraBy = targetSystemRadius / Math.max(currentSystemRadius, 1e-6);
      camera.position.multiplyScalar(scaleCameraBy);
      controls.target.multiplyScalar(scaleCameraBy);
      activeMixTween = null;
    }
    focusTweenActive = false;
    releaseFocus();
    flightSavedControlsEnabled = controls.enabled;
    controls.enabled = true;
    flightSavedCamera = camera.position.clone();
    flightSavedTarget = controls.target.clone();
    flightSavedControlsEnabled = true;

    const radius = systemRadius(scaleState.mix);
    spacecraft.group.position.set(0, Math.max(2, radius * 0.12), radius * 1.52);
    flightTemp.set(0, -spacecraft.group.position.y, -spacecraft.group.position.z).normalize();
    spacecraft.group.quaternion.setFromUnitVectors(localForward, flightTemp);
    spacecraft.group.visible = true;
    setFlightCameraMode('external');
    flightVelocity.set(0, 0, 0);
    externalCameraDistance = 8.2;
    flightLaunchElapsed = 0;
    flightElapsed = 0;
    flightLaunchDuration = THREE.MathUtils.clamp(radius * 0.36 / 28, 2.6, 5.2);
    launchStart.copy(spacecraft.group.position);
    launchEnd.set(0, Math.max(1.5, radius * 0.075), radius * 1.14);
    flightAutopilotTarget = null;
    spacecraftActive = true;
    document.body.classList.add('spacecraft-active');
    hud.setSpacecraftActive(true);
    spacecraftHud?.setVisible(true);
    spacecraftHud?.setAutopilot(false);
    spacecraftHud?.setStatus('LAUNCH SEQUENCE');
    spacecraftHud?.setSpeed(0);
    spacecraftHud?.setCameraMode(flightCameraMode);
    updateFlightCamera();
  }

  function exitSpacecraftMode() {
    if (!spacecraftActive) return;
    spacecraftActive = false;
    spacecraft.group.visible = false;
    setFlightCameraMode('external');
    flightAutopilotTarget = null;
    flightVelocity.set(0, 0, 0);
    clearFlightControls();
    document.body.classList.remove('spacecraft-active');
    hud.setSpacecraftActive(false);
    spacecraftHud?.setVisible(false);
    gestureRequestId += 1;
    gestureControlActive = false;
    gestureControlBusy = false;
    if (handGestureController) {
      handGestureController.stop();
      handGestureController = null;
    }
    spacecraftHud?.setGestureEnabled(false);
    gestureFlightControls.clear();
    controls.enabled = flightSavedControlsEnabled;
    if (flightSavedCamera) camera.position.copy(flightSavedCamera);
    if (flightSavedTarget) controls.target.copy(flightSavedTarget);
    controls.update();
    flightSavedCamera = null;
    flightSavedTarget = null;
  }

  function beginAutopilot(targetId) {
    if (!spacecraftActive) return;
    if (!targetId) {
      flightAutopilotTarget = null;
      spacecraftHud?.setAutopilot(false);
      spacecraftHud?.setStatus('MANUAL FLIGHT');
      return;
    }
    const entry = entryById.get(targetId);
    if (!entry || entry.id === 'sun') return;
    flightAutopilotTarget = entry;
    clearFlightControls();
    spacecraftHud?.setAutopilot(true, entry.id);
    spacecraftHud?.setStatus(`AUTO-PILOT · ${entry.name.toUpperCase()}`);
  }

  function updateFlightCamera() {
    if (!spacecraftActive) return;
    if (flightCameraMode === 'cockpit') {
      camera.position.copy(spacecraft.group.localToWorld(cockpitLocalOffset.clone()));
      flightLookRotation.setFromEuler(new THREE.Euler(flightLookPitch - 0.12, flightLookYaw, 0, 'YXZ'));
      camera.quaternion.copy(spacecraft.group.quaternion).multiply(flightLookRotation);
    } else {
      externalOrbitRotation.setFromEuler(new THREE.Euler(flightLookPitch, flightLookYaw, 0, 'YXZ'));
      const offset = new THREE.Vector3(0, 2.9, externalCameraDistance).applyQuaternion(externalOrbitRotation);
      camera.position.copy(spacecraft.group.localToWorld(offset));
      camera.lookAt(spacecraft.group.position);
    }
    camera.updateMatrixWorld();
  }

  function updateSpacecraftFlight(dt) {
    if (!spacecraftActive) return;
    flightElapsed += dt;
    spacecraft.update(dt, flightElapsed);

    if (flightLaunchElapsed < flightLaunchDuration) {
      flightLaunchElapsed += dt;
      const t = THREE.MathUtils.clamp(flightLaunchElapsed / flightLaunchDuration, 0, 1);
      const eased = t * t * (3 - 2 * t);
      spacecraft.group.position.lerpVectors(launchStart, launchEnd, eased);
      if (t >= 1) spacecraftHud?.setStatus('FLIGHT READY · MANUAL CONTROL');
      updateFlightCamera();
      spacecraftHud?.setSpeed(launchStart.distanceTo(launchEnd) / flightLaunchDuration * (6 * t * (1 - t)));
      return;
    }

    const scaleFactor = Math.max(1, systemRadius(scaleState.mix) / 150);
    const maxSpeed = (isFlightControlPressed('boost') ? 54 : 26) * scaleFactor;
    const acceleration = (isFlightControlPressed('boost') ? 42 : 18) * scaleFactor;

    if (flightAutopilotTarget) {
      const target = flightAutopilotTarget;
      target.body.getWorldPosition(_v1);
      const toTarget = _v2.copy(_v1).sub(spacecraft.group.position);
      const approachDistance = Math.max((target.body.radiusWorld || 0.5) * 9, 5 * scaleFactor);
      const desiredPosition = _v1.clone().addScaledVector(toTarget.clone().normalize(), -approachDistance);
      const delta = desiredPosition.sub(spacecraft.group.position);
      const distance = delta.length();
      const directionToPlanet = toTarget.lengthSq() > 1e-8 ? toTarget.normalize() : localForward.clone().applyQuaternion(spacecraft.group.quaternion);
      autopilotQuaternion.setFromUnitVectors(localForward, directionToPlanet);
      spacecraft.group.quaternion.slerp(autopilotQuaternion, Math.min(1, dt * 1.25));
      const autopilotSpeed = Math.min(maxSpeed, Math.max(3 * scaleFactor, distance * 1.6));
      if (distance < Math.max(1.2 * scaleFactor, approachDistance * 0.08)) {
        spacecraft.group.position.copy(desiredPosition);
        flightVelocity.set(0, 0, 0);
        flightAutopilotTarget = null;
        spacecraftHud?.setAutopilot(false);
        spacecraftHud?.setStatus(`ARRIVED · ${target.name.toUpperCase()}`);
      } else {
        flightVelocity.copy(delta.normalize()).multiplyScalar(autopilotSpeed);
        spacecraft.group.position.addScaledVector(flightVelocity, dt);
      }
    } else {
      const yaw = (Number(isFlightControlPressed('yawRight')) - Number(isFlightControlPressed('yawLeft'))) * 0.9;
      spacecraft.group.rotateY(yaw * dt);
      const forwardInput = Number(isFlightControlPressed('forward')) - Number(isFlightControlPressed('back'));
      const verticalInput = Number(isFlightControlPressed('up')) - Number(isFlightControlPressed('down'));
      flightForward.set(0, 0, -1).applyQuaternion(spacecraft.group.quaternion).normalize();
      flightUp.set(0, 1, 0).applyQuaternion(spacecraft.group.quaternion).normalize();
      flightVelocity.addScaledVector(flightForward, forwardInput * acceleration * dt);
      flightVelocity.addScaledVector(flightUp, verticalInput * acceleration * 0.72 * dt);
      flightVelocity.multiplyScalar(Math.exp(-0.3 * dt));
      if (flightVelocity.length() > maxSpeed) flightVelocity.setLength(maxSpeed);
      spacecraft.group.position.addScaledVector(flightVelocity, dt);
    }

    spacecraftHud?.setSpeed(flightVelocity.length());
    updateFlightCamera();
  }

  async function toggleHandGestureControl() {
    if (gestureControlBusy) return;
    gestureControlBusy = true;
    if (gestureControlActive) {
      gestureControlActive = false;
      gestureRequestId += 1;
      gestureFlightControls.clear();
      await handGestureController?.stop();
      handGestureController = null;
      spacecraftHud?.setGestureEnabled(false);
      spacecraftHud?.setGestureStatus('CAMERA OFF');
      gestureControlBusy = false;
      return;
    }

    const requestId = ++gestureRequestId;
    let controller = null;
    try {
      controller = new HandGestureController({
        onFrame: (frame) => {
          gestureFlightControls.clear();
          for (const control of frame.controls || []) gestureFlightControls.add(control);
          if (spacecraftActive && flightCameraMode === 'external' && frame.zoomDelta) {
            externalCameraDistance = THREE.MathUtils.clamp(
              externalCameraDistance * Math.exp(-frame.zoomDelta * 3.5),
              3.5,
              28,
            );
            updateFlightCamera();
          }
        },
        onStatus: (message) => spacecraftHud?.setGestureStatus(message),
      });
      handGestureController = controller;
      spacecraftHud?.setGestureVideo(controller.video);
      spacecraftHud?.setGestureEnabled(true);
      await controller.start();
      if (requestId !== gestureRequestId || !spacecraftActive) {
        await controller.stop();
        if (handGestureController === controller) handGestureController = null;
        spacecraftHud?.setGestureEnabled(false);
        gestureControlBusy = false;
        return;
      }
      gestureControlActive = true;
      gestureControlBusy = false;
    } catch (error) {
      gestureFlightControls.clear();
      await controller?.stop();
      if (handGestureController === controller) handGestureController = null;
      if (requestId === gestureRequestId && spacecraftActive) {
        gestureControlActive = false;
        spacecraftHud?.setGestureEnabled(false);
        spacecraftHud?.setGestureStatus('CAMERA OFF');
        window.alert(`Hand control could not start. ${error?.message || 'Check camera permission and internet connection.'}`);
      }
      // Do not disturb a newer gesture session if the previous start was cancelled.
      if (requestId === gestureRequestId) gestureControlBusy = false;
    }
  }

  spacecraftHud = createSpacecraftHUD({
    targets: entries.filter((entry) => !entry.isMoon && entry.id !== 'sun').map((entry) => ({ id: entry.id, name: entry.name })),
    onCameraToggle: () => setFlightCameraMode(flightCameraMode === 'external' ? 'cockpit' : 'external'),
    onExit: exitSpacecraftMode,
    onAutopilot: beginAutopilot,
    onControl: setFlightControl,
    onGestureToggle: toggleHandGestureControl,
  });
  window.addEventListener('keydown', (event) => {
    if (!spacecraftActive) return;
    if (event.key === 'Escape') {
      exitSpacecraftMode();
      return;
    }
    const control = keyControlMap.get(event.key.toLowerCase());
    if (control) {
      event.preventDefault();
      keyboardFlightControls.add(control);
    }
  });
  window.addEventListener('keyup', (event) => {
    const control = keyControlMap.get(event.key.toLowerCase());
    if (control) keyboardFlightControls.delete(control);
  });
  window.addEventListener('blur', clearFlightControls);

  // Pointer look, external-camera wheel zoom, and mobile two-finger pinch zoom.
  const activeFlightPointers = new Map();
  let lastPinchDistance = null;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!spacecraftActive || event.button > 0) return;
    if (event.pointerType === 'touch') {
      activeFlightPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { renderer.domElement.setPointerCapture(event.pointerId); } catch {}
      if (activeFlightPointers.size >= 2) {
        const pts = [...activeFlightPointers.values()];
        lastPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        flightLookDragging = false;
        flightLookPointerId = null;
        return;
      }
    }
    flightLookDragging = true;
    flightLookPointerId = event.pointerId;
    flightLookPointerX = event.clientX;
    flightLookPointerY = event.clientY;
    try { renderer.domElement.setPointerCapture(event.pointerId); } catch {}
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!spacecraftActive) return;
    if (event.pointerType === 'touch' && activeFlightPointers.has(event.pointerId)) {
      activeFlightPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activeFlightPointers.size >= 2) {
        const pts = [...activeFlightPointers.values()];
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (lastPinchDistance !== null && flightCameraMode === 'external') {
          const change = distance - lastPinchDistance;
          externalCameraDistance = THREE.MathUtils.clamp(externalCameraDistance * Math.exp(-change * 0.006), 3.5, 28);
          updateFlightCamera();
        }
        lastPinchDistance = distance;
        return;
      }
    }
    if (!flightLookDragging || event.pointerId !== flightLookPointerId) return;
    const dx = event.clientX - flightLookPointerX;
    const dy = event.clientY - flightLookPointerY;
    flightLookPointerX = event.clientX;
    flightLookPointerY = event.clientY;
    flightLookYaw = THREE.MathUtils.euclideanModulo(flightLookYaw - dx * 0.004, Math.PI * 2);
    flightLookPitch = THREE.MathUtils.clamp(flightLookPitch + dy * 0.0035, -1.08, 1.08);
    updateFlightCamera();
  });
  const stopFlightLook = (event) => {
    if (event?.pointerType === 'touch' && activeFlightPointers.has(event.pointerId)) {
      activeFlightPointers.delete(event.pointerId);
      if (activeFlightPointers.size < 2) lastPinchDistance = null;
      if (activeFlightPointers.size === 1) {
        const [id, point] = [...activeFlightPointers.entries()][0];
        flightLookDragging = true;
        flightLookPointerId = id;
        flightLookPointerX = point.x;
        flightLookPointerY = point.y;
      } else {
        flightLookDragging = false;
        flightLookPointerId = null;
      }
      return;
    }
    if (event && flightLookPointerId !== null && event.pointerId !== flightLookPointerId) return;
    flightLookDragging = false;
    flightLookPointerId = null;
  };
  renderer.domElement.addEventListener('pointerup', stopFlightLook);
  renderer.domElement.addEventListener('pointercancel', stopFlightLook);
  renderer.domElement.addEventListener('lostpointercapture', stopFlightLook);
  renderer.domElement.addEventListener('wheel', (event) => {
    if (!spacecraftActive || flightCameraMode !== 'external') return;
    event.preventDefault();
    externalCameraDistance = THREE.MathUtils.clamp(externalCameraDistance * Math.exp(event.deltaY * 0.001), 3.5, 28);
    updateFlightCamera();
  }, { passive: false });

  /* ---------- picking ---------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downX = 0;
  let downY = 0;
  let pointerDown = false;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDown = true;
    downX = e.clientX;
    downY = e.clientY;
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (spacecraftActive) { pointerDown = false; return; }
    if (!pointerDown) return;
    pointerDown = false;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // drag, not click
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickMeshes, false);
    if (hits.length > 0) {
      focusBody(entryById.get(hits[0].object.userData.bodyId));
    } else {
      releaseFocus(); // empty space -> free orbit mode
    }
  });

  /* ---------- resize ---------- */
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer?.setSize(w, h);
    bloomPass?.setSize(w, h);
  });

  /* ---------- render loop ---------- */
  const timer = new THREE.Timer();
  let dateAccum = 1; // force immediate first readout

  function refreshDateReadout() {
    const d = new Date(epochMs + simMs);
    const isHindi = hud.getLanguage() === 'hi';
    const formatted = new Intl.DateTimeFormat(isHindi ? 'hi-IN' : 'en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    }).format(d);
    hud.setDate(`${formatted} IST`);
  }

  function animate() {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);

    updateTweens(dt);
    if (playing) {
      simMs = Math.min(simMs + dt * 1000 * SPEED_PRESETS[speedIndex].mult, MAX_SIM_MS);
    }
    const days = daysSinceJ2000();

    sun.update(days, scaleAPI, dt);
    for (const planet of planets) planet.update(days, scaleAPI);
    belt.update(days, scaleAPI.orbitRadiusOfAU);
    brandingArch.setScale(systemRadius(scaleState.mix) / baseSystemRadius);

    if (spacecraftActive) {
      updateSpacecraftFlight(dt);
    } else {
      followUpdate();
      controls.update();
      labels.update(camera, focusSystemId());
    }

    if (composer) composer.render();
    else renderer.render(scene, camera);

    dateAccum += dt;
    if (dateAccum > 0.25) {
      dateAccum = 0;
      refreshDateReadout();
    }
  }

  // Prime everything once so the first visible frame is correct.
  updateOrbitVisibility();
  sun.update(daysSinceJ2000(), scaleAPI, 0);
  for (const planet of planets) planet.update(daysSinceJ2000(), scaleAPI);
  belt.update(daysSinceJ2000(), scaleAPI.orbitRadiusOfAU);
  brandingArch.setScale(systemRadius(scaleState.mix) / baseSystemRadius);
  refreshDateReadout();

  renderer.setAnimationLoop(animate);
  document.getElementById('loading').classList.add('hidden');
}

// Small timer delay so the static loading overlay paints before the heavy
// texture-generation work starts. (Deliberately not requestAnimationFrame:
// rAF never fires in hidden/background tabs, which would leave the app
// stuck on the loading screen until the tab is focused.)
setTimeout(() => {
  init().catch((err) => {
    console.error(err);
    setStatus('INITIALIZATION FAILED — SEE CONSOLE');
  });
}, 30);
