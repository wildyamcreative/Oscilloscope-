# Oscilloscope-

Virtual oscilloscope visualizer: type text and it becomes a glowing-green 3D
wireframe model on a CRT tube, with live sliders to spin, distort, glitch and
"break up" the signal.

## Run it

```bash
npm install
npm run dev      # open the printed http://localhost:5173 URL
```

```bash
npm run build    # production build into dist/
npm run preview  # serve the production build
```

## Controls

A panel (top-right) groups every knob:

- **Text** — input string, glyph size, 3D extrusion depth, font.
- **Beam / Glow** — beam color, glow strength/radius/threshold, line opacity.
- **Motion** — auto-rotate + X/Y/Z spin speeds, and a signal "wave" wobble
  (amplitude / frequency / speed). Drag on the screen to tumble the model by
  hand.
- **Glitch** — master amount, chromatic RGB split, horizontal block
  displacement, jitter, and vertical scan-jump.
- **CRT** — scanlines (intensity + density), screen curvature, vignette,
  flicker, static noise, and phosphor persistence (afterglow trails).
- **Presets & Capture** — `Default / Calm Signal / Heavy Glitch / Broken Tube /
  Hologram` presets, save/load to the browser, export/import JSON, screenshot
  to PNG, and reset.

## How it works

Built with **Vite** + **Three.js**. Text is extruded into a `TextGeometry`,
converted to edge lines (`EdgesGeometry` → `LineSegments`) for the wireframe,
and pushed through a post-processing chain: phosphor persistence
(`AfterimagePass`) → glow (`UnrealBloomPass`) → glitch shader → CRT shader.
A vertex shader on the beam adds the live wave/jitter signal wobble.
