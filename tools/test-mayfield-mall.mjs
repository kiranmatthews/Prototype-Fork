import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {createMayfieldPilot} from './mayfield-pilot.mjs';
const out=process.env.MAYFIELD_OUTPUT||'/tmp/mayfield-validation';await mkdir(out,{recursive:true});
const mode=process.argv.includes('--skate')?'skate':'foot';
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m,server,THREE}=r;
 const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
 const {campaignLevelByKey,validateCampaignMapGraph}=await server.ssrLoadModule('/src/campaign.ts');
 assert.ok(parseCustomLevelJson(JSON.stringify(m.MAYFIELD_MALL_LEVEL)),'Mayfield survives editor validation');
 const slot=campaignLevelByKey('maynard-course-4');assert.equal(slot.levelId,'mayfield-mall');assert.equal(slot.name,'Mayfield Mall');assert.ok(!slot.placeholder&&!slot.skateRace&&!slot.competition);assert.deepEqual(validateCampaignMapGraph(),[]);
 assert.equal(l.skatepark,false);assert.equal(p.freeSkate,false);assert.equal(m.MAYFIELD_MALL_LEVEL.skateReference,undefined);assert.equal(m.MAYFIELD_MALL_LEVEL.components.filter(c=>c.t==='gate').length,1);
 const ray=new THREE.Raycaster(),support=[];
 for(const [x,y,s,nm]of [[0,0,-4,'spawn'],...m.MAYFIELD_CHECKPOINTS.map((c,i)=>[0,c.y,c.s,`checkpoint ${i+1}`]),[0,0,606,'Kona entrance'],[0,0,648,'Kona floor'],[0,0,690,'Kona exit'],[0,0,788,'finish approach']]){
  ray.set(new THREE.Vector3(x,y+1.5,-s),new THREE.Vector3(0,-1,0));ray.far=4;const hit=ray.intersectObjects(l.groundMeshes,false)[0];assert.ok(hit&&Math.abs(hit.point.y-y)<.08,`${nm}: support ${hit?.point.y} != ${y}`);support.push({nm,y:hit.point.y});
 }
 const pilot=createMayfieldPilot(m,{mode});const tuning=JSON.stringify(r.TUNING);
 try {r.stepFor(10);for(let i=0;i<18000&&p.state!=='finished';i++){r.tick(pilot.sample(p,l));pilot.observe(p,l);}assert.equal(p.state,'finished');assert.equal(p.totalDeaths,0);assert.equal(pilot.evidence.checkpoints.length,6);assert.equal(pilot.evidence.jumps.length,2);assert.equal(pilot.evidence.crystal,true);assert.equal(JSON.stringify(r.TUNING),tuning);}
 finally {await writeFile(`${out}/${mode}.json`,JSON.stringify({mode,state:p.state,position:p.pos.toArray(),deaths:p.totalDeaths,support,evidence:pilot.evidence,trace:r.trace.filter((_,i)=>i%10===0)},null,2));}
 console.log(JSON.stringify({mode,state:p.state,seconds:r.frame*r.dt,deaths:p.totalDeaths,evidence:pilot.evidence},null,2));
},{modulePath:'/src/levels/mayfield-mall.ts',source:m=>m.MAYFIELD_MALL_LEVEL,levelId:'mayfield-mall',maxFrames:19000});
