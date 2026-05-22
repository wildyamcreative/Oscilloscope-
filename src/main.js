import * as THREE from 'three';
import { createScene } from './scene.js';
import { createComposer } from './postprocessing.js';
import { buildTextModel } from './textModel.js';
import { buildGUI } from './controls.js';
import { defaultParams, clonedDefaults } from './params.js';

const canvas = document.getElementById('scope');
const { renderer, scene, camera, controls } = createScene(canvas);
const post = createComposer(renderer, scene, camera);

// Mutable live state, seeded from defaults.
const params = clonedDefaults();
let beam = null;

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
  // Beam material (color/opacity/thickness) on the current model.
  if (beam) {
    beam.material.color.set(params.color);
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
  if (readout) readout.textContent = (params.text || '').slice(0, 16).toUpperCase() || 'TEXT';
}

// Rebuild the 3D text model from the current params.
function rebuild() {
  let model;
  try {
    model = buildTextModel({
      text: params.text,
      voxelRes: params.voxelRes,
      depthLayers: params.depthLayers,
      color: params.color,
      opacity: params.lineOpacity,
      lineWidth: params.lineWidth,
      resolution: { x: window.innerWidth, y: window.innerHeight },
    });
  } catch (err) {
    console.error('Failed to build text model:', err);
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

const api = {
  params,
  defaults: defaultParams,
  applyParams,
  rebuild,
  screenshot,
  controls,
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
