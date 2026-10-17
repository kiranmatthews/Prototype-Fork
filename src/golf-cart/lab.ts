import * as THREE from 'three';
declare const __BUILD_CHANNEL__:string;
declare const __BUILD_TAG__:string;
import './lab.css';
import { GolfCartFleet } from './fleet';
import { CART_PALETTES, type CartPalette } from './model';
import { DRIVER_STYLES, type DriverStyle } from './driver';
import { buildLabCourse, labGround, LAB_OBSTACLES, LAB_ROUTES, LAB_SPAWNS } from './labCourse';

document.body.innerHTML=`<canvas aria-label="Interactive golf cart playground"></canvas>
<header><div class="eyebrow">COUNTRY CLUB MOTOR POOL</div><h1>GOLF CART<br>GARAGE</h1><p>A little cart. A lot of character.</p><div class="count">05 CARTS · ONE SHARED KIT</div></header>
<aside aria-label="Cart customisation"><h2>Make it yours.</h2><p class="description">Swap the driver. Pick a colour. Go for a spin.</p>
<label class="field"><span>Selected cart</span><select id="cart">${CART_PALETTES.map((_,i)=>`<option value="${i}">Cart 0${i+1} · ${['Lagoon','Papaya','Marigold','Bluebird','Orchid'][i]}</option>`).join('')}</select></label>
<span class="label">Paint shop</span><div id="swatches">${CART_PALETTES.map((p,i)=>`<button data-palette="${i}" style="background:${p.paint}" aria-label="${['Lagoon','Papaya','Marigold','Bluebird','Orchid'][i]} palette" aria-pressed="${i===0}"></button>`).join('')}</div>
<div class="custom-colors"><label><input id="paint" type="color" value="#08a89e">Body</label><label><input id="cream" type="color" value="#fff0bd">Roof</label><label><input id="seat" type="color" value="#f4c786">Seat</label></div>
<label class="field"><span>Who's driving?</span><select id="driver"><option value="captain">Club captain</option><option value="groundskeeper">Groundskeeper</option><option value="robot">Robot caddie</option><option value="none">Empty seat</option></select></label>
<div class="checks"><label><input type="checkbox" id="roof" checked>Canopy</label><label><input type="checkbox" id="cargo" checked>Golf bag</label></div>
<button class="primary" id="drive">Take the wheel →</button><div class="tools"><button id="repair">Repair / reset</button><button id="export">Save GLB</button><button id="recipe">Save colours</button></div><div class="tools"><button id="watch">Watch all five</button><button id="crash">Crash test</button><button id="roll-test">Roll test</button></div>
<div class="health"><span>Cart condition</span><span id="condition">Pristine</span></div><div class="healthbar"><i id="health"></i></div><p class="details">${DRIVER_STYLES.length} drivers · removable canopy & bag<br>Independent wheels · shared geometry<br>Drag to orbit · scroll to zoom</p><div class="links"><a href="./?playtest&level=country-club">Visit Country Club ↗</a> · <a href="./labs/">All labs</a></div></aside>
<div class="bottom"><div class="speed"><span id="speed">0</span><small>KM/H</small></div><div class="controls"><kbd>W</kbd><kbd>S</kbd> pedal / reverse · <kbd>A</kbd><kbd>D</kbd> steer<br><kbd>Space</kbd> drift · <kbd>Shift</kbd> hop · <kbd>R</kbd> repair · <kbd>Tab</kbd> swap cart</div></div>
<button id="camera">Fleet view</button><div id="touch"><div><button data-key="KeyA" aria-label="Steer left">◀</button><button data-key="KeyD" aria-label="Steer right">▶</button></div><div><button data-key="Space" aria-label="Handbrake">DRIFT</button><button data-key="ShiftLeft" aria-label="Spring hop">HOP</button><button data-key="KeyS" aria-label="Brake and reverse">REV</button><button data-key="KeyW" aria-label="Accelerate">GO</button></div></div><div id="toast" role="status"></div><div id="metric"></div><div id="stamp">${__BUILD_CHANNEL__} · ${__BUILD_TAG__}</div>`;

const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=document.querySelector('canvas')!;
const lite=new URLSearchParams(location.search).has('lite');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,lite?1:1.65));renderer.shadowMap.enabled=!lite;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
const scene=new THREE.Scene();scene.background=new THREE.Color('#afd6c9');scene.fog=new THREE.Fog('#afd6c9',48,125);
scene.add(new THREE.HemisphereLight('#ffefd5','#3c6d68',1.6));
const sun=new THREE.DirectionalLight('#fff1d1',2.6);sun.position.set(-18,30,13);sun.castShadow=!lite;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-45,right:45,top:40,bottom:-40,near:1,far:100});sun.shadow.bias=-.0004;sun.shadow.normalBias=.035;scene.add(sun);
const fill=new THREE.DirectionalLight('#9bdedb',.7);fill.position.set(10,8,-15);scene.add(fill);
const camera=new THREE.PerspectiveCamera(42,1,.1,180);buildLabCourse(scene);
const fleet=new GolfCartFleet({ground:labGround,spawns:LAB_SPAWNS,routes:LAB_ROUTES,obstacles:LAB_OBSTACLES});scene.add(fleet.root);
let selected=0,driving=false,autoMode=false,fleetView=false,orbitAngle=-2.45,orbitPitch=.30,distance=innerWidth<1000?8:6.5,dragging=false,lastX=0,lastY=0,paused=false,frames=0,samples=0,frameMs=0,lastMetric=0;
const keys=new Set<string>(),cameraTarget=new THREE.Vector3(),cameraGoal=new THREE.Vector3(),target=new THREE.Vector3();
let toastTimer:ReturnType<typeof setTimeout>;
function toast(text:string){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2300);}
function sync(){
  const m=fleet.models[selected];($('cart') as HTMLSelectElement).value=String(selected);($('driver') as HTMLSelectElement).value=m.socket.children.length?fleet.driverStyles[selected]:'none';
  for(const key of ['paint','cream','seat'] as const)($<HTMLInputElement>(key)).value=m.palette[key];
  for(const key of ['roof','cargo'] as const)$<HTMLInputElement>(key).checked=m.modules[key].visible;
  document.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(CART_PALETTES[Number(b.dataset.palette)].paint===m.palette.paint)));
}
function choose(index:number){selected=(index+fleet.models.length)%fleet.models.length;fleet.selected=driving?selected:-1;sync();}
function setDriving(value:boolean){autoMode=false;driving=value;fleet.selected=value?selected:-1;document.body.classList.toggle('driving',value);$('drive').textContent=value?'← Back to garage':'Take the wheel →';if(value){fleetView=false;toast('Shift to hop · Space to slide · R to repair');}else keys.clear();}
$('drive').onclick=()=>setDriving(!driving);$('repair').onclick=()=>{fleet.physics.reset(selected);fleet.present(0);toast('Freshly repaired. Try to keep it that way.');};
$<HTMLSelectElement>('cart').onchange=e=>choose(Number((e.target as HTMLSelectElement).value));
$<HTMLSelectElement>('driver').onchange=e=>{const value=(e.target as HTMLSelectElement).value;fleet.setDriver(selected,value==='none'?null:value as DriverStyle);fleet.present(0);};
for(const key of ['paint','cream','seat'] as const)$<HTMLInputElement>(key).oninput=e=>{fleet.models[selected].setPalette({[key]:(e.target as HTMLInputElement).value});sync();};
for(const key of ['roof','cargo'] as const)$<HTMLInputElement>(key).onchange=e=>fleet.models[selected].setModule(key,(e.target as HTMLInputElement).checked);
document.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach(b=>b.onclick=()=>{fleet.models[selected].setPalette(CART_PALETTES[Number(b.dataset.palette)]);sync();});
$('watch').onclick=()=>{setDriving(true);autoMode=true;fleet.selected=-1;fleetView=true;toast('Five carts on autopilot');};
$('roll-test').onclick=()=>{fleet.physics.reset(selected);const c=fleet.physics.carts[selected];Object.assign(c,{x:8,z:12,y:labGround(8,12).height,yaw:0});setDriving(true);fleet.physics.kick(selected,10,0,16);fleet.present(0);updateCamera(0);toast('Side impact! Hang on…');};
$('crash').onclick=()=>{fleet.physics.reset(selected);const c=fleet.physics.carts[selected];Object.assign(c,{x:0,z:-18,y:labGround(0,-18).height,yaw:0,vz:-15});setDriving(true);fleet.present(0);updateCamera(0);toast('Frontal impact test · real collision damage');};
$('camera').onclick=()=>{fleetView=!fleetView;$('camera').textContent=fleetView?'Close-up':'Fleet view';};
function download(blob:Blob,name:string){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=async()=>{
  try{const {GLTFExporter}=await import('three/examples/jsm/exporters/GLTFExporter.js');const clone=fleet.models[selected].root.clone(true);clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.updateMatrixWorld(true);
    const output=await new GLTFExporter().parseAsync(clone,{binary:true,onlyVisible:true});download(new Blob([output as ArrayBuffer],{type:'model/gltf-binary'}),`golf-cart-${selected+1}.glb`);toast('Modular GLB saved.');
  }catch(error){toast(`Export failed: ${error instanceof Error?error.message:String(error)}`);}
};
$('recipe').onclick=()=>download(new Blob([JSON.stringify({version:1,palette:fleet.models[selected].palette,driver:$<HTMLSelectElement>('driver').value,roof:fleet.models[selected].modules.roof.visible,cargo:fleet.models[selected].modules.cargo.visible},null,2)],{type:'application/json'}),'golf-cart-preset.json');
addEventListener('keydown',e=>{
  if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab','ShiftLeft','ShiftRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}
  if(e.repeat)return;if(e.code==='Tab')choose(selected+1);if(e.code==='KeyR')$('repair').click();if(e.code==='KeyC')$('camera').click();if(e.code==='Escape'&&driving)setDriving(false);
});addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{keys.clear();paused=document.hidden;last=performance.now();});
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-key]')){
  button.onpointerdown=e=>{e.preventDefault();if(!driving)setDriving(true);button.setPointerCapture(e.pointerId);keys.add(button.dataset.key!);};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(button.dataset.key!));
}
canvas.onpointerdown=e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!dragging)return;orbitAngle-=(e.clientX-lastX)*.008;orbitPitch=THREE.MathUtils.clamp(orbitPitch+(e.clientY-lastY)*.005,.08,1.1);lastX=e.clientX;lastY=e.clientY;};
canvas.onpointerup=canvas.onpointercancel=()=>{dragging=false;};canvas.onwheel=e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.005,3.7,15);};
const resize=()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.setViewOffset(innerWidth,innerHeight,innerWidth>760?Math.round(innerWidth*.08):0,0,innerWidth,innerHeight);camera.updateProjectionMatrix();};addEventListener('resize',resize);resize();
function updateCamera(dt:number){
  const c=fleet.physics.carts[selected];target.set(c.x,c.y+1.05,c.z);
  if(fleetView){if(driving){target.set(0,0,0);cameraGoal.set(-12,50,43);}else{target.set(-.6,1,20);cameraGoal.set(-3,16,-18);}}
  else if(driving&&!dragging){cameraGoal.set(c.x+Math.sin(c.yaw)*6.6,c.y+3.5,c.z+Math.cos(c.yaw)*6.6);target.x-=Math.sin(c.yaw)*2;target.z-=Math.cos(c.yaw)*2;}
  else cameraGoal.set(c.x+Math.sin(orbitAngle)*distance*Math.cos(orbitPitch),c.y+1.0+Math.sin(orbitPitch)*distance,c.z+Math.cos(orbitAngle)*distance*Math.cos(orbitPitch));
  const t=dt===0?1:1-Math.exp(-7*dt);camera.position.lerp(cameraGoal,t);cameraTarget.lerp(target,t);camera.lookAt(cameraTarget);
}
updateCamera(0);sync();let last=performance.now();
function frame(now:number){
  requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;if(paused)return;
  const held=(a:string,b:string)=>keys.has(a)||keys.has(b);
  if(autoMode&&keys.size){autoMode=false;fleet.selected=selected;fleetView=false;}
  fleet.input={throttle:(held('KeyW','ArrowUp')?1:0)-(held('KeyS','ArrowDown')?1:0),steer:(held('KeyA','ArrowLeft')?1:0)-(held('KeyD','ArrowRight')?1:0),brake:0,handbrake:keys.has('Space'),hop:keys.has('ShiftLeft')||keys.has('ShiftRight')};
  const begin=performance.now();if(driving)fleet.update(dt);else fleet.present(0);const simulationMs=performance.now()-begin;
  updateCamera(dt);renderer.render(scene,camera);frames++;samples++;frameMs+=dt*1000;
  if(now-lastMetric>250){const c=fleet.physics.carts[selected];$('speed').textContent=String(Math.round(Math.hypot(c.vx,c.vz)*3.6));$('health').style.width=`${c.health*100}%`;const damage=Math.max(...c.damage);$('condition').textContent=c.tumbling?'Oops. Rolling!':!c.grounded?'Airborne!':damage<.02?'Pristine':damage<.3?'Scuffed':damage<.7?'Dented':'Battered';
    $('metric').textContent=`${Math.round(1000/(frameMs/samples||16))} fps · ${fleet.stats.count} carts · ${fleet.stats.fleetTriangles.toLocaleString()} cart triangles · ${renderer.info.render.calls} draws · ${simulationMs.toFixed(1)} ms vehicle update`;
    $('metric').dataset.review=JSON.stringify({carts:fleet.stats.count,triangles:fleet.stats.fleetTriangles,drawCalls:renderer.info.render.calls,selected,position:[c.x,c.y,c.z],damage:c.damage,grounded:c.grounded,roll:c.tumbleAngle,rolls:c.rolls,recoveries:c.recoveries,airborneCount:c.airborneCount});
    lastMetric=now;samples=0;frameMs=0;
  }
}
requestAnimationFrame(frame);
// Compact, deterministic review surface: tests use the actual runtime, never a separate renderer.
const review={fleet,scene,camera,renderer,choose,setDriving,stats:()=>({...fleet.stats,frames,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,selected,driving,stamp:$('stamp').textContent}),setPalette:(patch:Partial<CartPalette>)=>{fleet.models[selected].setPalette(patch);sync();},setFleetView:(v:boolean)=>{fleetView=v;updateCamera(0);},step:(seconds:number)=>{for(let i=0;i<Math.ceil(seconds*120);i++)fleet.update(1/120);},render:()=>{updateCamera(0);renderer.render(scene,camera);}};
(window as unknown as {__golfCartLab:typeof review}).__golfCartLab=review;
addEventListener('pagehide',event=>{if(!event.persisted){fleet.dispose();renderer.dispose();}});
