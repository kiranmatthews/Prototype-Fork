// Local review fixture: actual Level/Player contact, no saved progress or level data writes.
import * as THREE from 'three';
import { Level, type Crate } from '../src/level';
import { Player } from '../src/player';
import { CONST } from '../src/tuning';

const scene = new THREE.Scene(); scene.background = new THREE.Color('#d5dfe0');
scene.add(new THREE.HemisphereLight(0xeaf4ff,0x90816b,.9));
const key = new THREE.DirectionalLight(0xfff4db,3.8); key.position.set(3,7,5); key.castShadow=true;
key.shadow.mapSize.set(2048,2048); key.shadow.camera.left=key.shadow.camera.bottom=-6; key.shadow.camera.right=key.shadow.camera.top=6;
key.shadow.normalBias=.02;scene.add(key);
const rim = new THREE.DirectionalLight(0xc6ddff,1.1);rim.position.set(4,3,-4);scene.add(rim);
const renderer = new THREE.WebGLRenderer({antialias:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(34,1,.05,100);
const input:any={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,consumeEdges(){}};
let level:Level, player:Player, cartons:Crate[]=[];
let mode='stack', angle=-.58, freeze=true, halfSpeed=false, stopAtContact=false, accumulator=0;
let samples:object[]=[];
const size=.96;
function setup(next=mode){
  level?.dispose();if(player)scene.remove(player.group);
  mode=next;freeze=true;stopAtContact=false;samples=[];
  const components:any[]=[{t:'platform',p:[0,-.3,0],s:[16,.6,16],color:'#a9b4af',edgeGrinding:false},{t:'gate',p:[0,0,-7]}];
  if(mode==='single'||mode==='landing')components.push({t:'crate',p:[0,0,0],kind:'wood'});
  else for(let y=0;y<3;y++)for(let z=0;z<2;z++)for(let x=0;x<3;x++)components.push({t:'crate',p:[(x-1)*size,y*size,z*size],kind:'wood'});
  level=new Level(scene,{id:'milk-carton-review',name:'Milk carton review',data:{v:1,name:'Milk carton review',spawn:[4,.02,3],killY:-10,components}});
  level.root.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh)m.receiveShadow=true;});
  cartons=level.crates.filter(c=>!!c.carton);
  const visible = new Set<THREE.Object3D>([...level.groundMeshes,...cartons.map(c=>c.mesh)]);
  for(const child of level.root.children)if(!visible.has(child))child.visible=false;
  if(!player)player=new Player(scene);else scene.add(player.group);
  player.rawInput=input;player.respawn(level,true);player.prepareStartPresentation(level);player.setCharacterHeadStyle('skull');
  player.group.visible=mode==='landing';
  if(mode==='landing'){
    player.pos.set(0,3.1,0);player.prevPos.copy(player.pos);player.group.position.copy(player.pos);
    player.state='air';player.grounded=false;player.freeSkate=false;player.airFromSkate=false;player.airRose=true;
    player.airPeakY=3.1;player.airGrav='foot';player.speed=0;player.vVel=0;
    player.collapseRenderInterpolation();freeze=false;
  }
}
const nav=document.querySelector('nav')!, output=document.querySelector('output')!;
function button(name:string,fn:()=>void){const b=document.createElement('button');b.textContent=name;b.onclick=fn;nav.append(b);}
button('Single carton',()=>setup('single'));button('Stack',()=>setup('stack'));
button('Remove upper carton',()=>{const c=cartons.filter(c=>c.alive&&Math.abs(c.mesh.position.x)<.1&&c.mesh.position.z<.1).sort((a,b)=>b.mesh.position.y-a.mesh.position.y)[0];if(c)level.breakCrate(c);freeze=false;});
button('Remove bottom carton',()=>{const c=cartons.filter(c=>c.alive&&Math.abs(c.mesh.position.x)<.1&&c.mesh.position.z<.1).sort((a,b)=>a.mesh.position.y-b.mesh.position.y)[0];if(c)level.breakCrate(c);freeze=false;});
button('Land on carton',()=>setup('landing'));
button('Pause on spout contact',()=>{setup('landing');stopAtContact=true;});
button('Next physics frame',()=>{freeze=true;step();});button('Resume',()=>freeze=false);
button('Slow motion',()=>halfSpeed=!halfSpeed);
for(const [name,value] of [['Front',0],['Right',Math.PI/2],['Rear',Math.PI],['Left',-Math.PI/2],['Three quarter',-.58]] as const)button(name,()=>angle=value);
button('Dark background',()=>scene.background=new THREE.Color('#173532'));
button('Reset',()=>setup());
function step(){
  if(mode==='landing')player.step(CONST.fixedStep,input,level);
  level.update(CONST.fixedStep);player.commitRenderStep(level);
  if(mode==='landing'){
    const c=cartons[0],fold=c.carton!;
    if(c.alive&&fold.expansion<1){
      samples.push({feet:player.pos.y,spout:c.mesh.position.y+.493*size+.4*size*fold.expansion,fold:fold.expansion});
      if(stopAtContact){freeze=true;stopAtContact=false;}
    }
  }
}
let last=performance.now();setup();
function frame(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(!freeze){accumulator+=dt*(halfSpeed?.2:1);while(accumulator>=CONST.fixedStep){step();accumulator-=CONST.fixedStep;if(freeze)break;}}
  renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  const target=new THREE.Vector3(0,mode==='single'?.65:mode==='landing'?1.6:1.55,mode==='stack'?.35:0);
  const distance=mode==='single'?4.7:mode==='landing'?7.5:9;
  camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*distance,distance*.32,Math.cos(angle)*distance));camera.lookAt(target);
  const alpha=freeze?1:accumulator/CONST.fixedStep;
  player.applyRenderInterpolation(alpha);level.applyCartonRenderInterpolation(alpha);
  renderer.render(scene,camera);player.restoreRenderPose();level.restoreCartonRenderPose();
  const living=cartons.filter(c=>c.alive);
  output.textContent=JSON.stringify({mode,paused:freeze,alive:living.length,expanded:living.filter(c=>c.carton!.expansion>.01).length,feet:+player.pos.y.toFixed(4),lastContact:samples.at(-1),cratesBroken:player.cratesBroken,cartons:living.map(c=>({y:+c.mesh.position.y.toFixed(3),fold:+c.carton!.expansion.toFixed(3),covered:c.carton!.covered}))},null,2);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
