import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {createServer} from 'vite';
import{writeFile}from'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}}),report={sphereSamples:0,cameraSamples:0,worstPenetration:0,worstFraming:0,blockedSightlines:[],foreground:[]};
try{
 const m=await server.ssrLoadModule('/src/levels/hollowwake-descent.ts'),{BoulderChase,BoulderChaseCamera}=await server.ssrLoadModule('/src/boulderChase.ts'),spec=m.HOLLOWWAKE_LEVEL.boulderChase;
 const position=[],index=[];
 for(const c of m.HOLLOWWAKE_LEVEL.components.filter(c=>c.t==='mesh'&&c.solid)){const start=position.length/3;for(let i=0;i<c.vertices.length;i++)position.push(c.vertices[i]+c.p[i%3]);index.push(...c.indices.map(i=>i+start));}
 const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(position,3));geo.setIndex(index);const tree=new MeshBVH(geo),point=new THREE.Vector3();
 const course=()=>new BoulderChase(spec,Array.from({length:6},()=>({mesh:new THREE.Mesh(),box:new THREE.Box3(),r:spec.radius,speed:0})),new THREE.Vector3(...m.HOLLOWWAKE_LEVEL.spawn));
 for(const branch of [0,1]){
  const chase=course();for(const f of chase.forks)f.choice=branch;
  for(let at=0;at<2440;at+=3){
   if(m.HOLLOWWAKE_ROOMS.some(r=>at>r.entry-spec.radius-1&&at<r.exit+spec.radius+3))continue;
   const p=m.hollowPoint(at,m.hollowFork(at)?branch:-1);chase.sampleBoulder(chase.project(new THREE.Vector3(...p)),point);point.y+=spec.radius;
   const hit=tree.closestPointToPoint(point);assert.ok(hit);
   const penetration=spec.radius-hit.distance;report.worstPenetration=Math.max(report.worstPenetration,penetration);report.sphereSamples++;
   assert.ok(penetration<.24,`boulder clips rock at ${at}/${branch}: ${penetration.toFixed(3)}m`);
  }
 }
 for(const branch of [0,1])for(const aspect of [16/9,9/16]){
  const chase=course(),rig=new BoulderChaseCamera(),camera=new THREE.PerspectiveCamera(54,aspect,.1,300);
  for(let at=0;at<2480;at+=5){
   const p=new THREE.Vector3(...m.hollowPoint(at,m.hollowFork(at)?branch:-1));chase.reset(p);for(const f of chase.forks)f.choice=branch;
   chase.actors[chase.stage].drop=0;chase.actors[chase.stage].reveal=0;rig.update(camera,chase,p,32,1/60,true);
   const near=tree.closestPointToPoint(camera.position);assert.ok(near&&near.distance>.35,`camera touches wall at ${at}/${branch}/${aspect}`);
   let inside=false;for(let s=-camera.position.z-24;s<=-camera.position.z+24;s+=.5)for(const b of m.hollowFork(s)?[0,1]:[-1]){const q=m.hollowCentre(s,b),r=m.hollowRadius(s);if(Math.hypot(camera.position.x-q[0],camera.position.y-q[1]-r,camera.position.z-q[2])<r-.35)inside=true;}
   assert.ok(inside,`camera leaves enclosure at ${at}/${branch}/${aspect}: ${camera.position.toArray()}`);
   const feet=p.clone().project(camera),head=p.clone().add(new THREE.Vector3(0,2.5,0)).project(camera),framing=Math.max(Math.abs(feet.x),Math.abs(feet.y),Math.abs(head.x),Math.abs(head.y));report.worstFraming=Math.max(report.worstFraming,framing);assert.ok(framing<.9,`hero framing ${at}`);report.cameraSamples++;
   const chest=p.clone().add(new THREE.Vector3(0,1.3,0)),direction=chest.clone().sub(camera.position),length=direction.length();
   const obstruction=tree.raycastFirst(new THREE.Ray(camera.position,direction.normalize()),THREE.DoubleSide,0,length-.2);
   if(obstruction)report.blockedSightlines.push({at,branch,aspect,distance:obstruction.distance});
   if(aspect===16/9&&!m.HOLLOWWAKE_ROOMS.some(r=>at>r.entry-50&&at<r.exit+45)){
    let visible=0;
    for(let distance=1;distance<=30;distance+=.5){const q=new THREE.Vector3(...m.hollowPoint(at+distance,m.hollowFork(at+distance)?branch:-1,0,.15)),ndc=q.clone().project(camera);if(Math.abs(ndc.x)<.9&&ndc.y>-.9&&ndc.y<.9&&ndc.z<1)visible=distance;}
    report.foreground.push(visible);
   }
  }
 }
 const foreground=report.foreground.sort((a,b)=>a-b);report.foreground={samples:foreground.length,minMetres:foreground[0],medianMetres:foreground[Math.floor(foreground.length/2)],p10Metres:foreground[Math.floor(foreground.length*.1)]};assert.ok(report.foreground.medianMetres>=18&&report.foreground.p10Metres>=17,'escape path remains visible ahead');assert.equal(report.blockedSightlines.length,0,'rock obscures the runner');report.pass=true;console.log(report);geo.dispose();
}catch(e){report.error=String(e.stack??e);console.error(report);process.exitCode=1;}finally{await writeFile('/private/tmp/hollowwake/camera-clearance.json',JSON.stringify(report,null,2));await server.close();}
