import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.ROOF_CRATE_OUTPUT??'/tmp/rooftop-crate-review';await mkdir(out,{recursive:true});
const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8')),source=pack.levels.find(e=>e.id==='rooftop-relay').data;
const before=process.env.ROOF_CRATE_BASELINE?JSON.parse(await readFile(process.env.ROOF_CRATE_BASELINE,'utf8')):null;
const report={harvests:[],maxFloorError:0};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r;assert.equal(l.crates.length,103);assert.equal(l.totalCrates,128);assert.equal(l.bonusCrateTotal,43);assert.equal(l.enemies.length,0);
 if(before){
 assert.deepEqual(source.components.filter(c=>c.t!=='crate'),before.components.filter(c=>c.t!=='crate'));
 const settings=d=>Object.fromEntries(Object.entries(d).filter(([k])=>k!=='components'));
 assert.deepEqual(settings(source),settings(before));
 assert.deepEqual(source.components.filter(c=>c.t==='crate'&&c.kind==='metal'),before.components.filter(c=>c.t==='crate'&&c.kind==='metal'));
 report.preservation={nonCrates:source.components.filter(c=>c.t!=='crate').length,metalCrates:24,settingsExact:true};
 }
 const name=b=>source.components[b.mesh.userData.editorIdx].nm??'';
 const prefixes=[...r.sourceModule.ROOFTOP_DISTRICTS.map(d=>d.name+' · terrace deliveries'),...[-8,10].map(side=>'Club catering delivery '+side+' ·')];
 const selected=new Set(),groups=[];
 for(const prefix of prefixes){const boxes=l.crates.filter(b=>name(b).startsWith(prefix));assert.equal(boxes.length,prefix.startsWith('Club catering')?4:10);boxes.forEach(b=>selected.add(b));groups.push({name:prefix,boxes,newGroup:true});}
 for(const b of l.crates.filter(b=>!b.metal&&!selected.has(b)))groups.push({name:name(b),boxes:[b],newGroup:false});
 assert.equal(groups.reduce((sum,g)=>sum+g.boxes.length,0),79);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const g of groups){
  p.respawn(l,true);l.update(0);r.scene.updateMatrixWorld(true);
  const floor=Math.min(...g.boxes.map(b=>b.box.min.y));
  if(g.newGroup)for(const b of g.boxes.filter(b=>Math.abs(b.box.min.y-floor)<.01))for(const x of [b.box.min.x+.02,b.box.max.x-.02])for(const z of [b.box.min.z+.02,b.box.max.z-.02]){
   ray.set(new THREE.Vector3(x,floor+1,z),down);ray.far=3;const hit=l.raycastGround(ray)[0];assert.ok(hit,'supported footprint '+g.name);
   const error=Math.abs(hit.point.y-floor);assert.ok(error<.1,'floor mismatch '+g.name+' '+error);report.maxFloorError=Math.max(report.maxFloorError,error);
  }
  const centre=new THREE.Vector3(g.boxes.reduce((v,b)=>v+b.mesh.position.x,0)/g.boxes.length,floor,g.boxes.reduce((v,b)=>v+b.mesh.position.z,0)/g.boxes.length);
  const f=l.cameraDirAt(centre.x,centre.y,centre.z),heading=new THREE.Vector3(f?.x??0,0,f?.z??-1).normalize(),approach=centre.clone().addScaledVector(heading,-2.5);
  ray.set(approach.clone().add(new THREE.Vector3(0,4,0)),down);ray.far=14;const ground=l.raycastGround(ray)[0];assert.ok(ground,'approach '+g.name);
  p.respawn(l,true,false,{position:ground.point.clone().add(new THREE.Vector3(0,.08,0)),heading});r.stepFor(15);
  const first=r.frame;
  r.until(()=>g.boxes.every(b=>!b.alive),()=>({...r.steerToward(g.boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0].mesh.position,{pace:.22}),spinHeld:r.frame%24<12}),{maxFrames:900,label:g.name});
  assert.equal(p.totalDeaths,0);report.harvests.push({name:g.name,count:g.boxes.length,frames:r.frame-first,deaths:p.totalDeaths,newGroup:g.newGroup});
 }
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));report.fullReset=true;
 report.inventory={physical:l.crates.length,counted:l.crates.filter(b=>!b.metal).length,gemTally:l.totalCrates,checkpoints:l.checkpoints.length,bonus:l.bonusCrateTotal,masks:l.crates.filter(b=>b.mask).length,multiHit:l.crates.filter(b=>b.multiHit).length,enemies:l.enemies.length};
},{modulePath:'/src/levels/codex-lab.ts',source:()=>source,levelId:'rooftop-relay',allowCheckpointTrips:true,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile(out+'/grammar.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS '+report.harvests.length+' staged approaches collect all 79 main crates; eight grouped deliveries have supported footprints; full reset restores 103 physical crates');
