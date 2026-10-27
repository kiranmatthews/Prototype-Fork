import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const empty={v:1,name:'Beach Street fixture',spawn:[0,.12,0],killY:-10,components:[{t:'platform',p:[0,-.5,0],s:[20,1,20]},{t:'gate',p:[0,0,-8]}]};
const report={patrols:[],cover:[],surfaces:[],motion:[]};
await withSkateRuntime(async({server,THREE,Level,Player})=>{
 const {COASTAL_STREET_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
 const gameplay={...source,sky:'coast',ocean:undefined,unitySand:undefined,components:source.components.filter(c=>c.t!=='decor'&&c.solid!==false)};
 const l=new Level(new THREE.Scene(),{id:'beach-street-test',name:source.name,data:gameplay});
 try{
  l.root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0),0,40);
  const floor=(x,y,z)=>{ray.ray.origin.set(x,y+10,z);return l.raycastGround(ray)[0]?.point.y;};
  assert.equal(source.components.filter(c=>c.t==='gate').length,1);
  assert.equal(new Set(l.enemies.map(e=>e.kind)).size,8);
  assert.ok(l.enemies.length>=40);
  assert.equal(l.checkpoints.length,6);
  for(const e of l.enemies){
   const probes=[e.x0,(e.x0+e.x1)/2,e.x1].map(x=>({x,y:floor(x,e.baseY,e.cross)}));
   for(const p of probes){assert.ok(Number.isFinite(p.y),'Supported patrol');assert.ok(Math.abs(p.y-e.baseY)<.1,`Patrol at ${e.cross} crosses an obstacle: ${JSON.stringify(probes)} base ${e.baseY}`);assert.ok(Math.abs(p.x)<6.1,'Patrol stays within promenade');}
   report.patrols.push({kind:e.kind,z:e.cross,baseY:e.baseY,probes});
   for(const cp of l.checkpoints)assert.ok(Math.abs(e.cross-cp.spawnPos.z)>15,'Checkpoint recovery bubble');
  }
  for(const c of source.components.filter(c=>c.grp===11&&['ramp','platform','wall'].includes(c.t))){
   const top=c.t==='ramp'?c.p[1]+c.rise/2:c.t==='wall'?c.p[1]+c.s[1]:c.p[1]+c.s[1]/2;
   if(c.t!=='wall'){const y=floor(c.p[0],top,c.p[2]);assert.ok(Math.abs(y-top)<.12,`Physical top ${c.nm}: ${y} vs ${top}`);}
   assert.notEqual(c.edgeGrinding,false,'Ordinary edges retain grinding');report.surfaces.push({name:c.nm,top});
  }
  for(const e of l.enemies.filter(e=>e.kind==='sentry')){
   const cover=source.components.filter(c=>c.nm?.includes('sentry cover')&&!c.nm.includes('cap')&&!c.nm.includes('binding')).sort((a,b)=>Math.abs(a.p[2]-e.cross)-Math.abs(b.p[2]-e.cross))[0];
   const from=e.group.position.clone().add(new THREE.Vector3(0,.75,0)),target=new THREE.Vector3(cover.p[0],floor(cover.p[0],e.baseY,cover.p[2]+4)+.7,cover.p[2]+4);
   assert.ok(l.projectilePathBlocked(from,target),`Cover shields ${e.cross}`);
   const flank=target.clone();flank.x=-Math.sign(cover.p[0])*4;
   report.cover.push({sentry:e.cross,cover:cover.nm,blocked:true,flankBlocked:l.projectilePathBlocked(from,flank)});
  }
  const islands=source.components.filter(c=>c.nm?.includes('continuous submerged shore'));
  for(const rail of source.components.filter(c=>c.t==='rail'&&c.nm?.startsWith('street rail '))){
   const start=-rail.p[2],end=-(rail.p[2]+rail.pts.at(-1)[1]);
   for(const o of source.components.filter(c=>c.grp===11&&['platform','wall','ramp'].includes(c.t))){
    const halfWidth=(o.s?.[0]??o.w)/2,halfDepth=(o.s?.[2]??o.len)/2;
    assert.ok(Math.abs(rail.p[0]-o.p[0])>=halfWidth+.2||end<=-o.p[2]-halfDepth-.9||start>=-o.p[2]+halfDepth+.9,`Grind line intersects ${o.nm}`);
   }
  }
  assert.equal(islands.length,5);assert.ok(!source.components.some(c=>c.dkind?.endsWith('matte')));
  for(const c of islands){
   assert.ok(Math.min(...c.vertices.filter((_,i)=>i%3===1))<-3,'Shore extends below water');
   assert.ok(Math.min(...c.vertices.filter((_,i)=>i%3===0).map(x=>x+c.p[0]))>55,'Island never intersects road or near shoreline');
   assert.ok(c.normals.filter((_,i)=>i%3===1).some(n=>n>.9),'Upward facing shore geometry');
  }
  const p=new Player(new THREE.Scene());p.rawInput=makeInput();p.respawn(l,true);
  for(let i=0;i<90;i++){p.step(1/60,makeInput(),l);l.update(1/60);}
  assert.ok(p.grounded,'Supported spawn');report.spawn=p.pos.toArray();
  for(let i=0;i<300;i++){l.update(1/60);if(i%30===0)report.motion.push({crushers:l.crushers.map(c=>c.mesh.position.y),spinners:l.enemies.filter(e=>e.kind==='spinner').map(e=>e.state)});}
  assert.ok(report.motion.some(s=>s.spinners.includes('out'))&&report.motion.some(s=>s.spinners.includes('in')),'Timing windows remain live');
  const all=source.components;
  assert.ok(all.filter(c=>c.grp===3&&c.t==='platform').every(c=>c.color==='#a64c35'),'Stairs contrast with the paving');
  assert.ok(all.filter(c=>c.grp===4&&c.t==='platform').every(c=>c.color==='#206474'),'Ledges contrast with the paving');
  report.counts={components:all.length,enemies:l.enemies.length,crushers:l.crushers.length,crumbles:l.crumbles.length,pendulums:all.filter(c=>c.t==='pendulum').length,islands:islands.length};
 }finally{l.dispose();}
},{levelEntry:{id:'empty',name:empty.name,data:empty}});
await mkdir('docs/beach-street',{recursive:true});await writeFile('docs/beach-street/geometry.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS Beach Street patrol support, physical obstacle tops, sentry cover, safe checkpoints, live timing windows and spatial shoreline',JSON.stringify(report.counts));
