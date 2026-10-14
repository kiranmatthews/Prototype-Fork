import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData,BUILTIN_LEVELS}=await r.server.ssrLoadModule('/src/level.ts');
 const m=r.sourceModule,data=m.RUMBLEWATER_RUN_LEVEL,copy=normalizeCustomLevelData(r.l.captureData());
 assert.ok(copy,'the complete new level is portable through the editor schema');
 assert.deepEqual(copy.boulderChase,data.boulderChase,'capture/export/import retains the pursuit');
 assert.equal(BUILTIN_LEVELS.filter(l=>l.id==='rumblewater-run').length,1);
 assert.ok(BUILTIN_LEVELS.some(l=>l.id==='codex-lab')&&BUILTIN_LEVELS.some(l=>l.id==='custard-creek'));
 assert.equal(data.components.filter(c=>c.t==='gate').length,1);
 assert.ok(data.killY<Math.min(...data.boulderChase.path.map(p=>p[1]))-15);
 assert.ok(m.RUMBLEWATER_LENGTH/m.RUMBLEWATER_ORIGINAL_LENGTH>=3,'at least triple the original curved route length');
 assert.ok(data.components.filter(c=>c.t==='vertramp').length>=15);
 assert.ok(m.RUMBLEWATER_RAILS.length>=10&&m.RUMBLEWATER_GAPS.length>=25);
 const beats=m.RUMBLEWATER_DIFFICULTY.map(a=>a.beats.length);
 assert.ok(beats[1]>beats[0]*1.5&&beats[2]>beats[1]*1.3,'more decisions in each equally long act');
 const kinds=m.RUMBLEWATER_DIFFICULTY.map(a=>new Set(a.beats.map(b=>b.kind)));
 assert.ok(kinds[1].has('transfer')&&kinds[1].has('crumble')&&kinds[1].has('swing'),'second act introduces new traversal and timing');
 assert.ok(kinds[2].has('double-jump')&&kinds[2].has('rolling')&&kinds[2].size>=10,'final act adds skills and combines the earlier ones');
 assert.equal(data.components.filter(c=>c.t==='crate'&&c.kind==='mask').length,2,'later acts do not provide an automatic third-mask invulnerability chain');
 const cams=data.components.filter(c=>c.t==='camnode');
 assert.ok(m.rumbleProgress(cams[0].p)>m.RUMBLEWATER_END&&m.rumbleProgress(cams.at(-1).p)<0,'camera covers every act and the landing');
 for(let i=1;i<cams.length;i++)assert.ok(m.rumbleProgress(cams[i].p)<m.rumbleProgress(cams[i-1].p),'ordered reverse camera spine');
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0),origin=new r.THREE.Vector3();
 const probes=[[0,0,0],[155,-5.9,0],[217,-7,0],[289,-3,0],[400,0,0],[520,0,0],[618,7,3],[646,-7.2,0],[735,0,0],[800,0,0],[882,0,0],
  [904,0,0],[1040,0,0],[1150,0,0],[1244,-6,0],[1288,-6,0],[1344,-6,0],[1460,0,0],[1528,-4.4,0],[1572,4.4,0],[1606,1,0],
  [1686,0,0],[1724,0,0],[1808,0,0],[1918,3,0],[1985,1,0],[2048,6,0],[2060,-6,0],[2110,-6,0],[2165,-6,0],[2215,-1,0],
  [2272,0,0],[2350,0,0],[2440,1.5,0],[2525,2,0],[2560,0,0],[2600,-2.4,0],[2625,0,0],[2655,0,0],
  ...m.RUMBLEWATER_CHECKPOINTS.map(s=>[s,0,0])];
 for(const [s,u,h]of probes){
  const p=m.rumblePoint(s,m.rumbleHeight(s)+h,u);ray.set(origin.fromArray(p).add(new r.THREE.Vector3(0,1,0)),down);ray.far=2;
  const hits=r.l.raycastGround(ray).filter(h=>h.face&&h.face.normal.y>.15);
  assert.ok(hits.length,`supported authored route at ${s}/${u}`);
 }
 // Inspect the actual generated surfaces: a coarse convex backfill chord
 // must never cut through the curved native riding plane.
 let backingProbes=0,minimumBackingClearance=Infinity;const backingFailures=[];
 for(const [index,pipe]of data.components.entries())if(pipe.t==='vertramp'){
  const riding=r.l.groundMeshes.filter(mesh=>mesh.userData.editorIdx===index);
  const backing=r.l.root.children.filter(mesh=>data.components[mesh.userData.editorIdx]?.nm===pipe.nm+' · closed earth embankment');
  const points=pipe.pts;
  for(const fraction of [.25,.5,.75]){
   const i=Math.min(points.length-2,Math.floor((points.length-1)*fraction)),a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
   for(const side of [-1,1])for(const wall of [.78,.87,.94,.98]){
    const u=side*(pipe.w+pipe.rise*Math.sin(pipe.arc*Math.PI/180)*wall);
    origin.set(pipe.p[0]+(a[0]+b[0])/2-dz/length*u,pipe.p[1]+Math.max(a[3]??0,b[3]??0)+pipe.rise+3,pipe.p[2]+(a[1]+b[1])/2+dx/length*u);
    ray.set(origin,down);ray.far=pipe.rise+10;
    const top=ray.intersectObjects(riding,true)[0],soil=ray.intersectObjects(backing,true)[0];
    assert.ok(top&&soil,pipe.nm+' has both a riding skin and a continuous backing');
    const clearance=top.point.y-soil.point.y;minimumBackingClearance=Math.min(minimumBackingClearance,clearance);backingProbes++;
    if(clearance<=.08)backingFailures.push({name:pipe.nm,fraction,side,wall,clearance});
   }
  }
 }
 assert.ok(!backingFailures.length,'Pipe backing clearance: '+JSON.stringify(backingFailures));
 for(const gap of m.RUMBLEWATER_GAPS){
  const s=(gap.a+gap.b)/2,p=m.rumblePoint(s,m.rumbleHeight(s)+.2,gap.u);
  ray.set(origin.fromArray(p),down);ray.far=.45;
  assert.equal(r.l.raycastGround(ray).filter(hit=>hit.object.userData.crumbleId===undefined).length,0,`${gap.name} has no permanent hidden floor at the route height`);
 }
 console.log(JSON.stringify({pass:true,metres:m.RUMBLEWATER_LENGTH,originalMetres:m.RUMBLEWATER_ORIGINAL_LENGTH,multiplier:m.RUMBLEWATER_LENGTH/m.RUMBLEWATER_ORIGINAL_LENGTH,
  decisionsPerAct:beats,kindsPerAct:kinds.map(k=>[...k]),supportProbes:probes.length,backingProbes,minimumBackingClearance,openGapProbes:m.RUMBLEWATER_GAPS.length,
  pipes:m.RUMBLEWATER_PIPES.length,rails:m.RUMBLEWATER_RAILS.length,checkpoints:m.RUMBLEWATER_CHECKPOINTS.length,components:data.components.length}));
},{modulePath:'/src/levels/rumblewater-run.ts',levelId:'rumblewater-run',source:m=>m.RUMBLEWATER_RUN_LEVEL});
