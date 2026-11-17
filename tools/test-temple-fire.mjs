import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
for(const masks of [0,1])await withBlockworksRuntime(async r=>{
 r.p.masks=masks;r.stepFor(270);assert.equal(r.p.totalDeaths,0,'warning and cool phases must be safe');
 if(masks){r.until(()=>r.p.masks===0,{}, {maxFrames:240});assert.equal(r.p.totalDeaths,0,'a mask absorbs the fire');}
 else {r.until(()=>r.p.totalDeaths>0,{}, {maxFrames:240,allowDeath:true});assert.equal(r.p.state,'dead','unprotected contact burns');}
 console.log('PASS native tiki contact',masks?'mask absorbed':'bare contact death');
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,start:[0,9.12,-24],endlessDeaths:true});

await withBlockworksRuntime(async r=>{
 const tiki=r.l.fireTikis[0];tiki.update(6.3,r.p.pos);
 const box=tiki.boxes[6];assert.ok(!box.isEmpty());
 r.p.pos.copy(box.getCenter(new r.THREE.Vector3()));r.p.pos.y-=.5;
 r.p.invulnTimer=0;r.p.uberTimer=0;r.p.masks=1;r.p.state='hang';
 assert.equal(r.p.hangHazards(r.l),true,'fire must also reach a ledge hang');
 assert.equal(r.p.masks,0);assert.equal(r.p.state,'air');assert.equal(r.p.totalDeaths,0);
 console.log('PASS fire contact breaks a protected ledge hang');
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true});
