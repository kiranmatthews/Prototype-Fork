import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {Level,normalizeCustomLevelData,setEditorBuild}=await r.server.ssrLoadModule('/src/level.ts');
 const {WATERPARK_PORTAL_WORK}=await r.server.ssrLoadModule('/src/waterparkPortal.ts');
 assert.ok(normalizeCustomLevelData(r.source),'the entire decorated course stays saveable');
 const portals=r.source.components.filter(c=>c.dkind==='waterparkportal');assert.equal(portals.length,14);
 const fixture=c=>({v:1,name:'Portal edit',spawn:[0,1,0],killY:-30,components:[c,{t:'gate',p:[0,0,-10]}]});
 const sample={...portals[0],p:[12,5,-8],yaw:37,w:18,rise:9,bank:1.3,s:[1.2,.85,1.1],color:'#c9d6ba'};
 for(const patch of [{w:1},{w:121},{rise:0},{rise:81},{bank:31},{bank:-31},{solid:true},{scenerySolid:true}])
  assert.equal(normalizeCustomLevelData(fixture({...sample,...patch})),null,'invalid portal dimensions or hard collision must be rejected');
 assert.equal(normalizeCustomLevelData({...fixture(sample),components:Array.from({length:150},()=>({...sample}))}),null,'procedural geometry is charged against the existing generated-work cap');
 const reports=[];
 for(const editing of [false,true]){
  setEditorBuild(editing);const source=fixture(sample),l=new Level(new r.THREE.Scene(),{id:'portal-edit',name:source.name,data:source});
  assert.deepEqual(l.captureData(),normalizeCustomLevelData(source));l.root.updateMatrixWorld(true);
  const group=l.root.children.find(g=>g.userData.editorIdx===0);assert.ok(group);
  const meshes=[];group.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.equal(meshes.length,2);
  const resources=new Map();let work=0;
  for(const mesh of meshes){
   assert.ok(!l.groundMeshes.includes(mesh));assert.equal(mesh.userData.visualOnly,true);assert.equal(mesh.userData.edgeGrinding,false);
   const g=mesh.geometry;work+=g.attributes.position.count+g.index.count/3;
   for(const a of Object.values(g.attributes))assert.ok(a.array.every(Number.isFinite));
   for(let i=0;i<g.attributes.normal.count;i++)assert.ok(Math.abs(new r.THREE.Vector3().fromBufferAttribute(g.attributes.normal,i).length()-1)<.0001);
   for(const resource of [g,mesh.material]){resources.set(resource,0);resource.addEventListener('dispose',()=>resources.set(resource,resources.get(resource)+1));}
   assert.equal(mesh.material.map,null);assert.equal(mesh.material.normalMap,null);
   for(let i=0;i<g.index.count;i+=3){const points=[0,1,2].map(k=>new r.THREE.Vector3().fromBufferAttribute(g.attributes.position,g.index.getX(i+k)));assert.ok(points[1].sub(points[0]).cross(points[2].sub(points[0])).lengthSq()>1e-12,'no degenerate portal faces');}
  }
  assert.ok(work<=WATERPARK_PORTAL_WORK);
  const arch=meshes.find(m=>m.name.endsWith('beveled portal collar')),edges=new Map();
  for(let i=0;i<arch.geometry.index.count;i+=3){const ids=[0,1,2].map(k=>arch.geometry.index.getX(i+k));for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(',');const e=edges.get(key)??{count:0,direction:0};e.count++;e.direction+=a<b?1:-1;edges.set(key,e);}}
  assert.ok([...edges.values()].every(e=>e.count===2&&e.direction===0),'collar is closed with consistent winding');
  // Probe the opening in the edited, rotated and non-uniformly scaled frame.
  const ray=new r.THREE.Raycaster();let clear=0;
  for(const x of [-4,0,4])for(const y of [1,3,5]){
   const a=group.localToWorld(new r.THREE.Vector3(x,y,2)),b=group.localToWorld(new r.THREE.Vector3(x,y,-2));
   ray.set(a,b.clone().sub(a).normalize());ray.far=a.distanceTo(b);assert.equal(ray.intersectObjects(meshes,false).length,0);clear++;
  }
  reports.push({editing,work,clearOpeningRays:clear});l.dispose();assert.ok([...resources.values()].every(n=>n===1),'portal resources dispose exactly once');
 }
 setEditorBuild(false);console.log(JSON.stringify({portals:portals.length,reports}));
 console.log('PASS compact portals remain saveable, bounded, editable, closed, non-colliding and disposable.');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
