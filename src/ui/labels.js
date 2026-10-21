/**
 * Floating body-name labels, projected from world space each frame.
 * Clickable (focuses the body) — this is also how you find the planets
 * in true-scale mode, where they are sub-pixel dots.
 *
 * Moon labels only appear while their planetary system is in focus to
 * avoid clutter at the system overview.
 */

import * as THREE from 'three';

const _world = new THREE.Vector3();
const _view = new THREE.Vector3();

export class Labels {
  /**
   * @param {HTMLElement} container  #labels overlay div
   * @param {Array} entries [{id, name, isMoon, parentId, body (Planet|Sun)}]
   * @param {function} onPick id => void
   */
  constructor(container, entries, onPick) {
    this.container = container;
    this.entries = entries;
    this.enabled = true;
    for (const entry of entries) {
      const div = document.createElement('div');
      div.className = `body-label ${entry.isMoon ? 'moon-label' : ''}`;
      div.textContent = entry.name;
      div.addEventListener('click', () => onPick(entry.id));
      container.append(div);
      entry.labelEl = div;
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.container.style.display = on ? '' : 'none';
  }

  /**
   * @param {THREE.Camera} camera
   * @param {string|null} focusSystemId planet id whose moons are revealed
   */
  update(camera, focusSystemId) {
    if (!this.enabled) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    for (const entry of this.entries) {
      const div = entry.labelEl;
      if (entry.isMoon && entry.parentId !== focusSystemId) {
        div.style.display = 'none';
        continue;
      }
      entry.body.getWorldPosition(_world);

      // Cull labels behind the camera (projection flips there).
      _view.copy(_world).applyMatrix4(camera.matrixWorldInverse);
      if (_view.z > 0) {
        div.style.display = 'none';
        continue;
      }

      // Hide a label once the camera is close enough that the body itself
      // dominates the view.
      const dist = _view.length();
      if (dist < entry.body.radiusWorld * 8) {
        div.style.display = 'none';
        continue;
      }

      _world.project(camera);
      const x = (_world.x * 0.5 + 0.5) * w;
      const y = (-_world.y * 0.5 + 0.5) * h;
      if (x < -60 || x > w + 60 || y < -30 || y > h + 30) {
        div.style.display = 'none';
        continue;
      }
      div.style.display = '';
      div.style.transform = `translate(-50%, -130%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }
}
