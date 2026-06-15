// Single source of truth for every tweakable value in the visualizer.
// The GUI binds directly to this object; presets are just snapshots of it.

export const defaultParams = {
  // Source: 'text' renders the typed string; 'image' renders an uploaded image
  // as a 3D brightness-relief hologram. Switched automatically when an image
  // is loaded, and selectable in the GUI.
  mode: 'text',

  // Text / model
  text: 'HELLO',
  voxelRes: 8,
  depthLayers: 2,

  // Image hologram
  imageRes: 64, // grid resolution along the longest edge
  imageDepth: 6, // max cube layers for the brightest pixels (relief height)
  imageThreshold: 0.2, // brightness cutoff below which pixels are skipped
  imageInvert: false, // build from dark areas instead of bright
  imageColor: false, // sample original image colors instead of the beam color

  // Beam / glow
  color: '#39ff7a',
  lineWidth: 2.0,
  glowStrength: 0.25,
  glowRadius: 0.0,
  glowThreshold: 0.3,
  lineOpacity: 1.0,

  // Motion
  autoRotate: true,
  rotX: 0.05,
  rotY: 0.18,
  rotZ: 0.0,

  // Glitch
  glitchAmount: 0.0,
  rgbSplit: 0.0,
  block: 0.0,
  jitter: 0.0,
  scanJump: 0.0,

  // CRT
  scanIntensity: 0.35,
  scanCount: 700,
  curvature: 0.18,
  vignette: 0.45,
  flicker: 0.04,
  noise: 0.04,
  phosphorPersistence: 0.0,
};

// Named presets. Each is a partial override merged over defaultParams when
// selected, so presets only need to list what makes them distinct.
export const presets = {
  Default: {},

  'Calm Signal': {
    glitchAmount: 0.0,
    rgbSplit: 0.0,
    block: 0.0,
    jitter: 0.0,
    scanJump: 0.0,
    scanIntensity: 0.25,
    noise: 0.04,
    flicker: 0.03,
    phosphorPersistence: 0.3,
    rotY: 0.1,
  },

  'Heavy Glitch': {
    glitchAmount: 0.65,
    rgbSplit: 0.7,
    block: 0.6,
    jitter: 0.5,
    scanJump: 0.4,
    noise: 0.25,
    flicker: 0.18,
    glowStrength: 1.6,
    phosphorPersistence: 0.45,
  },

  'Broken Tube': {
    glitchAmount: 0.35,
    rgbSplit: 0.25,
    block: 0.15,
    jitter: 0.9,
    scanJump: 0.85,
    flicker: 0.45,
    noise: 0.4,
    curvature: 0.32,
    vignette: 0.7,
    scanIntensity: 0.6,
    glowStrength: 1.1,
    phosphorPersistence: 0.75,
    color: '#2fe06a',
  },

  Hologram: {
    glitchAmount: 0.12,
    rgbSplit: 0.4,
    block: 0.0,
    jitter: 0.1,
    scanJump: 0.05,
    scanIntensity: 0.5,
    scanCount: 1100,
    curvature: 0.08,
    vignette: 0.3,
    noise: 0.06,
    flicker: 0.05,
    glowStrength: 1.8,
    glowRadius: 0.7,
    color: '#46f0ff',
    phosphorPersistence: 0.35,
    rotY: 0.28,
  },
};

export function clonedDefaults() {
  return structuredClone(defaultParams);
}
