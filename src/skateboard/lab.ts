import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createSkateboardPresentation, rebuildSkateboardPresentation } from "./model";
import { createSkateboardTuningPanel } from "./panel";
import { skateboardSettings } from "./settings";

const app = document.getElementById("app")!;
const diagnostics = document.getElementById("lab-diagnostics")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x70947c);
const camera = new THREE.PerspectiveCamera(57, 1, 0.05, 120);
// Keep Unity's 57° review lens but begin on the inspection gallery. Unity's
// serialized camera starts back at the playable spawn; this standalone page
// has no rider to walk forward, so that framing made every board unnecessarily
// tiny until the first orbit.
camera.position.set(-6.5, 6, -6);
const target = new THREE.Vector3(0.5, 2, 4.5);
camera.lookAt(target);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(target);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 35;
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xffffff, 0x34443a, 1.25));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-5, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = sun.shadow.camera.bottom = -14;
sun.shadow.camera.right = sun.shadow.camera.top = 14;
scene.add(sun);

function checkerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#9ea5aa";
  context.fillRect(0, 0, 256, 256);
  context.fillStyle = "#50575e";
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
  new THREE.MeshLambertMaterial({ map: checkerTexture() }),
);
arena.name = "SkateboardTuningArena";
arena.position.y = -0.5;
arena.receiveShadow = true;
scene.add(arena);

interface BoardView {
  readonly board: THREE.Group;
  readonly label: string;
}

const views: BoardView[] = [];

function addBoard(
  label: string,
  position: readonly [number, number, number],
  rotationDegrees: readonly [number, number, number],
  scale: number,
  labelHeight: number,
): THREE.Group {
  const board = createSkateboardPresentation(skateboardSettings.value);
  board.name = label.split(" ").join("_");
  board.position.set(...position);
  board.rotation.set(...rotationDegrees.map(THREE.MathUtils.degToRad) as [number, number, number]);
  board.scale.setScalar(scale);
  scene.add(board);
  const labelSprite = worldLabel(label);
  labelSprite.position.set(position[0], labelHeight, position[2] - 0.18);
  scene.add(labelSprite);
  views.push({ board, label });
  return board;
}

function worldLabel(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.font = "bold 42px ui-monospace, Menlo, monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 9;
  context.strokeStyle = "rgba(0,0,0,.72)";
  context.strokeText(text, 384, 48);
  context.fillStyle = "#f8f9ff";
  context.fillText(text, 384, 48);
  const material = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2, 0.4, 1);
  sprite.renderOrder = 20;
  return sprite;
}

const hero = addBoard(
  "LIVE INSPECTION BOARD",
  [4.5, 1.25, 2.25],
  [12, -32, -9],
  2.4,
  3.92,
);
addBoard("X SIDE — ENLARGED", [2.2, 1.45, 6], [0, 90, 0], 2.4, 2.05);
addBoard("Y TOP — ENLARGED", [-0.65, 2.25, 6], [-90, 0, 0], 2.4, 3.42);
addBoard("Z END — ENLARGED", [4.7, 1.45, 6], [0, 0, 0], 2.4, 2.05);
addBoard("ACTUAL SIZE — 1×", [6.55, 2.05, 6], [-90, 0, 0], 1, 2.75);

// The Unity scene keeps this owner-supplied board photograph as a visual-only
// world-space card. It is never sampled by the production skateboard.
const referenceTexture = new THREE.TextureLoader().load(
  `${import.meta.env.BASE_URL}skateboard/surf-cruiser-reference.webp`,
);
referenceTexture.colorSpace = THREE.SRGBColorSpace;
const reference = new THREE.Mesh(
  new THREE.PlaneGeometry((3.55 * 1448) / 1086, 3.55),
  new THREE.MeshBasicMaterial({ map: referenceTexture, side: THREE.DoubleSide }),
);
reference.name = "SurfCruiser_VisualReference";
reference.position.set(-5, 2.45, 6);
scene.add(reference);
const referenceLabel = worldLabel("OWNER REFERENCE — VISUAL ONLY");
referenceLabel.position.set(-5, 4.42, 5.82);
scene.add(referenceLabel);

const panel = createSkateboardTuningPanel({
  settings: skateboardSettings,
  initiallyOpen: true,
  labMode: true,
});

let rebuildQueued = false;
skateboardSettings.subscribe((value) => {
  if (rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(() => {
    rebuildQueued = false;
    for (const view of views) rebuildSkateboardPresentation(view.board, value);
    const stats = hero.userData.geometryStats as
      | { vertices: number; triangles: number; materialGroups: number }
      | undefined;
    panel.setStatus(
      stats
        ? `Live mesh · ${stats.vertices.toLocaleString()} vertices · ${stats.triangles.toLocaleString()} triangles · ${stats.materialGroups} materials`
        : "Live mesh rebuilt.",
    );
  });
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

function frame(): void {
  controls.update();
  const stats = hero.userData.geometryStats as
    | { vertices: number; triangles: number; materialGroups: number }
    | undefined;
  diagnostics.textContent = stats
    ? `Surf Cruiser — Unity parity\n${stats.vertices.toLocaleString()} vertices · ${stats.triangles.toLocaleString()} triangles · ${stats.materialGroups} material groups\ntruck asset ${hero.userData.assetReady ? "ready" : "loading / procedural fallback"}`
    : "Surf Cruiser: building Unity parity mesh…";
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

(window as unknown as Record<string, unknown>).__skateboardLab = {
  scene,
  camera,
  renderer,
  controls,
  views,
  settings: skateboardSettings,
  hero,
};
