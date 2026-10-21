/**
 * Large in-world PJMC brand arch.
 * Letters are separate textured planes placed on a real 3D semicircle. This is
 * intentionally NOT a screen-space HUD: it grows/crops naturally when the user
 * zooms in and can be fully seen from the automatic overview camera.
 */
import * as THREE from 'three';

function makeTextTexture(text, { fontSize = 300, wide = false } = {}) {
  const canvas = document.createElement('canvas');
  const measureCanvas = document.createElement('canvas');
  const measureContext = measureCanvas.getContext('2d');
  measureContext.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  const measure = measureContext.measureText(text).width;
  canvas.width = wide ? 2304 : Math.ceil(measure + fontSize * 0.42);
  canvas.height = wide ? 512 : Math.ceil(fontSize * 1.42);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const x = canvas.width / 2;
  const y = canvas.height / 2;
  ctx.shadowColor = 'rgba(37, 174, 255, 0.95)';
  ctx.shadowBlur = wide ? 26 : 32;
  ctx.strokeStyle = 'rgba(3, 24, 51, 0.98)';
  ctx.lineWidth = wide ? 20 : 24;
  ctx.strokeText(text, x, y);
  const gradient = ctx.createLinearGradient(0, y - fontSize * 0.55, 0, y + fontSize * 0.55);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.34, '#baf0ff');
  gradient.addColorStop(0.72, '#53caff');
  gradient.addColorStop(1, '#1685e3');
  ctx.shadowBlur = wide ? 22 : 28;
  ctx.fillStyle = gradient;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(201, 245, 255, 0.9)';
  ctx.lineWidth = wide ? 4 : 5;
  ctx.strokeText(text, x, y);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return { texture, aspect: canvas.width / canvas.height };
}

function makeGlyph(text, height, z, rotationZ = 0, wide = false) {
  const { texture, aspect } = makeTextTexture(text, { fontSize: wide ? 280 : 300, wide });
  const width = wide ? height * Math.max(aspect, 2.5) : height * Math.max(aspect, 0.32);
  const geometry = new THREE.PlaneGeometry(width, height);
  const frontMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  const backMaterial = frontMaterial.clone();
  backMaterial.side = THREE.FrontSide;
  const front = new THREE.Mesh(geometry, frontMaterial);
  front.position.z = z;
  front.rotation.z = rotationZ;
  const back = new THREE.Mesh(geometry, backMaterial);
  back.position.z = z - height * 0.012;
  back.rotation.set(0, Math.PI, rotationZ);
  const group = new THREE.Group();
  group.add(front, back);
  return group;
}

export class BrandingArch {
  constructor(baseSystemRadius) {
    this.baseSystemRadius = baseSystemRadius;
    this.group = new THREE.Group();
    this.group.name = 'PJMC in-world branding arch';

    // The feet sit just outside Neptune's visualization orbit. The arch reaches
    // high above the system and lives slightly behind the orbital plane.
    const r = baseSystemRadius * 2.05;
    const baseline = baseSystemRadius * 1.13;
    const z = -baseSystemRadius * 0.28;
    const word = 'PJMC';
    const glyphHeight = baseSystemRadius * 0.56;
    for (let i = 0; i < word.length; i++) {
      const theta = Math.PI - ((i + 0.5) / word.length) * Math.PI;
      const glyph = makeGlyph(word[i], glyphHeight, z, theta - Math.PI / 2);
      glyph.position.set(Math.cos(theta) * r, baseline + Math.sin(theta) * r, 0);
      this.group.add(glyph);
    }

    // A smaller straight title sits within the open area under the arch.
    const subtitle = makeGlyph('SOLAR SYSTEM', baseSystemRadius * 0.42, z + baseSystemRadius * 0.018, 0, true);
    subtitle.position.set(0, baseline + baseSystemRadius * 0.19, 0);
    this.group.add(subtitle);
  }

  setScale(scale) {
    this.group.scale.setScalar(scale);
  }
}
