import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-p1-twist';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {THREE,p,l,server}=r,loop=l.verticalLoop;
 const {verticalLoopTransform:T,verticalLoopShift,verticalLoopYaw,validVerticalLoop,VerticalLoopView}=await server.ssrLoadModule('/src/verticalLoop.ts');
 const {RenderInterpolator}=await server.ssrLoadModule('/src/renderInterpolation.ts');
 const {LaunchCamera}=await server.ssrLoadModule('/src/launchCamera.ts');
 const {SPAGHETTI_RAILS_PLATFORMING_LEVEL:P1}=await server.ssrLoadModule('/src/levels/spaghetti-platformer-p1.ts');
 const report={scope:'Native P1 restoration, isometry/render continuity, repeated physical falls, landing, checkpoint and crystal/finish fixtures. Not a complete manual playthrough.'};
 const geometry=P1.components.filter(c=>['rail','platform','ramp','gate','pit'].includes(c.t));
 assert.equal(createHash('sha256').update(JSON.stringify(geometry)).digest('hex'),'1a135128a3c2418d4c51cd8d035e8fb87f90a5cd48a6fc904339d6ba4c031fa8');
 assert.deepEqual(r.source.components,P1.components.filter(c=>c.t!=='pit'),'Every P1 component except the fatal abyss is retained');
 assert.equal(l.skateRace,null);assert.equal(l.railChoices.paths.length,18);assert.equal(l.railChoices.planar,false);
 assert.equal(l.checkpoints.length,41);assert.ok(validVerticalLoop(loop));
 for(const twist of [null,[],{degrees:NaN,center:[0,0]},{degrees:5,center:[0]},{degrees:90,center:[0,0]},{degrees:5,center:[0,0],extra:1}])assert.ok(!validVerticalLoop({...loop,twist}));
 const vector=new THREE.Vector3(147,17,-318);
 for(const cells of [-4,-1,0,1,4]){
  const a=T(loop,cells*loop.height),b=T(loop,-cells*loop.height);
  assert.ok(vector.clone().applyMatrix4(a).applyMatrix4(b).distanceTo(vector)<1e-9);
  const y=loop.minY+loop.height*.3+cells*loop.height;
  assert.equal(verticalLoopShift(y,loop),-cells*loop.height);
 }
 // Both dynamic children and exact static batches use the same transform.
 const source=new THREE.Group(),material=new THREE.MeshBasicMaterial(),geometryBox=new THREE.BoxGeometry(4,3,7);
 const live=new THREE.Mesh(geometryBox,material),fixed=new THREE.Mesh(geometryBox,material);
 live.position.set(35,52,-80);live.rotation.y=.7;fixed.position.set(-40,80,20);fixed.userData.editorIdx=0;
 source.add(live,fixed);const view=new VerticalLoopView(source,loop,i=>i===0,300);
 view.update(new THREE.PerspectiveCamera(),300);source.updateMatrixWorld(true);
 assert.ok(view.diagnostics.staticBatches>0&&view.diagnostics.liveCopies>0);
 for(const proxy of view.root.children){
  const isLive=proxy.geometry===geometryBox,offset=proxy.matrix.elements[13]-(isLive?live.position.y:0);
  const expected=T(loop,offset);if(isLive)expected.multiply(live.matrix);
  assert.ok(proxy.matrix.elements.every((v,i)=>Math.abs(v-expected.elements[i])<1e-8));
 }
 live.visible=false;view.update(new THREE.PerspectiveCamera(),300);
 assert.ok(view.root.children.filter(m=>m.geometry===geometryBox).every(m=>!m.visible));
 view.dispose();material.dispose();geometryBox.dispose();
 // Fractional render poses must remain equivalent on both sides of a seam.
 const root=new THREE.Group(),child=new THREE.Group();root.add(child);child.position.set(1,2,3);
 const interpolator=new RenderInterpolator();root.position.copy(vector);interpolator.capture([root,child]);
 root.position.add(new THREE.Vector3(.2,-.8,.4));root.rotation.y=.2;interpolator.capture([root,child]);
 interpolator.apply(.37);const pose=root.position.clone(),quat=root.quaternion.clone();
 const matrix=T(loop,loop.height),yaw=verticalLoopYaw(loop,loop.height),rotation=new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,yaw);
 interpolator.transformWorld(matrix,rotation);interpolator.apply(.37);
 assert.ok(root.position.distanceTo(pose.applyMatrix4(matrix))<1e-9);
 assert.ok(root.quaternion.angleTo(quat.premultiply(rotation))<1e-7);assert.deepEqual(child.position.toArray(),[1,2,3]);
 // An active launch shot also respects a rotated rebase, including its exit.
 const a=new LaunchCamera(),b=new LaunchCamera(),ca=new THREE.PerspectiveCamera(),cb=ca.clone();
 for(let f=0;f<100;f++){
  a.restore(ca);b.restore(cb);if(f===30)b.transformWorld(matrix,rotation,yaw);
  const point=new THREE.Vector3(20+f*.1,90-f*.2,10-f*.1),launch=f<70?{id:1,strength:1,elapsed:f/60,gather:.1}:null;
  ca.position.copy(point).add(new THREE.Vector3(0,8,12));ca.lookAt(point);cb.copy(ca);
  if(f>=30){cb.position.applyMatrix4(matrix);cb.quaternion.premultiply(rotation);}
  a.apply(ca,point,launch,1/60,f===0);b.apply(cb,f>=30?point.clone().applyMatrix4(matrix):point,launch,1/60,f===0);
  assert.ok(cb.position.distanceTo(f>=30?ca.position.clone().applyMatrix4(matrix):ca.position)<1e-7);
  assert.ok(cb.quaternion.angleTo(f>=30?ca.quaternion.clone().premultiply(rotation):ca.quaternion)<1e-7);
 }
 r.stepFor(30);assert.ok(p.grounded&&!p.isBailing);report.spawn=r.snapshot();
 const cp=r.source.components.find(c=>c.t==='checkpoint');
 p.respawn(l,true,false,{position:new THREE.Vector3(cp.p[0],cp.p[1]+.08,cp.p[2]+3),heading:new THREE.Vector3(0,0,-1)});
 for(let i=0;i<240&&!l.activeCheckpoint;i++)r.tick({moveY:1,spinHeld:true,spinPressed:i%30===0});
 assert.ok(l.activeCheckpoint);const checkpoint=l.activeCheckpoint,deathCount=p.totalDeaths;
 // Controlled initial placement in clear space; only native physics thereafter.
 p.respawn(l,true,false,{position:new THREE.Vector3(700,loop.minY+loop.height-.01,700),heading:new THREE.Vector3(0,0,-1)});
 const initial=p.pos.clone(),initialOffset=p.verticalLoopOffset,fallStart=r.frame,wraps=[];
 for(let f=0;f<1500&&wraps.length<5;f++){
  const before=p.verticalLoopOffset;r.tick({});
  const unwrapped=p.pos.clone().applyMatrix4(T(loop,-(p.verticalLoopOffset-initialOffset)));
  assert.ok(Math.hypot(unwrapped.x-initial.x,unwrapped.z-initial.z)<1e-6,'A still fall never acquires sideways motion at a rotated seam');
  if(p.verticalLoopOffset!==before)wraps.push({seconds:(r.frame-fallStart)*r.dt,verticalSpeed:p.vVel,offset:p.verticalLoopOffset-initialOffset});
 }
 assert.equal(wraps.length,5);assert.ok(wraps[0].seconds>3.6&&wraps[0].seconds<4.3);
 for(let i=1;i<wraps.length;i++)assert.ok(Math.abs(wraps[i].seconds-wraps[i-1].seconds-loop.height/r.CONST.maxFallSpeed)<.02);
 assert.equal(p.totalDeaths,deathCount);report.fall=wraps;
 // Held forward and nonzero momentum remain straight in the unwrapped world.
 p.respawn(l,true,false,{position:new THREE.Vector3(700,.1,700),heading:new THREE.Vector3(0,0,-1)});
 p.state='air';p.grounded=false;p.vVel=-52;p.speed=21;p.airFromSkate=true;p.airGrav='board';p.camDir.copy(p.axisF);
 const moveStart=p.pos.clone(),moveDirection=p.axisF.clone(),moveOffset=p.verticalLoopOffset;
 for(let f=0;f<480;f++){
  r.tick({moveY:1});const point=p.pos.clone().applyMatrix4(T(loop,-(p.verticalLoopOffset-moveOffset)));
  const delta=point.sub(moveStart);
  assert.ok(Math.abs(delta.x*moveDirection.z-delta.z*moveDirection.x)<1e-6,'A held direction never bends at the seam');
  assert.ok(delta.dot(moveDirection)>0);assert.equal(p.totalDeaths,deathCount);
 }
 report.movingFall={wraps:(p.verticalLoopOffset-moveOffset)/loop.height,speed:p.speed};
 assert.ok(report.movingFall.wraps>=3);
 // Upward passage uses the exact inverse; upward speed is not discarded.
 p.respawn(l,true,false,{position:new THREE.Vector3(700,191.9,700),heading:new THREE.Vector3(0,0,-1)});
 p.state='air';p.grounded=false;p.vVel=40;p.speed=0;p.camDir.set(0,0,-1);
 const upOffset=p.verticalLoopOffset;r.tick({});
 assert.equal(p.verticalLoopOffset-upOffset,-loop.height);assert.ok(p.vVel>30&&p.pos.y>0&&p.pos.y<1);
 report.upward={position:p.pos.toArray(),verticalSpeed:p.vVel};
 // Fall through the lower cell onto P1's rotated starting deck, using live collision.
 const catchXZ=new THREE.Vector3(0,164,100).applyMatrix4(T(loop,-loop.height));
 p.respawn(l,true,false,{position:new THREE.Vector3(catchXZ.x,4,catchXZ.z),heading:new THREE.Vector3(0,0,-1)});
 const oldOffset=p.verticalLoopOffset;
 for(let f=0;f<300&&!(p.verticalLoopOffset>oldOffset&&p.grounded);f++)r.tick({});
 assert.ok(p.grounded&&p.verticalLoopOffset===oldOffset+loop.height);assert.ok(Math.abs(p.pos.y-164)<.15);
 assert.equal(p.totalDeaths,deathCount);report.catch=r.snapshot();
 // Banked progress survives an actual loop (respawn fixtures above intentionally reset it).
 p.respawn(l,true,false,{position:new THREE.Vector3(cp.p[0],cp.p[1]+.08,cp.p[2]+3),heading:new THREE.Vector3(0,0,-1)});
 for(let i=0;i<240&&!l.activeCheckpoint;i++)r.tick({moveY:1,spinHeld:true,spinPressed:i%30===0});
 const banked=l.activeCheckpoint??checkpoint;p.pos.set(catchXZ.x,4,catchXZ.z);p.prevPos.copy(p.pos);p.state='air';p.grounded=false;p.vVel=-20;p.speed=0;p.snapRenderInterpolation();
 const bankedOffset=p.verticalLoopOffset;
 for(let f=0;f<300&&!(p.verticalLoopOffset>bankedOffset&&p.grounded);f++)r.tick({});
 assert.equal(l.activeCheckpoint,banked);assert.equal(p.totalDeaths,deathCount);
 p.respawn(l,true,false,{position:new THREE.Vector3(15,20.08,-400),heading:new THREE.Vector3(0,0,-1)});
 for(let i=0;i<600&&p.state!=='finished';i++)r.tick(r.steerToward(p.hasCrystal?[15,20,-430]:[15,20,-406]));
 assert.ok(p.hasCrystal);assert.equal(p.state,'finished');report.finish=r.snapshot();
 report.loop=loop;report.counts={platforms:r.source.components.filter(c=>c.t==='platform').length,rails:r.source.components.filter(c=>c.t==='rail').length,branches:l.railChoices.paths.length};
 await writeFile(output+'/native.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({loop,counts:report.counts,fall:wraps,catch:report.catch.position,crystal:p.hasCrystal,finish:p.state}));
},{modulePath:'/src/levels/spaghetti-rails-platforming.ts',source:m=>m.SPAGHETTI_RAILS_PLATFORMING_LEVEL,levelId:'spaghetti-rails-platforming',endlessDeaths:true});
