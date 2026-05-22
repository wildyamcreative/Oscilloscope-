import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GlitchShader } from './shaders/glitch.js';
import { CRTShader } from './shaders/crt.js';

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Phosphor persistence (afterglow trails).
  const afterimage = new AfterimagePass();
  afterimage.uniforms.damp.value = 0.55;
  composer.addPass(afterimage);

  // The green glow.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.5,
    0.6,
    0.0
  );
  composer.addPass(bloom);

  // Glitch then CRT.
  const glitch = new ShaderPass(GlitchShader);
  composer.addPass(glitch);

  const crt = new ShaderPass(CRTShader);
  composer.addPass(crt);

  composer.addPass(new OutputPass());

  const setSize = (w, h) => {
    composer.setSize(w, h);
    bloom.setSize(w, h);
    crt.uniforms.uResolution.value = [w, h];
  };
  setSize(window.innerWidth, window.innerHeight);

  return { composer, afterimage, bloom, glitch, crt, setSize };
}
