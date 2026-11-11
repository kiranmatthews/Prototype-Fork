import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {SpriteFire,type SpriteFireSpec} from '../spriteFire';
import {FlameHeatDistortion} from '../flameHeatDistortion';
import './lab.css';

declare const __BUILD_CHANNEL__:string;
declare const __BUILD_TAG__:string;

const EXHIBITS:(SpriteFireSpec&{name:string;tag:string;colour:string;description:string})[]=[
  {arrangement:'torch',hue:0,name:'Golden torch',tag:'THE ORIGINAL',colour:'#ffbb61',description:'A steady golden heart with three curling tongues. The original painted flame, layered at different scales.'},
  {arrangement:'bonfire',hue:-.035,name:'Wild bonfire',tag:'GATHERING HEAT',colour:'#ff7655',description:'A wide, restless fire. Staggered flames gather around a taller core, with glowing embers drifting upward.'},
  {arrangement:'wall',hue:.025,name:'Solar curtain',tag:'LINE OF FIRE',colour:'#ffe485',description:'Seven tongues overlap into a continuous wall. A brighter yellow hue and offset timing keep the edge alive.'},
  {arrangement:'ring',hue:.25,name:'Alchemist’s ring',tag:'CLOSED CIRCUIT',colour:'#adf363',description:'A ring of small green flames with an open centre. Orbit the exhibit to see each sprite turn toward you.'},
  {arrangement:'jet',hue:.49,name:'Blue jet',tag:'UNDER PRESSURE',colour:'#84baff',description:'A fast sideways stream. The same upright artwork is turned along the jet, with sparks trailing from its tip.'},
  {arrangement:'wisp',hue:.41,name:'Spirit flame',tag:'SLOW BURN',colour:'#7bf1dc',description:'A slender cyan flame that hovers and breathes. Slower playback lets the painted curls unfold.'},
  {arrangement:'vortex',hue:.69,name:'Violet spiral',tag:'UPWARD CURRENT',colour:'#c9a0ff',description:'Nine violet tongues circle a rising column. Their orbit and staggered frames make a twisting plume.'},
  {arrangement:'embers',hue:.86,name:'Rose embers',tag:'AFTER THE FIRE',colour:'#ff9ac7',description:'A low bed of pink flames releases a tall shower of embers. Even the tiny sparks reuse the same artwork.'},
];
const element=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=element<HTMLCanvasElement>('world'),stage=element('stage'),loading=element('loading');
element('build-stamp').textContent=`${__BUILD_CHANNEL__} · ${__BUILD_TAG__}`;
const lite=new URLSearchParams(location.search).has('lite');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=!lite;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#101e24');scene.fog=new THREE.Fog('#101e24',38,95);
const camera=new THREE.PerspectiveCamera(43,1,.1,150);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=3.5;controls.maxDistance=60;controls.maxPolarAngle=Math.PI*.49;controls.minPolarAngle=.12;
const heat=new FlameHeatDistortion();
const fires:SpriteFire[]=[],boards:THREE.Mesh[]=[],ownedTextures:THREE.Texture[]=[];
const stationObjects:THREE.Object3D[][]=[],labels:THREE.Sprite[]=[];
const materials=new Set<THREE.Material>(),geometries=new Set<THREE.BufferGeometry>();
let atlas:THREE.Texture|null=null,selected=0,overview=true,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,time=0,speed=1,last=performance.now(),frame=0,disposed=false,raf=0,page=0;
const hues=EXHIBITS.map(e=>e.hue);
const locations=EXHIBITS.map((_,i)=>new THREE.Vector3((i%4-1.5)*7.3,.62,i<4?0:-9));
const lookTarget=new THREE.Vector3(),positionTarget=new THREE.Vector3();
let travel=0;
function mesh<G extends THREE.BufferGeometry,M extends THREE.Material>(geometry:G,material:M,x:number,y:number,z:number){
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);scene.add(m);geometries.add(geometry);materials.add(material);return m;
}
const metal=new THREE.MeshStandardMaterial({color:'#24393f',roughness:.6,metalness:.48});
const rim=new THREE.MeshStandardMaterial({color:'#98805c',roughness:.38,metalness:.7});
const floorMat=new THREE.MeshStandardMaterial({color:'#1c3036',roughness:.9,metalness:.08});
const floor=mesh(new THREE.PlaneGeometry(160,160),floorMat,0,-.13,-8);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
scene.add(new THREE.HemisphereLight('#c8e9ed','#26343b',2.5));
const sun=new THREE.DirectionalLight('#ffe1b8',3.1);sun.position.set(-10,24,10);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-23,right:23,top:23,bottom:-23,near:1,far:80});sun.shadow.bias=-.0003;sun.shadow.normalBias=.025;scene.add(sun);
const fill=new THREE.DirectionalLight('#7ab7d0',1.7);fill.position.set(12,9,-12);scene.add(fill);

function gridTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d')!;
  x.fillStyle='#1c3037';x.fillRect(0,0,512,512);
  for(let i=0;i<=512;i+=32){x.strokeStyle=i%128===0?'#68817e':'#394f53';x.lineWidth=i%128===0?2:1;x.beginPath();x.moveTo(i,0);x.lineTo(i,512);x.moveTo(0,i);x.lineTo(512,i);x.stroke();}
  x.strokeStyle='#e9bf82';x.lineWidth=3;x.strokeRect(3,3,506,506);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;ownedTextures.push(t);return t;
}
const backdropMaterial=new THREE.MeshStandardMaterial({map:gridTexture(),roughness:.92,side:THREE.DoubleSide});
const galleryBackdrop=mesh(new THREE.PlaneGeometry(33,6.8),backdropMaterial,0,3.3,-12.3);
function label(text:string,index:number,x:number,z:number){
  const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d')!;
  ctx.fillStyle='#10232ae8';ctx.fillRect(0,0,768,128);ctx.strokeStyle=EXHIBITS[index].colour;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(768,0);ctx.stroke();
  ctx.font='500 29px Arial';ctx.fillStyle='#dce8df';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`${String(index+1).padStart(2,'0')}  /  ${text.toUpperCase()}`,384,64);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;ownedTextures.push(t);
  const material=new THREE.SpriteMaterial({map:t,depthWrite:false,toneMapped:false});materials.add(material);
  const sprite=new THREE.Sprite(material);sprite.scale.set(4.5,.75,1);sprite.position.set(x,.35,z+3.0);scene.add(sprite);labels.push(sprite);
}
for(let i=0;i<locations.length;i++){
  const first=scene.children.length;
  const p=locations[i],colour=EXHIBITS[i].colour;
  const base=mesh(new THREE.CylinderGeometry(2.45,2.6,.6,64),metal,p.x,.17,p.z);base.castShadow=true;base.receiveShadow=true;
  const lip=mesh(new THREE.TorusGeometry(2.37,.055,8,80),rim,p.x,.49,p.z);lip.rotation.x=-Math.PI/2;
  const bowl=mesh(new THREE.CylinderGeometry(1.87,1.74,.12,48),new THREE.MeshStandardMaterial({color:'#10191b',roughness:.85}),p.x,.54,p.z);bowl.receiveShadow=true;
  const glow=mesh(new THREE.CircleGeometry(2.25,64),new THREE.MeshBasicMaterial({color:colour,transparent:true,opacity:.065,depthWrite:false,toneMapped:false}),p.x,.612,p.z);glow.rotation.x=-Math.PI/2;
  const light=new THREE.PointLight(colour,3.6,7,2);light.position.copy(p).add(new THREE.Vector3(0,1.2,0));scene.add(light);
  const board=mesh(new THREE.PlaneGeometry(5.65,5.3),backdropMaterial,p.x,2.7,p.z-2.8);boards.push(board);
  label(EXHIBITS[i].name,i,p.x,p.z);
  stationObjects.push(scene.children.slice(first));
}

function refreshVisibility(){
  const grid=element<HTMLInputElement>('grid').checked;
  stationObjects.forEach((objects,i)=>objects.forEach(o=>o.visible=overview||i===selected));
  fires.forEach((fire,i)=>fire.visible=overview||i===selected);
  boards.forEach((board,i)=>board.visible=grid&&!overview&&i===selected);
  labels.forEach(label=>label.visible=overview);
  galleryBackdrop.visible=grid&&overview;
}

function size(){
  if(disposed)return;const {width,height}=stage.getBoundingClientRect();
  const native=element<HTMLSelectElement>('resolution').value==='native';
  renderer.setPixelRatio(native?devicePixelRatio:Math.min(devicePixelRatio,720/Math.max(1,height)));
  renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();
  element('render-stats').textContent=`${canvas.width} × ${canvas.height} · ${paused?'PAUSED':'LIVE'}`;
  refreshCards();if(overview)frameCollection(false);
}
function frameCollection(animate=true){
  overview=true;controls.autoRotate=false;element('orbit').setAttribute('aria-pressed','false');
  lookTarget.set(0,1,-4.6);
  const distance=Math.max(32,34/Math.max(.55,camera.aspect));positionTarget.set(5,distance*.57,distance*.8-4.6);
  travel=animate?1:0;if(!animate){camera.position.copy(positionTarget);controls.target.copy(lookTarget);controls.update();}
  element('overview').setAttribute('aria-pressed','true');element('scene-caption').textContent='THE COLLECTION / EIGHT STUDIES';
  refreshVisibility();
}
function focus(){
  overview=false;const p=locations[selected];lookTarget.copy(p).add(new THREE.Vector3(0,1.6,0));
  const distance=Math.max(8.8,7.0/Math.max(.5,camera.aspect));positionTarget.copy(p).add(new THREE.Vector3(2.0,3.2,distance));travel=1;
  element('overview').setAttribute('aria-pressed','false');element('scene-caption').textContent=`STUDY ${String(selected+1).padStart(2,'0')} / ${EXHIBITS[selected].name.toUpperCase()}`;
  refreshVisibility();
}
function updateInspector(){
  const e=EXHIBITS[selected];element('exhibit-number').textContent=`${String(selected+1).padStart(2,'0')} / ${e.tag}`;
  element('exhibit-name').textContent=e.name;element('description').textContent=e.description;
  let degrees=Math.round(hues[selected]*360);if(degrees>180)degrees-=360;
  element<HTMLInputElement>('hue').value=String(degrees);element('hue-value').textContent=degrees===0?'Original':`${degrees>0?'+':''}${degrees}°`;
  document.querySelectorAll<HTMLButtonElement>('.exhibit').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));
}
function select(i:number,move=true){selected=(i+EXHIBITS.length)%EXHIBITS.length;page=Math.floor(selected/4);refreshCards();updateInspector();if(move)focus();history.replaceState(null,'',`#${EXHIBITS[selected].arrangement}`);}
const nav=element('exhibits');EXHIBITS.forEach((e,i)=>{
  const button=document.createElement('button');button.className='exhibit';button.style.setProperty('--accent',e.colour);button.setAttribute('aria-pressed',String(i===selected));button.setAttribute('aria-label',`${String(i+1).padStart(2,'0')} ${e.name}`);
  button.style.setProperty('--hue',`${e.hue*360}deg`);
  button.innerHTML=`<span class="number">${String(i+1).padStart(2,'0')}</span><span class="mini-flame" aria-hidden="true"></span><span><span class="title">${e.name}</span><span class="kind">${e.arrangement}</span><span class="colour-line"></span></span>`;
  button.onclick=()=>select(i);nav.append(button);
});
function refreshCards(){const compact=innerWidth<=760;nav.querySelectorAll<HTMLButtonElement>('button').forEach((b,i)=>b.hidden=compact&&Math.floor(i/4)!==page);}
element('prev-page').onclick=()=>{page=1-page;refreshCards();};element('next-page').onclick=()=>{page=1-page;refreshCards();};
element('overview').onclick=()=>frameCollection();element('focus').onclick=focus;
element('orbit').onclick=()=>{controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.7;element('orbit').setAttribute('aria-pressed',String(controls.autoRotate));};
controls.addEventListener('start',()=>{travel=0;});
function playback(){element('pause').setAttribute('aria-pressed',String(paused));element('pause').textContent=paused?'▶ Play':'Ⅱ Pause';}
element('pause').onclick=()=>{paused=!paused;playback();};element('step').onclick=()=>{paused=true;time+=1/16;playback();};
element<HTMLSelectElement>('speed').onchange=e=>speed=Number((e.target as HTMLSelectElement).value);
function setHue(degrees:number){hues[selected]=degrees/360;if(fires[selected])fires[selected].uniforms.hue.value=hues[selected];updateInspector();}
element<HTMLInputElement>('hue').oninput=e=>setHue(Number((e.target as HTMLInputElement).value));
document.querySelectorAll<HTMLButtonElement>('[data-hue]').forEach(b=>b.onclick=()=>setHue(Number(b.dataset.hue)));
element<HTMLInputElement>('heat').onchange=e=>heat.enabled=(e.target as HTMLInputElement).checked;
element<HTMLInputElement>('heat-strength').oninput=e=>{heat.strength=Number((e.target as HTMLInputElement).value);element('heat-value').textContent=`${heat.strength.toFixed(1)}×`;};
element<HTMLInputElement>('grid').onchange=refreshVisibility;
element<HTMLInputElement>('interpolate').onchange=e=>fires.forEach(f=>f.uniforms.blendFrames.value=(e.target as HTMLInputElement).checked?1:0);
element<HTMLSelectElement>('resolution').onchange=size;
element('reset').onclick=()=>{setHue(EXHIBITS[selected].hue*360);time=0;};
function keydown(e:KeyboardEvent){
  if((e.target as HTMLElement).matches('input,select,summary,button,a'))return;
  if(e.code==='Space'){e.preventDefault();paused=!paused;playback();}
  if(e.code==='ArrowRight'){e.preventDefault();select(selected+1);}
  if(e.code==='ArrowLeft'){e.preventDefault();select(selected-1);}
  if(e.code==='Escape')frameCollection();
}
window.addEventListener('keydown',keydown);
const resizeObserver=new ResizeObserver(size);resizeObserver.observe(stage);
function draw(){
  if(disposed)return;const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
  if(!paused&&!document.hidden)time+=dt*speed;
  if(travel){const alpha=1-Math.exp(-dt*7);camera.position.lerp(positionTarget,alpha);controls.target.lerp(lookTarget,alpha);if(camera.position.distanceToSquared(positionTarget)<.0001){camera.position.copy(positionTarget);controls.target.copy(lookTarget);travel=0;}}
  controls.update();camera.updateMatrixWorld();fires.forEach(f=>f.update(time,camera));scene.updateMatrixWorld(true);
  heat.reviewTime=time;renderer.info.reset();
  if(!heat.render(renderer,scene,camera,null,undefined,false))renderer.render(scene,camera);
  if(frame++%30===0){const s=renderer.getDrawingBufferSize(new THREE.Vector2());element('render-stats').textContent=`${s.x} × ${s.y} · ${paused?'PAUSED':'LIVE'}`;}
  raf=requestAnimationFrame(draw);
}
async function start(){
  try{
    atlas=await new THREE.TextureLoader().loadAsync(new URL('./fire-sprites/flame-atlas.png',document.baseURI).href);
    atlas.colorSpace=THREE.SRGBColorSpace;atlas.minFilter=atlas.magFilter=THREE.LinearFilter;atlas.generateMipmaps=false;atlas.wrapS=atlas.wrapT=THREE.ClampToEdgeWrapping;
    EXHIBITS.forEach((spec,i)=>{const fire=new SpriteFire(atlas!,{...spec,seed:i+1});fire.position.copy(locations[i]);fires.push(fire);scene.add(fire);});
    const fragment=location.hash.slice(1),index=EXHIBITS.findIndex(e=>e.arrangement===fragment);
    updateInspector();playback();size();if(index>=0)select(index);else frameCollection(false);loading.hidden=true;draw();
  }catch(error){loading.textContent=`The flame atlas could not load. Reload to try again.`;console.error(error);}
}
function dispose(){
  if(disposed)return;disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();window.removeEventListener('keydown',keydown);controls.dispose();heat.dispose();fires.forEach(f=>f.dispose());atlas?.dispose();ownedTextures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();
}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
// Bounded authoring hooks let the browser smoke test freeze an exact pose and
// compare the shared framebuffer heat pass without changing gameplay code.
Object.assign(window,{__fireLab:{renderer,scene,camera,controls,heat,fires,select,frameCollection,focus,
  setTime:(value:number)=>{time=value;paused=true;playback();},
  get state(){return {ready:fires.length===8,time,paused,selected,overview,transitioning:travel>0,hues:[...hues],spriteCount:fires.reduce((n,f)=>n+f.spriteCount,0),heat:heat.diagnostics};},dispose}});
void start();
