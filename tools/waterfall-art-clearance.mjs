import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
// This lightweight source audit reads a real rendered journey. It does not
// instantiate a native scene or substitute for the final visual inspection.
const traceFile=process.argv[2]||'docs/waterfall-climb/runs/greybox-full/full-journey.json';
const b=await build({stdin:{contents:"export {WATERFALL_CLIMB_LEVEL as main} from './src/levels/waterfall-climb';export {WATERFALL_CLIMB_BONUS as bonus} from './src/levels/waterfall-climb-bonus';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const data=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const sub=(a,b)=>a.map((n,i)=>n-b[i]),dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function rayBox(from,to,b){let lo=0,hi=1;for(let i=0;i<3;i++){
 const d=to[i]-from[i];if(Math.abs(d)<1e-9){if(from[i]<b.min[i]||from[i]>b.max[i])return false;}
 else{let a=(b.min[i]-from[i])/d,z=(b.max[i]-from[i])/d;if(a>z)[a,z]=[z,a];lo=Math.max(lo,a);hi=Math.min(hi,z);}
 }return lo<hi&&hi>0&&lo<1;}
function rayTriangle(from,to,a,b,c){
 const d=sub(to,from),e1=sub(b,a),e2=sub(c,a),h=cross(d,e2),det=dot(e1,h);
 if(Math.abs(det)<1e-8)return false;const inv=1/det,s=sub(from,a),u=inv*dot(s,h);if(u<0||u>1)return false;
 const q=cross(s,e1),v=inv*dot(d,q);if(v<0||u+v>1)return false;const t=inv*dot(e2,q);return t>.001&&t<.999;
}
const report={method:'Source mesh triangle intersections and conservative full prop bounds against a recorded real-camera journey; not a replacement for rendered review.',traceFile,levels:{}};
for(const key of ['main','bonus']){
 const d=data[key],scenery=[];let triangles=0,vertices=0;
 for(const c of d.components){
  if(c.t==='decor'){
   assert.equal(c.scenerySolid,false);const r=(c.yaw??0)*Math.PI/180,dx=(Math.abs(Math.cos(r))*c.s[0]+Math.abs(Math.sin(r))*c.s[2])/2,dz=(Math.abs(Math.sin(r))*c.s[0]+Math.abs(Math.cos(r))*c.s[2])/2;
   scenery.push({name:c.nm,position:c.p,min:[c.p[0]-dx,c.p[1],c.p[2]-dz],max:[c.p[0]+dx,c.p[1]+c.s[1],c.p[2]+dz]});
  }else if(c.t==='mesh'){
   assert.equal(c.solid,false);assert.equal(c.scenerySolid,false);assert.equal(c.uvs.length,c.vertices.length/3*2);assert.ok(c.vertices.every(Number.isFinite));
   vertices+=c.vertices.length/3;triangles+=c.indices.length/3;
   const points=[];for(let k=0;k<c.vertices.length;k+=3)points.push(c.vertices.slice(k,k+3).map((n,i)=>n+c.p[i]));
   for(let k=0;k<c.indices.length;k+=3){const [a,b,c0]=c.indices.slice(k,k+3).map(i=>points[i]);assert.ok(Math.hypot(...cross(sub(b,a),sub(c0,a)))>1e-7,c.nm);}
   scenery.push({name:c.nm,position:c.p,points,indices:c.indices,min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i])))});
  }
 }
 const result=report.levels[key]={components:d.components.length,noncollidingScenery:scenery.length,authoredMeshVertices:vertices,authoredMeshTriangles:triangles,degenerateTriangles:0};
 if(key==='main'){
  const samples=JSON.parse(fs.readFileSync(traceFile,'utf8')).report.trace.filter((_,i)=>i%5===0),hits=[];let rejectedBroadBounds=0;
  for(const p of samples){const from=p.camera,to=p.position.map((v,i)=>v+(i===1?1.1:0));
   for(const b of scenery)if(rayBox(from,to,b)){
    const actual=!b.points||b.indices.some((_,i)=>i%3===0&&rayTriangle(from,to,...b.indices.slice(i,i+3).map(k=>b.points[k])));
    if(actual)hits.push({frame:p.frame,name:b.name,position:b.position,method:b.points?'triangle':'conservative prop bounds'});else rejectedBroadBounds++;
   }
  }
  Object.assign(result,{cameraBodySamples:samples.length,rejectedBroadBounds,cameraBodyHits:hits});
 }
}
fs.writeFileSync('docs/waterfall-climb/art-geometry-review.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));assert.deepEqual(report.levels.main.cameraBodyHits,[],'Scenery crosses the authored camera-to-player corridor');
