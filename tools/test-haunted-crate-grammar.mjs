import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {withThemedBonusRuntime} from './test-themed-bonus-puzzles.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusJourney,runThemedBonusWrongOrder} from './themed-bonus-pilot.mjs';
const output=process.env.HAUNTED_CRATE_OUTPUT||'/tmp/haunted-crates';await mkdir(output,{recursive:true});
const report={harvests:[],bonusOrder:[]};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),groups=new Map();
 assert.equal(l.crates.length,773);assert.equal(l.totalCrates,105);assert.equal(l.enemies.length,5);assert.deepEqual([...new Set(l.enemies.map(e=>e.kind))].sort(),['grunt','turtle']);
 for(const b of l.crates){const spec=r.source.components[b.mesh.userData.editorIdx];if(!spec.nm?.startsWith('HAUNTED /'))continue;const nm=spec.nm.split(' ·')[0];if(!groups.has(nm))groups.set(nm,[]);groups.get(nm).push(b);}
 for(const [nm,boxes]of groups){
  const x=boxes[0].mesh.position.x,z=boxes[0].mesh.position.z,y=Math.min(...boxes.map(b=>b.box.min.y));
  for(const dx of [-.57,.57])for(const dz of [-.57,.57]){ray.set(new THREE.Vector3(x+dx,y+1,z+dz),down);ray.far=2;const hit=l.raycastGround(ray)[0];assert.ok(hit&&Math.abs(hit.point.y-y)<.08,'entire crate footprint supported: '+nm);}
  ray.set(new THREE.Vector3(x,y+2,z+2.5),down);ray.far=4;const hit=l.raycastGround(ray)[0];assert.ok(hit&&Math.abs(hit.point.y-y)<.2,'safe approach '+nm);
  p.respawn(l,true,false,{position:hit.point.clone().add(new THREE.Vector3(0,.08,0)),heading:new THREE.Vector3(0,0,-1)});r.stepFor(20);
  r.until(()=>boxes.every(b=>!b.alive),()=>{const b=boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0];return {...r.steerToward(b.mesh.position,{pace:.3}),spinHeld:r.frame%24<12};},{maxFrames:900,label:nm});
  assert.equal(p.totalDeaths,0);report.harvests.push({name:nm,count:boxes.length,deaths:p.totalDeaths});
 }
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));report.resetRestores=true;
 for(let f=0;f<600;f++){l.update(1/60);if(f%30)continue;for(const e of l.enemies){ray.set(new THREE.Vector3(e.group.position.x,e.baseY+2,e.group.position.z),down);ray.far=4;const hit=l.raycastGround(ray)[0];assert.ok(hit&&Math.abs(hit.point.y-e.baseY)<.15,'supported guardian patrol');}}
 report.patrolProbes=100;
},{modulePath:'/src/levels/codex-lab.ts',source:m=>m.CODEX_LAB_LEVEL,levelId:'codex-lab'});
await withThemedBonusRuntime('bonus-codex-switchback',r=>{report.bonus=runInputPilot(r,runThemedBonusJourney);assert.equal(report.bonus.state,'finished');assert.equal(report.bonus.cratesBroken,29);assert.equal(report.bonus.totalCrates,29);assert.equal(report.bonus.gemEarned,true);assert.equal(report.bonus.deaths,0);});
for(const index of [0,1,2])await withThemedBonusRuntime('bonus-codex-switchback',r=>{
 r.course={...r.course,rooms:[r.course.rooms[index]]};report.bonusOrder.push(runInputPilot(r,runThemedBonusWrongOrder));
 r.p.respawn(r.l,true);assert.ok(r.l.crates.every(b=>b.alive));assert.equal(r.l.crates.filter(b=>b.pending).length,9);assert.ok(r.l.outlinedSurfaces.every(s=>!s.active));report.bonusOrder.at(-1).retryRestores=true;
},{start:[index===0?1:index===1?35:69,.12,0]});
await writeFile(output+'/grammar.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS nineteen supported cargo harvests, guardian patrols, 29-box bonus and three wrong-order/retry scenarios');
