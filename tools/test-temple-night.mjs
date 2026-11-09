import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
// Temple of Embers structure: every authored floor supports the rider at its
// authored height, every checkpoint is a safe warp, the kill plane respawns,
// the sentinels breathe, and the course verified its own placement rules.
await withBlockworksRuntime(async r=>{
 const {l,p,THREE}=r,{JUNGLE_TERRACES_ROUTE:route}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts'),{templeFloorCentre}=await r.server.ssrLoadModule('/src/levels/temple-of-embers.ts');
 const {normalizeCustomLevelData,BUILTIN_LEVELS}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(route.data))));assert.equal(BUILTIN_LEVELS.some(e=>e.id==='jungle-skyline'),false);
 assert.equal(route.data.sky,'night');assert.equal(route.data.components.filter(c=>c.t==='gate').length,1);
 assert.equal(route.data.components.filter(c=>c.t==='bonusplatform').length,1);assert.equal(route.data.components.filter(c=>c.t==='crystal').length,1);
 assert.equal(l.fireTikis.length,9);assert.ok(l.torches.length>=40);assert.ok(route.end>850);
 assert.ok(route.checks.length>=10,'the course must verify its own placement rules');
 assert.ok(route.countedCrates>=150&&route.countedCrates<=190,`counted crates ${route.countedCrates}`);
 assert.equal(route.rooms.length,7);
 for(const kind of ['pendulum','vertramp','firetiki','enemy','pit','rock'])assert.ok(route.data.components.some(c=>c.t===kind),`${kind} is missing`);
 for(const kind of ['phasepad','crumble','trickgate','returnportal','speedpad','trampoline','mover','grindosaurus'])assert.ok(!route.data.components.some(c=>c.t===kind),`${kind} must not appear in the temple`);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floorAt=(q,up=.3,depth=1)=>{ray.set(new THREE.Vector3(...q).add(new THREE.Vector3(0,up,0)),down);ray.far=depth;return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y;};
 l.root.updateMatrixWorld(true);
 const failures=[];let probes=0;
 // Every registered floor, sampled across its width and length (banks included).
 const spawnS=route.toLocal(route.data.spawn)[0],gate=route.data.components.find(c=>c.t==='gate'),[gateS,,gateX]=route.toLocal(gate.p);
 const curved=route.floors.filter(f=>/gutter|reservoir|quarter/.test(f.nm));
 for(const f of route.floors){
  if(f.kind==='side'&&f.nm.includes('pedestal'))continue;
  if(curved.includes(f))continue;
  const along=Math.max(1,Math.ceil((f.b-f.a)/3)),across=Math.max(1,Math.ceil((f.x1-f.x0)/3));
  for(let i=0;i<=along;i++)for(let j=0;j<=across;j++){
   const s=f.a+.3+(f.b-f.a-.6)*i/along,x=templeFloorCentre(f,s)+f.x0+.3+(f.x1-f.x0-.6)*j/across,y=f.ya+(f.yb-f.ya)*(s-f.a)/(f.b-f.a||1);
   if(curved.some(c=>s>=c.a-.01&&s<=c.b+.01&&x>=c.x0-.01&&x<=c.x1+.01))continue; // curved surfaces (gutter, basin, banks) are ridden by the journey
   if(Math.abs(s-spawnS)<3&&Math.abs(x-route.toLocal(route.data.spawn)[2])<2)continue; // the start pad stands on the spawn ledge
   if(Math.abs(s-gateS)<2.5&&Math.abs(x-gateX)<3)continue; // the finish gate's stone threshold sits on the terrace
   const hit=floorAt(route.toWorld(s,y,x),.6,1.6);probes++;
   if(hit===undefined||Math.abs(hit-y)>.36)failures.push({floor:f.nm,s:+s.toFixed(1),x:+x.toFixed(1),y:+y.toFixed(2),hit});
  }
 }
 if(failures.length)console.log('support failures',JSON.stringify(failures.slice(0,30)));
 assert.equal(failures.length,0,'Every authored floor needs continuous support');
 p.respawn(l,true,false);r.stepFor(25);assert.ok(p.grounded&&!p.isBailing);
 const checkpoints=[];
 for(const cp of l.checkpoints){assert.ok(p.warpCheckpoint(l,1));r.stepFor(25);assert.ok(p.grounded&&!p.isBailing,`checkpoint ${checkpoints.length+1} must be a safe warp`);checkpoints.push({station:+route.toLocal(p.pos.toArray())[0].toFixed(1),position:p.pos.toArray().map(n=>+n.toFixed(2))});void cp;}
 assert.equal(checkpoints.length,11);
 const saved=l.currentSpawn.clone(),deaths=p.totalDeaths;p.respawn(l,false,true,{position:new THREE.Vector3(saved.x,l.killY-1,saved.z)});
 r.until(()=>p.totalDeaths>deaths,{}, {allowDeath:true,maxFrames:180});r.until(()=>p.grounded&&p.state==='ride',{}, {allowDeath:true,maxFrames:480});assert.ok(p.pos.distanceTo(saved)<.5);
 const {templeTikiPhase}=await r.server.ssrLoadModule('/src/templeFireTiki.ts');
 assert.equal(templeTikiPhase(2).phase,'cool');assert.equal(templeTikiPhase(4.8).phase,'warn');assert.equal(templeTikiPhase(6.3).phase,'fire');
 const tiki=l.fireTikis[0];tiki.update(2,p.pos);assert.ok(tiki.boxes.every(b=>b.isEmpty()));tiki.update(14*.75,p.pos);assert.ok(tiki.boxes.some(b=>!b.isEmpty()),'the sleeping sentinel still breathes on its slow cycle');
 const report={name:route.data.name,probes,floors:route.floors.length,end:route.end,peak:route.peak,countedCrates:route.countedCrates,checks:route.checks,checkpoints,torches:l.torches.length,tikis:l.fireTikis.length,enemies:l.enemies.length,rooms:route.rooms,components:route.data.components.length};
 await writeFile('/private/tmp/temple-night-structure.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,checks:report.checks.length,rooms:report.rooms.length}));
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true});
