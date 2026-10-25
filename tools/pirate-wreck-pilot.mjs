/** One continuous run driven only by ordinary movement/jump/spin inputs. */
export function* pirateJourney(r) {
 const {p,l}=r; const report=r.report??(r.report={stage:'spawn',evidence:[]});
 const check=(ok,message)=>{if(!ok)throw Error(`${message}: ${JSON.stringify({position:p.pos.toArray(),state:p.state,grounded:p.grounded,ground:p.groundHit?.name})}`);};
 const live=()=>check(!p.isBailing&&!['dead','gameover'].includes(p.state),'Unexpected death');
 const interiorOnly=p.pos.x>500; let shipOffset=interiorOnly?1000:0; let boardingTransitions=0,t=0;
 const distance=q=>Math.hypot(q[0]+shipOffset-p.pos.x,q[2]-p.pos.z);
 const input=(q,pace=1)=>{
  const dx=q[0]+shipOffset-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz),f=p.axisF,fn=Math.hypot(f.x,f.z),fx=f.x/fn,fz=f.z/fn;
  // Cardinal travel zones use screen-right for eastward progress; a jump
  // entering the zone retains its old frame until the native landing flip.
  if(n>=.06&&l.zoneAt(p.pos.x,p.pos.z)?.dir==='E'&&p.travelDir==='E')
   return {moveX:dx/n*pace,moveY:-dz/n*pace};
  return n<.06?{}:{moveX:(dx*-fz+dz*fx)/n*pace,moveY:(dx*fx+dz*fz)/n*pace};
 };
 function* wait(n,sample={}){for(let i=0;i<n;i++)yield sample;}
 function* walk(q,name,buttons={},settle=18){
  report.stage=name;let i=0;
  while(distance(q)>.16&&i++<4200){yield {...input(q,settle<=2?.65:Math.min(.85,.15+distance(q)*.12)),...buttons};live();}
  check(i<4200,`${name} timed out`);yield* wait(settle,buttons);check(distance(q)<.45,`${name} stopping distance`);
  check(p.grounded,`${name} unsupported`);report.evidence.push({name,position:p.pos.toArray(),ground:p.groundHit?.name});
 }
 function* hop(q,name,settle=18){
  report.stage=name;yield* wait(26,{jumpHeld:true});yield {jumpReleased:true};check(p.state==='air','Jump did not start');
  let i=0;while(!p.grounded&&i++<240){const target=typeof q==='function'?q():q;yield {...input(target),jumpHeld:i===22&&distance(target)>2.2};live();}
  check(p.grounded&&distance(typeof q==='function'?q():q)<1.9,`${name} missed landing`);yield* wait(settle);report.evidence.push({name,position:p.pos.toArray(),ground:p.groundHit?.name});
 }
 function* cp(q,name){
  const approach=l.zoneAt(q[0]+shipOffset,q[2])?.dir==='E'?[q[0]-1.2,q[1],q[2]]:[q[0],q[1],q[2]+1.2];
  yield* walk(approach,name);yield {spinHeld:true};yield* wait(25);
  check(l.checkpoints.some(c=>c.active&&c.spawnPos.distanceTo(p.pos)<4),`${name} did not activate`);
 }
 yield* wait(30);check(p.grounded,'Spawn unsupported');
 if(!interiorOnly){
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
 if(boardingPortal){
  yield* walk([-31,-6,-76],'Covered boarding passage');report.stage='Enter the scenic ship';
  let i=0;while(p.pos.z>-100&&i++<600){yield input([-24,-6,-76],.65);live();}
  check(i<600&&p.pos.distanceTo(boardingPortal.destination)<1.5,'Boarding passage did not reach the full wreck');
  shipOffset=boardingPortal.destination.x-4;yield* wait(18);check(p.grounded,'Boarding destination unsupported');boardingTransitions=1;
  report.evidence.push({name:'Covered ship-set transition',position:p.pos.toArray(),ground:p.groundHit?.name});
 }else{yield* walk([-20,-6,-75],'Boarding gangway');yield* walk([0,8,-106],'Climb onto the wreck');}
 }
 if(!interiorOnly||p.pos.z>-350){
 yield* walk([4,8,-124],'Boarding room');yield* cp([4,8,-129],'Ship checkpoint');
 // The new interior is verified by normal movement, charged jumps and timed
 // spins. Every takeoff and landing is an explicit world-space observation.
 yield* walk([-1.2,8,-134.6],'Cargo zigzag takeoff');
 yield* hop([-3,8.7,-140.4],'Port cargo jump');
 yield* walk([-1.6,8.7,-143.8],'Across the clipped cargo');
 yield* hop([.1,9.3,-150.2],'Starboard cargo jump');
 yield* walk([.1,9.3,-155.6],'Pass the crab on the open left lane');
 yield* hop([-3.8,9.9,-162.1],'Turtle elbow jump');
 yield* walk([-3.8,9.9,-166],'Pass the turtle on the outside elbow');
 yield* hop([-1.8,9.9,-173.2],'Lookout landing');
 yield* cp([2.8,9.9,-177],'Broken gangways checkpoint');
 yield* walk([0,9.9,-181],'First boardwalk join');
 yield* walk([0,9.9,-192.4],'First broken gangway takeoff');
 yield* hop([-1.3,10.5,-199],'Offset boardwalk jump');
 yield* walk([-1.3,10.5,-207.8],'Second broken gangway takeoff');
 yield* hop([1.3,10.5,-214.4],'Far boardwalk jump');
 yield* walk([1.3,10.5,-219.6],'Read the gangway crab');
 // A fresh press near the enemy, after a safe landing and visible approach.
 yield {spinHeld:true};
 yield* walk([1.3,10.5,-222.8],'Spin through the gangway crab',{spinHeld:true});
 yield* hop([.8,10.5,-229.5],'Crane dock landing');
 yield* cp([3.7,10.5,-233],'Cargo ferry checkpoint');
 yield* walk([0,10.5,-236.8],'Crosswise ferry waiting edge');
 const ferry=l.movers.find(m=>Math.abs(m.base.z+244.5)<.1);
 const foreaft=l.movers.find(m=>Math.abs(m.base.z+265)<.1);
 check(ferry&&foreaft,'Both cargo ferries must exist');
 t=0;while((Math.abs(ferry.mesh.position.x-shipOffset)>.9||Math.cos(l.time*ferry.speed+ferry.phase)<0)&&t++<900)yield {};
 check(t<900,'Crosswise ferry never aligned');
 yield* hop(()=>[ferry.mesh.position.x-shipOffset,10.5,-243.6],'Board the crosswise cargo sling',4);
 t=0;while(ferry.mesh.position.x-shipOffset<1.8&&t++<900)yield {};
 check(t<900,'Crosswise ferry never reached the receiving side');
 yield* walk([ferry.mesh.position.x-shipOffset,10.5,-246],'Cargo sling takeoff',{},4);
 yield* hop([2.3,11,-251.3],'Crane elbow landing');
 yield* walk([2.3,11,-257.2],'Fore-and-aft ferry waiting edge');
 t=0;while(foreaft.mesh.position.z<-264&&t++<900)yield {};
 check(t<900,'Fore-and-aft ferry never aligned');
 yield* hop(()=>[4,11,foreaft.mesh.position.z+.4],'Board the fore-and-aft cargo sling',4);
 t=0;while(foreaft.mesh.position.z>-266&&t++<900)yield {};
 check(t<900,'Fore-and-aft ferry never reached the far side');
 yield* walk([2.5,11,foreaft.mesh.position.z-.5],'Fore-and-aft sling takeoff',{},4);
 yield* hop([-.2,11.8,-272.8],'Sorting island landing');
 yield* cp([1.8,11.8,-276],'Loose cargo checkpoint');
 yield* walk([-2,11.8,-279.7],'Collapsing pallets takeoff');
 for(const [x,y,z,nextX,nextY,nextZ] of [
  [-2,12.2,-284.5,2,12.6,-291.9],
  [2,12.6,-291.9,-2,13,-299.3],
  [-2,13,-299.3,1,13.4,-306.7],
 ]){
  if(z===-284.5)yield* hop([x,y,z],'First loose cargo pallet',3);
  yield* walk([x,y,z-2],'Quick step across the loose pallet',{},2);
  yield* hop([nextX,nextY,nextZ],'Linked collapsing cargo jump',3);
 }
 yield* walk([1,13.4,-309],'Final loose cargo edge',{},2);
 yield* hop([0,13.4,-315],'Last safe muster landing');
 yield* cp([2.7,13.4,-318],'Broken stern checkpoint');
 yield* walk([-2,13.4,-320.9],'Stern ascent takeoff');
 yield* hop([-4.8,14.4,-327.8],'Stern battlement jump');
 yield* walk([-4.8,14.4,-330.4],'Read the stern crab');yield {spinHeld:true};
 yield* walk([-2.2,14.4,-332],'Spin across the stern battlement',{spinHeld:true});
 yield* hop([.1,15.2,-338.8],'Stern cross-deck jump');
 yield* walk([.1,15.2,-342.7],'Pass the hopper with landing room');
 yield* hop([-2,16,-349.2],'High keystone jump');
 yield* walk([-2,16,-353],'High keystone takeoff');
 yield* hop([0,16,-358.4],'Midships muster landing');
 }
 if(p.pos.x<shipOffset+100){
 yield* cp([2.7,16,-363],'Interlocking cargo checkpoint');
 yield* walk([-2,16,-366.7],'Cargo hook takeoff');
 yield* hop([-5.4,16.8,-373.3],'Cargo hook landing');
 yield* walk([-5.4,16.8,-378.5],'Cargo hook elbow');
 yield* hop([-.4,17.6,-384],'Cargo tongue landing');
 yield* walk([2,17.6,-386],'Across the cargo tongue');
 yield* walk([2,17.6,-390.5],'Cargo tongue takeoff');
 yield* hop([-2,18.4,-397],'Long comb landing');
 yield* walk([-3,18.4,-409],'Long comb takeoff');
 yield* hop([0,18.4,-414.5],'Stamp works landing');
 yield* cp([3,18.4,-418],'Stamp works checkpoint');
 yield* walk([.4,18.4,-421.6],'First stamp bed takeoff');
 yield* hop([.4,18.4,-428.3],'First stamp bed landing');
 yield* walk([.4,18.4,-433.6],'Outside the port stamping head');
 yield* hop([-2.5,19.1,-440.5],'Reversed stamp bed landing');
 yield* walk([-2.5,19.1,-445.6],'Outside the starboard stamping head');
 const lift=l.movers.find(m=>Math.abs(m.base.z+454)<.1);
 check(lift,'Freight lift must exist');
 t=0;while((lift.mesh.position.y>20||Math.cos(l.time*lift.speed+lift.phase)<0)&&t++<1200)yield {};
 check(t<1200,'Freight lift never arrived');
 yield* hop(()=>[0,lift.mesh.position.y,-452.5],'Board the freight lift',4);
 t=0;while(lift.mesh.position.y<20.3&&t++<1200)yield {};
 yield* walk([0,lift.mesh.position.y,-456.2],'Freight lift takeoff',{},4);
 yield* hop([0,20.4,-463.6],'Upper sorting gallery landing');
 yield* cp([3,20.4,-469],'Split shelves checkpoint');
 yield* walk([-2,20.4,-474.2],'Port shelf takeoff');
 yield* hop([-4.3,21.2,-478.8],'Port shelf landing');
 yield* walk([-3.7,21.2,-483],'Port shelf takeoff');
 yield* hop([-1.4,22,-489.5],'High diamond landing');
 yield* walk([-.8,22,-494.3],'High diamond outside lane');
 yield* hop([3,20.8,-501.3],'Descending shelf landing');
 yield* walk([3,20.8,-505.5],'Descending shelf takeoff');
 yield* hop([1,19.4,-513],'Balance works landing');
 yield* cp([2.7,19.4,-516.5],'Balancing cargo checkpoint');
 yield* walk([-1.5,19.4,-520],'Transverse pallet takeoff');
 const balance=l.movers.find(m=>Math.abs(m.base.z+528)<.1);
 const bob=l.movers.find(m=>Math.abs(m.base.z+548.5)<.1);
 check(balance&&bob,'Both balance platforms must exist');
 t=0;while(balance.mesh.position.x-shipOffset<-3&&t++<1200)yield {};
 yield* hop(()=>[balance.mesh.position.x-shipOffset,19.4,-526.7],'Board the transverse pallet',4);
 t=0;while(balance.mesh.position.x-shipOffset<-1.6&&t++<1200)yield {};
 yield* walk([balance.mesh.position.x-shipOffset,19.4,-529.9],'Transverse pallet takeoff',{},4);
 yield* hop([1.5,19.4,-536.7],'Diagonal balance landing');
 yield* walk([2,19.4,-541.4],'Bobbing pallet takeoff');
 yield* hop(()=>[-1,bob.mesh.position.y,-547.3],'Bobbing pallet landing',4);
 yield* walk([-1,bob.mesh.position.y,-550],'Bobbing pallet edge',{},4);
 yield* hop([0,17.2,-556.7],'Last gangway refuge landing');
 yield* cp([2.8,17.2,-560],'Descending gangways checkpoint');
 yield* walk([0,17.2,-563.8],'Descending gangways takeoff');
 yield* hop([0,17.2,-570.8],'Descending near jetty landing');
 yield* walk([0,17.2,-580.3],'Descending near jetty edge');
 yield* hop([1.2,17.2,-586.6],'Descending middle jetty landing');
 yield* walk([1.2,17.2,-595.5],'Descending middle jetty edge');
 yield* hop([-2.2,16,-602.2],'Descending far jetty landing');
 yield* walk([-2.1,16,-606.9],'Read the last jetty turtle');
 yield* hop([-1.5,16,-614.1],'Jump over the last jetty turtle');
 yield* walk([0,16,-615],'Broadside corner');
 yield* cp([0,16,-619],'Broadside stair checkpoint');
 yield* walk([4,16,-618],'Broadside first takeoff');
 yield* hop([10,16.8,-618],'Broadside first stair');
 yield* walk([14,16.8,-618],'First stair edge');
 yield* hop([21,18,-618],'Broadside second stair');
 yield* walk([25,18,-618],'Second stair edge');
 yield* hop([32.5,18.8,-617],'Broadside combat shelf');
 yield* walk([34.1,18.8,-617],'Read the broadside crab');yield {spinHeld:true};
 yield* walk([38,18.8,-617],'Spin across the broadside shelf',{spinHeld:true});
 yield* hop([43.7,19.6,-618],'Broadside hoist refuge');
 yield* cp([46,19.6,-616.5],'Broadside hoist checkpoint');
 yield* walk([51,19.6,-618],'Broadside hoist waiting edge');
 const sideLift=l.movers.find(m=>Math.abs(m.base.x-shipOffset-58)<.1&&Math.abs(m.base.z+618)<.1);
 check(sideLift,'Broadside hoist must exist');
 t=0;while((sideLift.mesh.position.y>20.4||Math.cos(l.time*sideLift.speed+sideLift.phase)<0)&&t++<1200)yield {};
 yield* hop(()=>[56.5,sideLift.mesh.position.y,-618],'Broadside hoist landing',4);
 yield* walk([59.6,sideLift.mesh.position.y,-618],'Broadside hoist takeoff',{},4);
 t=0;while((sideLift.mesh.position.y<21.4||Math.cos(l.time*sideLift.speed+sideLift.phase)<0)&&t++<1200)yield {};
 yield* hop([67,21,-616.3],'Broadside high landing');
 yield* walk([73.4,21,-615.7],'Outside the broadside hopper');
 yield* hop([80.3,20.3,-617.4],'First dropping stair',3);
 yield* walk([83.7,20.3,-618],'First dropping stair edge',{},2);
 yield* hop([90.3,19.5,-618],'Second dropping stair',3);
 yield* walk([93.7,19.5,-618],'Second dropping stair edge',{},2);
 yield* hop([101.8,18.6,-618],'Broadside timber refuge');
 yield* cp([103,18.6,-616.4],'Broadside timber checkpoint');
 }
 yield* walk([107.5,18.6,-618],'Broadside near timber takeoff');
 yield* hop([114.2,17.5,-618],'Broadside near timber landing');
 yield* walk([123.5,17.5,-618],'Broadside near timber edge');
 yield* hop([130.4,16.6,-618],'Broadside far timber landing');
 yield* walk([139.5,16.6,-618],'Broadside far timber edge');
 yield* hop([145,16,-618],'Treasury departure landing');
 // The detailed finale is the same authored set translated +148X / -256Z.
 const end=q=>[q[0]+148,q[1],q[2]-256];
 yield* walk(end([3,16,-365]),'Escape bridge approach');yield* walk(end([6,16.4,-370]),'Escape bridge near bank');
 yield* walk(end([15.7,17.03,-377.75]),'Broken bridge takeoff');
 yield* hop(end([19.3,17.33,-380.7]),'Broken bridge jump');yield* walk(end([30,18,-388]),'Treasure tunnel');
 yield* cp(end([32,18,-397]),'Treasure checkpoint');yield* walk(end([32,18,-412]),'Enter the hoard');
 yield* walk(end([32,20,-425]),'Climb the treasure dais');report.stage='Cross the finish gate';
 let i=0;while(p.state!=='finished'&&i++<1200){yield input(end([32,20,-441]),.7);live();}
 check(p.state==='finished','Finish gate did not trigger');check(p.totalDeaths===0,'Journey hid a death');
 return {state:p.state,deaths:p.totalDeaths,boardingTransitions,checkpoints:l.checkpoints.filter(c=>c.active).length,position:p.pos.toArray(),evidence:report.evidence};
}
