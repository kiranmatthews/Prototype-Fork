import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as THREE from 'three';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const out='art/carlisle-shipyard/deck-replacement/validation';await mkdir(out,{recursive:true});
const bundle=await build({stdin:{contents:`export {fitCarlisleDeck} from './src/carlisleBoardwalk';export {CARLISLE_TIDAL_RELAY_LEVEL,carlislePoint} from './src/levels/carlisle-tidal-relay';`,resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
await writeFile('/tmp/carlisle-deck-fit-bundle.mjs',bundle.outputFiles[0].text);
const {fitCarlisleDeck,CARLISLE_TIDAL_RELAY_LEVEL:level,carlislePoint}=await import('/tmp/carlisle-deck-fit-bundle.mjs?'+Date.now());
const glb=await readFile('public/props/carlisle-decks/solid-timber-joined.glb'),jsonLength=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+jsonLength)),binary=glb.subarray(jsonLength+28),primitive=gltf.meshes[0].primitives[0];
function accessor(i){const a=gltf.accessors[i],v=gltf.bufferViews[a.bufferView],type={5126:Float32Array,5125:Uint32Array,5123:Uint16Array}[a.componentType],n={SCALAR:1,VEC2:2,VEC3:3}[a.type],offset=(v.byteOffset??0)+(a.byteOffset??0),raw=binary.subarray(offset,offset+a.count*n*type.BYTES_PER_ELEMENT);return new THREE.BufferAttribute(new type(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),n);}
const source=new THREE.BufferGeometry();for(const [key,value] of Object.entries(primitive.attributes))source.setAttribute({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}[key],accessor(value));source.setIndex(accessor(primitive.indices));
assert.equal(source.index.count/3,23974);
const report={sourceTriangles:23974,originalTriangles:29553,slipperySurfacesExcluded:level.components.filter(c=>c.t==='mesh'&&c.solid&&c.grindTopTriangles&&c.slip).length,decks:0,sections:0,triangles:0,samples:0,outside:0,roundingDistance:0,outsideDetails:[],maxAbove:0,minBelow:0,fitMilliseconds:0,perDeck:[]};
function height(triangles,p){for(const [a,b,c] of triangles){const d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z),u=((b.z-c.z)*(p.x-c.x)+(c.x-b.x)*(p.z-c.z))/d,v=((c.z-a.z)*(p.x-c.x)+(a.x-c.x)*(p.z-c.z))/d;if(u>=-.0002&&v>=-.0002&&u+v<=1.0002)return a.y*u+b.y*v+c.y*(1-u-v);}return NaN;}
for(const c of level.components.filter(c=>c.t==='mesh'&&c.solid&&c.grindTopTriangles&&!c.slip)){
 const point=i=>new THREE.Vector3(...c.vertices.slice(i*3,i*3+3)).add(new THREE.Vector3(...c.p)),triangles=[];
 for(let i=0;i<c.grindTopTriangles*3;i+=3)triangles.push(c.indices.slice(i,i+3).map(point));
 let lo=-150,hi=4200;for(let i=0;i<15;i++){const m=(lo+hi)/2;if(carlislePoint(m,0)[2]>c.p[2])lo=m;else hi=m;}
 const s=(lo+hi)/2,direction=new THREE.Vector3(...carlislePoint(s+5,0)).sub(new THREE.Vector3(...carlislePoint(s-5,0))),start=performance.now();
 const geometries=fitCarlisleDeck(source,triangles,direction);report.fitMilliseconds+=performance.now()-start;
 let faces=0,above=0;
 for(const g of geometries){const p=g.getAttribute('position'),idx=g.index;faces+=idx.count/3;
  for(let i=0;i<idx.count;i+=3*19){const v=new THREE.Vector3();for(let k=0;k<3;k++)v.add(new THREE.Vector3().fromBufferAttribute(p,idx.getX(i+k)));v.divideScalar(3);const y=height(triangles,v);report.samples++;if(!Number.isFinite(y)){
   const flat=v.clone().setY(0),nearest=Math.min(...triangles.map(t=>new THREE.Triangle(...t.map(p=>p.clone().setY(0))).closestPointToPoint(flat,new THREE.Vector3()).distanceTo(flat)));
   if(nearest>.0005){report.outside++;report.outsideDetails.push({name:c.nm,at:v.toArray(),distance:nearest});}else report.roundingDistance=Math.max(report.roundingDistance,nearest);
  }else{above=Math.max(above,v.y-y);report.minBelow=Math.min(report.minBelow,v.y-y);}}
  assert.ok([...p.array].every(Number.isFinite),c.nm+' invalid position');g.dispose();
 }
 report.maxAbove=Math.max(report.maxAbove,above);report.decks++;report.sections+=geometries.length;report.triangles+=faces;report.perDeck.push({name:c.nm,sections:geometries.length,faces,maxAbove:above});
 assert.ok(faces>0,c.nm+' missing generated surface');
}
await writeFile(out+'/fit.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,perDeck:undefined},null,2));
assert.equal(report.outside,0,'visible timber covers unsupported course space');
assert.ok(report.maxAbove<.15,'timber rises too far above the unchanged contact');
assert.ok(report.minBelow>-1.8,'under-beams extend too far below the native decks');
assert.ok(report.minBelow<-1.5,'solid timber depth was flattened');
assert.equal(report.slipperySurfacesExcluded,18,'slippery slopes must retain their native art');
