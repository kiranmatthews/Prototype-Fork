import {puzzleControls} from './puzzle-controls.mjs';

export function* runHauntedBonus(r){
 const c=puzzleControls(r),{p,l}=r,named=name=>c.crateNamed(name);
 const family=name=>l.crates.filter(b=>{const nm=r.source.components[b.mesh.userData.editorIdx]?.nm;return nm===name||nm?.startsWith(name+' ·');});
 function* harvest(name){const boxes=family(name);c.check(boxes.length>0,'missing '+name);
  while(boxes.some(b=>b.alive))yield* c.hit(boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0],name);
 }
 yield* c.stepFor(20);yield* harvest('HAUNTED BONUS / arrival');
 const room=r.course.rooms[0],arrow=named('Room 1 return: conserved arrow');
 yield* c.walk([room.launchX-2,0,0],'preserve return arrow');yield* c.hop([room.launchX+3,0,0],'pass return arrow');
 yield* c.hit(named('Room 1 return: far reveal switch'),'reveal haunted gallery');
 yield* c.walk([room.launchX+1.8,0,0],'return to retained donor');
 yield* c.bounce(arrow,[room.shelf.a+1.3,room.shelf.y,0],'held arrow and double to gallery',{double:true,airSpinAbove:room.shelf.y-1.2});
 yield* harvest('Room 1 return: upper life');yield* harvest('Room 1 return: upper mystery');
 yield* c.walk([room.shelf.a+.5,room.shelf.y,0],'leave harvested gallery');
 yield* c.hop([room.launchX-2,0,0],'descend before clearing donor',{heightTolerance:.2});
 c.check(arrow.alive,'donor lost before rewards');yield* c.hit(arrow,'clear arrow last');
 yield* c.walk([room.switchX-2,0,0],'spent return switch approach');yield* c.hop([room.switchX+2.4,0,0],'pass spent return switch');
 yield* harvest('HAUNTED BONUS / return recovery');
 yield* c.hit(named('Room 2 bridge: local switch'),'materialize bridge');yield* c.hop([41.4,0,0],'pass bridge switch');
 yield* harvest('HAUNTED BONUS / bridge cargo');yield* harvest('Room 2 bridge: receiver reward');yield* harvest('Room 2 bridge: receiver mystery');
 const x=76,upper=named('Room 3 finite: upper finite support'),lower=named('Room 3 finite: lower finite support'),cap=named('Room 3 finite: upper cap'),hits=upper.hitsRemaining;
 yield* c.walk([x-1.7,0,0],'finite-stack approach');yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>upper.hitsRemaining<hits,()=>c.steer([x,upper.box.max.y,0]),{label:'upper support contact',limit:160});
 yield* c.until(()=>p.vVel<.65,()=>c.steer([x,cap.box.min.y,0]),{label:'rebound apex',limit:90});
 yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
 yield* c.until(()=>!cap.alive,()=>c.steer([x,cap.box.min.y,0]),{label:'cap before spending finite support',limit:160});
 c.check(upper.alive,'finite support spent before target');
 yield* c.until(()=>p.grounded,()=>c.steer([x-2,0,0]),{label:'clear finite landing',limit:240});yield* c.stepFor(20);
 for(const support of [upper,lower])if(support.alive)yield* c.hit(support,'spent finite support');
 yield* harvest('HAUNTED BONUS / exit count');yield* c.walk([99,0,0],'approach earned gem');yield* c.clearAll();yield* c.finish();
 c.check(p.totalDeaths===0,'positive journey hid a reset');
 return {state:p.state,gemEarned:p.gemEarned,totalCrates:l.totalCrates,cratesBroken:p.cratesBroken,deaths:p.totalDeaths};
}
