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
 setEditorBuild(false);
 const {RaceCourse}=await r.server.ssrLoadModule('/src/race/course.ts'),course=new RaceCourse(r.source.skateRace.line);
 const supportSamples=()=>Array.from({length:Math.ceil(course.length/8)},(_,i)=>course.support(r.l,i*8)?.toArray()??null);
 const supportsBefore=supportSamples(),dataBefore=JSON.stringify(r.l.captureData()),groundBefore=[...r.l.groundMeshes];
 const forest=groundBefore.filter(m=>m.name==='Tropical forest / sculpted understory floor'),matrices=forest.map(m=>[...m.matrixWorld.elements]);
 const camera=new r.THREE.PerspectiveCamera(60,1.6,.1,2000);camera.position.set(-70.094371,557.131033,-2612.599905);
 r.l.updateSceneryView(camera);r.scene.updateMatrixWorld(true);
 const wrappers=r.l.root.children.filter(o=>o.name==='Waterpark fog visibility');assert.ok(wrappers.length>100);
 assert.ok(forest.every(m=>m.parent.name==='Waterpark fog visibility'));
 assert.equal(forest[0].parent.visible,false,'upper forest more than two kilometres away cannot silhouette over the lagoon');
 assert.ok(forest.some(m=>m.parent.visible),'nearby forest stays rendered');
 assert.deepEqual(r.l.groundMeshes,groundBefore,'visibility never removes the native ground set');
 assert.deepEqual(supportSamples(),supportsBefore,'all course support queries, including distant recovery anchors, stay exact');
 for(let i=0;i<forest.length;i++)assert.deepEqual(forest[i].matrixWorld.elements,matrices[i],'identity wrappers cannot transform the return terrain');
 assert.equal(JSON.stringify(r.l.captureData()),dataBefore,'runtime culling cannot alter the portable editor data');
 const hidden=forest[0],geometry=hidden.geometry,ids=Array.from(geometry.index.array.slice(0,3));
 const centre=ids.reduce((v,i)=>v.add(new r.THREE.Vector3().fromBufferAttribute(geometry.attributes.position,i)),new r.THREE.Vector3()).multiplyScalar(1/3).applyMatrix4(hidden.matrixWorld);
 const ray=new r.THREE.Raycaster(centre.clone().add(new r.THREE.Vector3(0,1,0)),new r.THREE.Vector3(0,-1,0),0,2);
 assert.ok(ray.intersectObject(hidden,false).length,'a culled forest face remains a real recovery contact');
 const secondary=new r.THREE.PerspectiveCamera(60,1,.1,2000);secondary.position.copy(centre);
 hidden.visible=false;r.l.updateSceneryView(camera,secondary);assert.equal(hidden.parent.visible,true);assert.equal(hidden.visible,false,'secondary views must not revive logically hidden pieces');hidden.visible=true;
 r.l.updateSceneryView(camera);assert.equal(hidden.parent.visible,false);
 r.l.updateSceneryView(camera,undefined,true);assert.ok(wrappers.every(o=>o.visible),'clear editor inspection restores the whole island');
 const enabled=r.l.atmosphere.fogEnabled;r.l.atmosphere.fogEnabled=false;r.l.updateSceneryView(camera);
 assert.ok(wrappers.every(o=>o.visible),'disabling fog restores distant scenery');r.l.atmosphere.fogEnabled=enabled;
 console.log(JSON.stringify({cells:tops.length,buriedCells:buried.length,visibleTriangles,hiddenTriangles,contactRays,maxSlope,visibilityWrappers:wrappers.length,unchangedCourseSupports:supportsBefore.length}));
 console.log('PASS forest tops and distant-fog visibility: exact return contacts, course support, transforms, editor data, secondary view and clear inspection.');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
