import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {WATERSLIDE_ASSETS}=await r.server.ssrLoadModule('/src/waterslideAssets.ts');
 const {RaceCourse}=await r.server.ssrLoadModule('/src/race/course.ts');
 const course=new RaceCourse(r.source.skateRace.line),ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0),issues=[],checks=[];
 const ground=r.l.groundMeshes.filter(m=>!m.userData.outOfBounds&&!m.userData.lethal);
 const walls=r.source.components.filter(c=>c.t==='wall');
 const wallTop=(c,p)=>{const q=p.clone().sub(new r.THREE.Vector3(...c.p)).applyAxisAngle(r.THREE.Object3D.DEFAULT_UP,-(c.yaw||0)*Math.PI/180);return Math.abs(q.x)<=c.s[0]/2+.02&&Math.abs(q.z)<=c.s[2]/2+.02?c.p[1]+c.s[1]:null;};
 for(const c of r.source.components.filter(c=>c.t==='decor'&&WATERSLIDE_ASSETS[c.dkind]&&c.scenerySolid!==false)){
  const [w,h,d]=WATERSLIDE_ASSETS[c.dkind].size.map(v=>v*(c.w||1)),yaw=(c.yaw||0)*Math.PI/180;
  const positions=[];for(const u of [-.35,.35])for(const v of [-.35,.35])positions.push(new r.THREE.Vector3(w*u,0,d*v).applyAxisAngle(r.THREE.Object3D.DEFAULT_UP,yaw).add(new r.THREE.Vector3(...c.p)));
  const clearance=[];
  for(const p of positions){
   ray.set(p.clone().add(new r.THREE.Vector3(0,2,0)),down);ray.far=5;
   const heights=ray.intersectObjects(ground,false).filter(h=>h.face?.normal.y>.1).map(h=>h.point.y);
   for(const wall of walls){const y=wallTop(wall,p);if(y!==null&&Math.abs(y-p.y)<2)heights.push(y);}
   const dy=heights.length?Math.min(...heights.map(y=>Math.abs(p.y-y))):999;clearance.push(dy);
   if(dy>.12)issues.push({name:c.nm,kind:c.dkind,p:p.toArray(),supportError:dy});
  }
  if(c.dkind!=='waterslideentrancearch')for(let s=0;s<course.length;s+=3){const p=course.sample(s),q=p.clone().sub(new r.THREE.Vector3(...c.p)).applyAxisAngle(r.THREE.Object3D.DEFAULT_UP,-yaw);if(q.y>-.5&&q.y<h+1&&Math.abs(q.x)<w/2+1.2&&Math.abs(q.z)<d/2+1.2)issues.push({name:c.nm,p:c.p,corridor:s});}
  checks.push({kind:c.dkind,p:c.p,supportError:Math.max(...clearance)});
 }
 const columnMeshes=[];r.scene.traverse(o=>{if(o.isMesh&&!o.userData.lethal)columnMeshes.push(o);});
 let columnFootProbes=0;
 for(const c of r.source.components.filter(c=>c.dkind==='waterslideflumesupport')){
  for(const x of [-3.625,3.625])for(const z of [-2.072,2.072]){
   const p=new r.THREE.Vector3(x,0,z).multiplyScalar(c.w).applyAxisAngle(r.THREE.Object3D.DEFAULT_UP,(c.yaw||0)*Math.PI/180).add(new r.THREE.Vector3(...c.p));
   ray.set(p.clone().add(new r.THREE.Vector3(0,.5,0)),down);ray.far=.8;columnFootProbes++;
   const column=ray.intersectObjects(columnMeshes,false).some(h=>h.point.y>=p.y-.1);
   // The lowest trestle feet are already buried in the actual valley floor.
   ray.set(p.clone().add(new r.THREE.Vector3(0,16,0)),down);ray.far=16;
   const buried=ray.intersectObjects(r.l.groundMeshes.filter(m=>m.userData.outOfBounds),false).some(h=>h.point.y>=p.y);
   if(!column&&!buried)issues.push({name:c.nm,unsupportedTrestleFoot:p.toArray()});
  }
 }
 const report={props:checks.length,footProbes:checks.length*4,columnFootProbes,checks,issues};
 await writeFile(process.env.WATERSLIDE_PLACEMENT_OUTPUT||'/private/tmp/waterslide-placement.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({props:report.props,footProbes:report.footProbes,columnFootProbes,issues}));assert.deepEqual(issues,[],'Props must sit on supported surfaces and leave the racing corridor clear');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
