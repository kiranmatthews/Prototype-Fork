import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
const b=await build({stdin:{contents:"export * from './src/levels/waterfall-climb';export {WATERFALL_CLIMB_BONUS} from './src/levels/waterfall-climb-bonus';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const source=m.WATERFALL_CLIMB_LEVEL,meshes=[],ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),issues=[];
let topTriangles=0;
for(const c of source.components){
 let geo,p=c.p;
 if(c.t==='mesh'&&c.solid!==false){
  geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(c.vertices,3));geo.setIndex(c.indices);
  for(let i=0;i<c.grindTopTriangles*3;i+=3){const [a,b,d]=c.indices.slice(i,i+3).map(k=>c.vertices.slice(k*3,k*3+3));
   const ny=(b[2]-a[2])*(d[0]-a[0])-(b[0]-a[0])*(d[2]-a[2]);if(ny<=0)issues.push({name:c.nm,kind:'folded top',triangle:i/3,ny});topTriangles++;}
 }else if(['platform','crumble'].includes(c.t)){geo=new THREE.BoxGeometry(...c.s);if(c.t==='crumble')p=[p[0],p[1]-c.s[1]/2,p[2]];}
 if(geo){const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());mesh.position.fromArray(p);mesh.name=c.nm;mesh.updateMatrixWorld(true);meshes.push(mesh);}
}
const supported=(name,p,kind)=>{
 ray.set(new THREE.Vector3(p[0],p[1]+.25,p[2]),down);ray.far=.5;const hit=ray.intersectObjects(meshes,false)[0];
 if(!hit||Math.abs(hit.point.y-p[1])>.2)issues.push({name,kind,p,ground:hit?.point.toArray(),mesh:hit?.object.name});
};
supported('spawn',[source.spawn[0],source.spawn[1]-.12,source.spawn[2]],'spawn');
for(const a of m.WATERFALL_ACTIONS){
 if(['walk','jump','spin','mover','grind','cache','checkpoint'].includes(a.kind))supported(a.name,a.to,'destination');
 if(a.from&&['jump','spin','mover','grind'].includes(a.kind))supported(a.name,a.from,'takeoff');
}
for(const c of source.components.filter(c=>['crate','checkpoint','gate'].includes(c.t)))supported(c.nm,c.p,c.t);
assert.ok(source.components.filter(c=>['platform','mesh','crumble','rail','spinbridge'].includes(c.t)&&c.solid!==false).every(c=>c.edgeGrinding!==false),'Ordinary authored edges retain grinding');
const report={topTriangles,staticSurfaces:meshes.length,actions:m.WATERFALL_ACTIONS.length,issues};
await mkdir('docs/waterfall-climb/runs',{recursive:true});await writeFile('docs/waterfall-climb/runs/layout-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}
assert.equal(issues.length,0,'Authored landing/takeoff or walkable mesh issue');
