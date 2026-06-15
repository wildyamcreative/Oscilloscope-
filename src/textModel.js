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

// Downsample an image into a grid and return per-cell brightness/alpha/color so
// callers can turn it into a 3D relief hologram.
function sampleImageGrid(image, maxCells) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const aspect = iw / ih;
  let gw, gh;
  if (aspect >= 1) {
    gw = maxCells;
    gh = Math.max(1, Math.round(maxCells / aspect));
  } else {
    gh = maxCells;
    gw = Math.max(1, Math.round(maxCells * aspect));
  }

  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, gw, gh);
  const data = ctx.getImageData(0, 0, gw, gh).data;

  const cells = [];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = (y * gw + x) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const alpha = data[i + 3] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      cells.push({ x, y, lum, alpha, r, g, b });
    }
  }
  return { cells, gw, gh };
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

// Append the 12 edges of a unit cube at origin (ox,oy,oz) into `positions`,
// de-duplicating shared edges via `seen` so overlapping cubes don't double up.
// When `colors` is provided, an RGB triple is pushed per emitted vertex.
function addCubeEdges(positions, seen, ox, oy, oz, colors, rgb) {
  const addEdge = (ax, ay, az, bx, by, bz) => {
    const key =
      ax <= bx && ay <= by && az <= bz
        ? `${ax},${ay},${az}_${bx},${by},${bz}`
        : `${bx},${by},${bz}_${ax},${ay},${az}`;
    if (seen.has(key)) return;
    seen.add(key);
    positions.push(ax, ay, az, bx, by, bz);
    if (colors) {
      colors.push(rgb[0], rgb[1], rgb[2], rgb[0], rgb[1], rgb[2]);
    }
  };
  for (const [a, b] of CUBE_EDGES) {
    const ca = CORNERS[a];
    const cb = CORNERS[b];
    addEdge(
      ox + ca[0], oy + ca[1], oz + ca[2],
      ox + cb[0], oy + cb[1], oz + cb[2]
    );
  }
}

// Build line-segment endpoint positions from a list of voxels. Each voxel is
// { x, y, depth, color? }; the cube is stacked `depth` layers deep in Z. Y is
// flipped so the source grid isn't upside-down. Optionally accumulates a
// parallel per-vertex color array. Returns { positions, colors }.
export function buildPositionsFromVoxels(voxels) {
  const seen = new Set();
  const positions = [];
  const wantColors = voxels.length > 0 && !!voxels[0].color;
  const colors = wantColors ? [] : null;

  for (const v of voxels) {
    const layers = Math.max(1, Math.round(v.depth));
    for (let z = 0; z < layers; z++) {
      addCubeEdges(positions, seen, v.x, -v.y, z, colors, v.color);
    }
  }
  return { positions, colors };
}

// Back-compat / unit-testable helper: uniform-depth cubes from [x,y] cells.
export function buildPositionsFromCells(cells, depthLayers) {
  const voxels = cells.map(([x, y]) => ({ x, y, depth: depthLayers }));
  return buildPositionsFromVoxels(voxels).positions;
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

// Shared assembly: turn positions (+ optional vertex colors) into the glowing
// LineSegments2 beam object the rest of the app expects.
function assembleBeam(positions, colors, { color, opacity, lineWidth, resolution }) {
  const radius = centerPositions(positions);

  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  if (colors) geometry.setColors(colors);

  const material = new LineMaterial({
    color: colors ? 0xffffff : new THREE.Color(color),
    vertexColors: !!colors,
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
  lines.userData.useVertexColors = !!colors;
  return lines;
}

// Builds the glowing 3D wireframe block-letter model from thick lines.
export function buildTextModel({ text, voxelRes, depthLayers, color, opacity, lineWidth, resolution }) {
  const { cells } = sampleGlyphGrid(text || ' ', voxelRes);
  const voxels = cells.map(([x, y]) => ({ x, y, depth: depthLayers }));
  const { positions } = buildPositionsFromVoxels(voxels);
  return assembleBeam(positions, null, { color, opacity, lineWidth, resolution });
}

// Builds a 3D brightness-relief hologram from an already-loaded image: brighter
// pixels extrude further toward the viewer. Optionally keeps the image colors.
export function buildImageModel({
  image, imageRes, imageDepth, imageThreshold, imageInvert, imageColor,
  color, opacity, lineWidth, resolution,
}) {
  const { cells } = sampleImageGrid(image, Math.round(imageRes));
  const maxDepth = Math.max(1, Math.round(imageDepth));
  const voxels = [];

  for (const c of cells) {
    if (c.alpha < 0.15) continue; // skip transparent pixels
    const brightness = imageInvert ? 1 - c.lum : c.lum;
    if (brightness < imageThreshold) continue;
    // Map brightness above the threshold to 1..maxDepth relief layers.
    const t = (brightness - imageThreshold) / Math.max(0.001, 1 - imageThreshold);
    const depth = Math.max(1, Math.round(1 + t * (maxDepth - 1)));
    const voxel = { x: c.x, y: c.y, depth };
    if (imageColor) voxel.color = [c.r, c.g, c.b];
    voxels.push(voxel);
  }

  // Nothing passed the threshold — fall back to a single voxel so we don't
  // crash on an all-transparent/all-dark image.
  if (voxels.length === 0) voxels.push({ x: 0, y: 0, depth: 1 });

  const { positions, colors } = buildPositionsFromVoxels(voxels);
  return assembleBeam(positions, colors, { color, opacity, lineWidth, resolution });
}

// Load an image File/Blob into an HTMLImageElement, resolving once decoded.
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}
