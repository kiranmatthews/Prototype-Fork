import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.GROVE_CRATE_OUTPUT??'/tmp/grove-crates';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source}=r,report={harvests:[],maxFloorError:0};
 if(process.env.GROVE_CRATE_BASELINE){
  const before=JSON.parse(await readFile(process.env.GROVE_CRATE_BASELINE,'utf8'));
  assert.equal(JSON.stringify(source.components.filter(c=>c.t!=='crate')),JSON.stringify(before.components.filter(c=>c.t!=='crate')));
  assert.deepEqual(Object.fromEntries(Object.entries(source).filter(([k])=>k!=='components')),Object.fromEntries(Object.entries(before).filter(([k])=>k!=='components')));
  assert.deepEqual(source.components.filter(c=>c.t==='crate'&&['tnt','nitro'].includes(c.kind)),before.components.filter(c=>c.t==='crate'&&['tnt','nitro'].includes(c.kind)));
  report.nonCratesExact=report.settingsExact=report.explosivesExact=true;
 }
 assert.equal(l.crates.length,62);assert.equal(l.totalCrates,90);assert.equal(l.bonusCrateTotal,24);assert.equal(l.checkpoints.length,5);assert.equal(l.enemies.length,0);
 const groups=new Map();
 for(const b of l.crates){const nm=source.components[b.mesh.userData.editorIdx]?.nm;if(!nm?.includes(' · box '))continue;const key=nm.split(' · box ')[0];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);}
 assert.equal(groups.size,18);const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const [name,boxes] of groups){
  const min=Math.min(...boxes.map(b=>b.box.min.y)),centre=boxes.reduce((sum,b)=>sum.add(b.mesh.position),new THREE.Vector3()).multiplyScalar(1/boxes.length);
  for(const b of boxes.filter(b=>Math.abs(b.box.min.y-min)<.01))for(const dx of [-.556,.556])for(const dz of [-.556,.556]){
   ray.set(b.mesh.position.clone().setY(min+3).add(new THREE.Vector3(dx,0,dz)),down);ray.far=6;const h=l.raycastGround(ray)[0];assert.ok(h,name+' corner support');report.maxFloorError=Math.max(report.maxFloorError,Math.abs(h.point.y-min));
  }
  ray.set(centre.clone().set(0,min+3,centre.z+3),down);ray.far=8;const floor=l.raycastGround(ray)[0];assert.ok(floor,name+' centre-line approach');
  p.respawn(l,true,false,{position:floor.point.clone().add(new THREE.Vector3(0,.1,0)),heading:new THREE.Vector3(0,0,-1)});r.stepFor(20);const first=r.frame;let held=false;
  r.until(()=>boxes.every(b=>!b.alive),()=>{const target=boxes.find(b=>b.alive).mesh.position,spin=p.spinning||!held;held=spin;return{...r.steerToward(target,{pace:p.spinning?.38:0}),spinHeld:spin};},{maxFrames:1200,label:name});
  assert.equal(p.totalDeaths,0);assert.ok(l.minefields.fields.every(f=>!f.detonated));report.harvests.push({name,count:boxes.length,frames:r.frame-first,deaths:0,fromCentreRoute:true});
 }
 assert.ok(report.maxFloorError<.5,'rounded tunnel floor support stays close to each stack');
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));report.reset={physical:l.crates.length,fieldsArmed:l.minefields.fields.every(f=>!f.detonated)};
 await writeFile(out+'/grammar.json',JSON.stringify(report,null,2));console.log('PASS all 56 refuge/tunnel rewards through 18 separately staged ordinary-input approaches; full crate and field reset');
},{modulePath:'/src/levels/jungle-minefield.ts',source:m=>m.JUNGLE_MINEFIELD_LEVEL,levelId:'jungle-minefield',maxFrames:25000});
