/**
 * Planetary ring systems with an analytic planet shadow.
 *
 * The ring is a RingGeometry whose UVs are remapped radially (u = 0 at the
 * inner edge, u = 1 at the outer edge) so a 1D baked ring profile can be
 * applied. Instead of shadow maps, the fragment shader checks whether each
 * ring point lies inside the planet's shadow cylinder cast by the Sun
 * (which sits at the world origin) — robust at any scene scale.
 */

import * as THREE from 'three';

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
    #include <logdepthbuf_vertex>
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uPlanetPos;
  uniform float uPlanetRadius;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    vec4 tex = texture2D(uMap, vUv);
    float alpha = tex.a * uOpacity;
    if (alpha < 0.004) discard;
    // Planet shadow: the Sun is at the origin, so the shadow cylinder runs
    // along the planet's position vector, behind the planet.
    vec3 sunToPlanet = normalize(uPlanetPos);
    vec3 rel = vWorldPos - uPlanetPos;
    float proj = dot(rel, sunToPlanet);
    float shadow = 1.0;
    if (proj > 0.0) {
      float axisDist = length(rel - sunToPlanet * proj);
      shadow = mix(0.12, 1.0, smoothstep(uPlanetRadius * 0.96, uPlanetRadius * 1.06, axisDist));
    }
    gl_FragColor = vec4(tex.rgb * shadow, alpha);
  }
`;

/**
 * @param {object} spec   { inner, outer, opacity } in planet radii
 * @param {THREE.Texture} texture baked radial ring profile
 * @returns {{ mesh: THREE.Mesh, material: THREE.ShaderMaterial }}
 */
export function createRings(spec, texture) {
  const geometry = new THREE.RingGeometry(spec.inner, spec.outer, 192, 2);
  // Remap UVs radially so u runs from the inner to the outer edge.
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getY(i));
    uv.setXY(i, (r - spec.inner) / (spec.outer - spec.inner), 0.5);
  }
  geometry.rotateX(-Math.PI / 2); // lie in the planet's equatorial plane

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uPlanetPos: { value: new THREE.Vector3() },
      uPlanetRadius: { value: 1 },
      uOpacity: { value: spec.opacity ?? 1 },
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
