/** Current-source geometry/objective probes, not continuous route/flow proof.
 * Real access, linked combos and sightlines require warehouse-session-browser. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,server,scene,Level,level,player:p,CONST})=>{
 level.dispose();
 const {WAREHOUSE_PARK_LEVEL:data}=await server.ssrLoadModule('/src/levels/codex-lab.ts');
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 const {surfaceBoundaryEdges}=await server.ssrLoadModule('/src/surfaceEdges.ts');
 assert.ok(normalizeCustomLevelData(structuredClone(data)),'source must survive strict import');
 const l=new Level(scene,{id:'warehouse',name:data.name,data});scene.updateMatrixWorld(true);
 p.competitionMode=false;p.endlessDeaths=true;
 const report={scope:'Structural/mechanic probes; continuous flow acceptance is separate',spawn:null,enclosure:null,halfpipe:[],grinds:[],checkpoints:[],objectives:null};
 const tick=(sample={})=>{const input=makeInput(sample);p.step(CONST.fixedStep,input,l);l.update(CONST.fixedStep);input.consumeEdges();};
 const place=(position,heading=[0,0,-1],hard=true)=>{p.respawn(l,hard,true,{position:new THREE.Vector3(...position),heading:new THREE.Vector3(...heading)});p.axisF.fromArray(heading).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);};
 const snapshot=()=>({position:p.pos.toArray(),state:p.state,grounded:p.grounded,bail:p.isBailing,speed:p.speed,tokens:l.skateCollectathon.collected});
 try{
  assert.equal(l.skatepark,true);assert.equal(data.cameraRig,undefined,'retain shared competition camera');
  assert.equal(l.alwaysSkate,false);assert.equal(l.captureData().alwaysSkate,false,'walking option survives editor capture');
  assert.equal(l.captureData().skateCollectathon,true);assert.equal(l.skateCollectathon.tokens.length,5);
  assert.equal(data.components.filter(c=>c.t==='gate').length,1,'one unambiguous exit');
  const floor=data.components.find(c=>c.nm==='Continuous concrete floor'),roof=data.components.find(c=>c.nm==='Warehouse roof / real ceiling');
  assert.ok(floor?.s&&roof?.s,'retain continuous physical floor and enclosing roof');
  const floorTop=floor.p[1]+floor.s[1]/2,ceiling=roof.p[1]-roof.s[1]/2;
  assert.ok(data.killY<floorTop-2,'recovery plane is below playable floor');
  assert.ok(ceiling>Math.max(data.spawn[1],...l.skateCollectathon.tokens.map(t=>t.y))+2,'enclosure clears reward areas');
  const roofMesh=l.groundMeshes.find(mesh=>data.components[mesh.userData.editorIdx]===roof);assert.ok(roofMesh,'roof has real collision');
  const ray=new THREE.Raycaster();let ceilingSamples=0,boundarySamples=0;
  for(const fx of[-.35,0,.35])for(const fz of[-.35,0,.35]){
   ray.set(new THREE.Vector3(floor.p[0]+floor.s[0]*fx,floorTop+.5,floor.p[2]+floor.s[2]*fz),new THREE.Vector3(0,1,0));
   const hit=ray.intersectObject(roofMesh)[0];assert.ok(hit&&Math.abs(hit.point.y-ceiling)<1e-5,'ceiling collision closes room footprint');ceilingSamples++;
  }
  assert.ok(data.components.some(c=>c.t==='wallpath'&&c.containment&&c.closed),'closed native containment surrounds park');
  for(const y of[floorTop+1,ceiling-.5])for(let i=0;i<16;i++){
   ray.set(new THREE.Vector3(floor.p[0],y,floor.p[2]),new THREE.Vector3(Math.sin(i*Math.PI/8),0,Math.cos(i*Math.PI/8)));
   assert.ok(l.containmentWalls.some(box=>ray.ray.intersectBox(box,new THREE.Vector3())),'containment closes sampled heading below roof');boundarySamples++;
  }
  report.enclosure={width:floor.s[0],depth:floor.s[2],floor:floorTop,ceiling,ceilingSamples,boundarySamples};
  place(data.spawn);for(let i=0;i<30;i++)tick();
  assert.ok(p.grounded&&!p.isBailing&&p.state!=='dead','normal spawn settles on real support');
  assert.ok(Math.abs(p.pos.y-data.spawn[1])<1,'spawn is directly above its support');assert.equal(p.freeSkate,false);report.spawn=snapshot();
  const ordinary=new Set(['platform','ramp','mesh','mover','woodpath','crumble','phasepad','spinbridge','trampoline','speedpad']);
  let boundaryCount=0,surfaceCount=0;
  for(const c of data.components)if(ordinary.has(c.t)&&c.solid!==false&&c.edgeGrinding===false)
   assert.ok(c===floor||c===roof,'ordinary riding surface disabled grinding: '+c.nm);
  for(const mesh of l.groundMeshes){
   const c=data.components[mesh.userData.editorIdx];
   if(!c||!ordinary.has(c.t)||c.solid===false||c.edgeGrinding===false||mesh.userData.vert===true||mesh.userData.finishPad||mesh.userData.startWarpPad)continue;
   const edges=surfaceBoundaryEdges(mesh);if(!edges.length)continue;surfaceCount++;
   for(const [a,b]of edges){const midpoint=a.clone().lerp(b,.5);midpoint.y+=.05;
    assert.ok(l.grindRails.some(r=>r.grindable&&r.closest(midpoint).distance<.211),'missing live grind boundary: '+c.nm);boundaryCount++;
   }
  }
  assert.ok(surfaceCount>0&&boundaryCount>0,'riding layout exposes native deck grind boundaries');report.grindBoundaries={surfaces:surfaceCount,boundaries:boundaryCount};
  const authoredRails=l.rails.filter(r=>r.grindable&&!r.coping&&Number.isInteger(r.object.userData.editorIdx)&&data.components[r.object.userData.editorIdx]?.t==='rail');
  assert.ok(authoredRails.length>0,'authored rail opportunities exist beyond deck edges');
  for(const rail of authoredRails){
   assert.ok(Number.isFinite(rail.totalLength)&&rail.totalLength>0);for(const point of rail.points)assert.ok(point.toArray().every(Number.isFinite));
   let caught=false;
   for(const fraction of [.35,.65]){
    const point=rail.pointAt(rail.totalLength*fraction),heading=rail.tangentAt(rail.totalLength*fraction);point.y+=.15;
    place(point.toArray(),heading.toArray());p.freeSkate=p.airFromSkate=true;p.speed=8;p.grounded=false;p.state='air';p.vVel=0;
    for(let i=0;i<12&&!p.isBailing;i++){tick({grindHeld:true,grindPressed:i===0,moveY:1});if(p.state==='grind'){caught=true;break;}}
    if(caught)break;
   }
   assert.ok(caught,'authored rail accepts normal aligned moving catch: '+rail.object.name);report.grinds.push({component:rail.object.userData.editorIdx,length:rail.totalLength,caught});
  }
  // Both pump directions at three stations expose obstructed transition envelopes.
  const halfpipes=data.components.filter(c=>c.t==='vertramp'&&c.vkind==='half');assert.ok(halfpipes.length>0,'park includes a reusable vert session');
  for(const c of halfpipes)for(const fraction of[-.3,0,.3])for(const side of[-1,1]){
   const yaw=(c.yaw??0)*Math.PI/180,up=new THREE.Vector3(0,1,0),offset=new THREE.Vector3(0,0,(c.len??20)*fraction).applyAxisAngle(up,yaw);
   const start=new THREE.Vector3(...c.p).add(offset);start.y+=.15;const heading=new THREE.Vector3(side,0,0).applyAxisAngle(up,yaw);
   place(start.toArray(),heading.toArray());p.freeSkate=p.airFromSkate=true;p.speed=8;
   let launched=false,landed=false,apex=p.pos.y,frames=0;
   for(;frames<1200&&!p.isBailing&&p.state!=='dead';frames++){
    launched||=p.vertAir;apex=Math.max(apex,p.pos.y);const cf=p.camDir;
    tick({moveX:launched||p.freeSkate?0:-cf.z*heading.x+cf.x*heading.z,moveY:launched?0:p.freeSkate?1:cf.x*heading.x+cf.z*heading.z,jumpHeld:true});if(launched&&p.grounded){landed=true;break;}
   }
   assert.ok(launched&&landed&&!p.isBailing,'halfpipe pump/return works without support or side snag: '+JSON.stringify({name:c.nm,fraction,side,frames,launched,landed,apex,...snapshot()}));
   assert.ok(apex>c.p[1]+(c.rise??4)+.2,'native pump clears authored coping');
   assert.equal(p.groundHit?.mesh?.userData.editorIdx,data.components.indexOf(c),'ordinary vert air returns to its transition: '+JSON.stringify({name:c.nm,fraction,side,frames,apex,heading:heading.toArray(),...snapshot()}));
   report.halfpipe.push({name:c.nm,fraction,side,frames,apex,...snapshot()});
  }
  assert.ok(l.checkpoints.length>0,'failed challenges have supported retry positions');
  for(const cp of l.checkpoints){
   place([cp.spawnPos.x,cp.box.max.y+2,cp.spawnPos.z]);let frames=0;for(;frames<240&&!cp.active;frames++)tick();assert.ok(cp.active,'checkpoint activates through player contact');
   assert.ok(l.currentSpawn.distanceTo(cp.spawnPos)<.01,'checkpoint owns actual retry spawn');
   p.respawn(l,false);for(let i=0;i<60;i++)tick();assert.ok(p.grounded&&!p.isBailing,'checkpoint respawn settles on support');report.checkpoints.push({spawn:cp.spawnPos.toArray(),frames,...snapshot()});
  }
  // Objective unit probes; rendered sessions must earn all five continuously.
  l.reset(true);const goals=l.skateCollectathon.tokens;
  for(let i=0;i<goals.length;i++){
   const token=goals[i];assert.ok(token.y>floorTop+1.35,'reward requires reaching above ordinary floor');
   for(let j=0;j<i;j++)assert.ok(!token.box.intersectsBox(goals[j].box),'distinct collectible pickup areas');
   const underside=token.box.clone();underside.min.y=token.y-3;underside.max.y=token.y;
   assert.deepEqual(l.skateCollectathon.collect(underside),[],'feet must reach reward; touching underside is insufficient');
  }
  const gate=data.components.find(c=>c.t==='gate');place([gate.p[0],gate.p[1]+1,gate.p[2]]);for(let i=0;i<90;i++)tick();assert.notEqual(p.state,'finished','exit remains locked with missing goals');
  const order=[4,1,3,0,2];for(const index of order){const token=goals[index],feet=token.box.clone();feet.min.y=token.y-1.1;feet.max.y=token.y+1.5;assert.deepEqual(l.skateCollectathon.collect(feet),[token.name],'pickup has no collection-order prerequisite');}
  assert.equal(l.skateCollectathon.collected,5);l.reset(false);assert.equal(l.skateCollectathon.collected,5,'soft retry preserves earned goals');
  place([gate.p[0],gate.p[1]+1,gate.p[2]],[0,0,-1],false);let finishFrames=0;for(;finishFrames<120&&p.state!=='finished';finishFrames++)tick();assert.equal(p.state,'finished','actual gate contact completes collected objective');
  l.reset(true);assert.equal(l.skateCollectathon.collected,0,'hard restart restores objective');
  report.objectives={count:goals.length,heights:goals.map(t=>t.y),testCollectionOrder:order.map(i=>i+1),undersideRejected:true,softRetryPreserves:true,hardResetClears:true,finishFrames};
  if(process.env.WAREHOUSE_REPORT)await writeFile(process.env.WAREHOUSE_REPORT,JSON.stringify(report,null,2));
  console.log('PASS source/enclosure/support, rail catches, deck boundaries, six-way halfpipe contacts, checkpoints and five-goal lifecycle; flow/readability requires continuous rendered sessions');
 }finally{l.dispose();}
});
