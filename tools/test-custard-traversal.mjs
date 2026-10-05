import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.CUSTARD_TRAVERSAL_OUTPUT||'/private/tmp/custard-creek-traversal';await mkdir(output,{recursive:true});
const bend=s=>22*(Math.sin((s+100)*2*Math.PI/310)-Math.sin(100*2*Math.PI/310))+5*(Math.sin((s+42.5)*2*Math.PI/560)-Math.sin(42.5*2*Math.PI/560));
const cross=x=>8*Math.sin(x*2*Math.PI/152);
const warp=q=>[q[0]+bend(-q[2]),q[1],q[2]+cross(q[0])];
const inverse=p=>{let z=p.z,x=p.x;for(let i=0;i<20;i++){x=p.x-bend(-z);z=p.z-cross(x);}return {x,y:p.y,z};};
const headingAt=q=>{const a=warp(q),b=warp([q[0],q[1],q[2]-1]);return b.map((v,i)=>v-a[i]);};
const results=[];
async function encounter(name,start,body,heading){
 let report={name,start,startHeading:heading??headingAt(start)},trace=[];
 try{await withBlockworksRuntime(async r=>{
  trace=r.trace;
  const w=q=>r.sourceModule.custardWarp(q),src=()=>inverse(r.p.pos);
  const follow=(x,look=8,buttons={})=>({...r.steerToward(w([x,r.p.pos.y,src().z-look])),...buttons});
  const ground=(label)=>{assert.equal(r.p.grounded,true,label);assert.equal(r.p.isBailing,false,label);assert.ok(!['dead','gameover'].includes(r.p.state),label);};
  const grind=(x,look=8,buttons={})=>({...follow(x,look,buttons),grindHeld:true,...(r.p.state==='grind'?{moveY:0,moveX:Math.max(-1,Math.min(1,-r.p.balance*5-r.p.balanceVel*.7))}:{})});
  r.stepFor(30);ground('supported independent starting fixture');report.initial=r.snapshot();
  await body({r,w,src,follow,grind,ground,report});
  report.final=r.snapshot();report.pass=true;
  report.states=[...new Set(trace.map(v=>v.state))];report.grounds=[...new Set(trace.map(v=>v.ground?.name).filter(Boolean))];
  report.rails=[...new Set(trace.map(v=>v.rail).filter(v=>v!==null))];report.movers=[...new Set(trace.map(v=>v.mover).filter(v=>v!==null))];
  report.cratesBroken=r.p.cratesBroken;report.seconds=r.frame*r.dt;
 },{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL,start:warp(start),heading:heading??headingAt(start),controlFrame:r=>r.p.courseInputDirection(r.l)??r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1}});}catch(e){report.pass=false;report.failure=e.message;report.last=trace.at(-1);}
 await writeFile(output+'/'+name+'-trace.json',JSON.stringify(trace));
 results.push(report);console.log(JSON.stringify({name:report.name,pass:report.pass,seconds:report.seconds,states:report.states,grounds:report.grounds,rails:report.rails,movers:report.movers,cratesBroken:report.cratesBroken,...(!report.pass?{failure:report.failure}: {})}));
}
const chosen=new Set(process.argv.slice(2));const selected=n=>chosen.size===0||chosen.has(n);
if(selected('first-gap'))await encounter('first-gap',[0,-4.5,-134],({r,w,src,follow,ground,report})=>{
 r.until(()=>src().z<-138,()=>follow(0),{maxFrames:600});
 r.until(()=>src().z<-152.6,()=>follow(0,8,{jumpHeld:true}),{maxFrames:600});
 report.takeoff=r.snapshot();r.releaseJump(follow(0));
 r.until(()=>src().z<-166&&r.p.grounded,()=>follow(0),{maxFrames:600});ground('gap landing');
});
if(selected('first-rail'))await encounter('first-rail',[0,-12.45,-326],({r,w,src,follow,grind,ground,report})=>{
 r.until(()=>r.p.state==='grind',()=>grind(0,10,{jumpHeld:true}),{maxFrames:600,label:'catch first rail'});
 report.catch=r.snapshot();
 r.until(()=>src().z<-412,()=>grind(0,8,{jumpHeld:true}),{maxFrames:1200,label:'first rail crossing'});
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:300,label:'rail landing'});ground('rail landing');
});
if(selected('slalom-rail'))await encounter('slalom-rail',[-3,-12.45,-544],({r,w,src,follow,grind,ground,report})=>{
 r.until(()=>r.p.state==='grind',()=>grind(src().z>-563?-3:0,8,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:600,label:'catch slalom rail'});report.catch=r.snapshot();
 r.until(()=>src().z<-657,()=>grind(0,8,{jumpHeld:true}),{maxFrames:1200,label:'curved rail crossing'});
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:300,label:'slalom rail landing'});ground('rail landing');
});
if(selected('halfpipe'))await encounter('halfpipe',[0,-13.4,-708],({r,w,src,follow,grind,ground,report})=>{
 r.until(()=>src().z<-832,()=>follow(0,10,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:1800,label:'halfpipe carving'});
 report.exit=r.snapshot();ground('halfpipe exit landing');
 r.until(()=>r.p.state==='grind',()=>grind(0,8,{jumpHeld:true}),{maxFrames:300,label:'catch triple rails'});report.catch=r.snapshot();
 r.until(()=>src().z<-911,()=>grind(0,8,{jumpHeld:true}),{maxFrames:1200,label:'triple rail pit crossing'});
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:300,label:'triple rail landing'});ground('triple rail landing');
});
if(selected('last-kicker'))await encounter('last-kicker',[0,-12.45,-1538],({r,w,src,follow,ground,report})=>{
 r.until(()=>src().z<-1554.2,()=>follow(0,8,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:600,label:'last kicker charge run-up'});
 report.takeoff=r.snapshot();assert.equal(r.p.groundHit?.name,'Creek encounter 42');r.releaseJump(follow(0));
 r.until(()=>src().z<-1567&&r.p.grounded,()=>follow(0),{maxFrames:600,label:'last kicker landing'});ground('last kicker lower landing');assert.equal(r.p.groundHit?.name,'Creek encounter 43');
});
if(selected('late-weave-rail'))await encounter('late-weave-rail',[149,-25.9,-1856],({r,w,src,follow,grind,ground,report})=>{
 r.until(()=>src().z<-1864.7,()=>follow(149,8,{jumpHeld:true}),{maxFrames:600,label:'weave rail charge run-up'});
 report.takeoff=r.snapshot();r.releaseJump(grind(149));
 r.until(()=>r.p.state==='grind',()=>grind(149),{maxFrames:300,label:'catch late weave rail'});report.catch=r.snapshot();
 r.until(()=>src().z<-1955&&r.p.grounded&&r.p.state!=='grind',()=>grind(149.5),{maxFrames:1800,label:'late weave rail far landing'});ground('late weave landing');assert.equal(r.p.groundHit?.name,'Creek encounter 60');
});
if(selected('crumble'))await encounter('crumble',[1.5,-12.45,-1480],({r,w,src,follow,ground,report})=>{
 r.until(()=>src().z<-1495.8,()=>follow(1.5,8,{jumpHeld:true}),{maxFrames:600});
 r.until(()=>src().z<-1499.5,()=>({...r.steerToward(w([0,-12.56,-1513])),jumpHeld:true}),{maxFrames:600});
 report.takeoff=r.snapshot();assert.equal(r.p.groundHit?.name,'crumble pad');r.releaseJump(r.steerToward(w([0,-12.56,-1513])));
 r.until(()=>src().z<-1512&&r.p.grounded,()=>follow(0,8),{maxFrames:600,label:'crumble jump landing'});ground('crumble landing');
 report.touched=r.l.crumbles.map((c,i)=>({i,state:c.state,t:c.t}));
});
if(selected('lift'))await encounter('lift',[-5,-18.5,-1616],({r,w,src,follow,ground,report})=>{
 const mover=r.l.movers[0],top=()=>mover.mesh.position.y+.4;
 r.walkTo(w([-5,-18.625,-1619.4]),{pace:.35,label:'walk to lift approach'});
 r.until(()=>top()<-17.7,{}, {maxFrames:900,label:'wait for lift low phase'});
 report.lowPhase=r.snapshot();
 r.jumpTo(()=>[mover.mesh.position.x,top(),mover.mesh.position.z],{arrivalTolerance:2,heightTolerance:.2,label:'board lift'});
 assert.equal(r.p.groundHit?.moverId,0);report.boarded=r.snapshot();
 r.until(()=>top()>-10,{}, {maxFrames:700,label:'ride rising lift'});report.highPhase=r.snapshot();
 r.walkTo(w([-5,top(),-1624.2]),{pace:.3,label:'walk to lift departure edge'});
 const exit=w([-5,-9,-1629.5]);r.charge(26);r.releaseJump(r.steerToward(exit));
 r.stepFor(18,()=>r.steerToward(exit));r.charge(5,()=>r.steerToward(exit));r.releaseJump(r.steerToward(exit));
 r.until(()=>r.p.grounded,()=>r.steerToward(exit),{maxFrames:300,label:'doublejump to reward balcony'});
 assert.equal(r.p.groundHit?.name,'Creek encounter 45');ground('lift reward balcony');
});
if(selected('moving-crossing'))await encounter('moving-crossing',[69,-15.9,-1720],({r,w,src,follow,grind,ground,report})=>{
 const mover=r.l.movers[1],top=()=>mover.mesh.position.y+.4;
 r.walkTo(w([73,-16,-1720]),{pace:.35,label:'walk to moving bridge approach'});
 r.until(()=>mover.mesh.position.x<mover.base.x-5.7,{}, {maxFrames:900,label:'wait for moving bridge near phase'});
 const target=()=>[mover.mesh.position.x,top(),mover.mesh.position.z];
 r.charge(26);r.releaseJump(r.steerToward(target));r.stepFor(18,()=>r.steerToward(target));
 r.charge(5,()=>r.steerToward(target));r.releaseJump(r.steerToward(target));
 r.until(()=>r.p.grounded,()=>r.steerToward(target),{maxFrames:300,label:'board moving bridge'});
 assert.equal(r.p.groundHit?.moverId,1);report.boarded=r.snapshot();
 r.stepFor(25);r.until(()=>mover.mesh.position.x>mover.base.x+2.5,{}, {maxFrames:900,label:'ride moving bridge to far phase'});report.farPhase=r.snapshot();
 const exit=w([101,-16,-1720]);r.charge(40,()=>r.steerToward(exit));r.releaseJump({...r.steerToward(exit),grindHeld:true});
 r.until(()=>r.p.state==='grind',()=>({...r.steerToward(exit),grindHeld:true}),{maxFrames:300,label:'jump from moving bridge to crossing rail'});report.catch=r.snapshot();
 r.until(()=>src().x>97.5,()=>({moveY:0,moveX:Math.max(-1,Math.min(1,-r.p.balance*5-r.p.balanceVel*.7)),grindHeld:true,jumpHeld:true}),{maxFrames:300,label:'charge on crossing rail'});
 r.releaseJump({...r.steerToward(w([106,-16,-1720])),grindHeld:true});
 r.until(()=>src().x>101&&r.p.grounded&&r.p.state!=='grind',()=>({...r.steerToward(w([106,-16,-1720])),spinHeld:r.frame%12===0}),{maxFrames:900,label:'moving crossing far landing'});
 ground('moving bridge landing');assert.equal(r.p.groundHit?.name,'Creek encounter 52');
},warp([70,0,-1720]).map((v,i)=>v-warp([69,0,-1720])[i]));
if(selected('crusher'))await encounter('crusher',[155,-25.45,-1802],({r,w,src,follow,ground,report})=>{
 r.until(()=>src().z<-1820,()=>follow(155,7,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:900,label:'first crusher timing lane'});
 r.until(()=>src().z<-1841,()=>follow(149,6,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:900,label:'second crusher timing lane'});ground('crusher landing');
});
if(selected('split-dock'))await encounter('split-dock',[152,-25.9,-2020],({r,w,src,follow,ground,report})=>{
 r.until(()=>src().z<-2147,()=>follow(152,5,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:1500,label:'central collapsing dock line'});ground('split dock exit');
 report.crumbleStates=r.l.crumbles.map((c,i)=>({i,state:c.state,t:c.t}));
});
if(selected('pendulum-finish'))await encounter('pendulum-finish',[152,-25.45,-2198],({r,w,src,follow,ground,report})=>{
 r.stepFor(30);
 r.until(()=>r.p.state==='finished',()=>follow(152,8,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:1200,label:'finish carving'});assert.equal(r.p.state,'finished');
});
if(selected('rail-chapter'))await encounter('rail-chapter',[0,-12.45,-326],({r,w,src,follow,grind,ground,report})=>{
 r.until(()=>r.p.state==='grind',()=>grind(0,10,{jumpHeld:true}),{maxFrames:600,label:'catch first rail'});
 r.until(()=>src().z<-412,()=>grind(0,8,{jumpHeld:true}),{maxFrames:1200,label:'first rail crossing'});
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:300,label:'first rail landing'});ground('first rail landing');
 r.until(()=>src().z<-474.2,()=>follow(0,8,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:900,label:'first rail landing enemy and ramp approach'});
 report.rampTakeoff=r.snapshot();r.releaseJump(follow(0));
 r.until(()=>src().z<-489&&r.p.grounded,()=>follow(0),{maxFrames:600,label:'ramp gap landing'});ground('ramp gap landing');
 r.until(()=>src().z<-543,()=>follow(-3,8,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:900,label:'warehouse crate line'});
 r.until(()=>r.p.state==='grind',()=>grind(src().z>-563?-3:0,8,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:600,label:'catch slalom rail'});
 r.until(()=>src().z<-657,()=>grind(0,8,{jumpHeld:true}),{maxFrames:1200,label:'slalom rail crossing'});
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:300,label:'slalom rail landing'});ground('slalom rail landing');
 r.until(()=>src().z<-832,()=>follow(0,10,{jumpHeld:true,spinHeld:r.frame%12===0}),{maxFrames:1800,label:'halfpipe carving'});ground('halfpipe exit');
 r.until(()=>r.p.state==='grind',()=>grind(0,8,{jumpHeld:true}),{maxFrames:300,label:'triple rail entry'});
 r.until(()=>src().z<-911,()=>grind(0,8,{jumpHeld:true}),{maxFrames:1200,label:'triple rail crossing'});
 r.until(()=>r.p.grounded&&r.p.state!=='grind',()=>follow(0),{maxFrames:300,label:'triple rail landing'});ground('triple rail landing');
});

const prior=JSON.parse(await readFile(output+'/report.json','utf8').catch(()=> '[]'));
 const combined=[...prior.filter(p=>!results.some(r=>r.name===p.name)),...results];
 await writeFile(output+'/report.json',JSON.stringify(combined,null,2));
if(results.some(r=>!r.pass))process.exitCode=1;
