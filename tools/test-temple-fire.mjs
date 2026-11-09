import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {withTempleRuntime} from './temple-test-runtime.mjs';
// Stand in the sleeping sentinel's sigh (station 70; the head on the left faces across the floor).
for(const masks of [0,1])await withTempleRuntime(async r=>{
 // The sleeping sentinel breathes on a fourteen-second cycle: cool for the first 7.5 s, then a warning, then fire.
 r.p.masks=masks;r.stepFor(420);assert.equal(r.p.totalDeaths,0,'warning and cool phases must be safe');
 if(masks){r.until(()=>r.p.masks===0,{}, {maxFrames:420});assert.equal(r.p.totalDeaths,0,'a mask absorbs the fire');}
 else {r.until(()=>r.p.totalDeaths>0,{}, {maxFrames:420,allowDeath:true});assert.equal(r.p.state,'dead','unprotected contact burns');}
 console.log('PASS native tiki contact',masks?'mask absorbed':'bare contact death');
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',start:[70,.12,-5],endlessDeaths:true});

await withBlockworksRuntime(async r=>{
 // The sleeping sentinel breathes on its own slow cycle: sample it three quarters of the way round, in the fire phase.
 const tiki=r.l.fireTikis[0];tiki.update((tiki.spec.cycle??7.8)*.75,r.p.pos);
 const box=tiki.boxes.find(b=>!b.isEmpty());assert.ok(box,'the fire phase must produce flame boxes');
 r.p.pos.copy(box.getCenter(new r.THREE.Vector3()));r.p.pos.y-=.5;
 r.p.invulnTimer=0;r.p.uberTimer=0;r.p.masks=1;r.p.state='hang';
 assert.equal(r.p.hangHazards(r.l),true,'fire must also reach a ledge hang');
 assert.equal(r.p.masks,0);assert.equal(r.p.state,'air');assert.equal(r.p.totalDeaths,0);
 console.log('PASS fire contact breaks a protected ledge hang');
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true});
