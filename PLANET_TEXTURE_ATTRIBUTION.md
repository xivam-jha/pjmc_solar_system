# Planet Texture Attribution

This project uses optional equirectangular planet maps from Solar System Scope, whose texture page states that its maps are based on NASA imagery/elevation data and spacecraft/observatory imagery. The map textures are distributed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**. Attribution is required when redistributing the maps.

- Official texture/download page: https://play.solarsystemscope.com/textures/
- License: https://creativecommons.org/licenses/by/4.0/
- NASA/JPL planetary map archive: https://space.jpl.nasa.gov/tmaps/

The app tries the official `play.solarsystemscope.com` download endpoint first, then alternate mirrors. Procedural maps remain as offline/error fallbacks. The Earth night map is displayed only on the night-side hemisphere; the Earth cloud map is treated as an opacity mask.

These are precomputed global maps, not live satellite imagery. Some planetary map areas are filled or tuned for visualization, and gas-giant atmospheric maps are representative maps rather than live weather.

Suggested credit in redistributed builds: **Planetary texture maps by Solar System Scope (solarsystemscope.com), CC BY 4.0; based on NASA imagery/elevation data.**
