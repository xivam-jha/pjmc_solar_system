/**
 * Planet.js — Ultra Photorealistic Planetary Rendering Engine
 * PJMC STUDENT — SOLAR SYSTEM EXPLORER
 * Pawan Jha Mathematics Classes
 *
 * Reusable Planet class used for all 8 major planets, the Moon, major satellites, and Pluto.
 * Features:
 * - Genuine scientific equirectangular 2K PBR materials (roughness, metalness, bump, specular).
 * - Smooth Day/Night terminator blending with warm twilight Rayleigh shift and night-side city lights.
 * - Physically inspired sun-facing atmospheric scattering without cartoon night-side glow.
 * - Dynamic differential cloud shell with separate rotation speed.
 * - Real Cassini alpha ring textures with dual shadows (ring on planet & planet on ring).
 * - Interactive Venus Radar Topography vs. Cloud Atmosphere toggle.
 * - Adaptive geometry tiers (up to 192x96 segments) with sphere caching.
 */

import * as THREE from 'three';
import { createRings } from './Rings.js';
import { adaptiveQuality } from '../renderer/AdaptiveQuality.js';

const TWO_PI = Math.PI * 2;
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/* Shared unit-sphere geometries, keyed by widthSegments_heightSegments */
const sphereCache = new Map();
export function getSphereGeometry(widthSegments, heightSegments = Math.round(widthSegments / 2)) {
  const key = `${widthSegments}_${heightSegments}`;
  if (!sphereCache.has(key)) {
    sphereCache.set(key, new THREE.SphereGeometry(1, widthSegments, heightSegments));
  }
  return sphereCache.get(key);
}

/* Shared unit-circle line geometry for orbit paths */
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
/* Physically Inspired Atmospheric Scattering Shader                  */
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
  uniform vec3 uTwilightColor;
  varying vec3 vNormalV;
  varying vec3 vViewV;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    
    // View angle rim glow (limb brightening)
    float viewDot = abs(dot(normalize(vNormalV), normalize(vViewV)));
    float fresnel = pow(clamp(1.0 - viewDot, 0.0, 1.0), uPower);
    
    // Sun direction: the Sun is located at the world origin (0, 0, 0)
    vec3 sunDir = normalize(-vWorldPos);
    float sunDot = dot(normalize(vWorldNormal), sunDir);
    
    // Physically authentic day illumination:
    // Full brightness on day hemisphere, tapering smoothly across terminator.
    // Strictly ZERO emission on the dark night side to eliminate artificial halos.
    float dayFactor = smoothstep(-0.06, 0.28, sunDot);
    
    if (dayFactor <= 0.001) {
      discard;
    }
    
    // Rayleigh twilight reddening near the terminator (-0.05 to 0.15)
    float twilightFactor = smoothstep(0.25, -0.05, sunDot) * smoothstep(-0.08, 0.04, sunDot);
    vec3 atmoColor = mix(uColor, uTwilightColor, twilightFactor * 0.75);
    
    // Subtle limb-darkening profile
    float limb = mix(0.85, 1.25, fresnel);
    
    vec3 finalRgb = atmoColor * (fresnel * dayFactor * uIntensity * limb);
    gl_FragColor = vec4(finalRgb, fresnel * dayFactor);
  }
`;

function createAtmosphere(spec, segments = 64) {
  // Twilight warm shift color (sunset orange/amber for Earth, deeper gold for Venus, warm rust for Mars)
  let twilightHex = 0xff8c42;
  if (spec.color === 0xe8d9a0) twilightHex = 0xffb366; // Venus
  else if (spec.color === 0xd8a080) twilightHex = 0xcc5533; // Mars
  else if (spec.color === 0xd89040) twilightHex = 0xe07020; // Titan

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(spec.color) },
      uTwilightColor: { value: new THREE.Color(twilightHex) },
      uPower: { value: spec.power ?? 3.2 },
      uIntensity: { value: spec.intensity ?? 0.8 },
    },
    vertexShader: ATMO_VERTEX,
    fragmentShader: ATMO_FRAGMENT,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(getSphereGeometry(segments), material);
  mesh.scale.setScalar(1.025);
  return { mesh, material };
}

/* ------------------------------------------------------------------ */
/* Planet Class                                                        */
/* ------------------------------------------------------------------ */

export class Planet {
  /**
   * @param {object} data     entry from data/celestialBodies.js
   * @param {object} textures texture set
   * @param {object} opts     { isMoon, parent (Planet) }
   */
  constructor(data, textures, { isMoon = false, parent = null } = {}) {
    this.data = data;
    this.textures = textures;
    this.isMoon = isMoon;
    this.parent = parent;
    this._radius = 1;
    this.spinOffset = ((data.phaseDeg ?? 0) * Math.PI) / 180;
    this.ringShadowShader = null;
    this.isVenusRadarMode = false;

    // Quality preset settings
    const preset = adaptiveQuality.getPreset();
    this.currentSegments = isMoon ? preset.moonSegments : preset.primarySegments;

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

    // -- surface PBR material ---------------------------------------
    this.#setupSurfaceMaterial(textures);

    // -- surface mesh -----------------------------------------------
    this.surfaceMesh = new THREE.Mesh(
      getSphereGeometry(this.currentSegments),
      this.surfaceMaterial
    );
    this.surfaceMesh.userData.bodyId = data.id;
    this.spinGroup.add(this.surfaceMesh);

    // -- cloud layer (Earth) ----------------------------------------
    this.cloudMesh = null;
    this.cloudMaterial = null;
    if (data.clouds || data.id === 'earth') {
      const cloudTex = textures.earth_clouds || textures[data.clouds] || textures.earthClouds;
      if (cloudTex) {
        this.cloudMaterial = new THREE.MeshStandardMaterial({
          map: cloudTex,
          transparent: true,
          opacity: 0.86,
          roughness: 0.95,
          metalness: 0.0,
          depthWrite: false,
        });
        this.cloudMesh = new THREE.Mesh(
          getSphereGeometry(preset.cloudSegments),
          this.cloudMaterial
        );
        this.cloudMesh.scale.setScalar(1.018);
        this.spinGroup.add(this.cloudMesh);
      }
    }

    // -- atmosphere glow --------------------------------------------
    this.atmosphereMesh = null;
    this.atmosphereMaterial = null;
    if (data.atmosphere) {
      const { mesh, material } = createAtmosphere(data.atmosphere, preset.atmosphereSegments);
      this.atmosphereMesh = mesh;
      this.atmosphereMaterial = material;
      this.spinGroup.add(this.atmosphereMesh);
    }

    // -- rings ------------------------------------------------------
    this.ringMesh = null;
    this.ringMaterial = null;
    if (data.rings) {
      // Prioritize high-resolution alpha ring texture
      const ringTex = textures.saturn_ring_alpha || textures[data.rings.texture];
      const { mesh, material } = createRings(data.rings, ringTex);
      this.ringMesh = mesh;
      this.ringMaterial = material;
      this.spinGroup.add(mesh);

      if (data.rings.castOnPlanet) {
        this.#injectRingShadow(ringTex);
      }
    }

    // -- orbit line -------------------------------------------------
    this.orbitLine = new THREE.LineLoop(
      getCircleGeometry(),
      new THREE.LineBasicMaterial({
        color: isMoon ? 0x35586e : 0x3b6a8a,
        transparent: true,
        opacity: isMoon ? 0.35 : 0.4,
      }),
    );
    this.root.add(this.orbitLine);

    // -- moons ------------------------------------------------------
    this.moons = (data.moons ?? []).map((moonData) => {
      const moon = new Planet(moonData, textures, { isMoon: true, parent: this });
      this.tiltGroup.add(moon.root);
      return moon;
    });

    // Subscribe to dynamic adaptive quality updates
    this.unsubscribeQuality = adaptiveQuality.onQualityChange((newPreset) => {
      this.applyQualityPreset(newPreset);
    });
  }

  /**
   * Configure scientifically calibrated PBR materials per planetary body.
   */
  #setupSurfaceMaterial(textures) {
    const data = this.data;
    const isMoon = this.isMoon;

    const matConfig = {
      map: textures[data.texture] || textures[data.id],
      roughness: 0.8,
      metalness: 0.05,
    };

    // Body-specific scientific PBR parameter calibrations
    switch (data.id) {
      case 'mercury':
        matConfig.roughness = 0.88;
        matConfig.metalness = 0.08;
        if (textures.mercury_bump) {
          matConfig.bumpMap = textures.mercury_bump;
          matConfig.bumpScale = 0.055;
        }
        break;

      case 'venus':
        // Default: Cloud tops
        matConfig.roughness = 0.55;
        matConfig.metalness = 0.02;
        break;

      case 'earth':
        matConfig.map = textures.earth || textures[data.texture];
        matConfig.roughness = 0.50;
        matConfig.metalness = 0.04;
        if (textures.earth_specular) {
          matConfig.roughnessMap = textures.earth_specular;
        }
        if (textures.earth_bump) {
          matConfig.bumpMap = textures.earth_bump;
          matConfig.bumpScale = 0.045;
        }
        break;

      case 'moon':
        matConfig.roughness = 0.92;
        matConfig.metalness = 0.04;
        if (textures.moon_bump) {
          matConfig.bumpMap = textures.moon_bump;
          matConfig.bumpScale = 0.058;
        }
        break;

      case 'mars':
        matConfig.roughness = 0.78;
        matConfig.metalness = 0.10;
        if (textures.mars_bump) {
          matConfig.bumpMap = textures.mars_bump;
          matConfig.bumpScale = 0.062;
        }
        break;

      case 'jupiter':
        matConfig.roughness = 0.48;
        matConfig.metalness = 0.0;
        break;

      case 'saturn':
        matConfig.roughness = 0.52;
        matConfig.metalness = 0.0;
        break;

      case 'uranus':
        matConfig.roughness = 0.44;
        matConfig.metalness = 0.0;
        break;

      case 'neptune':
        matConfig.roughness = 0.40;
        matConfig.metalness = 0.0;
        break;

      case 'pluto':
        matConfig.roughness = 0.84;
        matConfig.metalness = 0.05;
        break;

      default:
        if (isMoon) {
          matConfig.roughness = 0.85;
          matConfig.metalness = 0.05;
        }
        break;
    }

    // Generic bump fallback for moons / terrestrial bodies
    const bumpKey = data.texture + '_bump';
    if (!matConfig.bumpMap && textures[bumpKey]) {
      matConfig.bumpMap = textures[bumpKey];
      matConfig.bumpScale = isMoon ? 0.025 : 0.04;
    }

    this.surfaceMaterial = new THREE.MeshStandardMaterial(matConfig);

    // Inject photorealistic Earth day/night blending with city lights
    if (data.id === 'earth' && (textures.earth_night || textures.earthNight)) {
      this.#injectEarthNightLights(textures.earth_night || textures.earthNight);
    }
  }

  /**
   * Inject city lights onto the night side of Earth with warm emission.
   */
  #injectEarthNightLights(nightTexture) {
    const mat = this.surfaceMaterial;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uNightMap = { value: nightTexture };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec2 vEarthUv;
          varying vec3 vEarthWorldNormal;
          varying vec3 vEarthWorldPos;`,
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
          vEarthUv = uv;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vEarthWorldNormal = normalize(mat3(modelMatrix) * normal);
          vEarthWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D uNightMap;
          varying vec2 vEarthUv;
          varying vec3 vEarthWorldNormal;
          varying vec3 vEarthWorldPos;`,
        )
        .replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          {
            vec3 sunDir = normalize(-vEarthWorldPos);
            float dayAmount = dot(normalize(vEarthWorldNormal), sunDir);
            // Smooth terminator transition for city illumination
            float nightFactor = smoothstep(0.08, -0.16, dayAmount);
            if (nightFactor > 0.0) {
              vec3 cityLights = texture2D(uNightMap, vEarthUv).rgb;
              // Warm incandescent glow with slight boost
              gl_FragColor.rgb += cityLights * vec3(1.35, 1.15, 0.90) * nightFactor * 1.5;
            }
          }`,
        );
    };
    mat.customProgramCacheKey = () => 'earth-night-lights-v2';
  }

  /**
   * Analytic ring shadow on the planet surface: for each fragment, march
   * toward the Sun (world origin) and darken if the ray crosses the ring annulus.
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
                  gl_FragColor.rgb *= 1.0 - a * 0.85;
                }
              }
            }
          }
          #include <dithering_fragment>`,
        );
      self.ringShadowShader = shader;
    };
    mat.customProgramCacheKey = () => 'standard-ring-shadow-v2';
  }

  /**
   * Toggle Venus view mode between Cloud Tops and Magellan Radar Surface.
   * @param {boolean} radarMode
   */
  setVenusRadarMode(radarMode) {
    if (this.data.id !== 'venus') return;
    this.isVenusRadarMode = radarMode;

    if (radarMode) {
      if (this.textures.venus_surface) {
        this.surfaceMaterial.map = this.textures.venus_surface;
        this.surfaceMaterial.roughness = 0.76;
        this.surfaceMaterial.metalness = 0.06;
        if (this.textures.venus_bump) {
          this.surfaceMaterial.bumpMap = this.textures.venus_bump;
          this.surfaceMaterial.bumpScale = 0.05;
        }
        this.surfaceMaterial.needsUpdate = true;
      }
      if (this.atmosphereMesh) {
        this.atmosphereMesh.visible = false;
      }
    } else {
      this.surfaceMaterial.map = this.textures.venus || this.textures[this.data.texture];
      this.surfaceMaterial.roughness = 0.55;
      this.surfaceMaterial.metalness = 0.02;
      this.surfaceMaterial.bumpMap = null;
      this.surfaceMaterial.needsUpdate = true;
      if (this.atmosphereMesh) {
        this.atmosphereMesh.visible = true;
      }
    }
  }

  /**
   * Apply adaptive quality preset to geometry and shaders.
   * @param {object} preset
   */
  applyQualityPreset(preset) {
    const segs = this.isMoon ? preset.moonSegments : preset.primarySegments;
    if (this.surfaceMesh && this.currentSegments !== segs) {
      this.currentSegments = segs;
      this.surfaceMesh.geometry = getSphereGeometry(segs);
    }

    if (this.cloudMesh && preset.cloudSegments) {
      this.cloudMesh.geometry = getSphereGeometry(preset.cloudSegments);
    }

    if (this.atmosphereMesh && preset.atmosphereSegments) {
      this.atmosphereMesh.geometry = getSphereGeometry(preset.atmosphereSegments);
    }
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

    // Clouds drift with differential velocity relative to the planet surface
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y = this.spinGroup.rotation.y * 1.05 + daysSinceJ2000 * 0.12;
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

  dispose() {
    if (this.unsubscribeQuality) {
      this.unsubscribeQuality();
    }
  }
}
