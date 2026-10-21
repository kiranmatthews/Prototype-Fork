import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const reports=[];
for(const old of [false,true])await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,original=await r.server.ssrLoadModule('/src/levels/rumblewater-run.ts');
 const progress=old?original.rumbleProgress:m.ripcordProgress,height=old?original.rumbleHeight:m.ripcordHeight;
 const rooms=old?original.RUMBLEWATER_REFUGES:m.RIPCORD_REFUGES,point=old?original.rumblePoint:m.ripcordPoint;
 r.stepFor(20);assert.ok(r.p.grounded);
 for(const room of rooms){
  assert.ok(r.p.warpCheckpoint(r.l,1));r.stepFor(120);
  assert.ok(r.p.grounded&&!r.p.isBailing);assert.ok(Math.abs(progress(r.p.pos)-room.checkpoint)<2);
  assert.ok(r.l.boulder.course.sheltered&&!r.l.boulder.course.active);
 }
 assert.ok(r.p.warpCheckpoint(r.l,-1));r.stepFor(20);
 const checkpoint=r.l.currentSpawn.clone(),before=r.p.lives;
 // Declared miss fixture, followed by actual water contact and natural respawn.
 const s=old?2419:m.RIPCORD_BOULDER_END+3;
 r.p.respawn(r.l,false,false,{position:new r.THREE.Vector3(...point(s,height(s)+.1))});
 r.until(()=>r.p.state==='dead',{}, {maxFrames:600,allowDeath:true,label:'water in the physical gap'});
 assert.ok(r.p.pos.y<height(s)-2,'the missed jump falls below the playable surface');
 const waterContact=r.p.waterDeathSurface!==null;
 r.until(()=>r.p.state==='ride'&&r.p.grounded,{}, {maxFrames:600,allowDeath:true,label:'natural checkpoint respawn'});
 assert.equal(r.p.lives,before-1);assert.ok(r.p.pos.distanceTo(checkpoint)<1);
 assert.ok(!r.l.boulder.course.active);r.stepFor(120);assert.ok(!r.l.boulder.course.active);
 reports.push({level:old?'Rolling Bones':'Ripcord River',warps:rooms.length+1,pitDeath:true,waterContact,naturalRespawn:true,lives:r.p.lives,checkpoint:checkpoint.toArray(),cradles:r.l.boulder.cradles.filter(Boolean).length});
},{modulePath:'/src/levels/ripcord-river.ts',levelId:old?'rolling-bones':'rumblewater-run',source:m=>old?m.ROLLING_BONES_LEVEL:m.RIPCORD_RIVER_LEVEL,maxFrames:5000,allowCheckpointTrips:true});
await mkdir('/private/tmp/ripcord-river-evidence',{recursive:true});await writeFile('/private/tmp/ripcord-river-evidence/recovery.json',JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
