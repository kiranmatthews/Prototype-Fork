import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';

const server=await createServer({configFile:false,cacheDir:'/private/tmp/kite-clearance-test-cache',appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const report={fixtures:[],course:{}};
try{
 const {KiteFlight,KITE_FLIGHT}=await server.ssrLoadModule('/src/kiteFlight.ts');
 const {WorldSolids}=await server.ssrLoadModule('/src/worldSolids.ts');
 const {COASTAL_STREET_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
 const {meshScenerySolid}=await server.ssrLoadModule('/src/worldSurfaceBinding.ts');
 const {KITE_CANOPY_SCALE,KITE_CANOPY_OFFSET}=await server.ssrLoadModule('/src/kiteArt.ts');
 // Project the actual exported canopy vertices, including the low wingtips.
 const bytes=await readFile('public/beach-kite/canopy.glb'),len=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+len));
 const accessor=gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION],view=gltf.bufferViews[accessor.bufferView],offset=28+len+(view.byteOffset??0)+(accessor.byteOffset??0);
 const vertices=[];for(let i=0;i<accessor.count;i++)vertices.push(new THREE.Vector3(bytes.readFloatLE(offset+i*12),bytes.readFloatLE(offset+i*12+4),bytes.readFloatLE(offset+i*12+8)).multiplyScalar(KITE_CANOPY_SCALE).add(KITE_CANOPY_OFFSET));
 const bounds=new THREE.Box3().setFromPoints(vertices),matrix=new THREE.Matrix4(),unit=new THREE.Vector3(1,1,1),quat=new THREE.Quaternion();
 const flight=()=>{const f=new KiteFlight();f.canopyBounds.copy(bounds);return f;};
 const canopy=(f,p,scale=KITE_FLIGHT.canopyScale)=>bounds.clone().applyMatrix4(matrix.compose(p.clone().add(f.position),quat.setFromEuler(f.rotation),unit.setScalar(scale)));
 const addBox=(world,size,position,options={})=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial());mesh.position.fromArray(position);world.add(mesh,options);return mesh;};
 const query=new Set();
 {
  const world=new WorldSolids(),z=-KITE_FLIGHT.lead;let active=false;
  const moving=addBox(world,[8,20,8],[0,10,-300],{dynamic:true});
  addBox(world,[8,50,8],[0,25,z],{active:()=>active});
  const hidden=addBox(world,[8,80,8],[0,40,z]);hidden.material.visible=false;
  let f=flight();f.step(new THREE.Vector3(),0,0,0,0,1.6,1/60,world);assert.equal(f.position.y,KITE_FLIGHT.height,'inactive artwork and invisible containment do not raise the kite');
  moving.position.z=z;moving.visible=false; // Camera culling must not revoke clearance.
  f=flight();f.step(new THREE.Vector3(),0,0,0,0,1.6,1/60,world);
  assert.ok(canopy(f,new THREE.Vector3()).min.y>=20+KITE_FLIGHT.clearance-1e-6,'moving/camera-culled scenery is cleared');
  world.collectBoxSurfaces(new THREE.Box3(new THREE.Vector3(-5,0,z-7),new THREE.Vector3(5,60,z+8)),query);
  assert.ok([...query].some(s=>s.mesh===moving));assert.equal(query.size,2);
  active=true;world.collectBoxSurfaces(new THREE.Box3(new THREE.Vector3(-5,0,z-7),new THREE.Vector3(5,60,z+8)),query);assert.equal(query.size,3);
  assert.equal(world.surfaces.size,3,'clearance never creates physics colliders');
  report.fixtures.push('dynamic, camera-culled, inactive and invisible surfaces');world.dispose();
 }
 {
  const world=new WorldSolids();const roof=addBox(world,[30,22,26],[0,11,-145]);const f=flight(),p=new THREE.Vector3();let maxStep=0,previous=null,checked=0;
  for(let i=0;i<900;i++){
   p.z=-i*.3;f.step(p,i/60,0,0,0,1.6,1/60,world);const b=canopy(f,p);
   assert.equal(b.intersectsBox([...world.surfaces][0].bounds),false,'the complete foil must clear a roof throughout approach and departure');
   if(previous!==null)maxStep=Math.max(maxStep,Math.abs(f.position.y-previous));previous=f.position.y;checked++;
  }
  assert.ok(maxStep<.5,`anticipation prevents a late roof-height snap (${maxStep} m/frame)`);
  assert.ok(Math.abs(f.position.y-KITE_FLIGHT.height)<.12,'height settles after leaving the roof');
  f.reset();f.step(new THREE.Vector3(0,40,-700),0,0,0,0,1.6,1/60,world);assert.equal(f.position.y,KITE_FLIGHT.height,'respawn discards old height');
  f.step(new THREE.Vector3(0,0,500),0,0,0,0,1.6,1/60,world);assert.equal(f.position.y,KITE_FLIGHT.height,'large teleports reset smoothing');
  report.fixtures.push({name:'roof traversal and reset',frames:checked,maxHeightStep:maxStep});world.dispose();
 }
 // Use authored mesh bounds (not simplified replacement game geometry).
 // This includes every physical roof bed, shop wall, sign and road obstacle.
 const world=new WorldSolids();let surfaces=0;
 for(const c of source.components){
  if(c.t!=='mesh'||!c.vertices?.length||c.invisible||!meshScenerySolid(c))continue;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(c.vertices,3));if(c.indices)geometry.setIndex(c.indices);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());mesh.position.fromArray(c.p);mesh.scale.fromArray(c.s??[1,1,1]);mesh.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);world.add(mesh,{name:c.nm,owner:c});surfaces++;
 }
 const nodes=source.components.filter(c=>c.t==='camnode').sort((a,b)=>b.p[2]-a.p[2]);
 const ground=z=>{const next=nodes.findIndex(n=>n.p[2]<=z);if(next<1)return(nodes[Math.max(0,next)]??nodes.at(-1)).p[1]-2.2;const a=nodes[next-1].p,b=nodes[next].p;return THREE.MathUtils.lerp(a[1],b[1],(z-a[2])/(b[2]-a[2]))-2.2;};
 let oldIntersections=0,newIntersections=0,cases=0,screenMax=-Infinity;
 const camera=new THREE.PerspectiveCamera(58,1.6,.1,400),v=new THREE.Vector3();
 const old=new KiteFlight();
 for(let distance=0;distance<=3000;distance+=10)for(const x of [-7,-4,0,4,7])for(const wind of [-1,0,1]){
  const p=new THREE.Vector3(x,ground(-distance)+.12,-distance),f=flight(),steer=wind;
  f.step(p,0,steer,0,wind,1.6,1/60,world);
  world.collectBoxSurfaces(canopy(f,p),query);newIntersections+=query.size?1:0;
  old.position.set(1.2+steer*.65+wind*4.8,8.5,-28);old.rotation.set(.38+wind*.06,-.08*steer,-.10*steer-wind*.4);
  world.collectBoxSurfaces(canopy(old,p,1),query);oldIntersections+=query.size?1:0;cases++;
 }
 assert.equal(newIntersections,0);assert.ok(oldIntersections>100,'fixture reproduces the old roof overlap');
 // Near and far screen shapes, both gust extremes, full steering and jumps.
 const framing=[];
 for(const aspect of [16/9,1.6,1,.533,1.875])for(const wind of [-1,1])for(const steer of [-1.6,1.6])for(const lift of [0,7]){
  const p=new THREE.Vector3(-7,12+lift,0),f=flight();f.step(p,0,steer,lift,wind,aspect,1/60,world);
  camera.aspect=aspect;camera.position.set(p.x,17+lift*.35,8.2);camera.rotation.set(-16*Math.PI/180,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  matrix.compose(p.clone().add(f.position),quat.setFromEuler(f.rotation),unit.setScalar(KITE_FLIGHT.canopyScale));
  const screen={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  for(const point of vertices){v.copy(point).applyMatrix4(matrix).project(camera);screen.minX=Math.min(screen.minX,v.x);screen.maxX=Math.max(screen.maxX,v.x);screen.minY=Math.min(screen.minY,v.y);screen.maxY=Math.max(screen.maxY,v.y);}
  assert.ok(screen.minX>-1&&screen.maxX<1&&screen.minY>-1&&screen.maxY<.97,JSON.stringify({aspect,wind,steer,lift,screen}));
  screenMax=Math.max(screenMax,screen.maxY);framing.push({aspect,wind,steer,lift,screen});
 }
 report.course={surfaces,cases,oldIntersections,newIntersections};report.framing={cases:framing.length,maxCanopyScreenY:screenMax,samples:framing};report.pass=true;
 await mkdir('docs/kite-clearance',{recursive:true});await writeFile('docs/kite-clearance/clearance-check.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pass:true,fixtures:report.fixtures,course:report.course,framing:{cases:framing.length,maxCanopyScreenY:screenMax}}));world.dispose();
}finally{await server.close();}
