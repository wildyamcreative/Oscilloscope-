// Full-screen glitch pass: chromatic RGB split, horizontal block displacement,
// per-frame jitter and occasional vertical scan-jump. Driven by uAmount as a
// master intensity plus per-effect sliders.
export const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.0 },
    uRgbSplit: { value: 0.0 },
    uBlock: { value: 0.0 },
    uJitter: { value: 0.0 },
    uScanJump: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uRgbSplit;
    uniform float uBlock;
    uniform float uJitter;
    uniform float uScanJump;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453123); }
    float hash2(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      float t = uTime;
      float amt = clamp(uAmount, 0.0, 1.0);

      // Occasional vertical scan-jump (the whole image rolls/jumps).
      float jumpTrigger = step(0.92, hash(floor(t * 3.0)));
      uv.y = fract(uv.y + jumpTrigger * uScanJump * (hash(floor(t * 3.0) + 1.0) - 0.5));

      // Horizontal block displacement: rows grouped into blocks, some shoved
      // sideways. More active rows the higher uBlock is.
      float rows = 24.0;
      float blockId = floor(uv.y * rows);
      float blockRand = hash2(vec2(blockId, floor(t * 8.0)));
      float active = step(1.0 - uBlock * 0.6, blockRand);
      uv.x += active * (hash2(vec2(blockId, floor(t * 8.0) + 7.0)) - 0.5) * uBlock * 0.3;

      // Fine per-frame jitter.
      float jx = (hash2(vec2(floor(t * 60.0), 3.0)) - 0.5);
      float jy = (hash2(vec2(floor(t * 60.0), 9.0)) - 0.5);
      uv += vec2(jx, jy) * uJitter * 0.03;

      // Chromatic RGB channel split.
      float split = uRgbSplit * 0.012 + amt * 0.004;
      float r = texture2D(tDiffuse, uv + vec2(split, 0.0)).r;
      vec2 g = texture2D(tDiffuse, uv).gb;
      float b = texture2D(tDiffuse, uv - vec2(split, 0.0)).b;
      vec3 color = vec3(r, g.x, b);

      // Sparse white-noise sparkle scaled by master amount.
      float sparkle = step(0.997, hash2(uv * vec2(640.0, 480.0) + t));
      color += sparkle * amt * 0.6;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
