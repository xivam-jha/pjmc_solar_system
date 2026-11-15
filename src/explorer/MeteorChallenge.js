import * as THREE from 'three';

// Fixed-size visual pool and swept collision checks for mobile frame rates.
export class MeteorChallenge {
  constructor(scene, random = Math.random) {
    this.random=random;this.group=new THREE.Group();this.group.name='PJMC meteor shower';scene.add(this.group);
    this.rockGeometry=new THREE.IcosahedronGeometry(1,2);
    const p=this.rockGeometry.attributes.position,colors=[];
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
      const n=Math.sin(x*11+y*7+z*5)*Math.cos(z*13-x*3);
      const dent=1+.15*n+.08*Math.sin(y*19+z*9);
      p.setXYZ(i,x*dent,y*dent*.86,z*dent);
      const heat=Math.max(0,-y-.3)*.8;
      const c=new THREE.Color().setRGB(.18+n*.035+heat,.13+n*.03+heat*.24,.10+n*.025);
      colors.push(c.r,c.g,c.b);
    }
    this.rockGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));this.rockGeometry.computeVertexNormals();
    this.rockMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:.03,emissive:0x422318,emissiveIntensity:.65,flatShading:true});
    this.trailGeometry=new THREE.ConeGeometry(.28,3.4,8,1,true);this.trailGeometry.translate(0,2,0);
    this.trailMaterial=new THREE.MeshBasicMaterial({color:0xff9d36,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    this.coreGeometry=new THREE.SphereGeometry(1.04,10,8,0,Math.PI*2,Math.PI*.5,Math.PI*.5);
    this.coreMaterial=new THREE.MeshBasicMaterial({color:0xffb34b,transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending});
    this.pool=Array.from({length:10},()=>{
      const root=new THREE.Group(),rock=new THREE.Mesh(this.rockGeometry,this.rockMaterial);
      root.add(rock,new THREE.Mesh(this.trailGeometry,this.trailMaterial),new THREE.Mesh(this.coreGeometry,this.coreMaterial));root.visible=false;this.group.add(root);
      return {root,rock,velocity:new THREE.Vector3(),target:new THREE.Vector3(),age:0,active:false,radius:.3};
    });
    this.shieldMesh=new THREE.Mesh(new THREE.IcosahedronGeometry(.35,1),new THREE.MeshBasicMaterial({color:0x68ddff,wireframe:true}));this.group.add(this.shieldMesh);
    this.sparkGeometry=new THREE.OctahedronGeometry(.045);this.sparkMaterial=new THREE.MeshBasicMaterial({color:0xffca79});
    this.sparks=Array.from({length:12},()=>{const m=new THREE.Mesh(this.sparkGeometry,this.sparkMaterial);m.visible=false;this.group.add(m);return {mesh:m,velocity:new THREE.Vector3()};});
    this.reset();
  }
  reset(level=0) {
    this.level=level;this.phase='idle';this.health=100;this.shield=false;this.invulnerable=0;this.timer=0;this.spawnClock=0;this.spawnCount=0;this.damageTaken=0;this.impactTime=0;this.previousRocket=null;
    this.pool.forEach(m=>{m.active=false;m.root.visible=false;});this.sparks.forEach(s=>s.mesh.visible=false);this.shieldMesh.visible=false;
  }
  get finished(){return this.phase==='complete';}
  begin(){if(this.phase==='idle'){this.phase='warning';this.timer=3;}}
  hit(damage,position){
    if(this.phase!=='active'||this.invulnerable>0)return false;
    this.invulnerable=2;
    if(this.shield){this.shield=false;this.onShield?.();return true;}
    this.health=Math.max(0,this.health-damage);this.damageTaken+=damage;this.impactTime=.4;
    for(const s of this.sparks){s.mesh.visible=true;s.mesh.position.copy(position);s.velocity.set(this.random()-.5,this.random()-.5,this.random()-.5).multiplyScalar(5);}
    this.onDamage?.(damage,this.health);
    if(this.health===0){this.phase='dead';this.pool.forEach(m=>{m.active=false;m.root.visible=false;});this.shieldMesh.visible=false;}
    return true;
  }
  spawn(position){
    const m=this.pool.find(m=>!m.active);if(!m)return;
    this.spawnCount++;
    m.radius=this.level>0&&this.spawnCount%4===0?.55:.3;
    const aimed=this.spawnCount%3===1;
    m.target.copy(position).add(new THREE.Vector3(aimed?0:(this.random()-.5)*6,0,aimed?0:(this.random()-.5)*6));
    const offset=new THREE.Vector3(5+this.random()*4,9+this.random()*3,(this.random()-.5)*7);
    m.root.position.copy(m.target).add(offset);m.velocity.copy(offset).multiplyScalar(-1/(this.level===0?2.4:1.9));
    m.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),m.velocity.clone().normalize());m.root.scale.setScalar(m.radius);
    m.active=true;m.age=0;m.root.visible=true;
  }
  update(dt,position,forward){
    dt=Math.min(Math.max(dt,0),.1);
    this.invulnerable=Math.max(0,this.invulnerable-dt);this.impactTime=Math.max(0,this.impactTime-dt);
    for(const s of this.sparks){s.mesh.visible=this.impactTime>0;if(s.mesh.visible)s.mesh.position.addScaledVector(s.velocity,dt);}
    if(this.phase==='warning'){
      this.timer-=dt;
      if(this.timer<=0){this.phase='active';this.timer=this.level===0?20:25;this.shieldMesh.position.copy(position).addScaledVector(forward,5).add(new THREE.Vector3(0,1,0));this.shieldMesh.visible=true;}
    }else if(this.phase==='active'){
      this.timer-=dt;this.spawnClock-=dt;
      if(this.spawnClock<=0){this.spawn(position);this.spawnClock=this.level===0?1.5:1.05;}
      const rocketStart=this.previousRocket||position;
      if(this.shieldMesh.visible){
        this.shieldMesh.rotation.y+=dt*1.8;
        const nearest=new THREE.Line3(rocketStart,position).closestPointToPoint(this.shieldMesh.position,true,new THREE.Vector3());
        if(nearest.distanceTo(this.shieldMesh.position)<.85){this.shield=true;this.shieldMesh.visible=false;this.onPickup?.();}
      }
      for(const m of this.pool){if(!m.active)continue;
        const old=m.root.position.clone();m.root.position.addScaledVector(m.velocity,dt);m.rock.rotation.y+=dt*.9;m.rock.rotation.z+=dt*.6;m.age+=dt;
        const relative=new THREE.Line3(old.sub(rocketStart),m.root.position.clone().sub(position));
        const nearest=relative.closestPointToPoint(new THREE.Vector3(),true,new THREE.Vector3());
        if(nearest.length()<m.radius+.6){m.active=false;m.root.visible=false;this.hit(m.radius>.4?30:15,position);}
        if(m.age>4){m.active=false;m.root.visible=false;}
        if(this.phase==='dead')break;
      }
      if(this.timer<=0&&this.phase==='active'){this.phase='complete';this.pool.forEach(m=>{m.active=false;m.root.visible=false;});this.shieldMesh.visible=false;}
    }
    this.previousRocket=position.clone();
  }
  warningTarget(){return this.pool.find(m=>m.active&&m.age<1.2)?.target||null;}
  dispose(){this.group.removeFromParent();const gs=new Set(),ms=new Set();this.group.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.group.clear();}
}
