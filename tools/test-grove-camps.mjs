import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
// Continue real field exits through a delayed brake, the supply base and the
// next clue. No teleports or velocity edits after the initial approach spawn.
const ids=process.argv.slice(2).map(Number),results=[];
await mkdir('/private/tmp/grove-camps',{recursive:true});
for(const id of ids.length?ids:[1,3,7]){
 const replay=JSON.parse(await readFile(`/private/tmp/grove-traversal/${id}-inputs.json`,'utf8'));
 const report={id};
 try{await withBlockworksRuntime(async r=>{
  const m=r.sourceModule,f=m.GROVE_FIELDS[id-1],next=m.GROVE_FIELDS[id],p=r.p,base=f.end+m.GROVE_CAMP_BASE_OFFSET;
  assert.ok(Math.abs(-replay.start[2]-(id===7?f.clueAt+2:f.start-9))<.01,'regenerate field replays after moving the level');
  for(const input of replay.frames)r.tick(input);
  assert.ok(p.grounded);assert.ok(-p.pos.z>f.end);report.arrival=r.snapshot();
  r.stepFor(30); // Half a second to react after landing, including button release.
  r.until(()=>p.grounded&&Math.abs(p.speed)<.05,{grabHeld:true},{maxFrames:360,label:'brake in clear landing zone'});
  report.stopped=r.snapshot();
  report.stopBeyondField=-p.pos.z-f.end;
  assert.ok(-p.pos.z<base-5,'stopping run reaches the supplies');
  assert.equal(p.totalDeaths,0);assert.ok(r.l.minefields.fields.every(f=>!f.detonated));
  r.stepFor(45);
  const runTo=target=>{
   r.until(()=>r.distanceTo(target)<.12,()=>r.steerToward(target,{pace:Math.min(1,r.distanceTo(target)/2.2)}),{maxFrames:600,label:'run forward through refuge'});
   r.stepFor(25);assert.ok(p.grounded);assert.ok(r.distanceTo(target)<.5);
  };
  const supplies=r.l.crates.filter(c=>Math.abs(c.mesh.position.z+base)<5&&!c.checkpoint).sort((a,b)=>b.mesh.position.z-a.mesh.position.z);
  assert.equal(supplies.length,2);
  const collect=crate=>{
   const target=crate.mesh.position;
   runTo([target.x,0,target.z+1.2]);r.stepFor(1,{spinHeld:true});r.stepFor(24);
   assert.equal(crate.alive,false,'reachable camp crate should break with a native spin');
  };
  collect(supplies[0]);
  const checkpoint=r.l.checkpoints.find(cp=>Math.abs(cp.spawnPos.z+base)<.5);
  if(checkpoint){
   runTo([0,0,-base+1.2]);r.stepFor(1,{spinHeld:true});r.stepFor(24);
   assert.equal(r.l.activeCheckpoint,checkpoint);
  }
  collect(supplies[1]);report.supplies=r.snapshot();
  runTo([0,0,-(next.clueAt-2)]);report.reading=r.snapshot();
  assert.ok(-p.pos.z>base+5,'clue must follow the supply base');
  r.stepFor(90); // A deliberate pause to inspect the rag safely.
  assert.equal(p.totalDeaths,0);assert.ok(r.l.minefields.fields.every(f=>!f.detonated));
  const nextX=next.data.spots?.[0][0]??(next.id===6?-1.5:next.id===1?-3.6:0);
  runTo([nextX,0,-next.start+9]);report.approach=r.snapshot();
  assert.ok(-p.pos.z<next.start-7);assert.equal(p.totalDeaths,0);
  report.pass=true;report.checkpoint=!!checkpoint;report.gap=next.start-f.end;
  await writeFile(`/private/tmp/grove-camps/${id}-inputs.json`,JSON.stringify({id,start:replay.start,frames:r.trace.map(t=>t.input),phases:{arrival:report.arrival.frame,stopped:report.stopped.frame,supplies:report.supplies.frame,reading:report.reading.frame,approach:report.approach.frame}}));
 },{modulePath:'/src/levels/jungle-minefield.ts',source:m=>m.JUNGLE_MINEFIELD_LEVEL,levelId:'jungle-minefield',start:replay.start,maxFrames:6000});
 }catch(e){report.pass=false;report.error=String(e);process.exitCode=1;}
 results.push(report);await writeFile(`/private/tmp/grove-camps/${id}.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({id,pass:report.pass,stopBeyondField:report.stopBeyondField,gap:report.gap,checkpoint:report.checkpoint,error:report.error}));
}
await writeFile('/private/tmp/grove-camps/review.json',JSON.stringify(results,null,2));
