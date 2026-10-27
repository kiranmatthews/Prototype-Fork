import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {withBananaBay} from './banana-bay-runtime.mjs';
import {runSwitchyardJourney} from './puzzle-switchyard-pilot.mjs';

const out=process.env.BANANA_BAY_OUTPUT||resolve('docs/banana-bay/evidence');await mkdir(out,{recursive:true});
const results=[];
await withBananaBay(async r=>{
  const {l,p,source:d,THREE}=r;
  for(let n=0;n<30;n++)r.tick();
  assert.ok(p.grounded,'native beach spawn supported');
  assert.ok(r.normalizeCustomLevelData(d),'source overlay fits editor contract');
  const captured=l.captureData();assert.ok(r.normalizeCustomLevelData(captured),'complete native sand/ocean capture fits editor contract');
  assert.equal(d.components.filter(c=>c.t==='gate').length,1);
  assert.equal(d.components.filter(c=>c.t==='crystal').length,1);
  assert.equal(l.enemies.length,15);assert.equal(l.checkpoints.length,14);
  assert.ok(d.components.find(c=>c.t==='gate').p[2]<-1380,'new finale extends the course');
  const camera=d.components.filter(c=>c.t==='camnode');
  for(let i=1;i<camera.length;i++)assert.ok(camera[i].p[2]<camera[i-1].p[2],`ordered camera node ${i}`);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,10);
  const errors=[];let supports=0;
  for(const box of l.crates){
    if(box.pending)continue;
    ray.ray.origin.copy(box.mesh.position).setY(box.box.min.y+.05);ray.far=.2;
    const supported=l.raycastGround(ray).length||l.crates.some(other=>other!==box&&other.alive&&
      Math.abs(other.box.max.y-box.box.min.y)<.08&&Math.abs(other.mesh.position.x-box.mesh.position.x)<.1&&Math.abs(other.mesh.position.z-box.mesh.position.z)<.1);
    const deliberateHigh=d.components.some(c=>c.t==='crate'&&c.nm?.includes('high parcel before')&&Math.hypot(c.p[0]-box.mesh.position.x,c.p[2]-box.mesh.position.z)<.1);
    if(!supported&&!deliberateHigh)errors.push({p:box.mesh.position.toArray(),bottom:box.box.min.y});else supports++;
  }
  assert.deepEqual(errors,[],'every cargo crate has a surface, stack, or documented launcher dependency');
  for(const cp of l.checkpoints){
    ray.ray.origin.copy(cp.mesh.position).setY(cp.box.min.y+10);ray.far=20;
    const top=l.raycastGround(ray)[0]?.point.y;
    assert.ok(Number.isFinite(top)&&Math.abs(top-cp.box.min.y)<.16,`checkpoint clear of higher deck geometry: ${cp.spawnPos.toArray()} vs ${top}`);
  }
  let shoreProbes=0;
  for(const shelf of d.components.filter(c=>c.t==='platform'&&c.shoreProfile&&c.grp===74))for(const side of [-1,1]){
    ray.ray.origin.set(shelf.p[0]+side*shelf.s[0]*.3,10,shelf.p[2]);ray.far=20;
    const hit=l.raycastGround(ray)[0];
    assert.ok(hit&&hit.point.y>.2,`${shelf.nm}: visible, supported sand beside the pier`);shoreProbes++;
  }
  const ferry=l.movers.find(m=>m.mesh.userData.carlisleTimberDressed);
  assert.ok(ferry?.mesh.children.some(c=>c.userData.timberRaft),'ferry has the existing complete timber raft skin');
  let patrolSamples=0;
  for(let n=0;n<600;n++){
    l.update(r.dt);if(n%10)continue;
    for(const e of l.enemies){
      ray.ray.origin.copy(e.group.position).setY(e.baseY+.1);ray.far=.3;
      const hit=l.raycastGround(ray)[0];assert.ok(hit,`unsupported patrol ${e.homePosition.toArray()}`);patrolSamples++;
    }
  }
  assert.ok(captured.ocean.shore.at(-1)[1]<-1470,'sea continues beyond finish');
  results.push({test:'native main structure',crates:l.crates.length,checkpoints:l.checkpoints.length,enemies:l.enemies.length,supports,patrolSamples,shoreProbes,spawn:p.pos.toArray(),finish:d.components.find(c=>c.t==='gate').p});
  if(process.env.BANANA_BAY_CAPTURE_NATIVE)await writeFile(out+'/main-native-capture.json',JSON.stringify(captured));
});
await withBananaBay(async r=>{
  const {BAY_ATMOSPHERE}=await r.server.ssrLoadModule('/src/levels/banana-bay-theme.ts');
  assert.deepEqual(r.source.atmosphere,BAY_ATMOSPHERE);
  assert.equal(r.source.ocean.look,'sunny-beach');assert.ok(r.l.water);
  assert.ok(r.source.components.filter(c=>c.t==='woodpath').length>=10);
  for(const kind of ['sunnycliff','sunnyhibiscus','baytrunk','baycrown','bayvine','jungleleaf'])
    assert.ok(r.source.components.some(c=>c.dkind===kind),`shared asset ${kind}`);
  const gen=runSwitchyardJourney(r);
  try{let step;while(!(step=gen.next()).done)r.tick(step.value);
    assert.equal(r.p.state,'finished');assert.equal(r.p.totalDeaths,0);assert.equal(r.p.cratesBroken,r.l.totalCrates);
    results.push({test:'bonus continuous input-only all-crate journey',...step.value,frames:r.frame,seconds:r.frame*r.dt,actions:r.report.actions,evidence:r.report.evidence});
  }finally{await writeFile(out+'/bonus-trace.json',JSON.stringify({report:r.report,trace:r.trace}));}
},{bonus:true});
await writeFile(out+'/physics.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(({actions,evidence,...rest})=>rest),null,2));
console.log('PASS Banana Bay source/capture, cargo support, enemy patrols, shared art and complete bonus puzzle.');
