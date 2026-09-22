import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createEnemyVisual } from './runtime';
import { ENEMY_KINDS, type EnemyKind, type EnemyAnimationFrame, type EnemyVisual } from './types';
import {ENEMY_NAMES} from './catalog';

const required=<T extends HTMLElement>(id:string):T=>{
  const element=document.getElementById(id);if(!element)throw new Error(`Enemy review element missing: ${id}`);
  return element as T;
};
const stage=required<HTMLDivElement>('review-stage');
const timeline=required<HTMLInputElement>('timeline'),frameInput=required<HTMLInputElement>('frame-input');
const kindInput=required<HTMLSelectElement>('enemy-kind'),stateInput=required<HTMLSelectElement>('enemy-state');
const speedInput=required<HTMLSelectElement>('playback-speed'),playButton=required<HTMLButtonElement>('play-pause');
const diagnosticsElement=required<HTMLPreElement>('review-diagnostics');
const query=new URLSearchParams(location.search);
const FPS=60;
const NAMES=ENEMY_NAMES;
interface Segment {state:string;frames:number;speed:number;}
const CYCLES:Record<EnemyKind,readonly Segment[]>={
  grunt:[{state:'patrol',frames:180,speed:2.4}],spiker:[{state:'patrol',frames:180,speed:2.2}],
  turtle:[{state:'patrol',frames:180,speed:1.5}],
  charger:[{state:'patrol',frames:96,speed:1.7},{state:'telegraph',frames:33,speed:0},{state:'dash',frames:60,speed:8},{state:'recover',frames:66,speed:0}],
  hopper:[{state:'crouch',frames:27,speed:0},{state:'leap',frames:43,speed:3.4}],
  floater:[{state:'hover',frames:156,speed:3.2},{state:'swoop',frames:48,speed:3.2}],
  sentry:[{state:'track',frames:78,speed:0},{state:'charge',frames:33,speed:0},{state:'fire',frames:9,speed:0},{state:'cooldown',frames:42,speed:0}],
  spinner:[{state:'out',frames:132,speed:0},{state:'in',frames:81,speed:0}],
};
type View='front'|'quarter'|'side'|'back'|'orbit';
const initialKind=query.get('kind');
const review={kind:ENEMY_KINDS.includes(initialKind as EnemyKind)?initialKind as EnemyKind:'all' as EnemyKind|'all',
  motion:query.get('state')??'cycle',frame:0,playing:query.get('paused')!=='1',speed:1,
  camera:(['front','quarter','side','back'].includes(query.get('view')??'')?query.get('view'):'quarter') as View,
  showBounds:false,showSkeleton:false,trackTarget:true};
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','Generated enemy models and animation states');stage.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0f1b23);
const camera=new THREE.PerspectiveCamera(35,1,.03,160);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
controls.dampingFactor=.12;controls.minDistance=1.1;controls.maxDistance=50;controls.maxPolarAngle=Math.PI*.49;
const hemi=new THREE.HemisphereLight(0xe9f5ff,0x7a7970,1.5);scene.add(hemi);
const key=new THREE.DirectionalLight(0xfff4dd,2.5);key.position.set(-5,9,7);key.castShadow=true;
key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=key.shadow.camera.bottom=-12;
key.shadow.camera.right=key.shadow.camera.top=12;key.shadow.camera.far=40;key.shadow.normalBias=.015;scene.add(key);
const rim=new THREE.DirectionalLight(0xb6d7ff,1.4);rim.position.set(5,4,-6);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:0x1b2c32,roughness:.95}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.04;floor.receiveShadow=true;scene.add(floor);
const grid=new THREE.GridHelper(40,40,0x48636b,0x2b4049);grid.position.y=-.035;scene.add(grid);
interface Actor {kind:EnemyKind;visual:EnemyVisual;home:THREE.Vector3;label:HTMLButtonElement;status:HTMLTableCellElement;
  bounds:THREE.Box3;boundsHelper:THREE.Box3Helper;skeleton:THREE.SkeletonHelper|null;frame:EnemyAnimationFrame;}
const actors:Actor[]=[];
const siteRoot=new URL('../../',location.href);
for(const [index,kind] of ENEMY_KINDS.entries()){
  const option=document.createElement('option');option.value=kind;option.textContent=`${NAMES[kind]} · ${kind}`;kindInput.append(option);
  const visual=createEnemyVisual(kind,{url:new URL(`enemies/${kind}.glb`,siteRoot).href});
  scene.add(visual.group);
  const label=document.createElement('button');label.className='actor-label';label.textContent=NAMES[kind];
  label.addEventListener('click',()=>setKind(kind));stage.append(label);
  const row=document.createElement('tr'),name=document.createElement('td'),status=document.createElement('td');
  name.textContent=kind;status.textContent='Loading…';row.append(name,status);required('roster-status').append(row);
  const bounds=new THREE.Box3(),boundsHelper=new THREE.Box3Helper(bounds,0xefba74);boundsHelper.visible=false;scene.add(boundsHelper);
  actors.push({kind,visual,home:new THREE.Vector3((index%4-1.5)*3.2,0,index<4?-2:2),label,status,bounds,boundsHelper,skeleton:null,
    frame:{state:CYCLES[kind][0].state,stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:kind!=='floater',alive:true,flung:false}});
}

function cycleFrames(kind:EnemyKind):number{return CYCLES[kind].reduce((sum,part)=>sum+part.frames,0);}
function durationFrames():number {
  if(review.motion==='defeat')return 60;if(review.motion==='flung')return 96;if(review.motion==='idle')return 180;
  if(review.motion==='cycle')return review.kind==='all'?Math.max(...ENEMY_KINDS.map(cycleFrames)):cycleFrames(review.kind);
  if(review.kind==='all')return 180;
  return CYCLES[review.kind].find(part=>part.state===review.motion)?.frames??180;
}
function selectedSegment(kind:EnemyKind,frame:number):{state:string;speed:number;time:number} {
  if(review.motion==='idle'||review.motion==='defeat'||review.motion==='flung')return {state:review.motion,speed:0,time:frame/FPS};
  if(review.motion!=='cycle'){
    const part=CYCLES[kind].find(value=>value.state===review.motion)??CYCLES[kind][0];
    return {state:part.state,speed:part.speed,time:frame/FPS};
  }
  let local=frame%cycleFrames(kind);
  for(const part of CYCLES[kind]){if(local<part.frames)return {state:part.state,speed:part.speed,time:local/FPS};local-=part.frames;}
  return {state:CYCLES[kind][0].state,speed:CYCLES[kind][0].speed,time:0};
}
function sampleActor(actor:Actor,frame:number):EnemyAnimationFrame {
  const part=selectedSegment(actor.kind,frame),time=frame/FPS;
  const alive=review.motion!=='defeat'&&review.motion!=='flung';
  const leap=actor.kind==='hopper'&&part.state==='leap';
  return {kind:actor.kind,state:part.state,stateTime:part.time,time,speed:part.speed,
    verticalVelocity:leap?8.6-24*part.time:0,grounded:actor.kind!=='floater'&&!leap,alive,flung:review.motion==='flung'};
}
function layoutActor(actor:Actor):void {
  const {visual,kind,frame}=actor,solo=review.kind!=='all',shown=!solo||review.kind===kind;
  visual.group.visible=shown;actor.label.hidden=!shown;
  visual.group.position.copy(solo?new THREE.Vector3():actor.home);visual.group.rotation.set(0,0,0);
  if(kind==='hopper'&&frame.state==='leap')visual.group.position.y=Math.max(0,8.6*frame.stateTime-12*frame.stateTime**2);
  if(kind==='floater')visual.group.position.y=frame.state==='swoop'
    ?1.65-Math.sin(Math.min(1,frame.stateTime/.8)*Math.PI)*1.3:1.65+Math.sin(frame.time*3)*.18;
  if(frame.flung){visual.group.position.y+=.65;visual.group.rotation.x=frame.stateTime*9;visual.group.rotation.y=frame.stateTime*5;}
  if(kind==='sentry')visual.body.rotation.y=review.trackTarget?Math.sin(frame.time*1.1)*.75:0;
  let width=1.3,height=1.1,cy=.55;
  if(kind==='turtle'){height=.9;cy=.42;}else if(kind==='charger')width=1.45;
  else if(kind==='floater')cy=.05;else if(kind==='sentry'){width=1.05;height=1.15;cy=.6;}
  else if(kind==='spinner')width=frame.state==='out'?2.1:.8;
  actor.bounds.setFromCenterAndSize(new THREE.Vector3(visual.group.position.x,visual.group.position.y+cy,visual.group.position.z),new THREE.Vector3(width,height,width));
  actor.boundsHelper.visible=review.showBounds&&shown;
  if(actor.skeleton)actor.skeleton.visible=review.showSkeleton&&shown;
}
function applyFrame(dt:number,frame:number):void {
  for(const actor of actors){actor.frame=sampleActor(actor,frame);layoutActor(actor);actor.visual.update(dt,actor.frame);}
}
function updateTransport():void {
  const max=durationFrames()-1;timeline.max=frameInput.max=String(max);
  timeline.value=String(review.frame);
  // A focused number field owns its draft, including a temporary empty value
  // or a number beyond the range. Playback/readiness refreshes must not erase it.
  if(document.activeElement!==frameInput)frameInput.value=String(review.frame);
  required('time-readout').textContent=`${(review.frame/FPS).toFixed(2)} / ${(max/FPS).toFixed(2)} s`;
  playButton.textContent=review.playing?'Pause':'Play';playButton.setAttribute('aria-pressed',String(review.playing));
}
function seekFrame(frame:number):void {
  review.frame=THREE.MathUtils.clamp(Math.round(Number.isFinite(frame)?frame:0),0,durationFrames()-1);
  // Replaying the adapter owns mixer time and state transitions. Setting the
  // frame metadata alone would leave imported AnimationActions at stale times.
  for(const actor of actors)actor.visual.reset();
  applyFrame(0,0);
  for(let index=1;index<=review.frame;index++)applyFrame(1/FPS,index);
  updateTransport();updateDiagnostics();
}
function refreshStateOptions():void {
  const states=review.kind==='all'?[]:CYCLES[review.kind].map(part=>part.state);
  const options=[['cycle','Combat cycle'],['idle','Idle / settle'],...states.map(value=>[value,value[0].toUpperCase()+value.slice(1)]),['defeat','Defeat · compression'],['flung','Defeat · airborne tumble']];
  if(!options.some(([value])=>value===review.motion))review.motion='cycle';
  stateInput.replaceChildren(...options.map(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option;}));
  stateInput.value=review.motion;
  required('motion-hint').textContent=review.motion==='cycle'?'Cycle through each enemy’s combat states and vulnerable windows.'
    :review.motion==='defeat'||review.motion==='flung'?'The model stays visible after defeat to reveal any animation that fails to settle.'
    :`Inspect ${review.motion} throughout its full motion, including compression and rebound.`;
}
function setKind(kind:EnemyKind|'all'):void {
  if(kind!=='all'&&!ENEMY_KINDS.includes(kind))return;
  review.kind=kind;kindInput.value=kind;refreshStateOptions();seekFrame(0);setCamera(review.camera==='orbit'?'quarter':review.camera);
  required('view-title').textContent=kind==='all'?'Full roster':`${NAMES[kind]} · ${kind}`;
}
function setMotion(motion:string):void {
  review.motion=motion;refreshStateOptions();seekFrame(0);
  if(review.camera!=='orbit')setCamera(review.camera);
}
function setPlaying(playing:boolean):void {review.playing=playing;updateTransport();updateDiagnostics();}
function setSpeed(speed:number):void {review.speed=THREE.MathUtils.clamp(speed,.1,3);speedInput.value=String(review.speed);updateDiagnostics();}
function setCamera(view:Exclude<View,'orbit'>):void {
  review.camera=view;
  const solo=review.kind!=='all',jumpingHopper=review.kind==='hopper'&&(review.motion==='cycle'||review.motion==='leap');
  const swoopingFloater=review.kind==='floater'&&(review.motion==='cycle'||review.motion==='swoop');
  const targetY=swoopingFloater?1.15:review.kind==='floater'?1.7:jumpingHopper?1.35:.65;
  const target=new THREE.Vector3(0,solo?targetY:.85,0);
  const direction=view==='front'?new THREE.Vector3(0,solo?.045:.9,1):view==='side'?new THREE.Vector3(1,solo?.045:.9,0)
    :view==='back'?new THREE.Vector3(0,solo?.045:.9,-1):new THREE.Vector3(.643,solo?.18:.8,.766);
  const halfWidth=solo?1.3:7.5,halfHeight=solo?(jumpingHopper?1.55:swoopingFloater?1.4:1.1):4.5;
  const distance=Math.max(halfHeight,halfWidth/Math.max(.4,camera.aspect))/Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  controls.target.copy(target);camera.position.copy(target).addScaledVector(direction.normalize(),distance);controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===view)));
}
function diagnostics():Record<string,unknown> {
  return {kind:review.kind,motion:review.motion,frame:review.frame,time:review.frame/FPS,totalFrames:durationFrames(),playing:review.playing,
    playbackSpeed:review.speed,camera:review.camera,cameraPosition:camera.position.toArray(),
    loaded:actors.filter(actor=>actor.visual.diagnostics.status==='ready').length,
    assets:actors.filter(actor=>review.kind==='all'||actor.kind===review.kind).map(actor=>({
      ...actor.visual.diagnostics,state:actor.frame.state,stateTime:actor.frame.stateTime,grounded:actor.frame.grounded,
      alive:actor.frame.alive,rootPosition:actor.visual.group.position.toArray(),rootScale:actor.visual.group.scale.toArray(),
    }))};
}
function updateDiagnostics():void {
  const ready=actors.filter(actor=>actor.visual.diagnostics.status==='ready').length;
  const failed=actors.filter(actor=>actor.visual.diagnostics.status==='error').length;
  required('asset-status').textContent=`${ready} / 8 models ready${failed?` · ${failed} missing`:''}`;
  required('loading-message').textContent=failed?`${failed} asset${failed===1?' is':'s are'} unavailable. Place the baked GLBs in public/enemies/ and reload assets.`
    :ready<8?'Loading generated enemy models…':'';
  for(const actor of actors){const info=actor.visual.diagnostics;actor.status.textContent=info.status==='ready'?'Ready':info.status==='error'?'Missing / failed':'Loading…';
    actor.label.dataset.status=info.status;actor.label.title=`${actor.kind} · ${info.status}${info.error?` · ${info.error}`:''}`;}
  diagnosticsElement.textContent=JSON.stringify(diagnostics(),null,2);
  document.body.dataset.readyCount=String(ready);document.body.dataset.reviewKind=review.kind;
}
const projected=new THREE.Vector3();
function positionLabels():void {
  for(const actor of actors){
    if(actor.label.hidden)continue;
    projected.copy(actor.visual.group.position);projected.y+=actor.kind==='floater'?.75:1.3;projected.project(camera);
    actor.label.style.left=`${(projected.x*.5+.5)*stage.clientWidth}px`;
    actor.label.style.top=`${(-projected.y*.5+.5)*stage.clientHeight}px`;
    actor.label.style.visibility=projected.z<1&&projected.z>-1?'visible':'hidden';
  }
}
kindInput.addEventListener('change',()=>setKind(kindInput.value as EnemyKind|'all'));
stateInput.addEventListener('change',()=>setMotion(stateInput.value));speedInput.addEventListener('change',()=>setSpeed(Number(speedInput.value)));
playButton.addEventListener('click',()=>setPlaying(!review.playing));
required('previous-frame').addEventListener('click',()=>{setPlaying(false);seekFrame(review.frame-1);});
required('next-frame').addEventListener('click',()=>{setPlaying(false);seekFrame(review.frame+1);});
required('restart').addEventListener('click',()=>seekFrame(0));
for(const input of [timeline,frameInput]){
  input.addEventListener('focus',()=>setPlaying(false));
  input.addEventListener('pointerdown',()=>setPlaying(false));
}
// Capture the user's edit before setPlaying refreshes the transport values.
timeline.addEventListener('input',()=>{const frame=Number(timeline.value);setPlaying(false);seekFrame(frame);});
function applyFrameEdit():void {
  const frame=frameInput.valueAsNumber;setPlaying(false);
  if(Number.isFinite(frame))seekFrame(frame);
}
frameInput.addEventListener('input',applyFrameEdit);
frameInput.addEventListener('change',applyFrameEdit);
frameInput.addEventListener('blur',()=>{applyFrameEdit();frameInput.value=String(review.frame);});
required<HTMLInputElement>('show-bounds').addEventListener('change',event=>{review.showBounds=(event.target as HTMLInputElement).checked;actors.forEach(layoutActor);});
required<HTMLInputElement>('show-skeleton').addEventListener('change',event=>{review.showSkeleton=(event.target as HTMLInputElement).checked;actors.forEach(layoutActor);});
required<HTMLInputElement>('track-target').addEventListener('change',event=>{review.trackTarget=(event.target as HTMLInputElement).checked;seekFrame(review.frame);});
required('reload-assets').addEventListener('click',()=>location.reload());
document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button=>button.addEventListener('click',()=>setCamera(button.dataset.camera as Exclude<View,'orbit'>)));
controls.addEventListener('start',()=>{review.camera='orbit';document.querySelectorAll<HTMLButtonElement>('[data-camera]').forEach(button=>button.setAttribute('aria-pressed','false'));});
window.addEventListener('keydown',event=>{
  if((event.target as HTMLElement)?.matches('input,select,textarea,button'))return;
  if(event.code==='Space'){event.preventDefault();setPlaying(!review.playing);}
  if(event.code==='ArrowRight'||event.code==='ArrowLeft'){event.preventDefault();setPlaying(false);seekFrame(review.frame+(event.code==='ArrowRight'?1:-1));}
});
const resize=new ResizeObserver(()=>{renderer.setSize(stage.clientWidth,stage.clientHeight,false);camera.aspect=stage.clientWidth/Math.max(1,stage.clientHeight);camera.updateProjectionMatrix();
  if(review.camera!=='orbit')setCamera(review.camera);});resize.observe(stage);
let disposed=false,animationHandle=0,lastNow=performance.now(),accumulator=0,lastDiagnostics=0;
function render(now:number):void {
  if(disposed)return;
  const elapsed=Math.min(.1,Math.max(0,(now-lastNow)/1000));lastNow=now;
  if(review.playing){
    accumulator+=elapsed*review.speed;
    while(accumulator>=1/FPS){
      accumulator-=1/FPS;
      if(review.frame>=durationFrames()-1)seekFrame(0);else{review.frame++;applyFrame(1/FPS,review.frame);}
    }
    updateTransport();
  }else accumulator=0;
  controls.update();renderer.render(scene,camera);positionLabels();
  if(now-lastDiagnostics>200){updateDiagnostics();lastDiagnostics=now;}
  animationHandle=requestAnimationFrame(render);
}
setKind(review.kind);seekFrame(Number(query.get('frame')??0));
for(const actor of actors)void actor.visual.ready.then(()=>{
  if(disposed)return;
  if(actor.visual.diagnostics.status==='ready'){
    actor.skeleton=new THREE.SkeletonHelper(actor.visual.group);actor.skeleton.visible=review.showSkeleton;scene.add(actor.skeleton);
    const material=actor.skeleton.material as THREE.LineBasicMaterial;material.depthTest=false;actor.skeleton.renderOrder=10;
  }
  seekFrame(review.frame);
});
(window as unknown as {__enemyReview:Record<string,unknown>}).__enemyReview={review,actors,scene,camera,renderer,
  setKind,setMotion,seekFrame,setCamera,setPlaying,setSpeed,getDiagnostics:diagnostics};
animationHandle=requestAnimationFrame(render);
window.addEventListener('beforeunload',()=>{
  disposed=true;cancelAnimationFrame(animationHandle);resize.disconnect();controls.dispose();
  for(const actor of actors)actor.visual.dispose();
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  scene.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.geometry)geometry.add(mesh.geometry);
    if(mesh.material)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);});
  for(const value of geometry)value.dispose();for(const value of materials)value.dispose();key.shadow.map?.dispose();renderer.dispose();
});
