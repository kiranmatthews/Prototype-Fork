import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({server,THREE,Level,player})=>{
 const {createKookState,resetKook,stepKook,KOOK}=await server.ssrLoadModule('/src/enemies/kookBehavior.ts');
 const {KookSquawk,kookSquawkHits}=await server.ssrLoadModule('/src/enemies/kookSquawk.ts');
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const {ROOFTOP_RELAY_LEVEL:data}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const fixture=(role,bearing=0)=>{const e={kook:createKookState(role,1,bearing),state:'',stateT:0,alive:true,body:new THREE.Group(),group:new THREE.Group(),homePosition:new THREE.Vector3(),x0:-3,x1:3,dir:1,speed:1,axis:'x',cross:0};resetKook(e);return e;};
 let shots=[],blocked=false,cues=[];
 let gunner=fixture('gunner');const ctx={player:new THREE.Vector3(0,0,12),enemies:[gunner],blocked:()=>blocked,fire:(e,target)=>shots.push(target.clone()),cue:(e,c)=>cues.push(c)};
 const tick=(seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)for(const e of ctx.enemies)if(e.alive)stepKook(e,1/60,ctx);};
 tick(.9);assert.equal(shots.length,0,'Aim must telegraph the shot');tick(.6);assert.equal(shots.length,1,'Gunner fires without a goose or alarm');
 const n=shots.length;blocked=true;tick(5);assert.equal(shots.length,n,'Opaque cover prevents shots');
 ctx.player.set(1000,0,1000);resetKook(gunner);const seen=[];for(let i=0;i<900;i++){stepKook(gunner,1/60,ctx);seen.push(gunner.group.position.z);assert.ok(gunner.group.position.distanceTo(gunner.homePosition)<=3.001);}
 assert.ok(Math.max(...seen)>2.9&&Math.min(...seen)<-2.9,'Gunner must patrol both directions');
 const goose=fixture('lookout',.7);ctx.enemies=[goose];blocked=false;ctx.player.set(0,0,12);tick(.3);assert.equal(goose.state,'windup');tick(.65);const locked=goose.kook.target.clone();ctx.player.x=5;tick(.2);assert.equal(goose.state,'shriek');assert.deepEqual(goose.kook.target.toArray(),locked.toArray(),'Squawk aim is locked before discharge');
 tick(KOOK.squawk+.1);assert.equal(goose.state,'recover');tick(KOOK.recover+.1);assert.equal(goose.state,'patrol');
 resetKook(goose);blocked=true;tick(4);assert.equal(goose.kook.alarms,0);assert.equal(goose.state,'patrol');assert.ok(goose.group.position.length()>.1);
 const beam=new KookSquawk(),root=new THREE.Group();root.add(beam);goose.group.userData.kookSquawk=beam;goose.state='shriek';
 const origin=new THREE.Vector3(0,2,0),aim=new THREE.Vector3(0,2,20),box=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(0,2,10),new THREE.Vector3(.8,1.6,.8));
 beam.pose(origin,aim,'windup',.8,true);assert.equal(kookSquawkHits(goose,box,()=>false),false,'Telegraph is harmless');
 beam.pose(origin,aim,'shriek',.3,true);assert.equal(kookSquawkHits(goose,box,()=>false),true,'Visible sound cone damages');
 assert.equal(kookSquawkHits(goose,box,()=>true),false,'Solid cover stops damage');
 box.translate(new THREE.Vector3(4,0,0));assert.equal(kookSquawkHits(goose,box,()=>false),false,'Sidestep clears cone');
 box.translate(new THREE.Vector3(-4,0,-16));assert.equal(kookSquawkHits(goose,box,()=>false),false,'Behind emitter is safe');
 beam.clip((a,b)=>b.z>=6);assert.ok(beam.length<=6&&beam.length>5.8);box.translate(new THREE.Vector3(0,0,16));assert.equal(kookSquawkHits(goose,box,()=>false),false,'Clipped visual has matching damage extent');
 beam.pose(origin,aim,'recover',0,true);assert.equal(beam.active,false);beam.dispose();
 const enemies=data.components.filter(c=>c.kookRole);assert.equal(enemies.length,7);assert.ok(enemies.every(c=>c.range>0&&c.speed>0&&c.terrainSupports));
 const level=new Level(new THREE.Scene(),{id:'anthro-size',name:'Anthro',data:{...data,components:[{t:'platform',p:[0,-.5,0],s:[40,1,40]},...enemies.map((e,i)=>({...e,p:[i*4-12,0,0]})),{t:'gate',p:[0,0,-15]}]}});
 try{
  level.playerPos.set(1000,0,1000);
  for(const reset of [false,true]){if(reset)level.reset(true);level.update(1/60);
   for(const e of level.enemies){assert.equal(e.state,'patrol');assert.equal(e.body.scale.y,1.7);assert.ok(e.x1>e.x0);const size=e.box.getSize(new THREE.Vector3());assert.ok(Math.abs(size.y-(e.kook.role==='lookout'?2.35:2.5)*1.7)<1e-9);}}
  for(const c of level.captureData().components.filter(c=>c.kookRole)){assert.ok(c.range>0);assert.equal(c.s[1],(c.kookRole==='lookout'?2.35:2.5)*1.7);}
 }finally{level.dispose();}
 assert.ok(normalizeCustomLevelData({...data,components:[...enemies,{t:'gate',p:[0,0,-50]}]}));
 const fatalLevel=new Level(new THREE.Scene(),{id:'fatal-squawk',name:'Squawk',data:{v:1,name:'Squawk',spawn:[0,.1,10],killY:-10,components:[{t:'platform',p:[0,-.5,5],s:[40,1,50]},{t:'enemy',p:[-10,0,0],range:0,foe:'grunt',kookRole:'lookout'},{t:'gate',p:[0,0,-15]}]}});
 try{
  player.respawn(fatalLevel,true);player.pos.set(0,0,10);player.prevPos.copy(player.pos);player.playerBox.setFromCenterAndSize(new THREE.Vector3(0,1,10),new THREE.Vector3(.8,1.8,.8));
  player.invulnTimer=player.uberTimer=0;player.maskCount=2;
  const foe=fatalLevel.enemies[0];foe.state='shriek';const b=new KookSquawk();foe.group.userData.kookSquawk=b;b.pose(new THREE.Vector3(0,1,0),new THREE.Vector3(0,1,20),'shriek',.3,true);
  let deaths=0,masks=0;const die=player.die,spend=player.spendMask;player.die=()=>{deaths++;};player.spendMask=()=>{masks++;return true;};
  try{player.collide(fatalLevel);assert.equal(deaths,1,'Squawk must reach the actual player death path');assert.equal(masks,0,'The fatal beam cannot be absorbed by a mask');player.hangHazards(fatalLevel);assert.equal(deaths,2,'Hanging does not shelter the player from the fatal squawk');assert.equal(masks,0);player.invulnTimer=2;player.hangHazards(fatalLevel);assert.equal(deaths,2,'Spawn invulnerability still applies');}
  finally{player.die=die;player.spendMask=spend;b.dispose();}
 }finally{fatalLevel.dispose();}
 const report={animals:7,independentShooting:true,allPatrol:true,aimLock:true,squawkCone:true,telegraphSafe:true,sidestep:true,coverClipsVisualAndDamage:true,reset:true,authoredSizeMultiplier:1.7};
 await mkdir('docs/rooftop-kook/anthro',{recursive:true});await writeFile('docs/rooftop-kook/anthro/gameplay.json',JSON.stringify(report,null,2)+'\n');console.log('PASS',JSON.stringify(report));
});
