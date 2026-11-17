import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const out=process.env.HOLLOWWAKE_CRATE_OUTPUT||'/tmp/hollowwake-crates';await mkdir(out,{recursive:true});
const report={harvests:[],maxFloorDifference:0};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),groups=new Map();
 assert.equal(l.crates.length,66);assert.equal(l.totalCrates,89);assert.equal(l.bonusCrateTotal,24);assert.equal(l.enemies.length,17);
 for(const box of l.crates){if(box.metal)continue;const name=r.source.components[box.mesh.userData.editorIdx].nm.replace(/ \/ \d+$/,'');if(!groups.has(name))groups.set(name,[]);groups.get(name).push(box);}
 for(const [name,boxes]of groups){
  const x=boxes[0].mesh.position.x,z=boxes[0].mesh.position.z,y=Math.min(...boxes.map(b=>b.box.min.y)),s=m.hollowProgress([x,y,z]);
  for(const dx of [-.576,.576])for(const dz of [-.576,.576]){
   ray.set(new THREE.Vector3(x+dx,y+1,z+dz),down);ray.far=2;const hit=l.raycastGround(ray)[0];assert.ok(hit,'continuous curved floor '+name);
   const error=Math.abs(hit.point.y-y);report.maxFloorDifference=Math.max(report.maxFloorDifference,error);assert.ok(error<.45,'round-floor footprint '+name);
  }
  const q=m.hollowPoint(s-1.8);ray.set(new THREE.Vector3(q[0],q[1]+2,q[2]),down);ray.far=4;const hit=l.raycastGround(ray)[0];assert.ok(hit,'supported approach '+name);
  p.respawn(l,true,false,{position:hit.point.clone().add(new THREE.Vector3(0,.08,0)),heading:new THREE.Vector3(...m.hollowTangent(s))});r.stepFor(20);
  r.until(()=>boxes.every(b=>!b.alive),()=>({...r.steerToward(boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0].mesh.position,{pace:.25}),spinHeld:r.frame%24<12}),{maxFrames:900,label:name});
  assert.equal(p.totalDeaths,0);report.harvests.push({name,count:boxes.length,station:s,deaths:p.totalDeaths});console.log('HARVEST',name,boxes.length);
 }
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));report.fullResetRestores=true;
 const after=JSON.parse(JSON.stringify(r.source));
 // A captured pre-edit source adds exact preservation checks to the reusable
 // harvest test. Gameplay checks can also run without that workspace artifact.
 const beforePath=process.env.HOLLOWWAKE_BASELINE||out+'/before.json';
 const before=await readFile(beforePath,'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT'&&!process.env.HOLLOWWAKE_BASELINE)return null;throw error;});
 if(before){
  assert.deepEqual(after.components.filter(c=>c.t!=='crate'),before.components.filter(c=>c.t!=='crate'));
  assert.deepEqual(after.components.filter(c=>c.t==='crate'&&c.kind==='metal'),before.components.filter(c=>c.t==='crate'&&c.kind==='metal'));
  const config=d=>Object.fromEntries(Object.entries(d).filter(([k])=>!['components','groups','crateLayoutRevision'].includes(k)));assert.deepEqual(config(after),config(before));
  report.preservation={nonCrateComponents:before.components.filter(c=>c.t!=='crate').length,steel:6,enemies:17,settingsExact:true};
 }
 await writeFile(out+'/after.json',JSON.stringify(after));
},{modulePath:'/src/levels/hollowwake-descent.ts',levelId:'hollowwake-descent',source:m=>m.HOLLOWWAKE_LEVEL,allowCheckpointTrips:true});
assert.equal(report.harvests.length,18);assert.equal(report.harvests.reduce((n,r)=>n+r.count,0),60);
await writeFile(out+'/grammar.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS eighteen protected cargo harvests, sixty counted crates, full reset'+(report.preservation?', and exact non-crate preservation':''));
