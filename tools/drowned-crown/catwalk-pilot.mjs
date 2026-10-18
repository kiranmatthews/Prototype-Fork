/** Ordinary campaign inputs through the current optional ship galleries.
 * The port pilot stops on the bonus stone, then resumes only after the real
 * bonus return (or the native suspended-level contract fixture) has completed. */
export function* pirateCatwalkJourney(r) {
 const {p,l,side}=r,x=1000+side*64,report=r.report??(r.report={stage:'gallery approach',evidence:[]});
 const check=(ok,message)=>{if(!ok)throw Error(message+': '+JSON.stringify({position:p.pos.toArray(),state:p.state,grounded:p.grounded,ground:p.groundHit?.name}));};
 const live=()=>check(!p.isBailing&&!['dead','gameover'].includes(p.state)&&p.totalDeaths===0,'Unexpected gallery bail or death');
 const distance=q=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);
 const input=(q,pace=1)=>{
  const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz),f=p.axisF,fn=Math.hypot(f.x,f.z),fx=f.x/fn,fz=f.z/fn;
  return n<.06?{}:{moveX:(dx*-fz+dz*fx)/n*pace,moveY:(dx*fx+dz*fz)/n*pace};
 };
 function* wait(n,buttons={}){for(let i=0;i<n;i++)yield buttons;}
 const record=name=>report.evidence.push({name,position:p.pos.toArray(),ground:p.groundHit?.name,crystal:p.hasCrystal});
 function* walk(q,name,buttons={}){
  report.stage=name;let i=0;
  while(distance(q)>.16&&i++<4200){yield {...input(q,Math.min(.85,.15+distance(q)*.12)),...buttons};live();}
  check(i<4200,name+' timed out');yield*wait(18,buttons);
  check(p.grounded&&distance(q)<.45&&Math.abs(p.pos.y-q[1])<.7,name+' missed its supported destination');record(name);
 }
 function* hop(q,name,landing){
  report.stage=name;yield*wait(26,{jumpHeld:true});yield{jumpReleased:true};check(p.state==='air',name+' did not launch');
  let i=0;while(!p.grounded&&i++<240){yield p.pos.z<=q[2]?{}:input(q);live();}
  const landed=landing?Math.abs(p.pos.x-q[0])<1.6&&p.pos.z>=landing.minZ&&p.pos.z<=landing.maxZ:distance(q)<1.6;
  check(p.grounded&&landed&&Math.abs(p.pos.y-q[1])<.7,name+' missed its landing');record(name);
  // The charged crossing can retain the board. Brake through the authored
  // rollout before asking the walking pilot to stop beside the next crate.
  if(landing){let n=0;while(p.freeSkate&&n++<120){yield{moveY:-1};live();}check(!p.freeSkate,'Catwalk jump did not roll out');yield*wait(18);}
 }
 if(!r.afterBonus){
  yield*wait(30);check(p.grounded,'Boarding gallery unsupported');
  yield*walk([1000,8,-138],'Boarding gallery approach');
  yield*walk([1000,16,-161],'Climb to the fore gallery');
  yield*walk([x,16,-160],'Cross the fore gallery');
  yield*walk([x,26,-183],'Climb to the '+(side<0?'port':'starboard')+' catwalk');
  yield*walk([x,26,-203.7],'Approach the rigging stores');
  yield*walk([x,26,-211],'Clear the rigging stores',{spinHeld:true});
  yield*walk([x,26,-223],'Approach the gallery reward');
  if(side<0){
   yield*walk([x,26,-226.5],'Approach the captain’s ledger stone');
   yield*hop([x,27.05,-230],'Jump onto the captain’s ledger stone');
   return{phase:'bonus-landing',position:p.pos.toArray(),deaths:p.totalDeaths};
  }
  yield*walk([x,26,-234],'Collect the starboard rigging crystal');
  check(p.hasCrystal,'Starboard route did not collect its crystal');
 }else{
  check(side<0,'Only the port route has a bonus return');
  yield*wait(30);check(p.grounded&&distance([x,26,-223])<.5,'Bonus return is unsupported or misplaced');record('Supported bonus return');
  // The stone does not block the inner edge of this intact 6.45 m module.
  yield*walk([x+2.3,26,-225],'Pass beside the returned bonus stone');
  yield*walk([x+2.3,26,-234],'Pass the captain’s ledger stone');
  yield*walk([x,26,-239],'Rejoin the port catwalk');
 }
 yield*walk([x,26,-244.1],'Broken catwalk takeoff');
 // A charged jump may carry well beyond the near edge; require the actual
 // fifth module's supported landing strip, not one arbitrary point on it.
 yield*hop([x,26,-249.1],'Jump across the broken catwalk',{minZ:-264,maxZ:-248});
 yield*walk([x,26,-263.7],'Approach the aft stores');
 yield*walk([x,26,-272],'Clear the aft stores',{spinHeld:true});
 yield*walk([x,26,-302],'Rear catwalk landing');
 yield*walk([x,16,-330],'Descend to the rear gallery');
 yield*walk([1000,16,-333],'Cross the rear gallery');
 yield*walk([1000,16,-365],'Join the treasury approach');
 check(side<0||p.hasCrystal,'The crystal was lost on the return');
 return{phase:'complete',side,position:p.pos.toArray(),deaths:p.totalDeaths,crystal:p.hasCrystal,evidence:report.evidence};
}
