/** One continuous run driven only by ordinary movement/jump/spin inputs. */
export function* pirateJourney(r) {
 const {p,l}=r; const report=r.report??(r.report={stage:'spawn',evidence:[]});
 const check=(ok,message)=>{if(!ok)throw Error(`${message}: ${JSON.stringify({position:p.pos.toArray(),state:p.state,grounded:p.grounded,ground:p.groundHit?.name})}`);};
 const live=()=>check(!p.isBailing&&!['dead','gameover'].includes(p.state),'Unexpected death');
 let shipOffset=0;
 const distance=q=>Math.hypot(q[0]+shipOffset-p.pos.x,q[2]-p.pos.z);
 const input=(q,pace=1)=>{
  const dx=q[0]+shipOffset-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz),f=p.axisF,fn=Math.hypot(f.x,f.z),fx=f.x/fn,fz=f.z/fn;
  return n<.06?{}:{moveX:(dx*-fz+dz*fx)/n*pace,moveY:(dx*fx+dz*fz)/n*pace};
 };
 function* wait(n,sample={}){for(let i=0;i<n;i++)yield sample;}
 function* walk(q,name,buttons={}){
  report.stage=name;let i=0;
  while(distance(q)>.16&&i++<4200){yield {...input(q,Math.min(.85,.15+distance(q)*.12)),...buttons};live();}
  check(i<4200,`${name} timed out`);yield* wait(18,buttons);check(distance(q)<.45,`${name} stopping distance`);
  check(p.grounded,`${name} unsupported`);report.evidence.push({name,position:p.pos.toArray(),ground:p.groundHit?.name});
 }
 function* hop(q,name){
  report.stage=name;yield* wait(26,{jumpHeld:true});yield {jumpReleased:true};check(p.state==='air','Jump did not start');
  let i=0;while(!p.grounded&&i++<240){yield input(q);live();}
  check(p.grounded&&distance(q)<1.6,`${name} missed landing`);yield* wait(18);report.evidence.push({name,position:p.pos.toArray(),ground:p.groundHit?.name});
 }
 function* cp(q,name){yield* walk([q[0],q[1],q[2]+1.2],name);yield {spinHeld:true};yield* wait(25);check(l.checkpoints.some(c=>c.active&&c.spawnPos.distanceTo(p.pos)<4),`${name} did not activate`);}
 yield* wait(30);check(p.grounded,'Spawn unsupported');
 if(p.pos.z>50){
  yield* walk([-71.5,-6,193],'Customs quay curve');yield* walk([-69.2,-6,181],'Customs quay');yield* walk([-58,-6,164],'Quayside dogleg');
  yield* walk([-57,-6,153.4],'First jetty takeoff');yield* hop([-57,-6,149.8],'First broken jetty jump');
  yield* cp([-55.5,-6,138],'Harbour checkpoint');yield* walk([-57,-6,134.4],'Second jetty takeoff');
  yield* hop([-59,-6,130.3],'Cargo jetty jump');yield* walk([-59,-6,127],'Cargo jetty landing');
  yield* walk([-43,-5.5,112],'Fort wharf');yield* walk([-43,-5.5,103.4],'Third jetty takeoff');
  yield* hop([-43,-5.5,99.3],'Fort wharf jump');yield* walk([-43,-5.5,90],'Beneath the fort');
  yield* walk([-48,-3,74],'Sea gate boardwalk');yield* cp([-48,-1.4,60],'Sea gate checkpoint');
  yield* walk([-48,0,48],'Enter the smugglers sea gate');
 }
 yield* walk([-48,0,20],'Into the mine');yield* walk([-34,-3,-8],'First tunnel bend');
 yield* walk([-34.8,-4.2,-19.7],'Fissure takeoff');yield* hop([-35.1,-4.6,-24.1],'Tidal fissure jump');
 yield* walk([-36,-6,-38],'Lower tunnel');yield* walk([-48,-6,-58],'Moonpool turn');
 yield* cp([-48,-6,-68],'Moonpool checkpoint');yield* walk([-48,-6,-75],'Port-side wreck reveal');
 const boardingPortal=l.returnPortals.find(portal=>portal.destination.x>300&&Math.abs(portal.destination.z+112)<.01);
 let boardingTransitions=0;
 if(boardingPortal){
  yield* walk([-31,-6,-76],'Covered boarding passage');report.stage='Enter the scenic ship';
  let i=0;while(p.pos.z>-100&&i++<600){yield input([-24,-6,-76],.65);live();}
  check(i<600&&p.pos.distanceTo(boardingPortal.destination)<1.5,'Boarding passage did not reach the full wreck');
  shipOffset=boardingPortal.destination.x-4;yield* wait(18);check(p.grounded,'Boarding destination unsupported');boardingTransitions=1;
  report.evidence.push({name:'Covered ship-set transition',position:p.pos.toArray(),ground:p.groundHit?.name});
 }else{yield* walk([-20,-6,-75],'Boarding gangway');yield* walk([0,8,-106],'Climb onto the wreck');}
 yield* walk([4,8,-111],'Avoid the aft mast');
 yield* walk([4,8,-124],'Main deck');yield* cp([-6,8,-129],'Ship checkpoint');
 yield* walk([-8,8,-133],'Enter broken hatch');yield* walk([-8,-4,-162],'Descend into the hull');
 yield* walk([-8,-4,-181],'Across the broken keel');yield* walk([1,-4,-190],'Through the cargo hold');
 yield* cp([3,-4,-201],'Cargo checkpoint');yield* walk([8,-4,-204],'Bow hatch ramp');
 yield* walk([8,8,-239],'Climb out of the hold');yield* walk([3,8,-245],'Crawl beneath the bow rigging',{grabHeld:true});
 yield* walk([6,8.4,-252],'Crawl onto the escape bridge',{grabHeld:true});yield* walk([15.7,9.03,-259.75],'Broken bridge takeoff');
 yield* hop([19.3,9.33,-262.7],'Broken bridge jump');yield* walk([30,10,-270],'Treasure tunnel');
 yield* cp([32,10,-279],'Treasure checkpoint');yield* walk([32,10,-294],'Enter the hoard');
 yield* walk([32,12,-307],'Climb the treasure dais');report.stage='Cross the finish gate';
 let i=0;while(p.state!=='finished'&&i++<1200){yield input([32,12,-323],.7);live();}
 check(p.state==='finished','Finish gate did not trigger');check(p.totalDeaths===0,'Journey hid a death');
 return {state:p.state,deaths:p.totalDeaths,boardingTransitions,checkpoints:l.checkpoints.filter(c=>c.active).length,position:p.pos.toArray(),evidence:report.evidence};
}
