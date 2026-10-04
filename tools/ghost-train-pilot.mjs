import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const options={modulePath:'/src/levels/ghost-train.ts',levelId:'ghost-train',source:m=>m.GHOST_TRAIN_LEVEL,
  controlFrame:r=>r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1},maxFrames:18000};
const station=r=>18-r.p.pos.z;
const safe=r=>assert.ok(!r.p.isBailing&&!['dead','gameover'].includes(r.p.state),JSON.stringify(r.snapshot()));
const top=m=>m.mesh.position.y+m.mesh.geometry.parameters.height/2;

/** Walk, charge and jump between production moving supports without writes. */
export function runGhostCartRelay(r,relay){
  const begin=r.frame,deaths=r.p.totalDeaths,fixtures=r.sourceModule.GHOST_TRAIN_CARTS.filter(c=>c.relay===relay);
  const carts=fixtures.map(c=>r.l.movers.find(m=>Math.hypot(m.base.x-c.p[0],m.base.z-c.p[2])<.03));
  assert.ok(carts.every(Boolean),'all authored moving carts must exist');
  const walk=(target,name)=>{
    r.until(()=>r.distanceTo(target)<.16,()=>{
      assert.ok(r.p.grounded,`${name}: walked off support ${JSON.stringify(r.snapshot())}`);
      return r.steerToward(target,{pace:Math.min(.55,.16+r.distanceTo(target)*.14),tolerance:.13});
    },{maxFrames:1800,label:name});
    r.stepFor(24);safe(r);assert.ok(r.p.grounded,`${name}: settle must stay supported`);
  };
  walk(()=>[carts[0].mesh.position.x,top(carts[0]),carts[0].mesh.position.z+2.5],'board moving departure cart');
  const landings=[];
  for(let i=0;i<carts.length-1;i++){
    const from=carts[i],to=carts[i+1],side=Math.sign(to.base.x-from.base.x),trim=Math.min(2,Math.abs(to.base.x-from.base.x)/2);
    const takeoff=()=>[from.mesh.position.x+side*trim,top(from),from.mesh.position.z+1];
    const receive=()=>[to.mesh.position.x-side*trim,top(to),to.mesh.position.z+4.8];
    walk(takeoff,`walk cart ${i+1} to its run-up`);
    r.stepFor(18,()=>r.steerToward(receive));
    r.until(()=>from.mesh.position.z-r.p.pos.z>=6.9,()=>{
      assert.ok(r.p.grounded,'cart jump run-up must stay on its real roof');
      return{...r.steerToward(receive),jumpHeld:true};
    },{maxFrames:180,label:'earn approach speed across the cart roof'});
    if(process.env.GHOST_DEBUG)console.log('CART_LAUNCH',i+1,r.snapshot(),receive(),to.mesh.position.toArray());
    r.releaseJump(r.steerToward(receive));assert.equal(r.p.state,'air','transfer must actually jump');assert.ok(r.p.vVel>0,'transfer release must launch upward');
    if(process.env.GHOST_DEBUG)console.log('CART_RELEASE',i+1,r.snapshot(),receive());
    r.until(()=>r.p.grounded,()=>r.steerToward(receive),{maxFrames:180,label:`land on cart ${i+2}`});
    const id=r.l.movers.indexOf(to);assert.equal(r.p.groundHit?.moverId,id,'cart transfer landed on the intended moving support');
    landings.push({cart:i+2,frame:r.frame,position:r.p.pos.toArray(),mover:id});
    r.until(()=>!r.p.freeSkate&&Math.abs(r.p.speed)<.08,{grabHeld:true},{maxFrames:240,label:'brake the earned jump momentum on the receiving cart'});
    r.stepFor(18);safe(r);
  }
  const gap=r.sourceModule.GHOST_TRAIN_GAPS.filter(g=>g.kind==='cart')[relay];
  walk(r.sourceModule.ghostRoutePoint(gap.b+14),'disembark final cart onto station island');
  assert.equal(r.p.totalDeaths,deaths,'relay must clear without respawn');
  assert.ok(r.trace.slice(begin).filter(t=>t.state==='air').length>30,'three actual airborne transfers were required');
  return{test:'input-only moving-cart relay',relay,landings,exitStation:station(r),frames:r.frame-begin,deaths:r.p.totalDeaths};
}

/** Native grind catch, charged broken-rail pops and native receiving catches. */
export function runGhostBrokenRails(r,rails){
  const begin=r.frame,deaths=r.p.totalDeaths,m=r.sourceModule,p=r.p,first=rails[0];
  const aim=(s,u=0)=>r.steerToward(m.ghostRoutePoint(s,.6,u));
  r.until(()=>station(r)>=first.a+2,()=>({...aim(station(r)+8,first.u),jumpHeld:true}),{maxFrames:600,label:'approach broken railway'});
  r.releaseJump({...aim(station(r)+8,first.u),grindHeld:true});
  r.until(()=>p.state==='grind',()=>({...aim(station(r)+8,first.u),grindHeld:true}),{maxFrames:180,label:'catch first cartless rail'});
  const catches=[{frame:r.frame,rail:r.l.rails.indexOf(p.grindRail),station:station(r)}];
  for(let i=0;i<rails.length-1;i++){
    const rail=rails[i],next=rails[i+1],old=p.grindRail;
    r.until(()=>station(r)>=rail.b-1.9,()=>({moveY:1,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),grindHeld:true,jumpHeld:station(r)>rail.b-13}),{maxFrames:1800,label:`grind to broken rail ${i+1} end`});
    r.releaseJump({moveY:1,grindHeld:true});assert.equal(p.state,'air','broken track must be jumped');
    r.until(()=>p.state==='grind'&&p.grindRail!==old,()=>({...aim(station(r)+6,next.u),grindHeld:true}),{maxFrames:180,label:'catch receiving broken railway'});
    catches.push({frame:r.frame,rail:r.l.rails.indexOf(p.grindRail),station:station(r)});
  }
  const last=rails.at(-1);
  r.until(()=>station(r)>last.b+3&&p.grounded,()=>({moveY:1,moveX:p.state==='grind'?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0,grindHeld:true}),{maxFrames:1800,label:'ride broken track exit onto actual floor'});
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
  r.until(()=>station(r)>=gap.a-2,()=>({...r.steerToward(m.ghostRoutePoint(station(r)+10)),jumpHeld:true}),{maxFrames:600,label:'earn approach speed on execution-gallery flagstones'});
  assert.ok(r.p.grounded,'flagstone takeoff must remain on real floor');
  r.releaseJump(r.steerToward(m.ghostRoutePoint(gap.b+8)));
  assert.ok(r.p.state==='air'&&r.p.vVel>0,'flagstone gap needs an actual upward jump');
  r.until(()=>r.p.grounded&&station(r)>gap.b,()=>r.steerToward(m.ghostRoutePoint(station(r)+8)),{maxFrames:180,label:'land beyond the collapsed flagstones'});
  assert.equal(r.p.groundHit?.moverId,undefined,'flagstone receiver is ordinary floor');
  assert.equal(r.p.totalDeaths,deaths,'flagstone jump must survive');
  return{test:'input-only execution-gallery floor jump',gap:[gap.a,gap.b],landingStation:station(r),frames:r.frame-begin,deaths:r.p.totalDeaths};
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
if(!jumpsOnly){
  for(const relay of process.env.GHOST_RELAY?[Number(process.env.GHOST_RELAY)]:[0,1,2,3]){
  const gap=sourceModule.GHOST_TRAIN_GAPS.filter(g=>g.kind==='cart')[relay];
  for(const wait of allPhases?[0,2.1,4.2]:[0])await run(`moving carts relay ${relay}`,r=>runGhostCartRelay(r,relay),sourceModule.ghostRoutePoint(gap.a-4,.12),wait);
}
for(const [a,b]of [[1008,1059],[1426,1583],[2159,2225]]){
  const rails=sourceModule.GHOST_TRAIN_RAILS.filter(r=>r.a>=a&&r.b<=b);
  await run(`broken railway ${a}–${b}`,r=>runGhostBrokenRails(r,rails),sourceModule.ghostRoutePoint(a-6,.12));
}
const axe=sourceModule.GHOST_TRAIN_AXES[0],axeStation=18-axe.p[2];
for(const wait of [0,1.7,3.4])await run('swinging execution axe',r=>runGhostAxe(r,axe),sourceModule.ghostRoutePoint(axeStation-7,.12),wait);
}
for(const gap of sourceModule.GHOST_TRAIN_GAPS.filter(g=>g.kind==='jump'))await run(gap.name,r=>runGhostFloorGap(r,gap),sourceModule.ghostRoutePoint(gap.a-18,.12));
await writeFile(jumpsOnly?'/private/tmp/ghost-train-flagstones.json':'/private/tmp/ghost-train-pilot.json',JSON.stringify({reports,failures},null,2));
console.log(JSON.stringify({reports,failures},null,2));
assert.equal(failures.length,0,failures.map(f=>`${f.name}: ${f.error}`).join('\n'));
