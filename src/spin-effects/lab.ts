import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Player } from '../player';
import { installLocalResetListener } from '../localGameStorage';
import { createSpinTuningPanel } from './panel';
import { SpinEffectsPresentation } from './presentation';
import {
  bakeSpinSmear, cloneSpinModel, DEFAULT_SPIN_SMEAR, disposeSpinModel,
  normalizeSpinSmear, SPIN_SMEAR_CONTROLS, spinModelStats,
  type SpinSmearSettings,
} from './smear';
import { exportSpinSmear, loadSpinSmearModel, saveSpinSmearModel } from './smearStore';
import { SPIN_SMEAR_POSE_REVISION } from './storageKeys';

const app = document.getElementById('app')!;
installLocalResetListener();
const status = document.getElementById('lab-status')!;
const diagnostics = document.getElementById('lab-diagnostics')!;
const bakeButton = document.getElementById('bake-model') as HTMLButtonElement;
const downloadButton = document.getElementById('download-model') as HTMLButtonElement;
const spinToggle = document.getElementById('spin-preview') as HTMLInputElement;
const ringsToggle = document.getElementById('show-rings') as HTMLInputElement;
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) spinToggle.checked = false;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x142b31);
scene.add(new THREE.HemisphereLight(0xf4f5ee, 0x34535a, 2.4));
const light = new THREE.DirectionalLight(0xffead4, 3);
light.position.set(3, 7, 5); scene.add(light);
const camera = new THREE.PerspectiveCamera(43, 1, .05, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.15, 0);
controls.enableDamping = true;
controls.minDistance = 4; controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI * .49;
camera.position.set(0, 3.4, 11.5); controls.update();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({ color: 0x29454c, roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -.025; scene.add(floor);
const grid = new THREE.GridHelper(30, 60, 0x627880, 0x354e55);
grid.position.y = -.02; scene.add(grid);
for (const x of [-2.8, 0, 2.8]) {
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.23, .07, 64),
    new THREE.MeshStandardMaterial({ color: 0x3c5d62, roughness: .85 }));
  plinth.position.set(x, -.035, 0); scene.add(plinth);
}
const currentRoot = new THREE.Group(); currentRoot.position.x = -2.8; scene.add(currentRoot);
const draftRoot = new THREE.Group(); scene.add(draftRoot);
const productionRoot = new THREE.Group(); productionRoot.position.x = 2.8; scene.add(productionRoot);
const player = new Player(new THREE.Scene());
let source: THREE.Group | null = null;
let draft: THREE.Group | null = null;
let settings: SpinSmearSettings = { ...DEFAULT_SPIN_SMEAR };
let bakeCount = 0, busy = false, needsDraft = false;
let production: SpinEffectsPresentation | null = null;
const bindings: Array<{ key: keyof SpinSmearSettings; range: HTMLInputElement; number: HTMLInputElement }> = [];
const ringPanel = createSpinTuningPanel({ labMode: true, hideLauncher: true });
const controlsElement = document.getElementById('smear-controls')!;
for (const definition of SPIN_SMEAR_CONTROLS) {
  const row = document.createElement('div'); row.className = 'smear-control';
  const label = document.createElement('label'); label.textContent = definition.label;
  const range = document.createElement('input'); range.type = 'range';
  const number = document.createElement('input'); number.type = 'number';
  range.id = `smear-${definition.key}`; label.htmlFor = range.id;
  for (const input of [range, number]) {
    input.min = String(definition.min); input.max = String(definition.max); input.step = String(definition.step);
    input.value = String(settings[definition.key]);
    input.setAttribute('aria-label', definition.label + (input === number ? ' value' : ''));
    input.addEventListener('input', () => {
      if (!input.value || !Number.isFinite(input.valueAsNumber)) return;
      settings = normalizeSpinSmear({ ...settings, [definition.key]: input.valueAsNumber });
      range.value = number.value = String(settings[definition.key]); needsDraft = true;
      status.textContent = 'Draft changed. Bake to use it during spin.';
    });
  }
  bindings.push({ key: definition.key, range, number });
  row.append(label, range, number); controlsElement.append(row);
}
function rebuildDraft(): void {
  if (!source) return;
  if (draft) disposeSpinModel(draft);
  draft = bakeSpinSmear(source, settings); draftRoot.add(draft);
  diagnostics.textContent = `${spinModelStats(draft).vertices.toLocaleString()} vertices · static 3D surface`;
  needsDraft = false;
}
function setSettings(value: SpinSmearSettings): void {
  settings = normalizeSpinSmear(value);
  for (const { key, range, number } of bindings) range.value = number.value = String(settings[key]);
  needsDraft = true;
}
document.getElementById('reset-smear')!.addEventListener('click', () => {
  setSettings({ ...DEFAULT_SPIN_SMEAR });
  status.textContent = 'Default draft restored. Bake to use it during spin.';
});
document.getElementById('ring-tuning')!.addEventListener('click', () => ringPanel.toggle());
document.getElementById('reload-character')!.addEventListener('click', () => window.location.reload());
async function bake(): Promise<void> {
  if (!source || busy) return;
  busy = true; bakeButton.disabled = downloadButton.disabled = true;
  status.textContent = 'Baking current character…';
  const recipe = { ...settings }, model = bakeSpinSmear(source, recipe);
  try {
    const result = await saveSpinSmearModel(model, recipe); await production?.prepare(); bakeCount++;
    status.textContent = result.persisted
      ? 'Baked and saved. This model is now used during spin.'
      : 'Baked for this session. Browser storage is unavailable; download the model to keep it.';
  } catch (error) {
    status.textContent = `Bake failed: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    disposeSpinModel(model); busy = false; bakeButton.disabled = downloadButton.disabled = false;
  }
}
bakeButton.addEventListener('click', () => { void bake(); });
downloadButton.addEventListener('click', async () => {
  const model = production?.sculpture.children[0];
  if (!(model instanceof THREE.Group) || busy) return;
  downloadButton.disabled = true;
  try {
    const glb = await exportSpinSmear(model);
    const url = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'character-spin-smear.glb';
    anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { status.textContent = `Download failed: ${String(error)}`; }
  finally { downloadButton.disabled = false; }
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) button.addEventListener('click', () => {
  const view = button.dataset.view;
  camera.position.set(view === 'side' ? 10 : 0, view === 'top' ? 11 : 3.4,
    view === 'side' ? .01 : view === 'top' ? .01 : 11.5);
  controls.target.set(0, 1.15, 0); controls.update();
});
function resize(): void {
  const width = app.clientWidth, height = app.clientHeight;
  renderer.setSize(width, height, false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(app); resize();
const start = performance.now();
let heldStep = 0;
function frame(now: number): void {
  if (needsDraft) rebuildDraft();
  if (spinToggle.checked) heldStep = Math.floor((now - start) * .06);
  production?.update({ step: heldStep, active: true, boardAttached: false, groundedSkate: false, bodyVisible: true });
  if (production) production.characterRings.visible = ringsToggle.checked;
  controls.update(); renderer.render(scene, camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
async function initialize(): Promise<void> {
  await player.preparePresentationAssets(); player.syncCharacterAppearance();
  currentRoot.add(player.captureSpinSmearSource(false));
  source = player.captureSpinSmearSource();
  const previous = await loadSpinSmearModel(), savedSettings = previous?.userData.spinSmear?.settings;
  if (savedSettings) setSettings(normalizeSpinSmear(savedSettings));
  rebuildDraft();
  production = new SpinEffectsPresentation({ parent: productionRoot, createSource: () => cloneSpinModel(source!) });
  await production.prepare();
  status.textContent = previous?.userData.spinSmear?.poseRevision === SPIN_SMEAR_POSE_REVISION
    ? 'Saved bake loaded. Edit the draft, then bake to replace it.'
    : previous ? 'Saved settings loaded with the new T-pose. Bake to save the updated model.'
    : 'T-pose spin character loaded. Edit the draft, then bake for gameplay.';
  bakeButton.disabled = downloadButton.disabled = false;
}
void initialize().catch(error => { status.textContent = `Character could not load: ${String(error)}`; });
(window as unknown as Record<string, unknown>).__spinLab = {
  scene, camera, renderer, controls, player, ringPanel, bake,
  get source() { return source; }, get draft() { return draft; },
  get production() { return production; }, get settings() { return { ...settings }; },
  get bakeCount() { return bakeCount; }, get ready() { return !!production?.diagnostics.assetReady; },
};
