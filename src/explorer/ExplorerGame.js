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
    });

    this.launchSeq = new LaunchSequence(this.scene, this.camera, this.rocket);

    // Flight physics & dynamics variables
    this.velocity = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.targetRotation = new THREE.Quaternion();
    this.flightSpeed = 0;
    this.maxSpeed = 24.0;
    this.baseSpeed = 12.0;
    this.boostSpeed = 35.0;
    this.boostEnergy = 100.0;
    this.isBoosting = false;

    // Vectors for camera interpolation
    this.camTargetPos = new THREE.Vector3();
    this.camCurrentPos = new THREE.Vector3();
    this.camLookTarget = new THREE.Vector3();
    this.tempV1 = new THREE.Vector3();
    this.tempV2 = new THREE.Vector3();
    this.navScreenVec = new THREE.Vector3();

    // Cache camera state before entering explore mode
    this.savedCamPos = new THREE.Vector3();
    this.savedControlsTarget = new THREE.Vector3();

    this.activeMission = null;
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
        // Skip intro clicked
        this.startSpaceFlight(
          new THREE.Vector3(earthPos.x, earthPos.y + 4.0, earthPos.z + 5.0),
          new THREE.Euler(0, 0, 0)
        );
      }
    );
  }

  startSpaceFlight(startPos, startRot) {
    this.state = GAME_STATE.FLYING;
    this.launchSeq.stop();

    // Position rocket
    this.rocket.setPosition(startPos.x, startPos.y, startPos.z);
    this.rocket.rotation.copy(startRot);
    this.rocket.setVisible(true);

    // Initial forward momentum (Nose is at +Z)
    this.flightSpeed = 8.0;
    this.velocity.set(0, 0, 1).applyQuaternion(this.rocket.quaternion).multiplyScalar(this.flightSpeed);

    // Setup initial chase camera behind rocket (looking forward toward space)
    const offset = new THREE.Vector3(0, 2.2, -8.2).applyQuaternion(this.rocket.quaternion);
    this.camera.position.copy(this.rocket.position).add(offset);
    this.camCurrentPos.copy(this.camera.position);
    const lookTarget = new THREE.Vector3(0, 0.4, 6.0).applyQuaternion(this.rocket.quaternion);
    this.camLookTarget.copy(this.rocket.position).add(lookTarget);
    this.camera.lookAt(this.camLookTarget);

    // Enable touch & keyboard controls
    this.controls.show();
    this.hud.show();
    this.setCockpitMode(false);
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
    this.missions.clearCheckpoints();
    this.controls.hide();
    this.hud.hide();

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
    const steer = this.controls.getSteer();
    const isBraking = this.controls.isBraking();

    // Boost energy management
    if (this.controls.isBoosting() && this.boostEnergy > 2) {
      this.isBoosting = true;
      this.boostEnergy = Math.max(0, this.boostEnergy - dt * 25);
    } else {
      this.isBoosting = false;
      this.boostEnergy = Math.min(100, this.boostEnergy + dt * 15);
    }

    // Target flight speed
    let targetSpeed = this.baseSpeed;
    if (this.isBoosting) {
      targetSpeed = this.boostSpeed;
    } else if (isBraking) {
      targetSpeed = 4.0;
    }

    // Accelerate / decelerate smoothly
    const accelRate = this.isBoosting ? 25.0 : 12.0;
    this.flightSpeed = THREE.MathUtils.lerp(this.flightSpeed, targetSpeed, Math.min(1.0, dt * 3.5));

    // Pitch & Yaw rotation from joystick / keyboard
    const turnRate = 2.0;
    const yawDelta = -steer.x * turnRate * dt;
    const pitchDelta = -steer.y * turnRate * dt;

    // Apply rotation around rocket's local axes
    this.rocket.rotateY(yawDelta);
    this.rocket.rotateX(pitchDelta);

    // Natural banking/roll when turning horizontally
    const targetRoll = -steer.x * 0.45;
    this.rocket.rotation.z = THREE.MathUtils.lerp(this.rocket.rotation.z, targetRoll, dt * 5.0);

    // Forward direction vector (in direction of nose +Z)
    const forward = this.tempV1.set(0, 0, 1).applyQuaternion(this.rocket.quaternion);

    // Apply forward thrust to position
    this.rocket.position.addScaledVector(forward, this.flightSpeed * dt);

    // Soft celestial boundaries: prevent flying beyond radius 260
    const distFromOrigin = this.rocket.position.length();
    if (distFromOrigin > 250) {
      const pull = this.tempV2.copy(this.rocket.position).normalize().negate();
      this.rocket.position.addScaledVector(pull, (distFromOrigin - 250) * dt * 2.0);
    }

    // Update rocket flame animation and boost intensity
    const throttleNorm = this.flightSpeed / this.maxSpeed;
    this.rocket.update(dt, throttleNorm, this.isBoosting);

    // Modulate audio engine rumble with throttle
    this.audio.playEngineThrottle(throttleNorm);
  }

  updateCamera(dt) {
    if (this.isCockpit) {
      // First-Person Cockpit View (Facing forward +Z)
      const cockpitWorldPos = this.rocket.getCockpitWorldPosition(this.tempV1);
      this.camera.position.copy(cockpitWorldPos);
      this.camera.quaternion.copy(this.rocket.quaternion);
    } else {
      // Third-Person Smooth Chase Camera (Positioned behind engines, looking forward past nose)
      const offset = this.tempV1.set(0, 2.2, -8.2).applyQuaternion(this.rocket.quaternion);
      this.camTargetPos.copy(this.rocket.position).add(offset);

      // Smooth interpolation for camera position
      this.camCurrentPos.lerp(this.camTargetPos, Math.min(1.0, dt * 8.0));
      this.camera.position.copy(this.camCurrentPos);

      // Camera looks forward past the rocket nose
      const lookAhead = this.tempV2.set(0, 0.4, 6.0).applyQuaternion(this.rocket.quaternion);
      this.camLookTarget.copy(this.rocket.position).add(lookAhead);
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
