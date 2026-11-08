import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
// Temple of Embers structure: every authored floor supports the rider, every
// checkpoint is a safe warp, the kill plane respawns, the sentinels breathe.
await withBlockworksRuntime(async r=>{
 const {l,p,THREE}=r,{JUNGLE_TERRACES_ROUTE:route}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');
 const {normalizeCustomLevelData,BUILTIN_LEVELS}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(route.data))));assert.equal(BUILTIN_LEVELS.some(e=>e.id==='jungle-skyline'),false);
 assert.equal(route.data.sky,'night');assert.equal(route.data.components.filter(c=>c.t==='gate').length,1);
 assert.equal(route.data.components.filter(c=>c.t==='bonusplatform').length,1);assert.equal(route.data.components.filter(c=>c.t==='crystal').length,1);
 assert.equal(l.fireTikis.length,7);assert.ok(l.torches.length>=60);assert.ok(route.end>1400);
 assert.ok(route.checks.length>=12,'the course must verify its own placement rules');
 assert.ok(route.countedCrates>=80&&route.countedCrates<=110,`counted crates ${route.countedCrates}`);
 assert.equal(route.chapters.length,13);
 for(const kind of ['phasepad','rope','trampoline','crumble','speedpad','pendulum','mover','grindosaurus','trickgate','crusher','vertramp','zone'])
  assert.ok(route.data.components.some(c=>c.t===kind),`set piece ${kind} is missing`);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floorAt=(q,up=.3,depth=1)=>{ray.set(new THREE.Vector3(...q).add(new THREE.Vector3(0,up,0)),down);ray.far=depth;return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y;};
 l.root.updateMatrixWorld(true);
 const failures=[];let probes=0;
 const gateS=route.toLocal(route.data.components.find(c=>c.t==='gate').p)[0];
 const spawnS=route.toLocal(route.data.spawn)[0];
 const skipBody=s=>Math.abs(s-gateS)<2.6||Math.abs(s-spawnS)<3||route.setPieces.censers.some(c=>Math.abs(s-c.s)<1.4)||route.setPieces.crushers.some(c=>Math.abs(s-c.s)<2.2)||
  (route.setPieces.serpent&&Math.abs(s-route.setPieces.serpent.s)<3.4)||route.data.components.some(c=>c.t==='enemy'&&Math.abs(route.toLocal(c.p)[0]-s)<1.8);
 for(let s=-22;s<route.end-2;s+=1.9){
  if(route.gaps.some(g=>s>g.a-.4&&s<g.b+.4)||route.voids.some(v=>s>v.a-.4&&s<v.b+.4)||route.pipes.some(b=>s>b.a-.4&&s<b.b+.4))continue;
  const y=route.groundAt(s);
  for(const side of [-2.9,-1.25,0,1.25,2.9]){const q=route.toWorld(s,y,side),hit=floorAt(q);if(hit===undefined||Math.abs(hit-y)>.25)failures.push({s,side,y,hit});probes++;
   if(skipBody(s))continue;const bodyFloor=floorAt(q,2.3,2.7);if(bodyFloor!==undefined&&bodyFloor-y>.25)failures.push({s,side,y,bodyFloor,reason:'body clearance'});}
 }
 // Lower floors beneath the burning ropes and the lift well, both side courts and every stair step.
 for(const v of route.voids)for(let s=v.a+1;s<v.b-1;s+=2)for(const side of [-2,0,2]){const hit=floorAt(route.toWorld(s,v.floorY,side));if(hit===undefined||Math.abs(hit-v.floorY)>.25)failures.push({s,side,y:v.floorY,hit,reason:v.name});probes++;}
 for(const [a,b,side,y] of [[712,732,9,12],[950,970,-9,24]])for(let s=a+1;s<b;s+=2){const hit=floorAt(route.toWorld(s,y,side));if(hit===undefined||Math.abs(hit-y)>.25)failures.push({s,side,y,hit,reason:'side court'});probes++;}
 for(const c of route.climbs){const span=(c.b-c.a)/c.steps;for(let i=0;i<c.steps;i++){const y=c.base+(c.top-c.base)*(i+1)/c.steps,s=c.a+(i+.5)*span,hit=floorAt(route.toWorld(s,y,c.side));if(hit===undefined||Math.abs(hit-y)>.25)failures.push({s,side:c.side,y,hit,reason:'stair step'});probes++;}}
 if(failures.length)console.log('support failures',JSON.stringify(failures.map(f=>({...f,s:+f.s.toFixed(1)}))));
 assert.equal(failures.length,0,'Every authored floor needs continuous support');
 p.respawn(l,true,false);r.stepFor(25);assert.ok(p.grounded&&!p.isBailing);
 const checkpoints=[];
 for(const cp of l.checkpoints){assert.ok(p.warpCheckpoint(l,1));r.stepFor(25);assert.ok(p.grounded&&!p.isBailing,`checkpoint ${checkpoints.length+1} must be a safe warp`);checkpoints.push({station:+route.toLocal(p.pos.toArray())[0].toFixed(1),position:p.pos.toArray()});void cp;}
 assert.equal(checkpoints.length,11);
 const saved=l.currentSpawn.clone(),deaths=p.totalDeaths;p.respawn(l,false,true,{position:new THREE.Vector3(saved.x,l.killY-1,saved.z)});
 r.until(()=>p.totalDeaths>deaths,{}, {allowDeath:true,maxFrames:180});r.until(()=>p.grounded&&p.state==='ride',{}, {allowDeath:true,maxFrames:480});assert.ok(p.pos.distanceTo(saved)<.5);
 const {templeTikiPhase}=await r.server.ssrLoadModule('/src/templeFireTiki.ts');
 assert.equal(templeTikiPhase(2).phase,'cool');assert.equal(templeTikiPhase(4.8).phase,'warn');assert.equal(templeTikiPhase(6.3).phase,'fire');
 const tiki=l.fireTikis[0];tiki.update(2,p.pos);assert.ok(tiki.boxes.every(b=>b.isEmpty()));tiki.update(6.2,p.pos);assert.ok(tiki.boxes.some(b=>!b.isEmpty()));
 const report={name:route.data.name,probes,end:route.end,peak:route.peak,countedCrates:route.countedCrates,checks:route.checks,checkpoints,torches:l.torches.length,tikis:l.fireTikis.length,
  chapters:route.chapters,components:route.data.components.length};
 await writeFile('/private/tmp/temple-night-structure.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,checks:report.checks.length,chapters:report.chapters.length}));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true});
