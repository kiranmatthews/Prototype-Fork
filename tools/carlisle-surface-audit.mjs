import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
const before=process.argv.includes('--before'),out=process.env.CARLISLE_OUT??'docs/carlisle-relay/surface-cleanup';
let data;
if(before)data=JSON.parse(await readFile('/private/tmp/carlisle-before-surfaces.json','utf8'));
else{const b=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});data=(await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'))).CARLISLE_TIDAL_RELAY_LEVEL;}
const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function intersection(subject,clip){
 let points=subject;
 for(let e=0;e<3&&points.length;e++){
  const a=clip[e],b=clip[(e+1)%3],sign=Math.sign(cross(a,b,clip[(e+2)%3])),next=[];
  for(let i=0;i<points.length;i++){
   const p=points[i],q=points[(i+1)%points.length],dp=cross(a,b,p)*sign,dq=cross(a,b,q)*sign;
   if(dp>=0)next.push(p);
   if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
  }points=next;
 }return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;
}
const reports=[];
await withSkateRuntime(async({THREE,level,scene})=>{
 // Include the exact opposed-lift crossover phases, not just round clocks.
 const liftCross=Math.asin(.4)*2;
 for(const time of [0,liftCross,Math.PI*2-liftCross,7,Math.PI*2+liftCross,Math.PI*4-liftCross,19,53]){
  level.time=time;level.update(0);scene.updateMatrixWorld(true);
  const triangles=[],grid=new Map(),pairs=new Map();
  for(const mesh of level.groundMeshes){
   const idx=mesh.userData.editorIdx,c=data.components[idx];if(!c||!['mesh','mover','platform','trampoline'].includes(c.t))continue;
   const g=mesh.geometry,p=g.attributes.position,index=g.index;
   for(let i=0;i<(index?.count??p.count);i+=3){
    const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld));
    const normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();if(normal.y<.2)continue;
    const box=new THREE.Box3().setFromPoints(v),t={id:triangles.length,mesh,idx,name:c.nm,v,normal,box,flat:v.map(p=>[p.x,p.z])};triangles.push(t);
    const candidates=new Set();
    for(let x=Math.floor(box.min.x/16);x<=Math.floor(box.max.x/16);x++)for(let z=Math.floor(box.min.z/16);z<=Math.floor(box.max.z/16);z++){
     const key=`${x}/${z}`,bucket=grid.get(key)??[];
     for(const other of bucket)candidates.add(other);
     bucket.push(t);grid.set(key,bucket);
    }
    for(const other of candidates){
     if(other.mesh===mesh||normal.dot(other.normal)<.9999||box.min.x>=other.box.max.x||box.max.x<=other.box.min.x||box.min.z>=other.box.max.z||box.max.z<=other.box.min.z)continue;
     const gap=Math.abs(normal.dot(v[0].clone().sub(other.v[0])));if(gap>.08)continue;
     const area=intersection(t.flat,other.flat);if(area<.002)continue;
     const key=[idx,other.idx].sort((a,b)=>a-b).join('/'),row=pairs.get(key)??{names:[other.name,t.name],area:0,minGap:Infinity,at:v[0].toArray()};
     row.area+=area;row.minGap=Math.min(row.minGap,gap);pairs.set(key,row);
    }
   }
  }
  const row={time,triangles:triangles.length,conflicts:[...pairs.values()].filter(r=>r.area>.01)};reports.push(row);
  console.log(JSON.stringify(row));
 }
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
await mkdir(out,{recursive:true});await writeFile(`${out}/${before?'before':'after'}-overlap.json`,JSON.stringify(reports,null,2)+'\n');
if(!before)assert.ok(reports.every(r=>r.conflicts.length===0),'near-coplanar playable surfaces overlap');
