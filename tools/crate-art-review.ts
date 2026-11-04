import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CRATE_ART_KINDS, createCrateArt, setCrateArtState, updateCrateArt, pulseCrateArt, crateArtStats } from '../src/crateArt';
import { CrateEffects, createCheckpointMarker, updateCheckpointMarker } from '../src/crateEffects';
import { WorldSolids } from '../src/worldSolids';
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x15222d);
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, .05, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(devicePixelRatio); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; document.body.prepend(renderer.domElement);
const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.target.set(0, .2, 0);
scene.add(new THREE.HemisphereLight(0xe9f5ff, 0x4f3434, 2.1));
const key = new THREE.DirectionalLight(0xffd7a1, 3.2); key.position.set(-4, 7, 7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = key.shadow.camera.bottom = -5; key.shadow.camera.right = key.shadow.camera.top = 5; key.shadow.normalBias = .02; scene.add(key);
const rim = new THREE.DirectionalLight(0x8ac9ed, 2); rim.position.set(5, 4, -5); scene.add(rim);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x1b2e3c, roughness: .85 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.02; ground.receiveShadow = true; scene.add(ground); ground.updateMatrixWorld(true);
const solids = new WorldSolids(); solids.add(ground);
const world = { worldSolids: solids, groundMeshes: [ground], killY: -20 };
const effects = new CrateEffects(); scene.add(effects.root);
const marker = createCheckpointMarker(2); marker.root.position.y = -1; scene.add(marker.root);
const all = CRATE_ART_KINDS.map(kind => {
  const art = createCrateArt(kind, 2), holder = new THREE.Group(); holder.add(art.root); scene.add(holder);
  const label = document.createElement('div'); label.className = 'label'; label.textContent = kind; document.body.append(label);
  return { art, holder, label };
});
const controls = document.querySelector('#controls')!, status = document.querySelector('#status')!;
let selected = -1, native = true, frozen = false, time = 0, fuse: number | undefined, auto = false;
const select = document.createElement('select'); select.setAttribute('aria-label', 'Crate type');
for (const [i, name] of ['Whole family', ...CRATE_ART_KINDS].entries()) { const o = document.createElement('option'); o.value = String(i - 1); o.textContent = name; select.append(o); } controls.append(select);
function button(name: string, action: () => void) { const b = document.createElement('button'); b.textContent = name; b.onclick = action; controls.append(b); }
function reset() {
  effects.clear(); marker.active = false; updateCheckpointMarker(marker, 0); fuse = undefined; frozen = false; time = 0;
  for (const { art } of all) { art.pulse = 0; setCrateArtState(art, {}); updateCrateArt(art, 0, 0); }
}
function layout() {
  reset();
  all.forEach(({ art, holder, label }, i) => {
    holder.visible = selected < 0 || selected === i; label.hidden = selected >= 0;
    if (selected < 0) { holder.position.set((i % 5 - 2) * 2.45, (1 - Math.floor(i / 5)) * 2.45, 0); holder.rotation.set(.19, -.48, 0); art.root.scale.setScalar(1.65); }
    else { holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); }
  });
  ground.visible = selected >= 0;
  camera.position.set(selected < 0 ? 0 : 4.3, selected < 0 ? .4 : 2.8, selected < 0 ? 19.7 : 6.5);
  orbit.target.set(0, selected < 0 ? -.15 : .1, 0); orbit.update();
}
select.onchange = () => { selected = Number(select.value); layout(); };
function choose() { if (selected < 0) { selected = 0; select.value = '0'; layout(); } return all[selected].art; }
function hit(explode = false) {
  const art = choose(); reset(); art.root.visible = false;
  effects.emit(art.kind, new THREE.Vector3(), 2, -1, explode || art.kind === 'tnt' || art.kind === 'nitro');
  if (art.kind === 'checkpoint') marker.active = true;
}
function step(dt: number) {
  time += dt;
  if (selected >= 0) {
    const art = all[selected].art;
    if (fuse !== undefined) { fuse -= dt; setCrateArtState(art, { fuse }); if (fuse <= 0) { hit(true); fuse = undefined; } }
    if (art.root.visible) updateCrateArt(art, dt, time);
  }
  effects.update(dt, world); updateCheckpointMarker(marker, dt);
}
button('Reset', () => { reset(); layout(); });
button('Three-quarter', () => { choose(); camera.up.set(0, 1, 0); camera.position.set(4.3, 2.8, 6.5); orbit.update(); });
for (const [name, x, y, z] of [['Front', 0, 1, 7], ['Back', 0, 1, -7], ['Left', -7, 1, 0], ['Right', 7, 1, 0], ['Top', 0, 7, .01], ['Underside', 0, -7, .01]] as const)
  button(name, () => { choose(); ground.visible = name !== 'Underside'; camera.position.set(x, y, z); orbit.update(); });
button('Turntable', () => { choose(); auto = !auto; });
button('Bounce', () => { reset(); pulseCrateArt(choose()); });
button('Smash', () => hit());
button('Impact frame', () => { hit(); step(.04); frozen = true; });
button('Debris frame', () => { hit(); for (let i = 0; i < 18; i++) step(1 / 60); frozen = true; });
button('Settled frame', () => { hit(); for (let i = 0; i < 96; i++) step(1 / 60); frozen = true; });
button('TNT fuse', () => { selected = CRATE_ART_KINDS.indexOf('tnt'); select.value = String(selected); layout(); fuse = 3; });
button('Five-hit', () => { selected = CRATE_ART_KINDS.indexOf('multihit'); select.value = String(selected); layout(); setCrateArtState(all[selected].art, { hits: 2 }); pulseCrateArt(all[selected].art); });
button('Spent switch', () => { selected = CRATE_ART_KINDS.indexOf('bang'); select.value = String(selected); layout(); setCrateArtState(all[selected].art, { used: true }); pulseCrateArt(all[selected].art); });
button('Checkpoint', () => { selected = CRATE_ART_KINDS.indexOf('checkpoint'); select.value = String(selected); layout(); hit(); });
button('MAX / 480p', () => { native = !native; renderer.setPixelRatio(native ? devicePixelRatio : Math.min(1, 480 / innerHeight)); renderer.setSize(innerWidth, innerHeight); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; });
button('Warm / cool', () => { key.color.setHex(key.color.getHex() === 0xffd7a1 ? 0xb6dbff : 0xffd7a1); });
button('Pause', () => frozen = !frozen);
layout();
let previous = performance.now();
function draw(now: number) {
  const dt = Math.min((now - previous) / 1000, .04); previous = now;
  if (!frozen) step(dt);
  if (auto && selected >= 0) { const x = camera.position.x, z = camera.position.z; camera.position.x = x * Math.cos(dt * .3) + z * Math.sin(dt * .3); camera.position.z = z * Math.cos(dt * .3) - x * Math.sin(dt * .3); }
  orbit.update();
  if (selected < 0) for (const { holder, label } of all) { const v = holder.position.clone().add(new THREE.Vector3(0, -1.14, 0)).project(camera); label.style.left = `${(v.x * .5 + .5) * innerWidth}px`; label.style.top = `${(-v.y * .5 + .5) * innerHeight}px`; }
  renderer.render(scene, camera);
  status.textContent = JSON.stringify({ view: selected < 0 ? 'family' : all[selected].art.kind, resolution: native ? 'MAX/native' : '480p', ...(selected >= 0 ? crateArtStats(all[selected].art.kind) : {}), effects: effects.diagnostics, fuse: fuse === undefined ? null : +fuse.toFixed(2), paused: frozen }, null, 2);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
