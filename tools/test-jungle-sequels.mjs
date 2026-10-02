import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const reports=[];
for(const id of ['jungle-terraces','jungle-skyline'])await withBlockworksRuntime(async r=>{
 const {JUNGLE_SEQUEL_ROUTES}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');const route=JUNGLE_SEQUEL_ROUTES.find(q=>q.id===id),{l,p,THREE}=r;
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');assert.ok(normalizeCustomLevelData(route.data));
 assert.equal(l.cameraViews.length,0,'Main temples must use the close route-following camera');
 assert.ok(l.lanePts.length>70,'Winding course needs an ordered spatial camera spine');
 assert.equal(route.data.components.filter(c=>c.t==='gate').length,1);
 r.stepFor(25);assert.ok(p.grounded&&!p.isBailing);
 const core=route.data.components.filter(c=>c.t==='platform'&&c.nm?.startsWith('Playable temple storey'));
 assert.equal(new Set(core.map(c=>c.p[1]+c.s[1]/2)).size,id==='jungle-terraces'?3:6);assert.equal(Math.max(...core.map(c=>c.p[1]+c.s[1]/2)),route.peak);
 const corners=Array.from({length:Math.ceil(route.end/5)},(_,i)=>route.toWorld(i*5,route.groundAt(i*5)));
 assert.ok(Math.max(...corners.map(p=>p[0]))-Math.min(...corners.map(p=>p[0]))>100);
 assert.ok(Math.max(...corners.map(p=>p[2]))-Math.min(...corners.map(p=>p[2]))>150);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floorAt=(q,depth=1)=>{ray.set(new THREE.Vector3(...q).add(new THREE.Vector3(0,.3,0)),down);ray.far=depth;return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y;};
 // Source height is a measurement target; probe the generated world mesh.
 for(const box of l.crates.filter(c=>c.bang))l.triggerBang(box);l.root.updateMatrixWorld(true);
 let probes=0;
 for(let s=-12;s<route.end-14;s+=1.9){if(route.gaps.some(g=>g.switchX===undefined&&s>g.a-.2&&s<g.b+.2))continue;
  const y=route.groundAt(s);for(const side of [-2.9,0,2.9]){const q=route.toWorld(s,y,side),hit=floorAt(q);assert.ok(hit!==undefined&&Math.abs(hit-y)<.25,`${id} missing route support s=${s},side=${side},expected=${y},hit=${hit}`);probes++;}
 }
 const cps=[];p.respawn(l,true,false);r.stepFor(15);
 for(const cp of l.checkpoints){assert.ok(p.warpCheckpoint(l,1));r.stepFor(25);assert.ok(p.grounded&&!p.isBailing);cps.push(p.pos.toArray());}
 const saved=l.currentSpawn.clone(),deaths=p.totalDeaths;p.respawn(l,false,true,{position:new THREE.Vector3(saved.x,l.killY-1,saved.z)});
 r.until(()=>p.totalDeaths>deaths,{}, {allowDeath:true,maxFrames:180});r.until(()=>p.grounded&&p.state==='ride',{}, {allowDeath:true,maxFrames:480});assert.ok(p.pos.distanceTo(saved)<.5);
 reports.push({id,storeys:new Set(core.map(c=>c.p[1]+c.s[1]/2)).size,peak:route.peak,probes,checkpoints:cps,spawn:route.data.spawn,routeBounds:{x:Math.max(...corners.map(p=>p[0]))-Math.min(...corners.map(p=>p[0])),z:Math.max(...corners.map(p=>p[2]))-Math.min(...corners.map(p=>p[2]))}});
},{modulePath:'/src/level.ts',levelId:id,source:m=>m.findLevel(id).data,endlessDeaths:true});
await writeFile(`${tmpdir()}/playable-temple-structure.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
