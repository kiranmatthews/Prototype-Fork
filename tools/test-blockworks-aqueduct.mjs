import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
export async function runAqueduct(f){
 const {p,l,sourceModule:m,tick,until,steerToward,trace}=f;
 const s=()=>20-p.pos.z,aim=(ahead=9,u=0)=>steerToward(m.routePoint(s()+ahead,0,u));
 let stage='floor approach',sawSteep=false,caughtCoping=false,launchRail=null,receiver=false,popped=false;
 try {
  until(()=>s()>=872,()=>({...aim(),jumpHeld:true}),{label:stage,maxFrames:1800});
  stage='carve bank into coping';
  until(()=>p.state==='grind',()=>{sawSteep ||= !!p.groundHit&&p.groundHit.normal.y<.85;return {...aim(13,11),jumpHeld:true,grindHeld:true};},{label:stage,maxFrames:420});
  caughtCoping=true;assert.ok(p.speed>12,'the bank-to-coping catch must retain useful momentum');
  stage='ride coping to upper departure';
  until(()=>s()>921&&p.state==='ride'&&p.grounded,()=>({moveY:1,moveX:p.state==='grind'?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0,grindHeld:true,jumpHeld:true}),{label:stage,maxFrames:1200});
  stage='approach high transfer rail';
  until(()=>s()>=934,()=>({...aim(6,8.5),jumpHeld:true}),{label:stage,maxFrames:240});
  tick({...aim(6,8.5),jumpReleased:true,grindHeld:true});
  until(()=>p.state==='grind',()=>({...aim(7,8.1),grindHeld:true}),{label:stage,maxFrames:180});
  launchRail=p.grindRail;
  stage='charge and pop from rising rail';
  until(()=>s()>=974.5,()=>({moveY:1,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),grindHeld:true,jumpHeld:s()>962}),{label:stage,maxFrames:600});
  tick({moveY:1,grindHeld:true,jumpReleased:true});popped=p.state==='air';
  stage='catch lower receiver';
  until(()=>p.state==='grind'&&p.grindRail!==launchRail,()=>({...aim(7,Math.max(0,2*(1012-s())/30)),grindHeld:true}),{label:stage,maxFrames:180});
  receiver=true;stage='exit to checkpoint';
  until(()=>s()>=1023&&p.grounded&&p.state==='ride',()=>({moveY:1,moveX:p.state==='grind'?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0,grindHeld:true}),{label:stage,maxFrames:900});
  stage='bank aqueduct checkpoint';
  until(()=>!p.freeSkate&&p.speed<.08,()=>({...aim(8,0),grabHeld:true}),{label:stage,maxFrames:300});
  f.stepFor(45);
  const checkpoint=m.BLOCKWORKS_CHECKPOINTS.find(cp=>cp.s===1030),q=checkpoint.p;
  f.walkTo([q[0]+1.3,q[1],q[2]],{pace:.35,arrivalTolerance:.3,label:stage});
  tick({spinHeld:true});f.stepFor(25);
  assert.ok(l.activeCheckpoint&&Math.hypot(l.activeCheckpoint.spawnPos.x-q[0],l.activeCheckpoint.spawnPos.z-q[2])<.1,'aqueduct checkpoint was not banked');
  assert.ok(sawSteep&&caughtCoping&&popped&&receiver);
  assert.ok(trace.every(t=>!t.bailing&&!['dead','gameover'].includes(t.state)));
  console.log('PASS continuous curved aqueduct, earned bank-to-coping carry, upper departure, rail-to-rail transfer and landing');
  console.log(JSON.stringify({frames:trace.length,finish:p.pos.toArray(),maxHeight:Math.max(...trace.map(t=>t.position[1])),sawSteep,receiver}));
 } catch(error){console.error('AQUEDUCT_STAGE',stage,'S',s(),f.snapshot());throw error;}
 finally{await writeFile('/tmp/blockworks-aqueduct-trace.json',JSON.stringify(trace));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const k=2*Math.PI/660,startS=746;
 const start=[66*Math.sin(k*startS)-18*Math.sin(2*k*startS),.02,20-startS];
 await withBlockworksRuntime(runAqueduct,{start});
}
