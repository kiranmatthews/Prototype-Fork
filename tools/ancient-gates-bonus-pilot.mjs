import {puzzleControls} from './puzzle-controls.mjs';

/** Input-only all-box journey. Includes returning for both conserved arrows. */
export function* runAncientGatesBonus(r){
 const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
 const box=c.crateNamed;
 const hit=function*(name){if(box(name).alive)yield* c.hit(box(name),name);};
 const walk=function*(x,y=0,label='hoard approach'){yield* c.walk([x,y,0],label);};
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
 yield* hit('Gatekeeper welcome');yield* hit('Gatekeeper welcome cap');
 yield* walk(4.2);yield* hop(9,0,'preserve the jade arrow outward');
 yield* hit('First sealed offering');yield* hit('First sealed offering cap');yield* hit('Jade gallery seal');
 c.check(box('Keep the jade arrow').alive&&!box('Revealed jade life').pending,'seal opens gallery without consuming arrow');
 yield* walk(7.8,0,'return to the conserved jade arrow');
 yield* c.bounce(box('Keep the jade arrow'),[11.8,6.4,0],'jade gallery ascent',{double:true,airSpinAbove:5.2});
 yield* hit('Revealed jade life');yield* hit('Revealed jade cache');yield* walk(10.5,6.4,'gallery return edge');
 yield* hop(3.5,0,'return before collecting the jade arrow');yield* hit('Keep the jade arrow');
 yield* walk(37.2);yield* hop(41.5,0,'clear the spent jade seal');yield* hit('Three-stone causeway seal');
 yield* hop(50.6,0,'clear the spent causeway seal');
 for(const [i,[x,y]] of [[58,1],[66,2],[74,1.2]].entries()){
  yield* hop(x,y,`restored causeway stone ${i+1}`,{spin:true});
  c.check(!box(`Causeway offering ${i+1}`).alive,'causeway reward harvested on actual support');
 }
 yield* hop(81.5,0,'causeway far landing');
 for(const name of ['Copper store parcel','Copper fruit chest','Copper store cache'])yield* hit(name);
 yield* walk(102.8);
 for(const [i,x] of [108,112.5,117,121.5,126].entries()){
  yield* hop(x,.96,`steel relay anchor ${i+1}`,{spin:true,tolerance:.7});
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
 for(const name of ['Treasury upper finite chest','Treasury lower finite chest','Treasury exit cache'])yield* hit(name);
 yield* c.bounce(box('Final hoard arrow'),[159.4,6,0],'last offering shelf',{double:true,airSpinAbove:4.8});
 yield* hit('Last shelf offering');yield* hit('Last shelf life');yield* walk(158.5,6);
 yield* hop(150.5,0,'return from the last shelf');yield* hit('Final hoard arrow');
 yield* walk(170.8);yield* hop(179.5,0,'last hoard opening');
 for(const name of ['Departure offering','Departure offering cap','Gatekeeper farewell'])yield* hit(name);
 yield* c.clearAll('all Gatekeeper offerings');
 const result=yield* c.finish('return with the complete Gatekeeper’s Hoard');
 c.check(p.totalDeaths===deaths,'bonus must not hide a reset');
 return {deaths:p.totalDeaths-deaths,frames:r.frame,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,state:p.state,...result};
}
