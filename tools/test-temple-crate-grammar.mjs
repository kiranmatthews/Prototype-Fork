import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.TEMPLE_CRATES_OUTPUT??'/tmp/temple-crates';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source}=r,report={harvests:[],maxFloorError:0,floorErrors:[]};
 if(process.env.TEMPLE_CRATES_BASELINE){
  const before=JSON.parse(await readFile(process.env.TEMPLE_CRATES_BASELINE,'utf8'));
  assert.equal(JSON.stringify(source.components.filter(c=>c.t!=='crate')),JSON.stringify(before.components));
  assert.deepEqual(Object.fromEntries(Object.entries(source).filter(([k])=>k!=='components')),Object.fromEntries(Object.entries(before).filter(([k])=>k!=='components')));
  report.nonCratesExact=report.settingsExact=true;
 }
 assert.equal(l.crates.length,187);assert.equal(l.totalCrates,174);assert.equal(l.bonusCrateTotal,29);assert.equal(l.checkpoints.length,12);assert.equal(l.enemies.length,8);
 const route=r.sourceModule.JUNGLE_TERRACES_ROUTE,{TEMPLE_OFFERING_GROUPS}=await r.server.ssrLoadModule('/src/levels/temple-crate-arrangement.ts');
 const counts=new Map(),groups=[];
 for(const [section,s,side,count]of TEMPLE_OFFERING_GROUPS){const n=(counts.get(section)??0)+1;counts.set(section,n);groups.push({prefix:`Ember offering / section ${section} / cache ${n} /`,count,q:route.toWorld(s,route.groundAt(s),0)});}
 for(const [j,c]of route.climbs.entries())for(let i=1;i<c.steps;i+=2){const s=c.a+(i+.62)*(c.b-c.a)/c.steps,y=c.base+(c.top-c.base)*(i+1)/c.steps;groups.push({prefix:`Ember stair offering / climb ${j+1} / step ${i+1} /`,count:2,q:route.toWorld(s,y,c.side+.5)});}
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const [i,{prefix,count,q}] of groups.entries()){
  const boxes=l.crates.filter(b=>source.components[b.mesh.userData.editorIdx]?.nm?.startsWith(prefix));assert.equal(boxes.length,count);
  const authoredBase=Math.min(...boxes.map(b=>source.components[b.mesh.userData.editorIdx].p[1]));
  for(const b of boxes.filter(b=>Math.abs(source.components[b.mesh.userData.editorIdx].p[1]-authoredBase)<.01))for(const dx of [-.556,.556])for(const dz of [-.556,.556]){
   const base=b.box.min.y;
   ray.set(b.mesh.position.clone().setY(base+3).add(new THREE.Vector3(dx,0,dz)),down);ray.far=6;const h=l.raycastGround(ray)[0];assert.ok(h,prefix+' corner support');const error=Math.abs(h.point.y-base);report.maxFloorError=Math.max(report.maxFloorError,error);if(error>.01)report.floorErrors.push({prefix,name:source.components[b.mesh.userData.editorIdx]?.nm,crate:b.mesh.position.toArray(),base,corner:[dx,dz],ground:h.point.toArray(),error});
  }
  if(process.env.TEMPLE_SUPPORT_ONLY)continue;
  ray.set(new THREE.Vector3(...q).add(new THREE.Vector3(0,3,0)),down);ray.far=6;const floor=l.raycastGround(ray)[0];assert.ok(floor,prefix+' route approach');
  p.respawn(l,true,false,{position:floor.point.clone().add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(0,0,-1)});r.stepFor(20);const first=r.frame;let held=false;
  // Approach at a cautious walking pace, pausing between distinct spins.
  try{r.until(()=>boxes.every(b=>!b.alive),()=>{const target=boxes.find(b=>b.alive).mesh.position,spin=p.spinning||!held;held=spin;return{...r.steerToward(target,{pace:p.spinning?.38:0}),spinHeld:spin};},{maxFrames:1800,label:prefix});}
  catch(error){await writeFile(out+'/main-failure.json',JSON.stringify({group:i,position:p.pos.toArray(),spinTimer:p.spinTimer,spinCooldown:p.spinCd,boxes:boxes.map(b=>({name:source.components[b.mesh.userData.editorIdx]?.nm,alive:b.alive,pending:b.pending,position:b.mesh.position.toArray(),base:b.box.min.y})),tail:r.trace.slice(-50)},null,2));throw error;}
  assert.equal(p.totalDeaths,0);assert.ok(!l.runMode&&!l.timeTrial);
  report.harvests.push({name:prefix,count,frames:r.frame-first,deaths:0,fromSupportedLanding:true});
  await writeFile(out+'/main-progress.json',JSON.stringify(report,null,2));
 }
 await writeFile(out+'/support.json',JSON.stringify(report,null,2));
 assert.ok(report.maxFloorError<.04);
 if(process.env.TEMPLE_SUPPORT_ONLY){console.log('PASS supported footprints only; no harvests attempted');return;}
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));assert.ok(l.enemies.every(e=>e.alive));report.reset={crates:187,enemies:8};
 await writeFile(out+'/main.json',JSON.stringify(report,null,2));console.log('PASS all 114 revised ordinary/stair rewards through 29 separately staged approaches, supported footprints and reset');
},{modulePath:'/src/levels/jungle-sequels.ts',source:m=>m.JUNGLE_TERRACES_LEVEL,levelId:'jungle-terraces',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,maxFrames:48000});
