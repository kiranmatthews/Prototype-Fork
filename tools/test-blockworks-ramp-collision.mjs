import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {makeInput} from './jungle-cup-harness.mjs';

await withBlockworksRuntime(async r=>{
 const {THREE,l,p,source,sourceModule,server,CONST}=r;
 const {MeshSideCollisions}=await server.ssrLoadModule('/src/meshSideCollisions.ts');
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const ramps=sourceModule.BLOCKWORKS_SKATE_RAMPS, half=CONST.playerHalf;
 let contacts=0;
 for(const wedge of ramps){
  const component=source.components.find(c=>c.nm===wedge.name);
  assert.equal(component.solidSides,true,wedge.name);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(component.vertices,3));
  geometry.setIndex(component.indices);
  const mesh=new THREE.Mesh(geometry);mesh.position.fromArray(component.p);
  const sides=new MeshSideCollisions();let active=true;sides.add(mesh,()=>active);
  const low=new THREE.Vector3(...wedge.low),high=new THREE.Vector3(...wedge.high);
  const forward=high.clone().sub(low).setY(0).normalize(),right=new THREE.Vector3(-forward.z,0,forward.x);
  const centre=low.clone().lerp(high,.85).setY(low.y);
  for(const body of [half,{...half,y:.15}])for(const sign of [-1,1]){
   const from=centre.clone().addScaledVector(right,sign*(wedge.width/2+2));
   const end=centre.clone().addScaledVector(right,-sign*2),normal=new THREE.Vector3();
   assert.ok(sides.resolve(from,end,body,normal),`${wedge.name}: side ${sign} must be solid`);
   const reach=Math.abs(right.x)*body.x+Math.abs(right.z)*body.z;
   assert.ok(end.clone().sub(centre).dot(right)*sign>=wedge.width/2+reach-.01,`${wedge.name}: stance lost horizontal clearance`);
   assert.ok(normal.dot(right)*sign>.5,`${wedge.name}: wrong separation direction`);
   const above=from.clone().setY(high.y+.1),aboveEnd=end.clone().setY(high.y+.1);
   assert.equal(sides.resolve(above,aboveEnd,body,normal),false,'air above the ramp stays clear');
   active=false;
   const ghostEnd=centre.clone();assert.equal(sides.resolve(from,ghostEnd,body,normal),false,'ghost must not block');active=true;
   contacts++;
  }
  const back=high.clone().setY(low.y).addScaledVector(forward,2),backEnd=high.clone().setY(low.y).addScaledVector(forward,-2);
  assert.ok(sides.resolve(back,backEnd,half,new THREE.Vector3()),`${wedge.name}: high end must be solid`);
  assert.ok(backEnd.clone().sub(high).dot(forward)>0,`${wedge.name}: crossed high-end wall`);contacts++;
  sides.dispose();geometry.dispose();mesh.material.dispose();
 }

 // The actual switch-owned collision must follow activation and checkpoint
 // state, not just rendering visibility or a separate always-solid proxy.
 const ghost=ramps.find(w=>w.gated),lo=new THREE.Vector3(...ghost.low),hi=new THREE.Vector3(...ghost.high);
 const dir=hi.clone().sub(lo).setY(0).normalize(),side=new THREE.Vector3(-dir.z,0,dir.x);
 const centre=lo.clone().lerp(hi,.85).setY(lo.y);
 const ghostContact=()=>l.meshSideCollisions.resolve(centre.clone().addScaledVector(side,ghost.width/2+1),centre.clone(),half,new THREE.Vector3());
 assert.equal(ghostContact(),false);
 for(const crate of l.crates.filter(c=>c.bang))l.triggerBang(crate);
 assert.equal(ghostContact(),true);
 l.activateCheckpoint(l.checkpoints[0],0,0,0,0);l.reset(false);assert.equal(ghostContact(),true);
 l.reset(true);assert.equal(ghostContact(),false);
 l.activateCheckpoint(l.checkpoints[0],0,0,0,0);
 for(const crate of l.crates.filter(c=>c.bang))l.triggerBang(crate);
 l.reset(false);assert.equal(ghostContact(),false);
 const captured=l.captureData();assert.ok(normalizeCustomLevelData(captured));
 assert.equal(captured.components.filter(c=>c.solidSides).length,19);
 const invalid=structuredClone(captured);invalid.components.find(c=>c.solidSides).solid=false;
 assert.equal(normalizeCustomLevelData(invalid),null,'non-solid scenery cannot opt into player walls');

 // Last fresh-spawn approach from the user's 43,490-frame recording. The
 // old controller enters the Entry shelf access side at source frame 34998
 // and alternates grounded/air indefinitely, preventing bail recovery.
 const take=JSON.parse(await readFile(new URL('./fixtures/blockworks-ramp-side-replay.json',import.meta.url),'utf8'));
 const {Replayer,isReplayFile}=await server.ssrLoadModule('/src/replay.ts');assert.ok(isReplayFile(take));
 p.respawn(l,true);p.endlessDeaths=true;
 const replay=new Replayer(),input=makeInput();replay.begin(take);
 const entryLow=new THREE.Vector3(...ramps[0].low),entryHigh=new THREE.Vector3(...ramps[0].high);
 const entryDirection=entryHigh.clone().sub(entryLow).setY(0),entryLength=entryDirection.length();entryDirection.normalize();
 let unrecovered=0,maxUnrecovered=0,approachDistance=Infinity;
 for(let frame=0;frame<take.frames;frame++){
  replay.feed(input,p.camDir);p.rawInput=input;p.step(r.dt,input,l);l.update(r.dt);p.commitRenderStep(l);
  unrecovered=p.isBailing?unrecovered+1:0;maxUnrecovered=Math.max(maxUnrecovered,unrecovered);
  const along=THREE.MathUtils.clamp(p.pos.clone().sub(entryLow).dot(entryDirection),0,entryLength);
  approachDistance=Math.min(approachDistance,p.pos.distanceTo(entryLow.clone().addScaledVector(entryDirection,along)));
  assert.ok(!['dead','gameover'].includes(p.state),'recorded approach must remain playable');
  input.consumeEdges();
 }
 replay.end();
 assert.ok(approachDistance<2,'fixture must reach the reported ramp side');
 assert.ok(maxUnrecovered<180,`ramp trapped recovery for ${maxUnrecovered} frames`);
 assert.equal(p.isBailing,false);assert.equal(p.grounded,true);
 assert.ok(p.pos.distanceTo(new THREE.Vector3(22.409,0,-52.823))>2,'recorded steering must leave the trap');
 // A wipeout beside the sealed side can still finish its supported settle.
 const first=ramps[0],firstLow=new THREE.Vector3(...first.low),firstHigh=new THREE.Vector3(...first.high);
 const f=firstHigh.clone().sub(firstLow).setY(0).normalize(),right=new THREE.Vector3(-f.z,0,f.x);
 const beside=firstLow.clone().lerp(firstHigh,.85).setY(firstLow.y+.02).addScaledVector(right,first.width/2+1);
 p.respawn(l,true,false,{position:beside});r.stepFor(2);p.bail(false,0);
 r.stepFor(180);assert.ok(!p.isBailing&&p.grounded,'side-adjacent wipeout must recover');
 console.log(`PASS ${contacts} swept wedge side/end contacts, top clearance, ghost/checkpoint lifecycle, capture and recorded approach recovery (${maxUnrecovered} frames).`);
});
