import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try {
  const {WorldSolids,solidContact}=await server.ssrLoadModule('/src/worldSolids.ts');
  const {WorldSurfaceBinding,meshScenerySolid,decorScenerySolid}=await server.ssrLoadModule('/src/worldSurfaceBinding.ts');
  const {jungleSolidRole}=await server.ssrLoadModule('/src/jungleAssets.ts');
  const root=new THREE.Group(),world=new WorldSolids(),ground=[],walls=[],owners=new WeakMap(),components=new WeakMap();
  const binding=new WorldSurfaceBinding(root,world,{ground:()=>ground,active:m=>m.userData.testActive!==false,walls:()=>walls,wallSource:b=>owners.get(b),component:m=>components.get(m)});
  const q={low:.4,high:1.4,radius:.4,ignoreGround:true},hit=solidContact(),v=(...a)=>new THREE.Vector3(...a);
  const cross=(x=0)=>world.cast(v(x,0,3),v(x,0,-3),q,hit);
  const mesh=(x=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(4,3,.1));m.position.set(x,1.5,0);return m;};
  let checks=0;
  assert.equal(cross(),false);
  const wall=mesh();wall.userData.solidSurface='mesh';root.add(wall);binding.prepare();
  assert.ok(cross(),'asynchronously attached hard geometry is solid');
  wall.visible=false;assert.ok(cross(),'distance/camera hiding never removes collision');
  const ray=new THREE.Raycaster(v(0,8,0),v(0,-1,0),0,20);
  assert.ok(ray.intersectObjects(ground,false).length,'hard scenery also supplies its real top');
  wall.removeFromParent();binding.prepare();assert.equal(cross(),false);assert.equal(ground.length,0);checks+=4;

  const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(3,3,.12),new THREE.MeshBasicMaterial(),2);
  instances.setMatrixAt(0,new THREE.Matrix4().makeTranslation(-4,1.5,0));instances.setMatrixAt(1,new THREE.Matrix4().makeTranslation(4,1.5,0));
  instances.userData.solidSurface='mesh';root.add(instances);binding.prepare();
  assert.ok(cross(-4)&&cross(4));assert.equal(cross(0),false,'instanced separation stays open');
  instances.removeFromParent();binding.prepare();assert.equal(world.surfaces.size,0);checks+=3;

  const source={t:'wall',p:[0,0,0],s:[4,3,.1]},exact=mesh();exact.rotation.y=.7;components.set(exact,source);root.add(exact);
  exact.updateWorldMatrix(true,false);const fallback=new THREE.Box3().setFromObject(exact);walls.push(fallback);owners.set(fallback,source);binding.prepare();
  assert.equal(binding.diagnostics.wallBoxes,0,'legacy AABB must not pad exact rotated corners');
  assert.equal(world.surfaces.size,1);exact.removeFromParent();binding.prepare();assert.equal(binding.diagnostics.wallBoxes,1,'authored barrier remains available before its real mesh arrives');
  walls.length=0;binding.prepare();assert.equal(world.surfaces.size,0);checks+=3;

  const phase=mesh();components.set(phase,{t:'phasepad',p:[0,0,0]});root.add(phase);ground.push(phase);binding.prepare();assert.ok(cross());
  ground.length=0;binding.prepare();assert.equal(cross(),false,'inactive phase support cannot be a ghost wall');
  ground.push(phase);binding.prepare();assert.ok(cross());root.remove(phase);ground.length=0;binding.prepare();checks+=3;

  const crumble=mesh();components.set(crumble,{t:'crumble',p:[0,0,0]});root.add(crumble);ground.push(crumble);binding.prepare();assert.ok(cross());crumble.userData.testActive=false;assert.equal(cross(),false,'falling/gone support is inactive even while retained in the ground array');root.remove(crumble);ground.length=0;binding.prepare();checks++;

  const bridge=mesh();components.set(bridge,{t:'spinbridge',p:[0,0,0]});root.add(bridge);ground.push(bridge);binding.prepare();
  ground.length=0;binding.prepare();assert.ok(cross(),'bridge body stays solid when its standing surface is inactive');root.remove(bridge);binding.prepare();checks++;

  for(const kind of ['treehousecavewall','treehousecavearch','treehouseporchhut','treehousebalcony','treehousehost','trialsv2earthbanka','coastv2ledge','templewall'])assert.equal(jungleSolidRole(kind),'mesh',kind);
  for(const kind of ['treehousecanopy','treehousebush','junglefern','trialsv2awning','treehousetrialscavematte'])assert.equal(jungleSolidRole(kind),'none',kind);
  assert.equal(jungleSolidRole('trialsv2treea'),'trunk');checks+=14;
  for(const kind of ['fern','monstera','ghoststeam','roadarrow'])assert.equal(decorScenerySolid(kind),false);
  assert.equal(decorScenerySolid('ghostclockwork'),true);checks+=5;
  const arrow={t:'mesh',p:[0,0,0],solid:false,vertices:[-1,0,1,1,0,1,0,0,-1],indices:[0,1,2]};
  assert.equal(meshScenerySolid({...arrow,tex:'treehouse-canvas',vertices:[-1,0,1,1,1,1,0,0,-1]}),false);checks++;
  assert.equal(meshScenerySolid(arrow),false);assert.equal(meshScenerySolid({...arrow,scenerySolid:true}),true);checks+=2;

  const flex=mesh();flex.userData.solidSurface='trunk';const position=flex.geometry.attributes.position;
  flex.geometry.setAttribute('aJungleFlex',new THREE.Float32BufferAttribute(Array.from({length:position.count},(_,i)=>(position.getY(i)+1.5)/3),1));
  root.add(flex);binding.prepare();assert.ok([...world.surfaces][0].geometry.attributes.position.count>0,'clipping preserves triangles crossing the rooted wind region');root.remove(flex);binding.prepare();checks++;
  const movingFloor=mesh();movingFloor.userData.solidSurface='mesh';components.set(movingFloor,{t:'mover',p:[0,0,0]});root.add(movingFloor);binding.prepare();
  assert.ok(ray.intersectObjects(ground,false).length);binding.beginStep();movingFloor.position.x=40;binding.prepare();
  assert.equal(ray.intersectObjects(ground,false).length,0,'same ray must forget a moved support');ray.ray.origin.x=40;
  assert.ok(ray.intersectObjects(ground,false).length,'a changed ray uses the new spatial cell');checks+=3;
  // The indexed path must retain every original hit, including finite angled
  // rays, nearer clipping, support identity, moving meshes and empty space.
  for(let i=0;i<120;i++){
    ray.ray.origin.set(i%3===0?40:((i*17)%97)-48,4+(i%5),((i*23)%11)-5);
    ray.ray.direction.set((i%5-2)*.08,-1,(i%7-3)*.09).normalize();ray.near=i%4*.1;ray.far=2+(i%9)*4;
    const direct=ray.intersectObjects(ground,false),indexed=binding.raycastGround(ray);
    assert.equal(indexed.length,direct.length,'indexed ray changed its hit count');
    for(let j=0;j<direct.length;j++){assert.equal(indexed[j].object,direct[j].object);assert.ok(indexed[j].point.distanceTo(direct[j].point)<1e-9);}
  }
  checks++;
  binding.dispose();assert.equal(world.surfaces.size,0);assert.equal(ground.length,0);
  root.add(mesh());assert.equal(world.surfaces.size,0,'disposed binding cannot accept late assets');checks++;

  // Rotating arms traverse an arc, not the chord connecting their end poses.
  for(const [x,z,expected]of [[3,-3,true],[4,-4,false]]){
    const rotating=new WorldSolids(),arm=new THREE.Mesh(new THREE.BoxGeometry(10,3,.1));arm.position.y=1.5;
    rotating.add(arm,{dynamic:true});rotating.beginStep();arm.rotation.y=Math.PI/2;
    assert.equal(rotating.cast(v(x,0,z),v(x,0,z),{...q,radius:.1,low:.1,high:1.7},hit),expected,'rotating arm follows its swept arc');rotating.dispose();checks++;
  }
  // Thousands of distant instances must not create thousands of triangle tests.
  const many=new WorldSolids(),shared=new THREE.BoxGeometry(3,4,.1);
  for(let i=0;i<5000;i++){const m=new THREE.Mesh(shared);m.position.set(i*40,2,0);many.add(m);}
  const start=performance.now();for(let i=0;i<1000;i++)assert.ok(many.cast(v(0,0,2),v(0,0,-2),q,hit));
  const milliseconds=(performance.now()-start)/1000;
  assert.ok(many.diagnostics.lastCandidates<=2&&many.diagnostics.lastTriangles<=24,'spatial work remains local');
  assert.equal(many.diagnostics.geometries,1,'instances share geometry acceleration');
  console.log(JSON.stringify({pass:true,checks:checks+2,queryMilliseconds:milliseconds,work:many.diagnostics}));many.dispose();
} finally {await server.close();}
