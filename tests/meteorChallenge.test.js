import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeteorChallenge} from '../src/explorer/MeteorChallenge.js';
globalThis.localStorage={getItem:()=>null};
const {ExplorerGame,GAME_STATE}=await import('../src/explorer/ExplorerGame.js');
delete globalThis.localStorage;
const p=new THREE.Vector3(),f=new THREE.Vector3(0,0,1);
function active(){const m=new MeteorChallenge(new THREE.Scene(),()=>.5);m.begin();for(let i=0;i<31;i++)m.update(.1,p,f);return m;}
test('three-second warning, bounded shower and cleanup',()=>{
 const m=new MeteorChallenge(new THREE.Scene(),()=>.5);m.begin();
 for(let i=0;i<20;i++)m.update(.1,p,f);
 assert.equal(m.phase,'warning');assert.equal(m.pool.filter(x=>x.active).length,0);
 for(let i=0;i<11;i++)m.update(.1,p,f);assert.equal(m.phase,'active');
 // Stay outside the fixed paths to check survival duration without damage.
 for(let i=0;i<260;i++)m.update(.1,new THREE.Vector3(i*10,0,0),f);
 assert.equal(m.phase,'complete');assert.ok(m.pool.every(x=>!x.active));assert.equal(m.pool.length,10);
 m.reset();assert.equal(m.health,100);assert.equal(m.phase,'idle');assert.equal(m.shieldMesh.visible,false);m.dispose();
});
test('shield absorbs one hit, damage has two-second grace, zero health ends flight',()=>{
 const m=active();m.shield=true;m.hit(30,p);assert.equal(m.health,100);assert.equal(m.shield,false);
 assert.equal(m.hit(30,p),false);m.invulnerable=0;m.hit(15,p);assert.equal(m.health,85);
 m.hit(30,p);assert.equal(m.health,85);
 for(let i=0;i<3;i++){m.invulnerable=0;m.hit(30,p);}
 assert.equal(m.health,0);assert.equal(m.phase,'dead');assert.equal(m.hit(15,p),false);m.dispose();
});
test('swept relative collisions catch fast meteors and shield pickup',()=>{
 const m=active();m.spawnClock=100;m.shieldMesh.position.copy(p);m.update(.01,p,f);assert.equal(m.shield,true);
 m.shield=false;const meteor=m.pool[0];meteor.active=true;meteor.radius=.3;meteor.age=0;meteor.root.position.set(0,3,0);meteor.velocity.set(0,-100,0);
 m.update(.06,p,f);assert.equal(m.health,85);assert.equal(meteor.active,false);m.dispose();
});
test('success waits for meteor survival; retry preserves collected mission progress',()=>{
 const meteors=active();const mission={id:'mission_01'};
 const game={meteors,hud:{showTip(){},hideMeteorFailure(){}},state:GAME_STATE.FLYING};
 ExplorerGame.prototype.handleMissionSuccess.call(game,{mission,elapsedSeconds:12});assert.equal(game.pendingMissionSuccess.mission,mission);assert.equal(game.state,GAME_STATE.FLYING);
 game.state=GAME_STATE.WRECKED;meteors.phase='dead';
 Object.assign(game,{planetRegistry:new Map(),safePosition:new THREE.Vector3(1,20,1),safeRotation:new THREE.Quaternion(),rocket:{position:new THREE.Vector3(),quaternion:new THREE.Quaternion()},missions:{activeWaypointIndex:5},velocity:new THREE.Vector3(),controls:{keys:new Set(['w']),input:{accelerate:true,thrust:1}},camCurrentPos:new THREE.Vector3(),resumeFlight(){this.state=GAME_STATE.FLYING;}});
 ExplorerGame.prototype.retryMeteorChallenge.call(game);
 assert.equal(game.missions.activeWaypointIndex,5);assert.equal(game.pendingMissionSuccess.mission,mission);assert.equal(game.meteors.health,100);assert.equal(game.meteors.phase,'warning');assert.equal(game.requestedThrottle,0);assert.equal(game.state,GAME_STATE.FLYING);meteors.dispose();
});
