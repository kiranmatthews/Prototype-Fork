// Local-only native controller review. It does not save settings or progress.
import * as THREE from 'three';
import {Level} from '../src/level';
import {CONST} from '../src/tuning';
const game:any=await new Promise(resolve=>{const poll=()=>{const g=(window as any).__game;if(g)resolve(g);else requestAnimationFrame(poll);};poll();});
const p=game.player,arena=new Level(game.scene,{id:'wall-facing-browser',name:'Wall facing',data:{v:1,name:'Wall facing',spawn:[1000.15,3,0],killY:-30,
  components:[{t:'platform',p:[1000,-.5,0],s:[120,1,140]},{t:'wall',p:[999.65,0,0],s:[.2,12,120]},{t:'gate',p:[1000,0,-60]}]}});
let toward=true,travel='Forward',frame=0,ever=false;
const input=()=>({moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:true,grindPressed:false,
  grabHeld:false,grabPressed:false,spinHeld:false,spinPressed:false,transferHeld:false,transferPressed:false,restartPressed:false,consumeEdges(){}});
function reset(){
  p.respawn(arena,true);game.characterAnimationRuntime.restart();
  p.freeSkate=p.airFromSkate=true;p.skateMountT=-1;p.sidePose=p.deckPose=p.skatePose=1;p.parkControls=false;
  p.stance=travel==='Reverse'?-1:1;p.state='air';p.grounded=false;p.speed=0;p.wallriding=false;p.wallridePose=0;
  p.visualYaw=(toward?Math.PI/2:-Math.PI/2)-p.stance*Math.PI/2;
  p.pos.set(999.75+CONST.playerHalf.x-.025,3,0);p.prevPos.copy(p.pos);p.syncVisual(input(),1/60);
  p.axisF.set(travel==='Head-on'?-1:0,0,travel==='Reverse'?1:travel==='Head-on'?0:-1);
  p.axisL.set(p.axisF.z,0,-p.axisF.x);p.speed=travel.startsWith('Vertical')?0:12;p.vVel=travel==='Vertical up'?9:travel==='Vertical down'?-9:2;
  p.airMomentum=true;p.airGrav='board';frame=0;ever=false;
}
const native=p.step.bind(p);
p.step=(dt:number)=>{native(dt,input(),arena);arena.update(dt);ever||=p.wallriding;if(++frame>160)reset();};
const render=game.renderer.render.bind(game.renderer);
game.renderer.render=(...args:any[])=>{
  if(args[1]===game.camera){const target=p.pos.clone().add(new THREE.Vector3(0,1.35,0));game.camera.position.copy(target).add(new THREE.Vector3(5.7,2.1,4.8));game.camera.up.set(0,1,0);game.camera.lookAt(target);game.camera.updateMatrixWorld(true);}
  return render(...args);
};
const panel=document.createElement('div');panel.style.cssText='position:fixed;top:12px;left:12px;z-index:999999;background:#17232eee;color:white;padding:12px;width:270px;font:13px monospace';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='wallride-facing-status';status.style.whiteSpace='pre-wrap';panel.append(controls,status);document.body.append(panel);
const button=(label:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:7px;margin:2px';b.onclick=action;controls.append(b);};
button('Face wall',()=>{toward=true;reset();});button('Face away',()=>{toward=false;reset();});
for(const mode of ['Forward','Reverse','Head-on','Vertical up','Vertical down'])button(mode,()=>{travel=mode;reset();});
button('Replay',reset);
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');const facing=p.riderG.getWorldDirection(new THREE.Vector3());
  status.textContent=JSON.stringify({facing:toward?'wall':'away',travel,frame,wallriding:p.wallriding,everWallride:ever,torsoTowardWall:+(-facing.x/Math.hypot(facing.x,facing.z)).toFixed(3)},null,2);requestAnimationFrame(report);}
reset();report();
