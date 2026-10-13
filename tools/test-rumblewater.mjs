import assert from 'node:assert/strict';
import {driveDownstream} from './rumblewater-downstream-pilot.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output='/private/tmp/rumblewater-evidence';await mkdir(output,{recursive:true});
const requested=process.argv.slice(2),results=[];
for(const name of requested.length?requested:['inner-low','outer-high','inner-high','outer-low','recovery','late-recovery','stall']){
 const report={name},trace=[];
 try{await withBlockworksRuntime(async r=>{
  const m=r.sourceModule,s=()=>m.rumbleProgress(r.p.pos),pt=(station,u=0)=>m.rumblePoint(station,m.rumbleHeight(station),u);
  const follow=(u=0,buttons={},look=7)=>({...r.steerToward(pt(s()+look,typeof u==='function'?u(s()+look):u)),...buttons});
  const skate=(u=0)=>follow(u,{jumpHeld:true,spinHeld:r.frame%30<8});
  const until=(to,fn=()=>skate(),label='travel')=>r.until(()=>s()>=to,fn,{maxFrames:5000,label});
  const hop=(at,landing,u=0,airU=u)=>{
   until(at,()=>skate(u),'jump approach '+at);r.releaseJump(follow(airU));
   r.until(()=>s()>landing&&r.p.grounded,()=>follow(airU),{maxFrames:400,label:'jump landing '+landing});
   report['jump'+at]={...r.snapshot(),progress:s()};
  };
  const grind=(u=0)=>r.p.state==='grind'?{moveY:0,moveX:Math.max(-1,Math.min(1,-r.p.balance*5-r.p.balanceVel*.7)),grindHeld:true,jumpHeld:true}:
   follow(u,{grindHeld:true,jumpHeld:true});
  const fork=s=>{const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};return smooth((s-136)/24)*(1-smooth((s-278)/32));};
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  const low=s=>-7.2*smooth((s-584)/24)*(1-smooth((s-687)/29));
  const high=s=>7*smooth((s-584)/24)*(1-smooth((s-687)/29));
  const starts={'mid-low':892,'mid-high':892,'causeway-low':1188,'causeway-high':1188,'roofs':1438,'quarry-low':1798,'quarry-high':1798,'relay-low':2028,'relay-high':2028,'throat':2265,'final-low':2488,'final-high':2488,'late-recovery':2005};
  const fixture=starts[name];
  if(fixture){const at=pt(fixture);at[1]+=.12;r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(...at)});r.l.boulder.course.reset(r.p.pos);}
  r.stepFor(20);assert.ok(r.p.grounded,'spawn supported');
  const downstreamContext={r,m,s,pt,follow,skate,grind,until,hop,report};
  if(name==='late-recovery'){
   report.startWorld=r.p.pos.toArray();until(2025,()=>skate(),'earn quarry checkpoint');
   assert.ok(r.l.checkpoints[9].active,'late checkpoint activates through movement');
   r.until(()=>r.p.state==='dead',()=>follow(24),{maxFrames:900,allowDeath:true,label:'fall off the late aqueduct bank'});
   assert.notEqual(r.p.waterDeathSurface,null);
   r.until(()=>r.p.state==='ride'&&r.p.grounded,{}, {maxFrames:900,allowDeath:true,label:'late checkpoint natural respawn'});
   assert.ok(Math.abs(s()-2016)<3);assert.equal(r.p.lives,3);assert.ok(!r.l.boulder.course.active);
   r.stepFor(120);assert.ok(!r.l.boulder.course.active);
   report.pass=true;report.final=r.snapshot();report.seconds=r.frame*r.dt;report.waterRespawn=true;return;
  }
  if(fixture){report.startWorld=r.p.pos.toArray();await driveDownstream(downstreamContext,name.endsWith('high'),fixture);report.final=r.snapshot();report.seconds=r.frame*r.dt;report.pass=true;return;}
  if(name==='stall'){
   until(12,()=>follow(),'walk out of the release');
   r.until(()=>r.p.state==='dead',{}, {maxFrames:1800,allowDeath:true,label:'boulder catches a stopped runner'});
   assert.equal(r.p.waterDeathSurface,null,'death is the boulder, not water');assert.equal(r.p.lives,3);
   report.pass=true;report.final=r.snapshot();report.seconds=r.frame*r.dt;return;
  }
  hop(84.5,98);
  if(name==='recovery'){
   until(130,()=>skate(),'earn first checkpoint');assert.ok(r.l.checkpoints[0].active);
   r.until(()=>r.p.state==='dead',()=>follow(15),{maxFrames:900,allowDeath:true,label:'leave bank into water'});
   assert.notEqual(r.p.waterDeathSurface,null,'actually touches river water');
   r.until(()=>r.p.state==='ride'&&r.p.grounded,{}, {maxFrames:900,allowDeath:true,label:'natural checkpoint respawn'});
   assert.equal(r.p.lives,3);assert.ok(Math.abs(s()-121)<3);assert.ok(!r.l.boulder.course.active);
   r.stepFor(120);assert.ok(!r.l.boulder.course.active,'restart waits for movement');
   report.pass=true;report.final=r.snapshot();report.seconds=r.frame*r.dt;report.waterRespawn=true;return;
  }
  until(138,()=>skate());
  if(name.startsWith('inner')){
   hop(188.5,201,s=>-7*fork(s));hop(246.5,259,s=>-7*fork(s));until(311,()=>skate(s=>-7*fork(s)));
  }else{
   until(158,()=>skate(s=>7*fork(s)),'aqueduct approach');
   r.until(()=>r.p.state==='grind',()=>grind(s=>7*fork(s)),{maxFrames:500,label:'aqueduct catch'});
   until(290,()=>grind(s=>7*fork(s)),'aqueduct grind');
   r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(),{maxFrames:400,label:'aqueduct landing'});
  }
  until(452,()=>skate(s=>2.5*Math.sin((s-323)/32)),'serpent carve');
  hop(468.5,482);until(580,()=>skate(s=>s<550?2*Math.sin((s-490)/25):0),'second pipe');
  if(name.endsWith('low')){
   hop(622.4,635,low);until(718,()=>skate(low),'lower snake exit');
  }else{
   until(607,()=>skate(high),'high shelf ascent');
   r.until(()=>r.p.state==='grind',()=>grind(high),{maxFrames:400,label:'high rail catch'});
   until(674,()=>grind(high),'high wire grind');
   r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(high),{maxFrames:400,label:'high bank landing'});
   until(720,()=>skate(high),'high bank merge');
  }
  until(777,()=>skate(),'last chute');
  hop(840.2,856);
  until(892,()=>skate(),'enter the new downstream acts');
  await driveDownstream(downstreamContext,name.endsWith('high'));
  report.final=r.snapshot();report.seconds=r.frame*r.dt;report.pass=true;
  report.rails=[...new Set(r.trace.map(t=>t.rail).filter(x=>x!==null))];
  report.checkpoints=r.l.checkpoints.filter(c=>c.active).length;
  report.minBoulderGap=Math.min(...trace.filter(t=>t.chaseActive&&r.sourceModule.rumbleProgress(t.position)<m.RUMBLEWATER_BOULDER_END-12).map(t=>t.chaseGap));
  assert.equal(r.p.totalDeaths,0);assert.ok(!r.p.isBailing);
 },{modulePath:'/src/levels/rumblewater-run.ts',levelId:'rumblewater-run',source:m=>m.RUMBLEWATER_RUN_LEVEL,
   onTick:(state,r)=>{const b=r.l.boulder.course;trace.push({...state,cameraYaw:Math.atan2(r.p.camDir.x,r.p.camDir.z),chaseActive:b.active,chaseGap:b.playerProgress-b.progress});},
   maxFrames:20000});
 }catch(e){report.pass=false;report.failure=e.stack;report.last=trace.at(-1);}
 await writeFile(`${output}/${name}-trace.json`,JSON.stringify(trace));results.push(report);console.log(JSON.stringify(report));
}
const prior=JSON.parse(await import('node:fs/promises').then(fs=>fs.readFile(`${output}/report.json`,'utf8')).catch(()=> '[]'));
await writeFile(`${output}/report.json`,JSON.stringify([...prior.filter(p=>!results.some(r=>r.name===p.name)),...results],null,2));if(results.some(r=>!r.pass))process.exitCode=1;
