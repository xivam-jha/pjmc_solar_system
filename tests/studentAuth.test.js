import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeStudentAuth, receiveDashboardProfile, getAuthenticatedStudent, isTrustedDashboardEvent, announceFlightReady } from '../src/explorer/StudentAuth.js';
import { StudentProgress } from '../src/explorer/StudentProgress.js';
function fixture() {
  let listener, request;
  const parent = { postMessage: (data, origin) => {
    if (data.type === 'pjmc:records') {
      queueMicrotask(() => listener?.({origin:'https://shivamonline.gt.tc',source:parent,data:{type:'pjmc:records-result',nonce:data.nonce,result:{badges:[]}}}));
    } else request = { data, origin };
  } };
  const host = { parent, addEventListener: (_, fn) => { listener = fn; }, removeEventListener: () => { listener = null; } };
  return { host, request: () => request, listening: () => !!listener,
    send: (overrides = {}) => listener?.({ origin: 'https://shivamonline.gt.tc', source: parent,
      data: { type: 'pjmc:student', nonce: request.data.nonce, student: { id: '17', name: 'Student Seventeen' } }, ...overrides }) };
}
test('bridge rejects untrusted origins, windows, nonces, malformed profiles and missing parents', async () => {
  const f = fixture(); const pending = receiveDashboardProfile(f.host);
  assert.equal(f.request().origin, 'https://shivamonline.gt.tc');
  f.send({ origin: 'https://example.com' }); f.send({ source: {} });
  f.send({ data: { type: 'pjmc:student', nonce: 'wrong', student: { id:'99', name:'Spoof' } } });
  assert.equal(f.listening(), true); f.send();
  assert.deepEqual(await pending, { id:'17', name:'Student Seventeen' });
  assert.equal(f.listening(), false);
  const event = { origin: 'https://shivamonline.gt.tc', source: f.host.parent, data: { nonce: f.request().data.nonce } };
  assert.equal(isTrustedDashboardEvent(event, f.host), true);
  assert.equal(isTrustedDashboardEvent({ ...event, source: {} }, f.host), false);
  assert.equal(isTrustedDashboardEvent({ ...event, origin: 'https://example.com' }, f.host), false);
  assert.equal(isTrustedDashboardEvent({ ...event, data: { nonce: 'wrong' } }, f.host), false);
  announceFlightReady(f.host); assert.equal(f.request().data.type, 'pjmc:flight-ready');
  const missing = fixture();
  await assert.rejects(receiveDashboardProfile(missing.host, 5), /पहचान नहीं मिली/);
  assert.equal(missing.listening(), false);
  const bad = fixture(); const invalid = receiveDashboardProfile(bad.host);
  bad.send({data:{type:'pjmc:student',nonce:bad.request().data.nonce,student:{id:'0',name:'Fake'}}});
  await assert.rejects(invalid, /जानकारी नहीं मिली/);
  const standalone = {}; standalone.parent = standalone;
  await assert.rejects(receiveDashboardProfile(standalone), /Dashboard/);
});
test('bridge avoids fetch, isolates progress, migrates old sessions and ignores URL identities', async () => {
  const local = new Map(), session = new Map(), f = fixture();
  globalThis.window = f.host;
  globalThis.location = { hash: '#pjmc=bridge', pathname: '/pjmc_solar_system/', search: '', replace: url => { location.target = url; } };
  globalThis.history = { replaceState: () => { location.hash = ''; } };
  globalThis.sessionStorage = { getItem:k=>session.get(k),removeItem:k=>session.delete(k) };
  globalThis.localStorage = { getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v) };
  globalThis.fetch = () => { throw new Error('No network authentication allowed'); };
  try {
    const login = initializeStudentAuth(); f.send(); assert.equal(await login, true);
    assert.equal(getAuthenticatedStudent().id, '17');
    const progress = new StudentProgress(); progress.award('mission_01');
    await progress.syncOnline();
    assert.equal(progress.data.name, 'Student Seventeen');
    assert.equal(local.has('pjmc_space_pilot_v1:student:17'), true);
    assert.equal(local.has('pjmc_space_pilot_v1'), false);
    assert.equal(location.hash, '#pjmc=bridge');
    for (const hash of ['#login=1', '#code=old&state=old']) {
      location.hash = hash; assert.equal(await initializeStudentAuth(), false);
      assert.equal(location.target, 'https://shivamonline.gt.tc/student/explore-universe.php');
      assert.equal(location.hash, '');
    }
    session.set('pjmc_game_login', 'old-token');
    assert.equal(await initializeStudentAuth(), false); assert.equal(session.size, 0);
    location.hash = '#name=Fake&id=17';
    assert.equal(await initializeStudentAuth(), true); assert.equal(getAuthenticatedStudent(), null);
  } finally {
    for (const k of ['window','location','history','sessionStorage','localStorage','fetch']) delete globalThis[k];
  }
});
