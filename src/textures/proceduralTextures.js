/**
 * Procedural texture generation.
 *
 * Every texture in the app is generated at runtime on 2D canvases from
 * seeded value-noise — no downloaded assets, fully deterministic, works
 * offline. Equirectangular maps wrap seamlessly in longitude because the
 * noise lattice is periodic in x (and domain-warp offsets are themselves
 * periodic, which preserves the seam-free property).
 */

import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/* Noise primitives                                                    */
/* ------------------------------------------------------------------ */

/** Integer lattice hash -> [0,1). Deterministic across runs. */
function hash2(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth01(t) {
  return t * t * (3 - 2 * t);
}

/**
 * 2D value noise, periodic in x with integer period `px` (in lattice cells).
 * Sample coordinates are in lattice space: x in [0, px) covers one wrap.
 */
function valueNoise(x, y, px, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const wx = smooth01(x - ix);
  const wy = smooth01(y - iy);
  const x0 = ((ix % px) + px) % px;
  const x1 = (x0 + 1) % px;
  const a = hash2(x0, iy, seed);
  const b = hash2(x1, iy, seed);
  const c = hash2(x0, iy + 1, seed);
  const d = hash2(x1, iy + 1, seed);
  return a + (b - a) * wx + (c - a) * wy + (a - b - c + d) * wx * wy;
}

/** Fractal Brownian motion built on the periodic value noise. */
function fbm(x, y, px, seed, octaves = 4, gain = 0.5) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let p = px;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x, y, p, seed + i * 101);
    norm += amp;
    x *= 2;
    y *= 2;
    p *= 2;
    amp *= gain;
  }
  return sum / norm;
}

/** Ridged variant: sharp filament/crack-like features near 0. */
function ridged(x, y, px, seed, octaves = 4) {
  return Math.abs(2 * fbm(x, y, px, seed, octaves) - 1);
}

/** Seeded PRNG for crater placement etc. */
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Canvas helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Run `pixelFn(u, v, out)` for every pixel and build a CanvasTexture.
 * `out` is an [r, g, b, a] array (0-255); alpha defaults to 255.
 */
function makeTexture(w, h, pixelFn, { colorSpace = THREE.SRGBColorSpace, wrapT = THREE.ClampToEdgeWrapping } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const out = [0, 0, 0, 255];
  let i = 0;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      out[3] = 255;
      pixelFn((x + 0.5) / w, v, out);
      d[i++] = out[0];
      d[i++] = out[1];
      d[i++] = out[2];
      d[i++] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = wrapT;
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  return tex;
}

function hex(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

function lerp3(a, b, t, out) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

/** Piecewise-linear palette lookup. stops: [[t, [r,g,b]], ...] sorted by t. */
function palette(stops, t, out) {
  if (t <= stops[0][0]) {
    out[0] = stops[0][1][0]; out[1] = stops[0][1][1]; out[2] = stops[0][1][2];
    return;
  }
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      lerp3(stops[i - 1][1], stops[i][1], k, out);
      return;
    }
  }
  const last = stops[stops.length - 1][1];
  out[0] = last[0]; out[1] = last[1]; out[2] = last[2];
}

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function sstep(e0, e1, t) {
  return smooth01(clamp01((t - e0) / (e1 - e0)));
}

/* ------------------------------------------------------------------ */
/* Cratered rocky bodies (Mercury, Moon, Callisto, Phobos, ...)        */
/* ------------------------------------------------------------------ */

/**
 * Build a float "shade" field from fbm, stamp craters into it (floor
 * depression + bright rim), then map through a 3-color palette.
 */
function generateCratered({
  seed, w = 512, h = 256,
  dark, base, light,
  craterCount = 130, craterMax = 24,
  noiseFreq = 6, contrast = 1.0,
}) {
  const shade = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      shade[y * w + x] = fbm(u * noiseFreq, v * noiseFreq * 0.5, noiseFreq, seed, 5);
    }
  }
  // Stamp craters (wrapping in x).
  const rng = mulberry32(seed * 7 + 1);
  for (let n = 0; n < craterCount; n++) {
    const cx = rng() * w;
    const cy = h * (0.06 + 0.88 * rng());
    const r = (1.5 + craterMax * rng() ** 2.2) * (w / 512);
    const depth = 0.35 + 0.5 * rng();
    const ri = Math.ceil(r * 1.2);
    for (let dy = -ri; dy <= ri; dy++) {
      const yy = Math.round(cy) + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -ri; dx <= ri; dx++) {
        const dist = Math.hypot(dx, dy) / r;
        if (dist > 1.15) continue;
        const xx = ((Math.round(cx) + dx) % w + w) % w;
        let delta = 0;
        if (dist < 0.85) delta -= depth * 0.4 * (1 - sstep(0.55, 0.85, dist)); // floor
        delta += depth * 0.32 * Math.max(0, 1 - Math.abs(dist - 0.95) / 0.2); // rim
        shade[yy * w + xx] += delta;
      }
    }
  }
  const cDark = hex(dark);
  const cBase = hex(base);
  const cLight = hex(light);
  return makeTexture(w, h, (u, v, out) => {
    const s = clamp01(0.5 + (shade[Math.floor(v * h) * w + Math.floor(u * w)] - 0.5) * contrast);
    if (s < 0.5) lerp3(cDark, cBase, s * 2, out);
    else lerp3(cBase, cLight, (s - 0.5) * 2, out);
  });
}

/* ------------------------------------------------------------------ */
/* Banded gas/ice giants (+ Venus cloud deck)                          */
/* ------------------------------------------------------------------ */

function generateBanded({
  seed, w = 1024, h = 512,
  stops,
  turb = 0.04,       // latitude displacement from large-scale noise
  streakAmp = 0,     // extra x-stretched streaky distortion
  detailAmp = 0.08,  // fine brightness mottling
  spots = [],        // [{u, v, rx, ry, color, strength}]
}) {
  const stopsRGB = stops.map(([t, c]) => [t, hex(c)]);
  const spotsRGB = spots.map((s) => ({ ...s, rgb: hex(s.color) }));
  const col = [0, 0, 0];
  return makeTexture(w, h, (u, v, out) => {
    const warp = fbm(u * 10, v * 5, 10, seed, 4) - 0.5;
    let t = v + warp * turb;
    if (streakAmp > 0) t += streakAmp * (fbm(u * 36, v * 7, 36, seed + 77, 3) - 0.5);
    palette(stopsRGB, clamp01(t), col);
    const bright = 1 + detailAmp * (fbm(u * 28, v * 14, 28, seed + 31, 3) - 0.5) * 2;
    col[0] *= bright; col[1] *= bright; col[2] *= bright;
    for (const s of spotsRGB) {
      let du = Math.abs(u - s.u);
      if (du > 0.5) du = 1 - du; // wrap
      const dv = v - s.v;
      const e = (du / s.rx) ** 2 + (dv / s.ry) ** 2;
      if (e < 1) {
        const m = smooth01(1 - e) * s.strength;
        const swirl = 0.85 + 0.3 * Math.sin(e * 9.4); // faint internal banding
        col[0] += (s.rgb[0] * swirl - col[0]) * m;
        col[1] += (s.rgb[1] * swirl - col[1]) * m;
        col[2] += (s.rgb[2] * swirl - col[2]) * m;
      }
    }
    out[0] = col[0]; out[1] = col[1]; out[2] = col[2];
  });
}

/* ------------------------------------------------------------------ */
/* One-off bodies                                                      */
/* ------------------------------------------------------------------ */

function generateEarth() {
  const seed = 7;
  const OCEAN_DEEP = hex(0x0a2d5e);
  const OCEAN = hex(0x14559e);
  const SHELF = hex(0x2a7fc0);
  const GRASS = hex(0x3d7a35);
  const FOREST = hex(0x29571f);
  const DESERT = hex(0xc2a45e);
  const ROCK = hex(0x8a7355);
  const SNOW = hex(0xf2f5f7);
  const tmp = [0, 0, 0];
  return makeTexture(1024, 512, (u, v, out) => {
    const lat = Math.abs(0.5 - v) * 2; // 0 equator -> 1 pole
    // Domain-warped continents.
    const wx = fbm(u * 6, v * 3, 6, seed + 50, 3) - 0.5;
    const wy = fbm(u * 6, v * 3, 6, seed + 60, 3) - 0.5;
    const c = fbm(u * 7 + wx * 1.6, v * 3.5 + wy * 1.6, 7, seed, 5);
    const landT = sstep(0.535, 0.555, c);
    if (landT < 1) {
      // Ocean with depth shading.
      lerp3(OCEAN_DEEP, OCEAN, sstep(0.25, 0.5, c), out);
      lerp3(out, SHELF, sstep(0.5, 0.54, c) * 0.7, out);
    }
    if (landT > 0) {
      // Land: vegetation vs desert by a second climate noise, alpine rock high up.
      const climate = fbm(u * 9, v * 4.5, 9, seed + 11, 4);
      lerp3(FOREST, GRASS, sstep(0.35, 0.65, climate), tmp);
      const desertBelt = sstep(0.55, 0.2, lat) * sstep(0.45, 0.7, climate);
      lerp3(tmp, DESERT, desertBelt * 0.85, tmp);
      lerp3(tmp, ROCK, sstep(0.62, 0.72, c) * 0.8, tmp);
      out[0] += (tmp[0] - out[0]) * landT;
      out[1] += (tmp[1] - out[1]) * landT;
      out[2] += (tmp[2] - out[2]) * landT;
    }
    // Polar ice (sea + land) with a noisy boundary.
    const ice = sstep(0.78, 0.86, lat + (fbm(u * 12, v * 6, 12, seed + 90, 3) - 0.5) * 0.12);
    if (ice > 0) lerp3(out, SNOW, ice, out);
  });
}

function generateEarthClouds() {
  const seed = 31;
  return makeTexture(512, 256, (u, v, out) => {
    const wx = fbm(u * 5, v * 2.5, 5, seed + 5, 3) - 0.5;
    const n = fbm(u * 8 + wx * 2.2, v * 4 + wx * 1.4, 8, seed, 5);
    // Slightly favour mid-latitude storm bands.
    const lat = Math.abs(0.5 - v) * 2;
    const belt = 0.75 + 0.25 * Math.cos(lat * Math.PI * 2.2);
    const a = sstep(0.52, 0.74, n) * belt;
    out[0] = 255; out[1] = 255; out[2] = 255;
    out[3] = Math.round(235 * a);
  });
}

function generateMars() {
  const seed = 12;
  const DARK = hex(0x6b3120);
  const MID = hex(0xb4502f);
  const LIGHT = hex(0xd98a5c);
  const ICE = hex(0xf0ece4);
  return makeTexture(512, 256, (u, v, out) => {
    const lat = Math.abs(0.5 - v) * 2;
    const t = fbm(u * 7, v * 3.5, 7, seed, 5);
    const dark = fbm(u * 4, v * 2, 4, seed + 21, 4); // big albedo provinces
    if (t < 0.5) lerp3(DARK, MID, t * 2, out);
    else lerp3(MID, LIGHT, (t - 0.5) * 2, out);
    const dm = sstep(0.58, 0.42, dark) * 0.55;
    lerp3(out, DARK, dm, out);
    // Polar ice caps; the southern cap is slightly larger.
    const capEdge = v < 0.5 ? 0.84 : 0.8;
    const ice = sstep(capEdge, capEdge + 0.06, lat + (fbm(u * 10, v * 5, 10, seed + 3, 3) - 0.5) * 0.1);
    if (ice > 0) lerp3(out, ICE, ice, out);
  });
}

function generateIo() {
  const seed = 44;
  const SULFUR = hex(0xd9c25e);
  const PALE = hex(0xf2ecc8);
  const ORANGE = hex(0xc97a2e);
  const tmp = [0, 0, 0];
  const tex = makeTexture(512, 256, (u, v, out) => {
    const t = fbm(u * 8, v * 4, 8, seed, 5);
    if (t < 0.5) lerp3(ORANGE, SULFUR, t * 2, out);
    else lerp3(SULFUR, PALE, (t - 0.5) * 2, out);
    // Volcanic hotspots: dark centre with a reddish halo ring.
    const hot = fbm(u * 16, v * 8, 16, seed + 9, 3);
    if (hot > 0.74) {
      const m = sstep(0.74, 0.82, hot);
      tmp[0] = 60; tmp[1] = 22; tmp[2] = 8;
      lerp3(out, tmp, m, out);
    } else if (hot > 0.66) {
      const m = sstep(0.66, 0.74, hot) * 0.6;
      tmp[0] = 160; tmp[1] = 60; tmp[2] = 16;
      lerp3(out, tmp, m, out);
    }
  });
  return tex;
}

function generateEuropa() {
  const seed = 52;
  const ICE = hex(0xe8e2d4);
  const TAN = hex(0xcbb89c);
  const CRACK = hex(0x9c5a3c);
  return makeTexture(512, 256, (u, v, out) => {
    const t = fbm(u * 5, v * 2.5, 5, seed, 4);
    lerp3(ICE, TAN, sstep(0.35, 0.7, t) * 0.5, out);
    // Lineae: two scales of ridged-noise filaments.
    const c1 = ridged(u * 6, v * 3, 6, seed + 7, 4);
    const c2 = ridged(u * 12, v * 6, 12, seed + 13, 3);
    const crack = Math.max(sstep(0.075, 0.0, c1), sstep(0.06, 0.0, c2) * 0.7);
    if (crack > 0) lerp3(out, CRACK, crack * 0.65, out);
  });
}

function generateTriton() {
  const seed = 61;
  const PINK = hex(0xe3cfc4);
  const GREY = hex(0xb9aca6);
  const CAP = hex(0xf3e9e2);
  return makeTexture(512, 256, (u, v, out) => {
    // "Cantaloupe terrain": high-frequency bumpy mottling.
    const t = fbm(u * 14, v * 7, 14, seed, 4);
    lerp3(GREY, PINK, sstep(0.3, 0.7, t), out);
    const cap = sstep(0.55, 0.75, (v - 0.5) * 2 + (fbm(u * 8, v * 4, 8, seed + 5, 3) - 0.5) * 0.2);
    if (cap > 0) lerp3(out, CAP, cap, out); // southern nitrogen-ice cap
  });
}

function generatePluto() {
  const seed = 73;
  const DARK = hex(0x6b4a33);
  const MID = hex(0xc9a583);
  const HEART = hex(0xefe3d3);
  return makeTexture(512, 256, (u, v, out) => {
    const t = fbm(u * 6, v * 3, 6, seed, 5);
    if (t < 0.5) lerp3(DARK, MID, t * 2, out);
    else lerp3(MID, HEART, (t - 0.5) * 2 * 0.6, out);
    // Sputnik Planitia: a bright heart-ish lobe near the equator.
    let du = Math.abs(u - 0.55);
    if (du > 0.5) du = 1 - du;
    const dv = (v - 0.55) * 1.6;
    const e = (du / 0.13) ** 2 + (dv / 0.18) ** 2 + (fbm(u * 10, v * 5, 10, seed + 4, 3) - 0.5) * 0.7;
    if (e < 1) lerp3(out, HEART, smooth01(1 - Math.max(0, e)) * 0.9, out);
  });
}

/* ------------------------------------------------------------------ */
/* Sun                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Sun data texture (linear, not sRGB): R = fine granulation, G = large-scale
 * mottling. The Sun shader animates and colour-ramps these channels.
 */
function generateSunTexture() {
  const seed = 5;
  return makeTexture(
    512, 256,
    (u, v, out) => {
      const g1 = fbm(u * 28, v * 14, 28, seed, 5);
      const r1 = 1 - ridged(u * 20, v * 10, 20, seed + 8, 4);
      const fine = clamp01(g1 * 0.55 + r1 * 0.55 - 0.05);
      const large = fbm(u * 6, v * 3, 6, seed + 40, 3);
      out[0] = Math.round(255 * fine);
      out[1] = Math.round(255 * large);
      out[2] = 0;
    },
    { colorSpace: THREE.NoColorSpace, wrapT: THREE.RepeatWrapping },
  );
}

/* ------------------------------------------------------------------ */
/* Ring systems                                                        */
/* ------------------------------------------------------------------ */

/**
 * 1D radial ring profile baked into a (w x 16) strip. u = 0 inner edge,
 * u = 1 outer edge. `gaps` carve smooth notches; `ringlets` add narrow
 * bright bands (for the sparse Uranus/Neptune systems).
 */
function generateRingTexture({
  seed, baseColor, w = 1024,
  baseAlpha = 0.85, noiseAmp = 0.4,
  gaps = [], ringlets = [], innerFade = 0.06, outerFade = 0.93,
}) {
  const cBase = hex(baseColor);
  // Precompute per-column profile.
  const alphaRow = new Float32Array(w);
  const brightRow = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const t = (x + 0.5) / w;
    let a = baseAlpha * (1 - noiseAmp / 2 + noiseAmp * fbm(t * 48, 0.5, 48, seed, 4));
    for (const g of gaps) {
      const k = Math.exp(-(((t - g.center) / g.width) ** 2));
      a *= 1 - g.depth * k;
    }
    let ringlet = 0;
    for (const r of ringlets) {
      ringlet = Math.max(ringlet, r.alpha * Math.exp(-(((t - r.center) / r.width) ** 2)));
    }
    a = Math.max(a, ringlet);
    a *= sstep(0, innerFade, t) * sstep(1, outerFade, t);
    alphaRow[x] = clamp01(a);
    brightRow[x] = 0.82 + 0.3 * fbm(t * 23, 1.5, 23, seed + 9, 3);
  }
  return makeTexture(w, 16, (u, v, out) => {
    const x = Math.floor(u * w);
    out[0] = Math.min(255, cBase[0] * brightRow[x]);
    out[1] = Math.min(255, cBase[1] * brightRow[x]);
    out[2] = Math.min(255, cBase[2] * brightRow[x]);
    out[3] = Math.round(255 * alphaRow[x]);
  });
}

/* ------------------------------------------------------------------ */
/* Glow sprites                                                        */
/* ------------------------------------------------------------------ */

/** Radial-gradient sprite used for the Sun corona and Milky Way haze. */
function generateGlowTexture(stops) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, color] of stops) grad.addColorStop(t, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Public factory                                                      */
/* ------------------------------------------------------------------ */

/**
 * Generate every texture the scene needs. Async: yields to the browser
 * between bodies so the loading overlay can update its status line.
 */
export async function createTextureSet(onProgress = () => {}) {
  const next = (label) => {
    onProgress(label);
    return new Promise((r) => setTimeout(r, 0));
  };
  const set = {};

  await next('SUN');
  set.sun = generateSunTexture();
  set.corona = generateGlowTexture([
    [0.0, 'rgba(255,255,255,1)'],
    [0.12, 'rgba(255,228,170,0.85)'],
    [0.3, 'rgba(255,160,60,0.32)'],
    [0.6, 'rgba(255,110,30,0.08)'],
    [1.0, 'rgba(255,80,20,0)'],
  ]);
  set.softGlow = generateGlowTexture([
    [0.0, 'rgba(255,255,255,0.9)'],
    [0.4, 'rgba(220,228,255,0.35)'],
    [1.0, 'rgba(200,210,255,0)'],
  ]);

  await next('MERCURY');
  set.mercury = generateCratered({
    seed: 3, dark: 0x4f4a45, base: 0x847d75, light: 0xb3aca2,
    craterCount: 170, craterMax: 26, contrast: 1.1,
  });

  await next('VENUS');
  set.venus = generateBanded({
    seed: 9,
    stops: [
      [0.0, 0xd9c177], [0.22, 0xeadfb4], [0.4, 0xd8c389], [0.55, 0xf0e8c8],
      [0.72, 0xdcc88f], [0.9, 0xe8dcae], [1.0, 0xd5bf7c],
    ],
    turb: 0.2, streakAmp: 0.05, detailAmp: 0.05,
  });

  await next('EARTH');
  set.earth = generateEarth();
  set.earthClouds = generateEarthClouds();

  await next('THE MOON');
  set.moon = generateCratered({
    seed: 17, dark: 0x5d5b58, base: 0x969390, light: 0xc4c1bd,
    craterCount: 200, craterMax: 22, contrast: 0.95,
  });

  await next('MARS');
  set.mars = generateMars();
  set.phobos = generateCratered({
    seed: 23, dark: 0x4a423c, base: 0x6f655c, light: 0x948a7e,
    w: 256, h: 128, craterCount: 60, craterMax: 30, contrast: 1.2,
  });
  set.deimos = generateCratered({
    seed: 29, dark: 0x564e46, base: 0x7d7268, light: 0xa3988b,
    w: 256, h: 128, craterCount: 40, craterMax: 22, contrast: 1.0,
  });

  await next('JUPITER');
  set.jupiter = generateBanded({
    seed: 1,
    stops: [
      [0.0, 0xa8946f], [0.07, 0xd8c3a3], [0.15, 0xa87d52], [0.24, 0xe8dabd],
      [0.32, 0xc99868], [0.4, 0xf0e6cf], [0.47, 0xd6b58e], [0.56, 0xa9743f],
      [0.64, 0xe6d3b3], [0.74, 0xb98e62], [0.85, 0xd9c4a4], [1.0, 0xbfa37d],
    ],
    turb: 0.05, streakAmp: 0.02, detailAmp: 0.12,
    spots: [{ u: 0.72, v: 0.66, rx: 0.055, ry: 0.042, color: 0xb73e2a, strength: 0.85 }],
  });

  await next('GALILEAN MOONS');
  set.io = generateIo();
  set.europa = generateEuropa();
  set.ganymede = generateCratered({
    seed: 37, dark: 0x6d6258, base: 0x968a7c, light: 0xc2b6a6,
    craterCount: 120, craterMax: 18, contrast: 0.9,
  });
  set.callisto = generateCratered({
    seed: 41, dark: 0x4a4138, base: 0x6e6253, light: 0xa89a82,
    craterCount: 220, craterMax: 20, contrast: 1.15,
  });

  await next('SATURN');
  set.saturn = generateBanded({
    seed: 2,
    stops: [
      [0.0, 0xb3995f], [0.15, 0xd9c694], [0.3, 0xc4ab72], [0.45, 0xe8daad],
      [0.6, 0xd2bb84], [0.75, 0xe3d3a2], [0.9, 0xc6ad77], [1.0, 0xb59c63],
    ],
    turb: 0.025, detailAmp: 0.05,
  });
  set.saturnRing = generateRingTexture({
    seed: 4, baseColor: 0xd8c5a0,
    gaps: [
      { center: 0.62, width: 0.025, depth: 0.95 }, // Cassini division
      { center: 0.93, width: 0.008, depth: 0.85 }, // Encke gap
      { center: 0.18, width: 0.05, depth: 0.45 },  // C-ring translucency
    ],
  });
  set.titan = generateBanded({
    seed: 47, w: 512, h: 256,
    stops: [[0.0, 0xb5762e], [0.35, 0xd8a04f], [0.65, 0xe0ad5c], [1.0, 0xc08438]],
    turb: 0.12, detailAmp: 0.04,
  });

  await next('URANUS');
  set.uranus = generateBanded({
    seed: 6, w: 512, h: 256,
    stops: [[0.0, 0x9fd3da], [0.4, 0xaee1e6], [0.6, 0xa5dce2], [1.0, 0x93cdd6]],
    turb: 0.06, detailAmp: 0.02,
  });
  set.uranusRing = generateRingTexture({
    seed: 8, baseColor: 0x9aacb3, baseAlpha: 0.0, noiseAmp: 0,
    ringlets: [
      { center: 0.18, width: 0.012, alpha: 0.35 },
      { center: 0.34, width: 0.01, alpha: 0.3 },
      { center: 0.52, width: 0.014, alpha: 0.4 },
      { center: 0.72, width: 0.012, alpha: 0.35 },
      { center: 0.92, width: 0.025, alpha: 0.6 }, // epsilon ring
    ],
  });

  await next('NEPTUNE');
  set.neptune = generateBanded({
    seed: 14, w: 512, h: 256,
    stops: [
      [0.0, 0x2440b8], [0.25, 0x3a66e8], [0.45, 0x2e51cf], [0.65, 0x4673ee],
      [0.85, 0x2b49c2], [1.0, 0x1f38a8],
    ],
    turb: 0.07, streakAmp: 0.03, detailAmp: 0.09,
    spots: [{ u: 0.4, v: 0.62, rx: 0.05, ry: 0.038, color: 0x16259e, strength: 0.75 }],
  });
  set.neptuneRing = generateRingTexture({
    seed: 16, baseColor: 0x968d85, baseAlpha: 0.08, noiseAmp: 0.5,
    ringlets: [
      { center: 0.3, width: 0.012, alpha: 0.3 },
      { center: 0.62, width: 0.01, alpha: 0.25 },
      { center: 0.88, width: 0.015, alpha: 0.4 }, // Adams ring
    ],
  });
  set.triton = generateTriton();

  await next('PLUTO & CHARON');
  set.pluto = generatePluto();
  set.charon = generateCratered({
    seed: 83, dark: 0x57504c, base: 0x8a827c, light: 0xb5ada6,
    w: 256, h: 128, craterCount: 70, craterMax: 18, contrast: 0.9,
  });

  // Prefer high-resolution image-based planetary maps when online; keep the
  // generated textures as an offline fallback. Maps are from Solar System Scope
  // (CC BY 4.0), built from spacecraft/observatory imagery and NASA elevation data.
  const imageMaps = {
    mercury: '2k_mercury.jpg',
    venus: '2k_venus_surface.jpg',
    earth: '2k_earth_daymap.jpg',
    earthClouds: '2k_earth_clouds.jpg',
    moon: '2k_moon.jpg',
    mars: '2k_mars.jpg',
    jupiter: '2k_jupiter.jpg',
    saturn: '2k_saturn.jpg',
    uranus: '2k_uranus.jpg',
    neptune: '2k_neptune.jpg',
  };
  const loader = new THREE.TextureLoader();
  await Promise.all(Object.entries(imageMaps).map(([key, filename]) => new Promise((resolve) => {
    const timer = setTimeout(resolve, 4500);
    loader.load(
      `https://www.solarsystemscope.com/textures/download/${filename}`,
      (texture) => {
        clearTimeout(timer);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        const oldTexture = set[key];
        set[key] = texture;
        oldTexture?.dispose?.();
        resolve();
      },
      undefined,
      () => { clearTimeout(timer); resolve(); },
    );
  })));

  return set;
}
