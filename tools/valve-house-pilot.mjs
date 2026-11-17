import {puzzleControls} from './puzzle-controls.mjs';

/** Continuous normal-input solution of the expanded three-room bonus. */
export function* runValveHouseBonus(r){
 const c=puzzleControls(r),{p,l}=r,named=name=>c.crateNamed(name);
 const family=name=>l.crates.filter(b=>{const nm=r.source.components[b.mesh.userData.editorIdx]?.nm;return nm===name||nm?.startsWith(name+' ·');});
 function* harvest(name){const boxes=family(name);c.check(boxes.length>0,'missing '+name);
  while(boxes.some(b=>b.alive))yield* c.hit(boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0],name);
 }
 function* settle(target,label){yield* c.until(()=>p.grounded,()=>c.steer(target),{label,limit:240});yield* c.stepFor(20);}
 yield* c.stepFor(20);yield* harvest('VALVE / arrival supplies');
 const tnt=named('Room 1 fuse: timed support'),wood=named('Room 1 fuse: wooden takeoff cap'),cap=named('Room 1 fuse: upper cap before fuse');
 yield* c.walk([5.9,0,0],'inspect fuse and overhead life');yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>!wood.alive,()=>c.steer([8,wood.box.max.y,0]),{label:'stomp takeoff cap',limit:140});
 yield* c.until(()=>p.vVel<.65,()=>c.steer([8,cap.box.min.y,0]),{label:'rebound apex',limit:90});
 yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
 yield* c.until(()=>!cap.alive,()=>c.steer([8,cap.box.min.y,0]),{label:'high life before TNT',limit:160});
 c.check(tnt.alive,'timed support lost before reward');
 yield* settle([3.5,0,0],'clear refuge');yield* c.walk([6.3,0,0],'deliberate fuse approach');
 yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>tnt.fuse!==undefined,()=>c.steer([8,tnt.box.max.y,0]),{label:'prime TNT by contact',limit:160});
 yield* settle([3.5,0,0],'leave blast radius');
 yield* c.until(()=>!tnt.alive&&l.explosions.length===0,{}, {label:'post-blast recovery',limit:240});
 yield* harvest('Room 1 fuse: refuge reward');yield* harvest('VALVE / fuse recovery');
 yield* c.hit(named('Room 2 bridge: local switch'),'materialize bridge');yield* c.hop([33.4,0,0],'pass bridge switch');
 yield* harvest('VALVE / revealed crossing');yield* harvest('Room 2 bridge: receiver reward');yield* harvest('Room 2 bridge: receiver mystery');
 const room=r.course.rooms[2],arrow=named('Room 3 return: conserved arrow');
 yield* c.walk([room.launchX-2,0,0],'preserve return arrow');yield* c.hop([room.launchX+3,0,0],'pass return arrow');
 yield* c.hit(named('Room 3 return: far reveal switch'),'reveal high valve gallery');
 yield* c.walk([room.launchX+1.8,0,0],'return to retained donor');
 yield* c.bounce(arrow,[room.shelf.a+1.3,room.shelf.y,0],'held arrow and double to gallery',{double:true,airSpinAbove:room.shelf.y-1.2});
 yield* harvest('Room 3 return: upper life');yield* harvest('Room 3 return: upper mystery');
 yield* c.walk([room.shelf.a+.5,room.shelf.y,0],'leave harvested gallery');
 yield* c.hop([room.launchX-2,0,0],'descend before clearing donor',{heightTolerance:.2});
 c.check(arrow.alive,'donor lost before rewards');yield* c.hit(arrow,'clear arrow last');
 yield* c.walk([room.switchX-2,0,0],'spent return switch approach');yield* c.hop([room.switchX+2.4,0,0],'pass spent return switch');
 yield* harvest('VALVE / exit count');yield* c.walk([101,0,0],'approach earned gem');yield* c.clearAll();yield* c.finish();
 c.check(p.totalDeaths===0,'positive journey hid a reset');
 return {state:p.state,gemEarned:p.gemEarned,totalCrates:l.totalCrates,cratesBroken:p.cratesBroken,deaths:p.totalDeaths};
}
