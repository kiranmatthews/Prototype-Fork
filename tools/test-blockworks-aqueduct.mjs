import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

/** Session one authored high-air row from the live floor, then return under
 * control. This never resets position/speed or manufactures a launch. */
export function pumpAqueductRow(f,focus,firstSide){
 const {p,l,sourceModule:m,tick,until}=f,normal=m.routeTangent(focus),begin=f.frame;
 const row=m.BLOCKWORKS_VERT_AQUEDUCT.targets.filter(t=>Math.abs(t.s-focus)<3);
 const targets=row.map(t=>({source:t,crate:l.crates.find(c=>Math.abs(c.box.min.y-t.y)<.02&&Math.hypot(c.mesh.position.x-t.p[0],c.mesh.position.z-t.p[2])<.02)}));
 assert.equal(targets.length,3,'the session must address a complete authored high-air row');
 assert.ok(targets.every(t=>t.crate),'every high target must exist at its authored height');
 let side=firstSide,released=false,current=null;
 const airs=[];
 for(let frame=0;frame<1600&&airs.length<8;frame++){
  let input=current?{jumpHeld:p.vVel<0}:{};
  if(!current){
   const release=!released&&p.pos.y>2&&p.groundHit?.normal.y<.45;
   input={...f.worldDirectionInput({x:-normal[2]*side,z:normal[0]*side}),jumpHeld:!release&&!released,jumpReleased:release};
   if(release)released=true;
  }
  tick(input);
  assert.ok(!p.isBailing&&!['dead','gameover'].includes(p.state),'a pumped target session must remain a clean ride');
  if(!current&&!p.grounded&&(p.vertAir||p.pipeHang))current={side,peak:p.pos.y,frames:0};
  if(current){
   current.frames++;current.peak=Math.max(current.peak,p.pos.y);
   if(p.grounded){airs.push(current);current=null;side*=-1;released=false;}
  }
 }
 if(process.env.AQUEDUCT_DEBUG)console.log('PUMP',focus,airs,targets.map(t=>({name:t.source.name,alive:t.crate.alive})));
 assert.equal(airs.length,8,'eight earned wall-to-wall airs must complete');
 assert.ok(airs.every(a=>a.frames>=45&&a.peak>5),'each transition must provide real hangtime');
 assert.ok(airs.at(-1).peak>airs[0].peak+6,'successive pump input must earn the high target height');
 assert.ok(Math.max(...airs.map(a=>a.peak))>row[0].y,'the target row must be reachable with the authored movement model');
 const middle=targets.find(t=>Math.abs(t.source.s-focus)<.01);
 assert.ok(middle&&!middle.crate.alive,'the player must actually break the central high-air reward');
 assert.ok(f.trace.slice(begin).every(t=>t.state!=='grind'&&t.rail===null),'the wall-to-wall session must not use coping or rail assistance');
 until(()=>p.grounded&&p.pos.y<.1,()=>({...f.steerToward(m.routePoint(focus,0)),jumpHeld:false}),{maxFrames:300,label:'return pumped air to the flat'});
 until(()=>!p.freeSkate&&Math.abs(p.speed)<.08,{grabHeld:true},{maxFrames:600,label:'brake on the bowl floor after high air'});
 f.stepFor(45);
 return{focus,airs,broken:targets.filter(t=>!t.crate.alive).map(t=>t.source.name),frames:f.frame-begin};
}

export async function runAqueduct(f){
 const {p,l,sourceModule:m,tick,until,steerToward,trace}=f,begin=f.frame,tuningBefore=JSON.stringify(f.TUNING);
 const s=()=>20-p.pos.z,aim=(ahead=9,u=0)=>steerToward(m.routePoint(s()+ahead,0,u));
 const sessions=[];let stage='floor approach',launchRail=null,receiver=false,popped=false;
 try {
  const pipe=f.source.components.find(c=>c.t==='vertramp'&&c.grp===13);
  assert.equal(pipe.rails,false,'the redesigned vert vault must have no coping');
  assert.equal(pipe.deck,1.2);assert.equal(pipe.arc,90);
  for(const [focus,firstSide] of [[826,-1],[874,1]]){
   stage=`approach high-air row ${focus}`;
   until(()=>s()>=focus-12,()=>({...aim(),jumpHeld:true}),{label:stage,maxFrames:1800});
   until(()=>Math.abs(p.speed)<.2,{grabHeld:true,jumpHeld:true},{label:`${stage} · brake`,maxFrames:600});
   f.stepFor(45,{grabHeld:true});
   f.walkTo(m.routePoint(focus,0),{pace:.35,arrivalTolerance:.3,label:`${stage} · line up across the floor`});
   stage=`pump both walls to high-air row ${focus}`;
   sessions.push(pumpAqueductRow(f,focus,firstSide));
  }
  stage='ride clean floor departure';
  f.walkTo(m.routePoint(884,0),{pace:.35,arrivalTolerance:.3,label:'line up the floor exit'});
  until(()=>s()>=943.2,()=>({...aim(8),jumpHeld:true}),{label:stage,maxFrames:900});
  assert.ok(p.grounded&&p.freeSkate&&p.pos.y>3.35,'the central ramp must carry the same rider up to the departure deck');
  assert.ok(trace.slice(begin).every(t=>t.state!=='grind'),'the aqueduct floor exit must be reached without riding coping');
  stage='catch after-pipe launch rail';
  tick({...aim(6),jumpReleased:true,grindHeld:true});
  until(()=>p.state==='grind',()=>({...aim(7),grindHeld:true}),{label:stage,maxFrames:180});
  launchRail=p.grindRail;
  until(()=>s()>=945,{moveY:1,grindHeld:true},{label:'seat and carry the launch-rail catch',maxFrames:30});
  assert.ok(s()>=944&&p.speed>12,'the launch rail must be caught beyond the bowl with real approach momentum');
  stage='charge and pop from rising rail';
  until(()=>s()>=974.5,()=>({moveY:1,moveX:Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)),grindHeld:true,jumpHeld:s()>962}),{label:stage,maxFrames:600});
  tick({moveY:1,grindHeld:true,jumpReleased:true});popped=p.state==='air';
  stage='catch lower receiver';
  until(()=>p.state==='grind'&&p.grindRail!==launchRail,()=>({...aim(7,Math.max(0,.8*(1012-s())/30)),grindHeld:true}),{label:stage,maxFrames:180});
  receiver=true;stage='exit to checkpoint';
  until(()=>s()>=1023&&p.grounded&&p.state==='ride',()=>({moveY:1,moveX:p.state==='grind'?Math.max(-1,Math.min(1,-p.balance*5-p.balanceVel*.7)):0,grindHeld:true}),{label:stage,maxFrames:900});
  stage='bank aqueduct checkpoint';
  until(()=>!p.freeSkate&&p.speed<.08,()=>({...aim(8,0),grabHeld:true}),{label:stage,maxFrames:300});
  f.stepFor(45);
  const checkpoint=m.BLOCKWORKS_CHECKPOINTS.find(cp=>cp.s===1030),q=checkpoint.p;
  f.walkTo([q[0]+1.3,q[1],q[2]],{pace:.35,arrivalTolerance:.3,label:stage});
  tick({spinHeld:true});f.stepFor(25);
  assert.ok(l.activeCheckpoint&&Math.hypot(l.activeCheckpoint.spawnPos.x-q[0],l.activeCheckpoint.spawnPos.z-q[2])<.1,'aqueduct checkpoint was not banked');
  assert.ok(popped&&receiver,'both relocated rails and their airborne transfer must be traversed');
  assert.ok(trace.slice(begin).every(t=>!t.bailing&&!['dead','gameover'].includes(t.state)));
  assert.equal(JSON.stringify(f.TUNING),tuningBefore,'high-air targets must not require altered movement tuning');
  console.log('PASS continuous curved vert vault, both high-air reward rows, floor departure, after-pipe rail transfer and checkpoint');
  const evidence={stage:'aqueduct',frame:f.frame,frames:f.frame-begin,position:p.pos.toArray(),speed:p.speed,sessions,receiver};
  console.log(JSON.stringify(evidence));
  return evidence;
 } catch(error){console.error('AQUEDUCT_STAGE',stage,'S',s(),f.snapshot());throw error;}
 finally{await writeFile('/tmp/blockworks-aqueduct-trace.json',JSON.stringify(trace));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const k=2*Math.PI/660,startS=746;
 const start=[66*Math.sin(k*startS)-18*Math.sin(2*k*startS),.02,20-startS];
 await withBlockworksRuntime(runAqueduct,{start});
}
