import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runRumblewaterBonus} from './rumblewater-bonus-pilot.mjs';
const output=process.env.RIPCORD_OUTPUT||'/tmp/ripcord-crate-review';await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {resolveBonusLevel,bonusCrateCount}=await r.server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 r.source=r.sourceModule.RUMBLEWATER_BONUS_LEVEL;r.report={actions:[],evidence:[]};
 assert.ok(normalizeCustomLevelData(r.source));assert.equal(resolveBonusLevel('rumblewater-run'),r.source);assert.equal(bonusCrateCount('rumblewater-run'),r.l.totalCrates);
 const pilot=runRumblewaterBonus(r);
 try{let step;while(!(step=pilot.next()).done)r.tick(step.value);r.report.result=step.value;
  assert.equal(r.p.totalDeaths,0);assert.equal(r.p.cratesBroken,r.l.totalCrates);
  const outlines=r.l.crates.filter(c=>c.wasOutline);
  assert.ok(outlines.length&&outlines.every(c=>!c.pending&&!c.alive),'journey reveals and harvests every island reward');
  r.l.reset(true);r.l.update(0);
  assert.ok(r.l.crates.every(c=>c.alive),'retry restores every consumed crate');
  assert.ok(r.l.crates.filter(c=>c.wasOutline).every(c=>c.pending),'retry re-ghosts the island rewards');
  const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
  for(const x of [41,45.5,50]){ray.set(new r.THREE.Vector3(x,1.3,0),down);ray.far=.2;assert.ok(r.l.raycastGround(ray).length,'permanent island remains supported on retry');}
  r.report.retryRestoration={crates:true,outlineRewards:true,permanentIslandSupport:true};console.log(JSON.stringify(r.report));}
 catch(error){console.log(JSON.stringify({error:error.message,report:r.report,last:r.snapshot()}));throw error;}
 finally{await writeFile(output+'/bonus-journey.json',JSON.stringify({report:r.report,trace:r.trace}));}
},{modulePath:'/src/levels/rumblewater-bonus.ts',levelId:'bonus-rumblewater-run',source:m=>m.RUMBLEWATER_BONUS_LEVEL,controlFrame:()=>({x:0,z:-1}),maxFrames:12000});
