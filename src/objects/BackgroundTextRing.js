<<<<<<< HEAD
/**
 * A single continuous 360-degree PJMC SUKHPUR word-ring surrounding the
 * planetary system. The text is painted once and mapped to one seamless
 * annular ribbon facing the default camera; no external texture download
 * or font-loading request is required.
 */
import * as THREE from 'three';

const SEGMENTS = 720;
const RING_HALF_WIDTH = 0.12; // radial band width relative to the ring radius

function makeTextTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available for the PJMC ring.');

  // One character per equal arc segment makes the phrase travel around the
  // full circumference naturally instead of stretching the entire word.
  const phrase = 'PJMC SUKHPUR';
  const characters = [...phrase];
  const cellCount = characters.length + 1; // one extra seam gap after the final R
  const cellWidth = canvas.width / cellCount;
  const fontSize = 310;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${fontSize}px Arial, Helvetica, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = '#e6faff';
  ctx.strokeStyle = 'rgba(80, 213, 255, 0.98)';
  ctx.lineWidth = 4;

  characters.forEach((character, index) => {
    if (character === ' ') return; // a deliberate one-segment word gap
    const x = (index + 1.5) * cellWidth;
    ctx.save();
    ctx.shadowColor = 'rgba(75, 207, 255, 0.98)';
    ctx.shadowBlur = 34;
    ctx.fillText(character, x, canvas.height / 2);
    ctx.shadowBlur = 0;
    ctx.strokeText(character, x, canvas.height / 2);
    ctx.restore();
  });

  // Transparent gaps between letters preserve the background starfield.
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createRibbonGeometry() {
  const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const normals = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const uvs = new Float32Array((SEGMENTS + 1) * 2 * 2);
  const indices = [];
  const inner = 1 - RING_HALF_WIDTH;
  const outer = 1 + RING_HALF_WIDTH;

  for (let i = 0; i <= SEGMENTS; i++) {
    const u = i / SEGMENTS;
    const angle = u * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (let side = 0; side < 2; side++) {
      const index = i * 2 + side;
      const radius = side === 0 ? outer : inner;
      positions[index * 3] = cos * radius;
      positions[index * 3 + 1] = sin * radius;
      positions[index * 3 + 2] = 0;
      normals[index * 3] = 0;
      normals[index * 3 + 1] = 0;
      normals[index * 3 + 2] = 1;
      uvs[index * 2] = u;
      uvs[index * 2 + 1] = side === 0 ? 1 : 0;
    }
    if (i < SEGMENTS) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, c, d, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createGuideLine(radius, color, opacity) {
  const points = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0.006));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
  return new THREE.LineLoop(geometry, material);
}

export class BackgroundTextRing {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'PJMC SUKHPUR 360-degree brand ring';

    const texture = makeTextTexture();
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.02,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.ribbon = new THREE.Mesh(createRibbonGeometry(), material);
    this.ribbon.name = 'PJMC SUKHPUR text ribbon';
    this.ribbon.renderOrder = 2;
    this.group.add(this.ribbon);

    this.group.add(createGuideLine(1 + RING_HALF_WIDTH * 1.12, 0x54d7ff, 0.38));
    this.group.add(createGuideLine(1 - RING_HALF_WIDTH * 1.12, 0x54d7ff, 0.22));
    this.setRadius(1);
  }

  setRadius(radius) {
    // Uniform scaling keeps the letters and their supporting ring in sync
    // while switching between visualization and true-scale modes.
    const safeRadius = Math.max(0.001, Number(radius) || 1);
    this.group.scale.setScalar(safeRadius);
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
=======
import * as THREE from 'three';

/**
 * A single, 360-degree inscription surrounding the solar system.
 * The letters stand upright around the ecliptic, so they remain readable
 * instead of lying flat on the ground. The group is scaled by the same
 * visualization/true-scale radius as the planetary system.
 */
export class BackgroundTextRing {
  constructor(text = 'PJMC Sukhpur') {
    this.group = new THREE.Group();
    this.text = text;

    // Normalized dimensions. main.js scales the whole group with the system.
    const ringRadius = 1.26;
    const glyphHeight = 0.32;
    const fontSize = 176;
    const characters = Array.from(text);
    const total = characters.length;

    characters.forEach((character, index) => {
      // Keep spaces in the angular count so the phrase is written exactly
      // once across the complete circle rather than repeated around it.
      if (character.trim() === '') return;

      const { texture, aspect } = this.createGlyphTexture(character, fontSize);
      const width = glyphHeight * aspect;
      const theta = Math.PI / 2 - (index / total) * Math.PI * 2;
      const radial = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
      // The phrase advances in the decreasing-angle direction.
      const tangent = new THREE.Vector3(Math.sin(theta), 0, -Math.cos(theta));
      const center = radial.clone().multiplyScalar(ringRadius);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
        side: THREE.FrontSide,
        depthWrite: false,
        toneMapped: false,
      });

      const outside = this.createGlyphPlane(center, tangent, width, glyphHeight, false);
      const outsideMesh = new THREE.Mesh(outside, material);
      outsideMesh.renderOrder = 2;
      this.group.add(outsideMesh);

      // Add an inward-facing counterpart with mirrored UVs. This keeps the
      // inscription legible when the camera is rotated to the other side.
      const inside = this.createGlyphPlane(center, tangent, width, glyphHeight, true);
      const insideMesh = new THREE.Mesh(inside, material);
      insideMesh.renderOrder = 2;
      this.group.add(insideMesh);
    });
  }

  createGlyphTexture(character, fontSize) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable for the background text ring.');

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `900 ${fontSize}px Arial, Helvetica, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineJoin = 'round';
    context.shadowColor = '#38bdf8';
    context.shadowBlur = 28;
    context.strokeStyle = 'rgba(110, 220, 255, 0.92)';
    context.lineWidth = 5;
    context.strokeText(character, canvas.width / 2, canvas.height / 2 + 2);

    const gradient = context.createLinearGradient(0, 48, 0, 208);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.48, '#b7f3ff');
    gradient.addColorStop(1, '#53b7ff');
    context.shadowBlur = 18;
    context.fillStyle = gradient;
    context.fillText(character, canvas.width / 2, canvas.height / 2 + 2);

    const metrics = context.measureText(character);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return {
      texture,
      aspect: THREE.MathUtils.clamp(metrics.width / fontSize, 0.28, 1.15),
    };
  }

  createGlyphPlane(center, tangent, width, height, inward) {
    const up = new THREE.Vector3(0, 1, 0);
    const halfTangent = tangent.clone().multiplyScalar(width / 2);
    const halfUp = up.clone().multiplyScalar(height / 2);
    const bottomLeft = center.clone().sub(halfTangent).sub(halfUp);
    const bottomRight = center.clone().add(halfTangent).sub(halfUp);
    const topRight = center.clone().add(halfTangent).add(halfUp);
    const topLeft = center.clone().sub(halfTangent).add(halfUp);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      ...bottomLeft.toArray(),
      ...bottomRight.toArray(),
      ...topRight.toArray(),
      ...topLeft.toArray(),
    ], 3));

    // Reverse U for the inward face so the letters are not mirrored from
    // inside the circle. V remains bottom-to-top for both faces.
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(
      inward
        ? [1, 0, 0, 0, 0, 1, 1, 1]
        : [0, 0, 1, 0, 1, 1, 0, 1],
      2,
    ));
    geometry.setIndex(inward ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    return geometry;
>>>>>>> f5f151341652102d66d771f5d749347440f4c8d5
  }
}
