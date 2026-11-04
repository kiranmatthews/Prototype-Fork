import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CRATE_ART_KINDS, createCrateArt, setCrateArtState, updateCrateArt, pulseCrateArt, crateArtStats } from '../src/crateArt';
import { CrateEffects } from '../src/crateEffects';
import { WorldSolids } from '../src/worldSolids';
import { setLifePortraitStyle, lifePortraitStyle } from '../src/lifePortrait';
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
const all = CRATE_ART_KINDS.map(kind => {
  const art = createCrateArt(kind, 2), holder = new THREE.Group(); holder.add(art.root); scene.add(holder);
  const label = document.createElement('div'); label.className = 'label'; label.textContent = kind; document.body.append(label);
  return { art, holder, label };
});
const controls = document.querySelector('#controls')!, status = document.querySelector('#status')!;
let reviewError = '';
let debrisCheck: { minimumY: number; finite: boolean; cleanedUp: boolean } | undefined;
let emitMilliseconds = 0;
let burstPool: { peak: number; limit: number } | undefined;
let selected = -1, native = true, frozen = false, time = 0, fuse: number | undefined, auto = false, slow = false;
let checkpointPop = 0, assetsReady = false;
let sixSides = false;
const sides = ['Front', 'Back', 'Left', 'Right', 'Top', 'Underside'];
const sideRotations = [new THREE.Euler(), new THREE.Euler(0,Math.PI,0), new THREE.Euler(0,Math.PI/2,0), new THREE.Euler(0,-Math.PI/2,0), new THREE.Euler(Math.PI/2,0,0), new THREE.Euler(-Math.PI/2,0,0)];
const sheetCamera = new THREE.OrthographicCamera(-1.45,1.45,1.45,-1.45,.1,20); sheetCamera.position.set(0,0,6);
const sideLabels = sides.map(name => { const label = document.createElement('div'); label.className='label'; label.textContent=name; label.hidden=true; document.body.append(label); return label; });
void Promise.all(all.map(({ art }) => art.ready)).then(() => { assetsReady = true; });
const select = document.createElement('select'); select.setAttribute('aria-label', 'Crate type');
for (const [i, name] of ['Whole family', ...CRATE_ART_KINDS].entries()) { const o = document.createElement('option'); o.value = String(i - 1); o.textContent = name; select.append(o); } controls.append(select);
function button(name: string, action: () => void) { const b = document.createElement('button'); b.textContent = name;
  b.onclick = () => { try { action(); } catch (error) { reviewError=String(error); console.error(error); } }; controls.append(b); }
function reset() {
  effects.clear(); checkpointPop = 0; fuse = undefined; frozen = false; time = 0;
  debrisCheck = undefined; burstPool = undefined; emitMilliseconds = 0; reviewError = '';
  for (const { art } of all) { art.pulse = 0; setCrateArtState(art, {}); updateCrateArt(art, 0, 0); }
}
function layout() {
  reset(); sixSides = false;
  key.position.set(-4,7,7); key.castShadow = true;
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
  const art = choose(); reset(); sixSides = false; art.root.visible = false;
  if (art.kind === 'checkpoint') { art.root.visible = true; checkpointPop = .12; return; }
  const started = performance.now();
  effects.emit(art.kind, new THREE.Vector3(), 2, -1, explode || art.kind === 'tnt' || art.kind === 'nitro', art.shell.material as THREE.MeshStandardMaterial);
  emitMilliseconds = performance.now() - started;
}
function step(dt: number) {
  time += dt;
  if (selected >= 0) {
    const art = all[selected].art;
    if (fuse !== undefined) { fuse -= dt; setCrateArtState(art, { fuse }); if (fuse <= 0) { hit(true); fuse = undefined; } }
    if (art.root.visible) updateCrateArt(art, dt, time);
    if (checkpointPop > 0) {
      checkpointPop = Math.max(0, checkpointPop - dt);
      art.root.scale.setScalar(art.size * checkpointPop / .12); art.root.visible = checkpointPop > 0;
    }
  }
  effects.update(dt, world);
}
button('Reset', () => { reset(); layout(); });
button('Three-quarter', () => { choose(); sixSides = false; frozen = false; ground.visible = true; key.castShadow = true; camera.up.set(0, 1, 0); camera.position.set(4.3, 2.8, 6.5); orbit.update(); });
button('Six sides', () => { choose(); reset(); sixSides = true; frozen = true; auto = false; ground.visible = false; key.position.set(-4,7,7); key.castShadow = false; });
for (const [name, x, y, z] of [['Front', 0, 1, 7], ['Back', 0, 1, -7], ['Left', -7, 1, 0], ['Right', 7, 1, 0], ['Top', 0, 7, .01], ['Underside', 0, -7, .01]] as const)
  button(name, () => { choose(); sixSides = false; ground.visible = name !== 'Underside'; camera.position.set(x, y, z); orbit.update(); });
button('Turntable', () => { choose(); sixSides = false; frozen = false; ground.visible = true; key.castShadow = true; auto = !auto; });
button('Bounce', () => { reset(); pulseCrateArt(choose()); });
button('Smash', () => hit());
button('Fracture start', () => { hit(); frozen = true; });
button('Impact frame', () => { hit(); step(.04); frozen = true; });
button('Debris frame', () => { hit(); for (let i = 0; i < 18; i++) step(1 / 60); frozen = true; });
button('Settled frame', () => { hit(); for (let i = 0; i < 96; i++) step(1 / 60); frozen = true; });
button('Validate debris', () => {
  if (!assetsReady) return;
  hit(); let minimumY = Infinity, finite = true;
  const vertex = new THREE.Vector3();
  for (let frame = 0; frame < 360; frame++) {
    step(1 / 60);
    if (frame < 70 || frame % 20) continue;
    effects.root.updateMatrixWorld(true);
    effects.root.traverse(node => {
      if (!(node as THREE.SkinnedMesh).isSkinnedMesh) return;
      const mesh = node as THREE.SkinnedMesh, positions = mesh.geometry.getAttribute('position');
      mesh.skeleton.update();
      for (let i = 0; i < positions.count; i++) {
        vertex.fromBufferAttribute(positions, i); mesh.applyBoneTransform(i, vertex); vertex.applyMatrix4(mesh.matrixWorld);
        finite &&= Number.isFinite(vertex.x + vertex.y + vertex.z);
        minimumY = Math.min(minimumY, vertex.y);
      }
    });
  }
  debrisCheck = { minimumY: Number.isFinite(minimumY) ? +minimumY.toFixed(4) : 0, finite,
    cleanedUp: effects.diagnostics.shards === 0 && effects.diagnostics.drawCalls === 0 };
  if (!finite || minimumY < -1.04 || !debrisCheck.cleanedUp) throw new Error(`Debris validation failed: ${JSON.stringify(debrisCheck)}`);
  frozen = true;
});
button('TNT fuse', () => { selected = CRATE_ART_KINDS.indexOf('tnt'); select.value = String(selected); layout(); fuse = 3; });
button('Validate burst pool', () => {
  if (!assetsReady) return;
  const art=choose(); reset(); let peak=0;
  for(let i=0;i<12;i++) {
    effects.emit(art.kind,new THREE.Vector3(),2,-1,false,art.shell.material as THREE.MeshStandardMaterial);
    peak=Math.max(peak,effects.diagnostics.shards);
    if(peak>effects.diagnostics.limit) throw new Error('Simultaneous fractures exceeded the debris limit');
  }
  burstPool={peak,limit:effects.diagnostics.limit}; effects.clear(); frozen=true;
});
for (const [name, remaining] of [['Fuse midway', 1.5], ['Fuse near end', .15]] as const)
  button(name, () => {
    selected = CRATE_ART_KINDS.indexOf('tnt'); select.value = String(selected); layout(); fuse = remaining; time = 3 - remaining;
    setCrateArtState(all[selected].art, { fuse }); updateCrateArt(all[selected].art, 0, time); frozen = true;
  });
for (const hits of [5,4,3,2,1,0]) button(`${hits} fruit`, () => {
  if (selected !== CRATE_ART_KINDS.indexOf('multihit')) { selected = CRATE_ART_KINDS.indexOf('multihit'); select.value = String(selected); layout(); }
  setCrateArtState(all[selected].art, { hits }); pulseCrateArt(all[selected].art);
});
button('Bone Man face', () => setLifePortraitStyle('skull'));
button('Alternate face', () => setLifePortraitStyle('alternate'));
button('Spent switch', () => { selected = CRATE_ART_KINDS.indexOf('bang'); select.value = String(selected); layout(); setCrateArtState(all[selected].art, { used: true }); pulseCrateArt(all[selected].art); });
button('Checkpoint', () => { selected = CRATE_ART_KINDS.indexOf('checkpoint'); select.value = String(selected); layout(); hit(); });
button('MAX / 480p', () => { native = !native; renderer.setPixelRatio(native ? devicePixelRatio : Math.min(1, 480 / innerHeight)); renderer.setSize(innerWidth, innerHeight); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; });
button('Warm / cool', () => { key.color.setHex(key.color.getHex() === 0xffd7a1 ? 0xb6dbff : 0xffd7a1); });
button('Face lighting', () => { key.position.copy(camera.position).normalize().multiplyScalar(7); key.castShadow = camera.position.y > 0; });
button('Studio lighting', () => { key.position.set(-4, 7, 7); key.castShadow = true; });
button('Slow motion', () => slow = !slow);
button('Pause', () => frozen = !frozen);
let recording = false;
let recordingTick: ((dt: number) => void) | undefined;
button('Record action', () => {
  if (recording || !assetsReady) return;
  const art = choose(); reset(); sixSides = false; auto = false; slow = false;
  ground.visible = true; key.position.set(-4,7,7); key.castShadow = true;
  camera.up.set(0,1,0); camera.position.set(4.3,2.8,6.5); orbit.update();
  const stream = renderer.domElement.captureStream(60);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
  const chunks: Blob[] = []; recording = true;
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onstop = () => {
    const url = URL.createObjectURL(new Blob(chunks,{type:'video/webm'})), anchor = document.createElement('a');
    anchor.href=url; anchor.download=`${art.kind}-crate-motion.webm`; anchor.textContent=`Download ${art.kind} motion`;
    anchor.style.cssText='color:#ffe5b3;padding:8px'; controls.append(anchor);
    stream.getTracks().forEach(track=>track.stop()); recording=false; recordingTick=undefined;
  };
  recorder.onerror = event => { reviewError=String(event); recording=false; recordingTick=undefined; stream.getTracks().forEach(track=>track.stop()); };
  recorder.start();
  // Follow the same simulation clock as the fuse and debris. A slow capture
  // frame must not stop the recording before the actual detonation/settle.
  let elapsed = 0;
  const plain = !['tnt','nitro','checkpoint'].includes(art.kind);
  recordingTick = dt => {
    const before = elapsed; elapsed += dt;
    if (before < .5 && elapsed >= .5) {
      if (art.kind === 'tnt') fuse = 3;
      else if (plain) pulseCrateArt(art);
      else hit();
    }
    if (plain && before < .95 && elapsed >= .95) hit();
    if (elapsed >= (art.kind === 'tnt' ? 5.6 : 4.6)) {
      recordingTick = undefined; recorder.stop();
    }
  };
});
layout();
let previous = performance.now();
function draw(now: number) {
  const dt = Math.min((now - previous) / 1000, .04); previous = now;
  recordingTick?.(dt);
  if (!frozen) step(dt * (slow ? .2 : 1));
  if (auto && selected >= 0) { const x = camera.position.x, z = camera.position.z; camera.position.x = x * Math.cos(dt * .3) + z * Math.sin(dt * .3); camera.position.z = z * Math.cos(dt * .3) - x * Math.sin(dt * .3); }
  orbit.update();
  if (selected < 0) for (const { holder, label } of all) { const v = holder.position.clone().add(new THREE.Vector3(0, -1.14, 0)).project(camera); label.style.left = `${(v.x * .5 + .5) * innerWidth}px`; label.style.top = `${(-v.y * .5 + .5) * innerHeight}px`; }
  sideLabels.forEach(label => label.hidden = !sixSides);
  if (sixSides && selected >= 0) {
    const holder = all[selected].holder, rotation = holder.rotation.clone();
    const width = innerWidth / 3, height = (innerHeight - 180) / 2;
    const aspect = width / height, frame = all[selected].art.kind === 'tnt' ? 1.85 : 1.45;
    sheetCamera.left = -frame * aspect; sheetCamera.right = frame * aspect; sheetCamera.top = frame; sheetCamera.bottom = -frame; sheetCamera.updateProjectionMatrix();
    renderer.setScissorTest(true);
    for (let i=0;i<6;i++) {
      const x=(i%3)*width, y=100+(1-Math.floor(i/3))*height;
      renderer.setViewport(x,y,width,height); renderer.setScissor(x,y,width,height);
      holder.rotation.copy(sideRotations[i]); renderer.render(scene,sheetCamera);
      sideLabels[i].style.left=`${x+width/2}px`; sideLabels[i].style.top=`${innerHeight-y-height+8}px`;
    }
    holder.rotation.copy(rotation); renderer.setScissorTest(false); renderer.setViewport(0,0,innerWidth,innerHeight);
  } else renderer.render(scene, camera);
  status.textContent = JSON.stringify({ view: selected < 0 ? 'family' : all[selected].art.kind, head: lifePortraitStyle(), visibleFruit: selected >= 0 ? all[selected].art.contents?.count : undefined, assetsReady, recording, ...(reviewError ? {error:reviewError}:{}), resolution: native ? 'MAX/native' : '480p', ...(selected >= 0 ? crateArtStats(all[selected].art.kind) : {}), effects: effects.diagnostics, burstPool, ...(debrisCheck ? {debrisCheck}:{}), emitMilliseconds: +emitMilliseconds.toFixed(2), fuse: fuse === undefined ? null : +fuse.toFixed(2), paused: frozen }, null, 2);
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
