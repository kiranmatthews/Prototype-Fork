import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const fixture={v:1,name:'Race item behaviour',spawn:[0,.1,30],killY:-30,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-100],s:[60,1,420]},{t:'crate',kind:'mystery',p:[20,0,80]},
 {t:'gate',p:[0,0,-200]},{t:'camnode',p:[0,0,100]},{t:'camnode',p:[0,0,-210]}],
 skateRace:{v:1,racers:8,seed:3,line:[[0,0,100,60],[0,0,-200,60]],jumps:[],finishWidth:55,originalLength:225}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),{RACE_ITEMS}=await r.server.ssrLoadModule('/src/race/types.ts');
 const {createRaceItemModel,disposeRaceItemModel}=await r.server.ssrLoadModule('/src/race/items.ts');
 const race=new SkateRace(r.scene,r.p,false,()=>true);race.attach(r.l,'item-fixture');
 const blank=()=>normalizeGameInput({});race.drive=()=>blank();
 const place=(id,x,z)=>{const a=race.riders[id],p=new r.THREE.Vector3(x,0,z);a.player.resetRacePosition(r.l,p,new r.THREE.Vector3(0,0,-1));a.player.invulnTimer=0;a.knockGrace=0;a.shield=0;a.itemCooldown=999;a.progress=a.anchorProgress=race.course.project(p).s;a.anchor.copy(race.course.support(r.l,a.progress));};
 const reset=()=>{race.start('race');race.phase='running';for(let id=0;id<8;id++)place(id,id?20:0,id?45+id*5:30);};
 const tick=(n=1)=>{for(let i=0;i<n;i++){r.scene.updateMatrixWorld(true);race.step(r.dt,blank());r.p.commitRenderStep(r.l);race.commitRenderStep();}};
 const fire=kind=>{race.riders[0].item=kind;assert.equal(race.useItem(),true);};
 const until=(test,max=180)=>{for(let i=0;i<max&&!test();i++)tick();assert.ok(test());};
 const models=[];
 for(const kind of Object.keys(RACE_ITEMS)){
  const model=createRaceItemModel(kind);let meshes=0;model.traverse(o=>{if(o.isMesh)meshes++;});
  const size=new r.THREE.Box3().setFromObject(model).getSize(new r.THREE.Vector3());assert.ok(size.toArray().every(v=>Number.isFinite(v)&&v>0&&v<5));
  if(!['shield','tnt','nitro'].includes(kind))assert.equal(meshes,1,'Solid items share one draw in world and HUD');models.push({kind,meshes});disposeRaceItemModel(model);
 }
 reset();place(1,0,5);fire('green-shell');until(()=>race.riders[1].player.skateCameraBailing);assert.equal(race.riders[2].player.skateCameraBailing,false);
 reset();place(0,27,30);r.p.applyRaceImpulse(new r.THREE.Vector3(1,0,0),0);fire('green-shell');tick(5);
 const ricochet=race.projectiles.find(p=>p.type==='green-shell');assert.ok(ricochet?.bounces>0&&ricochet.direction.x<0);
 reset();place(1,6,5);place(2,-7,-60);fire('red-shell');assert.equal(race.projectiles[0].target,1);tick(10);assert.ok(race.projectiles[0].mesh.position.x>0);until(()=>race.riders[1].player.skateCameraBailing);assert.equal(race.riders[2].player.skateCameraBailing,false);
 reset();place(1,0,5);place(2,6,-30);place(3,8,-28);fire('blue-shell');assert.equal(race.projectiles[0].target,2);until(()=>race.riders[2].player.skateCameraBailing);assert.equal(race.riders[1].player.skateCameraBailing,false);assert.equal(race.riders[3].player.skateCameraBailing,true);
 reset();fire('shock-shell');tick(100);assert.ok(race.riders.slice(1).every(a=>a.player.skateCameraBailing));assert.equal(r.p.skateCameraBailing,false);
 reset();race.riders[3].shield=8;fire('shock-shell');tick(100);assert.equal(race.riders[3].shield,0);assert.equal(race.riders[3].player.skateCameraBailing,false);assert.ok(race.riders.slice(1).filter(a=>a.id!==3).every(a=>a.player.skateCameraBailing));
 reset();place(1,0,35);fire('banana');const peel=race.projectiles[0];assert.ok(peel.mesh.position.z>r.p.pos.z);race.drive=id=>normalizeGameInput(id===1?{moveY:1}:{});until(()=>race.riders[1].player.skateCameraBailing);race.drive=()=>blank();
 reset();r.p.speed=12;fire('mushroom');tick(30);assert.ok(r.p.speed>14);assert.ok(race.riders[0].boost>0);
 reset();r.p.speed=50;fire('mushroom');tick();assert.ok(r.p.speed>42,'A boost cannot chop existing momentum to its target speed');
 reset();fire('shield');assert.equal(race.riders[0].shield,8);r.p.raceHooks.hazard('blast');assert.equal(race.riders[0].shield,0);assert.equal(r.p.skateCameraBailing,false);
 race.start('time-trial');race.phase='running';r.l.raceActorId=0;r.l.breakCrate(r.l.crates[0]);assert.equal(race.riders[0].item,'mushroom');assert.equal(race.riders[0].boxes.size,0);
 assert.ok(race.riders.every(a=>a.player.totalDeaths===0&&a.player.lives===4));
 console.log(JSON.stringify({models,greenHit:true,greenRicochet:true,redNextAhead:true,blueLeaderAndBurst:true,shockAllRivals:true,bananaRearTrap:true,shieldBlocks:true,boostKeepsMomentum:true,trialBoosts:true}));
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'item-fixture'});
