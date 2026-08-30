import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { loadCrtGuestLuts } from "./luts";
import { CrtGuestPass } from "./pass";
import { createCrtGuestTuningPanel } from "./panel";
import { CrtGuestSettings } from "./settings";

const app = document.getElementById("app");
const diagnostics = document.getElementById("review-diagnostics");
if (!app || !diagnostics) throw new Error("CRT review document is incomplete");
const diagnosticsElement: HTMLElement = diagnostics;

const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const pattern = new THREE.ShaderMaterial({
  name: "CRT Guest review pattern",
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform float uTime;
    varying vec2 vUv;

    vec3 bars(float x) {
      if (x < 1.0 / 7.0) return vec3(1.0);
      if (x < 2.0 / 7.0) return vec3(1.0, 1.0, 0.0);
      if (x < 3.0 / 7.0) return vec3(0.0, 1.0, 1.0);
      if (x < 4.0 / 7.0) return vec3(0.0, 1.0, 0.0);
      if (x < 5.0 / 7.0) return vec3(1.0, 0.0, 1.0);
      if (x < 6.0 / 7.0) return vec3(1.0, 0.0, 0.0);
      return vec3(0.0, 0.0, 1.0);
    }

    void main() {
      vec2 uv = vUv;
      vec3 color = bars(uv.x);
      if (uv.y < 0.66) {
        float checker = mod(floor(uv.x * 64.0) + floor(uv.y * 48.0), 2.0);
        color = mix(vec3(0.015), vec3(0.9), checker);
      }
      if (uv.y < 0.42) {
        color = vec3(smoothstep(0.0, 1.0, uv.x));
      }
      if (uv.y < 0.22) {
        vec2 p = uv - vec2(0.5, 0.11);
        float pulse = exp(-90.0 * dot(p, p)) * (1.5 + 0.5 * sin(uTime * 2.0));
        color = vec3(pulse, pulse * 0.55, pulse * 0.12);
      }
      float border = step(0.01, uv.x) * step(uv.x, 0.99) * step(0.01, uv.y) * step(uv.y, 0.99);
      gl_FragColor = vec4(color * border, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pattern));

const settings = new CrtGuestSettings({
  storage: null,
  loadStored: false,
  persistChanges: false,
});
const crtPass = new CrtGuestPass(renderer, settings);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(crtPass);
composer.addPass(new OutputPass());

const panel = createCrtGuestTuningPanel({
  settings,
  bindToggle: (toggle) => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== "F10" || event.repeat) return;
      event.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  },
});

function resize(): void {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  renderer.setSize(width, height, false);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);
}
window.addEventListener("resize", resize);
resize();

void loadCrtGuestLuts(`${import.meta.env.BASE_URL}crt-guest/lut/`).then(
  (luts) => crtPass.setLuts(luts),
  (error: unknown) => {
    diagnosticsElement.textContent =
      "CRT Guest LUT load failed: " +
      (error instanceof Error ? error.message : String(error));
  },
);

let start = performance.now();
let lastDiagnostics = 0;
function frame(now: number): void {
  pattern.uniforms.uTime.value = (now - start) / 1000;
  composer.render();
  if (now - lastDiagnostics > 250) {
    lastDiagnostics = now;
    const state = crtPass.diagnostics;
    diagnosticsElement.textContent = JSON.stringify(
      {
        active: state.active,
        reason: state.bypassReason,
        variant: state.variant,
        quality: state.quality,
        size: `${state.width}×${state.height}`,
        kernel: `${state.kernelWidth}×${state.kernelHeight}`,
        draws: state.lastDrawCount,
        frames: state.renderCount,
        historyResets: state.historyResetCount,
        failure: state.runtimeFailure,
      },
      null,
      2,
    );
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const reviewApi = { renderer, scene, camera, composer, settings, pass: crtPass, panel };
(window as unknown as { __crtReview: typeof reviewApi }).__crtReview = reviewApi;
