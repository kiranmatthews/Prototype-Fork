import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

// Continuous production-player journeys: start at the authored spawn and use
// device inputs only. Optional upper rewards belong to separate room probes.
const evidence=[];
for(const id of ['jungle-terraces','jungle-skyline']) {
  await withBlockworksRuntime(async r=>{
    const {JUNGLE_SEQUEL_ROUTES}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');
    const route=JUNGLE_SEQUEL_ROUTES.find(route=>route.id===id),p=r.p;
    const jump=route.gaps.find(g=>g.switchX===undefined);
    let released=false,braking=false;
    r.until(()=>p.state==='finished',()=>{
      let pop=!released&&p.pos.x>=jump.a-3.8&&p.pos.x<jump.a&&p.grounded;
      if(pop)released=true;
      // Establish the approach speed before a downhill commits to the next
      // bowl. Braking only at the lip is too late after the skyline chute.
      const pipe=route.pipes.find(pipe=>p.pos.x>pipe.a-70&&p.pos.x<pipe.b+8);
      if(!pipe)braking=false;
      else if(p.speed>16)braking=true;else if(p.speed<13)braking=false;
      const switchNear=route.gaps.some(g=>g.switchX!==undefined&&Math.abs(p.pos.x-g.switchX)<5);
      return {moveX:p.grounded?1:0,jumpHeld:!pop,spinHeld:switchNear&&p.grounded,grabHeld:braking&&p.grounded};
    },{maxFrames:12000,label:`${id} source-spawn-to-finish skating journey`});
    assert.equal(p.totalDeaths,0,'course must be finishable without a death');
    assert.ok(released,'the final gap requires a deliberate ollie');
    for(const gap of route.gaps.filter(g=>g.switchX!==undefined)){
      const source=route.data.components.find(c=>c.t==='crate'&&c.kind==='bang'&&c.grp===gap.group);
      const live=r.l.crates.find(c=>Math.abs(c.mesh.position.x-source.p[0])<.01&&c.bang);
      assert.ok(live?.bangUsed,`${id}: route switch must be hit during the actual run`);
    }
    const grounded=r.trace.filter(row=>row.grounded);
    evidence.push({id,frames:r.frame,seconds:r.frame*r.dt,deaths:p.totalDeaths,
      finish:p.pos.toArray(),highest:Math.max(...r.trace.map(row=>row.position[1])),
      minPipeContact:route.pipes.map(pipe=>({name:pipe.name,
        lowest:Math.min(...grounded.filter(row=>row.position[0]>pipe.a&&row.position[0]<pipe.b).map(row=>row.position[1]))})),
      maxSpeed:Math.max(...r.trace.map(row=>row.speed))});
  },{modulePath:'/src/level.ts',levelId:id,source:m=>m.findLevel(id).data,
    controlFrame:()=>({x:0,z:-1}),maxFrames:12500,endlessDeaths:true});
}
await writeFile(`${tmpdir()}/jungle-sequel-journeys.json`,JSON.stringify(evidence,null,2));
console.log(JSON.stringify(evidence,null,2));
