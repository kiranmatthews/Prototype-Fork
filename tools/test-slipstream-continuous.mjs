import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { withBlockworksRuntime } from './blockworks-runner.mjs';
import { createContinuousPilot } from './slipstream-continuous-pilot.mjs';
await withBlockworksRuntime(async r => {
  const { p,l } = r;
  const reservoir = await r.server.ssrLoadModule('/src/levels/slipstream-2.ts');
  const registry = await r.server.ssrLoadModule('/src/level.ts');
  const campaign = await r.server.ssrLoadModule('/src/campaign.ts');
  assert.ok(registry.normalizeCustomLevelData(r.source));
  assert.deepEqual(campaign.validateCampaignMapGraph(), []);
  assert.equal(campaign.CAMPAIGN_LEVELS.filter(c => ['slip','slipstream-2','astra-chimeworks'].includes(c.levelId)).length,1);
  const pack = JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
  assert.deepEqual(pack.levels.find(e=>e.id==='slip').data,JSON.parse(JSON.stringify(r.source)));
  assert.ok(!pack.levels.some(e=>['slipstream-2','astra-chimeworks'].includes(e.id)));
  for(const type of ['gate','clock','crystal']) assert.equal(r.source.components.filter(c=>c.t===type).length,1,type);
  assert.equal(r.source.components.filter(c=>c.t==='mover').length,3,'Only the Chimeworks sliding keys remain');
  const support=[];
  const ray = new r.THREE.Raycaster(); l.root.updateMatrixWorld(true);
  const probes=[r.source.spawn,...r.source.components.filter(c=>['checkpoint','gate'].includes(c.t)).map(c=>c.p)];
  for(const c of r.sourceModule.SLIPSTREAM_CONNECTIONS) for(let i=0;i<=40;i++) {
    const t=i/40; probes.push(c.a.map((n,j)=>n+(c.b[j]-n)*t));
  }
  for(const q of probes) {
    ray.set(p.pos.clone().fromArray(q).add(p.pos.clone().set(0,2,0)),p.pos.clone().set(0,-1,0));
    ray.near=0;ray.far=4;
    const hit=ray.intersectObjects(l.groundMeshes.filter(m=>!m.userData.finishPad && !m.userData.startWarpPad),false)[0];
    assert.ok(hit && Math.abs(hit.point.y-q[1])<.4,'Missing support at '+q+' actual '+hit?.point.y+' '+hit?.object.name+' '+JSON.stringify(hit?.object.userData, (k,v)=>['mesh','geometry','material'].includes(k)?undefined:v));
    support.push({p:q,y:hit.point.y});
  }
  const pilot = createContinuousPilot(r.sourceModule,reservoir,{nodeCamera:true,highRoute:process.argv.includes('--high-route')});
  const tuning=JSON.stringify(r.TUNING),errors=[];
  try { while(p.state!=='finished') { r.tick(pilot.sample(p,l));pilot.observe(p,l);if(process.argv.includes('--trace')&&p.pos.z < -1180&&p.pos.z > -1290&&r.frame%20===0)console.log(JSON.stringify({f:r.frame,p:p.pos.toArray(),state:p.state,rail:!!p.grindRail,ground:p.groundHit?.y,input:r.lastInput})); } } catch(e) {errors.push(String(e));}
  const report={frames:r.frame,seconds:r.frame*r.dt,position:p.pos.toArray(),state:p.state,deaths:p.totalDeaths,
    supportProbes:support.length,evidence:pilot.evidence,errors,traceTail:r.trace.slice(-90)};
  await writeFile('/private/tmp/slipstream-continuous-native.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,traceTail:undefined,evidence:{...report.evidence,footLandings:report.evidence.footLandings.length}},null,2));
  assert.deepEqual(errors,[]);assert.equal(p.totalDeaths,0);assert.equal(p.state,'finished');
  assert.equal(JSON.stringify(r.TUNING),tuning);
  if(!process.argv.includes('--keys')&&!process.argv.includes('--reservoir'))assert.equal(pilot.evidence.checkpoints.length,l.checkpoints.length);
  assert.equal(pilot.evidence.footLandings.length,12);
  if(!process.argv.includes('--keys'))assert.equal(pilot.evidence.reservoir.jumps.length,process.argv.includes('--reservoir')?2:3);
  if(process.argv.includes('--high-route')) { assert.ok(pilot.evidence.reservoir.highRailFrames>100);assert.equal(pilot.evidence.reservoir.crystal,true); }
}, {modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slip',endlessDeaths:true,maxFrames:25000,start:process.argv.includes('--keys')?[16,38.1,-2148]:process.argv.includes('--reservoir')?[58,109.9,-1140]:undefined,
  controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
