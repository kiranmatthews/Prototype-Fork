import assert from 'node:assert/strict';
import {withBlockworksRuntime,normalizeGameInput} from './blockworks-runner.mjs';
const fixture={v:1,name:'Race starts',spawn:[0,.1,10],killY:-30,startWarpPad:false,components:[{t:'platform',p:[0,-.5,-60],s:[50,1,220]},{t:'crate',kind:'mystery',p:[20,0,-10]},{t:'gate',p:[0,0,-150]},{t:'camnode',p:[0,0,20]},{t:'camnode',p:[0,0,-150]}],skateRace:{v:1,racers:8,seed:19410,line:[[0,0,20,50],[0,0,-150,50]],jumps:[],finishWidth:40,originalLength:170}};
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');
 const {Recorder,Replayer,isReplayFile}=await r.server.ssrLoadModule('/src/replay.ts');
 const race=new SkateRace(r.scene,r.p);race.attach(r.l,'start-fixture');
 const blank=()=>normalizeGameInput({});race.drive=()=>blank();
 const seeds=new Set(),items=new Set();
 for(let i=0;i<24;i++){race.start();seeds.add(race.runSeed);race.phase='running';race.crateBroken(r.l.crates[0],0);items.add(race.riders[0].item);}
 assert.equal(seeds.size,24,'Fresh starts must not reuse the level seed');assert.ok(items.size>=4,'The same box must not give a fixed reward across starts');
 race.start('race',123);for(let i=0;i<230;i++){r.scene.updateMatrixWorld(true);race.step(r.dt,blank());}
 assert.equal(race.phase,'running');assert.ok(race.riders.every(a=>a.player.boardRolling&&a.player.boardG.visible),'All eight start mounted and remain mounted while waiting');
 assert.ok(race.riders.every(a=>a.player.skatePose>.99&&a.player.deckPose>.99));
 // The first move uses the board; intentional brake/dismount is still normal.
 for(let i=0;i<40;i++)race.step(r.dt,normalizeGameInput({moveY:1}));assert.ok(r.p.boardRolling&&r.p.speed>2);
 for(let i=0;i<60;i++)race.step(r.dt,normalizeGameInput({grabHeld:true}));assert.equal(r.p.boardRolling,false);
 const recorder=new Recorder();recorder.start('start-fixture');
 const input={...blank(),raceStartPressed:true};race.step(r.dt,input);const chosen=race.runSeed;recorder.record(input);
 for(let i=0;i<3;i++)recorder.record(blank());
 const take=recorder.export();assert.equal(isReplayFile(take),true);assert.deepEqual(take.raceSeeds,[[0,chosen]]);
 const replayer=new Replayer();replayer.begin(take);const playback=blank();assert.ok(replayer.feed(playback));race.step(r.dt,playback);assert.equal(race.runSeed,chosen);replayer.end();
 const legacy={...take};delete legacy.raceSeeds;replayer.begin(legacy);replayer.feed(playback);race.step(r.dt,playback);assert.equal(race.runSeed,19410);replayer.end();
 for(const raceSeeds of [[[0,0]],[[0,-1]],[[0,2**32]],[[4,1]],[[1,1],[0,2]],[[0,1],[0,2]]])assert.equal(isReplayFile({...take,raceSeeds}),false);
 console.log(JSON.stringify({freshSeeds:seeds.size,distinctFirstBoxItems:[...items],allMounted:true,normalDismount:true,replaySeedRoundtrip:true,legacyFallback:true,invalidSeedsRejected:true}));
},{modulePath:'/src/levels/slipstream.ts',source:()=>fixture,levelId:'start-fixture'});
