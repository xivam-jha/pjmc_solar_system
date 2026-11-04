/**
 * Rings.js — Photorealistic Planetary Ring Systems
 * PJMC STUDENT — SOLAR SYSTEM EXPLORER
 * Pawan Jha Mathematics Classes
 *
 * Planetary ring systems with high-resolution radial alpha profiles,
 * Cassini Division, Encke Gap, sunlit scattering, and an analytic
 * shadow cylinder cast by the planet on the rings.
 */

import * as THREE from 'three';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uPlanetPos;
  uniform float uPlanetRadius;
  uniform float uOpacity;
  uniform vec3 uRingColor;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec4 tex = texture2D(uMap, vUv);
    
    // Support both pre-colored ring textures and alpha-only profiles
    vec3 color = tex.rgb;
    // If texture is grayscale or pure white alpha mask, apply authentic ring tone
    if (abs(color.r - color.g) < 0.05 && abs(color.g - color.b) < 0.05) {
      color = mix(color, uRingColor, 0.75);
    }
    
    float alpha = tex.a * uOpacity;
    if (alpha < 0.005) discard;

    // Solar illumination: Sun is at origin (0,0,0)
    vec3 toSun = normalize(-vWorldPos);
    // Rings are translucent particle clouds; light shines on both faces
    float sunScattering = 0.45 + 0.55 * abs(dot(toSun, vNormal));

    // Analytic Planet Shadow:
    // Sun is at the world origin, so the shadow cylinder projects
    // along the planet's position vector, directly behind the planet.
    vec3 sunToPlanet = normalize(uPlanetPos);
    vec3 rel = vWorldPos - uPlanetPos;
    float proj = dot(rel, sunToPlanet);
    float shadow = 1.0;
    
    // Check if fragment is behind the planet along the sun-planet axis
    if (proj > 0.0) {
      float axisDist = length(rel - sunToPlanet * proj);
      // Soft penumbra transition at shadow boundary
      shadow = mix(0.06, 1.0, smoothstep(uPlanetRadius * 0.98, uPlanetRadius * 1.03, axisDist));
    }

    vec3 finalRgb = color * sunScattering * shadow;
    gl_FragColor = vec4(finalRgb, alpha);
  }
`;

/**
 * @param {object} spec   { inner, outer, opacity, color } in planet radii
 * @param {THREE.Texture} texture baked radial ring profile or alpha strip
 * @returns {{ mesh: THREE.Mesh, material: THREE.ShaderMaterial }}
 */
export function createRings(spec, texture) {
  // 256 circular segments for ultra-smooth silhouette
  const geometry = new THREE.RingGeometry(spec.inner, spec.outer, 256, 2);

  // Remap UVs radially so u runs from the inner to the outer edge
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - spec.inner) / (spec.outer - spec.inner), 0.5);
  }
  geometry.rotateX(-Math.PI / 2); // align with planet's equatorial plane

  // Default warm ring particle color
  let ringColor = new THREE.Color(0xd2c29d);
  if (spec.color) ringColor.set(spec.color);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uPlanetPos: { value: new THREE.Vector3() },
      uPlanetRadius: { value: 1 },
      uOpacity: { value: spec.opacity ?? 1.0 },
      uRingColor: { value: ringColor },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, material };
}
