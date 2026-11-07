import * as THREE from 'three';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'meshoptimizer';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Bake the complete authored landscape into fixed spatial cells. Every vertex
// survives; the runtime's ordinary asset streaming never substitutes a mesh.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}};
async function module(path){
  const bundle=await build({entryPoints:[path],bundle:true,format:'esm',platform:'node',write:false});
  return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
}
const m=await module('src/levels/desert-canyon.ts'),v=await module('src/levels/desert-vista.ts');
const components=v.buildVista({start:m.DESERT_VISTA_START,length:m.DESERT_LENGTH,point:m.desertPoint,yaw:m.desertYaw,
  profile:m.elevationAtZ,ground:m.desertGround,width:m.desertWidth,bakeTerrain:true});
// The measured amphitheatres are open elevation sheets. Retain every source
// triangle and add separate native side walls down into the authored earth.
// Otherwise their high perimeter reveals a large opening from the road below.
await MeshoptDecoder.ready;
const surveyBytes=await readFile(new URL('../../public/desert-canyon/survey-rim.glb',import.meta.url));
const survey=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
  surveyBytes.buffer.slice(surveyBytes.byteOffset,surveyBytes.byteOffset+surveyBytes.byteLength),'');
survey.scene.updateMatrixWorld(true);const surveyParts=[];
survey.scene.traverse(o=>{if(o.isMesh)surveyParts.push(o.geometry.clone().applyMatrix4(o.matrixWorld));});
const surveyGeometry=mergeGeometries(surveyParts);for(const g of surveyParts)g.dispose();
surveyGeometry.computeBoundingBox();const surveyBox=surveyGeometry.boundingBox,surveySize=surveyBox.getSize(new THREE.Vector3()),surveyCenter=surveyBox.getCenter(new THREE.Vector3());
surveyGeometry.translate(-surveyCenter.x,-surveyBox.min.y,-surveyCenter.z);surveyGeometry.scale(1/surveySize.x,1/surveySize.y,1/surveySize.z);
const surveyEdges=new Map(),surveyIndex=surveyGeometry.index.array;
for(let i=0;i<surveyIndex.length;i+=3)for(let k=0;k<3;k++){
  const a=surveyIndex[i+k],b=surveyIndex[i+(k+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);
  const edge=surveyEdges.get(key);if(edge)edge.count++;else surveyEdges.set(key,{a,b,count:1});
}
for(const c of m.DESERT_CANYON_LEVEL.components.filter(c=>c.t==='decor'&&c.dkind==='desertsurveyrim')){
  const matrix=new THREE.Matrix4().compose(new THREE.Vector3(...c.p),new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,c.yaw*Math.PI/180),new THREE.Vector3(...c.s));
  const vertices=[],indices=[],colors=[],uvs=[];
  for(const edge of surveyEdges.values())if(edge.count===1){
    const a=new THREE.Vector3().fromBufferAttribute(surveyGeometry.attributes.position,edge.a).applyMatrix4(matrix);
    const b=new THREE.Vector3().fromBufferAttribute(surveyGeometry.attributes.position,edge.b).applyMatrix4(matrix);
    const lowerA=a.clone(),lowerB=b.clone();lowerA.y=Math.min(a.y-1,m.desertGround(a.x,a.z)-6);lowerB.y=Math.min(b.y-1,m.desertGround(b.x,b.z)-6);
    const first=vertices.length/3;
    for(const p of [a,b,lowerA,lowerB]){vertices.push(...p.toArray());colors.push(...new THREE.Color('#cb8958').toArray());uvs.push(p.x,p.z);}
    indices.push(first,first+2,first+1,first+1,first+2,first+3);
  }
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  components.push({t:'mesh',p:[0,0,0],vertices,indices,normals:Array.from(geometry.attributes.normal.array),colors,uvs,castShadow:true,grp:65});geometry.dispose();
}
surveyGeometry.dispose();
const cells=new Map();
for(const c of components){
  const key=`${c.grp}:${Math.floor((c.p[0]+684)/384)}:${Math.floor((-c.p[2]-2144)/384)}`;
  const cell=cells.get(key)??[];cell.push(c);cells.set(key,cell);
}
const out=new URL('../../public/desert-canyon/vista/',import.meta.url);await mkdir(out,{recursive:true});
const exporter=new GLTFExporter(),assets=[],placements=[],models=[];
let serial=0;
async function save(parts,shadow,ground,role){
  const geometry=mergeGeometries(parts);for(const g of parts)g.dispose();
  geometry.computeBoundingBox();const box=geometry.boundingBox,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  const position=[center.x,box.min.y,center.z],name=`terrain-${String(++serial).padStart(3,'0')}`,kind=`desertvista${serial}`;
  geometry.translate(-center.x,-box.min.y,-center.z);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;
  const bytes=Buffer.from(await exporter.parseAsync(mesh,{binary:true}));await writeFile(new URL(name+'.glb',out),bytes);
  const label=role===60?'native terrain':role===63?'rooted sandstone formations':role===65?'measured amphitheatre roots':'sculpted clay pebbles';
  assets.push(`  ${kind}:{file:'../desert-canyon/vista/${name}',label:'Canyon vista · ${label} ${serial}',size:${JSON.stringify(size.toArray())} as const,wind:false,normalStrength:0,doubleSided:false,cellSize:384,groundSurface:${ground},clay:${role===64}}`);
  placements.push({kind,p:position,s:size.toArray(),shadow,ground});
  models.push({file:name+'.glb',role,vertices:geometry.attributes.position.count,triangles:geometry.index.count/3,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  geometry.dispose();material.dispose();
}
for(const components of cells.values()){
  const ground=components[0].grp===60||components[0].grp===63;
  let parts=[],triangles=0,shadow=false;
  for(const c of components){
    const count=c.indices.length/3;
    if(triangles+count>28000&&parts.length){await save(parts,shadow,ground,components[0].grp);parts=[];triangles=0;shadow=false;}
    const g=new THREE.BufferGeometry();
    for(const [attribute,key,size] of [['position','vertices',3],['normal','normals',3],['color','colors',3],['uv','uvs',2]])
      g.setAttribute(attribute,new THREE.Float32BufferAttribute(c[key],size));
    g.setIndex(c.indices);g.translate(...c.p);parts.push(g);triangles+=count;shadow||=c.castShadow;
  }
  if(parts.length)await save(parts,shadow,ground,components[0].grp);
}
await writeFile(new URL('../../src/desertVistaCatalog.ts',import.meta.url),`// Generated by tools/desert-canyon/build-vista.mjs; complete native geometry.\nexport const DESERT_VISTA_ASSETS={\n${assets.join(',\n')}\n} as const;\nexport const VISTA_PLACEMENTS: {kind:string;p:[number,number,number];s:[number,number,number];shadow:boolean;ground:boolean}[]=${JSON.stringify(placements)};\n`);
const manifest={source:'bamyazi/RockGenerator MIT SimplexNoise; authored strata, valley, river and trail contours',geometryPolicy:'Complete native geometry in fixed spatial cells, including reflections; no distance substitutions',models};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({cells:models.length,triangles:models.reduce((sum,m)=>sum+m.triangles,0),bytes:models.reduce((sum,m)=>sum+m.bytes,0)}));
