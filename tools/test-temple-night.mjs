import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {l,p,THREE}=r,{JUNGLE_TERRACES_ROUTE:route}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');
 const {normalizeCustomLevelData,BUILTIN_LEVELS}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(route.data));assert.equal(BUILTIN_LEVELS.some(e=>e.id==='jungle-skyline'),false);
 assert.equal(route.data.sky,'night');assert.equal(route.data.components.filter(c=>c.t==='gate').length,1);
 assert.equal(route.data.components.filter(c=>c.t==='bonusplatform').length,1);assert.equal(route.data.components.filter(c=>c.t==='crystal').length,1);
 assert.equal(l.fireTikis.length,6);assert.ok(l.torches.length>=60);assert.ok(route.end>1300);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floorAt=(q,up=.3,depth=1)=>{ray.set(new THREE.Vector3(...q).add(new THREE.Vector3(0,up,0)),down);ray.far=depth;return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y;};
 for(const box of l.crates.filter(c=>c.bang))l.triggerBang(box);l.root.updateMatrixWorld(true);
 const failures=[];let probes=0;
 for(let s=-12;s<route.end-14;s+=1.9){if(route.gaps.some(g=>g.switchX===undefined&&s>g.a-.4&&s<g.b+.4))continue;
  const y=route.groundAt(s);for(const side of [-2.9,-1.25,0,1.25,2.9]){const q=route.toWorld(s,y,side),hit=floorAt(q);if(hit===undefined||Math.abs(hit-y)>.25)failures.push({s,side,y,hit});probes++;const bodyFloor=floorAt(q,2.3,2.7);if(bodyFloor!==undefined&&bodyFloor-y>.25)failures.push({s,side,y,bodyFloor,reason:'body clearance'});}
 }
 assert.deepEqual(failures,[],'Every route arm and seam needs continuous support');
 p.respawn(l,true,false);r.stepFor(25);assert.ok(p.grounded&&!p.isBailing);
 const checkpoints=[];
 for(const cp of l.checkpoints){assert.ok(p.warpCheckpoint(l,1));r.stepFor(25);assert.ok(p.grounded&&!p.isBailing);checkpoints.push(p.pos.toArray());}
 const saved=l.currentSpawn.clone(),deaths=p.totalDeaths;p.respawn(l,false,true,{position:new THREE.Vector3(saved.x,l.killY-1,saved.z)});
 r.until(()=>p.totalDeaths>deaths,{}, {allowDeath:true,maxFrames:180});r.until(()=>p.grounded&&p.state==='ride',{}, {allowDeath:true,maxFrames:480});assert.ok(p.pos.distanceTo(saved)<.5);
 const {templeTikiPhase}=await r.server.ssrLoadModule('/src/templeFireTiki.ts');
 assert.equal(templeTikiPhase(2).phase,'cool');assert.equal(templeTikiPhase(4.8).phase,'warn');assert.equal(templeTikiPhase(6.3).phase,'fire');
 const tiki=l.fireTikis[0];tiki.update(2,p.pos);assert.ok(tiki.boxes.every(b=>b.isEmpty()));tiki.update(4.8,p.pos);assert.ok(tiki.boxes.every(b=>b.isEmpty()));
 tiki.update(6.2,p.pos);assert.ok(tiki.boxes.some(b=>!b.isEmpty()));const yaw=tiki.head.rotation.y;tiki.update(6.7,p.pos);assert.notEqual(yaw,tiki.head.rotation.y);tiki.update(7.6,p.pos);assert.ok(tiki.boxes.every(b=>b.isEmpty()));
 const report={name:route.data.name,probes,end:route.end,peak:route.peak,checkpoints,torches:l.torches.length,tikis:l.fireTikis.length,bonusEntrances:1};
 await writeFile('/private/tmp/temple-night-structure.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true});
