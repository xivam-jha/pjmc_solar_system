/**
 * ConstellationText: High-definition, crystal-clear 3D celestial text for
 * "PJMC STUDENT" surrounded by authentic constellation chart lines,
 * glowing anchor star diamonds, and dynamic twinkling 3D stars.
 */

import * as THREE from 'three';

const STAR_VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute vec2 aTwinkle;
  varying vec3 vColor;
  varying float vTwinkle;
  uniform float uTime;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vColor = aColor;
    float tw = 0.72 + 0.28 * sin(uTime * aTwinkle.x + aTwinkle.y);
    vTwinkle = tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * tw * (480.0 / max(-mv.z, 1.0));
    #include <logdepthbuf_vertex>
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.15, d);
    if (a < 0.02) discard;
    float core = smoothstep(0.35, 0.0, d);
    vec3 c = mix(vColor, vec3(1.0), core * 0.8);
    gl_FragColor = vec4(c * 1.6, a * vTwinkle);
  }
`;

export function createConstellationText({ text = 'PJMC   STUDENT' } = {}) {
  const group = new THREE.Group();

  // 1. Ultra-HD Canvas for Razor-Sharp Typography (2048 x 512)
  const w = 2048;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, w, h);

  // Deep starlight glow
  ctx.shadowColor = 'rgba(0, 225, 255, 0.95)';
  ctx.shadowBlur = 45;

  // Ultra-bold, clean geometric space typography
  ctx.font = '900 148px "Arial Black", "Montserrat", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '18px';

  // Crisp glowing cyan outer stroke
  ctx.strokeStyle = 'rgba(95, 220, 255, 0.9)';
  ctx.lineWidth = 8;
  ctx.strokeText(text, w / 2, h / 2 - 12);

  // Pure white-to-cyan celestial core gradient
  const grad = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.75);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.45, '#f0fbff');
  grad.addColorStop(1, '#70d6ff');
  ctx.fillStyle = grad;
  ctx.fillText(text, w / 2, h / 2 - 12);

  // Reset shadow for razor-sharp constellation chart lines
  ctx.shadowBlur = 0;

  // Constellation chart frame lines & coordinates
  ctx.strokeStyle = 'rgba(95, 212, 255, 0.5)';
  ctx.lineWidth = 2.5;

  // Top & bottom constellation chart borders
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.14);
  ctx.lineTo(w * 0.94, h * 0.14);
  ctx.moveTo(w * 0.06, h * 0.86);
  ctx.lineTo(w * 0.94, h * 0.86);
  ctx.stroke();

  // Corner bracket accents
  const bLen = 30;
  ctx.lineWidth = 3;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(w * 0.06, h * 0.14 + bLen);
  ctx.lineTo(w * 0.06, h * 0.14);
  // Top-right
  ctx.moveTo(w * 0.94, h * 0.14 + bLen);
  ctx.lineTo(w * 0.94, h * 0.14);
  // Bottom-left
  ctx.moveTo(w * 0.06, h * 0.86 - bLen);
  ctx.lineTo(w * 0.06, h * 0.86);
  // Bottom-right
  ctx.moveTo(w * 0.94, h * 0.86 - bLen);
  ctx.lineTo(w * 0.94, h * 0.86);
  ctx.stroke();

  // Constellation Star Diamond Draw Helper
  function drawStarDiamond(cx, cy, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r * 0.28, cy - r * 0.28);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx + r * 0.28, cy + r * 0.28);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r * 0.28, cy + r * 0.28);
    ctx.lineTo(cx - r, cy);
    ctx.lineTo(cx - r * 0.28, cy - r * 0.28);
    ctx.closePath();
    ctx.fill();
  }

  // Anchor constellation stars on corners and center
  drawStarDiamond(w * 0.06, h * 0.14, 15, '#ffffff');
  drawStarDiamond(w * 0.94, h * 0.14, 15, '#ffffff');
  drawStarDiamond(w * 0.06, h * 0.86, 15, '#ffffff');
  drawStarDiamond(w * 0.94, h * 0.86, 15, '#ffffff');
  drawStarDiamond(w * 0.5, h * 0.14, 11, '#5fd4ff');
  drawStarDiamond(w * 0.5, h * 0.86, 11, '#5fd4ff');

  // Subtitle starlight annotation
  ctx.font = '700 24px "Cascadia Code", "Consolas", monospace';
  ctx.letterSpacing = '10px';
  ctx.fillStyle = 'rgba(160, 230, 255, 0.75)';
  ctx.fillText('✦ CELESTIAL CANOPY · SOLAR EXPLORER ✦', w / 2, h * 0.88 + 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;

  // Primary 3D Luminous Celestial Banner
  // Scaled 4x: 820 width x 205 height
  const planeGeo = new THREE.PlaneGeometry(820, 205);
  const planeMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const bannerMesh = new THREE.Mesh(planeGeo, planeMat);
  group.add(bannerMesh);

  // 2. Sparkling 3D Star Cluster Around the Title
  const starCount = 380;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);
  const twinkles = new Float32Array(starCount * 2);

  const palette = [
    [0.6, 0.9, 1.0],   // celestial cyan
    [1.0, 1.0, 1.0],   // starlight white
    [0.45, 0.75, 1.0], // azure blue
    [1.0, 0.92, 0.65], // golden accent star
  ];

  for (let i = 0; i < starCount; i++) {
    const px = (Math.random() - 0.5) * 800;
    const py = (Math.random() - 0.5) * 180;
    const pz = (Math.random() - 0.5) * 25;

    positions[i * 3] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;

    const isMajor = Math.random() < 0.16;
    const c = isMajor ? palette[3] : palette[Math.floor(Math.random() * 3)];
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];

    sizes[i] = isMajor ? 5.0 + Math.random() * 3.5 : 2.2 + Math.random() * 2.2;
    twinkles[i * 2] = 1.0 + Math.random() * 2.6;       // speed
    twinkles[i * 2 + 1] = Math.random() * Math.PI * 2; // phase
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  starGeo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 2));

  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const starPoints = new THREE.Points(starGeo, starMat);
  group.add(starPoints);

  // Position high in the sky dome, tilted directly towards the observer
  const basePosViz = new THREE.Vector3(0, 310, -170);
  const basePosTrue = new THREE.Vector3(0, 2800, -2000);
  group.position.copy(basePosViz);
  group.rotation.x = THREE.MathUtils.degToRad(32); // tilted towards the viewer
  group.rotation.y = 0;

  return {
    group,
    update(dt, mix = 0) {
      starMat.uniforms.uTime.value += dt;
      // Smoothly adapt position and scale between Visualization and True Scale
      group.position.lerpVectors(basePosViz, basePosTrue, mix);
      const s = 1.0 + mix * 7.5;
      group.scale.set(s, s, s);
    },
  };
}
