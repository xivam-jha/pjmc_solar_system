/**
 * The Sun: an emissive procedural surface with animated turbulence and
 * limb darkening, plus layered additive corona sprites. The corona works
 * with or without bloom post-processing (it is the graceful fallback).
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
    // Two drifting samples of the granulation channel create slow turbulence.
    vec2 uv1 = vUv + vec2(t * 0.0045, t * 0.0014);
    vec2 uv2 = vUv * 1.7 - vec2(t * 0.0028, -t * 0.0011);
    float n1 = texture2D(uMap, uv1).r;
    float n2 = texture2D(uMap, uv2).r;
    float largeScale = texture2D(uMap, vUv + vec2(t * 0.001, 0.0)).g;
    float g = clamp(n1 * 0.62 + n2 * 0.52 + (largeScale - 0.5) * 0.25, 0.0, 1.0);
    vec3 col = mix(vec3(1.0, 0.42, 0.04), vec3(1.0, 0.94, 0.68), smoothstep(0.2, 0.95, g));
    // Hot cells flare above 1.0 so the bloom pass picks them up.
    col += vec3(1.0, 0.85, 0.5) * pow(max(g - 0.78, 0.0) * 4.0, 2.0);
    // Limb darkening.
    float ndv = clamp(dot(normalize(vNormalV), normalize(vViewV)), 0.0, 1.0);
    col *= mix(0.42, 1.0, pow(ndv, 0.55));
    gl_FragColor = vec4(col * 1.5, 1.0);
  }
`;

export class Sun {
  constructor(data, textures) {
    this.data = data;
    this.isMoon = false;
    this.parent = null;
    this.moons = [];
    this._radius = 1;

    this.bodyGroup = new THREE.Group(); // stays at the origin
    this.spinGroup = new THREE.Group();
    this.bodyGroup.add(this.spinGroup);

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

    // Layered corona sprites (scaled in local units of the spin group, so
    // they track the Sun's current display radius automatically).
    const coronaLayers = [
      { scale: 2.4, color: 0xffd9a0, opacity: 0.5 },
      { scale: 3.4, color: 0xff9a40, opacity: 0.18 },
      { scale: 5.0, color: 0xff6a20, opacity: 0.07 },
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

  /** dt is real seconds (surface turbulence keeps moving even when paused). */
  update(daysSinceJ2000, scale, dt) {
    const r = scale.bodyRadius(this);
    this._radius = r;
    this.spinGroup.scale.setScalar(r);
    this.spinGroup.rotation.y = (2 * Math.PI * daysSinceJ2000 * 24) / this.data.rotationPeriodHours;
    this.material.uniforms.uTime.value += dt;
  }
}
