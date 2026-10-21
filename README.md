# PJMC Solar System Explorer

**GitHub Pages:** <https://xivam-jha.github.io/pjmc_solar_system/>

An interactive browser-based 3D Solar System Explorer built with [three.js](https://threejs.org/) and Vite for Pawan Jha Mathematics Classes, Sukhpur.
**Every texture and visual effect is generated procedurally at runtime** (seeded value
noise on 2D canvases plus custom shaders), so the app has zero downloaded assets, works
fully offline, and has no asset-licensing concerns.

![tech](https://img.shields.io/badge/three.js-r184-049EF4) ![tech](https://img.shields.io/badge/vite-8-646CFF)

## Install & run

```bash
npm install
npm run dev      # dev server (default: http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # serve the production build
```

Requires Node.js ≥ 20.19 (any recent LTS).

## What's in the scene

- **The Sun** — animated procedural granulation with limb darkening, additive corona
  sprites, and Unreal-bloom glow.
- **All 8 planets + Pluto/Charon** — each with a distinct procedural texture: craters
  (Mercury, the Moon, Callisto, …), warped cloud bands and the Great Red Spot (Jupiter),
  continents/oceans/ice/clouds and a fresnel atmosphere (Earth), polar caps (Mars),
  retrograde spins (Venus, Uranus, Pluto — via their real >90° axial tilts), and so on.
- **13 moons** — the Moon, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Titan,
  Triton (retrograde orbit), Charon. All tidally locked (synchronous rotation).
- **Ring systems** — Saturn (with Cassini division and Encke gap), plus faint Uranus and
  Neptune rings. Saturn has *analytic* two-way shadows: the planet shades the rings and
  the rings shade the planet (computed in shaders, no shadow maps — see Decisions).
- **Asteroid belt** — 4,500 instanced rocks between Mars and Jupiter, each on its own
  Keplerian orbit (period ∝ a^1.5), so the belt shears differentially over time.
- **Starfield** — ~9,000 additive point stars with varied size/brightness/colour
  temperature, concentrated along an inclined Milky Way band with faint haze sprites.

## PJMC branding and extra controls

- **Large 3D PJMC arch:** the word “PJMC” is laid out once along an in-world semicircle high above the system, with a smaller “SOLAR SYSTEM” line. It is not a screen-fixed overlay: zooming in naturally crops it, while Reset View frames the complete arc and planetary system.
- **Brand surfaces:** PJMC branding appears on the loading screen, top bar, body information panel, footer, browser title and favicon.
- **Search:** search body names in English or Hindi; choose a result to focus and follow that body.
- **Language toggle:** switch the interface, body names and information facts between English and Hindi.
- **Clock:** the simulation readout is formatted in India Standard Time (IST). Major-planet positions use an educational Kepler solution based on JPL approximate elements; moon paths remain visual circular approximations. This is not a precision live ephemeris.

## Controls

| Action | How |
|---|---|
| Orbit / pan / zoom | Mouse drag / right-drag / wheel (touch: drag / pinch) |
| Focus & follow a body | Click it in 3D, click its floating label, or use the BODIES list |
| Free camera | Click empty space, or the FREE CAM button |
| Default overview | RESET VIEW |
| Time | Play/pause + presets: real time, 1 hr/s, 1 day/s, 1 month/s, 1 year/s |
| Jump to the present | ● NOW (returns the clock to the current time and real-time speed) |
| Scale | VISUALIZATION ↔ TRUE SCALE (animated transition) |
| Clutter | ORBITS and LABELS toggles |
| Search | Search a planet or moon; Enter selects the first match |
| Language | Use the हिंदी / ENGLISH button |

The simulated date is shown in the bottom bar. The info panel (name, type, diameter,
distance, periods, tilt, moons, and a fact) opens whenever a body is selected.

## Scale strategy

Real proportions make the planets invisible (the Sun is 0.28 units wide against a
1,800-unit Neptune orbit at this app's true scale), so two independent scale mappings
are used, blended by an animated `mix` parameter:

- **Visualization scale (default)** — power-law compression chosen so all bodies stay
  recognizable and all orbits fit in one view without overlapping:
  - body radius = `0.9 · (diameter / d_earth)^0.45` units (clamped to a 0.14 minimum for
    tiny moons like Phobos/Deimos)
  - orbit radius = `11 + 16 · AU^0.65` units (Mercury ≈ 20, Neptune ≈ 157)
  - moon orbits = parent's display radius × a hand-picked factor (2.1–4.9) so satellite
    systems sit outside ring systems and inside neighbouring orbits
- **True scale** — 1 AU = 60 units, all diameters and distances proportional (planets
  become labelled dots; the clickable labels are how you find them). Moon distances use
  their real semi-major axes.

Because sizes/distances are resolved through scale functions *every frame*, toggling
scale simply tweens `mix` — bodies, orbits, rings, moons, the PJMC arch and the asteroid
belt all re-project smoothly. The major planets use an approximate Kepler solution and
JPL J2000 orbital elements/rates; moons keep their circular visual orbits. This is an
educational position model, not a full precision ephemeris. See [NASA/JPL's Approximate
Positions of the Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html).

## Engineering decisions & simplifications

- **Approximate Keplerian orbits for major planets.** The 8 planets use JPL
  approximate orbital elements/rates and elliptical paths; Pluto uses static
  approximate elements. The displayed size/distance visualization scale is still
  compressed, and satellite orbits are circular visual approximations.
- **Moons orbit in their parent's equatorial plane** (the moon containers live inside
  the axial-tilt group). This is physically right for the big moons of Jupiter, Saturn
  and Uranus — Uranus's moons correctly orbit "vertically" — and a small approximation
  for Earth's Moon (5° off the ecliptic in reality).
- **Retrograde handling.** Venus (177.4°), Uranus (97.8°) and Pluto (122.5°) spin
  retrograde *because of their real axial tilts* rather than a sign flag; Triton's
  retrograde orbit uses a negative orbital period.
- **No shadow maps.** A point-light shadow cube over a scene that spans 5 orders of
  magnitude would be all aliasing. Saturn's ring/planet shadows are computed
  analytically in shaders (cylinder test for the planet's shadow on the rings; a
  ray-to-ring-plane test with the baked ring-alpha profile for the rings' shadow on the
  planet), which is exact, cheap, and works at every scale. Uranus/Neptune rings are too
  faint for shadows to matter; moon eclipse shadows are omitted.
- **Lighting** is one `PointLight` at the Sun with `decay = 0` (physical falloff would
  black out Neptune at true scale) plus low ambient so night sides stay readable.
- **Logarithmic depth buffer** to cover the huge near/far range (a 0.003-unit Phobos up
  to a 12,000-unit starfield) without z-fighting; all custom shaders include the
  log-depth chunks.
- **Bloom with graceful fallback.** The post-processing chain (EffectComposer →
  RenderPass → UnrealBloomPass → OutputPass) is imported dynamically; if anything fails,
  the app falls back to plain rendering — the Sun still glows via its emissive shader
  and additive corona sprites.
- **Asteroid sizes are exaggerated** (real belt rocks would be sub-pixel even at
  visualization scale) and the belt's vertical thickness scales with its radius.
- **Time at extreme speeds:** at 1 year/s the planets sweep their orbits faster than the
  camera-follow can keep a fixed phase angle, so a followed body may show its night
  side — slow time down to inspect a body (this matches NASA Eyes behaviour).
- **Texture generation takes ~1–2 s** on load (hundreds of thousands of per-pixel noise
  samples); it runs behind the loading overlay with per-body status updates. Textures
  wrap seamlessly in longitude because the noise lattice (and all domain-warp offsets)
  are periodic in x.
- **`chunkSizeWarningLimit` is raised to 1200 kB** in `vite.config.js`: three.js is a
  single ~600 kB library chunk and code-splitting it brings no benefit to a one-page
  WebGL app. This keeps `npm run build` warning-free without hiding real issues.
- **Sim clock starts at the real current date**, advances with the chosen multiplier,
  and is clamped to JavaScript's valid `Date` range (~year 275,000) at 1 yr/s.

## Project structure

```
solar-system/
├── index.html                       # static shell + loading overlay
├── vite.config.js
├── src/
│   ├── main.js                      # renderer, camera, sim clock, scales, focus/follow, picking
│   ├── styles.css                   # dark mission-control theme, responsive
│   ├── data/celestialBodies.js      # the data table driving everything
│   ├── objects/
│   │   ├── Sun.js                   # animated emissive shader + corona
│   │   ├── Planet.js                # reusable planet/moon class (recursion for moons)
│   │   ├── Rings.js                 # radial-UV ring mesh + analytic shadow shader
│   │   ├── Starfield.js             # custom point shader + Milky Way band
│   │   ├── BrandingArch.js          # world-space PJMC semicircular branding
│   │   └── AsteroidBelt.js          # InstancedMesh with per-rock Keplerian orbits
│   ├── textures/proceduralTextures.js  # seeded noise → canvas textures for every body
│   └── ui/
│       ├── hud.js                   # top bar, body list, time bar
│       ├── infoPanel.js             # selected-body data sheet
│       └── labels.js                # projected, clickable body labels
└── README.md
```

Planets and moons are instantiated in a loop from the data table — adding a body is a
data edit, not a code change.

## Performance

Measured ~60 fps in testing. Geometry is shared (unit spheres scaled per body), the
belt is a single instanced draw call, stars are one `Points` draw call, and per-frame
work is dominated by 4,500 instance matrix updates (~1 ms).


## GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` installs from `package-lock.json`, runs `npm run build`, then publishes the generated `dist/` folder. Keep the workflow under `.github/workflows/` and set Repository Settings → Pages → Source to **GitHub Actions**. Do not publish raw `src/` files directly.
