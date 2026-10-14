const assert={ok:(value,message='Expected a valid traversal state')=>{if(!value)throw Error(message);}};

/** Cooperative device-input steps. The native runner and real browser consume
 * the same decisions, with no pose, velocity, hazard, balance or tuning writes. */
export function rumblewaterSteps(ctx){
 const {r,s,follow,skate,grind,report}=ctx;
 function* untilPred(predicate,sample={},options={}){
  const max=options.maxFrames??5000;
  for(let i=0;i<max&&!predicate();i++){
   yield typeof sample==='function'?sample():sample;
   assert.ok((!r.p.isBailing||r.p.checkpointTripActive)&&!['dead','gameover'].includes(r.p.state),options.label+' remains alive');
  }
  assert.ok(predicate(),options.label+' completes');
 }
 function* until(to,sample=()=>skate(),label='travel'){yield* untilPred(()=>s()>=to,sample,{label});}
 function* stepFor(count,sample={}){for(let i=0;i<count;i++)yield typeof sample==='function'?sample():sample;}
 function* releaseJump(sample={}){yield {...sample,jumpHeld:false,jumpReleased:true};}
 function* charge(count,sample={}){yield* stepFor(count,()=>({...typeof sample==='function'?sample():sample,jumpHeld:true}));}
 function* hop(at,landing,u=0,airU=u){
  yield* until(at,()=>skate(u),'jump approach '+at);yield* releaseJump(follow(airU));
  yield* untilPred(()=>s()>landing&&r.p.grounded,()=>follow(airU),{maxFrames:400,label:'jump landing '+landing});
  report['jump'+at]={...r.snapshot(),progress:s()};
 }
 const neutralGrind=()=>({moveY:0,moveX:Math.max(-1,Math.min(1,-r.p.balance*5-r.p.balanceVel*.7)),grindHeld:true,jumpHeld:true});
 function* catchRail(u,label){yield* untilPred(()=>r.p.state==='grind',()=>grind(u),{maxFrames:700,label});assert.ok(r.l.rails.indexOf(r.p.grindRail)>=0,label+' reaches the authored rail');}
 function* transfer(takeoff,u,label){
  yield* until(takeoff,neutralGrind,label+' approach');const old=r.p.grindRail;assert.ok(old);
  yield* releaseJump({grindHeld:true,moveX:0,moveY:0});yield* stepFor(4,{moveX:0,moveY:0});
  yield* untilPred(()=>r.p.state==='grind'&&r.p.grindRail!==old,()=>({moveX:0,moveY:0,grindHeld:true}),{maxFrames:350,label});
  report[label]={frame:r.frame,progress:s(),rail:r.l.rails.indexOf(r.p.grindRail)};
 }
 function* landRail(u,label){yield* untilPred(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(u),{maxFrames:500,label});}
 return{untilPred,until,stepFor,releaseJump,charge,hop,neutralGrind,catchRail,transfer,landRail};
}
export function* downstreamInputs(ctx,high,start=892){
 const {r,m,s,follow,skate,grind,report}=ctx;
 const {untilPred,until,stepFor,releaseJump,charge,hop,neutralGrind,catchRail,transfer,landRail}=rumblewaterSteps(ctx);
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 if(start<1168){
  yield* until(944,()=>skate(4.9),'first stamping bay');yield* until(988,()=>skate(-4.9),'second stamping bay');
  yield* until(1060,()=>skate(0),'breakaway sluice crossing');
  yield* until(1100,()=>skate(2.6),'left pipe tooth');yield* until(1140,()=>skate(-2.6),'right pipe tooth');
  yield* until(1190,()=>skate(),'sluice exit checkpoint');
 }
 if(start<1436){
  const side=high?1:-1;
  yield* until(1228,()=>skate(side*5.8),'counterweight approach');
  const split=s=>smooth((s-1216)/25)*(1-smooth((s-1370)/46));
  const inner=s=>-6.1*split(s)+1.05*Math.sin((s-1230)/29)*split(s),outer=s=>6*split(s);
  if(high){
   yield* until(1238,()=>skate(outer),'reach marked transfer rail');yield* catchRail(outer,'first transfer rail catch');yield* transfer(1290.5,outer,'causeway rail transfer');
   yield* until(1388,neutralGrind,'causeway receiving grind');yield* landRail(outer,'causeway bank landing');
   yield* until(1428,()=>skate(outer),'causeway merge');
  }else{
   yield* hop(1260.3,1276,inner);yield* hop(1318.2,1335,inner);yield* until(1428,()=>skate(inner),'stepping causeway merge');
  }
 }
 if(start<1676){
  yield* until(1490,()=>skate(-2.8),'climb the broken mill roof');
  yield* hop(1500.3,1517,-2.1);
  yield* until(1533,()=>skate(-4.4),'set up the diagonal roof launch');
  const roofAim=m.rumblePoint(1565,m.rumbleHeight(1565),3.4);
  yield* until(1546.3,()=>({...r.steerToward(roofAim),jumpHeld:true}),'angle across the left roof');
  yield* releaseJump(r.steerToward(roofAim));
  yield* untilPred(()=>s()>1563&&r.p.grounded,()=>r.steerToward(roofAim),{maxFrames:400,label:'diagonal roof landing'});
  report.diagonalRoof=r.snapshot();
  yield* until(1636,()=>skate(s=>s<1587?2.3:2.5*(1-smooth((s-1587)/38))),'falling roof eaves');
  yield* until(1658,()=>skate(3.2),'roof nitro bypass');yield* until(1687,()=>skate(),'roof exit checkpoint');
 }
 if(start<1784){
  yield* hop(1696.3,1712,0);yield* hop(1738.3,1755,1);yield* until(1802,()=>skate(),'flooded teeth');
 }
 if(start<2010){
  yield* until(1819,()=>skate(4.2),'quarry metal chicane');yield* until(1858,()=>skate(-4.2),'quarry nitro chicane');
  yield* until(1902,()=>skate(3.5),'quarry stamping lock');yield* until(1921,()=>skate(3.5),'cross-rolling quarry stone');
  yield* hop(1926.2,1944,2.6);
  if(high){
   yield* until(1952,()=>skate(3.8),'salvage rail approach');yield* catchRail(3.8,'salvage rail catch');
   yield* until(1985,neutralGrind,'salvage grind');yield* landRail(0,'quarry exit landing');
  }else yield* until(2008,()=>skate(s=>s<1964?0:1.4*Math.sin((s-1964)/11)),'quarry falling ledge');
  yield* until(2028,()=>skate(high?3.5:0),'quarry restart court');
 }
 if(start<2258){
  const split=s=>smooth((s-2026)/22)*(1-smooth((s-2195)/33));
  const low=s=>-6.2*split(s)+1.25*Math.sin((s-2050)/24)*split(s),relay=s=>6*split(s)+1.35*Math.sin((s-2040)/30)*split(s);
  if(high){
   yield* until(2039,()=>skate(relay),'reach the marked three-rail admission');yield* catchRail(relay,'relay rail one catch');
   yield* transfer(2087.5,relay,'relay air one');yield* transfer(2147.5,relay,'relay air two');
   yield* until(2227,neutralGrind,'relay exit');yield* landRail(4.5,'relay court landing');
   assert.ok(r.p.hasCrystal,'the relay crystal is collected through actual movement');
  }else{
   yield* hop(2075.2,2091,low);
   yield* until(2129.1,()=>skate(low),'wide split first jump');yield* releaseJump(follow(low));
   yield* stepFor(18,()=>follow(low));yield* charge(5,()=>follow(low));yield* releaseJump(follow(low));
   yield* untilPred(()=>s()>2154&&r.p.grounded,()=>follow(low),{maxFrames:450,label:'wide split double-jump landing'});
   report.doubleJump=r.snapshot();yield* hop(2179.1,2196,low);yield* until(2219,()=>skate(low),'follow the low bank into the shared merge');
  }
  yield* until(2245,()=>skate(4.5),'late counterweight bypass');yield* until(2265,()=>skate(),'throat restart');
 }
 if(start<2470){
  yield* until(2294,()=>skate(2.6),'throat metal tooth');yield* until(2316,()=>skate(-2.6),'throat breakable tooth');
  yield* hop(2322.2,2339,0);yield* until(2370,()=>skate(-2.5),'throat stamping stone');
  yield* until(2408,()=>skate(2.5),'throat counterweight');yield* hop(2414.2,2432,1.1);
  yield* until(2467,()=>skate(-1.8),'returning throat');yield* until(2501,()=>skate(),'last checkpoint');
 }
 if(start<2676){
  yield* until(high?2540:2537,()=>skate(s=>2*Math.sin((s-2506)*Math.PI/36)),'crown falling switchback');
  const groundCrown=s=>s<2550?1.7:1.7-3.4*smooth((s-2550)/17);
  yield* until(high?2556:2552,()=>skate(high?3.7:groundCrown),'first crown stamp');
  if(high){
   const crown=s=>s<2572?3.7-7.3*smooth((s-2555)/17):s<2604?-3.6+6*smooth((s-2572)/32):2.4*(1-smooth((s-2604)/25));
   yield* catchRail(crown,'final crown catch');yield* until(2627.6,neutralGrind,'final crown grind');
   yield* releaseJump({grindHeld:false,moveX:0,moveY:0});
   yield* untilPred(()=>s()>2644&&r.p.grounded,()=>follow(),{maxFrames:450,label:'grind to sanctuary jump'});
  }else{
   yield* until(2576,()=>skate(groundCrown),'second crown stamp');
   yield* until(2620,()=>skate(s=>-2.4*Math.sin((s-2578)*Math.PI/42)),'last collapsing causeway');
   yield* hop(2629.1,2646,0);
  }
  yield* untilPred(()=>r.p.state==='finished',()=>skate(),{maxFrames:900,label:'new sanctuary finish'});
 }
}
export async function driveDownstream(ctx,high,start=892){for(const input of downstreamInputs(ctx,high,start))ctx.r.tick(input);}

/** In the respite room, recover and deliberately spin its checkpoint before
 * remounting. These are ordinary inputs; the threshold tumble remains real. */
export function checkpointApproach(p,l,m,station,follow,frame){
 const index=m.RUMBLEWATER_REFUGES.findIndex(room=>station>room.entry+1&&station<room.checkpoint+1.2);
 if(index<0||l.checkpoints[index].active||p.isBailing)return null;
 const room=m.RUMBLEWATER_REFUGES[index],distance=room.checkpoint-station;
 if(distance>6)return null;
 if(p.spinning)return follow(0,{spinHeld:true});
 if(p.spinCd>0)return {};
 return distance>2.7?follow(0):{...follow(0),spinHeld:frame%2===0};
}
