import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async env=>{
 const THREE=await env.server.ssrLoadModule('three'),{SkateRace}=await env.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(env.scene,env.p,false,()=>true);race.attach(env.l,'coconut-cart-rally');race.start('race',0);race.phase='running';
 let c=race.carts,w=c.fleet.physics;
 const a=w.carts[1],b=w.carts[2],p=env.p.pos;Object.assign(a,{x:p.x+3.2,y:p.y,z:p.z});Object.assign(b,{x:p.x+4,y:p.y,z:p.z});
 assert.equal(c.nearest(0),1);b.x=p.x+3;assert.equal(c.nearest(0),1,'minor crowd jitter keeps the selected kart');b.x=p.x+2;assert.equal(c.nearest(0),2,'a clearly closer kart wins');
 c.burning[2]=true;assert.equal(c.nearest(0),1,'a wreck immediately loses its target lock');c.burning[2]=false;
 assert.equal(c.clearBay(p.x,p.z,1),false,'loaner cannot appear under a racer');
 const body=w.carts[8];assert.equal(c.clearBay(body.x,body.z,9),false,'loaner cannot appear inside another parked kart');
 const geometry=c.fleet.models.map(m=>m.stats.triangles),before=JSON.stringify(w.carts);
 for(const alpha of [-1,0,.25,.5,1,2])c.present(alpha);
 assert.equal(JSON.stringify(w.carts),before,'rendering never writes simulation state');
 const camera=new THREE.PerspectiveCamera(60,16/9,.1,180);camera.position.copy(p).add(new THREE.Vector3(0,12,22));camera.lookAt(p.clone().add(new THREE.Vector3(0,0,-40)));camera.updateMatrixWorld(true);c.updateView(camera);
 const visible=c.fleet.models.map((_,i)=>c.fleet.isPresented(i));assert.ok(visible.filter(Boolean).length<20);assert.equal(visible[0],true);
 for(const batch of c.fleet.batches)assert.equal(batch.mesh.count,batch.sources.filter(s=>visible[s.cart]&&s.mesh.visible).length,'visible carts retain every source instance');
 const reflected=camera.clone();reflected.position.y=-camera.position.y;reflected.up.set(0,-1,0);reflected.lookAt(p.x,-p.y,p.z-40);reflected.updateMatrixWorld(true);c.updateView(reflected);
 assert.deepEqual(c.fleet.models.map((_,i)=>c.fleet.isPresented(i)),visible,'ocean reflection retains the same full models');
 assert.deepEqual(c.fleet.models.map(m=>m.stats.triangles),geometry,'culling never changes authored geometry');
 c.updateView(camera);c.present(.5);const versions=c.fleet.batches.map(b=>(b.mesh.instanceColor?.version??0));c.present(.5);assert.deepEqual(c.fleet.batches.map(b=>(b.mesh.instanceColor?.version??0)),versions,'unchanged paint never uploads again');
 c.fleet.models[0].setPalette({paint:'#ff0000'});c.present(.5);assert.ok(c.fleet.batches.some((b,i)=>(b.mesh.instanceColor?.version??0)>versions[i]));
 c.burning.fill(false);c.present(.5);assert.equal(c.effects.flames.count,0);const fireVersion=c.effects.flames.instanceMatrix.version;c.present(.8);assert.equal(c.effects.flames.instanceMatrix.version,fireVersion,'no empty flame uploads');
 c.burning[0]=true;c.previous[0].x=w.carts[0].x-10;c.present(.5);const matrix=new THREE.Matrix4();c.effects.flames.getMatrixAt(0,matrix);
 assert.ok(Math.abs(matrix.elements[12]-c.fleet.models[0].root.position.x)<1,'fire follows interpolated chassis');assert.ok(c.effects.flames.count>=5,'each burning body pocket emits a tongue');
 c.effects.update(16,c.burning);c.present(1);assert.equal(c.effects.flames.count,0,'flames burn down to a persistent wreck');
 c.fleet.models[0].setScorched(true);assert.ok(c.fleet.models[0].materials.paint.color.getHex()<0x303030);c.fleet.models[0].setScorched(false);
 const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,2000);let probes=0;
 for(let s=0;s<race.course.length;s+=13)for(const offset of [-15,-7,0,7,15]){
  const point=race.course.sample(s,offset);ray.ray.origin.copy(point).setY(point.y+100);
  const full=ray.intersectObjects(env.l.groundMeshes,false),local=ray.intersectObjects(c.groundCandidates(point.x,point.z),false);
  assert.deepEqual(local.map(h=>[h.object.uuid,h.distance]),full.map(h=>[h.object.uuid,h.distance]),'local ground candidates preserve every exact intersection');probes++;
 }
 const scenarios=[];
 for(const seed of [11,741]){
  race.start('race',seed);race.phase='running';c=race.carts;w=c.fleet.physics;let wrecked=false,frames=0;
  for(;frames<18000&&!race.riders.every(r=>r.finish!==null);frames++){
   if(frames===600){for(let id=0;id<8;id++)c.hit(id,undefined,1);wrecked=true;}
   race.step(env.dt,race.drive(0));
   if(frames%120===0){
    const occupied=c.cartForRacer.filter(i=>i>=0);assert.equal(new Set(occupied).size,occupied.length,'single owner per kart');
    for(let i=0;i<w.carts.length;i++){const v=w.carts[i];assert.ok([v.x,v.y,v.z,v.vx,v.vy,v.vz,v.yaw,v.health].every(Number.isFinite));assert.ok(v.health>=0&&v.health<=1);const owner=c.driverForCart[i];if(owner>=0){assert.equal(c.cartForRacer[owner],i);assert.equal(c.burning[i],false);}}
   }
  }
  const finishes=race.riders.map(r=>r.finish);if(!finishes.every(Number.isFinite))console.log('STRANDED',JSON.stringify(race.riders.map(r=>({id:r.id,finish:r.finish,progress:r.progress,falls:r.falls,anchor:r.anchor.toArray(),position:r.player.pos.toArray(),state:r.player.state,grounded:r.player.grounded,cart:c.cartForRacer[r.id],target:c.nearest(r.id,350),input:c.drive(r.id),loanWait:c.loanWait[r.id]}))));assert.ok(wrecked);assert.ok(finishes.every(Number.isFinite),`all racers recover after mass burnout, seed ${seed}: ${JSON.stringify(finishes)}`);
  scenarios.push({seed,seconds:frames/60,finishes,falls:race.riders.map(r=>r.falls),stats:{...c.stats}});
 }
 race.start('time-trial',8);assert.equal(race.carts.fleet.physics.carts.length,13);assert.ok(race.carts.fleet.physics.carts.every(c=>c.health===1));race.attach({skateRace:null},'flats');assert.equal(env.p.raceHooks,null);
 const report={passed:true,immutableInterpolation:true,exactGroundProbes:probes,stableTheftTarget:true,clearLoanerBays:true,reflectionGeometryPreserved:true,noIdleUploads:true,scenarios};await writeFile(process.env.CART_POLISH_STRESS??'/private/tmp/cart-polish-stress.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
