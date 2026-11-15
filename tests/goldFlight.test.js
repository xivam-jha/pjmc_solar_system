import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { safeAboveSystem, clearOfBodies, recoverOutsideBodies } from '../src/explorer/FlightSafety.js';
import { MissionManager, MISSIONS } from '../src/explorer/Missions.js';
function registry() {
 const map=new Map();
 for(const [id,x,y,z,r] of [['sun',0,0,0,8],['earth',25,1,0,2.16],['moon',28,1,0,1],['mars',-45,0,12,2],['saturn',100,0,-20,6],['jupiter',-75,0,40,7],['neptune',150,0,0,4]]) {
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(1));mesh.position.set(x,y,z);mesh.updateMatrixWorld();
  map.set(id,{surfaceMesh:mesh,body:{radiusWorld:r,tiltGroup:new THREE.Group()}});
 }return map;
}
test('launch above system and all mission routes keep a safe approach',()=>{
 const bodies=registry(),start=safeAboveSystem(bodies);
 assert.ok(start.y>70);assert.ok(start.length()<250);assert.ok(clearOfBodies(start,bodies));
 const manager=new MissionManager(new THREE.Scene(),bodies);
 for(const mission of MISSIONS.slice(0,4)){
  manager.startMission(mission.id);manager.prepareRoute(start,new THREE.Vector3(0,-1,0));
  let previous=start;
  for(const point of manager.route){
   for(let n=0;n<=50;n++)assert.ok(clearOfBodies(previous.clone().lerp(point,n/50),bodies,1.5),mission.id);
   previous=point;
  }
 }
 manager.dispose();
});
test('Gold collects once, ends navigation, and survives a nearby collision recovery',()=>{
 const bodies=registry(),manager=new MissionManager(new THREE.Scene(),bodies);
 manager.startMission('mission_01');manager.prepareRoute(safeAboveSystem(bodies),new THREE.Vector3(0,-1,0));
 let rewards=0,complete=0;manager.onWaypointComplete=()=>rewards++;manager.onMissionComplete=()=>complete++;
 const first=manager.route[0];manager.update(.016,first);manager.update(.016,first);
 assert.equal(rewards,1);assert.equal(manager.getMissionProgress().current,1);
 const recovery=recoverOutsideBodies(new THREE.Vector3(25,1,0),bodies);
 assert.ok(clearOfBodies(recovery,bodies));assert.ok(recovery.distanceTo(new THREE.Vector3(25,1,0))<15);
 manager.previousRocketPos=recovery.clone();assert.equal(manager.getMissionProgress().current,1);
 for(let i=1;i<manager.route.length;i++)manager.update(.016,manager.route[i]);
 assert.equal(complete,1);assert.equal(rewards,5);assert.equal(manager.getActiveWaypointPosition(new THREE.Vector3()),false);
 manager.update(.016,manager.route.at(-1));assert.equal(complete,1);
 assert.ok(manager.checkpointMeshes.every(m=>m.name.startsWith('PJMC_Gold_')));
 manager.dispose();
});
