import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { runTempleJourney } from './temple-winding-pilot.mjs';

// Continuous production-player journeys: start at the authored spawn and use
// device inputs only. Optional upper rewards belong to separate room probes.
const evidence=[];
for(const id of ['jungle-terraces','jungle-skyline']) {
  await withBlockworksRuntime(async r=>{
    const {JUNGLE_SEQUEL_ROUTES}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');
    const route=JUNGLE_SEQUEL_ROUTES.find(route=>route.id===id),p=r.p;
    const jump=route.gaps.find(g=>g.switchX===undefined);
    r.route=route;r.nodeCamera=true;
    const generator=runTempleJourney(r);let next=generator.next();
    try{while(!next.done){r.tick(next.value);next=generator.next();}}catch(error){await writeFile(`${tmpdir()}/temple-route-failure.json`,JSON.stringify({id,error:String(error),trace:r.trace.slice(-500)},null,2));throw error;}
    const released=true;
    console.log('Finished',id,r.frame,p.pos.toArray());
    assert.equal(p.totalDeaths,0,'course must be finishable without a death');
    assert.ok(released,'the final gap requires a deliberate ollie');
    for(const gap of route.gaps.filter(g=>g.switchX!==undefined)){
      const source=route.data.components.find(c=>c.t==='crate'&&c.kind==='bang'&&c.grp===gap.group);
      const live=r.l.crates.find(c=>Math.abs(c.mesh.position.x-source.p[0])<.01&&Math.abs(c.mesh.position.z-source.p[2])<.01&&c.bang);
      assert.ok(live?.bangUsed,`${id}: route switch must be hit during the actual run`);
    }
    const grounded=r.trace.filter(row=>row.grounded);
    evidence.push({id,frames:r.frame,seconds:r.frame*r.dt,deaths:p.totalDeaths,
      finish:p.pos.toArray(),highest:Math.max(...r.trace.map(row=>row.position[1])),
      minPipeContact:route.pipes.map(pipe=>({name:pipe.name,
        lowest:Math.min(...grounded.filter(row=>route.toLocal(row.position)[0]>pipe.a&&route.toLocal(row.position)[0]<pipe.b).map(row=>row.position[1]))})),
      maxSpeed:Math.max(...r.trace.map(row=>row.speed))});
  },{onTick:()=>{},modulePath:'/src/level.ts',levelId:id,source:m=>m.findLevel(id).data,
    controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z},maxFrames:18500,endlessDeaths:true});
}
await writeFile(`${tmpdir()}/jungle-sequel-journeys.json`,JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
