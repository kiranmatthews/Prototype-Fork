import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const fixture={v:1,name:'Course warp check',spawn:[0,.12,5],killY:-10,components:[
 {t:'platform',p:[0,-.5,-10],s:[24,1,50]}, {t:'gate',p:[0,0,-24]},
]};
await withBlockworksRuntime(async r=>{
 const {l,p,THREE}=r;
 const {Level,findLevel}=await r.server.ssrLoadModule('/src/level.ts');
 const {CAMPAIGN_LEVELS}=await r.server.ssrLoadModule('/src/campaign.ts');
 const {WARP_PAD_TOP}=await r.server.ssrLoadModule('/src/warpPad.ts');
 assert.ok(l.startWarpPosition);
 assert.deepEqual(l.captureData().spawn,fixture.spawn,'derived start changed the authored spawn');
 for(let i=0;i<10;i++)r.tick({});
 assert.ok(p.grounded&&Math.abs(p.pos.y-WARP_PAD_TOP)<.01);
 assert.equal(p.state,'ride','standing on the start pad finished the course');
 const raised=l.spawnPos.y;
 for(let i=0;i<3;i++){p.respawn(l,true);assert.equal(l.spawnPos.y,raised);}
 for(let i=0;i<65;i++)r.tick({moveY:1});
 assert.ok(p.pos.z<2&&p.grounded&&Math.abs(p.pos.y)<.01,'could not walk off the start onto the course');
 let finished=0;p.onFinish=()=>finished++;
 p.pos.set(0,WARP_PAD_TOP+.02,-24);p.settle(l);
 for(let i=0;i<5;i++)r.tick({});
 assert.equal(finished,1,'finish pad did not finish exactly once');
 let courses=0;
 for(const definition of CAMPAIGN_LEVELS){
  const entry=findLevel(definition.levelId)??findLevel(definition.fallbackLevelId);
  if(!entry)continue;
  const level=new Level(new THREE.Scene(),entry);
  try{
   if(level.isBossLevel||level.skatepark||level.hudMode==='hub'){
    assert.equal(level.startWarpPosition,null,'special course gained a standard start pad');continue;
   }
   assert.ok(level.startWarpPosition,`${entry.id}: missing start platform`);
   level.root.updateMatrixWorld(true);
   const from=level.startWarpPosition.clone().add(new THREE.Vector3(0,.12,0));
   const hit=new THREE.Raycaster(from,new THREE.Vector3(0,-1,0),0,.2).intersectObjects(level.groundMeshes,false)[0];
   assert.ok(hit?.object.userData.startWarpPad,`${entry.id}: spawn is not supported by its pad`);
   assert.equal(level.warpPads.filter(pad=>pad.group.name==='level start warp pad').length,1);
   assert.ok(level.warpPads.every(pad=>!pad.group.getObjectByName('warp column')),'idle plasma hides the new travel effect');
   const copy=level.captureData();
   const rebuilt=new Level(new THREE.Scene(),{...entry,data:copy});
   assert.ok(rebuilt.spawnPos.distanceTo(level.spawnPos)<.025,`${entry.id}: capture/import stacked the start pad`);
   rebuilt.dispose(level);courses++;
  }finally{level.dispose();}
 }
 console.log(`PASS level warps: ${courses} campaign starts supported, quiet platforms, stable authoring round trips, reset, walk-off and one-shot finish`);
},{modulePath:'/src/level.ts',levelId:'jungle',source:()=>fixture});
