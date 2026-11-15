import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Rocket} from '../src/explorer/Rocket.js';

test('concept spacecraft retains flight, camera and throttle contracts with bounded geometry',()=>{
 const rocket=new Rocket();
 assert.equal(rocket.model.getObjectByName('Smoked blue glass canopy').material.transparent,true);
 assert.ok(rocket.model.getObjectByName('Gold stabilizer cap'));
 assert.ok(rocket.model.getObjectByName('Brushed gold exhaust rim -1'));
 const box=new THREE.Box3();let triangles=0;
 rocket.root.updateMatrixWorld(true);
 rocket.model.traverse(o=>{if(o.isMesh){
  const a=o.geometry.attributes.position.array;assert.ok([...a].every(Number.isFinite));
  triangles+=(o.geometry.index?.count || o.geometry.attributes.position.count)/3;
  if(o.visible)box.union(new THREE.Box3().setFromObject(o));
 }});
 const size=box.getSize(new THREE.Vector3());
 assert.ok(size.x>1.5 && size.x<2.2);assert.ok(size.z>1.6 && size.z<2.2);
 assert.ok(triangles<30000,`triangle budget ${triangles}`);
 rocket.update(.016,0);assert.equal(rocket.rightFlame.visible,false);assert.equal(rocket.engineLight.visible,false);
 rocket.update(.016,1);assert.equal(rocket.rightFlame.visible,true);assert.equal(rocket.leftFlame.visible,true);
 assert.equal(rocket.rightFlame.position.z,rocket.leftFlame.position.z);
 assert.ok(rocket.rightFlame.position.z<0);
 rocket.update(.016,0);assert.equal(rocket.rightFlame.visible,false);
 rocket.setPaint('#f4b942');assert.equal(rocket.paintMaterial.color.getHexString(),'f4b942');
 rocket.teleport(new THREE.Vector3(2,3,4),new THREE.Vector3(2,3,14));
 assert.ok(rocket.getForwardVector().distanceTo(new THREE.Vector3(0,0,1))<1e-6);
 assert.ok(rocket.getCockpitPosition(new THREE.Vector3()).toArray().every(Number.isFinite));
 rocket.dispose();assert.equal(rocket.root.children.length,0);
});
