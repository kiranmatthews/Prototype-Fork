import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';

// Water collects in the existing kickers' low spots. Clip the actual support
// triangles at a horizontal waterline; never flatten or replace the ride mesh.
const pockets = [[1101,'Ribbon runout'],[1479,'Reservoir'],[1754,'Broken sluice'],
 [2154,'Last spillway'],[2553,'Garden dip'],[2629,'Upper pool approach'],[3028,'Skyfall approach']];
const round = n => Math.round(n*1e5)/1e5;
await withBlockworksRuntime(async r=>{
 const {RaceCourse}=await r.server.ssrLoadModule('/src/race/course.ts'),course=new RaceCourse(r.source.skateRace.line);
 const floors=r.l.groundMeshes.filter(m=>{const c=r.source.components[m.userData.editorIdx];return c&&c.grp<420&&['mesh','vertramp'].includes(c.t)&&!c.outOfBounds&&c.solid!==false;});
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0),components=[],report=[];
 for(const [s,label] of pockets){
  const centre=course.sample(s);ray.set(centre.clone().addScaledVector(down,-4),down);ray.far=8;
  const hit=ray.intersectObjects(floors,false).filter(h=>h.face?.normal.y>.2).sort((a,b)=>Math.abs(a.point.y-centre.y)-Math.abs(b.point.y-centre.y))[0];assert.ok(hit,label);
  const mesh=hit.object,position=mesh.geometry.attributes.position,index=mesh.geometry.index;
  let bottom=hit.point.y;
  for(let i=0;i<position.count;i++){const p=new r.THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);if(Math.hypot(p.x-hit.point.x,p.z-hit.point.z)<30&&Math.abs(p.y-hit.point.y)<2)bottom=Math.min(bottom,p.y);}
  let waterY=round(bottom+.22);
  const buildPocket=()=>{
   const origin=[round(hit.point.x),waterY,round(hit.point.z)],vertices=[],indices=[],uvs=[],ids=new Map();let deepest=0;
   const put=v=>{const depth=waterY-v.y;deepest=Math.max(deepest,depth);const p=[round(v.x-origin[0]),0,round(v.z-origin[2])],key=p.join(',');if(!ids.has(key)){ids.set(key,vertices.length/3);vertices.push(...p);uvs.push(round(Math.max(0,depth)),0);}return ids.get(key);};
   for(let i=0;i<(index?.count??position.count);i+=3){
    const points=[0,1,2].map(k=>new r.THREE.Vector3().fromBufferAttribute(position,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
    if(points.every(v=>v.y>waterY)||points.some(v=>Math.hypot(v.x-origin[0],v.z-origin[2])>40)||points.every(v=>v.y<waterY-1))continue;
    if(points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).y<=0)continue;
    const clipped=[];for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3],inside=a.y<=waterY;if(inside)clipped.push(a);if(inside!==(b.y<=waterY))clipped.push(a.clone().lerp(b,(waterY-a.y)/(b.y-a.y)));}
    for(let j=1;j<clipped.length-1;j++){const face=[clipped[0],clipped[j],clipped[j+1]];if(face[1].clone().sub(face[0]).cross(face[2].clone().sub(face[0])).lengthSq()>1e-12)indices.push(...face.map(put));}
   }
   assert.ok(indices.length>0,label);assert.ok(deepest<.32,`${label} is deeper than shallow rainwater: ${deepest}`);
   const component={t:'mesh',p:origin,vertices,indices,uvs,tex:'waterslide-shallows',materialStyle:'water',color:'#278f99',opacity:.84,solid:false,scenerySolid:false,edgeGrinding:false,castShadow:false,doubleSided:false,grp:435,nm:`Shallow slide pool / ${label}`};
   const edges=new Map();
   for(let i=0;i<indices.length;i+=3)for(let j=0;j<3;j++){const key=[indices[i+j],indices[i+(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)??0)+1);}
   const boundaryDepth=Math.max(0,...[...edges].filter(([,n])=>n===1).flatMap(([e])=>e.split(',').map(i=>uvs[Number(i)*2])));
   return {component,boundaryDepth,deepest};
  };
  let baked=buildPocket();
  // A few short troughs have an open downstream lip. Keep standing water
  // below that outlet instead of painting a sheet through the jump edge.
  if(baked.boundaryDepth>.001){waterY=round(waterY-baked.boundaryDepth-.012);baked=buildPocket();}
  assert.ok(baked.boundaryDepth<.001,`${label}: water must close against the floor`);
  components.push(baked.component);report.push({s,label,waterY,maxDepth:round(baked.deepest),vertices:baked.component.vertices.length/3,triangles:baked.component.indices.length/3});
 }
 await writeFile(new URL('../../src/levels/slipstream-shallow-pools.json',import.meta.url),JSON.stringify(components)+'\n');
 console.log(JSON.stringify({pools:report,totalTriangles:report.reduce((n,p)=>n+p.triangles,0)},null,2));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
