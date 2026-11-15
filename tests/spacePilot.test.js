import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StudentProgress } from '../src/explorer/StudentProgress.js';
import { MissionManager, MISSIONS } from '../src/explorer/Missions.js';

test('rewards are idempotent, unlock the next mission and survive reload', () => {
  const saved = new Map();
  globalThis.localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
  const profile = new StudentProgress();
  assert.equal(profile.unlocked(1), false);
  profile.award('mission_01'); profile.award('mission_01');
  assert.equal(profile.stars, 3);
  assert.equal(new StudentProgress().unlocked(1), true);
  localStorage.setItem = () => { throw new Error('quota'); };
  assert.equal(profile.addPhoto('data:image/jpeg;base64,AA==', 'Moon'), false);
  assert.equal(profile.data.photos.length, 0);
  delete globalThis.localStorage;
});

test('routes clear rendered planets and high-speed segments cross gates', () => {
  const scene = new THREE.Scene();
  const registry = new Map();
  for (const [id, x, radius] of [['earth', 25, 2.16], ['moon', 31, 1], ['mars', 55, 1.5], ['saturn', 100, 6], ['jupiter', 75, 6.5]]) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1));
    mesh.position.x = x; scene.add(mesh);
    const tiltGroup = new THREE.Group(); scene.add(tiltGroup);
    registry.set(id, { surfaceMesh: mesh, body: { radiusWorld: radius, tiltGroup } });
  }
  const manager = new MissionManager(scene, registry);
  for (const mission of MISSIONS.slice(0, 4)) {
    manager.startMission(mission.id);
    manager.prepareRoute(new THREE.Vector3(25, 4, 0), new THREE.Vector3(0, 0, 1));
    for (const point of manager.route) {
      for (const entry of registry.values()) {
        assert.ok(point.distanceTo(entry.surfaceMesh.position) >= entry.body.radiusWorld + 1.79, mission.id);
      }
    }
  }
  manager.startMission('mission_01');
  manager.route = manager.activeMission.waypoints.map((_, i) => new THREE.Vector3(100 + i * 10, 100, 100));
  manager.previousRocketPos = new THREE.Vector3(98, 100, 100);
  manager.update(0.1, new THREE.Vector3(102, 100, 100));
  assert.equal(manager.activeWaypointIndex, 1);
});
