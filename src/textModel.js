import * as THREE from 'three';

// Uniforms shared by every line material we build. Keeping a single object lets
// the GUI/animation loop write here once and have rebuilt models pick it up.
export const beamUniforms = {
  uTime: { value: 0 },
  uWaveAmp: { value: 0.2 },
  uWaveFreq: { value: 0.35 },
  uWaveSpeed: { value: 1.2 },
  uJitter: { value: 0.0 },
};

function makeBeamMaterial(colorHex, opacity) {
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = beamUniforms.uTime;
    shader.uniforms.uWaveAmp = beamUniforms.uWaveAmp;
    shader.uniforms.uWaveFreq = beamUniforms.uWaveFreq;
    shader.uniforms.uWaveSpeed = beamUniforms.uWaveSpeed;
    shader.uniforms.uJitter = beamUniforms.uJitter;

    shader.vertexShader =
      `
      uniform float uTime;
      uniform float uWaveAmp;
      uniform float uWaveFreq;
      uniform float uWaveSpeed;
      uniform float uJitter;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      }
      ` + shader.vertexShader;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      // Beam riding a wobbling signal: sine displacement across the model.
      float ph = uTime * uWaveSpeed;
      transformed.y += sin(position.x * uWaveFreq + ph) * uWaveAmp;
      transformed.x += sin(position.y * uWaveFreq * 0.8 + ph * 1.3) * uWaveAmp * 0.5;
      transformed.z += cos(position.x * uWaveFreq * 0.6 + ph * 0.7) * uWaveAmp * 0.5;
      // Per-vertex jitter (signal noise / unstable trace).
      float n = hash(position + floor(uTime * 24.0));
      transformed += (vec3(hash(position.yzx + n), hash(position.zxy + n), n) - 0.5) * uJitter;
      `
    );
  };

  return material;
}

// Rasterize the text to a small canvas in a heavy/bold face, then read it back
// as a grid of filled cells -> one voxel per cell.
function sampleGlyphGrid(text, rows) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const fontPx = Math.max(6, Math.round(rows));
  const fontSpec = `900 ${fontPx}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;

  ctx.font = fontSpec;
  const metrics = ctx.measureText(text);
  const cols = Math.max(1, Math.ceil(metrics.width) + 2);
  const height = fontPx + 4;

  canvas.width = cols;
  canvas.height = height;
  // Resizing the canvas resets the context, so re-apply the font.
  ctx.font = fontSpec;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, cols, height);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, 1, height / 2);

  const data = ctx.getImageData(0, 0, cols, height).data;
  const cells = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < cols; x++) {
      // Red channel is enough (we drew white on black).
      if (data[(y * cols + x) * 4] > 128) cells.push([x, y]);
    }
  }
  return { cells, cols, rows: height };
}

const CORNERS = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
const CUBE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

// Pure geometry builder (no DOM / no WebGL, so it is unit-testable in Node):
// a unit cube at every filled voxel cell, stacked `depthLayers` deep in Z.
// Shared edges are de-duplicated so overlapping cubes don't double-brighten
// under additive blending. Returns a flat array of line-segment positions.
export function buildPositionsFromCells(cells, depthLayers) {
  const layers = Math.max(1, Math.round(depthLayers));
  const seen = new Set();
  const positions = [];

  const addEdge = (ax, ay, az, bx, by, bz) => {
    const key =
      ax <= bx && ay <= by && az <= bz
        ? `${ax},${ay},${az}_${bx},${by},${bz}`
        : `${bx},${by},${bz}_${ax},${ay},${az}`;
    if (seen.has(key)) return;
    seen.add(key);
    positions.push(ax, ay, az, bx, by, bz);
  };

  for (const [cx, cy] of cells) {
    for (let z = 0; z < layers; z++) {
      // Flip Y so text isn't upside-down; world origin handled by centering.
      const ox = cx;
      const oy = -cy;
      const oz = z;
      for (const [a, b] of CUBE_EDGES) {
        const ca = CORNERS[a];
        const cb = CORNERS[b];
        addEdge(
          ox + ca[0], oy + ca[1], oz + ca[2],
          ox + cb[0], oy + cb[1], oz + cb[2]
        );
      }
    }
  }
  return positions;
}

function buildVoxelGeometry(text, rows, depthLayers) {
  const { cells } = sampleGlyphGrid(text || ' ', rows);
  const positions = buildPositionsFromCells(cells, depthLayers);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.center();
  return geo;
}

// Builds the glowing-green 3D wireframe block-letter model.
export function buildTextModel({ text, voxelRes, depthLayers, color, opacity }) {
  const geometry = buildVoxelGeometry(text, voxelRes, depthLayers);
  const material = makeBeamMaterial(color, opacity);
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'beam';
  return lines;
}
