import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const replay=JSON.parse(await readFile(new URL('./fixtures/warehouse-bank-collision.json',import.meta.url),'utf8'));
await withSkateRuntime(async({THREE,server,scene,Level,level,player:p,CONST})=>{
 level.dispose();
 const {WAREHOUSE_PARK_LEVEL:data}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
 const report={};
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
  if(alwaysSkate)assert.ok(p.pos.z<-90,'recorded steering must clear the reported bank');
  const end=p.pos.clone();for(let f=0;f<300;f++)tick(makeInput({moveY:1,jumpHeld:true}));
  assert.ok(p.pos.distanceTo(end)>8,'the replay must leave the player able to move');
  report[alwaysSkate?'recordedMountedRules':'walkingEnabled']={maxFlicker,samples,escape:p.pos.distanceTo(end)};
  l.dispose();
 }
 // Keep the level's real park physics while exercising normal foot/board transitions.
 const l=new Level(scene,{id:'warehouse',name:data.name,data});scene.updateMatrixWorld(true);p.competitionMode=false;p.endlessDeaths=true;
 const tick=sample=>{const input=makeInput(sample);p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);};
 p.respawn(l,true);for(let i=0;i<20;i++)tick({});assert.equal(p.freeSkate,false,'spawn on foot');
 const start=p.pos.clone();for(let i=0;i<45;i++)tick({moveY:1});assert.equal(p.freeSkate,false);assert.ok(p.pos.distanceTo(start)>2,'walking has direct movement');
 for(let i=0;i<70;i++)tick({moveY:1,jumpHeld:true});assert.equal(p.freeSkate,true,'hold jump and direction to mount');
 for(let i=0;i<160;i++)tick({grabHeld:true});assert.equal(p.freeSkate,false,'braking to a stop permits dismount');
 for(let i=0;i<30;i++)tick({});assert.equal(p.freeSkate,false,'idle cannot force the board back out');
 report.controls={spawnOnFoot:true,walk:true,mount:true,brakeDismount:true};
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
 if(process.env.WAREHOUSE_COLLISION_REPORT)await writeFile(process.env.WAREHOUSE_COLLISION_REPORT,JSON.stringify(report,null,2));
 console.log('PASS recorded bank exit, overhead support rejection, replay escape, and walking / mount / brake / dismount');
});
