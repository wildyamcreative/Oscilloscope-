import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// Uniforms shared by every line material we build. Keeping a single object lets
// the GUI/animation loop write here once and have rebuilt models pick it up.
export const beamUniforms = {
  uTime: { value: 0 },
  uWaveAmp: { value: 0.4 },
  uWaveFreq: { value: 0.35 },
  uWaveSpeed: { value: 1.2 },
  uJitter: { value: 0.0 },
};

const fontCache = new Map();
const loader = new FontLoader();

function loadFont(name) {
  if (fontCache.has(name)) return Promise.resolve(fontCache.get(name));
  return new Promise((resolve, reject) => {
    loader.load(
      `./fonts/${name}.typeface.json`,
      (font) => {
        fontCache.set(name, font);
        resolve(font);
      },
      undefined,
      reject
    );
  });
}

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

// Builds the glowing-green 3D wireframe: extruded text -> edge lines.
export async function buildTextModel({ text, size, depth, font, color, opacity }) {
  const loaded = await loadFont(font);

  const beveled = depth > 0.5;
  const textGeo = new TextGeometry(text || ' ', {
    font: loaded,
    size,
    depth,
    curveSegments: 6,
    bevelEnabled: beveled,
    bevelThickness: beveled ? depth * 0.15 : 0,
    bevelSize: beveled ? size * 0.02 : 0,
    bevelSegments: 2,
  });
  textGeo.center();

  const edges = new THREE.EdgesGeometry(textGeo, 25);
  textGeo.dispose();

  const material = makeBeamMaterial(color, opacity);
  const lines = new THREE.LineSegments(edges, material);
  lines.name = 'beam';
  return lines;
}
