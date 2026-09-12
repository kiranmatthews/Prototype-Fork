// Local-only control/pose review; never saves settings, clips or levels.
import * as THREE from 'three';
import { Level } from '../src/level';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player,runtime=g.characterAnimationRuntime;
const level=new Level(g.scene,{id:'idle-polish',name:'Idle polish',data:{v:1,name:'Idle polish',spawn:[1000,.02,0],killY:-30,
  components:[{t:'platform',p:[1000,-.5,0],s:[120,1,120]},{t:'gate',p:[1000,0,-55]}]}});
let mode='Stand',frame=0,frozen=false,angle=.7,freezeRecovery=false;
const input=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,
  grabHeld:false,grabPressed:false,spinHeld:false,spinPressed:false,grindHeld:false,grindPressed:false,consumeEdges(){}});
function reset(next:string){mode=next;frame=0;frozen=false;p.respawn(level,true);runtime.restart();}
const native=p.step.bind(p);
p.step=(dt:number)=>{
  if(frozen)return;
  const i=input();
  if(mode==='Jump charge'){i.jumpHeld=true;i.jumpPressed=frame===0;}
  if(mode==='Jump + land'){i.jumpHeld=frame<30;i.jumpPressed=frame===0;i.jumpReleased=frame===30;}
  if(mode==='Run + skid')i.moveY=frame<110?1:0;
  if(mode==='Mount'){i.moveY=1;i.jumpHeld=true;i.jumpPressed=frame===0;}
  if(mode==='Skate idle'||mode==='Skate charge'){
    p.state='ride';p.grounded=true;p.freeSkate=true;p.speed=0;p.skateMountT=-1;
    p.charging=mode==='Skate charge';p.chargeTimer=p.charging?999:0;
    p.syncVisual(i,dt);
  }else native(dt,i,level);
  level.update(dt);frame++;
  if(freezeRecovery&&runtime.diagnostics.idleRecoveryWeight>=.999)frozen=true;
};
const render=g.renderer.render.bind(g.renderer);
g.renderer.render=(...args:any[])=>{if(args[1]===g.camera){
  const target=p.pos.clone().add(new THREE.Vector3(0,1.1,0));
  g.camera.position.copy(target).add(new THREE.Vector3(Math.sin(angle)*4.8,.65,Math.cos(angle)*4.8));
  g.camera.up.set(0,1,0);g.camera.lookAt(target);g.camera.updateMatrixWorld(true);
}return render(...args);};
const panel=document.createElement('div');panel.style.cssText='position:fixed;top:12px;left:12px;z-index:999999;background:#17232eee;color:white;padding:12px;width:290px;font:13px monospace';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='idle-polish-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;b.style.cssText='padding:6px;margin:2px';controls.append(b);};
for(const name of ['Stand','Jump charge','Jump + land','Run + skid','Skate idle','Skate charge','Mount'])button(name,()=>reset(name));
for(const [name,a]of [['Front',Math.PI],['Side',Math.PI/2],['Behind',0],['Oblique',.7]]as const)button(name,()=>angle=a);
button('Freeze',()=>frozen=!frozen);button('Pause at recovered limbs',()=>freezeRecovery=!freezeRecovery);
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');
 const at=(n:string)=>p.riderG.getObjectByName(n).getWorldPosition(new THREE.Vector3());
 const knees=['left','right'].map(s=>at('knee-'+s).sub(at('hip-'+s)).angleTo(at('ankle-'+s).sub(at('knee-'+s)))*180/Math.PI);
 const d=runtime.diagnostics;
 status.textContent=JSON.stringify({mode,frame,frozen,clip:d.activeClipId,time:d.timelineTime,speed:d.authoredPlaybackSpeed,
  recovery:d.idleRecoveryWeight,knees:knees.map(n=>+n.toFixed(1)),stance:p.stance,charge:p.chargePose,grounded:p.grounded,footError:p.freeSkate?p.boardG?.userData.skateContact?.footError:undefined},null,2);
 requestAnimationFrame(report);
}
reset('Stand');report();
