/**
 * Main asteroid belt between Mars and Jupiter.
 *
 * One InstancedMesh of low-poly icosahedra. Each instance keeps its real
 * orbital elements (semi-major axis in AU, phase, Keplerian period from
 * a^1.5) so the belt shears differentially over time and re-projects
 * correctly when the distance scale changes.
 */

import * as THREE from 'three';

const TWO_PI = Math.PI * 2;
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();

export class AsteroidBelt {
  constructor(count = 4500) {
    this.count = count;

    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshLambertMaterial({ flatShading: true });
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // instances span the whole belt torus

    this.au = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.periodDays = new Float32Array(count);
    this.yFrac = new Float32Array(count);
    this.scales = new Float32Array(count);
    this.quats = [];

    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // Triangular distribution concentrates rocks mid-belt.
      const au = 2.1 + ((Math.random() + Math.random()) / 2) * 1.3;
      this.au[i] = au;
      this.phase[i] = Math.random() * TWO_PI;
      this.periodDays[i] = 365.25 * au ** 1.5; // Kepler's third law
      this.yFrac[i] = (Math.random() + Math.random() + Math.random()) / 1.5 - 1; // ~gaussian [-1,1]
      this.scales[i] = 0.05 + Math.random() ** 2.5 * 0.16;
      this.quats.push(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(Math.random() * TWO_PI, Math.random() * TWO_PI, Math.random() * TWO_PI),
        ),
      );
      color.setHSL(0.07 + Math.random() * 0.04, 0.08 + Math.random() * 0.12, 0.22 + Math.random() * 0.18);
      this.mesh.setColorAt(i, color);
    }
    this.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * @param {number} daysSinceJ2000 simulation time
   * @param {function} orbitRadiusOfAU maps AU -> current world radius
   */
  update(daysSinceJ2000, orbitRadiusOfAU) {
    for (let i = 0; i < this.count; i++) {
      const theta = this.phase[i] + (TWO_PI * daysSinceJ2000) / this.periodDays[i];
      const r = orbitRadiusOfAU(this.au[i]);
      const s = this.scales[i];
      _pos.set(Math.cos(theta) * r, this.yFrac[i] * r * 0.045, -Math.sin(theta) * r);
      _scale.set(s, s * (0.7 + 0.6 * ((i * 0.61803) % 1)), s); // irregular shapes
      _mat.compose(_pos, this.quats[i], _scale);
      this.mesh.setMatrixAt(i, _mat);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
