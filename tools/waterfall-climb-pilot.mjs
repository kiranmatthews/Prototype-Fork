import {puzzleControls} from './puzzle-controls.mjs';

/** The second route deliberately exercises distinct movement verbs. Every
 * yielded value is a normal production input sample; geometry is never moved. */
export function* runWaterfallClimb(r,{collect=true,untilBeat=Infinity,fromBeat=0}={}) {
 const c=puzzleControls(r),{p,l,source}=r,route=r.route??r.sourceModule.WATERFALL_ACTIONS;
 const deaths=p.totalDeaths,metrics={skateFrames:0,skateMetres:0,grindFrames:0,grindMetres:0,moverRides:0,drumLaunches:0};
 yield* c.stepFor(20);c.check(p.grounded,'Waterfall spawn is supported');
 function* brake(label='Brake onto the safe bank'){
  yield* c.until(()=>p.grounded&&Math.abs(p.speed)<.07&&!p.freeSkate,{grabHeld:true,jumpHeld:true},{label,limit:300});
  yield* c.tick({});
  if(!p.grounded)yield* c.until(()=>p.grounded,{}, {label:label+' release the held charge',limit:180});
  yield* c.stepFor(8);
 }
 function* skate(action){
  const points=action.points;let index=0,braking=false;
  const max=action.section>=20?15:23;
  for(let n=0;n<10000&&index<points.length;n++){
   const target=points[index],dist=c.distance(target),last=index===points.length-1;
   if(!last){const next=points[index+1],passed=(p.pos.x-target[0])*(next[0]-target[0])+(p.pos.z-target[2])*(next[2]-target[2]);if(passed>0&&dist<Math.max(5,p.speed*.6)){index++;continue;}}
   if(last&&action.stop&&dist<Math.max(12,p.speed*1.45)){index++;break;}
   if(dist<(last&&!action.stop?1.5:3)){index++;continue;}
   if(p.speed>max)braking=true;else if(p.speed<max-2.5)braking=false;
   const before=p.pos.clone();yield* c.tick({...c.steer(target),jumpHeld:true,grabHeld:braking});c.live(action.name);
   if(p.freeSkate){metrics.skateFrames++;metrics.skateMetres+=p.pos.distanceTo(before);}
  }
  c.check(index===points.length,action.name+' followed its whole curve');
  if(action.stop){yield* brake(action.name+' dismount');yield* c.walk(points[points.length-1],action.name+' bank arrival',{settle:0});}
 }
 function* spin(action){
  const b=l.spinBridges.find(b=>b.component.nm===action.target),q=b.component;
  const a=(q.yaw??0)*Math.PI/180,dir=[Math.cos(a),0,-Math.sin(a)];
  yield* c.walk(action.from,action.name+' takeoff',{settle:0});
  if(q.p[1]>p.pos.y+.4){
   yield* c.hop([q.p[0]+dir[0]*2,q.p[1],q.p[2]+dir[2]*2],action.name+' air activation',{airButtons:{spinHeld:true}});
  }else{
   yield* c.tick({});yield* c.tick({spinHeld:true});
   yield* c.until(()=>b.deployed,{}, {label:action.name+' opens',limit:100});
  }
  c.check(b.deployed,action.name+' is physically open');
  const end=[q.p[0]+dir[0]*(q.s[0]-.8),q.p[1],q.p[2]+dir[2]*(q.s[0]-.8)];
  yield* c.walk(end,action.name+' cross the timed leaf',{settle:0});
  yield* c.hop(action.to,action.name+' leave the leaf');
  r.report.evidence.push({action:action.name,verb:'timed spin',remaining:b.remaining});
 }
 function* moving(action){
  const spec=source.components.find(q=>q.nm===action.target&&q.t==='mover');
  const m=l.movers[source.components.filter(q=>q.t==='mover').indexOf(spec)];c.check(m,action.name+' moving platform exists');
  const top=()=>m.mesh.position.y+spec.s[1]/2;
  const nearest=(point,margin=.9)=>action.target==='Drifting lily'?[m.mesh.position.x,top(),m.mesh.position.z+Math.sign(point[2]-m.mesh.position.z)*(spec.s[2]/2-1.2)]:[Math.max(m.mesh.position.x-spec.s[0]/2+margin,Math.min(m.mesh.position.x+spec.s[0]/2-margin,point[0])),top(),
   Math.max(m.mesh.position.z-spec.s[2]/2+margin,Math.min(m.mesh.position.z+spec.s[2]/2-margin,point[2]))];
  yield* c.walk(action.from,action.name+' boarding point');
  yield* c.until(()=>Math.abs(top()-action.from[1])<.35&&c.distance(nearest(action.from))<5.6,{}, {label:action.name+' arrives',limit:1600});
  yield* c.hop(()=>nearest(action.from),action.name+' board',{heightTolerance:.5,tolerance:1});
  c.check(p.groundHit?.mesh===m.mesh||p.groundHit?.moverId===l.movers.indexOf(m),action.name+' actually carries the player');
  metrics.moverRides++;
  yield* c.walk(()=>[m.mesh.position.x,top(),m.mesh.position.z],action.name+' stand on the moving deck',{settle:0,tolerance:.3});
  const clear=()=>{const q=nearest(action.to);return Math.abs(top()-action.to[1])<.55&&Math.hypot(q[0]-action.to[0],q[2]-action.to[2])<(action.target==='Drifting lily'?4.1:6.1)&&(spec.axis!=='x'||(action.to[0]-m.mesh.position.x)*m.lastDelta.x>-.001)&&(spec.axis!=='y'||m.lastDelta.y>0);};
  yield* c.walk(()=>nearest(action.to),action.name+' exit edge',{settle:0,tolerance:.2});
  yield* c.until(clear,{}, {label:action.name+' reach the exit',limit:1800});
  yield* c.hop(action.to,action.name+' disembark');
 }
 function* grind(action){
  const end=action.points[action.points.length-1],next=action.points[1],first=action.points[0],dx=next[0]-first[0],dz=next[2]-first[2],length=Math.hypot(dx,dz);
  yield* c.walk([action.from[0]+dz/length*1.25,action.from[1],action.from[2]-dx/length*1.25],action.name+' mount');
  yield* c.charge(26);yield* c.tick({...c.steer(next),jumpReleased:true});
  yield* c.stepFor(6,()=>c.steer(next));
  yield* c.until(()=>p.state==='grind',{grindHeld:true},{label:action.name+' rail contact',limit:100});
  const rail=p.grindRail;c.check(l.rails.includes(rail),action.name+' caught the authored rail instead of a deck rim');let last=p.pos.clone();
  yield* c.until(()=>c.distance(end)<2.5,()=>{
   c.check(p.state==='grind'&&p.grindRail===rail,action.name+' retain the authored rail');
   metrics.grindFrames++;metrics.grindMetres+=p.pos.distanceTo(last);last=p.pos.clone();
   return {moveX:Math.max(-1,Math.min(1,-p.balance*8-p.balanceVel*1.3)),grindHeld:true};
  },{label:action.name+' full grind',limit:2400});
  yield* c.tick({...c.steer(action.to),jumpHeld:true});yield* c.tick({...c.steer(action.to),jumpReleased:true});
  // Board airs retain their travel vector; a sideways stick is a spin trick.
  yield* c.until(()=>p.grounded,{}, {label:action.name+' dismount landing',limit:180});
  yield* brake(action.name+' safe bank stop');
  c.check(Math.abs(p.pos.y-action.to[1])<.35,action.name+' stayed on its receiving balcony');
 }
 function* bounce(action){
  const q=action.from,to=action.to,side=Math.sign(p.pos.x-q[0])||1;
  yield* c.walk([q[0]+side*3.2,q[1],q[2]],action.name+' rim approach');
  yield* c.charge(26);yield* c.tick({jumpReleased:true});
  yield* c.until(()=>!p.grounded&&p.vVel>30,()=>({...c.steer(q),jumpHeld:true}),{label:action.name+' spring contact',limit:200});
  metrics.drumLaunches++;
  yield* c.until(()=>p.pos.y>to[1]+.6,{jumpHeld:true},{label:action.name+' clear the receiving shelf',limit:100});
  yield* c.until(()=>p.grounded,()=>({...c.steer(to),jumpHeld:true}),{label:action.name+' high landing',limit:160});
  c.check(Math.abs(p.pos.y-to[1])<.2&&c.distance(to)<1.5,action.name+' reached its high shelf');
  yield* c.stepFor(4);
 }
 for(let index=fromBeat;index<Math.min(route.length,untilBeat);index++){
  const action=route[index];r.report.beat=index;r.report.stage=action.name;
  if(action.kind==='cache') {if(collect){const box=c.crateNamed(action.target);if(box?.alive)yield* c.hit(box,action.name);}}
  else if(action.kind==='checkpoint'){
   const cp=l.checkpoints.find(q=>Math.hypot(q.spawnPos.x-action.to[0],q.spawnPos.z-action.to[2])<.1&&Math.abs(q.spawnPos.y-.1-action.to[1])<.1);
   yield* c.walk([action.to[0]+(p.pos.x>action.to[0]?1.1:-1.1),action.to[1],action.to[2]],action.name+' approach');yield* c.tick({});yield* c.tick({spinHeld:true});yield* c.stepFor(23);c.check(cp.active,action.name+' activates');
  }
  else if(action.kind==='walk')yield* c.walk(action.to,action.name);
  else if(action.kind==='jump'){yield* c.walk(action.from,action.name+' takeoff',{settle:0});yield* c.hop(action.to,action.name,{tolerance:1.1});}
  else if(action.kind==='spin')yield* spin(action);
  else if(action.kind==='skate')yield* skate(action);
  else if(action.kind==='ollie'){
   yield* c.tick({moveY:1,jumpReleased:true});c.check(p.state==='air',action.name+' launches on the board');
   yield* c.until(()=>p.grounded,{moveY:1},{label:action.name+' landing',limit:180});c.check(p.freeSkate,action.name+' lands skating');
   r.report.evidence.push({action:action.name,verb:'ollie',position:p.pos.toArray(),speed:p.speed});
  }
  else if(action.kind==='grind')yield* grind(action);
  else if(action.kind==='mover')yield* moving(action);
  else if(action.kind==='bounce')yield* bounce(action);
  else if(action.kind==='enemy'){
   const spec=source.components.find(q=>q.nm===action.target&&q.t==='enemy');
   const foe=l.enemies.find(q=>Math.abs((q.x0+q.x1)/2-spec.p[0])<.1&&Math.abs(q.baseY-spec.p[1])<.1&&Math.abs(q.group.position.z-spec.p[2])<.1);
   c.check(foe,action.name+' exists');
   yield* c.walk([spec.p[0]-spec.range-2.2,spec.p[1],spec.p[2]],action.name+' safe approach');
   let spinHeld=false;
   yield* c.until(()=>!foe.alive,()=>{const target=[foe.group.position.x,spec.p[1],spec.p[2]],d=c.distance(target);spinHeld=p.spinning||(d<2.4&&p.spinCd<=0&&!spinHeld);return {...((d>2.2||p.spinning)?c.steer(target,.5):{}),spinHeld};},{label:action.name+' defeat',limit:400});yield* c.stepFor(24);
  }
  r.report.evidence.push({action:'action complete',index,name:action.name,kind:action.kind,position:p.pos.toArray()});
 }
 if(untilBeat<route.length)return {deaths:p.totalDeaths-deaths,beat:r.report.beat,position:p.pos.toArray(),metrics};
 if(collect&&fromBeat===0)yield* c.clearAll('All Waterfall Climb caches and checkpoints');
 yield* c.until(()=>p.state==='finished',{moveX:1},{label:'Cross the summit finish gate',limit:240});
 c.check(p.totalDeaths===deaths,'The continuous route concealed a death');
 return {state:p.state,deaths:p.totalDeaths-deaths,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,activeCheckpoints:l.checkpoints.filter(q=>q.active).length,position:p.pos.toArray(),frames:r.frame,metrics};
}

export function* runWaterfallBonus(r){
 const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
 const hit=function*(name){const box=c.crateNamed(name);if(box.alive)yield* c.hit(box,name);};
 yield* c.stepFor(20);c.check(p.grounded,'Hidden Spillway arrival supported');
 for(const name of ['Arrival parcel','Arrival pair','Arrival pair cap','First wheel supplies'])yield* hit(name);
 const wheel=function*(index,takeoff,landing){
  const b=l.spinBridges[index];yield* c.walk(takeoff,b.component.nm+' approach');
  yield* c.tick({});yield* c.tick({spinHeld:true});
  yield* c.until(()=>b.deployed,{}, {label:b.component.nm+' opens',limit:90});
  yield* c.walk([b.component.p[0]+b.component.s[0]-.65,b.component.p[1],0],b.component.nm+' traverse',{settle:0});
  yield* c.hop(landing,b.component.nm+' gap exit');
 };
 yield* wheel(0,[8.2,0,0],[23,1.2,0]);
 for(const name of ['First receiver cache','First receiver pair','First receiver cap'])yield* hit(name);
 yield* c.walk([30.2,1.2,0],'Bell balcony takeoff');yield* c.hop([34.9,2.4,0],'Bell balcony jump');
 yield* c.highArrowBox(c.crateNamed('Bell rope launcher'),c.crateNamed('High bell cache'),'Keeper bell cache above the launcher');
 yield* hit('Bell keeper provisions');
 yield* c.walk([51.1,2.4,0],'Ferry boarding sill');
 const ferry=l.movers[0],near=()=>ferry.mesh.position.x-7.5/2+.9;
 yield* c.until(()=>near()<55.8,{}, {label:'Wait for the bell keeper ferry',limit:900});
 yield* c.hop(()=>[near(),2.4,0],'Board the moving keeper ferry',{tolerance:1});
 c.check(p.groundHit?.moverId===0,'Keeper ferry actually carries the player');
 yield* c.walk(()=>[ferry.mesh.position.x,2.4,0],'Stand on the ferry',{settle:0});
 yield* c.until(()=>ferry.mesh.position.x>69,{}, {label:'Ride toward the treasury bank',limit:900});
 yield* c.walk(()=>[ferry.mesh.position.x+2.6,2.4,0],'Ferry exit rim',{settle:0});
 yield* c.hop([79,2.4,0],'Leave the moving ferry');
 for(const name of ['Ferry shore pair','Ferry shore pair cap'])yield* hit(name);
 yield* c.walk([89.1,2.4,0],'First rotten beam takeoff');
 yield* c.hop([94,3.1,0],'Reach the first rotten beam',{airButtons:{spinHeld:true}});
 yield* c.tick({});yield* c.tick({spinHeld:true});
 yield* c.walk([98,3.1,0],'Cross the first rotten beam',{settle:0,buttons:{spinHeld:true}});
 yield* c.hop([102,3.8,0],'Transfer before the beam falls',{airButtons:{spinHeld:true}});
 yield* c.tick({});yield* c.tick({spinHeld:true});
 yield* c.walk([106,3.8,0],'Cross the second rotten beam',{settle:0,buttons:{spinHeld:true}});
 yield* c.hop([111,4.5,0],'Reach the safe treasury terrace');
 for(const name of ['Treasury pair','Treasury pair cap','Sluice seal switch'])yield* hit(name);
 yield* c.hop([124,4.5,0],'Clear the spent seal switch');yield* c.walk([127,4.5,0],'Revealed stones takeoff');
 for(const [index,[x,y]]of [[133.5,5.2],[141.5,6]].entries()){
  yield* c.hop([x-1.1,y,0],`Revealed spillway leap ${index+1}`,{airButtons:{spinHeld:true}});
  yield* hit(`Revealed spillway parcel ${index+1}`);
  yield* c.walk([x+1.5,y,0],`Revealed spillway exit ${index+1}`,{settle:0});
 }
 yield* c.hop([149,6.8,0],'Treasury landing');
 for(const name of ['Treasury lower','Treasury crown','Keeper life','Last spillway parcel'])yield* hit(name);
 yield* c.clearAll('Every Hidden Spillway cache');const finish=yield* c.finish('Return from the Hidden Spillway',{limit:240});
 c.check(p.totalDeaths===deaths,'Bonus traversal concealed a death');return {...finish,deaths:0,cratesBroken:p.cratesBroken,frames:r.frame};
}
