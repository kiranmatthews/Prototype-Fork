import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withAfterHoursRuntime} from './nightworks-runner.mjs';
import {createAfterHoursPilot} from './nightworks-pilot.mjs';
await withAfterHoursRuntime(async r=>{
 const {p,l,source,trace,THREE}=r,pilot=createAfterHoursPilot(source),before=JSON.stringify(r.TUNING);
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(source.NIGHTWORKS_AFTER_HOURS_LEVEL))));
 assert.equal(source.NIGHTWORKS_AFTER_HOURS_LEVEL.components.filter(c=>c.t==='gate').length,1);assert.equal(l.checkpoints.length,3);assert.equal(l.enemies.length,6);
 assert.ok(l.nightworksRocks);assert.ok(l.laneActive);assert.ok(!source.NIGHTWORKS_AFTER_HOURS_LEVEL.components.some(c=>['mover','phasepad','ropeswing'].includes(c.t)));
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floor=(x,z,y=80)=>{ray.set(new THREE.Vector3(x,y,z),down);return ray.intersectObjects(l.groundMeshes,false)[0];};
 assert.ok(Math.abs(floor(0,11).point.y-24)<1e-5);
 for(const cp of source.AFTER_HOURS_CHECKPOINTS)assert.ok(Math.abs(floor(cp[0],cp[2]).point.y-cp[1])<.05,'supported checkpoint');
 for(const gap of source.AFTER_HOURS_GAPS)assert.equal(floor(0,(gap.takeoff[2]+gap.landing[2])/2),undefined,'actual void between islands');
 for(let i=0;i<7500&&p.state!=='finished';i++){
  r.tick(pilot.sample(p,l));pilot.observe(p,l);
  if(p.isBailing||['dead','gameover'].includes(p.state))break;
 }
 if(process.env.AFTER_HOURS_TRACE)await writeFile(process.env.AFTER_HOURS_TRACE,JSON.stringify({evidence:pilot.evidence,end:r.snapshot(),trace}));
 assert.equal(p.state,'finished',JSON.stringify({e:pilot.evidence,s:r.snapshot()}));
 assert.equal(p.totalDeaths,0);assert.ok(!p.isBailing);assert.equal(pilot.evidence.footFrames,0,'stay mounted from push-off to gate');
 assert.equal(pilot.evidence.gaps.length,3);
 for(const jump of pilot.evidence.gaps){assert.ok(jump.end[2]<=source.AFTER_HOURS_GAPS[jump.index].landing[2]+1);assert.ok(jump.peak>jump.start[1]+2);}
 assert.deepEqual(pilot.evidence.checkpoints,[0,1,2]);assert.equal(JSON.stringify(r.TUNING),before);
 console.log(`PASS After Hours: ${(trace.length*r.CONST.fixedStep).toFixed(2)} seconds, all three ollies/checkpoints, continuously mounted, no bails/deaths.`);
});

// The optional ridges really ferry a mounted rider over void, and the last
// one reaches the elevated collectible. Placement is only before each run.
for(const [name,start,release,end]of [
 ['freight',[-8,12.1,-83],-101,-163],
 ['moon',[-8,12.1,-320],-338,-423],
 ['crystal',[9,24.1,-531],-542,-598],
])await withAfterHoursRuntime(r=>{
 let launched=false,grind=0,mounted=false,foot=0;
 for(let i=0;i<1500&&r.p.pos.z>end;i++){
  let jumpHeld=true;if(!launched&&r.p.pos.z<=release&&r.p.grounded){jumpHeld=false;launched=true;}
  const sample={...r.directionInput([0,0,-1]),jumpHeld,grindHeld:true};
  if(r.p.state==='grind')sample.moveX=-r.p.balance*.9;
  r.tick(sample);grind+=r.p.state==='grind';mounted||=r.p.boardRolling;
  if(mounted&&!r.p.boardRolling&&r.p.state!=='grind'&&r.p.state!=='air')foot++;
  assert.ok(!r.p.isBailing&&!['dead','gameover'].includes(r.p.state),`${name}: ${JSON.stringify(r.snapshot())}`);
 }
 assert.ok(r.p.pos.z<=end&&grind>100,`${name} must enter and traverse the real ridge`);assert.equal(foot,0);
 if(name==='crystal')assert.ok(r.p.hasCrystal&&r.l.crystalPickup.collected);
 console.log(`PASS ${name} ridge: ${grind} actual grind frames, mounted exit${name==='crystal'?', crystal collected':''}.`);
},{start});

await withAfterHoursRuntime(r=>{
 const pilot=createAfterHoursPilot(r.source);let banked=false,dead=false,recovered=false;
 for(let i=0;i<3000;i++){
  if(!banked){r.tick(pilot.sample(r.p,r.l));banked=r.l.checkpoints[0].active;}
  else if(!dead){r.tick({...r.directionInput([1,0,0]),jumpHeld:true});dead=r.p.state==='dead';}
  else {r.tick({});if(r.p.state==='ride'&&r.p.grounded){recovered=true;break;}}
 }
 assert.ok(banked&&dead&&recovered,'actual gap-side fall must die and respawn at the banked checkpoint');
 assert.equal(r.l.activeCheckpoint,r.l.checkpoints[0]);assert.ok(r.p.pos.distanceTo(r.l.checkpoints[0].spawnPos)<.2);
 console.log('PASS true-void fall, death and checkpoint respawn.');
});

await withAfterHoursRuntime(async r=>{
 const {normalizeCustomLevelData,worldMapComponentPoints}=await r.server.ssrLoadModule('/src/level.ts');
 const {validateCampaignMapGraph}=await r.server.ssrLoadModule('/src/campaign.ts');
 assert.deepEqual(validateCampaignMapGraph(),[]);
 const old=worldMapComponentPoints().slice(0,-1),map=pts=>({v:1,name:'Saved map',spawn:[0,.1,0],killY:-30,components:[{t:'worldmap',p:[0,0,0],pts}]});
 assert.equal(normalizeCustomLevelData(map(old)).components.find(c=>c.t==='worldmap').pts.length,worldMapComponentPoints().length);
 old[0][0]+=.25;const custom=normalizeCustomLevelData(map(old));assert.ok(custom);
 assert.deepEqual(custom.components.find(c=>c.t==='worldmap').pts,old,'custom saved hub coordinates remain unchanged');
 console.log('PASS prior map migration, custom coordinate preservation and sequel graph.');
});
