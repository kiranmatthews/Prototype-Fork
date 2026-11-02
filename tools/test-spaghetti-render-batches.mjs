import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {partitionPeriodicGeometry,VerticalLoopView}=await server.ssrLoadModule('/src/verticalLoop.ts');
 const {cityRailVisual}=await server.ssrLoadModule('/src/cityAssets.ts');
 const points=Array.from({length:37},(_,i)=>new THREE.Vector3(Math.sin(i*.6)*24,120-i*6,-i*24));
 const beam=cityRailVisual(points).children[0],geometry=beam.geometry;
 const colors=new Uint8Array(geometry.getAttribute('position').count*3);
 for(let i=0;i<colors.length;i++)colors[i]=i%251;
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
 const triangles=g=>{
  const attributes=Object.keys(g.attributes).sort(),result=[];
  for(let i=0;i<g.getAttribute('position').count;i+=3){
   const values=[];
   for(const name of attributes){const a=g.getAttribute(name);values.push(name,a.normalized,a.array.constructor.name,...a.array.slice(i*a.itemSize,(i+3)*a.itemSize));}
   result.push(JSON.stringify(values));
  }
  return result.sort();
 };
 const before=triangles(geometry),parts=partitionPeriodicGeometry(geometry);
 assert.ok(parts.size>10,'A long sloping rail receives spatially local render groups');
 assert.deepEqual([...parts.values()].flatMap(triangles).sort(),before,'Every original triangle, normal, UV and normalized color is retained exactly');
 assert.deepEqual(triangles(geometry),before,'The live source and collision geometry are untouched');
 const originalBounds=geometry.boundingBox.clone();
 for(const part of parts.values()){part.computeBoundingBox();assert.ok(part.boundingBox.max.z-part.boundingBox.min.z<160,'Chunk bounds stay local');}
 const source=new THREE.Group();source.add(beam);beam.userData.editorIdx=0;
 const view=new VerticalLoopView(source,{minY:-144,height:288},()=>true);
 view.update(new THREE.PerspectiveCamera(),390);
 assert.equal(view.diagnostics.liveCopies,0);assert.equal(view.diagnostics.staticBatches,parts.size);
 const copied=view.root.children.reduce((n,m)=>n+m.geometry.getAttribute('position').count/3,0);
 assert.equal(copied,before.length*6,'All six neighbours retain the exact full source surface');
 assert.deepEqual(geometry.boundingBox,originalBounds);
 view.dispose();for(const part of parts.values())if(part!==geometry)part.dispose();geometry.dispose();beam.material.dispose();
 console.log(JSON.stringify({triangles:before.length,localBatches:parts.size,neighbourTriangles:copied,exactGeometry:true}));
}finally{await server.close();}
