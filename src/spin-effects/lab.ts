import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createSpinTuningPanel } from "./panel";
import { SpinEffectsPresentation } from "./presentation";
import { DEFAULT_SPIN_PREVIEW_BOUNDS, SpinOrbitalRings } from "./rings";
import { spinRingSettings } from "./settings";
import { createSkateboardPresentation } from "../skateboard/model";
import { skateboardSettings } from "../skateboard/settings";

const app = document.getElementById("app")!;
const diagnostics = document.getElementById("lab-diagnostics")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x70947c);
scene.fog = null;
const camera = new THREE.PerspectiveCamera(57, 1, 0.05, 120);
camera.position.set(-6.475, 7.5575, -13.675);
const target = new THREE.Vector3(2.025, 1.3075, -2.175);
camera.lookAt(target);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 35;
controls.maxPolarAngle = Math.PI * 0.49;

function checkerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "rgb(163,171,179)";
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = "rgb(79,87,94)";
  context.fillRect(0, 0, 128, 128);
  context.fillRect(128, 128, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 9);
  return texture;
}

const arena = new THREE.Mesh(
  new THREE.BoxGeometry(36, 1, 36),
  new THREE.MeshBasicMaterial({ map: checkerTexture() }),
);
arena.name = "SpinRingTuning_PlayableArena_36m";
arena.position.y = -0.5;
scene.add(arena);

function worldLabel(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.font = "bold 40px ui-monospace, Menlo, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 9;
  context.strokeStyle = "rgba(0,0,0,.72)";
  context.strokeText(text, 384, 48);
  context.fillStyle = "#fff2f8";
  context.fillText(text, 384, 48);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(3.6, 0.45, 1);
  sprite.renderOrder = 20;
  return sprite;
}

const preview = new SpinOrbitalRings(
  spinRingSettings.value,
  DEFAULT_SPIN_PREVIEW_BOUNDS,
);
preview.name = "SpinOrbitalRings_PersistentPreview";
preview.position.set(4.5, 0.35, 2.5);
scene.add(preview);
const previewLabel = worldLabel("PERSISTENT RING PREVIEW");
previewLabel.position.set(4.5, 4.45, 2.5);
scene.add(previewLabel);

const demoRoot = new THREE.Group();
demoRoot.name = "ProductionSpin_LoopingPreview";
demoRoot.position.set(0, 0, -3.5);
scene.add(demoRoot);
const production = new SpinEffectsPresentation({
  parent: demoRoot,
  settings: spinRingSettings,
  targetBottom: 0,
});
const demoLabel = worldLabel("PRODUCTION SCULPTURE · 0.30s + 15-TICK RING HANDOFF");
demoLabel.position.set(0, 3.8, -3.5);
scene.add(demoLabel);

const boardDemoRoot = new THREE.Group();
boardDemoRoot.name = "BoardRoute_LoopingPreview";
boardDemoRoot.position.set(-3.75, 1.15, 2.5);
boardDemoRoot.rotation.set(-0.18, 0.35, 0.12);
scene.add(boardDemoRoot);
const demoBoard = createSkateboardPresentation(skateboardSettings.value);
demoBoard.scale.setScalar(1);
boardDemoRoot.add(demoBoard);
const boardRoute = new SpinEffectsPresentation({
  parent: boardDemoRoot,
  settings: spinRingSettings,
});
const boardLabel = worldLabel("BOARD AIR · NO SPIN HALO");
boardLabel.position.set(-3.75, 3.15, 2.5);
scene.add(boardLabel);

spinRingSettings.subscribe((value) => preview.applySettings(value));
const panel = createSpinTuningPanel({
  settings: spinRingSettings,
  initiallyOpen: true,
  labMode: true,
});

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const start = performance.now();
function frame(now: number): void {
  const elapsed = (now - start) / 1000;
  const step = Math.floor(elapsed * 60 + 0.000000001);
  const phase = elapsed % 1.15;
  const active = phase < 0.3;
  preview.applyStep(step);
  production.update({
    step,
    active,
    boardAttached: false,
    bodyVisible: true,
  });
  boardRoute.update({
    step,
    active,
    boardAttached: true,
    bodyVisible: true,
  });
  controls.update();
  const stats = preview.geometryStats;
  const productionState = production.diagnostics;
  diagnostics.textContent =
    `Spin orbital rings — Unity parity\n` +
    `${stats.rings} rings · ${stats.segments} segments · ${stats.vertices} vertices · ${stats.triangles} triangles\n` +
    `Whirlwind Vixen ${productionState.assetReady ? "ready" : "loading"} · route ${productionState.route} · ` +
    `${productionState.sculptureVisible ? "sculpture" : productionState.characterRingsVisible ? "ring handoff" : "idle"}`;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as Record<string, unknown>).__spinLab = {
  scene,
  camera,
  renderer,
  controls,
  preview,
  production,
  boardRoute,
  demoBoard,
  panel,
  settings: spinRingSettings,
};
