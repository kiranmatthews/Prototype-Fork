import {puzzleControls} from './puzzle-controls.mjs';

/** One continuous normal-input harvest of the fuse and materialized bridge. */
export function* runQuaysideBonus(r){
 const c=puzzleControls(r),{p,l}=r;
 const named=name=>c.crateNamed(name);
 const group=name=>l.crates.filter(b=>{
  const nm=r.source.components[b.mesh.userData.editorIdx]?.nm;
  return nm===name||nm?.startsWith(name+' ·');
 });
 function* harvest(name){
  const boxes=group(name);c.check(boxes.length>0,'missing cargo '+name);
  while(boxes.some(b=>b.alive))yield* c.hit(boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0],name);
 }
 yield* c.stepFor(20);yield* harvest('QUAYSIDE / TEACH / arrival cargo');
 const tnt=named('Room 1 fuse: timed support'),wood=named('Room 1 fuse: wooden takeoff cap'),cap=named('Room 1 fuse: upper cap before fuse');
 yield* c.walk([5.9,0,0],'inspect TNT support and overhead life');yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>!wood.alive,()=>c.steer([8,wood.box.max.y,0]),{label:'stomp the wooden takeoff cap',limit:140});
 yield* c.until(()=>p.vVel<.65,()=>c.steer([8,cap.box.min.y,0]),{label:'rebound apex above retained TNT',limit:90});
 yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
 yield* c.until(()=>!cap.alive,()=>c.steer([8,cap.box.min.y,0]),{label:'collect the high life first',limit:160});
 c.check(tnt.alive,'TNT spent before high reward');
 yield* c.until(()=>p.grounded,()=>c.steer([3.5,0,0]),{label:'land in the clear refuge',limit:240});yield* c.stepFor(20);
 yield* c.walk([6.3,0,0],'deliberate fuse approach');yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>tnt.fuse!==undefined,()=>c.steer([8,tnt.box.max.y,0]),{label:'prime TNT by contact',limit:160});
 yield* c.until(()=>p.grounded,()=>c.steer([3.5,0,0]),{label:'leave the blast radius',limit:240});
 yield* c.until(()=>!tnt.alive&&l.explosions.length===0,{}, {label:'wait for supported post-blast recovery',limit:240});
 yield* harvest('Room 1 fuse: refuge reward');yield* harvest('QUAYSIDE / REST / fuse recovery');
 const button=named('Room 2 bridge: local switch');
 c.check(group('QUAYSIDE / TEST / bridge cargo').every(b=>b.pending),'bridge payload active before switch');
 yield* c.hit(button,'materialize the native bridge');yield* c.hop([33.4,0,0],'pass the used switch');
 yield* harvest('QUAYSIDE / TEST / bridge cargo');
 yield* harvest('Room 2 bridge: receiver reward');yield* harvest('Room 2 bridge: receiver mystery');
 yield* harvest('QUAYSIDE / COUNT / exit cargo');yield* c.walk([67,0,0],'approach the earned gem');
 yield* c.clearAll();yield* c.finish();c.check(p.totalDeaths===0,'positive journey used a reset');
 return {state:p.state,gemEarned:p.gemEarned,totalCrates:l.totalCrates,cratesBroken:p.cratesBroken,deaths:p.totalDeaths};
}

/** Native opening sample up to the first traversal transition. */
export function* runAmbushOpening(r){
 const {p,l}=r;let frame=0;
 const steer=(target,pace=1)=>{
  const dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,n=Math.hypot(dx,dz);
  return {moveX:n>.04?dx/n*pace:0,moveY:n>.04?-dz/n*pace:0,spinHeld:frame%24<12};
 };
 for(const target of [[-3,0,-18]]){
  let ticks=0;
  while(Math.hypot(p.pos.x-target[0],p.pos.z-target[2])>.35||!p.grounded){
   if(++ticks>3600||p.state==='dead')throw Error('opening traversal failed at '+JSON.stringify(p.pos.toArray()));
   const sample=steer(target,Math.hypot(p.pos.x-target[0],p.pos.z-target[2])<2?.4:1);frame++;yield sample;
  }
  for(let i=0;i<40;i++){frame++;yield {spinHeld:frame%24<12};}
 }
 return {crates:p.cratesBroken,deaths:p.totalDeaths,position:p.pos.toArray()};
}

/** Staged approach, then a normal held-arrow bounce and double across the dock. */
export function* runAmbushDock(r){
 const c=puzzleControls(r),{p,l}=r,arrow=l.crates.find(b=>b.metalBounce),q=[146.5,-26,-2107];
 yield* c.stepFor(20);yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>p.bounceJump&&p.vVel>15,()=>({...c.steer(arrow.mesh.position.toArray()),jumpHeld:p.vVel<0}),{limit:220,label:'held dock arrow contact'});
 yield* c.until(()=>p.vVel<.65,()=>({...c.steer(q),jumpHeld:true}),{limit:120,label:'dock bounce apex'});
 yield* c.tick({});yield* c.tick({...c.steer(q),jumpHeld:true});yield* c.tick({...c.steer(q),jumpReleased:true});
 yield* c.until(()=>p.grounded,()=>({...c.steer(q),jumpHeld:p.state==='hang'}),{limit:300,label:'land on the far dock'});
 c.check(Math.abs(p.pos.y-q[1])<.3&&c.distance(q)<2,'dock receiver landing');c.check(p.totalDeaths===0,'dock crossing used a reset');
 return {position:p.pos.toArray(),deaths:p.totalDeaths,arrowAlive:arrow.alive};
}
