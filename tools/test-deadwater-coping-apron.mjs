import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

// This older replay concatenated menu retries without recording their resets.
// The final retry starts at 3496 (cancelled jump, spawn-facing camera, fresh run).
// Reconstruct that explicit starting state; never guess resets in the game.
const take=JSON.parse(await readFile(new URL('./fixtures/deadwater-apron-replay.json',import.meta.url),'utf8'));
await withSkateRuntime(async({THREE,server,Level,Player,CONST})=>{
 const {findLevel}=await server.ssrLoadModule('/src/level.ts');
 const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
 const level=new Level(new THREE.Scene(),findLevel(take.level));
 level.update(0);level.scene.updateMatrixWorld(true);
 const p=new Player(level.scene),replay=new Replayer(),input=makeInput();
 p.enterLevel(take.level);p.competitionMode=true;p.endlessDeaths=true;p.respawn(level,true,true);
 replay.begin(take);replay.frame=3496;
 try {
  for(let frame=3496;frame<=4199;frame++) {
   assert.ok(replay.feed(input,p.camDir));p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
   assert.equal(p.isBailing,false,`reported approach hit the apron at replay frame ${frame}`);
  }
  assert.ok(p.groundHit?.halfpipe===level.halfpipes[4],'recorded approach must reach the first orange pool');
  console.log('PASS reported final-run approach: no false apron impact at frame 4199.');
  replay.end();
  const hp=level.halfpipes[4];
  const place=(position,heading,speed)=>{
   p.respawn(level,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);
   p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.speed=speed;p.freeSkate=true;
   p.groundHit=p.queryGround(level);assert.ok(p.groundHit);p.rideNormal.copy(p.groundHit.normal);
  };
  let cases=0,pipeReturns=0,galleryReturns=0;
  // South of the upper gallery, which intentionally covers the north end.
  for(const z of [-158.25,-160,-164,-167.5])for(const angle of [-.2,0,.2])for(const release of [false,true]) {
   const position=hp.worldPos(-(hp.flatHalf+hp.radius*Math.PI/3),z,new THREE.Vector3());
   place(position,new THREE.Vector3(-1,0,angle).normalize(),23);
   let launch=false,landed=false,released=false,contacts=0;
   const nativeSmack=p.wallSmack;
   p.wallSmack=(...args)=>{contacts++;return nativeSmack.apply(p,args)};
   try {
    for(let frame=0;frame<240;frame++) {
     const edge=release&&!released&&p.grounded&&p.rideNormal.y<.16;released ||= edge;
     const sample=makeInput({jumpHeld:!released,jumpPressed:frame===0,jumpReleased:edge});
     p.step(CONST.fixedStep,sample,level);level.update(CONST.fixedStep);
     assert.equal(p.isBailing,false,`apron approach/return bailed: ${JSON.stringify({z,angle,release,frame})}`);
     if(p.vertAir){launch=true;assert.ok(p.hangPipe===hp)}
     if(launch&&p.grounded){
      if(p.groundHit?.halfpipe===hp){assert.ok(p.speed>8,`drop-in lost momentum at ${z}, angle=${angle}`);pipeReturns++;}
      else {
       // Lateral travel toward the north end can land on its real gallery.
       assert.ok(p.pos.z>=-158&&p.groundHit?.name==='Coaster upper gallery'&&p.groundHit.normal.y>.98,
        `wrong return surface: ${p.groundHit?.name}, z=${z}, angle=${angle}, release=${release}`);
       galleryReturns++;
      }
      landed=true;break;
     }
    }
    assert.ok(launch&&landed,`missing air/return: ${JSON.stringify({z,angle,release})}`);
    assert.equal(contacts,0,'apron must not push or stop a rider during ascent or drop-in');cases++;
   } finally {p.wallSmack=nativeSmack}
  }
  // The entry is still a continuous supported deck, including the new lip.
  for(const x of [-3.9,-.8,-.7,-.35,-.01]) {
   place(new THREE.Vector3(x,18.05,-160),new THREE.Vector3(1,0,0),0);
   assert.ok(Math.abs(p.groundHit.y-18)<1e-6,`entry lost support at ${x}`);
  }
  for(const z of [-151,-160,-169]) {
   place(new THREE.Vector3(-3,18.05,z),new THREE.Vector3(1,0,0),12);
   let reachedFloor=false;
   for(let frame=0;frame<180&&!reachedFloor;frame++) {
    p.step(CONST.fixedStep,makeInput({jumpHeld:true}),level);level.update(CONST.fixedStep);
    assert.equal(p.isBailing,false,'entering across the apron must remain a clean drop-in');
    reachedFloor=p.grounded&&p.groundHit?.halfpipe===hp&&p.pos.y<7;
   }
   assert.ok(reachedFloor,`entry did not reach the pool floor: ${JSON.stringify({z,pos:p.pos.toArray(),ground:p.groundHit?.name,state:p.state,speed:p.speed})}`);
  }
  const body=level.walls.find(w=>Math.abs(w.min.x+4)<1e-6&&Math.abs(w.max.x+.75)<1e-6&&Math.abs(w.min.z+170)<1e-6);
  assert.ok(body&&body.min.y<17&&body.max.y>17.7,'the recessed deck body must remain solid');
  console.log(`PASS ${cases} authored airs (${pipeReturns} pool returns, ${galleryReturns} gallery landings), five supported apron points, three forward drop-ins and retained solid deck body.`);
 } finally {replay.end();level.dispose()}
});
