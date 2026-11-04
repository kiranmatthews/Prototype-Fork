// Local-only harness. Buttons provide visible, repeatable entry points into
// the production Level/Player path; the pilot supplies ordinary input only.
import * as THREE from 'three';
import { renderQualitySettings } from '../src/render-quality/settings';
import { JUNGLE_FRUIT_CLEARINGS } from '../src/levels/fruit-clusters';
const params=new URLSearchParams(location.search);
renderQualitySettings.setRegularResolution(params.has('native')?null:720);
await import('../src/main');
const g:any=await new Promise(resolve=>{const wait=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(wait);};wait();});
const p=g.player,panel=document.createElement('section');panel.id='fruit-review';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='fruit-runtime-status';panel.append(controls,status);document.body.append(panel);
let selected:any[]=[],frames=0,action='inspect',startFruit=0,crate:any=null,lastResult:any=null;
function button(label:string,fn:()=>void){const b=document.createElement('button');b.textContent=label;b.onclick=fn;controls.append(b);}
const round=(v:number)=>+v.toFixed(3);
const position=(at:THREE.Vector3,heading=new THREE.Vector3(0,0,-1))=>{
 const l=g.getLevel();l.root.updateMatrixWorld(true);
 const hit=new THREE.Raycaster(new THREE.Vector3(at.x,at.y+4,at.z),new THREE.Vector3(0,-1,0),0,10).intersectObjects(l.groundMeshes,false)[0];
 if(!hit)throw new Error('No supported fruit review approach');
 at.y=hit.point.y+.06;p.respawn(l,true,true,{position:at,heading});
 frames=0;action='inspect';crate=null;lastResult=null;
};
function selectCluster(index:number){
 const l=g.getLevel();
 if(params.get('level')==='beachfront'){
  const authored=l.builtFromData.components.filter((c:any)=>c.nm?.startsWith('Loose fruit /'));
  const slice=authored.slice(index*6,index*6+6);
  selected=l.pickups.filter((f:any)=>slice.some((c:any)=>f.mesh.position.distanceTo(new THREE.Vector3(...c.p))<.3));
 }else{
  const z=JUNGLE_FRUIT_CLEARINGS[index];selected=l.pickups.filter((f:any)=>f.mesh.position.z<=z+.23&&f.mesh.position.z>=z-1.63);
 }
 if(selected.length!==6)throw new Error(`Expected six cluster members; found ${selected.length}`);
 const centre=selected.reduce((sum:THREE.Vector3,f:any)=>sum.add(f.mesh.position),new THREE.Vector3()).multiplyScalar(1/6);
 const heading=selected[5].mesh.position.clone().sub(selected[1].mesh.position);heading.y=0;heading.normalize();
 position(centre.addScaledVector(heading,-4.5),heading);startFruit=p.fruit;
}
const count=params.get('level')==='beachfront'?5:4;
for(let i=0;i<count;i++)button(`Cluster ${i+1}`,()=>selectCluster(i));
button('Walk through',()=>{startFruit=p.fruit;frames=190;action='walk';});
button('Crate approach',()=>{
 const l=g.getLevel();const target=l.crates.find((c:any)=>!c.tnt&&!c.nitro&&!c.metal&&!c.bouncy&&!c.mask&&!c.mystery&&!c.life&&!c.multiHit);
 if(!target)throw new Error('No ordinary crate');
 const at=target.box.getCenter(new THREE.Vector3());at.z+=2.8;position(at);crate=target;selected=[];startFruit=p.fruit;
});
button('Walk + spin',()=>{startFruit=p.fruit;frames=160;action='spin';});
button('Respawn',()=>{p.respawn(g.getLevel(),false,true);frames=0;action='respawn';});
button('Trial on/off',()=>{const l=g.getLevel();l.setTimeTrial(!l.timeTrial);action=l.timeTrial?'trial':'ordinary';});
button('Hide panel',()=>{panel.style.display='none';});
const step=p.step.bind(p);let spinSent=false;
p.step=(dt:number,input:any,l:any)=>{
 input.moveX=0;input.moveY=frames>35&&(selected.length===0||selected.some(f=>f.alive))?1:0;
 for(const key of Object.keys(input))if(/Held|Pressed|Released/.test(key))input[key]=false;
 if(action==='spin'&&crate?.alive&&frames>0){
  const d=crate.box.distanceToPoint(p.pos.clone().add(new THREE.Vector3(0,1,0)));
  if(d<1.1&&!spinSent){input.spinHeld=true;input.spinPressed=true;spinSent=true;}
 }else spinSent=false;
 step(dt,input,l);
 if(frames>0&&--frames===0){
  lastResult={action,fruitDelta:p.fruit-startFruit,collected:selected.filter(f=>!f.alive).length,crateBroken:crate?!crate.alive:null,deaths:p.totalDeaths,position:p.pos.toArray().map(round)};
 }
};
function report(){const l=g.getLevel();status.textContent=JSON.stringify({
 level:l.name,action,frames,position:p.pos.toArray().map(round),grounded:p.grounded,
 cluster:selected.length,remaining:selected.filter(f=>f.alive).length,visible:selected.filter(f=>f.mesh.visible).length,
 fruit:p.fruit,delta:p.fruit-startFruit,flights:p.fruits.filter((f:any)=>f.phase!=='off').map((f:any)=>f.phase),
 variants:selected.map(f=>f.mesh.userData.milkVariant),material:selected[0]?.mesh.children[0].material.name,
 quality:g.getRenderQualitySizes(),trial:l.timeTrial,result:lastResult,
 },null,1);requestAnimationFrame(report);}
selectCluster(0);report();
