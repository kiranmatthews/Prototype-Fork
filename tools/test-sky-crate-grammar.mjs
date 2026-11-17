import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.SKY_CRATES_OUTPUT??'/tmp/sky-crates';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source}=r,report={harvests:[],maxFloorError:0};
 if(process.env.SKY_CRATES_BASELINE){
  const before=JSON.parse(await readFile(process.env.SKY_CRATES_BASELINE,'utf8'));
  assert.equal(JSON.stringify(source.components.filter(c=>c.t!=='crate')),JSON.stringify(before.components));
  assert.deepEqual(Object.fromEntries(Object.entries(source).filter(([k])=>k!=='components')),Object.fromEntries(Object.entries(before).filter(([k])=>k!=='components')));
  report.nonCratesExact=report.settingsExact=true;
 }
 assert.equal(l.crates.length,89);assert.equal(l.totalCrates,117);assert.equal(l.bonusCrateTotal,22);assert.equal(l.checkpoints.length,7);assert.equal(l.enemies.length,4);
 const approaches=[5,-38,-71.5,-71.5,-140,-172.5,-233,-234,-239.5,-305.5,-312.5,-373,-381,-381,-438,-479].map(z=>[0,0,z]);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const [i,q] of approaches.entries()){
  const prefix=`Sky supply / section ${Math.floor(i/2)+1} / cache ${i%2+1} /`,boxes=l.crates.filter(b=>source.components[b.mesh.userData.editorIdx]?.nm?.startsWith(prefix));assert.equal(boxes.length,5);
  const base=Math.min(...boxes.map(b=>b.box.min.y));
  for(const b of boxes.filter(b=>Math.abs(b.box.min.y-base)<.01))for(const dx of [-.556,.556])for(const dz of [-.556,.556]){
   ray.set(b.mesh.position.clone().setY(base+3).add(new THREE.Vector3(dx,0,dz)),down);ray.far=6;const h=l.raycastGround(ray)[0];assert.ok(h,prefix+' corner support');report.maxFloorError=Math.max(report.maxFloorError,Math.abs(h.point.y-base));
  }
  ray.set(new THREE.Vector3(...q).add(new THREE.Vector3(0,3,0)),down);ray.far=6;const floor=l.raycastGround(ray)[0];assert.ok(floor,prefix+' route approach');
  p.respawn(l,true,false,{position:floor.point.clone().add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(0,0,-1)});r.stepFor(20);const first=r.frame;let held=false;
  // Approach at a cautious walking pace, pausing between distinct spins.
  try{r.until(()=>boxes.every(b=>!b.alive),()=>{const target=boxes.find(b=>b.alive).mesh.position,spin=p.spinning||!held;held=spin;return{...r.steerToward(target,{pace:p.spinning?.38:0}),spinHeld:spin};},{maxFrames:1800,label:prefix});}
  catch(error){await writeFile(out+'/main-failure.json',JSON.stringify({group:i,position:p.pos.toArray(),spinTimer:p.spinTimer,spinCooldown:p.spinCd,boxes:boxes.map(b=>({name:source.components[b.mesh.userData.editorIdx]?.nm,alive:b.alive,pending:b.pending,position:b.mesh.position.toArray(),base:b.box.min.y})),tail:r.trace.slice(-50)},null,2));throw error;}
  assert.equal(p.totalDeaths,0);assert.ok(!l.runMode&&!l.timeTrial);
  report.harvests.push({name:prefix,count:5,frames:r.frame-first,deaths:0,fromSupportedLanding:true});
  await writeFile(out+'/main-progress.json',JSON.stringify(report,null,2));
 }
 assert.ok(report.maxFloorError<.04);p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));assert.ok(l.enemies.every(e=>e.alive));report.reset={crates:89,enemies:4};
 await writeFile(out+'/main.json',JSON.stringify(report,null,2));console.log('PASS all 80 ordinary rewards through 16 separately staged route approaches, supported footprints and reset');
},{modulePath:'/src/levels/sky-bridge.ts',source:m=>m.SKY_BRIDGE_LEVEL,levelId:'sky',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,maxFrames:48000});
