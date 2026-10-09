import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const opts={endlessDeaths:true,modulePath:'/src/levels/pirate-wreck.ts',levelId:'drowned-crown',source:m=>m.PIRATE_WRECK_LEVEL};
const results=[];
await withBlockworksRuntime(r=>{
 r.until(()=>r.p.state==='dead',{}, {maxFrames:600,allowDeath:true,label:'Fall into the actual moonpool pit'});
 r.until(()=>r.p.grounded&&r.p.state==='ride',{}, {maxFrames:1500,allowDeath:true,label:'Return from moonpool'});
 assert.equal(r.p.totalDeaths,1);assert.ok(r.p.pos.distanceTo(r.l.spawnPos)<2.1,'Death must return to supported spawn');
 results.push({case:'moonpool pit death and automatic respawn',position:r.p.pos.toArray(),deaths:r.p.totalDeaths});
},{...opts,start:[24,0,-165]});
await withBlockworksRuntime(r=>{
 r.stepFor(30);r.tick({spinHeld:true});r.stepFor(25);assert.ok(r.l.checkpoints[1].active);
 r.walkTo([8,8,-142],{pace:.4,arrivalTolerance:.5});
 r.until(()=>r.p.totalDeaths===1,()=>({...r.steerToward([12,8,-170],{pace:.8}),grindHeld:true}),{maxFrames:900,allowDeath:true,label:'Deliberate deck-edge fall'});
 r.until(()=>r.p.grounded&&r.p.state==='ride',{}, {maxFrames:1500,allowDeath:true,label:'Checkpoint respawn'});
 assert.ok(r.p.pos.distanceTo(r.l.checkpoints[1].spawnPos)<2.1,'Death must use the banked checkpoint');
 results.push({case:'banked checkpoint death and respawn',position:r.p.pos.toArray(),deaths:r.p.totalDeaths});
},{...opts,start:[-6,8.1,-127.8]});
await withBlockworksRuntime(r=>{
 r.stepFor(30);for(let i=0;i<120;i++)r.tick(r.steerToward([0,8,-114],{pace:.6}));
 assert.ok(r.p.pos.x>1,'Mast must block the player');assert.ok(r.p.grounded&&!r.p.isBailing);
 results.push({case:'solid mast collision',position:r.p.pos.toArray()});
},{...opts,start:[3,8.1,-114]});
await withBlockworksRuntime(r=>{
 r.stepFor(30);r.walkTo([-22,-4,-198],{pace:.4,arrivalTolerance:.5});r.walkTo([-23,-4,-202],{pace:.3,arrivalTolerance:.5});
 r.stepFor(20);assert.equal(r.p.hasCrystal,true,'The powder room crystal must be reachable');
 r.walkTo([-22,-4,-198],{pace:.3,arrivalTolerance:.5});r.walkTo([-10,-4,-198],{pace:.4,arrivalTolerance:.5});
 results.push({case:'powder room crystal and return',crystal:r.p.hasCrystal,position:r.p.pos.toArray()});
},{...opts,start:[-11,-3.9,-198]});
await withBlockworksRuntime(r=>{
 r.stepFor(30);r.walkTo([10,14,-104],{pace:.4,arrivalTolerance:.5});r.walkTo([3,14,-104],{pace:.3,arrivalTolerance:.5});
 assert.ok(Math.abs(r.p.pos.y-14)<.2);results.push({case:'captains cabin climb',position:r.p.pos.toArray()});
},{...opts,start:[10,8.1,-126]});
await withBlockworksRuntime(r=>{
 r.stepFor(30);r.walkTo([-57,-4,-40],{pace:.3,arrivalTolerance:.5});
 r.walkTo([-57,-4,-49],{pace:.3,arrivalTolerance:.5,buttons:{grabHeld:true}});
 assert.ok(r.p.grounded&&r.p.crawling,'use the native crawl below the retained crystal tips');
 const cache=r.l.crates.find(c=>Math.hypot(c.mesh.position.x+58,c.mesh.position.z+50)<.1);assert.ok(cache?.alive);
 r.tick({grabHeld:true,spinHeld:true});r.stepFor(30,{grabHeld:true});assert.equal(cache.alive,false,'the grotto life cache must be reachable');
 r.walkTo([-57,-4,-40],{pace:.3,arrivalTolerance:.5,buttons:{grabHeld:true}});
 results.push({case:'secret mine grotto, cache and return',position:r.p.pos.toArray(),cacheBroken:!cache.alive});
},{...opts,start:[-35,-4.9,-31]});
console.log(JSON.stringify(results,null,2));
