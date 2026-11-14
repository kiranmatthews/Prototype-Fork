import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runEasyBonus} from './easy-bonus-pilot.mjs';

const out=process.env.GHOST_CRATE_OUTPUT||'/tmp/ghost-crates';await mkdir(out,{recursive:true});
const report={harvests:[]};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),groups=new Map();
 assert.equal(l.crates.length,225);assert.equal(l.enemies.length,15);assert.equal(l.checkpoints.length,23);assert.equal(l.bonusCrateTotal,24);
 for(const b of l.crates){const name=r.source.components[b.mesh.userData.editorIdx].nm.split(' ·')[0];if(!groups.has(name))groups.set(name,[]);groups.get(name).push(b);}
 for(const [name,boxes]of groups){
  const x=boxes[0].mesh.position.x,z=boxes[0].mesh.position.z,y=Math.min(...boxes.map(b=>b.box.min.y)),s=m.ghostRouteProgress([x,y,z]);
  for(const dx of [-.576,.576])for(const dz of [-.576,.576]){ray.set(new THREE.Vector3(x+dx,y+1,z+dz),down);ray.far=2;const hit=l.raycastGround(ray)[0];assert.ok(hit&&Math.abs(hit.point.y-y)<.08,'supported footprint '+name);}
  const q=m.ghostRoutePoint(s-2.5);ray.set(new THREE.Vector3(q[0],q[1]+2,q[2]),down);ray.far=4;const hit=l.raycastGround(ray)[0];assert.ok(hit,'supported approach '+name);
  p.respawn(l,true,false,{position:hit.point.clone().add(new THREE.Vector3(0,.08,0)),heading:new THREE.Vector3(...m.ghostRouteTangent(s))});r.stepFor(20);
  r.until(()=>boxes.every(b=>!b.alive),()=>({...r.steerToward(boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0].mesh.position,{pace:.3}),spinHeld:r.frame%24<12}),{maxFrames:900,label:name});
  assert.equal(p.totalDeaths,0);report.harvests.push({name,count:boxes.length,station:s,deaths:p.totalDeaths});
  console.log('HARVEST',name,boxes.length);await writeFile(out+'/harvest-progress.json',JSON.stringify(report.harvests));
 }
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));report.resetRestores=true;
 await writeFile(out+'/main-after.json',JSON.stringify(r.source));
},{modulePath:'/src/levels/ghost-train.ts',levelId:'ghost-train',source:m=>m.GHOST_TRAIN_LEVEL,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
const bonusOptions={modulePath:'/src/levels/bonus-easy.ts',levelId:'bonus-easy',source:m=>m.EASY_BONUS_LEVEL,controlFrame:()=>({x:0,z:-1})};
await withBlockworksRuntime(async r=>{
 report.bonus=runInputPilot(r,runEasyBonus);assert.equal(report.bonus.cratesBroken,24);assert.equal(report.bonus.gemEarned,true);assert.equal(report.bonus.deaths,0);
 await writeFile(out+'/bonus-after.json',JSON.stringify(r.source));
},bonusOptions);
await withBlockworksRuntime(r=>{
 r.stepFor(20);const boxes=r.l.crates.filter(b=>Math.abs(b.mesh.position.x+9)<.01);
 r.until(()=>boxes.every(b=>!b.alive),()=>({...r.steerToward([-9,0,0],{pace:.3}),spinHeld:r.frame%24<12}),{maxFrames:900,label:'collect before failed gap'});
 r.p.pos.set(3,-2,0);r.p.grounded=false;
 r.until(()=>r.p.totalDeaths===1,{}, {maxFrames:900,allowDeath:true,label:'failed gap'});
 r.until(()=>r.p.grounded&&r.p.state!=='dead',{}, {maxFrames:900,allowDeath:true,label:'retry at bonus start'});
 assert.ok(r.l.crates.every(b=>b.alive));assert.equal(r.p.cratesBroken,0);assert.ok(r.p.pos.distanceTo(r.l.spawnPos)<1);
 report.bonusRetry={deaths:r.p.totalDeaths,restored:r.l.crates.length,crates:r.p.cratesBroken,position:r.p.pos.toArray()};
},{...bonusOptions,endlessDeaths:true});
await writeFile(out+'/grammar.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS 68 supported cargo harvests, continuous Easy Street all-box clear and failed-gap reset');
