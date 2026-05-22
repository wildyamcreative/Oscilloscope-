// Single source of truth for every tweakable value in the visualizer.
// The GUI binds directly to this object; presets are just snapshots of it.

export const defaultParams = {
  // Text / model
  text: 'HELLO',
  voxelRes: 16,
  depthLayers: 2,

  // Beam / glow
  color: '#39ff7a',
  glowStrength: 1.5,
  glowRadius: 0.6,
  glowThreshold: 0.0,
  lineOpacity: 0.95,

  // Motion
  autoRotate: true,
  rotX: 0.0,
  rotY: 0.18,
  rotZ: 0.0,
  waveAmp: 0.4,
  waveFreq: 0.35,
  waveSpeed: 1.2,

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
  noise: 0.05,
  phosphorPersistence: 0.55,
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
    waveAmp: 0.15,
    waveFreq: 0.2,
    scanIntensity: 0.25,
    noise: 0.04,
    flicker: 0.03,
    phosphorPersistence: 0.4,
    rotY: 0.1,
  },

  'Heavy Glitch': {
    glitchAmount: 0.65,
    rgbSplit: 0.7,
    block: 0.6,
    jitter: 0.5,
    scanJump: 0.4,
    waveAmp: 0.9,
    waveFreq: 0.6,
    waveSpeed: 2.4,
    noise: 0.25,
    flicker: 0.18,
    glowStrength: 2.1,
    phosphorPersistence: 0.6,
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
    waveAmp: 0.5,
    waveFreq: 0.5,
    waveSpeed: 1.6,
    scanIntensity: 0.5,
    scanCount: 1100,
    curvature: 0.08,
    vignette: 0.3,
    noise: 0.06,
    flicker: 0.05,
    glowStrength: 2.4,
    glowRadius: 0.9,
    color: '#46f0ff',
    phosphorPersistence: 0.5,
    rotY: 0.28,
  },
};

export function clonedDefaults() {
  return structuredClone(defaultParams);
}
