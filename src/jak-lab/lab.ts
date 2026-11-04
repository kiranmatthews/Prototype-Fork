import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {ModelExhibit} from './models';
import {ParticleExhibit} from './particles';
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
  <footer class="footer"><span><kbd>W A S D</kbd> move · <kbd>Q E</kbd> down / up · <kbd>Shift</kbd> faster · drag to look / orbit</span><div class="legend"><span>Original assets</span><span>Texture-free Gouraud</span></div><span id="render-stats"></span></footer>`;
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=host.querySelector<HTMLCanvasElement>('canvas.world')!;
const loading=element('loading');
const hostControls=document.createElement('details');hostControls.id='effect-host';hostControls.hidden=true;
hostControls.innerHTML=`<summary>Effect inputs</summary><p class="muted">Inspection inputs for callbacks: a stationary origin and flat water by default.</p>
  <label class="field" id="host-root-field">HOST HEIGHT (m)<input id="host-root" type="range" min="-10" max="40" step=".1" value="0" aria-label="Effect host height"></label>
  <label class="field" id="host-heading-field">HEADING<input id="host-heading" type="range" min="0" max="360" step="1" value="0" aria-label="Effect heading"></label>
  <label class="field" id="host-slope-field">SURFACE SLOPE<input id="host-slope" type="range" min="-70" max="70" step="1" value="0" aria-label="Effect surface slope"></label>
  <label class="field" id="host-water-field">WATER HEIGHT (m)<input id="host-water" type="range" min="-10" max="10" step=".1" value="0" aria-label="Effect water height"></label>
  <label class="check" id="host-fade-field"><input id="host-fade" type="checkbox">Fade out eco</label>`;
element('status').before(hostControls);
const replayField=document.createElement('div');replayField.hidden=true;
replayField.innerHTML=`<label class="field">EMISSION PLAYBACK<select id="host-replay" aria-label="Emission playback"></select></label><p class="source" id="host-replay-note"></p>`;
hostControls.before(replayField);

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
  const exhibits:Exhibit[]=[...catalogue.models.map(model=>({id:'model:'+model.id,name:pretty(model.name),area:model.area,kind:model.background?'scene' as const:'object' as const,model})),
    ...[...catalogue.groups,...directEffects].map(effect=>({id:'effect:'+effect.id,name:pretty(effect.name),area:effect.source.file.startsWith('levels/')?effect.source.file.split('/')[1]:'engine',kind:'effect' as const,effect}))]
    .sort((a,b)=>(a.area===b.area?0:a.area==='common'?-1:b.area==='common'?1:a.area.localeCompare(b.area))||a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name));
  const locations=new Map(exhibits.map((exhibit,index)=>[exhibit.id,new THREE.Vector3((index%8-3.5)*16,0,-Math.floor(index/8)*17)]));
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(devicePixelRatio);renderer.setSize(innerWidth,innerHeight);
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
    context.fillStyle='#789caa';context.font='15px monospace';context.fillText(exhibit.kind==='effect'?`EFFECT ${exhibit.effect!.id}`:exhibit.model!.name,20,108,720);
    const texture=new THREE.CanvasTexture(sheet);texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false}));sprite.scale.set(10.5,1.75,1);
    sprite.position.copy(locations.get(exhibit.id)!).add(new THREE.Vector3(0,5.8,0));scene.add(sprite);return sprite;
  }
  function focus():void {
    const point=locations.get(selected.id)!,view=loaded.get(selected.id);
    const size=view instanceof ModelExhibit?view.inspectionSize:new THREE.Vector3(8,4,6);
    const radius=Math.max(2,size.length()*.5);
    // Reserve the central viewport for the exhibit; the two fixed panels cover
    // its sides. Native-size backgrounds also need a larger far plane and orbit.
    const halfFov=Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5)*Math.min(1,camera.aspect*(innerWidth>780?.5:1)));
    const distance=radius/Math.sin(halfFov)*1.1;
    controls.target.copy(point).add(new THREE.Vector3(0,Math.max(.4,size.y*.5),0));
    camera.position.copy(controls.target).add(new THREE.Vector3(9,6.8,12).normalize().multiplyScalar(distance));
    camera.far=Math.max(400,distance+radius*3);camera.updateProjectionMatrix();
    controls.maxDistance=Math.max(65,distance*4);
    scene.fog=nativeScale.checked?null:galleryFog;
    camera.lookAt(controls.target);
    exploring=false;controls.enabled=true;element('explore').setAttribute('aria-pressed','false');controls.update();
  }
  function inspect():void {
    element('selected-kind').textContent=selected.kind==='effect'?'Particle effect':selected.kind==='scene'?'Complete level scene':'Object / item';
    element('selected-name').textContent=selected.name;
    element('selected-area').textContent=areaNames[selected.area]??pretty(selected.area);
    const view=loaded.get(selected.id),status=element('status');
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
      element<HTMLInputElement>('host-root').value=String(h.root.y/4096);
      element<HTMLInputElement>('host-heading').value=String((h.targetYaw??0)*360/65536);
      element<HTMLInputElement>('host-slope').value=String(Math.atan2(h.targetNormal.z,h.targetNormal.y)*180/Math.PI);
      element<HTMLInputElement>('host-water').value=String(h.oceanHeight(new THREE.Vector3())/4096);
      element<HTMLInputElement>('host-fade').checked=h.fadeOut;
    }
    animationSelect.replaceChildren();
    element('animation-field').hidden=!(view instanceof ModelExhibit&&view.clips.length);
    element('timeline-field').hidden=!(view instanceof ModelExhibit&&view.clips.length);
    if(view instanceof ModelExhibit) {
      for(const clip of view.clips)animationSelect.add(new Option(clip.name,clip.name));animationSelect.value=view.clipName;
      status.classList.remove('pending');status.textContent='Original geometry and animation. Gouraud uses sampled vertex colour and vertex lighting; no diffuse textures.';
      element('provenance').textContent=`${selected.model!.path}\n${view.dimensions.toArray().map(v=>v.toFixed(2)).join(' × ')} m · ${view.clips.length} source animations`;
    } else if(view instanceof ParticleExhibit) {
      status.classList.toggle('pending',view.issues.size>0);
      status.textContent=view.issues.size?`Source graph loaded. Fidelity work remaining:\n${[...view.issues].join('\n')}`:
        'Source emission graph. Original sprites and texture-free Gouraud meshes share one simulation. Visual verification pending.';
      element('provenance').textContent=`${selected.effect!.source.file}:${selected.effect!.source.line}\n`+
        (selected.effect!.directLaunch?`Direct emitter ${selected.effect!.directLaunch!.particle} · launched once per second for inspection`:
          `Group ${selected.effect!.id} · ${selected.effect!.items.length} launch bindings`);
    } else {
      status.classList.toggle('pending',errors.has(selected.id));status.textContent=errors.get(selected.id)??'Loading original source assets…';
      element('provenance').textContent=selected.model?.path??selected.effect?.source.file??'';
    }
    loading.textContent=view?'':errors.get(selected.id)??`Loading ${selected.name}…`;
  }
  function select(exhibit:Exhibit):void {
    selected=exhibit;nativeScale.checked=false;focus();inspect();renderResults();tick=1;
    const url=new URL(location.href);url.searchParams.set('exhibit',selected.id);history.replaceState(null,'',url);
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
    const candidates=exhibits.map(exhibit=>({exhibit,distance:camera.position.distanceToSquared(locations.get(exhibit.id)!)}))
      .filter(item=>item.distance<34*34||item.exhibit.id===selected.id).sort((a,b)=>a.distance-b.distance).slice(0,7);
    wanted=new Set([selected.id,...candidates.map(item=>item.exhibit.id)]);
    for(const [id,view] of loaded)if(!wanted.has(id)){view.dispose();loaded.delete(id);}
    for(const [id,sprite] of labels)if(!wanted.has(id)){sprite.material.map?.dispose();sprite.material.dispose();sprite.removeFromParent();labels.delete(id);}
    for(const id of wanted) {
      const exhibit=exhibits.find(entry=>entry.id===id)!;
      if(!labels.has(id))labels.set(id,label(exhibit));
      if(loaded.has(id)||pending.has(id)||errors.has(id)||pending.size>=2)continue;
      pending.add(id);
      const promise=exhibit.model?ModelExhibit.load(exhibit.model):ParticleExhibit.load(exhibit.effect!,catalogue);
      void promise.then(view=>{
        pending.delete(id);
        if(!wanted.has(id)){view.dispose();return;}
        view.root.position.copy(locations.get(id)!).setY(.16);view.setRendering(mode);scene.add(view.root);loaded.set(id,view);
        if(id===selected.id){view.setNativeScale(nativeScale.checked);inspect();if(!exploring)focus();}
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
    if(!paused)for(const view of loaded.values())view.update(dt*speed);
    tick+=dt;statsTick+=dt;if(tick>.3){tick=0;void stream();}
    if(statsTick>.25){statsTick=0;
      const view=loaded.get(selected.id);element('statistics').textContent=view instanceof ModelExhibit?
        `DISPLAY SCALE  ${view.scale.toFixed(3)}×\nANIMATION  ${view.time.toFixed(2)} s / ${view.duration.toFixed(2)} s`:
        view instanceof ParticleExhibit?`PARTICLES  ${view.motion.particles.length}\nEMISSION  ${view.motion.replayPhase}\nSOURCE CLOCK  ${view.motion.clock} / 300 Hz\nCAPACITY DROPS  ${view.motion.dropped}\nDISPLAY SCALE  ${view.scale.toFixed(3)}×`:'';
      if(view instanceof ModelExhibit&&view.duration)element<HTMLInputElement>('timeline').value=String((view.time%view.duration)/view.duration);
      element('render-stats').textContent=`${Math.round(1/Math.max(.001,frameTime))} fps · ${renderer.domElement.width}×${renderer.domElement.height} · ${loaded.size} nearby`;
    }
    renderer.render(scene,camera);
  });
  // Read-only diagnostic surface for whole-catalogue validation and inspection.
  Object.defineProperty(window,'__jakLab',{value:{catalogue,exhibits,get selected(){return selected.id;},
    get loaded(){return [...loaded.keys()];},get errors(){return Object.fromEntries(errors);},
    get diagnostics(){return Object.fromEntries([...loaded].map(([id,view])=>[id,view.diagnostics]));}}});
}
void boot().catch(error=>{loading.textContent=String(error);console.error(error);});
