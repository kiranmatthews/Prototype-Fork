import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runTribalBonus} from './tribal-run-bonus-pilot.mjs';
const out=process.env.TRIBAL_OUTPUT||'docs/tribal-run/greybox/evidence';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 r.report={stage:'spawn',actions:[],evidence:[]};
 const {resolveBonusLevel,bonusCrateCount}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 assert.equal(resolveBonusLevel('tribal-run'),r.source);assert.equal(bonusCrateCount('tribal-run'),52);
 assert.equal(r.l.outlinedSurfaces.length,3);assert.ok(r.l.outlinedSurfaces.every(s=>!s.active));
 assert.equal(r.l.crates.filter(c=>c.pending).length,9);
 // Committing to the visible ghost bridge before its switch loses the attempt.
 r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(59.2,6.92,0),heading:new r.THREE.Vector3(1,0,0)});r.stepFor(24);
 r.charge();r.releaseJump();
 r.until(()=>r.p.state==='dead'||r.p.totalDeaths>0,()=>r.steerToward([65,6.8,0]),{maxFrames:400,allowDeath:true,label:'unrevealed bridge costs an attempt'});
 r.report.wrongOrder={state:r.p.state,deaths:r.p.totalDeaths,position:r.p.pos.toArray()};
 r.p.respawn(r.l,true);assert.ok(r.l.outlinedSurfaces.every(s=>!s.active));assert.equal(r.l.crates.filter(c=>c.pending).length,9);
 const pilot=runTribalBonus(r);let step;
 try{while(!(step=pilot.next()).done)r.tick(step.value);r.report.result=step.value;assert.equal(r.p.state,'finished');assert.equal(r.p.cratesBroken,52);
  r.l.reset(true);assert.ok(r.l.outlinedSurfaces.every(s=>!s.active));assert.equal(r.l.crates.filter(c=>c.pending).length,9);assert.ok(r.l.crates.every(c=>c.alive));r.report.retryRestores=true;
  console.log(JSON.stringify(r.report));}
 catch(error){r.report.error=error.message;console.log(JSON.stringify(r.report));throw error;}
 finally{await writeFile(`${out}/bonus-physics.json`,JSON.stringify({report:r.report,trace:r.trace}));}
},{modulePath:'/src/levels/tribal-run-bonus.ts',source:m=>m.TRIBAL_RUN_BONUS_LEVEL,levelId:'bonus-tribal-run',controlFrame:()=>({x:0,z:-1}),maxFrames:18000,optimizeDeps:{noDiscovery:true,include:[]},
 onTick:(s,r)=>{if(s.frame%1200===0)console.log(JSON.stringify({stage:r.report?.stage,frame:s.frame,position:s.position}));}});
