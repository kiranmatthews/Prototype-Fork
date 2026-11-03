import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runTribalRebuild} from './tribal-rebuild-pilot.mjs';
import {auditTribalGeometry} from './tribal-run-geometry-audit.mjs';
const first=Number(process.env.TRIBAL_FIRST??0),last=Number(process.env.TRIBAL_LAST??22),out='docs/tribal-run-rebuild';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,source,sourceModule:m}=r;
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');assert.ok(normalizeCustomLevelData(structuredClone(source)),'editor data contract');
 if(first){const s=m.TRIBAL_RUN_CROSSINGS[first].a-9;p.respawn(l,true,false,{position:new r.THREE.Vector3(...m.tribalPoint(s,m.tribalHeight(s)+.12,m.tribalOffset(s))),heading:new r.THREE.Vector3(...m.tribalTangent(s))});}
 r.report={stage:'spawn',counts:{movers:l.movers.length,enemies:l.enemies.length,rails:m.TRIBAL_RUN_CROSSINGS.filter(c=>c.kind==='rail').length,slides:m.TRIBAL_RUN_SLIDES.length,components:source.components.length},rides:[],actions:[],rails:[],jumps:[]};
 if(process.argv.includes('--audit')){r.report.geometry=auditTribalGeometry(r);assert.ok(m.TRIBAL_RUN_SLIDES.length>=6);assert.ok(l.movers.length>=20);assert.ok(l.enemies.length>=24);console.log(JSON.stringify({event:'geometry',...r.report.counts,probes:r.report.geometry.supportProbes}));}
 if(process.argv.includes('--audit-only')){await writeFile(out+'/geometry.json',JSON.stringify(r.report,null,2));return;}
 const tuning=JSON.stringify(r.TUNING),pilot=runTribalRebuild(r,{first,last,finish:last===m.TRIBAL_RUN_CROSSINGS.length-1});let next;
 try{while(!(next=pilot.next()).done)r.tick(next.value);r.report.result=next.value;assert.equal(p.totalDeaths,0);assert.equal(JSON.stringify(r.TUNING),tuning);
  r.report.slipperyFrames=r.trace.filter(t=>t.ground?.slippy).length;assert.ok(first>0||r.report.slipperyFrames>0);
  r.report.maxFrameTravel=r.trace.slice(1).reduce((v,f,i)=>Math.max(v,Math.hypot(...f.position.map((x,k)=>x-r.trace[i].position[k]))),0);assert.ok(r.report.maxFrameTravel<2.2);
  if(last===m.TRIBAL_RUN_CROSSINGS.length-1){assert.equal(p.state,'finished');assert.equal(p.hasCrystal,true);if(first===0)assert.equal(l.checkpoints.filter(c=>c.active).length,9);}
  r.report.pass=true;console.log(JSON.stringify({pass:true,result:r.report.result,counts:r.report.counts,rides:r.report.rides.length,rails:r.report.rails.length,slipperyFrames:r.report.slipperyFrames}));
 }catch(e){r.report.error=e.message;console.log(JSON.stringify({stage:r.report.stage,error:e.message}));throw e;}
 finally{await writeFile(`${out}/native-${first}-${last}.json`,JSON.stringify(r.report,null,2)+'\n');await writeFile('/private/tmp/tribal-rebuild-trace.json',JSON.stringify(r.trace));}
},{modulePath:'/src/levels/tribal-run.ts',source:m=>m.TRIBAL_RUN_LEVEL,levelId:'tribal-run',maxFrames:65000,optimizeDeps:{noDiscovery:true,include:[]},onTick:(s,r)=>{if(s.frame%900===0)console.log(JSON.stringify({frame:s.frame,stage:r.report?.stage,s:r.sourceModule.tribalProgress(r.p.pos),state:s.state}));}});
