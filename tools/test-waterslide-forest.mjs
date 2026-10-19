import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {Level,normalizeCustomLevelData,setEditorBuild}=await r.server.ssrLoadModule('/src/level.ts');
 const tops=r.source.components.filter(c=>c.nm==='Tropical forest / sculpted understory floor');
 const buried=r.source.components.filter(c=>c.nm==='Tropical forest / buried return surface');
 const triangles=[],seams=new Map();let visibleTriangles=0,hiddenTriangles=0,contactRays=0,maxSlope=0;
 assert.equal(tops.length,16);assert.ok(buried.length>0);assert.ok(normalizeCustomLevelData(r.source),'whole course stays within the editor schema and work budget');
 for(const c of [...tops,...buried]){
  assert.equal(c.solid,true);assert.equal(c.outOfBounds,true);assert.equal(c.edgeGrinding,false);
  const hidden=buried.includes(c),mesh=r.l.root.children.find(o=>o.userData.editorIdx===r.source.components.indexOf(c));
  assert.ok(mesh&&r.l.groundMeshes.includes(mesh),'both rendered tops and buried contacts stay in the ground query');
  assert.equal(mesh.visible,!hidden);assert.equal(mesh.material.side,hidden?r.THREE.DoubleSide:r.THREE.FrontSide);
  for(let i=0;i<c.vertices.length;i+=3){
   const point=c.vertices.slice(i,i+3).map((v,j)=>v+c.p[j]);assert.ok(point.every(Number.isFinite));
   const key=[point[0],point[2]].join(',');if(seams.has(key))assert.equal(point[1],seams.get(key),'shared cell seams retain exactly the same elevation');else seams.set(key,point[1]);
  }
  for(let i=0;i<c.indices.length;i+=3){
   const points=c.indices.slice(i,i+3).map(k=>new r.THREE.Vector3(...c.vertices.slice(k*3,k*3+3)).add(new r.THREE.Vector3(...c.p)));
   triangles.push(points.flatMap(p=>p.toArray().map(v=>Math.round(v*1e6))).join(','));
   const n=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));assert.ok(n.y>0&&n.length()>0);
   const slope=Math.hypot(n.x,n.z)/n.y;
   if(hidden){
    hiddenTriangles++;assert.ok(slope>2,'only stretched gorge connectors are buried');
    const centre=points.reduce((a,p)=>a.add(p),new r.THREE.Vector3()).multiplyScalar(1/3);
    const ray=new r.THREE.Raycaster(centre.clone().add(new r.THREE.Vector3(0,1,0)),new r.THREE.Vector3(0,-1,0),0,2),hit=ray.intersectObject(mesh,false)[0];
    assert.ok(hit&&Math.abs(hit.distance-1)<.001,'hidden face retains its original recovery contact');contactRays++;
   }else {visibleTriangles++;maxSlope=Math.max(maxSlope,slope);assert.ok(slope<=2,'forest top cannot stretch into a near-vertical sheet');}
  }
 }
 // Approved return triangle soup from 0d03a916, before the visual repair.
 // Sorting permits splitting into visible and buried components, while every
 // original world-space triangle and its winding must remain unchanged.
 assert.equal(triangles.length,7680);
 assert.equal(createHash('sha256').update(triangles.sort().join(';')).digest('hex'),'5520d43a341bdf78ce3a10c9333dee193053770415fd5747a413008428ce8cd9');
 const fixture={v:1,name:'Forest cut',spawn:[0,1,0],killY:-30,components:[...structuredClone([...tops.slice(-1),...buried]),{t:'gate',p:[0,0,-10]}]};
 for(const editing of [false,true]){
  setEditorBuild(editing);const level=new Level(new r.THREE.Scene(),{id:'forest-cut',name:fixture.name,data:fixture});
  assert.deepEqual(level.captureData(),normalizeCustomLevelData(fixture));level.dispose();
 }
 setEditorBuild(false);console.log(JSON.stringify({cells:tops.length,buriedCells:buried.length,visibleTriangles,hiddenTriangles,contactRays,maxSlope}));
 console.log('PASS forest tops retain clean slopes and seams; every accepted recovery triangle remains queryable and editable.');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
