import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runTribalMoving} from './tribal-moving-pilot.mjs';
import {auditTribalGeometry} from './tribal-run-geometry-audit.mjs';
const first=Number(process.env.TRIBAL_FIRST??0),last=Number(process.env.TRIBAL_LAST??28);
const out='docs/tribal-moving';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,sourceModule:m}=r;
 const source=r.source;
 if(first){const s=m.TRIBAL_RUN_CROSSINGS[first].a-8;p.respawn(l,true,false,{position:new r.THREE.Vector3(...m.tribalPoint(s,m.tribalHeight(s)+.12)),heading:new r.THREE.Vector3(...m.tribalTangent(s))});}
 const phase=Number(process.env.TRIBAL_WAIT??0);for(let i=0;i<phase*60;i++)r.tick({});
 r.report={stage:'spawn',rides:[],actions:[],counts:{movers:l.movers.length,crabs:l.enemies.length,fireHeads:l.fireTikis.length,components:source.components.length}};
 if(process.argv.includes('--audit')){
  const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
  assert.ok(normalizeCustomLevelData(structuredClone(source)),'source/editor data contract');
  r.report.geometry=auditTribalGeometry(r);
  assert.equal(l.movers.length,35);assert.equal(l.enemies.length,34);assert.equal(l.fireTikis.length,8);
  for(const head of l.fireTikis){
   const s=m.tribalProgress(head.group.position),centre=new r.THREE.Vector3(...m.tribalPoint(s,m.tribalHeight(s))).sub(head.group.position).normalize();
   const direction=new r.THREE.Vector3(0,0,1).applyQuaternion(head.group.quaternion);
   assert.ok(direction.dot(centre)>.98,'carved heads face into the approach');
  }
  for(const c of source.components.filter(c=>c.t==='enemy')){
   const nearest=m.TRIBAL_RUN_CROSSINGS.reduce((d,g)=>Math.min(d,Math.abs(m.tribalProgress(new r.THREE.Vector3(...c.p))-g.a),Math.abs(m.tribalProgress(new r.THREE.Vector3(...c.p))-g.b)),Infinity);
   assert.ok(nearest>7,'landing approaches remain clear of patrol centres');
  }
  const {dressTribalCrab}=await r.server.ssrLoadModule('/src/enemies/tribalCrabDress.ts');
  const nodes=[new r.THREE.Group(),new r.THREE.Group(),new r.THREE.Group()],dress=dressTribalCrab(...nodes);
  assert.ok(dress.triangles<500,'manually assembled simple costume stays small');
  assert.ok(nodes.every(n=>n.children.length===1));dress.dispose();assert.ok(nodes.every(n=>n.children.length===0));
  r.report.costumeTriangles=dress.triangles;
  console.log(JSON.stringify({event:'geometry passed',probes:r.report.geometry.supportProbes,gaps:r.report.geometry.openGaps,costumeTriangles:dress.triangles}));
 }
 if(process.argv.includes('--audit-only')){await writeFile(`${out}/geometry.json`,JSON.stringify(r.report,null,2)+'\n');return;}
 console.log(JSON.stringify({event:'loaded',...r.report.counts}));
 const tuning=JSON.stringify(r.TUNING),pilot=runTribalMoving(r,{first,last,finish:last===28});let next;
 try{
  while(!(next=pilot.next()).done)r.tick(next.value);
  r.report.result=next.value;
  assert.equal(p.totalDeaths,0);assert.equal(JSON.stringify(r.TUNING),tuning);
  r.report.maxFrameTravel=r.trace.slice(1).reduce((max,f,i)=>Math.max(max,Math.hypot(...f.position.map((v,k)=>v-r.trace[i].position[k]))),0);
  assert.ok(r.report.maxFrameTravel<2.2,'continuous physics cannot conceal a teleport');
  assert.equal(r.report.rides.length,m.TRIBAL_RUN_CROSSINGS.slice(first,last+1).reduce((n,c)=>n+c.movers.length,0));
  if(first===0&&last===28){assert.equal(p.state,'finished');assert.equal(p.hasCrystal,true);assert.equal(l.checkpoints.filter(c=>c.active).length,9);}
  r.report.pass=true;console.log(JSON.stringify({pass:true,result:r.report.result,counts:r.report.counts,rides:r.report.rides.length,maxFrameTravel:r.report.maxFrameTravel}));
 }catch(e){r.report.error=e.message;console.log(JSON.stringify({stage:r.report.stage,error:e.message}));throw e;}
 finally{await writeFile(`${out}/native-${first}-${last}.json`,JSON.stringify(r.report,null,2)+'\n');await writeFile('/private/tmp/tribal-moving-trace.json',JSON.stringify(r.trace));}
},{modulePath:'/src/levels/tribal-run.ts',source:m=>m.TRIBAL_RUN_LEVEL,levelId:'tribal-run',maxFrames:65000,optimizeDeps:{noDiscovery:true,include:[]},
 onTick:(s,r)=>{if(s.frame%600===0)console.log(JSON.stringify({frame:s.frame,stage:r.report?.stage,s:r.sourceModule.tribalProgress(r.p.pos),state:s.state,mover:s.mover}));}});
