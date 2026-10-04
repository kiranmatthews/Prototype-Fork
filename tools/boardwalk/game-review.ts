// Local smoke controls use the production game, collision and fixed-step Player.
import * as THREE from 'three';
import {woodPathMeshPaint} from '../../src/woodPathMeshes';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player,panel=document.createElement('aside'),buttons=document.createElement('div'),status=document.createElement('pre');
panel.style.cssText='position:fixed;left:8px;top:8px;z-index:999999;background:#fff6e9eb;color:#382b20;padding:10px;font:11px monospace;max-width:330px';
panel.append(buttons,status);document.body.append(panel);
let pilot:THREE.Vector3[]|null=null,next=0,result='idle',samples=0,unsupported=0;
const errors:string[]=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:6px;margin:2px';b.onclick=fn;buttons.append(b);};
const place=(position:THREE.Vector3)=>{pilot=null;p.respawn(g.getLevel(),true,true,{position});p.snapRenderInterpolation?.();result='placed';};
const paths=()=>g.getLevel().groundMeshes.filter((m:any)=>m.userData.woodPathComp);
const pathPoints=()=>{const c=paths()[0].userData.woodPathComp;return c.pts.map((q:number[])=>new THREE.Vector3(c.p[0]+q[0],c.p[1]+(q[3]??0),c.p[2]+q[1]));};
add('Beachside Run',()=>{pilot=null;g.switchLevel('beachfront');result='spawn';});
add('Island Hopper',()=>{pilot=null;g.switchLevel('island-hopper');result='spawn';});
add('Inspect first boardwalk',()=>{const pts=pathPoints();place(pts[Math.min(2,pts.length-1)].clone().add(new THREE.Vector3(0,.12,0)));});
add('Ride first boardwalk',()=>{const pts=pathPoints(),start=pts.length>8?2:0;place(pts[start].clone().add(new THREE.Vector3(0,.12,0)));pilot=pts.slice(start+1);next=0;samples=0;unsupported=0;result='riding';});
add('Next checkpoint',()=>{pilot=null;p.warpCheckpoint(g.getLevel(),1);result='checkpoint banked';});
add('Pit respawn',()=>{pilot=null;p.pos.y=g.getLevel().killY-2;p.prevPos.copy(p.pos);p.grounded=false;result='pit drop';});
add('Near finish',()=>{const l=g.getLevel();const gate=l.captureData().components.find((c:any)=>c.t==='gate');
  const f=new THREE.Vector3(-Math.sin((gate.yaw??0)*Math.PI/180),0,-Math.cos((gate.yaw??0)*Math.PI/180));
  const to=new THREE.Vector3(...gate.p);place(to.clone().addScaledVector(f,-4).add(new THREE.Vector3(0,.15,0)));pilot=[to.clone().addScaledVector(f,5)];next=0;result='finishing';});
add('Normal controls',()=>{pilot=null;result='manual';});add('Hide tools',()=>panel.hidden=true);
const native=p.step.bind(p);
p.step=(dt:number,input:any,level:any)=>{
  if(pilot&&next<pilot.length){const target=pilot[next],dx=target.x-p.pos.x,dz=target.z-p.pos.z,d=Math.hypot(dx,dz);
    const f=p.courseInputDirection(level)??level.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};
    input.moveX=d>1e-6?(-f.z*dx+f.x*dz)/d*.65:0;input.moveY=d>1e-6?(f.x*dx+f.z*dz)/d*.65:0;
    for(const key of ['jumpHeld','jumpPressed','jumpReleased','grindHeld','grindPressed','spinHeld','spinPressed','grabHeld','grabPressed'])input[key]=false;
    if(d<1.2){next++;if(next===pilot.length){pilot=null;result='ride complete';}}
    samples++;if(!p.grounded)unsupported++;
  }
  native(dt,input,level);
};
function report(){const models=new Map<string,number>();let count=0;g.getLevel().root.traverse((m:any)=>{if(m.userData.woodPathModel){models.set(m.userData.woodPathModel,(models.get(m.userData.woodPathModel)??0)+m.count);count+=m.count;}});
  const l=g.getLevel();status.textContent=JSON.stringify({level:l.name,result,paint:woodPathMeshPaint.status,state:p.state,grounded:p.grounded,
    pos:p.pos.toArray().map((v:number)=>+v.toFixed(2)),deaths:p.totalDeaths,checkpoint:l.activeCheckpoint!==null,instances:count,models:models.size,
    samples,unsupported,speed:p.speed,pilotNext:next,ground:p.groundHit?.name,loading:g.getLoadingDiagnostics(),render:g.getRenderFrameStats(),errors},null,2);requestAnimationFrame(report);}
report();
