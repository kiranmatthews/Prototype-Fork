import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const options={modulePath:'/src/levels/ghost-train.ts',levelId:'ghost-train',source:m=>m.GHOST_TRAIN_LEVEL,
  controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z},maxFrames:54000};
const station=r=>r.sourceModule.ghostRouteProgress(r.p.pos);
const safe=r=>assert.ok(!r.p.isBailing&&!['dead','gameover'].includes(r.p.state),JSON.stringify(r.snapshot()));
const top=m=>m.mesh.position.y+m.mesh.geometry.parameters.height/2;
const local=(r,m,x,z)=>m.mesh.localToWorld(new r.THREE.Vector3(x,m.mesh.geometry.parameters.height/2,z)).toArray();

/** Walk, charge and jump between production moving supports without writes. */
export function runGhostCartRelay(r,relay){
  const begin=r.frame,deaths=r.p.totalDeaths,fixtures=r.sourceModule.GHOST_TRAIN_CARTS.filter(c=>c.relay===relay);
  const carts=fixtures.map(c=>r.l.movers.find(m=>Math.hypot(m.base.x-c.p[0],m.base.z-c.p[2])<.03));
  assert.ok(carts.every(Boolean),'all authored moving carts must exist');
  const gap=r.sourceModule.GHOST_TRAIN_GAPS.filter(g=>g.kind==='cart')[relay];
  const cartAim=target=>{const input=r.steerToward(target);if(Math.abs(input.moveX)<.12)input.moveX=0;return input;};
  const walk=(target,name)=>{
    r.until(()=>r.distanceTo(target)<.16,()=>{
      assert.ok(r.p.grounded,`${name}: walked off support ${JSON.stringify(r.snapshot())}`);
      return r.steerToward(target,{pace:Math.min(.55,.16+r.distanceTo(target)*.14),tolerance:.13});
    },{maxFrames:1800,label:name});
    r.stepFor(24);safe(r);assert.ok(r.p.grounded,`${name}: settle must stay supported`);
  };
  r.until(()=>r.sourceModule.ghostRouteProgress(local(r,carts[0],0,3.3))<gap.a-.8&&carts[0].lastDelta.z>=-.001,{},
    {maxFrames:720,label:'wait on the loading dock for the incoming train'});
  walk(()=>local(r,carts[0],0,3.3),'approach open carriage boarding end');
  r.charge(26);r.releaseJump(cartAim(()=>local(r,carts[0],0,.3)));
  r.until(()=>{const q=carts[0].mesh.worldToLocal(r.p.pos.clone()),par=carts[0].mesh.geometry.parameters;return r.p.grounded&&Math.abs(q.x)<par.width/2-.04&&Math.abs(q.z)<par.depth/2-.08&&Math.abs(r.p.pos.y-top(carts[0]))<.12;},
    ()=>({...cartAim(()=>local(r,carts[0],0,.3)),...(r.p.state==='hang'?{jumpHeld:true}:{})}),{maxFrames:360,label:'jump into the first compact carriage'});
  r.until(()=>!r.p.freeSkate&&Math.abs(r.p.speed)<.08,{grabHeld:true},{maxFrames:240,label:'settle inside boarding carriage'});
  const landings=[];
  for(let i=0;i<carts.length-1;i++){
    const from=carts[i],to=carts[i+1];
    const takeoff=()=>local(r,from,0,1.7);
    const receive=()=>local(r,to,0,.8);
    walk(takeoff,`walk cart ${i+1} to its run-up`);
    r.stepFor(18,()=>cartAim(receive));
    r.charge(26,()=>({...cartAim(receive),jumpHeld:true}));
    assert.ok(r.p.grounded,'compact carriage charge must stay supported');
    if(process.env.GHOST_DEBUG)console.log('CART_LAUNCH',i+1,r.snapshot(),receive(),to.mesh.position.toArray());
    r.releaseJump(cartAim(receive));assert.equal(r.p.state,'air','transfer must actually jump');assert.ok(r.p.vVel>0,'transfer release must launch upward');
    if(process.env.GHOST_DEBUG)console.log('CART_RELEASE',i+1,r.snapshot(),receive());
    r.until(()=>r.p.grounded&&Math.abs(r.p.pos.y-top(to))<.12,()=>({...cartAim(receive),...(r.p.state==='hang'?{jumpHeld:true}:{})}),{maxFrames:360,label:`land inside cart ${i+2}`});
    const id=r.l.movers.indexOf(to),actual=r.p.groundHit?.moverId;
    const exitIsland=i===carts.length-2&&actual===undefined&&station(r)>r.sourceModule.GHOST_TRAIN_GAPS.filter(g=>g.kind==='cart')[relay].b;
    assert.ok(actual===id||exitIsland,'cart transfer must land in the intended cabin or its overlapping exit dock');
    landings.push({cart:i+2,frame:r.frame,position:r.p.pos.toArray(),mover:actual??null,overlappingExitIsland:exitIsland});
    r.until(()=>!r.p.freeSkate&&Math.abs(r.p.speed)<.08,{grabHeld:true},{maxFrames:240,label:'brake the earned jump momentum on the receiving cart'});
    r.stepFor(18);safe(r);
  }
  // Leave the visible forward end wall with an ordinary charged hop.
  r.until(()=>gap.b-r.sourceModule.ghostRouteProgress(local(r,carts.at(-1),0,0))<6&&carts.at(-1).lastDelta.z<=.001,{},
    {maxFrames:720,label:'ride the last carriage into the illuminated exit window'});
  walk(()=>local(r,carts.at(-1),0,1.7),'line up the last carriage exit');
  r.stepFor(18,()=>cartAim(r.sourceModule.ghostRoutePoint(gap.b+6)));
  r.charge(26,()=>({...cartAim(r.sourceModule.ghostRoutePoint(gap.b+6)),jumpHeld:true}));
  r.releaseJump(cartAim(r.sourceModule.ghostRoutePoint(gap.b+5)));
  r.until(()=>r.p.grounded&&station(r)>gap.b+2,()=>cartAim(r.sourceModule.ghostRoutePoint(gap.b+8)),{maxFrames:240,label:'jump out onto the station island'});
  assert.equal(r.p.totalDeaths,deaths,'relay must clear without respawn');
  assert.ok(r.trace.slice(begin).filter(t=>t.state==='air').length>30,'three actual airborne transfers were required');
  return{test:'input-only moving-cart relay',relay,landings,exitStation:station(r),frames:r.frame-begin,deaths:r.p.totalDeaths};
}

/** Native grind catch, charged broken-rail pops and native receiving catches. */
export function runGhostBrokenRails(r,rails){
  const begin=r.frame,deaths=r.p.totalDeaths,m=r.sourceModule,p=r.p,first=rails[0];
  const aim=(s,u=0)=>r.steerToward(m.ghostRoutePoint(s,m.ghostRouteHeight(s)+.48,u));
  r.until(()=>station(r)>=first.a+2,()=>({...aim(station(r)+8,first.u),jumpHeld:true}),{maxFrames:600,label:'approach broken railway'});
  r.releaseJump({...aim(station(r)+8,first.u),grindHeld:true});
  r.until(()=>p.state==='grind',()=>({...aim(station(r)+8,first.u),grindHeld:true}),{maxFrames:180,label:'catch first cartless rail'});
  const catches=[{frame:r.frame,rail:r.l.rails.indexOf(p.grindRail),station:station(r)}];
  for(let i=0;i<rails.length-1;i++){
    const rail=rails[i],next=rails[i+1],old=p.grindRail;
    r.until(()=>station(r)>=rail.b-1.9,()=>({moveY:0,moveX:Math.max(-1,Math.min(1,-p.balance*9-p.balanceVel*1.5)),grindHeld:true,jumpHeld:station(r)>rail.b-13}),{maxFrames:1800,label:`grind to broken rail ${i+1} end`});
    r.releaseJump({moveY:1,grindHeld:true});assert.equal(p.state,'air','broken track must be jumped');
    r.until(()=>p.state==='grind'&&p.grindRail!==old,()=>({...aim(station(r)+6,next.u),grindHeld:true}),{maxFrames:180,label:'catch receiving broken railway'});
    catches.push({frame:r.frame,rail:r.l.rails.indexOf(p.grindRail),station:station(r)});
  }
  const last=rails.at(-1);
  r.until(()=>station(r)>last.b+3&&p.grounded,()=>({...p.state==='grind'?{moveY:0,moveX:Math.max(-1,Math.min(1,-p.balance*9-p.balanceVel*1.5))}:r.steerToward(m.ghostRoutePoint(last.b+7)),grindHeld:true}),{maxFrames:1800,label:'ride broken track exit onto actual floor'});
  assert.equal(r.p.totalDeaths,deaths,'broken track must clear without respawn');
  assert.equal(catches.length,rails.length);assert.ok(new Set(catches.map(c=>c.rail)).size===rails.length,'every segment needs its own native grind catch');
  return{test:'input-only broken railway grind transfers',catches,exitStation:station(r),frames:r.frame-begin,deaths:r.p.totalDeaths};
}

export function runGhostAxe(r,component){
  const begin=r.frame,s=18-component.p[2],p=r.p;
  // Wait on supported stone for the real pendulum to leave the centre, then
  // walk through the timing window. Initial world phase is never overwritten.
  r.until(()=>{const phase=r.l.time*component.speed+component.phase;return Math.sin(phase)>.01&&Math.sin(phase)<.1&&Math.cos(phase)>0;},{},{maxFrames:600,label:'wait for execution axe safe timing window'});
  r.until(()=>station(r)>s+6,()=>r.steerToward(r.sourceModule.ghostRoutePoint(station(r)+8)),{maxFrames:600,label:'walk through swinging axe timing window'});
  assert.equal(p.totalDeaths,0,'timed axe crossing must survive');safe(r);
  return{test:'input-only swinging axe crossing',initialAxePhase:component.phase,exitStation:station(r),frames:r.frame-begin};
}

export function runGhostFloorGap(r,gap){
  const begin=r.frame,deaths=r.p.totalDeaths,m=r.sourceModule;
  r.until(()=>station(r)>=gap.a-2,()=>({...r.steerToward(m.ghostRoutePoint(station(r)+10)),jumpHeld:true,spinHeld:Math.floor(r.frame/18)%2===0}),{maxFrames:600,label:'earn approach speed on broken bathhouse paving'});
  assert.ok(r.p.grounded,'flagstone takeoff must remain on real floor');
  r.releaseJump(r.steerToward(m.ghostRoutePoint(gap.b+8)));
  assert.ok(r.p.state==='air'&&r.p.vVel>0,`gap ${gap.a} needs an actual upward jump: ${JSON.stringify(r.snapshot())}`);
  r.until(()=>r.p.grounded&&station(r)>gap.b,()=>r.steerToward(m.ghostRoutePoint(station(r)+8)),{maxFrames:180,label:'land beyond the collapsed flagstones'});
  assert.equal(r.p.groundHit?.moverId,undefined,'flagstone receiver is ordinary floor');
  assert.equal(r.p.totalDeaths,deaths,'flagstone jump must survive');
  return{test:'input-only execution-gallery floor jump',gap:[gap.a,gap.b],landingStation:station(r),frames:r.frame-begin,deaths:r.p.totalDeaths};
}

/** One uninterrupted spawn-to-gate run; only ordinary device samples move it. */
export function runGhostJourney(r){
  const m=r.sourceModule,p=r.p,begin=r.frame,tuning=JSON.stringify(r.TUNING),evidence=[],banked=[];
  const brake=()=>{if(p.freeSkate)r.until(()=>!p.freeSkate&&Math.abs(p.speed)<.08,{grabHeld:true},{maxFrames:360,label:'brake on supported receiving ground'});};
  const offset=s=>{
    let near=null,d=9;
    for(const c of m.GHOST_TRAIN_ENEMIES){const cs=18-c.p[2],delta=Math.abs(s-cs);if(delta<d){d=delta;near=c;}}
    if(!near)return 0;
    return-Math.sign(near.p[0]-m.ghostRouteX(18-near.p[2]))*1.65*Math.sin((1-d/9)*Math.PI/2);
  };
  const walkRoute=to=>{
    // Closely linked jumps may already carry the rider past the next run-up
    // marker. Keep that earned momentum instead of braking at the next edge.
    if(station(r)>=to-.08)return;
    brake();r.until(()=>p.state==='finished'||station(r)>=to-.08||r.distanceTo(m.ghostRoutePoint(to,undefined,offset(to)))<.18,()=>{
      const s=station(r),ahead=Math.min(to,s+3.8),target=m.ghostRoutePoint(ahead,undefined,offset(ahead));
      return{...r.steerToward(target,{pace:Math.min(.88,.22+(to-s)*.18)}),spinHeld:Math.floor(r.frame/18)%2===0};
    },{maxFrames:5400,label:`walk authored chamber route to ${to.toFixed(1)}`});r.stepFor(12);safe(r);
  };
  const actions=[];
  for(const [i,g]of m.GHOST_TRAIN_GAPS.filter(g=>g.kind==='cart').entries())actions.push({s:g.a-8,name:`convoy ${i}`,run:()=>runGhostCartRelay(r,i)});
  for(const c of m.GHOST_TRAIN_AXES)actions.push({s:18-c.p[2]-7,name:c.nm,run:()=>runGhostAxe(r,c)});
  for(const g of m.GHOST_TRAIN_GAPS.filter(g=>g.kind==='jump'))actions.push({s:g.a-18,name:g.name,flow:true,run:()=>runGhostFloorGap(r,g)});
  for(const [a,b]of [[998,1052],[1432,1590],[2170,2224]])actions.push({s:a-6,name:`rail vault ${a}`,run:()=>runGhostBrokenRails(r,m.GHOST_TRAIN_RAILS.filter(q=>q.a>=a&&q.b<=b))});
  for(const cp of m.GHOST_TRAIN_CHECKPOINTS)actions.push({s:cp.s-2,name:cp.name,run:()=>{
    brake();const target=[cp.p[0]-1.3,cp.p[1],cp.p[2]];
    r.walkTo(target,{pace:.35,arrivalTolerance:.3,label:`approach checkpoint ${cp.name}`});r.tick({spinHeld:true});r.stepFor(24);
    assert.ok(r.l.activeCheckpoint&&Math.hypot(r.l.activeCheckpoint.spawnPos.x-cp.p[0],r.l.activeCheckpoint.spawnPos.z-cp.p[2])<.2,`bank checkpoint ${cp.name}`);
    banked.push(cp.name);return{test:'checkpoint banked through inputs',name:cp.name,station:station(r)};
  }});
  actions.sort((a,b)=>a.s-b.s);
  for(const action of actions){
    if(station(r)<action.s)walkRoute(action.s);
    if(!action.flow){brake();r.stepFor(8);}const report=action.run();evidence.push(report);safe(r);
    if(process.env.GHOST_JOURNEY_PROGRESS)console.log('JOURNEY',action.name,station(r).toFixed(2),r.frame);
  }
  brake();walkRoute(2255);r.until(()=>p.state==='finished',{moveY:.4},{maxFrames:240,label:'cross the actual emerald throne finish gate'});
  assert.equal(p.totalDeaths,0,'continuous journey must not hide a respawn');assert.equal(JSON.stringify(r.TUNING),tuning,'authored geometry must preserve movement tuning');
  assert.equal(banked.length,m.GHOST_TRAIN_CHECKPOINTS.length,'all authored checkpoints must bank through inputs');
  let distance=0,largestStep=0;for(let i=begin+1;i<r.trace.length;i++){const a=r.trace[i-1].position,b=r.trace[i].position,d=Math.hypot(...b.map((v,j)=>v-a[j]));distance+=d;largestStep=Math.max(largestStep,d);}
  assert.ok(largestStep<2.2,'continuous journey cannot contain a teleport-sized step');
  return{test:'continuous input-only ghost train journey',state:p.state,frames:r.frame-begin,seconds:(r.frame-begin)*r.dt,distance,largestStep,checkpoints:banked.length,evidence,deaths:p.totalDeaths};
}

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
let sourceModule;try{sourceModule=await server.ssrLoadModule('/src/levels/ghost-train.ts');}finally{await server.close();}
const reports=[],failures=[];
const run=async(name,pilot,start,wait=0)=>{
  try{
    const evidence=await withBlockworksRuntime(r=>{r.stepFor(20+Math.round(wait/r.dt));return pilot(r);},{...options,start});
    reports.push({name,initialWait:wait,...evidence});console.log('PASS',name,'wait',wait);
  }catch(error){failures.push({name,initialWait:wait,error:error.message});console.log('FAIL',name,'wait',wait,error.message);}
};
const allPhases=process.argv.includes('--phases');
const jumpsOnly=process.argv.includes('--jumps-only');
const journeyOnly=process.argv.includes('--journey');
const bonusOnly=process.argv.includes('--bonus-only');
if(bonusOnly)for(const line of sourceModule.GHOST_TRAIN_BONUS_LINES)
  await run(`optional high line ${line.a}–${line.b}`,r=>runGhostBrokenRails(r,[line]),sourceModule.ghostRoutePoint(line.a-6,sourceModule.ghostRouteHeight(line.a-6)+.12,line.u));
if(journeyOnly){
  let recording;try{await withBlockworksRuntime(r=>{recording=r.trace;r.stepFor(20);reports.push(runGhostJourney(r));},{...options});}catch(error){failures.push({name:'continuous ghost train journey',error:error.message});}
  await writeFile('/private/tmp/ghost-train-v2-journey-trace.json',JSON.stringify(recording));
}
if(!jumpsOnly&&!journeyOnly&&!bonusOnly){
if(!process.argv.includes('--mechanics-only')&&!process.argv.includes('--rails-only')){
  for(const relay of process.env.GHOST_RELAY?[Number(process.env.GHOST_RELAY)]:[0,1,2,3]){
  const gap=sourceModule.GHOST_TRAIN_GAPS.filter(g=>g.kind==='cart')[relay];
  for(const wait of allPhases?[0,2.1,4.2]:[0])await run(`moving carts relay ${relay}`,r=>runGhostCartRelay(r,relay),sourceModule.ghostRoutePoint(gap.a-8,sourceModule.ghostRouteHeight(gap.a-8)+.12),wait);
}
}
if(!process.argv.includes('--carts-only')){
for(const [a,b]of [[998,1052],[1432,1590],[2170,2224]].filter(([a])=>!process.env.GHOST_RAIL||a===Number(process.env.GHOST_RAIL))){
  const rails=sourceModule.GHOST_TRAIN_RAILS.filter(r=>r.a>=a&&r.b<=b);
  await run(`broken railway ${a}–${b}`,r=>runGhostBrokenRails(r,rails),sourceModule.ghostRoutePoint(a-6,sourceModule.ghostRouteHeight(a-6)+.12));
}
const axe=sourceModule.GHOST_TRAIN_AXES[0],axeStation=18-axe.p[2];
if(!process.argv.includes('--rails-only'))for(const wait of [0,1.7,3.4])await run('swinging execution axe',r=>runGhostAxe(r,axe),sourceModule.ghostRoutePoint(axeStation-7,sourceModule.ghostRouteHeight(axeStation-7)+.12),wait);
}
}
if(!process.argv.includes('--carts-only')&&!process.argv.includes('--rails-only')&&!journeyOnly&&!bonusOnly)for(const gap of sourceModule.GHOST_TRAIN_GAPS.filter(g=>g.kind==='jump'&&(!process.env.GHOST_JUMP||g.a===Number(process.env.GHOST_JUMP))))await run(gap.name+' '+gap.a,r=>runGhostFloorGap(r,gap),sourceModule.ghostRoutePoint(gap.a-8,sourceModule.ghostRouteHeight(gap.a-8)+.12));
await writeFile(process.env.GHOST_REPORT??(journeyOnly?'/private/tmp/ghost-train-v2-journey.json':jumpsOnly?'/private/tmp/ghost-train-flagstones.json':'/private/tmp/ghost-train-pilot.json'),JSON.stringify({reports,failures},null,2));
console.log(JSON.stringify({reports,failures},null,2));
assert.equal(failures.length,0,failures.map(f=>`${f.name}: ${f.error}`).join('\n'));
