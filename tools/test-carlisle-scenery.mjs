import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {CarlisleSceneryCollision,carlisleSceneryFloor}=await server.ssrLoadModule('/src/carlisleSceneryCollision.ts');
 const {CARLISLE_ASSETS}=await server.ssrLoadModule('/src/carlisleAssets.ts');
 const {CARLISLE_COAST_LEVEL:main}=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 const {CameraViewFraming}=await server.ssrLoadModule('/src/cameraViews.ts');
 const camera=new THREE.PerspectiveCamera(70,1.6,.1,300),framing=new CameraViewFraming();
 framing.apply(camera,{weight:1,view:{p:[30,8,0],s:[114,48,18],yaw:0,feather:1,
  cameraPosition:[2,8.2,22],cameraTarget:[2,5.6,0],cameraFollowDistance:18,cameraFollowTargetHeight:5.3,cameraFov:56}},
  new THREE.Vector3(12,0,0),true,{groundY:0,grounded:true,dt:1/60,authoredComposition:true},
  {travel:{x:1,z:0},distance:6,dt:1/60});
 assert.ok(Math.abs(camera.position.x-12)<1e-5,'storyboard view has no unrequested look-ahead');
 assert.ok(Math.abs(Math.hypot(camera.position.y-5.3,camera.position.z)-18)<1e-5,'ordinary side-view zoom cannot crop the storyboard composition');
 assert.equal(camera.fov,56,'authored full-court lens remains readable');
 const solids=main.components.filter(c=>c.t==='decor'&&c.solid===true);
 assert.ok(solids.length>500,'real geology throughout the parent course is solid');
 assert.ok(main.components.filter(c=>c.dkind?.includes('grass')).every(c=>c.solid===false),'grass never becomes a wall');
 const cutaways=solids.filter(c=>c.nm.startsWith('Carlisle canyon mass')&&c.cameraCutaway);
 assert.ok(cutaways.some(c=>c.p[0]<30)&&cutaways.some(c=>c.p[0]>130),'both side-view turn banks are cut away');
 let landings=0,impacts=0;
 for(const kind of ['coastv2buttress','coastv2ledge','coastv2cavewall','coastv2earthbank','coastpillar','coastarch','coastbeachrock'])for(const yaw of [0,37]){
  const size=CARLISLE_ASSETS[kind].size,c={t:'decor',dkind:kind,p:[13,-4,29],s:size,yaw,solid:true};
  const owner=new CarlisleSceneryCollision(),mesh=owner.add(c);assert.ok(mesh);assert.equal(mesh.visible,false);
  const box=new THREE.Box3().setFromObject(mesh),ray=new THREE.Raycaster();
  for(const fraction of [-.2,0,.2]){
   const x=c.p[0]+fraction*size[0],z=c.p[2];
   ray.set(new THREE.Vector3(x,box.max.y+2,z),new THREE.Vector3(0,-1,0));
   const top=ray.intersectObject(mesh)[0];if(!top)continue;
   assert.ok(Math.abs(carlisleSceneryFloor(c,x,z)-top.point.y)<1e-5);landings++;
  }
  for(const f of [.28,.48,.7]){
   const y=box.min.y+size[1]*f;
   ray.set(new THREE.Vector3(c.p[0],y,box.max.z+2),new THREE.Vector3(0,0,-1));
   const hit=ray.intersectObject(mesh)[0];if(!hit)continue;
   const normal=hit.face.normal.clone().transformDirection(mesh.matrixWorld);if(normal.z<.65||Math.abs(normal.y)>.4)continue;
   const from=hit.point.clone().addScaledVector(normal,.8);from.y-=.6;
   const to=hit.point.clone().addScaledVector(normal,-.5);to.y=from.y;
   const resolved=owner.resolve(from,to,.35,1.6);
   assert.ok(resolved,`${kind}/${yaw}: real side contact prevents crossing the visible face`);
   const final=new THREE.Vector3(resolved.x,hit.point.y,resolved.z);
   assert.ok(final.clone().sub(hit.point).dot(normal)>-.1,`${kind}: capsule finishes outside the rock`);impacts++;
  }
  // Physics remains present when rendering is hidden or its LOD is retired.
  mesh.visible=false;assert.ok(mesh.geometry.boundsTree);
 }
 assert.ok(landings>=30&&impacts>=12,`meaningful real surface coverage: ${landings} tops, ${impacts} sides`);
 const arch=new CarlisleSceneryCollision();arch.add({t:'decor',dkind:'coastarch',p:[0,0,0],s:[18,11.761,6.361],solid:true});
 assert.equal(arch.resolve(new THREE.Vector3(0,1,5),new THREE.Vector3(0,1,-5),.35,1.6),null,'the real arch opening is passable, unlike an AABB');
 console.log(`PASS Carlisle scenery: ${solids.length} structural placements; ${landings} standable top probes; ${impacts} swept side contacts; open arch; both turn cutaways.`);
}finally{await server.close();}
