import * as THREE from 'three';
import { createScene } from './scene.js';
import { createComposer } from './postprocessing.js';
import { buildTextModel, buildImageModel } from './textModel.js';
import { buildGUI } from './controls.js';
import { defaultParams, clonedDefaults } from './params.js';

const canvas = document.getElementById('scope');
const { renderer, scene, camera, controls } = createScene(canvas);
const post = createComposer(renderer, scene, camera);

// Mutable live state, seeded from defaults.
const params = clonedDefaults();
let beam = null;
// The currently loaded image element (when in image/hologram mode).
let sourceImage = null;

// Position the camera so the whole model fits the current viewport (handles
// tall phone screens, where horizontal field of view is the tight dimension).
function frameCamera(object) {
  const r = Math.max(object.userData.boundingRadius || 1, 0.001);
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const dist = (r / Math.sin(Math.min(vFov, hFov) / 2)) * 1.25;
  camera.position.set(0, 0, dist);
  camera.near = Math.max(dist / 100, 0.01);
  camera.far = dist * 100;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}

// Push every visual param into its uniform / object target. Called on any GUI
// change and whenever a preset is applied so the screen always matches params.
function applyParams() {
  // Beam material (color/opacity/thickness) on the current model. Skip the
  // color when the model carries its own per-vertex (image) colors.
  if (beam) {
    if (!beam.userData.useVertexColors) beam.material.color.set(params.color);
    beam.material.opacity = params.lineOpacity;
    beam.material.linewidth = params.lineWidth;
  }

  // Glow.
  post.bloom.strength = params.glowStrength;
  post.bloom.radius = params.glowRadius;
  post.bloom.threshold = params.glowThreshold;

  // Phosphor persistence.
  post.afterimage.uniforms.damp.value = params.phosphorPersistence;

  // Glitch.
  post.glitch.uniforms.uAmount.value = params.glitchAmount;
  post.glitch.uniforms.uRgbSplit.value = params.rgbSplit;
  post.glitch.uniforms.uBlock.value = params.block;
  post.glitch.uniforms.uJitter.value = params.jitter;
  post.glitch.uniforms.uScanJump.value = params.scanJump;

  // CRT.
  post.crt.uniforms.uScanIntensity.value = params.scanIntensity;
  post.crt.uniforms.uScanCount.value = params.scanCount;
  post.crt.uniforms.uCurvature.value = params.curvature;
  post.crt.uniforms.uVignette.value = params.vignette;
  post.crt.uniforms.uFlicker.value = params.flicker;
  post.crt.uniforms.uNoise.value = params.noise;

  // Auto-rotate flag on OrbitControls is handled in the loop via params.

  const readout = document.getElementById('readout-text');
  if (readout) {
    readout.textContent =
      params.mode === 'image'
        ? 'HOLOGRAM'
        : (params.text || '').slice(0, 16).toUpperCase() || 'TEXT';
  }
}

// Rebuild the 3D model (text or image hologram) from the current params.
function rebuild() {
  const resolution = { x: window.innerWidth, y: window.innerHeight };
  const common = {
    color: params.color,
    opacity: params.lineOpacity,
    lineWidth: params.lineWidth,
    resolution,
  };
  let model;
  try {
    if (params.mode === 'image' && sourceImage) {
      model = buildImageModel({
        image: sourceImage,
        imageRes: params.imageRes,
        imageDepth: params.imageDepth,
        imageThreshold: params.imageThreshold,
        imageInvert: params.imageInvert,
        imageColor: params.imageColor,
        ...common,
      });
    } else {
      model = buildTextModel({
        text: params.text,
        voxelRes: params.voxelRes,
        depthLayers: params.depthLayers,
        ...common,
      });
    }
  } catch (err) {
    console.error('Failed to build model:', err);
    return;
  }
  if (beam) {
    scene.remove(beam);
    beam.geometry.dispose();
    beam.material.dispose();
  }
  beam = model;
  beam.rotation.set(0, 0, 0);
  scene.add(beam);
  frameCamera(beam);
  applyParams();
}

// Adopt a freshly loaded image and switch into hologram mode.
function setImage(image) {
  sourceImage = image;
  params.mode = 'image';
  rebuild();
}

const api = {
  params,
  defaults: defaultParams,
  applyParams,
  rebuild,
  screenshot,
  controls,
  setImage,
  fitView: () => beam && frameCamera(beam),
  hasImage: () => !!sourceImage,
};

function screenshot() {
  // Render one fresh frame, then read the canvas out as a PNG download.
  post.composer.render();
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `oscilloscope-${Date.now()}.png`;
  a.click();
}

buildGUI(api);
rebuild();

// Optional debug handle for headless/manual inspection (?debug in the URL).
// Inert in normal use.
if (location.search.includes('debug')) {
  window.__scope = { scene, camera, controls, post, renderer, params, api, getBeam: () => beam };
}

// ---- Zoom / framing buttons (dolly the camera along its view direction) ----
function zoomBy(factor) {
  const dir = camera.position.clone().sub(controls.target);
  let len = dir.length() * factor;
  len = THREE.MathUtils.clamp(len, controls.minDistance, controls.maxDistance);
  camera.position.copy(controls.target).add(dir.setLength(len));
  controls.update();
}
document.getElementById('zoom-in')?.addEventListener('click', () => zoomBy(0.8));
document.getElementById('zoom-out')?.addEventListener('click', () => zoomBy(1.25));
document.getElementById('zoom-fit')?.addEventListener('click', () => api.fitView());

// Resize handling.
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  post.setSize(w, h);
  if (beam) beam.material.resolution.set(w, h);
});

// Animation loop.
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  post.glitch.uniforms.uTime.value = t;
  post.crt.uniforms.uTime.value = t;

  if (beam && params.autoRotate) {
    beam.rotation.x += params.rotX * dt;
    beam.rotation.y += params.rotY * dt;
    beam.rotation.z += params.rotZ * dt;
  }

  controls.update();
  post.composer.render();
}
tick();
