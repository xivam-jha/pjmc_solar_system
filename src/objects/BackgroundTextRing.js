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
  }
}
