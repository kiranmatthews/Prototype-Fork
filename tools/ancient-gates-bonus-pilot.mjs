import {puzzleControls} from './puzzle-controls.mjs';

/** Input-only all-box journey, including the revealed return gallery. */
export function* runAncientGatesBonus(r){
 const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
 const box=c.crateNamed;
 const hit=function*(name){if(box(name).alive)yield* c.hit(box(name),name);};
 const walk=function*(x,y=0,label='hoard approach'){yield* c.walk([x,y,0],label);};
 const cargo=function*(name){
  const boxes=l.crates.filter(b=>r.source.components[b.mesh.userData.editorIdx]?.nm?.startsWith(`Hoard delivery / ${name} /`));
  while(boxes.some(b=>b.alive)){
   const next=boxes.filter(b=>b.alive).sort((a,b)=>Math.abs(a.mesh.position.x-p.pos.x)-Math.abs(b.mesh.position.x-p.pos.x))[0];
   yield* c.hit(next,`${name} delivery`);
  }
 };
 const climb=function*(edge,y,label){
  yield* walk(edge-1.5,0,`${label} takeoff`);yield* c.charge();yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.vVel<=7,{}, {label:`${label} first jump`,limit:100});
  yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
  yield* c.until(()=>p.grounded,()=>({...c.steer([edge+2,y,0]),jumpHeld:p.state==='hang'}),{label:`${label} double jump and clamber`,limit:240});
  c.check(Math.abs(p.pos.y-y)<.1,`${label} supported shelf`);
 };
 const hop=function*(x,y,label,{spin=false,double=Math.abs(x-p.pos.x)>6.4,tolerance=1.2}={}){
  const target=[x,y,0],launch=p.pos.toArray();yield* c.charge();yield* c.tick({jumpReleased:true});
  let armed=false,popped=false,lastSpin=false;
  yield* c.until(()=>p.grounded,()=>{
   const input=c.steer(target);
   if(double&&!popped&&p.vVel<1.5){if(!armed){input.jumpHeld=true;armed=true;}else{input.jumpReleased=true;popped=true;}}
   if(spin){input.spinHeld=c.distance(target)<2.2&&p.pos.y<y+2&&(p.spinning||!lastSpin);lastSpin=input.spinHeld;}
   if(p.state==='hang')input.jumpHeld=true;
   return input;
  },{label,limit:240});
  c.check(c.distance(target)<tolerance&&Math.abs(p.pos.y-y)<.16,`${label} actual receiver`);
  r.report.evidence.push({action:label,launch,landing:p.pos.toArray(),double:popped});
 };
 yield* c.stepFor(20);c.check(p.grounded,'supported hoard spawn');
 yield* cargo('arrival');yield* cargo('sealed-court');yield* hit('Jade gallery seal');
 yield* climb(10,6.4,'revealed jade gallery');yield* cargo('jade-gallery');yield* walk(10.5,6.4,'gallery return edge');
 yield* hop(3.5,0,'return from the jade gallery');
 yield* walk(37.2);yield* hop(41.5,0,'clear the spent jade seal');yield* hit('Three-stone causeway seal');
 yield* hop(50.6,0,'clear the spent causeway seal');
 for(const [i,[x,y]] of [[58,1],[66,2],[74,1.2]].entries()){
  yield* hop(x,y,`restored causeway stone ${i+1}`,{spin:true});
  c.check(!box(`Causeway offering ${i+1}`).alive,'causeway reward harvested on actual support');
 }
 yield* hop(81.5,0,'causeway far landing');
 yield* cargo('copper-store');
 yield* walk(102.8);
 for(const [i,x] of [108,112.5,117,121.5,126].entries()){
  yield* hop(x,box(`Permanent relay anchor ${i+1}`).box.max.y,`steel relay anchor ${i+1}`,{spin:true,tolerance:.7});
  c.check(box(`Permanent relay anchor ${i+1}`).alive&&!box(`Relay cap ${i+1}`).alive,'retain anchor after its cap');
 }
 yield* hop(131.5,0,'steel relay exit');
 const upper=box('Treasury upper finite chest'),cap=box('Treasury crown before supports'),hits=upper.hitsRemaining;
 yield* walk(135.3,0,'finite treasury approach');yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>upper.hitsRemaining<hits,()=>c.steer([137,upper.box.max.y,0]),{label:'spend one upper treasury bounce',limit:160});
 yield* c.until(()=>p.vVel<.65,()=>c.steer([137,cap.box.min.y,0]),{label:'treasury rebound apex',limit:100});
 yield* c.tick({jumpHeld:true});yield* c.tick({jumpReleased:true});
 yield* c.until(()=>!cap.alive,()=>c.steer([137,cap.box.min.y,0]),{label:'crown before finite supports',limit:160});
 c.check(upper.alive,'finite support survives until crown is earned');
 yield* c.until(()=>p.grounded,()=>c.steer([134.8,0,0]),{label:'treasury safe descent',limit:200});
 for(const name of ['Treasury upper finite chest','Treasury lower finite chest'])yield* hit(name);
 yield* cargo('treasury-exit');yield* climb(158,6,'last offering shelf');yield* cargo('last-shelf');yield* walk(168.5,6);
 yield* hop(170.5,0,'return from the last shelf');
 yield* walk(170.8);yield* hop(179.5,0,'last hoard opening');
 yield* cargo('departure');
 yield* c.clearAll('all Gatekeeper offerings');
 const result=yield* c.finish('return with the complete Gatekeeper’s Hoard');
 c.check(p.totalDeaths===deaths,'bonus must not hide a reset');
 return {deaths:p.totalDeaths-deaths,frames:r.frame,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,state:p.state,...result};
}
