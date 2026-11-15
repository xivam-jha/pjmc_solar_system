import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeStudentAuth, requestStudentRecords } from '../src/explorer/StudentAuth.js';
import { StudentProgress } from '../src/explorer/StudentProgress.js';

test('online awards survive network failure, retry once and restore badges on another device', async () => {
  const listeners = new Set(), local = new Map(), server = new Set(['mission_01']);
  let offline = false, awards = 0;
  const parent = { postMessage(data) {
    queueMicrotask(() => {
      let response;
      if (data.type === 'pjmc:ready') response = {type:'pjmc:student',nonce:data.nonce,student:{id:'25',name:'Pilot 25'}};
      else {
        response = {type:'pjmc:records-result',nonce:data.nonce};
        if (offline) response.error = 'Offline';
        else {
          if (data.action==='award') {server.add(data.mission);awards++;}
          response.result = {badges:[...server]};
        }
      }
      for(const fn of [...listeners]) fn({origin:'https://shivamonline.gt.tc',source:parent,data:response});
    });
  }};
  globalThis.window = {parent,addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn)};
  globalThis.location = {hash:'#pjmc=bridge'};
  globalThis.localStorage = {getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)};
  try {
    await initializeStudentAuth();
    const p = new StudentProgress(); await p.syncOnline();
    assert.equal(p.stars,3);assert.equal(p.unlocked(1),true);
    offline=true; p.award('mission_02'); await p.syncOnline();
    assert.equal(p.data.pending.mission_02,true);
    assert.equal(JSON.parse(local.get(p.storageKey)).pending.mission_02,true);
    offline=false; await p.syncOnline();
    assert.equal(awards,1);assert.equal(p.data.pending.mission_02,undefined);
    p.award('mission_02'); await p.syncOnline(); assert.equal(awards,1);
    local.clear(); const other = new StudentProgress(); await other.syncOnline();
    assert.equal(other.stars,6);assert.equal(other.unlocked(2),true);
    assert.equal(listeners.size,0);
  } finally {for(const key of ['window','location','localStorage']) delete globalThis[key];}
});

test('records RPC ignores spoofed replies and clears timeout listener', async () => {
  let listener, data;
  const parent={postMessage:d=>{data=d;}};
  const host={parent,addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>listener=null};
  const pending=requestStudentRecords('load',{},host,20);
  listener({origin:'https://evil.example',source:parent,data:{type:'pjmc:records-result',nonce:data.nonce,result:{badges:['mission_04']}}});
  listener({origin:'https://shivamonline.gt.tc',source:{},data:{type:'pjmc:records-result',nonce:data.nonce,result:{}}});
  assert.ok(listener);
  await assert.rejects(pending,/उपलब्ध/);
  assert.equal(listener,null);
});
