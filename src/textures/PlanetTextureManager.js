/**
 * PlanetTextureManager.js
 * 
 * High-Resolution Local Planetary Texture Manager
 * PJMC STUDENT — SOLAR SYSTEM EXPLORER
 * Pawan Jha Mathematics Classes
 * 
 * Handles loading, caching, color space configuration, mipmapping,
 * anisotropic filtering, and memory disposal for all celestial bodies.
 * Strictly uses local scientific assets without runtime CDN dependencies.
 */

import * as THREE from 'three';

class PlanetTextureManager {
  constructor() {
    this.loader = new THREE.TextureLoader();
    this.cache = new Map();
    this.maxAnisotropy = 8;
  }

  /**
   * Set max anisotropic filtering supported by the active WebGL renderer.
   * @param {number} anisotropy
   */
  setAnisotropy(anisotropy) {
    this.maxAnisotropy = Math.max(1, anisotropy);
    for (const tex of this.cache.values()) {
      if (tex && tex.isTexture) {
        tex.anisotropy = this.maxAnisotropy;
        tex.needsUpdate = true;
      }
    }
  }

  /**
   * Load or retrieve a cached texture.
   * @param {string} path Local asset path
   * @param {object} options { isDataMap: boolean, wrapS, wrapT, flipY }
   * @returns {Promise<THREE.Texture>}
   */
  load(path, { isDataMap = false, wrapS = THREE.RepeatWrapping, wrapT = THREE.ClampToEdgeWrapping, flipY = true } = {}) {
    if (this.cache.has(path)) {
      return Promise.resolve(this.cache.get(path));
    }

    return new Promise((resolve) => {
      this.loader.load(
        path,
        (texture) => {
          texture.colorSpace = isDataMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
          texture.wrapS = wrapS;
          texture.wrapT = wrapT;
          texture.flipY = flipY;
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = this.maxAnisotropy;
          texture.needsUpdate = true;

          this.cache.set(path, texture);
          resolve(texture);
        },
        undefined,
        (err) => {
          console.warn(`[PlanetTextureManager] Failed to load local asset: ${path}. Checking fallback.`, err);
          resolve(null);
        }
      );
    });
  }

  /**
   * Preload all high-resolution scientific planet maps.
   * @param {function} onProgress
   * @returns {Promise<object>} Map of loaded planet textures
   */
  async preloadAll(onProgress = () => {}) {
    const assets = [
      // Sun
      { key: 'sun', path: '/textures/planets/sun/2k_sun.jpg' },
      
      // Mercury
      { key: 'mercury', path: '/textures/planets/mercury/2k_mercury.jpg' },
      { key: 'mercury_bump', path: '/textures/planets/mercury/2k_mercury_bump.jpg', isDataMap: true },
      
      // Venus
      { key: 'venus', path: '/textures/planets/venus/2k_venus_atmosphere.jpg' },
      { key: 'venus_surface', path: '/textures/planets/venus/2k_venus_surface.jpg' },
      { key: 'venus_bump', path: '/textures/venus_bump.jpg', isDataMap: true },
      
      // Earth & Moon
      { key: 'earth', path: '/textures/planets/earth/2k_earth_daymap.jpg' },
      { key: 'earth_night', path: '/textures/planets/earth/2k_earth_nightmap.jpg' },
      { key: 'earth_clouds', path: '/textures/planets/earth/2k_earth_clouds.jpg' },
      { key: 'earth_specular', path: '/textures/planets/earth/2k_earth_specular.jpg', isDataMap: true },
      { key: 'earth_bump', path: '/textures/planets/earth/2k_earth_bump.jpg', isDataMap: true },
      { key: 'moon', path: '/textures/planets/moon/2k_moon.jpg' },
      { key: 'moon_bump', path: '/textures/planets/moon/2k_moon_bump.jpg', isDataMap: true },
      
      // Mars
      { key: 'mars', path: '/textures/planets/mars/2k_mars.jpg' },
      { key: 'mars_bump', path: '/textures/planets/mars/2k_mars_bump.jpg', isDataMap: true },
      
      // Jupiter
      { key: 'jupiter', path: '/textures/planets/jupiter/2k_jupiter.jpg' },
      
      // Saturn & Rings
      { key: 'saturn', path: '/textures/planets/saturn/2k_saturn.jpg' },
      { key: 'saturn_ring_alpha', path: '/textures/planets/saturn/2k_saturn_ring_alpha.png', isDataMap: true },
      
      // Ice Giants
      { key: 'uranus', path: '/textures/planets/uranus/2k_uranus.jpg' },
      { key: 'neptune', path: '/textures/planets/neptune/2k_neptune.jpg' },
      
      // Pluto
      { key: 'pluto', path: '/textures/planets/pluto/2k_pluto.jpg' },
      
      // Deep Space
      { key: 'galaxy_starfield', path: '/textures/galaxy_starfield.png' }
    ];

    const result = {};
    for (let i = 0; i < assets.length; i++) {
      const item = assets[i];
      onProgress(item.key.toUpperCase().replace('_', ' '));
      const tex = await this.load(item.path, { isDataMap: !!item.isDataMap });
      if (tex) {
        result[item.key] = tex;
      }
    }

    return result;
  }

  /**
   * Dispose all cached textures and free GPU memory.
   */
  dispose() {
    for (const tex of this.cache.values()) {
      if (tex && typeof tex.dispose === 'function') {
        tex.dispose();
      }
    }
    this.cache.clear();
  }
}

export const planetTextureManager = new PlanetTextureManager();
