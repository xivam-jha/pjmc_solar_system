/**
 * AdaptiveQuality.js
 * 
 * Dynamic Performance & Adaptive Quality Architecture
 * PJMC STUDENT — SOLAR SYSTEM EXPLORER
 * Pawan Jha Mathematics Classes
 * 
 * Manages geometric detail levels, shader complexity, anisotropic filtering,
 * and automatic real-time performance scaling based on client capabilities.
 */

export const QUALITY_PRESETS = {
  ultra: {
    id: 'ultra',
    label: 'Ultra (NASA Mode)',
    primarySegments: 192,
    moonSegments: 96,
    cloudSegments: 128,
    anisotropy: 16,
    atmosphereTier: 'ultra',
    atmosphereSegments: 96,
    enableShadows: true,
    enableDetailedClouds: true,
  },
  high: {
    id: 'high',
    label: 'High (Photoreal)',
    primarySegments: 128,
    moonSegments: 64,
    cloudSegments: 96,
    anisotropy: 8,
    atmosphereTier: 'high',
    atmosphereSegments: 64,
    enableShadows: true,
    enableDetailedClouds: true,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced (Smooth)',
    primarySegments: 96,
    moonSegments: 48,
    cloudSegments: 64,
    anisotropy: 4,
    atmosphereTier: 'medium',
    atmosphereSegments: 48,
    enableShadows: true,
    enableDetailedClouds: true,
  },
  low: {
    id: 'low',
    label: 'Performance (Low)',
    primarySegments: 64,
    moonSegments: 32,
    cloudSegments: 48,
    anisotropy: 2,
    atmosphereTier: 'low',
    atmosphereSegments: 36,
    enableShadows: false,
    enableDetailedClouds: false,
  },
};

const TIER_ORDER = ['low', 'balanced', 'high', 'ultra'];

export class AdaptiveQualityManager {
  constructor() {
    this.mode = 'auto'; // 'auto' | 'ultra' | 'high' | 'balanced' | 'low'
    this.currentTier = 'high'; // default starting tier
    this.preset = QUALITY_PRESETS[this.currentTier];

    // Frame tracking for Auto mode
    this.fpsHistory = [];
    this.historyMaxSize = 60;
    this.lastTierChangeTime = performance.now();
    this.hysteresisDownMs = 3000; // 3 seconds below threshold to downgrade
    this.hysteresisUpMs = 7000;   // 7 seconds consistently above threshold to upgrade
    this.lowFpsDuration = 0;
    this.highFpsDuration = 0;
    this.currentFps = 60;

    // Listeners for quality change
    this.listeners = new Set();
  }

  /**
   * Set user preferred quality mode.
   * @param {'auto' | 'ultra' | 'high' | 'balanced' | 'low'} mode
   */
  setMode(mode) {
    if (!['auto', 'ultra', 'high', 'balanced', 'low'].includes(mode)) return;
    this.mode = mode;
    if (mode !== 'auto') {
      this.#applyTier(mode);
    }
  }

  getMode() {
    return this.mode;
  }

  getCurrentTier() {
    return this.currentTier;
  }

  getPreset() {
    return this.preset;
  }

  getFPS() {
    return Math.round(this.currentFps);
  }

  /**
   * Register a listener for tier changes.
   * @param {function(preset: object, tier: string)} callback
   */
  onQualityChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  #applyTier(tier) {
    if (!QUALITY_PRESETS[tier]) return;
    if (this.currentTier === tier) return;

    this.currentTier = tier;
    this.preset = QUALITY_PRESETS[tier];
    this.lastTierChangeTime = performance.now();
    this.lowFpsDuration = 0;
    this.highFpsDuration = 0;

    console.info(`[AdaptiveQuality] Switched to tier: ${tier.toUpperCase()}`, this.preset);

    for (const listener of this.listeners) {
      try {
        listener(this.preset, this.currentTier);
      } catch (e) {
        console.error('[AdaptiveQuality] Error in listener:', e);
      }
    }
  }

  /**
   * Call once per frame in animation loop to monitor performance.
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    if (dt <= 0) return;
    const instantFps = 1 / dt;
    this.fpsHistory.push(instantFps);
    if (this.fpsHistory.length > this.historyMaxSize) {
      this.fpsHistory.shift();
    }

    // Calculate rolling average FPS
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    this.currentFps = sum / this.fpsHistory.length;

    // In Auto mode, evaluate hysteresis
    if (this.mode === 'auto') {
      const now = performance.now();
      const timeSinceChange = now - this.lastTierChangeTime;
      const currentIndex = TIER_ORDER.indexOf(this.currentTier);

      // Low FPS evaluation (Downgrade threshold < 35 FPS)
      if (this.currentFps < 35) {
        this.lowFpsDuration += dt * 1000;
        this.highFpsDuration = 0;

        if (this.lowFpsDuration > this.hysteresisDownMs && timeSinceChange > this.hysteresisDownMs && currentIndex > 0) {
          const nextTier = TIER_ORDER[currentIndex - 1];
          this.#applyTier(nextTier);
        }
      } 
      // High FPS evaluation (Upgrade threshold > 56 FPS)
      else if (this.currentFps > 56) {
        this.highFpsDuration += dt * 1000;
        this.lowFpsDuration = 0;

        if (this.highFpsDuration > this.hysteresisUpMs && timeSinceChange > this.hysteresisUpMs && currentIndex < TIER_ORDER.length - 1) {
          const nextTier = TIER_ORDER[currentIndex + 1];
          this.#applyTier(nextTier);
        }
      } else {
        this.lowFpsDuration = 0;
        this.highFpsDuration = 0;
      }
    }
  }
}

export const adaptiveQuality = new AdaptiveQualityManager();
