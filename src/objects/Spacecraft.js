import * as THREE from 'three';

function makeLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '900 74px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0, 145, 255, 0.95)';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = '#071522';
  ctx.lineWidth = 13;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 0;
  const gradient = ctx.createLinearGradient(0, 18, 0, canvas.height - 18);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.5, '#d3f4ff');
  gradient.addColorStop(1, '#51baf2');
  ctx.fillStyle = gradient;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function box(parent, material, size, position, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function capsule(parent, material, radius, length, position, rotation = [Math.PI / 2, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 12), material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function makeLimb(parent, material, start, end, radius) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.06, direction.length(), 10), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

function buildWing(material, mirror = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0.34, 0.25);
  shape.lineTo(1.95, 0.78);
  shape.lineTo(2.5, 1.72);
  shape.lineTo(0.56, 2.22);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  mesh.scale.x = mirror;
  mesh.position.set(0, -0.1, 0.55);
  return mesh;
}

/**
 * Procedural PJMC SPACE EXPLORER vehicle. The model is deliberately self-contained
 * (no remote model downloads) so the app still loads when offline or deployed to Pages.
 * Local -Z is the direction of travel.
 */
export class Spacecraft {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'PJMC SPACE EXPLORER';
    this.group.visible = false;

    const hull = new THREE.MeshStandardMaterial({ color: 0xdce7ef, metalness: 0.72, roughness: 0.27 });
    const pale = new THREE.MeshStandardMaterial({ color: 0xf2f7fb, metalness: 0.52, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x172838, metalness: 0.7, roughness: 0.34 });
    const accent = new THREE.MeshStandardMaterial({ color: 0x1b8bd2, metalness: 0.58, roughness: 0.27, emissive: 0x06385c, emissiveIntensity: 0.55 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x2c8fba, metalness: 0.2, roughness: 0.12, transmission: 0.26, transparent: true, opacity: 0.62, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
    const suit = new THREE.MeshStandardMaterial({ color: 0xf5f7f8, metalness: 0.08, roughness: 0.72 });
    const suitJoint = new THREE.MeshStandardMaterial({ color: 0x8396a3, metalness: 0.18, roughness: 0.58 });
    const visor = new THREE.MeshPhysicalMaterial({ color: 0x071a32, metalness: 0.75, roughness: 0.12, clearcoat: 1, side: THREE.DoubleSide });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x123e51, toneMapped: false });
    const screenGlow = new THREE.MeshBasicMaterial({ color: 0x54d5ff, toneMapped: false });

    this.exterior = new THREE.Group();
    this.exterior.name = 'Spacecraft exterior';
    this.group.add(this.exterior);

    // Main fuselage and pointed nose; nose points along local -Z.
    capsule(this.exterior, hull, 0.48, 2.65, [0, 0, 0.15]);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.47, 1.45, 16, 1), pale);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0, -2.03);
    this.exterior.add(nose);
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), accent);
    noseTip.position.set(0, 0, -2.73);
    this.exterior.add(noseTip);

    const wingMaterial = pale.clone();
    wingMaterial.side = THREE.DoubleSide;
    const leftWing = buildWing(wingMaterial, 1);
    const rightWing = buildWing(wingMaterial, -1);
    this.exterior.add(leftWing, rightWing);
    box(this.exterior, accent, [0.07, 0.045, 1.52], [0.7, -0.075, 1.36], [0, 0.05, -0.18]);
    box(this.exterior, accent, [0.07, 0.045, 1.52], [-0.7, -0.075, 1.36], [0, -0.05, 0.18]);

    // Vertical tail fins.
    box(this.exterior, pale, [0.13, 0.82, 1.13], [0.38, 0.47, 1.34], [0.18, 0, -0.12]);
    box(this.exterior, pale, [0.13, 0.82, 1.13], [-0.38, 0.47, 1.34], [-0.18, 0, 0.12]);

    // Blue engine bells and animated glowing exhausts.
    this.flames = [];
    this.engineLights = [];
    for (const x of [-0.27, 0, 0.27]) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.29, 0.62, 12, 1, true), dark);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x, -0.02, 2.15);
      this.exterior.add(nozzle);
      const flameMaterial = new THREE.MeshBasicMaterial({ color: 0x51cfff, transparent: true, opacity: 0.78, blending: THREE.AdditiveBlending, depthWrite: false });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.12, 12), flameMaterial);
      flame.rotation.x = Math.PI / 2;
      flame.position.set(x, -0.02, 2.82);
      this.exterior.add(flame);
      this.flames.push(flame);
      const light = new THREE.PointLight(0x39aaff, 1.15, 8, 2);
      light.position.set(x, 0, 2.8);
      this.exterior.add(light);
      this.engineLights.push(light);
    }

    // Cockpit canopy.
    this.canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), glass);
    this.canopy.scale.set(0.49, 0.43, 0.83);
    this.canopy.position.set(0, 0.38, -1.12);
    this.exterior.add(this.canopy);
    const canopyRim = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.055, 8, 24), accent);
    canopyRim.scale.set(1, 0.86, 1);
    canopyRim.position.set(0, 0.38, -1.25);
    canopyRim.rotation.x = Math.PI / 2;
    this.exterior.add(canopyRim);

    // PJMC title decals on both sides of the fuselage.
    const labelTexture = makeLabelTexture('PJMC SPACE EXPLORER');
    const labelMaterial = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const labelL = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.39), labelMaterial);
    labelL.position.set(0.43, 0.04, 0.34);
    labelL.rotation.y = Math.PI / 2;
    this.exterior.add(labelL);
    const labelR = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.39), labelMaterial.clone());
    labelR.position.set(-0.43, 0.04, 0.34);
    labelR.rotation.y = -Math.PI / 2;
    this.exterior.add(labelR);
    const topBadge = new THREE.Mesh(new THREE.PlaneGeometry(2.05, 0.3), labelMaterial.clone());
    topBadge.position.set(0, 0.48, 0.45);
    topBadge.rotation.x = -Math.PI / 2;
    this.exterior.add(topBadge);

    // Astronaut sitting behind the dashboard. The procedural suit stays crisp and light-weight.
    this.pilot = new THREE.Group();
    this.pilot.name = 'Seated astronaut';
    this.pilot.position.y = 0.18;
    this.exterior.add(this.pilot);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.98, 0.24), dark);
    seat.position.set(0, -0.06, -0.05);
    this.pilot.add(seat);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.23, 0.42, 4, 10), suit);
    torso.position.set(0, -0.03, -0.42);
    torso.rotation.x = -0.12;
    this.pilot.add(torso);
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.2), suitJoint);
    pack.position.set(0, 0.04, -0.05);
    this.pilot.add(pack);
    capsule(this.pilot, suit, 0.25, 0.08, [0, 0.34, -0.76], [0, 0, 0]);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), suit);
    helmet.position.set(0, 0.39, -0.78);
    this.pilot.add(helmet);
    const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 12, 0, Math.PI * 2, 0.22, 1.8), visor);
    visorMesh.position.set(0, 0.42, -1.015);
    visorMesh.scale.set(1.0, 0.86, 0.5);
    this.pilot.add(visorMesh);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 8, 18), suitJoint);
    collar.position.set(0, 0.21, -0.76);
    collar.rotation.x = Math.PI / 2;
    this.pilot.add(collar);
    // Bent legs and boots.
    makeLimb(this.pilot, suit, [-0.13, -0.23, -0.45], [-0.18, -0.43, -0.84], 0.12);
    makeLimb(this.pilot, suit, [0.13, -0.23, -0.45], [0.18, -0.43, -0.84], 0.12);
    box(this.pilot, dark, [0.22, 0.13, 0.32], [-0.18, -0.48, -0.98]);
    box(this.pilot, dark, [0.22, 0.13, 0.32], [0.18, -0.48, -0.98]);
    // Arms angled towards the controls.
    makeLimb(this.pilot, suit, [-0.22, 0.13, -0.48], [-0.36, -0.02, -0.77], 0.09);
    makeLimb(this.pilot, suit, [-0.36, -0.02, -0.77], [-0.22, -0.12, -0.99], 0.085);
    makeLimb(this.pilot, suit, [0.22, 0.13, -0.48], [0.36, -0.02, -0.77], 0.09);
    makeLimb(this.pilot, suit, [0.36, -0.02, -0.77], [0.22, -0.12, -0.99], 0.085);
    for (const [x, z] of [[-0.22, -0.99], [0.22, -0.99]]) {
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), suit);
      glove.position.set(x, -0.12, z);
      this.pilot.add(glove);
    }
    // Chest patch as a small blue insignia.
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.025), accent);
    patch.position.set(0.12, 0.05, -0.64);
    this.pilot.add(patch);

    // Cockpit-only interior pieces: remain visible while the outer shell is hidden in first-person.
    this.cockpitInterior = new THREE.Group();
    this.cockpitInterior.name = 'Cockpit first-person interior';
    this.group.add(this.cockpitInterior);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x102636, metalness: 0.76, roughness: 0.32 });
    box(this.cockpitInterior, frameMat, [0.09, 1.14, 0.12], [-1.23, 0.73, -2.0]);
    box(this.cockpitInterior, frameMat, [0.09, 1.14, 0.12], [1.23, 0.73, -2.0]);
    box(this.cockpitInterior, frameMat, [2.5, 0.09, 0.12], [0, 1.28, -2.0]);
    box(this.cockpitInterior, frameMat, [2.5, 0.1, 0.12], [0, 0.17, -2.0]);
    box(this.cockpitInterior, frameMat, [0.055, 0.85, 0.1], [0, 0.76, -2.0]);
    box(this.cockpitInterior, dark, [2.35, 0.28, 0.8], [0, -0.12, -1.56], [0.12, 0, 0]);
    box(this.cockpitInterior, accent, [2.1, 0.035, 0.08], [0, 0.02, -1.94]);
    for (const x of [-0.74, 0, 0.74]) {
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.24), screenMat);
      screen.position.set(x, 0.035, -1.985);
      screen.rotation.y = Math.PI;
      this.cockpitInterior.add(screen);
      for (let i = 0; i < 3; i++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.3 - i * 0.035, 0.012), screenGlow);
        line.position.set(x, 0.105 - i * 0.055, -1.99);
        line.rotation.y = Math.PI;
        this.cockpitInterior.add(line);
      }
    }
    for (let i = 0; i < 9; i++) {
      const btn = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.04), i % 3 === 0 ? accent : pale);
      btn.position.set(-0.86 + i * 0.215, -0.025, -1.95);
      this.cockpitInterior.add(btn);
    }

    this.cockpitInterior.visible = false;
    this.mode = 'external';
    this.phase = 0;
  }

  setCockpitMode(enabled) {
    this.mode = enabled ? 'cockpit' : 'external';
    this.exterior.visible = !enabled;
    this.cockpitInterior.visible = enabled;
  }

  update(dt, elapsedSeconds = 0) {
    this.phase += dt;
    const pulse = 0.8 + 0.2 * Math.sin(elapsedSeconds * 8.5);
    for (let i = 0; i < this.flames.length; i++) {
      this.flames[i].scale.set(0.78 + 0.22 * pulse, 0.72 + 0.48 * pulse, 0.72 + 0.38 * pulse);
      this.flames[i].material.opacity = 0.54 + 0.34 * pulse;
      this.engineLights[i].intensity = 0.55 + 1.15 * pulse;
    }
  }
}
