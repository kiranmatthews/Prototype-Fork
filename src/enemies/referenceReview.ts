import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {preciseBounds} from '../jak-lab/modelBounds';
import './referenceReview.css';

declare const __BUILD_TAG__:string;
declare const __BUILD_CHANNEL__:string;
interface ClipFact {name:string;duration:number;channels:number;animatedNodes:number;paths:string[];maxKeys:number;}
interface AssetFact {path:string;sha256:string;decodedBytes:number;triangles:number;jointCount:number;joints:{index:number;name:string;parent?:number}[];clips:ClipFact[];}
interface Variant {id:string;name:string;label:string;asset:AssetFact;artGroup:string;frameExcludeBones?:string[];defaultAction?:string;animationRepair:{added:string[];removedWrongRig:string[]};}
interface Candidate {id:string;name:string;game:'jak1';category:string;role:string;pattern:string;adaptation:string;variants:Variant[];areas:string[];sources:{path:string;url:string}[];}
interface Audit {sourceRevision:string;summary:{characters:number;playableModels:number;exportedClips:number;recoveredClips:number};candidates:Candidate[];}
const el=<T extends HTMLElement=HTMLElement>(id:string)=>{const node=document.getElementById(id);if(!node)throw new Error(`Missing ${id}`);return node as T;};
const select=(id:string)=>el<HTMLSelectElement>(id),input=(id:string)=>el<HTMLInputElement>(id);
const siteRoot=new URL('../../',location.href),params=new URLSearchParams(location.search);
el('build-stamp').textContent=`${__BUILD_CHANNEL__} · build ${__BUILD_TAG__}`;
const stage=el('reference-stage'),status=el('model-status'),clipInput=select('clip');
const loader=new GLTFLoader(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.01,500);
scene.background=new THREE.Color(0x101b22);
const renderer=new THREE.WebGLRenderer({antialias:!params.has('lite')});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.domElement.setAttribute('aria-label','Jak 1 character preview');stage.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.25;controls.maxDistance=150;
scene.add(new THREE.HemisphereLight(0xe6f2ff,0x665e48,2.1));
const key=new THREE.DirectionalLight(0xfff1d3,2.5);key.position.set(-4,7,8);scene.add(key);
const rim=new THREE.DirectionalLight(0xafcfff,1.6);rim.position.set(6,4,-5);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:0x1a2a30,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
const grid=new THREE.GridHelper(100,100,0x3c535c,0x233940);grid.position.y=-.03;scene.add(grid);
const exhibit=new THREE.Group();scene.add(exhibit);
let audit:Audit,selected:Candidate,variant:Variant;
let model:THREE.Group|null=null,mixer:THREE.AnimationMixer|null=null,rig:THREE.SkeletonHelper|null=null;
let clips:THREE.AnimationClip[]=[],action:THREE.AnimationAction|null=null;
let bodyVertices:{mesh:THREE.Mesh;indices:number[]}[]=[];
let bounds=new THREE.Box3(),duration=0,elapsed=0,playing=params.get('paused')!=='1',loaded=false;
let request=0,abort:AbortController|null=null,currentView='quarter',errorMessage='';
const savedKey='solProtoEnemyReferenceShortlistV1';
let shortlist=new Set<string>();
try{const saved:unknown=JSON.parse(localStorage.getItem(savedKey)??'[]');if(Array.isArray(saved))shortlist=new Set(saved.filter((v):v is string=>typeof v==='string'));}catch{/* Optional browser preference. */}

function disposeModel(root:THREE.Object3D):void{
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>(),skeletons=new Set<THREE.Skeleton>();
  root.traverse(node=>{if(!(node instanceof THREE.Mesh))return;geometries.add(node.geometry);
    for(const material of Array.isArray(node.material)?node.material:[node.material]){materials.add(material);for(const value of Object.values(material))if(value instanceof THREE.Texture)textures.add(value);}
    if(node instanceof THREE.SkinnedMesh)skeletons.add(node.skeleton);
  });
  for(const item of geometries)item.dispose();for(const item of materials)item.dispose();for(const item of skeletons)item.dispose();
  const images=new Set<ImageBitmap>();for(const item of textures){if(typeof ImageBitmap!=='undefined'&&item.image instanceof ImageBitmap)images.add(item.image);item.dispose();}for(const item of images)item.close();root.removeFromParent();
}
function clearModel():void{
  mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);rig?.removeFromParent();rig?.dispose();rig=null;
  if(model)disposeModel(model);model=null;mixer=null;action=null;clips=[];bodyVertices=[];exhibit.clear();loaded=false;
}
function option(value:string,label:string):HTMLOptionElement{const node=document.createElement('option');node.value=value;node.textContent=label;return node;}
function actionName(name:string):string{
  const prefixes=[variant?.name.replace(/-lod0$/,''),selected?.id,variant?.artGroup.replace(/-ag$/,'')].filter((v):v is string=>!!v).sort((a,b)=>b.length-a.length);
  let label=name;for(const prefix of prefixes)if(label.startsWith(prefix+'-')){label=label.slice(prefix.length+1);break;}
  return label.replace(/-/g,' ').replace(/\b\w/g,s=>s.toUpperCase());
}
function renderList():void{
  const query=input('search').value.trim().toLowerCase(),category=select('category-filter').value,scope=select('scope-filter').value;
  const rows=audit.candidates.filter(row=>(category==='all'||row.category===category)&&(scope!=='saved'||shortlist.has(row.id))&&
    `${row.name} ${row.id} ${row.role} ${row.pattern} ${row.areas.join(' ')} ${row.variants.map(v=>v.label+' '+v.name).join(' ')}`.toLowerCase().includes(query));
  el('result-count').textContent=`${rows.length} characters`;
  el('candidate-list').replaceChildren(...rows.map(row=>{
    const button=document.createElement('button');button.className='candidate';button.dataset.id=row.id;button.setAttribute('aria-current',String(row.id===selected?.id));
    const title=document.createElement('strong');title.textContent=row.name;const meta=document.createElement('small');
    const actions=row.variants.reduce((sum,v)=>sum+v.asset.clips.length,0);meta.textContent=`${row.category} · ${actions} actions${row.variants.length>1?` · ${row.variants.length} variants`:''}`;
    const badge=document.createElement('span');badge.className='badge';badge.textContent=shortlist.has(row.id)?'★':'';button.append(badge,title,meta);button.onclick=()=>void choose(row.id);return button;
  }));
  if(!rows.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching characters. Try another search or category.';el('candidate-list').append(empty);}
}
function renderActions():void{
  const query=input('action-search').value.trim().toLowerCase(),visible=clips.filter(c=>(c.name+' '+actionName(c.name)).toLowerCase().includes(query));
  el('action-count').textContent=`${clips.length} actions`;
  el('action-list').replaceChildren(...visible.map(clip=>{
    const button=document.createElement('button');button.className='action';button.dataset.clip=clip.name;button.setAttribute('aria-pressed',String(clip.name===clipInput.value));
    const name=document.createElement('span');name.textContent=actionName(clip.name);const time=document.createElement('small');time.textContent=clip.duration>0?`${clip.duration.toFixed(2)} s`:'Pose';
    button.append(name,time);button.onclick=()=>setClip(clip.name);return button;
  }));
  if(!visible.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No matching actions.';el('action-list').append(empty);}
}
function updateShortlist():void{const saved=shortlist.has(selected.id);el('shortlist').textContent=saved?'★ Shortlisted':'☆ Shortlist';el('shortlist').setAttribute('aria-pressed',String(saved));}
function updateDetails():void{
  el('candidate-title').textContent=selected.name;el('candidate-role').textContent=`Jak 1 / ${selected.category} / ${variant.label}`;
  el('pattern').textContent=selected.pattern;el('adaptation').textContent=selected.adaptation;el('areas').textContent=selected.areas.join(' · ');
  el('metrics').replaceChildren(...[[variant.asset.jointCount,'joints'],[variant.asset.clips.length,'actions'],[variant.asset.triangles.toLocaleString(),'triangles']].map(([value,label])=>{
    const div=document.createElement('div');div.className='metric';const strong=document.createElement('strong');strong.textContent=String(value);const span=document.createElement('span');span.textContent=String(label);div.append(strong,span);return div;
  }));
  el('sources').replaceChildren(...selected.sources.map(source=>{const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noreferrer';a.textContent=source.path+' ↗';return a;}));
  el('diagnostics').textContent=JSON.stringify({model:variant.id,artGroup:variant.artGroup,joints:variant.asset.joints,animationRepair:variant.animationRepair},null,2);
  updateShortlist();renderList();
}
function sourceTime():number{return duration<=0?0:input('loop').checked?elapsed%duration:Math.min(elapsed,duration);}
function sample():void{
  if(mixer&&action){action.paused=false;mixer.setTime(sourceTime());}scene.updateMatrixWorld(true);if(rig)rig.visible=input('skeleton').checked;
  input('timeline').value=String(sourceTime());el('clock').textContent=duration>0?`${sourceTime().toFixed(2)} / ${duration.toFixed(2)} s`:'Single pose';el('play').textContent=playing&&duration>0?'Pause':'Play';
}
function frameCamera(view=currentView):void{
  currentView=view;scene.updateMatrixWorld(true);const box=bounds.clone().applyMatrix4(exhibit.matrixWorld);
  if(box.isEmpty())box.set(new THREE.Vector3(-2,0,-2),new THREE.Vector3(2,3,2));
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const direction=view==='front'?new THREE.Vector3(0,.08,1):view==='side'?new THREE.Vector3(1,.08,0):view==='back'?new THREE.Vector3(0,.08,-1):new THREE.Vector3(.65,.3,1).normalize();
  const radius=size.length()*.5,dist=Math.max(3.8,radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*Math.max(1,1/camera.aspect)*1.06);
  controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,dist);camera.lookAt(center);controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===view)));
}
function indexBody():void{
  bodyVertices=[];if(!model||!variant.frameExcludeBones?.length)return;
  const excluded=new Set<THREE.Object3D>();
  model.traverse(node=>{if(variant.frameExcludeBones!.includes(node.name))node.traverse(child=>excluded.add(child));});
  model.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    const geometry=node.geometry,indices=geometry.index?[...new Set(Array.from(geometry.index.array as ArrayLike<number>))]:Array.from({length:geometry.getAttribute('position').count},(_,i)=>i);
    const skinIndex=geometry.getAttribute('skinIndex'),skinWeight=geometry.getAttribute('skinWeight');
    bodyVertices.push({mesh:node,indices:node instanceof THREE.SkinnedMesh?indices.filter(index=>{
      let strongest=0;for(let component=1;component<4;component++)if(skinWeight.getComponent(index,component)>skinWeight.getComponent(index,strongest))strongest=component;
      return !excluded.has(node.skeleton.bones[skinIndex.getComponent(index,strongest)]);
    }):indices});
  });
}
function inspectionBounds():THREE.Box3{
  const complete=preciseBounds(model!);if(!bodyVertices.length||input('props').checked)return complete;
  const box=new THREE.Box3(),point=new THREE.Vector3(),inverse=exhibit.matrixWorld.clone().invert();
  for(const {mesh,indices} of bodyVertices)for(const index of indices){mesh.getVertexPosition(index,point);box.expandByPoint(point.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse));}
  return box.isEmpty()?complete:box;
}
function fitModel():void{
  if(!model)return;model.position.set(0,0,0);exhibit.scale.setScalar(1);bounds.makeEmpty();
  // SkinnedMesh refreshes its attached bind inverse in updateMatrixWorld.
  // Measuring after changing display scale must run that override first;
  // Object3D.updateWorldMatrix alone leaves the previous exhibit scale in it.
  if(mixer&&action){
    const keys=new Set<number>([0,duration]);
    for(const track of action.getClip().tracks)for(const time of track.times)keys.add(time);
    const times=[...keys].sort((a,b)=>a-b);
    // Sparse sampling misses brief reaches in elastic clips. Include every
    // authored key and the middle of each interval before fitting the camera.
    for(let i=1;i<times.length;i++)keys.add((times[i-1]+times[i])/2);
    for(const time of keys){action.reset().play();mixer.setTime(time);scene.updateMatrixWorld(true);bounds.union(inspectionBounds());}
    action.reset().play();mixer.setTime(0);
  }else{scene.updateMatrixWorld(true);bounds.copy(inspectionBounds());}
  const center=bounds.getCenter(new THREE.Vector3()),offset=new THREE.Vector3(-center.x,-bounds.min.y,-center.z);model.position.copy(offset);bounds.translate(offset);
  const size=bounds.getSize(new THREE.Vector3());exhibit.scale.setScalar(3.6/Math.max(size.x,size.y,size.z,.01));sample();frameCamera();
}
function setClip(name:string):void{
  if(!mixer||!model)return;const clip=clips.find(c=>c.name===name);if(!clip)return;
  mixer.stopAllAction();action=mixer.clipAction(clip).reset();action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();duration=clip.duration;elapsed=0;clipInput.value=name;
  input('loop').checked=/idle|walk|run|hover|patrol|charge$|spin$|swim|loop|breath|graze/.test(name);input('timeline').max=String(Math.max(duration,.001));
  for(const id of ['play','back','forward','restart','timeline'])el<HTMLButtonElement>(id).disabled=duration<=0;
  el('clip-source').textContent=name;renderActions();fitModel();const url=new URL(location.href);url.searchParams.set('clip',name);history.replaceState(null,'',url);
}
async function choose(id:string,variantId?:string):Promise<void>{
  selected=audit.candidates.find(c=>c.id===id)??audit.candidates.find(c=>c.id==='lurkercrab')!;variant=selected.variants.find(v=>v.id===variantId||v.name===variantId)??selected.variants[0];
  const token=++request;abort?.abort();abort=new AbortController();clearModel();errorMessage='';elapsed=0;duration=0;
  select('variant').replaceChildren(...selected.variants.map(v=>option(v.id,v.label)));select('variant').value=variant.id;select('variant').disabled=selected.variants.length===1;
  input('props').checked=false;el('props-control').hidden=!variant.frameExcludeBones?.length;
  input('action-search').value='';el('action-list').replaceChildren();el('action-count').textContent='Loading actions…';clipInput.replaceChildren(option('','Loading actions…'));clipInput.disabled=true;
  for(const id of ['play','back','forward','restart','timeline','previous-action','next-action'])el<HTMLButtonElement>(id).disabled=true;
  el('clip-source').textContent='';status.textContent='Loading character and actions…';updateDetails();bounds.makeEmpty();frameCamera();
  const url=new URL(location.href);url.searchParams.set('candidate',selected.id);url.searchParams.set('variant',variant.id);url.searchParams.delete('clip');history.replaceState(null,'',url);
  try{
    const asset=variant.asset,assetURL=new URL(asset.path,siteRoot),response=await fetch(assetURL,{signal:abort.signal});if(!response.ok)throw new Error(`Model transfer failed: ${response.status}`);
    const transfer=await response.arrayBuffer(),magic=new Uint8Array(transfer,0,Math.min(2,transfer.byteLength));
    const data=magic[0]===0x1f&&magic[1]===0x8b?await new Response(new Blob([transfer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer():transfer;
    if(data.byteLength!==asset.decodedBytes||new DataView(data).getUint32(0,true)!==0x46546c67)throw new Error('Incomplete character model');
    if(token!==request)return;const result=await loader.parseAsync(data,new URL('./',assetURL).href);if(token!==request){disposeModel(result.scene);return;}
    model=result.scene;clips=result.animations;mixer=new THREE.AnimationMixer(model);exhibit.add(model);rig=new THREE.SkeletonHelper(model);rig.visible=input('skeleton').checked;scene.add(rig);
    indexBody();
    if(clips.length!==asset.clips.length)throw new Error('Character action inventory does not match its model');
    clipInput.replaceChildren(...clips.map(c=>option(c.name,`${actionName(c.name)} · ${c.duration>0?c.duration.toFixed(2)+' s':'pose'}`)));clipInput.disabled=clips.length===0;
    if(clips.length)setClip(clips.find(c=>c.name===variant.defaultAction)?.name??clips.find(c=>/idle|hover|breath/.test(c.name)&&c.duration>0)?.name??clips[0].name);else{clipInput.append(option('','Rest pose'));fitModel();renderActions();}
    for(const id of ['previous-action','next-action'])el<HTMLButtonElement>(id).disabled=clips.length<2;
    loaded=true;status.textContent='';sample();
  }catch(error){if(token!==request)return;errorMessage=error instanceof Error?error.message:String(error);clearModel();status.textContent=`Could not load this character: ${errorMessage}. Select another character or retry.`;}
}
function seek(time:number):void{elapsed=Math.max(0,Math.min(duration,time));if(elapsed===duration)input('loop').checked=false;playing=false;sample();}
function resize():void{
  renderer.setPixelRatio(input('native').checked?window.devicePixelRatio||1:1);const {width,height}=stage.getBoundingClientRect();renderer.setSize(Math.max(1,width),Math.max(1,height),false);
  camera.aspect=Math.max(1,width)/Math.max(1,height);camera.updateProjectionMatrix();if(model)frameCamera();
}
new ResizeObserver(resize).observe(stage);input('native').onchange=resize;
for(const id of ['search','category-filter','scope-filter'])el(id).addEventListener(id==='search'?'input':'change',renderList);
input('action-search').oninput=renderActions;select('variant').onchange=()=>void choose(selected.id,select('variant').value);
el('shortlist').onclick=()=>{if(shortlist.has(selected.id))shortlist.delete(selected.id);else shortlist.add(selected.id);try{localStorage.setItem(savedKey,JSON.stringify([...shortlist]));}catch{status.textContent='Browser storage is unavailable. Export your shortlist to keep it.';}updateShortlist();renderList();};
el('export-shortlist').onclick=()=>{
  const rows=audit.candidates.filter(c=>shortlist.has(c.id)).map(c=>({id:c.id,name:c.name,category:c.category,variants:c.variants.map(v=>v.id),sources:c.sources.map(s=>s.url)}));
  const blob=new Blob([JSON.stringify({sourceRevision:audit.sourceRevision,candidates:rows},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='jak1-character-shortlist.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
clipInput.onchange=()=>setClip(clipInput.value);
for(const [id,step] of [['previous-action',-1],['next-action',1]] as const)el(id).onclick=()=>{if(clips.length)setClip(clips[(clips.findIndex(c=>c.name===clipInput.value)+step+clips.length)%clips.length].name);};
el('play').onclick=()=>{if(!playing&&elapsed>=duration&&!input('loop').checked)elapsed=0;playing=!playing;sample();};
el('back').onclick=()=>seek(sourceTime()-1/60);el('forward').onclick=()=>seek(sourceTime()+1/60);el('restart').onclick=()=>{elapsed=0;sample();};
input('timeline').oninput=()=>seek(Number(input('timeline').value));input('loop').onchange=()=>{elapsed=sourceTime();sample();};input('skeleton').onchange=sample;
input('props').onchange=fitModel;
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>frameCamera(button.dataset.view));
let last=performance.now();
function tick(now:number):void{
  const dt=Math.min(.05,(now-last)/1000);last=now;if(loaded&&playing&&duration>0&&!document.hidden){elapsed+=dt*Number(select('speed').value);if(!input('loop').checked&&elapsed>=duration){elapsed=duration;playing=false;}sample();}
  controls.update();renderer.render(scene,camera);requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
const api={choose,setClip,seek,setPlaying(value:boolean){playing=value;},getAudit:()=>audit,
  getFraming(){
    if(!model)return null;scene.updateMatrixWorld(true);
    const actual=inspectionBounds().applyMatrix4(exhibit.matrixWorld),projected=new THREE.Box3();
    for(const x of [actual.min.x,actual.max.x])for(const y of [actual.min.y,actual.max.y])for(const z of [actual.min.z,actual.max.z])projected.expandByPoint(new THREE.Vector3(x,y,z).project(camera));
    return {min:projected.min.toArray(),max:projected.max.toArray(),center:projected.getCenter(new THREE.Vector3()).toArray(),size:projected.getSize(new THREE.Vector3()).toArray()};
  },
  getDiagnostics(){
    scene.updateMatrixWorld(true);const bones:number[]=[];let sourceTriangles=0,vertexFingerprint=0,verticesFinite=true,morphTargets=0;const point=new THREE.Vector3();
    model?.traverse(node=>{if(node instanceof THREE.Bone)bones.push(...node.matrixWorld.elements);if(node instanceof THREE.Mesh){sourceTriangles+=(node.geometry.index?.count??node.geometry.getAttribute('position').count)/3;if(node instanceof THREE.SkinnedMesh)node.skeleton.update();morphTargets+=node.morphTargetInfluences?.length??0;
      const indices=node.geometry.index,count=indices?.count??node.geometry.getAttribute('position').count;
      for(let i=0;i<count;i+=Math.max(1,Math.floor(count/64))){node.getVertexPosition(indices?indices.getX(i):i,point);verticesFinite=verticesFinite&&point.toArray().every(Number.isFinite);vertexFingerprint+=(point.x*3+point.y*7+point.z*11)*(i+1);}
    }});
    return {candidate:selected?.id,variant:variant?.id,status:loaded?'ready':errorMessage?'error':'loading',error:errorMessage,sourceTriangles,sourceJoints:variant?.asset.jointCount,
      vertexFingerprint,verticesFinite,morphTargets,clipCount:clips.length,clip:clipInput.value,time:sourceTime(),duration,poseFingerprint:bones.reduce((sum,n,i)=>sum+n*(i+1),0),finite:bones.every(Number.isFinite),
      modelCount:exhibit.children.length,resolution:renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(),triangles:renderer.info.render.triangles,shortlist:[...shortlist]};
  }};
declare global{interface Window{__enemyReferences:typeof api;}}
window.__enemyReferences=api;
async function start():Promise<void>{
  const response=await fetch(new URL('enemies/opengoal-audit.json',siteRoot));if(!response.ok)throw new Error(`Character catalogue unavailable: ${response.status}`);audit=await response.json() as Audit;
  shortlist=new Set([...shortlist].filter(id=>audit.candidates.some(c=>c.id===id)));
  select('category-filter').replaceChildren(option('all','All characters'),...['Enemies','Bosses','Bystanders','Wildlife'].map(category=>option(category,category)));
  el('audit-summary').textContent=`${audit.summary.characters} characters · ${audit.summary.playableModels} models · ${audit.summary.exportedClips} actions`;
  await choose(params.get('candidate')??'lurkercrab',params.get('variant')??undefined);const requested=params.get('clip');if(requested&&clips.some(c=>c.name===requested))setClip(requested);
}
void start().catch(error=>{status.textContent=String(error);el('audit-summary').textContent='Character catalogue could not load.';});
window.addEventListener('pagehide',event=>{if(event.persisted)return;request++;abort?.abort();clearModel();controls.dispose();renderer.dispose();});
