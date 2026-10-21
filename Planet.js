/**
 * Reusable Planet class — also used for moons (recursively) and Pluto.
 *
 * Scene-graph layout per body:
 *
 *   root (Group, orbital-plane inclination)
 *   ├── orbitLine (unit circle, scaled to the current orbit radius)
 *   └── bodyGroup (Group, positioned on the orbit; never scaled)
 *       └── tiltGroup (Group, axial tilt)
 *           ├── spinGroup (Group, daily rotation; scale = display radius)
 *           │   ├── surface mesh (unit sphere)
 *           │   ├── cloud shell  (optional, drifts relative to surface)
 *           │   ├── atmosphere shell (optional fresnel glow)
 *           │   └── rings (optional; spin is invisible on a radial texture)
 *           └── moon roots (orbit in the parent's equatorial plane)
 *
 * Sizes and orbit radii are *not* baked into geometry: every frame they are
 * resolved through the scale API, which blends "visualization" and "true"
 * scale — this is what makes the animated scale toggle cheap.
 */

import * as THREE from 'three';
import { createRings } from './Rings.js';

const TWO_PI = Math.PI * 2;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/* Shared unit-sphere geometries, keyed by segment count. */
const sphereCache = new Map();
export function getSphereGeometry(segments) {
  if (!sphereCache.has(segments)) {
    sphereCache.set(segments, new THREE.SphereGeometry(1, segments, segments / 2));
  }
  return sphereCache.get(segments);
}

/* Shared unit-circle line geometry for orbit paths. */
let circleGeometry = null;
function getCircleGeometry() {
  if (!circleGeometry) {
    const pts = [];
    for (let i = 0; i < 256; i++) {
      const a = (i / 256) * TWO_PI;
      pts.push(new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)));
    }
    circleGeometry = new THREE.BufferGeometry().setFromPoints(pts);
  }
  return circleGeometry;
}

/* ------------------------------------------------------------------ */
/* Atmosphere (fresnel rim glow) shader                                */
/* ------------------------------------------------------------------ */

const ATMO_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const ATMO_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uIntensity;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    float fres = pow(1.0 - abs(dot(normalize(vNormalV), normalize(vViewV))), uPower);
    // Stronger glow on the day side (the Sun is at the world origin).
    vec3 sunDir = normalize(-vWorldPos);
    float day = 0.25 + 0.75 * smoothstep(-0.35, 0.35, dot(normalize(vWorldNormal), sunDir));
    gl_FragColor = vec4(uColor * fres * day * uIntensity, 1.0);
  }
`;

function createAtmosphere(spec) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(spec.color) },
      uPower: { value: spec.power },
      uIntensity: { value: spec.intensity },
    },
    vertexShader: ATMO_VERTEX,
    fragmentShader: ATMO_FRAGMENT,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(getSphereGeometry(48), material);
  mesh.scale.setScalar(1.07);
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Planet                                                              */
/* ------------------------------------------------------------------ */

export class Planet {
  /**
   * @param {object} data     entry from data/celestialBodies.js
   * @param {object} textures procedural texture set
   * @param {object} opts     { isMoon, parent (Planet) }
   */
  constructor(data, textures, { isMoon = false, parent = null } = {}) {
    this.data = data;
    this.isMoon = isMoon;
    this.parent = parent;
    this._radius = 1;
    this.spinOffset = ((data.phaseDeg ?? 0) * Math.PI) / 180;
    this.ringShadowShader = null; // set by onBeforeCompile when applicable

    // -- groups -----------------------------------------------------
    this.root = new THREE.Group();
    if (data.inclinationDeg) {
      this.root.rotation.x = THREE.MathUtils.degToRad(data.inclinationDeg);
    }
    this.bodyGroup = new THREE.Group();
    this.tiltGroup = new THREE.Group();
    this.tiltGroup.rotation.z = THREE.MathUtils.degToRad(data.axialTiltDeg ?? 0);
    this.spinGroup = new THREE.Group();
    this.bodyGroup.add(this.tiltGroup);
    this.tiltGroup.add(this.spinGroup);
    this.root.add(this.bodyGroup);

    // -- surface ----------------------------------------------------
    const segments = isMoon ? 32 : 48;
    this.surfaceMaterial = new THREE.MeshLambertMaterial({ map: textures[data.texture] });
    this.surfaceMesh = new THREE.Mesh(getSphereGeometry(segments), this.surfaceMaterial);
    this.surfaceMesh.userData.bodyId = data.id;
    this.spinGroup.add(this.surfaceMesh);

    // -- cloud layer (Earth) -----------------------------------------
    this.cloudMesh = null;
    if (data.clouds) {
      this.cloudMesh = new THREE.Mesh(
        getSphereGeometry(segments),
        new THREE.MeshLambertMaterial({
          map: textures[data.clouds],
          transparent: true,
          depthWrite: false,
        }),
      );
      this.cloudMesh.scale.setScalar(1.018);
      this.spinGroup.add(this.cloudMesh);
    }

    // -- atmosphere glow ---------------------------------------------
    if (data.atmosphere) {
      this.spinGroup.add(createAtmosphere(data.atmosphere));
    }

    // -- rings --------------------------------------------------------
    this.ringMaterial = null;
    if (data.rings) {
      const { mesh, material } = createRings(data.rings, textures[data.rings.texture]);
      this.ringMaterial = material;
      this.spinGroup.add(mesh);
      if (data.rings.castOnPlanet) {
        this.#injectRingShadow(textures[data.rings.texture]);
      }
    }

    // -- orbit line ----------------------------------------------------
    this.orbitLine = new THREE.LineLoop(
      getCircleGeometry(),
      new THREE.LineBasicMaterial({
        color: isMoon ? 0x35586e : 0x3b6a8a,
        transparent: true,
        opacity: isMoon ? 0.35 : 0.4,
      }),
    );
    this.root.add(this.orbitLine);

    // -- moons ----------------------------------------------------------
    // Moon roots live inside tiltGroup so satellite systems orbit in the
    // planet's equatorial plane (matching ring planes — notably Uranus).
    this.moons = (data.moons ?? []).map((moonData) => {
      const moon = new Planet(moonData, textures, { isMoon: true, parent: this });
      this.tiltGroup.add(moon.root);
      return moon;
    });
  }

  /**
   * Analytic ring shadow on the planet surface: for each fragment, march
   * toward the Sun (world origin) and darken if the ray crosses the ring
   * annulus. Injected into the stock Lambert shader so standard lighting
   * is preserved.
   */
  #injectRingShadow(ringTexture) {
    const spec = this.data.rings;
    const mat = this.surfaceMaterial;
    const self = this;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRingMap = { value: ringTexture };
      shader.uniforms.uRingInner = { value: spec.inner };
      shader.uniforms.uRingOuter = { value: spec.outer };
      shader.uniforms.uRingNormal = { value: new THREE.Vector3(0, 1, 0) };
      shader.uniforms.uPlanetPos = { value: new THREE.Vector3() };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRingWorldPos;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvRingWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vRingWorldPos;
          uniform sampler2D uRingMap;
          uniform float uRingInner;
          uniform float uRingOuter;
          uniform vec3 uRingNormal;
          uniform vec3 uPlanetPos;`,
        )
        .replace(
          '#include <dithering_fragment>',
          `{
            vec3 toSun = normalize(-vRingWorldPos);
            float denom = dot(toSun, uRingNormal);
            if (abs(denom) > 1e-4) {
              float t = dot(uPlanetPos - vRingWorldPos, uRingNormal) / denom;
              if (t > 0.0) {
                vec3 hit = vRingWorldPos + toSun * t;
                float r = length(hit - uPlanetPos);
                if (r > uRingInner && r < uRingOuter) {
                  float u = (r - uRingInner) / (uRingOuter - uRingInner);
                  float a = texture2D(uRingMap, vec2(u, 0.5)).a;
                  gl_FragColor.rgb *= 1.0 - a * 0.8;
                }
              }
            }
          }
          #include <dithering_fragment>`,
        );
      self.ringShadowShader = shader;
    };
    mat.customProgramCacheKey = () => 'lambert-ring-shadow';
  }

  get radiusWorld() {
    return this._radius;
  }

  getWorldPosition(target) {
    return this.bodyGroup.getWorldPosition(target);
  }

  /**
   * @param {number} daysSinceJ2000 simulation time
   * @param {object} scale  { bodyRadius(planet), orbitRadius(planet) }
   */
  update(daysSinceJ2000, scale) {
    const r = scale.bodyRadius(this);
    this._radius = r;
    this.spinGroup.scale.setScalar(r);

    // Orbit position (circular, mean-longitude epoch alignment for planets).
    const orbitR = scale.orbitRadius(this);
    const L0 = ((this.data.meanLongitudeDeg ?? 0) * Math.PI) / 180 + this.spinOffset * (this.isMoon ? 1 : 0);
    const angle = L0 + (TWO_PI * daysSinceJ2000) / this.data.orbitalPeriodDays;
    this.bodyGroup.position.set(Math.cos(angle) * orbitR, 0, -Math.sin(angle) * orbitR);
    this.orbitLine.scale.setScalar(orbitR);

    // Daily rotation (Venus/Uranus/Pluto retrograde comes from tilt > 90 deg).
    this.spinGroup.rotation.y =
      this.spinOffset + (TWO_PI * daysSinceJ2000 * 24) / this.data.rotationPeriodHours;

    // Clouds drift slowly relative to the ground.
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y = this.spinGroup.rotation.y * 0.07;
    }

    // Ring shader uniforms (world-space, scale-aware).
    if (this.ringMaterial) {
      this.getWorldPosition(this.ringMaterial.uniforms.uPlanetPos.value);
      this.ringMaterial.uniforms.uPlanetRadius.value = r;
    }
    if (this.ringShadowShader) {
      const u = this.ringShadowShader.uniforms;
      this.getWorldPosition(u.uPlanetPos.value);
      u.uRingInner.value = r * this.data.rings.inner;
      u.uRingOuter.value = r * this.data.rings.outer;
      u.uRingNormal.value.set(0, 1, 0).applyQuaternion(this.tiltGroup.getWorldQuaternion(_q));
    }

    for (const moon of this.moons) moon.update(daysSinceJ2000, scale);
  }
}
