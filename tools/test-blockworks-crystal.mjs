import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runFoundry} from './test-blockworks-foundry.mjs';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
let m;try{m=await server.ssrLoadModule('/src/levels/codex-lab.ts');}finally{await server.close();}
const components=m.CODEX_LAB_LEVEL.components,crystals=components.filter(c=>c.t==='crystal');
assert.equal(crystals.length,1);
const crystal=crystals[0],perch=components.find(c=>c.nm==='Foundry crystal precision perch');
assert.ok(20-crystal.p[2]>1100&&20-crystal.p[2]<1160,'crystal belongs to mid-course foundry');
assert.equal(perch.p[1]-perch.s[1]/2,m.BLOCKWORKS_GROUND,'perch must reach shared ground');
assert.deepEqual([perch.s[0],perch.s[2]],[2.4,2.4]);
const reward=m.routePoint(1131,3.6,11),start=[reward[0]-4.4,3.62,reward[2]];
const fixture=await withBlockworksRuntime(r=>{
  r.stepFor(30);assert.ok(!r.p.hasCrystal);
  r.jumpTo([crystal.p[0]+.6,3.6,crystal.p[2]],{heightTolerance:.12,arrivalTolerance:.65});
  r.walkTo([crystal.p[0],3.6,crystal.p[2]]);
  assert.ok(r.p.hasCrystal&&r.l.crystalPickup.collected);
  r.jumpTo([start[0],3.6,start[2]],{heightTolerance:.12,arrivalTolerance:.65});
  r.stepFor(30);assert.ok(r.p.grounded&&!r.p.isBailing&&r.p.totalDeaths===0);
  return{start,inputs:r.trace.map(row=>row.input),end:r.p.pos.toArray(),seconds:r.frame*r.dt};
},{start,maxFrames:3000});
if(process.env.CRYSTAL_REVIEW_FIXTURE)await writeFile(process.env.CRYSTAL_REVIEW_FIXTURE,JSON.stringify(fixture));
await withBlockworksRuntime(r=>runFoundry(r,{exerciseReward:false,verifyRespawn:false}),{start:m.routePoint(1040,3.62),maxFrames:20000});
console.log(`PASS crystal grounded mid-course detour, precise landing and return (${fixture.seconds.toFixed(1)}s), main route leaves crystal uncollected`);
