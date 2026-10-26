import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const data={v:1,name:'Race explosives',spawn:[0,.1,30],killY:-30,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-100],s:[80,1,420]},
 ...['tnt','nitro','mystery','empty'].map((kind,i)=>({t:'crate',kind,p:[22+i*3,0,75]})),
 {t:'checkpoint',p:[0,0,-30]},{t:'gate',p:[0,0,-200]},{t:'camnode',p:[0,0,100]},{t:'camnode',p:[0,0,-210]}],
 skateRace:{v:1,racers:8,seed:19,line:[[0,0,100,80],[0,0,-200,80]],jumps:[],finishWidth:65,originalLength:300}};
for(const vehicle of [undefined,'golf-cart'])await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts'),{RaceItemDeck}=await e.server.ssrLoadModule('/src/race/itemOdds.ts');
 const {normalizeCustomLevelData,Level}=await e.server.ssrLoadModule('/src/level.ts');
 const normalized=normalizeCustomLevelData(structuredClone(e.source));assert.equal(normalized.components.some(c=>c.t==='checkpoint'),false);
 assert.equal(e.l.checkpoints.length,0);assert.equal(e.l.totalCrates,1,'Ammo is excluded from the box gem');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'explosives');const blank=()=>normalizeGameInput({});
 const place=(id,x,z,y=0)=>{const r=race.riders[id],at=new e.THREE.Vector3(x,y,z);r.player.resetRacePosition(e.l,at,new e.THREE.Vector3(0,0,-1));r.player.invulnTimer=0;r.knockGrace=0;r.recovery=0;r.shield=r.star=0;r.itemCooldown=999;r.progress=r.anchorProgress=race.course.project(at).s;r.anchor.copy(at);
  if(race.carts){const c=race.carts.fleet.physics.carts[race.carts.cartForRacer[id]];Object.assign(c,{x,y,z,yaw:0,vx:0,vy:0,vz:0,speed:0,grounded:!y,health:1,cooldown:0});race.carts.sync();}
 };
 const reset=()=>{race.start('race',19);race.phase='running';race.drive=()=>blank();if(race.carts)race.carts.drive=()=>blank();for(let id=0;id<8;id++)place(id,id?30:0,id?-20-id*12:30);};
 const tick=(n=1)=>{for(let i=0;i<n;i++)race.step(e.dt,blank());};
 const fire=kind=>{race.riders[0].item=kind;assert.ok(race.useItem());return race.projectiles.at(-1);};
 const harmed=id=>race.carts?race.carts.fleet.physics.carts[race.carts.cartForRacer[id]].health<.99:race.riders[id].player.skateCameraBailing;
 for(const rank of [1,4,8]){const deck=new RaceItemDeck();deck.reset(87557);const choices=new Set();for(let n=0;n<1000;n++)choices.add(deck.draw(rank,120,true,false,!!vehicle));assert.ok(choices.has('tnt')&&choices.has('nitro'),'Both items are available at every race position');}
 reset();
 for(const ammo of ['tnt','nitro']){
  const box=e.l.crates.find(c=>c.raceItem===ammo);assert.ok(box?.mystery&&!box.tnt&&!box.nitro);
  const original=box.mesh.position.clone();race.riders[0].item='shield';place(0,original.x,original.z);tick(2);assert.ok(box.alive,'A full slot leaves ammo for another racer');
  race.riders[0].item=null;tick(2);assert.equal(box.alive,false);assert.equal(race.riders[0].item,ammo);assert.equal(harmed(0),false);assert.equal(race.riders[0].boxes.size,0);
  place(0,0,30);tick(245);assert.ok(box.alive,'Ammo returns for following racers');
 }
 reset();const tnt=fire('tnt');place(1,tnt.mesh.position.x,tnt.mesh.position.z);place(2,tnt.mesh.position.x+2,tnt.mesh.position.z);race.riders[2].shield=8;
 tick(160);assert.equal(harmed(1),false,'The fuse gives a real warning');assert.ok(tnt.mesh.userData.explosiveBundle.remaining>0);tick(23);
 assert.ok(harmed(1),'TNT blast hits the rival');assert.equal(harmed(0),false);assert.equal(harmed(2),false);assert.equal(race.riders[2].shield,0);assert.equal(race.projectiles.length,0);
 reset();const nitro=fire('nitro');tick(40);assert.equal(race.projectiles.length,1,'Nitro waits for contact');place(1,nitro.mesh.position.x,nitro.mesh.position.z);tick();assert.ok(harmed(1));assert.equal(harmed(0),false);assert.equal(race.projectiles.length,0);
 reset();const jump=fire('nitro');tick(40);place(1,jump.mesh.position.x,jump.mesh.position.z,6);tick();assert.equal(harmed(1),false);assert.equal(race.projectiles.length,1,'Airborne racers can clear Nitro');
 reset();const first=fire('tnt'),second=fire('nitro');first.time=2.99;tick();assert.equal(race.projectiles.length,0,'Explosions chain exactly once');assert.equal(second.time,99);
 reset();const trap=fire('nitro');race.riders[1].item='green-shell';place(1,trap.mesh.position.x,trap.mesh.position.z+10);race.useItem(1);tick(30);assert.ok(!race.projectiles.some(p=>p.type==='nitro'),'Shells clear mines');
 reset();fire('nitro');race.riders[0].item='horn';race.useItem();tick();assert.equal(race.projectiles.length,0,'Horn clears mines safely');
 reset();const abandoned=fire('tnt');race.reset();assert.equal(race.projectiles.length,0);assert.equal(abandoned.mesh.parent,null);assert.equal(abandoned.mesh.userData.explosiveBundle.disposed,true);
 race.start('time-trial',19);race.phase='running';e.l.raceActorId=0;e.l.breakCrate(e.l.crates[0]);assert.equal(race.riders[0].item,'mushroom','Solo trial ammo becomes useful boosts');
 // Ordinary campaign crates retain their lethal/explosive rules and checkpoints.
 const ordinary=new Level(e.scene,{id:'ordinary',name:'Ordinary',data:{...structuredClone(data),skateRace:undefined}},e.l);
 assert.equal(ordinary.checkpoints.length,1);assert.ok(ordinary.crates[0].tnt&&!ordinary.crates[0].mystery);assert.ok(ordinary.crates[1].nitro&&!ordinary.crates[1].mystery);ordinary.dispose();
 console.log(`PASS ${vehicle??'skate'}: pickups, full slot, respawn, deck, TNT fuse/blast/shield, Nitro contact/air dodge, chain, interception, horn, cleanup, trials, campaign unchanged`);
},{modulePath:'/src/levels/slipstream.ts',source:()=>({...structuredClone(data),skateRace:{...data.skateRace,vehicle}}),levelId:'explosives'});
const pack=JSON.parse(await readFile('public/levels.json','utf8'));for(const e of pack.levels.filter(e=>e.data?.skateRace))assert.ok(e.data.components.every(c=>c.t!=='checkpoint'),`${e.id} source snapshot has no checkpoints`);
