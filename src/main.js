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
import { BackgroundTextRing } from './objects/BackgroundTextRing.js';
import { AsteroidBelt } from './objects/AsteroidBelt.js';
import { BackgroundTextRing } from './objects/BackgroundTextRing.js';
import { createHUD } from './ui/hud.js';
import { InfoPanel } from './ui/infoPanel.js';
import { Labels } from './ui/labels.js';
import { bodyName } from './ui/i18n.js';
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
  orbitRadius(p) {
    if (p.isMoon) {
      const viz = vizRadiusOf(p.parent.data, false) * p.data.vizDistanceFactor;
      return lerp(viz, p.data.distanceKm * KM_TO_UNIT, scaleState.mix);
    }
    if (!p.data.distanceAU) return 0;
    return lerp(vizOrbitOfAU(p.data.distanceAU), p.data.distanceAU * AU_UNIT, scaleState.mix);
  },
  orbitRadiusOfAU(au) {
    return lerp(vizOrbitOfAU(au), au * AU_UNIT, scaleState.mix);
  },
};

<<<<<<< HEAD
// The overview is fitted around Pluto too (39.5 AU semi-major axis), not
// just Neptune. The brand ring is scaled from the same system radius so its
// complete circumference stays in frame when switching scale modes.
const systemRadius = (mix) => lerp(vizOrbitOfAU(39.5), 39.5 * AU_UNIT, mix);
// 1.50× leaves room for Pluto near aphelion before the ring band begins.
const ringRadiusOf = (mix) => systemRadius(mix) * 1.50;
const defaultCameraPos = (mix, out) => {
  const verticalHalfFov = THREE.MathUtils.degToRad(50) / 2;
  const aspect = Math.max(0.25, window.innerWidth / Math.max(1, window.innerHeight));
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
  // The extra margin accounts for the slight tilt of the camera and keeps
  // the full circular ring visible on portrait/mobile screens as well.
  const distance = (ringRadiusOf(mix) * 1.25) / Math.tan(limitingHalfFov);
  return out.set(0, distance * 0.42, distance);
};
=======
// Camera overview positions for each scale mode.
const DEFAULT_CAM_VIZ = new THREE.Vector3(0, 115, 255);
const DEFAULT_CAM_TRUE = new THREE.Vector3(0, 1050, 2400);
// Representative system radius, used to scale the background inscription and
// to frame the complete system in the overview camera.
const systemRadius = (mix) => lerp(vizOrbitOfAU(30.05), 30.05 * AU_UNIT, mix);
>>>>>>> f5f151341652102d66d771f5d749347440f4c8d5

const defaultCameraPos = (mix, out) => {
  const direction = DEFAULT_CAM_VIZ.clone().lerp(DEFAULT_CAM_TRUE, mix).normalize();
  const verticalHalfFov = THREE.MathUtils.degToRad(50) / 2;
  const aspect = Math.max(window.innerWidth / Math.max(window.innerHeight, 1), 0.1);
  const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
  const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
  // The inscription reaches about 1.43x the outer orbit; reserve extra room
  // so the entire solar system and the full text circle fit in the overview.
  const visualExtent = systemRadius(mix) * 1.46;
  const distance = (visualExtent / Math.sin(limitingHalfFov)) * 1.08;
  return out.copy(direction).multiplyScalar(distance);
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
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxDistance = 26000;
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
  // Keep the camera inside the background star sphere even when True Scale
  // or a narrow portrait overview requires a much longer camera distance.
  const starfieldRadius = Math.max(12000, ringRadiusOf(1) * 8);
  scene.add(createStarfield(textures, { radius: starfieldRadius }));

  setStatus('BUILDING PJMC SUKHPUR BRAND RING…');
  const brandRing = new BackgroundTextRing();
  brandRing.setRadius(ringRadiusOf(scaleState.mix));
  scene.add(brandRing.group);

  // One complete 360-degree PJMC Sukhpur inscription, outside the outer orbit.
  const backgroundTextRing = new BackgroundTextRing('PJMC Sukhpur');
  backgroundTextRing.group.scale.setScalar(systemRadius(scaleState.mix));
  scene.add(backgroundTextRing.group);

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
    infoPanel.show(entry.data, entry.parentName);
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
    activeCamTween = addTween({
      duration: 1.2,
      onUpdate(e) {
        camera.position.lerpVectors(startCam, endCam, e);
        controls.target.lerpVectors(startTarget, _v1.set(0, 0, 0), e);
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
  const bodyList = entries.map((e) => ({
    id: e.id,
    name: e.name,
    hiName: bodyName(e.id, e.name, 'hi'),
    isMoon: e.isMoon,
  }));
  const infoPanel = new InfoPanel(() => releaseFocus());
  let interfaceLanguage = 'en';
  let labels;
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
      onSetLanguage: (language) => {
        interfaceLanguage = language;
        infoPanel.setLanguage(language);
        labels.setLanguage(language);
      },
    },
    bodyList,
  );
  hud.setActiveSpeed(speedIndex);
  hud.setPlaying(playing);

  labels = new Labels(
    document.getElementById('labels'),
    entries.map((e) => ({ id: e.id, name: e.name, hiName: bodyName(e.id, e.name, 'hi'), isMoon: e.isMoon, parentId: e.parentId, body: e.body })),
    (id) => focusBody(entryById.get(id)),
  );

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
    const locale = interfaceLanguage === 'hi' ? 'hi-IN' : 'en-IN';
    const value = new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Kolkata',
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    }).format(d);
    hud.setDate(`${value} IST`);
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
    brandRing.setRadius(ringRadiusOf(scaleState.mix));

    followUpdate();
    backgroundTextRing.group.scale.setScalar(systemRadius(scaleState.mix));
    controls.update();
    labels.update(camera, focusSystemId());

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
