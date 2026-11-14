import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.RALLY_CRATE_OUTPUT??'/tmp/rally-crate-placement.json';
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const {l,p,source,THREE}=e,report={passed:false,pickups:[],corners:0,maxFloorDelta:0,probeBasis:'authored ground anchors; runtime item cubes float above the road'};
 const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 if(process.env.RALLY_CRATE_BASELINE){
  const before=JSON.parse(await readFile(process.env.RALLY_CRATE_BASELINE,'utf8'));
  const omit=d=>({...d,components:d.components.filter(c=>c.t!=='crate')});
  assert.equal(hash(omit(source)),hash(omit(before)),'All non-crate components and settings remain exact');report.nonCratesAndSettingsExact=true;
 }
 if(process.env.RALLY_OTHER_PACK_HASHES){
  const hashes=JSON.parse(await readFile(process.env.RALLY_OTHER_PACK_HASHES,'utf8')),pack=JSON.parse(await readFile('public/levels.json','utf8'));
  for(const entry of pack.levels)if(entry.id!=='coconut-cart-rally')assert.equal(hash(entry),hashes[entry.id],'Other published levels remain exact');report.otherPublishedLevelsExact=true;
 }
 assert.equal(l.crates.length,52);assert.ok(l.crates.every(c=>c.mystery));assert.equal(l.totalCrates,0);assert.equal(l.enemies.length,0);assert.equal(l.checkpoints.length,0);
 const race=new SkateRace(e.scene,p,false,()=>true);race.attach(l,'coconut-cart-rally');race.start('time-trial',42);race.phase='running';
 const carts=race.carts,w=carts.fleet.physics,rider=race.riders[0],ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 for(const [index,box]of l.crates.entries()){
  const base=source.components[box.mesh.userData.editorIdx].p[1];
  for(const dx of [-.556,.556])for(const dz of [-.556,.556]){
   ray.set(box.mesh.position.clone().setY(base+2).add(new THREE.Vector3(dx,0,dz)),down);ray.far=4;const hit=l.raycastGround(ray)[0];assert.ok(hit,'Every item anchor corner has dirt below it');
   const delta=hit.point.y-base;assert.ok(Math.abs(delta)<.5,`Item ${index+1} anchor follows the local corrugated dirt: ${delta}`);report.maxFloorDelta=Math.max(report.maxFloorDelta,Math.abs(delta));report.corners++;
  }
  // Each isolated approach starts supported, eight metres before its target.
  // Only controls drive the approach; collection uses the real cart contact.
  l.reset(true);rider.item=null;rider.boost=0;rider.finish=null;rider.recovery=0;
  const at=race.course.project(box.mesh.position).s,f=race.course.tangent(at).setY(0).normalize(),start=box.mesh.position.clone().addScaledVector(f,-8);
  Object.assign(w.spawns[0],{x:start.x,z:start.z,yaw:Math.atan2(-f.x,-f.z)});w.reset(0);carts.sync();
  rider.progress=rider.previousProgress=rider.anchorProgress=race.course.project(p.pos).s;rider.anchor.copy(p.pos);
  const kart=w.carts[0],initial=p.pos.clone();let frames=0;
  for(;frames<360&&box.alive;frames++){
   const angle=Math.atan2(-(box.mesh.position.x-kart.x),-(box.mesh.position.z-kart.z))-kart.yaw;
   race.step(e.dt,{moveX:Math.max(-1,Math.min(1,Math.atan2(Math.sin(angle),Math.cos(angle))*2)),moveY:1,jumpHeld:true});
  }
  assert.ok(!box.alive,`Pickup ${index+1} can be driven through`);assert.equal(rider.item,'mushroom');assert.equal(rider.boxes.size,0);assert.equal(rider.falls,0);assert.equal(kart.hits,0,`Pickup ${index+1} approach does not hit a rock`);assert.ok(p.pos.distanceTo(initial)>5);
  report.pickups.push({index,frames,position:box.mesh.position.toArray(),speed:kart.speed,item:rider.item,hits:kart.hits});
  if(index===0){for(let n=0;n<95;n++)race.step(e.dt,{moveX:0,moveY:0,grabHeld:true});assert.ok(box.alive,'The item returns for the chasing pack');report.respawnSeconds=95/60;}
 }
 race.start('time-trial',42);assert.ok(l.crates.every(c=>c.alive));assert.equal(race.riders[0].item,null);report.retryRestored=true;
 race.attach({skateRace:null},'flats');report.passed=true;await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,pickups:report.pickups.length,corners:report.corners,maxFloorDelta:report.maxFloorDelta}));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
