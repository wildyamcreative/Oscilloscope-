// Full-screen CRT pass: barrel curvature, scanlines, vignette, flicker, static
// noise and a green phosphor tint. Applied last (before output) so everything
// reads as a real tube.
export const CRTShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uScanIntensity: { value: 0.35 },
    uScanCount: { value: 700 },
    uCurvature: { value: 0.18 },
    uVignette: { value: 0.45 },
    uFlicker: { value: 0.06 },
    uNoise: { value: 0.08 },
    uResolution: { value: [1, 1] },
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
    uniform float uScanIntensity;
    uniform float uScanCount;
    uniform float uCurvature;
    uniform float uVignette;
    uniform float uFlicker;
    uniform float uNoise;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    // Barrel distortion: push UVs outward from center to fake tube curvature.
    vec2 curve(vec2 uv) {
      uv = uv * 2.0 - 1.0;
      vec2 offset = abs(uv.yx) / vec2(6.0, 5.0);
      uv = uv + uv * offset * offset * uCurvature * 6.0;
      return uv * 0.5 + 0.5;
    }

    void main() {
      vec2 uv = curve(vUv);

      // Anything bent off-screen by the curvature is black tube border.
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec3 color = texture2D(tDiffuse, uv).rgb;

      // Scanlines.
      float scan = sin(uv.y * uScanCount * 3.14159) * 0.5 + 0.5;
      color *= 1.0 - uScanIntensity * (1.0 - scan);

      // Subtle aperture-grille shimmer across x.
      float grille = sin(uv.x * uResolution.x * 1.5) * 0.5 + 0.5;
      color *= 1.0 - 0.06 * (1.0 - grille);

      // Rolling brightness flicker.
      float flick = 1.0 - uFlicker * (0.5 + 0.5 * sin(uTime * 50.0)) * hash(vec2(uTime, 1.0));
      color *= flick;

      // Animated static noise.
      float n = hash(uv * uResolution + uTime);
      color += (n - 0.5) * uNoise;

      // Vignette.
      vec2 vc = uv - 0.5;
      float vig = 1.0 - dot(vc, vc) * uVignette * 2.2;
      color *= clamp(vig, 0.0, 1.0);

      // Green phosphor tint — bias toward the classic P1 green.
      color *= vec3(0.82, 1.05, 0.86);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
