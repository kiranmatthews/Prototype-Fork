import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({server,THREE,Level})=>{
 const {createKookState,resetKook,stepKook}=await server.ssrLoadModule('/src/enemies/kookBehavior.ts');
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const {ROOFTOP_RELAY_LEVEL:data}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const fixture=(role,group=1,x=0,z=0)=>{const e={kook:createKookState(role,group,0),state:'',stateT:0,alive:true,body:new THREE.Group(),group:new THREE.Group()};e.group.position.set(x,0,z);resetKook(e);return e;};
 let karen=fixture('lookout'),gunner=fixture('gunner',1,-5,-8),other=fixture('gunner',2,5,-8),blocked=false,shots=0,cues=[];
 const ctx={player:new THREE.Vector3(0,0,12),enemies:[karen,gunner,other],blocked:()=>blocked,fire:()=>shots++,cue:(e,c)=>cues.push(c)};
 const tick=(seconds)=>{for(let t=0;t<seconds;t+=1/60)for(const e of ctx.enemies)if(e.alive)stepKook(e,1/60,ctx);};
 // Proximity cannot wake gunners, and opaque cover hides the player.
 blocked=true;tick(10);assert.equal(shots,0);assert.equal(karen.kook.alarms,0);assert.equal(gunner.state,'doze');
 blocked=false;ctx.player.z=-15;tick(3);assert.equal(karen.kook.alarms,0,'lookout must see the approach');
 ctx.player.z=12;tick(.5);assert.equal(karen.state,'windup');assert.equal(gunner.state,'doze');
 karen.alive=false;tick(2);assert.equal(shots,0,'interrupting lookout must prevent alarm');
 karen.alive=true;resetKook(karen);tick(1.2);assert.equal(karen.kook.alarms,1);assert.equal(gunner.state,'wake');assert.equal(other.state,'doze');assert.equal(shots,0);
 tick(1.3);assert.equal(shots,0,'wake and aim must telegraph the first shot');tick(1);assert.ok(shots>0);
 const first=shots;blocked=true;tick(4);assert.equal(shots,first,'cover must stop new shots');
 resetKook(gunner);assert.equal(gunner.state,'doze');assert.equal(gunner.kook.awake,0);
 const enemies=data.components.filter(c=>c.kookRole);assert.equal(enemies.filter(c=>c.kookRole==='lookout').length,3);assert.equal(enemies.filter(c=>c.kookRole==='gunner').length,4);
 const sizing=new Level(new THREE.Scene(),{id:'kook-size',name:'Kook size',data:{...data,components:[...enemies,{t:'gate',p:[0,0,-50]}]}});
 try{
  for(const reset of [false,true]){
   if(reset)sizing.reset(true);sizing.update(1/60);
   for(const e of sizing.enemies){
    assert.ok(Math.abs(e.body.scale.y-1.7)<1e-12,'Every courtyard enemy must retain 1.7x artwork scale after reset');
    const size=e.box.getSize(new THREE.Vector3()),height=(e.kook.role==='lookout'?2.35:2.5)*1.7;
    assert.ok(Math.abs(size.x-1.05*1.7)<1e-9&&Math.abs(size.y-height)<1e-9,'Combat bounds must match the enlarged enemy');
   }
  }
  for(const c of sizing.captureData().components.filter(c=>c.kookRole))
   assert.equal(c.s[1],(c.kookRole==='lookout'?2.35:2.5)*1.7,'Editor capture must retain the authored enemy height');
 }finally{sizing.dispose();}
 // Visibility starts at the resized head, so a roof-level obstruction cannot
 // accidentally masquerade as cover for a much taller character.
 const tall=fixture('lookout');tall.body.scale.setScalar(1.7);let sightHeight;
 stepKook(tall,1/60,{...ctx,enemies:[tall],blocked:from=>{sightHeight=from.y;return true;}});
 assert.equal(sightHeight,1.95*1.7);
 assert.equal(data.components.filter(c=>c.t==='crate'&&c.kind==='metal').length,24,'every gunner needs its authored cover stack');
 const subset={...data,components:[...enemies,{t:'gate',p:[0,0,-50]}]};assert.ok(normalizeCustomLevelData(subset));
 assert.equal(normalizeCustomLevelData({...subset,components:[{...enemies[0],alertGroup:-1},subset.components.at(-1)]}),null);
 const level=new Level(new THREE.Scene(),{id:'kook-cover-test',name:'Kook cover',data:{v:1,name:'Kook cover',spawn:[0,.1,5],killY:-10,components:[{t:'platform',p:[0,-.5,0],s:[20,1,30]},{t:'crate',p:[0,0,0],kind:'metal'},{t:'crate',p:[0,.96,0],kind:'metal'},{t:'gate',p:[0,0,-12]}]}});
 try{
  const from=new THREE.Vector3(0,1.6,-5),to=new THREE.Vector3(0,.8,5);
  assert.equal(level.projectilePathBlocked(from,to),true,'stacked cases stop a bullet');
  for(const c of level.crates)c.alive=false;
  assert.equal(level.projectilePathBlocked(from,to),false,'destroyed cover cannot keep blocking');
 }finally{level.dispose();}
 const report={lookouts:3,gunners:4,sizeMultiplier:1.7,scaledBounds:true,sizeSurvivesReset:true,sizeSurvivesCapture:true,groupIsolation:true,visibility:true,interruptibleAlarm:true,telegraphedShot:true,cover:true,reset:true};
 await writeFile('docs/rooftop-kook/validation/enemies.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
});
