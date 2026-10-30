/** Ordinary controller samples from the arcade checkpoint to the bonus stone. */
export function* runMayfieldBonusEntrance(r){
 const {p,l}=r,entry=r.entry;
 const distance=q=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);
 const steer=q=>{const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz)||1,f=p.courseInputDirection(l)??p.camDir,k=Math.min(.8,n/.65);return{moveX:(dx*-f.z+dz*f.x)/n*k,moveY:(dx*f.x+dz*f.z)/n*k};};
 const check=(ok,label)=>{if(!ok)throw Error(`${label}: ${JSON.stringify({position:p.pos.toArray(),state:p.state,ground:p.groundHit?.name})}`);};
 function* until(test,sample,label,limit=600){r.report.stage=label;for(let i=0;i<limit&&!test();i++){yield typeof sample==='function'?sample():sample;check(!p.isBailing&&!['dead','gameover'].includes(p.state),label);}check(test(),label+' timed out');}
 yield* until(()=>p.grounded,{},'Supported arcade start');
 const approach=[entry[0]+3.4,entry[1],entry[2]+2.5];
 yield* until(()=>distance(approach)<.17,()=>steer(approach),'Walk to arcade bonus');
 for(let i=0;i<18;i++)yield{};
 check(p.grounded,'Supported bonus takeoff');
 r.report.stage='Deliberate jump onto bonus stone';
 for(let i=0;i<26;i++)yield{jumpHeld:true};
 yield{jumpReleased:true};check(p.state==='air','Bonus jump must launch');
 yield* until(()=>p.grounded,()=>steer(entry),'Land on bonus stone',180);
 check(distance(entry)<1.6&&Math.abs(p.pos.y-entry[1]-1.05)<.3,'Land on the actual bonus stone');
 return{position:p.pos.toArray(),ground:p.groundHit?.name,deaths:p.totalDeaths};
}
