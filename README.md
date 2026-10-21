# PJMC Sukhpur — Solar System Explorer

An interactive, procedural 3D Solar System built with **Three.js + Vite**. This version keeps the original procedural planet systems and adds a single 360-degree `PJMC SUKHPUR` background ring, a camera overview fitted around Pluto and the full ring, searchable celestial bodies, a Hindi/English interface, an IST clock, and elliptical Kepler-style orbit motion.

## Features

- **Sun and planetary system:** Mercury, Venus, Earth and Moon, Mars and Phobos/Deimos, Jupiter and Io/Europa/Ganymede/Callisto, Saturn and Titan, Uranus, Neptune and Triton, Pluto and Charon.
- **Procedural appearance:** planet, cloud, atmosphere and ring textures are generated locally in the browser; no external texture URLs are required.
- **Background starfield:** 9,000 star points, a Milky Way-like band, faint galactic haze, plus 4,500 instanced asteroid visuals.
- **PJMC SUKHPUR brand ring:** one instance of the phrase mapped around a complete 360-degree ring; transparent areas keep the starfield visible.
- **Fit-to-overview camera:** Reset View frames the full ring and the modeled system, including Pluto. The radius scales together in Visualization and True Scale modes.
- **Search and focus:** search by English or Hindi body name; press Enter or select a result to focus/follow it. Click a planet, moon, or visible label to open its information panel.
- **Camera controls:** orbit/rotate, zoom, pan, Free Cam and Reset View.
- **Scale modes:** Visualization Scale keeps the planets visible; True Scale uses physical diameter and semi-major-axis proportions, where small bodies will be extremely tiny.
- **Simulation controls:** pause/play, real time, accelerated time presets and a NOW button.
- **India time:** clock readout is formatted in the `Asia/Kolkata` time zone (IST). The default mode starts at real-time speed.
- **English / हिन्दी:** main controls, body list, selected-body information and body labels can be switched between English and Hindi.
- **Responsive interface:** desktop and mobile layouts.

## Important scientific note

This is an educational visualization, not a high-precision ephemeris. Planet positions use approximate fixed J2000 mean-longitude, eccentricity and perihelion values and solve Kepler's equation with average orbital periods. The model includes elliptical paths for the main planets and Pluto, but simplifies orbital orientation and does not calculate modern perturbations, precession, light-time, or current JPL Horizons ephemerides. The clock is real IST by default; faster simulation presets intentionally move the modeled date forward/backward faster.

## Run locally

Requirements: Node.js 22 (or a compatible supported Vite runtime) and npm.

```bash
npm ci
npm run dev
```

Build and preview the production site:

```bash
npm run build
npm run preview
```

Vite writes the production website into `dist/`. Do not publish the raw `src/` folder as the website's build output.

For GitHub Desktop upload steps in Hindi, see [`GITHUB_PUSH_HI.md`](./GITHUB_PUSH_HI.md).

## Deploy to GitHub Pages

The workflow is at `.github/workflows/deploy.yml`. On pushes to `main`, it installs the locked dependencies, builds the Vite app, uploads `dist/`, and deploys that artifact to GitHub Pages.

In **Repository → Settings → Pages**, set **Build and deployment → Source → GitHub Actions**. Then check the `Deploy Solar System Explorer to GitHub Pages` workflow under the Actions tab. Do not use `Deploy from a branch` at the same time for the published website; that can publish the unbuilt `index.html` and make `/src/main.js` return 404.

## Controls

- **Visualization / True Scale:** switches between presentation scale and proportional physical sizes/distances.
- **Search:** type an English or Hindi name; Enter selects the first match.
- **Click / body list / label:** focus a body and open its details.
- **Free Cam:** stop following a selected body and resume free camera controls.
- **Reset View:** return to the overview that includes the full `PJMC SUKHPUR` ring.
- **Orbits / Labels:** show or hide the orbit paths and floating planet labels.
- **NOW:** return the simulation date to the current date/time, then continue at real-time speed.

## Project structure

```text
src/
  data/celestialBodies.js       # orbital/body data
  objects/                      # Sun, planet, rings, asteroids, starfield, PJMC ring
  textures/proceduralTextures.js# locally generated textures
  ui/hud.js                     # controls, search, bilingual UI
  ui/i18n.js                    # English/Hindi strings and facts
  ui/infoPanel.js               # selected-body facts
  ui/labels.js                  # projected/clickable labels
  main.js                       # renderer, scene, camera and simulation
  styles.css                    # responsive mission-control UI
```
