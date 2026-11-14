import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.CARLISLE_CRATE_OUTPUT||'/tmp/carlisle-crates',report={harvests:[],maxFloorError:0};
await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {l,p,THREE,source}=r;
 assert.equal(l.crates.length,419);assert.equal(l.totalCrates,376);assert.equal(l.bonusCrateTotal,21);assert.equal(l.enemies.length,0);assert.equal(l.crates.filter(c=>c.mask).length,4);
 const before=await readFile(process.env.CARLISLE_CRATE_BASELINE||out+'/before-main.json','utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT'&&!process.env.CARLISLE_CRATE_BASELINE)return null;throw e;});
 if(before){
 assert.deepEqual(source.components.filter(c=>c.t!=='crate'),before.components.filter(c=>c.t!=='crate'));
 const settings=d=>Object.fromEntries(Object.entries(d).filter(([k])=>k!=='components'));
 assert.deepEqual(settings(source),settings(before));
 const remaining=source.components.filter(c=>c.t==='crate').map(c=>JSON.stringify(c));
 for(const c of before.components.filter(c=>c.t==='crate')){const i=remaining.indexOf(JSON.stringify(c));assert.ok(i>=0,'preserved original crate '+c.nm);remaining.splice(i,1);}
 report.preservation={nonCrates:before.components.filter(c=>c.t!=='crate').length,originalCrates:384,addedCrates:35,settingsExact:true};
 }
 const names=[['Shore starter parcel',10],['Scissor hub stair',12],['Winch transfer bundle',10],['Pinwheel quay stores',10],['Counterweight cargo steps',18],['Scissors departure stores',10],['Helical quay stores',10],['Rigging launch parcels',10],['Home harbour cargo fan',14]];
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const [name,count] of names){
  const boxes=l.crates.filter(b=>source.components[b.mesh.userData.editorIdx].nm?.startsWith(name+' ·'));
  assert.equal(boxes.length,count,name);
  const y=Math.min(...boxes.map(b=>b.box.min.y));
  for(const b of boxes.filter(b=>Math.abs(b.box.min.y-y)<.01))for(const x of [b.box.min.x+.02,b.box.max.x-.02])for(const z of [b.box.min.z+.02,b.box.max.z-.02]){
   ray.set(new THREE.Vector3(x,y+1,z),down);ray.far=3;const hit=l.raycastGround(ray)[0];assert.ok(hit,'supported footprint '+name);
   const diff=Math.abs(hit.point.y-y);assert.ok(diff<.1,'floor height '+name);report.maxFloorError=Math.max(report.maxFloorError,diff);
  }
  const x=boxes.reduce((n,b)=>n+b.mesh.position.x,0)/boxes.length,z=Math.max(...boxes.map(b=>b.box.max.z))+1.5;
  ray.set(new THREE.Vector3(x,y+1,z),down);ray.far=3;const hit=l.raycastGround(ray)[0];assert.ok(hit,'approach '+name);
  p.respawn(l,true,false,{position:hit.point.clone().add(new THREE.Vector3(0,.08,0)),heading:new THREE.Vector3(0,0,-1)});
  r.stepFor(15);
  r.until(()=>boxes.every(b=>!b.alive),()=>({...r.steerToward(boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0].mesh.position,{pace:.22}),spinHeld:r.frame%24<12}),{maxFrames:900,label:name});
  assert.equal(p.totalDeaths,0);report.harvests.push({name,count:boxes.length,masks:boxes.filter(b=>b.mask).length,deaths:p.totalDeaths});
 }
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));report.fullReset=true;
 report.inventory={physical:l.crates.length,counted:l.crates.filter(b=>!b.metal&&!b.bang&&!b.nitroBang).length,gemTally:l.totalCrates,checkpoints:l.checkpoints.length,bonus:l.bonusCrateTotal,enemies:l.enemies.length,masks:l.crates.filter(b=>b.mask).length};
 await writeFile(out+'/after-main.json',JSON.stringify(source));
},{modulePath:'/src/levels/carlisle-tidal-relay.ts',levelId:'carlisle-coast',source:m=>m.CARLISLE_TIDAL_RELAY_LEVEL,allowCheckpointTrips:true});
await writeFile(out+'/grammar.json',JSON.stringify(report,null,2)+'\n');console.log('PASS all nine quay harvests (104 crates), supported footprints and full reset (baseline preservation when supplied)');
