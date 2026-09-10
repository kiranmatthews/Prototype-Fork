// Local camera comparison; no tuning changes or completed event saves.
import * as THREE from 'three';
import { JungleCupEvent } from '../src/competition/event';
import { SkateChaseCamera,SKATE_CAMERA } from '../src/skateChaseCamera';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
JungleCupEvent.prototype.stepRun=()=>false;g.competitionAction('retry');g.getCompetition().phase='running';
const p=g.player,view=document.createElement('section');
view.style.cssText='position:fixed;bottom:8px;left:8px;background:#102b28ee;color:white;padding:12px;z-index:999999;font:12px monospace;width:340px';document.body.append(view);
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='park-camera-status';status.style.whiteSpace='pre-wrap';view.append(controls,status);
let legacy=false,freeze=false,nextSnap=false,mode='parked',apex=false,weight=0;
function place(position:number[],heading:number[],speed:number){
  p.respawn(g.level,true,true,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(...heading)});
  p.axisF.set(...heading);p.axisL.set(heading[2],0,-heading[0]);p.speed=speed;p.freeSkate=true;
  p.groundHit=p.queryGround(g.level);p.rideNormal.copy(p.groundHit.normal);freeze=false;nextSnap=true;
}
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:7px;margin:2px';b.onclick=fn;controls.append(b);};
add('Main-game framing',()=>{legacy=false;nextSnap=!p.vertAir&&p.skateCameraUp.y>.996;});
add('Previous park framing',()=>{legacy=true;nextSnap=!p.vertAir&&p.skateCameraUp.y>.996;});
add('Flat comparison',()=>{mode='parked';apex=false;place([0,.1,14],[0,0,-1],0);});
add('Cruise',()=>{mode='cruise';apex=false;place([0,.1,14],[0,0,-1],12);});
add('South vert',()=>{mode='vert';apex=true;place([0,.1,10],[0,0,1],16);});
add('East vert',()=>{mode='vert';apex=true;place([28,.1,-42],[1,0,0],16);});
add('Freeze',()=>freeze=true);add('Resume',()=>{freeze=false;apex=false;});
add('Normal play',()=>location.assign('/?playtest&level=jungle-cup'));
const original=SkateChaseCamera.prototype.update;
SkateChaseCamera.prototype.update=function(camera,subject,dt,snap,surfaces,framing){
  if(legacy){camera.fov=SKATE_CAMERA.verticalFov;camera.updateProjectionMatrix();}
  original.call(this,camera,subject,dt,snap||nextSnap,surfaces,legacy?undefined:framing);
  nextSnap=false;weight=this.groundFramingWeight;
};
const nativeStep=p.step.bind(p);
p.step=(dt:number,input:any,level:any)=>{
  if(freeze)return;
  input.moveX=0;input.moveY=mode==='parked'?-1:0;input.jumpHeld=mode==='vert';
  input.jumpPressed=input.jumpReleased=input.grabHeld=input.grabPressed=input.spinHeld=input.spinPressed=input.grindHeld=input.grindPressed=false;
  nativeStep(dt,input,level);
  if(apex&&p.vertAir&&p.vVel<.3&&p.vVel>-.5){freeze=true;apex=false;}
};
const direction=new THREE.Vector3();
function report(){g.camera.getWorldDirection(direction);status.textContent=JSON.stringify({profile:legacy?'previous park':'main-game flats',mode,paused:freeze,vert:p.vertAir,
  groundBlend:+weight.toFixed(3),pitch:+THREE.MathUtils.radToDeg(Math.asin(-direction.y)).toFixed(2),fov:+g.camera.fov.toFixed(2),
  eye:g.camera.position.toArray().map((n:number)=>+n.toFixed(4)),quaternion:g.camera.quaternion.toArray().map((n:number)=>+n.toFixed(6))},null,2);requestAnimationFrame(report);}
place([0,.1,14],[0,0,-1],0);report();
