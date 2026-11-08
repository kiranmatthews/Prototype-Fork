// Temple of Embers · one continuous input-only journey from spawn to the gate.
// Ordinary device samples shared by the Node runtime and a real browser.
// The rider skates the whole course: it grinds the gold rails over the ember
// stones and both burning ropes, boosts across the ash floor, rides the right
// lane past the censers, waits for the brazier lift, keeps to the serpent's
// and the bull's off-side lanes, pumps the bowl, times each piston, ollies
// the leap, weaves the gauntlet and crosses the gate.
export function* runEmberJourney(r){
 const route=r.route,p=r.p,l=r.l,sp=route.setPieces,THREE=r.THREE;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Grind crossings: approach lane, pop station, the line to balance along, exit.
 const grinds=[
  {name:'first ember chasm rail',from:140,pop:151.5,a:156,b:184,side:3.6,exit:187},
  {name:'second ember chasm rail',from:188,pop:191.5,a:196,b:235,side:3.6,exit:238},
  {name:'first burning rope',from:244,pop:257.6,a:261.5,b:276.5,side:-1.6,exit:277.3},
  {name:'second burning rope',from:277.3,pop:278.4,a:280.5,b:300.5,side:-1.6,exit:303},
 ];
 const popped=new Set(),jumps=route.gaps.filter(g=>g.b-g.a<9); // the seven-metre leap
 let braking=false,liftCommit=false,liftExit=false,liftPrevDeck=Infinity;const crusherPrev=new Map();
 const flames=route.tikiTrials;
 const laneFor=s=>{
  const tiki=flames.find(q=>s>q.s-13&&s<q.s+5);
  if(tiki)return -tiki.side*(s>1040&&s<1125?2.6:3.15); // the climb's rail is on the safe side
  if(sp.serpent&&s>sp.serpent.s-sp.serpent.range-14&&s<sp.serpent.s+sp.serpent.range+4)return -3.15;
  const bull=l.enemies.find(e=>e.alive&&e.kind==='charger');
  if(bull){const q=route.toLocal(bull.group.position.toArray())[0];if(s>q-32&&s<q+14)return -3.15;}
  if(sp.crumbles.length&&s>sp.crumbles[0].a-20&&s<sp.crumbles.at(-1).b+3)return 0; // the ash pads zigzag about the centre line
  if(sp.zone&&s>sp.zone.a-8&&s<sp.zone.b+4)return 2.3; // censers swing down the centre
  if(sp.speedPads.some(q=>Math.abs(s-q.s)<9&&q.s>1200))return -3.0; // keep off the vault boost, on the side away from the nitro
  if(s>1205&&s<1240)return -1.25; // nitro glows on the right
  return 1.25;
 };
 const speedCap=s=>{
  const pipe=route.pipes.find(q=>s>q.a-55&&s<q.b+8);
  if(pipe)return Math.sqrt(31.17*pipe.radius)+4.2;
  const turn=route.frameAt(s),future=route.frameAt(s+10);
  if(turn.fx*future.fx+turn.fz*future.fz<.985)return 11;
  if(grinds.some(g=>s>g.from&&s<g.pop))return 12.5;
  if(sp.crumbles.length&&s>sp.crumbles[0].a-14&&s<sp.crumbles.at(-1).b+6)return 40; // the boost carries the ash floor; never brake on it
  if(sp.lift&&s>sp.lift.a-30&&s<sp.lift.a)return 7;
  if(sp.crushers.length&&s>sp.crushers[0].s-24&&s<sp.crushers.at(-1).s+2)return 4.5;
  if(s>1385&&s<1450)return 13; // the gauntlet weave
  return 24;
 };
 for(let frame=0;frame<42000&&p.state!=='finished';frame++){
  if(p.isBailing||['dead','gameover'].includes(p.state))throw Error('Temple journey lost control at '+JSON.stringify({frame,position:p.pos.toArray(),local:route.toLocal(p.pos.toArray()),state:p.state}));
  if(r.nodeCamera){const camera=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(camera.x,0,camera.z);}
  const local=route.toLocal(p.pos.toArray()),s=local[0],turn=route.frameAt(s);
  const ahead=(d,side,y=p.pos.y)=>route.toWorld(Math.min(route.end-4,s+Math.min(d,d/turn.scale)),y,side);
  const toward=(target,pace=1)=>{const d={x:target[0]-p.pos.x,z:target[2]-p.pos.z};return r.worldDirectionInput(d,pace);};
  const sample=(()=>{
   // Fell beneath the ropes: walk to the bellows under the landing and bounce back.
   if(p.pos.y<-2&&s>255&&s<306){
    const pad=sp.trampolines.find(q=>q.s===298);
    if(p.grounded&&Math.hypot(...((q=>[q[0]-p.pos.x,q[2]-p.pos.z])(route.toWorld(pad.s,-5,0))))>.9)return {...toward(route.toWorld(pad.s,-5,0),.5)};
    return {...toward(route.toWorld(304,0,0),.6),jumpHeld:p.grounded||p.vVel>0};
   }
   // Grind crossings: charge on the approach, release once at the pop station,
   // hold grind only in the air and on the line, and never touch jump again
   // until the far floor (a release while grinding is an ollie off the line).
   const g=grinds.find(q=>s>=q.from&&s<q.exit);
   if(g){
    const launched=popped.has(g.pop);
    if(p.state==='grind'){
     const correction=clamp(-p.balance*5-p.balanceVel*.7,-1,1);
     return {...toward(route.toWorld(g.b+6,p.pos.y,g.side),.9),moveX:correction,grindHeld:true};
    }
    const pop=!launched&&s>=g.pop&&p.grounded;
    if(pop)popped.add(g.pop);
    const target=ahead(p.grounded?6:3,g.side);
    if(launched)return {...toward(target,1),grindHeld:!p.grounded};
    return {...toward(target,1),jumpHeld:!pop,grabHeld:!pop&&p.grounded&&p.speed>speedCap(s)};
   }
   // The brazier lift: stop a metre short of the well, commit as the deck
   // comes down through the floor height, board it and ride to the top.
   if(sp.lift&&s>sp.lift.a-9&&s<sp.lift.b+1&&p.pos.y>sp.lift.low-1){
    const lift=l.movers[0],deckY=lift.mesh.position.y+(lift.mesh.geometry?.parameters?.height??.85)/2,descending=deckY<liftPrevDeck-1e-4;liftPrevDeck=deckY;
    const onLift=p.groundHit?.moverId!=null,centre=route.toWorld((sp.lift.a+sp.lift.b)/2,p.pos.y,0);
    if(onLift){
     // Push off as the deck nears the top, so the step onto the landing meets it level.
     liftCommit=false;
     if(!liftExit&&deckY>sp.lift.high-.7&&!descending)liftExit=true;
     if(liftExit&&deckY<sp.lift.high-1.6)liftExit=false;
     if(!liftExit)return {jumpHeld:true};
     return {...toward(route.toWorld(sp.lift.b+6,sp.lift.high,0),1),jumpHeld:true};
    }
    liftExit=false;
    if(!liftCommit&&deckY<sp.lift.low+.45&&descending)liftCommit=true;
    if(liftCommit&&deckY>sp.lift.low+.9)liftCommit=false;
    if(liftCommit)return {...toward(centre,1),jumpHeld:true};
    const wait=route.toWorld(sp.lift.a-1,p.pos.y,0),d=Math.hypot(wait[0]-p.pos.x,wait[2]-p.pos.z);
    return {grabHeld:p.speed>.3&&d<2.5,jumpHeld:true,...toward(wait,d>2.5?.6:d>.4?.2:0)};
   }
   // The piston vault: wait in front of each hammer and go the moment it
   // lifts off the deck, so the whole rise and hang are the window.
   const next=sp.crushers.find(c=>s<c.s+2.2);
   if(next&&s>sp.crushers[0].s-14&&s<sp.crushers.at(-1).s+2.2){
    const block=l.crushers[sp.crushers.indexOf(next)],y=block.mesh.position.y,prev=crusherPrev.get(next.s)??y;crusherPrev.set(next.s,y);
    // Commit only as the block leaves the deck: the whole rise and hang are then ahead.
    const liftingOff=y>prev+1e-4&&y<block.restY+1.2;
    // The hammers span the whole floor, so the rider stops straight in its own
    // lane (a board cannot slide sideways, and steering toward a centred
    // target would arc it under the block), then pushes straight through.
    const lane=clamp(local[2],-5,5);
    if(crusherPrev.get('go')===next.s)return {...toward(route.toWorld(next.s+5,p.pos.y,lane),1),jumpHeld:true};
    const inZone=s>next.s-7.5&&s<next.s-2.6;
    if(inZone){
     if(p.speed>.25)return {grabHeld:true,jumpHeld:true};
     if(liftingOff)crusherPrev.set('go',next.s);
     return {jumpHeld:true};
    }
    return {...toward(route.toWorld(next.s-5,p.pos.y,lane),.35),jumpHeld:true,grabHeld:p.speed>4.5};
   }
   // Ordinary skating: lane choice, speed cap, the seven-metre leap.
   const jump=jumps.find(q=>!popped.has(q.a)&&s>=q.a-.35&&s<q.a);
   const pop=!!jump&&p.grounded;if(pop)popped.add(jump.a);
   const cap=speedCap(s);if(p.speed>cap)braking=true;else if(p.speed<cap-3)braking=false;
   const corner=turn.fx*route.frameAt(s+10).fx+turn.fz*route.frameAt(s+10).fz<.985;
   const target=ahead(corner?2.8:7,laneFor(s));
   const move=!pop&&(p.grounded||!p.airFromSkate)?toward(target):{};
   return {...move,jumpHeld:!pop,grabHeld:!pop&&braking&&p.grounded};
  })();
  // A grab is only ever a grounded brake; in the air it is a trick that bails on landing.
  if(sample.grabHeld&&!p.grounded)sample.grabHeld=false;
  // Spin anything spin-killable that comes close, and bank each checkpoint.
  if(p.grounded&&p.state!=='grind'){
   const checkpoint=l.checkpoints.some(cp=>!cp.active&&cp.box.distanceToPoint(p.pos)<3.5);
   const enemy=l.enemies.some(e=>e.alive&&e.spinKill&&(e.kind!=='charger'||e.state==='recover'||e.state==='patrol')&&e.box.distanceToPoint(p.pos)<3.2);
   const plainCrate=l.crates.some(c=>c.alive&&!c.pending&&!c.metal&&!c.metalBounce&&!c.bang&&!c.nitroBang&&!c.bouncy&&!c.tnt&&!c.nitro&&c.box.distanceToPoint(p.pos)<2.8);
   const explosive=l.crates.some(c=>c.alive&&!c.pending&&(c.tnt||c.nitro)&&c.box.distanceToPoint(p.pos)<3.5);
   if(checkpoint||(plainCrate||enemy)&&!explosive)sample.spinHeld=p.spinning||!r.lastInput.spinHeld;
  }
  void THREE;
  yield sample;
 }
 if(p.state!=='finished')throw Error('Temple journey timed out at '+JSON.stringify(route.toLocal(p.pos.toArray())));
 return {state:p.state,deaths:p.totalDeaths,position:p.pos.toArray()};
}
