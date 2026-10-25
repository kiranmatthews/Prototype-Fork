/** Input-only finale pilot, shared by the production-player and Chrome checks. */
export function* runJungleFinale(r, gaps, ledges) {
  const {p,l}=r,events=[];
  const pose=()=>({frame:r.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed,deaths:p.totalDeaths});
  const check=(ok,label)=>{if(!ok)throw Error(label+': '+JSON.stringify(pose()));};
  function* until(test,input,label,limit=2400){
    r.stage=label;
    for(let n=0;n<limit&&!test();n++){
      yield typeof input==='function'?input():input;
      check(!p.isBailing&&!['dead','gameover'].includes(p.state),label);
    }
    check(test(),label+' timed out');
  }
  function* frames(n,input={}){for(let i=0;i<n;i++)yield input;}
  const steer=(x,z,pace=1)=>{
    const dx=x-p.pos.x,dz=z-p.pos.z,n=Math.hypot(dx,dz);
    if(n<.025)return {};
    const f=l.zoneAt(p.pos.x,p.pos.z)?{x:0,z:-1}:l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};
    return {moveX:(dx*-f.z+dz*f.x)/n*pace,moveY:(dx*f.x+dz*f.z)/n*pace};
  };
  function* walk(x,z,label){
    yield* until(()=>Math.hypot(x-p.pos.x,z-p.pos.z)<.12,()=>steer(x,z,Math.min(.8,.14+Math.hypot(x-p.pos.x,z-p.pos.z)*.22)),label);
    yield* frames(22);check(p.grounded,label+' support');
  }
  yield* frames(30);
  for(const [i,gap]of gaps.entries()){
    yield* until(()=>p.pos.z<gap.near+.8,()=>({moveY:1,jumpHeld:true,spinHeld:Math.abs(p.pos.z+702)<3||Math.abs(p.pos.z+1040)<3}),`skate approach ${i+1}`);
    const launch=pose();yield {moveY:1};
    yield* until(()=>p.pos.z<gap.far-3&&p.grounded,{moveY:1},`clear gap ${i+1}`,300);
    events.push({name:gap.name,width:gap.near-gap.far,launch,landing:pose()});
    r.events=events;
  }
  yield* until(()=>p.pos.z<-1300,{moveY:1},'final landing runout');
  yield* until(()=>!p.freeSkate,{moveY:-1},'brake and step off',300);
  yield* frames(25);
  yield* walk(0,-1343,'enter the turning court');
  yield* until(()=>l.checkpoints.some(c=>c.active&&Math.abs(c.spawnPos.z+1345)<.1),
    ()=>({moveY:.25,spinHeld:p.spinning||r.frame%32<12}),'bank climbing checkpoint',240);
  yield* walk(12.5,-1360,'turn right toward the ascent');
  let previous={x:2,w:28,y:0};
  for(const [i,[x,y,w]]of ledges.entries()){
    yield* walk(previous.x+previous.w/2-1.4,-1360,`approach ledge ${i+1}`);
    const launch=pose(),target=x-w/2+1.6;
    yield* frames(26,{jumpHeld:true});yield {...steer(target,-1360),jumpReleased:true};
    yield* until(()=>p.grounded,()=>steer(target,-1360),`climb ledge ${i+1}`,180);
    check(Math.abs(p.pos.y-y)<.2,`ledge ${i+1} landing height`);
    events.push({name:`ledge ${i+1}`,launch,landing:pose()});
    if((i+1)%4===0&&i<11){
      yield* walk(x-.3,-1360,'terrace checkpoint approach');
      yield* until(()=>l.checkpoints.some(c=>c.active&&Math.abs(c.spawnPos.x-x-1)<.1),
        ()=>({moveX:.15,spinHeld:p.spinning||r.frame%32<12}),'bank terrace checkpoint',240);
      check(l.checkpoints.some(c=>c.active&&Math.abs(c.spawnPos.x-x-1)<.1),'terrace checkpoint');
    }
    previous={x,y,w};
  }
  yield* walk(176,-1360,'summit sanctuary approach');
  yield* frames(26,{jumpHeld:true});yield {moveX:1,jumpReleased:true,spinHeld:true};
  yield* until(()=>p.state==='finished',()=>({moveX:1,spinHeld:p.spinning||r.frame%32<12}),'cross the summit finish',300);
  events.push({name:'finish',...pose()});return events;
}
