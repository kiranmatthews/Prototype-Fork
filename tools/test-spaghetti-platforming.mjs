import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/platforming-native';await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const source=r.sourceModule.SPAGHETTI_RAILS_PLATFORMING_LEVEL;
 assert.deepEqual(JSON.parse(await readFile('docs/spaghetti-rails/spaghetti-rails-platforming.level.json','utf8')),source,'Independent saved editor file matches the platforming source');
 assert.equal(r.l.skateRace,null);assert.equal(r.l.railChoices.paths.length,18);
 const geometry=source.components.filter(c=>['rail','platform','ramp','gate','pit'].includes(c.t));
 const hash=createHash('sha256').update(JSON.stringify(geometry)).digest('hex');
 assert.equal(hash,'1a135128a3c2418d4c51cd8d035e8fb87f90a5cd48a6fc904339d6ba4c031fa8','Rejected layout geometry remains exactly preserved');
 r.stepFor(30);assert.ok(r.p.grounded&&!r.p.isBailing);const spawn=r.p.pos.toArray();
 assert.equal(r.l.checkpoints.length,41);assert.equal(r.l.raceCheckpoints.length,0);
 // Local contact fixtures: initial placement on the original platforms, then
 // actual player input. These are not a claim of a full-course playthrough.
 const cp=source.components.find(c=>c.t==='checkpoint');
 r.p.respawn(r.l,true,false,{position:new Vector3(cp.p[0],cp.p[1]+.08,cp.p[2]+3),heading:new Vector3(0,0,-1)});
 for(let i=0;i<240&&!r.l.activeCheckpoint;i++)r.tick({moveY:1,spinHeld:true,spinPressed:i%30===0});
 assert.ok(r.l.activeCheckpoint,'A normal checkpoint crate banks through actual player contact');
 const checkpoint=r.l.activeCheckpoint.spawnPos.toArray(),deaths=r.p.totalDeaths;
 // Explicit pit fault injection verifies ordinary platforming recovery.
 r.p.pos.y=r.l.killY-3;r.p.prevPos.copy(r.p.pos);r.p.state='air';r.p.grounded=false;r.p.vVel=-5;
 for(let i=0;i<900&&(r.p.totalDeaths===deaths||!r.p.grounded);i++)r.tick({});
 assert.equal(r.p.totalDeaths,deaths+1);assert.ok(r.p.pos.distanceTo(new Vector3(...checkpoint))<2);
 r.p.respawn(r.l,true,false,{position:new Vector3(15,20.08,-400),heading:new Vector3(0,0,-1)});
 for(let i=0;i<600&&r.p.state!=='finished';i++)r.tick({moveY:1});
 assert.ok(r.p.hasCrystal,'The separate platforming crystal is collectible');assert.equal(r.p.state,'finished','The normal finish gate works without race mode');
 const report={at:new Date().toISOString(),scope:'Saved geometry equality, supported spawn, normal checkpoint/pit recovery and crystal/finish local contact fixtures; not full traversal.',id:'spaghetti-rails-platforming',geometrySha256:hash,spawn,checkpoint,ordinaryDeaths:1,finish:r.p.pos.toArray(),race:false};
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/spaghetti-rails-platforming.ts',source:m=>m.SPAGHETTI_RAILS_PLATFORMING_LEVEL,levelId:'spaghetti-rails-platforming',endlessDeaths:true});
