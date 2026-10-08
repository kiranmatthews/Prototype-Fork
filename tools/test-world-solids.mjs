import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer}from'vite';
import {readFile}from'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {WorldSolids,solidContact}=await server.ssrLoadModule('/src/worldSolids.ts');
 const q={low:.4,high:1.4,radius:.4,ignoreGround:true},v=(x,y,z)=>new THREE.Vector3(x,y,z),result=solidContact();let checks=0;
 const box=(size,position=[0,1.5,0])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size));m.position.fromArray(position);m.updateMatrixWorld();return m;};
 for(const direction of [-1,1])for(const speed of [5,25,100,1000,10000]){
  const world=new WorldSolids(),wall=box([20,3,.08]);world.add(wall);
  const from=v(0,0,direction*2),to=v(0,0,-direction*speed);
  assert.equal(world.resolve(from,to,q,result),true,'thin walls cannot be crossed between fixed frames');
  assert.ok(direction*to.z>=.4399&&direction*to.z<.46);assert.ok(result.normal.z*direction>.99);checks++;world.dispose();
 }
 for(const yaw of [0,.4,1.1,2.4]){
  const world=new WorldSolids(),wall=box([1,1,1],[300,2,-600]);wall.scale.set(.15,4,20);wall.rotation.y=yaw;wall.updateMatrixWorld();world.add(wall);
  const normal=v(Math.cos(yaw),0,-Math.sin(yaw)),centre=v(300,0,-600),from=centre.clone().addScaledVector(normal,4),to=centre.clone().addScaledVector(normal,-4);
  assert.ok(world.resolve(from,to,q,result));assert.ok(to.clone().sub(centre).dot(normal)>.474);assert.ok(result.normal.dot(normal)>.999);checks++;world.dispose();
 }
 {
  const world=new WorldSolids();for(const m of [box([1,4,1],[-2,2,0]),box([1,4,1],[2,2,0]),box([5,1,1],[0,4,0])])world.add(m);
  assert.equal(world.cast(v(0,0,5),v(0,0,-5),q,result),false,'a visible arch stays open');
  assert.equal(world.cast(v(2,0,5),v(2,0,-5),q,result),true,'its actual jamb is solid');checks+=2;world.dispose();
 }
 {
  const world=new WorldSolids();world.add(box([20,.2,20],[0,-.1,0]));
  assert.equal(world.resolve(v(0,0,0),v(4,0,0),q,result),false,'existing floor solver keeps ordinary support');
  world.add(box([20,.2,20],[0,2.1,0]));const end=v(0,3,0);
  assert.equal(world.resolve(v(0,0,0),end,q,result),true,'undersides block a rising head');assert.ok(end.y<.205&&result.normal.y<-.99);checks+=2;world.dispose();
 }
 {
  const world=new WorldSolids();world.add(box([10,.3,4],[0,1.55,-2]));
  assert.ok(world.cast(v(0,0,5),v(0,0,-2),q,result),'standing body cannot pass through a low ceiling');
  assert.equal(world.cast(v(0,0,5),v(0,0,-2),{...q,low:.35,high:.65,radius:.35},result),false,'crouched body fits the actual opening');checks+=2;world.dispose();
 }
 {
  const world=new WorldSolids(),wall=box([.1,3,6],[0,1.5,0]);world.add(wall,{dynamic:true});world.beginStep();wall.position.x=3;wall.updateMatrixWorld();
  const end=v(3,0,0);assert.ok(world.resolve(v(3,0,0),end,q,result),'moving wall catches a stationary body');assert.ok(end.x>3.44);assert.ok(result.surfaceDelta.x>2.99);checks++;world.dispose();
 }
 {
  const world=new WorldSolids(),wall=box([4,4,.2]);let active=false;const surface=world.add(wall,{active:()=>active});
  assert.equal(world.cast(v(0,0,5),v(0,0,-5),q,result),false);active=true;assert.ok(world.cast(v(0,0,5),v(0,0,-5),q,result));world.remove(surface);assert.equal(world.cast(v(0,0,5),v(0,0,-5),q,result),false);assert.equal(world.diagnostics.geometries,0);checks++;world.dispose();
 }
 const m=await server.ssrLoadModule('/src/levels/custard-creek.ts'),world=new WorldSolids();
 for(const c of m.CUSTARD_CREEK_LEVEL.components.filter(c=>c.nm==='Custard spillway outer stone mass')){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(c.vertices,3));g.setIndex(c.indices);const mesh=new THREE.Mesh(g);mesh.position.fromArray(c.p);mesh.name=c.nm;mesh.updateMatrixWorld();world.add(mesh,{name:c.nm});
 }
 const frames=JSON.parse(await readFile(new URL('fixtures/custard-solid-wall-approach.json',import.meta.url),'utf8')).frames.filter(r=>r.f>=6320&&r.f<6360);let first;
 for(let i=1;i<frames.length;i++)if(world.cast(new THREE.Vector3(...frames[i-1].p),new THREE.Vector3(...frames[i].p),q,result)){first={frame:frames[i].f,name:result.surface.name,normal:result.normal.toArray(),point:result.point.toArray()};break;}
 assert.ok(first&&first.frame<6349,'exact visible replay wall blocks the capsule before its recorded penetration');checks++;
 console.log(JSON.stringify({pass:true,checks,replay:first,work:world.diagnostics}));world.dispose();
}finally{await server.close();}
