import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const replayBytes=await readFile(new URL('./fixtures/warehouse-bank-collision.json',import.meta.url));
const replay=JSON.parse(replayBytes.toString('utf8'));
// This regression belongs to the reported October 15 bank, not the current
// level layout. Keep the exact old triangles/coordinates while allowing the
// authored park to evolve independently. Art contributes no collision here.
const fixture=JSON.parse(gunzipSync(await readFile(new URL('./fixtures/warehouse-bank-collision-level.json.gz',import.meta.url))).toString('utf8'));
assert.equal(fixture.version,1);
assert.equal(fixture.provenance.sourceCommit,'197639416ee320da40532c812d196f831b9c3d0a');
assert.equal(fixture.provenance.replay.sha256,createHash('sha256').update(replayBytes).digest('hex'),'historical geometry must use its recorded input fixture');
assert.equal(fixture.provenance.replay.frames,replay.frames);
const data=fixture.data;
assert.equal(data.warehouseArt,false);assert.ok(data.components.every(c=>c.grp!==208));
await withSkateRuntime(async({THREE,server,scene,Level,level,player:p,CONST})=>{
 level.dispose();
 const {WAREHOUSE_PARK_LEVEL:currentData}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
 const report={historicalFixture:fixture.provenance};
 for(const alwaysSkate of[true,false]){
  const l=new Level(scene,{id:'warehouse',name:data.name,data:{...data,alwaysSkate}});
  scene.updateMatrixWorld(true);p.competitionMode=false;p.endlessDeaths=replay.endlessDeaths;p.enterLevel('warehouse');p.respawn(l,true);
  const take=new Replayer(),input=makeInput(),samples=[];let flicker=0,maxFlicker=0;
  const tick=sample=>{p.step(CONST.fixedStep,sample,l);l.update(CONST.fixedStep);sample.consumeEdges();};
  take.begin(replay);
  try{for(let f=0;f<replay.frames;f++){
   const before=p.pos.clone();take.feed(input,p.camDir);tick(input);
   if(f===300)assert.equal(p.freeSkate,alwaysSkate,'idle honors the authored mounting rule');
   const overhead=p.groundHit&&p.groundHit.y>p.pos.y+.8;
   flicker=overhead&&p.pos.distanceTo(before)<.05?flicker+1:0;maxFlicker=Math.max(maxFlicker,flicker);
   if(f===661&&alwaysSkate){assert.equal(p.state,'air');assert.ok(p.pos.y>1&&p.speed>20,'recorded bank exit must retain its roll-out above the side');}
   if(f%30===0||f===661||f===replay.frames-1)samples.push({frame:f+1,position:p.pos.toArray(),state:p.state,skating:p.freeSkate,ground:p.groundHit?.name,bail:p.isBailing});
   assert.ok(p.pos.toArray().every(Number.isFinite));
  }}finally{take.end();}
  assert.equal(maxFlicker,0,'overhead deck must not oscillate between support and air');
  if(alwaysSkate)assert.ok(samples.some(s=>s.position[2]<-90),'recorded steering must clear the reported bank');
  // Recovery may turn and revisit an earlier position. Measure actual free
  // travel before any later death instead of the endpoint after five seconds.
  const end=p.pos.clone(),deaths=p.totalDeaths;let escape=0;
  for(let f=0;f<300;f++){tick(makeInput({moveY:1,jumpHeld:true}));if(p.totalDeaths===deaths)escape=Math.max(escape,p.pos.distanceTo(end));}
  assert.ok(escape>8,'the replay must leave the player able to move');
  report[alwaysSkate?'recordedMountedRules':'walkingEnabled']={maxFlicker,samples,escape};
  l.dispose();
 }
 // Current-source policy/control coverage has no historical coordinates,
 // component-name assumptions or required dimensions. Its normal spawn must
 // still support walking, mounting and braking with the shared park rig.
 const current=new Level(scene,{id:'warehouse',name:currentData.name,data:currentData});scene.updateMatrixWorld(true);p.competitionMode=false;p.endlessDeaths=true;
 assert.equal(current.skatepark,true,'current source retains the competition camera');
 assert.equal(current.alwaysSkate,false,'current source permits walking');
 assert.equal(current.captureData().alwaysSkate,false,'walking policy survives editor capture');
 assert.equal(currentData.cameraRig,undefined,'current source uses shared competition-camera calibration');
 const currentTick=sample=>{const input=makeInput(sample);p.step(CONST.fixedStep,input,current);current.update(CONST.fixedStep);};
 p.respawn(current,true);for(let i=0;i<20;i++)currentTick({});assert.equal(p.freeSkate,false,'spawn on foot');
 const start=p.pos.clone();for(let i=0;i<45;i++)currentTick({moveY:1});assert.equal(p.freeSkate,false);assert.ok(p.pos.distanceTo(start)>2,'walking has direct movement');
 for(let i=0;i<70;i++)currentTick({moveY:1,jumpHeld:true});assert.equal(p.freeSkate,true,'hold jump and direction to mount');
 for(let i=0;i<160;i++)currentTick({grabHeld:true,jumpHeld:true});assert.equal(p.freeSkate,false,'braking to a stop permits dismount');
 for(let i=0;i<30;i++)currentTick({});assert.equal(p.freeSkate,false,'idle cannot force the board back out');
 report.currentSource={controls:{spawnOnFoot:true,walk:true,mount:true,brakeDismount:true},sharedCompetitionCamera:true};
 current.dispose();
 const l=new Level(scene,{id:'warehouse',name:data.name,data});scene.updateMatrixWorld(true);
 const tick=sample=>{const input=makeInput(sample);p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);};
 // Cross actual low rims in both directions, at slow and fast board speeds.
 // Centreline pilots alone miss the side-exit / lower-floor ordering bug.
 report.rims=[];
 for(const name of['Low serpentine pump bank','Curving arrival drop-in','Curving service ramp / ground to 18 m']){
  const c=data.components.find(c=>c.nm===name),v=c.vertices,stations=[];
  for(let k=0;k<v.length;k+=12)if(v[k+1]>.9&&v[k+1]<1.3)stations.push(k);
  assert.ok(stations.length,name);
  // The long ramps have an intentional guard rail on one side; use their
  // open rim. The unguarded pump bank is traversed across both sides.
  const sides=name==='Curving arrival drop-in'?[1]:name==='Curving service ramp / ground to 18 m'?[-1]:[-1,1];
  for(const k of [...new Set([stations[0],stations[stations.length-1]])])for(const sign of sides)for(const speed of[6,23]){
   const centre=new THREE.Vector3((v[k]+v[k+3])/2,v[k+1],(v[k+2]+v[k+5])/2);
   const side=new THREE.Vector3(v[k+3]-v[k],0,v[k+5]-v[k+2]);const reach=side.length()/2+1.5;side.normalize().multiplyScalar(sign);
   p.respawn(l,true,true,{position:centre.clone().add(new THREE.Vector3(0,.02,0)),heading:side});
   p.axisF.copy(side);p.axisL.set(side.z,0,-side.x);p.freeSkate=true;p.speed=speed;
   let frames=0;for(;frames<150;frames++){
    tick({moveY:1,jumpHeld:true});
    if(p.grounded&&p.pos.clone().sub(centre).dot(side)>reach)break;
   }
   if(frames>=150)console.log('rim failure',JSON.stringify({name,station:k/12,sign,speed,centre:centre.toArray(),side:side.toArray(),position:p.pos.toArray(),state:p.state,ground:p.groundHit?.name,grounded:p.grounded,heading:p.axisF.toArray(),bail:p.isBailing,projected:p.pos.clone().sub(centre).dot(side),reach}));
   assert.ok(frames<150,`${name}: side ${sign} at ${speed} m/s trapped the rider`);
   assert.equal(p.isBailing,false,`${name}: an ordinary rim exit must remain controllable`);
   report.rims.push({name,station:k/12,sign,speed,frames,position:p.pos.toArray()});
  }
 }
 // Recovering at the historical wedged position must see the real lower
 // floor, even if a saved position or an earlier build put the body there.
 p.respawn(l,true,true,{position:new THREE.Vector3(-4.354,0,-66.828),heading:new THREE.Vector3(0,0,1)});
 p.pos.y=p.prevPos.y=0;
 for(let i=0;i<30;i++){tick({});assert.ok(p.grounded&&Math.abs(p.pos.y)<.01,'overhead top cannot take floor ownership');}
 l.dispose();
 // A native ramp is a rotated box, not a solidSides custom ribbon. Preserve
 // the newly reported maintenance-ramp floor ownership case independently
 // of future warehouse layout edits, including valid top/ceiling contacts.
 const rampData={v:1,name:'Native ramp support regression',spawn:[-.513,.15,-81.663],killY:-14,skatepark:true,alwaysSkate:false,startWarpPad:false,components:[
  {t:'platform',nm:'Lower floor',p:[0,-1,-83],s:[100,2,100],edgeGrinding:false},
  {t:'ramp',nm:'Reported maintenance ramp',p:[-10,0,-83],rise:8.5,len:28,w:7,yaw:90},
  {t:'ramp',nm:'Clear underpass / ceiling probe',p:[20,4,-83],rise:1,len:10,w:8},
  {t:'gate',p:[40,0,-120]},
 ]};
 const native=new Level(scene,{id:'warehouse-ramp-regression',name:rampData.name,data:rampData});scene.updateMatrixWorld(true);
 const nativeTick=sample=>{const input=makeInput(sample);p.step(CONST.fixedStep,input,native);native.update(CONST.fixedStep);input.consumeEdges();};
 const nativePlace=(position,heading=[0,0,-1])=>{p.respawn(native,true,true,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(...heading)});p.axisF.fromArray(heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);};
 report.nativeRamp={standing:[],sideEntries:[],climb:null,ceiling:null};
 nativePlace(rampData.spawn);
 for(let i=0;i<90;i++){
  nativeTick({});if(i<10)continue;
  assert.ok(p.grounded&&Math.abs(p.pos.y)<.01,'native overhead ramp cannot alternate lower floor ownership at reported position');
  if(i%10===0)report.nativeRamp.standing.push({frame:i,position:p.pos.toArray(),state:p.state,ground:p.groundHit?.name});
 }
 for(const board of[false,true])for(const direction of[-1,1]){
  nativePlace([-.513,.15,direction<0?-75:-91],[0,0,direction]);
  if(board){p.freeSkate=p.airFromSkate=true;p.speed=12;}
  let unsupported=0;
  for(let i=0;i<120;i++){
   const cf=p.camDir;nativeTick({moveX:board?0:cf.x*direction,moveY:board?1:cf.z*direction,jumpHeld:board});if(i>10&&!p.grounded)unsupported++;
   assert.ok(!p.isBailing&&p.pos.y>-.1,'native ramp side entry must retain the lower floor');
  }
  assert.equal(unsupported,0,'walk/board under a native ramp without false ground-loss frames');
  assert.ok(direction*(p.pos.z-(direction<0?-75:-91))>12,'native side underpass remains traversable: '+JSON.stringify({board,direction,position:p.pos.toArray()}));
  report.nativeRamp.sideEntries.push({board,direction,unsupported,position:p.pos.toArray()});
 }
 nativePlace([5,.15,-83],[-1,0,0]);p.freeSkate=p.airFromSkate=true;p.speed=12;let climbHeight=0;
 for(let i=0;i<240&&p.pos.x>-23;i++){nativeTick({moveY:1,jumpHeld:true});climbHeight=Math.max(climbHeight,p.pos.y);assert.equal(p.isBailing,false);}
 assert.ok(climbHeight>7.5,'reachable native ramp top remains a climbable support');report.nativeRamp.climb={height:climbHeight,position:p.pos.toArray()};
 nativePlace([20,.15,-83]);for(let i=0;i<20;i++)nativeTick({jumpHeld:true});nativeTick({jumpReleased:true});let apex=p.pos.y;
 for(let i=0;i<120;i++){nativeTick({});apex=Math.max(apex,p.pos.y);}
 const ceilingMesh=native.groundMeshes.find(m=>m.userData.editorIdx===2),ceilingRay=new THREE.Raycaster(new THREE.Vector3(20,8,-83),new THREE.Vector3(0,-1,0));
 const ceilingHit=ceilingRay.intersectObject(ceilingMesh)[0],ceilingNormal=ceilingHit.face.normal.clone().transformDirection(ceilingMesh.matrixWorld);
 const footLimit=ceilingHit.point.y-ceilingNormal.y-p.hitboxHalf.y*2;
 assert.ok(apex>.1&&Math.abs(apex-footLimit)<.05,'airborne head contact reaches the actual native-ramp underside with current character collision height');
 assert.ok(p.grounded&&Math.abs(p.pos.y)<.01,'ceiling bonk returns to actual floor');report.nativeRamp.ceiling={apex,footLimit,hitboxHeight:p.hitboxHalf.y*2,position:p.pos.toArray()};
 native.dispose();
 if(process.env.WAREHOUSE_COLLISION_REPORT)await writeFile(process.env.WAREHOUSE_COLLISION_REPORT,JSON.stringify(report,null,2));
 console.log('PASS historical recorded bank exit, original rim crossings, overhead support rejection and replay escape; current-source walking / mount / brake / dismount and shared competition-camera policy');
});
