/**
 * ExplorerGame — Master Coordinator for PJMC Space Explorer.
 *
 * Integrates:
 * - Rocket (PJMC-01 3D model & engine flame shader)
 * - FlightControls (Touch virtual joystick + right-hand buttons + Desktop keyboard)
 * - AudioSystem (Procedural Web Audio API sound effects)
 * - LaunchSequence (Cinematic countdown & Earth ascent)
 * - Missions (4 missions + Free Flight, pulsing 3D waypoint torus rings)
 * - FlightHUD (Telemetry header, Cockpit overlay, screen nav pointer, modals)
 *
 * Implements smooth camera tracking (3rd-person chase cam and 1st-person Cockpit),
 * realistic yet accessible space flight physics, and clean mode transitions
 * that leave the existing Solar System simulation 100% intact.
 */

import * as THREE from 'three';
import { Rocket } from './Rocket.js';
import { FlightControls } from './FlightControls.js';
import { AudioSystem } from './AudioSystem.js';
import { LaunchSequence } from './LaunchSequence.js';
import { MissionManager, MISSIONS } from './Missions.js';
import { FlightHUD } from './FlightHUD.js';

export const GAME_STATE = {
  INACTIVE: 'INACTIVE',
  MENU: 'MENU',
  LAUNCHING: 'LAUNCHING',
  FLYING: 'FLYING',
  PAUSED: 'PAUSED',
  VICTORY: 'VICTORY',
};

export class ExplorerGame {
  constructor(scene, camera, renderer, planets, sun, orbitControls) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.planets = planets;
    this.sun = sun;
    this.orbitControls = orbitControls;

    this.state = GAME_STATE.INACTIVE;
    this.isCockpit = false;

    // Build planet registry for quick world-coordinate lookups
    this.planetRegistry = new Map();
    this.planetRegistry.set('sun', {
      data: sun.data,
      surfaceMesh: sun.surfaceMesh,
      root: sun.bodyGroup,
    });
    for (const p of planets) {
      this.planetRegistry.set(p.data.id, {
        data: p.data,
        surfaceMesh: p.surfaceMesh,
        root: p.root,
      });
    }

    // Subsystems
    this.audio = new AudioSystem();
    this.rocket = new Rocket();
    this.scene.add(this.rocket.group);
    this.rocket.setVisible(false);

    this.missions = new MissionManager(this.scene, this.planetRegistry);
    this.missions.onWaypointComplete = (curr, total) => this.handleWaypointHit(curr, total);
    this.missions.onMissionComplete = (res) => this.handleMissionSuccess(res);

    this.controls = new FlightControls({
      onBoostChange: (boosting) => this.handleBoostChange(boosting),
      onCameraToggle: () => this.toggleCameraMode(),
      onPauseToggle: () => this.togglePause(),
    });

    this.hud = new FlightHUD({
      onResume: () => this.resumeFlight(),
      onRestart: () => this.restartMission(),
      onSelectMission: (id) => this.startLaunchForMission(id),
      onNextMission: () => this.startNextMission(),
      onExitExplore: () => this.exitToSolarSystem(),
      onPauseClick: () => this.togglePause(),
      onToggleSound: (enabled) => this.audio.setMuted(!enabled),
      onToggleQuality: (lvl) => this.setQualityLevel(lvl),
      onOpenSettings: () => this.controls.openSettingsModal(),
    });

    this.launchSeq = new LaunchSequence(this.scene, this.camera, this.rocket);

    // Flight physics & dynamics variables
    this.velocity = new THREE.Vector3();
    this.flightSpeed = 0.0; // Stationary on start! Only moves when lever is pushed
    this.cruiseSpeed = 0.0;
    this.maxCruiseSpeed = 38.0; // Max speed when lever pushed to AAGE
    this.boostSpeed = 54.0;
    this.brakeSpeed = 0.0;
    this.boostEnergy = 100.0;
    this.maxBoostEnergy = 100.0;
    this.boostDrainRate = 28.0;
    this.boostRechargeRate = 20.0;
    this.isBoosting = false;

    // Angular velocities with damping
    this.pitchRate = 0;
    this.yawRate = 0;
    this.rollRate = 0;
    this.visualBank = 0;
    this.maxTurnRate = 1.85; // rad/s
    this.maxRollRate = 2.2;  // rad/s

    // Vectors for camera interpolation
    this.camTargetPos = new THREE.Vector3();
    this.camCurrentPos = new THREE.Vector3();
    this.camLookTarget = new THREE.Vector3();
    this.camUp = new THREE.Vector3(0, 1, 0);
    this.tempV1 = new THREE.Vector3();
    this.tempV2 = new THREE.Vector3();
    this.tempV3 = new THREE.Vector3();
    this.navScreenVec = new THREE.Vector3();

    // Cache camera state before entering explore mode
    this.savedCamPos = new THREE.Vector3();
    this.savedControlsTarget = new THREE.Vector3();

    this.activeMission = null;

    // Space warp speed particles
    this.#buildWarpParticles();

    // 360-degree free-look touch orbit camera with smooth auto-centering
    this.freeLookYaw = 0.0;
    this.freeLookPitch = 0.0;
    this.targetFreeLookYaw = 0.0;
    this.targetFreeLookPitch = 0.0;
    this.isFreeLooking = false;
    this.#bindFreeLookEvents();
  }

  #buildWarpParticles() {
    const count = 180;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x66e5ff,
      size: 1.5,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.warpPoints = new THREE.Points(geometry, material);
    this.warpPoints.visible = false;
    this.scene.add(this.warpPoints);
  }

  updateWarpParticles(dt) {
    if (!this.warpPoints || !this.warpPoints.visible) return;

    if (this.flightSpeed < 0.2 && !this.isBoosting) {
      this.warpPoints.material.opacity = 0.0;
      return;
    }

    const posAttr = this.warpPoints.geometry.attributes.position;
    const posArr = posAttr.array;
    const rocketPos = this.rocket.position;
    const forward = this.rocket.getForwardVector(this.tempV1);

    const speed = this.flightSpeed * (this.isBoosting ? 2.4 : 1.2);
    const step = speed * dt;

    for (let i = 0; i < posArr.length; i += 3) {
      // Move particle backwards along rocket heading
      posArr[i] -= forward.x * step;
      posArr[i + 1] -= forward.y * step;
      posArr[i + 2] -= forward.z * step;

      const dx = posArr[i] - rocketPos.x;
      const dy = posArr[i + 1] - rocketPos.y;
      const dz = posArr[i + 2] - rocketPos.z;
      const dotFwd = dx * forward.x + dy * forward.y + dz * forward.z;
      const dist = Math.hypot(dx, dy, dz);

      if (dotFwd < -25 || dist > 50) {
        posArr[i] = rocketPos.x + forward.x * (32 + Math.random() * 20) + (Math.random() - 0.5) * 28;
        posArr[i + 1] = rocketPos.y + forward.y * (32 + Math.random() * 20) + (Math.random() - 0.5) * 20;
        posArr[i + 2] = rocketPos.z + forward.z * (32 + Math.random() * 20) + (Math.random() - 0.5) * 28;
      }
    }

    posAttr.needsUpdate = true;
    this.warpPoints.material.opacity = this.isBoosting ? 0.95 : Math.min(0.85, 0.25 + (this.flightSpeed / this.maxCruiseSpeed) * 0.55);
    this.warpPoints.material.size = this.isBoosting ? 2.4 : 1.5;
  }

  /* ------------------------------------------------------------------ */
  /* 360° Free-Look Touch Orbit Camera (Auto-centers on release)         */
  /* ------------------------------------------------------------------ */

  #bindFreeLookEvents() {
    this.freeLookPointerId = null;
    this.freeLookPrevX = 0;
    this.freeLookPrevY = 0;

    const onPointerDown = (e) => {
      if (this.state !== GAME_STATE.FLYING) return;
      if (this.freeLookPointerId !== null) return;

      // Ignore touches on HUD buttons, joystick, lever, settings modal, etc.
      if (e.target && e.target.closest) {
        if (e.target.closest('.pjmc-joystick-zone, .pjmc-actions-zone, .pjmc-hud-pause-btn, .pjmc-modal, .pjmc-controls-root button, .pjmc-lever-zone, .pjmc-skip-intro-btn')) {
          return;
        }
      }

      this.freeLookPointerId = e.pointerId;
      this.freeLookPrevX = e.clientX;
      this.freeLookPrevY = e.clientY;
      this.isFreeLooking = true;
    };

    const onPointerMove = (e) => {
      if (!this.isFreeLooking || e.pointerId !== this.freeLookPointerId) return;

      const dx = e.clientX - this.freeLookPrevX;
      const dy = e.clientY - this.freeLookPrevY;
      this.freeLookPrevX = e.clientX;
      this.freeLookPrevY = e.clientY;

      // Orbit sensitivity
      const sens = 0.0055;
      this.targetFreeLookYaw += dx * sens;

      // Clamp vertical tilt angle between -1.25 rad (-72 deg) and +1.25 rad (+72 deg)
      this.targetFreeLookPitch = Math.max(-1.25, Math.min(1.25, this.targetFreeLookPitch + dy * sens));
    };

    const onPointerUp = (e) => {
      if (e && this.freeLookPointerId !== null && e.pointerId !== this.freeLookPointerId) return;
      this.freeLookPointerId = null;
      this.isFreeLooking = false;

      // Finger released: smoothly auto-glide back to forward chase view ("auto aage set ho jae")
      this.targetFreeLookYaw = 0;
      this.targetFreeLookPitch = 0;
    };

    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Mode Transitions & Lifecycle                                       */
  /* ------------------------------------------------------------------ */

  openMenu() {
    this.audio.init(); // User gesture unlocks audio context
    if (this.state === GAME_STATE.FLYING) {
      this.hud.openMissionModal();
      return;
    }

    // Save camera & orbit controls state
    this.savedCamPos.copy(this.camera.position);
    this.savedControlsTarget.copy(this.orbitControls.target);
    this.orbitControls.enabled = false;

    this.state = GAME_STATE.MENU;
    this.hud.openMissionModal();
  }

  startLaunchForMission(missionId) {
    this.activeMission = this.missions.startMission(missionId);
    this.hud.closeMissionModal();

    // Find launch base position on Earth
    const earthPos = this.tempV1;
    this.missions.getPlanetWorldPos('earth', earthPos);

    this.state = GAME_STATE.LAUNCHING;
    this.controls.hide();

    // Start cinematic launch on Earth surface
    this.launchSeq.start(
      earthPos,
      (rocketPos, rocketRot) => {
        // Launch finished: transition seamlessly into space flight!
        this.startSpaceFlight(rocketPos, rocketRot);
      },
      () => {
        // Skip intro clicked: place spacecraft directly in realistic Low Earth Orbit
        this.launchSeq.finish();
      }
    );
  }

  startSpaceFlight(startPos, startRot) {
    this.state = GAME_STATE.FLYING;
    this.launchSeq.stop();

    // Position rocket
    this.rocket.setPosition(startPos.x, startPos.y, startPos.z);
    if (startRot) {
      if (startRot.isQuaternion) {
        this.rocket.quaternion.copy(startRot);
      } else if (startRot.isEuler) {
        this.rocket.rotation.copy(startRot);
      }
    }
    this.rocket.setVisible(true);

    // Initial momentum is 0 (Stationary in orbit until player pushes the lever forward!)
    this.flightSpeed = 0.0;
    this.pitchRate = 0;
    this.yawRate = 0;
    this.rollRate = 0;
    this.visualBank = 0;
    this.rocket.setVisualBank(0);
    this.velocity.set(0, 0, 0);

    // Reset free-look orbit camera
    this.freeLookYaw = 0.0;
    this.freeLookPitch = 0.0;
    this.targetFreeLookYaw = 0.0;
    this.targetFreeLookPitch = 0.0;
    this.isFreeLooking = false;

    // Setup initial chase camera behind rocket (scaled proportionally to sleek rocket)
    const offset = new THREE.Vector3(0, 0.85, -3.2).applyQuaternion(this.rocket.quaternion);
    this.camera.position.copy(this.rocket.position).add(offset);
    this.camCurrentPos.copy(this.camera.position);

    const lookTarget = new THREE.Vector3(0, 0.15, 3.5).applyQuaternion(this.rocket.quaternion);
    this.camLookTarget.copy(this.rocket.position).add(lookTarget);

    const rocketUp = this.rocket.getUpVector(this.tempV2);
    this.camUp.copy(rocketUp);
    this.camera.up.copy(this.camUp);
    this.camera.lookAt(this.camLookTarget);

    // Enable touch & keyboard controls
    this.controls.show();
    this.hud.show();
    this.setCockpitMode(false);
    if (this.warpPoints) this.warpPoints.visible = true;
  }

  resumeFlight() {
    this.state = GAME_STATE.FLYING;
    this.hud.hidePauseModal();
    this.controls.show();
    this.audio.playEngineThrottle(0.5);
  }

  togglePause() {
    if (this.state === GAME_STATE.FLYING) {
      this.state = GAME_STATE.PAUSED;
      this.hud.showPauseModal();
      this.controls.hide();
      this.audio.stopEngine();
    } else if (this.state === GAME_STATE.PAUSED) {
      this.resumeFlight();
    }
  }

  restartMission() {
    this.hud.hidePauseModal();
    if (this.activeMission) {
      this.startLaunchForMission(this.activeMission.id);
    } else {
      this.startLaunchForMission('mission_01');
    }
  }

  startNextMission() {
    if (!this.activeMission) return;
    const curIdx = MISSIONS.findIndex((m) => m.id === this.activeMission.id);
    const nextIdx = (curIdx + 1) % MISSIONS.length;
    this.startLaunchForMission(MISSIONS[nextIdx].id);
  }

  exitToSolarSystem() {
    this.state = GAME_STATE.INACTIVE;

    // Stop audio
    this.audio.stopEngine();
    this.audio.stopBoost();

    // Cleanup launch, rocket, waypoints, controls, HUD
    this.launchSeq.stop();
    this.rocket.setVisible(false);
    if (this.warpPoints) this.warpPoints.visible = false;
    this.missions.clearCheckpoints();
    this.controls.hide();
    this.hud.hide();

    // Reset free-look orbit state
    this.isFreeLooking = false;
    this.freeLookYaw = 0.0;
    this.freeLookPitch = 0.0;
    this.targetFreeLookYaw = 0.0;
    this.targetFreeLookPitch = 0.0;

    // Restore OrbitControls
    this.orbitControls.enabled = true;
    this.camera.position.copy(this.savedCamPos);
    this.orbitControls.target.copy(this.savedControlsTarget);
    this.orbitControls.update();
  }

  toggleCameraMode() {
    this.setCockpitMode(!this.isCockpit);
  }

  setCockpitMode(isCockpit) {
    this.isCockpit = isCockpit;
    this.hud.setCockpitMode(isCockpit);
    // Hide outer rocket fuselage in cockpit mode so it doesn't block view
    this.rocket.setVisible(!isCockpit);
  }

  setQualityLevel(level) {
    const dpr = level === 'LOW' ? 1.0 : level === 'MED' ? 1.5 : Math.min(window.devicePixelRatio, 2.0);
    this.renderer.setPixelRatio(dpr);
  }

  /* ------------------------------------------------------------------ */
  /* Checkpoint & Gameplay Callbacks                                    */
  /* ------------------------------------------------------------------ */

  handleWaypointHit(current, total) {
    this.audio.playCheckpointChime(current, total);
  }

  handleMissionSuccess({ mission, elapsedSeconds }) {
    this.state = GAME_STATE.VICTORY;
    this.audio.playFanfare();
    this.controls.hide();
    this.hud.showVictoryModal(mission, elapsedSeconds);
  }

  handleBoostChange(boosting) {
    if (boosting && this.boostEnergy > 10) {
      this.isBoosting = true;
      this.audio.playBoostWhoosh();
    } else {
      this.isBoosting = false;
      this.audio.stopBoost();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Main Per-Frame Update Loop                                         */
  /* ------------------------------------------------------------------ */

  update(dt) {
    if (this.state === GAME_STATE.INACTIVE) return;

    if (this.state === GAME_STATE.LAUNCHING) {
      this.launchSeq.update(dt);
      return;
    }

    if (this.state === GAME_STATE.PAUSED || this.state === GAME_STATE.VICTORY) {
      return;
    }

    if (this.state === GAME_STATE.FLYING) {
      this.updateFlightPhysics(dt);
      this.missions.update(dt, this.rocket.position);
      this.updateCamera(dt);
      this.updateHUDAndNav();
    }
  }

  updateFlightPhysics(dt) {
    const input = this.controls.getInput();

    // 1. Boost energy & thruster management
    const wantBoost = input.boost && this.boostEnergy > 3.0;
    if (wantBoost) {
      this.boostEnergy = Math.max(0, this.boostEnergy - dt * this.boostDrainRate);
      if (!this.isBoosting) {
        this.isBoosting = true;
        this.audio.playBoostWhoosh();
      }
    } else {
      this.boostEnergy = Math.min(this.maxBoostEnergy, this.boostEnergy + dt * this.boostRechargeRate);
      if (this.isBoosting) {
        this.isBoosting = false;
        this.audio.stopBoost();
      }
    }

    // 2. Spacecraft Forward Speed
    // CRITICAL: Stationary on start! Only moves forward when lever is pushed up towards AAGE.
    // When lever is released (input.thrust == 0), the jet gradually glides to a stop ("dhire dhire ruk jae")!
    let targetSpeed = 0.0;
    if (this.isBoosting) {
      targetSpeed = this.boostSpeed;
    } else if (input.thrust > 0.02) {
      // Pushing AAGE on lever accelerates up to maxCruiseSpeed (38.0)
      targetSpeed = input.thrust * this.maxCruiseSpeed;
    } else if (input.thrust < -0.05 || input.brake) {
      // Pulling PICHE on lever or brake decelerates quickly to full stop (0)
      targetSpeed = 0.0;
    }

    // Smooth acceleration / gradual stopping damping:
    // Accelerating: damp 3.8
    // Gliding to a stop when lever is released: damp 2.2 (natural smooth glide to stop)
    // Active braking: damp 5.5
    const speedDamp = this.isBoosting
      ? 5.0
      : targetSpeed > this.flightSpeed
        ? 3.8
        : (input.thrust < -0.05 || input.brake)
          ? 5.5
          : 2.2;

    this.flightSpeed = THREE.MathUtils.damp(this.flightSpeed, targetSpeed, speedDamp, dt);

    // If nearly stopped and no throttle is applied, snap to absolute zero
    if (this.flightSpeed < 0.1 && targetSpeed === 0.0) {
      this.flightSpeed = 0.0;
    }

    // 3. Angular velocity with responsive damping
    const targetPitchRate = input.pitch * this.maxTurnRate;
    const targetYawRate = input.yaw * this.maxTurnRate;
    const targetRollRate = input.roll * this.maxRollRate;

    this.pitchRate = THREE.MathUtils.damp(this.pitchRate, targetPitchRate, 7.5, dt);
    this.yawRate = THREE.MathUtils.damp(this.yawRate, targetYawRate, 7.5, dt);
    this.rollRate = THREE.MathUtils.damp(this.rollRate, targetRollRate, 8.0, dt);

    // Apply rotation around spacecraft's local axes via pure quaternion operations
    // Pitch: Uper (+1.0) -> Nose tilts UP, Niche (-1.0) -> Nose tilts DOWN
    // Yaw: Left (-1.0) -> Nose turns LEFT, Right (+1.0) -> Nose turns RIGHT
    const pitchDelta = -this.pitchRate * dt;
    const yawDelta = this.yawRate * dt;
    const rollDelta = -this.rollRate * dt;
    this.rocket.applyLocalRotation(pitchDelta, yawDelta, rollDelta);

    // 4. Automatic Visual Banking (tilts visual mesh along Z without altering flight orientation)
    if (this.controls.settings.autoBank) {
      const targetBank = -this.yawRate * 0.52; // Bank naturally into the turn
      this.visualBank = THREE.MathUtils.damp(this.visualBank, targetBank, 6.0, dt);
    } else {
      this.visualBank = THREE.MathUtils.damp(this.visualBank, 0, 6.0, dt);
    }
    this.rocket.setVisualBank(this.visualBank);

    // 5. Forward movement along actual facing vector (+Z) ONLY when flightSpeed > 0
    if (this.flightSpeed > 0.001) {
      const forward = this.rocket.getForwardVector(this.tempV1);
      this.velocity.copy(forward).multiplyScalar(this.flightSpeed);
      this.rocket.position.addScaledVector(this.velocity, dt);
    } else {
      this.velocity.set(0, 0, 0);
    }

    // 6. Update Space Warp Particles
    this.updateWarpParticles(dt);

    // Soft celestial boundaries: prevent flying beyond radius 260
    const distFromOrigin = this.rocket.position.length();
    if (distFromOrigin > 250) {
      const pull = this.tempV2.copy(this.rocket.position).normalize().negate();
      this.rocket.position.addScaledVector(pull, (distFromOrigin - 250) * dt * 2.0);
    }

    // Soft planetary atmospheric barrier: prevent clipping inside planets
    for (const [id, entry] of this.planetRegistry) {
      if (id === 'sun') continue;
      const pPos = this.tempV1;
      this.missions.getPlanetWorldPos(id, pPos);
      const dist = this.rocket.position.distanceTo(pPos);
      const baseR = entry.data.diameterKm ? (entry.data.diameterKm / 12742) ** 0.45 * 0.9 * 2.4 : 2.16;
      const minAltitude = baseR + 0.35;
      if (dist < minAltitude && dist > 0.01) {
        const pushDir = this.tempV2.subVectors(this.rocket.position, pPos).normalize();
        this.rocket.position.copy(pPos).addScaledVector(pushDir, minAltitude);
        const vDot = this.velocity.dot(pushDir);
        if (vDot < 0) {
          this.velocity.subScaledVector(pushDir, vDot);
        }
      }
    }

    // 7. Update rocket flame animation and boost intensity
    const throttleNorm = this.isBoosting ? 1.0 : (this.flightSpeed / this.maxCruiseSpeed);
    this.rocket.update(dt, Math.max(0.0, Math.min(1.0, throttleNorm)), this.isBoosting);

    // 8. Modulate engine audio
    if (this.flightSpeed > 0.05 || this.isBoosting) {
      this.audio.playEngineThrottle(throttleNorm, this.isBoosting);
    } else {
      this.audio.playEngineThrottle(0.0, false);
    }
  }

  updateCamera(dt) {
    // 1. Smoothly interpolate free-look orbit angles
    // When actively dragging: fast responsive tracking (18.0)
    // When released: smoothly glides back to forward view (4.5) ("chhodne par auto aage set ho jae")
    const returnSpeed = this.isFreeLooking ? 18.0 : 4.5;
    this.freeLookYaw = THREE.MathUtils.damp(this.freeLookYaw, this.targetFreeLookYaw, returnSpeed, dt);
    this.freeLookPitch = THREE.MathUtils.damp(this.freeLookPitch, this.targetFreeLookPitch, returnSpeed, dt);

    if (!this.isFreeLooking && Math.abs(this.freeLookYaw) < 0.0005 && Math.abs(this.freeLookPitch) < 0.0005) {
      this.freeLookYaw = 0;
      this.freeLookPitch = 0;
    }

    // Free-look rotation quaternion in spacecraft local space
    // Yaw rotates around rocket local UP (0, 1, 0)
    // Pitch rotates around rocket local RIGHT (1, 0, 0)
    const qFreeYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.freeLookYaw);
    const qFreePitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), this.freeLookPitch);
    const qFree = qFreeYaw.multiply(qFreePitch);

    if (this.isCockpit) {
      // First-Person Cockpit View (Looking out canopy with free-look pilot head rotation)
      const cockpitWorldPos = this.rocket.getCockpitWorldPosition(this.tempV1);
      this.camera.position.copy(cockpitWorldPos);
      this.camera.quaternion.copy(this.rocket.quaternion).multiply(qFree);
    } else {
      // Third-Person 360° Orbit Chase Camera (proportional to 0.28 sleek rocket)
      const baseLocalOffset = new THREE.Vector3(0, 0.85, -3.2).applyQuaternion(qFree);
      const worldOffset = baseLocalOffset.applyQuaternion(this.rocket.quaternion);
      this.camTargetPos.copy(this.rocket.position).add(worldOffset);

      // Smooth camera position interpolation
      const posLerpSpeed = this.isFreeLooking ? 18.0 : 7.5;
      this.camCurrentPos.lerp(this.camTargetPos, Math.min(1.0, dt * posLerpSpeed));
      this.camera.position.copy(this.camCurrentPos);

      // Camera look target:
      // When looking straight forward: look ahead into space past rocket nose (+Z)
      // When orbiting to look around planets or backwards: camera points toward rocket center
      const freeMag = Math.min(1.0, Math.hypot(this.freeLookYaw, this.freeLookPitch) * 1.5);
      const lookZ = THREE.MathUtils.lerp(3.5, 0.6, freeMag);
      const localLook = new THREE.Vector3(0, 0.15, lookZ)
        .applyQuaternion(qFree)
        .applyQuaternion(this.rocket.quaternion);
      this.camLookTarget.copy(this.rocket.position).add(localLook);

      // Camera UP vector aligns with rocket local UP to prevent flipping
      const targetUp = this.rocket.getUpVector(this.tempV3);
      this.camUp.lerp(targetUp, Math.min(1.0, dt * 6.0)).normalize();
      this.camera.up.copy(this.camUp);

      this.camera.lookAt(this.camLookTarget);
    }
  }

  updateHUDAndNav() {
    const rocketPos = this.rocket.position;

    // Find target planet position & distance
    const targetId = this.activeMission?.target || 'earth';
    const planetPos = this.tempV1;
    this.missions.getTargetPlanetPosition(targetId, planetPos);
    const distToPlanet = rocketPos.distanceTo(planetPos);

    // Mission progress
    const progress = this.missions.getMissionProgress();
    const isFree = this.activeMission?.id === 'free_flight';

    this.hud.updateTelemetry({
      speed: this.flightSpeed * 10, // Simulated km/s
      boostPercent: this.boostEnergy,
      missionTitle: this.activeMission?.title || 'EXPLORATION',
      targetName: targetId,
      targetDistance: distToPlanet * 100, // Visual scaling to km
      waypointCurrent: progress.current + 1,
      waypointTotal: progress.total,
      isFreeFlight: isFree,
    });

    // 3D-to-2D Screen Waypoint Pointer
    const wpPos = this.tempV2;
    const hasActiveWp = this.missions.getActiveWaypointPosition(wpPos);

    if (!hasActiveWp || isFree) {
      this.hud.updateNavArrow(0, 0, '', false);
      return;
    }

    // Project active waypoint to screen coordinates
    this.navScreenVec.copy(wpPos).project(this.camera);

    const isBehind = this.navScreenVec.z > 1.0;
    let x = (this.navScreenVec.x * 0.5 + 0.5) * window.innerWidth;
    let y = (-(this.navScreenVec.y * 0.5) + 0.5) * window.innerHeight;

    if (isBehind) {
      x = window.innerWidth - x;
      y = window.innerHeight - y;
    }

    // Clamp to screen padding
    const padding = 45;
    const clampedX = Math.max(padding, Math.min(window.innerWidth - padding, x));
    const clampedY = Math.max(padding, Math.min(window.innerHeight - padding, y));

    const distToWp = rocketPos.distanceTo(wpPos);
    const distText = `${(distToWp * 10).toFixed(0)} KM`;

    this.hud.updateNavArrow(clampedX, clampedY, distText, true);
  }

  destroy() {
    this.exitToSolarSystem();
    this.audio.dispose();
    this.controls.destroy();
    this.missions.dispose();
    this.hud.destroy();
    this.launchSeq.dispose();
    this.rocket.dispose();
  }
}
