import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const report={encounters:[],supportSamples:0,maxFloorError:0};
try{await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,defs=m.HOLLOWWAKE_ENCOUNTERS,ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 assert.equal(r.l.enemies.length,17);
 for(const [i,e]of defs.entries()){
  const enemy=r.l.enemies[i];assert.equal(enemy.kind,e.foe);assert.equal(enemy.terrainSupports,true);
  assert.ok(!m.HOLLOWWAKE_ROOMS.some(room=>e.s>room.entry-30&&e.s<room.exit+40),'safe refuge/release: '+e.name);
  assert.ok(!m.HOLLOWWAKE_FORKS.some(f=>e.s>f.a-20&&e.s<f.split+25),'clear side choice: '+e.name);
  assert.ok(!m.HOLLOWWAKE_GAPS.some(g=>m.hollowGapApplies(g,e.branch)&&e.s>g.s-24&&e.s<g.s+g.len+26),'jump recovery: '+e.name);
  assert.ok(!m.HOLLOWWAKE_OBSTACLES.some(o=>(o.branch===e.branch||o.branch<0)&&Math.abs(o.s-e.s)<32),'clear crate escape: '+e.name);
  // Sample the entire actual axis-bound patrol, not just its centre.
  const heights=[];
  for(let j=0;j<=12;j++){
   const pos=enemy.homePosition.clone();pos.x=enemy.x0+(enemy.x1-enemy.x0)*j/12;
   ray.set(pos.clone().add(new r.THREE.Vector3(0,2,0)),down);ray.far=4;
   const hit=ray.intersectObjects(r.l.groundMeshes,false).find(h=>h.face?.normal.y>.15);assert.ok(hit,'patrol floor: '+e.name);heights.push(hit.point.y);
   assert.ok(!r.l.walls.some(w=>w.containsPoint(pos.clone().setY(hit.point.y+.6))),'patrol clear of spine: '+e.name);
  }
  report.encounters.push({...e,groundRange:Math.max(...heights)-Math.min(...heights)});
 }
 // Isolated behaviour fixture: production FSMs advance while the chase waits
 // at spawn; no player or enemy transforms are overridden during these cycles.
 const cycles=new Map();
 for(let frame=0;frame<720;frame++){
  r.l.update(r.dt);
  for(const e of r.l.enemies){
   const states=cycles.get(e)??new Set();states.add(e.state);cycles.set(e,states);
   if(frame%12)continue;
   ray.set(e.group.position.clone().setY(e.baseY+2),down);ray.far=4;
   const hit=ray.intersectObjects(r.l.groundMeshes,false).find(h=>h.face?.normal.y>.15);assert.ok(hit,'live patrol stays supported');
   const error=Math.abs(hit.point.y-e.baseY);report.maxFloorError=Math.max(report.maxFloorError,error);report.supportSamples++;assert.ok(error<.015,'live feet track curved floor');
   assert.ok(e.group.position.y>=e.baseY-.001,'hop never sinks into floor');
   if(e.kind!=='hopper')assert.ok(Math.abs(e.group.position.y-e.baseY)<.001,'walker stays on ground');
  }
 }
 for(const e of r.l.enemies)if(e.kind==='hopper')assert.deepEqual([...cycles.get(e)].sort(),['crouch','leap']);
 const captured=r.l.captureData().components.filter(c=>c.t==='enemy');assert.equal(captured.length,defs.length);
 assert.deepEqual(captured,m.HOLLOWWAKE_LEVEL.components.filter(c=>c.t==='enemy'),'editor save keeps authored patrols rather than their moving pose');
 for(const full of [false,true]){
  r.l.reset(full);
  for(const e of r.l.enemies){assert.ok(e.alive);assert.ok(e.group.position.distanceTo(e.homePosition)<1e-8);assert.equal(e.baseY,e.homePosition.y);}
 }
 report.pass=true;
},{modulePath:'/src/levels/hollowwake-descent.ts',levelId:'hollowwake-descent',source:m=>m.HOLLOWWAKE_LEVEL});}catch(error){report.error=String(error.stack??error);report.pass=false;process.exitCode=1;}
await mkdir('/private/tmp/hollowwake',{recursive:true});await writeFile('/private/tmp/hollowwake/enemy-placement.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
