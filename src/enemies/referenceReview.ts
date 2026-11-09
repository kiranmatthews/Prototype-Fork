import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {preciseBounds} from '../jak-lab/modelBounds';
import {createEnemyVisual} from './runtime';
import {ENEMY_NAMES} from './catalog';
import {ENEMY_KINDS, type EnemyKind, type EnemyVisual, type EnemyAnimationFrame} from './types';
import {ENEMY_REVIEW_CYCLES} from './reviewCycles';
import './referenceReview.css';

declare const __BUILD_TAG__:string;
declare const __BUILD_CHANNEL__:string;

interface ClipFact {name:string;duration:number;channels:number;animatedNodes:number;paths:string[];maxKeys:number;}
interface AssetFact {path:string;sha256:string;decodedSha256:string;decodedBytes:number;sourceSha256:string;bytes:number;triangles:number;skinCount:number;jointCount:number;joints:{index:number;name:string;parent?:number}[];clips:ClipFact[];}
interface Candidate {id:string;name:string;game:string;model:string|null;role:string;pair:EnemyKind;priority:number;pattern:string;adaptation:string;rigNotes:string;caveat:string;availability:'playable-clips'|'inventory-only'|'source-only';asset:AssetFact|null;areas:string[];historicalClips?:string[];sources:{path:string;sha256:string;url:string;states:{name:string;line:number}[];referencedClips:string[]}[];}
interface Audit {sourceRevision:string;scope:string;summary:{candidates:number;playableModels:number;exportedClips:number};candidates:Candidate[];}
const el=<T extends HTMLElement=HTMLElement>(id:string)=>{const node=document.getElementById(id);if(!node)throw new Error(`Missing ${id}`);return node as T;};
const select=(id:string)=>el<HTMLSelectElement>(id),input=(id:string)=>el<HTMLInputElement>(id);
el('build-stamp').textContent=`${__BUILD_CHANNEL__} · build ${__BUILD_TAG__}`;
const siteRoot=new URL('../../',location.href),params=new URLSearchParams(location.search);
const stage=el('reference-stage'),status=el('model-status'),clipInput=select('clip');
const loader=new GLTFLoader(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,500);
scene.background=new THREE.Color(0x101b22);
const renderer=new THREE.WebGLRenderer({antialias:!params.has('lite')});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.domElement.setAttribute('aria-label','Source enemy and current roster comparison');stage.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=150;
scene.add(new THREE.HemisphereLight(0xe6f2ff,0x665e48,2.1));
const light=new THREE.DirectionalLight(0xfff1d3,2.5);light.position.set(-4,7,8);scene.add(light);
const rim=new THREE.DirectionalLight(0xafcfff,1.6);rim.position.set(6,4,-5);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:0x1a2a30,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
const grid=new THREE.GridHelper(100,100,0x3c535c,0x233940);grid.position.y=-.03;scene.add(grid);
const sourceGroup=new THREE.Group(),oursGroup=new THREE.Group();scene.add(sourceGroup,oursGroup);
let audit:Audit,selected:Candidate,model:THREE.Group|null=null,mixer:THREE.AnimationMixer|null=null,clips:THREE.AnimationClip[]=[],action:THREE.AnimationAction|null=null;
let ours:EnemyVisual|null=null,oursKind:EnemyKind='grunt',sourceRig:THREE.SkeletonHelper|null=null,oursRig:THREE.SkeletonHelper|null=null;
let sourceBox=new THREE.Box3(),oursBox=new THREE.Box3(),duration=1,elapsed=0,playing=params.get('paused')!=='1',loaded=false;
let request=0,loadAbort:AbortController|null=null,currentView='quarter',currentState='',previousOurFrame=-1;
const savedKey='solProtoEnemyReferenceShortlistV1';
let shortlist=new Set<string>();
try{const saved:unknown=JSON.parse(localStorage.getItem(savedKey)??'[]');if(Array.isArray(saved))shortlist=new Set(saved.filter((v):v is string=>typeof v==='string'));}catch{/* A disabled or malformed preference never prevents inspection. */}

function disposeModel(root:THREE.Object3D):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>(),skeletons=new Set<THREE.Skeleton>();
  root.traverse(node=>{if(!(node instanceof THREE.Mesh))return;geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);}if(node instanceof THREE.SkinnedMesh)skeletons.add(node.skeleton);});
  for(const item of geometries)item.dispose();for(const item of materials)item.dispose();for(const item of skeletons)item.dispose();
  const images=new Set<ImageBitmap>();for(const item of textures){if(typeof ImageBitmap!=='undefined'&&item.image instanceof ImageBitmap)images.add(item.image);item.dispose();}for(const item of images)item.close();root.removeFromParent();
}
function removeRig(rig:THREE.SkeletonHelper|null):void{if(!rig)return;rig.removeFromParent();rig.dispose();}
function clearModels():void {
  mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);removeRig(sourceRig);removeRig(oursRig);sourceRig=oursRig=null;
  if(model)disposeModel(model);model=null;mixer=null;action=null;clips=[];ours?.dispose();ours=null;sourceGroup.clear();oursGroup.clear();loaded=false;previousOurFrame=-1;
}
function option(value:string,label:string):HTMLOptionElement{const node=document.createElement('option');node.value=value;node.textContent=label;return node;}
function renderList():void {
  const query=input('search').value.trim().toLowerCase(),game=select('game-filter').value,scope=select('scope-filter').value;
  const rows=audit.candidates.filter(row=>(game==='all'||row.game===game)&&
    (scope==='all'||scope==='recommended'&&row.priority===1||scope==='saved'&&shortlist.has(row.id)||scope==='playable-clips'&&!!row.asset||scope==='unavailable'&&!row.asset)&&
    `${row.name} ${row.role} ${row.pattern} ${row.adaptation} ${row.pair}`.toLowerCase().includes(query));
  el('result-count').textContent=`${rows.length} candidates`;
  el('candidate-list').replaceChildren(...rows.map(row=>{const button=document.createElement('button');button.className='candidate';button.setAttribute('role','listitem');button.setAttribute('aria-current',String(row.id===selected?.id));button.dataset.id=row.id;
    const title=document.createElement('strong');title.textContent=row.name;const meta=document.createElement('small');meta.textContent=`${row.game.replace('jak','Jak ')} · ${row.asset?`${row.asset.clips.length} clips`:'needs extraction'} · ${row.role}`;
    const badge=document.createElement('span');badge.className='badge';badge.textContent=shortlist.has(row.id)?'★':row.priority===1?'↗':'';button.append(badge,title,meta);button.onclick=()=>void choose(row.id);return button;}));
  if(!rows.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching candidates. Change the filters or add a candidate to your shortlist.';el('candidate-list').append(empty);}
}
function updateShortlist():void{const saved=shortlist.has(selected.id);el('shortlist').textContent=saved?'★ Shortlisted':'☆ Shortlist';el('shortlist').setAttribute('aria-pressed',String(saved));}
function updateDetails():void {
  el('candidate-title').textContent=selected.name;el('candidate-role').textContent=`${selected.game.replace('jak','Jak ')} / ${selected.role} / ${selected.priority===1?'first pass':selected.priority===2?'second pass':'later study'}`;
  for(const [id,text] of [['pattern',selected.pattern],['adaptation',selected.adaptation],['rig-notes',selected.rigNotes],['caveat',selected.caveat]])el(id).textContent=text;
  el('metrics').replaceChildren(...(selected.asset?[[selected.asset.jointCount,'skin joints'],[selected.asset.clips.length,'clips'],[selected.asset.triangles.toLocaleString(),'triangles']]:[['—','rig unverified'],[selected.historicalClips?.length??'—','historical clips'],['—','mesh unavailable']]).map(([value,label])=>{const div=document.createElement('div');div.className='metric';const strong=document.createElement('strong');strong.textContent=String(value);const span=document.createElement('span');span.textContent=String(label);div.append(strong,span);return div;}));
  el('sources').replaceChildren(...selected.sources.map(source=>{const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noreferrer';a.textContent=source.path+' ↗';return a;}));
  updateShortlist();renderList();updateDiagnostics();
}
function updatePairLink():void{el<HTMLAnchorElement>('roster-link').href=`motion-review.html?kind=${oursKind}`;}
function currentFrame(time:number):EnemyAnimationFrame {
  const cycle=ENEMY_REVIEW_CYCLES[oursKind],total=cycle.reduce((sum,part)=>sum+part.frames,0);
  let frame=Math.max(0,Math.floor(time*60))%total,part=cycle[0];
  for(const segment of cycle){part=segment;if(frame<segment.frames)break;frame-=segment.frames;}
  const stateTime=frame/60,leap=oursKind==='hopper'&&part.state==='leap';
  return {kind:oursKind,state:part.state,stateTime,time,speed:part.speed,verticalVelocity:leap?8.6-24*stateTime:0,grounded:oursKind!=='floater'&&!leap,alive:true,flung:false};
}
function poseOurs(dt:number,time:number):void {
  if(!ours)return;const frame=currentFrame(time);currentState=frame.state;ours.group.position.y=0;
  if(oursKind==='hopper'&&frame.state==='leap')ours.group.position.y=Math.max(0,8.6*frame.stateTime-12*frame.stateTime**2);
  if(oursKind==='floater')ours.group.position.y=frame.state==='swoop'?1.65-Math.sin(Math.min(1,frame.stateTime/.8)*Math.PI)*1.3:1.65+Math.sin(frame.time*3)*.18;
  if(oursKind==='sentry')ours.body.rotation.y=Math.sin(frame.time*1.1)*.75;
  ours.update(dt,frame);
}
function sourceTime():number{return input('loop').checked?elapsed%duration:Math.min(elapsed,duration);}
function sampleOurs(reset:boolean):void {
  if(!ours)return;const target=Math.floor(elapsed*60);
  if(reset||target<previousOurFrame){ours.reset();poseOurs(0,0);previousOurFrame=0;}
  for(let frame=previousOurFrame+1;frame<=target;frame++)poseOurs(1/60,frame/60);
  previousOurFrame=target;
}
function sample(reset=false):void {
  if(mixer&&action){action.paused=false;mixer.setTime(sourceTime());}
  sampleOurs(reset);scene.updateMatrixWorld(true);
  if(sourceRig)sourceRig.visible=input('skeleton').checked;if(oursRig)oursRig.visible=input('skeleton').checked&&input('compare').checked;
  input('timeline').value=String(sourceTime());el('clock').textContent=`${sourceTime().toFixed(2)} / ${duration.toFixed(2)} s`;
  el('play').textContent=playing?'Pause':'Play';el('ours-label').textContent=`${ENEMY_NAMES[oursKind]} · ${currentState}`;
}
function frameCamera(view=currentView):void {
  currentView=view;
  // Keep the two exhibits beside one another in the chosen camera plane.
  // World-X separation would make them overlap in a side view.
  const compare=!!ours&&input('compare').checked;
  const azimuth=view==='side'?Math.PI/2:view==='back'?Math.PI:view==='front'?0:Math.atan2(.65,1);
  const right=new THREE.Vector3(Math.cos(azimuth),0,-Math.sin(azimuth));
  const sizeA=sourceBox.getSize(new THREE.Vector3()),sizeB=oursBox.getSize(new THREE.Vector3());
  const spanA=(Math.abs(right.x)*sizeA.x+Math.abs(right.z)*sizeA.z)*sourceGroup.scale.x;
  const spanB=(Math.abs(right.x)*sizeB.x+Math.abs(right.z)*sizeB.z)*oursGroup.scale.x;
  const separation=(spanA+spanB)/4+.65;
  sourceGroup.position.copy(right).multiplyScalar(compare?-separation:0);oursGroup.position.copy(right).multiplyScalar(separation);scene.updateMatrixWorld(true);
  const bounds=sourceBox.clone().applyMatrix4(sourceGroup.matrixWorld);
  if(ours&&input('compare').checked)bounds.union(oursBox.clone().applyMatrix4(oursGroup.matrixWorld));
  if(bounds.isEmpty())bounds.set(new THREE.Vector3(-2,0,-2),new THREE.Vector3(2,3,2));
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  const direction=view==='front'?new THREE.Vector3(0,.08,1):view==='side'?new THREE.Vector3(1,.08,0):view==='back'?new THREE.Vector3(0,.08,-1):new THREE.Vector3(.65,.4,1).normalize();
  const radius=size.length()*.5,dist=Math.max(4,radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(1,1/camera.aspect)*1.08);
  controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,dist);camera.lookAt(center);controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
}
function layout():void {
  const compare=!!ours&&input('compare').checked;oursGroup.visible=compare;
  el('ours-label').hidden=!compare;scene.updateMatrixWorld(true);frameCamera();
}
function setClip(name:string):void {
  if(!mixer||!model)return;const clip=clips.find(c=>c.name===name);if(!clip)return;
  mixer.stopAllAction();action=mixer.clipAction(clip).reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();duration=Math.max(.001,clip.duration);elapsed=0;clipInput.value=clip.name;
  input('loop').checked=/idle|walk|run|hover|patrol|charge$|spin$|swim/.test(name);input('timeline').max=String(duration);
  // Frame the complete clip rather than its often oversized straight bind pose.
  model.position.set(0,0,0);sourceGroup.scale.setScalar(1);sourceBox.makeEmpty();
  for(let i=0;i<=12;i++){action.reset().play();mixer.setTime(duration*i/12);sourceBox.union(preciseBounds(model));}
  action.reset().play();mixer.setTime(0);
  const center=sourceBox.getCenter(new THREE.Vector3()),offset=new THREE.Vector3(-center.x,-sourceBox.min.y,-center.z);
  model.position.copy(offset);sourceBox.translate(offset);const size=sourceBox.getSize(new THREE.Vector3());sourceGroup.scale.setScalar(3.2/Math.max(size.x,size.y,size.z,.01));
  sample(true);layout();updateDiagnostics();const url=new URL(location.href);url.searchParams.set('clip',name);history.replaceState(null,'',url);
}
async function loadOurs(token:number):Promise<void> {
  removeRig(oursRig);oursRig=null;ours?.dispose();ours=null;oursGroup.clear();previousOurFrame=-1;oursGroup.scale.setScalar(1);
  if(!input('compare').checked)return;
  const visual=createEnemyVisual(oursKind,{url:new URL(`enemies/${oursKind==='moa'?'moa-clean':oursKind}.glb`,siteRoot).href});
  await visual.ready;if(token!==request){visual.dispose();return;}if(visual.diagnostics.status!=='ready'){visual.dispose();throw new Error(`Our ${oursKind} model did not load`);}
  ours=visual;oursGroup.add(visual.group);poseOurs(0,0);
  oursBox=preciseBounds(visual.group);const center=oursBox.getCenter(new THREE.Vector3());
  // Centre the adapter in a separate display parent; its physics root stays unscaled.
  visual.group.position.x=-center.x;visual.group.position.z=-center.z;oursBox.translate(new THREE.Vector3(-center.x,0,-center.z));
  // Include the authored hop/hover height in camera framing.
  if(oursKind==='hopper')oursBox.max.y+=1.6;if(oursKind==='floater')oursBox.max.y+=.3;
  const size=oursBox.getSize(new THREE.Vector3());oursGroup.scale.setScalar(3.2/Math.max(size.x,size.y,size.z,.01));
  oursRig=new THREE.SkeletonHelper(visual.group);oursRig.visible=input('skeleton').checked;scene.add(oursRig);sample(true);layout();
}
async function choose(id:string):Promise<void> {
  const candidate=audit.candidates.find(c=>c.id===id);if(!candidate)return;selected=candidate;const token=++request;loadAbort?.abort();loadAbort=new AbortController();clearModels();
  oursKind=selected.pair;select('pair').value=oursKind;updatePairLink();updateDetails();elapsed=0;duration=1;
  const url=new URL(location.href);url.searchParams.set('candidate',id);url.searchParams.delete('clip');history.replaceState(null,'',url);
  clipInput.replaceChildren(option('',selected.asset?'Loading clips…':'No extracted clips available'));clipInput.disabled=true;select('pair').disabled=true;input('compare').disabled=true;
  for(const id of ['play','back','forward','restart','timeline'])el<HTMLButtonElement>(id).disabled=true;
  el('source-label').textContent=selected.asset?'OpenGOAL · source placeholder':'Source-only candidate';status.textContent=selected.asset?'Loading the complete reference rig…':'No playable model in the active export. Review the source evidence and extraction notes on the right.';
  sourceBox.makeEmpty();oursBox.makeEmpty();layout();
  if(!selected.asset){el('diagnostics').textContent=JSON.stringify({availability:selected.availability,historicalClips:selected.historicalClips??[],sources:selected.sources},null,2);return;}
  try{
    const asset=selected.asset,assetURL=new URL(asset.path,siteRoot);const response=await fetch(assetURL,{signal:loadAbort.signal});if(!response.ok||!response.body)throw new Error(`Model transfer failed: ${response.status}`);
    const transfer=await response.arrayBuffer(),magic=new Uint8Array(transfer,0,Math.min(2,transfer.byteLength));
    // A server may send Content-Encoding:gzip, which fetch already decodes.
    // GitHub Pages may instead serve the .gz file as opaque bytes. Support both.
    const data=magic[0]===0x1f&&magic[1]===0x8b
      ?await new Response(new Blob([transfer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():transfer;
    if(data.byteLength!==asset.decodedBytes||new DataView(data).getUint32(0,true)!==0x46546c67)throw new Error('Incomplete reference model');
    if(token!==request)return;const result=await loader.parseAsync(data,new URL('./',assetURL).href);if(token!==request){disposeModel(result.scene);return;}
    model=result.scene;clips=result.animations;mixer=new THREE.AnimationMixer(model);sourceGroup.add(model);
    sourceRig=new THREE.SkeletonHelper(model);sourceRig.visible=input('skeleton').checked;scene.add(sourceRig);
    clipInput.replaceChildren(...clips.map(clip=>option(clip.name,`${clip.name} · ${clip.duration>0?clip.duration.toFixed(2)+' s':'static pose'}`)));clipInput.disabled=false;
    setClip(clips.find(c=>/idle$/.test(c.name))?.name??clips[0].name);await loadOurs(token);if(token!==request)return;
    loaded=true;status.textContent='';select('pair').disabled=false;input('compare').disabled=false;for(const id of ['play','back','forward','restart','timeline'])el<HTMLButtonElement>(id).disabled=false;
    updateDiagnostics();sample(true);
  }catch(error){if(token!==request)return;loaded=false;status.textContent=`Reference unavailable: ${error instanceof Error?error.message:String(error)}. Select another candidate or reload.`;}
}
function seek(time:number):void{elapsed=Math.max(0,Math.min(duration,time));if(elapsed===duration)input('loop').checked=false;playing=false;sample(true);updateDiagnostics();}
function updateDiagnostics():void {
  if(!selected)return;el('diagnostics').textContent=JSON.stringify({availability:selected.availability,model:selected.model,
    clip:selected.asset?.clips.find(c=>c.name===clipInput.value),skinJoints:selected.asset?.joints,
    sources:selected.sources.map(s=>({file:s.path,sha256:s.sha256,states:s.states,referencedClips:s.referencedClips})),
    packedSha256:selected.asset?.sha256,sourceSha256:selected.asset?.sourceSha256},null,2);
}
function resize():void {renderer.setPixelRatio(input('native').checked?window.devicePixelRatio||1:1);const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,Math.max(1,height),false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();if(model)frameCamera();}
new ResizeObserver(resize).observe(stage);input('native').onchange=resize;
for(const id of ['search','game-filter','scope-filter'])el(id).addEventListener(id==='search'?'input':'change',()=>renderList());
el('shortlist').onclick=()=>{if(shortlist.has(selected.id))shortlist.delete(selected.id);else shortlist.add(selected.id);try{localStorage.setItem(savedKey,JSON.stringify([...shortlist]));}catch{status.textContent='Browser storage is unavailable. Export your shortlist to keep it.';}updateShortlist();renderList();};
el('export-shortlist').onclick=()=>{const rows=audit.candidates.filter(c=>shortlist.has(c.id)).map(c=>({id:c.id,name:c.name,game:c.game,pair:c.pair,adaptation:c.adaptation,availability:c.availability,sources:c.sources.map(s=>s.url)}));const blob=new Blob([JSON.stringify({sourceRevision:audit.sourceRevision,candidates:rows},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='enemy-reference-shortlist.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
clipInput.onchange=()=>setClip(clipInput.value);el('play').onclick=()=>{if(!playing&&elapsed>=duration&&!input('loop').checked)elapsed=0;playing=!playing;sample();};
el('back').onclick=()=>seek(sourceTime()-1/60);el('forward').onclick=()=>seek(sourceTime()+1/60);el('restart').onclick=()=>{elapsed=0;sample(true);};
input('timeline').oninput=()=>seek(Number(input('timeline').value));input('loop').onchange=()=>{elapsed=sourceTime();sample(true);};
input('skeleton').onchange=()=>sample();
select('pair').replaceChildren(...ENEMY_KINDS.map(kind=>option(kind,ENEMY_NAMES[kind])));
select('pair').onchange=()=>{oursKind=select('pair').value as EnemyKind;updatePairLink();const token=++request;void loadOurs(token).catch(error=>{status.textContent=String(error);});};
input('compare').onchange=()=>{const token=++request;void loadOurs(token).then(()=>layout()).catch(error=>{status.textContent=String(error);});};
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>frameCamera(button.dataset.view));
let last=performance.now();
function tick(now:number):void {const dt=Math.min(.05,(now-last)/1000);last=now;if(loaded&&playing&&!document.hidden){elapsed+=dt*Number(select('speed').value);if(!input('loop').checked&&elapsed>=duration){elapsed=duration;playing=false;}sample();}controls.update();renderer.render(scene,camera);requestAnimationFrame(tick);}
requestAnimationFrame(tick);
const api={choose,setClip,seek,setPlaying(value:boolean){playing=value;},getAudit:()=>audit,
  getDiagnostics(){scene.updateMatrixWorld(true);const bones:number[]=[];let sourceTriangles=0,vertexFingerprint=0,verticesFinite=true;const point=new THREE.Vector3();model?.traverse(node=>{if(node instanceof THREE.Bone)bones.push(...node.matrixWorld.elements);if(node instanceof THREE.Mesh){sourceTriangles+=(node.geometry.index?.count??node.geometry.getAttribute('position').count)/3;if(node instanceof THREE.SkinnedMesh)node.skeleton.update();const indices=node.geometry.index,count=indices?.count??node.geometry.getAttribute('position').count;for(let i=0;i<count;i+=Math.max(1,Math.floor(count/64))){node.getVertexPosition(indices?indices.getX(i):i,point);verticesFinite=verticesFinite&&point.toArray().every(Number.isFinite);vertexFingerprint+=(point.x*3+point.y*7+point.z*11)*(i+1);}}});return {sourceTriangles,vertexFingerprint,verticesFinite,clipCount:clips.length,candidate:selected?.id,status:loaded?'ready':selected?.asset?'loading-or-error':'unavailable',clip:clipInput.value,time:sourceTime(),duration,sourceJoints:selected?.asset?.jointCount,poseFingerprint:bones.reduce((sum,n,i)=>sum+n*(i+1),0),finite:bones.every(Number.isFinite),ourKind:oursKind,ourStatus:ours?.diagnostics.status??'hidden',ourState:currentState,ourRootScale:ours?.group.scale.toArray(),resolution:renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(),triangles:renderer.info.render.triangles,shortlist:[...shortlist]};}};
declare global{interface Window{__enemyReferences:typeof api;}}
window.__enemyReferences=api;
async function start():Promise<void>{const response=await fetch(new URL('enemies/opengoal-audit.json',siteRoot));if(!response.ok)throw new Error(`Audit unavailable: ${response.status}`);audit=await response.json() as Audit;shortlist=new Set([...shortlist].filter(id=>audit.candidates.some(c=>c.id===id)));el('audit-summary').textContent=`${audit.summary.playableModels} rigs · ${audit.summary.exportedClips} clips · ${audit.summary.candidates} candidates`;await choose(params.get('candidate')??'lurkercrab');if(!selected)await choose('lurkercrab');const requested=params.get('clip');if(requested&&clips.some(c=>c.name===requested))setClip(requested);}
void start().catch(error=>{status.textContent=String(error);el('audit-summary').textContent='Audit could not load.';});
window.addEventListener('pagehide',event=>{if(event.persisted)return;request++;loadAbort?.abort();clearModels();controls.dispose();renderer.dispose();});
