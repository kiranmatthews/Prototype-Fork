import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const fixture={v:1,name:'Waterslide items',spawn:[0,.1,0],killY:-40,startWarpPad:false,components:[{t:'platform',p:[0,-.5,-80],s:[60,1,500]},{t:'crate',kind:'mystery',p:[25,0,80]},{t:'gate',p:[0,0,-280]},{t:'camnode',p:[0,0,100]},{t:'camnode',p:[0,0,-280]}],skateRace:{v:1,racers:8,seed:19410,line:[[0,0,100,60],[0,0,-280,60]],jumps:[],finishWidth:55,originalLength:380}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),{RaceItemDeck}=await r.server.ssrLoadModule('/src/race/itemOdds.ts');
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'item-fixture');const blank=()=>normalizeGameInput({});
 const place=(id,x,z)=>{const a=race.riders[id],p=new r.THREE.Vector3(x,0,z);a.player.resetRacePosition(r.l,p,new r.THREE.Vector3(0,0,-1));a.player.invulnTimer=0;a.progress=race.course.project(p).s;a.knockGrace=0;a.itemCooldown=999;};
 const reset=()=>{race.start('race',19410);race.phase='running';race.drive=()=>blank();for(let i=0;i<8;i++)place(i,i>1?25:0,i?34+i*5:0);place(1,0,34);};
 const tick=(n=1,input={})=>{for(let i=0;i<n;i++){r.scene.updateMatrixWorld(true);race.step(r.dt,normalizeGameInput(input));}};
 const fire=(id,kind)=>{race.riders[id].item=kind;assert.ok(race.useItem(id));};
 const wait=(test,n=180)=>{for(let i=0;i<n&&!test();i++)tick();assert.ok(test());};
 const counts={},deck=new RaceItemDeck();deck.reset(683296);for(let i=0;i<100000;i++){const k=deck.draw(7,180,true,true);counts[k]=(counts[k]??0)+1;}
 assert.ok(counts.star>20&&counts.star<300);assert.ok(counts['tidal-wave']>10&&counts['tidal-wave']<200);assert.ok(counts.boomerang>4000&&counts['water-bomb']>2000);
 reset();fire(1,'water-bomb');wait(()=>race.projectiles[0]?.phase==='windup');assert.equal(r.p.skateCameraBailing,false);assert.ok(race.hud().threats.some(t=>t.item==='water-bomb'));tick(43);assert.ok(r.p.skateCameraBailing);
 reset();fire(1,'water-bomb');tick(75,{jumpHeld:true});tick(1,{jumpReleased:true});tick(25);assert.equal(r.p.skateCameraBailing,false,'A timed normal jump clears the splash');
 reset();place(1,0,22);fire(1,'boomerang');tick();assert.ok(race.hud().threats.some(t=>t.item==='boomerang'));wait(()=>r.p.skateCameraBailing);tick(220);assert.equal(race.projectiles.length,0);
 reset();fire(0,'star');assert.equal(race.riders[0].star,6);r.p.raceHooks.hazard('blast');assert.equal(r.p.skateCameraBailing,false);tick(30);assert.equal(race.riders[0].starModel.visible,true);tick(340);assert.equal(race.riders[0].star,0);r.p.raceHooks.hazard('blast');assert.equal(r.p.skateCameraBailing,true);
 reset();place(1,0,45);fire(1,'tidal-wave');tick(50);assert.equal(r.p.skateCameraBailing,false);assert.ok(race.hud().threats.some(t=>t.item==='tidal-wave'));wait(()=>r.p.skateCameraBailing);assert.equal(race.riders[1].player.skateCameraBailing,false);
 reset();place(1,0,45);fire(1,'tidal-wave');tick(77,{jumpHeld:true});tick(1,{jumpReleased:true});tick(32);assert.equal(r.p.skateCameraBailing,false,'A normal jump clears the wave crest');
 assert.equal(r.p.lives,4);console.log(JSON.stringify({draws:100000,counts,waterBombWarningAndHit:true,normalJumpClearsSplash:true,boomerangOutAndBack:true,starProtectionExpires:true,waveWarningAndHit:true,normalJumpClearsWave:true}));
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'item-fixture'});
