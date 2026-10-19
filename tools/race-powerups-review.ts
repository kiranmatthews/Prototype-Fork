/** Development-only visual review and local icon baker. No external assets. */
import * as THREE from 'three';
import { createRaceItemModel, disposeRaceItemModel } from '../src/race/items';
import { RaceItemEffects } from '../src/race/effects';
import { RACE_ITEMS, type RaceItem } from '../src/race/types';
if(!import.meta.env.DEV)throw new Error('Power-up review is development-only');
const grid=document.querySelector<HTMLElement>('#grid')!,stage=document.querySelector<HTMLElement>('#effects')!,status=document.querySelector<HTMLElement>('#status')!,select=document.querySelector<HTMLSelectElement>('#kind')!;
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setSize(innerWidth,innerHeight);document.body.prepend(renderer.domElement);
const cards=Object.entries(RACE_ITEMS).map(([kind,info])=>{
 const card=document.createElement('article');card.className='card';const target=document.createElement('div');target.className='stage';card.append(target);
 const model=createRaceItemModel(kind),scene=new THREE.Scene();scene.add(model);
 let triangles=0;model.traverse(o=>{if(o instanceof THREE.Mesh)triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
 const label=document.createElement('div');label.className='label';label.textContent=info.name;card.append(label);const budget=document.createElement('div');budget.className='budget';budget.textContent=`${triangles} triangles · ${model.children.length} draw${model.children.length===1?'':'s'}`;card.append(budget);grid.append(card);
 const option=document.createElement('option');option.value=kind;option.textContent=info.name;select.append(option);
 const camera=new THREE.PerspectiveCamera(32,1,.1,50);camera.position.set(2.1,2.35,5.2);camera.lookAt(0,.15,0);
 return {kind,model,scene,camera,target};
});
const fxScene=new THREE.Scene(),root=new THREE.Group();fxScene.add(root);const fx=new RaceItemEffects(root),camera=new THREE.PerspectiveCamera(48,1,.1,150);camera.position.set(11,9,15);camera.lookAt(0,1,0);camera.updateMatrixWorld();fx.updateView(camera);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:0x306343}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;fxScene.add(floor);
const road=new THREE.Mesh(new THREE.PlaneGeometry(6,100),new THREE.MeshBasicMaterial({color:0x648667}));road.rotation.x=-Math.PI/2;road.position.y=-.02;fxScene.add(road);
for(let i=-4;i<5;i++){const line=new THREE.Mesh(new THREE.PlaneGeometry(.1,2),new THREE.MeshBasicMaterial({color:0xb6c6a3}));line.rotation.x=-Math.PI/2;line.position.set(0,0,i*5);fxScene.add(line);}
const at=new THREE.Vector3(0,.15,0),heading=new THREE.Vector3(0,0,-1);let fxMode=false,rotate=false,frozen=false,busy=false,age=0,clock=0,last=performance.now(),display:THREE.Group|undefined;
function selectModel(){if(display)disposeRaceItemModel(display);display=createRaceItemModel(select.value);display.position.set(0,1.1,0);root.add(display);}
function burst(){if(select.value==='shock-shell')fx.lightning(at);else fx.burst(select.value as RaceItem,at);}
select.value='mushroom';selectModel();select.onchange=()=>{fx.clear();selectModel();burst();};
document.querySelector<HTMLButtonElement>('#models')!.onclick=()=>{fxMode=false;grid.hidden=false;stage.hidden=true;document.body.classList.remove('fx');};
document.querySelector<HTMLButtonElement>('#fx')!.onclick=()=>{fxMode=true;grid.hidden=true;stage.hidden=false;document.body.classList.add('fx');burst();};
document.querySelector<HTMLButtonElement>('#rotate')!.onclick=e=>{rotate=!rotate;(e.target as HTMLButtonElement).textContent=rotate?'Pause rotation':'Resume rotation';};
document.querySelector<HTMLButtonElement>('#freeze')!.onclick=e=>{frozen=!frozen;(e.target as HTMLButtonElement).textContent=frozen?'Resume effects':'Pause effects';};
document.querySelector<HTMLButtonElement>('#burst')!.onclick=()=>{frozen=false;document.querySelector('#freeze')!.textContent='Pause effects';burst();};
document.querySelector<HTMLButtonElement>('#stress')!.onclick=()=>{busy=!busy;};
document.querySelector<HTMLButtonElement>('#bake')!.onclick=()=>{
 const result:Record<string,string>={};const bake=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});bake.setSize(192,192);bake.setClearColor(0,0);bake.outputColorSpace=THREE.SRGBColorSpace;
 for(const card of cards){const scene=new THREE.Scene(),model=createRaceItemModel(card.kind);scene.add(model);const c=new THREE.PerspectiveCamera(32,1,.1,30);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());const distance=Math.max(size.x,size.y,size.z)*2.25;c.position.copy(center).add(new THREE.Vector3(.35,.37,1).normalize().multiplyScalar(distance));c.lookAt(center);bake.render(scene,c);result[card.kind]=bake.domElement.toDataURL('image/webp',.9);disposeRaceItemModel(model);}
 bake.dispose();const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(result)],{type:'application/json'}));a.download='race-powerup-pictures.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);status.textContent='Baked twelve 192px HUD pictures from the actual Gouraud models.';
};
function viewport(target:HTMLElement){const r=target.getBoundingClientRect();renderer.setViewport(r.x,innerHeight-r.bottom,r.width,r.height);renderer.setScissor(r.x,innerHeight-r.bottom,r.width,r.height);return r.width/r.height;}
function frame(now:number){
 const dt=Math.min(.05,(now-last)/1000);last=now;renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);renderer.info.autoReset=false;renderer.info.reset();
 if(fxMode){
  if(!frozen){age+=dt;clock+=dt;if(display){display.rotation.y=age*.8;display.position.y=1.1+Math.sin(age*2)*.1;}
   if(clock>1/24){clock%=1/24;fx.wake(select.value as RaceItem,at,heading,age);if(busy)for(let i=0;i<8;i++){at.set((i%4-1.5)*3,.15,Math.floor(i/4)*5-2);fx.wake(i%2?'star':'mushroom',at,heading,age,i);}at.set(0,.15,0);}
   fx.update(dt);
  }
  camera.aspect=viewport(stage);camera.updateProjectionMatrix();renderer.render(fxScene,camera);status.textContent=`${RACE_ITEMS[select.value as RaceItem].name} · ${JSON.stringify(fx.stats)} · no textures / lights / bloom`;
 }else{
  for(const card of cards){if(rotate)card.model.rotation.y+=dt*.32;card.camera.aspect=viewport(card.target);card.camera.updateProjectionMatrix();renderer.render(card.scene,card.camera);}
  status.textContent=`12 shared models · ${renderer.info.render.calls} draws total · ${renderer.info.render.triangles.toLocaleString()} triangles · native Gouraud vertex shading`;
 }
 requestAnimationFrame(frame);
}requestAnimationFrame(frame);addEventListener('resize',()=>renderer.setSize(innerWidth,innerHeight));
