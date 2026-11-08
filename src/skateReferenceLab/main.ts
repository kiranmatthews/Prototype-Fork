import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {Player} from '../player';
import {SkateRetargeter, clipDuration, type MotionData, type SourceClip} from './retarget';
import {loadMotionStudyJson} from '../motionStudyAssets';

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const play = $<HTMLButtonElement>('#play'), scrub = $<HTMLInputElement>('#scrub');
const frameInput = document.createElement('input'); frameInput.type = 'number'; frameInput.min = '1'; frameInput.step = '1'; frameInput.id = 'frame-number'; frameInput.setAttribute('aria-label', 'Frame number');
$('#frame-label').replaceChildren(document.createTextNode('FRAME '), frameInput, document.createTextNode(' / '));
const frameCount = document.createElement('span'); $('#frame-label').append(frameCount);
const speed = $<HTMLSelectElement>('#speed'), loop = $<HTMLInputElement>('#loop');
const rest = $<HTMLInputElement>('#rest'), travel = $<HTMLInputElement>('#travel');
const loading = $('#loading'), status = $('#status');
const categoryFilter = document.createElement('select'); categoryFilter.id = 'motion-category'; categoryFilter.setAttribute('aria-label', 'Motion category');
document.querySelector('.search')!.after(categoryFilter);
const CATEGORY_ORDER = ['Mounts', 'Dismounts', 'Drop-ins', 'Stances', 'Riding', 'Switch stance', 'Charge holds', 'Charge transitions', 'Crouch transitions', 'Lean & pump', 'Manual stances', 'Pushing', 'Crouch & pop', 'Kickflips', 'Landings'];

const LABELS: Record<string, [string, string]> = {
  R_STAND_IDLE2_N_0_CYC: ['Standing idle', 'Riding'],
  R_IDLE_RIDE_N_0_CYC: ['Relaxed ride', 'Riding'],
  R_IDLE_RIDE_AGGR_0_CYC: ['Aggressive ride', 'Riding'],
  R_IDLE_RIDE_LOOSE_0_CYC: ['Loose ride', 'Riding'],
  R_PUSHLSP_HSTR_N_0_INTO: ['Slow push · enter', 'Pushing'],
  R_PUSHLSP_HSTR_N_0_CYC1: ['Slow push · cycle 1', 'Pushing'],
  R_PUSHLSP_HSTR_N_0_CYC2: ['Slow push · cycle 2', 'Pushing'],
  R_PUSH_H_N_OUT_MIDFRONT: ['Push · recover', 'Pushing'],
  R_PUSHHSP_HSTR_N_0_INTO: ['Fast push · enter', 'Pushing'],
  R_PUSHHSP_HSTR_N_0_CYC1: ['Fast push · cycle 1', 'Pushing'],
  R_PUSHHSP_HSTR_N_0_CYC2: ['Fast push · cycle 2', 'Pushing'],
  R_ANTIC_CROUCH_OLLIE_N_0_INTO: ['Ollie · crouch transition', 'Crouch & pop'],
  R_ANTIC_CROUCH_HIGHOLLIE_N_0_INTO: ['High ollie · crouch transition', 'Crouch & pop'],
  OLLIE_LOW_G: ['Low ollie · ground', 'Crouch & pop'],
  OLLIE_LOW_A: ['Low ollie · air', 'Crouch & pop'],
  OLLIE_HIGH_G: ['High ollie · ground', 'Crouch & pop'],
  OLLIE_HIGH_A: ['High ollie · air', 'Crouch & pop'],
  KICKFLIP_IN_LOW_G: ['Low kickflip · ground', 'Kickflips'],
  KICKFLIP_IN_LOW_A: ['Low kickflip · air', 'Kickflips'],
  KICKFLIP_IN_HIGH_G: ['High kickflip · ground', 'Kickflips'],
  KICKFLIP_IN_HIGH_A: ['High kickflip · air', 'Kickflips'],
  L_LAND_HIGH_AGGR_1_N: ['High landing · aggressive', 'Landings'],
  L_LAND_HIGH_LOOSE_1_N: ['High landing · loose', 'Landings'],
};
const describe = (clip: SourceClip): [string, string] => [clip.label ?? LABELS[clip.name]?.[0] ?? clip.name, clip.category ?? LABELS[clip.name]?.[1] ?? 'Source motion'];

async function start(): Promise<void> {
  const data = await loadMotionStudyJson<MotionData>('skate-motion');
  const clips = [...data.clips].sort((a, b) => CATEGORY_ORDER.indexOf(describe(a)[1]) - CATEGORY_ORDER.indexOf(describe(b)[1])
    || Number(b.name === 'BR_STAND_0_INTO_MOUNT') - Number(a.name === 'BR_STAND_0_INTO_MOUNT') || describe(a)[0].localeCompare(describe(b)[0]));
  let clip = clips.find(c => c.name === 'BR_STAND_0_INTO_MOUNT') ?? clips.find(c => c.name === 'R_PUSHLSP_HSTR_N_0_CYC2') ?? clips[0];
  let playing = true, time = 0, last = 0;

  const scene = new THREE.Scene(); scene.background = new THREE.Color('#dce2d5');
  scene.fog = new THREE.Fog('#dce2d5', 12, 32);
  const renderer = new THREE.WebGLRenderer({canvas: $<HTMLCanvasElement>('#viewport'), antialias: true});
  renderer.setPixelRatio(devicePixelRatio); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  scene.add(new THREE.HemisphereLight(0xedf5ff, 0x97a77e, 2.5));
  const sun = new THREE.DirectionalLight(0xfff3d9, 3.3); sun.position.set(3, 7, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -4;
  sun.shadow.camera.right = sun.shadow.camera.top = 4; sun.shadow.normalBias = .025; scene.add(sun);
  const rim = new THREE.DirectionalLight(0xf2fff7, 1.5); rim.position.set(-3, 3, -5); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({color: 0xc4cdbb, roughness: 1}));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(50, 100, 0x819879, 0xb1bea4); grid.position.y = -.014;
  const gridMaterial = grid.material as THREE.Material; gridMaterial.transparent = true; gridMaterial.opacity = .36; scene.add(grid);

  const player = new Player(scene); player.group.position.set(0, 0, 0); player.group.rotation.set(0, 0, 0);
  player.setCharacterHeadStyle('skull'); player.setCharacterRenderBatching(false);
  const rig = player.enterAnimationPreview();
  player.applyAnimationDeformations({}); player.syncCharacterAppearance({upperArmRestAngleWeight: 0});
  const targetLeg = rig.jointsById.get('kneeLeft')!.node.position.length() + rig.jointsById.get('ankleLeft')!.node.position.length();
  const neutralHipHeight = rig.jointsById.get('hips')!.node.getWorldPosition(new THREE.Vector3()).y;
  player.applyAnimationDeformations({});
  const retarget = new SkateRetargeter(rig, data, targetLeg);
  player.group.traverse(node => {if (node instanceof THREE.Mesh) {node.castShadow = true; node.receiveShadow = true;}});

  const links = retarget.bindings.filter(b => b.joint.parentId && rig.jointsById.has(b.joint.parentId));
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(links.length * 6), 3));
  const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({color: 0xf44824, depthTest: false, transparent: true, opacity: .9}));
  lines.renderOrder = 20; lines.frustumCulled = false; lines.visible = false; scene.add(lines);

  const camera = new THREE.PerspectiveCamera(36, 1, .02, 90);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .1;
  controls.target.set(0, 1.18, 0); controls.minDistance = 1.6; controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * .51; controls.enablePan = true;
  const views: Record<string, THREE.Vector3> = {
    three: new THREE.Vector3(3.3, 1.45, 4.8), side: new THREE.Vector3(5.8, .4, 0),
    front: new THREE.Vector3(0, .4, 5.8), back: new THREE.Vector3(0, .4, -5.8),
  };
  function view(name: string): void {
    camera.position.copy(controls.target).add(views[name]); controls.update();
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.classList.toggle('selected', button.dataset.view === name));
  }
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button => button.onclick = () => view(button.dataset.view!));
  controls.addEventListener('start', () => document.querySelectorAll('[data-view]').forEach(button => button.classList.remove('selected')));
  view('three');
  const stage = $('#stage');
  const resize = () => {const {width, height} = stage.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();};
  new ResizeObserver(resize).observe(stage); resize();
  $<HTMLSelectElement>('#quality').onchange = event => {
    renderer.setPixelRatio((event.target as HTMLSelectElement).value === 'native' ? devicePixelRatio : Math.min(1.25, devicePixelRatio)); resize();
  };
  $<HTMLInputElement>('#skeleton').onchange = event => {lines.visible = (event.target as HTMLInputElement).checked;};

  function updateHeading(): void {
    const [label, category] = describe(clip);
    $('#clip-title').textContent = label; $('#clip-id').textContent = clip.name; $('#category').textContent = category.toUpperCase();
    $('#duration-label').textContent = `${clipDuration(clip).toFixed(3)} s`;
    scrub.max = String(clipDuration(clip)); scrub.step = String(1 / clip.fps / 100);
    frameInput.max = String(clip.frames.length); frameCount.textContent = String(clip.frames.length);
    // Some drop-ins were authored below a ledge. Keep the reference floor
    // below their board path rather than obscuring the end of the source clip.
    floor.position.y = category === 'Drop-ins'
      ? Math.min(-.02, ...clip.frames.map(frame => (frame[retarget.sourceBoard][1] - data.bones[retarget.sourceBoard].rest[1]) * retarget.translationScale * rig.root.scale.y - .02))
      : -.02;
    grid.position.y = floor.position.y + .006;
    document.querySelectorAll<HTMLButtonElement>('[data-clip]').forEach(button => button.setAttribute('aria-current', String(button.dataset.clip === clip.name)));
    status.textContent = `${data.clips.length} clips · ${retarget.bindings.length} joints + board · ${clip.fps} fps source`;
  }
  const buttons = new Map<string, HTMLButtonElement>();
  const groups = new Map<string, HTMLElement>();
  clips.forEach((entry, index) => {
    const [label, category] = describe(entry);
    if (!groups.has(category)) {
      const group = document.createElement('section'); const heading = document.createElement('div'); heading.className = 'clip-group'; heading.textContent = category.toUpperCase(); group.append(heading); $('#clip-list').append(group); groups.set(category, group);
    }
    const button = document.createElement('button'); button.className = 'clip-button'; button.dataset.clip = entry.name; button.dataset.category = category;
    const number = document.createElement('span'); number.className = 'clip-number'; number.textContent = String(index + 1).padStart(2, '0');
    const detail = document.createElement('span'), name = document.createElement('span'), meta = document.createElement('small');
    name.className = 'clip-name'; name.textContent = label; meta.textContent = `${entry.frames.length} frames · ${entry.fps} fps · ${clipDuration(entry).toFixed(2)}s`;
    detail.append(name, meta); button.append(number, detail); groups.get(category)!.append(button); buttons.set(entry.name, button);
    button.onclick = () => selectClip(entry);
  });
  const allCategories = document.createElement('option'); allCategories.value = ''; allCategories.textContent = `All motions (${clips.length})`; categoryFilter.append(allCategories);
  for (const name of groups.keys()) {const option = document.createElement('option'); option.value = name; option.textContent = `${name} (${clips.filter(c => describe(c)[1] === name).length})`; categoryFilter.append(option);}
  $('#clip-count').textContent = String(clips.length);
  function filterClips(): void {
    const term = $<HTMLInputElement>('#search').value.toLowerCase();
    let visible = 0;
    for (const [name, button] of buttons) {button.hidden = !`${name} ${button.textContent}`.toLowerCase().includes(term) || Boolean(categoryFilter.value && button.dataset.category !== categoryFilter.value); if (!button.hidden) visible++;}
    for (const group of groups.values()) group.hidden = !Array.from(group.querySelectorAll<HTMLButtonElement>('button')).some(b => !b.hidden);
    $('#clip-count').textContent = visible === clips.length ? String(clips.length) : `${visible}/${clips.length}`;
  }
  $<HTMLInputElement>('#search').oninput = filterClips; categoryFilter.onchange = filterClips;
  function setPlaying(value: boolean): void {playing = value; play.textContent = value ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(value));}
  function selectClip(next: SourceClip): void {clip = next; time = 0; rest.checked = false; $('#mode-label').textContent = 'DIRECT BONE MAPPING'; updateHeading();}
  play.onclick = () => setPlaying(!playing);
  $('#restart').onclick = () => {time = 0; setPlaying(true);};
  function step(direction: number): void {setPlaying(false); time = THREE.MathUtils.clamp((Math.round(time * clip.fps) + direction) / clip.fps, 0, clipDuration(clip));}
  $('#previous').onclick = () => step(-1); $('#next').onclick = () => step(1);
  scrub.oninput = () => {setPlaying(false); time = Number(scrub.value);};
  frameInput.oninput = () => {setPlaying(false); time = THREE.MathUtils.clamp((Number(frameInput.value) - 1) / clip.fps, 0, clipDuration(clip));};
  frameInput.onkeydown = event => {if (event.code === 'Enter') frameInput.blur();};
  rest.onchange = () => {$('#mode-label').textContent = rest.checked ? 'RETARGETING T-POSE' : 'DIRECT BONE MAPPING';};
  window.addEventListener('keydown', event => {
    if ((event.target as HTMLElement).matches('input,select,button,textarea')) return;
    if (event.code === 'Space') {event.preventDefault(); setPlaying(!playing);}
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {event.preventDefault(); step(event.code === 'ArrowLeft' ? -1 : 1);}
  });
  updateHeading(); buttons.get(clip.name)!.scrollIntoView({block: 'nearest'}); play.disabled = false; loading.hidden = true;
  const point = new THREE.Vector3(), previousAnchor = new THREE.Vector3(), anchor = new THREE.Vector3();
  function pose(): void {
    player.applyAnimationDeformations({});
    const scalars = retarget.apply(clip, time, {travel: travel.checked, rest: rest.checked});
    player.applyAnimationDeformations(scalars); player.syncCharacterAppearance({upperArmRestAngleWeight: 0});
    player.group.updateMatrixWorld(true);
    if (lines.visible) {
      const positions = lineGeometry.getAttribute('position') as THREE.BufferAttribute;
      links.forEach((binding, i) => {
        binding.joint.node.getWorldPosition(point); positions.setXYZ(i * 2, point.x, point.y, point.z);
        rig.jointsById.get(binding.joint.parentId!)!.node.getWorldPosition(point); positions.setXYZ(i * 2 + 1, point.x, point.y, point.z);
      }); positions.needsUpdate = true;
    }
    (clip.bank === 'OffBoard' ? rig.jointsById.get('hips')!.node : retarget.board).getWorldPosition(anchor);
    anchor.y = clip.bank === 'OffBoard' ? Math.max(0, anchor.y - neutralHipHeight) : 0;
    point.copy(anchor).sub(previousAnchor); controls.target.add(point); camera.position.add(point); previousAnchor.copy(anchor);
  }
  function render(now: number): void {
    const dt = Math.min(.1, (now - last) / 1000 || 0); last = now;
    if (playing && !rest.checked) {
      time += dt * Number(speed.value);
      if (time > clipDuration(clip)) {
        if (loop.checked) time %= Math.max(clipDuration(clip), 1 / clip.fps);
        else {time = clipDuration(clip); setPlaying(false);}
      }
    }
    pose(); controls.update(); renderer.render(scene, camera);
    scrub.value = String(time); $('#time-label').textContent = `${time.toFixed(3)} s`;
    if (document.activeElement !== frameInput) frameInput.value = String(Math.round(time * clip.fps) + 1);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

start().catch(error => {loading.hidden = false; loading.textContent = error instanceof Error ? error.message : String(error); status.textContent = 'Motion lab could not start'; console.error(error);});
