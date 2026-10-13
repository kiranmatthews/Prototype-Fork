import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
for(const masks of [0,1])await withBlockworksRuntime(async r=>{
 r.p.masks=masks;r.stepFor(270);assert.equal(r.p.totalDeaths,0,'warning and cool phases must be safe');
 if(masks){r.until(()=>r.p.masks===0,{}, {maxFrames:240});assert.equal(r.p.totalDeaths,0,'a mask absorbs the fire');}
 else {r.until(()=>r.p.totalDeaths>0,{}, {maxFrames:240,allowDeath:true});assert.equal(r.p.state,'dead','unprotected contact burns');}
 console.log('PASS native tiki contact',masks?'mask absorbed':'bare contact death');
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,start:[0,9.12,-24],endlessDeaths:true});
