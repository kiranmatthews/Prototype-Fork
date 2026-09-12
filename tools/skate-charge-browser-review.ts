// Local-only actual controller + authored-runtime review. No saved data writes.
import * as THREE from 'three';
import { Level } from '../src/level';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player,runtime=g.characterAnimationRuntime;
const level=new Level(g.scene,{id:'skate-charge-review',name:'Skate charge review',data:{v:1,name:'Skate charge review',spawn:[1000,.02,0],killY:-30,
  components:[{t:'platform',p:[1000,-.5,0],s:[1000,1,1000]},{t:'gate',p:[1000,0,-450]}]}});
let mode='Full ollie',frame=0,frozen=false,angle=.7,park=false,stance=-1,stopAt='None',hadAir=false,landFrame=0;
const input=()=>({moveX:0,moveY:1,jumpHeld:false,jumpPressed:false,jumpReleased:false,
  grabHeld:false,grabPressed:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,consumeEdges(){}});
function reset(next=mode){mode=next;frame=0;frozen=false;hadAir=false;landFrame=0;level.skatepark=park;p.respawn(level,true);runtime.restart();
  p.parkControls=park;p.freeSkate=true;p.speed=12;p.parkVelocity.set(0,0,-12);
  p.sidePose=p.deckPose=p.skatePose=1;p.stance=stance;p.skateMountT=-1;
}
const native=p.step.bind(p);
p.step=(dt:number)=>{
  if(frozen)return;
  const i=input(),hold=mode==='Tap ollie'?3:55;
  i.jumpHeld=mode!=='Ride'&&frame>=60&&(mode==='Hold charge'||frame<60+hold);
  i.jumpPressed=i.jumpHeld&&frame===60;i.jumpReleased=mode!=='Ride'&&mode!=='Hold charge'&&frame===60+hold;
  native(dt,i,level);level.update(dt);frame++;
  if(!p.grounded)hadAir=true;else if(hadAir&&!landFrame)landFrame=frame;
  if(stopAt==='Loaded'&&frame===60+hold||stopAt==='Extension'&&hadAir&&p.vVel>0&&p.airborneT>.10||
    stopAt==='Apex'&&hadAir&&p.vVel<=0||stopAt==='Landing'&&landFrame>0&&frame===landFrame+5)frozen=true;
  if(frame>300)reset();
};
const render=g.renderer.render.bind(g.renderer);
g.renderer.render=(...args:any[])=>{if(args[1]===g.camera){
  const target=p.pos.clone().add(new THREE.Vector3(0,1.25,0));
  g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*5.9,.6,Math.cos(angle)*5.9));
  g.camera.up.set(0,1,0);g.camera.lookAt(target);g.camera.updateMatrixWorld(true);
}return render(...args);};
const panel=document.createElement('div');panel.style.cssText='position:fixed;top:12px;left:12px;z-index:999999;background:#17232eee;color:white;padding:12px;width:290px;font:13px monospace';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='skate-charge-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;b.style.cssText='padding:6px;margin:2px';controls.append(b);};
for(const name of ['Ride','Hold charge','Tap ollie','Full ollie'])button(name,()=>reset(name));
for(const [name,a]of [['Front',Math.PI],['Side',Math.PI/2],['Behind',0],['Oblique',.7]]as const)button(name,()=>angle=a);
button('Freeze',()=>frozen=!frozen);button('Switch stance',()=>{stance=-stance;reset();});button('Campaign / Park',()=>{park=!park;reset();});
for(const name of ['None','Loaded','Extension','Apex','Landing'])button('Pause: '+name,()=>{stopAt=name;reset();});
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');
 const at=(n:string)=>p.riderG.getObjectByName(n).getWorldPosition(new THREE.Vector3());
 const knees=['left','right'].map(s=>at('knee-'+s).sub(at('hip-'+s)).angleTo(at('ankle-'+s).sub(at('knee-'+s)))*180/Math.PI);
 const d=runtime.diagnostics,c=p.boardG.userData.skateContact;
 status.textContent=JSON.stringify({mode,park,frame,frozen,stopAt,state:p.state,position:p.pos.toArray().map((n:number)=>+n.toFixed(2)),requested:d.requestedClipId,active:d.activeClipId,
  knees:knees.map(n=>+n.toFixed(1)),stance,charge:+p.chargePose.toFixed(3),grounded:p.grounded,
  vVel:+p.vVel.toFixed(2),flex:c?.bodyFlex,height:c?.bodyHeight,footError:c?.footError},null,2);
 requestAnimationFrame(report);
}
reset();report();
