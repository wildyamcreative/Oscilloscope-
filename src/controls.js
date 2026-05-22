import GUI from 'lil-gui';
import { presets, fonts, defaultParams } from './params.js';

const STORAGE_KEY = 'oscilloscope-saved-preset';

function debounce(fn, ms) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
}

export function buildGUI(api) {
  const { params } = api;
  const gui = new GUI({ title: 'OSCILLOSCOPE // CONTROLS' });

  const rebuildSoon = debounce(() => api.rebuild(), 250);
  const onVisual = () => api.applyParams();

  // Merge a partial state into the live params, refresh every controller and
  // re-render. Used by presets / load / reset.
  function applyState(partial, { rebuild = false } = {}) {
    Object.assign(params, partial);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    api.applyParams();
    if (rebuild) api.rebuild();
  }

  // ---- Text / model ----
  const fText = gui.addFolder('Text');
  fText.add(params, 'text').name('input').onChange(rebuildSoon);
  fText.add(params, 'size', 2, 40, 0.5).onChange(rebuildSoon);
  fText.add(params, 'depth', 0, 12, 0.5).name('extrusion').onChange(rebuildSoon);
  fText.add(params, 'font', fonts).onChange(() => api.rebuild());

  // ---- Beam / glow ----
  const fBeam = gui.addFolder('Beam / Glow');
  fBeam.addColor(params, 'color').onChange(onVisual);
  fBeam.add(params, 'glowStrength', 0, 4, 0.05).name('glow strength').onChange(onVisual);
  fBeam.add(params, 'glowRadius', 0, 2, 0.01).name('glow radius').onChange(onVisual);
  fBeam.add(params, 'glowThreshold', 0, 1, 0.01).name('glow threshold').onChange(onVisual);
  fBeam.add(params, 'lineOpacity', 0, 1, 0.01).name('opacity').onChange(onVisual);

  // ---- Motion ----
  const fMotion = gui.addFolder('Motion');
  fMotion.add(params, 'autoRotate').name('auto-rotate');
  fMotion.add(params, 'rotX', -2, 2, 0.01).name('spin X');
  fMotion.add(params, 'rotY', -2, 2, 0.01).name('spin Y');
  fMotion.add(params, 'rotZ', -2, 2, 0.01).name('spin Z');
  fMotion.add(params, 'waveAmp', 0, 3, 0.01).name('wave amp').onChange(onVisual);
  fMotion.add(params, 'waveFreq', 0, 1.5, 0.01).name('wave freq').onChange(onVisual);
  fMotion.add(params, 'waveSpeed', 0, 5, 0.01).name('wave speed').onChange(onVisual);

  // ---- Glitch ----
  const fGlitch = gui.addFolder('Glitch');
  fGlitch.add(params, 'glitchAmount', 0, 1, 0.01).name('amount').onChange(onVisual);
  fGlitch.add(params, 'rgbSplit', 0, 1, 0.01).name('RGB split').onChange(onVisual);
  fGlitch.add(params, 'block', 0, 1, 0.01).name('block displace').onChange(onVisual);
  fGlitch.add(params, 'jitter', 0, 1, 0.01).onChange(onVisual);
  fGlitch.add(params, 'scanJump', 0, 1, 0.01).name('scan jump').onChange(onVisual);

  // ---- CRT ----
  const fCRT = gui.addFolder('CRT');
  fCRT.add(params, 'scanIntensity', 0, 1, 0.01).name('scanlines').onChange(onVisual);
  fCRT.add(params, 'scanCount', 100, 1600, 10).name('scan density').onChange(onVisual);
  fCRT.add(params, 'curvature', 0, 0.6, 0.01).onChange(onVisual);
  fCRT.add(params, 'vignette', 0, 1.5, 0.01).onChange(onVisual);
  fCRT.add(params, 'flicker', 0, 1, 0.01).onChange(onVisual);
  fCRT.add(params, 'noise', 0, 0.6, 0.01).onChange(onVisual);
  fCRT.add(params, 'phosphorPersistence', 0, 0.95, 0.01).name('persistence').onChange(onVisual);

  // ---- Presets & capture ----
  const fPre = gui.addFolder('Presets & Capture');
  const preState = { preset: 'Default' };
  fPre
    .add(preState, 'preset', Object.keys(presets))
    .name('preset')
    .onChange((name) => {
      // Presets are partial overrides on top of a clean default base.
      applyState({ ...defaultParams, ...presets[name] }, { rebuild: true });
    });

  const actions = {
    reset() {
      preState.preset = 'Default';
      applyState({ ...defaultParams }, { rebuild: true });
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    },
    saveToBrowser() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    },
    loadFromBrowser() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      try {
        applyState(JSON.parse(raw), { rebuild: true });
      } catch (e) {
        console.error('Bad saved preset:', e);
      }
    },
    exportJSON() {
      const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'oscilloscope-preset.json';
      a.click();
      URL.revokeObjectURL(a.href);
    },
    importJSON() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            applyState(JSON.parse(String(reader.result)), { rebuild: true });
          } catch (e) {
            console.error('Bad imported preset:', e);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    },
    screenshot() {
      api.screenshot();
    },
  };

  fPre.add(actions, 'screenshot').name('screenshot (PNG)');
  fPre.add(actions, 'saveToBrowser').name('save to browser');
  fPre.add(actions, 'loadFromBrowser').name('load from browser');
  fPre.add(actions, 'exportJSON').name('export JSON');
  fPre.add(actions, 'importJSON').name('import JSON');
  fPre.add(actions, 'reset').name('reset all');

  return gui;
}
