import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

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
  ctx.font = fontSpec; // resizing the canvas resets the context
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
// Shared edges are de-duplicated so overlapping cubes don't double-brighten.
// Returns a flat array of line-segment endpoint positions.
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
      const ox = cx;
      const oy = -cy; // flip Y so text isn't upside-down
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

// Center positions in place and return the bounding-sphere radius (used for
// camera framing, since instanced line geometry has no standard bbox).
function centerPositions(positions) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]); maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]); maxY = Math.max(maxY, positions[i + 1]);
    minZ = Math.min(minZ, positions[i + 2]); maxZ = Math.max(maxZ, positions[i + 2]);
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] -= cx; positions[i + 1] -= cy; positions[i + 2] -= cz;
  }
  const dx = (maxX - minX) / 2, dy = (maxY - minY) / 2, dz = (maxZ - minZ) / 2;
  return Math.max(0.001, Math.sqrt(dx * dx + dy * dy + dz * dz));
}

// Builds the glowing-green 3D wireframe block-letter model from thick lines.
export function buildTextModel({ text, voxelRes, depthLayers, color, opacity, lineWidth, resolution }) {
  const { cells } = sampleGlyphGrid(text || ' ', voxelRes);
  const positions = buildPositionsFromCells(cells, depthLayers);
  const radius = centerPositions(positions);

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);

  const material = new LineMaterial({
    color: new THREE.Color(color),
    linewidth: lineWidth, // in pixels (worldUnits: false)
    worldUnits: false,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  material.resolution.set(resolution.x, resolution.y);

  const lines = new LineSegments2(geometry, material);
  lines.name = 'beam';
  lines.frustumCulled = false;
  lines.userData.boundingRadius = radius;
  return lines;
}
