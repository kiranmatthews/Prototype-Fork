import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
import {runSkateTrial} from './crystal-skate-pilot.mjs';
const ids=(process.argv[2]??Array.from({length:25},(_,i)=>i+1).join(',')).split(',').map(Number);
const out=process.env.CRYSTAL_SKATE_OUT??'/workspace/crystal-sequences';await mkdir(out,{recursive:true});
let failed=0;
await withBlockworksRuntime(async base=>{
 const m=base.sourceModule,{normalizeCustomLevelData}=await base.server.ssrLoadModule('/src/level.ts');
 const baseline=JSON.stringify(base.TUNING);
 for(const id of ids){
  const trial=m.CRYSTAL_TRIALS.find(t=>t.id===id),source=m.trialLevel(trial),report={id,passed:false,actions:[],evidence:[],phaseDelay:Number(process.argv[3]??0),sourceHash:createHash('sha256').update(JSON.stringify(source)).digest('hex')};
  assert.ok(normalizeCustomLevelData(source));
  const scene=new base.THREE.Scene(),l=new base.Level(scene,{id:`skate-${id}`,name:source.name,data:source});l.update(0);scene.updateMatrixWorld(true);
  const p=new base.Player(scene);p.enterLevel(`skate-${id}`);p.respawn(l,true);p.endlessDeaths=true;
  const trace=[];let frame=0,last={};
  const movingRailPop=Number(process.argv[4]??-89);
  if(trial.skateSections?.some(section=>section.kind===18))report.movingRailPop=movingRailPop;
  const r={p,l,trial,source,report,movingRailPop,phaseWait:Math.round(report.phaseDelay*60),get frame(){return frame;}};
  try{
   for(const sample of runSkateTrial(r,id)){
    const input=normalizeGameInput(sample,last);last={...input};p.step(1/60,input,l);l.update(1/60);p.flushLevelCrateRewards(l);p.commitRenderStep(l);frame++;
    trace.push({frame,p:p.pos.toArray(),heading:p.axisF.toArray(),speed:p.speed,vy:p.vVel,state:p.state,skate:p.freeSkate,grounded:p.grounded,rail:p.grindRail?l.rails.indexOf(p.grindRail):null,collected:l.skateCollectathon.collected,input:sample});
    input.consumeEdges();
   }
   assert.equal(p.state,'finished');assert.equal(l.skateCollectathon.collected,1);assert.equal(p.totalDeaths,0);
   assert.equal(JSON.stringify(base.TUNING),baseline);
   const line=trace.filter(q=>q.p[2]<25&&q.state!=='finished');
   assert.ok(line.every(q=>q.skate),'Skating route became a walking route');
   const speeds=line.map(q=>Math.abs(q.speed)).sort((a,b)=>a-b);
   report.metrics={sections:trial.skateSections?.length??1,skillActions:(report.sections??[report]).flatMap(s=>s.evidence).length,frames:frame,seconds:frame/60,minimumSpeed:speeds[0],medianSpeed:speeds[Math.floor(speeds.length/2)],boardFraction:1,deaths:p.totalDeaths,crystals:l.skateCollectathon.collected};
   if(id!==5)assert.ok(speeds[0]>10,`Line stopped: ${speeds[0]} m/s`);
   l.reset(false);assert.equal(l.skateCollectathon.collected,1);l.reset(true);assert.equal(l.skateCollectathon.collected,0);
   report.passed=true;
  }catch(e){report.failure=String(e);report.atFailure={p:p.pos.toArray(),speed:p.speed,state:p.state,skate:p.freeSkate};failed++;}
  await writeFile(`${out}/${String(id).padStart(2,'0')}-native.json`,JSON.stringify(report,null,2)+'\n');
  await writeFile(`${out}/${String(id).padStart(2,'0')}-trace.json`,JSON.stringify(trace)+'\n');
  console.log(JSON.stringify({id,passed:report.passed,metrics:report.metrics,failure:report.failure}));
  l.dispose();p.group.removeFromParent();
 }
},{modulePath:'/src/levels/crystal-trials.ts',source:m=>m.trialLevel(m.CRYSTAL_TRIALS[0]),controlFrame:()=>({x:0,z:-1})});
if(failed)process.exitCode=1;
