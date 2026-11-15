/**
 * Missions and Checkpoint System for PJMC Space Explorer.
 *
 * Implements:
 * - Mission 01: Earth Orbit Challenge
 * - Mission 02: Mars Exploration
 * - Mission 03: Saturn Ring Challenge
 * - Mission 04: Jupiter Flyby
 * - Free Flight Mode (unconstrained planetary exploration)
 *
 * Features dynamic glowing 3D torus checkpoint rings with additive blending,
 * distance calculation, passage detection, and particle bursts.
 */

import * as THREE from 'three';

export const MISSIONS = [
  {
    id: 'mission_01',
    num: '01',
    title: 'Earth to Moon',
    titleHi: 'पृथ्वी से चाँद तक',
    target: 'moon',
    desc: 'Learn to steer through three gates, then follow the Moon approach and land.',
    descHi: 'पृथ्वी के चारों ओर 5 ऑर्बिटल चेकपॉइंट्स को सफलतापूर्वक पार करें।',
    difficulty: 'EASY',
    difficultyHi: 'आसान',
    reward: 'Moon Explorer',
    waypoints: [
      { offset: new THREE.Vector3(3.2, 0.4, 0.0), label: 'Orbit Point Alpha' },
      { offset: new THREE.Vector3(2.3, 1.2, 2.3), label: 'Orbit Point Beta' },
      { offset: new THREE.Vector3(0.0, 0.6, 3.2), label: 'Orbit Point Gamma' },
      { offset: new THREE.Vector3(-2.3, -0.8, 2.3), label: 'Orbit Point Delta' },
      { offset: new THREE.Vector3(-3.2, 0.0, 0.0), label: 'Orbit Insertion Final' },
    ],
  },
  {
    id: 'mission_02',
    num: '02',
    title: 'Mars Rover Rescue',
    titleHi: 'मंगल अभियान',
    target: 'mars',
    desc: 'Follow the beacons to find a lost rover on Mars.',
    descHi: 'पृथ्वी से मंगल ग्रह की ओर 6 अंतरिक्ष मार्ग चेकपॉइंट्स को पार करें।',
    difficulty: 'MEDIUM',
    difficultyHi: 'मध्यम',
    reward: 'Red Planet Pioneer',
    waypoints: [
      { fraction: 0.15, height: 1.5, lateral: 1.0, label: 'Earth Departure Gate' },
      { fraction: 0.35, height: 2.5, lateral: -1.5, label: 'Interplanetary Waypoint 1' },
      { fraction: 0.55, height: 1.8, lateral: 2.0, label: 'Mid-Course Correction' },
      { fraction: 0.75, height: 2.2, lateral: -1.0, label: 'Interplanetary Waypoint 2' },
      { fraction: 0.90, height: 1.2, lateral: 0.5, label: 'Mars Approach Gate' },
      { fraction: 1.00, height: 0.8, lateral: 0.0, label: 'Mars Low Orbit Entry' },
    ],
  },
  {
    id: 'mission_03',
    num: '03',
    title: 'Saturn Rings',
    titleHi: 'शनि के छल्ले',
    target: 'saturn',
    desc: 'Weave through Saturn’s legendary ring system through 7 precision flight rings.',
    descHi: 'शनि ग्रह के शानदार छल्लों के बीच से 7 सटीक रिंग्स को पार करें।',
    difficulty: 'HARD',
    difficultyHi: 'कठिन',
    reward: 'Ring Navigator Ribbon',
    waypoints: [
      { radius: 6.5, angle: 0.0, y: 0.4, label: 'Outer Ring Gap' },
      { radius: 6.0, angle: 0.9, y: -0.3, label: 'Cassini Division Gate' },
      { radius: 5.5, angle: 1.8, y: 0.5, label: 'Ring Plane Passage' },
      { radius: 5.0, angle: 2.7, y: -0.4, label: 'Mid Ring Tunnel' },
      { radius: 4.5, angle: 3.6, y: 0.3, label: 'Inner B-Ring Orbit' },
      { radius: 4.2, angle: 4.5, y: -0.2, label: 'Crepe Ring Flyby' },
      { radius: 3.8, angle: 5.4, y: 0.2, label: 'Saturn North Pole Exit' },
    ],
  },
  {
    id: 'mission_04',
    num: '04',
    title: 'Jupiter Photo Expedition',
    titleHi: 'बृहस्पति महायात्रा',
    target: 'jupiter',
    desc: 'Follow a safe flyby route and photograph Jupiter. Look for its Great Red Spot.',
    descHi: 'विशालकाय बृहस्पति ग्रह के चारों ओर तीव्र गति से 6 चेकपॉइंट्स पूरे करें।',
    difficulty: 'EXPERT',
    difficultyHi: 'विशेषज्ञ',
    reward: 'Jupiter Conqueror',
    waypoints: [
      { radius: 7.0, angle: 0.2, y: 1.0, label: 'Radiation Belt Entry' },
      { radius: 6.2, angle: 1.2, y: -0.8, label: 'Great Red Spot Approach' },
      { radius: 5.5, angle: 2.2, y: 0.6, label: 'Equatorial Flyby' },
      { radius: 5.0, angle: 3.2, y: -0.5, label: 'Gravitational Slingshot' },
      { radius: 5.8, angle: 4.2, y: 0.8, label: 'Jovian Polar Arc' },
      { radius: 6.5, angle: 5.2, y: -0.2, label: 'Solar Corridor Exit' },
    ],
  },
  {
    id: 'free_flight',
    num: '∞',
    title: 'Free Exploration',
    titleHi: 'मुक्त अंतरिक्ष उड़ान',
    target: 'sun',
    desc: 'Unconstrained space exploration. Fly anywhere across the entire Solar System at your own pace.',
    descHi: 'अपनी मर्जी से पूरे सौरमंडल में जहाँ चाहें घूमें। कोई समय सीमा या रुकावट नहीं।',
    difficulty: 'FREE',
    difficultyHi: 'मुक्त',
    reward: 'Cosmic Explorer',
    waypoints: [],
  },
];

export class MissionManager {
  constructor(scene, planetRegistry) {
    this.scene = scene;
    this.planetRegistry = planetRegistry; // map of id -> { surfaceMesh, data, root }
    this.activeMission = null;
    this.activeWaypointIndex = 0;
    this.checkpointMeshes = [];
    this.group = new THREE.Group();
    this.group.name = 'PJMC_Checkpoints_Group';
    this.scene.add(this.group);

    this.tempV1 = new THREE.Vector3();
    this.tempV2 = new THREE.Vector3();
    this.pulseTime = 0;
    this.missionStartTime = 0;
    this.onWaypointComplete = null;
    this.onMissionComplete = null;

    // Shared geometry for checkpoint rings (optimized for 0.28 scale rocket)
    this.ringGeom = new THREE.TorusGeometry(0.85, 0.045, 12, 36);
    this.outerRingGeom = new THREE.TorusGeometry(0.98, 0.02, 8, 36);

    // Active & inactive ring materials
    this.activeMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    this.activeOuterMat = new THREE.MeshBasicMaterial({
      color: 0xffee55,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    this.inactiveMat = new THREE.MeshBasicMaterial({
      color: 0x0077aa,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });

    // Particle burst on passing checkpoint
    this.burstMesh = this.createBurstSystem();
    this.group.add(this.burstMesh);
    this.burstActive = false;
    this.burstTimer = 0;
  }

  createBurstSystem() {
    const count = 60;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;

      const phi = Math.random() * Math.PI * 2;
      const theta = (Math.random() - 0.5) * Math.PI;
      const speed = 2.0 + Math.random() * 4.0;
      vel[i * 3 + 0] = Math.cos(theta) * Math.cos(phi) * speed;
      vel[i * 3 + 1] = Math.sin(theta) * speed;
      vel[i * 3 + 2] = Math.cos(theta) * Math.sin(phi) * speed;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.userData = { vel, count, basePos: new THREE.Vector3() };

    const mat = new THREE.PointsMaterial({
      color: 0x00ffff,
      size: 0.35,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Points(geom, mat);
    mesh.visible = false;
    return mesh;
  }

  triggerBurst(position) {
    this.burstMesh.position.copy(position);
    this.burstMesh.visible = true;
    this.burstActive = true;
    this.burstTimer = 0;

    const pos = this.burstMesh.geometry.attributes.position.array;
    for (let i = 0; i < pos.length; i++) {
      pos[i] = 0;
    }
    this.burstMesh.geometry.attributes.position.needsUpdate = true;
    this.burstMesh.material.opacity = 1.0;
  }

  getPlanetWorldPos(planetId, out) {
    const entry = this.planetRegistry.get(planetId);
    if (!entry) {
      out.set(0, 0, 0);
      return out;
    }
    if (entry.surfaceMesh) {
      entry.surfaceMesh.getWorldPosition(out);
    } else if (entry.root) {
      entry.root.getWorldPosition(out);
    } else {
      out.set(0, 0, 0);
    }
    return out;
  }

  startMission(missionId) {
    this.clearCheckpoints();
    const mission = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
    this.activeMission = mission;
    this.activeWaypointIndex = 0;
    this.elapsedSeconds = 0;
    this.previousRocketPos = null;
    this.route = null;

    if (mission.waypoints && mission.waypoints.length > 0) {
      this.buildCheckpointMeshes();
    }
    return mission;
  }

  clearCheckpoints() {
    for (const mesh of this.checkpointMeshes) {
      this.group.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose?.();
    }
    this.checkpointMeshes = [];
    this.activeWaypointIndex = 0;
  }

  buildCheckpointMeshes() {
    const total = this.activeMission.waypoints.length;
    for (let i = 0; i < total; i++) {
      const ringGroup = new THREE.Group();
      ringGroup.name = `Checkpoint_${i}`;

      const inner = new THREE.Mesh(this.ringGeom, i === 0 ? this.activeMat : this.inactiveMat);
      const outer = new THREE.Mesh(this.outerRingGeom, i === 0 ? this.activeOuterMat : this.inactiveMat);
      ringGroup.add(inner);
      ringGroup.add(outer);

      // Light directional beacon
      const beaconLight = new THREE.PointLight(0x00f0ff, i === 0 ? 1.5 : 0.2, 8, 2);
      ringGroup.add(beaconLight);

      ringGroup.userData = {
        index: i,
        inner,
        outer,
        light: beaconLight,
        worldPos: new THREE.Vector3(),
      };

      this.group.add(ringGroup);
      this.checkpointMeshes.push(ringGroup);
    }
  }

  computeWaypointPosition(index, out) {
    if (!this.activeMission || !this.activeMission.waypoints[index]) {
      out.set(0, 0, 0);
      return out;
    }

    if (this.route) return out.copy(this.route[index]);
    return this.getPlanetWorldPos(this.activeMission.target, out);

    return out;
  }

  prepareRoute(start, forward) {
    const target = this.activeMission.target;
    const entry = this.planetRegistry.get(target);
    const center = this.getPlanetWorldPos(target, new THREE.Vector3());
    const radius = entry?.body?.radiusWorld || 2;
    const count = this.activeMission.waypoints.length;
    this.route = [];
    for (let i = 0; i < count; i++) {
      let point;
      if (target === 'saturn' || target === 'jupiter') {
        const angle = (i / count) * Math.PI * 1.6;
        const orbitRadius = radius * (target === 'saturn' ? 2.6 : 1.7) + 2;
        point = new THREE.Vector3(Math.cos(angle) * orbitRadius, 2, Math.sin(angle) * orbitRadius);
        point.applyQuaternion(entry.body.tiltGroup.getWorldQuaternion(new THREE.Quaternion())).add(center);
      } else if (i < 3) {
        point = start.clone().addScaledVector(forward, (i + 1) * 2.5);
      } else {
        const approach = start.clone().sub(center).normalize();
        point = center.clone().addScaledVector(approach, radius + 2 + (count - 1 - i) * 2.5);
      }
      // Keep every gate outside solid bodies, including the Sun and moons.
      for (const body of this.planetRegistry.values()) {
        const bodyPos = body.surfaceMesh.getWorldPosition(new THREE.Vector3());
        const clearance = (body.body?.radiusWorld || body.surfaceMesh.getWorldScale(new THREE.Vector3()).x) + 1.8;
        const offset = point.clone().sub(bodyPos);
        if (offset.length() < clearance) {
          if (offset.lengthSq() < 1e-8) offset.copy(forward);
          point.copy(bodyPos).addScaledVector(offset.normalize(), clearance);
        }
      }
      this.route.push(point);
    }
  }

  update(dt, rocketPos) {
    this.pulseTime += dt;
    this.elapsedSeconds += dt;

    // Update burst particles
    if (this.burstActive) {
      this.burstTimer += dt;
      const pos = this.burstMesh.geometry.attributes.position.array;
      const vel = this.burstMesh.geometry.userData.vel;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i + 0] += vel[i + 0] * dt;
        pos[i + 1] += vel[i + 1] * dt;
        pos[i + 2] += vel[i + 2] * dt;
      }
      this.burstMesh.geometry.attributes.position.needsUpdate = true;
      this.burstMesh.material.opacity = Math.max(0, 1.0 - this.burstTimer / 0.8);

      if (this.burstTimer >= 0.8) {
        this.burstActive = false;
        this.burstMesh.visible = false;
      }
    }

    if (!this.activeMission || !this.activeMission.waypoints.length) return;

    // Update positions and appearance of checkpoint rings
    const currentIdx = this.activeWaypointIndex;
    const pulseScale = 1.0 + Math.sin(this.pulseTime * 4.5) * 0.08;

    for (let i = 0; i < this.checkpointMeshes.length; i++) {
      const mesh = this.checkpointMeshes[i];
      const pos = mesh.userData.worldPos;
      this.computeWaypointPosition(i, pos);
      mesh.position.copy(pos);

      // Rotate ring slowly for sci-fi look
      mesh.rotation.y += dt * 0.8;
      mesh.rotation.z += dt * 0.4;

      const isActive = i === currentIdx;
      const isPast = i < currentIdx;

      if (isPast) {
        mesh.visible = false;
      } else if (isActive) {
        mesh.visible = true;
        mesh.scale.set(pulseScale, pulseScale, pulseScale);
        mesh.userData.inner.material = this.activeMat;
        mesh.userData.outer.material = this.activeOuterMat;
        mesh.userData.light.intensity = 2.0;

        // Check if rocket entered checkpoint radius (radius ~ 1.35)
        const segment = new THREE.Line3(this.previousRocketPos || rocketPos, rocketPos);
        const closest = segment.closestPointToPoint(pos, true, new THREE.Vector3());
        const dist = closest.distanceTo(pos);
        if (dist < 1.35) {
          this.triggerBurst(pos);
          this.advanceCheckpoint();
        }
      } else {
        // Upcoming checkpoint
        mesh.visible = true;
        mesh.scale.set(1, 1, 1);
        mesh.userData.inner.material = this.inactiveMat;
        mesh.userData.outer.material = this.inactiveMat;
        mesh.userData.light.intensity = 0.2;
      }
    }
    this.previousRocketPos = rocketPos.clone();
  }

  advanceCheckpoint() {
    this.activeWaypointIndex++;
    const total = this.activeMission.waypoints.length;

    if (this.onWaypointComplete) {
      this.onWaypointComplete(this.activeWaypointIndex, total);
    }

    if (this.activeWaypointIndex >= total) {
      // Mission Complete!
      const elapsedSec = this.elapsedSeconds;
      if (this.onMissionComplete) {
        this.onMissionComplete({
          mission: this.activeMission,
          elapsedSeconds: elapsedSec,
        });
      }
    }
  }

  getActiveWaypointPosition(out) {
    if (!this.activeMission || !this.activeMission.waypoints.length) {
      out.set(0, 0, 0);
      return false;
    }
    const idx = Math.min(this.activeWaypointIndex, this.activeMission.waypoints.length - 1);
    this.computeWaypointPosition(idx, out);
    return true;
  }

  getTargetPlanetPosition(planetId, out) {
    return this.getPlanetWorldPos(planetId || this.activeMission?.target || 'earth', out);
  }

  getMissionProgress() {
    if (!this.activeMission || !this.activeMission.waypoints.length) {
      return { current: 0, total: 0, percent: 100 };
    }
    const total = this.activeMission.waypoints.length;
    const current = Math.min(this.activeWaypointIndex, total);
    const percent = Math.round((current / total) * 100);
    return { current, total, percent };
  }

  dispose() {
    this.clearCheckpoints();
    if (this.burstMesh) {
      this.group.remove(this.burstMesh);
      this.burstMesh.geometry.dispose();
      this.burstMesh.material.dispose();
    }
    this.scene.remove(this.group);
  }
}
