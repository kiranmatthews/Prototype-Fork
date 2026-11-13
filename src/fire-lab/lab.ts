import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {SpriteFire,type FireCycleData,type FireCycle,type FireFamily} from '../spriteFire';
import {FlameHeatDistortion} from '../flameHeatDistortion';
import {FireCourtyard,COURT_FIRES,COURT_EXTRA_TORCHES} from './courtyard';
import {CourtyardWalk} from './walk';
import {EXHIBITS} from './exhibits';
import './lab.css';

declare const __BUILD_CHANNEL__:string;
declare const __BUILD_TAG__:string;

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
const courtyard=new FireCourtyard();courtyard.visible=false;scene.add(courtyard);
const courtTorches:SpriteFire[]=[];
const fireLights:THREE.PointLight[][]=EXHIBITS.map(()=>[]);fireLights[0].push(...courtyard.torchLights);
const walk=new CourtyardWalk(camera,canvas,courtyard,text=>{if(element('walk-status').textContent!==text)element('walk-status').textContent=text;});
const stationObjects:THREE.Object3D[][]=[],labels:THREE.Sprite[]=[];
const materials=new Set<THREE.Material>(),geometries=new Set<THREE.BufferGeometry>();
const cycles={} as Record<FireFamily,FireCycle>;
let selected=0,overview=true,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,time=0,speed=1,last=performance.now(),frame=0,disposed=false,raf=0,page=0;
let statsFrames=0,statsSeconds=0;
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
scene.add(new THREE.HemisphereLight('#b5d5d2','#26382f',1.35));
const sun=new THREE.DirectionalLight('#ffdaae',2.2);sun.position.set(-10,24,10);sun.castShadow=true;
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
  const light=new THREE.PointLight(colour,3.6,7,2);light.position.copy(p).add(new THREE.Vector3(0,1.2,0));scene.add(light);fireLights[i].push(light);
  const board=mesh(new THREE.PlaneGeometry(5.65,5.3),backdropMaterial,p.x,2.7,p.z-2.8);boards.push(board);
  label(EXHIBITS[i].name,i,p.x,p.z);
  stationObjects.push(scene.children.slice(first));
}

function refreshVisibility(){
  const grid=element<HTMLInputElement>('grid').checked;
  stationObjects.forEach((objects,i)=>objects.forEach(o=>o.visible=!walk.active&&(overview||i===selected)));
  fires.forEach((fire,i)=>fire.visible=walk.active||overview||i===selected);
  boards.forEach((board,i)=>board.visible=!walk.active&&grid&&!overview&&i===selected);
  labels.forEach(label=>label.visible=!walk.active&&overview);
  galleryBackdrop.visible=!walk.active&&grid&&overview;floor.visible=!walk.active;
  courtyard.visible=walk.active;courtTorches.forEach(f=>f.visible=walk.active);
}

function setWalk(active:boolean,reset=false){
  controls.enabled=!active;controls.autoRotate=false;travel=0;stage.setAttribute('aria-busy','false');
  if(active){walk.enter(reset);element<HTMLInputElement>('source-only').checked=false;fires.forEach(f=>f.sourceOnly=false);}
  else walk.leave();
  fires.forEach((f,i)=>{f.position.copy(active?new THREE.Vector3(...COURT_FIRES[i].p):locations[i]);f.scale.setScalar(active?COURT_FIRES[i].scale:1);});
  element('walk').setAttribute('aria-pressed',String(active));element('walk-hud').hidden=!active;
  element('fire-controls').hidden=!active;
  element('walk-home').hidden=!active;document.body.classList.toggle('walking',active);
  element('scene-help').textContent=active?'WASD MOVE · SHIFT RUN · SPACE JUMP · DRAG TO LOOK':'DRAG TO ORBIT · SCROLL TO ZOOM';
  if(active){element('overview').setAttribute('aria-pressed','false');element('orbit').setAttribute('aria-pressed','false');element('scene-caption').textContent='THE EMBER COURT / WALKING TOUR';history.replaceState(null,'','#court');canvas.focus();}
  refreshVisibility();
}

function size(){
  if(disposed)return;const {width,height}=stage.getBoundingClientRect();
  const native=element<HTMLSelectElement>('resolution').value==='native';
  renderer.setPixelRatio(native?devicePixelRatio:Math.min(devicePixelRatio,720/Math.max(1,height)));
  renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();
  element('render-stats').textContent=`${canvas.width} × ${canvas.height} · ${paused?'PAUSED':'LIVE'}`;
  refreshCards();if(fires.length&&overview&&!walk.active)frameCollection(false);
}
function frameCollection(animate=true){
  setWalk(false);
  overview=true;controls.autoRotate=false;element('orbit').setAttribute('aria-pressed','false');
  lookTarget.set(0,1,-4.6);
  // Keep the outer plinths inside the horizontal field of view when the
  // inspector makes a tall window's canvas almost square.
  const distance=Math.max(34,44/Math.max(.55,camera.aspect));positionTarget.set(5,distance*.57,distance*.8-4.6);
  travel=animate?1:0;stage.setAttribute('aria-busy',String(animate));if(!animate){camera.position.copy(positionTarget);controls.target.copy(lookTarget);controls.update();}
  element('overview').setAttribute('aria-pressed','true');element('scene-caption').textContent='THE COLLECTION / EIGHT STUDIES';
  history.replaceState(null,'','#collection');
  refreshVisibility();
}
function focus(){
  setWalk(false);
  stage.setAttribute('aria-busy','true');overview=false;const p=locations[selected];lookTarget.copy(p).add(new THREE.Vector3(0,1.6,0));
  const distance=Math.max(8.8,7.0/Math.max(.5,camera.aspect));positionTarget.copy(p).add(new THREE.Vector3(2.0,3.2,distance));travel=1;
  element('overview').setAttribute('aria-pressed','false');element('scene-caption').textContent=`STUDY ${String(selected+1).padStart(2,'0')} / ${EXHIBITS[selected].name.toUpperCase()}`;
  history.replaceState(null,'',`#${EXHIBITS[selected].arrangement}`);
  refreshVisibility();
}
function updateInspector(){
  const e=EXHIBITS[selected];element('exhibit-number').textContent=`${String(selected+1).padStart(2,'0')} / ${e.tag}`;
  element('exhibit-name').textContent=e.name;element('description').textContent=e.description;
  let degrees=Math.round(hues[selected]*360);if(degrees>180)degrees-=360;
  element<HTMLInputElement>('hue').value=String(degrees);element('hue-value').textContent=degrees===0?'Original':`${degrees>0?'+':''}${degrees}°`;
  document.querySelectorAll<HTMLButtonElement>('.exhibit').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));
}
function select(i:number,move=true){selected=(i+EXHIBITS.length)%EXHIBITS.length;page=Math.floor(selected/4);refreshCards();updateInspector();if(move)focus();history.replaceState(null,'',`#${walk.active?'court':EXHIBITS[selected].arrangement}`);}
const nav=element('exhibits');EXHIBITS.forEach((e,i)=>{
  const button=document.createElement('button');button.className='exhibit';button.style.setProperty('--accent',e.colour);button.setAttribute('aria-pressed',String(i===selected));button.setAttribute('aria-label',`${String(i+1).padStart(2,'0')} ${e.name}`);
  button.style.setProperty('--hue',`${e.hue*360}deg`);
  button.style.setProperty('--source',`url('${new URL(`./fire-sprites/v5/${e.family}/key.png`,document.baseURI).href}')`);
  button.innerHTML=`<span class="number">${String(i+1).padStart(2,'0')}</span><span class="mini-flame" aria-hidden="true"></span><span><span class="title">${e.name}</span><span class="kind">${e.arrangement==='embers'?'firebed':e.arrangement}</span><span class="colour-line"></span></span>`;
  button.onclick=()=>{select(i,!walk.active);if(walk.active){document.body.classList.add('court-controls');element('fire-controls').setAttribute('aria-pressed','true');size();}};nav.append(button);
});
function refreshCards(){const compact=innerWidth<=760;nav.querySelectorAll<HTMLButtonElement>('button').forEach((b,i)=>b.hidden=compact&&Math.floor(i/4)!==page);}
element('prev-page').onclick=()=>{page=1-page;refreshCards();};element('next-page').onclick=()=>{page=1-page;refreshCards();};
element('overview').onclick=()=>frameCollection();element('focus').onclick=focus;
element('walk').onclick=()=>setWalk(true);element('walk-home').onclick=()=>{walk.respawn(true);canvas.focus();};
element('fire-controls').onclick=()=>{const open=document.body.classList.toggle('court-controls');element('fire-controls').setAttribute('aria-pressed',String(open));size();};
element('orbit').onclick=()=>{if(walk.active)focus();controls.autoRotate=!controls.autoRotate;controls.autoRotateSpeed=.7;element('orbit').setAttribute('aria-pressed',String(controls.autoRotate));};
controls.addEventListener('start',()=>{travel=0;stage.setAttribute('aria-busy','false');});
function playback(){element('pause').setAttribute('aria-pressed',String(paused));element('pause').textContent=paused?'▶ Play':'Ⅱ Pause';}
element('pause').onclick=()=>{paused=!paused;playback();};element('step').onclick=()=>{paused=true;const rate=fires[selected]?.drawingRate??18;time=(Math.floor(time*rate+1e-6)+1)/rate+1e-6;playback();};
element<HTMLSelectElement>('speed').onchange=e=>speed=Number((e.target as HTMLSelectElement).value);
function setHue(degrees:number){hues[selected]=degrees/360;if(fires[selected])fires[selected].uniforms.hue.value=hues[selected];if(selected===0)courtTorches.forEach(f=>f.uniforms.hue.value=hues[0]);fireLights[selected].forEach(l=>l.color.set(EXHIBITS[selected].colour).offsetHSL(hues[selected]-EXHIBITS[selected].hue,0,0));updateInspector();}
element<HTMLInputElement>('hue').oninput=e=>setHue(Number((e.target as HTMLInputElement).value));
document.querySelectorAll<HTMLButtonElement>('[data-hue]').forEach(b=>b.onclick=()=>setHue(Number(b.dataset.hue)));
element<HTMLInputElement>('heat').onchange=e=>heat.enabled=(e.target as HTMLInputElement).checked;
element<HTMLInputElement>('heat-strength').oninput=e=>{heat.strength=Number((e.target as HTMLInputElement).value);element('heat-value').textContent=`${heat.strength.toFixed(1)}×`;};
element<HTMLInputElement>('grid').onchange=refreshVisibility;
element<HTMLInputElement>('source-only').onchange=e=>{fires.forEach(f=>f.sourceOnly=(e.target as HTMLInputElement).checked);time=0;focus();};
element<HTMLInputElement>('drawing-frame').oninput=e=>{paused=true;time=Number((e.target as HTMLInputElement).value)/(fires[selected]?.drawingRate??18)+1e-6;playback();};
element<HTMLInputElement>('interpolate').onchange=e=>[...fires,...courtTorches].forEach(f=>f.uniforms.blendFrames.value=(e.target as HTMLInputElement).checked?1:0);
element<HTMLSelectElement>('resolution').onchange=size;
element('reset').onclick=()=>{setHue(EXHIBITS[selected].hue*360);time=0;};
function keydown(e:KeyboardEvent){
  if((e.target as HTMLElement).matches('input,select,summary,button,a'))return;
  if(walk.active){if(e.code==='Escape')frameCollection();return;}
  if(e.code==='Space'){e.preventDefault();paused=!paused;playback();}
  if(e.code==='ArrowRight'){e.preventDefault();select(selected+1);}
  if(e.code==='ArrowLeft'){e.preventDefault();select(selected-1);}
  if(e.code==='Escape')frameCollection();
}
window.addEventListener('keydown',keydown);
const resizeObserver=new ResizeObserver(size);resizeObserver.observe(stage);
function draw(){
  if(disposed)return;const now=performance.now(),elapsed=Math.max(0,(now-last)/1000),dt=Math.min(elapsed,.05);last=now;
  statsFrames++;statsSeconds+=elapsed;
  if(!paused&&!document.hidden)time+=dt*speed;
  if(travel){const alpha=1-Math.exp(-dt*7);camera.position.lerp(positionTarget,alpha);controls.target.lerp(lookTarget,alpha);if(camera.position.distanceToSquared(positionTarget)<.0001){camera.position.copy(positionTarget);controls.target.copy(lookTarget);travel=0;stage.setAttribute('aria-busy','false');}}
  if(walk.active)walk.step(document.hidden?0:dt);else controls.update();camera.updateMatrixWorld();fires.forEach(f=>f.update(time,camera));if(walk.active)courtTorches.forEach(f=>f.update(time,camera));scene.updateMatrixWorld(true);
  const selectedFire=fires[selected];
  if(selectedFire){element('drawing-value').textContent=`${selectedFire.cycle.id.toUpperCase()} · ${String(selectedFire.drawingFrame+1).padStart(2,'0')} / ${selectedFire.cycle.frameCount}`;element<HTMLInputElement>('drawing-frame').max=String(selectedFire.cycle.frameCount-1);element<HTMLInputElement>('drawing-frame').value=String(selectedFire.drawingFrame);}
  heat.reviewTime=time;renderer.info.reset();
  if(!heat.render(renderer,scene,camera,null,undefined,false))renderer.render(scene,camera);
  if(frame++%30===0){const s=renderer.getDrawingBufferSize(new THREE.Vector2());element('render-stats').textContent=`${s.x} × ${s.y} · ${Math.round(statsFrames/Math.max(.001,statsSeconds))} FPS · ${paused?'PAUSED':'LIVE'}`;statsFrames=statsSeconds=0;}
  raf=requestAnimationFrame(draw);
}
async function start(){
  try{
    const base=new URL('./fire-sprites/v5/',document.baseURI);
    const response=await fetch(new URL('cycles.json',base));
    if(!response.ok)throw Error('Flame cycle manifest: '+response.status);
    const data=await response.json() as Record<FireFamily,FireCycleData>;
    const loader=new THREE.TextureLoader();
    const sharedTextures=new Map<string,Promise<THREE.Texture>>();
    function loadTexture(file:string){
      let pending=sharedTextures.get(file);
      if(!pending){pending=loader.loadAsync(new URL(file,base).href).then(texture=>{
        texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=texture.magFilter=THREE.LinearFilter;
        texture.generateMipmaps=false;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
        ownedTextures.push(texture);return texture;
      });sharedTextures.set(file,pending);}
      return pending;
    }
    await Promise.all((Object.keys(data) as FireFamily[]).map(async family=>{
      const cycle=data[family];
      const textures=await Promise.all(cycle.pages.map(page=>loadTexture(page.file)));
      cycles[family]={...cycle,textures};
    }));
    element('frame-total').textContent=Object.values(cycles).filter((c,i,all)=>all.findIndex(other=>other.motionId===c.motionId)===i).reduce((n,c)=>n+c.frameCount,0)+' SOURCE FRAMES';
    EXHIBITS.forEach((spec,i)=>{const fire=new SpriteFire(cycles[spec.family],{...spec,seed:i+1});fire.position.copy(locations[i]);fires.push(fire);scene.add(fire);});
    for(const [x,y,z] of COURT_EXTRA_TORCHES){
      const fire=new SpriteFire(cycles.narrow,{...EXHIBITS[0],seed:20+courtTorches.length,phase:Math.floor(((courtTorches.length+1)*.61803398875%1)*cycles.narrow.frameCount)});fire.position.set(x,y+2.1,z);fire.scale.setScalar(.43);courtTorches.push(fire);scene.add(fire);
      if(z>-25){const light=new THREE.PointLight(EXHIBITS[0].colour,6,5,2);light.position.set(x,y+2.5,z);courtyard.add(light);fireLights[0].push(light);}
    }
    COURT_FIRES.forEach((spec,i)=>{const light=new THREE.PointLight(EXHIBITS[i].colour,7,8,2);light.position.set(spec.p[0],spec.p[1]+.6,spec.p[2]);courtyard.add(light);fireLights[i].push(light);});
    const fragment=location.hash.slice(1),index=EXHIBITS.findIndex(e=>e.arrangement===fragment);
    updateInspector();playback();size();if(index>=0)select(index);else if(fragment==='collection')frameCollection(false);else setWalk(true,true);loading.hidden=true;last=performance.now();draw();
  }catch(error){loading.textContent=`The flame drawings could not load. Reload to try again.`;console.error(error);}
}
function dispose(){
  if(disposed)return;disposed=true;cancelAnimationFrame(raf);resizeObserver.disconnect();window.removeEventListener('keydown',keydown);walk.dispose();courtyard.dispose();controls.dispose();heat.dispose();fires.forEach(f=>f.dispose());courtTorches.forEach(f=>f.dispose());ownedTextures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());renderer.dispose();
}
window.addEventListener('pagehide',event=>{if(!event.persisted)dispose();});
// Bounded authoring hooks let the browser smoke test freeze an exact pose and
// compare the shared framebuffer heat pass without changing gameplay code.
Object.assign(window,{__fireLab:{renderer,scene,camera,controls,heat,fires,cycles,courtyard,walk,select,frameCollection,focus,
  setTime:(value:number)=>{time=value;paused=true;playback();},
  get state(){return {ready:fires.length===8,time,paused,selected,overview,walking:walk.state,transitioning:travel>0,hues:[...hues],sourceOnly:element<HTMLInputElement>('source-only').checked,families:Object.keys(cycles),frame: fires[selected]?.drawingFrame,spriteCount:fires.reduce((n,f)=>n+f.spriteCount,0)+(walk.active?courtTorches.length:0),heat:heat.diagnostics};},dispose}});
void start();
