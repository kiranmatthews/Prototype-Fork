// Independent folded-creek pilots. Every action after the initial fixture is
// a normalized production Player input; no pose, state, tuning or hazard edits.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.CUSTARD_TRAVERSAL_OUTPUT||'/private/tmp/custard-creek-independent-traversal';await mkdir(output,{recursive:true});
const author=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
let course;try{course=await author.ssrLoadModule('/src/levels/custard-creek.ts');}finally{await author.close();}
assert.equal(course.CUSTARD_CREEK_END,2430,'independent course owns its route length');
assert.ok(typeof course.custardPoint==='function'&&typeof course.custardProgress==='function','arc-length authoring interface');
const nativeWarn=console.warn;console.warn=(...args)=>{if(!String(args[0]).includes('BufferGeometry is already non-indexed'))nativeWarn(...args);};
const results=[],chosen=new Set(process.argv.slice(2));
const checks=new Set(['lockyard','inner-bank','outer-bank','mill-rail','spillway','sluice','ferry','boulder-run','backwater-finish','continuous-chapter','mill-roof-lift']);
for(const name of chosen)assert.ok(checks.has(name),`Unknown creek pilot: ${name}`);
const selected=n=>chosen.size===0||chosen.has(n);
const point=(s,u=0,y)=>course.custardPoint(s,y??course.custardHeight(s),u);
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const splitOffset=(s,side)=>side*6*(1-smooth((s-500)/60));
async function encounter(name,station,offset,body){
 const startWorld=point(station,offset,course.custardHeight(station)+.12),a=point(station),b=point(station+1),startHeading=b.map((v,i)=>v-a[i]);
 let report={name,course:'independent-folded-creek',startStation:station,startOffset:offset,startWorld,startHeading},trace=[];
 try{await withBlockworksRuntime(async r=>{
  trace=r.trace;const m=r.sourceModule,s=()=>m.custardProgress(r.p.pos),pt=(station,u=0,y)=>m.custardPoint(station,y??m.custardHeight(station),u);
  const follow=(u=0,look=8,buttons={},pace=1)=>({...r.steerToward(pt(Math.min(m.CUSTARD_CREEK_END+12,s()+look),typeof u==='function'?u(s()+look):u),{pace}),...buttons});
  const attack=()=>({spinHeld:r.frame%12===0});
  const skate=(u=0,look=8)=>follow(u,look,{jumpHeld:true,...attack()});
  // Line up with the planned bar before requesting a catch. Holding Grind
  // throughout the inward approach now correctly grabs the restored bank rim.
  const grind=(u=0,look=8,buttons={})=>({...follow(u,look,buttons),
   grindHeld:r.p.state==='grind'||r.l.rails.some(rail=>rail.grindable&&rail.closest(r.p.pos).distance<Math.min(1,r.TUNING.railSnapDistance)),
   ...(r.p.state==='grind'?{moveY:0,moveX:Math.max(-1,Math.min(1,-r.p.balance*5-r.p.balanceVel*.7))}:{})});
  const ground=label=>{assert.equal(r.p.grounded,true,label);assert.equal(r.p.isBailing,false,label);assert.ok(!['dead','gameover'].includes(r.p.state),label);};
  const until=(to,input=()=>skate(),label='follow creek')=>r.until(()=>s()>=to,input,{maxFrames:6000,label});
  const hop=(takeoff,landing,u=0,label='creek hop')=>{
   until(takeoff,()=>skate(u),label+' run-up');report[label+' takeoff']=r.snapshot();r.releaseJump(follow(u));
   r.until(()=>s()>landing&&r.p.grounded,()=>follow(u),{maxFrames:600,label:label+' landing'});ground(label+' supported landing');
  };
  r.stepFor(30);ground('supported independent starting fixture');report.initial=r.snapshot();report.initialProgress=s();
  await body({r,m,s,pt,follow,skate,grind,attack,ground,until,hop,report});
  report.final=r.snapshot();report.finalProgress=s();report.pass=true;
  report.states=[...new Set(trace.map(v=>v.state))];report.grounds=[...new Set(trace.map(v=>v.ground?.name).filter(Boolean))];report.rails=[...new Set(trace.map(v=>v.rail).filter(v=>v!==null))];report.movers=[...new Set(trace.map(v=>v.mover).filter(v=>v!==null))];report.cratesBroken=r.p.cratesBroken;report.seconds=r.frame*r.dt;
  report.headingExtents={x:[Math.min(...trace.map(t=>t.heading[0])),Math.max(...trace.map(t=>t.heading[0]))],z:[Math.min(...trace.map(t=>t.heading[2])),Math.max(...trace.map(t=>t.heading[2]))]};
 },{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL,start:startWorld,heading:startHeading,maxFrames:30000,onTick:(_state,r)=>{r.trace[r.trace.length-1].cameraYaw=Math.round(Math.atan2(r.p.camDir.x,r.p.camDir.z)*1e4)/1e4;},controlFrame:r=>r.p.courseInputDirection(r.l)??r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1}});}catch(e){report.pass=false;report.failure=e.message;report.last=trace.at(-1);}
 await writeFile(output+'/'+name+'-trace.json',JSON.stringify(trace));results.push(report);console.log(JSON.stringify({name:report.name,pass:report.pass,seconds:report.seconds,progress:report.finalProgress,states:report.states,grounds:report.grounds,rails:report.rails,movers:report.movers,cratesBroken:report.cratesBroken,...(!report.pass?{failure:report.failure}: {})}));
}
if(selected('lockyard'))await encounter('lockyard',0,0,({r,s,skate,ground,until,report})=>{
 const line=s=>s>75&&s<115?-5.5:s>131&&s<174?5.5:s>174&&s<219?4.2:0;
 until(238,()=>skate(line,8),'lockyard crusher chicane');ground('lockyard exit');assert.ok(r.p.cratesBroken>=3,'early section offers a continuously skatable crate line');
});
if(selected('inner-bank'))await encounter('inner-bank',275,-6,({r,s,skate,follow,ground,until,hop,report})=>{
 hop(339.2,353,-6,'inner bank first gap');hop(426.2,440,-6,'inner bank second gap');
 until(554,()=>skate(s=>s>444&&s<484?-3.7:splitOffset(s,-1),8),'inner bank spiker choice and merge');ground('inner bank merge');assert.ok(r.p.cratesBroken>=7);
});
if(selected('outer-bank'))await encounter('outer-bank',275,6,({r,s,skate,ground,until,report})=>{
 until(554,()=>skate(s=>s>350&&s<384?8.2:splitOffset(s,1),7),'outer bank collapsing plank route');ground('outer bank merge');assert.ok(r.trace.some(t=>t.ground?.name==='crumble pad'),'outer route actually touches collapsing planks');assert.ok(r.p.cratesBroken>=8);
});
if(selected('mill-rail'))await encounter('mill-rail',630,0,({r,s,grind,follow,ground,until,report})=>{
 r.until(()=>r.p.state==='grind',()=>grind(0,8,{jumpHeld:true}),{maxFrames:600,label:'catch crown aqueduct rail'});report.catch=r.snapshot();
 until(734,()=>grind(0,8,{jumpHeld:true}),'long crown aqueduct grind');
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:600,label:'crown terrace landing'});ground('crown terrace landing');assert.ok(s()>720);
});
if(selected('spillway'))await encounter('spillway',856,0,({r,s,skate,ground,until,report})=>{
 until(1170,()=>skate(s=>2.4*Math.sin((s-856)/43),8),'descending return-bend halfpipe');ground('spillway supported exit');assert.ok(r.p.cratesBroken>=3);assert.ok(r.p.pos.y<report.initial.position[1]-10);
});
if(selected('sluice'))await encounter('sluice',1210,0,({r,s,skate,follow,ground,until,hop,report})=>{
 hop(1239.2,1254,0,'first sluice basin');
 until(1319,()=>skate(s=>2.5*Math.sin((s-1251)/32),8),'first sluice island rewards');
 hop(1335.2,1350,0,'second sluice basin');
 until(1440,()=>skate(s=>-2*Math.sin((s-1347)/32),8),'returning island sentry approach');
 until(1484,()=>skate(s=>1.2*Math.sin((s-1440)/12),7),'collapsing sluice crescent');ground('sluice crescent exit');assert.ok(r.trace.some(t=>t.ground?.name==='crumble pad'));
});
if(selected('ferry'))await encounter('ferry',1600,4,({r,m,s,pt,follow,skate,ground,until,report})=>{
 const ferry=r.l.movers.find(v=>v.axisV.y===0),id=r.l.movers.indexOf(ferry),top=()=>ferry.mesh.position.y+.4;
 r.walkTo(pt(1620,4),{pace:.35,label:'ferry lip approach'});
 r.until(()=>ferry.mesh.position.z>ferry.base.z+13.7,{}, {maxFrames:1200,label:'wait for ferry near bank'});
 const aim=()=>[ferry.mesh.position.x,top(),ferry.mesh.position.z];r.charge(26);r.releaseJump(r.steerToward(aim));r.stepFor(18,()=>r.steerToward(aim));r.charge(5,()=>r.steerToward(aim));r.releaseJump(r.steerToward(aim));
 r.until(()=>r.p.grounded,()=>r.steerToward(aim),{maxFrames:300,label:'board reedbed ferry'});assert.equal(r.p.groundHit?.moverId,id);report.boarded=r.snapshot();
 r.walkTo(aim,{pace:.3,arrivalTolerance:.65,label:'walk to ferry deck centre'});
 const corner=()=>[ferry.mesh.position.x+3.6,top(),ferry.mesh.position.z-3.6];r.walkTo(corner,{pace:.3,arrivalTolerance:.65,label:'walk to receiver departure corner'});
 r.stepFor(25);r.until(()=>ferry.mesh.position.z<ferry.base.z-14.5,{}, {maxFrames:1200,label:'ride ferry to receiver'});report.farPhase=r.snapshot();
 const exit=pt(1665,-5.7);r.charge(26);r.releaseJump(r.steerToward(exit));
 r.until(()=>r.p.grounded&&r.p.groundHit?.moverId===undefined,()=>r.steerToward(exit),{maxFrames:300,label:'ferry receiver landing'});ground('ferry receiver');assert.ok(s()>1662);
});
if(selected('boulder-run'))await encounter('boulder-run',1825,0,({r,s,skate,ground,until,report})=>{
 until(2098,()=>skate(s=>5.3*Math.sin((s-1840)/38),8),'boulder quarry carving');ground('boulder-run exit');assert.ok(r.p.cratesBroken>=5);
});
if(selected('backwater-finish'))await encounter('backwater-finish',2110,3,({r,s,skate,grind,follow,ground,until,report})=>{
 until(2266,()=>skate(s=>s<2184?4.2:-4.2,8),'backwater pendulum approach');
 r.until(()=>r.p.state==='grind',()=>grind(0,8,{jumpHeld:true}),{maxFrames:600,label:'catch final crown rail'});report.catch=r.snapshot();
 until(2383,()=>grind(0,8,{jumpHeld:true}),'final exposed crescent grind');
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:600,label:'final island landing'});ground('final island landing');
 r.until(()=>r.p.state==='finished',()=>skate(0,8),{maxFrames:900,label:'finish island crate line and gate'});assert.equal(r.p.state,'finished');
});
if(selected('continuous-chapter'))await encounter('continuous-chapter',250,0,({r,m,s,pt,follow,skate,grind,attack,ground,until,hop,report})=>{
 until(276,()=>skate(-6,8),'split-bank entry run-up');ground('inner bank entry');
 hop(339.2,353,-6,'inner bank first gap');hop(426.2,440,-6,'inner bank second gap');
 until(554,()=>skate(s=>s>444&&s<484?-3.7:splitOffset(s,-1),8),'inner bank spiker bypass and merge');ground('inner bank merge');
 until(630,()=>skate(s=>-3*Math.sin((s-575)/35),8),'ascending mill charger bypass');
 r.until(()=>r.p.state==='grind',()=>grind(0,8,{jumpHeld:true}),{maxFrames:600,label:'catch crown aqueduct rail'});report.catch=r.snapshot();
 until(734,()=>grind(0,8,{jumpHeld:true}),'long crown aqueduct grind');
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:600,label:'crown terrace landing'});ground('crown terrace landing');
 until(850,()=>skate(3,8),'upper mill terrace crate arc and ascent');ground('highest terrace');report.highTerrace=r.snapshot();
 until(1190,()=>skate(s=>2.4*Math.sin((s-856)/43),8),'descending return-bend spillway and runout');ground('spillway chapter exit');
 assert.ok(r.p.cratesBroken>=20,'continuous chapter retains sustained skating reward lines');
 assert.ok(Math.max(...r.trace.map(t=>t.heading[2]))>.8&&Math.min(...r.trace.map(t=>t.heading[2]))<-.8,'actual inputs traverse a broad direction reversal');
 assert.ok(Math.max(...r.trace.map(t=>t.position[1]))>17,'the continuous route actually reaches the high mill');
});
if(selected('mill-roof-lift'))await encounter('mill-roof-lift',785,-4,({r,m,s,pt,ground,report})=>{
 const lift=r.l.movers.find(v=>v.axisV.y!==0),id=r.l.movers.indexOf(lift),floor=m.custardHeight(791),top=()=>lift.mesh.position.y+.4;
 r.walkTo(pt(791,-5.4),{pace:.35,label:'mill lift lip approach'});
 r.until(()=>top()<floor+.35,{}, {maxFrames:900,label:'wait for mill lift low phase'});
 const aim=()=>[lift.mesh.position.x-1.3,top(),lift.mesh.position.z];
 r.jumpTo(aim,{arrivalTolerance:1.4,heightTolerance:.3,label:'board mill roof lift'});assert.equal(r.p.groundHit?.moverId,id);report.boarded=r.snapshot();
 r.until(()=>top()>floor+4.4,{}, {maxFrames:900,label:'ride mill lift to roof height'});
 const corner=()=>[lift.mesh.position.x+1.4,top(),lift.mesh.position.z];r.walkTo(corner,{pace:.3,arrivalTolerance:.65,label:'walk across lift deck'});
 const exit=pt(791,-14.2,floor+5);r.jumpTo(exit,{arrivalTolerance:1.4,heightTolerance:.3,label:'mill roof landing'});ground('mill reward roof');
});

const prior=JSON.parse(await readFile(output+'/report.json','utf8').catch(()=> '[]'));
const current=prior.filter(p=>p.course==='independent-folded-creek'&&!results.some(r=>r.name===p.name));await writeFile(output+'/report.json',JSON.stringify([...current,...results],null,2));
console.warn=nativeWarn;if(results.some(r=>!r.pass))process.exitCode=1;
