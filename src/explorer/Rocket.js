/**
 * PJMC Space Explorer — Rocket (PJMC-01).
 *
 * Professional Aerospace 3D Spacecraft featuring permanent 3D surface branding:
 * - Primary Brand: PJMC (Large bold, electric cyan & metallic white)
 * - Subtitle: PAWAN JHA MATHEMATICS CLASSES
 * - Spacecraft Identity: PJMC-01
 *
 * Brand Placements:
 * 1. Fuselage Left & Right sides (Curved surface decal plates, unmirrored)
 * 2. Upper Fuselage Spine (Directly visible in 3rd-person chase camera)
 * 3. Vertical Stabilizer Tail Fin (Both left & right faces)
 * 4. Delta Wings (Top surface of both wings)
 * 5. Nosecone Section (Circular mission insignia crest)
 *
 * Features procedural materials (metallic pearlescent silver, electric cyan trim),
 * animated GLSL thruster flame plumes, dynamic cockpit lighting, and camera mounts.
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
  uniform float uThrottle;
  uniform float uBoost;
  varying vec2 vUv;
  varying vec3 vNormal;

  void main() {
    float y = vUv.y; // 0 at base, 1 at tip
    float wave = sin(vUv.x * 24.0 + uTime * 40.0) * 0.12;
    float intensity = (1.0 - y + wave * (1.0 - y)) * (0.65 + uThrottle * 0.85 + uBoost * 1.35);

    // Color gradient: Core bright white/cyan -> electric blue -> deep sapphire outer edge
    vec3 coreColor = vec3(0.92, 0.98, 1.0);
    vec3 blueColor = vec3(0.0, 0.72, 1.0);
    vec3 deepBlue  = vec3(0.0, 0.28, 0.85);

    vec3 col = mix(coreColor, blueColor, smoothstep(0.08, 0.55, y));
    col = mix(col, deepBlue, smoothstep(0.55, 1.0, y));

    float alpha = clamp(intensity, 0.0, 1.0) * (1.0 - y * 0.65);
    if (alpha < 0.02) discard;

    gl_FragColor = vec4(col * (1.6 + uBoost * 1.6), alpha);
  }
`;

/* ------------------------------------------------------------------ */
/* Canvas Textures for Permanent 3D Surface Branding                   */
/* ------------------------------------------------------------------ */

/**
 * 1. Fuselage Left/Right Side Banner Decal (2048 x 512 HD)
 * Large bold PJMC, subtitle PAWAN JHA MATHEMATICS CLASSES, identity PJMC-01.
 */
function createFuselageSideTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Carbon-composite panel plate background
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, 'rgba(4, 14, 28, 0.92)');
  grad.addColorStop(0.5, 'rgba(8, 22, 44, 0.94)');
  grad.addColorStop(1, 'rgba(4, 14, 28, 0.92)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(16, 16, canvas.width - 32, canvas.height - 32, 24);
  ctx.fill();

  // Electric cyan glowing border & tech accents
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.95)';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Dual supersonic racing stripes
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(24, 70, canvas.width - 48, 8);
  ctx.fillRect(24, canvas.height - 78, canvas.width - 48, 8);

  ctx.fillStyle = '#0077b6';
  ctx.fillRect(24, 82, canvas.width - 48, 4);
  ctx.fillRect(24, canvas.height - 86, canvas.width - 48, 4);

  // Corner tech bracket ticks
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  const corners = [
    [32, 32], [canvas.width - 32, 32],
    [32, canvas.height - 32], [canvas.width - 32, canvas.height - 32]
  ];
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.fill();
  }

  // Left Section: Mission Patch Emblem
  ctx.save();
  ctx.translate(220, 256);

  // Outer orbital ring
  ctx.beginPath();
  ctx.arc(0, 0, 110, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Tilted orbital ellipse
  ctx.beginPath();
  ctx.ellipse(0, 0, 140, 50, Math.PI / 4, 0, Math.PI * 2);
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Center crest star
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 64px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('✦', 0, 0);

  ctx.font = '800 20px "Arial Black", sans-serif';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('PJMC', 0, 68);
  ctx.restore();

  // Center Section: Primary Brand "PJMC"
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // "PJMC" Big Bold Lettering
  ctx.font = '900 160px "Arial Black", "Montserrat", sans-serif';
  ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
  ctx.shadowBlur = 24;

  const textGrad = ctx.createLinearGradient(420, 160, 420, 320);
  textGrad.addColorStop(0, '#ffffff');
  textGrad.addColorStop(0.5, '#e0f8ff');
  textGrad.addColorStop(1, '#00e5ff');

  ctx.fillStyle = textGrad;
  ctx.fillText('PJMC', 420, 275);

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
  ctx.lineWidth = 4;
  ctx.strokeText('PJMC', 420, 275);

  // Spacecraft Identity Badge [ PJMC-01 ]
  ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(1020, 165, 340, 80, 12);
  ctx.fill();
  ctx.stroke();

  ctx.font = '900 52px "Arial Black", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText('PJMC-01', 1190, 226);

  // Subtitle: "PAWAN JHA MATHEMATICS CLASSES"
  ctx.textAlign = 'left';
  ctx.font = '900 42px "Arial Black", "Montserrat", sans-serif';
  ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAWAN JHA MATHEMATICS CLASSES', 425, 350);

  // Aerospace Tech Details Line
  ctx.shadowBlur = 0;
  ctx.font = '700 24px monospace';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('DEEP SPACE EXPLORER  •  ORBITAL CLASS  •  AEROSPACE DIVISION', 425, 400);

  // Right Side Speed Chevrons
  ctx.fillStyle = '#00f0ff';
  for (let i = 0; i < 4; i++) {
    const x = 1880 + i * 28;
    ctx.beginPath();
    ctx.moveTo(x, 210);
    ctx.lineTo(x + 18, 256);
    ctx.lineTo(x, 302);
    ctx.lineTo(x + 8, 302);
    ctx.lineTo(x + 26, 256);
    ctx.lineTo(x + 8, 210);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * 2. Upper Spine Top Decal (1024 x 512)
 * High-visibility branding for third-person chase camera.
 */
function createSpineDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Tech spine stripe
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, 'rgba(4, 18, 36, 0.95)');
  grad.addColorStop(1, 'rgba(2, 10, 22, 0.95)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(16, 20, canvas.width - 32, canvas.height - 40, 18);
  ctx.fill();

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Bold "PJMC - 01"
  ctx.font = '900 110px "Arial Black", "Montserrat", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PJMC - 01', canvas.width / 2, 170);

  // Subtitle "PAWAN JHA MATHEMATICS CLASSES"
  ctx.shadowBlur = 8;
  ctx.font = '900 36px "Arial Black", sans-serif';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('PAWAN JHA MATHEMATICS CLASSES', canvas.width / 2, 280);

  // Chevron directional arrows pointing toward nose
  ctx.shadowBlur = 0;
  ctx.font = '800 24px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText('▲ ▲ ▲  FORWARD FLIGHT SYSTEM  ▲ ▲ ▲', canvas.width / 2, 360);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  return tex;
}

/**
 * 3. Tail Fin & Wings Decal (512 x 256)
 */
function createFinDecalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(4, 18, 38, 0.9)';
  ctx.beginPath();
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 14);
  ctx.fill();

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Primary text
  ctx.font = '900 78px "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PJMC', canvas.width / 2, 90);

  // Subtitle
  ctx.shadowBlur = 0;
  ctx.font = '900 22px "Arial Black", sans-serif';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('PAWAN JHA MATHS', canvas.width / 2, 160);

  ctx.font = '700 18px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('PJMC-01', canvas.width / 2, 205);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  return tex;
}

/**
 * 4. Nose Mission Crest Emblem (512 x 512)
 */
function createNoseEmblemTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = 220;

  // Outer glowing circle
  ctx.fillStyle = 'rgba(4, 16, 32, 0.92)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Inner decorative ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 24, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Planetary orbit ring
  ctx.beginPath();
  ctx.ellipse(cx, cy, radius - 10, radius - 90, -Math.PI / 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center Bold PJMC
  ctx.font = '900 100px "Arial Black", "Montserrat", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 240, 255, 0.9)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PJMC', cx, cy - 25);

  ctx.shadowBlur = 0;
  ctx.font = '900 24px "Arial Black", sans-serif';
  ctx.fillStyle = '#00f0ff';
  ctx.fillText('PJMC - 01', cx, cy + 50);

  ctx.font = '800 18px "Arial Black", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAWAN JHA MATHS CLASSES', cx, cy + 95);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Custom Curved Surface Decal Geometry Generator                     */
/* ------------------------------------------------------------------ */

/**
 * Creates a precision curved geometry that conforms exactly to the
 * tapered fuselage cylinder without clipping or distortion.
 * - side === 'right' : mounted on starboard (+X)
 * - side === 'left'  : mounted on port (-X), unmirrored left-to-right reading
 * - side === 'top'   : mounted on spine (+Y)
 */
function createCurvedFuselageDecalGeo(side = 'right') {
  const zSegments = 24;
  const phiSegments = 10;
  const zMin = -1.6;
  const zMax = 1.7;
  const phiHalf = 0.38; // ~22 degrees arc

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let j = 0; j <= phiSegments; j++) {
    const v = j / phiSegments;
    const phi = -phiHalf + v * (2 * phiHalf);

    for (let i = 0; i <= zSegments; i++) {
      const u = i / zSegments;

      let z;
      if (side === 'right') {
        z = zMin + u * (zMax - zMin); // Z increases left to right
      } else if (side === 'left') {
        z = zMax - u * (zMax - zMin); // Z decreases left to right (unmirrored!)
      } else {
        z = zMin + u * (zMax - zMin);
      }

      // Conical fuselage radius at Z
      const r = 0.905 - 0.02 * (z / 2.5) + 0.012; // +0.012 offset outside metal

      let x, y;
      if (side === 'right') {
        x = r * Math.cos(phi);
        y = r * Math.sin(phi);
      } else if (side === 'left') {
        x = -r * Math.cos(phi);
        y = r * Math.sin(phi);
      } else {
        // top spine (+Y)
        x = r * Math.sin(phi);
        y = r * Math.cos(phi);
      }

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  for (let j = 0; j < phiSegments; j++) {
    for (let i = 0; i < zSegments; i++) {
      const a = j * (zSegments + 1) + i;
      const b = (j + 1) * (zSegments + 1) + i;
      const c = (j + 1) * (zSegments + 1) + (i + 1);
      const d = j * (zSegments + 1) + (i + 1);

      if (side === 'right') {
        indices.push(a, b, d);
        indices.push(b, c, d);
      } else if (side === 'left') {
        indices.push(a, d, b);
        indices.push(b, d, c);
      } else {
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ */
/* Rocket Class (PJMC-01)                                             */
/* ------------------------------------------------------------------ */

export class Rocket {
  constructor() {
    this.root = new THREE.Group();
    this.group = this.root; // alias for scene addition
    this.model = new THREE.Group();
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

  #buildMesh() {
    // 1. Premium Metallic Silver Body Material
    const silverBodyMat = new THREE.MeshStandardMaterial({
      color: 0xecf2f8,
      metalness: 0.88,
      roughness: 0.22,
    });

    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf5f8fc,
      metalness: 0.65,
      roughness: 0.26,
    });

    const electricBlueMat = new THREE.MeshStandardMaterial({
      color: 0x00d4ff,
      metalness: 0.82,
      roughness: 0.18,
      emissive: 0x004477,
      emissiveIntensity: 0.45,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x161a22,
      metalness: 0.92,
      roughness: 0.28,
    });

    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x061426,
      metalness: 0.98,
      roughness: 0.05,
      emissive: 0x002d55,
      emissiveIntensity: 0.45,
    });

    // 2. Fuselage Main Body (Length 5.0, Z-axis)
    const fuselageGeo = new THREE.CylinderGeometry(0.85, 0.95, 5.0, 36);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeo, silverBodyMat);
    fuselage.position.z = 0;
    this.model.add(fuselage);

    // Decorative titanium panel rings at structural seams
    const ringSeamGeo = new THREE.TorusGeometry(0.915, 0.02, 8, 36);
    ringSeamGeo.rotateX(Math.PI / 2);
    const ringSeamMat = new THREE.MeshStandardMaterial({ color: 0x00b4d8, metalness: 0.9, roughness: 0.2 });

    const ringPositions = [-1.8, -0.6, 1.0, 2.2];
    for (const z of ringPositions) {
      const ring = new THREE.Mesh(ringSeamGeo, ringSeamMat);
      ring.position.z = z;
      this.model.add(ring);
    }

    // 3. Nosecone Section
    const noseGeo = new THREE.ConeGeometry(0.85, 2.4, 36);
    noseGeo.rotateX(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeo, silverBodyMat);
    nose.position.z = 3.7;
    this.model.add(nose);

    // Electric blue nose tip
    const tipGeo = new THREE.ConeGeometry(0.35, 1.0, 36);
    tipGeo.rotateX(Math.PI / 2);
    const tip = new THREE.Mesh(tipGeo, electricBlueMat);
    tip.position.z = 4.4;
    this.model.add(tip);

    // 4. Cockpit Canopy
    const canopyGeo = new THREE.SphereGeometry(0.65, 28, 18);
    canopyGeo.scale(0.85, 0.62, 2.2);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 0.68, 1.4);
    this.model.add(canopy);

    // 5. Delta Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(3.4, -1.8);
    wingShape.lineTo(3.4, -2.6);
    wingShape.lineTo(0, -1.9);
    wingShape.closePath();

    const wingExtrude = { depth: 0.14, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 };
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, wingExtrude);
    wingGeo.center();

    // Right wing
    const rightWing = new THREE.Mesh(wingGeo, silverBodyMat);
    rightWing.rotation.x = Math.PI / 2;
    rightWing.position.set(2.1, -0.15, -0.8);
    this.model.add(rightWing);

    // Left wing
    const leftWing = rightWing.clone();
    leftWing.scale.x = -1;
    leftWing.position.set(-2.1, -0.15, -0.8);
    this.model.add(leftWing);

    // Wingtips with electric blue stabilizers
    const tipFinGeo = new THREE.BoxGeometry(0.12, 0.95, 1.4);
    const rightTipFin = new THREE.Mesh(tipFinGeo, electricBlueMat);
    rightTipFin.position.set(3.5, 0.25, -1.8);
    this.model.add(rightTipFin);

    const leftTipFin = rightTipFin.clone();
    leftTipFin.position.set(-3.5, 0.25, -1.8);
    this.model.add(leftTipFin);

    // 6. Vertical Stabilizer Tail Fin
    const vertFinShape = new THREE.Shape();
    vertFinShape.moveTo(0, 0);
    vertFinShape.lineTo(0, 1.9);
    vertFinShape.lineTo(-1.7, 1.9);
    vertFinShape.lineTo(-2.3, 0);
    vertFinShape.closePath();

    const vertFinGeo = new THREE.ExtrudeGeometry(vertFinShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 });
    vertFinGeo.rotateY(Math.PI / 2);
    const vertFin = new THREE.Mesh(vertFinGeo, electricBlueMat);
    vertFin.position.set(0, 0.92, -0.6);
    this.model.add(vertFin);

    // 7. Dual Engine Thruster Nozzles
    const nozzleGeo = new THREE.CylinderGeometry(0.42, 0.54, 1.1, 28);
    nozzleGeo.rotateX(Math.PI / 2);

    const rightNozzle = new THREE.Mesh(nozzleGeo, darkMetalMat);
    rightNozzle.position.set(0.44, -0.05, -2.85);
    this.model.add(rightNozzle);

    const leftNozzle = new THREE.Mesh(nozzleGeo, darkMetalMat);
    leftNozzle.position.set(-0.44, -0.05, -2.85);
    this.model.add(leftNozzle);

    // Engine blue glowing exhaust rims
    const rimGeo = new THREE.TorusGeometry(0.5, 0.06, 12, 28);
    const rightRim = new THREE.Mesh(rimGeo, electricBlueMat);
    rightRim.position.copy(rightNozzle.position);
    rightRim.position.z -= 0.55;
    this.model.add(rightRim);

    const leftRim = rightRim.clone();
    leftRim.position.copy(leftNozzle.position);
    leftRim.position.z -= 0.55;
    this.model.add(leftRim);

    // 8. Engine Flame Shader Plumes
    this.flameMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uThrottle: { value: 0 },
        uBoost: { value: 0 },
      },
      vertexShader: FLAME_VERTEX,
      fragmentShader: FLAME_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const flameGeo = new THREE.ConeGeometry(0.46, 3.4, 18, 1, true);
    flameGeo.rotateX(-Math.PI / 2);
    flameGeo.translate(0, 0, -1.7); // flame shoots backwards (-Z)

    this.rightFlame = new THREE.Mesh(flameGeo, this.flameMaterial);
    this.rightFlame.position.set(0.44, -0.05, -3.4);
    this.model.add(this.rightFlame);

    this.leftFlame = new THREE.Mesh(flameGeo, this.flameMaterial);
    this.leftFlame.position.set(-0.44, -0.05, -3.4);
    this.model.add(this.leftFlame);

    // Dynamic Engine Blue Glow Light
    this.engineLight = new THREE.PointLight(0x00d4ff, 2.2, 22);
    this.engineLight.position.set(0, 0, -4.0);
    this.model.add(this.engineLight);

    // Cockpit camera mount point
    this.cockpitMount = new THREE.Group();
    this.cockpitMount.position.set(0, 0.88, 1.2);
    this.model.add(this.cockpitMount);

    // Third-person camera mount point
    this.chaseTarget = new THREE.Group();
    this.chaseTarget.position.set(0, 2.2, -8.2);
    this.model.add(this.chaseTarget);

    /* ------------------------------------------------------------------ */
    /* 3D SURFACE BRANDING DECALS (PERMANENT, NON-OVERLAY)                 */
    /* ------------------------------------------------------------------ */

    // Shared decal material settings: polygonOffset eliminates all z-fighting
    const decalMatConfig = {
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -4.0,
      roughness: 0.25,
      metalness: 0.35,
    };

    // A. Starboard (Right) Fuselage Decal Plate
    const sideDecalTex = createFuselageSideTexture();
    const rightDecalMat = new THREE.MeshStandardMaterial({
      ...decalMatConfig,
      map: sideDecalTex,
    });
    const rightDecalGeo = createCurvedFuselageDecalGeo('right');
    const rightDecal = new THREE.Mesh(rightDecalGeo, rightDecalMat);
    this.model.add(rightDecal);

    // B. Port (Left) Fuselage Decal Plate (Unmirrored reading!)
    const leftDecalMat = new THREE.MeshStandardMaterial({
      ...decalMatConfig,
      map: sideDecalTex,
    });
    const leftDecalGeo = createCurvedFuselageDecalGeo('left');
    const leftDecal = new THREE.Mesh(leftDecalGeo, leftDecalMat);
    this.model.add(leftDecal);

    // C. Upper Fuselage Spine Decal (Prominent in 3rd-person chase camera)
    const spineTex = createSpineDecalTexture();
    const spineMat = new THREE.MeshStandardMaterial({
      ...decalMatConfig,
      map: spineTex,
    });
    const spineGeo = createCurvedFuselageDecalGeo('top');
    const spineDecal = new THREE.Mesh(spineGeo, spineMat);
    this.model.add(spineDecal);

    // D. Vertical Tail Fin Decals (Both Left and Right faces)
    const finTex = createFinDecalTexture();
    const finDecalMat = new THREE.MeshStandardMaterial({
      ...decalMatConfig,
      map: finTex,
    });
    const finDecalGeo = new THREE.PlaneGeometry(1.6, 0.8);

    // Right face of tail fin
    const rightFinDecal = new THREE.Mesh(finDecalGeo, finDecalMat);
    rightFinDecal.rotation.y = Math.PI / 2;
    rightFinDecal.position.set(0.068, 1.45, -1.35);
    this.model.add(rightFinDecal);

    // Left face of tail fin (unmirrored)
    const leftFinDecal = new THREE.Mesh(finDecalGeo, finDecalMat);
    leftFinDecal.rotation.y = -Math.PI / 2;
    leftFinDecal.position.set(-0.068, 1.45, -1.35);
    this.model.add(leftFinDecal);

    // E. Delta Wing Tops Decals
    const wingDecalGeo = new THREE.PlaneGeometry(1.5, 0.7);

    const rightWingDecal = new THREE.Mesh(wingDecalGeo, finDecalMat);
    rightWingDecal.rotation.x = -Math.PI / 2;
    rightWingDecal.rotation.z = -0.45;
    rightWingDecal.position.set(2.0, -0.06, -1.0);
    this.model.add(rightWingDecal);

    const leftWingDecal = new THREE.Mesh(wingDecalGeo, finDecalMat);
    leftWingDecal.rotation.x = -Math.PI / 2;
    leftWingDecal.rotation.z = 0.45;
    leftWingDecal.position.set(-2.0, -0.06, -1.0);
    this.model.add(leftWingDecal);

    // F. Nosecone Mission Insignia Crest
    const noseEmblemTex = createNoseEmblemTexture();
    const noseMat = new THREE.MeshStandardMaterial({
      ...decalMatConfig,
      map: noseEmblemTex,
    });
    const noseEmblemGeo = new THREE.CircleGeometry(0.38, 32);
    const noseEmblem = new THREE.Mesh(noseEmblemGeo, noseMat);
    noseEmblem.rotation.x = -Math.PI / 2 + 0.35; // tilted along nosecone slope
    noseEmblem.position.set(0, 0.56, 3.1);
    this.model.add(noseEmblem);
  }

  /* ------------------------------------------------------------------ */
  /* Animation, Physics & State Updates                                 */
  /* ------------------------------------------------------------------ */

  update(dt, inputOrThrottle, maybeBoost = false) {
    if (typeof inputOrThrottle === 'number') {
      this.throttle = inputOrThrottle;
      this.isBoosting = !!maybeBoost;
    } else {
      const input = inputOrThrottle || { forward: true, pitch: 0, yaw: 0, boost: false, brake: false };
      let targetThrottle = 0.45;
      if (input.forward) targetThrottle = 1.0;
      if (input.brake) targetThrottle = 0.05;

      if (input.boost && this.boostEnergy > 5) {
        this.isBoosting = true;
        this.boostEnergy = Math.max(0, this.boostEnergy - this.boostConsumption * dt);
      } else {
        this.isBoosting = false;
        this.boostEnergy = Math.min(this.maxBoostEnergy, this.boostEnergy + this.boostRecharge * dt);
      }

      this.throttle = THREE.MathUtils.lerp(this.throttle, targetThrottle, dt * 4.0);

      const currentMax = this.maxSpeed * (this.isBoosting ? this.boostMultiplier : 1.0);
      const targetSpeed = currentMax * this.throttle;
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, dt * (input.brake ? 4.5 : 2.5));

      const pitchAmount = (input.pitch || 0) * this.turnRate * dt;
      this.root.rotateX(pitchAmount);

      const yawAmount = -(input.yaw || 0) * this.turnRate * dt;
      this.root.rotateY(yawAmount);

      const targetBank = -(input.yaw || 0) * 0.55;
      this.banking = THREE.MathUtils.lerp(this.banking, targetBank, dt * 5.0);
      this.model.rotation.z = this.banking;

      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion);
      this.velocity.copy(forward).multiplyScalar(this.speed);
      this.root.position.addScaledVector(this.velocity, dt);
    }

    // Engine flame plumes shader animation
    if (this.flameMaterial && this.flameMaterial.uniforms) {
      this.flameMaterial.uniforms.uTime.value += dt;
      this.flameMaterial.uniforms.uThrottle.value = this.throttle;
      this.flameMaterial.uniforms.uBoost.value = this.isBoosting ? 1.0 : 0.0;
    }

    if (this.rightFlame && this.leftFlame) {
      const flameScaleZ = 0.5 + this.throttle * 1.0 + (this.isBoosting ? 1.8 : 0.0);
      this.rightFlame.scale.set(1.0 + (this.isBoosting ? 0.35 : 0), 1.0 + (this.isBoosting ? 0.35 : 0), flameScaleZ);
      this.leftFlame.scale.copy(this.rightFlame.scale);
    }

    if (this.engineLight) {
      this.engineLight.intensity = 1.2 + this.throttle * 2.2 + (this.isBoosting ? 3.8 : 0);
    }
  }

  teleport(pos, lookAtPos = null) {
    this.root.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.speed = 0;
    this.throttle = 0;
    this.banking = 0;
    this.model.rotation.z = 0;
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
    this.root.clear();
  }
}
