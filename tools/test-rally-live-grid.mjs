import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const {RaceFinishPresentation}=await e.server.ssrLoadModule('/src/race/finishPresentation.ts');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');
 const report={passed:false,grindRails:e.l.grindRails.length,views:[]};
 assert.equal(e.l.grindRails.length,0,'No authored, surface or crate grinds anywhere in this race');
 // Adjacent physical crates must not silently regenerate a ledge on a rebuild.
 const boxes=e.l.crates.slice(0,2),saved=boxes.map(b=>({mystery:b.mystery,position:b.mesh.position.clone(),box:b.box.clone()}));
 boxes.forEach((b,i)=>{b.mystery=false;b.mesh.position.set(i*.96,1,-30);b.box.setFromCenterAndSize(b.mesh.position,new e.THREE.Vector3(.96,.96,.96));});
 e.l.rebuildCrateRails();assert.equal(e.l.grindRails.length,0,'Even touching solid crates cannot be ground');
 const vehicle=e.l.skateRace.vehicle;delete e.l.skateRace.vehicle;e.l.rebuildCrateRails();assert.ok(e.l.crateRails.length>0,'Ordinary skate races retain their crate ledges');e.l.skateRace.vehicle=vehicle;
 boxes.forEach((b,i)=>{b.mystery=saved[i].mystery;b.mesh.position.copy(saved[i].position);b.box.copy(saved[i].box);});e.l.rebuildCrateRails();
 race.start('race',42);let c=race.carts;const w=c.fleet.physics,initial=w.carts.slice(0,8).map(k=>({...k})),dropY=w.carts[8].y,sceneTime=e.l.time,cooldowns=[...c.thrustCooldown];
 let previous={};const tick=(n,sample={})=>{for(let i=0;i<n;i++){const input=normalizeGameInput(sample,previous);race.step(1/60,input);previous=input;}};
 tick(150,{moveX:1,moveY:1,jumpHeld:true,spinHeld:true,grindHeld:true,itemPressed:true});
 assert.equal(race.phase,'countdown');assert.equal(race.elapsed,0);assert.equal(e.p.ttTime,0);
 assert.ok(e.l.time>sceneTime+2.4&&c.crowd.time.value>2.4,'World and GPU crowd animate during countdown');
 assert.ok(w.carts[8].y<dropY-14&&w.carts[8].y>c.ground(w.carts[8].x,w.carts[8].z).height+15,'Higher delivery is visibly falling before GO');
 w.carts.slice(0,8).forEach((k,i)=>{assert.ok(Math.hypot(k.x-initial[i].x,k.z-initial[i].z)<.01);assert.equal(k.health,1);assert.ok(Math.hypot(k.vx,k.vz)<.01);});
 assert.deepEqual(c.thrustCooldown,cooldowns,'Countdown cannot spend the randomized recharge stagger');
 assert.ok(race.riders.every(r=>r.progress===0&&!r.item&&r.finish===null));assert.equal(c.stats.thrusters,0);assert.equal(c.stats.exits,0);
 report.countdown={worldSeconds:w.time,crowdSeconds:c.crowd.time.value,dropMetres:dropY-w.carts[8].y,clocks:race.elapsed,heldOnGrid:true};
 tick(32);assert.equal(race.phase,'running');tick(300);assert.equal(c.stats.loanerLandings,18);assert.equal(c.drops.activeCount,0);assert.equal(e.l.grindRails.length,0);
 // Check the actual results lens, including its asymmetric UI viewport.
 race.phase='finished';const end=race.course.length;race.riders.forEach((r,i)=>r.player.pos.copy(race.course.sample(end+2,(i%2?1:-1)*10)));
 for(const [width,height,viewport]of [[1280,720,{x:32,y:43,width:660,height:634}],[1600,900,{x:32,y:43,width:850,height:800}],[390,844,{x:16,y:30,width:358,height:338}]]){
  const camera=new e.THREE.PerspectiveCamera(50,width/height,.1,5000);camera.position.set(2,12,6);camera.lookAt(0,0,0);const before=camera.clone(),presentation=new RaceFinishPresentation();
  presentation.frame(camera,race,1,width,height,viewport);
  const at=race.course.project(camera.position),floor=race.course.sample(at.s).y;
  assert.ok(Math.abs(at.offset)<2,'Camera stays above the track centre, clear of the stands');assert.ok(camera.position.y>floor+12);assert.ok(at.s<end-15&&at.s>end-130);
  assert.ok(camera.getWorldDirection(new e.THREE.Vector3()).dot(race.course.tangent(end))>.6,'Shot looks down the approach toward the finish');
  for(const point of [race.course.sample(end),...race.riders.map(r=>r.player.pos.clone().add(new e.THREE.Vector3(0,1,0)))]){
   const p=point.project(camera),x=(p.x+1)*width/2,y=(1-p.y)*height/2;assert.ok(x>=viewport.x&&x<=viewport.x+viewport.width&&y>=viewport.y&&y<=viewport.y+viewport.height,'Finishers and gate stay beside results');
  }
  report.views.push({width,height,camera:camera.position.toArray(),offset:at.offset,metresBeforeFinish:end-at.s});
  presentation.restore(camera);assert.ok(camera.position.distanceTo(before.position)<1e-9);assert.ok(camera.quaternion.angleTo(before.quaternion)<1e-6);assert.equal(camera.fov,before.fov);assert.equal(camera.view,null);
 }
 race.start('time-trial',42);c=race.carts;assert.equal(e.l.grindRails.length,0);assert.equal(c.drops.activeCount,18);tick(60,{jumpHeld:true});assert.equal(e.p.ttTime,0);assert.equal(race.elapsed,0);
 race.attach({skateRace:null},'flats');report.passed=true;report.restart=true;
 await writeFile(process.env.RALLY_GRID_REPORT??'/private/tmp/rally-live-grid.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
