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

    // 1. Hexagonal Launch Base
    const baseGeo = new THREE.CylinderGeometry(8, 9, 1.2, 6);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x222831,
      metalness: 0.85,
      roughness: 0.35,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.6;
    this.gantryGroup.add(base);

    // Launch ring with blue neon perimeter lights
    const ringGeo = new THREE.TorusGeometry(7.2, 0.2, 8, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    this.gantryGroup.add(ring);

    // 2. Launch Tower Support Towers
    const towerGeo = new THREE.BoxGeometry(0.8, 12, 0.8);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x393e46,
      metalness: 0.9,
      roughness: 0.4,
    });

    const tower1 = new THREE.Mesh(towerGeo, towerMat);
    tower1.position.set(-4.5, 6, -3);
    const tower2 = new THREE.Mesh(towerGeo, towerMat);
    tower2.position.set(-4.5, 6, 3);
    this.gantryGroup.add(tower1, tower2);

    // Gantry walkbridge
    const bridgeGeo = new THREE.BoxGeometry(3.5, 0.4, 1.4);
    const bridge = new THREE.Mesh(bridgeGeo, towerMat);
    bridge.position.set(-2.5, 8.5, 0);
    this.gantryGroup.add(bridge);

    // 3. Launchpad Floodlights
    const floodlight = new THREE.PointLight(0x00d4ff, 2.5, 30);
    floodlight.position.set(0, 1.5, 5);
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

    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'pjmc-skip-intro-btn';
    this.skipBtn.innerHTML = 'SKIP INTRO ⏭';
    this.skipBtn.setAttribute('aria-label', 'Skip Launch Sequence');

    this.skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });

    this.overlay.append(this.statusEl, this.countdownEl, this.skipBtn);
    document.body.append(this.overlay);
  }

  /** Start launch countdown & liftoff on Earth */
  start(earthPosition, onCompleteOrRadius, maybeSkip) {
    this.active = true;
    this.elapsed = 0;
    this.stage = 0;
    this.countdownSeconds = 5;

    let earthRadius = 1.2;
    if (typeof onCompleteOrRadius === 'function') {
      this.onComplete = onCompleteOrRadius;
      this.onSkip = maybeSkip;
    } else if (typeof onCompleteOrRadius === 'number') {
      earthRadius = onCompleteOrRadius;
      if (typeof maybeSkip === 'function') this.onComplete = maybeSkip;
    }

    // Position launchpad on sunlit surface of Earth
    this.earthPos = earthPosition ? earthPosition.clone() : new THREE.Vector3(0, 0, 0);
    this.launchPos = this.earthPos.clone().add(new THREE.Vector3(0, earthRadius + 0.1, 0));

    this.gantryGroup.position.copy(this.launchPos);
    this.gantryGroup.visible = true;

    // Place rocket upright on launchpad (+Y vertical launch)
    if (this.rocket) {
      this.rocket.setVisible(true);
      this.rocket.teleport(
        this.launchPos.clone().add(new THREE.Vector3(0, 2.8, 0)),
        this.launchPos.clone().add(new THREE.Vector3(0, 50, 0)) // nose pointed UP
      );
    }

    // Position camera for cinematic hero angle looking up at the rocket
    this.camera.position.copy(this.launchPos).add(new THREE.Vector3(12, 4.5, 14));
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

    // Stage 0: 5-second countdown
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

      // Camera gentle orbit during countdown
      const angle = this.elapsed * 0.35;
      this.camera.position.set(
        this.launchPos.x + Math.cos(angle) * 16,
        this.launchPos.y + 4.5 + Math.sin(this.elapsed * 0.5) * 1.5,
        this.launchPos.z + Math.sin(angle) * 16
      );
      this.camera.lookAt(this.rocket.root.position);

      if (this.elapsed >= 5.0) {
        // LIFTOFF!
        this.stage = 1;
        this.countdownEl.textContent = 'LIFTOFF!';
        this.countdownEl.classList.add('liftoff');
        this.statusEl.textContent = 'MAIN ENGINES AT FULL POWER';
        audioSystem.playBeep(1760, 0.5);
        audioSystem.startEngine();
        audioSystem.setEngineThrottle(1.0, true);
      }
    }
    // Stage 1: Vertical Ascent into Orbit (duration ~4.5s)
    else if (this.stage === 1) {
      const ascentTime = this.elapsed - 5.0;
      const verticalSpeed = Math.min(ascentTime * 14 + (ascentTime ** 2) * 4.5, 65);

      this.rocket.root.position.y += verticalSpeed * dt;
      this.rocket.throttle = 1.0;
      this.rocket.isBoosting = true;
      this.rocket.update(dt, { pitch: 0, yaw: 0, forward: true, boost: true, brake: false });

      // Camera smoothly flies up behind the rocket
      const rocketPos = this.rocket.root.position;
      const targetCamPos = rocketPos.clone().add(new THREE.Vector3(0, -3.5, -14));
      this.camera.position.lerp(targetCamPos, dt * 2.8);
      this.camera.lookAt(rocketPos.clone().add(new THREE.Vector3(0, 10, 0)));

      if (ascentTime >= 4.0) {
        this.finish();
      }
    }
  }

  skip() {
    if (!this.active) return;
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

    // Position rocket ready for space flight heading toward orbit
    const orbitPos = this.launchPos.clone().add(new THREE.Vector3(0, 24, 18));
    if (this.rocket) {
      this.rocket.teleport(
        orbitPos,
        orbitPos.clone().add(new THREE.Vector3(0, 5, 20)) // forward into space
      );
    }

    audioSystem.startEngine();
    audioSystem.setEngineThrottle(0.5, false);

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
