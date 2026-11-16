import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_SKINS, flightMedal, cleanFlightRecord } from '../src/explorer/FlightRewards.js';
import { StudentProgress } from '../src/explorer/StudentProgress.js';
import { Rocket } from '../src/explorer/Rocket.js';
globalThis.localStorage = { getItem: () => null };
const { ExplorerGame, GAME_STATE } = await import('../src/explorer/ExplorerGame.js');
const { AudioSystem } = await import('../src/explorer/AudioSystem.js');
delete globalThis.localStorage;

test('six distinct liveries unlock by their own challenge and preserve opaque jet geometry', () => {
  const profile = new StudentProgress(), rocket = new Rocket();
  const schemes = new Set();
  for (const skin of FLIGHT_SKINS) {
    assert.equal(profile.selectSkin(skin.id), false);
    profile.award(skin.mission); assert.equal(profile.selectSkin(skin.id), true);
    rocket.setLivery(profile.skin);
    schemes.add([rocket.paintMaterial.color.getHexString(), rocket.accentMaterial.color.getHexString(), rocket.engineMaterial.color.getHexString()].join('/'));
    assert.equal(rocket.paintMaterial.transparent, false); assert.equal(rocket.paintMaterial.depthWrite, true);
  }
  assert.equal(schemes.size, 6); assert.equal(profile.stars, 18);
  rocket.setPaint('#ecf2f8'); assert.equal(rocket.accentMaterial.color.getHexString(), 'f2c76e'); rocket.dispose();
});

test('medals and personal best persist but checkpoint retries cannot replace a best time', () => {
  const saved = new Map(); globalThis.localStorage = { getItem: k => saved.get(k), setItem: (k,v) => saved.set(k,v) };
  try {
    const p = new StudentProgress();
    assert.equal(p.recordFlight('challenge_01', { seconds: 90 }).medal, 'Gold');
    assert.equal(p.recordFlight('challenge_01', { seconds: 20, retries: 1 }).personalBest, false);
    assert.equal(p.data.flights.challenge_01.best.seconds, 90);
    assert.equal(p.recordFlight('challenge_01', { seconds: 75, damage: 20 }).personalBest, true);
    assert.equal(new StudentProgress().data.flights.challenge_01.best.medal, 'Silver');
    assert.equal(flightMedal({ damage: 0, mistakes: 3 }), 'Bronze');
    assert.equal(flightMedal({ damage: 0, retries: 1 }), 'Bronze');
    assert.equal(p.recordFlight('unknown', { seconds: 5 }), null);
    assert.equal(cleanFlightRecord({ seconds: Infinity }), null);
    assert.equal(p.stars, 0);
    localStorage.setItem = () => { throw new Error('Full'); };
    assert.equal(p.recordFlight('challenge_02', { seconds: 60 }).saved, false);
  } finally { delete globalThis.localStorage; }
});

function flight() {
  return Object.assign(Object.create(ExplorerGame.prototype), {
    state: GAME_STATE.FLYING, pauseBlocks: new Set(), enginePower: .5, isBoosting: true,
    controls: { hidden: false, hide() { this.hidden = true; }, show() { this.hidden = false; },
      settingsModal: { style: { display: 'none' } }, closeSettingsModal() { this.settingsModal.style.display = 'none'; } },
    hud: { diaryModal: { style: { display: 'none' } }, showPauseModal() {}, hidePauseModal() {}, setPauseBlocked(blocked) { this.blocked = blocked; } },
    audio: { stopEngine() {}, stopBoost() {}, playEngineThrottle() {} }, rocket: { update() {} },
  });
}

test('settings and ranking pause simulation and require explicit unblocked resume', () => {
  const g = flight();
  g.setOverlayPause('settings', true); assert.equal(g.state, GAME_STATE.PAUSED);
  assert.equal(g.controls.hidden, true); assert.equal(g.hud.blocked, true);
  g.resumeFlight(); assert.equal(g.state, GAME_STATE.PAUSED);
  g.setOverlayPause('ranking', true); g.setOverlayPause('settings', false);
  g.resumeFlight(); assert.equal(g.state, GAME_STATE.PAUSED);
  g.setOverlayPause('ranking', false); assert.equal(g.state, GAME_STATE.PAUSED);
  g.resumeFlight(); assert.equal(g.state, GAME_STATE.FLYING);
  g.state = GAME_STATE.VICTORY; g.resumeFlight(); assert.equal(g.state, GAME_STATE.VICTORY);
});

test('pause toggle resumes on second press and first closes a nested diary', () => {
  const g = flight(); g.togglePause(); assert.equal(g.state, GAME_STATE.PAUSED);
  g.hud.diaryModal.style.display = 'flex'; g.togglePause();
  assert.equal(g.hud.diaryModal.style.display, 'none'); assert.equal(g.state, GAME_STATE.PAUSED);
  g.togglePause(); assert.equal(g.state, GAME_STATE.FLYING);
});

test('training completion stops flight, awards no stars and continues to the selected mission', () => {
  let marked, launch;
  const g = flight(); Object.assign(g, {
    afterTrainingMission: 'challenge_03', progress: { finishTraining(value) { marked = value; } },
    resetFlightMotion() {}, challenges: { clear() {} },
    startLaunchForMission(id) { launch = id; },
  });
  Object.assign(g.hud, { updateChallengeHUD() {}, showTrainingComplete(next) { assert.equal(next, true); }, hideTrainingComplete() {} });
  g.handleTrainingComplete(); assert.equal(g.state, GAME_STATE.VICTORY); assert.equal(marked, true);
  g.finishTrainingFlow(true); assert.equal(launch, 'challenge_03'); assert.equal(g.afterTrainingMission, null);
});

test('muted signal sounds never initialize an audio context', () => {
  const sound = { muted: true, init() { assert.fail('Muted sound must stay silent'); } };
  AudioSystem.prototype.playBeep.call(sound, 880, .04);
});
