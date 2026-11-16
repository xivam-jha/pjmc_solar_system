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
import { CHALLENGES } from './ChallengeCatalog.js';

export const MISSIONS = [
  {
    id: 'mission_01',
    num: '01',
    title: 'Earth to Moon',
    titleHi: 'पृथ्वी से चाँद तक',
    target: 'moon',
    desc: 'Collect PJMC Gold on your approach to the Moon.',
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
    requires: 'mission_01',
    num: '02',
    title: 'Mars Rover Rescue',
    titleHi: 'मंगल अभियान',
    target: 'mars',
    desc: 'Collect Gold on the route to the Mars rover.',
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
    requires: 'mission_02',
    num: '03',
    title: 'Saturn Rings',
    titleHi: 'शनि के छल्ले',
    target: 'saturn',
    desc: 'Collect seven Gold tokens above Saturn’s rings.',
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
    requires: 'mission_03',
    num: '04',
    title: 'Jupiter Photo Expedition',
    titleHi: 'बृहस्पति महायात्रा',
    target: 'jupiter',
    desc: 'Collect Gold near Jupiter and take a photo.',
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
  ...CHALLENGES,
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
    this.group.name = 'PJMC_Gold_Collectibles';
    this.scene.add(this.group);

    this.tempV1 = new THREE.Vector3();
    this.tempV2 = new THREE.Vector3();
    this.pulseTime = 0;
    this.missionStartTime = 0;
    this.onWaypointComplete = null;
    this.onMissionComplete = null;

    this.ringGeom = new THREE.CylinderGeometry(.72, .72, .16, 40);
    this.ringGeom.rotateX(Math.PI / 2);
    this.outerRingGeom = new THREE.TorusGeometry(.69, .025, 6, 40);
    this.activeMat = new THREE.MeshStandardMaterial({color:0xeec36b,metalness:.65,roughness:.28,emissive:0x8a571a,emissiveIntensity:.4});
    this.activeOuterMat = new THREE.MeshBasicMaterial({color:0xffe4a1});
    this.inactiveMat = new THREE.MeshStandardMaterial({color:0x9d793b,metalness:.45,roughness:.5,emissive:0x38240b,emissiveIntensity:.4});
    this.coinFaceGeometry = new THREE.CircleGeometry(.62, 40);
    this.coinTexture = this.createGoldTexture();
    this.coinFaceMaterial = new THREE.MeshBasicMaterial({map:this.coinTexture,color:0xffe5a0,side:THREE.DoubleSide});

    // Particle burst on passing checkpoint
    this.burstMesh = this.createBurstSystem();
    this.group.add(this.burstMesh);
    this.burstActive = false;
    this.burstTimer = 0;
  }

  createGoldTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); if (!ctx) return null;
    const gradient = ctx.createLinearGradient(0,0,256,256);
    gradient.addColorStop(0,'#fff0bc'); gradient.addColorStop(.5,'#cc9c45'); gradient.addColorStop(1,'#f5d78b');
    ctx.fillStyle=gradient; ctx.fillRect(0,0,256,256);
    ctx.strokeStyle='#846022'; ctx.lineWidth=3; ctx.beginPath();ctx.arc(128,128,115,0,Math.PI*2);ctx.stroke();
    ctx.lineWidth=1;ctx.beginPath();ctx.arc(128,128,104,0,Math.PI*2);ctx.stroke();
    ctx.textAlign='center';ctx.fillStyle='#694515';ctx.font='bold 49px sans-serif';ctx.fillText('PJMC',128,137);
    ctx.font='bold 21px sans-serif';ctx.fillText('G O L D',128,174);
    ctx.font='26px sans-serif';ctx.fillText('✦',128,83);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace; return texture;
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
      color: 0xffd37c,
      size: 0.09,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    mat.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');
    };
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
    this.burstActive = false;
    this.burstMesh.visible = false;
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
      ringGroup.name = `PJMC_Gold_${i}`;

      const inner = new THREE.Mesh(this.ringGeom, i === 0 ? this.activeMat : this.inactiveMat);
      const outer = new THREE.Mesh(this.outerRingGeom, i === 0 ? this.activeOuterMat : this.inactiveMat);
      ringGroup.add(inner);
      ringGroup.add(outer);
      outer.position.z = .09;
      const front = new THREE.Mesh(this.coinFaceGeometry, this.coinFaceMaterial);front.position.z=.085;
      const back = new THREE.Mesh(this.coinFaceGeometry, this.coinFaceMaterial);back.position.z=-.085;back.rotation.y=Math.PI;
      ringGroup.add(front,back);

      // Light directional beacon
      const beaconLight = { intensity: 0 }; // No per-token lights on mobile.

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
      const approach = center.clone().add(new THREE.Vector3(0, radius + (target === 'saturn' ? 5 : 3), 0));
      const fraction = (i + 1) / count;
      point = start.clone().lerp(approach, fraction);
      // Small side-to-side movement while staying above the planetary plane.
      point.x += Math.sin(fraction * Math.PI * 2) * 2;
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
      mesh.rotation.z = Math.sin(this.pulseTime * .7 + i) * .12;

      const isActive = i === currentIdx;
      const isPast = i < currentIdx;

      if (isPast) {
        mesh.visible = false;
      } else if (isActive) {
        mesh.visible = true;
        mesh.scale.set(pulseScale, pulseScale, pulseScale);
        mesh.userData.inner.material = this.activeMat;
        mesh.userData.outer.material = this.activeOuterMat;
        mesh.userData.light.intensity = 0;

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
        mesh.userData.light.intensity = 0;
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
    if (!this.activeMission || !this.activeMission.waypoints.length || this.activeWaypointIndex >= this.activeMission.waypoints.length) {
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
    this.ringGeom.dispose(); this.outerRingGeom.dispose(); this.coinFaceGeometry.dispose();
    this.activeMat.dispose(); this.activeOuterMat.dispose(); this.inactiveMat.dispose(); this.coinFaceMaterial.dispose(); this.coinTexture?.dispose();
    this.scene.remove(this.group);
  }
}
