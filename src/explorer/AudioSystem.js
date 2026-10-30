/**
 * PJMC Space Explorer — AudioSystem.
 * Built entirely with Web Audio API for zero-dependency, 100% offline,
 * lightweight sound effects (engine roar, boost whoosh, countdown beeps,
 * checkpoint chimes, and victory fanfare).
 */

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('pjmc_muted') === 'true';
    this.engineGain = null;
    this.engineFilter = null;
    this.engineOsc = null;
    this.engineNoise = null;
    this.engineRunning = false;
  }

  /** Convenience alias for user-gesture audio initialization */
  init() {
    this.ensureContext();
  }

  /** Initialize AudioContext on first user interaction */
  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(muted) {
    this.muted = !!muted;
    localStorage.setItem('pjmc_muted', this.muted ? 'true' : 'false');
    if (this.muted) {
      if (this.engineGain && this.ctx) this.engineGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Countdown beep */
  playBeep(freq = 880, duration = 0.15) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /** Start synthesized rocket engine roar */
  startEngine() {
    if (this.engineRunning) return;
    this.ensureContext();
    if (!this.ctx) return;

    this.engineRunning = true;

    // 1. Pink/Brown noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.25;
    }

    this.engineNoise = this.ctx.createBufferSource();
    this.engineNoise.buffer = noiseBuffer;
    this.engineNoise.loop = true;

    // Filter to simulate low-end rumble
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(260, this.ctx.currentTime);

    // Oscillator for mechanical vibration hum
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(55, this.ctx.currentTime);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    this.engineOsc.connect(oscGain);

    // Master engine gain
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(this.muted ? 0 : 0.05, this.ctx.currentTime);

    this.engineNoise.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    oscGain.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);

    this.engineNoise.start();
    this.engineOsc.start();
  }

  /** Modulate rocket engine sound with throttle and boost */
  setEngineThrottle(throttle = 0.2, isBoosting = false) {
    if (!this.engineRunning || !this.ctx) return;

    const targetGain = this.muted ? 0 : Math.min(0.04 + throttle * 0.14 + (isBoosting ? 0.08 : 0), 0.26);
    const targetFreq = 180 + throttle * 480 + (isBoosting ? 650 : 0);
    const targetOsc = 45 + throttle * 55 + (isBoosting ? 40 : 0);

    const now = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.engineOsc.frequency.setTargetAtTime(targetOsc, now, 0.08);
  }

  /** Stop engine sound */
  stopEngine() {
    if (!this.engineRunning || !this.ctx) return;
    this.engineRunning = false;
    try {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      setTimeout(() => {
        try {
          this.engineNoise?.stop();
          this.engineOsc?.stop();
          this.engineNoise?.disconnect();
          this.engineOsc?.disconnect();
        } catch (_) {}
      }, 150);
    } catch (_) {}
  }

  /** Boost whoosh sound */
  playBoostWhoosh() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  /** Checkpoint cleared chime */
  playCheckpointChime() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.06);

      gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.06 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * 0.06);
      osc.stop(this.ctx.currentTime + idx * 0.06 + 0.5);
    });
  }

  /** Mission victory fanfare */
  playVictory() {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const chord = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.09);

      gain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.09);
      gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + idx * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.09 + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * 0.09);
      osc.stop(this.ctx.currentTime + idx * 0.09 + 1.3);
    });
  }

  /** Alias for victory fanfare */
  playFanfare() {
    this.playVictory();
  }

  /** Throttle helper for gameplay loop */
  playEngineThrottle(throttle = 0.5, isBoosting = false) {
    if (!this.engineRunning) {
      this.startEngine();
    }
    this.setEngineThrottle(throttle, isBoosting);
  }

  /** Stop boost helper */
  stopBoost() {
    // Boost whoosh stops automatically
  }

  /** Cleanup audio context */
  dispose() {
    this.stopEngine();
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.close();
      } catch (_) {}
    }
  }
}

export const audioSystem = new AudioSystem();
