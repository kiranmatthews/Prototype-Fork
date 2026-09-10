// Local regression: enter Jungle first, then inspect the shared milk in a long course.
import * as THREE from 'three';
const g:any=await new Promise(resolve=>{const wait=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(wait);};wait();});
g.switchLevel('jungle');g.switchLevel('test');
const p=g.player,level=g.getLevel(),panel=document.createElement('section');
panel.style.cssText='position:fixed;bottom:8px;left:8px;background:#102b28e8;color:white;padding:10px;z-index:999999;font:12px monospace;width:290px';
const controls=document.createElement('div'),status=document.createElement('pre');status.dataset.testid='milk-distance-status';panel.append(controls,status);document.body.append(panel);
let selected:any=null,manual=false;
function place(z:number){
  selected=level.pickups.reduce((a:any,b:any)=>Math.abs(b.mesh.position.z-z)<Math.abs(a.mesh.position.z-z)?b:a);
  const at=selected.mesh.position.clone();at.y-=1.3;at.z+=5;
  p.respawn(level,true,true,{position:at,heading:new THREE.Vector3(0,0,-1)});
  manual=false;
}
const add=(name:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:6px;margin:2px';b.onclick=fn;controls.append(b);};
add('Course start',()=>{p.respawn(level,true,true);selected=null;manual=false;});add('Lower stretch',()=>place(-1101));add('Course end',()=>place(-2190));
add('Normal controls',()=>manual=true);
const step=p.step.bind(p);p.step=(dt:number,input:any,l:any)=>{
  if(!manual){input.moveX=input.moveY=0;for(const k of Object.keys(input))if(/Held|Pressed|Released/.test(k))input[k]=false;}
  step(dt,input,l);
};
function report(){const mesh=selected?.mesh.children[0],m=mesh?.material;
  status.textContent=JSON.stringify({level:level.name,position:p.pos.toArray().map((n:number)=>+n.toFixed(2)),
    milk:selected?.mesh.position.toArray().map((n:number)=>+n.toFixed(2)),
    material:m?.name,depthBlackening:!!m?.userData.jungleDepthFade,program:m?.customProgramCacheKey()},null,2);
  requestAnimationFrame(report);
}
place(-1101);report();
