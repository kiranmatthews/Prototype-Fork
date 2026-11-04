import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {ModelExhibit} from './models';
import {ParticleExhibit} from './particles';
import {ParticleRenderPass} from './distortion';
import {sourceAssemblyDefinitions} from './sourceAssemblies';
import type {Catalogue, EffectDefinition, Exhibit, RenderingMode} from './types';
import {configureAssetBase} from './types';
import './lab.css';

const host=document.querySelector<HTMLDivElement>('#lab')!;
host.innerHTML=`
  <canvas class="world" aria-label="Explorable Jak and Daxter archive" tabindex="0"></canvas>
  <header class="topbar"><div class="brand"><span class="sigil">◈</span><div><h1>JAK & DAXTER / THE ARCHIVE</h1><small>Whole-game inspection lab</small></div></div><div class="coverage" id="coverage">Reading the source catalogue…</div></header>
  <aside class="panel catalogue" aria-label="Archive catalogue"><p class="eyebrow">Explore the collection</p><h2>Every corner of Jak’s world</h2><input type="search" id="search" placeholder="Find an object or effect…" aria-label="Search archive"><div class="row"><select id="area" aria-label="Area"><option value="">All areas</option></select><select id="kind" aria-label="Exhibit type"><option value="">All exhibits</option><option value="object">Objects & items</option><option value="effect">Particle effects</option><option value="scene">Level scenes</option></select></div><p id="matches" class="muted"></p><div class="results" id="results"></div><div class="pager"><button id="previous" aria-label="Previous catalogue page">←</button><span id="page"></span><button id="next" aria-label="Next catalogue page">→</button></div></aside>
  <div class="camera-tools"><button id="explore" aria-pressed="false">Explore</button><button id="focus">Focus exhibit</button><button class="toggle-panels" id="panels">Details</button></div>
  <aside class="panel inspection" aria-label="Exhibit inspection"><p class="eyebrow" id="selected-kind">Original / Gouraud</p><h2 id="selected-name">Loading…</h2><p class="muted" id="selected-area"></p><div class="mode-switch"><button data-mode="original">Original</button><button data-mode="gouraud">Gouraud</button><button data-mode="compare" aria-pressed="true">Both</button></div><div class="inspection-content"><div class="row"><button id="pause" aria-pressed="false">Pause</button><button id="restart">Restart</button><select id="speed" aria-label="Playback speed"><option value=".25">¼ speed</option><option value=".5">½ speed</option><option value="1" selected>1× speed</option><option value="2">2× speed</option></select></div><label class="field" id="animation-field">SOURCE ANIMATION<select id="animation" aria-label="Source animation"></select></label><label class="field" id="timeline-field">ANIMATION TIME<input id="timeline" type="range" min="0" max="1" step=".001" value="0" aria-label="Animation time"></label><label class="check"><input type="checkbox" id="native-scale">Show at original world scale</label><label class="field">RENDER RESOLUTION<select id="resolution" aria-label="Render resolution"><option value="720">720p</option><option value="native" selected>MAX / native</option></select></label><div class="status" id="status"></div><div class="statline" id="statistics"></div><div class="source" id="provenance"></div></div></aside>
  <div class="loading" role="status" id="loading">Opening the local source archive…</div>
  <footer class="footer"><span><kbd>W A S D</kbd> move · <kbd>Q E</kbd> down / up · <kbd>Shift</kbd> faster · drag to look / orbit</span><div class="legend"><span>Original assets</span><span>Gouraud variants</span></div><span id="render-stats"></span></footer>`;
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
const sceneParts=document.createElement('details');sceneParts.id='scene-parts';sceneParts.hidden=true;
sceneParts.innerHTML=`<summary>Scene parts</summary><label class="field">FIND A PROP OR PLANT<input type="search" id="part-search" aria-label="Search scene parts" placeholder="Name or source tree…"></label><label class="field">SOURCE PART<select id="scene-part" size="6" aria-label="Scene part"></select></label><button id="part-close">Close view</button><p class="muted" id="part-note"></p>`;
element('animation-field').before(sceneParts);
const partSelect=element<HTMLSelectElement>('scene-part'),partSearch=element<HTMLInputElement>('part-search');
const deathControls=document.createElement('div');deathControls.hidden=true;
deathControls.innerHTML=`<label class="field">MODEL DISAPPEARANCE<select id="mesh-death-replay" aria-label="Model disappearance"></select></label><p class="muted" id="mesh-death-note"></p>`;
element('animation-field').before(deathControls);
const deathSelect=element<HTMLSelectElement>('mesh-death-replay');

async function boot():Promise<void> {
  const catalogueURL=new URL(new URL(location.href).searchParams.get('catalogue')??
    (import.meta.env.DEV?'/__jak-lab/catalogue.json':'./catalogue.json'),location.href);
  const response=await fetch(catalogueURL);
  if(!response.ok)throw new Error('Local assets are not connected. Export the supplied game with tools/jak-lab/extract_assets.py, build its catalogue, then start Vite with JAK_LAB_DIR.');
  const catalogue=await response.json() as Catalogue;
  configureAssetBase(catalogueURL);
  if(catalogue.schemaVersion!==1)throw new Error('Unsupported source catalogue version');
  const c=catalogue.coverage;
  element('coverage').textContent=`${c.effectGroups} effect groups · ${c.expectedJointGeometries} joint geometries · ${c.exportedTextures.toLocaleString()} source textures`;
  const areaNames:Record<string,string>={common:'Shared objects',beach:'Sentinel Beach',citadel:'Gol & Maia’s Citadel',darkcave:'Dark Eco Plant',demo:'Demo scenes',finalboss:'Final battle',firecanyon:'Fire Canyon',intro:'Opening scenes',jungle:'Forbidden Jungle',jungleb:'Jungle temple',lavatube:'Lava Tube',maincave:'Spider Cave',misty:'Misty Island',ogre:'Mountain Pass boss',robocave:'Spider Cave machinery',rolling:'Precursor Basin',snow:'Snowy Mountain',sunken:'Lost Precursor City',sunkenb:'Precursor City chambers',swamp:'Boggy Swamp',title:'Title scene',training:'Geyser Rock',village1:'Sandover Village',village2:'Rock Village',village3:'Volcanic Crater',racer_common:'Zoomer',flut_common:'Flut Flut',engine:'Shared effects'};
  const pretty=(name:string)=>name.replace(/^group-/,'').replace(/-lod0$/,'').replace(/-/g,' ');
  const directEffects:EffectDefinition[]=(catalogue.sourceInventory?.standaloneParticles??[]).flatMap(entry=>
    [...new Set(entry.launches.map(launch=>launch.is3d))].map(is3d=>{
      const launch=entry.launches.find(candidate=>candidate.is3d===is3d)!;
      return {id:10000+entry.particle*2+Number(is3d),name:`${launch.source.function??'direct-launch'} / particle ${entry.particle}${is3d?' / 3D':''}`,
        source:launch.source,items:[{particle:entry.particle,flags:['launch-asap',...(is3d?['is-3d']:[])]}],
        directLaunch:{particle:entry.particle,function:launch.source.function}};
    }));
  const deathExhibits:Exhibit[]=(catalogue.meshDeaths?.models??[]).flatMap(death=>{
    const model=catalogue.models.find(model=>model.id===death.model);
    if(!model||(!death.events.length&&!['sunken/generic-button-lod0','common/eichar-lod0'].includes(model.id)))return [];
    return [{id:'death:'+model.id,name:`${pretty(model.name)} · ${death.events.length?'death':'warp disappearance'}`,
      area:model.area,kind:'effect',model,death}];
  });
  const exhibits:Exhibit[]=[...catalogue.models.map(model=>({id:'model:'+model.id,name:pretty(model.name),area:model.area,kind:model.background?'scene' as const:'object' as const,model})),...deathExhibits,
    ...[...catalogue.groups,...directEffects,...sourceAssemblyDefinitions].map(effect=>({id:'effect:'+effect.id,name:pretty(effect.name),area:effect.source.file.startsWith('levels/')?effect.source.file.split('/')[1]:'engine',kind:'effect' as const,effect}))]
    .sort((a,b)=>(a.area===b.area?0:a.area==='common'?-1:b.area==='common'?1:a.area.localeCompare(b.area))||a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name));
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
  const loaded=new Map<string,ModelExhibit|ParticleExhibit>(),pending=new Set<string>(),errors=new Map<string,string>(),labels=new Map<string,THREE.Sprite>();
  let selected=exhibits.find(exhibit=>exhibit.model?.id==='common/fuel-cell-lod0')??exhibits[0];
  let mode:RenderingMode='compare',paused=false,speed=1,exploring=false,page=0,filtered=exhibits,wanted=new Set<string>();
  let tick=0,statsTick=0,frameTime=0;
  const areaSelect=element<HTMLSelectElement>('area'),kindSelect=element<HTMLSelectElement>('kind'),search=element<HTMLInputElement>('search');
  const animationSelect=element<HTMLSelectElement>('animation'),nativeScale=element<HTMLInputElement>('native-scale');
  const replaySelect=element<HTMLSelectElement>('host-replay');
  for(const area of [...new Set(exhibits.map(exhibit=>exhibit.area))].sort())areaSelect.add(new Option(areaNames[area]??pretty(area),area));
  function label(exhibit:Exhibit):THREE.Sprite {
    const sheet=document.createElement('canvas');sheet.width=768;sheet.height=128;
    const context=sheet.getContext('2d')!;context.fillStyle='#10212bea';context.fillRect(0,0,768,128);
    context.fillStyle=exhibit.kind==='effect'?'#90dec5':'#e3c38c';context.font='20px Arial';context.fillText((areaNames[exhibit.area]??pretty(exhibit.area)).toUpperCase(),20,32);
    context.fillStyle='#eef0df';context.font='30px Arial';context.fillText(exhibit.name,20,77,720);
    context.fillStyle='#789caa';context.font='15px monospace';context.fillText(exhibit.death?'MESH DISAPPEARANCE':exhibit.kind==='effect'?`EFFECT ${exhibit.effect!.id}`:exhibit.model!.name,20,108,720);
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
    // its sides. Native-size backgrounds also need a larger far plane and orbit.
    const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5)*Math.min(1,camera.aspect*(innerWidth>780?.5:1)));
    const distance=radius/Math.sin(halfFov)*1.1;
    controls.target.copy(point).add(new THREE.Vector3(0,Math.max(.4,size.y*.5),0));
    camera.position.copy(controls.target).add(new THREE.Vector3(9,6.8,12).normalize().multiplyScalar(distance));
    camera.near=.05;camera.far=Math.max(400,distance+radius*3);camera.updateProjectionMatrix();
    controls.minDistance=2;controls.maxDistance=Math.max(65,distance*4);
    scene.fog=nativeScale.checked?null:galleryFog;
    camera.lookAt(controls.target);
    exploring=false;controls.enabled=true;element('explore').setAttribute('aria-pressed','false');controls.update();
  }
  function inspect():void {
    element('selected-kind').textContent=selected.kind==='effect'?'Particle effect':selected.kind==='scene'?'Complete level scene':'Object / item';
    element('selected-name').textContent=selected.name;
    element('selected-area').textContent=areaNames[selected.area]??pretty(selected.area);
    const view=loaded.get(selected.id),status=element('status');
    deathControls.hidden=!(view instanceof ModelExhibit&&view.deathPlayback);
    deathSelect.replaceChildren();
    if(view instanceof ModelExhibit&&view.deathPlayback) {
      const death=view.deathPlayback;
      death.reference.events.forEach((event,index)=>deathSelect.add(new Option(`${pretty(event.clip)} · ${event.seconds.toFixed(3)} s marker`,`event:${index}`)));
      for(const profile of death.profiles)deathSelect.add(new Option(`Inspect ${pretty(profile.id)}`,profile.id));
      deathSelect.add(new Option('Animation only','off'));deathSelect.value=view.deathReplay;
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
    sceneParts.hidden=!(view instanceof ModelExhibit&&view.partSelection?.parts.length);
    if(view instanceof ModelExhibit&&view.partSelection)renderPartOptions(view);
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
    animationSelect.replaceChildren();
    element('animation-field').hidden=!(view instanceof ModelExhibit&&view.clips.length&&!view.deathPlayback);
    element('timeline-field').hidden=!(view instanceof ModelExhibit&&(view.clips.length||view.deathPlayback));
    if(view instanceof ModelExhibit) {
      for(const clip of view.clips)animationSelect.add(new Option(clip.name,clip.name));animationSelect.value=view.clipName;
      status.classList.remove('pending');status.textContent='Original geometry and animation. Gouraud uses vertex colour and vertex lighting, with the original opacity masks.';
      element('provenance').textContent=`${selected.model!.path}\n${view.dimensions.toArray().map(v=>v.toFixed(2)).join(' × ')} m · ${view.clips.length} source animations`;
      if(view.deathPlayback) {
        const death=view.deathPlayback;
        element('selected-kind').textContent='Source mesh disappearance';
        status.textContent='Original and Gouraud share the source animation, vertex emission, death texture profile and particle lifecycle.';
        element('provenance').textContent+=`\n${death.reference.sourceAssembly}\n${death.reference.sourceVertices.toLocaleString()} input vertices + ${death.reference.crossCopies.toLocaleString()} fragment copies\n${death.reference.unreferencedVertices} emission vertices outside the triangle stream`;
      }
      const part=view.partSelection?.current;
      if(part) {
        element('selected-kind').textContent=part.kind==='wind-draw'?'Source wind draw':part.kind==='shrub'?'Detail placements':'Prop placements';
        element('selected-name').textContent=part.name;
        element('provenance').textContent+=`\n${part.tree} · ${part.id}\n${part.meshes} draws · ${part.triangles.toLocaleString()} triangles`;
      }
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
  function select(exhibit:Exhibit,preservePart=false):void {
    if(selected.id!==exhibit.id){partSearch.value='';sceneParts.open=false;}
    selected=exhibit;nativeScale.checked=false;focus();inspect();renderResults();tick=1;
    const url=new URL(location.href);url.searchParams.set('exhibit',selected.id);
    if(!preservePart) {
      const view=loaded.get(exhibit.id),part=view instanceof ModelExhibit?view.partSelection?.current:null;
      if(part)url.searchParams.set('part',part.id);else url.searchParams.delete('part');
    }
    history.replaceState(null,'',url);
  }
  function renderPartOptions(view:ModelExhibit):void {
    const selection=view.partSelection!;
    const query=partSearch.value.trim().toLowerCase(),current=selection.current;
    const matches=selection.parts.filter(part=>`${part.name} ${part.tree} ${part.kind}`.toLowerCase().includes(query));
    partSelect.replaceChildren(new Option('Complete level scene',''));
    const choices=current&&!matches.includes(current)?[current,...matches]:matches;
    for(const part of choices)partSelect.add(new Option(
      `${part.kind==='shrub'?'Detail':part.kind==='wind-draw'?'Wind draw':'Prop'} · ${part.name} · ${part.tree}`,part.id));
    partSelect.value=current?.id??'';
    element<HTMLButtonElement>('part-close').disabled=!current;
    sceneParts.querySelector('summary')!.textContent=`Scene parts · ${selection.parts.length.toLocaleString()}`;
    element('part-note').textContent=current?
      current.kind==='wind-draw'?'One source wind draw, with its original placement. A draw may be only part of an object. Double-click a surface for a close view.':
        'All source placements of this named prop are shown together. Close view starts at the first source surface. Double-click another surface to inspect it; Focus exhibit restores the full view.':
      `${matches.length.toLocaleString()} matching parts. Choose one to isolate it; return to Complete level scene to restore the background.`;
  }
  function renderResults():void {
    const count=6,pages=Math.max(1,Math.ceil(filtered.length/count));page=Math.min(page,pages-1);
    element('matches').textContent=`${filtered.length.toLocaleString()} exhibits · ${exhibits.length.toLocaleString()} total`;
    element('page').textContent=`${page+1} / ${pages}`;
    element<HTMLButtonElement>('previous').disabled=page===0;element<HTMLButtonElement>('next').disabled=page===pages-1;
    const results=element('results');results.replaceChildren();
    filtered.slice(page*count,(page+1)*count).forEach(exhibit=>{
      const button=document.createElement('button');button.className='result'+(exhibit.id===selected.id?' selected':'');
      button.setAttribute('aria-pressed',String(exhibit.id===selected.id));
      const index=document.createElement('span');index.className='index';index.textContent=String(exhibits.indexOf(exhibit)+1).padStart(3,'0');
      const copy=document.createElement('span'),title=document.createElement('strong'),area=document.createElement('small');
      title.textContent=exhibit.name;area.textContent=`${exhibit.kind} · ${areaNames[exhibit.area]??pretty(exhibit.area)}`;
      copy.append(title,area);button.append(index,copy);button.onclick=()=>select(exhibit);results.append(button);
    });
  }
  function filter():void {
    const query=search.value.toLowerCase();
    filtered=exhibits.filter(exhibit=>(!areaSelect.value||exhibit.area===areaSelect.value)&&(!kindSelect.value||exhibit.kind===kindSelect.value)&&
      `${exhibit.name} ${exhibit.id} ${areaNames[exhibit.area]??''}`.toLowerCase().includes(query));
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
      const promise=exhibit.model?ModelExhibit.load(exhibit.model,exhibit.death?{catalogue,reference:exhibit.death}:undefined):ParticleExhibit.load(exhibit.effect!,catalogue,particlePass.sceneTexture);
      void promise.then(view=>{
        pending.delete(id);
        if(!wanted.has(id)){view.dispose();return;}
        view.root.position.copy(locations.get(id)!).setY(.16);view.setRendering(mode);scene.add(view.root);loaded.set(id,view);
        const caption=labels.get(id);if(caption)caption.position.y=view.inspectionSize.y+1.5;
        if(id===selected.id){
          const requestedPart=new URL(location.href).searchParams.get('part');
          if(view instanceof ModelExhibit&&view.partSelection?.parts.some(part=>part.id===requestedPart)) {
            view.setPart(requestedPart!);sceneParts.open=true;
          }
          view.setNativeScale(nativeScale.checked);inspect();if(!exploring)focus();
        }
      }).catch(error=>{pending.delete(id);errors.set(id,String(error));if(id===selected.id)inspect();console.error('Exhibit load failed',id,error);});
    }
  }
  search.oninput=filter;areaSelect.onchange=filter;kindSelect.onchange=filter;
  element('previous').onclick=()=>{page--;renderResults();};element('next').onclick=()=>{page++;renderResults();};
  for(const button of host.querySelectorAll<HTMLButtonElement>('[data-mode]'))button.onclick=()=>{
    mode=button.dataset.mode as RenderingMode;
    for(const candidate of host.querySelectorAll('[data-mode]'))candidate.setAttribute('aria-pressed',String((candidate as HTMLElement).dataset.mode===mode));
    for(const view of loaded.values())view.setRendering(mode);loaded.get(selected.id)?.setNativeScale(nativeScale.checked);focus();
  };
  element('pause').onclick=()=>{paused=!paused;element('pause').textContent=paused?'Play':'Pause';element('pause').setAttribute('aria-pressed',String(paused));};
  element('restart').onclick=()=>{const view=loaded.get(selected.id);if(view instanceof ModelExhibit)view.seek(0);else view?.restart();};
  element<HTMLSelectElement>('speed').onchange=event=>{speed=Number((event.target as HTMLSelectElement).value);};
  replaySelect.onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ParticleExhibit){view.setReplay(Number(replaySelect.value));inspect();}};
  deathSelect.onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ModelExhibit){view.setDeathReplay(deathSelect.value);inspect();if(!exploring)focus();}};
  partSearch.oninput=()=>{const view=loaded.get(selected.id);if(view instanceof ModelExhibit&&view.partSelection)renderPartOptions(view);};
  partSelect.onchange=()=>{
    const view=loaded.get(selected.id);if(!(view instanceof ModelExhibit))return;
    view.setPart(partSelect.value);view.setNativeScale(nativeScale.checked);inspect();focus();
    const url=new URL(location.href);if(partSelect.value)url.searchParams.set('part',partSelect.value);else url.searchParams.delete('part');
    history.replaceState(null,'',url);
  };
  function closeToSurface(point:THREE.Vector3,view:ModelExhibit):void {
    const direction=camera.position.clone().sub(controls.target).normalize();
    const distance=Math.max(.03,Math.min(camera.position.distanceTo(point)*.2,8*view.scale));
    controls.target.copy(point);camera.position.copy(point).addScaledVector(direction,distance);
    camera.near=Math.min(.05,view.scale*.01);camera.updateProjectionMatrix();
    controls.minDistance=Math.max(.001,view.scale*.2);
    controls.enabled=true;exploring=false;element('explore').setAttribute('aria-pressed','false');controls.update();
  }
  element('part-close').onclick=()=>{
    const view=loaded.get(selected.id);if(!(view instanceof ModelExhibit))return;
    const point=view.partSurfacePoint();if(point)closeToSurface(point,view);
  };
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
  animationSelect.onchange=()=>{const view=loaded.get(selected.id);if(view instanceof ModelExhibit)view.setClip(animationSelect.value);};
  element<HTMLInputElement>('timeline').oninput=event=>{
    const view=loaded.get(selected.id);if(view instanceof ModelExhibit)view.seek(Number((event.target as HTMLInputElement).value)*view.duration);
    if(!paused)element('pause').click();
  };
  function resize():void {
    const native=element<HTMLSelectElement>('resolution').value==='native';
    renderer.setPixelRatio(native?devicePixelRatio:Math.min(1,720/innerHeight));renderer.setSize(innerWidth,innerHeight);
    camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
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
  canvas.addEventListener('dblclick',event=>{
    const view=loaded.get(selected.id);if(!(view instanceof ModelExhibit)||!view.partSelection?.current)return;
    const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster(),meshes:THREE.Mesh[]=[];
    ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),camera);
    view.root.traverseVisible(node=>{if(node instanceof THREE.Mesh)meshes.push(node);});
    const hit=ray.intersectObjects(meshes,false)[0];if(!hit)return;
    // Inspect an actual rendered surface without inventing instance boundaries
    // or removing any of the other source placements.
    closeToSurface(hit.point,view);
  });
  const clock=new THREE.Clock(),movement=new THREE.Vector3(),right=new THREE.Vector3(),forward=new THREE.Vector3();
  const requested=new URL(location.href).searchParams.get('exhibit');select(exhibits.find(exhibit=>exhibit.id===requested)??selected,true);
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
    for(const [id,caption] of labels) {
      const view=loaded.get(id);
      caption.visible=exploring&&!(view instanceof ModelExhibit&&view.partSelection?.current);
    }
    if(!paused)for(const view of loaded.values()) {
      if(view instanceof ParticleExhibit)view.setInspectionCamera(camera.position);
      view.update(dt*speed);
    }
    tick+=dt;statsTick+=dt;if(tick>.3){tick=0;void stream();}
    if(statsTick>.25){statsTick=0;
      const view=loaded.get(selected.id);element('statistics').textContent=view instanceof ModelExhibit?
        `DISPLAY SCALE  ${view.scale.toFixed(3)}×\nANIMATION  ${view.time.toFixed(2)} s / ${view.duration.toFixed(2)} s`:
        view instanceof ParticleExhibit?`PARTICLES  ${view.motion.particles.length}\nDISTORTERS  ${view.distortions}\nAUXILIARY DROPS  ${view.motion.auxiliaryDrops}\nEMISSION  ${view.assembly?(view.assembly.enabled?'source draw':'off'):view.motion.replayPhase}\nSOURCE CLOCK  ${view.motion.clock} / 300 Hz\nCAPACITY DROPS  ${view.motion.dropped}\nDISPLAY SCALE  ${view.scale.toFixed(3)}×`:'';
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
    particlePass.render(renderer,scene,camera,[...loaded.values()].some(view=>view.root.visible&&view instanceof ParticleExhibit&&view.distortions>0));
  });
  // Read-only diagnostic surface for whole-catalogue validation and inspection.
  Object.defineProperty(window,'__jakLab',{value:{catalogue,exhibits,get selected(){return selected.id;},
    get loaded(){return [...loaded.keys()];},get errors(){return Object.fromEntries(errors);},
    get diagnostics(){return Object.fromEntries([...loaded].map(([id,view])=>[id,view.diagnostics]));}}});
}
void boot().catch(error=>{loading.textContent=String(error);console.error(error);});
