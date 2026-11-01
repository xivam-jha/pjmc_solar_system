/**
 * The Sun: an emissive procedural & real-texture surface with animated
 * turbulence, limb darkening, a dynamic 3D solar prominence flame shell
 * with leaping tongues of fire, eruptive magnetic coronal loops, and
 * layered additive corona sprites.
 */

import * as THREE from 'three';
import { getSphereGeometry } from './Planet.js';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uMap;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float t = uTime;
    vec2 uv1 = vUv + vec2(t * 0.0025, t * 0.0008);
    vec2 uv2 = vUv * 1.4 - vec2(t * 0.0016, -t * 0.0007);
    vec4 s1 = texture2D(uMap, uv1);
    vec4 s2 = texture2D(uMap, uv2);
    vec3 photoColor = mix(s1.rgb, s2.rgb, 0.35);

    // Dynamic solar flares and granulation highlights
    float lum = dot(photoColor, vec3(0.299, 0.587, 0.114));
    vec3 fiery = mix(vec3(1.0, 0.38, 0.02), vec3(1.0, 0.95, 0.72), smoothstep(0.18, 0.88, lum));
    vec3 col = mix(photoColor * 1.0, fiery, 0.35);

    // Flare spots above threshold for UnrealBloom pass (softened by 50%)
    col += vec3(1.0, 0.85, 0.5) * pow(max(lum - 0.7, 0.0) * 1.8, 2.0);

    // Limb darkening for spherical depth
    float ndv = clamp(dot(normalize(vNormalV), normalize(vViewV)), 0.0, 1.0);
    col *= mix(0.45, 1.1, pow(ndv, 0.55));
    gl_FragColor = vec4(col * 0.68, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Prominence Flame Shell Shaders (3D Animated Leaping Fire)           */
/* ------------------------------------------------------------------ */

const PROMINENCE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vPosition;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    vPosition = position;
    vNormalV = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const PROMINENCE_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vPosition;
  #include <common>
  #include <logdepthbuf_pars_fragment>

  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    #include <logdepthbuf_fragment>
    float rim = 1.0 - abs(dot(normalize(vNormalV), normalize(vViewV)));
    vec3 pos = vPosition * 2.5;

    // Dancing flame noise licking outwards
    float n1 = snoise(pos + vec3(0.0, uTime * 0.45, uTime * 0.2));
    float n2 = snoise(pos * 2.2 - vec3(uTime * 0.35, uTime * 0.5, 0.0));
    float n3 = snoise(pos * 4.6 + vec3(uTime * 0.6, -uTime * 0.4, uTime * 0.5));
    float flameNoise = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;

    // Fiery tongues bursting along the solar limb
    float flame = pow(rim, 1.7) * max(flameNoise + 0.38, 0.0) * 2.5;
    float flareBurst = pow(max(n1 * n2, 0.0), 1.5) * pow(rim, 1.1) * 4.8;
    flame += flareBurst;

    if (flame < 0.035) discard;

    // Hot plasma gradient: incandescent yellow-white core -> golden flame -> deep ruby crimson tips
    vec3 col = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.72, 0.1), smoothstep(0.15, 0.75, flame));
    col = mix(col, vec3(1.0, 0.98, 0.8), smoothstep(0.75, 1.8, flame));

    gl_FragColor = vec4(col * 1.0, clamp(flame * 0.55, 0.0, 1.0));
  }
`;

/**
 * Procedural authentic arched solar prominence texture (magnetic fire loop).
 */
function createProminenceLoopTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, size, size);

  // Soft atmospheric flare gradient
  const grad = ctx.createRadialGradient(size * 0.5, size * 0.6, 20, size * 0.5, size * 0.6, size * 0.45);
  grad.addColorStop(0, 'rgba(255, 235, 150, 0.95)');
  grad.addColorStop(0.25, 'rgba(255, 130, 25, 0.7)');
  grad.addColorStop(0.55, 'rgba(255, 45, 10, 0.3)');
  grad.addColorStop(0.85, 'rgba(160, 15, 0, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Main magnetic prominence arch
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 170, 45, 0.85)';
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.62, size * 0.3, Math.PI * 0.96, Math.PI * 2.04);
  ctx.stroke();

  // Secondary bright inner filament
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(255, 240, 130, 0.98)';
  ctx.beginPath();
  ctx.arc(size * 0.51, size * 0.6, size * 0.36, Math.PI * 1.04, Math.PI * 1.96);
  ctx.stroke();

  // Eruptive plasma filaments licking outward
  for (let i = 0; i < 38; i++) {
    const a = Math.PI * (1.0 + Math.random() * 1.0);
    const r1 = size * (0.24 + Math.random() * 0.1);
    const r2 = r1 + size * (0.08 + Math.random() * 0.14);
    ctx.lineWidth = 2 + Math.random() * 4;
    ctx.strokeStyle = Math.random() > 0.45 ? 'rgba(255, 95, 20, 0.75)' : 'rgba(255, 220, 80, 0.92)';
    ctx.beginPath();
    ctx.moveTo(size * 0.5 + Math.cos(a) * r1, size * 0.6 + Math.sin(a) * r1);
    ctx.lineTo(size * 0.5 + Math.cos(a + (Math.random() - 0.5) * 0.32) * r2, size * 0.6 + Math.sin(a) * r2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Sun {
  constructor(data, textures) {
    this.data = data;
    this.isMoon = false;
    this.parent = null;
    this.moons = [];
    this._radius = 1;

    this.bodyGroup = new THREE.Group(); // stays at origin
    this.spinGroup = new THREE.Group();
    this.bodyGroup.add(this.spinGroup);

    // 1. Core Sun Surface
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMap: { value: textures.sun },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
    this.surfaceMesh = new THREE.Mesh(getSphereGeometry(64), this.material);
    this.surfaceMesh.userData.bodyId = data.id;
    this.spinGroup.add(this.surfaceMesh);

    // 2. Dynamic 3D Prominence Flame Shell (Aag ki lapte)
    this.prominenceMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: PROMINENCE_VERTEX,
      fragmentShader: PROMINENCE_FRAGMENT,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.prominenceMesh = new THREE.Mesh(getSphereGeometry(64), this.prominenceMaterial);
    this.prominenceMesh.scale.setScalar(1.18);
    this.spinGroup.add(this.prominenceMesh);

    // 3. Eruptive Magnetic Coronal Prominence Arches (Loops around the solar perimeter)
    const loopTex = createProminenceLoopTexture();
    this.prominenceLoops = [];
    const loopCount = 8;
    for (let i = 0; i < loopCount; i++) {
      const angle = (i / loopCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const mat = new THREE.SpriteMaterial({
        map: loopTex,
        color: 0xffaa44,
        transparent: true,
        opacity: 0.38 + Math.random() * 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      const dist = 1.08 + Math.random() * 0.08;
      sprite.position.set(Math.cos(angle) * dist, (Math.random() - 0.5) * 0.3, Math.sin(angle) * dist);
      const baseScale = 1.5 + Math.random() * 0.6;
      sprite.scale.set(baseScale, baseScale, 1);
      sprite.userData = {
        baseScale,
        speed: 0.8 + Math.random() * 0.7,
        phase: Math.random() * Math.PI * 2,
        initialAngle: angle,
      };
      this.spinGroup.add(sprite);
      this.prominenceLoops.push(sprite);
    }

    // 4. Layered corona sprites (Atmospheric glow softened by 50%)
    const coronaLayers = [
      { scale: 2.3, color: 0xffdfaa, opacity: 0.30 },
      { scale: 3.3, color: 0xff9933, opacity: 0.11 },
      { scale: 5.2, color: 0xff5511, opacity: 0.045 },
    ];
    for (const layer of coronaLayers) {
      const mat = new THREE.SpriteMaterial({
        map: textures.corona,
        color: layer.color,
        transparent: true,
        opacity: layer.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(layer.scale, layer.scale, 1);
      this.spinGroup.add(sprite);
    }
  }

  get radiusWorld() {
    return this._radius;
  }

  getWorldPosition(target) {
    return this.bodyGroup.getWorldPosition(target);
  }

  /** dt is real seconds (flames and surface turbulence keep moving continuously). */
  update(daysSinceJ2000, scale, dt) {
    const r = scale.bodyRadius(this);
    this._radius = r;
    this.spinGroup.scale.setScalar(r);
    this.spinGroup.rotation.y = (2 * Math.PI * daysSinceJ2000 * 24) / this.data.rotationPeriodHours;

    // Advance dynamic time for surface and flame shaders
    this.material.uniforms.uTime.value += dt;
    this.prominenceMaterial.uniforms.uTime.value += dt;

    // Animate leaping prominence flame loops (breathing scale & pulsating flare)
    const t = this.prominenceMaterial.uniforms.uTime.value;
    for (const loop of this.prominenceLoops) {
      const s = loop.userData.baseScale * (1.0 + 0.16 * Math.sin(t * loop.userData.speed + loop.userData.phase));
      loop.scale.set(s, s, 1);
      loop.material.opacity = 0.32 + 0.15 * Math.sin(t * loop.userData.speed * 1.3 + loop.userData.phase);
    }
  }
}
