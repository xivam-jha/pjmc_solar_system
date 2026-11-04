/**
 * PJMC Space Explorer — LaunchSequence.
 * Cinematic Earth rocket launchpad sequence: countdown 5 -> 4 -> 3 -> 2 -> 1 -> LIFTOFF!,
 * launch smoke/sparks, rocket liftoff into orbit, dynamic camera tracking,
 * and a prominent SKIP INTRO button.
 */

import * as THREE from 'three';
import { audioSystem } from './AudioSystem.js';

export class LaunchSequence {
  constructor(scene, camera, rocket, onComplete) {
    this.scene = scene;
    this.camera = camera;
    this.rocket = rocket;
    this.onComplete = onComplete;

    this.active = false;
    this.elapsed = 0;
    this.stage = 0; // 0=countdown, 1=liftoff, 2=ascent
    this.countdownSeconds = 5;

    this.#buildPlatform();
    this.#buildDOM();
  }

  #buildPlatform() {
    this.gantryGroup = new THREE.Group();

    // 1. Proportional High-Tech Launch Base (calibrated to planet curvature)
    const baseGeo = new THREE.CylinderGeometry(0.55, 0.65, 0.12, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      metalness: 0.88,
      roughness: 0.28,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.06;
    this.gantryGroup.add(base);

    // Launch ring with blue neon perimeter lights
    const ringGeo = new THREE.TorusGeometry(0.58, 0.02, 6, 24);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.gantryGroup.add(ring);

    // 2. Launch Tower Support Towers
    const towerGeo = new THREE.BoxGeometry(0.08, 1.4, 0.08);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x2d323b,
      metalness: 0.9,
      roughness: 0.35,
    });

    const tower1 = new THREE.Mesh(towerGeo, towerMat);
    tower1.position.set(-0.35, 0.7, -0.2);
    const tower2 = new THREE.Mesh(towerGeo, towerMat);
    tower2.position.set(-0.35, 0.7, 0.2);
    this.gantryGroup.add(tower1, tower2);

    // Gantry walkbridge
    const bridgeGeo = new THREE.BoxGeometry(0.28, 0.04, 0.1);
    const bridge = new THREE.Mesh(bridgeGeo, towerMat);
    bridge.position.set(-0.18, 1.05, 0);
    this.gantryGroup.add(bridge);

    // 3. Launchpad Floodlights
    const floodlight = new THREE.PointLight(0x00d4ff, 1.8, 8);
    floodlight.position.set(0, 0.4, 0.8);
    this.gantryGroup.add(floodlight);

    // Hidden initially
    this.gantryGroup.visible = false;
    this.scene.add(this.gantryGroup);
  }

  #buildDOM() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'pjmc-launch-overlay hidden';
    this.overlay.style.display = 'none';

    this.countdownEl = document.createElement('div');
    this.countdownEl.className = 'pjmc-countdown-number';
    this.countdownEl.textContent = '5';

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'pjmc-launch-status';
    this.statusEl.textContent = 'SYSTEMS CHECK…';

    this.brandHeaderEl = document.createElement('div');
    this.brandHeaderEl.className = 'pjmc-launch-brand-tag';
    this.brandHeaderEl.innerHTML = `
      <span class="launch-brand-lead">PJMC STUDENT SPACE PROGRAM</span>
      <span class="launch-brand-sub">SPACECRAFT PJMC-01 • PAWAN JHA MATHEMATICS CLASSES</span>
    `;

    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'pjmc-skip-intro-btn';
    this.skipBtn.innerHTML = 'SKIP INTRO ⏭';
    this.skipBtn.setAttribute('aria-label', 'Skip Launch Sequence');

    this.skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });

    this.overlay.append(this.brandHeaderEl, this.statusEl, this.countdownEl, this.skipBtn);
    document.body.append(this.overlay);
  }

  /** Start launch countdown & liftoff on Earth */
  start(earthPosition, onCompleteOrRadius, maybeSkip) {
    this.active = true;
    this.elapsed = 0;
    this.stage = 0;
    this.countdownSeconds = 5;

    let earthRadius = 2.16; // Explore mode Earth radius
    if (typeof onCompleteOrRadius === 'function') {
      this.onComplete = onCompleteOrRadius;
      this.onSkip = maybeSkip;
    } else if (typeof onCompleteOrRadius === 'number') {
      earthRadius = Math.max(onCompleteOrRadius, 2.0);
      if (typeof maybeSkip === 'function') this.onComplete = maybeSkip;
    }
    this.earthRadius = earthRadius;

    // 1. Position launchpad on the SUNLIT surface of Earth
    this.earthPos = earthPosition ? earthPosition.clone() : new THREE.Vector3(0, 0, 0);
    const sunDir = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), this.earthPos).normalize();
    if (sunDir.lengthSq() < 0.1) sunDir.set(1, 0, 0);

    // Sunlit launch site with ~25 deg latitude for beautiful horizon perspective
    this.surfaceNormal = sunDir.clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35)
      .add(new THREE.Vector3(0, 0.42, 0))
      .normalize();

    this.launchPos = this.earthPos.clone().addScaledVector(this.surfaceNormal, earthRadius);

    // Surface tangents for smooth circular camera orbit
    this.tangentX = new THREE.Vector3().crossVectors(this.surfaceNormal, new THREE.Vector3(0, 1, 0)).normalize();
    if (this.tangentX.lengthSq() < 0.05) this.tangentX.set(1, 0, 0);
    this.tangentZ = new THREE.Vector3().crossVectors(this.surfaceNormal, this.tangentX).normalize();

    // Orient gantry cradle to sit naturally on Earth's spherical curve
    this.gantryGroup.position.copy(this.launchPos);
    this.gantryGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.surfaceNormal);
    this.gantryGroup.visible = true;

    // Place rocket upright in launch cradle on Earth (+normal launch)
    if (this.rocket) {
      this.rocket.setVisible(true);
      const rocketLaunchPos = this.launchPos.clone().addScaledVector(this.surfaceNormal, 0.42);
      this.rocket.teleport(
        rocketLaunchPos,
        rocketLaunchPos.clone().addScaledVector(this.surfaceNormal, 10) // nose pointed out to space
      );
    }

    // Initial cinematic camera angle looking up at the rocket with Earth curving below
    const initCam = this.launchPos.clone()
      .addScaledVector(this.tangentX, 2.4)
      .addScaledVector(this.tangentZ, 1.5)
      .addScaledVector(this.surfaceNormal, 0.85);
    this.camera.position.copy(initCam);
    if (this.rocket) {
      this.camera.lookAt(this.rocket.root.position);
    } else {
      this.camera.lookAt(this.launchPos);
    }

    this.overlay.style.display = 'flex';
    this.overlay.classList.remove('hidden');
    this.overlay.classList.add('active');
    this.countdownEl.textContent = '5';
    this.statusEl.textContent = 'IGNITION SEQUENCE INITIALIZED';

    audioSystem.playBeep(880, 0.18);
  }

  update(dt) {
    if (!this.active) return;
    this.elapsed += dt;

    // Stage 0: 5-second countdown with orbital camera sweep
    if (this.stage === 0) {
      const remaining = Math.max(0, Math.ceil(5 - this.elapsed));
      if (remaining !== this.countdownSeconds && remaining > 0) {
        this.countdownSeconds = remaining;
        this.countdownEl.textContent = String(remaining);
        this.countdownEl.classList.remove('pulse');
        void this.countdownEl.offsetWidth; // re-trigger animation
        this.countdownEl.classList.add('pulse');
        audioSystem.playBeep(880, 0.18);
      }

      // Camera gentle orbit around the rocket showing the sunlit Earth below
      const angle = this.elapsed * 0.45;
      const camPos = this.launchPos.clone()
        .addScaledVector(this.tangentX, Math.cos(angle) * 3.0)
        .addScaledVector(this.tangentZ, Math.sin(angle) * 3.0)
        .addScaledVector(this.surfaceNormal, 0.85);
      this.camera.position.copy(camPos);
      if (this.rocket) {
        // Countdown: engine must remain visually OFF and completely silent
        this.rocket.update(dt, 0.0, 0.0, false);
        this.camera.lookAt(this.rocket.root.position);
      }

      if (this.elapsed >= 5.0) {
        // LIFTOFF!
        this.stage = 1;
        this.countdownEl.textContent = 'LIFTOFF!';
        this.countdownEl.classList.add('liftoff');
        this.statusEl.textContent = 'MAIN ENGINES AT FULL POWER';
        audioSystem.playBeep(1760, 0.5);
        audioSystem.startEngine();
        audioSystem.setEngineThrottle(1.0, true);
        if (this.rocket) {
          this.rocket.update(dt, 1.0, 1.0, true);
        }
      }
    }
    // Stage 1: Vertical Ascent into Orbit (duration ~4.0s)
    else if (this.stage === 1) {
      const ascentTime = this.elapsed - 5.0;
      const verticalSpeed = Math.min(ascentTime * 3.5 + (ascentTime ** 2) * 1.5, 18);

      // Rocket ascends upward along surface normal into space
      if (this.rocket) {
        this.rocket.root.position.addScaledVector(this.surfaceNormal, verticalSpeed * dt);
        this.rocket.update(dt, 1.0, 1.0, true);
      }

      // Camera smoothly tracks behind rocket showing Earth receding below
      if (this.rocket) {
        const rocketPos = this.rocket.root.position;
        const targetCamPos = rocketPos.clone()
          .addScaledVector(this.surfaceNormal, -1.5)
          .addScaledVector(this.tangentX, 1.0);
        this.camera.position.lerp(targetCamPos, dt * 3.2);
        this.camera.lookAt(rocketPos.clone().addScaledVector(this.surfaceNormal, 2.5));
      }

      if (ascentTime >= 4.0) {
        this.finish();
      }
    }
  }

  skip() {
    if (!this.active) return;
    if (this.rocket) {
      this.rocket.update(0.016, 0.0, 0.0, false);
    }
    audioSystem.setEngineThrottle(0.0, false);
    this.stop();
    if (this.onSkip) {
      this.onSkip();
    } else {
      this.finish();
    }
  }

  stop() {
    this.active = false;
    this.overlay.style.display = 'none';
    this.overlay.classList.add('hidden');
    this.overlay.classList.remove('active');
    this.gantryGroup.visible = false;
  }

  finish() {
    this.stop();

    // Position rocket ready in Low Earth Orbit (LEO) cruising over sunlit Earth
    const earthR = this.earthRadius || 2.16;
    const orbitPos = this.earthPos.clone().addScaledVector(this.surfaceNormal, earthR * 1.5);
    const forwardDir = this.tangentX.clone().applyAxisAngle(this.surfaceNormal, 0.15).normalize();
    const lookTarget = orbitPos.clone().addScaledVector(forwardDir, 10);

    if (this.rocket) {
      this.rocket.teleport(orbitPos, lookTarget);
      this.rocket.update(0.016, 0.0, 0.0, false);
    }

    audioSystem.startEngine();
    audioSystem.setEngineThrottle(0.0, false);

    this.onComplete?.(
      this.rocket ? this.rocket.root.position : orbitPos,
      this.rocket ? this.rocket.root.quaternion : new THREE.Quaternion()
    );
  }

  destroy() {
    this.stop();
    this.overlay.remove();
    this.scene.remove(this.gantryGroup);
  }

  dispose() {
    this.destroy();
  }
}
