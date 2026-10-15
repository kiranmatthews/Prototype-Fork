import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const fixture={v:1,name:'Race counterplay',spawn:[0,.1,0],killY:-30,startWarpPad:false,components:[
 {t:'platform',p:[0,-.5,-70],s:[60,1,420]},{t:'crate',kind:'mystery',p:[22,0,75]},
 {t:'gate',p:[0,0,-240]},{t:'camnode',p:[0,0,100]},{t:'camnode',p:[0,0,-250]}],
 skateRace:{v:1,racers:8,seed:19410,line:[[0,0,100,60],[0,0,-240,60]],jumps:[],finishWidth:55,originalLength:340}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts'),{RaceItemDeck}=await r.server.ssrLoadModule('/src/race/itemOdds.ts');
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'counterplay-fixture');
 const neutral=()=>normalizeGameInput({});race.drive=()=>neutral();
 const place=(id,x,z)=>{const a=race.riders[id],p=new r.THREE.Vector3(x,0,z);a.player.resetRacePosition(r.l,p,new r.THREE.Vector3(0,0,-1));a.player.invulnTimer=0;a.knockGrace=0;a.shield=0;a.itemCooldown=999;a.progress=a.anchorProgress=race.course.project(p).s;a.anchor.copy(p);};
 const reset=()=>{race.start('race');race.phase='running';race.drive=()=>neutral();for(let id=0;id<8;id++)place(id,id>1?22:0,id?25+id*3:0);};
 const tick=(n=1,device={})=>{for(let i=0;i<n;i++){r.scene.updateMatrixWorld(true);race.step(r.dt,normalizeGameInput(device));r.p.commitRenderStep(r.l);race.commitRenderStep();}};
 const fire=(id,item)=>{race.riders[id].item=item;assert.equal(race.useItem(id),true);};
 const until=(test,max=240)=>{for(let i=0;i<max&&!test();i++)tick();assert.ok(test(),'condition did not resolve');};
 const shot=()=>race.projectiles.find(p=>p.type==='red-shell'||p.type==='blue-shell');
 const report={};
 const counts={};for(let seed=1;seed<=100;seed++){const deck=new RaceItemDeck();deck.reset(Math.imul(seed,0x9e3779b9));const previous=[];for(let n=0;n<100;n++){const item=deck.draw(1,0,true);assert.ok(!previous.includes(item));counts[item]=(counts[item]||0)+1;previous.push(item);if(previous.length>2)previous.shift();}}
 assert.equal(Object.keys(counts).length,5);for(const count of Object.values(counts))assert.ok(count>1200&&count<2800);report.leaderDraws=counts;
 const a=new RaceItemDeck(),b=new RaceItemDeck();a.reset(123);b.reset(123);for(let n=0;n<100;n++)assert.equal(a.draw(7,200,true),b.draw(7,200,true));
 for(const rank of [1,3,8]){a.reset(rank);for(let n=0;n<200;n++)assert.ok(!['shock-shell','blue-shell'].includes(a.draw(rank,200,false)));}
 reset();race.elapsed=60;race.riders[7].progress=-200;race.heavyAt=999;for(let n=0;n<20;n++){race.crateBroken(r.l.crates[0],7);assert.ok(!['shock-shell','blue-shell'].includes(race.riders[7].item));race.riders[7].item=null;}report.heavyCooldown=true;
 reset();place(0,22,75);race.riders[0].item='shield';tick(4);assert.equal(r.l.crates[0].alive,true);race.riders[0].item=null;tick();assert.equal(r.l.crates[0].alive,false);assert.ok(race.riders[0].item);report.fullSlotPreservesBox=true;
 reset();fire(1,'red-shell');let warning=0;until(()=>{if(race.hud().threats.some(t=>t.item==='red-shell'))warning+=r.dt;return shot()?.phase==='strike';});assert.ok(warning>=.6);tick(20);assert.ok(r.p.skateCameraBailing);report.redWarningSeconds=warning;
 reset();fire(1,'red-shell');until(()=>shot()?.phase==='windup');fire(0,'banana');tick(80);assert.equal(r.p.skateCameraBailing,false);assert.equal(race.projectiles.length,0);report.peelInterceptsRed=true;
 reset();fire(1,'red-shell');until(()=>shot()?.phase==='windup');race.riders[0].item='green-shell';assert.ok(race.useItem(0,true));tick(80);assert.equal(r.p.skateCameraBailing,false);assert.equal(race.projectiles.length,0);report.backwardShellInterceptsRed=true;
 reset();fire(1,'red-shell');until(()=>shot()?.phase==='strike');tick(1,{spinPressed:true,spinHeld:true});tick(20);assert.equal(r.p.skateCameraBailing,false);assert.equal(race.projectiles.length,0);report.normalSpinParriesRed=true;
 reset();fire(1,'red-shell');until(()=>shot()?.phase==='strike');fire(0,'shield');tick(20);assert.equal(r.p.skateCameraBailing,false);assert.equal(race.riders[0].shield,0);report.shieldBlocks=true;
 reset();fire(1,'red-shell');until(()=>shot()?.phase==='strike');const wall=new r.THREE.Box3(new r.THREE.Vector3(-4,-1,2),new r.THREE.Vector3(4,4,3));r.l.walls.push(wall);tick(20);assert.equal(r.p.skateCameraBailing,false);assert.equal(race.projectiles.length,0);r.l.walls.pop();report.wallStopsRed=true;
 reset();fire(1,'green-shell');tick();assert.ok(race.hud().threats.some(t=>t.item==='green-shell'));race.projectiles[0].direction.negate();tick();assert.equal(race.hud().threats.length,0);report.noRecedingWarnings=true;
 reset();fire(1,'red-shell');until(()=>shot()?.phase==='strike');r.p.pos.x+=8;tick();assert.equal(race.hud().threats.length,0);report.noDodgedRedWarning=true;
 reset();fire(1,'red-shell');race.projectiles[0].target=2;tick();assert.equal(race.hud().threats.length,0);report.noOtherTargetWarnings=true;
 reset();fire(1,'blue-shell');until(()=>shot()?.phase==='windup');const before=race.elapsed;until(()=>shot()?.phase==='strike');assert.ok(race.elapsed-before>=1.09);report.blueOrbitSeconds=race.elapsed-before;tick(55);assert.ok(r.p.skateCameraBailing);
 reset();fire(1,'blue-shell');until(()=>shot()?.phase==='strike');tick(20);fire(0,'mushroom');tick(35);assert.equal(r.p.skateCameraBailing,false);report.timedBoostDodgesBlue=true;
 reset();fire(1,'blue-shell');until(()=>shot()?.phase==='windup');tick(15);fire(0,'horn');tick(100);assert.equal(r.p.skateCameraBailing,false);assert.equal(race.projectiles.length,0);report.hornDestroysBlue=true;
 reset();fire(1,'blue-shell');until(()=>shot()?.phase==='strike');r.p.freeSkate=false;r.p.airFromSkate=false;tick(55,{moveX:1});assert.ok(Math.abs(r.p.pos.x)>3.5,JSON.stringify({pos:r.p.pos,state:r.p.state,speed:r.p.speed,board:r.p.boardRolling,bailing:r.p.skateCameraBailing,forward:r.p.raceInputBasis(r.l)}));assert.equal(r.p.skateCameraBailing,false);report.onFootSidestepDodgesBlue=true;
 reset();fire(1,'shock-shell');tick(80,{jumpHeld:true});assert.equal(r.p.skateCameraBailing,false);assert.ok(race.hud().threats.some(t=>t.item==='shock-shell'));tick(1,{jumpReleased:true});tick(18);assert.equal(r.p.skateCameraBailing,false);assert.ok(r.scene.getObjectByName('lightning strike'));report.normalJumpDodgesLightning=true;
 reset();fire(1,'shock-shell');tick(80);fire(0,'shield');tick(20);assert.equal(r.p.skateCameraBailing,false);assert.equal(race.riders[0].shield,0);report.shieldBlocksLightning=true;
 reset();fire(1,'shock-shell');tick(100);assert.ok(r.p.skateCameraBailing);assert.ok(race.riders[0].knockGrace>2);assert.equal(r.p.lives,4);report.lightningHitsGrounded=true;
 reset();assert.equal(race.hud().threats.length,0);assert.ok(race.riders.every(a=>!a.targetRing.visible&&!a.storm.visible));report.resetClearsThreats=true;
 const out=process.env.RACE_COUNTERPLAY_OUTPUT||join(tmpdir(),'skate-race-counterplay');await mkdir(out,{recursive:true});await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'counterplay-fixture'});
