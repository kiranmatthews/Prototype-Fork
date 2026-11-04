import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {ModelExhibit} from './models';
import {ParticleExhibit} from './particles';
import {FuelCellHudExhibit} from './fuelCellHudExhibit';
import {ScreenHudExhibit} from './screenHudExhibit';
import {screenHudDefinition} from './screenHud';
import {ParticleRenderPass} from './distortion';
import {effectExhibits} from './exhibits';
import {effectCategories,categoryLabel,type EffectCategory} from './effectCategories';
import type {Catalogue, Exhibit, RenderingMode} from './types';

type LabView=ModelExhibit|ParticleExhibit|FuelCellHudExhibit|ScreenHudExhibit;
function isHud(view:LabView|undefined):view is FuelCellHudExhibit|ScreenHudExhibit {
  return view instanceof FuelCellHudExhibit||view instanceof ScreenHudExhibit;
}
import {configureAssetBase} from './types';
import './lab.css';

const host=document.querySelector<HTMLDivElement>('#lab')!;
host.innerHTML=`
  <canvas class="world" aria-label="Explorable Jak and Daxter effects lab" tabindex="0"></canvas>
  <header class="topbar"><div class="brand"><span class="sigil">◈</span><div><h1>JAK & DAXTER / EFFECTS LAB</h1><small>Effects from across the whole game</small></div></div><div class="coverage" id="coverage">Reading the source catalogue…</div></header>
  <aside class="panel catalogue" aria-label="Archive catalogue"><p class="eyebrow">Explore the collection</p><h2>Explore Jak’s effects</h2><input type="search" id="search" placeholder="Find an effect…" aria-label="Search effects"><div class="row"><select id="area" aria-label="Area"><option value="">All areas</option></select><select id="kind" aria-label="Effect category"><option value="">All categories</option></select></div><p id="matches" class="muted"></p><div class="results" id="results"></div><div class="pager"><button id="previous" aria-label="Previous catalogue page">←</button><span id="page"></span><button id="next" aria-label="Next catalogue page">→</button></div></aside>
  <div class="camera-tools"><button id="explore" aria-pressed="false">Explore</button><button id="focus">Focus exhibit</button><button class="toggle-panels" id="panels">Details</button></div>
  <aside class="panel inspection" aria-label="Exhibit inspection"><p class="eyebrow" id="selected-kind">Original / Gouraud</p><h2 id="selected-name">Loading…</h2><p class="muted" id="selected-area"></p><div class="mode-switch"><button data-mode="original">Original</button><button data-mode="gouraud">Gouraud</button><button data-mode="compare" aria-pressed="true">Both</button></div><div class="inspection-content"><div class="row"><button id="pause" aria-pressed="false">Pause</button><button id="restart">Restart</button><select id="speed" aria-label="Playback speed"><option value=".25">¼ speed</option><option value=".5">½ speed</option><option value="1" selected>1× speed</option><option value="2">2× speed</option></select></div><label class="field" id="timeline-field">EFFECT TIME<input id="timeline" type="range" min="0" max="1" step=".001" value="0" aria-label="Effect time"></label><label class="check"><input type="checkbox" id="native-scale">Show at original world scale</label><label class="field">RENDER RESOLUTION<select id="resolution" aria-label="Render resolution"><option value="720">720p</option><option value="native" selected>MAX / native</option></select></label><div class="status" id="status"></div><div class="statline" id="statistics"></div><div class="source" id="provenance"></div></div></aside>
  <div class="loading" role="status" id="loading">Opening the local source archive…</div>
  <footer class="footer"><span><kbd>W A S D</kbd> move · <kbd>Q E</kbd> down / up · <kbd>Shift</kbd> faster · drag to look / orbit</span><div class="legend"><span>Original effects</span><span>Gouraud variants</span></div><span id="render-stats"></span></footer>`;
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=host.querySelector<HTMLCanvasElement>('canvas.world')!;
const loading=element('loading');
const hostControls=document.createElement('details');hostControls.id='effect-host';hostControls.hidden=true;
hostControls.innerHTML=`<summary>Effect inputs</summary><p class="muted">Adjust the conditions that drive this effect.</p>
  <label class="field" id="host-root-field">HOST HEIGHT (m)<input id="host-root" type="range" min="-10" max="40" step=".1" value="0" aria-label="Effect host height"></label>
  <label class="field" id="host-heading-field">HEADING<input id="host-heading" type="range" min="0" max="360" step="1" value="0" aria-label="Effect heading"></label>
  <label class="field" id="host-slope-field">SURFACE SLOPE<input id="host-slope" type="range" min="-70" max="70" step="1" value="0" aria-label="Effect surface slope"></label>
  <label class="field" id="host-water-field">WATER HEIGHT (m)<input id="host-water" type="range" min="-10" max="10" step=".1" value="0" aria-label="Effect water height"></label>
  <label class="check" id="host-fade-field"><input id="host-fade" type="checkbox">Fade out eco</label>
  <label class="field" id="host-lighting-field">BASE PARTICLE LIGHTING<select id="host-lighting" aria-label="Particle lighting"></select></label>
  <label class="field" id="host-hour-field">TIME OF DAY (0–24 h)<input id="host-hour" type="number" min="0" max="24" step=".25" value="12" aria-label="Time of day"></label>
  <p class="muted" id="host-lighting-note"></p>
  <p class="source" id="host-lighting-source"></p>
  <label class="field" id="host-sun-palette-field">AREA SUN PRESET<select id="host-sun-palette" aria-label="Sun palette"></select></label>
  <label class="field" id="host-sun-fade-field">SUN FADE (0–1)<input id="host-sun-fade" type="number" min="0" max="1" step=".05" value="1" aria-label="Sun fade"></label>
  <label class="field" id="host-racer-speed-field">ZOOMER SPEED (m/s)<input id="host-racer-speed" type="number" min="0" max="50" step=".5" value="0" aria-label="Zoomer speed"></label>
  <label class="field" id="host-racer-heat-field">ZOOMER HEAT (%)<input id="host-racer-heat" type="number" min="0" max="120" step="1" value="50" aria-label="Zoomer heat"></label>
  <label class="check" id="host-racer-entering-field"><input id="host-racer-entering" type="checkbox">HUD entering (instant needle)</label>
  <p class="muted" id="host-racer-note">Source needle and heat behavior, shown as isolated HUD layers. Full HUD placement is still pending.</p>`;
element('status').before(hostControls);
const hudControls=document.createElement('details');hudControls.hidden=true;
hudControls.innerHTML=`<summary id="hud-summary">Power-cell HUD</summary>
  <label class="field">SOURCE DISPLAY<select id="hud-format" aria-label="HUD display format"><option value="4:3">4:3 · NTSC</option><option value="16:9">16:9 · NTSC</option></select></label>
  <label class="check"><input type="checkbox" id="hud-full-frame">Show full HUD frame</label>
  <label class="check"><input type="checkbox" id="hud-hold" checked>Hold visible</label>
  <label class="field" id="hud-health-field">HEALTH<select id="hud-health" aria-label="Health"><option value="3">3 · full</option><option value="2">2</option><option value="1">1 · low health</option><option value="0.5">½</option><option value="0">0</option><option value="none">No target</option></select></label>
  <label class="field" id="hud-eco-type-field">ECO TYPE<select id="hud-eco-type" aria-label="Eco type"><option value="blue">Blue</option><option value="yellow">Yellow</option><option value="red">Red</option><option value="green">Green</option></select></label>
  <label class="field" id="hud-eco-charge-field">STARTING ECO (%)<input id="hud-eco-charge" aria-label="Starting eco (%)" type="number" min="0" max="120" step="1" value="100"></label>
  <label class="check" id="hud-eco-drain-field"><input type="checkbox" id="hud-eco-drain">Drain eco at source rate</label>
  <div class="row"><button id="hud-show">Show HUD</button><button id="hud-hide">Hide HUD</button></div>
  <p class="muted" id="hud-note"></p>`;
hostControls.before(hudControls);
const hudAssemblyLink=document.createElement('button');hudAssemblyLink.hidden=true;
hudAssemblyLink.textContent='View power-cell HUD';hudControls.before(hudAssemblyLink);
const assemblyControls=document.createElement('details');assemblyControls.id='source-assembly';assemblyControls.hidden=true;
assemblyControls.innerHTML=`<summary>Source assembly</summary>
  <label class="check"><input id="assembly-enabled" type="checkbox" checked>Emitter on</label>
  <label class="field" id="assembly-length-field">BEAM LENGTH (m)<input id="assembly-length" type="number" min="1" max="40" step=".5" value="12" aria-label="Beam length"></label>
  <label class="field" id="assembly-slope-field">BEAM SLOPE (degrees)<input id="assembly-slope" type="number" min="-80" max="80" step="5" value="0" aria-label="Beam slope"></label>
  <label class="field">HEADING (degrees)<input id="assembly-heading" type="number" min="-180" max="180" step="5" value="0" aria-label="Assembly heading"></label>
  <p class="muted" id="assembly-note"></p>`;
hostControls.before(assemblyControls);
const replayField=document.createElement('div');replayField.hidden=true;
replayField.innerHTML=`<label class="field">EMISSION PLAYBACK<select id="host-replay" aria-label="Emission playback"></select></label><p class="source" id="host-replay-note"></p>`;
hostControls.before(replayField);
const deathControls=document.createElement('div');deathControls.hidden=true;
deathControls.innerHTML=`<label class="field">MODEL DISAPPEARANCE<select id="mesh-death-replay" aria-label="Model disappearance"></select></label><p class="muted" id="mesh-death-note"></p>`;
element('timeline-field').before(deathControls);
const deathSelect=element<HTMLSelectElement>('mesh-death-replay');

async function boot():Promise<void> {
  const catalogueURL=new URL(new URL(location.href).searchParams.get('catalogue')??
    (import.meta.env.DEV?'/__jak-lab/catalogue.json':'./catalogue.json'),location.href);
  const response=await fetch(catalogueURL);
  if(!response.ok)throw new Error('Local assets are not connected. Export the supplied game with tools/jak-lab/extract_assets.py, build its catalogue, then start Vite with JAK_LAB_DIR.');
  const catalogue=await response.json() as Catalogue;
  configureAssetBase(catalogueURL);
  if(catalogue.schemaVersion!==1)throw new Error('Unsupported source catalogue version');
  const areaNames:Record<string,string>={common:'Shared effects',beach:'Sentinel Beach',citadel:'Gol & Maia’s Citadel',darkcave:'Dark Eco Plant',demo:'Demo scenes',finalboss:'Final battle',firecanyon:'Fire Canyon',intro:'Opening scenes',jungle:'Forbidden Jungle',jungleb:'Jungle temple',lavatube:'Lava Tube',maincave:'Spider Cave',misty:'Misty Island',ogre:'Mountain Pass boss',robocave:'Spider Cave machinery',rolling:'Precursor Basin',snow:'Snowy Mountain',sunken:'Lost Precursor City',sunkenb:'Precursor City chambers',swamp:'Boggy Swamp',title:'Title scene',training:'Geyser Rock',village1:'Sandover Village',village2:'Rock Village',village3:'Volcanic Crater',racer_common:'Zoomer',flut_common:'Flut Flut',engine:'Engine & HUD'};
  const pretty=(name:string)=>name.replace(/^group-/,'').replace(/-lod0$/,'').replace(/-/g,' ');
  const exhibits=effectExhibits(catalogue);
  if(!exhibits.length)throw new Error('The effects catalogue is empty');
  element('coverage').textContent=`${exhibits.length.toLocaleString()} effects · Original + Gouraud`;
  const locations=new Map(exhibits.map((exhibit,index)=>[exhibit.id,new THREE.Vector3((index%8-3.5)*16,0,-Math.floor(index/8)*17)]));
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(devicePixelRatio);renderer.setSize(innerWidth,innerHeight);
  const particlePass=new ParticleRenderPass();
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101e2a');
  const galleryFog=new THREE.Fog('#101e2a',38,125);scene.fog=galleryFog;
  const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.05,400);
  scene.add(new THREE.HemisphereLight(0xc0edf1,0x3e2920,2.1));
  const key=new THREE.DirectionalLight(0xffe6ba,2.6);key.position.set(-10,18,10);scene.add(key);
  const fill=new THREE.DirectionalLight(0x77d7dd,.75);fill.position.set(15,8,-15);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,Math.ceil(exhibits.length/8)*17+70),new THREE.MeshStandardMaterial({color:0x162a35,roughness:.9,metalness:.3}));
  floor.rotation.x=-Math.PI/2;floor.position.set(0,-.16,-Math.ceil(exhibits.length/8)*8.5+22);scene.add(floor);
  const grid=new THREE.GridHelper(3200,200,0x41616a,0x243d49);grid.position.y=-.15;grid.position.z=-1450;scene.add(grid);
  const pedestalGeometry=new THREE.CylinderGeometry(5.9,6.2,.28,40);
  const pedestal=new THREE.InstancedMesh(pedestalGeometry,new THREE.MeshStandardMaterial({color:0x273d46,roughness:.75,metalness:.35}),exhibits.length);
  const trim=new THREE.InstancedMesh(new THREE.TorusGeometry(5.8,.025,5,48),new THREE.MeshBasicMaterial({color:0x9f9e6a}),exhibits.length);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
  exhibits.forEach((exhibit,index)=>{
    const point=locations.get(exhibit.id)!;pedestal.setMatrixAt(index,matrix.makeTranslation(point.x,-.01,point.z));
    trim.setMatrixAt(index,matrix.compose(point.clone().setY(.14),rotation,new THREE.Vector3(1,1,1)));
  });scene.add(pedestal,trim);
  const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.49;
  const loaded=new Map<string,LabView>(),pending=new Set<string>(),errors=new Map<string,string>(),labels=new Map<string,THREE.Sprite>();
  let selected=exhibits.find(exhibit=>exhibit.id==='effect:58')??exhibits[0];
  let mode:RenderingMode='compare',paused=false,speed=1,exploring=false,page=0,filtered=exhibits,wanted=new Set<string>();
  let tick=0,statsTick=0,frameTime=0;
  const areaSelect=element<HTMLSelectElement>('area'),kindSelect=element<HTMLSelectElement>('kind'),search=element<HTMLInputElement>('search');
  const nativeScale=element<HTMLInputElement>('native-scale');
  const replaySelect=element<HTMLSelectElement>('host-replay');
  for(const area of [...new Set(exhibits.map(exhibit=>exhibit.area))].sort())areaSelect.add(new Option(areaNames[area]??pretty(area),area));
  function label(exhibit:Exhibit):THREE.Sprite {
    const sheet=document.createElement('canvas');sheet.width=768;sheet.height=128;
    const context=sheet.getContext('2d')!;context.fillStyle='#10212bea';context.fillRect(0,0,768,128);
    context.fillStyle='#90dec5';context.font='20px Arial';context.fillText((areaNames[exhibit.area]??pretty(exhibit.area)).toUpperCase(),20,32);
    context.fillStyle='#eef0df';context.font='30px Arial';context.fillText(exhibit.name,20,77,720);
    context.fillStyle='#789caa';context.font='15px monospace';context.fillText(exhibit.death?'MESH DISAPPEARANCE':`EFFECT ${exhibit.effect!.id}`,20,108,720);
    const texture=new THREE.CanvasTexture(sheet);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));sprite.scale.set(10.5,1.75,1);
    sprite.position.copy(locations.get(exhibit.id)!).add(new THREE.Vector3(0,5.8,0));scene.add(sprite);return sprite;
  }
  function focus():void {
    const point=locations.get(selected.id)!,view=loaded.get(selected.id);
    const size=view?view.inspectionSize:new THREE.Vector3(8,4,6);
    const caption=labels.get(selected.id);if(caption){
      caption.position.y=point.y+size.y+1.5;
      caption.visible=false; // The fixed inspector already names the focused exhibit.
    }
    const radius=Math.max(2,size.length()*.5);
    // Reserve the central viewport for the exhibit; the two fixed panels cover
    // its sides. Native-size effects also need a larger far plane and orbit.
    const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5)*Math.min(1,camera.aspect*(innerWidth>780?.5:1)));
    const distance=radius/Math.sin(halfFov)*1.1;
    controls.target.copy(point).add(new THREE.Vector3(0,Math.max(.4,size.y*.5),0));
    camera.position.copy(controls.target).add((isHud(view)?
      new THREE.Vector3(0,0,1):new THREE.Vector3(9,6.8,12).normalize()).multiplyScalar(distance));
    camera.near=.05;camera.far=Math.max(400,distance+radius*3);camera.updateProjectionMatrix();
    controls.minDistance=2;controls.maxDistance=Math.max(65,distance*4);
    scene.fog=nativeScale.checked?null:galleryFog;
    camera.lookAt(controls.target);
    exploring=false;controls.enabled=true;element('explore').setAttribute('aria-pressed','false');controls.update();
  }
  function inspect():void {
    element('selected-kind').textContent='Particle effect';
    element('selected-name').textContent=selected.name;
    element('selected-area').textContent=`${areaNames[selected.area]??pretty(selected.area)} · ${(selected.categories??[]).map(categoryLabel).join(' / ')}`;
    const view=loaded.get(selected.id),status=element('status');
    hudControls.hidden=!isHud(view);
    hudAssemblyLink.hidden=true;
    hudAssemblyLink.textContent='View power-cell HUD';
    if(view instanceof ScreenHudExhibit&&!selected.effect?.screenHud&&view.hud.profile.layers.length>1) {
      hudAssemblyLink.hidden=false;hudAssemblyLink.textContent='View full HUD assembly';
    }
    element<HTMLInputElement>('native-scale').disabled=isHud(view);
    if(isHud(view)) {
      element<HTMLSelectElement>('hud-format').value=view.hud.profile.id;
      element<HTMLInputElement>('hud-full-frame').checked=view.fullFrame;
      element<HTMLInputElement>('hud-hold').checked=view.hud.hold;
      const kind=view instanceof ScreenHudExhibit?view.hud.definition.id:'fuel-cell';
      element('hud-summary').textContent=view instanceof ScreenHudExhibit?view.hud.definition.name:'Power-cell HUD';
      element('hud-health-field').hidden=kind!=='health';
      for(const id of ['hud-eco-type-field','hud-eco-charge-field','hud-eco-drain-field'])element(id).hidden=kind!=='power';
      element('hud-note').textContent='Restart replays the arrival. Turn off Hold visible to see the original timed departure. The close view crops the same screen without moving its layers. Tally text and sounds are not replayed.'+
        (kind==='power'?' A full eco charge lasts 20 source seconds. A changing charge keeps the HUD visible; Hide also stops the drain.':'');
      if(view instanceof ScreenHudExhibit) {
        element<HTMLSelectElement>('hud-health').value=view.hud.health===null?'none':String(view.hud.health);
        element<HTMLSelectElement>('hud-eco-type').value=view.hud.ecoType;
        element<HTMLInputElement>('hud-eco-charge').value=String(Math.round(view.hud.charge*100));
        element<HTMLInputElement>('hud-eco-drain').checked=view.hud.drain;
      }
    }
    deathControls.hidden=!(view instanceof ModelExhibit&&view.deathPlayback);
    deathSelect.replaceChildren();
    if(view instanceof ModelExhibit&&view.deathPlayback) {
      const death=view.deathPlayback;
      death.reference.events.forEach((event,index)=>deathSelect.add(new Option(`${pretty(event.clip)} · ${event.seconds.toFixed(3)} s marker`,`event:${index}`)));
      for(const profile of death.profiles)deathSelect.add(new Option(`Inspect ${pretty(profile.id)}`,profile.id));
      deathSelect.value=view.deathReplay;
      element('mesh-death-note').textContent='Source animation markers and complete transformed vertex stream, including fragment copies. Inspection profiles start immediately. 60 Hz, normal frame load, base palette at noon. Gameplay movement and audio are not replayed.';
    }
    assemblyControls.hidden=!(view instanceof ParticleExhibit&&view.assembly);
    if(view instanceof ParticleExhibit&&view.assembly) {
      const a=view.assembly;
      element('selected-kind').textContent='Source effect assembly';
      element<HTMLInputElement>('assembly-enabled').checked=a.enabled;
      element<HTMLInputElement>('assembly-length').value=String(a.length);
      element<HTMLInputElement>('assembly-slope').value=String(a.slope);
      element<HTMLInputElement>('assembly-heading').value=String(a.heading);
      element('assembly-length-field').hidden=element('assembly-slope-field').hidden=a.kind!=='eco-beam';
      element('assembly-note').textContent=a.note;
    }
    replayField.hidden=!(view instanceof ParticleExhibit&&view.replays.length);
    replaySelect.replaceChildren(new Option('Held emitter (inspection)','-1'));
    if(view instanceof ParticleExhibit) {
      view.replays.forEach((replay,index)=>replaySelect.add(new Option(
        `Source burst · ${Number((replay.duration/300).toFixed(3))} s`,String(index))));
      replaySelect.value=String(view.motion.replay?view.replays.indexOf(view.motion.replay):-1);
      const replay=view.motion.replay;
      element('host-replay-note').textContent=replay?
        `${replay.source.function??'Source tracker'} · ${replay.linger/300} s linger, then cleanup.\n${replay.source.file}:${replay.source.line}\nLaunch position is placed at the exhibit origin.`:
        'Held playback is an inspection control. Select a source burst to replay its emission and linger timing.';
    }
    hostControls.hidden=!(view instanceof ParticleExhibit&&view.motion.hostInputs.size);
    if(view instanceof ParticleExhibit) {
      const inputs=view.motion.hostInputs,h=view.motion.host;
      element('host-root-field').hidden=!inputs.has('root')&&!inputs.has('primitive');
      element('host-heading-field').hidden=!inputs.has('target yaw/normal');
      element('host-slope-field').hidden=!inputs.has('target yaw/normal')&&!inputs.has('userdata normal vector');
      element('host-water-field').hidden=!inputs.has('ocean height');
      element('host-fade-field').hidden=!inputs.has('fade-out');
      const lit=inputs.has('particle lighting'),timed=inputs.has('time of day');
      element('host-lighting-field').hidden=!lit||!view.lighting||!!view.sun;
      element('host-hour-field').hidden=!lit&&!timed;
      element('host-lighting-note').hidden=element('host-lighting-source').hidden=!lit&&!timed;
      const lightingSelect=element<HTMLSelectElement>('host-lighting');lightingSelect.replaceChildren();
      for(const preset of view.lighting?.presets??[])lightingSelect.add(new Option(
        `${areaNames[preset.context.id]??pretty(preset.context.id)} · ${preset.selection.kind==='cycle'?'day cycle':`snapshot ${preset.selection.snapshot}`}`,preset.id));
      if(view.lighting)lightingSelect.value=view.lighting.selected.id;
      element('host-sun-palette-field').hidden=element('host-sun-fade-field').hidden=!view.sun;
      const sunSelect=element<HTMLSelectElement>('host-sun-palette');sunSelect.replaceChildren();
      for(const preset of view.sun?.presets??[])sunSelect.add(new Option(
        `${preset.context.id} · ${preset.selection.kind==='cycle'?'day cycle':'snapshot '+preset.selection.snapshot}`,preset.id));
      if(view.sun) {
        sunSelect.value=view.sun.selected.id;
        element<HTMLInputElement>('host-sun-fade').value=String(view.sun.fade);
      }
      element<HTMLInputElement>('host-hour').value=String(view.motion.hour);
      describeLighting(view);
      element('host-racer-speed-field').hidden=element('host-racer-entering-field').hidden=!inputs.has('racer speed');
      element('host-racer-heat-field').hidden=!inputs.has('racer heat');
      element('host-racer-note').hidden=!inputs.has('racer speed')&&!inputs.has('racer heat');
      element<HTMLInputElement>('host-root').value=String(h.root.y/4096);
      element<HTMLInputElement>('host-heading').value=String((h.targetYaw??0)*360/65536);
      element<HTMLInputElement>('host-slope').value=String(Math.atan2(h.targetNormal.z,h.targetNormal.y)*180/Math.PI);
      element<HTMLInputElement>('host-water').value=String(h.oceanHeight(new THREE.Vector3())/4096);
      element<HTMLInputElement>('host-fade').checked=h.fadeOut;
      element<HTMLInputElement>('host-racer-speed').value=String(h.racerSpeed/4096);
      element<HTMLInputElement>('host-racer-heat').value=String(h.racerHeat*100);
      element<HTMLInputElement>('host-racer-entering').checked=h.racerHudOffset>=10;
    }
    element('timeline-field').hidden=!(view instanceof ModelExhibit);
    if(view instanceof ModelExhibit) {
      status.classList.remove('pending');status.textContent='Original geometry and animation. Gouraud uses vertex colour and vertex lighting, with the original opacity masks.';
      element('provenance').textContent=`${selected.model!.path}\n${view.dimensions.toArray().map(v=>v.toFixed(2)).join(' × ')} m · ${view.clips.length} source animations`;
      if(view.deathPlayback) {
        const death=view.deathPlayback;
        element('selected-kind').textContent='Source mesh disappearance';
        status.textContent='Original and Gouraud share the source animation, vertex emission, death texture profile and particle lifecycle.';
        element('provenance').textContent+=`\n${death.reference.sourceAssembly}\n${death.reference.sourceVertices.toLocaleString()} input vertices + ${death.reference.crossCopies.toLocaleString()} fragment copies\n${death.reference.unreferencedVertices} emission vertices outside the triangle stream`;
      }
    } else if(view instanceof ScreenHudExhibit) {
      element('selected-kind').textContent=selected.effect?.screenHud?'Source HUD assembly':'Source HUD layer';
      status.classList.toggle('pending',view.issues.size>0);
      status.textContent=view.issues.size?[...view.issues].join('\n'):
        'Original source placement, dimensions, callbacks and entry/exit timing. Both views share one simulation; Gouraud interpolates the source sprite colours across a texture-free mesh.';
      element('provenance').textContent=`${view.hud.definition.source.file}:${view.hud.definition.source.line}\n`+
        view.hud.layers.map(layer=>layer.motion.group.name).join('\n');
    } else if(view instanceof FuelCellHudExhibit) {
      element('selected-kind').textContent='Animated HUD assembly';
      status.classList.toggle('pending',view.issues.size>0);
      status.textContent=view.issues.size?[...view.issues].join('\n'):
        'Source animated joints drive the orbiting glows, centre and flare layers in both views. The original screen projection is independent of the gallery camera.';
      element('provenance').textContent=`${selected.effect!.source.file}:${selected.effect!.source.line}\n`+
        `${catalogue.fuelCellHud!.model} · ${catalogue.fuelCellHud!.clip}\nGroup ${selected.effect!.id} · ${selected.effect!.items.length} launch bindings · source HUD states`;
    } else if(view instanceof ParticleExhibit) {
      status.classList.toggle('pending',view.issues.size>0);
      status.textContent=view.issues.size?`Source graph loaded. Fidelity work remaining:\n${[...view.issues].join('\n')}`:view.sun?
        'Original sun layers and source lifecycle. The Gouraud version uses the same simulation with colours interpolated across a texture-free mesh.':
        'Source emission graph. Original and Gouraud views share one simulation. Distortion samples the scene per pixel in Original and per vertex in Gouraud. Visual verification pending.';
      element('provenance').textContent=`${selected.effect!.source.file}:${selected.effect!.source.line}\n`+
        (view.assembly?`Source host draw · particle ${selected.effect!.items[0].particle} · 60 Hz`:
        selected.effect!.directLaunch?`Direct emitter ${selected.effect!.directLaunch!.particle} · launched once per second for inspection`:
          `Group ${selected.effect!.id} · ${selected.effect!.items.length} launch bindings`);
    } else {
      status.classList.toggle('pending',errors.has(selected.id));status.textContent=errors.get(selected.id)??'Loading original source assets…';
      element('provenance').textContent=selected.model?.path??selected.effect?.source.file??'';
    }
    loading.textContent=view?'':errors.get(selected.id)??`Loading ${selected.name}…`;
  }
  function describeLighting(view:ParticleExhibit):void {
    if(view.sun) {
      const sun=view.sun,preset=sun.selected;
      element('host-lighting-note').textContent='Original sun layers, recentered for inspection. '+
        'The source orbit, hour gates, colour palette and opposing rotations are preserved. '+
        (sun.host.orbit===1?'Green flares keep their authored colour; the preset only changes the initial fade. ':'')+
        'Sky backgrounds, terrain occlusion and local mood events are still pending. Preset changes reset the fade input.';
      element('host-lighting-source').textContent=`${sun.host.source.file}:${sun.host.source.line}\n`+
        `${preset.selection.source.file}:${preset.selection.source.line}`;
      return;
    }
    const lit=view.motion.hostInputs.has('particle lighting'),preset=view.lighting?.selected;
    element('host-lighting-note').textContent=lit?
      'Original base palettes. Local lighting events and area transitions are still pending. Changing these inputs restarts the effect.':
      'Time of day controls source emission hours. Changing it restarts the effect.';
    element('host-lighting-source').textContent=lit&&preset?
      `${preset.context.source.file}:${preset.context.source.line}\n${preset.selection.source.file}:${preset.selection.source.line}`:'';
  }
  function select(exhibit:Exhibit):void {
    selected=exhibit;nativeScale.checked=false;focus();inspect();renderResults();tick=1;
    const url=new URL(location.href);url.searchParams.set('exhibit',selected.id);url.searchParams.delete('part');
    history.replaceState(null,'',url);
  }
  function renderResults():void {
    const count=innerHeight<660?4:5,pages=Math.max(1,Math.ceil(filtered.length/count));page=Math.min(page,pages-1);
    element('matches').textContent=`${filtered.length.toLocaleString()} effects · ${exhibits.length.toLocaleString()} total`;
    element('page').textContent=`${page+1} / ${pages}`;
    element<HTMLButtonElement>('previous').disabled=page===0;element<HTMLButtonElement>('next').disabled=page===pages-1;
    const results=element('results');results.replaceChildren();
    filtered.slice(page*count,(page+1)*count).forEach(exhibit=>{
      const button=document.createElement('button');button.className='result'+(exhibit.id===selected.id?' selected':'');
      button.setAttribute('aria-pressed',String(exhibit.id===selected.id));
      const index=document.createElement('span');index.className='index';index.textContent=String(exhibits.indexOf(exhibit)+1).padStart(3,'0');
      const copy=document.createElement('span'),title=document.createElement('strong'),area=document.createElement('small');
      title.textContent=exhibit.name;area.textContent=`${categoryLabel(exhibit.categories![0])} · ${areaNames[exhibit.area]??pretty(exhibit.area)}`;
      copy.append(title,area);button.append(index,copy);button.onclick=()=>select(exhibit);results.append(button);
    });
  }
  function filter():void {
    const query=search.value.toLowerCase();
    filtered=exhibits.filter(exhibit=>(!areaSelect.value||exhibit.area===areaSelect.value)&&(!kindSelect.value||exhibit.categories?.includes(kindSelect.value as EffectCategory))&&
      `${exhibit.name} ${exhibit.id} ${areaNames[exhibit.area]??''} ${(exhibit.categories??[]).map(categoryLabel).join(' ')}`.toLowerCase().includes(query));
    page=0;renderResults();
  }
  async function stream():Promise<void> {
    const candidates=exploring?exhibits.map(exhibit=>({exhibit,distance:camera.position.distanceToSquared(locations.get(exhibit.id)!)}))
      .filter(item=>item.distance<34*34||item.exhibit.id===selected.id).sort((a,b)=>a.distance-b.distance).slice(0,7):[];
    wanted=new Set([selected.id,...candidates.map(item=>item.exhibit.id)]);
    for(const [id,view] of loaded)if(!wanted.has(id)){view.dispose();loaded.delete(id);}
    for(const [id,sprite] of labels)if(!wanted.has(id)){sprite.material.map?.dispose();sprite.material.dispose();sprite.removeFromParent();labels.delete(id);}
    for(const id of wanted) {
      const exhibit=exhibits.find(entry=>entry.id===id)!;
      if(!labels.has(id))labels.set(id,label(exhibit));
      if(loaded.has(id)||pending.has(id)||errors.has(id)||pending.size>=2)continue;
      pending.add(id);
      const promise=exhibit.model&&exhibit.death?ModelExhibit.load(exhibit.model,{catalogue,reference:exhibit.death}):
        exhibit.effect?.name===catalogue.fuelCellHud?.group?FuelCellHudExhibit.load(exhibit.effect!,catalogue):
          screenHudDefinition(exhibit.effect!,catalogue)?ScreenHudExhibit.load(exhibit.effect!,catalogue):
          ParticleExhibit.load(exhibit.effect!,catalogue,particlePass.sceneTexture);
      void promise.then(view=>{
        pending.delete(id);
        if(!wanted.has(id)){view.dispose();return;}
        view.root.position.copy(locations.get(id)!).setY(.16);view.setRendering(mode);scene.add(view.root);loaded.set(id,view);
        const caption=labels.get(id);if(caption)caption.position.y=view.inspectionSize.y+1.5;
        if(id===selected.id){
          view.setNativeScale(nativeScale.checked);inspect();if(!exploring)focus();
        }
      }).catch(error=>{pending.delete(id);errors.set(id,String(error));if(id===selected.id)inspect();console.error('Exhibit load failed',id,error);});
    }
  }
  function updateCategories():void {
    const value=kindSelect.value;
    kindSelect.replaceChildren(new Option('All categories',''));
    const local=exhibits.filter(exhibit=>!areaSelect.value||exhibit.area===areaSelect.value);
    for(const category of effectCategories) {
      const count=local.filter(exhibit=>exhibit.categories?.includes(category.id)).length;
      if(count||value===category.id)kindSelect.add(new Option(`${category.label} (${count})`,category.id));
    }
    kindSelect.value=value;
  }
  updateCategories();
  search.oninput=filter;areaSelect.onchange=()=>{updateCategories();filter();};kindSelect.onchange=filter;
  element('previous').onclick=()=>{page--;renderResults();};element('next').onclick=()=>{page++;renderResults();};
  for(const button of host.querySelectorAll<HTMLButtonElement>('[data-mode]'))button.onclick=()=>{
    mode=button.dataset.mode as RenderingMode;
    for(const candidate of host.querySelectorAll('[data-mode]'))candidate.setAttribute('aria-pressed',String((candidate as HTMLElement).dataset.mode===mode));
    for(const view of loaded.values())view.setRendering(mode);loaded.get(selected.id)?.setNativeScale(nativeScale.checked);focus();
  };
  element('pause').onclick=()=>{paused=!paused;element('pause').textContent=paused?'Play':'Pause';element('pause').setAttribute('aria-pressed',String(paused));};
  element('restart').onclick=()=>{const view=loaded.get(selected.id);if(view instanceof ModelExhibit)view.seek(0);else view?.restart();};
  hudAssemblyLink.onclick=()=>{const view=loaded.get(selected.id);const exhibit=exhibits.find(exhibit=>view instanceof ScreenHudExhibit?
    exhibit.effect?.screenHud===view.hud.definition.id:exhibit.effect?.name===catalogue.fuelCellHud?.group);if(exhibit)select(exhibit);};
  element('hud-format').onchange=()=>{const view=loaded.get(selected.id);if(isHud(view)){
    view.setFormat(element<HTMLSelectElement>('hud-format').value);inspect();if(!exploring)focus();
  }};
  element('hud-full-frame').onchange=()=>{const view=loaded.get(selected.id);if(isHud(view)){
    view.setFullFrame(element<HTMLInputElement>('hud-full-frame').checked);if(!exploring)focus();
  }};
  element('hud-hold').onchange=()=>{const view=loaded.get(selected.id);if(isHud(view))
    view.hud.hold=element<HTMLInputElement>('hud-hold').checked;};
  element('hud-show').onclick=()=>{const view=loaded.get(selected.id);if(isHud(view))view.hud.show();};
  element('hud-hide').onclick=()=>{const view=loaded.get(selected.id);if(isHud(view)){view.hud.hide();inspect();}};
  element('hud-health').onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ScreenHudExhibit){
    const value=element<HTMLSelectElement>('hud-health').value;view.hud.health=value==='none'?null:Number(value);view.update(1/60);
  }};
  element('hud-eco-type').onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ScreenHudExhibit){
    view.hud.ecoType=element<HTMLSelectElement>('hud-eco-type').value as typeof view.hud.ecoType;view.update(1/60);
  }};
  element('hud-eco-charge').onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ScreenHudExhibit){
    const value=Number(element<HTMLInputElement>('hud-eco-charge').value);if(Number.isFinite(value))view.hud.setCharge(Math.max(0,Math.min(120,value))/100);view.update(1/60);
  }};
  element('hud-eco-drain').onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ScreenHudExhibit)view.hud.drain=element<HTMLInputElement>('hud-eco-drain').checked;};
  element<HTMLSelectElement>('speed').onchange=event=>{speed=Number((event.target as HTMLSelectElement).value);};
  replaySelect.onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ParticleExhibit){view.setReplay(Number(replaySelect.value));inspect();}};
  deathSelect.onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ModelExhibit){view.setDeathReplay(deathSelect.value);inspect();if(!exploring)focus();}};
  for(const id of ['host-root','host-heading','host-slope','host-water','host-fade'])element<HTMLInputElement>(id).oninput=()=>{
    const view=loaded.get(selected.id);if(!(view instanceof ParticleExhibit))return;
    const h=view.motion.host;
    h.root.y=h.primitive.y=Number(element<HTMLInputElement>('host-root').value)*4096;
    h.targetYaw=Number(element<HTMLInputElement>('host-heading').value)*65536/360;
    const slope=Number(element<HTMLInputElement>('host-slope').value)*Math.PI/180;
    h.targetNormal.set(0,Math.cos(slope),Math.sin(slope));
    if(view.motion.hostInputs.has('userdata normal vector'))h.vectorNormal=h.targetNormal.clone();
    const water=Number(element<HTMLInputElement>('host-water').value)*4096;h.oceanHeight=()=>water;
    h.fadeOut=element<HTMLInputElement>('host-fade').checked;
    if(id!=='host-fade')view.restart();
  };
  for(const id of ['host-racer-speed','host-racer-heat','host-racer-entering'])element<HTMLInputElement>(id).oninput=()=>{
    const view=loaded.get(selected.id);if(!(view instanceof ParticleExhibit))return;
    const speedInput=element<HTMLInputElement>('host-racer-speed'),heatInput=element<HTMLInputElement>('host-racer-heat');
    if(speedInput.value!==''&&speedInput.validity.valid)view.motion.host.racerSpeed=Number(speedInput.value)*4096;
    if(heatInput.value!==''&&heatInput.validity.valid)view.motion.host.racerHeat=Number(heatInput.value)/100;
    view.motion.host.racerHudOffset=element<HTMLInputElement>('host-racer-entering').checked?10:0;
  };
  const updateLighting=()=>{
    const view=loaded.get(selected.id);if(!(view instanceof ParticleExhibit))return;
    const hour=element<HTMLInputElement>('host-hour');
    if(hour.value===''||!hour.validity.valid)return;
    view.motion.hour=Number(hour.value)%24;
    if(view.lighting)view.lighting.select(element<HTMLSelectElement>('host-lighting').value);
    view.refreshLighting();view.restart();describeLighting(view);
  };
  element<HTMLInputElement>('host-hour').oninput=updateLighting;
  element<HTMLSelectElement>('host-lighting').onchange=updateLighting;
  element<HTMLSelectElement>('host-sun-palette').onchange=()=>{
    const view=loaded.get(selected.id);if(!(view instanceof ParticleExhibit)||!view.sun)return;
    view.sun.select(element<HTMLSelectElement>('host-sun-palette').value);
    element<HTMLInputElement>('host-sun-fade').value=String(view.sun.fade);
    view.restart();describeLighting(view);
  };
  element<HTMLInputElement>('host-sun-fade').oninput=()=>{
    const view=loaded.get(selected.id),input=element<HTMLInputElement>('host-sun-fade');
    if(!(view instanceof ParticleExhibit)||!view.sun||input.value===''||!input.validity.valid)return;
    view.sun.fade=Number(input.value);view.restart();
  };
  for(const id of ['assembly-enabled','assembly-length','assembly-slope','assembly-heading'])element<HTMLInputElement>(id).oninput=()=>{
    const view=loaded.get(selected.id);if(!(view instanceof ParticleExhibit)||!view.assembly)return;
    view.assembly.enabled=element<HTMLInputElement>('assembly-enabled').checked;
    for(const field of ['length','slope','heading'] as const) {
      const input=element<HTMLInputElement>(`assembly-${field}`);
      if(input.value!==''&&input.validity.valid)view.assembly[field]=Number(input.value);
    }
    view.refreshAssembly();
    if(id==='assembly-length')focus();
  };
  nativeScale.onchange=()=>{loaded.get(selected.id)?.setNativeScale(nativeScale.checked);focus();};
  element<HTMLInputElement>('timeline').oninput=event=>{
    const view=loaded.get(selected.id);if(view instanceof ModelExhibit)view.seek(Number((event.target as HTMLInputElement).value)*view.duration);
    if(!paused)element('pause').click();
  };
  function resize():void {
    const native=element<HTMLSelectElement>('resolution').value==='native';
    renderer.setPixelRatio(native?devicePixelRatio:Math.min(1,720/innerHeight));renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
    renderResults();
  }
  element<HTMLSelectElement>('resolution').onchange=resize;addEventListener('resize',resize);
  element('focus').onclick=focus;
  element('explore').onclick=()=>{exploring=!exploring;controls.enabled=!exploring;element('explore').setAttribute('aria-pressed',String(exploring));canvas.focus();};
  element('panels').onclick=()=>{host.querySelector('.catalogue')!.classList.toggle('hidden');host.querySelector('.inspection')!.classList.toggle('shown');};
  const keys=new Set<string>();let dragging=false,lastX=0,lastY=0;
  addEventListener('keydown',event=>{
    if((event.target as HTMLElement).matches('input,select,textarea,button'))return;
    if(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight'].includes(event.code)){keys.add(event.code);event.preventDefault();}
  });addEventListener('keyup',event=>keys.delete(event.code));addEventListener('blur',()=>keys.clear());
  canvas.addEventListener('pointerdown',event=>{dragging=true;lastX=event.clientX;lastY=event.clientY;});
  addEventListener('pointerup',()=>dragging=false);
  canvas.addEventListener('pointermove',event=>{
    if(dragging&&exploring){const rotation=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');rotation.y-=(event.clientX-lastX)*.004;
      rotation.x=THREE.MathUtils.clamp(rotation.x-(event.clientY-lastY)*.004,-1.48,1.48);camera.quaternion.setFromEuler(rotation);}
    lastX=event.clientX;lastY=event.clientY;
  });
  const clock=new THREE.Clock(),movement=new THREE.Vector3(),right=new THREE.Vector3(),forward=new THREE.Vector3();
  const requested=new URL(location.href).searchParams.get('exhibit');select(exhibits.find(exhibit=>exhibit.id===requested)??selected);
  renderResults();resize();
  renderer.setAnimationLoop(()=>{
    const dt=Math.min(.05,clock.getDelta());frameTime+=(dt-frameTime)*.04;
    if(keys.size){exploring=true;controls.enabled=false;element('explore').setAttribute('aria-pressed','true');
      camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,camera.up).normalize();movement.set(0,0,0);
      movement.addScaledVector(forward,Number(keys.has('KeyW'))-Number(keys.has('KeyS')));
      movement.addScaledVector(right,Number(keys.has('KeyD'))-Number(keys.has('KeyA')));movement.y=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
      movement.normalize().multiplyScalar(dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?24:7));camera.position.add(movement);camera.position.y=Math.max(.5,camera.position.y);
    }
    if(!exploring)controls.update();
    // Large source sprites/scenes can extend beyond their gallery plinths.
    // Focus is an isolated inspection; Explore restores nearby full exhibits.
    for(const [id,view] of loaded)view.root.visible=exploring||id===selected.id;
    for(const caption of labels.values())caption.visible=exploring;
    if(!paused)for(const view of loaded.values()) {
      if(view instanceof ParticleExhibit)view.setInspectionCamera(camera.position);
      view.update(dt*speed);
    }
    tick+=dt;statsTick+=dt;if(tick>.3){tick=0;void stream();}
    if(statsTick>.25){statsTick=0;
      const view=loaded.get(selected.id);element('statistics').textContent=view instanceof ModelExhibit?
        `DISPLAY SCALE  ${view.scale.toFixed(3)}×\nEFFECT  ${view.time.toFixed(2)} s / ${view.duration.toFixed(2)} s`:
        view instanceof ParticleExhibit?`PARTICLES  ${view.motion.particles.length}\nDISTORTERS  ${view.distortions}\nAUXILIARY DROPS  ${view.motion.auxiliaryDrops}\nEMISSION  ${view.assembly?(view.assembly.enabled?'source draw':'off'):view.motion.replayPhase}\nSOURCE CLOCK  ${view.motion.clock} / 300 Hz\nCAPACITY DROPS  ${view.motion.dropped}\nDISPLAY SCALE  ${view.scale.toFixed(3)}×`:
        isHud(view)?`HUD  ${view.hud.phase}\nFORMAT  ${view.hud.profile.id} · NTSC\nOFFSET  ${view.hud.offset}\nPARTICLES  ${view.particles}\nSOURCE CLOCK  ${view.clock} / 300 Hz\nCAPACITY DROPS  ${view.dropped}`:'';
      if(view instanceof ScreenHudExhibit)element('statistics').textContent+=view.hud.definition.id==='health'?
        `\nHEALTH  ${view.hud.health??'no target'}`:view.hud.definition.id==='power'?
          `\nECO  ${view.hud.ecoType} · ${(view.hud.fraction*100).toFixed(1)}% · ${(view.hud.remaining/300).toFixed(2)} s`:'';
      if(view instanceof ModelExhibit&&view.deathPlayback) {
        const death=view.deathPlayback;
        element('statistics').textContent+=`\nDEATH  ${death.phase}${death.profileId?' · '+death.profileId:''}\nPARTICLES  ${death.motion.particles.length} · EMITTED ${death.launched}\nCAPACITY DROPS  ${death.motion.dropped}`;
      }
      if(view instanceof ParticleExhibit&&(view.motion.hostInputs.has('racer speed')||view.motion.hostInputs.has('racer heat'))) {
        const h=view.motion.host;
        element('statistics').textContent+=`\nZOOMER  ${(h.racerSpeed/4096).toFixed(1)} m/s · ${(h.racerHeat*100).toFixed(0)}% heat`;
        element('statistics').textContent+=`\nANGLES  ${view.motion.particles.map(p=>(((p.values['rot-z']??0)/65536*360+360)%360).toFixed(1)+'°').join(' / ')}`;
      }
      if(view instanceof ParticleExhibit&&view.assembly)
        element('statistics').textContent+=`\nSOURCE CALLS / FRAME  ${view.assembly.calls}\nEMITTER  ${view.assembly.enabled?'on':'off'}`;
      if(view instanceof ParticleExhibit&&(view.motion.hostInputs.has('particle lighting')||view.motion.hostInputs.has('time of day'))) {
        element('statistics').textContent+=`\nHOUR  ${view.motion.hour.toFixed(2)}`;
        if(!view.sun)element('statistics').textContent+=`\nPARTICLE RGB  ${view.motion.host.particleColor.toArray().map(v=>v.toFixed(4)).join(' / ')}`;
      }
      if(view instanceof ParticleExhibit&&view.sun) {
        const sun=view.sun;
        element('statistics').textContent+=`\nSUN  ${sun.active?'visible':'outside source hours / faded out'}`+
          (sun.host.orbit===0?`\nSUN RGB  ${view.motion.host.sunColor.toArray().map(v=>v.toFixed(2)).join(' / ')}`:
            '\nCOLOUR  authored green flares')+
          `\nSOURCE OFFSET (m)  ${sun.centre.toArray().map(v=>v.toFixed(1)).join(' / ')}`;
      }
      if(view instanceof ModelExhibit&&view.duration)element<HTMLInputElement>('timeline').value=String(
        view.deathPlayback?.active?Math.min(1,view.time/view.duration):(view.time%view.duration)/view.duration);
      element('render-stats').textContent=`${Math.round(1/Math.max(.001,frameTime))} fps · ${renderer.domElement.width}×${renderer.domElement.height} · ${loaded.size} nearby`;
    }
    for(const view of loaded.values())if(isHud(view))view.render(renderer);
    particlePass.render(renderer,scene,camera,[...loaded.values()].some(view=>view.root.visible&&view instanceof ParticleExhibit&&view.distortions>0));
  });
  // Read-only diagnostic surface for whole-catalogue validation and inspection.
  Object.defineProperty(window,'__jakLab',{value:{catalogue,exhibits,get selected(){return selected.id;},
    get loaded(){return [...loaded.keys()];},get errors(){return Object.fromEntries(errors);},
    get diagnostics(){return Object.fromEntries([...loaded].map(([id,view])=>[id,view.diagnostics]));}}});
}
void boot().catch(error=>{loading.textContent=String(error);console.error(error);});
