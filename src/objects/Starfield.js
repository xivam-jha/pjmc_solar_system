/**
 * Background starfield: thousands of additive points with per-star size,
 * brightness and colour temperature, a denser band of stars along an
 * inclined great circle for the Milky Way, plus a few large, very faint
 * haze sprites to suggest the galactic glow.
 */

import * as THREE from 'three';

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.35, d);
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

/** Star colour by temperature mix: warm red -> white -> blue-white. */
function starColor(t, brightness, out) {
  let r;
  let g;
  let b;
  if (t < 0.5) {
    const k = t * 2;
    r = 1.0;
    g = 0.72 + 0.28 * k;
    b = 0.6 + 0.4 * k;
  } else {
    const k = (t - 0.5) * 2;
    r = 1.0 - 0.22 * k;
    g = 1.0 - 0.12 * k;
    b = 1.0;
  }
  out[0] = r * brightness;
  out[1] = g * brightness;
  out[2] = b * brightness;
}

export function createStarfield(textures, { count = 9000, radius = 12000 } = {}) {
  const group = new THREE.Group();

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const col = [0, 0, 0];

  // The Milky Way band: a great circle tilted ~63 degrees (like the real
  // galactic plane vs the ecliptic).
  const bandQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(63), 0.4, 0));
  const v = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const inBand = i < count * 0.4;
    if (inBand) {
      // Concentrated near the band plane (y ~ 0 before tilting).
      const theta = Math.random() * Math.PI * 2;
      const spread = (Math.random() + Math.random() + Math.random()) / 3 - 0.5; // ~gaussian
      v.set(Math.cos(theta), spread * 0.35, Math.sin(theta)).normalize().applyQuaternion(bandQuat);
    } else {
      // Uniform on the sphere.
      const z = Math.random() * 2 - 1;
      const theta = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      v.set(s * Math.cos(theta), z, s * Math.sin(theta));
    }
    positions[i * 3] = v.x * radius;
    positions[i * 3 + 1] = v.y * radius;
    positions[i * 3 + 2] = v.z * radius;

    const brightness = 0.25 + Math.random() ** 2.2 * 0.75;
    starColor(Math.random(), brightness, col);
    colors[i * 3] = col[0];
    colors[i * 3 + 1] = col[1];
    colors[i * 3 + 2] = col[2];
    sizes[i] = (0.8 + Math.random() ** 3 * 2.4) * (inBand ? 0.85 : 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  group.add(points);

  // Faint galactic haze sprites along the band.
  for (let i = 0; i < 42; i++) {
    const theta = Math.random() * Math.PI * 2;
    const spread = (Math.random() - 0.5) * 0.12;
    v.set(Math.cos(theta), spread, Math.sin(theta)).normalize().applyQuaternion(bandQuat);
    const mat = new THREE.SpriteMaterial({
      map: textures.softGlow,
      color: new THREE.Color().setHSL(0.6 + Math.random() * 0.06, 0.3, 0.75),
      transparent: true,
      opacity: 0.02 + Math.random() * 0.025,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(v).multiplyScalar(radius * 0.85);
    const s = radius * (0.18 + Math.random() * 0.2);
    sprite.scale.set(s, s, 1);
    group.add(sprite);
  }

  return group;
}
