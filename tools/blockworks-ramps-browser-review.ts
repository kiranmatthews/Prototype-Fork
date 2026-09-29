// Local review: one starting placement, then ordinary steering/charge/brake.
import * as THREE from 'three';
import {BLOCKWORKS_SKATE_RAMPS} from '../src/levels/codex-lab';
const g:any=await new Promise(resolve=>{const poll=()=>{const v=(window as any).__game;if(v)resolve(v);else requestAnimationFrame(poll);};poll();});
g.campaign.startEphemeral();g.gameFlow.hide();const p=g.player;
let run:any=null,frozen=false,result='Ready',overview=false;
const panel=document.createElement('div');panel.style.cssText='position:fixed;bottom:8px;left:8px;z-index:999999;background:#162332ed;color:white;padding:10px;font:12px monospace';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='skate-ramps-status';panel.append(controls,status);document.body.append(panel);
const button=(name:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.onclick=action;controls.append(b);};
for(const label of ['Courtyard roof bays','Crown roof bays','Switch stair wedge'])button(label,()=>{
 const level=g.getLevel(),wedges=BLOCKWORKS_SKATE_RAMPS.filter(w=>w.name.startsWith(label)),first=wedges[0];
 const dir=new THREE.Vector3(...first.high).sub(new THREE.Vector3(...first.low)).setY(0).normalize(),ray=new THREE.Raycaster();let start;
 for(const d of [6,5,4,3,2]){const q=new THREE.Vector3(...first.low).addScaledVector(dir,-d);ray.set(q.clone().setY(first.low[1]+.2),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(level.groundMeshes,false)[0];if(hit&&Math.abs(hit.point.y-first.low[1])<.2){start=q.setY(hit.point.y+.05);break;}}
 if(!start){result='No supported runup';return;}
 overview=false;level.cameraViews.length=0;g.gameFlow.hide();p.respawn(level,true,false,{position:start,heading:dir});
 if(label==='Switch stair wedge')for(const key of level.crates.filter((c:any)=>c.bang))level.triggerBang(key);
 level.root.updateMatrixWorld(true);
 run={label,index:0,frames:0,braking:false,points:wedges.flatMap(w=>{const d=new THREE.Vector3(...w.high).sub(new THREE.Vector3(...w.low)).setY(0).normalize();return[new THREE.Vector3(...w.low),new THREE.Vector3(...w.high).addScaledVector(d,1.4)];})};frozen=false;result='Skating wedges';
});
button('Overview',()=>{overview=!overview;frozen=overview;});button('Freeze / live',()=>frozen=!frozen);
const actual=p.step.bind(p);p.step=(dt:number,input:any,level:any)=>{
 if(frozen)return;if(!run)return actual(dt,input,level);
 for(const k of Object.keys(input))if(/Held|Pressed|Released/.test(k))input[k]=false;
 let q=run.points[run.index];
 while(q&&Math.hypot(q.x-p.pos.x,q.z-p.pos.z)<1.25&&p.pos.y>=q.y-.15)q=run.points[++run.index];
 if(!q){result=p.freeSkate?'PASS — continuous skate ascent':'FAIL — left board';run=null;frozen=true;return;}
 const dx=q.x-p.pos.x,dz=q.z-p.pos.z,n=Math.hypot(dx,dz),f=level.cameraDirAt(p.pos.x,p.pos.y,p.pos.z);
 if(p.speed>13.5)run.braking=true;else if(p.speed<11.5)run.braking=false;
 input.moveX=p.grounded?Math.round((dx*-f.z+dz*f.x)/n*100)/100:0;input.moveY=p.grounded?Math.round((dx*f.x+dz*f.z)/n*100)/100:0;
 input.jumpHeld=true;input.jumpPressed=run.frames++===0;input.grabHeld=run.braking;
 actual(dt,input,level);if(p.isBailing||p.state==='dead'){result='FAIL';run=null;frozen=true;}
};
const render=g.renderer.render.bind(g.renderer);g.renderer.render=(...args:any[])=>{if(overview&&args[1]===g.camera){g.camera.position.copy(p.pos).add(new THREE.Vector3(14,13,17));g.camera.lookAt(p.pos.x,p.pos.y+1,p.pos.z-8);g.camera.updateMatrixWorld(true);}return render(...args);};
function report(){panel.inert=false;status.textContent=JSON.stringify({result,line:run?.label,waypoint:run?.index,position:p.pos.toArray().map((n:number)=>+n.toFixed(2)),board:p.freeSkate,speed:+p.speed.toFixed(2),deaths:p.totalDeaths,pendingWedges:g.getLevel().root.children.filter((o:any)=>o.userData.outlinedSurface&&!g.getLevel().groundMeshes.includes(o)).length},null,1);requestAnimationFrame(report);}report();
