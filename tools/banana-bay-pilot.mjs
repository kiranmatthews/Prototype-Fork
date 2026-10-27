/** Production inputs through the entire main route. Targets choose authored
 * centre lines and safe lanes; no position/velocity/crate edits occur here. */
export function* runBananaBay(r){
  const {p,l,route,sourceModule}=r;
  const check=(ok,label)=>{if(!ok)throw Error(`${label}: ${JSON.stringify({frame:r.frame,p:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths})}`);};
  const distance=q=>Math.hypot(q[0]-p.pos.x,q[2]-p.pos.z);
  const steer=(q,pace=1)=>{
    const dx=q[0]-p.pos.x,dz=q[2]-p.pos.z,n=Math.hypot(dx,dz);
    if(n<.03)return {};
    const f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1},m=Math.hypot(f.x,f.z)||1,fx=f.x/m,fz=f.z/m;
    const v=Math.min(pace,n/.65),x=(dx*-fz+dz*fx)/n,y=(dx*fx+dz*fz)/n;
    // Follow the camera lane for small corrections. Tiny sideways requests
    // otherwise engage the game's diagonal input gate and shorten the jump.
    return n>1.2&&Math.abs(x)<.24?{moveX:0,moveY:Math.sign(y)*v}:{moveX:x*v,moveY:y*v};
  };
  const live=label=>check(!['dead','gameover'].includes(p.state)&&!p.isBailing,label);
  function* ticks(n,s={}){for(let i=0;i<n;i++)yield typeof s==='function'?s(i):s;}
  function* until(fn,s,label,limit=900){
    r.report.stage=label;const start=r.frame;
    for(let i=0;i<limit&&!fn();i++){yield typeof s==='function'?s(i):s;live(label);}
    check(fn(),`${label} timeout`);r.report.actions.push({name:label,firstFrame:start,lastFrame:r.frame});
  }
  const attack=i=>({spinHeld:p.spinning||i%27===0});
  function* walk(q,label,{spin=true,stop=true}={}){
    yield* until(()=>distance(q)<.15,i=>({...steer(q,.85),...(spin?attack(i):{})}),label,1800);
    if(stop)yield* ticks(12);live(label);
  }
  function* hop(q,label,{double=false,spin=true,tolerance=1.4}={}){
    yield* ticks(26,{jumpHeld:true});yield {jumpReleased:true};
    check(p.state==='air',`${label} launch`);let air=0;
    yield* until(()=>p.grounded,i=>{
      air++;return {...steer(q),...(spin?attack(i):{}),...(double&&air===29?{jumpHeld:true}:{}),...(double&&air===30?{jumpReleased:true}:{})};
    },label,220);
    check(distance(q)<tolerance,`${label} landing`);
    r.report.evidence.push({action:label,p:p.pos.toArray(),ground:p.groundHit?.name});
    yield* ticks(12);
  }
  yield* ticks(20);check(p.grounded,'supported arrival');
  if(!['finale','ferry'].includes(r.startAt)){
  let d=24;
  // Coast: follow each raised centreline, taking the real breaks. The Nitro
  // side pocket is seaward, so choose the clear landward cargo lane.
  while(d<=712){
    const beat=route.BAY_COAST_BEATS.find(b=>d>=b.a-9&&d<=b.b+9);
    let lateral=beat?.lateral??0;if(d>=453&&d<=466)lateral=1.25;
    if(beat?.gap&&d>=beat.gap[0]-4&&d<beat.gap[1]){
      if(beat.name==='Loose board lesson'){
        yield* walk(route.bayCoastPoint(595.2,beat.lateral),'loose board takeoff');
        yield* hop(route.bayCoastPoint(599,beat.lateral),'safe-sand loose board');
        yield* walk(route.bayCoastPoint(604.2,beat.lateral),'loose board departure',{stop:false});
        yield* hop(route.bayCoastPoint(608,beat.lateral),'loose board receiver');d=611;
      }else{
        yield* walk(route.bayCoastPoint(beat.gap[0]-.8,beat.lateral),`${beat.name} takeoff`);
        yield* hop(route.bayCoastPoint(beat.gap[1]+1,beat.lateral),`${beat.name} crossing`);d=beat.gap[1]+5;
      }
      continue;
    }
    yield* walk(route.bayCoastPoint(d,lateral),`coast ${d.toFixed(1)}`,{stop:false});d+=4;
  }
  yield* walk([1,1.05,-738],'lagoon departure checkpoint');
  yield* walk([0,1.05,-752],'lagoon connector');
  const island=sourceModule.sunnyIslandPoint;
  for(let d=8;d<=376;d+=4){
    if(d===76){yield* walk(island(81.2),'first ramp takeoff');yield* hop(island(88),'first lagoon ramp jump',{double:true});d=92;}
    if(d===164){yield* walk(island(165.2),'first rope takeoff');yield* hop(island(173),'first rope span',{double:true});d=180;}
    if(d===244){yield* walk(island(251.2),'second ramp takeoff');yield* hop(island(259),'second lagoon ramp jump',{double:true});d=264;}
    if(d===328){yield* walk(island(326.2),'second rope takeoff');yield* hop(island(335),'second rope span',{double:true,tolerance:2.6});d=340;}
    yield* walk(island(d),`lagoon ${d}`,{stop:false});
  }
  }
  const f=route.bayFinalePoint;
  if(r.startAt!=='ferry'){
  for(let d=0;d<=50;d+=4)yield* walk(f(d),`salvage approach ${d}`,{stop:false});
  yield* walk(f(53.2),'salvage step takeoff');
  for(const [d,y,end]of [[58,1.65,64.2],[69,2.25,75.2],[80,1.65,86.2],[91,1.05,94]]){
    yield* hop(f(d,0,y),`salvage step ${d}`);
    yield* walk(f(end,0,y),`salvage step ${d} departure`);
  }
  }
  for(let d=96;d<=116;d+=4)yield* walk(f(d),`ferry approach ${d}`,{stop:false});
  yield* walk(f(119.2),'wait at the tidal ferry');
  const ferry=l.movers.find(m=>Math.abs(m.base.z-f(129)[2])<.2)??l.movers[0];
  check(ferry,'tidal ferry exists');
  yield* until(()=>Math.abs(ferry.mesh.position.x-f(129)[0])<1,{},'tidal ferry aligns',900);
  yield* hop([ferry.mesh.position.x,1.05,ferry.mesh.position.z+5.8],'board the tidal ferry');
  yield* walk([ferry.mesh.position.x,1.05,ferry.mesh.position.z-5.8],'walk across the tidal ferry');
  yield* until(()=>Math.abs(ferry.mesh.position.x-f(138.6)[0])<1,{},'tidal ferry receiver alignment',900);
  yield* hop(f(138.6),'tidal ferry receiver');
  for(let d=144;d<=164;d+=4)yield* walk(f(d),`breakwater approach ${d}`,{stop:false});
  yield* walk(f(166.2),'breakwater checkpoint takeoff');
  for(const [d,end]of [[171,177.2],[182,188.2],[193,199.2],[205,207]]){
    yield* hop(f(d),`breakwater deck ${d}`);
    yield* walk(f(end),`breakwater deck ${d} departure`,{stop:false});
  }
  for(let d=210;d<=237;d+=3)yield* walk(f(d),`finish quay ${d}`,{stop:false});
  yield* until(()=>p.state==='finished',{moveY:1},'actual finish gate',240);
  check(p.totalDeaths===0,'full route has no concealed respawn');
  return {state:p.state,frames:r.frame,seconds:r.frame*r.dt,deaths:p.totalDeaths,cratesBroken:p.cratesBroken,
    enemiesDefeated:l.enemies.filter(e=>!e.alive).length,position:p.pos.toArray(),completionScope:r.startAt?`isolated ${r.startAt} start`:'continuous main-route traversal; optional cargo separately validated'};
}
