import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ChallengeManager, reflectedBeam } from '../src/explorer/ChallengeManager.js';
import { CHALLENGES, TRAINING_MISSION } from '../src/explorer/ChallengeCatalog.js';
import { MISSIONS } from '../src/explorer/Missions.js';
import { StudentProgress, LESSONS } from '../src/explorer/StudentProgress.js';
import { safeAboveSystem, clearOfBodies } from '../src/explorer/FlightSafety.js';
globalThis.localStorage = { getItem: () => null };
const { ExplorerGame, GAME_STATE } = await import('../src/explorer/ExplorerGame.js');
delete globalThis.localStorage;

const start = new THREE.Vector3(35, 95, 40);
function challenge(kind) {
  const game = new ChallengeManager(new THREE.Scene(), () => .4);
  game.start(CHALLENGES.find(m => m.kind === kind), start);
  return game;
}
function hold(game, seconds, input = {}) {
  const position = input.position || game.currentTarget?.interactionPosition.clone() || start;
  game.resetMotion(position);
  for (let i = 0; i < Math.ceil(seconds * 10); i++) game.update(.1, { position, speed: 0, turnRate: 0, ...input });
}

test('all challenge arenas and connecting routes remain above solid planets', () => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1));
  const registry = new Map([['sun', { surfaceMesh: mesh, body: { radiusWorld: 8 } }]]);
  const spawn = safeAboveSystem(registry);
  const game = new ChallengeManager(new THREE.Scene(), () => .4);
  for (const mission of CHALLENGES) {
    game.start(mission, spawn);
    let previous = spawn;
    for (const target of game.targets) {
      assert.ok(target.position.length() < 250);
      for (let i = 0; i <= 20; i++) assert.ok(clearOfBodies(previous.clone().lerp(target.position, i / 20), registry, 4));
      previous = target.position;
    }
  }
  game.dispose();
});

test('rescue requires all three capsules AND a slow return to the station; timeout cannot win', () => {
  const game = challenge('rescue');
  hold(game, 2, { speed: 8 }); assert.equal(game.stage, 0);
  for (let i = 0; i < 3; i++) hold(game, 1.5);
  assert.equal(game.stage, 3); assert.equal(game.phase, 'active');
  hold(game, 2.5); assert.equal(game.phase, 'complete');
  game.start(CHALLENGES[0], start); game.elapsedSeconds = 179.95;
  game.update(.1, { position: start });
  assert.equal(game.phase, 'failed');
  const stage = game.stage; hold(game, 3); assert.equal(game.stage, stage);
  game.dispose();
});

test('repair needs parts and six steady seconds; drifting away loses partial repair', () => {
  const game = challenge('repair');
  const satellite = game.targets[3].position;
  hold(game, 7, { position: satellite }); assert.equal(game.stage, 0);
  for (let i = 0; i < 3; i++) hold(game, 1);
  assert.equal(game.stage, 3);
  hold(game, 2); assert.ok(game.hold >= 1.9);
  hold(game, 1, { turnRate: 1 }); assert.ok(game.hold < .01);
  hold(game, 5); assert.equal(game.phase, 'active');
  hold(game, 1); assert.equal(game.phase, 'complete');
  game.dispose();
});

test('cargo rewards gentle flying, takes damage from fast turns and collisions, and must be delivered', () => {
  const game = challenge('cargo');
  hold(game, 3, { position: start, speed: 1, turnRate: 1.5 }); assert.equal(game.cargo, 100);
  hold(game, 2, { position: start, speed: 9, turnRate: 1.5 }); assert.ok(game.cargo < 80);
  const condition = game.cargo; assert.equal(game.hit(20), true); assert.equal(game.hit(20), false);
  assert.equal(game.cargo, condition - 20);
  hold(game, .1); hold(game, .1); assert.equal(game.stage, 2);
  hold(game, 3); assert.equal(game.phase, 'active'); // Brief impact stun delays unloading.
  hold(game, .5); assert.equal(game.phase, 'complete');
  game.start(CHALLENGES[2], start); game.hit(100);
  assert.equal(game.phase, 'failed'); assert.equal(game.cargo, 0);
  game.dispose();
});

test('lost signal has no distant arrow; hint expires and data requires a stationary scan', () => {
  const game = challenge('signal'), out = new THREE.Vector3();
  game.update(.1, { position: start }); assert.equal(game.getNavigationTarget(out), false);
  assert.equal(game.view().instruction, game.signalTrend);
  assert.equal(game.hint(), true); assert.equal(game.hint(), false);
  assert.equal(game.getNavigationTarget(out), true);
  hold(game, 8.2, { position: start }); assert.equal(game.getNavigationTarget(out), false);
  const weakSignal = game.signal;
  hold(game, .1, { position: start.clone().lerp(game.currentTarget.position, .75) });
  assert.ok(game.signal > weakSignal);
  hold(game, 4, { speed: 6 }); assert.equal(game.stage, 0);
  hold(game, 3); assert.equal(game.phase, 'complete');
  game.dispose();
});

test('samples require each labelled rock, not an unrelated rock or fly-through', () => {
  const game = challenge('sample');
  hold(game, 4, { position: game.targets[2].position }); assert.equal(game.stage, 0);
  hold(game, 4, { speed: 8 }); assert.equal(game.stage, 0);
  for (let i = 0; i < 3; i++) {
    hold(game, 3); assert.equal(game.stage, i);
    assert.equal(game.classifySample(['S', 'M', 'C'][i]), false);
    assert.equal(game.classifySample(['C', 'S', 'M'][i]), true);
  }
  assert.equal(game.mistakes, 3);
  assert.equal(game.phase, 'complete'); assert.equal(game.targets.filter(t => t.done).length, 3);
  game.dispose();
});

test('laser puzzle rejects remote actions and wrong angles; three linked relays complete it once', () => {
  const game = challenge('relay'); let objectives = 0;
  game.onObjective = () => objectives++;
  assert.equal(game.rotateRelay(1), false); assert.equal(game.linkRelay(), false);
  for (let i = 0; i < 3; i++) {
    hold(game, .1);
    assert.equal(game.linkRelay(), false);
    for (let turn = 0; turn < 8 && !game.currentTarget.beamAligned; turn++) assert.equal(game.rotateRelay(1), true);
    assert.ok(game.currentTarget.beamAligned);
    const end = new THREE.Vector3().fromBufferAttribute(game.links[i].geometry.attributes.position, 1);
    assert.ok(end.distanceTo(game.currentTarget.destination) < .001);
    assert.equal(game.linkRelay(), true);
  }
  assert.equal(game.phase, 'complete'); assert.equal(objectives, 3);
  assert.equal(game.linkRelay(), false); assert.equal(game.rotateRelay(1), false);
  assert.ok(game.links.every(link => link.visible));
  game.dispose();
});

test('moving debris catches a swept collision, has grace time and cannot drain health while idle', () => {
  const game = challenge('sample');
  const hazard = game.hazards[0];
  game.hazards = [hazard]; hazard.base.copy(start); hazard.mesh.position.copy(start);
  game.resetMotion(start.clone().add(new THREE.Vector3(-6, 0, 0)));
  game.update(.1, { position: start.clone().add(new THREE.Vector3(6, 0, 0)), speed: 12 });
  assert.equal(game.health, 80);
  assert.equal(game.hit(20), false);
  const health = game.health; game.clear(); game.update(.1, { position: start });
  assert.equal(game.health, health); assert.equal(game.group.children.length, 0);
  game.start(CHALLENGES[4], start); assert.equal(game.health, 100); assert.equal(game.stage, 0);
  game.dispose(); assert.equal(game.resources.size, 0);
});

test('ten awards preserve old badges, challenges are independent, free flight never gives stars', () => {
  const saved = new Map(); globalThis.localStorage = { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v) };
  try {
    const profile = new StudentProgress();
    assert.equal(profile.unlocked('mission_02'), false);
    assert.ok(CHALLENGES.every(m => profile.unlocked(m.id)));
    assert.equal(profile.unlocked('free_flight'), true); assert.equal(profile.unlocked('unknown'), false);
    profile.award('challenge_06'); assert.equal(profile.unlocked('mission_02'), false);
    profile.award('mission_01'); assert.equal(profile.unlocked('mission_02'), true);
    for (const mission of MISSIONS) { profile.award(mission.id); profile.award(mission.id); }
    assert.equal(Object.keys(LESSONS).length, 10);
    assert.equal(profile.stars, 30); assert.equal(new StudentProgress().stars, 30);
    assert.equal(profile.data.badges.free_flight, undefined);
  } finally { delete globalThis.localStorage; }
});

test('challenge flight pauses the clock, bypasses Gold/meteor completion and retries the failed challenge', () => {
  const objectives = challenge('rescue');
  let success = 0, retry = 0, failure;
  const game = {
    state: GAME_STATE.FLYING, activeMission: CHALLENGES[0], challenges: objectives,
    rocket: { position: start.clone(), quaternion: new THREE.Quaternion(), update() {} }, velocity: new THREE.Vector3(),
    flightSpeed: 0, pitchRate: 0, yawRate: 0, rollRate: 0,
    updateFlightPhysics() {}, updateCamera() {}, updateHUDAndNav() {},
    missions: { update() { assert.fail('Challenges must not advance Gold checkpoints'); } },
    meteors: { update() { assert.fail('No unrelated meteor shower'); } },
    hud: { updateChallengeHUD() {}, showMeteorFailure(details) { failure = details; }, hideMeteorFailure() {} },
    controls: { hide() {}, disable() {}, getInput() { return {}; } }, audio: { stopEngine() {}, stopBoost() {} },
    handleMissionSuccess(result) { success++; assert.equal(result.mission.id, 'challenge_01'); },
    safePosition: new THREE.Vector3(), safeRotation: new THREE.Quaternion(), pauseBlocks: new Set(), planetRegistry: new Map(), camCurrentPos: new THREE.Vector3(),
    resetFlightMotion() {}, resumeFlight() { retry++; this.state = GAME_STATE.FLYING; },
    restartMission() { assert.fail('Checkpoint must not restart the whole challenge'); },
  };
  ExplorerGame.prototype.update.call(game, .1); const time = objectives.timeLeft;
  game.state = GAME_STATE.PAUSED; ExplorerGame.prototype.update.call(game, 20);
  assert.equal(objectives.timeLeft, time);
  game.state = GAME_STATE.FLYING; objectives.fail('Test failure');
  ExplorerGame.prototype.update.call(game, .1);
  assert.equal(game.state, GAME_STATE.WRECKED); assert.equal(failure.reason, 'Test failure'); assert.equal(success, 0);
  ExplorerGame.prototype.retryMeteorChallenge.call(game); assert.equal(retry, 1);
  game.state = GAME_STATE.FLYING; objectives.phase = 'complete';
  ExplorerGame.prototype.update.call(game, .1); assert.equal(success, 1);
  objectives.dispose();
});

test('challenge success shows its learning reward immediately without starting meteors', () => {
  let shown = 0;
  const game = {
    state: GAME_STATE.FLYING,
    challenges: { performance() { return { seconds: 70, damage: 0, retries: 0 }; } },
    progress: { recordFlight() { return {}; } },
    meteors: { finished: false, begin() { assert.fail('Challenge should finish at its own objective'); } },
    audio: { stopEngine() {}, stopBoost() {}, playFanfare() {} }, rocket: { update() {} }, controls: { hide() {} },
    hud: { updateChallengeHUD() {}, showVictoryModal(mission) { assert.equal(mission.id, 'challenge_06'); shown++; } },
  };
  ExplorerGame.prototype.handleMissionSuccess.call(game, { mission: CHALLENGES[5], elapsedSeconds: 70 });
  assert.equal(game.state, GAME_STATE.VICTORY); assert.equal(shown, 1);
});


test('rescue collects any capsule first, carries passengers and restores their checkpoint', () => {
  const game = challenge('rescue');
  hold(game, 1.5, { position: game.targets[2].position });
  assert.equal(game.targets[2].done, true); assert.equal(game.targets[0].done, false);
  assert.equal(game.carryPods.filter(p => p.visible).length, 1);
  const saved = game.checkpoint.position.clone();
  game.elapsedSeconds = 180; game.fail('timeout');
  const pose = game.restoreCheckpoint();
  assert.ok(pose.position.equals(saved)); assert.equal(game.stage, 1); assert.equal(game.retries, 1);
  assert.equal(game.targets[2].done, true); assert.equal(game.carryPods[0].visible, true);
  assert.ok(game.timeLeft >= 60); assert.equal(game.health, 100);
  hold(game, 1.5); hold(game, 1.5); hold(game, 2.5); assert.equal(game.phase, 'complete');
  game.dispose();
});

test('cargo warning overrides navigation; docking zone is clear and structures block swept entry', () => {
  const game = challenge('cargo');
  hold(game, .2, { position: start, speed: 10, turnRate: 1.6 });
  assert.match(game.view().instruction, /Cargo stress/); assert.equal(game.view().warning, true);
  const station = game.targets.at(-1);
  const dock = station.interactionPosition.clone();
  assert.equal(game.resolveStructureCollision(dock, dock, 0), false);
  const before = station.position.clone().add(new THREE.Vector3(0, 0, -10));
  const after = station.position.clone().add(new THREE.Vector3(0, 0, 10));
  assert.equal(game.resolveStructureCollision(after, before, 12), true);
  assert.ok(after.distanceTo(station.position) > station.solidRadius + .35);
  hold(game, .1); hold(game, .1);
  game.fail('test'); game.restoreCheckpoint(); assert.equal(game.stage, 2);
  game.dispose();
});

test('repair installs collected parts and straightens damaged panels as work progresses', () => {
  const game = challenge('repair'), satellite = game.targets[3];
  const broken = Math.abs(satellite.panelJoints[0].rotation.z);
  for (let i = 0; i < 3; i++) hold(game, 1);
  assert.equal(satellite.parts.filter(p => p.visible).length, 3);
  hold(game, 3); assert.ok(Math.abs(satellite.panelJoints[0].rotation.z) < broken);
  assert.equal(satellite.weld.visible, true);
  hold(game, 3); assert.ok(satellite.panelJoints.every(j => j.rotation.z === 0));
  assert.equal(satellite.weld.visible, false); game.dispose();
});

test('signal emits faster warmer pulses and gives automatic help when no progress is made', () => {
  const game = challenge('signal'); const tones = [];
  game.onSignalPulse = frequency => tones.push(frequency);
  hold(game, 19, { position: start });
  assert.ok(tones.length >= 9); assert.ok(game.hintRemaining > 0);
  assert.match(game.view().instruction, /मदद/); assert.equal(game.scanPulse.visible, true);
  const weak = tones.at(-1); game.beepClock = 0;
  hold(game, .1, { position: start.clone().lerp(game.currentTarget.interactionPosition, .8) });
  assert.ok(tones.at(-1) > weak); game.dispose();
});

test('practice needs four actual actions, is damage-free and never creates a learning award', () => {
  const game = new ChallengeManager(new THREE.Scene()); game.start(TRAINING_MISSION, start);
  hold(game, 10); assert.equal(game.stage, 0); assert.equal(game.hit(100), false);
  hold(game, .3, { input: { yaw: .3 } }); assert.equal(game.stage, 1);
  hold(game, .8, { speed: 4 }); assert.equal(game.stage, 2);
  hold(game, .6, { input: { brake: true } }); assert.equal(game.stage, 3);
  hold(game, 1.5); assert.equal(game.phase, 'complete');
  const progress = new StudentProgress(); progress.finishTraining(); progress.award(TRAINING_MISSION.id);
  assert.equal(progress.stars, 0); assert.equal(progress.data.trainingDone, true);
  assert.equal(progress.recordFlight(TRAINING_MISSION.id, { seconds: 30 }), null); game.dispose();
});

test('beam reflection follows a mirror normal and remains solvable from either side', () => {
  assert.ok(reflectedBeam(new THREE.Vector3(0, 0, 1), 45).distanceTo(new THREE.Vector3(1, 0, 0)) < .001);
  for (const side of [.1, .9]) {
    const game = new ChallengeManager(new THREE.Scene(), () => side); game.start(CHALLENGES[5], start);
    for (let i = 0; i < 3; i++) {
      hold(game, .1);
      for (let turn = 0; turn < 8 && !game.currentTarget.beamAligned; turn++) game.rotateRelay(1);
      assert.equal(game.linkRelay(), true);
    }
    assert.equal(game.phase, 'complete'); game.dispose();
  }
});
