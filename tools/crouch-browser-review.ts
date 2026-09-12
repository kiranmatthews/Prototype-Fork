// Local review of source/previous/fixed crouch with real gameplay and renderer.
// Overrides are in memory and never save an animation suite or tuning.
import * as THREE from 'three';
import { createPlayerStarterAnimationSuite, RigBinding } from '../src/animation';
import { UNITY_CROUCH_IDLE_ROTATION_KEYS } from '../src/animation/unityCrouchCrawlAnimations.generated';
const g:any=await new Promise(resolve=>{const poll=()=>{const game=(window as any).__game;if(game)resolve(game);else requestAnimationFrame(poll);};poll();});
const p=g.player,runtime=g.characterAnimationRuntime;
const original=runtime.document;
const fresh=createPlayerStarterAnimationSuite(RigBinding.fromSculptRuntime(p.animationRig.root).definition);
let mode='Fixed',angle=0,frozen=false,frame=0,minKnee=Infinity,minAnkle=Infinity,action='crouch';
const neutral=()=>({moveX:action==='crawl'?.3:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:action!=='stand',grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false});
function start(next:string){
  mode=next;frame=0;minKnee=minAnkle=Infinity;frozen=false;action='crouch';
  const suite=structuredClone(fresh),clip=suite.clips.find(c=>c.id==='player.crouch')!;
  if(mode!=='Fixed')for(const track of clip.tracks){if(track.kind!=='quaternion')continue;
    const values=UNITY_CROUCH_IDLE_ROTATION_KEYS[track.target as keyof typeof UNITY_CROUCH_IDLE_ROTATION_KEYS];
    track.keys=values.map(([time,value],i)=>{const q=new THREE.Quaternion().fromArray(value);
      if(mode==='Previous guess'&&/^(hip|knee)(Left|Right)$/.test(track.target))q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),(track.target.endsWith('Left')?1:-1)*(track.target.startsWith('hip')?.28:.12)));
      return {id:`${track.id}:key-${i}`,time,value:q.normalize().toArray(),interpolation:'linear'};
    });
  }
  runtime.setDocument(suite);runtime.restart();
}
const native=p.step.bind(p);
p.step=(dt:number,_input:any,level:any)=>{if(frozen)return;native(dt,neutral(),level);frame++;
  if(frame>30&&runtime.activeClipId==='player.crouch'){
    p.animationRig.root.updateMatrixWorld(true);
    const x=(id:string)=>p.animationRig.root.worldToLocal(p.animationRig.jointsById.get(id).node.getWorldPosition(new THREE.Vector3())).x;
    minKnee=Math.min(minKnee,x('kneeLeft')-x('kneeRight'));minAnkle=Math.min(minAnkle,x('ankleLeft')-x('ankleRight'));
  }
};
const render=g.renderer.render.bind(g.renderer);
g.renderer.render=(...args:any[])=>{if(args[1]===g.camera){
  p.animationRig.root.updateMatrixWorld(true);
  const target=p.animationRig.root.localToWorld(new THREE.Vector3(0,.8,0));
  const eye=p.animationRig.root.localToWorld(new THREE.Vector3(Math.sin(angle)*3.6,1.05,Math.cos(angle)*3.6));
  g.camera.position.copy(eye);g.camera.up.set(0,1,0);g.camera.lookAt(target);
}return render(...args);};
const panel=document.createElement('div');panel.style.cssText='position:fixed;top:55px;left:8px;z-index:999999;background:#15212def;color:white;padding:12px;width:260px;font:13px monospace';
const buttons=document.createElement('div'),status=document.createElement('pre');status.style.whiteSpace='pre-wrap';status.dataset.testid='crouch-status';panel.append(buttons,status);document.body.append(panel);
const button=(label:string,fn:()=>void)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;b.style.cssText='padding:7px;margin:2px';buttons.append(b);};
for(const label of ['Source','Previous guess','Fixed'])button(label,()=>start(label));
for(const degrees of [0,40,90,180])button(`${degrees}°`,()=>angle=THREE.MathUtils.degToRad(degrees));
button('Freeze',()=>frozen=true);button('Play',()=>frozen=false);
button('Stand',()=>{action='stand';frozen=false;});button('Crawl',()=>{action='crawl';frozen=false;});button('Crouch',()=>{action='crouch';frozen=false;});
button('Studio',()=>g.openAnimationStudio());
function report(){panel.inert=false;panel.removeAttribute('aria-hidden');status.textContent=JSON.stringify({mode,frame,action,clip:runtime.activeClipId,time:runtime.diagnostics.timelineTime,minKneeGap:+minKnee.toFixed(4),minAnkleGap:+minAnkle.toFixed(4),savedRevision:original.metadata?.playerStarterCatalogVersion,savedCrouchRevision:original.clips.find((c:any)=>c.id==='player.crouch')?.metadata?.crouchStanceRevision},null,2);requestAnimationFrame(report);}
start('Fixed');report();
