import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';
import {pirateJourney} from '../pirate-wreck-pilot.mjs';
let waterImages=0,retiredWaterImages=0;
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 if(!normalizeCustomLevelData(r.source)){
  console.log('Editor audit',JSON.stringify({components:r.source.components.length,vertices:r.source.components.reduce((n,c)=>n+(c.vertices?.length??0)/3,0),triangles:r.source.components.reduce((n,c)=>n+(c.indices?.length??(c.vertices?.length??0)/3)/3,0)}));
  const minimal={v:1,name:'Drowned component audit',spawn:[0,.1,0],killY:-20,groups:r.source.groups};
  for(const [i,c] of r.source.components.entries())if(!normalizeCustomLevelData({...minimal,components:[c]}))console.log('Rejected component',i,c.nm,c.t,c.vertices?.length,c.s,c.tex,c.grp);
 }
 assert.ok(normalizeCustomLevelData(r.source),'Editor round-trip');
 assert.equal(r.source.components.filter(c=>c.t==='gate').length,1);
 assert.equal(r.source.components.filter(c=>c.t==='checkpoint').length,6);
 try {
  const pilot=pirateJourney(r);let n=pilot.next();
  while(!n.done){r.tick(n.value);n=pilot.next();}
  assert.equal(n.value.checkpoints,6);assert.equal(n.value.deaths,0);
  const report={result:n.value,seconds:r.frame*r.dt,components:r.source.components.length};
  await writeFile('docs/drowned-crown/route-check.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({state:n.value.state,deaths:n.value.deaths,checkpoints:n.value.checkpoints,seconds:report.seconds,components:report.components}));
  const textures=new Set();r.l.root.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.userData.waterSurface&&m.map)textures.add(m.map);});
  waterImages=textures.size;for(const texture of textures)texture.addEventListener('dispose',()=>retiredWaterImages++);
 }catch(e){await writeFile('/private/tmp/drowned-route-failure.json',JSON.stringify({error:String(e),report:r.report,trace:r.trace},null,2));throw e;}
},{modulePath:'/src/levels/pirate-wreck.ts',levelId:'drowned-crown',source:m=>m.PIRATE_WRECK_LEVEL,maxFrames:90000});

assert.equal(waterImages,0,'One shared reflected ocean joins the harbour and cavern');
assert.equal(retiredWaterImages,waterImages,'Level retirement releases each reflection image exactly once');
