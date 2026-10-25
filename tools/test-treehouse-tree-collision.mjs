import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {trunkPrefix,trunkContactCases,trunkRouteCases,insideTrunk} from './treehouse-trunk-cases.mjs';
const report={sweeps:0,contacts:[],routes:[]};
await withBlockworksRuntime(async r=>{
  const {source,p,l,THREE,TUNING}=r,tuning=JSON.stringify(TUNING);
  const walls=source.components.filter(c=>c.nm?.startsWith(trunkPrefix));
  assert.ok(walls.length>=42,'opening and later reachable trunks have complete vertical coverage');
  assert.equal(walls.length%3,0);
  assert.ok(walls.every(c=>c.invisible&&c.t==='wall'&&c.edgeGrinding===false));
  const {collideTreehouseTrunks}=await r.server.ssrLoadModule('/src/levels/treehouse-tree-collision.ts');
  const original=source.components.filter(c=>!c.nm?.startsWith(trunkPrefix)),before=JSON.stringify(original);
  const rebuilt=collideTreehouseTrunks(original);
  assert.equal(JSON.stringify(original),before,'helper does not mutate the source');
  assert.deepEqual(rebuilt.slice(0,original.length),original,'all visual, route and gameplay components preserved');
  assert.deepEqual(rebuilt.slice(original.length),walls,'deterministic final placement');
  assert.ok(!walls.some(w=>insideTrunk(source.spawn,w)),'balcony spawn clear');
  for(let s=0;s<l.treehouseStairPath.length;s+=.25){const q=l.treehouseStairPath.at(s);assert.ok(!walls.some(w=>insideTrunk([q.x,q.y,q.z],w)),'stair corridor clear');}
  const {solidContact}=await r.server.ssrLoadModule('/src/worldSolids.ts');
  l.worldSurfaceBinding.prepare();
  for(const w of walls)for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const center=new THREE.Vector3(w.p[0],w.p[1]+w.s[1]/2,w.p[2]);
    const from=center.clone().add(new THREE.Vector3(dx*14,0,dz*14)),hit=solidContact();
    const own=s=>s.owner?.isBox3&&Math.abs(s.owner.min.y-w.p[1])<1e-4&&Math.abs(s.owner.max.y-w.p[1]-w.s[1])<1e-4&&s.owner.distanceToPoint(center)<8;
    assert.ok(l.worldSolids.cast(from,center,{low:0,high:0,radius:.22,ignore:s=>!own(s)},hit,false),`${w.nm}: continuous ${dx}/${dz} sweep`);
    assert.ok(hit.fraction<.99,'stop before the trunk centre');report.sweeps++;
  }
  for(const c of trunkContactCases(source)){
    const from=new THREE.Vector3(...c.start),target=new THREE.Vector3(...c.target),heading=target.clone().sub(from).setY(0).normalize();
    p.respawn(l,true,false,{position:from,heading});r.stepFor(3);
    let closest=Infinity,maxY=p.pos.y,penetrated=false;
    for(let f=0;f<c.frames;f++){
      const hold=c.mode==='skate'||c.mode==='jump'&&f<40;
      r.tick({...r.steerToward(target,{pace:c.mode==='walk'?.7:1,tolerance:0}),jumpHeld:hold});
      closest=Math.min(closest,Math.hypot(p.pos.x-target.x,p.pos.z-target.z));maxY=Math.max(maxY,p.pos.y);
      penetrated ||= c.bands.some(w=>insideTrunk(p.pos.toArray(),w));
    }
    const row={name:c.name,closest,maxY,penetrated,position:p.pos.toArray(),deaths:p.totalDeaths,bailed:p.isBailing};report.contacts.push(row);
    console.log(JSON.stringify(row));assert.equal(penetrated,false,c.name);assert.equal(p.totalDeaths,0,c.name);assert.ok(closest<5.5,`${c.name}: reaches tree vicinity`);
  }
  for(const c of trunkRouteCases){
    const from=new THREE.Vector3(...c.start),target=new THREE.Vector3(...c.target),heading=target.clone().sub(from).setY(0).normalize();
    p.respawn(l,true,false,{position:from,heading});r.stepFor(3);
    let reached=false;
    for(let f=0;f<c.frames;f++){
      r.tick(r.steerToward(target,{pace:.7,tolerance:0}));
      assert.equal(p.totalDeaths,0,c.name);assert.equal(p.isBailing,false,c.name);
      if(Math.hypot(p.pos.x-target.x,p.pos.z-target.z)<.5){reached=true;break;}
    }
    const row={name:c.name,reached,position:p.pos.toArray()};report.routes.push(row);console.log(JSON.stringify(row));assert.ok(reached,c.name);
  }
  assert.equal(JSON.stringify(TUNING),tuning);report.trees=walls.length/3;report.bands=walls.length;report.wallBoxes=l.walls.length;
},{modulePath:'/src/levels/treehouse-trail.ts',levelId:'treehouse-trail',source:m=>m.TREEHOUSE_TRAIL_LEVEL,controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile(process.env.TREEHOUSE_TRUNK_REPORT??join(tmpdir(),'treehouse-trunk-collision.json'),JSON.stringify(report,null,2));
console.log(`PASS ${report.trees} fitted trees: ${report.sweeps} continuous sweeps, ${report.contacts.length} native contact cases, ${report.routes.length} route-clearance runs.`);
