import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runTribalJourney} from './tribal-run-pilot.mjs';
import {auditTribalGeometry} from './tribal-run-geometry-audit.mjs';

const phase=process.env.TRIBAL_PHASE||'all',upper=process.argv.includes('--upper');
const out=process.env.TRIBAL_OUTPUT||'docs/tribal-run/greybox/evidence';
await mkdir(out,{recursive:true});
const start=process.env.TRIBAL_START?.split(',').map(Number);
console.log(JSON.stringify({event:'loading runtime',phase,upper,start}));
await withBlockworksRuntime(async r=>{
 const levelModule=await r.server.ssrLoadModule('/src/level.ts');
 const campaign=await r.server.ssrLoadModule('/src/campaign.ts');
 assert.ok(levelModule.normalizeCustomLevelData(r.source));
 assert.equal(levelModule.findLevel('tribal-run').data,r.source);
 assert.equal(campaign.campaignLevelByKey('tribal-run').levelId,'tribal-run');
 assert.ok(!r.source.chase&&!r.source.collapse&&!r.source.race);
 const tuning=JSON.stringify(r.TUNING);
 r.report={stage:'spawn',actions:[],evidence:[],phase,upper,start,sourceSha256:createHash('sha256').update(JSON.stringify(r.source)).digest('hex')};
 const station={basins:515,loom:902,stair:1405,finale:1650}[phase];
 if(station!==undefined&&!start){
  const point=r.sourceModule.tribalPoint(station,(phase==='finale'?-1:0)+.12);
  const heading=r.sourceModule.tribalTangent(station);
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(...point),heading:new r.THREE.Vector3(...heading)});
  r.report.start={station,point,heading,scope:'scenario setup before any input'};
 }
 if(process.argv.includes('--audit')){
  r.report.geometry=auditTribalGeometry(r);
  console.log(JSON.stringify({event:'geometry audit passed',...r.report.geometry,crateSeats:r.report.geometry.crateSeats.length}));
 }
 const pilot=runTribalJourney(r,{phase,upper});let next;
 try{
  while(!(next=pilot.next()).done)r.tick(next.value);
  r.report.result=next.value;r.report.seconds=r.frame*r.dt;
  assert.equal(r.p.totalDeaths,0);assert.equal(r.p.isBailing,false);
  assert.ok(r.trace.every(f=>!f.bailing&&!['dead','gameover'].includes(f.state)),'the continuous run must contain no bail or death');
  const maxStep=Math.max(...r.trace.slice(1).map((f,i)=>Math.hypot(...f.position.map((v,k)=>v-r.trace[i].position[k]))));
  assert.ok(maxStep<2.2,'continuous physics trace must not conceal a teleport');r.report.maxStep=maxStep;
  if(phase==='all')assert.equal(r.l.checkpoints.filter(c=>c.active).length,9,'all nine checkpoint boxes must be banked through inputs');
  if(phase==='all'||phase==='finale'){assert.equal(r.p.state,'finished');assert.equal(r.p.hasCrystal,true);}
  assert.equal(JSON.stringify(r.TUNING),tuning);
  console.log(JSON.stringify({pass:true,...r.report}));
 }catch(error){r.report.error=error.message;console.log(JSON.stringify(r.report));throw error;}
 finally{await writeFile(`${out}/main-${phase}${upper?'-upper':''}-native.json`,JSON.stringify({report:r.report,trace:r.trace}));}
},{modulePath:'/src/levels/tribal-run.ts',source:m=>m.TRIBAL_RUN_LEVEL,levelId:'tribal-run',start,maxFrames:45000,optimizeDeps:{noDiscovery:true,include:[]},
 onTick:(s,r)=>{if(s.frame%600===0)console.log(JSON.stringify({frame:s.frame,stage:r.report?.stage,progress:r.sourceModule.tribalProgress(r.p.pos),state:s.state}));}});
