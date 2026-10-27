import {puzzleControls} from './puzzle-controls.mjs';

/** One continuous journey using only production device samples. */
export function* runWaterfallClimb(r,{collect=true,untilBeat=Infinity,fromBeat=0}={}){
 const c=puzzleControls(r),{p,l,source}=r,route=r.route??r.sourceModule.WATERFALL_BEATS;
 const deaths=p.totalDeaths,visited=new Set();
 const passageButtons=collect?{}:{get spinHeld(){return p.spinning||r.frame%14===0;}};
 yield* c.stepFor(20);c.check(p.grounded,'Waterfall source spawn is supported');
 const sameFloor=(a,b)=>{
  const d=Math.hypot(a[0]-b[0],a[2]-b[2]),n=Math.max(2,Math.ceil(d/.6));
  for(let i=0;i<=n;i++){
   const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
   if(!source.components.some(k=>k.t==='platform'&&Math.abs(k.p[1]+k.s[1]/2-a[1])<.05
    &&Math.abs(x-k.p[0])<k.s[0]/2-.18&&Math.abs(z-k.p[2])<k.s[2]/2-.18))return false;
  }
  return true;
 };
 function* avoidBonus(target){
  // The raised bonus stone has real circular side collision. Keep collection
  // approaches on the open apron, including the checkpoint after bonus return.
  const bonus=source.components.find(k=>k.t==='bonusplatform'&&Math.abs(k.p[1]-p.pos.y)<.1);
  if(!bonus)return;
  const dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,d2=dx*dx+dz*dz;
  if(d2<1e-6)return;
  const t=Math.max(0,Math.min(1,((bonus.p[0]-p.pos.x)*dx+(bonus.p[2]-p.pos.z)*dz)/d2));
  if(Math.hypot(p.pos.x+dx*t-bonus.p[0],p.pos.z+dz*t-bonus.p[2])<3.5)
   yield* c.walk([bonus.p[0],p.pos.y,bonus.p[2]+4.8],'Walk around the raised bonus entrance');
 }
 function* collectHere(){
  if(!collect)return;
  const candidates=source.components.filter(k=>['crate','checkpoint'].includes(k.t)&&!visited.has(k.nm)
   &&Math.abs(k.p[1]-p.pos.y)<.1&&Math.hypot(k.p[0]-p.pos.x,k.p[2]-p.pos.z)<45
   &&sameFloor(p.pos.toArray(),k.p));
  candidates.sort((a,b)=>Math.hypot(a.p[0]-p.pos.x,a.p[2]-p.pos.z)-Math.hypot(b.p[0]-p.pos.x,b.p[2]-p.pos.z));
  for(const spec of candidates){
   if(spec.t==='crate'){
    const crate=c.crateNamed(spec.nm);
    if(crate?.alive){
     yield* avoidBonus(spec.p);
     yield* c.hit(crate,spec.nm);
    }
   }else{
    const cp=l.checkpoints.find(k=>Math.hypot(k.spawnPos.x-spec.p[0],k.spawnPos.z-spec.p[2])<.1&&Math.abs(k.spawnPos.y-.1-spec.p[1])<.1);
    if(cp&&!cp.active){
     yield* avoidBonus([spec.p[0]-1.1,spec.p[1],spec.p[2]]);
     yield* c.walk([spec.p[0]-1.1,spec.p[1],spec.p[2]],spec.nm+' approach');
     yield* c.tick({});yield* c.tick({spinHeld:true});yield* c.stepFor(24);
     c.check(cp.active,spec.nm+' activated');
    }
   }
   visited.add(spec.nm);
  }
 }
 for(let index=fromBeat;index<Math.min(route.length,untilBeat);index++){
  const beat=route[index];r.report.beat=index;
  yield* collectHere();
  // Fragile and timed receivers are crossed promptly; permanent ledges have
  // room to release the controls and inspect the next jump.
  const temporary=l.spinBridges.some(b=>b.deployed&&p.groundHit?.mesh===b.mesh)||p.groundHit?.crumbleId!==undefined;
  yield* c.walk(beat.from,beat.name+' takeoff',{settle:temporary?0:8,buttons:passageButtons});
  const jumpSpin=beat.bridge&&l.spinBridges.find(b=>b.component.nm===beat.bridge).component.p[1]>beat.from[1]+.4;
  if(beat.bridge&&!jumpSpin){
   const bridge=l.spinBridges.find(b=>b.component.nm===beat.bridge);c.check(bridge,beat.name+' bridge exists');
   yield* c.tick({});yield* c.tick({spinHeld:true});
   yield* c.until(()=>bridge.deployed,{}, {label:beat.name+' deploy',limit:100});
   r.report.evidence.push({action:beat.name+' spin',remaining:bridge.remaining,state:bridge.state});
   if(Math.abs(beat.to[2]-beat.from[2])>8){
    // River lock: walk the long lowered leaf, then hop the exposed seam.
    yield* c.walk([beat.from[0],beat.from[1],bridge.component.p[2]-bridge.component.s[0]+.8],beat.name+' cross open timber',{settle:0,buttons:passageButtons});
   }
  }
  yield* c.hop(beat.to,beat.name,{chargeFrames:26,...jumpSpin?{airButtons:{spinHeld:true}}:{}});
  if(jumpSpin)c.check(l.spinBridges.find(b=>b.component.nm===beat.bridge).deployed,beat.name+' opened in the jump');
  r.report.evidence.push({action:'beat complete',index,name:beat.name,position:p.pos.toArray()});
 }
 if(untilBeat<route.length)return {deaths:p.totalDeaths-deaths,beat:r.report.beat,position:p.pos.toArray()};
 yield* collectHere();
 if(collect&&fromBeat===0)yield* c.clearAll('Every river and waterfall checkpoint/cache');
 yield* c.walk([62,p.pos.y,route.at(-1).to[2]],'Reach the summit crystal');
 yield* c.until(()=>p.state==='finished',{moveX:1},{label:'Cross the summit finish gate',limit:220});
 c.check(p.totalDeaths===deaths,'Waterfall traversal concealed a death');
 return {state:p.state,deaths:p.totalDeaths-deaths,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,
  activeCheckpoints:l.checkpoints.filter(k=>k.active).length,position:p.pos.toArray(),frames:r.frame};
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
 yield* hit('Bell keeper provisions');yield* wheel(1,[51.2,2.4,0],[67,2.4,0]);yield* hit('Safe island cache');
 yield* wheel(2,[71.2,2.4,0],[86.9,3.6,0]);
 for(const name of ['Treasury pair','Treasury pair cap','Sluice seal switch'])yield* hit(name);
 yield* c.hop([97.5,3.6,0],'Clear the spent switch');yield* c.walk([99.3,3.6,0],'Revealed stones takeoff');
 for(const [index,[x,y]]of [[103.5,4.2],[109,4.8],[114.5,5.4]].entries()){
  yield* c.hop([x,y,0],`Revealed spillway leap ${index+1}`,{airButtons:{spinHeld:true}});
  yield* hit(`Revealed spillway parcel ${index+1}`);
 }
 yield* c.hop([120,5.4,0],'Treasury landing');
 for(const name of ['Treasury lower','Treasury middle','Treasury crown','Lost river cache','Keeper life','Last spillway parcel'])yield* hit(name);
 yield* c.clearAll('Every Hidden Spillway cache');const finish=yield* c.finish('Return from the Hidden Spillway',{limit:240});
 c.check(p.totalDeaths===deaths,'Bonus traversal concealed a death');return {...finish,deaths:0,cratesBroken:p.cratesBroken,frames:r.frame};
}
