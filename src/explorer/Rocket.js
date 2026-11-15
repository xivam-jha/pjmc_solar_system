/**
 * PJMC concept spacecraft: pearl ceramic hull, brushed-gold trim, graphite
 * engine nacelles, smoked-blue canopy and restrained cyan twin exhausts.
 * Procedural geometry keeps the existing +Z flight and camera contracts.
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* GLSL Shaders for Animated Thruster Flame Plumes                    */
/* ------------------------------------------------------------------ */

const FLAME_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FLAME_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uPower;
  uniform float uThrottle;
  uniform float uBoost;
  uniform vec3 uTint;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float power = max(uPower, uThrottle);
    float boost = uBoost;
    float totalPwr = clamp(power + boost * 1.5, 0.0, 2.5);

    // 1. ABSOLUTE ZERO CUTOFF: Zero throttle = 100% invisible engine exhaust
    if (totalPwr <= 0.001) {
      discard;
    }

    float y = vUv.y; // 0.0 at nozzle base, 1.0 at flame tip

    // Dynamic length threshold: scales smoothly with throttle and boost
    float effectiveMaxLen = clamp(0.22 + power * 0.58 + boost * 0.38, 0.05, 1.0);
    if (y > effectiveMaxLen) {
      discard;
    }

    // High-frequency plasma turbulence
    float speed = 36.0 + boost * 28.0;
    float wave1 = sin(vUv.x * 24.0 + uTime * speed) * 0.08;
    float wave2 = cos(vUv.x * 48.0 - uTime * (speed * 1.3)) * 0.05;
    float turbulence = (wave1 + wave2) * (1.0 - y * 0.45);

    // Mach diamond shock nodes pulsing down the supersonic jet stream
    float shockPhase = y * 28.0 - uTime * (speed * 1.25);
    float shockDiamond = pow(clamp(sin(shockPhase) * 0.5 + 0.5, 0.0, 1.0), 3.5) * (1.0 - y);

    // Smooth taper towards the exhaust tip
    float tipFade = smoothstep(effectiveMaxLen, effectiveMaxLen * 0.52, y);

    // Combined intensity (ZERO floor when power is 0)
    float intensity = (1.0 - (y / effectiveMaxLen) + turbulence) * tipFade * (power * 1.15 + boost * 1.75);
    intensity += shockDiamond * (0.45 * power + 0.95 * boost);

    if (intensity <= 0.01) {
      discard;
    }

    // Color gradient:
    // 1. Bright white-hot cyan inner plasma core
    // 2. Electric blue middle flame
    // 3. Deep sapphire royal blue outer exhaust boundary
    vec3 whiteCore    = vec3(0.96, 0.99, 1.0);
    vec3 cyanPlasma   = vec3(0.25, 0.92, 1.0);
    vec3 electricBlue = vec3(0.0, 0.58, 1.0);
    vec3 deepSapphire = vec3(0.01, 0.12, 0.85);

    float normY = y / effectiveMaxLen;
    vec3 col = mix(whiteCore, cyanPlasma, smoothstep(0.0, 0.22, normY));
    col = mix(col, electricBlue, smoothstep(0.22, 0.62, normY));
    col = mix(col, deepSapphire, smoothstep(0.62, 1.0, normY));

    // Accentuate core with shock diamonds
    col = mix(col, whiteCore, shockDiamond * (0.35 + boost * 0.45));

    float alpha = clamp(intensity, 0.0, 1.0) * (0.85 + boost * 0.15);
    if (alpha < 0.015) {
      discard;
    }

    gl_FragColor = vec4(mix(col, uTint, 0.45) * (1.3 + power * 0.75 + boost * 1.8), alpha);
  }
`;

// One small shared transparent decal instead of multiple billboard textures.
function createCleanBrandTexture() {
  if (typeof document === 'undefined') return null;
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  ctx.clearRect(0,0,1024,256);ctx.fillStyle='#202631';ctx.font='900 205px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('PJMC',512,135);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function createCleanBrandGeometry(profile,side) {
  const positions=[],uvs=[],indices=[];const cols=24,rows=6;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows,z=-1.2+u*2.7,angle=(v-.5)*.55;
    let r=1;
    for(let k=1;k<profile.length;k++)if(z<=profile[k][0]){const [a,ra]=profile[k-1],[b,rb]=profile[k];r=ra+(rb-ra)*(z-a)/(b-a);break;}
    positions.push(side*(r+.012)*Math.cos(angle),(r*.78+.012)*Math.sin(angle),z);
    uvs.push(side===1?1-u:u,v);
    if(i<cols&&j<rows){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export class Rocket {
  constructor() {
    this.root = new THREE.Group();
    this.group = this.root; // alias for scene addition
    this.model = new THREE.Group();
    // Balanced aerospace scale (length 1.4 units) so planets appear colossal and realistic!
    this.model.scale.setScalar(0.28);
    this.root.add(this.model);

    // Physics & State
    this.velocity = new THREE.Vector3();
    this.speed = 0;
    this.maxSpeed = 180;
    this.boostMultiplier = 2.4;
    this.acceleration = 70;
    this.braking = 55;
    this.turnRate = 1.8;
    this.rollRate = 2.4;
    this.banking = 0;
    this.throttle = 0;
    this.isBoosting = false;
    this.isBraking = false;

    this.boostEnergy = 100;
    this.maxBoostEnergy = 100;
    this.boostConsumption = 32;
    this.boostRecharge = 18;

    this.#buildMesh();
  }

  setPaint(color) {
    this.paintMaterial.color.set(color);
    const tint = color === '#ecf2f8' ? '#00d4ff' : color;
    this.engineLight.color.set(tint);
    this.flameMaterial.uniforms.uTint.value.set(tint);
  }

  #buildMesh() {
    const pearl = new THREE.MeshPhysicalMaterial({color:0xecf2f8,metalness:.28,roughness:.3,clearcoat:.55,clearcoatRoughness:.22});
    const gold = new THREE.MeshStandardMaterial({color:0xd7ae63,metalness:.72,roughness:.3});
    const graphite = new THREE.MeshStandardMaterial({color:0x252c36,metalness:.48,roughness:.38});
    const glass = new THREE.MeshPhysicalMaterial({color:0x326986,metalness:.15,roughness:.12,clearcoat:1,transparent:true,opacity:.72,depthWrite:false});
    const cyan = new THREE.MeshBasicMaterial({color:0x53dce8,toneMapped:false});
    this.paintMaterial = pearl;
    const add = (name,geometry,material,x=0,y=0,z=0) => {
      const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.set(x,y,z);this.model.add(mesh);return mesh;
    };
    // Smooth pearl hull, with a short graphite nose rather than a long cone.
    const profile=[[-2.65,.62],[-2.3,.85],[-1.5,.98],[-.4,1],[.8,.94],[1.7,.79],[2.3,.61],[2.8,.39],[3.15,.12],[3.22,0]];
    const hullGeo=new THREE.LatheGeometry(profile.map(([z,r])=>new THREE.Vector2(r,z)),40);
    hullGeo.rotateX(Math.PI/2);hullGeo.scale(1,.78,1);
    add('Pearl ceramic fuselage',hullGeo,pearl);
    const noseGeo=new THREE.LatheGeometry([[2.65,.46],[2.95,.29],[3.2,.08],[3.26,0]].map(([z,r])=>new THREE.Vector2(r,z)),32);
    noseGeo.rotateX(Math.PI/2);noseGeo.scale(1,.79,1);add('Graphite nose cap',noseGeo,graphite);
    const band=add('Gold nose collar',new THREE.TorusGeometry(.46,.055,8,40),gold,0,0,2.66);band.scale.y=.79;
    // Cockpit rim and a curved smoked-glass dome with visible seat backs.
    const rimGeo=new THREE.SphereGeometry(1,28,14,0,Math.PI*2,0,Math.PI/2);rimGeo.scale(.65,.17,1.16);
    add('Cockpit graphite frame',rimGeo,graphite,0,.59,1.04);
    for(const x of [-.22,.22]) {
      const seat=add('Cockpit seat',new THREE.BoxGeometry(.27,.43,.24),graphite,x,.88,.83);seat.rotation.x=-.14;
    }
    const canopyGeo=new THREE.SphereGeometry(1,32,16,0,Math.PI*2,0,Math.PI/2);canopyGeo.scale(.62,.64,1.11);
    add('Smoked blue glass canopy',canopyGeo,glass,0,.67,1.04);
    const spine=add('Graphite dorsal spine',new THREE.SphereGeometry(1,20,12),graphite,0,.67,-.84);spine.scale.set(.34,.22,1.05);
    // Mirrored swept wings. Geometry stays in the same +Z forward coordinates.
    const panel=(name,points,material,depth=.10)=>{
      const shape=new THREE.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();
      const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.035,bevelThickness:.025});geo.rotateX(Math.PI/2);
      return add(name,geo,material,0,-.10,0);
    };
    for(const side of [-1,1]) {
      const points=[[.72,.42],[3.12,-1.13],[3.32,-1.74],[2.95,-2.04],[.76,-1.77]].map(([x,z])=>[side*x,z]);
      panel('Swept pearl wing '+side,points,pearl,.13);
      panel('Gold wing edge '+side,[[2.88,-1.03],[3.13,-1.18],[3.28,-1.72],[2.96,-1.98],[2.85,-1.85],[3.06,-1.64]].map(([x,z])=>[side*x,z]),gold,.14);
      panel('Graphite wing root '+side,[[.72,.17],[1.35,-.28],[1.62,-1.9],[.76,-1.77]].map(([x,z])=>[side*x,z]),graphite,.15);
      const lamp=add('Cyan wingtip marker '+side,new THREE.BoxGeometry(.38,.045,.10),cyan,side*3.0,-.05,-1.75);lamp.rotation.y=side*-.35;
      // Slender gold side stripe below the branding.
      const stripePoints=[];
      for(let i=0;i<=10;i++) {
        const z=-1.7+i*.37,y=-.39+i*.015;
        let r=1;for(let k=1;k<profile.length;k++)if(z<=profile[k][0]){const [a,ra]=profile[k-1],[b,rb]=profile[k];r=ra+(rb-ra)*(z-a)/(b-a);break;}
        stripePoints.push(new THREE.Vector3(side*(Math.sqrt(Math.max(.01,r*r-(y/.78)**2))+.012),y,z));
      }
      add('Gold hull accent '+side,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripePoints),20,.026,5,false),gold);
    }
    // One swept vertical tail with a gold cap, as in the approved concept.
    const tailShape=new THREE.Shape();tailShape.moveTo(-2.4,.55);tailShape.lineTo(-2.55,1.95);tailShape.lineTo(-1.85,1.9);tailShape.lineTo(-.65,.65);tailShape.closePath();
    const tailGeo=new THREE.ExtrudeGeometry(tailShape,{depth:.13,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1});
    tailGeo.rotateY(-Math.PI/2);add('Swept vertical stabilizer',tailGeo,pearl,.065,0,0);
    const insetShape=new THREE.Shape();insetShape.moveTo(-2.28,.76);insetShape.lineTo(-2.41,1.79);insetShape.lineTo(-1.93,1.74);insetShape.lineTo(-.94,.76);insetShape.closePath();
    const insetGeo=new THREE.ShapeGeometry(insetShape);insetGeo.rotateY(-Math.PI/2);
    const insetMat=graphite.clone();insetMat.side=THREE.DoubleSide;
    add('Graphite tail inset right',insetGeo,insetMat,.10,0,0);add('Graphite tail inset left',insetGeo,insetMat,-.10,0,0);
    const tailCap=add('Gold stabilizer cap',new THREE.BoxGeometry(.17,.09,.72),gold,0,1.94,-2.19);tailCap.rotation.x=.06;
    // Separate engine nacelles and concentric nozzles; no white glow plates.
    for(const side of [-1,1]) {
      const x=side*.69;
      const podGeo=new THREE.CylinderGeometry(.48,.57,1.63,28);podGeo.rotateX(Math.PI/2);
      add('Graphite engine nacelle '+side,podGeo,graphite,x,-.22,-2.32);
      add('Brushed gold exhaust rim '+side,new THREE.TorusGeometry(.50,.085,10,32),gold,x,-.22,-3.13);
      add('Dark exhaust well '+side,new THREE.CircleGeometry(.46,28),graphite,x,-.22,-3.14).rotation.y=Math.PI;
      add('Cyan exhaust ring '+side,new THREE.TorusGeometry(.35,.035,8,28),cyan,x,-.22,-3.16);
      add('Cyan exhaust core '+side,new THREE.CircleGeometry(.25,24),cyan,x,-.22,-3.17).rotation.y=Math.PI;
      for(let i=0;i<3;i++) add('Engine vent '+side+' '+i,new THREE.BoxGeometry(.40,.025,.055),gold,x,.27,-2.1-i*.18);
    }
    // Large clean PJMC lettering conforms to both hull sides.
    const texture = createCleanBrandTexture();
    if(texture) {
      const decalMat=new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.05,roughness:.48,metalness:.1,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
      for(const side of [-1,1]) add('PJMC side marking '+side,createCleanBrandGeometry(profile,side),decalMat);
    }
    this.flameMaterial = new THREE.ShaderMaterial({
      uniforms:{uTint:{value:new THREE.Color(0x40dce8)},uTime:{value:0},uPower:{value:0},uThrottle:{value:0},uBoost:{value:0}},
      vertexShader:FLAME_VERTEX,fragmentShader:FLAME_FRAGMENT,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,
    });
    const flameGeo=new THREE.ConeGeometry(.34,2.4,16,1,true);flameGeo.rotateX(-Math.PI/2);flameGeo.translate(0,0,-1.2);
    this.rightFlame=add('Right cyan exhaust',flameGeo,this.flameMaterial,.69,-.22,-3.19);
    this.leftFlame=add('Left cyan exhaust',flameGeo,this.flameMaterial,-.69,-.22,-3.19);
    this.rightFlame.visible=this.leftFlame.visible=false;
    this.engineLight=new THREE.PointLight(0x40dce8,0,5);this.engineLight.position.set(0,-.22,-3.3);this.engineLight.visible=false;this.model.add(this.engineLight);
    this.cockpitMount=new THREE.Group();this.cockpitMount.position.set(0,.29,.48);this.root.add(this.cockpitMount);
    this.chaseTarget=new THREE.Group();this.chaseTarget.position.set(0,.65,-2.5);this.root.add(this.chaseTarget);
  }

  /* ------------------------------------------------------------------ */
  /* Spacecraft Orientation & Flight Physics Helpers                    */
  /* ------------------------------------------------------------------ */

  /** Apply pure local quaternion rotation (yaw, pitch, roll) without Euler angle resets */
  applyLocalRotation(pitchDelta, yawDelta, rollDelta = 0) {
    if (yawDelta) this.root.rotateY(yawDelta);
    if (pitchDelta) this.root.rotateX(pitchDelta);
    if (rollDelta) this.root.rotateZ(rollDelta);
  }

  /** Visual banking: smoothly tilts only the visual mesh child along Z without altering flight orientation */
  setVisualBank(bankAngle) {
    this.banking = bankAngle;
    this.model.rotation.z = bankAngle;
  }

  /** Get normalized spacecraft world forward vector (+Z nose direction) */
  getForwardVector(out = new THREE.Vector3()) {
    return out.set(0, 0, 1).applyQuaternion(this.root.quaternion);
  }

  /** Get normalized spacecraft world up vector (+Y dorsal direction) */
  getUpVector(out = new THREE.Vector3()) {
    return out.set(0, 1, 0).applyQuaternion(this.root.quaternion);
  }

  /** Get normalized spacecraft world right vector (+X starboard direction) */
  getRightVector(out = new THREE.Vector3()) {
    return out.set(1, 0, 0).applyQuaternion(this.root.quaternion);
  }

  /* ------------------------------------------------------------------ */
  /* Animation, Engine Flames & Shader Updates                          */
  /* ------------------------------------------------------------------ */

  update(dt, powerOrInput = 0.0, maybeBoost = 0.0, isBoostingFlag = false) {
    let power = 0.0;
    let boostPower = 0.0;
    let boosting = false;

    if (typeof powerOrInput === 'number') {
      power = Math.max(0.0, Math.min(1.0, powerOrInput));
      if (typeof maybeBoost === 'number') {
        boostPower = Math.max(0.0, Math.min(1.0, maybeBoost));
        boosting = isBoostingFlag || boostPower > 0.05;
      } else if (typeof maybeBoost === 'boolean') {
        boosting = maybeBoost;
        boostPower = boosting ? 1.0 : 0.0;
      }
    } else if (powerOrInput && typeof powerOrInput === 'object') {
      boosting = !!powerOrInput.boost;
      boostPower = boosting ? 1.0 : 0.0;
      if (typeof powerOrInput.thrust === 'number') {
        power = Math.max(0.0, powerOrInput.thrust);
      } else if (typeof powerOrInput.power === 'number') {
        power = Math.max(0.0, powerOrInput.power);
      } else {
        power = boosting ? 1.0 : (powerOrInput.forward ? 0.75 : 0.0);
      }
    }

    this.enginePower = power;
    this.boostPower = boostPower;
    this.throttle = power;
    this.isBoosting = boosting;

    const totalActive = (power > 0.001 || boostPower > 0.001);

    // Engine flame plumes shader animation
    if (this.flameMaterial && this.flameMaterial.uniforms) {
      this.flameMaterial.uniforms.uTime.value += dt;
      this.flameMaterial.uniforms.uPower.value = power;
      this.flameMaterial.uniforms.uThrottle.value = power;
      this.flameMaterial.uniforms.uBoost.value = boostPower;
    }

    if (this.rightFlame && this.leftFlame) {
      this.rightFlame.visible = totalActive;
      this.leftFlame.visible = totalActive;

      if (totalActive) {
        const flameScaleZ = 0.35 + power * 1.1 + boostPower * 1.7;
        const flameScaleXY = 0.75 + power * 0.25 + boostPower * 0.45;
        this.rightFlame.scale.set(flameScaleXY, flameScaleXY, flameScaleZ);
        this.leftFlame.scale.copy(this.rightFlame.scale);
      } else {
        this.rightFlame.scale.set(0.001, 0.001, 0.001);
        this.leftFlame.scale.copy(this.rightFlame.scale);
      }
    }

    if (this.engineLight) {
      this.engineLight.visible = totalActive;
      this.engineLight.intensity = totalActive ? (power * .85 + boostPower * 1.2) : 0.0;
    }
  }

  teleport(pos, lookAtPos = null) {
    this.root.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.throttle = 0;
    this.enginePower = 0;
    this.boostPower = 0;
    this.isBoosting = false;
    this.banking = 0;
    this.model.rotation.z = 0;
    if (this.rightFlame) this.rightFlame.visible = false;
    if (this.leftFlame) this.leftFlame.visible = false;
    if (this.engineLight) {
      this.engineLight.visible = false;
      this.engineLight.intensity = 0.0;
    }
    if (lookAtPos) {
      this.root.lookAt(lookAtPos);
    }
  }

  setVisible(visible) {
    this.root.visible = visible;
  }

  setPosition(x, y, z) {
    this.root.position.set(x, y, z);
  }

  get position() {
    return this.root.position;
  }

  get rotation() {
    return this.root.rotation;
  }

  get quaternion() {
    return this.root.quaternion;
  }

  rotateX(angle) {
    this.root.rotateX(angle);
  }

  rotateY(angle) {
    this.root.rotateY(angle);
  }

  rotateZ(angle) {
    this.root.rotateZ(angle);
  }

  getWorldPosition(out) {
    return this.root.getWorldPosition(out);
  }

  getCockpitPosition(out) {
    return this.cockpitMount.getWorldPosition(out);
  }

  getCockpitWorldPosition(out) {
    return this.cockpitMount.getWorldPosition(out);
  }

  getChaseCameraPosition(out) {
    return this.chaseTarget.getWorldPosition(out);
  }

  dispose() {
    const geometries=new Set(),materials=new Set(),textures=new Set();
    this.root.traverse(object=>{
      if(object.geometry)geometries.add(object.geometry);
      for(const material of Array.isArray(object.material)?object.material:[object.material])if(material){materials.add(material);if(material.map)textures.add(material.map);}
    });
    geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
    this.engineLight?.dispose();this.root.clear();
  }
}
