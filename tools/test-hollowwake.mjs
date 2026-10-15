import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const mode=process.argv[2]??'left',report={mode};
try{await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,s=()=>m.hollowProgress(r.p.pos);
 const smack=r.p.wallSmack;report.solidHits=[];r.p.wallSmack=function(x,z,speed,box){report.solidHits.push({at:s(),speed,box:box?[box.min.toArray(),box.max.toArray()]:null,crate:r.l.crates.findIndex(c=>c.box===box),wall:r.l.walls.indexOf(box)});return smack.call(this,x,z,speed,box);};
 const bail=r.p.bail;report.bails=[];r.p.bail=function(...args){report.bails.push({args,at:s(),frame:r.frame,position:this.pos.toArray(),vel:[this.speed,this.vVel],vertAir:this.vertAir,spin:this.grabSpinAngle,grab:this.grabPhase,flip:this.flipT,pipeEnd:this.pipeEndFly,stack:new Error().stack.split('\n').slice(1,5),ground:this.groundHit?.mesh?.name});return bail.apply(this,args);};
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const normalized=normalizeCustomLevelData(m.HOLLOWWAKE_LEVEL);assert.ok(normalized,'editor accepts the source within unchanged budgets');
 report.length=m.HOLLOWWAKE_LENGTH;report.components=m.HOLLOWWAKE_LEVEL.components.length;report.bytes=Buffer.byteLength(JSON.stringify(m.HOLLOWWAKE_LEVEL));
 assert.ok(report.length>2400);assert.equal(r.l.checkpoints.length,5);assert.ok(r.l.boulder?.course);
 assert.ok(!m.HOLLOWWAKE_LEVEL.components.some(c=>c.t==='torch'||c.t==='crystal'));
 r.stepFor(20);assert.ok(r.p.grounded,'supported spawn');report.spawn=r.snapshot();
 const branchAt=at=>{const i=m.HOLLOWWAKE_FORKS.findIndex(f=>at>=f.a&&at<=f.b);return i<0?-1:mode==='right'?1:mode==='alternate'?i%2:0;};
 const follow=(u=0,buttons={})=>({...r.steerToward(m.hollowPoint(s()+7,branchAt(s()+7),u)),...buttons});
 if(mode==='stall'){
  r.until(()=>s()>13,()=>follow(),{maxFrames:400,label:'release threshold'});
  r.until(()=>r.p.state==='dead',{}, {maxFrames:1800,allowDeath:true,label:'stationary runner is caught'});assert.equal(r.p.lives,3);report.pass=true;report.final=r.snapshot();return;
 }
 if(mode==='support'){
  const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);report.support=[];
  for(let at=0;at<m.HOLLOWWAKE_END;at+=7)for(const branch of branchAt(at)<0?[-1]:[0,1]){
   if(m.HOLLOWWAKE_GAPS.some(g=>g.branch===branch&&at>=g.s-2&&at<=g.s+g.len+2))continue;
   const p=m.hollowPoint(at,branch);ray.set(new r.THREE.Vector3(p[0],p[1]+2,p[2]),down);ray.far=4;
   const hits=ray.intersectObjects(r.l.groundMeshes,false).filter(h=>h.face?.normal.y>.15);
   assert.ok(hits.length,`floor missing at ${at} branch ${branch}`);assert.ok(Math.abs(hits[0].point.y-p[1])<.25,`floor mismatch ${at}`);report.support.push({at,branch,error:hits[0].point.y-p[1]});
  }report.pass=true;return;
 }
 const jumped=new Set();let activeJump=null;
 const driver=()=>{
  const at=s(),branch=branchAt(at),gap=m.HOLLOWWAKE_GAPS.find(g=>g.branch===branch&&g.len<20&&!jumped.has(g)&&g.s+g.len>at&&g.s<at+45);
  const obstacle=m.HOLLOWWAKE_OBSTACLES.find(o=>o.branch===branch&&o.u!==0&&o.s>at-2&&o.s<at+34);
  let u=obstacle?-Math.sign(obstacle.u)*3.8:0;
  report.lastInputs??=[];if(r.frame%3===0){report.lastInputs.push({at,branch,u,obstacle,position:r.p.pos.toArray()});if(report.lastInputs.length>50)report.lastInputs.shift();}
  if(activeJump){if(r.p.grounded&&at>activeJump.s+activeJump.len){jumped.add(activeJump);activeJump=null;}else{const air=follow(0);air.moveX=Math.max(-.24,Math.min(.24,air.moveX));return air;}}
  const room=m.HOLLOWWAKE_ROOMS.find((room,i)=>at>room.entry&&at<room.checkpoint+1&&!r.l.checkpoints[i].active);
  if(room&&!r.p.isBailing&&room.checkpoint-at<6){
   if(r.p.spinning)return follow(0,{spinHeld:true});if(r.p.spinCd>0)return{};
   return room.checkpoint-at>2.7?follow(0):follow(0,{spinHeld:r.frame%2===0});
  }
  if(r.p.checkpointTripActive)return follow(0);
  if(at>m.HOLLOWWAKE_END-40)return follow(0,{jumpHeld:true,spinHeld:at>m.HOLLOWWAKE_END-9});
  if(gap&&at>gap.s-1.8){activeJump=gap;return follow(0,{jumpHeld:false,jumpReleased:true});}
  return follow(u,{jumpHeld:true,spinHeld:r.frame%30<8});
 };
 r.until(()=>r.p.state==='finished',driver,{maxFrames:18000,label:'complete '+mode+' cave route'});
 assert.equal(r.p.totalDeaths,0);assert.equal(r.l.checkpoints.filter(c=>c.active).length,5);
 report.pass=true;report.final=r.snapshot();report.seconds=r.frame*r.dt;report.jumps=jumped.size;report.forks=r.l.boulder.course.forks.map(f=>f.choice);
 const channels=['jumpHeld','grindHeld','spinHeld','grabHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferHeld','transferPressed','jumpCancelled'];
 const data={v:2,level:'hollowwake-descent',date:new Date().toISOString(),tuning:Object.fromEntries(Object.entries(r.TUNING).filter(([,v])=>typeof v==='number')),tuningChanges:[],mx:r.trace.map(t=>t.input.moveX),my:r.trace.map(t=>t.input.moveY),b:r.trace.map(t=>channels.reduce((n,c,i)=>n|(t.input[c]?1<<i:0),0)),frames:r.trace.length,truncated:false,surfaceFrictionPolicy:1};
 await writeFile('tools/hollowwake/replay-'+mode+'.json',JSON.stringify(data));
}, {modulePath:'/src/levels/hollowwake-descent.ts',levelId:'hollowwake-descent',source:m=>m.HOLLOWWAKE_LEVEL,maxFrames:22000,allowCheckpointTrips:true});}
catch(error){report.error=String(error.stack??error);process.exitCode=1;}
await mkdir('/private/tmp/hollowwake',{recursive:true});await writeFile('/private/tmp/hollowwake/'+mode+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,lastInputs:undefined,bails:report.bails?.map(b=>({at:b.at,args:b.args,spin:b.spin})),support:report.support?{count:report.support.length,maxError:Math.max(...report.support.map(p=>Math.abs(p.error)))}:undefined}));
